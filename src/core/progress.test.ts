import { describe, expect, it } from 'vitest';
import {
  foldProgress,
  markMastered,
  mergeProgress,
  normalizeProgress,
  unfoldProgress,
  unmarkAffected,
  unmarkMastered,
} from '.';
import { testMap } from './testing';

const sorted = (ids: ReadonlySet<string>) => [...ids].sort();

describe('markMastered', () => {
  it('отмечает узел и все его пререквизиты по цепочке', () => {
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], d: [] } });

    expect(sorted(markMastered(map, new Set(), 'c'))).toEqual(['a', 'b', 'c']);
  });
});

describe('unmarkAffected', () => {
  it('перечисляет освоенные узлы, которые опираются на узел по цепочке, в порядке карты', () => {
    // d опирается на b, но не освоен — его снятие не затрагивает.
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], d: ['b'], e: ['a'] } });

    expect(unmarkAffected(map, new Set(['a', 'b', 'c', 'e']), 'a')).toEqual(['b', 'c', 'e']);
  });

  it('пуст, если на узел не опирается ни один освоенный', () => {
    const map = testMap({ nodes: { a: [], b: ['a'] } });

    expect(unmarkAffected(map, new Set(['a']), 'a')).toEqual([]);
  });
});

describe('unmarkMastered', () => {
  it('снимает отметку с узла и со всех опирающихся на него, пререквизиты остаются', () => {
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], e: ['a'] } });

    expect(sorted(unmarkMastered(map, new Set(['a', 'b', 'c', 'e']), 'b'))).toEqual(['a', 'e']);
  });
});

describe('последовательность отметок и снятий', () => {
  // Ромб с хвостами: несколько путей между узлами.
  const map = testMap({
    nodes: { a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: ['d'], f: ['c'], g: [], h: ['g', 'e'] },
  });
  const ids = map.nodes.map((n) => n.id);
  const prerequisites = new Map(map.nodes.map((n) => [n.id, n.prerequisites]));

  // Детерминированный генератор, чтобы падение воспроизводилось.
  let seed = 12345;
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };

  it('прогресс остаётся замкнутым вниз, а снятие убирает ровно объявленные узлы', () => {
    let progress: Set<string> = new Set();
    for (let step = 0; step < 500; step++) {
      const id = ids[random(ids.length)];
      if (random(2) === 0) {
        progress = markMastered(map, progress, id);
      } else {
        const affected = unmarkAffected(map, progress, id);
        const next = unmarkMastered(map, progress, id);
        const removed = [...progress].filter((n) => !next.has(n) && n !== id);
        expect(removed.sort()).toEqual([...affected].sort());
        progress = next;
      }
      for (const n of progress) {
        for (const p of prerequisites.get(n)!) expect(progress.has(p), `${n} освоен без ${p}`).toBe(true);
      }
    }
  });
});

describe('normalizeProgress', () => {
  it('молча отбрасывает идентификаторы, которых нет на карте', () => {
    const map = testMap({ nodes: { a: [], b: [] } });

    expect(sorted(normalizeProgress(map, ['a', 'removed']))).toEqual(['a']);
  });

  it('отмечает недостающие пререквизиты освоенных узлов', () => {
    // Автор добавил пререквизит new под уже освоенным c.
    const map = testMap({ nodes: { a: [], new: [], b: ['a'], c: ['b', 'new'] } });

    expect(sorted(normalizeProgress(map, ['a', 'b', 'c']))).toEqual(['a', 'b', 'c', 'new']);
  });
});

describe('ссылка с прогрессом', () => {
  // Ромб a → b, c → d и отдельная ветка e → f.
  const map = testMap({ nodes: { a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: [], f: ['e'] } });

  it('несёт только верхние освоенные узлы, в порядке карты', () => {
    expect(foldProgress(map, new Set(['a', 'b', 'c', 'e']))).toEqual(['b', 'c', 'e']);
  });

  it('разворачивается обратно в тот же прогресс', () => {
    for (const ids of [[], ['a'], ['a', 'b'], ['a', 'b', 'c', 'd'], ['a', 'c', 'e', 'f'], ['a', 'b', 'c', 'd', 'e', 'f']]) {
      const progress = new Set(ids);
      expect(sorted(unfoldProgress(map, foldProgress(map, progress)))).toEqual(ids);
    }
  });

  it('при разворачивании восстанавливает пререквизиты каскадом и молча отбрасывает неизвестные узлы', () => {
    expect(sorted(unfoldProgress(map, ['d', 'removed']))).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('mergeProgress', () => {
  it('освоено всё, что освоено хотя бы в одном из двух прогрессов', () => {
    expect(sorted(mergeProgress(new Set(['a', 'b']), new Set(['a', 'e', 'f'])))).toEqual(['a', 'b', 'e', 'f']);
  });
});
