import { useEffect, useState } from 'react';
import { markMastered, unmarkMastered, type LearningMap } from '../core';
import { MapView } from './MapView';
import { NodePanel } from './NodePanel';
import { loadProgress, saveProgress } from './storage';

export function App({ map }: { map: LearningMap }) {
  const [progress, setProgress] = useState(() => loadProgress(map));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = map.nodes.find((n) => n.id === selectedId);

  // Сохраняем и прогресс, приведённый к инварианту при загрузке.
  useEffect(() => saveProgress(progress), [progress]);

  return (
    <main className="app">
      <h1 className="app-title">Карта изучения программирования</h1>
      <div className="app-body">
        <MapView map={map} progress={progress} selectedId={selectedId} onSelect={setSelectedId} />
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
