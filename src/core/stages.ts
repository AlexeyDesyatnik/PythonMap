import type { LearningMap } from './map';

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
  const result = new Set<string>();
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id) || !prerequisites.has(id)) continue;
    result.add(id);
    stack.push(...prerequisites.get(id)!);
  }
  return result;
}
