import { defineConfig, devices } from '@playwright/test';

// Los e2e corren contra un build de producción servido con `vite preview` y
// con los emuladores de Firebase (Auth y Firestore). Se lanzan con
// `npm run test:e2e`, que envuelve todo en `firebase emulators:exec`.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : 'list',

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // El service worker de notificaciones no aporta en las pruebas.
    serviceWorkers: 'block'
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],

  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_USE_FIREBASE_EMULATOR: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-riesgo-uafe',
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-riesgo-uafe.firebaseapp.com',
      VITE_FIREBASE_APP_ID: '1:1234567890:web:demo'
    }
  }
});
