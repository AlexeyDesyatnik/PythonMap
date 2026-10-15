import { describe, expect, it } from 'vitest';
import { buildMap, validateMap } from '../src/core/index.ts';
import { mapLayout, type Box } from '../src/layout/index.ts';
import { DEFAULT_MAP_DIR, readMapFiles } from './map-files.ts';

describe('настоящие файлы карты', () => {
  it('читаются и собираются в карту', () => {
    const map = buildMap(readMapFiles(DEFAULT_MAP_DIR));

    expect(map.sections.length).toBeGreaterThan(0);
    expect(map.nodes.length).toBeGreaterThan(0);
  });

  it('не содержат блокирующих ошибок', () => {
    const errors = validateMap(buildMap(readMapFiles(DEFAULT_MAP_DIR))).filter((i) => i.severity === 'error');

    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('раскладываются так, что все блоки помещаются в размер раскладки', () => {
    const layout = mapLayout(buildMap(readMapFiles(DEFAULT_MAP_DIR)));
    const outside = (name: string, size: { width: number; height: number }, boxes: (Box & { id?: string })[]) =>
      boxes
        .filter((b) => b.x < 0 || b.y < 0 || b.x + b.width > size.width || b.y + b.height > size.height)
        .map((b) => `${name}: ${b.id}`);

    const problems = [
      ...outside('обзор', layout.overview, layout.overview.sections),
      ...Object.entries(layout.sections).flatMap(([id, s]) =>
        outside(id, s, s.kind === 'graph' ? [...s.nodes, ...s.blocks.map((b) => ({ ...b, id: b.sectionId }))] : s.nodes),
      ),
    ];
    expect(problems).toEqual([]);
  });

  it('раскладываются без наложения блоков друг на друга', () => {
    const layout = mapLayout(buildMap(readMapFiles(DEFAULT_MAP_DIR)));
    const overlapping = (name: string, boxes: (Box & { id?: string; sectionId?: string })[]) => {
      const found: string[] = [];
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          const apart =
            a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          if (!apart) found.push(`${name}: ${a.id ?? a.sectionId} и ${b.id ?? b.sectionId}`);
        }
      }
      return found;
    };

    const problems = [
      ...overlapping('обзор', layout.overview.sections),
      ...Object.entries(layout.sections).flatMap(([id, s]) =>
        overlapping(id, s.kind === 'graph' ? [...s.nodes, ...s.blocks] : s.nodes),
      ),
    ];
    expect(problems).toEqual([]);
  });
});
