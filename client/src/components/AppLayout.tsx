import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import * as authApi from '../api/auth';
import { toastError } from '../stores/toastStore';
import { useMediaQuery } from '../lib/useMediaQuery';
import { SidebarBoards } from './SidebarBoards';
import { PresenceAvatars } from './PresenceAvatars';
import { CreateBoardModal } from '../features/boards/CreateBoardModal';
import { Logo } from './Logo';

// Retardos de la barra lateral de escritorio: abrir con un pequeño margen
// evita que se despliegue al cruzarla con el ratón de camino a otro sitio.
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

function LayoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="2.5" y="3" width="15" height="3" rx="1" fill="currentColor" />
      <rect x="2.5" y="8.5" width="15" height="3" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="2.5" y="14" width="15" height="3" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8M12.5 13.5 16 10l-3.5-3.5M16 10H8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M3.5 6h6M13.5 6h3M3.5 14h3M10.5 14h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="11.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="14" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Texto de un elemento de la barra: con la barra plegada se desvanece (sigue en
// el DOM, así que el botón conserva su nombre accesible).
function Label({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <span
      className={`truncate whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </span>
  );
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const isCreateBoardOpen = useUiStore((state) => state.isCreateBoardOpen);
  const openCreateBoard = useUiStore((state) => state.openCreateBoard);
  const closeCreateBoard = useUiStore((state) => state.closeCreateBoard);
  const queryClient = useQueryClient();
  const location = useLocation();

  // Escritorio (≥ 768 px): barra de iconos que se despliega al pasar el ratón.
  // Móvil: menú lateral que se abre con el botón de la cabecera.
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const isExpanded = isDesktop ? isHoverOpen : isMobileOpen;
  const isInBoard = location.pathname.startsWith('/boards/');

  function scheduleHover(open: boolean) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(
      () => setIsHoverOpen(open),
      open ? OPEN_DELAY_MS : CLOSE_DELAY_MS,
    );
  }

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  // Al navegar o cambiar a escritorio, el menú móvil se cierra.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname, isDesktop]);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }
    firstLinkRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen]);

  // Con teclado (Tab) la barra también se despliega; con un foco que no es de
  // teclado (p. ej. al volver de un modal abierto con el ratón) no.
  function handleFocus(event: FocusEvent<HTMLElement>) {
    if (!isDesktop) {
      return;
    }
    let isKeyboardFocus = true;
    try {
      isKeyboardFocus = event.target.matches(':focus-visible');
    } catch {
      // Navegadores sin :focus-visible.
    }
    if (isKeyboardFocus) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setIsHoverOpen(true);
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (isDesktop && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      scheduleHover(false);
    }
  }

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

  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Fondo oscuro del menú móvil */}
      <div
        aria-hidden="true"
        onClick={() => setIsMobileOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none md:hidden ${
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="app-sidebar"
        aria-label="Menú principal"
        inert={!isDesktop && !isMobileOpen}
        onMouseEnter={() => isDesktop && scheduleHover(true)}
        onMouseLeave={() => isDesktop && scheduleHover(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar-bg text-sidebar-text transition-[width,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } ${isHoverOpen ? 'md:w-64 md:shadow-2xl' : 'md:w-16 md:shadow-none'}`}
      >
        <div className="flex items-center gap-3 px-4 py-5">
          <Logo className="h-8 w-8" />
          <Label visible={isExpanded}>
            <span className="text-lg font-semibold">MakeIt</span>
          </Label>
        </div>

        <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3">
          <SidebarBoards
            isExpanded={isExpanded}
            linkRef={firstLinkRef}
            icon={<LayoutIcon />}
            label={<Label visible={isExpanded}>Mis tableros</Label>}
          />
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <button
            type="button"
            title={isExpanded ? undefined : 'Nuevo tablero'}
            onClick={() => {
              setIsMobileOpen(false);
              openCreateBoard();
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-surface px-[11px] py-2 text-sm font-medium text-sidebar-text transition-colors hover:border-accent"
          >
            <PlusIcon />
            <Label visible={isExpanded}>Nuevo tablero</Label>
          </button>
        </div>

        <div className="flex flex-col gap-3 border-t border-sidebar-border px-3 py-4">
          <NavLink
            to="/settings"
            title={isExpanded ? undefined : 'Ajustes'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-surface text-sidebar-text'
                  : 'text-sidebar-text-muted hover:bg-sidebar-surface hover:text-sidebar-text'
              }`
            }
          >
            <SettingsIcon />
            <Label visible={isExpanded}>Ajustes</Label>
          </NavLink>
          {user && (
            <div className="flex items-center gap-3 px-1">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-surface text-xs font-semibold text-sidebar-text"
              >
                {initials}
              </span>
              <span
                className={`min-w-0 transition-opacity duration-200 motion-reduce:transition-none ${
                  isExpanded ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <span className="block truncate text-sm font-medium text-sidebar-text">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-sidebar-text-muted">{user.email}</span>
              </span>
            </div>
          )}
          <button
            type="button"
            title={isExpanded ? undefined : 'Cerrar sesión'}
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex w-full items-center gap-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            <LogoutIcon />
            <Label visible={isExpanded}>
              {logoutMutation.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Label>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-16">
        {/* En escritorio la cabecera solo hace falta dentro de un tablero, para
            las personas conectadas; en móvil lleva siempre el botón del menú. */}
        <header
          className={`flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:justify-end md:px-6 ${
            isInBoard ? '' : 'md:hidden'
          }`}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={isMobileOpen}
            aria-controls="app-sidebar"
            className="-ml-1 rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-text md:hidden"
          >
            <MenuIcon />
          </button>
          <span className="flex items-center gap-2 md:hidden">
            <Logo className="h-6 w-6 rounded-md" />
            <span className="font-semibold">MakeIt</span>
          </span>
          <div className="ml-auto md:ml-0">
            <PresenceAvatars />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>

      <CreateBoardModal isOpen={isCreateBoardOpen} onClose={closeCreateBoard} />
    </div>
  );
}
