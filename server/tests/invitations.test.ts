import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Invitation } from '../src/models/Invitation.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser, createBoard } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

function linkToken(link: string): string {
  return link.split('/invite/')[1] ?? '';
}

describe('invitaciones', () => {
  it('un admin crea una invitación y devuelve el enlace con el token en claro', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const response = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'invitado@example.com', role: 'editor' });

    expect(response.status).toBe(201);
    expect(response.body.invitation).toMatchObject({ email: 'invitado@example.com', status: 'pending' });
    expect(response.body.link).toContain('/invite/');

    const stored = await Invitation.findById(response.body.invitation.id);
    expect(stored?.tokenHash).toBeTruthy();
    expect(response.body.link).not.toContain(stored?.tokenHash);
  });

  it('un editor no puede crear invitaciones', async () => {
    const owner = await registerUser(app);
    const editor = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: editor.email, role: 'editor' })
      .then((res) =>
        request(app)
          .post('/api/invitations/accept')
          .set('Authorization', `Bearer ${editor.accessToken}`)
          .send({ token: linkToken(res.body.link as string) }),
      );

    const response = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ email: 'otro@example.com', role: 'viewer' });

    expect(response.status).toBe(403);
  });

  it('rechaza una segunda invitación pendiente para el mismo email en el mismo tablero', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'invitado@example.com', role: 'editor' });

    const response = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'invitado@example.com', role: 'viewer' });

    expect(response.status).toBe(409);
  });

  it('acepta una invitación válida y añade al usuario como miembro', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'editor' });

    const accept = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: linkToken(created.body.link as string) });

    expect(accept.status).toBe(200);
    expect(accept.body.boardId).toBe(board._id);

    const members = await request(app)
      .get(`/api/boards/${board._id}/members`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(members.body.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: invitee.email, role: 'editor' })]),
    );
  });

  it('aceptar dos veces es idempotente (no duplica el miembro)', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'editor' });
    const token = linkToken(created.body.link as string);

    await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token });
    const second = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token });

    expect(second.status).toBe(200);
    const members = await request(app)
      .get(`/api/boards/${board._id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body.members).toHaveLength(2); // owner + invitado, sin duplicar
  });

  it('rechaza aceptar con el email de otra cuenta', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const outsider = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'editor' });

    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ token: linkToken(created.body.link as string) });

    expect(response.status).toBe(403);
  });

  it('rechaza una invitación caducada', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'editor' });

    await Invitation.updateOne(
      { _id: created.body.invitation.id },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: linkToken(created.body.link as string) });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/caduc/i);
  });

  it('rechaza una invitación revocada', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'editor' });

    await request(app)
      .delete(`/api/invitations/${created.body.invitation.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: linkToken(created.body.link as string) });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/revocad/i);
  });

  it('lista solo las invitaciones pendientes', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'a@example.com', role: 'viewer' });
    await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'b@example.com', role: 'viewer' });
    await request(app)
      .delete(`/api/invitations/${created.body.invitation.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .get(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.body.invitations).toHaveLength(1);
    expect(response.body.invitations[0].email).toBe('b@example.com');
  });

  it('aislamiento: un admin de otro tablero no puede revocar invitaciones ajenas', async () => {
    const owner = await registerUser(app);
    const otherAdmin = await registerUser(app);
    await createBoard(app, otherAdmin.accessToken);
    const board = await createBoard(app, owner.accessToken);

    const created = await request(app)
      .post(`/api/boards/${board._id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'x@example.com', role: 'viewer' });

    const response = await request(app)
      .delete(`/api/invitations/${created.body.invitation.id}`)
      .set('Authorization', `Bearer ${otherAdmin.accessToken}`);

    expect(response.status).toBe(404);
  });
});
