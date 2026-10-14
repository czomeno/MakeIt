# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS deps
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY . .
RUN npm run build

# vite preview en vez de un servidor web aparte: no hace falta más en Fase 0
FROM deps AS prod
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY vite.config.ts ./
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "--port", "4173"]
