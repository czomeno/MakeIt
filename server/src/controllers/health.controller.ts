import type { RequestHandler } from 'express';
import { getDbStatus } from '../config/db.js';

export const getHealth: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    db: getDbStatus(),
  });
};
