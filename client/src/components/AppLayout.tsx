import { NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import * as authApi from '../api/auth';
import { toastError } from '../stores/toastStore';
import { ThemeToggle } from './ThemeToggle';
import { CreateBoardModal } from '../features/boards/CreateBoardModal';

function LayoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="2.5" y="3" width="15" height="3" rx="1" fill="currentColor" />
      <rect x="2.5" y="8.5" width="15" height="3" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="2.5" y="14" width="15" height="3" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const isCreateBoardOpen = useUiStore((state) => state.isCreateBoardOpen);
  const openCreateBoard = useUiStore((state) => state.openCreateBoard);
  const closeCreateBoard = useUiStore((state) => state.closeCreateBoard);
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onError: () => {
      toastError(
        'No se pudo avisar al servidor del cierre de sesión, pero tu sesión local se cerró.',
      );
    },
    onSettled: () => {
      // Limpia siempre, incluso si la petición de logout falló: la sesión
      // local ya se cerró en authApi.logout() y no debe quedar cache servida.
      queryClient.clear();
    },
  });

  return (
    // Por debajo de md (768 px) la barra lateral pasa a ser una barra superior
    // compacta con los mismos elementos; en escritorio no cambia nada.
    <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
      <aside className="flex shrink-0 flex-wrap items-center gap-x-1 border-b border-sidebar-border bg-sidebar-bg pb-2 text-sidebar-text md:w-64 md:flex-col md:flex-nowrap md:items-stretch md:gap-0 md:border-r md:border-b-0 md:pb-0">
        <div className="flex items-center gap-2 px-4 py-3 md:px-5 md:py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            M
          </span>
          <span className="text-lg font-semibold">MakeIt</span>
        </div>

        <nav className="px-1 md:flex-1 md:px-3">
          <NavLink
            to="/boards"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-surface text-sidebar-text'
                  : 'text-sidebar-text-muted hover:bg-sidebar-surface hover:text-sidebar-text'
              }`
            }
          >
            <LayoutIcon />
            Mis tableros
          </NavLink>
        </nav>

        <div className="px-1 md:border-t md:border-sidebar-border md:px-3 md:py-3">
          <button
            type="button"
            onClick={openCreateBoard}
            className="flex items-center md:w-full justify-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-surface px-3 py-2 text-sm font-medium text-sidebar-text transition-colors hover:border-accent"
          >
            <span aria-hidden="true">+</span>
            Nuevo tablero
          </button>
        </div>

        <div className="px-3 md:border-t md:border-sidebar-border md:px-4 md:py-4">
          {user && (
            <div className="hidden md:block">
              <p className="truncate text-sm font-medium text-sidebar-text">{user.name}</p>
              <p className="truncate text-xs text-sidebar-text-muted">{user.email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-xs md:mt-2 text-sidebar-text-muted underline-offset-2 hover:text-sidebar-text hover:underline disabled:opacity-50"
          >
            {logoutMutation.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-surface px-4 py-3 md:px-6">
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>

      <CreateBoardModal isOpen={isCreateBoardOpen} onClose={closeCreateBoard} />
    </div>
  );
}
