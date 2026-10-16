import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mapData } from './tools/vite-map-data.ts';

export default defineConfig({
  // Относительные адреса файлов сайта: собранный сайт работает из любого каталога —
  // и на GitHub Pages (…/PythonMap/), и в корне собственного домена.
  base: './',
  plugins: [react(), mapData()],
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
