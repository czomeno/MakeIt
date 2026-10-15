import { usePresenceStore } from '../stores/presenceStore';
import { avatarColorFor } from '../lib/badgeColors';

// Avatares de quien está conectado al tablero abierto (incluido uno mismo).
// Fuera de un tablero la lista está vacía y no se pinta nada.
export function PresenceAvatars() {
  const presence = usePresenceStore((state) => state.presence);
  if (presence.length === 0) {
    return null;
  }
  return (
    <div
      className="flex items-center -space-x-2"
      role="group"
      aria-label="Personas conectadas a este tablero"
    >
      {presence.map((user) => (
        <span
          key={user.userId}
          title={user.name}
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface text-xs font-bold text-white ${avatarColorFor(user.name || user.userId)}`}
        >
          <span aria-hidden="true">{user.initials || '?'}</span>
          <span className="sr-only">{user.name}</span>
        </span>
      ))}
    </div>
  );
}
