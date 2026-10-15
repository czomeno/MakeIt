/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 30000,
  // Fuera: puntos de entrada y scripts de operación (se prueban ejecutándolos).
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/seed.ts',
    '!src/scripts/**',
    '!src/types/**',
  ],
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  // Umbral mínimo: por debajo, `npm run test:coverage` (y el CI) fallan.
  // Fijado unos puntos por debajo de la cobertura real tras la Fase 5 para
  // que no frene cambios legítimos, pero sí detecte que se deja de probar.
  coverageThreshold: {
    global: { lines: 90, statements: 90, functions: 90, branches: 75 },
  },
};
