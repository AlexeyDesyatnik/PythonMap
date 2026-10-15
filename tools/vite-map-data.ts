// Подключает данные карты к сайту как модуль `virtual:map-data`: сырые данные
// файлов и раскладку карты, посчитанную здесь же, при сборке.
// Каталог берётся из переменной окружения MAP_DATA_DIR (так тесты сайта
// подставляют свою учебную карту), иначе — настоящие данные.
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { buildMap } from '../src/core/index.ts';
import { mapLayout } from '../src/layout/index.ts';
import { DEFAULT_MAP_DIR, listMapFiles, readMapFiles } from './map-files.ts';

const ID = 'virtual:map-data';
const RESOLVED_ID = '\0' + ID;

export function mapData(): Plugin {
  const dir = resolve(process.env.MAP_DATA_DIR ?? DEFAULT_MAP_DIR);
  return {
    name: 'map-data',
    resolveId(id) {
      return id === ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      for (const file of listMapFiles(dir)) this.addWatchFile(file);
      const data = readMapFiles(dir);
      return `export default ${JSON.stringify({ data, layout: mapLayout(buildMap(data)) })};`;
    },
    configureServer(server) {
      // Новый или удалённый файл раздела тоже должен обновить страницу.
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!resolve(file).startsWith(dir) || !file.endsWith('.yaml')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
      server.watcher.on('change', reload);
    },
  };
}
