// Сборка маленьких карт прямо в тестах.
import type { LearningMap, MapNode } from './map';

type Prerequisites = Record<string, string[]>;

interface TestMapSpec {
  /** Узлы одного раздела: идентификатор → пререквизиты. */
  nodes?: Prerequisites;
  /** Или несколько разделов: раздел → его узлы. */
  sections?: Record<string, Prerequisites>;
  /** Цель → её ступени, каждая — список целевых узлов. */
  goals?: Record<string, string[][]>;
  /** Узлы без контрольной задачи; у остальных она есть. */
  withoutCheckTasks?: string[];
}

export function testMap(spec: TestMapSpec): LearningMap {
  const sectionSpecs = spec.sections ?? { main: spec.nodes ?? {} };
  const nodes: MapNode[] = [];
  const sections = Object.entries(sectionSpecs).map(([sectionId, sectionNodes]) => {
    const ids = Object.keys(sectionNodes);
    for (const id of ids) {
      nodes.push({
        id,
        kind: 'topic',
        title: `Узел ${id}`,
        description: '',
        prerequisites: sectionNodes[id],
        materials: [],
        checkTasks: spec.withoutCheckTasks?.includes(id) ? [] : [{ title: 'Задача', url: 'https://example.org' }],
        sectionId,
      });
    }
    return { id: sectionId, title: `Раздел ${sectionId}`, nodeIds: ids };
  });
  const goals = Object.entries(spec.goals ?? {}).map(([goalId, stages]) => ({
    id: goalId,
    title: `Цель ${goalId}`,
    stages: stages.map((targets, i) => ({ id: `${goalId}-${i + 1}`, title: `Ступень ${i + 1}`, targets })),
  }));
  return { sections, nodes, goals };
}
