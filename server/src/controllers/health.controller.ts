import type { RequestHandler } from 'express';
import { getDbStatus } from '../config/db.js';
import { appVersion } from '../config/version.js';
import { isShuttingDown } from '../config/lifecycle.js';

// Liveness: el proceso responde. Siempre 200 mientras viva; informa del
// estado de la base de datos pero no depende de él (reiniciar la API no
// arregla un Mongo caído).
export const getHealth: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    version: appVersion,
    uptime: Math.round(process.uptime()),
    db: getDbStatus(),
  });
};

// Readiness: puede atender tráfico. 503 si Mongo no está conectado o si ya
// empezó el apagado ordenado. Es lo que usan el HEALTHCHECK de la imagen y
// los depends_on de Compose.
export const getReady: RequestHandler = (_req, res) => {
  const db = getDbStatus();
  const shuttingDown = isShuttingDown();
  const ready = db === 'connected' && !shuttingDown;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', db, shuttingDown });
};
