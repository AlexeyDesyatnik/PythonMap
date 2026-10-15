// Маршрут до выбранной ступени: неосвоенные узлы ступени в порядке, который
// не нарушает пререквизиты.
import type { LearningMap } from './map.ts';
import type { Progress } from './progress.ts';
import { stageNodes } from './stages.ts';
import type { StageChoice } from './views.ts';

/** Маршрут; первый узел — следующий шаг. Пустой маршрут — ступень достигнута. */
export function route(map: LearningMap, progress: Progress, stage: NonNullable<StageChoice>): string[] {
  const inStage = stageNodes(map, stage.goalId, stage.stageId);
  // Узлы ещё не в маршруте, в порядке автора.
  let left = map.nodes.filter((n) => inStage.has(n.id) && !progress.has(n.id));
  const done = new Set(progress);
  const result: string[] = [];
  // Каждый раз берём первый по порядку автора узел, все пререквизиты которого
  // уже освоены или стоят в маршруте раньше.
  while (left.length > 0) {
    const next = left.find((n) => n.prerequisites.every((p) => done.has(p)));
    // Готового узла нет только при цикле — его не пропускает проверка данных.
    if (!next) break;
    result.push(next.id);
    done.add(next.id);
    left = left.filter((n) => n !== next);
  }
  return result;
}
