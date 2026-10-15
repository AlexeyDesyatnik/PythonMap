import type { MapNode } from '../core';

/** Как узел подписан на экране: у задания ЕГЭ впереди его номер. */
export function nodeLabel(node: MapNode): string {
  return node.kind === 'ege-task' ? `${node.egeNumber}. ${node.title}` : node.title;
}
