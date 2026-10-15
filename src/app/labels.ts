import type { MapNode, NodeView } from '../core';

/** Как узел подписан на экране: у задания ЕГЭ впереди его номер. */
export function nodeLabel(node: MapNode): string {
  return node.kind === 'ege-task' ? `${node.egeNumber}. ${node.title}` : node.title;
}

/** Названия видов узла — для подсказки и для озвучивания узла. */
export const VIEW_TITLES: Record<NodeView, string> = {
  mastered: 'освоен',
  available: 'доступен',
  ahead: 'впереди',
  outside: 'вне ступени',
};
