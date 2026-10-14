import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './stores/authStore';
// Efecto de carga: aplica el tema guardado a <html> antes del primer pintado,
// para que /login y /register también respeten el tema (no solo el sidebar).
import './stores/themeStore';
import { bootstrapSession } from './api/auth';
import { AppRouter } from './routes/AppRouter';
import { Toaster } from './components/Toaster';
import { Spinner } from './components/Spinner';

export default function App() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {status === 'loading' ? (
          <div className="flex min-h-screen items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <AppRouter />
        )}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
