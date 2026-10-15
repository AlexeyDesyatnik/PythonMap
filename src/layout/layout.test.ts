import { describe, expect, it } from 'vitest';
import { testMap } from '../core/testing';
import { mapLayout } from '.';

describe('обзор', () => {
  it('раздел, который опирается на другой, стоит выше него, и стрелка ведёт снизу вверх', () => {
    const map = testMap({ sections: { base: { a: [] }, top: { b: ['a'] } } });

    const { overview } = mapLayout(map);
    const box = (id: string) => overview.sections.find((s) => s.id === id)!;

    expect(box('top').y + box('top').height).toBeLessThan(box('base').y);
    expect(overview.edges.map((e) => `${e.from}->${e.to}`)).toEqual(['base->top']);
  });

  it('связь между разделами, которая следует из цепочки других, скрыта', () => {
    const map = testMap({ sections: { s1: { a: [] }, s2: { b: ['a'] }, s3: { c: ['a', 'b'] } } });

    const { overview } = mapLayout(map);

    expect(overview.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(['s1->s2', 's2->s3']);
  });
});

describe('граф раздела', () => {
  it('темы из других разделов собраны в блоки, по одному на раздел-источник, ниже опирающихся тем', () => {
    const map = testMap({
      sections: {
        s1: { a: [], b: [] },
        s2: { c: [] },
        main: { x: ['a', 'b'], y: ['x', 'c'], z: ['b'] },
      },
    });

    const section = mapLayout(map).sections.main;
    if (section.kind !== 'graph') throw new Error('ожидался граф');

    expect(section.nodes.map((n) => n.id)).toEqual(['x', 'y', 'z']);
    expect(section.blocks.map((b) => [b.sectionId, b.nodeIds])).toEqual([
      ['s1', ['a', 'b']],
      ['s2', ['c']],
    ]);
    expect(section.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual([
      'section:s1->x',
      'section:s1->z',
      'section:s2->y',
      'x->y',
    ]);
    const node = (id: string) => section.nodes.find((n) => n.id === id)!;
    const block = (id: string) => section.blocks.find((b) => b.sectionId === id)!;
    expect(node('x').y + node('x').height).toBeLessThan(block('s1').y);
    expect(node('y').y + node('y').height).toBeLessThan(node('x').y);
  });
});

describe('ширина раскладки', () => {
  it('в одном ряду не больше четырёх блоков, чтобы широкий раздел не мельчил при вписывании в окно', () => {
    const map = testMap({ sections: { main: { a: [], b: [], c: [], d: [], e: [], f: [], top: ['a', 'f'] } } });

    const section = mapLayout(map).sections.main;
    if (section.kind !== 'graph') throw new Error('ожидался граф');

    const perRow = new Map<number, number>();
    for (const n of section.nodes) perRow.set(n.y + n.height, (perRow.get(n.y + n.height) ?? 0) + 1);
    expect(Math.max(...perRow.values())).toBeLessThanOrEqual(4);
    const node = (id: string) => section.nodes.find((n) => n.id === id)!;
    expect(node('top').y + node('top').height).toBeLessThan(Math.min(node('a').y, node('f').y));
  });
});

describe('раздел заданий ЕГЭ', () => {
  const map = testMap({
    sections: {
      s1: { a: [] },
      s2: { b: [] },
      ege: { t1: ['a'], t2: ['a', 'b'], t3: ['b'], t4: [] },
    },
    egeTasks: ['t1', 't2', 't3', 't4'],
    goals: { exam: [['a'], ['t2'], ['t1', 't3']] },
  });
  const section = mapLayout(map).sections.ege;
  if (section.kind !== 'rows') throw new Error('ожидались ряды');

  it('показан рядами по ступеням снизу вверх, а задания вне ступеней — отдельным рядом', () => {
    expect(section.rows.map((r) => [r.title, r.nodeIds])).toEqual([
      ['Ступень 2', ['t2']],
      ['Ступень 3', ['t1', 't3']],
      ['Вне ступеней', ['t4']],
    ]);
    const node = (id: string) => section.nodes.find((n) => n.id === id)!;
    expect(node('t1').y).toBe(node('t3').y);
    expect(node('t1').x).toBeLessThan(node('t3').x);
    expect(node('t1').y + node('t1').height).toBeLessThan(node('t2').y);
  });

  it('у каждого задания известно, на какие разделы оно опирается', () => {
    expect(Object.fromEntries(section.nodes.map((n) => [n.id, n.basedOn]))).toEqual({
      t1: ['s1'],
      t2: ['s1', 's2'],
      t3: ['s2'],
      t4: [],
    });
  });
});

describe('устойчивость раскладки', () => {
  const sections = {
    s1: { a: [], b: ['a'], c: ['a'] },
    s2: { d: ['b'], e: ['d', 'c'], f: [] },
    s3: { g: ['e'], h: ['f', 'g'] },
  };

  it('одни и те же данные дают одну и ту же раскладку', () => {
    expect(mapLayout(testMap({ sections }))).toEqual(mapLayout(testMap({ sections })));
  });

  it('новая тема и связь внутри раздела не сдвигают ни другие разделы, ни обзор', () => {
    const before = mapLayout(testMap({ sections }));
    const after = mapLayout(testMap({ sections: { ...sections, s2: { ...sections.s2, x: ['d'], f: ['x'] } } }));

    expect(after.sections.s1).toEqual(before.sections.s1);
    expect(after.sections.s3).toEqual(before.sections.s3);
    expect(after.overview).toEqual(before.overview);
    expect(after.sections.s2).not.toEqual(before.sections.s2);
  });
});
