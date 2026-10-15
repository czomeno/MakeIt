import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

function linkToken(link: string): string {
  return link.split('/invite/')[1] ?? '';
}

async function inviteAndAccept(
  ownerToken: string,
  boardId: string,
  invitee: { accessToken: string; email: string },
  role: 'admin' | 'editor' | 'viewer',
) {
  const created = await request(app)
    .post(`/api/boards/${boardId}/invitations`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email: invitee.email, role });
  await request(app)
    .post('/api/invitations/accept')
    .set('Authorization', `Bearer ${invitee.accessToken}`)
    .send({ token: linkToken(created.body.link as string) });
}

describe('miembros', () => {
  it('lista los miembros de un tablero con nombre, email y rol', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const response = await request(app)
      .get(`/api/boards/${board._id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.members).toEqual([
      expect.objectContaining({ email: owner.email, role: 'admin' }),
    ]);
  });

  it('un admin cambia el rol de otro miembro', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, editor, 'editor');

    const response = await request(app)
      .patch(`/api/boards/${board._id}/members/${editor.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'viewer' });

    expect(response.status).toBe(200);
    expect(response.body.member.role).toBe('viewer');
  });

  it('no permite degradar al último admin', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const response = await request(app)
      .patch(`/api/boards/${board._id}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'editor' });

    expect(response.status).toBe(409);
  });

  it('permite degradar a un admin si queda otro admin', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, other, 'admin');

    const response = await request(app)
      .patch(`/api/boards/${board._id}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ role: 'editor' });

    expect(response.status).toBe(200);
  });

  it('un admin expulsa a otro miembro', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, editor, 'editor');

    const response = await request(app)
      .delete(`/api/boards/${board._id}/members/${editor.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(204);
    const members = await request(app)
      .get(`/api/boards/${board._id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body.members).toHaveLength(1);
  });

  it('un miembro puede abandonar el tablero por sí mismo', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, editor, 'editor');

    const response = await request(app)
      .delete(`/api/boards/${board._id}/members/${editor.userId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);

    expect(response.status).toBe(204);
  });

  it('un editor no puede expulsar a otro miembro', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const viewer = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, editor, 'editor');
    await inviteAndAccept(owner.accessToken, board._id, viewer, 'viewer');

    const response = await request(app)
      .delete(`/api/boards/${board._id}/members/${viewer.userId}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);

    expect(response.status).toBe(403);
  });

  it('el propietario del tablero no se puede expulsar, ni siquiera siendo otro admin', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, other, 'admin');

    const response = await request(app)
      .delete(`/api/boards/${board._id}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(response.status).toBe(409);
  });

  it('no permite al último admin abandonar el tablero', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, other, 'admin');

    // Degrada al owner (el otro admin lo permite, ya que "other" sigue
    // siendo admin): ahora "other" es el único admin que queda.
    await request(app)
      .patch(`/api/boards/${board._id}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ role: 'editor' });

    const response = await request(app)
      .delete(`/api/boards/${board._id}/members/${other.userId}`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(response.status).toBe(409);
  });

  it('aislamiento: un miembro de otro tablero no puede ver los miembros de este', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const response = await request(app)
      .get(`/api/boards/${board._id}/members`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe('miembros: casos de error', () => {
  it('cambiar el rol o expulsar a quien no es miembro devuelve 404', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const patch = await request(app)
      .patch(`/api/boards/${board._id}/members/${stranger.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'editor' });
    expect(patch.status).toBe(404);

    const remove = await request(app)
      .delete(`/api/boards/${board._id}/members/${stranger.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(remove.status).toBe(404);
  });

  it('rechaza un rol inválido', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, other, 'viewer');

    const response = await request(app)
      .patch(`/api/boards/${board._id}/members/${other.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'superadmin' });
    expect(response.status).toBe(400);
  });

  it('un expulsado pierde el acceso al tablero (404)', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    await inviteAndAccept(owner.accessToken, board._id, other, 'editor');

    await request(app)
      .delete(`/api/boards/${board._id}/members/${other.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .get(`/api/boards/${board._id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(response.status).toBe(404);
  });
});
