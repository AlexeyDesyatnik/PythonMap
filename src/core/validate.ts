// Проверка данных карты. Ошибки не дают опубликовать карту, предупреждения
// подсказывают, что стоит улучшить.
import type { LearningMap, MapNode } from './map.ts';
import { stageNodes } from './stages.ts';

export type IssueCode =
  | 'duplicate-id'
  | 'missing-prerequisite'
  | 'missing-target'
  | 'cycle'
  | 'section-cycle'
  | 'redundant-prerequisite'
  | 'outside-stages'
  | 'no-check-task';

export interface Issue {
  severity: 'error' | 'warning';
  code: IssueCode;
  message: string;
  /** Узлы, о которых сообщение, — в порядке упоминания. */
  nodes: string[];
}

export function validateMap(map: LearningMap): Issue[] {
  const byId = new Map<string, MapNode>();
  for (const node of map.nodes) if (!byId.has(node.id)) byId.set(node.id, node);
  const label = (id: string) => {
    const node = byId.get(id);
    return node ? `«${node.title}» (${id})` : `«${id}»`;
  };
  const sectionTitle = (node: MapNode) => map.sections.find((s) => s.id === node.sectionId)?.title ?? node.sectionId;

  const issues: Issue[] = [];
  const error = (code: IssueCode, message: string, nodes: string[]) =>
    issues.push({ severity: 'error', code, message, nodes });
  const warning = (code: IssueCode, message: string, nodes: string[]) =>
    issues.push({ severity: 'warning', code, message, nodes });

  // Повторяющиеся идентификаторы.
  const sameId = new Map<string, MapNode[]>();
  for (const node of map.nodes) sameId.set(node.id, [...(sameId.get(node.id) ?? []), node]);
  for (const [id, nodes] of sameId) {
    if (nodes.length < 2) continue;
    const where = nodes.map((n) => `«${n.title}» в разделе «${sectionTitle(n)}»`).join(', ');
    error('duplicate-id', `Идентификатор ${id} повторяется: ${where}`, [id]);
  }

  // Несуществующие пререквизиты и целевые узлы.
  for (const node of map.nodes) {
    for (const p of node.prerequisites) {
      if (!byId.has(p)) {
        error('missing-prerequisite', `У узла ${label(node.id)} пререквизит ${p}, которого нет на карте`, [node.id, p]);
      }
    }
  }
  for (const goal of map.goals) {
    for (const stage of goal.stages) {
      for (const t of stage.targets) {
        if (!byId.has(t)) {
          error(
            'missing-target',
            `В ступени «${stage.title}» (${stage.id}) цели «${goal.title}» целевой узел ${t}, которого нет на карте`,
            [t],
          );
        }
      }
    }
  }

  // Циклы.
  const cycles = findCycles(byId);
  for (const cycle of cycles) {
    error('cycle', `Цикл в пререквизитах: ${[...cycle, cycle[0]].map(label).join(' → ')}`, cycle);
  }

  // Петли между разделами: обзор карты читается снизу вверх, от основ к вершине (ADR 0003).
  if (cycles.length === 0) {
    const links = new Map<string, [string, string]>();
    const sectionDeps = new Map(map.sections.map((s) => [s.id, { prerequisites: [] as string[] }]));
    for (const node of byId.values()) {
      for (const p of node.prerequisites) {
        const from = byId.get(p)?.sectionId;
        if (!from || from === node.sectionId || !sectionDeps.has(node.sectionId)) continue;
        const key = `${from}->${node.sectionId}`;
        if (!links.has(key)) {
          links.set(key, [p, node.id]);
          sectionDeps.get(node.sectionId)!.prerequisites.push(from);
        }
      }
    }
    const sectionLabel = (id: string) => `«${map.sections.find((s) => s.id === id)?.title ?? id}»`;
    for (const loop of findCycles(sectionDeps)) {
      // Каждый следующий раздел опирается на предыдущий, первый — на последний.
      const steps = loop.map((from, i) => links.get(`${from}->${loop[(i + 1) % loop.length]}`)!);
      error(
        'section-cycle',
        `Разделы опираются друг на друга по кругу: ${[...loop, loop[0]].map(sectionLabel).join(' → ')}; ` +
          `связи: ${steps.map(([a, b]) => `${label(a)} → ${label(b)}`).join(', ')}`,
        steps.flat(),
      );
    }
  }

  // Лишние связи: A — пререквизит B, но A и так следует из другого пререквизита B.
  // Пока в карте есть цикл, цепочки ходят по кругу, и искать их бессмысленно.
  for (const node of cycles.length > 0 ? [] : map.nodes) {
    const prereqs = [...new Set(node.prerequisites)].filter((p) => byId.has(p));
    for (const a of prereqs) {
      for (const c of prereqs) {
        if (c === a) continue;
        const path = prerequisitePath(byId, a, c);
        if (!path) continue;
        warning(
          'redundant-prerequisite',
          `Лишняя связь ${label(a)} → ${label(node.id)}: она уже следует из цепочки ${[...path, node.id].map(label).join(' → ')}`,
          [a, node.id],
        );
        break;
      }
    }
  }

  // Узлы вне всех ступеней.
  const inStages = new Set<string>();
  for (const goal of map.goals) {
    const last = goal.stages.at(-1);
    if (last) for (const id of stageNodes(map, goal.id, last.id)) inStages.add(id);
  }
  for (const node of byId.values()) {
    if (!inStages.has(node.id)) {
      warning('outside-stages', `Узел ${label(node.id)} не входит ни в одну ступень`, [node.id]);
    }
  }

  // Узлы без контрольной задачи.
  for (const node of byId.values()) {
    if (node.checkTasks.length === 0) {
      warning('no-check-task', `У узла ${label(node.id)} нет контрольной задачи`, [node.id]);
    }
  }

  return issues;
}

/**
 * Циклы в пререквизитах, каждый — один раз. Узлы цикла идут по стрелкам:
 * каждый следующий опирается на предыдущий, а первый — на последний.
 */
function findCycles(byId: Map<string, { prerequisites: string[] }>): string[][] {
  const state = new Map<string, 'active' | 'done'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  const visit = (id: string) => {
    state.set(id, 'active');
    stack.push(id);
    for (const p of byId.get(id)!.prerequisites) {
      if (!byId.has(p)) continue;
      if (state.get(p) === 'active') {
        // В стеке каждый следующий узел — пререквизит предыдущего; разворачиваем по стрелкам.
        const cycle = stack.slice(stack.indexOf(p)).reverse();
        const start = cycle.indexOf([...cycle].sort()[0]);
        const normalized = [...cycle.slice(start), ...cycle.slice(0, start)];
        const key = normalized.join(' ');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(normalized);
        }
      } else if (!state.has(p)) {
        visit(p);
      }
    }
    stack.pop();
    state.set(id, 'done');
  };

  for (const id of byId.keys()) if (!state.has(id)) visit(id);
  return cycles;
}

/** Цепочка по стрелкам от `from` до `to`, если `from` — пререквизит `to` по цепочке. */
function prerequisitePath(byId: Map<string, MapNode>, from: string, to: string): string[] | undefined {
  // Идём от `to` вниз по пререквизитам и запоминаем, откуда пришли.
  const cameFrom = new Map<string, string | null>([[to, null]]);
  const queue = [to];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (cameFrom.has(p) || !byId.has(p)) continue;
      cameFrom.set(p, id);
      if (p === from) {
        const path = [from];
        for (let next = cameFrom.get(from); next; next = cameFrom.get(next)) path.push(next);
        return path;
      }
      queue.push(p);
    }
  }
  return undefined;
}
