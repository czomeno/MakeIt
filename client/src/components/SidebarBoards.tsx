import { useId, type ReactNode, type Ref } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useBoardsQuery } from '../features/boards/hooks';
import { useViewPreferenceStore } from '../stores/viewPreferenceStore';
import { avatarColorFor } from '../lib/badgeColors';

interface SidebarBoardsProps {
  // La barra lateral muestra los textos (desplegada en escritorio o menú
  // móvil abierto). Plegada en iconos, el submenú se oculta.
  isExpanded: boolean;
  icon: ReactNode;
  label: ReactNode;
  linkRef?: Ref<HTMLAnchorElement>;
}

// Duración común de las animaciones del submenú (altura, opacidad, flecha).
const ANIMATION = 'duration-200 ease-out motion-reduce:transition-none';

// "Mis tableros" de la barra lateral: el enlace lleva a la lista de tableros
// y la flecha despliega debajo todos los tableros para entrar directamente.
export function SidebarBoards({ isExpanded, icon, label, linkRef }: SidebarBoardsProps) {
  const isOpen = useViewPreferenceStore((state) => state.isBoardsMenuOpen);
  const toggle = useViewPreferenceStore((state) => state.toggleBoardsMenu);
  const boardsQuery = useBoardsQuery();
  const { pathname } = useLocation();
  const submenuId = useId();

  const isShown = isOpen && isExpanded;
  const isInBoards = pathname === '/boards' || pathname.startsWith('/boards/');
  // Con el submenú visible, el tablero abierto se resalta en él; "Mis
  // tableros" solo en la propia lista. Plegado, "Mis tableros" lo representa.
  const isParentActive = isShown ? pathname === '/boards' : isInBoards;
  const boards = boardsQuery.data ?? [];

  return (
    <div>
      <div className="relative">
        <NavLink
          ref={linkRef}
          to="/boards"
          end
          title={isExpanded ? undefined : 'Mis tableros'}
          className={`flex items-center gap-3 rounded-lg py-2 pl-3 text-sm font-medium transition-colors ${
            isExpanded ? 'pr-10' : 'pr-3'
          } ${
            isParentActive
              ? 'bg-sidebar-surface text-sidebar-text'
              : 'text-sidebar-text-muted hover:bg-sidebar-surface hover:text-sidebar-text'
          }`}
        >
          {icon}
          {label}
        </NavLink>
        <button
          type="button"
          onClick={toggle}
          tabIndex={isExpanded ? 0 : -1}
          aria-expanded={isShown}
          aria-controls={submenuId}
          aria-label={isOpen ? 'Ocultar mis tableros' : 'Mostrar mis tableros'}
          className={`absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-text-muted transition-opacity hover:bg-sidebar-border hover:text-sidebar-text ${ANIMATION} ${
            isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${ANIMATION} ${isOpen ? 'rotate-90' : ''}`}
          >
            <path
              d="m8 5 5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Altura animada con grid-template-rows (0fr ↔ 1fr): no hace falta
          conocer la altura de la lista. Oculto, queda inerte (sin foco). */}
      <div
        id={submenuId}
        inert={!isShown}
        className={`grid transition-[grid-template-rows,opacity] ${ANIMATION} ${
          isShown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <ul
            aria-label="Mis tableros"
            className="mt-1 ml-5 flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto border-l border-sidebar-border pl-2"
          >
            {boardsQuery.isPending && (
              <li className="px-2 py-1.5 text-xs text-sidebar-text-muted">Cargando…</li>
            )}
            {boardsQuery.isError && (
              <li className="px-2 py-1.5 text-xs text-sidebar-text-muted">
                No se pudieron cargar.
              </li>
            )}
            {boardsQuery.isSuccess && boards.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-sidebar-text-muted">
                Todavía no tienes tableros.
              </li>
            )}
            {boards.map((board, index) => (
              <li
                key={board._id}
                // Entrada escalonada: cada tablero aparece un poco después.
                style={{ transitionDelay: isShown ? `${Math.min(index, 8) * 25}ms` : '0ms' }}
                className={`transition-[opacity,transform] ${ANIMATION} ${
                  isShown ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                }`}
              >
                <NavLink
                  to={`/boards/${board._id}`}
                  title={board.title}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-sidebar-surface font-medium text-sidebar-text'
                        : 'text-sidebar-text-muted hover:bg-sidebar-surface hover:text-sidebar-text'
                    }`
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${avatarColorFor(board.title)}`}
                  />
                  <span className="truncate">{board.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
