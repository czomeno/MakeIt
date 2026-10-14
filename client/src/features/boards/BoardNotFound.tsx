import { Link } from 'react-router-dom';

export function BoardNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Tablero no encontrado</h1>
      <p className="max-w-sm text-sm text-text-muted">
        No existe o no tienes acceso a este tablero.
      </p>
      <Link to="/boards" className="text-accent hover:text-accent-hover">
        Volver a mis tableros
      </Link>
    </div>
  );
}
