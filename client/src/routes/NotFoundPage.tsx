import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-text-muted">La ruta que buscas no existe.</p>
      <Link to="/boards" className="text-accent hover:text-accent-hover">
        Volver a mis tableros
      </Link>
    </div>
  );
}
