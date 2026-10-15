import { describe, it, expect } from '@jest/globals';
import { parseEnv } from '../src/config/env.js';

const strong = (seed: string) => `${seed}-Vx9qLr2mT7wZpK4sN8cJ1bYfH6dG3aE5`;

const production = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://app:pass@cluster0.abcde.mongodb.net/makeit?retryWrites=true',
  JWT_ACCESS_SECRET: strong('acc'),
  JWT_REFRESH_SECRET: strong('ref'),
  APP_BASE_URL: 'https://makeit.onrender.com',
};

function errorsFor(overrides: Record<string, string | undefined>) {
  const result = parseEnv({ ...production, ...overrides });
  return result.success ? [] : result.errors;
}

describe('validación de variables de entorno en producción', () => {
  it('acepta una configuración válida con mongodb+srv y respeta PORT', () => {
    const result = parseEnv({ ...production, PORT: '10000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(10000);
      expect(result.data.CORS_ORIGIN).toBeUndefined();
      expect(result.data.SERVE_CLIENT).toBe(false);
    }
  });

  it('rechaza arrancar sin MONGO_URI o con una cadena que no es de Mongo', () => {
    expect(errorsFor({ MONGO_URI: undefined }).join()).toMatch(/MONGO_URI/);
    expect(errorsFor({ MONGO_URI: 'postgres://x' }).join()).toMatch(/MONGO_URI/);
  });

  it('rechaza los secretos de ejemplo de .env.example', () => {
    const errors = errorsFor({
      JWT_ACCESS_SECRET: 'dev-access-secret-change-me-before-deploying',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-before-deploying',
    });
    expect(errors.join()).toMatch(/JWT_ACCESS_SECRET.*ejemplo/);
    expect(errors.join()).toMatch(/JWT_REFRESH_SECRET.*ejemplo/);
  });

  it('rechaza secretos cortos e iguales entre sí', () => {
    expect(errorsFor({ JWT_ACCESS_SECRET: 'corto-pero-de-16-car' }).join()).toMatch(/32/);
    const same = strong('mismo');
    expect(errorsFor({ JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same }).join()).toMatch(
      /distinto/,
    );
  });

  it('exige APP_BASE_URL con https (salvo localhost)', () => {
    expect(errorsFor({ APP_BASE_URL: undefined }).join()).toMatch(/APP_BASE_URL/);
    expect(errorsFor({ APP_BASE_URL: 'http://makeit.example.org' }).join()).toMatch(/https/);
    expect(errorsFor({ APP_BASE_URL: 'http://localhost:8080' })).toEqual([]);
  });

  it('fuera de producción no aplica esas reglas y usa la URL de desarrollo', () => {
    const result = parseEnv({
      MONGO_URI: 'mongodb://localhost/kanban',
      JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.APP_BASE_URL).toBe('http://localhost:5173');
    }
  });
});
