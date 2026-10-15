import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Invitation } from '../src/models/Invitation.js';
import { Board } from '../src/models/Board.js';
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
    expect(response.body.invitation).toMatchObject({
      email: 'invitado@example.com',
      status: 'pending',
    });
    expect(response.body.link).toContain('/invite/');

    const stored = await Invitation.findById(response.body.invitation.id);
    expect(stored?.tokenHash).toBeTruthy();
    expect(response.body.link).not.toContain(stored?.tokenHash);
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

describe('invitaciones: casos de error', () => {
  async function invite(ownerToken: string, boardId: string, email: string) {
    const created = await request(app)
      .post(`/api/boards/${boardId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email, role: 'editor' });
    return {
      id: created.body.invitation.id as string,
      token: linkToken(created.body.link as string),
    };
  }

  it('un token desconocido devuelve 404', async () => {
    const invitee = await registerUser(app);
    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: 'f'.repeat(64) });
    expect(response.status).toBe(404);
  });

  it('aceptar exige estar autenticado', async () => {
    const response = await request(app)
      .post('/api/invitations/accept')
      .send({ token: 'f'.repeat(64) });
    expect(response.status).toBe(401);
  });

  it('revocar dos veces la misma invitación devuelve 404 la segunda', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    const { id } = await invite(owner.accessToken, board._id, 'x@example.com');

    const first = await request(app)
      .delete(`/api/invitations/${id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(first.status).toBe(204);
    const second = await request(app)
      .delete(`/api/invitations/${id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(second.status).toBe(404);
  });

  it('si el tablero se borró, aceptar devuelve 404', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    const { token } = await invite(owner.accessToken, board._id, invitee.email);
    await Board.deleteOne({ _id: board._id });

    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token });
    expect(response.status).toBe(404);
  });

  it('el email de la invitación no distingue mayúsculas', async () => {
    const owner = await registerUser(app);
    const board = await createBoard(app, owner.accessToken);
    const invitee = await registerUser(app, { email: `mixta-${Date.now()}@example.com` });
    const { token } = await invite(owner.accessToken, board._id, invitee.email.toUpperCase());

    const response = await request(app)
      .post('/api/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token });
    expect(response.status).toBe(200);
  });
});
