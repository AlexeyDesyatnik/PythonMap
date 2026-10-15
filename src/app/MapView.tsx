import type { KeyboardEvent } from 'react';
import type { LearningMap, MapNode, NodeView, SectionCount } from '../core';
import type { Box, Edge, MapLayout, SectionLayout } from '../layout';
import { nodeLabel, plural, VIEW_TITLES, wrap } from './labels';
import { PanZoom } from './PanZoom';

interface Props {
  map: LearningMap;
  layout: MapLayout;
  views: ReadonlyMap<string, NodeView>;
  /** Маршрут до выбранной ступени; его узлы выделены номерами шагов. */
  route: string[];
  /** Счёт по разделам; раздела без узлов ступени здесь нет. */
  sectionCounts: SectionCount[];
  /** Открытый раздел; `null` — обзор. */
  sectionId: string | null;
  onOpenSection: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Карта в два уровня: обзор разделов и граф открытого раздела. */
export function MapView(props: Props) {
  const { map, layout, sectionId, onOpenSection, selectedId } = props;
  const section = map.sections.find((s) => s.id === sectionId);
  const sectionLayout = section ? layout.sections[section.id] : null;
  const focus = sectionLayout?.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="map-area" data-open-section={sectionId ?? ''}>
      <div className="map-toolbar">
        {section ? (
          <>
            <button type="button" className="map-back" onClick={() => onOpenSection(null)}>
              ← Обзор
            </button>
            <h2 className="map-heading" data-testid="map-heading">
              {section.title}
            </h2>
          </>
        ) : (
          <h2 className="map-heading" data-testid="map-heading">
            Обзор: разделы карты
          </h2>
        )}
      </div>
      {section && sectionLayout ? (
        <PanZoom
          width={sectionLayout.width}
          height={sectionLayout.height}
          contentKey={section.id}
          focus={focus}
          label={`Раздел «${section.title}»`}
        >
          <SectionGraph {...props} sectionLayout={sectionLayout} />
        </PanZoom>
      ) : (
        <PanZoom
          width={layout.overview.width}
          height={layout.overview.height}
          contentKey=""
          focus={null}
          label="Обзор карты"
        >
          <Overview {...props} />
        </PanZoom>
      )}
    </div>
  );
}

function Overview({ map, layout, route, sectionCounts, onOpenSection }: Props) {
  const sections = new Map(map.sections.map((s) => [s.id, s]));
  const counts = new Map(sectionCounts.map((c) => [c.sectionId, c]));
  const sectionOf = new Map(map.nodes.map((n) => [n.id, n.sectionId]));
  // Сколько шагов маршрута в каждом разделе и где следующий шаг.
  const routeSteps = new Map<string, number>();
  for (const id of route) routeSteps.set(sectionOf.get(id)!, (routeSteps.get(sectionOf.get(id)!) ?? 0) + 1);
  const nextSection = route.length > 0 ? sectionOf.get(route[0]) : undefined;

  return (
    <>
      <Edges edges={layout.overview.edges} />
      {layout.overview.sections.map((box) => {
        const section = sections.get(box.id)!;
        const count = counts.get(box.id);
        const steps = routeSteps.get(box.id);
        const tasks = layout.sections[box.id].kind === 'rows';
        const size = plural(section.nodeIds.length, tasks ? ['задание', 'задания', 'заданий'] : ['тема', 'темы', 'тем']);
        const lines = wrap(section.title, 21);
        const label = [
          section.title,
          size,
          count && `освоено ${count.mastered} из ${count.total}`,
          steps && `шагов маршрута: ${steps}`,
        ];
        return (
          <g
            key={box.id}
            data-section={box.id}
            data-route-steps={steps}
            className={`section-group${steps ? ' on-route' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={label.filter(Boolean).join(', ')}
            {...activate(() => onOpenSection(box.id))}
          >
            <rect className="section" x={box.x} y={box.y} width={box.width} height={box.height} rx={10} />
            {lines.map((line, i) => (
              <text key={i} className="section-title" x={box.x + 14} y={box.y + 26 + i * 19}>
                {line}
              </text>
            ))}
            <text className="section-size" x={box.x + 14} y={box.y + box.height - 14}>
              {size}
            </text>
            {count && (
              <text
                className="section-count"
                data-section-count={box.id}
                x={box.x + box.width - 14}
                y={box.y + box.height - 14}
                textAnchor="end"
              >
                {count.mastered} из {count.total}
              </text>
            )}
            {steps && (
              <RouteBadge x={box.x + box.width} y={box.y} text={String(steps)} next={box.id === nextSection} />
            )}
          </g>
        );
      })}
    </>
  );
}

function SectionGraph(props: Props & { sectionLayout: SectionLayout }) {
  const { map, sectionLayout: layout, views, route, onOpenSection } = props;
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const sections = new Map(map.sections.map((s) => [s.id, s]));

  if (layout.kind === 'rows') {
    return (
      <>
        {layout.rows.map((row, i) => (
          <g key={i} className="task-row">
            <line className="task-row-rule" x1={24} x2={layout.width - 24} y1={row.y - 14} y2={row.y - 14} />
            {wrap(row.title, 20).map((line, i) => (
              <text key={i} className="task-row-title" x={24} y={row.y + 20 + i * 18}>
                {line}
              </text>
            ))}
          </g>
        ))}
        {layout.nodes.map((box) => (
          <NodeBox
            key={box.id}
            {...props}
            node={nodes.get(box.id)!}
            box={box}
            note={box.basedOn.length > 0 ? `Опирается на: ${box.basedOn.map((s) => sections.get(s)!.title).join(', ')}` : undefined}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <Edges edges={layout.edges} />
      {layout.blocks.map((block) => {
        const source = sections.get(block.sectionId)!;
        // Отметка и шаг маршрута видны и у тем из других разделов.
        const items = block.nodeIds.map((id) => {
          const step = route.indexOf(id) + 1;
          const mark = `${views.get(id) === 'mastered' ? ' ✓' : ''}${step ? ` (шаг ${step})` : ''}`;
          return { name: nodeLabel(nodes.get(id)!), mark };
        });
        const titles = items.map((t) => t.name + t.mark);
        return (
          <g
            key={block.sectionId}
            data-block={block.sectionId}
            className="block-group"
            role="button"
            tabIndex={0}
            aria-label={`Из раздела «${source.title}»: ${titles.join(', ')}. Перейти в раздел`}
            {...activate(() => onOpenSection(block.sectionId))}
          >
            <rect className="block" x={block.x} y={block.y} width={block.width} height={block.height} rx={8} />
            <text className="block-title" x={block.x + 10} y={block.y + 19}>
              {wrap(`${source.title} ↗`, 26, 1)[0]}
            </text>
            {items.map((t, i) => (
              <text key={i} className="block-item" x={block.x + 10} y={block.y + 40 + i * 18}>
                {/* Название обрезается так, чтобы отметка и шаг маршрута остались видны. */}
                {wrap(`· ${t.name}`, 27 - t.mark.length, 1)[0]}
                {t.mark && <tspan className="block-item-mark">{t.mark}</tspan>}
              </text>
            ))}
          </g>
        );
      })}
      {layout.nodes.map((box) => (
        <NodeBox key={box.id} {...props} node={nodes.get(box.id)!} box={box} />
      ))}
    </>
  );
}

function NodeBox({
  node,
  box,
  note,
  views,
  route,
  selectedId,
  onSelect,
}: Props & { node: MapNode; box: Box; note?: string }) {
  const label = nodeLabel(node);
  const view = views.get(node.id)!;
  const mastered = view === 'mastered';
  const step = route.indexOf(node.id) + 1 || undefined;
  const lineH = 16;
  const titleLines = wrap(label, 22);
  const noteLines = note ? wrap(note, 36, 3) : [];
  const allLines = titleLines.length + noteLines.length;
  const top = box.y + box.height / 2 - ((allLines - 1) * lineH) / 2;
  return (
    <g
      data-node={node.id}
      data-section-of={node.sectionId}
      data-mastered={mastered}
      data-view={view}
      data-route-step={step}
      className={`node-group view-${view}${step ? ' on-route' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${label}, ${VIEW_TITLES[view]}${step ? `, № ${step} в маршруте` : ''}${note ? `. ${note}` : ''}`}
      aria-pressed={node.id === selectedId}
      {...activate(() => onSelect(node.id))}
    >
      <rect
        className={`node node-${node.kind} node-${view}${node.id === selectedId ? ' node-selected' : ''}`}
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={8}
      />
      <text className="node-title" x={box.x + box.width / 2} textAnchor="middle">
        {titleLines.map((line, i) => (
          <tspan key={i} x={box.x + box.width / 2} y={top + i * lineH} dominantBaseline="middle">
            {line}
          </tspan>
        ))}
      </text>
      {noteLines.length > 0 && (
        <text className="node-note" x={box.x + box.width / 2} textAnchor="middle" aria-hidden>
          {noteLines.map((line, i) => (
            <tspan
              key={i}
              x={box.x + box.width / 2}
              y={top + (titleLines.length + i) * lineH + 2}
              dominantBaseline="middle"
            >
              {line}
            </tspan>
          ))}
        </text>
      )}
      {step && <RouteBadge x={box.x + box.width} y={box.y} text={String(step)} next={step === 1} />}
      {mastered && (
        <text className="node-check" x={box.x + box.width - 14} y={box.y + 15} textAnchor="middle" aria-hidden>
          ✓
        </text>
      )}
    </g>
  );
}

function Edges({ edges }: { edges: Edge[] }) {
  return edges.map((e) => (
    <path
      key={`${e.from}->${e.to}`}
      data-edge={`${e.from}->${e.to}`}
      className="edge"
      d={e.path}
      markerEnd="url(#arrow)"
    />
  ));
}

function RouteBadge({ x, y, text, next }: { x: number; y: number; text: string; next: boolean }) {
  return (
    <g className={`route-badge${next ? ' route-badge-next' : ''}`} aria-hidden>
      <circle cx={x} cy={y} r={11} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}

/** Щелчок, Enter и пробел делают одно и то же. */
function activate(action: () => void) {
  return {
    onClick: action,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
  };
}
