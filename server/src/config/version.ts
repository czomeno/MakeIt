import { readFileSync } from 'node:fs';
import { env } from './env.js';

// ../../package.json funciona igual desde src/config (tsx, tests) que desde
// dist/config (imagen de producción, que copia el package.json a /app).
function packageVersion(): string {
  try {
    const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const appVersion =
  env.APP_VERSION ?? env.RENDER_GIT_COMMIT?.slice(0, 12) ?? packageVersion();
