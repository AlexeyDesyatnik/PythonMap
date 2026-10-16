import { useEffect, useMemo, useState } from 'react';
import { markMastered, nodeViews, progressCount, route, unmarkMastered, type LearningMap, type Progress } from '../core';
import type { MapLayout } from '../layout';
import { MapView } from './MapView';
import { NodePanel } from './NodePanel';
import { RoutePanel } from './RoutePanel';
import { SectionNodes } from './SectionNodes';
import { StagePicker } from './StagePicker';
import { VIEW_TITLES } from './labels';
import { loadProgress, loadStage, saveProgress, saveStage } from './storage';
import { usePhone } from './usePhone';

export function App({ map, layout }: { map: LearningMap; layout: MapLayout }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(map));
  const [stage, setStage] = useState(() => loadStage(map));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Открытый раздел; `null` — обзор.
  const [sectionId, setSectionId] = useState<string | null>(null);
  const selected = map.nodes.find((n) => n.id === selectedId);
  // На телефоне панель узла лежит поверх карты, поэтому убирается сама:
  // после отметки и при переходе в другой раздел или к обзору.
  const phone = usePhone();
  const openSection = (id: string | null) => {
    setSectionId(id);
    if (phone) setSelectedId(null);
  };
  const changeMark = (change: (p: Progress) => Progress) => {
    setProgress(change);
    if (phone) setSelectedId(null);
  };
  // Узел открывается вместе со своим разделом — так его видно на карте.
  const select = (id: string) => {
    setSelectedId(id);
    setSectionId(map.nodes.find((n) => n.id === id)!.sectionId);
  };
  const views = useMemo(() => nodeViews(map, progress, stage), [map, progress, stage]);
  const counts = useMemo(() => progressCount(map, progress, stage), [map, progress, stage]);
  const routeIds = useMemo(() => (stage ? route(map, progress, stage) : null), [map, progress, stage]);

  // Сохраняем и прогресс, приведённый к инварианту при загрузке.
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveStage(stage), [stage]);

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Карта изучения программирования</h1>
        <StagePicker map={map} stage={stage} onChange={setStage} />
        <p className="progress-total" data-testid="progress-total">
          Освоено {counts.total.mastered} из {counts.total.total}
        </p>
        <ul className="legend" aria-label="Виды узлов">
          {Object.entries(VIEW_TITLES).map(([view, title]) => (
            <li key={view} className={`legend-item legend-${view}`}>
              {title}
            </li>
          ))}
        </ul>
      </header>
      <div className="app-body">
        <RoutePanel map={map} stage={stage} route={routeIds} selectedId={selectedId} onSelect={select} />
        <MapView
          map={map}
          layout={layout}
          views={views}
          route={routeIds ?? []}
          sectionCounts={counts.sections}
          sectionId={sectionId}
          onOpenSection={openSection}
          selectedId={selectedId}
          onSelect={select}
        />
        {(selected || sectionId) && (
          <div className="side-panels">
            {selected && (
              <NodePanel
                key={selected.id}
                map={map}
                node={selected}
                progress={progress}
                views={views}
                onSelect={select}
                onMark={() => changeMark((p) => markMastered(map, p, selected.id))}
                onUnmark={() => changeMark((p) => unmarkMastered(map, p, selected.id))}
                onClose={phone ? undefined : () => setSelectedId(null)}
              />
            )}
            {sectionId && <SectionNodes map={map} sectionId={sectionId} selectedId={selectedId} onSelect={select} />}
          </div>
        )}
      </div>
    </main>
  );
}
