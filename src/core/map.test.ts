import { describe, expect, it } from 'vitest';
import { buildMap, MapDataError, type RawMapData } from '.';

function rawMap(sections: unknown[], goals: unknown = { goals: [] }): RawMapData {
  return {
    sections: sections.map((content, i) => ({ source: `section-${i + 1}.yaml`, content })),
    goals: { source: 'goals.yaml', content: goals },
  };
}

const basics = {
  id: 'basics',
  title: 'Основы',
  nodes: [
    { id: 'hello', kind: 'topic', title: 'Первая программа', description: 'print.' },
    {
      id: 'vars',
      kind: 'topic',
      title: 'Переменные',
      description: 'Имена для значений.',
      prerequisites: ['hello'],
      materials: [{ title: 'Учебник', url: 'https://example.org/vars' }],
      checkTasks: [{ title: 'Задача', url: 'https://example.org/task' }],
    },
  ],
};

const exam = {
  id: 'exam',
  title: 'Задания ЕГЭ',
  nodes: [
    { id: 'ege-sum', kind: 'ege-task', egeNumber: 5, title: 'Сумма', description: 'Перебор.', prerequisites: ['vars'] },
  ],
};

describe('buildMap', () => {
  it('сохраняет порядок разделов и узлов, заданный автором', () => {
    const map = buildMap(rawMap([basics, exam]));

    expect(map.sections.map((s) => [s.id, s.title, s.nodeIds])).toEqual([
      ['basics', 'Основы', ['hello', 'vars']],
      ['exam', 'Задания ЕГЭ', ['ege-sum']],
    ]);
    expect(map.nodes.map((n) => n.id)).toEqual(['hello', 'vars', 'ege-sum']);
  });

  it('относит каждый узел к разделу, в чьём файле он описан', () => {
    const map = buildMap(rawMap([basics, exam]));

    expect(map.nodes.map((n) => [n.id, n.sectionId])).toEqual([
      ['hello', 'basics'],
      ['vars', 'basics'],
      ['ege-sum', 'exam'],
    ]);
  });

  it('читает все поля узла', () => {
    const vars = buildMap(rawMap([basics])).nodes[1];

    expect(vars).toEqual({
      id: 'vars',
      kind: 'topic',
      title: 'Переменные',
      description: 'Имена для значений.',
      prerequisites: ['hello'],
      materials: [{ title: 'Учебник', url: 'https://example.org/vars' }],
      checkTasks: [{ title: 'Задача', url: 'https://example.org/task' }],
      sectionId: 'basics',
    });
  });

  it('считает пропущенные списки пустыми', () => {
    const hello = buildMap(rawMap([basics])).nodes[0];

    expect(hello.prerequisites).toEqual([]);
    expect(hello.materials).toEqual([]);
    expect(hello.checkTasks).toEqual([]);
  });

  it('хранит номер задания ЕГЭ подписью отдельно от идентификатора', () => {
    const task = buildMap(rawMap([exam])).nodes[0];

    expect(task.kind).toBe('ege-task');
    expect(task.id).toBe('ege-sum');
    expect(task.egeNumber).toBe('5');
  });

  it('читает цели со ступенями в порядке автора', () => {
    const map = buildMap(
      rawMap([basics], {
        goals: [
          {
            id: 'ege',
            title: 'ЕГЭ',
            stages: [
              { id: 'one', title: 'Первая', targets: ['hello'] },
              { id: 'two', title: 'Вторая', targets: ['vars'] },
            ],
          },
        ],
      }),
    );

    expect(map.goals).toEqual([
      {
        id: 'ege',
        title: 'ЕГЭ',
        stages: [
          { id: 'one', title: 'Первая', targets: ['hello'] },
          { id: 'two', title: 'Вторая', targets: ['vars'] },
        ],
      },
    ]);
  });

  it('называет файл и узел, если у узла нет обязательного поля', () => {
    const broken = { id: 'b', title: 'Б', nodes: [{ id: 'no-title', kind: 'topic', description: 'Без названия.' }] };

    expect(() => buildMap(rawMap([broken]))).toThrow(MapDataError);
    expect(() => buildMap(rawMap([broken]))).toThrow('section-1.yaml: узел no-title: нет поля «title»');
  });

  it('не принимает неизвестный вид узла', () => {
    const broken = { id: 'b', title: 'Б', nodes: [{ id: 'x', kind: 'lesson', title: 'X', description: 'X.' }] };

    expect(() => buildMap(rawMap([broken]))).toThrow('вид «lesson» неизвестен');
  });

  it('требует номер у задания ЕГЭ и не допускает его у темы', () => {
    const noNumber = { id: 'e', title: 'Е', nodes: [{ id: 't', kind: 'ege-task', title: 'Т', description: 'Т.' }] };
    const topicWithNumber = {
      id: 'e',
      title: 'Е',
      nodes: [{ id: 't', kind: 'topic', egeNumber: 3, title: 'Т', description: 'Т.' }],
    };

    expect(() => buildMap(rawMap([noNumber]))).toThrow('нет поля «egeNumber»');
    expect(() => buildMap(rawMap([topicWithNumber]))).toThrow('только у задания ЕГЭ');
  });
});
