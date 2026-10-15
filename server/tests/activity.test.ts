import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Activity } from '../src/models/Activity.js';
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
    cards: Array<{ _id: string; title: string }>;
  }>;
}

describe('actividad', () => {
  it('registra la creación, edición, movimiento y borrado de una tarjeta', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso] = await getColumns(accessToken, board._id);

    const created = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea' });
    const cardId = created.body.card._id as string;

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Detalle' });

    await request(app)
      .patch(`/api/cards/${cardId}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: enCurso!._id });

    await request(app).delete(`/api/cards/${cardId}`).set('Authorization', `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const types = response.body.items.map((item: { type: string }) => item.type);
    // Más recientes primero.
    expect(types).toEqual(['card.deleted', 'card.moved', 'card.updated', 'card.created']);
    expect(response.body.items[0].data).toMatchObject({ cardTitle: 'Tarea' });
    expect(response.body.items[1].data).toMatchObject({
      cardTitle: 'Tarea',
      fromColumnTitle: porHacer!.title,
      toColumnTitle: enCurso!.title,
    });
  });

  it('registra la creación y el borrado de columnas', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });

    const column = await request(app)
      .post(`/api/boards/${board._id}/columns`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Revisión' });

    await request(app)
      .delete(`/api/columns/${column.body.column._id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .set('Authorization', `Bearer ${accessToken}`);

    const types = response.body.items.map((item: { type: string }) => item.type);
    expect(types).toContain('column.created');
    expect(types).toContain('column.deleted');
  });

  it('agrupa ediciones seguidas de la misma tarjeta por el mismo autor', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer] = await getColumns(accessToken, board._id);

    const created = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea' });
    const cardId = created.body.card._id as string;

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Primer cambio' });
    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Segundo cambio' });

    const count = await Activity.countDocuments({ card: cardId, type: 'card.updated' });
    expect(count).toBe(1);

    const response = await request(app)
      .get(`/api/cards/${cardId}/activity`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.body.items).toHaveLength(2); // created + el updated fusionado
  });

  it('no agrupa una edición si entre medias hubo un movimiento', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer, enCurso] = await getColumns(accessToken, board._id);

    const created = await request(app)
      .post(`/api/columns/${porHacer!._id}/cards`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Tarea' });
    const cardId = created.body.card._id as string;

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Primer cambio' });
    await request(app)
      .patch(`/api/cards/${cardId}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ columnId: enCurso!._id });
    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Segundo cambio' });

    const count = await Activity.countDocuments({ card: cardId, type: 'card.updated' });
    expect(count).toBe(2);
  });

  it('pagina por cursor, de más reciente a más antigua', async () => {
    const { accessToken } = await registerUser(app);
    const board = await createBoard(app, accessToken, { template: 'generic' });
    const [porHacer] = await getColumns(accessToken, board._id);

    for (const title of ['A', 'B', 'C']) {
      await request(app)
        .post(`/api/columns/${porHacer!._id}/cards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title });
    }

    const firstPage = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).not.toBeNull();
    expect(
      firstPage.body.items.map((i: { data: { cardTitle: string } }) => i.data.cardTitle),
    ).toEqual(['C', 'B']);

    const secondPage = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .query({ limit: 2, cursor: firstPage.body.nextCursor })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();
    expect(secondPage.body.items[0].data.cardTitle).toBe('A');
  });

  it('registra member.joined, member.role_changed, member.left y member.removed', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const viewer = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });

    async function invite(email: string, role: 'admin' | 'editor' | 'viewer') {
      const created = await request(app)
        .post(`/api/boards/${board._id}/invitations`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email, role });
      return (created.body.link as string).split('/invite/')[1]!;
    }

    await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ token: await invite(editor.email, 'editor') });
    await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ token: await invite(viewer.email, 'viewer') });

    await request(app)
      .patch(`/api/boards/${board._id}/members/${editor.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'viewer' });

    // editor (ahora viewer) abandona por sí mismo; el owner expulsa a viewer.
    await request(app)
      .delete(`/api/boards/${board._id}/members/${editor.userId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    await request(app)
      .delete(`/api/boards/${board._id}/members/${viewer.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const types = response.body.items.map((item: { type: string }) => item.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'member.joined',
        'member.role_changed',
        'member.left',
        'member.removed',
      ]),
    );
  });

  it('un no-miembro recibe 404 al pedir la actividad de un tablero', async () => {
    const owner = await registerUser(app);
    const intruder = await registerUser(app);
    const board = await createBoard(app, owner.accessToken, { template: 'generic' });

    const response = await request(app)
      .get(`/api/boards/${board._id}/activity`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);
    expect(response.status).toBe(404);
  });
});
