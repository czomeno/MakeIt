import { test, expect } from '@playwright/test';
import { addCard, column, createBoardViaUi, newUser } from './helpers';

test('registro → login → tablero con plantilla → columna y tarjeta → persisten tras recargar', async ({
  page,
}, testInfo) => {
  const user = newUser(testInfo, 'Ada');

  await test.step('registro', async () => {
    await page.goto('/register');
    await page.getByLabel('Nombre').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Contraseña').fill(user.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/boards$/);
  });

  await test.step('cerrar sesión y volver a entrar', async () => {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Contraseña').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/boards$/);
  });

  await test.step('crear tablero con la plantilla de candidaturas', async () => {
    await createBoardViaUi(page, 'Búsqueda de empleo', 'Candidaturas de empleo');
    await expect(column(page, 'Por aplicar')).toBeVisible();
    await expect(column(page, 'Oferta')).toBeVisible();
  });

  await test.step('crear una columna y una tarjeta en ella', async () => {
    await page.getByLabel('Nueva columna').fill('Seguimiento');
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await expect(column(page, 'Seguimiento')).toBeVisible();
    await addCard(page, 'Seguimiento', 'Llamar a Acme');
  });

  await test.step('recargar: la sesión y los datos persisten', async () => {
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Búsqueda de empleo', exact: true }),
    ).toBeVisible();
    await expect(
      column(page, 'Seguimiento').getByRole('button', { name: 'Llamar a Acme' }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
