import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { Board } from '../src/models/Board.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

type Role = 'admin' | 'editor' | 'viewer';

// Tablero con una columna y una tarjeta, un usuario por rol y un ajeno.
async function setupBoard() {
  const owner = await registerUser(app);
  const editor = await registerUser(app);
  const viewer = await registerUser(app);
  const outsider = await registerUser(app);
  const board = await createBoard(app, owner.accessToken, { template: 'generic' });
  await Board.findByIdAndUpdate(board._id, {
    $push: {
      members: {
        $each: [
          { user: editor.userId, role: 'editor' },
          { user: viewer.userId, role: 'viewer' },
        ],
      },
    },
  });
  const detail = await request(app)
    .get(`/api/boards/${board._id}`)
    .set('Authorization', `Bearer ${owner.accessToken}`);
  const columnId = detail.body.board.columns[0]._id as string;
  const otherColumnId = detail.body.board.columns[1]._id as string;
  const card = await request(app)
    .post(`/api/columns/${columnId}/cards`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({ title: 'Tarea' });

  const tokens: Record<Role | 'outsider', string> = {
    admin: owner.accessToken,
    editor: editor.accessToken,
    viewer: viewer.accessToken,
    outsider: outsider.accessToken,
  };
  return {
    tokens,
    boardId: board._id as string,
    columnId,
    otherColumnId,
    cardId: card.body.card._id as string,
    users: { owner, editor, viewer, outsider },
  };
}

type Ctx = Awaited<ReturnType<typeof setupBoard>>;

interface Operation {
  name: string;
  minRole: Role;
  send: (ctx: Ctx, token: string) => request.Test;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Una fila por endpoint protegido por rol. Los resolvers (columna, tarjeta)
// obtienen el tablero a partir del recurso, así que se prueban todos.
const operations: Operation[] = [
  {
    name: 'GET tablero',
    minRole: 'viewer',
    send: (c, t) => request(app).get(`/api/boards/${c.boardId}`).set(auth(t)),
  },
  {
    name: 'GET actividad del tablero',
    minRole: 'viewer',
    send: (c, t) => request(app).get(`/api/boards/${c.boardId}/activity`).set(auth(t)),
  },
  {
    name: 'GET actividad de tarjeta',
    minRole: 'viewer',
    send: (c, t) => request(app).get(`/api/cards/${c.cardId}/activity`).set(auth(t)),
  },
  {
    name: 'GET miembros',
    minRole: 'viewer',
    send: (c, t) => request(app).get(`/api/boards/${c.boardId}/members`).set(auth(t)),
  },
  {
    name: 'POST columna',
    minRole: 'editor',
    send: (c, t) =>
      request(app).post(`/api/boards/${c.boardId}/columns`).set(auth(t)).send({ title: 'Nueva' }),
  },
  {
    name: 'PATCH columna',
    minRole: 'editor',
    send: (c, t) =>
      request(app).patch(`/api/columns/${c.columnId}`).set(auth(t)).send({ title: 'Renombrada' }),
  },
  {
    name: 'PATCH mover columna',
    minRole: 'editor',
    send: (c, t) =>
      request(app)
        .patch(`/api/columns/${c.columnId}/move`)
        .set(auth(t))
        .send({ prevColumnId: c.otherColumnId }),
  },
  {
    name: 'POST tarjeta',
    minRole: 'editor',
    send: (c, t) =>
      request(app).post(`/api/columns/${c.columnId}/cards`).set(auth(t)).send({ title: 'Otra' }),
  },
  {
    name: 'PATCH tarjeta',
    minRole: 'editor',
    send: (c, t) =>
      request(app).patch(`/api/cards/${c.cardId}`).set(auth(t)).send({ title: 'Editada' }),
  },
  {
    name: 'PATCH mover tarjeta',
    minRole: 'editor',
    send: (c, t) =>
      request(app).patch(`/api/cards/${c.cardId}/move`).set(auth(t)).send({ columnId: c.columnId }),
  },
  {
    name: 'PATCH tablero',
    minRole: 'admin',
    send: (c, t) =>
      request(app).patch(`/api/boards/${c.boardId}`).set(auth(t)).send({ title: 'Otro título' }),
  },
  {
    name: 'POST invitación',
    minRole: 'admin',
    send: (c, t) =>
      request(app)
        .post(`/api/boards/${c.boardId}/invitations`)
        .set(auth(t))
        .send({ email: 'nueva@example.com', role: 'viewer' }),
  },
  {
    name: 'GET invitaciones',
    minRole: 'admin',
    send: (c, t) => request(app).get(`/api/boards/${c.boardId}/invitations`).set(auth(t)),
  },
  {
    name: 'PATCH rol de miembro',
    minRole: 'admin',
    send: (c, t) =>
      request(app)
        .patch(`/api/boards/${c.boardId}/members/${c.users.viewer.userId}`)
        .set(auth(t))
        .send({ role: 'editor' }),
  },
];

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };
const ROLES: Role[] = ['viewer', 'editor', 'admin'];

describe('matriz de autorización por rol', () => {
  describe.each(operations)('$name (mínimo: $minRole)', (operation) => {
    it('un no-miembro recibe 404, sin revelar que el tablero existe', async () => {
      const ctx = await setupBoard();
      const response = await operation.send(ctx, ctx.tokens.outsider);
      expect(response.status).toBe(404);
    });

    it('sin token recibe 401', async () => {
      const ctx = await setupBoard();
      const response = await operation.send(ctx, '');
      expect(response.status).toBe(401);
    });

    it.each(ROLES)('rol %s: permitido solo si alcanza el mínimo', async (role) => {
      const ctx = await setupBoard();
      const response = await operation.send(ctx, ctx.tokens[role]);
      if (RANK[role] >= RANK[operation.minRole]) {
        expect(response.status).toBeLessThan(300);
      } else {
        expect(response.status).toBe(403);
      }
    });
  });

  it('DELETE tarjeta y columna: el viewer recibe 403 y el editor puede', async () => {
    const ctx = await setupBoard();
    const asViewerCard = await request(app)
      .delete(`/api/cards/${ctx.cardId}`)
      .set(auth(ctx.tokens.viewer));
    expect(asViewerCard.status).toBe(403);
    const asViewerColumn = await request(app)
      .delete(`/api/columns/${ctx.columnId}`)
      .set(auth(ctx.tokens.viewer));
    expect(asViewerColumn.status).toBe(403);

    const asEditorCard = await request(app)
      .delete(`/api/cards/${ctx.cardId}`)
      .set(auth(ctx.tokens.editor));
    expect(asEditorCard.status).toBe(204);
    const asEditorColumn = await request(app)
      .delete(`/api/columns/${ctx.columnId}`)
      .set(auth(ctx.tokens.editor));
    expect(asEditorColumn.status).toBe(204);
  });

  it('DELETE tablero: solo admin', async () => {
    const ctx = await setupBoard();
    const asEditor = await request(app)
      .delete(`/api/boards/${ctx.boardId}`)
      .set(auth(ctx.tokens.editor));
    expect(asEditor.status).toBe(403);
    const asAdmin = await request(app)
      .delete(`/api/boards/${ctx.boardId}`)
      .set(auth(ctx.tokens.admin));
    expect(asAdmin.status).toBe(204);
  });
});

describe('recursos inexistentes e ids inválidos', () => {
  it.each([
    ['tablero', (id: string) => `/api/boards/${id}`],
    ['actividad de tarjeta', (id: string) => `/api/cards/${id}/activity`],
  ])('GET %s con un id que no existe: 404', async (_label, path) => {
    const { accessToken } = await registerUser(app);
    const response = await request(app)
      .get(path(new Types.ObjectId().toString()))
      .set(auth(accessToken));
    expect(response.status).toBe(404);
  });

  it('PATCH de columna y tarjeta inexistentes: 404', async () => {
    const { accessToken } = await registerUser(app);
    const missing = new Types.ObjectId().toString();
    const column = await request(app)
      .patch(`/api/columns/${missing}`)
      .set(auth(accessToken))
      .send({ title: 'x' });
    expect(column.status).toBe(404);
    const card = await request(app)
      .patch(`/api/cards/${missing}`)
      .set(auth(accessToken))
      .send({ title: 'x' });
    expect(card.status).toBe(404);
  });

  it('un id con formato inválido devuelve 400 de validación', async () => {
    const { accessToken } = await registerUser(app);
    const response = await request(app).get('/api/boards/no-es-un-id').set(auth(accessToken));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('asignados de tarjeta', () => {
  it('acepta asignar a un miembro del tablero', async () => {
    const ctx = await setupBoard();
    const response = await request(app)
      .patch(`/api/cards/${ctx.cardId}`)
      .set(auth(ctx.tokens.admin))
      .send({ assignees: [ctx.users.editor.userId] });
    expect(response.status).toBe(200);
    expect(response.body.card.assignees).toEqual([ctx.users.editor.userId]);
  });

  it('rechaza asignar a alguien que no es miembro, al crear y al editar', async () => {
    const ctx = await setupBoard();
    const onUpdate = await request(app)
      .patch(`/api/cards/${ctx.cardId}`)
      .set(auth(ctx.tokens.admin))
      .send({ assignees: [ctx.users.outsider.userId] });
    expect(onUpdate.status).toBe(400);
    expect(onUpdate.body.error.details).toEqual({ unknown: [ctx.users.outsider.userId] });

    const onCreate = await request(app)
      .post(`/api/columns/${ctx.columnId}/cards`)
      .set(auth(ctx.tokens.admin))
      .send({ title: 'Nueva', assignees: [ctx.users.outsider.userId] });
    expect(onCreate.status).toBe(400);
  });
});
