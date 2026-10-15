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

/** Перенос по словам; что не влезло в `maxLines` строк, обрезается многоточием. */
export function wrap(text: string, maxChars: number, maxLines = 2): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const last = lines.slice(maxLines - 1).join(' ');
    return [...lines.slice(0, maxLines - 1), last.slice(0, maxChars - 1) + '…'];
  }
  return lines.map((l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l));
}

/** «1 тема», «3 темы», «5 тем». */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const d = n % 10;
  const dd = n % 100;
  const word = d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
  return `${n} ${word}`;
}
