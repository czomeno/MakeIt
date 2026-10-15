import { expect, type Page, type TestInfo } from '@playwright/test';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

// Emails únicos por test y worker: los tests son independientes entre sí y
// pueden ejecutarse en paralelo contra la misma base de datos.
export function newUser(testInfo: TestInfo, name: string): TestUser {
  const id = `${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name,
    email: `e2e-${name.toLowerCase()}-${id}@example.com`,
    password: 'contraseña-e2e-segura',
  };
}

// Registro por API (más rápido que por la UI): la cookie de refresh queda en
// el contexto del navegador, así que al abrir la app ya hay sesión.
export async function registerViaApi(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post('/api/auth/register', { data: user });
  expect(response.status(), await response.text()).toBe(201);
}

export async function createBoardViaUi(
  page: Page,
  title: string,
  template: 'Genérico' | 'Candidaturas de empleo' = 'Genérico',
): Promise<string> {
  await page.goto('/boards');
  await page.getByRole('button', { name: 'Nuevo tablero' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo tablero' });
  await dialog.getByLabel('Título').fill(title);
  await dialog.getByLabel('Plantilla').selectOption({ label: template });
  await dialog.getByRole('button', { name: 'Crear tablero' }).click();
  await expect(page).toHaveURL(/\/boards\/[0-9a-f]{24}$/);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  return new URL(page.url()).pathname.split('/').pop()!;
}

// Cada columna se localiza por su botón de título (accesible también en modo
// lectura); el data-testid solo acota el contenedor.
export function column(page: Page, title: string) {
  return page
    .getByTestId('board-column')
    .filter({ has: page.getByRole('button', { name: title, exact: true }) });
}

export function card(page: Page, title: string) {
  return page.getByRole('button', { name: new RegExp(`^${title}`) });
}

export async function addCard(page: Page, columnTitle: string, title: string): Promise<void> {
  const input = page.getByRole('textbox', { name: `Añadir tarjeta a ${columnTitle}` });
  await input.fill(title);
  await input.press('Enter');
  await expect(column(page, columnTitle).getByRole('button', { name: title })).toBeVisible();
}

// Arrastre con el teclado (KeyboardSensor de dnd-kit): espacio para coger,
// flecha para mover, espacio para soltar. Es el camino accesible que usaría
// un usuario de teclado y, a diferencia del ratón, es determinista.
//
// `untilReady` espera una condición OBSERVABLE antes de soltar (p. ej. el
// anuncio para lectores de pantalla, o que la vista previa ya se reordenó):
// dnd-kit puede desplazar la página con scroll suave para seguir al elemento,
// y soltar antes de que termine dejaría la tarjeta donde estaba.
export async function dragCardWithKeyboard(
  page: Page,
  title: string,
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
  untilReady: () => Promise<void>,
): Promise<void> {
  const moved = page.waitForResponse(
    (response) => /\/api\/cards\/[0-9a-f]+\/move$/.test(response.url()) && response.ok(),
  );
  await card(page, title).focus();
  await page.keyboard.press('Space');
  // El arrastre ya está activo (aparece la copia flotante)...
  await expect(dragOverlay(page, title)).toBeVisible();
  // ...pero el KeyboardSensor de dnd-kit registra su listener de flechas en un
  // setTimeout(0) al coger la tarjeta, y una flecha enviada antes se pierde.
  // Un setTimeout(0) propio en la página se ejecuta después del suyo (mismo
  // retardo, orden de llegada): es un punto de sincronización, no una espera.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press(key);
  await untilReady();
  await page.keyboard.press('Space');
  await moved;
  // La copia flotante (DragOverlay) desaparece al terminar la animación.
  await expect(card(page, title)).toHaveCount(1);
}

// Anuncio de dnd-kit (región aria-live, visualmente oculta) mientras se
// arrastra una tarjeta sobre otra columna.
export function dragAnnouncement(page: Page, cardTitle: string, columnTitle: string) {
  return page.getByText(`Tarjeta ${cardTitle} sobre la columna ${columnTitle}.`, { exact: true });
}

// Copia flotante (DragOverlay) de la tarjeta que se está arrastrando: es el
// botón con ese título que NO es un elemento ordenable de dnd-kit.
export function dragOverlay(page: Page, title: string) {
  return card(page, title).and(page.locator(':not([aria-roledescription])'));
}
