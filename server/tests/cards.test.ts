import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Card } from '../src/models/Card.js';
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
  return detail.body.board.columns as Array<{
    _id: string;
    title: string;
    cards: Array<{ _id: string; title: string; position: number }>;
  }>;
}

describe('tarjetas', () => {
  it('crea una tarjeta con campos de candidatura de empleo', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'job-applications' });
    const [first] = await getColumns(accessToken, board._id);

    const response = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Backend en Acme',
        company: 'Acme',
        jobUrl: 'https://acme.example.com/jobs/1',
      });

    expect(response.status).toBe(201);
    expect(response.body.card).toMatchObject({ title: 'Backend en Acme', company: 'Acme' });
  });

  it('edita una tarjeta', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);
    const created = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original' });

    const response = await request(app)
      .patch(`/api/cards/${created.body.card._id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Editada', labels: ['urgente'] });

    expect(response.status).toBe(200);
    expect(response.body.card).toMatchObject({ title: 'Editada', labels: ['urgente'] });
  });

  it('crea una tarjeta con prioridad y sin completar por defecto', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    const response = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Con prioridad', priority: 'high' });

    expect(response.status).toBe(201);
    expect(response.body.card).toMatchObject({ priority: 'high', completed: false });
  });

  it('marca una tarjeta como completada y cambia y quita su prioridad', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);
    const created = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea', priority: 'low' });
    const url = `/api/cards/${created.body.card._id}`;

    const completed = await request(app)
      .patch(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ completed: true, priority: 'medium' });
    expect(completed.status).toBe(200);
    expect(completed.body.card).toMatchObject({ completed: true, priority: 'medium' });

    // Editar otro campo no toca la prioridad.
    const renamed = await request(app)
      .patch(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea renombrada' });
    expect(renamed.body.card.priority).toBe('medium');

    const cleared = await request(app)
      .patch(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ priority: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.card.priority).toBeUndefined();
    expect((await Card.findById(created.body.card._id).lean())?.priority).toBeUndefined();
  });

  it('rechaza una prioridad desconocida', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    const response = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Mala', priority: 'urgentísima' });

    expect(response.status).toBe(400);
  });

  it('mueve una tarjeta dentro de la misma columna y el orden resultante es correcto', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    const titles = ['A', 'B', 'C'];
    for (const title of titles) {
      await request(app)
        .post(`/api/columns/${first!._id}/cards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title });
    }

    const [columnBefore] = await getColumns(accessToken, board._id);
    const [a, b, c] = columnBefore!.cards;

    // Mueve "C" al principio.
    const move = await request(app)
      .patch(`/api/cards/${c!._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: first!._id, nextCardId: a!._id });
    expect(move.status).toBe(200);

    const [columnAfter] = await getColumns(accessToken, board._id);
    expect(columnAfter!.cards.map((card) => card.title)).toEqual(['C', 'A', 'B']);
    void b;
  });

  it('mueve una tarjeta a otra columna del mismo tablero', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso] = await getColumns(accessToken, board._id);
    const created = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea' });

    const move = await request(app)
      .patch(`/api/cards/${created.body.card._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: enCurso!._id });
    expect(move.status).toBe(200);
    expect(move.body.card.column).toBe(enCurso!._id);
  });

  it('sin vecinos indicados, mueve la tarjeta al final de la columna destino', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso] = await getColumns(accessToken, board._id);

    // "En curso" ya tiene una tarjeta antes de mover nada hacia ahí.
    const existing = await request(app)
      .post(`/api/columns/${enCurso!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ya estaba aquí' });

    const moved = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Recién movida' });

    const move = await request(app)
      .patch(`/api/cards/${moved.body.card._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: enCurso!._id });
    expect(move.status).toBe(200);
    // Debe quedar detrás de la que ya estaba, no chocar en la misma posición.
    expect(move.body.card.position).toBeGreaterThan(existing.body.card.position);

    const [, columnEnCurso] = await getColumns(accessToken, board._id);
    expect(columnEnCurso!.cards.map((c) => c.title)).toEqual(['Ya estaba aquí', 'Recién movida']);
  });

  it('rechaza mover una tarjeta a una columna de otro tablero', async () => {
    const { accessToken } = await registerUser(app);
    const boardA = await createBoard(app, accessToken, { template: 'generic' });
    const boardB = await createBoard(app, accessToken, { template: 'generic' });
    const [columnA] = await getColumns(accessToken, boardA._id);
    const [columnB] = await getColumns(accessToken, boardB._id);

    const created = await request(app)
      .post(`/api/columns/${columnA!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea' });

    const move = await request(app)
      .patch(`/api/cards/${created.body.card._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: columnB!._id });

    expect(move.status).toBe(400);
  });

  it('borra una tarjeta', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);
    const created = await request(app)
      .post(`/api/columns/${first!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'A borrar' });

    const del = await request(app)
      .delete(`/api/cards/${created.body.card._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const [column] = await getColumns(accessToken, board._id);
    expect(column!.cards).toHaveLength(0);
  });

  it('rebalancea toda la columna cuando dos vecinas quedan demasiado juntas', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [first] = await getColumns(accessToken, board._id);

    const titles = ['A', 'B', 'C'];
    for (const title of titles) {
      await request(app)
        .post(`/api/columns/${first!._id}/cards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title });
    }

    const [before] = await getColumns(accessToken, board._id);
    const [a, b, c] = before!.cards;

    // Fuerza el hueco entre A y B a un espacio ínfimo, directo en Mongo
    // (la API nunca deja fijar "position" a mano).
    await Card.updateOne({ _id: a!._id }, { position: 1000 });
    await Card.updateOne({ _id: b!._id }, { position: 1000.0000001 });

    // Mover C entre A y B obliga a bisecar ese hueco casi nulo.
    const move = await request(app)
      .patch(`/api/cards/${c!._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: first!._id, prevCardId: a!._id, nextCardId: b!._id });
    expect(move.status).toBe(200);

    const [after] = await getColumns(accessToken, board._id);
    // El orden se mantiene...
    expect(after!.cards.map((card) => card.title)).toEqual(['A', 'C', 'B']);
    // ...y las tres quedan uniformemente espaciadas (renumeradas), no
    // amontonadas en el hueco original.
    const positions = after!.cards.map((card) => card.position);
    expect(positions).toEqual([1000, 2000, 3000]);
  });

  it('rechaza una tarjeta vecina que no está en la columna destino', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso] = await getColumns(accessToken, board._id);
    const inFirst = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'En la primera' });
    const moving = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Movida' });

    for (const neighbour of ['prevCardId', 'nextCardId']) {
      const response = await request(app)
        .patch(`/api/cards/${moving.body.card._id}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ columnId: enCurso!._id, [neighbour]: inFirst.body.card._id });
      expect(response.status).toBe(400);
    }
  });

  it('muchas inserciones seguidas en el mismo hueco mantienen el orden (bisección + rebalanceo)', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [column] = await getColumns(accessToken, board._id);
    const create = async (title: string) =>
      (
        await request(app)
          .post(`/api/columns/${column!._id}/cards`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ title })
      ).body.card._id as string;

    const first = await create('primera');
    const last = await create('última');

    // Cada nueva tarjeta se mete justo detrás de "primera": el hueco se
    // divide a la mitad cada vez hasta forzar al menos un rebalanceo.
    const inserted: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      const id = await create(`t${i}`);
      const response = await request(app)
        .patch(`/api/cards/${id}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ columnId: column!._id, prevCardId: first, nextCardId: inserted.at(-1) ?? last });
      expect(response.status).toBe(200);
      inserted.push(id);
    }

    const [after] = await getColumns(accessToken, board._id);
    const ids = after!.cards.map((card) => card._id);
    expect(ids).toEqual([first, ...[...inserted].reverse(), last]);
    const positions = after!.cards.map((card) => card.position);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
