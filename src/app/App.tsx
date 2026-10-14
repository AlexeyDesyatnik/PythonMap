import type { LearningMap } from '../core';
import { MapView } from './MapView';

export function App({ map }: { map: LearningMap }) {
  return (
    <main className="app">
      <h1 className="app-title">Карта изучения программирования</h1>
      <MapView map={map} />
    </main>
  );
}
