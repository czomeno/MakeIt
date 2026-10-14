import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initSocket } from '../src/socket/index.js';
import { env } from '../src/config/env.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();
const httpServer = createServer(app);
let io: ReturnType<typeof initSocket>;
let baseUrl: string;
const openSockets: ClientSocket[] = [];

beforeAll(async () => {
  await connectTestDB();
  io = initSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterEach(async () => {
  for (const socket of openSockets) {
    socket.disconnect();
  }
  openSockets.length = 0;
  await clearTestDB();
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await closeTestDB();
});

function connectAs(accessToken: string): ClientSocket {
  const socket = ioClient(baseUrl, {
    path: env.SOCKET_PATH,
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: false,
  });
  openSockets.push(socket);
  return socket;
}

function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error: Error) => reject(error));
  });
}

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function join(socket: ClientSocket, boardId: string): Promise<unknown> {
  return new Promise((resolve) => socket.emit('board:join', { boardId }, resolve));
}

async function firstColumnId(accessToken: string, boardId: string): Promise<string> {
  const detail = await request(app)
    .get(`/api/boards/${boardId}`)
    .set('Authorization', `Bearer ${accessToken}`);
  return detail.body.board.columns[0]._id as string;
}

describe('Socket.io', () => {
  it('rechaza la conexión sin token', async () => {
    const socket = connectAs('');
    await expect(waitForConnect(socket)).rejects.toBeTruthy();
  });

  it('rechaza la conexión con un token inválido', async () => {
    const socket = connectAs('token-basura');
    await expect(waitForConnect(socket)).rejects.toBeTruthy();
  });

  it('board:join es rechazado para quien no es miembro, sin confirmar si el tablero existe', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const socket = connectAs(outsider.accessToken);
    await waitForConnect(socket);

    const ack = await join(socket, board._id);
    expect(ack).toEqual({ error: 'FORBIDDEN' });
  });

  it('un miembro recibe card:moved cuando otro mueve una tarjeta por REST', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });
    const detail = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const [first, second] = detail.body.board.columns;
    const created = await request(app)
      .post(`/api/columns/${first._id}/cards`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Tarea' });

    const socket = connectAs(owner.accessToken);
    await waitForConnect(socket);
    const joinAck = await join(socket, board._id);
    expect(joinAck).toEqual({ ok: true });

    const eventPromise = waitFor<{ card: { _id: string }; actorId: string }>(socket, 'card:moved');
    await request(app)
      .patch(`/api/cards/${created.body.card._id}/move`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ columnId: second._id });

    const payload = await eventPromise;
    expect(payload.card._id).toBe(created.body.card._id);
    expect(payload.actorId).toBe(owner.userId);
  });

  it('un no-miembro no recibe eventos del tablero', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });

    const outsiderSocket = connectAs(outsider.accessToken);
    await waitForConnect(outsiderSocket);
    // No se une a la room del tablero.

    let received = false;
    outsiderSocket.on('card:created', () => {
      received = true;
    });

    const columnId = await firstColumnId(owner.accessToken, board._id);
    await request(app)
      .post(`/api/columns/${columnId}/cards`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Tarea' });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toBe(false);
  });

  it('un expulsado deja de recibir eventos del tablero', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });

    const invite = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: other.email, role: 'editor' });
    const token = (invite.body.link as string).split('/invite/')[1];
    await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ token });

    const otherSocket = connectAs(other.accessToken);
    await waitForConnect(otherSocket);
    await join(otherSocket, board._id);

    const removedPromise = waitFor(otherSocket, 'member:removed');
    await request(app)
      .delete(`/api/boards/${board._id}/members/${other.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    // Confirma que SÍ le llega el aviso de expulsión antes de salir de la room.
    await removedPromise;

    let receivedAfterKick = false;
    otherSocket.on('card:created', () => {
      receivedAfterKick = true;
    });

    const columnId = await firstColumnId(owner.accessToken, board._id);
    await request(app)
      .post(`/api/columns/${columnId}/cards`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Tarea' });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(receivedAfterKick).toBe(false);
  });

  it('la presencia se actualiza al conectar y desconectar', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });

    const invite = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: other.email, role: 'viewer' });
    const token = (invite.body.link as string).split('/invite/')[1];
    await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ token });

    const ownerSocket = connectAs(owner.accessToken);
    await waitForConnect(ownerSocket);
    await join(ownerSocket, board._id);

    const otherSocket = connectAs(other.accessToken);
    await waitForConnect(otherSocket);

    const presenceAfterJoin = waitFor<{ users: { userId: string }[] }>(ownerSocket, 'presence:update');
    await join(otherSocket, board._id);
    const afterJoin = await presenceAfterJoin;
    expect(afterJoin.users.map((u) => u.userId).sort()).toEqual(
      [owner.userId, other.userId].sort(),
    );

    const presenceAfterLeave = waitFor<{ users: { userId: string }[] }>(ownerSocket, 'presence:update');
    otherSocket.disconnect();
    const afterLeave = await presenceAfterLeave;
    expect(afterLeave.users.map((u) => u.userId)).toEqual([owner.userId]);
  });
});
