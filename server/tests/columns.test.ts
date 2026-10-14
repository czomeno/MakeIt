import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Column } from '../src/models/Column.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

async function getColumns(accessToken: string, boardId: string) {
  const detail = await request(app)
    .get(`/api/boards/${boardId}`)
    .set('Authorization', `Bearer ${accessToken}`);
  return detail.body.board.columns as Array<{ _id: string; title: string; position: number }>;
}

describe('columnas', () => {
  it('crea una columna al final del tablero', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });

    const response = await request(app)
      .post(`/api/boards/${board._id}/columns`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Backlog' });
    expect(response.status).toBe(201);

    const columns = await getColumns(accessToken, board._id);
    expect(columns.at(-1)?.title).toBe('Backlog');
  });

  it('edita el título de una columna', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    const response = await request(app)
      .patch(`/api/columns/${first!._id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renombrada' });

    expect(response.status).toBe(200);
    expect(response.body.column.title).toBe('Renombrada');
  });

  it('mueve una columna entre dos vecinas y el orden resultante es correcto', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso, hecho] = await getColumns(accessToken, board._id);

    // Mueve "Hecho" entre "Por hacer" y "En curso".
    const move = await request(app)
      .patch(`/api/columns/${hecho!._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ prevColumnId: porHacer!._id, nextColumnId: enCurso!._id });
    expect(move.status).toBe(200);

    const columns = await getColumns(accessToken, board._id);
    expect(columns.map((c) => c.title)).toEqual(['Por hacer', 'Hecho', 'En curso']);
  });

  it('borra una columna y sus tarjetas en cascada', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarjeta' });

    const del = await request(app)
      .delete(`/api/columns/${first!._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const columns = await getColumns(accessToken, board._id);
    expect(columns.find((c) => c._id === first!._id)).toBeUndefined();
  });

  it('rechaza mover una columna usando una vecina de otro tablero', async () => {
    const { accessToken } = await registerUser(app);
    const boardA = await createBoard(app, accessToken, { template: 'generic' });
    const boardB = await createBoard(app, accessToken, { template: 'generic' });
    const [columnA] = await getColumns(accessToken, boardA._id);
    const [columnB] = await getColumns(accessToken, boardB._id);

    const move = await request(app)
      .patch(`/api/columns/${columnA!._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ prevColumnId: columnB!._id });

    expect(move.status).toBe(400);
  });

  it('rebalancea todas las columnas cuando dos vecinas quedan demasiado juntas', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso, hecho] = await getColumns(accessToken, board._id);

    // Fuerza el hueco entre "Por hacer" y "En curso" a un espacio ínfimo,
    // directo en Mongo (la API nunca deja fijar "position" a mano).
    await Column.updateOne({ _id: porHacer!._id }, { position: 1000 });
    await Column.updateOne({ _id: enCurso!._id }, { position: 1000.0000001 });

    // Mover "Hecho" entre ambas obliga a bisecar ese hueco casi nulo.
    const move = await request(app)
      .patch(`/api/columns/${hecho!._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ prevColumnId: porHacer!._id, nextColumnId: enCurso!._id });
    expect(move.status).toBe(200);

    const columns = await getColumns(accessToken, board._id);
    expect(columns.map((c) => c.title)).toEqual(['Por hacer', 'Hecho', 'En curso']);
    expect(columns.map((c) => c.position)).toEqual([1000, 2000, 3000]);
  });

  it('un no-miembro recibe 404 al intentar crear una columna', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const response = await request(app)
      .post(`/api/boards/${board._id}/columns`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ title: 'Intrusa' });

    expect(response.status).toBe(404);
  });
});
