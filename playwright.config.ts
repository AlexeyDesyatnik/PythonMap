import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Сайт в тестах работает на собственной учебной карте, а не на настоящих данных,
    // и со своим адресом канала для сообщений об ошибках.
    command: `npx vite --port ${PORT} --strictPort`,
    env: { MAP_DATA_DIR: 'tests/e2e/map', VITE_REPORT_URL: 'https://example.org/report?node={узел}' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
