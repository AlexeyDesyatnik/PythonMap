import { useEffect, useMemo, useState } from 'react';
import {
  markMastered,
  mergeProgress,
  nodeViews,
  progressCount,
  route,
  unfoldProgress,
  unmarkMastered,
  type LearningMap,
  type Progress,
  type StageChoice,
} from '../core';
import type { MapLayout } from '../layout';
import { MarksStep, StageStep, type FirstVisitStep } from './FirstVisit';
import { MapView } from './MapView';
import { NodePanel } from './NodePanel';
import { ProgressLinkQuestion, ShareProgress, type LinkAnswer } from './ProgressLink';
import { clearProgressLink, readProgressLink } from './linkAddress';
import { RoutePanel } from './RoutePanel';
import { SectionNodes } from './SectionNodes';
import { StagePicker } from './StagePicker';
import { VIEW_TITLES } from './labels';
import {
  loadFirstVisitDone,
  loadProgress,
  loadStage,
  saveFirstVisitDone,
  saveProgress,
  saveStage,
} from './storage';
import { usePhone } from './usePhone';

export function App({ map, layout }: { map: LearningMap; layout: MapLayout }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(map));
  const [stage, setStage] = useState(() => loadStage(map));
  // Прогресс из ссылки, по которой открыта страница, пока она не обработана.
  const [linked, setLinked] = useState(() => readLinked(map));
  useEffect(() => {
    // Ссылку могут вставить и в уже открытую вкладку — тогда меняется только часть после `#`.
    const onHashChange = () => setLinked(readLinked(map));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [map]);
  const answerLink = (answer: LinkAnswer) => {
    if (!linked) return;
    if (answer === 'replace') setProgress(linked);
    if (answer === 'merge') setProgress((p) => mergeProgress(p, linked));
    setLinked(null);
    clearProgressLink();
  };
  // Спрашивать нечего, если своего прогресса нет, если он тот же, что в ссылке,
  // или если в ссылке не осталось ни одного узла текущей карты.
  const askLink = linked !== null && progress.size > 0 && linked.size > 0 && !sameProgress(progress, linked);
  useEffect(() => {
    if (!linked || askLink) return;
    if (progress.size === 0) setProgress(linked);
    setLinked(null);
    clearProgressLink();
  }, [linked, askLink, progress]);
  // Шаги первого визита; `null` — их уже прошли или пропустили.
  const [firstVisit, setFirstVisit] = useState<FirstVisitStep | null>(() => (loadFirstVisitDone() ? null : 'stage'));
  const finishFirstVisit = () => {
    setFirstVisit(null);
    saveFirstVisitDone();
  };
  // Если прогресс уже есть, отмечать с нуля нечего — шаг отметки не нужен.
  const afterStageStep = (chosen: StageChoice | null) => {
    if (chosen) setStage(chosen);
    if (progress.size > 0) finishFirstVisit();
    else setFirstVisit('marks');
  };
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
        <ShareProgress map={map} progress={progress} />
        <ul className="legend" aria-label="Виды узлов">
          {Object.entries(VIEW_TITLES).map(([view, title]) => (
            <li key={view} className={`legend-item legend-${view}`}>
              {title}
            </li>
          ))}
        </ul>
      </header>
      {firstVisit === 'marks' && <MarksStep marked={progress.size > 0} onDone={finishFirstVisit} />}
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
      {askLink && <ProgressLinkQuestion linked={linked} own={progress} onAnswer={answerLink} />}
      {/* Шаги первого визита ждут, пока ссылка обработана: шаг 1 смотрит, есть ли уже прогресс. */}
      {firstVisit === 'stage' && !linked && (
        <StageStep map={map} stage={stage} marksStepNext={progress.size === 0} onDone={afterStageStep} />
      )}
    </main>
  );
}

function readLinked(map: LearningMap): Progress | null {
  const ids = readProgressLink();
  return ids && unfoldProgress(map, ids);
}

function sameProgress(a: Progress, b: Progress): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}
