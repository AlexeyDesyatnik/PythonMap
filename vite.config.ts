import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mapData } from './tools/vite-map-data.ts';

export default defineConfig({
  plugins: [react(), mapData()],
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
