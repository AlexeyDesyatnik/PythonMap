import { describe, expect, it } from 'vitest';
import { judgeLinks, type CheckResult, type FailureHistory } from './link-history.ts';

const ok = (url: string): CheckResult => ({ url, ok: true });
const failed = (url: string, problem = 'ответ 503'): CheckResult => ({ url, ok: false, problem });

/** Прогоняет несколько запусков подряд, каждый раз сохраняя историю. */
const runs = (deadAfter: number, ...checks: CheckResult[][]) => {
  let history: FailureHistory = {};
  let last: ReturnType<typeof judgeLinks> | undefined;
  for (const results of checks) {
    last = judgeLinks(history, results, deadAfter);
    history = last.history;
  }
  return last!;
};

describe('judgeLinks', () => {
  it('не считает ссылку мёртвой, пока неудач подряд меньше порога', () => {
    const verdicts = runs(3, [failed('a')], [failed('a')]).verdicts;

    expect(verdicts).toEqual([{ url: 'a', ok: false, problem: 'ответ 503', failuresInRow: 2, dead: false }]);
  });

  it('считает ссылку мёртвой, когда неудач подряд набралось столько, сколько задано порогом', () => {
    const { verdicts } = runs(3, [failed('a'), failed('b')], [failed('a'), ok('b')], [failed('a'), failed('b')]);

    expect(verdicts.map((v) => [v.url, v.failuresInRow, v.dead])).toEqual([
      ['a', 3, true],
      ['b', 1, false],
    ]);
  });

  it('открывшаяся страница обнуляет счёт неудач', () => {
    const { verdicts } = runs(2, [failed('a')], [failed('a')], [ok('a')], [failed('a')]);

    expect(verdicts.map((v) => [v.url, v.failuresInRow, v.dead])).toEqual([['a', 1, false]]);
  });

  it('помнит между запусками только ссылки, которые сейчас не открываются', () => {
    // b открылась, c убрали с карты — их история больше не нужна.
    const { history } = judgeLinks({ a: 1, b: 2, c: 5 }, [failed('a'), ok('b')], 3);

    expect(history).toEqual({ a: 2 });
  });
});
