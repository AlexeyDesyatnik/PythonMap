import { useState, type ReactNode } from 'react';
import {
  unlockedNodes,
  unmarkAffected,
  type Link,
  type LearningMap,
  type MapNode,
  type NodeView,
  type Progress,
} from '../core';
import { nodeLabel, VIEW_TITLES } from './labels';
import { reportLink } from './settings';

interface Props {
  map: LearningMap;
  node: MapNode;
  progress: Progress;
  views: Map<string, NodeView>;
  /** Переход к другому узлу — пререквизиту или открываемому. */
  onSelect: (id: string) => void;
  onMark: () => void;
  onUnmark: () => void;
  /** Без него крестика нет: на телефоне панель убирается сама. */
  onClose?: () => void;
}

/** Панель узла: всё, что нужно, чтобы за него взяться, и его отметка. */
export function NodePanel({ map, node, progress, views, onSelect, onMark, onUnmark, onClose }: Props) {
  // Узлы, с которых снимется отметка, пока ученик решает в предупреждении.
  const [pendingUnmark, setPendingUnmark] = useState<MapNode[] | null>(null);
  const mastered = progress.has(node.id);
  const byId = (id: string) => map.nodes.find((n) => n.id === id)!;
  const prerequisites = node.prerequisites.map(byId);
  const unlocks = unlockedNodes(map, node.id).map(byId);
  const report = reportLink(nodeLabel(node));

  const toggle = () => {
    if (!mastered) return onMark();
    const affected = unmarkAffected(map, progress, node.id);
    if (affected.length === 0) return onUnmark();
    setPendingUnmark(affected.map(byId));
  };

  return (
    <aside className="node-panel" role="region" aria-label="Узел">
      {onClose && (
        <button type="button" className="node-panel-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
      )}
      <h2 className="node-panel-title">{nodeLabel(node)}</h2>
      <p className="node-panel-description">{node.description}</p>
      <label className="node-panel-mark">
        <input type="checkbox" checked={mastered} onChange={toggle} />
        Освоен
      </label>

      {node.materials.length === 0 && node.checkTasks.length === 0 ? (
        <p className="node-panel-note">Материалы появятся.</p>
      ) : (
        <>
          <Links title="Материалы" links={node.materials} />
          <Links title="Контрольные задачи" links={node.checkTasks}>
            <p className="node-panel-hint">Реши их сам — и отмечай узел освоенным.</p>
          </Links>
        </>
      )}

      <NodeLinks title="Пререквизиты" nodes={prerequisites} views={views} onSelect={onSelect}>
        <p className="node-panel-note">Нет: с этого узла можно начинать.</p>
      </NodeLinks>
      <NodeLinks title="Открывает" nodes={unlocks} views={views} onSelect={onSelect} />

      {report && (
        <p className="node-panel-report">
          <a href={report} target="_blank" rel="noopener noreferrer">
            Сообщить об ошибке
          </a>
        </p>
      )}

      {pendingUnmark && (
        <div className="dialog-backdrop">
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unmark-title"
            onKeyDown={(e) => e.key === 'Escape' && setPendingUnmark(null)}
          >
            <p id="unmark-title">
              Отметка снимется не только с узла «{nodeLabel(node)}», но и с узлов, которые на него опираются:
            </p>
            <ul>
              {pendingUnmark.map((n) => (
                <li key={n.id}>{nodeLabel(n)}</li>
              ))}
            </ul>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingUnmark(null)} autoFocus>
                Отмена
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setPendingUnmark(null);
                  onUnmark();
                }}
              >
                Снять отметку
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Внешние ссылки узла; пустой список не показывается. `children` — пояснение под списком. */
function Links({ title, links, children }: { title: string; links: Link[]; children?: ReactNode }) {
  if (links.length === 0) return null;
  return (
    <section className="node-panel-part">
      <h3>{title}</h3>
      <ul className="node-panel-links">
        {links.map((link) => (
          <li key={link.url}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.title}
            </a>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

interface NodeLinksProps {
  title: string;
  nodes: MapNode[];
  views: Map<string, NodeView>;
  onSelect: (id: string) => void;
  /** Что показать, если узлов нет; без него пустой список не показывается. */
  children?: ReactNode;
}

/** Соседние узлы с их видом; щелчок открывает узел. */
function NodeLinks({ title, nodes, views, onSelect, children }: NodeLinksProps) {
  if (nodes.length === 0 && !children) return null;
  return (
    <section className="node-panel-part">
      <h3>{title}</h3>
      {nodes.length === 0 ? (
        children
      ) : (
        <ul className="node-panel-nodes" aria-label={title}>
          {nodes.map((n) => {
            const view = views.get(n.id)!;
            return (
              <li key={n.id} data-mastered={view === 'mastered'}>
                <button type="button" className={`node-panel-node legend-${view}`} onClick={() => onSelect(n.id)}>
                  {nodeLabel(n)}
                  <span className="node-panel-view">{VIEW_TITLES[view]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
