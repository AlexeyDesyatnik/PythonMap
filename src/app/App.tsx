import { useEffect, useMemo, useState } from 'react';
import { markMastered, nodeViews, progressCount, unmarkMastered, type LearningMap } from '../core';
import { MapView } from './MapView';
import { NodePanel } from './NodePanel';
import { StagePicker } from './StagePicker';
import { VIEW_TITLES } from './labels';
import { loadProgress, loadStage, saveProgress, saveStage } from './storage';

export function App({ map }: { map: LearningMap }) {
  const [progress, setProgress] = useState(() => loadProgress(map));
  const [stage, setStage] = useState(() => loadStage(map));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = map.nodes.find((n) => n.id === selectedId);
  const views = useMemo(() => nodeViews(map, progress, stage), [map, progress, stage]);
  const counts = useMemo(() => progressCount(map, progress, stage), [map, progress, stage]);

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
        <MapView
          map={map}
          views={views}
          sectionCounts={counts.sections}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <NodePanel
            key={selected.id}
            map={map}
            node={selected}
            progress={progress}
            onMark={() => setProgress((p) => markMastered(map, p, selected.id))}
            onUnmark={() => setProgress((p) => unmarkMastered(map, p, selected.id))}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </main>
  );
}
