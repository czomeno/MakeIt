import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Board } from '../src/models/Board.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('POST /api/boards', () => {
  it('crea al creador como admin y siembra las columnas del template "generic"', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });

    expect(board.members).toEqual([expect.objectContaining({ role: 'admin' })]);

    const detail = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(detail.body.board.columns.map((c: { title: string }) => c.title)).toEqual([
      'Por hacer',
      'En curso',
      'Hecho',
    ]);
  });

  it('siembra las columnas del template "job-applications"', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'job-applications' });

    const detail = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(detail.body.board.columns.map((c: { title: string }) => c.title)).toEqual([
      'Por aplicar',
      'Enviada',
      'Entrevista',
      'Prueba técnica',
      'Oferta',
      'Rechazada',
    ]);
  });

  it('rechaza un template inválido', async () => {
    const { accessToken } = await registerUser(app);
    const response = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'x', template: 'no-existe' });
    expect(response.status).toBe(400);
  });
});

describe('aislamiento entre usuarios', () => {
  it('el usuario B no ve el tablero del usuario A en su listado', async () => {
    const userA = await registerUser(app);
    const userB = await registerUser(app);
    await createBoard(app, userA.accessToken, { title: 'Tablero de A' });

    const list = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(list.body.boards).toHaveLength(0);
  });

  it('el usuario B recibe 404 (no 403) al intentar ver el tablero de A', async () => {
    const userA = await registerUser(app);
    const userB = await registerUser(app);
    const board = await createBoard(app, userA.accessToken);

    const response = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(response.status).toBe(404);
  });

  it('el usuario B no puede editar ni borrar el tablero de A', async () => {
    const userA = await registerUser(app);
    const userB = await registerUser(app);
    const board = await createBoard(app, userA.accessToken);

    const patch = await request(app)
      .patch(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ title: 'hackeado' });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(del.status).toBe(404);
  });
});

describe('permisos por rol', () => {
  async function addMember(boardId: string, userId: string, role: 'editor' | 'viewer') {
    await Board.findByIdAndUpdate(boardId, { $push: { members: { user: userId, role } } });
  }

  it('viewer puede ver pero no editar ni crear columnas', async () => {
    const owner = await registerUser(app);
    const viewer = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await addMember(board._id, viewer.userId, 'viewer');

    const get = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(get.status).toBe(200);

    const patch = await request(app)
      .patch(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'nuevo título' });
    expect(patch.status).toBe(403);

    const createColumn = await request(app)
      .post(`/api/boards/${board._id}/columns`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Columna viewer' });
    expect(createColumn.status).toBe(403);
  });

  it('editor puede crear columnas pero no borrar el tablero', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await addMember(board._id, editor.userId, 'editor');

    const createColumn = await request(app)
      .post(`/api/boards/${board._id}/columns`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ title: 'Columna editor' });
    expect(createColumn.status).toBe(201);

    const del = await request(app)
      .delete(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(del.status).toBe(403);
  });
});

describe('DELETE /api/boards/:id', () => {
  it('borra el tablero y sus columnas/tarjetas en cascada', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const detail = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    const columnId = detail.body.board.columns[0]._id as string;

    await request(app)
      .post(`/api/columns/${columnId}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarjeta a borrar en cascada' });

    const del = await request(app)
      .delete(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const getAfter = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getAfter.status).toBe(404);
  });
});
