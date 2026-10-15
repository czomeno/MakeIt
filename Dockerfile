# syntax=docker/dockerfile:1

# Imagen ÚNICA de producción: la API (Express + Socket.io) sirve también el
# frontend compilado, todo desde el mismo origen. Es lo que se despliega en
# Render (render.yaml) y lo que usan el CI, los e2e y la alternativa VPS.
#
#   docker build -t makeit .
#
# El desarrollo sigue usando server/Dockerfile y client/Dockerfile (target dev).

# --- Frontend: bundle estático de Vite (+ service worker de la PWA)
FROM node:26.11.1-alpine3.24 AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- API: TypeScript compilado a dist/
FROM node:26.11.1-alpine3.24 AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# --ignore-scripts: evita descargar el binario de mongod de los tests.
RUN npm ci --ignore-scripts
COPY server/ ./
RUN npm run build

# --- Solo dependencias de producción de la API
FROM node:26.11.1-alpine3.24 AS server-prod-deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# --- Producción
FROM node:26.11.1-alpine3.24 AS prod
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_CLIENT=true \
    CLIENT_DIST_PATH=/app/public \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
# El proceso no necesita npm/yarn/corepack en producción, y sus dependencias
# internas son la fuente más habitual de CVEs en los escaneos de la imagen.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
# Archivos de root y de solo lectura para el usuario "node".
COPY server/package.json ./
COPY --from=server-prod-deps /app/node_modules ./node_modules
COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ./public
USER node
# Render inyecta su propio PORT; 4000 es solo el valor por defecto.
EXPOSE 4000
# /api/ready responde 200 solo con Mongo conectado y sin apagado en curso.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# node directamente (no "npm start"): así SIGTERM llega al proceso y el
# apagado ordenado se ejecuta.
CMD ["node", "dist/server.js"]
