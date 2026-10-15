import { execSync } from 'node:child_process';

const COMPOSE = 'docker compose -f docker-compose.e2e.yml';

export default function globalSetup(): void {
  if (process.env.E2E_BASE_URL) {
    return;
  }
  // Empieza siempre de cero (Mongo en tmpfs) y espera a que los tres
  // servicios estén "healthy" (los healthchecks usan /api/ready y /healthz).
  execSync(`${COMPOSE} down -v --remove-orphans`, { stdio: 'inherit' });
  execSync(`${COMPOSE} up -d --build --wait`, { stdio: 'inherit' });
}
