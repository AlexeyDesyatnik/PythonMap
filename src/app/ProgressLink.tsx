import { useState } from 'react';
import { foldProgress, type LearningMap, type Progress } from '../core';
import { progressLinkUrl } from './linkAddress';

interface ShareProps {
  map: LearningMap;
  progress: Progress;
}

/**
 * Кнопка «Ссылка с прогрессом»: копирует ссылку и показывает её отдельной строкой
 * шапки, чтобы её можно было скопировать и вручную.
 */
export function ShareProgress({ map, progress }: ShareProps) {
  // Показанная ссылка и удалось ли её скопировать; `null` — ссылка не показана.
  const [shown, setShown] = useState<{ url: string; copied: boolean } | null>(null);
  const share = async () => {
    const url = progressLinkUrl(foldProgress(map, progress));
    setShown({ url, copied: false });
    try {
      await navigator.clipboard.writeText(url);
      setShown({ url, copied: true });
    } catch {
      // Браузер не дал доступа к буферу обмена — ссылка всё равно видна в поле.
    }
  };
  return (
    <>
      <button
        className="share-progress"
        type="button"
        disabled={progress.size === 0}
        title={progress.size === 0 ? 'Пока ничего не освоено' : undefined}
        onClick={share}
      >
        Ссылка с прогрессом
      </button>
      {shown && (
        <div className="share-progress-popup" role="region" aria-label="Ваша ссылка с прогрессом">
          <input
            readOnly
            aria-label="Ссылка с прогрессом"
            value={shown.url}
            onFocus={(e) => e.target.select()}
          />
          <p>
            {shown.copied ? 'Ссылка скопирована. ' : 'Скопируйте ссылку. '}
            Откройте её на другом устройстве или отправьте преподавателю. Ссылка не обновляется сама: после новых
            отметок получите новую.
          </p>
          <button type="button" onClick={() => setShown(null)}>
            Закрыть
          </button>
        </div>
      )}
    </>
  );
}

export type LinkAnswer = 'replace' | 'merge' | 'cancel';

interface QuestionProps {
  linked: Progress;
  own: Progress;
  onAnswer: (answer: LinkAnswer) => void;
}

/** Вопрос, что делать со ссылкой, если в браузере уже есть другой прогресс. Без ответа ничего не меняется. */
export function ProgressLinkQuestion({ linked, own, onAnswer }: QuestionProps) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="progress-link-title">
        <h2 id="progress-link-title" className="first-visit-title">
          По ссылке открыт другой прогресс
        </h2>
        <p>
          В ссылке освоено узлов: {linked.size}. В этом браузере: {own.size}. Что сделать?
        </p>
        <ul>
          <li>«Заменить» — оставить только прогресс из ссылки.</li>
          <li>«Объединить» — освоенным будет всё, что освоено хотя бы в одном из двух.</li>
          <li>«Отменить» — оставить свой прогресс как есть.</li>
        </ul>
        <div className="dialog-actions">
          <button type="button" onClick={() => onAnswer('cancel')} autoFocus>
            Отменить
          </button>
          <button type="button" onClick={() => onAnswer('merge')}>
            Объединить
          </button>
          <button type="button" className="primary" onClick={() => onAnswer('replace')}>
            Заменить
          </button>
        </div>
      </div>
    </div>
  );
}
