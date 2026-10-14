# Makefile — guía de comandos

El `Makefile` de la raíz reúne todos los comandos para levantar, probar y
comprobar `MakeIt`, tanto con Docker como en local. Es un atajo: cada
target simplemente envuelve un comando de `docker compose` o un script de
`npm` ya existente (en `/server` o `/client`); no hay lógica nueva, solo
nombres fáciles de recordar.

## Requisitos

- `make` (viene instalado en macOS/Linux).
- Para los comandos de Docker: `docker` + el plugin `docker compose`, y un
  daemon corriendo (Docker Desktop, Colima, OrbStack...).
- Para los comandos locales (`server-dev`, `server-build`, `test`...): Node.js
  20+ y `npm install` ya ejecutado en `/server` y/o `/client`.

Para ver la lista de comandos sin salir de la terminal:

```bash
make help
```

Cada línea de `make help` sale de un comentario `## ...` justo después del
nombre del target en el `Makefile` — si añades un target nuevo, un comentario
`##` lo documenta automáticamente, no hay que tocar nada más.

## Arranque rápido

```bash
make up      # construye y levanta client + api + mongo en segundo plano
make smoke   # prueba el flujo completo contra la API real
make open    # abre http://localhost:5173 en el navegador
```

## Docker — ver el sistema funcionando

| Comando             | Qué hace                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make up`           | `docker compose up -d --build`. Construye las imágenes si hace falta y levanta los 3 servicios en segundo plano. Es el comando del día a día: no bloquea la terminal.                                                 |
| `make up-fg`        | Lo mismo, pero en primer plano (`docker compose up --build`), mostrando en vivo los logs de `client`, `api` y `mongo` mezclados. Útil la primera vez, para ver el arranque completo.                                  |
| `make down`         | Para y elimina los contenedores. Los datos de Mongo sobreviven (quedan en el volumen `mongo-data`).                                                                                                                   |
| `make down-v`       | Igual, pero además borra **todos** los volúmenes: datos de Mongo y los `node_modules` de `api`/`client`. Es destructivo pero seguro de repetir (todo se puede reconstruir).                                           |
| `make rebuild`      | `down-v` + `up`. El comando a usar después de añadir una dependencia nueva a `package.json`: el volumen de `node_modules` no se refresca solo al reconstruir la imagen (ver nota más abajo), así que hay que tirarlo. |
| `make restart`      | Reinicia los tres contenedores sin reconstruir las imágenes (`docker compose restart`). Más rápido que `down` + `up` cuando el código no ha cambiado.                                                                 |
| `make ps`           | Estado de los contenedores (equivalente a `docker ps` filtrado a este proyecto).                                                                                                                                      |
| `make logs`         | Sigue los logs de los tres servicios a la vez.                                                                                                                                                                        |
| `make logs-api`     | Logs solo de la API (`tsx watch`, conexión a Mongo, peticiones...).                                                                                                                                                   |
| `make logs-client`  | Logs solo del servidor de desarrollo de Vite.                                                                                                                                                                         |
| `make logs-mongo`   | Logs solo de Mongo (arranque, healthcheck, conexiones).                                                                                                                                                               |
| `make shell-api`    | Abre una shell (`sh`) dentro del contenedor de la API — para inspeccionar archivos, correr un comando suelto, etc.                                                                                                    |
| `make shell-client` | Lo mismo, dentro del contenedor del cliente.                                                                                                                                                                          |
| `make mongosh`      | Abre `mongosh` dentro del contenedor de Mongo, ya conectado a la base `kanban`. Para consultar o limpiar datos a mano.                                                                                                |
| `make seed`         | Ejecuta `npm run seed` **dentro** del contenedor de la API: crea el usuario demo (`demo@makeit.test` / `demo12345`) y un tablero de ejemplo.                                                                      |

> **Por qué existe `rebuild` aparte de `up`:** Docker Compose monta
> `node_modules` como un volumen con nombre para no repetir `npm install` en
> cada arranque. Si solo añades código, `make up` basta. Pero si cambias
> `package.json` (una dependencia nueva), esa carpeta montada sigue teniendo
> la versión antigua y el contenedor falla con `ERR_MODULE_NOT_FOUND` aunque
> la imagen se haya reconstruido bien. `make rebuild` borra el volumen antes
> de levantar, así que siempre arranca con el `node_modules` correcto.

## Ver el sistema funcionando

| Comando       | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make health` | `curl` a `GET /api/health` con el JSON formateado. Confirma que la API responde y que ve la base de datos (`"db": "connected"`).                                                                                                                                                                                                                                                                                                                                         |
| `make smoke`  | Ejecuta `scripts/smoke-test.sh`: un flujo real y completo contra la API — salud → registro → login → `/me` → crear tablero → comprobar que se sembraron las columnas del template → crear tarjeta → moverla de columna → verificar dónde queda. Falla (`exit 1`) con un mensaje claro en el primer paso que no se cumpla. No borra los datos que crea: queda un usuario `smoke-<timestamp>@example.com` y su tablero, para que puedas inspeccionarlos si algo no cuadra. |
| `make open`   | Abre `http://localhost:5173` en el navegador (usa el comando `open` de macOS).                                                                                                                                                                                                                                                                                                                                                                                           |

`make smoke` es la forma más rápida de comprobar que todo el sistema —no solo
la API suelta— funciona de verdad tras un cambio: requiere que `make up` haya
terminado y que los tres contenedores estén sanos.

## Instalación y desarrollo local (sin Docker)

Pensado para cuando quieres editar con recarga automática sin pasar por
contenedores. Necesitas un Mongo accesible (local o el de Docker, publicado
en `localhost:27017`) y un `.env` en la raíz (`cp .env.example .env`).

| Comando               | Qué hace                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `make install`        | `npm install` en `/server` y `/client`.                                                                |
| `make server-install` | Solo en `/server`.                                                                                     |
| `make client-install` | Solo en `/client`.                                                                                     |
| `make server-dev`     | `npm run dev` en `/server` (`tsx watch`, puerto 4000). Pensado para su propia terminal.                |
| `make client-dev`     | `npm run dev` en `/client` (Vite, puerto 5173, proxy `/api` → `:4000`). También en su propia terminal. |
| `make seed-local`     | `npm run seed` contra el Mongo de `MONGO_URI` del `.env`, sin pasar por Docker.                        |

## Build

| Comando             | Qué hace                                          |
| ------------------- | ------------------------------------------------- |
| `make build`        | Compila `server` y `client`.                      |
| `make server-build` | Solo `tsc` del servidor, a `server/dist`.         |
| `make client-build` | Solo tipos + bundle del cliente, a `client/dist`. |

## Calidad: lint, formato, tests

| Comando                                                 | Qué hace                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `make lint`                                             | ESLint en `server` y `client`.                                                                                              |
| `make server-lint` / `make client-lint`                 | ESLint en uno solo de los dos proyectos.                                                                                    |
| `make format`                                           | Prettier `--write` en ambos proyectos: reformatea y guarda los archivos.                                                    |
| `make server-format` / `make client-format`             | Lo mismo, en uno solo.                                                                                                      |
| `make format-check`                                     | Prettier `--check` en ambos: falla si algo no está formateado, sin modificar nada (lo que corre en CI).                     |
| `make server-format-check` / `make client-format-check` | Lo mismo, en uno solo.                                                                                                      |
| `make test`                                             | Tests de la API: Jest + Supertest + un Mongo en memoria (`mongodb-memory-server`). No toca Docker ni la base de datos real. |
| `make test-coverage`                                    | Igual, con el informe de cobertura por archivo.                                                                             |
| `make check`                                            | `lint` + `build` + `test`, en ese orden. El comando a correr antes de un commit grande o antes de hacer `make rebuild`.     |

## Limpieza

| Comando      | Qué hace                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make clean` | Borra `node_modules`, `dist` y `coverage` de `server` y `client`. No toca Docker ni la base de datos — para eso está `make down-v`. Después hace falta `make install` para volver a trabajar en local. |

## El script `scripts/smoke-test.sh`

Es un script de shell normal (`bash`, con `set -euo pipefail`), pensado para
ejecutarse con `make smoke` pero que también puedes correr directamente:

```bash
./scripts/smoke-test.sh
BASE_URL=http://localhost:4000/api ./scripts/smoke-test.sh   # para apuntar a otra URL
```

Usa `curl` para hablar con la API y `python3 -c` como forma ligera de leer
los campos que necesita de cada respuesta JSON (no añade ninguna dependencia
nueva al proyecto). Cada paso imprime `✓` en verde si sale bien; el primer
paso que falle corta la ejecución (`exit 1`) con un mensaje explicando qué
se esperaba.

## ¿Por qué un Makefile y no solo scripts de npm?

El proyecto ya tiene sus propios scripts de `npm` en `/server` y `/client`
(`dev`, `build`, `lint`, `test`...) — el Makefile no los sustituye, los llama.
Lo que aporta es un único punto de entrada en la raíz del repo que cubre
también los comandos de `docker compose` (que no son `npm scripts`) y da
nombres cortos e iguales para "la versión Docker" y "la versión local" de
cada tarea, sin tener que recordar en qué carpeta hay que estar ni la sintaxis
exacta de cada herramienta.
