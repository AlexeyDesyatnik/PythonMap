import { useMemo } from 'react';
import type { LearningMap } from '../core';
import { simpleLayout } from '../layout/simple';

export function MapView({ map }: { map: LearningMap }) {
  const layout = useMemo(() => simpleLayout(map), [map]);
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const sections = new Map(map.sections.map((s) => [s.id, s]));

  return (
    <div className="map-scroll">
      <svg
        className="map"
        role="img"
        aria-label="Карта"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrow-head" />
          </marker>
        </defs>

        {layout.sections.map((box) => (
          <g key={box.id} data-section={box.id}>
            <rect className="section" x={box.x} y={box.y} width={box.width} height={box.height} rx={10} />
            <text className="section-title" x={box.x + 14} y={box.y + 23}>
              {sections.get(box.id)!.title}
            </text>
          </g>
        ))}

        {layout.edges.map((e) => (
          <path
            key={`${e.from}->${e.to}`}
            data-edge={`${e.from}->${e.to}`}
            className="edge"
            d={e.path}
            markerEnd="url(#arrow)"
          />
        ))}

        {layout.nodes.map((box) => {
          const node = nodes.get(box.id)!;
          const lines = wrap(node.kind === 'ege-task' ? `${node.egeNumber}. ${node.title}` : node.title, 24);
          const lineH = 16;
          const top = box.y + box.height / 2 - ((lines.length - 1) * lineH) / 2;
          return (
            <g key={box.id} data-node={node.id} data-section-of={node.sectionId}>
              <rect
                className={`node node-${node.kind}`}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={8}
              />
              <text className="node-title" x={box.x + box.width / 2} textAnchor="middle">
                {lines.map((line, i) => (
                  <tspan key={i} x={box.x + box.width / 2} y={top + i * lineH} dominantBaseline="middle">
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Перенос названия по словам; длинное название обрезается до двух строк. */
function wrap(text: string, maxChars: number): string[] {
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
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, maxChars - 1) + '…'];
  return lines;
}
