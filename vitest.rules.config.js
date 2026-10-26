import { defineConfig } from 'vitest/config';

// Los tests de reglas necesitan el emulador de Firestore. Se ejecutan aparte
// con `npm run test:rules` para que `npm test` siga siendo rápido y sin Java.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false
  }
});
