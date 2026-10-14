#!/usr/bin/env bash
# Prueba de humo contra la API real (pensada para usarse vía "make smoke").
# Flujo: health -> registro -> login -> /me -> crear tablero -> crear tarjeta
# -> moverla de columna -> comprobar el resultado. No borra nada al acabar:
# el usuario y el tablero de prueba quedan en la base de datos.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
STAMP="$(date +%s)"
EMAIL="smoke-${STAMP}@example.com"
PASSWORD="password123"

info()  { printf '\033[36m==> %s\033[0m\n' "$1"; }
ok()    { printf '\033[32m    ✓ %s\033[0m\n' "$1"; }
fail()  { printf '\033[31m    ✗ %s\033[0m\n' "$1"; exit 1; }

command -v curl >/dev/null || fail "curl no está instalado"
command -v python3 >/dev/null || fail "python3 no está instalado (se usa para leer el JSON de las respuestas)"

json_get() {
  # json_get '<json>' 'expresión python sobre data' — pequeño helper para no
  # repetir el boilerplate de python3 -c en cada paso.
  python3 -c "import sys, json; data = json.loads(sys.argv[1]); print($1)" "$2"
}

info "Comprobando que la API responde en $BASE_URL"
HEALTH="$(curl -sf "$BASE_URL/health")" || fail "La API no responde. ¿Está arriba? Prueba con: make up"
DB_STATUS="$(json_get "data['db']" "$HEALTH")"
[ "$DB_STATUS" = "connected" ] || fail "La API responde pero la base de datos está '$DB_STATUS'"
ok "API ok, base de datos connected"

info "Registrando usuario de prueba ($EMAIL)"
REGISTER="$(curl -sf -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
ok "Usuario creado: $(json_get "data['user']['id']" "$REGISTER")"

info "Iniciando sesión con las mismas credenciales"
LOGIN="$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
ACCESS_TOKEN="$(json_get "data['accessToken']" "$LOGIN")"
ok "Login ok, access token obtenido"

info "GET /auth/me con el access token"
ME="$(curl -sf "$BASE_URL/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN")"
ok "Usuario autenticado: $(json_get "data['user']['email']" "$ME")"

info "Creando un tablero (template job-applications)"
BOARD="$(curl -sf -X POST "$BASE_URL/boards" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Tablero de prueba (smoke test)","template":"job-applications"}')"
BOARD_ID="$(json_get "data['board']['_id']" "$BOARD")"
ok "Tablero creado: $BOARD_ID"

info "Comprobando que se sembraron las columnas del template"
DETAIL="$(curl -sf "$BASE_URL/boards/$BOARD_ID" -H "Authorization: Bearer $ACCESS_TOKEN")"
COLUMN_TITLES="$(json_get "', '.join(c['title'] for c in data['board']['columns'])" "$DETAIL")"
COL1="$(json_get "data['board']['columns'][0]['_id']" "$DETAIL")"
COL2="$(json_get "data['board']['columns'][1]['_id']" "$DETAIL")"
ok "Columnas: $COLUMN_TITLES"

info "Creando una tarjeta en la primera columna"
CARD="$(curl -sf -X POST "$BASE_URL/columns/$COL1/cards" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Candidatura de prueba","company":"Acme Inc.","labels":["smoke-test"]}')"
CARD_ID="$(json_get "data['card']['_id']" "$CARD")"
ok "Tarjeta creada: $CARD_ID"

info "Moviendo la tarjeta a la segunda columna"
curl -sf -X PATCH "$BASE_URL/cards/$CARD_ID/move" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"columnId\":\"$COL2\"}" >/dev/null
ok "Tarjeta movida"

info "Comprobando el resultado final"
FINAL="$(curl -sf "$BASE_URL/boards/$BOARD_ID" -H "Authorization: Bearer $ACCESS_TOKEN")"
FINAL_COLUMN="$(json_get "next(c['title'] for c in data['board']['columns'] if any(card['_id'] == '$CARD_ID' for card in c['cards']))" "$FINAL")"
[ "$FINAL_COLUMN" = "Enviada" ] || fail "La tarjeta debería estar en 'Enviada' y está en '$FINAL_COLUMN'"
ok "La tarjeta está en la columna '$FINAL_COLUMN'"

echo
printf '\033[32m✓ Flujo completo correcto: health -> registro -> login -> /me -> tablero -> tarjeta -> mover\033[0m\n'
printf 'Tablero de prueba: %s/boards/%s\n' "$BASE_URL" "$BOARD_ID"
