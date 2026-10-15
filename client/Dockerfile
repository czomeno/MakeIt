# syntax=docker/dockerfile:1


# Versión exacta de Node (misma major que .nvmrc y que el CI). FROM literal,
# sin ARG, para que Dependabot pueda actualizarla.
FROM node:26.11.1-alpine3.24 AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS deps
# El hash del lockfile instalado permite al target dev detectar un volumen de
# node_modules desactualizado (ver más abajo).
RUN npm ci && sha1sum package-lock.json > node_modules/.lock-hash

# --- Desarrollo (docker-compose.yml): Vite con hot reload
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
# docker-compose.yml monta node_modules en un volumen con nombre, que NO se
# actualiza al reconstruir la imagen: si package-lock.json cambió desde la
# última instalación, se reinstala antes de arrancar.
CMD ["sh", "-c", "sha1sum -c -s node_modules/.lock-hash 2>/dev/null || { echo 'package-lock.json ha cambiado: npm ci...'; npm ci && sha1sum package-lock.json > node_modules/.lock-hash; }; exec npm run dev"]

# Producción: el bundle lo compila y lo sirve la imagen única (Dockerfile de
# la raíz); este archivo solo tiene el target de desarrollo.
