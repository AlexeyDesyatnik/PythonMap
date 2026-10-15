import { chooseGoal, type LearningMap, type StageChoice } from '../core';

interface Props {
  map: LearningMap;
  stage: StageChoice;
  onChange: (stage: StageChoice) => void;
}

/** Выбор цели и ступени внутри неё. */
export function StagePicker({ map, stage, onChange }: Props) {
  const goal = map.goals.find((g) => g.id === stage?.goalId);

  return (
    <div className="stage-picker">
      <label>
        Цель
        <select
          value={goal?.id ?? ''}
          onChange={(e) => onChange(chooseGoal(map, e.target.value))}
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
          onChange={(e) => goal && onChange({ goalId: goal.id, stageId: e.target.value })}
        >
          {!goal && <option value="">—</option>}
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
