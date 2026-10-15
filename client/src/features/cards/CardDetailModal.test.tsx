import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { Toaster } from '../../components/Toaster';
import { CardDetailModal } from './CardDetailModal';
import type { Card, Member } from '../../types/api';

const CARD: Card = {
  _id: 'card-1',
  board: 'board-1',
  column: 'col-1',
  title: 'Preparar entrevista',
  description: 'Repasar el temario',
  position: 1000,
  labels: ['urgente'],
  assignees: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const MEMBERS: Member[] = [
  { userId: 'user-1', role: 'admin', name: 'Ada Lovelace', email: 'ada@example.com' },
  { userId: 'user-2', role: 'editor', name: 'Grace Hopper', email: 'grace@example.com' },
];

function renderModal(
  props: Partial<React.ComponentProps<typeof CardDetailModal>> = {},
  members: Member[] = MEMBERS,
) {
  server.use(http.get('/api/boards/:boardId/members', () => HttpResponse.json({ members })));
  const onClose = vi.fn();
  const view = renderWithProviders(
    <>
      <CardDetailModal
        boardId="board-1"
        template="generic"
        card={CARD}
        canEdit
        isOpen
        onClose={onClose}
        {...props}
      />
      <Toaster />
    </>,
  );
  return { ...view, onClose };
}

function capturePatch() {
  const bodies: unknown[] = [];
  server.use(
    http.patch('/api/cards/:id', async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return HttpResponse.json({ card: { ...CARD, ...(body as object) } });
    }),
  );
  return bodies;
}

describe('CardDetailModal', () => {
  it('muestra los datos de la tarjeta en un diálogo accesible', async () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Detalle de la tarjeta' });
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Preparar entrevista');
    expect(within(dialog).getByLabelText('Descripción')).toHaveValue('Repasar el temario');
    expect(within(dialog).getByLabelText('Etiquetas')).toHaveValue('urgente');
    expect(await within(dialog).findByRole('checkbox', { name: 'Grace Hopper' })).not.toBeChecked();
  });

  it('"Guardar cambios" está deshabilitado hasta que hay cambios', async () => {
    const user = userEvent.setup();
    renderModal();
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Título'), ' ya');
    expect(save).toBeEnabled();
  });

  it('guarda título, etiquetas y asignados normalizados', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderModal();

    const title = screen.getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Entrevista técnica');
    const labels = screen.getByLabelText('Etiquetas');
    await user.clear(labels);
    await user.type(labels, ' urgente, , remoto ');
    await user.click(await screen.findByRole('checkbox', { name: 'Grace Hopper' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Tarjeta actualizada.')).toBeInTheDocument();
    expect(bodies).toEqual([
      expect.objectContaining({
        title: 'Entrevista técnica',
        labels: ['urgente', 'remoto'],
        assignees: ['user-2'],
      }),
    ]);
  });

  it('con un único miembro (el caso de un tablero personal) también se puede guardar', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderModal({}, [MEMBERS[0]!]);

    await user.click(await screen.findByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.type(screen.getByLabelText('Título'), '!');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Tarjeta actualizada.')).toBeInTheDocument();
    expect(bodies).toEqual([expect.objectContaining({ assignees: ['user-1'] })]);
  });

  it('valida el título obligatorio sin llamar a la API', async () => {
    const bodies = capturePatch();
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText('Título'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('muestra el error del servidor si falla al guardar', async () => {
    server.use(
      http.patch('/api/cards/:id', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'No tienes permisos suficientes' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Título'), '!');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('No tienes permisos suficientes')).toBeInTheDocument();
  });

  it('un lector ve los campos deshabilitados y no tiene acciones de edición', () => {
    renderModal({ canEdit: false });
    expect(screen.getByLabelText('Título')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar tarjeta' })).not.toBeInTheDocument();
  });

  it('en la plantilla de candidaturas muestra empresa y valida la URL de la oferta', async () => {
    const user = userEvent.setup();
    renderModal({ template: 'job-applications' });

    expect(screen.getByLabelText('Empresa')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Enlace de la oferta'), 'no-es-una-url');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('URL inválida')).toBeInTheDocument();
  });

  it('borra la tarjeta tras confirmar y cierra el modal', async () => {
    let deleted = false;
    server.use(
      http.delete('/api/cards/:id', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Borrar tarjeta' }));
    const confirm = await screen.findByRole('dialog', { name: 'Borrar tarjeta' });
    await user.click(within(confirm).getByRole('button', { name: 'Borrar tarjeta' }));

    expect(await screen.findByText('Tarjeta borrada.')).toBeInTheDocument();
    expect(deleted).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape en la confirmación de borrado cierra solo la confirmación', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Borrar tarjeta' }));
    expect(await screen.findByRole('dialog', { name: 'Borrar tarjeta' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Borrar tarjeta' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('avisa si la tarjeta cambia en remoto mientras hay cambios sin guardar', async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal();
    await user.type(screen.getByLabelText('Título'), ' (borrador)');

    rerender(
      <CardDetailModal
        boardId="board-1"
        template="generic"
        card={{ ...CARD, title: 'Cambiado por otra persona' }}
        canEdit
        isOpen
        onClose={() => {}}
      />,
    );

    expect(
      await screen.findByText('Esta tarjeta ha cambiado mientras la editabas.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('Preparar entrevista (borrador)');

    await user.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(screen.getByLabelText('Título')).toHaveValue('Cambiado por otra persona');
  });

  it('muestra el estado vacío y de error de la actividad', async () => {
    renderModal();
    expect(await screen.findByText('Sin actividad todavía.')).toBeInTheDocument();
  });

  it('muestra un error si la actividad no se puede cargar', async () => {
    server.use(
      http.get('/api/cards/:cardId/activity', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 }),
      ),
    );
    renderModal();
    expect(await screen.findByText('No se pudo cargar la actividad.')).toBeInTheDocument();
  });
});
