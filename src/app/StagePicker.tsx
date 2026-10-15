import { useState } from 'react';
import type { LearningMap, StageChoice } from '../core';

interface Props {
  map: LearningMap;
  stage: StageChoice;
  onChange: (stage: StageChoice) => void;
}

/**
 * Выбор цели и ступени внутри неё. Ступень ученик выбирает сам: после выбора
 * или смены цели ступень не выбрана.
 */
export function StagePicker({ map, stage, onChange }: Props) {
  const [goalId, setGoalId] = useState(stage?.goalId ?? '');
  const goal = map.goals.find((g) => g.id === goalId);

  return (
    <div className="stage-picker">
      <label>
        Цель
        <select
          value={goalId}
          onChange={(e) => {
            setGoalId(e.target.value);
            onChange(null);
          }}
        >
          <option value="">Не выбрана</option>
          {map.goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ступень
        <select
          value={stage?.stageId ?? ''}
          disabled={!goal}
          onChange={(e) => goal && onChange(e.target.value ? { goalId: goal.id, stageId: e.target.value } : null)}
        >
          <option value="">{goal ? 'Выберите ступень' : '—'}</option>
          {goal?.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
