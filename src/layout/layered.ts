// Послойная раскладка направленного графа снизу вверх: блок, на который
// опираются, стоит ниже опирающегося. Обычная схема в четыре шага: слои,
// порядок внутри слоёв (меньше пересечений), координаты, стрелки. Длинные
// стрелки идут через невидимые точки на промежуточных слоях, чтобы огибать блоки.
// Результат зависит только от входа: ни случайности, ни измерения текста.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayeredBlock {
  id: string;
  width: number;
  height: number;
}

/** Стрелка от `from` (ниже) к `to` (выше). */
export interface LayeredLink {
  from: string;
  to: string;
}

export interface Edge extends LayeredLink {
  /** Путь стрелки для SVG: от верха нижнего блока к низу верхнего. */
  path: string;
}

export interface LayeredResult {
  width: number;
  height: number;
  boxes: Map<string, Box>;
  edges: Edge[];
}

const LAYER_GAP = 64;
const BLOCK_GAP = 28;
/** Ширина места, которое длинная стрелка занимает на промежуточном слое. */
const LANE = 14;
export const MARGIN = 24;
const MAX_PER_LAYER = 4;

interface Item {
  id: string;
  width: number;
  height: number;
  /** Невидимая точка длинной стрелки. */
  dummy: boolean;
  layer: number;
  /** Порядок автора — решает при равенстве. */
  rank: number;
  x: number;
  below: Item[];
  above: Item[];
}

/** Блоки — в порядке автора; стрелки на неизвестные блоки и петли пропускаются. */
export function layered(blocks: LayeredBlock[], links: LayeredLink[]): LayeredResult {
  if (blocks.length === 0) return { width: 2 * MARGIN, height: 2 * MARGIN, boxes: new Map(), edges: [] };
  const items = new Map<string, Item>();
  blocks.forEach((b, rank) =>
    items.set(b.id, { ...b, dummy: false, layer: 0, rank, x: 0, below: [], above: [] }),
  );
  const real = links.filter((l) => l.from !== l.to && items.has(l.from) && items.has(l.to));

  assignLayers(items, real);

  // Длинные стрелки разбиваются на звенья через невидимые точки.
  const chains = real.map((link) => {
    const from = items.get(link.from)!;
    const to = items.get(link.to)!;
    const chain = [from];
    for (let layer = from.layer + 1; layer < to.layer; layer++) {
      const id = `${link.from}->${link.to}#${layer}`;
      const dummy: Item = { id, width: LANE, height: 0, dummy: true, layer, rank: from.rank, x: 0, below: [], above: [] };
      items.set(id, dummy);
      chain.push(dummy);
    }
    chain.push(to);
    for (let i = 1; i < chain.length; i++) {
      chain[i - 1].above.push(chain[i]);
      chain[i].below.push(chain[i - 1]);
    }
    return { link, chain };
  });

  const layers = orderLayers([...items.values()]);
  placeX(layers);
  const layerY = placeY(layers);

  const xs = [...items.values()].flatMap((i) => [i.x - i.width / 2, i.x + i.width / 2]);
  const shift = MARGIN - Math.min(...xs);
  for (const item of items.values()) item.x += shift;
  const width = Math.round(Math.max(...xs) + shift + MARGIN);
  // Нижний слой стоит ниже всех.
  const height = Math.round(layerY[0].bottom + MARGIN);

  const boxOf = (item: Item): Box => {
    const { top, height: h } = layerY[item.layer];
    // Блоки слоя выровнены по низу: стрелки к ним приходят на одной высоте.
    return {
      x: Math.round(item.x - item.width / 2),
      y: Math.round(top + h - item.height),
      width: item.width,
      height: item.height,
    };
  };
  const boxes = new Map(blocks.map((b) => [b.id, boxOf(items.get(b.id)!)]));

  return { width, height, boxes, edges: drawEdges(chains, boxes, layerY) };
}

/**
 * Слой блока — выше всех, на кого он опирается, и по возможности самый низкий.
 * В слое не больше MAX_PER_LAYER блоков: лишние поднимаются выше, иначе широкий
 * раздел пришлось бы сильно уменьшать, чтобы вписать в окно. Блоки расставляются
 * в порядке автора среди готовых. Блок, который сам ни на что не опирается,
 * затем поднимается вплотную под самого низкого из опирающихся, если там есть место, —
 * так его стрелки короче.
 */
function assignLayers(items: Map<string, Item>, links: LayeredLink[]) {
  const prereqs = new Map([...items.keys()].map((id) => [id, [] as string[]]));
  const dependents = new Map([...items.keys()].map((id) => [id, [] as string[]]));
  for (const l of links) {
    prereqs.get(l.to)!.push(l.from);
    dependents.get(l.from)!.push(l.to);
  }
  const layer = new Map<string, number>();
  const filled: number[] = [];
  const lowest = (id: string) => Math.max(-1, ...prereqs.get(id)!.map((p) => layer.get(p) ?? -1)) + 1;
  const place = (id: string, from: number) => {
    let l = from;
    while ((filled[l] ?? 0) >= MAX_PER_LAYER) l++;
    layer.set(id, l);
    filled[l] = (filled[l] ?? 0) + 1;
  };

  const left = [...items.values()];
  while (left.length > 0) {
    const ready = left.filter((i) => prereqs.get(i.id)!.every((p) => layer.has(p)));
    // Готовых нет только при петле в данных: её не пропускает проверка данных, а здесь она просто рвётся.
    const pool = ready.length > 0 ? ready : left;
    const next = pool.reduce((best, i) => {
      const a = lowest(i.id);
      const b = lowest(best.id);
      return a < b || (a === b && i.rank < best.rank) ? i : best;
    });
    place(next.id, lowest(next.id));
    left.splice(left.indexOf(next), 1);
  }

  for (const [id, item] of items) {
    item.layer = layer.get(id)!;
    const above = dependents.get(id)!.map((d) => layer.get(d)!);
    if (prereqs.get(id)!.length > 0 || above.length === 0) continue;
    const target = Math.min(...above) - 1;
    if (target > item.layer && (filled[target] ?? 0) < MAX_PER_LAYER) {
      filled[item.layer]--;
      filled[target]++;
      item.layer = target;
      layer.set(id, target);
    }
  }
  // Подъём мог опустошить слой — убираем пустые слои.
  const used = [...new Set([...items.values()].map((i) => i.layer))].sort((a, b) => a - b);
  for (const item of items.values()) item.layer = used.indexOf(item.layer);
}

/** Слои снизу вверх; внутри слоя — порядок слева направо с наименьшим числом пересечений. */
function orderLayers(items: Item[]): Item[][] {
  const count = Math.max(...items.map((i) => i.layer)) + 1;
  let layers: Item[][] = Array.from({ length: count }, () => []);
  for (const item of items) layers[item.layer].push(item);
  for (const layer of layers) layer.sort((a, b) => a.rank - b.rank || Number(a.dummy) - Number(b.dummy));

  let best = layers.map((l) => [...l]);
  let bestCrossings = crossings(best);
  for (let pass = 0; pass < 8 && bestCrossings > 0; pass++) {
    const upward = pass % 2 === 0;
    const order = upward ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).reverse().slice(1);
    for (const i of order) {
      const ref = layers[upward ? i - 1 : i + 1];
      const pos = new Map(ref.map((item, j) => [item, j]));
      const center = (item: Item, j: number) => {
        const near = (upward ? item.below : item.above).map((n) => pos.get(n)!);
        return near.length > 0 ? near.reduce((s, p) => s + p, 0) / near.length : j;
      };
      const keyed = layers[i].map((item, j) => ({ item, key: center(item, j), j }));
      keyed.sort((a, b) => a.key - b.key || a.j - b.j);
      layers[i] = keyed.map((k) => k.item);
    }
    const c = crossings(layers);
    if (c < bestCrossings) {
      best = layers.map((l) => [...l]);
      bestCrossings = c;
    }
    layers = layers.map((l) => [...l]);
  }
  return best;
}

function crossings(layers: Item[][]): number {
  let total = 0;
  for (let i = 1; i < layers.length; i++) {
    const below = new Map(layers[i - 1].map((item, j) => [item, j]));
    const segs = layers[i].flatMap((item, j) => item.below.map((b) => [below.get(b)!, j] as const));
    for (let a = 0; a < segs.length; a++) {
      for (let b = a + 1; b < segs.length; b++) {
        if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) total++;
      }
    }
  }
  return total;
}

/**
 * Горизонтальное положение: каждый блок тянется к середине своих соседей
 * по стрелкам, но не наезжает на соседей по слою и не выходит за ширину
 * самого широкого слоя, поставленного вплотную, — иначе раскладка расползается вширь.
 */
function placeX(layers: Item[][]) {
  const gap = (a: Item, b: Item) => (a.dummy || b.dummy ? BLOCK_GAP / 2 : BLOCK_GAP);
  let half = 0;
  for (const layer of layers) {
    let x = 0;
    layer.forEach((item, j) => {
      if (j > 0) x += minDistance(layer[j - 1], item, gap);
      item.x = x;
    });
    const mid = x / 2;
    for (const item of layer) item.x -= mid;
    half = Math.max(half, mid + layer[0].width / 2, mid + layer.at(-1)!.width / 2);
  }

  for (let pass = 0; pass < 6; pass++) {
    const upward = pass % 2 === 0;
    const order = upward ? layers : [...layers].reverse();
    for (const layer of order) {
      const xs = layer.map((item) => {
        const near = [...(upward ? item.below : item.above), ...(pass > 3 ? (upward ? item.above : item.below) : [])];
        return near.length > 0 ? near.reduce((s, n) => s + n.x, 0) / near.length : item.x;
      });
      // Слева направо — не левее границы и не ближе допустимого к левому соседу, затем так же справа налево.
      const last = layer.length - 1;
      xs[0] = Math.max(xs[0], -half + layer[0].width / 2);
      for (let j = 1; j <= last; j++) xs[j] = Math.max(xs[j], xs[j - 1] + minDistance(layer[j - 1], layer[j], gap));
      xs[last] = Math.min(xs[last], half - layer[last].width / 2);
      for (let j = last - 1; j >= 0; j--) xs[j] = Math.min(xs[j], xs[j + 1] - minDistance(layer[j], layer[j + 1], gap));
      layer.forEach((item, j) => (item.x = xs[j]));
    }
  }
}

function minDistance(a: Item, b: Item, gap: (a: Item, b: Item) => number): number {
  return a.width / 2 + gap(a, b) + b.width / 2;
}

/** Верх и высота каждого слоя; нижний слой — внизу. */
function placeY(layers: Item[][]): { top: number; height: number; bottom: number }[] {
  const heights = layers.map((l) => Math.max(0, ...l.map((i) => i.height)));
  const result = new Array<{ top: number; height: number; bottom: number }>(layers.length);
  let y = MARGIN;
  for (let i = layers.length - 1; i >= 0; i--) {
    result[i] = { top: y, height: heights[i], bottom: y + heights[i] };
    y += heights[i] + LAYER_GAP;
  }
  return result;
}

/**
 * Стрелка выходит из верха нижнего блока и входит в низ верхнего. Если у блока
 * несколько стрелок с одной стороны, их концы разнесены по ширине блока в том
 * же порядке, в каком стоят блоки на другом конце, — так стрелки не перекрещиваются у блока.
 */
function drawEdges(
  chains: { link: LayeredLink; chain: Item[] }[],
  boxes: Map<string, Box>,
  layerY: { top: number; height: number; bottom: number }[],
): Edge[] {
  const outPorts = ports(chains, (c) => c.chain[0].id, (c) => c.chain[1].x);
  const inPorts = ports(chains, (c) => c.chain.at(-1)!.id, (c) => c.chain.at(-2)!.x);

  return chains.map((c) => {
    const from = boxes.get(c.link.from)!;
    const to = boxes.get(c.link.to)!;
    const points: [number, number][] = [[outPorts.get(c)!, from.y]];
    for (const dummy of c.chain.slice(1, -1)) {
      const { top, bottom } = layerY[dummy.layer];
      points.push([dummy.x, bottom], [dummy.x, top]);
    }
    points.push([inPorts.get(c)!, to.y + to.height]);

    let path = `M ${Math.round(points[0][0])} ${Math.round(points[0][1])}`;
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      if (x1 === x2) path += ` L ${Math.round(x2)} ${Math.round(y2)}`;
      else {
        const my = (y1 + y2) / 2;
        path += ` C ${Math.round(x1)} ${Math.round(my)}, ${Math.round(x2)} ${Math.round(my)}, ${Math.round(x2)} ${Math.round(y2)}`;
      }
    }
    return { ...c.link, path };
  });

  function ports<T extends { link: LayeredLink }>(
    list: T[],
    blockOf: (c: T) => string,
    otherX: (c: T) => number,
  ): Map<T, number> {
    const groups = new Map<string, T[]>();
    for (const c of list) groups.set(blockOf(c), [...(groups.get(blockOf(c)) ?? []), c]);
    const result = new Map<T, number>();
    for (const [id, group] of groups) {
      const box = boxes.get(id)!;
      group.sort((a, b) => otherX(a) - otherX(b));
      const step = Math.min(18, (box.width * 0.7) / group.length);
      group.forEach((c, i) => result.set(c, box.x + box.width / 2 + (i - (group.length - 1) / 2) * step));
    }
    return result;
  }
}
