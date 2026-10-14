import { Server, type DefaultEventsMap } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { verifyAccessToken } from '../utils/tokens.js';
import { Board } from '../models/Board.js';
import { env } from '../config/env.js';
import { setSocketServer } from '../services/realtime.service.js';
import { addPresence, removePresence, removePresenceEverywhere, listPresence } from './presence.js';
import type { SocketData } from './types.js';

const joinLeaveSchema = z.object({ boardId: z.string().refine(isValidObjectId) });

// Solo hay dos eventos de cliente (board:join / board:leave), así que una
// ventana deslizante simple en memoria basta de límite de eventos por socket.
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(socketId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  timestamps.push(now);
  rateBuckets.set(socketId, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

type AckResponse = { ok: true } | { error: 'RATE_LIMITED' | 'INVALID_PAYLOAD' | 'FORBIDDEN' };

export function initSocket(httpServer: HttpServer) {
  const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(
    httpServer,
    {
      path: env.SOCKET_PATH,
      cors: { origin: env.CORS_ORIGIN, credentials: true },
      // Los eventos de cliente son minúsculos (solo board:join/leave, un id).
      maxHttpBufferSize: 16 * 1024,
    },
  );

  // Autenticación del handshake con el mismo access token JWT que requireAuth;
  // sin token válido, se rechaza la conexión entera (el cliente debe
  // refrescar su access token y reconectar).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as unknown;
    if (typeof token !== 'string' || !token) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.name = payload.name;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] conectado ${socket.id} (user ${socket.data.userId})`);

    socket.on('board:join', async (raw: unknown, ack?: (response: AckResponse) => void) => {
      if (isRateLimited(socket.id)) {
        ack?.({ error: 'RATE_LIMITED' });
        return;
      }
      const parsed = joinLeaveSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ error: 'INVALID_PAYLOAD' });
        return;
      }
      const { boardId } = parsed.data;

      // No-miembro -> error genérico, igual que requireBoardRole con REST:
      // no revela si el tablero existe.
      const board = await Board.findById(boardId).select('members').lean();
      const isMember =
        board?.members.some((member) => member.user.toString() === socket.data.userId) ?? false;
      if (!isMember) {
        ack?.({ error: 'FORBIDDEN' });
        return;
      }

      await socket.join(`board:${boardId}`);
      addPresence(boardId, socket.id, socket.data.userId, socket.data.name);
      io.to(`board:${boardId}`).emit('presence:update', { users: listPresence(boardId) });
      ack?.({ ok: true });
    });

    socket.on('board:leave', (raw: unknown) => {
      if (isRateLimited(socket.id)) {
        return;
      }
      const parsed = joinLeaveSchema.safeParse(raw);
      if (!parsed.success) {
        return;
      }
      const { boardId } = parsed.data;
      void socket.leave(`board:${boardId}`);
      removePresence(boardId, socket.id);
      io.to(`board:${boardId}`).emit('presence:update', { users: listPresence(boardId) });
    });

    socket.on('disconnect', () => {
      const affectedBoards = removePresenceEverywhere(socket.id);
      for (const boardId of affectedBoards) {
        io.to(`board:${boardId}`).emit('presence:update', { users: listPresence(boardId) });
      }
      rateBuckets.delete(socket.id);
      console.log(`[socket] desconectado ${socket.id}`);
    });
  });

  setSocketServer(io);
  return io;
}
