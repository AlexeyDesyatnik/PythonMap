import { useState } from 'react';
import { unmarkAffected, type LearningMap, type MapNode, type Progress } from '../core';
import { nodeLabel } from './labels';

interface Props {
  map: LearningMap;
  node: MapNode;
  progress: Progress;
  onMark: () => void;
  onUnmark: () => void;
  /** Без него крестика нет: на телефоне панель убирается сама. */
  onClose?: () => void;
}

/** Панель узла. Пока в ней название и отметка; остальное содержимое — отдельная задача. */
export function NodePanel({ map, node, progress, onMark, onUnmark, onClose }: Props) {
  // Узлы, с которых снимется отметка, пока ученик решает в предупреждении.
  const [pendingUnmark, setPendingUnmark] = useState<MapNode[] | null>(null);
  const mastered = progress.has(node.id);

  const toggle = () => {
    if (!mastered) return onMark();
    const affected = unmarkAffected(map, progress, node.id);
    if (affected.length === 0) return onUnmark();
    setPendingUnmark(affected.map((id) => map.nodes.find((n) => n.id === id)!));
  };

  return (
    <aside className="node-panel" role="region" aria-label="Узел">
      {onClose && (
        <button type="button" className="node-panel-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
      )}
      <h2 className="node-panel-title">{nodeLabel(node)}</h2>
      <label className="node-panel-mark">
        <input type="checkbox" checked={mastered} onChange={toggle} />
        Освоен
      </label>

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
