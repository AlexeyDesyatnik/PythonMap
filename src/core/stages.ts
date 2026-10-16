import type { LearningMap } from './map.ts';

/**
 * Состав ступени: целевые узлы этой и всех предыдущих ступеней той же цели
 * плюс все их пререквизиты по цепочке. Несуществующие узлы пропускаются —
 * о них сообщает проверка данных.
 */
export function stageNodes(map: LearningMap, goalId: string, stageId: string): Set<string> {
  const goal = map.goals.find((g) => g.id === goalId);
  if (!goal) throw new Error(`Цели ${goalId} нет`);
  const index = goal.stages.findIndex((s) => s.id === stageId);
  if (index < 0) throw new Error(`Ступени ${stageId} нет в цели ${goalId}`);

  const targets = goal.stages.slice(0, index + 1).flatMap((s) => s.targets);
  return withPrerequisites(map, targets);
}

/** Узлы вместе со всеми их пререквизитами по цепочке. */
export function withPrerequisites(map: LearningMap, ids: Iterable<string>): Set<string> {
  const prerequisites = new Map(map.nodes.map((n) => [n.id, n.prerequisites]));
  return reachable(ids, prerequisites);
}

/** Узлы вместе со всеми, кто опирается на них по цепочке. */
export function withReliantNodes(map: LearningMap, ids: Iterable<string>): Set<string> {
  const reliant = new Map(map.nodes.map((n) => [n.id, [] as string[]]));
  for (const node of map.nodes) {
    for (const p of node.prerequisites) reliant.get(p)?.push(node.id);
  }
  return reachable(ids, reliant);
}

/** Узлы, которые узел открывает: те, для кого он прямой пререквизит. В порядке карты. */
export function unlockedNodes(map: LearningMap, id: string): string[] {
  return map.nodes.filter((n) => n.prerequisites.includes(id)).map((n) => n.id);
}

/** Всё, куда можно дойти от `ids` по стрелкам `next`; узлы не из `next` пропускаются. */
function reachable(ids: Iterable<string>, next: Map<string, string[]>): Set<string> {
  const result = new Set<string>();
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id) || !next.has(id)) continue;
    result.add(id);
    stack.push(...next.get(id)!);
  }
  return result;
}
