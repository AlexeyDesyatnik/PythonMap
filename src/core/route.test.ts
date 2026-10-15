import { describe, expect, it } from 'vitest';
import { route } from '.';
import { testMap } from './testing';

describe('route', () => {
  it('содержит только неосвоенные узлы выбранной ступени', () => {
    // Ступень 1 — a, b, c; d входит только во вторую, e — ни в одну.
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], d: [], e: [] }, goals: { ege: [['c'], ['d']] } });

    expect(route(map, new Set(['a']), { goalId: 'ege', stageId: 'ege-1' })).toEqual(['b', 'c']);
  });

  it('не ставит узел раньше его пререквизитов, даже если автор поставил его раньше', () => {
    // В данных раздел later идёт первым, но опирается на раздел basics.
    const map = testMap({
      sections: { later: { x: ['b'] }, basics: { a: [], b: ['a'] } },
      goals: { ege: [['x']] },
    });

    expect(route(map, new Set(), { goalId: 'ege', stageId: 'ege-1' })).toEqual(['a', 'b', 'x']);
  });

  it('среди равных следует порядку автора: разделов, затем узлов внутри раздела', () => {
    // Как только q освоен, p готов и идёт раньше r и s: его раздел первый.
    const map = testMap({
      sections: { first: { p: ['q'] }, second: { s: [], q: [], r: [] } },
      goals: { ege: [['p', 'r', 's']] },
    });

    expect(route(map, new Set(), { goalId: 'ege', stageId: 'ege-1' })).toEqual(['s', 'q', 'p', 'r']);
  });

  it('пуст, когда все узлы ступени освоены', () => {
    const map = testMap({ nodes: { a: [], b: ['a'], c: [] }, goals: { ege: [['b'], ['c']] } });

    expect(route(map, new Set(['a', 'b']), { goalId: 'ege', stageId: 'ege-1' })).toEqual([]);
  });
});
