import { describe, expect, it } from 'vitest';
import { nodeViews, normalizeStage, progressCount } from '.';
import { testMap } from './testing';

const views = (result: Map<string, string>) => Object.fromEntries(result);

describe('nodeViews', () => {
  it('доступен — ровно тот неосвоенный узел, у которого освоены все пререквизиты', () => {
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['a', 'b'], d: [] } });

    expect(views(nodeViews(map, new Set(['a']), null))).toEqual({
      a: 'mastered',
      b: 'available',
      c: 'ahead',
      d: 'available',
    });
  });

  it('неосвоенный узел не из выбранной ступени — вне ступени, даже если он доступен', () => {
    // Ступень 1 — a и b; c и d входят только во вторую.
    const map = testMap({ nodes: { a: [], b: ['a'], c: ['b'], d: [] }, goals: { ege: [['b'], ['c', 'd']] } });

    expect(views(nodeViews(map, new Set(), { goalId: 'ege', stageId: 'ege-1' }))).toEqual({
      a: 'available',
      b: 'ahead',
      c: 'outside',
      d: 'outside',
    });
  });

  it('освоенный узел виден освоенным, даже если он не из выбранной ступени', () => {
    const map = testMap({ nodes: { a: [], b: [] }, goals: { ege: [['a']] } });

    expect(views(nodeViews(map, new Set(['b']), { goalId: 'ege', stageId: 'ege-1' }))).toEqual({
      a: 'available',
      b: 'mastered',
    });
  });

  it('ступень включает предыдущие ступени той же цели', () => {
    const map = testMap({ nodes: { a: [], b: [], c: [] }, goals: { ege: [['a'], ['b']], olymp: [['c']] } });

    expect(views(nodeViews(map, new Set(), { goalId: 'ege', stageId: 'ege-2' }))).toEqual({
      a: 'available',
      b: 'available',
      c: 'outside',
    });
  });
});

describe('progressCount', () => {
  // Ступень 1 — a1, a2 и b1; b2 входит только во вторую, разделу c не нужен ни один узел ступени 1.
  const map = testMap({
    sections: { a: { a1: [], a2: ['a1'] }, b: { b1: ['a2'], b2: [] }, c: { c1: [] } },
    goals: { ege: [['b1'], ['b2', 'c1']] },
  });

  it('считает освоенные из входящих в ступень — в целом и по разделам в порядке карты', () => {
    // b2 освоен, но в ступень 1 не входит и в счёт не попадает.
    const count = progressCount(map, new Set(['a1', 'b2']), { goalId: 'ege', stageId: 'ege-1' });

    expect(count.total).toEqual({ mastered: 1, total: 3 });
    expect(count.sections).toEqual([
      { sectionId: 'a', mastered: 1, total: 2 },
      { sectionId: 'b', mastered: 0, total: 1 },
    ]);
  });

  it('пока ступень не выбрана, считает по всей карте', () => {
    const count = progressCount(map, new Set(['a1', 'a2']), null);

    expect(count.total).toEqual({ mastered: 2, total: 5 });
    expect(count.sections).toEqual([
      { sectionId: 'a', mastered: 2, total: 2 },
      { sectionId: 'b', mastered: 0, total: 2 },
      { sectionId: 'c', mastered: 0, total: 1 },
    ]);
  });
});

describe('normalizeStage', () => {
  const map = testMap({ nodes: { a: [] }, goals: { ege: [['a']] } });

  it('сохраняет ступень, которая есть на карте', () => {
    expect(normalizeStage(map, { goalId: 'ege', stageId: 'ege-1' })).toEqual({ goalId: 'ege', stageId: 'ege-1' });
  });

  it('молча забывает ступень, которой больше нет, и испорченную запись', () => {
    expect(normalizeStage(map, { goalId: 'ege', stageId: 'removed' })).toBeNull();
    expect(normalizeStage(map, { goalId: 'olymp', stageId: 'ege-1' })).toBeNull();
    expect(normalizeStage(map, 'ege-1')).toBeNull();
    expect(normalizeStage(map, null)).toBeNull();
  });
});
