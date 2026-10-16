import { describe, expect, it } from 'vitest';
import { stageNodes, unlockedNodes } from '.';
import { testMap } from './testing';

const sorted = (ids: Set<string>) => [...ids].sort();

describe('stageNodes', () => {
  it('включает целевые узлы и все их пререквизиты по цепочке', () => {
    const map = testMap({
      nodes: { a: [], b: ['a'], c: ['b'], d: [] },
      goals: { ege: [['c']] },
    });

    expect(sorted(stageNodes(map, 'ege', 'ege-1'))).toEqual(['a', 'b', 'c']);
  });

  it('включает предыдущие ступени той же цели', () => {
    const map = testMap({
      nodes: { a: [], b: [], c: ['b'] },
      goals: { ege: [['a'], ['c']] },
    });

    expect(sorted(stageNodes(map, 'ege', 'ege-1'))).toEqual(['a']);
    expect(sorted(stageNodes(map, 'ege', 'ege-2'))).toEqual(['a', 'b', 'c']);
  });

  it('не включает ступени других целей', () => {
    const map = testMap({
      nodes: { a: [], b: [] },
      goals: { ege: [['a']], olymp: [['b']] },
    });

    expect(sorted(stageNodes(map, 'olymp', 'olymp-1'))).toEqual(['b']);
  });

  it('пропускает несуществующие узлы и не зацикливается на циклах', () => {
    const map = testMap({
      nodes: { a: ['b', 'ghost'], b: ['a'] },
      goals: { ege: [['a', 'missing']] },
    });

    expect(sorted(stageNodes(map, 'ege', 'ege-1'))).toEqual(['a', 'b']);
  });
});

describe('unlockedNodes', () => {
  it('перечисляет узлы, для которых узел — прямой пререквизит, в порядке карты, по всем разделам', () => {
    // d опирается на a только через b — его узел a не открывает.
    const map = testMap({
      sections: { one: { a: [], b: ['a'], d: ['b'] }, two: { c: ['a'], e: ['b', 'a'] } },
    });

    expect(unlockedNodes(map, 'a')).toEqual(['b', 'c', 'e']);
    expect(unlockedNodes(map, 'd')).toEqual([]);
  });
});
