// Отметки освоенных узлов. Прогресс всегда замкнут вниз: вместе с узлом
// освоены все его пререквизиты (ADR 0002).
import type { LearningMap } from './map.ts';
import { withPrerequisites, withReliantNodes } from './stages.ts';

/** Прогресс — множество идентификаторов освоенных узлов. */
export type Progress = ReadonlySet<string>;

/** Отметка: узел и все его пререквизиты по цепочке становятся освоенными. */
export function markMastered(map: LearningMap, progress: Progress, id: string): Set<string> {
  return new Set([...progress, ...withPrerequisites(map, [id])]);
}

/**
 * С каких ещё узлов снимется отметка вместе с этим: освоенные узлы, которые
 * опираются на него по цепочке. В порядке карты, без самого узла.
 */
export function unmarkAffected(map: LearningMap, progress: Progress, id: string): string[] {
  const reliant = withReliantNodes(map, [id]);
  return map.nodes.map((n) => n.id).filter((n) => n !== id && progress.has(n) && reliant.has(n));
}

/**
 * Сохранённый прогресс, приведённый к инварианту: идентификаторы, которых нет
 * на карте, отбрасываются молча, недостающие пререквизиты отмечаются.
 */
export function normalizeProgress(map: LearningMap, ids: Iterable<string>): Set<string> {
  return withPrerequisites(map, ids);
}

/** Снятие отметки: узел и все опирающиеся на него по цепочке перестают быть освоенными. */
export function unmarkMastered(map: LearningMap, progress: Progress, id: string): Set<string> {
  const reliant = withReliantNodes(map, [id]);
  return new Set([...progress].filter((n) => !reliant.has(n)));
}

/**
 * Свёртка прогресса для ссылки: только «верхние» освоенные узлы — те, на
 * которые не опирается ни один другой освоенный. Остальное восстановит
 * каскад при разворачивании. В порядке карты.
 */
export function foldProgress(map: LearningMap, progress: Progress): string[] {
  const below = new Set<string>();
  for (const node of map.nodes) {
    if (progress.has(node.id)) for (const p of node.prerequisites) below.add(p);
  }
  return map.nodes.map((n) => n.id).filter((id) => progress.has(id) && !below.has(id));
}

/** Прогресс из ссылки: каскад от её узлов; узлов, которых нет на карте, молча нет. */
export function unfoldProgress(map: LearningMap, ids: Iterable<string>): Set<string> {
  return normalizeProgress(map, ids);
}

/** Объединение: освоено всё, что освоено хотя бы в одном из двух. */
export function mergeProgress(a: Progress, b: Progress): Set<string> {
  return new Set([...a, ...b]);
}
