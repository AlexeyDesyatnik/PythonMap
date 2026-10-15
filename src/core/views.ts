// Выбранная ступень и то, как ученик при ней видит карту: виды узлов и счёт.
import type { LearningMap } from './map.ts';
import type { Progress } from './progress.ts';
import { stageNodes } from './stages.ts';

/** Выбранная учеником ступень; `null` — ступень не выбрана. */
export type StageChoice = { goalId: string; stageId: string } | null;

/** Сохранённая ступень; если её уже нет на карте или запись испорчена, она молча забывается. */
export function normalizeStage(map: LearningMap, saved: unknown): StageChoice {
  const { goalId, stageId } = (typeof saved === 'object' && saved !== null ? saved : {}) as Record<string, unknown>;
  const goal = map.goals.find((g) => g.id === goalId);
  const stage = goal?.stages.find((s) => s.id === stageId);
  return goal && stage ? { goalId: goal.id, stageId: stage.id } : null;
}

/** Вид узла: освоен, доступен, впереди или вне выбранной ступени. */
export type NodeView = 'mastered' | 'available' | 'ahead' | 'outside';

/**
 * Вид каждого узла карты. Освоенный узел всегда виден освоенным; неосвоенный
 * узел не из выбранной ступени — вне ступени; остальные доступны, если освоены
 * все их пререквизиты, иначе впереди.
 */
export function nodeViews(map: LearningMap, progress: Progress, stage: StageChoice): Map<string, NodeView> {
  const inStage = stageFilter(map, stage);
  const views = new Map<string, NodeView>();
  for (const node of map.nodes) {
    let view: NodeView;
    if (progress.has(node.id)) view = 'mastered';
    else if (!inStage(node.id)) view = 'outside';
    else view = node.prerequisites.every((p) => progress.has(p)) ? 'available' : 'ahead';
    views.set(node.id, view);
  }
  return views;
}

/** Сколько узлов освоено из скольких. */
export interface MasteredCount {
  mastered: number;
  total: number;
}

export type SectionCount = MasteredCount & { sectionId: string };

export interface ProgressCount {
  total: MasteredCount;
  /** Разделы в порядке карты; разделы без узлов ступени пропущены. */
  sections: SectionCount[];
}

/**
 * Счёт: сколько узлов освоено из входящих в выбранную ступень — в целом и по
 * разделам. Пока ступень не выбрана, считается вся карта.
 */
export function progressCount(map: LearningMap, progress: Progress, stage: StageChoice): ProgressCount {
  const inStage = stageFilter(map, stage);
  const count = (ids: string[]): MasteredCount => {
    const counted = ids.filter(inStage);
    return { mastered: counted.filter((id) => progress.has(id)).length, total: counted.length };
  };
  return {
    total: count(map.nodes.map((n) => n.id)),
    sections: map.sections.map((s) => ({ sectionId: s.id, ...count(s.nodeIds) })).filter((s) => s.total > 0),
  };
}

/** Входит ли узел в выбранную ступень. Пока ступень не выбрана, входит любой. */
function stageFilter(map: LearningMap, stage: StageChoice): (id: string) => boolean {
  if (!stage) return () => true;
  const nodes = stageNodes(map, stage.goalId, stage.stageId);
  return (id) => nodes.has(id);
}
