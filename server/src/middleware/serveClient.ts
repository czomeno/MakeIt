import path from 'node:path';
import express, { type RequestHandler, type Router } from 'express';

// Archivos que NUNCA se cachean: deben poder cambiar en cada despliegue (el
// service worker y el manifest deciden cuándo hay una versión nueva).
const NO_CACHE_FILES = new Set(['index.html', 'sw.js', 'registerSW.js', 'manifest.webmanifest']);

// Imagen única de producción: la API sirve también el frontend compilado
// (client/dist), desde el MISMO origen que /api y que Socket.io.
//
// Orden de prioridad (ver createApp):
//  1. Socket.io intercepta su path en el servidor HTTP, antes de Express.
//  2. /api: rutas de la API y, si no existe la ruta, 404 JSON.
//  3. Estáticos del cliente.
//  4. Fallback a index.html para el router de React (/boards/123...).
export function serveClient(distPath: string, socketPath: string): Router {
  const root = path.resolve(distPath);
  const indexFile = path.join(root, 'index.html');
  const router = express.Router();

  router.use(
    express.static(root, {
      index: false,
      setHeaders: (res, filePath) => {
        const relative = path.relative(root, filePath).split(path.sep).join('/');
        if (relative.startsWith('assets/')) {
          // Nombre con hash de contenido (Vite): nunca cambia, caché de 1 año.
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (NO_CACHE_FILES.has(relative) || relative.startsWith('workbox-')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          // Iconos, favicon...: cambian poco, sin hash en el nombre.
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    }),
  );

  const spaFallback: RequestHandler = (req, res, next) => {
    const isPageRequest =
      (req.method === 'GET' || req.method === 'HEAD') &&
      !req.path.startsWith('/api/') &&
      req.path !== '/api' &&
      !req.path.startsWith(socketPath) &&
      // /assets/falta.js o /favicon.png inexistentes: 404, no index.html.
      path.extname(req.path) === '';
    if (!isPageRequest) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile, (error) => {
      if (error) {
        next(error);
      }
    });
  };
  router.use(spaFallback);

  return router;
}
