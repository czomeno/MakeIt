import type { ActivityItem, BoardRole } from '../../types/api';

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: 'administrador',
  editor: 'editor',
  viewer: 'lector',
};

function text(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

// Frase en español a partir del tipo + los datos guardados en el momento del
// evento (títulos/nombres, no referencias): sigue teniendo sentido aunque la
// tarjeta/columna ya no exista.
export function activityMessage(item: ActivityItem): string {
  const actor = item.actor?.name || 'Alguien';
  const d = item.data;

  switch (item.type) {
    case 'card.created':
      return `${actor} creó «${text(d, 'cardTitle')}» en ${text(d, 'columnTitle')}`;
    case 'card.updated':
      return `${actor} editó «${text(d, 'cardTitle')}»`;
    case 'card.moved': {
      const from = text(d, 'fromColumnTitle');
      const to = text(d, 'toColumnTitle');
      return from === to
        ? `${actor} reordenó «${text(d, 'cardTitle')}» en ${to}`
        : `${actor} movió «${text(d, 'cardTitle')}» de ${from} a ${to}`;
    }
    case 'card.deleted':
      return `${actor} borró «${text(d, 'cardTitle')}»`;
    case 'column.created':
      return `${actor} creó la columna «${text(d, 'columnTitle')}»`;
    case 'column.renamed':
      return `${actor} renombró «${text(d, 'oldTitle')}» a «${text(d, 'newTitle')}»`;
    case 'column.moved':
      return `${actor} reordenó la columna «${text(d, 'columnTitle')}»`;
    case 'column.deleted':
      return `${actor} borró la columna «${text(d, 'columnTitle')}»`;
    case 'member.joined':
      return `${text(d, 'memberName') || actor} se unió al tablero`;
    case 'member.left':
      return `${text(d, 'memberName') || actor} abandonó el tablero`;
    case 'member.removed':
      return `${actor} expulsó a ${text(d, 'memberName')}`;
    case 'member.role_changed': {
      const newRole = text(d, 'newRole') as BoardRole;
      return `${actor} cambió el rol de ${text(d, 'memberName')} a ${ROLE_LABELS[newRole] ?? newRole}`;
    }
    default:
      return `${actor} hizo un cambio`;
  }
}
