// Прогресс хранится только в браузере ученика (ADR 0001): полный набор
// идентификаторов освоенных узлов, выбранная ступень и признак того, что
// первый визит пройден. Браузер может не дать доступа к хранилищу (приватный
// режим, запрет сайтов) — тогда карта просто работает без сохранения.
import { normalizeProgress, normalizeStage, type LearningMap, type Progress, type StageChoice } from '../core';

const PROGRESS_KEY = 'python-map/progress';
const STAGE_KEY = 'python-map/stage';
const FIRST_VISIT_KEY = 'python-map/first-visit-done';

export function loadProgress(map: LearningMap): Set<string> {
  const ids = read(PROGRESS_KEY);
  const valid = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  return normalizeProgress(map, valid);
}

export function saveProgress(progress: Progress): void {
  write(PROGRESS_KEY, [...progress]);
}

export function loadStage(map: LearningMap): StageChoice {
  return normalizeStage(map, read(STAGE_KEY));
}

export function saveStage(stage: StageChoice): void {
  write(STAGE_KEY, stage);
}

/** Пройден ли первый визит: его шаги показываются только один раз. */
export function loadFirstVisitDone(): boolean {
  return read(FIRST_VISIT_KEY) === true;
}

export function saveFirstVisitDone(): void {
  write(FIRST_VISIT_KEY, true);
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    // Испорченная или недоступная запись — как будто её нет.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Без хранилища выбор живёт до закрытия страницы.
  }
}
