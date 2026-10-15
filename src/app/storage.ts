// Прогресс хранится только в браузере ученика (ADR 0001): полный набор
// идентификаторов освоенных узлов. Браузер может не дать доступа к хранилищу
// (приватный режим, запрет сайтов) — тогда карта просто работает без сохранения.
import { normalizeProgress, type LearningMap, type Progress } from '../core';

const PROGRESS_KEY = 'python-map/progress';

export function loadProgress(map: LearningMap): Set<string> {
  let ids: unknown = [];
  try {
    ids = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
  } catch {
    // Испорченная или недоступная запись — начинаем с пустого прогресса.
  }
  const valid = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  return normalizeProgress(map, valid);
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...progress]));
  } catch {
    // Без хранилища прогресс живёт до закрытия страницы.
  }
}
