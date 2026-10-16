import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;
// Тесты открывают собранный сайт из подкаталога, как его отдаёт GitHub Pages
// (https://<владелец>.github.io/PythonMap/), поэтому в тестах адреса относительные: './'.
const SITE_PATH = '/PythonMap/';
const OUT_DIR = 'dist-e2e';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: `http://localhost:${PORT}${SITE_PATH}`,
    // Обычно ученик уже прошёл первый визит; его шаги проверяются отдельно, на чистом браузере.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PORT}`,
          localStorage: [{ name: 'python-map/first-visit-done', value: 'true' }],
        },
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Сайт в тестах — та же статическая сборка, что уходит на сайт, только на собственной
    // учебной карте, а не на настоящих данных, и со своим адресом канала для сообщений об ошибках.
    command: `npx vite build --outDir ${OUT_DIR} --emptyOutDir && npx vite preview --outDir ${OUT_DIR} --base ${SITE_PATH} --port ${PORT} --strictPort`,
    env: { MAP_DATA_DIR: 'tests/e2e/map', VITE_REPORT_URL: 'https://example.org/report?node={узел}' },
    url: `http://localhost:${PORT}${SITE_PATH}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
