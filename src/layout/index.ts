// Раскладка карты в два уровня (ADR 0003): обзор разделов и граф каждого
// раздела. Считается при сборке сайта, каждый раздел — отдельно от остальных,
// поэтому правка одного раздела не сдвигает узлы в других.
import { stageNodes, type LearningMap, type MapNode } from '../core/index.ts';
import { layered, MARGIN, type Box, type Edge } from './layered.ts';

export type { Box, Edge } from './layered.ts';

export interface OverviewLayout {
  width: number;
  height: number;
  sections: (Box & { id: string })[];
  /** Основные стрелки между разделами: связь, следующая из цепочки других, скрыта. */
  edges: Edge[];
}

/** Темы другого раздела, на которые опираются темы этого. */
export interface ExternalBlock extends Box {
  sectionId: string;
  /** Темы раздела-источника в порядке карты. */
  nodeIds: string[];
}

export interface SectionGraphLayout {
  kind: 'graph';
  width: number;
  height: number;
  nodes: (Box & { id: string })[];
  blocks: ExternalBlock[];
  /** Стрелки от пререквизита к узлу; стрелка от блока начинается с `section:<раздел>`. */
  edges: Edge[];
}

/** Ряд заданий ЕГЭ одной ступени. */
export interface TaskRow {
  title: string;
  nodeIds: string[];
  /** Верх и высота полосы ряда; подпись ряда стоит слева. */
  y: number;
  height: number;
}

/** Раздел заданий ЕГЭ: задания не опираются друг на друга, поэтому они стоят рядами по ступеням. */
export interface SectionRowsLayout {
  kind: 'rows';
  width: number;
  height: number;
  /** Ряды снизу вверх: от ближней ступени к дальней, последний — задания вне ступеней. */
  rows: TaskRow[];
  /** `basedOn` — разделы, на которые опирается задание, в порядке карты. */
  nodes: (Box & { id: string; basedOn: string[] })[];
}

export type SectionLayout = SectionGraphLayout | SectionRowsLayout;

export interface MapLayout {
  overview: OverviewLayout;
  /** Раскладка каждого раздела по его идентификатору. */
  sections: Record<string, SectionLayout>;
}

export const SECTION_W = 210;
export const SECTION_H = 84;
export const NODE_W = 180;
export const NODE_H = 54;
export const BLOCK_W = 180;
/** Заголовок блока и строка на каждую тему. */
export const BLOCK_HEADER = 30;
export const BLOCK_LINE = 18;
export const TASK_W = 230;
export const TASK_H = 96;
export const ROW_LABEL_W = 150;
const TASKS_PER_LINE = 3;
const TASK_GAP = 20;
const ROW_GAP = 28;

export function mapLayout(map: LearningMap): MapLayout {
  return {
    overview: overviewLayout(map),
    sections: Object.fromEntries(map.sections.map((s) => [s.id, sectionLayout(map, s.id)])),
  };
}

export const blockKey = (sectionId: string) => `section:${sectionId}`;

function sectionLayout(map: LearningMap, sectionId: string): SectionLayout {
  const own = map.nodes.filter((n) => n.sectionId === sectionId);
  if (own.length > 0 && own.every((n) => n.kind === 'ege-task')) return taskRows(map, own);
  const sectionOf = new Map(map.nodes.map((n) => [n.id, n.sectionId]));

  // Внешние пререквизиты, собранные по разделам-источникам.
  const external = new Map<string, Set<string>>();
  const links: { from: string; to: string }[] = [];
  for (const node of own) {
    const seen = new Set<string>();
    for (const p of node.prerequisites) {
      const from = sectionOf.get(p);
      if (!from) continue;
      if (from === sectionId) {
        links.push({ from: p, to: node.id });
        continue;
      }
      if (!external.has(from)) external.set(from, new Set());
      external.get(from)!.add(p);
      if (!seen.has(from)) {
        seen.add(from);
        links.push({ from: blockKey(from), to: node.id });
      }
    }
  }
  const blocks = map.sections
    .filter((s) => external.has(s.id))
    .map((s) => ({ sectionId: s.id, nodeIds: s.nodeIds.filter((id) => external.get(s.id)!.has(id)) }));

  const result = layered(
    [
      ...own.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      ...blocks.map((b) => ({
        id: blockKey(b.sectionId),
        width: BLOCK_W,
        height: BLOCK_HEADER + b.nodeIds.length * BLOCK_LINE + 8,
      })),
    ],
    links,
  );
  return {
    kind: 'graph',
    width: result.width,
    height: result.height,
    nodes: own.map((n) => ({ id: n.id, ...result.boxes.get(n.id)! })),
    blocks: blocks.map((b) => ({ ...b, ...result.boxes.get(blockKey(b.sectionId))! })),
    edges: result.edges,
  };
}

function overviewLayout(map: LearningMap): OverviewLayout {
  const result = layered(
    map.sections.map((s) => ({ id: s.id, width: SECTION_W, height: SECTION_H })),
    mainSectionLinks(map),
  );
  return {
    width: result.width,
    height: result.height,
    sections: [...result.boxes].map(([id, box]) => ({ id, ...box })),
    edges: result.edges,
  };
}

/** Связи между разделами без тех, что следуют из цепочки других. */
function mainSectionLinks(map: LearningMap): { from: string; to: string }[] {
  const sectionOf = new Map(map.nodes.map((n) => [n.id, n.sectionId]));
  const deps = new Map(map.sections.map((s) => [s.id, new Set<string>()]));
  for (const node of map.nodes) {
    for (const p of node.prerequisites) {
      const from = sectionOf.get(p);
      if (from && from !== node.sectionId) deps.get(node.sectionId)?.add(from);
    }
  }
  // Всё, на что раздел опирается по цепочке.
  const below = new Map<string, Set<string>>();
  const belowOf = (id: string, visiting = new Set<string>()): Set<string> => {
    if (below.has(id)) return below.get(id)!;
    const result = new Set<string>();
    if (visiting.has(id)) return result;
    visiting.add(id);
    for (const d of deps.get(id) ?? []) {
      result.add(d);
      for (const x of belowOf(d, visiting)) result.add(x);
    }
    below.set(id, result);
    return result;
  };

  const links: { from: string; to: string }[] = [];
  for (const section of map.sections) {
    const direct = [...deps.get(section.id)!];
    for (const from of direct) {
      const implied = direct.some((other) => other !== from && belowOf(other).has(from));
      if (!implied) links.push({ from, to: section.id });
    }
  }
  return links;
}

/** Ряд задания — первая по порядку ступень, в которую оно входит. */
function taskRows(map: LearningMap, tasks: MapNode[]): SectionRowsLayout {
  const stages = map.goals.flatMap((g) =>
    g.stages.map((s) => ({ title: s.title, nodes: stageNodes(map, g.id, s.id) })),
  );
  const groups = [...stages.map((s) => ({ title: s.title, nodeIds: [] as string[] })), { title: 'Вне ступеней', nodeIds: [] as string[] }];
  for (const task of tasks) {
    const i = stages.findIndex((s) => s.nodes.has(task.id));
    groups[i < 0 ? stages.length : i].nodeIds.push(task.id);
  }
  const used = groups.filter((g) => g.nodeIds.length > 0);

  // Полосы рядов сверху вниз, начиная с последнего (самого дальнего).
  const lines = (g: { nodeIds: string[] }) => Math.ceil(g.nodeIds.length / TASKS_PER_LINE);
  const totalHeight =
    used.reduce((s, g) => s + lines(g) * TASK_H + (lines(g) - 1) * TASK_GAP, 0) + (used.length - 1) * ROW_GAP;
  const sectionOf = new Map(map.nodes.map((n) => [n.id, n.sectionId]));
  const sectionOrder = map.sections.map((s) => s.id);

  const rows: TaskRow[] = [];
  const boxes = new Map<string, Box>();
  let bottom = MARGIN + totalHeight;
  for (const g of used) {
    const height = lines(g) * TASK_H + (lines(g) - 1) * TASK_GAP;
    const y = bottom - height;
    rows.push({ ...g, y, height });
    g.nodeIds.forEach((id, i) => {
      boxes.set(id, {
        x: MARGIN + ROW_LABEL_W + (i % TASKS_PER_LINE) * (TASK_W + TASK_GAP),
        y: y + Math.floor(i / TASKS_PER_LINE) * (TASK_H + TASK_GAP),
        width: TASK_W,
        height: TASK_H,
      });
    });
    bottom = y - ROW_GAP;
  }
  const widest = Math.max(...used.map((g) => Math.min(g.nodeIds.length, TASKS_PER_LINE)));
  return {
    kind: 'rows',
    width: MARGIN * 2 + ROW_LABEL_W + widest * TASK_W + (widest - 1) * TASK_GAP,
    height: MARGIN * 2 + totalHeight,
    rows,
    nodes: tasks.map((t) => {
      const sections = new Set(t.prerequisites.map((p) => sectionOf.get(p)).filter((s) => s && s !== t.sectionId));
      return { id: t.id, ...boxes.get(t.id)!, basedOn: sectionOrder.filter((s) => sections.has(s)) };
    }),
  };
}
