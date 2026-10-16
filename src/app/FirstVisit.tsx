import { useState } from 'react';
import type { LearningMap, StageChoice } from '../core';
import { StagePicker } from './StagePicker';

/** Шаг первого визита, который сейчас показан. */
export type FirstVisitStep = 'stage' | 'marks';

interface StageStepProps {
  map: LearningMap;
  stage: StageChoice;
  /** Будет ли после этого шаг отметки: если прогресс уже есть, его нет. */
  marksStepNext: boolean;
  /** Выбранная ступень; `null` — шаг пропущен, и выбор не меняется. */
  onDone: (stage: StageChoice | null) => void;
}

/** Шаг 1: цель и ступень. Выбор вступает в силу только по кнопке «Дальше». */
export function StageStep({ map, stage, marksStepNext, onDone }: StageStepProps) {
  const [draft, setDraft] = useState(stage);
  return (
    <div className="dialog-backdrop">
      <div
        className="dialog first-visit"
        role="dialog"
        aria-modal="true"
        aria-label="Первый визит: цель и ступень"
      >
        {marksStepNext && <p className="first-visit-step">Шаг 1 из 2</p>}
        <h2 className="first-visit-title">Ради чего вы учитесь?</h2>
        <p>
          Выберите цель и ступень — ближайший рубеж на пути к ней. Карта построит маршрут до ступени и
          покажет, с чего начать. Сменить ступень можно в любой момент.
        </p>
        <StagePicker map={map} stage={draft} onChange={setDraft} />
        <div className="dialog-actions">
          <button type="button" onClick={() => onDone(null)}>
            Пропустить
          </button>
          <button type="button" className="primary" disabled={!draft} onClick={() => onDone(draft)}>
            Дальше
          </button>
        </div>
      </div>
    </div>
  );
}

interface MarksStepProps {
  /** Отмечено ли уже что-нибудь: от этого зависит подпись кнопки. */
  marked: boolean;
  onDone: () => void;
}

/** Шаг 2: отметка самого сложного из освоенного — прямо на карте, под этой подсказкой. */
export function MarksStep({ marked, onDone }: MarksStepProps) {
  return (
    <section className="first-visit-marks" role="region" aria-label="Первый визит: отметка">
      <div>
        <p className="first-visit-step">Шаг 2 из 2</p>
        <p>
          Отметьте на карте самое сложное из того, что уже умеете: откройте раздел, в нём узел — и поставьте
          «Освоен». Всё, на что узел опирается, отметится само.
        </p>
      </div>
      <button type="button" className="primary" onClick={onDone}>
        {marked ? 'Готово' : 'Пропустить'}
      </button>
    </section>
  );
}
