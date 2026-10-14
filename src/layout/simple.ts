// Простейшая раскладка: разделы — колонки в порядке автора, узлы раздела —
// друг под другом, тоже в порядке автора. Временная: настоящую раскладку
// выбирает прототип.
import type { LearningMap } from '../core';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  width: number;
  height: number;
  sections: (Box & { id: string })[];
  nodes: (Box & { id: string })[];
  /** Стрелка идёт от пререквизита к узлу, который на нём держится. */
  edges: { from: string; to: string; path: string }[];
}

const NODE_W = 190;
const NODE_H = 52;
const NODE_GAP = 18;
const PAD = 16;
const HEADER = 34;
const COLUMN_GAP = 70;
const MARGIN = 20;

export function simpleLayout(map: LearningMap): Layout {
  const nodeBoxes = new Map<string, Box>();
  const sections: Layout['sections'] = [];

  map.sections.forEach((section, col) => {
    const x = MARGIN + col * (NODE_W + 2 * PAD + COLUMN_GAP);
    const height = HEADER + PAD + section.nodeIds.length * (NODE_H + NODE_GAP) - NODE_GAP + PAD;
    sections.push({ id: section.id, x, y: MARGIN, width: NODE_W + 2 * PAD, height });
    section.nodeIds.forEach((id, row) => {
      nodeBoxes.set(id, {
        x: x + PAD,
        y: MARGIN + HEADER + PAD + row * (NODE_H + NODE_GAP),
        width: NODE_W,
        height: NODE_H,
      });
    });
  });

  const edges: Layout['edges'] = [];
  for (const node of map.nodes) {
    const to = nodeBoxes.get(node.id)!;
    for (const prereq of node.prerequisites) {
      const from = nodeBoxes.get(prereq);
      if (from) edges.push({ from: prereq, to: node.id, path: edgePath(from, to) });
    }
  }

  const width = Math.max(0, ...sections.map((s) => s.x + s.width)) + MARGIN;
  const height = Math.max(0, ...sections.map((s) => s.y + s.height)) + MARGIN;
  return {
    width,
    height,
    sections,
    nodes: [...nodeBoxes].map(([id, box]) => ({ id, ...box })),
    edges,
  };
}

function edgePath(a: Box, b: Box): string {
  const ay = a.y + a.height / 2;
  const by = b.y + b.height / 2;
  if (a.x === b.x) {
    // Один раздел: дуга слева от колонки. Концы смещены от середины,
    // чтобы не сливаться со стрелками из других разделов.
    const x = a.x;
    const y1 = a.y + (a.height * 2) / 3;
    const y2 = b.y + b.height / 3;
    const bulge = Math.min(PAD - 2, 8 + Math.abs(y2 - y1) / 20);
    return `M ${x} ${y1} C ${x - bulge} ${y1}, ${x - bulge} ${y2}, ${x} ${y2}`;
  }
  const forward = a.x < b.x;
  const ax = forward ? a.x + a.width : a.x;
  const bx = forward ? b.x : b.x + b.width;
  const dx = (bx - ax) / 2;
  return `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
}
