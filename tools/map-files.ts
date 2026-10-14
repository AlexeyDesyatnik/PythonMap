// Чтение файлов карты с диска. Используется сборкой сайта и инструментами автора;
// в браузер не попадает.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import type { RawMapData, SourceFile } from '../src/core/index.ts';

/** Каталог настоящих данных карты. */
export const DEFAULT_MAP_DIR = 'data/map';

/**
 * Каталог карты устроен так:
 *   goals.yaml           — цели и ступени;
 *   sections/*.yaml      — по файлу на раздел; порядок разделов задаётся
 *                          порядком имён файлов (поэтому они начинаются с номера).
 */
export function readMapFiles(dir: string): RawMapData {
  const sectionsDir = join(dir, 'sections');
  const sectionFiles = readdirSync(sectionsDir)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => join(sectionsDir, name));
  return {
    sections: sectionFiles.map(readYaml),
    goals: readYaml(join(dir, 'goals.yaml')),
  };
}

/** Все файлы карты — чтобы сборка следила за их изменениями. */
export function listMapFiles(dir: string): string[] {
  const sectionsDir = join(dir, 'sections');
  return [
    join(dir, 'goals.yaml'),
    ...readdirSync(sectionsDir)
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => join(sectionsDir, name)),
  ];
}

function readYaml(path: string): SourceFile {
  const source = relative(process.cwd(), path).split(sep).join('/');
  return { source, content: parse(readFileSync(path, 'utf8')) };
}
