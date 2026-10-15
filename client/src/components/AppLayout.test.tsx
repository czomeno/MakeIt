import { describe, it, expect } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { makeBoard } from '../test/fixtures';
import { useViewPreferenceStore } from '../stores/viewPreferenceStore';
import { usePresenceStore } from '../stores/presenceStore';
import { renderWithProviders } from '../test/test-utils';
import { AppLayout } from './AppLayout';
import { useAuthStore } from '../stores/authStore';
import { TEST_USER } from '../test/handlers';

// En jsdom no hay matchMedia: el layout se comporta como en escritorio.
function renderLayout() {
  useAuthStore.setState({ status: 'authenticated', user: TEST_USER, accessToken: 'token' });
  renderWithProviders(<AppLayout />, { route: '/boards' });
  return screen.getByRole('complementary', { name: 'Menú principal' });
}

describe('AppLayout', () => {
  it('la barra lateral empieza plegada y se despliega al pasar el ratón', async () => {
    const sidebar = renderLayout();
    expect(sidebar).toHaveClass('md:w-16');

    fireEvent.mouseEnter(sidebar);
    await waitFor(() => expect(sidebar).toHaveClass('md:w-64'));

    fireEvent.mouseLeave(sidebar);
    await waitFor(() => expect(sidebar).toHaveClass('md:w-16'));
  });

  it('plegada, los botones conservan su nombre accesible', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Mis tableros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo tablero' })).toBeInTheDocument();
  });

  it('el botón de cerrar sesión es rojo', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('bg-red-600');
  });
});

describe('AppLayout: submenú de tableros', () => {
  function mockBoards() {
    server.use(
      http.get('/api/boards', () =>
        HttpResponse.json({
          boards: [
            makeBoard([], { _id: 'b1', title: 'Búsqueda de empleo' }),
            makeBoard([], { _id: 'b2', title: 'Sprint' }),
          ],
        }),
      ),
    );
  }

  it('lista los tableros con enlace directo a cada uno', async () => {
    mockBoards();
    renderLayout();
    const submenu = screen.getByRole('list', { name: 'Mis tableros' });
    expect(await within(submenu).findByRole('link', { name: 'Sprint' })).toHaveAttribute(
      'href',
      '/boards/b2',
    );
    expect(within(submenu).getByRole('link', { name: 'Búsqueda de empleo' })).toBeInTheDocument();
  });

  it('la flecha pliega y despliega la lista y se recuerda', async () => {
    mockBoards();
    const user = userEvent.setup();
    const sidebar = renderLayout();
    fireEvent.mouseEnter(sidebar);
    const toggle = await screen.findByRole('button', { name: 'Ocultar mis tableros' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'));

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Mostrar mis tableros' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(useViewPreferenceStore.getState().isBoardsMenuOpen).toBe(false);
  });

  it('con la barra plegada, el submenú queda oculto e inerte', async () => {
    mockBoards();
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Ocultar mis tableros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveAttribute('inert');
  });
});

describe('AppLayout: personas conectadas', () => {
  it('muestra los avatares en la cabecera', () => {
    renderLayout();
    expect(screen.queryByRole('group', { name: 'Personas conectadas a este tablero' })).toBeNull();

    act(() => {
      usePresenceStore.setState({
        presence: [{ userId: 'u1', name: 'Clara Zamora', initials: 'CZ' }],
      });
    });

    const group = screen.getByRole('group', { name: 'Personas conectadas a este tablero' });
    expect(group).toHaveTextContent('CZ');
    expect(group).toHaveTextContent('Clara Zamora');
    expect(group.closest('header')).not.toBeNull();
  });
});

describe('AppLayout: ajustes', () => {
  it('el interruptor de tema ya no está en la cabecera; Ajustes está en la barra lateral', () => {
    const sidebar = renderLayout();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(within(sidebar).getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});
