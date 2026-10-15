# Tests end-to-end (Playwright)

Cuatro flujos, pocos y fiables, contra el **stack real**: la imagen única de
producción (API + Socket.io + frontend, lo mismo que se despliega en Render) y
un Mongo efímero, definidos en
[`docker-compose.e2e.yml`](../docker-compose.e2e.yml).

| Spec                           | Qué comprueba                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth-and-persistence.spec.ts` | Registro → cerrar sesión → login → tablero con plantilla → columna y tarjeta → al recargar, la sesión y los datos siguen ahí.              |
| `drag-and-drop.spec.ts`        | Mover tarjetas con el teclado (reordenar en la columna y pasar a la siguiente) y que el orden persista tras recargar.                      |
| `collaboration.spec.ts`        | Dos navegadores: A invita a B por enlace, B acepta, A mueve una tarjeta y B la ve moverse en vivo; A pasa a B a lector y luego lo expulsa. |
| `security.spec.ts`             | Un usuario sin relación con un tablero ve «Tablero no encontrado» al abrir su URL.                                                         |

## Ejecutarlos en local

Requisitos: Docker en marcha y las dependencias de la raíz instaladas.

```bash
npm install                          # en la raíz (una vez)
npx playwright install chromium      # el navegador (una vez)
npm run test:e2e                     # levanta el stack, ejecuta y lo tira
```

`npm run test:e2e` construye la imagen, levanta `docker-compose.e2e.yml`
(app en http://localhost:8081, puerto configurable con `E2E_PORT`), espera
a que los servicios estén _healthy_ y al acabar lo destruye todo.

Opciones útiles:

```bash
npx playwright test --ui                               # modo interactivo
npx playwright test collaboration                      # un solo spec
E2E_KEEP_STACK=1 npm run test:e2e                      # no tirar el stack al acabar
E2E_BASE_URL=http://localhost:8081 npx playwright test # contra un stack ya levantado
npx playwright show-report                             # informe HTML del último run
```

Si un test falla, en `test-results/` quedan la traza (`trace.zip`, ábrela con
`npx playwright show-trace`), la captura y el vídeo de ese test. En CI se suben
como artefacto del job `e2e`.

## Reglas de la suite

- **Selectores por rol y nombre accesible** (`getByRole`, `getByLabel`). El
  único `data-testid` es `board-column`, porque una columna no tiene rol propio.
- **Sin esperas fijas.** Se espera siempre a una condición observable: un
  elemento visible, una respuesta de red, el anuncio para lectores de
  pantalla de dnd-kit o `expect.poll`.
- **Sin reintentos** (`retries: 0`): si un test solo pasa a la segunda, está
  roto.
- **Sin service worker:** la PWA se bloquea en los e2e (`serviceWorkers:
'block'`) para que cada test vea lo que sirve el servidor, no una caché.
- **Tests independientes:** cada uno crea sus propios usuarios con emails
  únicos, así que pueden ejecutarse en paralelo contra la misma base de datos.
- **Arrastre con teclado** en lugar de ratón: es determinista y además prueba
  el camino accesible. Ventana Full HD (1920×1080) para que el tablero quepa
  sin scroll: si la página tiene que desplazarse, dnd-kit mueve la tarjeta con
  una animación de scroll cuya duración no controlamos.
