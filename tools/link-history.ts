// Правило проверки ссылок: ссылка мёртвая только после нескольких неудач подряд.
// Часть сайтов отвечает отказом на автоматические запросы, поэтому одна неудача
// ещё ничего не значит. Здесь только чистая логика, без сети и файлов.

/** Сколько проверок подряд ссылка должна не открыться, чтобы считаться мёртвой. */
export const DEAD_AFTER_FAILURES = 3;

/** Результат одной проверки ссылки. */
export interface CheckResult {
  url: string;
  ok: boolean;
  /** Что пошло не так, если страница не открылась. */
  problem?: string;
}

/** История между запусками: адрес → сколько проверок подряд он не открывался. */
export type FailureHistory = Record<string, number>;

export interface Verdict extends CheckResult {
  failuresInRow: number;
  dead: boolean;
}

/**
 * Учитывает новый запуск проверки: возвращает приговор по каждой ссылке
 * и историю, которую нужно сохранить до следующего запуска.
 */
export function judgeLinks(
  history: FailureHistory,
  results: CheckResult[],
  deadAfter: number,
): { verdicts: Verdict[]; history: FailureHistory } {
  const next: FailureHistory = {};
  const verdicts = results.map((r) => {
    const failuresInRow = r.ok ? 0 : (history[r.url] ?? 0) + 1;
    if (failuresInRow > 0) next[r.url] = failuresInRow;
    return { ...r, failuresInRow, dead: failuresInRow >= deadAfter };
  });
  return { verdicts, history: next };
}
