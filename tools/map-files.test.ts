import { describe, expect, it } from 'vitest';
import { buildMap, validateMap } from '../src/core/index.ts';
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
});
