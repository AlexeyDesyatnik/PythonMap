import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Box } from '../layout';

interface Props {
  /** Размер содержимого в координатах раскладки. */
  width: number;
  height: number;
  /** Смена ключа — новое содержимое: оно вписывается в окно заново. */
  contentKey: string;
  /** Блок, который должен быть виден (например, открытый из маршрута узел). */
  focus: Box | null;
  label: string;
  /**
   * Наименьший масштаб, при котором подписи ещё читаются. Новое содержимое
   * не уменьшается сильнее, а прокручивается вбок; кнопка «Показать целиком»
   * всё равно показывает его целиком.
   */
  readableScale?: number;
  children: ReactNode;
}

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.25;
const MAX_K = 2.5;
const PAD = 16;
/** Сдвиг мыши, после которого нажатие считается перетаскиванием, а не щелчком. */
const DRAG_THRESHOLD = 4;

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/** SVG, который можно перетаскивать мышью или пальцем и масштабировать колесом и кнопками. */
export function PanZoom({ width, height, contentKey, focus, label, readableScale = MIN_K, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const fittedKey = useRef<string | null>(null);
  // Ученик сам двигал или масштабировал карту — смена размера окна её больше не вписывает.
  const touched = useRef(false);
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitted = (minK = MIN_K): View => {
    const k = clampK(Math.max(minK, Math.min(1, (size.w - 2 * PAD) / width, (size.h - 2 * PAD) / height)));
    return { k, x: (size.w - width * k) / 2, y: Math.max(PAD, (size.h - height * k) / 2) };
  };

  // Новое содержимое вписывается в окно; блок фокуса, если он за краем, переводится в центр.
  useLayoutEffect(() => {
    if (size.w === 0) return;
    let next = view;
    if (fittedKey.current !== contentKey || !touched.current) {
      fittedKey.current = contentKey;
      touched.current = false;
      next = fitted(readableScale);
    }
    if (focus) {
      const left = next.x + focus.x * next.k;
      const top = next.y + focus.y * next.k;
      const visible =
        left >= 0 && top >= 0 && left + focus.width * next.k <= size.w && top + focus.height * next.k <= size.h;
      if (!visible) {
        next = {
          ...next,
          x: size.w / 2 - (focus.x + focus.width / 2) * next.k,
          y: size.h / 2 - (focus.y + focus.height / 2) * next.k,
        };
      }
    }
    if (next !== view) setView(next);
    // Пересчёт нужен только при смене содержимого, фокуса или размера окна.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, focus, size]);

  // Колесо масштабирует вокруг указателя; обработчик не пассивный, чтобы страница не прокручивалась.
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomAt = (factor: number, px: number, py: number) => {
    touched.current = true;
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  };

  return (
    <div className="map-viewport">
      <div
        ref={ref}
        className="map-canvas"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.sx;
          const dy = e.clientY - d.sy;
          if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          if (!d.moved) {
            d.moved = true;
            touched.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(e) => {
          if (drag.current?.moved) suppressClick.current = true;
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onClickCapture={(e) => {
          // Отпущенная после перетаскивания кнопка не должна открывать узел.
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
          }
        }}
      >
        <svg className="map" role="group" aria-label={label} width="100%" height="100%">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="arrow-head" />
            </marker>
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>{children}</g>
        </svg>
      </div>
      <div className="zoom-controls">
        <button type="button" aria-label="Крупнее" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)}>
          +
        </button>
        <button type="button" aria-label="Мельче" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)}>
          −
        </button>
        <button type="button" aria-label="Показать целиком" title="Показать целиком" onClick={() => {
            touched.current = false;
            setView(fitted());
          }}>
          ⤢
        </button>
      </div>
    </div>
  );
}
