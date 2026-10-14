SHELL := /bin/bash
.DEFAULT_GOAL := help

# MakeIt — comandos de desarrollo, Docker y verificación.
# "make help" lista todo con una línea de descripción por comando.

# ============================================================
# Docker (flujo recomendado para ver el sistema funcionando)
# ============================================================

up: ## Levanta todo en segundo plano (build + client + api + mongo)
	docker compose up -d --build

up-fg: ## Igual que "up" pero en primer plano, mostrando los logs de los 3 servicios
	docker compose up --build

down: ## Para y elimina los contenedores (conserva los datos de Mongo)
	docker compose down

down-v: ## Para y elimina contenedores + volúmenes (borra Mongo y node_modules)
	docker compose down -v

rebuild: ## Reconstruye desde cero; útil tras añadir una dependencia nueva
	docker compose down -v
	docker compose up -d --build

restart: ## Reinicia los tres servicios sin reconstruir imágenes
	docker compose restart

ps: ## Estado de los contenedores
	docker compose ps

logs: ## Logs de los tres servicios en vivo
	docker compose logs -f

logs-api: ## Logs solo de la API
	docker compose logs -f api

logs-client: ## Logs solo del cliente
	docker compose logs -f client

logs-mongo: ## Logs solo de Mongo
	docker compose logs -f mongo

shell-api: ## Abre una shell dentro del contenedor de la API
	docker compose exec api sh

shell-client: ## Abre una shell dentro del contenedor del cliente
	docker compose exec client sh

mongosh: ## Abre mongosh dentro del contenedor de Mongo, en la base "kanban"
	docker compose exec mongo mongosh kanban

seed: ## Crea el usuario y tablero demo dentro del contenedor de la API
	docker compose exec api npm run seed

# ============================================================
# Ver el sistema funcionando
# ============================================================

health: ## Comprueba GET /api/health (estado de la API y de la base de datos)
	curl -sf http://localhost:4000/api/health | python3 -m json.tool

smoke: ## Flujo real contra la API en Docker: registro -> login -> tablero -> tarjeta -> mover
	./scripts/smoke-test.sh

open: ## Abre el cliente en el navegador (macOS)
	open http://localhost:5173

# ============================================================
# Instalación y desarrollo local (sin Docker)
# ============================================================

install: server-install client-install ## npm install en server y client

server-install: ## npm install solo en /server
	cd server && npm install

client-install: ## npm install solo en /client
	cd client && npm install

server-dev: ## Arranca la API en local con recarga automática (necesita Mongo accesible)
	cd server && npm run dev

client-dev: ## Arranca el cliente en local (Vite, proxy /api -> localhost:4000)
	cd client && npm run dev

seed-local: ## Seed contra el Mongo de MONGO_URI, sin Docker
	cd server && npm run seed

# ============================================================
# Build
# ============================================================

build: server-build client-build ## Compila server y client

server-build: ## Compila la API (TypeScript) a server/dist
	cd server && npm run build

client-build: ## Compila el cliente (tipos + bundle) a client/dist
	cd client && npm run build

# ============================================================
# Calidad: lint, formato, tests
# ============================================================

lint: server-lint client-lint ## ESLint en server y client

server-lint: ## ESLint solo en /server
	cd server && npm run lint

client-lint: ## ESLint solo en /client
	cd client && npm run lint

format: server-format client-format ## Formatea server y client con Prettier (escribe cambios)

server-format: ## Prettier --write solo en /server
	cd server && npm run format

client-format: ## Prettier --write solo en /client
	cd client && npm run format

format-check: server-format-check client-format-check ## Comprueba el formato sin modificar archivos

server-format-check: ## Prettier --check solo en /server
	cd server && npm run format:check

client-format-check: ## Prettier --check solo en /client
	cd client && npm run format:check

test: ## Tests de la API (Jest + Supertest + Mongo en memoria, no toca Docker)
	cd server && npm test

test-coverage: ## Tests de la API con informe de cobertura
	cd server && npm run test:coverage

check: lint build test ## Lint + build + tests de todo el proyecto (antes de un commit grande)

# ============================================================
# Limpieza
# ============================================================

clean: ## Borra node_modules, dist y coverage de server y client (no toca Docker)
	rm -rf server/node_modules server/dist server/coverage
	rm -rf client/node_modules client/dist

# ============================================================
# Ayuda
# ============================================================

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: up up-fg down down-v rebuild restart ps logs logs-api logs-client logs-mongo \
	shell-api shell-client mongosh seed health smoke open \
	install server-install client-install server-dev client-dev seed-local \
	build server-build client-build \
	lint server-lint client-lint format server-format client-format \
	format-check server-format-check client-format-check test test-coverage check \
	clean help
