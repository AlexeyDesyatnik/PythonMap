import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Сайт в тестах работает на собственной учебной карте, а не на настоящих данных.
    command: `npx vite --port ${PORT} --strictPort`,
    env: { MAP_DATA_DIR: 'tests/e2e/map' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
