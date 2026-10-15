import { describe, expect, it } from 'vitest';
import { validateMap, type Issue } from '.';
import { testMap } from './testing';

const brief = (issues: Issue[]) => issues.map((i) => [i.severity, i.code, i.nodes]);

describe('validateMap', () => {
  it('ничего не сообщает об исправной карте', () => {
    const map = testMap({ nodes: { a: [], b: ['a'] }, goals: { ege: [['b']] } });

    expect(validateMap(map)).toEqual([]);
  });

  describe('ошибки', () => {
    it('повторяющийся идентификатор узла', () => {
      const map = testMap({
        sections: { s1: { a: [] }, s2: { a: [] } },
        goals: { ege: [['a']] },
      });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['error', 'duplicate-id', ['a']]]);
      expect(issues[0].message).toBe(
        'Идентификатор a повторяется: «Узел a» в разделе «Раздел s1», «Узел a» в разделе «Раздел s2»',
      );
    });

    it('пререквизит, которого нет', () => {
      const map = testMap({ nodes: { a: ['ghost'] }, goals: { ege: [['a']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['error', 'missing-prerequisite', ['a', 'ghost']]]);
      expect(issues[0].message).toBe('У узла «Узел a» (a) пререквизит ghost, которого нет на карте');
    });

    it('целевой узел, которого нет', () => {
      const map = testMap({ nodes: { a: [] }, goals: { ege: [['a', 'ghost']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['error', 'missing-target', ['ghost']]]);
      expect(issues[0].message).toBe(
        'В ступени «Ступень 1» (ege-1) цели «Цель ege» целевой узел ghost, которого нет на карте',
      );
    });

    it('цикл в пререквизитах называет всю цепочку', () => {
      // a → b → c → a: каждый следующий опирается на предыдущий.
      const map = testMap({ nodes: { a: ['c'], b: ['a'], c: ['b'] }, goals: { ege: [['c']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['error', 'cycle', ['a', 'b', 'c']]]);
      expect(issues[0].message).toBe(
        'Цикл в пререквизитах: «Узел a» (a) → «Узел b» (b) → «Узел c» (c) → «Узел a» (a)',
      );
    });

    it('узел, который сам себе пререквизит, — тоже цикл', () => {
      const map = testMap({ nodes: { a: ['a'] }, goals: { ege: [['a']] } });

      expect(brief(validateMap(map))).toEqual([['error', 'cycle', ['a']]]);
    });

    it('каждый из нескольких циклов сообщается один раз', () => {
      const map = testMap({
        nodes: { a: ['b'], b: ['a'], c: ['d'], d: ['c'], e: ['a', 'c'] },
        goals: { ege: [['e']] },
      });

      expect(brief(validateMap(map))).toEqual([
        ['error', 'cycle', ['a', 'b']],
        ['error', 'cycle', ['c', 'd']],
      ]);
    });
  });

  describe('петли между разделами', () => {
    it('разделы, опирающиеся друг на друга по кругу, — ошибка с примером связей', () => {
      // s1 → s2 через a → b, s2 → s1 через b → c.
      const map = testMap({
        sections: { s1: { a: [], c: ['b'] }, s2: { b: ['a'] } },
        goals: { ege: [['c']] },
      });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['error', 'section-cycle', ['a', 'b', 'b', 'c']]]);
      expect(issues[0].message).toBe(
        'Разделы опираются друг на друга по кругу: «Раздел s1» → «Раздел s2» → «Раздел s1»; ' +
          'связи: «Узел a» (a) → «Узел b» (b), «Узел b» (b) → «Узел c» (c)',
      );
    });

    it('связи между разделами в одну сторону — не петля', () => {
      const map = testMap({
        sections: { s1: { a: [], b: [] }, s2: { c: ['a', 'b'] } },
        goals: { ege: [['c']] },
      });

      expect(validateMap(map)).toEqual([]);
    });
  });

  describe('предупреждения', () => {
    it('избыточная связь называет цепочку, из которой она следует', () => {
      // c опирается на a напрямую, но a и так следует через b.
      const map = testMap({ nodes: { a: [], b: ['a'], c: ['a', 'b'] }, goals: { ege: [['c']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['warning', 'redundant-prerequisite', ['a', 'c']]]);
      expect(issues[0].message).toBe(
        'Лишняя связь «Узел a» (a) → «Узел c» (c): она уже следует из цепочки «Узел a» (a) → «Узел b» (b) → «Узел c» (c)',
      );
    });

    it('избыточная связь через длинную цепочку', () => {
      const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], d: ['c', 'a'] }, goals: { ege: [['d']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['warning', 'redundant-prerequisite', ['a', 'd']]]);
      expect(issues[0].message).toContain('«Узел a» (a) → «Узел b» (b) → «Узел c» (c) → «Узел d» (d)');
    });

    it('лишние связи не ищутся, пока в карте есть цикл', () => {
      // Без цикла связь a → c была бы лишней.
      const map = testMap({ nodes: { a: ['c'], b: ['a'], c: ['a', 'b'] }, goals: { ege: [['c']] } });

      expect(validateMap(map).map((i) => i.code)).toEqual(['cycle', 'cycle']);
    });

    it('узел, не входящий ни в одну ступень', () => {
      const map = testMap({ nodes: { a: [], b: ['a'], lonely: [] }, goals: { ege: [['b']] } });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['warning', 'outside-stages', ['lonely']]]);
      expect(issues[0].message).toBe('Узел «Узел lonely» (lonely) не входит ни в одну ступень');
    });

    it('узел без контрольной задачи', () => {
      const map = testMap({ nodes: { a: [] }, goals: { ege: [['a']] }, withoutCheckTasks: ['a'] });

      const issues = validateMap(map);
      expect(brief(issues)).toEqual([['warning', 'no-check-task', ['a']]]);
      expect(issues[0].message).toBe('У узла «Узел a» (a) нет контрольной задачи');
    });
  });
});
