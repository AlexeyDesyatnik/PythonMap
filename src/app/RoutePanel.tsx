import type { LearningMap, StageChoice } from '../core';
import { nodeLabel } from './labels';

interface Props {
  map: LearningMap;
  stage: StageChoice;
  /** Маршрут до выбранной ступени; `null` — ступень не выбрана. */
  route: string[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Маршрут списком: первый узел — следующий шаг. */
export function RoutePanel({ map, stage, route, selectedId, onSelect }: Props) {
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const stages = map.goals.find((g) => g.id === stage?.goalId)?.stages ?? [];
  const nextStage = stages[stages.findIndex((s) => s.id === stage?.stageId) + 1];

  return (
    <aside className="route-panel" role="region" aria-label="Маршрут">
      <h2 className="route-panel-title">Маршрут</h2>
      {route === null ? (
        <p className="route-panel-note">Выберите цель и ступень — карта построит маршрут до неё.</p>
      ) : route.length === 0 ? (
        <p className="route-panel-note route-reached">
          Ступень достигнута: все её узлы освоены.
          {nextStage && ` Можно браться за следующую — «${nextStage.title}».`}
        </p>
      ) : (
        <ol className="route-list">
          {route.map((id, i) => (
            <li key={id} className={i === 0 ? 'route-next' : undefined}>
              <button
                type="button"
                className="route-item"
                aria-pressed={id === selectedId}
                onClick={() => onSelect(id)}
              >
                <span className="route-step">{i + 1}</span>
                <span className="route-item-text">
                  {i === 0 && <span className="route-next-label">Следующий шаг</span>}
                  {nodeLabel(nodes.get(id)!)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
