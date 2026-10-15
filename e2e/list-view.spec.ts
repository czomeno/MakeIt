import { test, expect } from '@playwright/test';
import { chooseOption, newUser } from './helpers';

test('vista de lista: crear candidaturas desde el pop-up, filtrarlas y marcarlas como hechas', async ({
  page,
}, testInfo) => {
  // Registro por API: deja la cookie de sesión en el navegador y devuelve el
  // token de acceso para crear el tablero también por API.
  const registered = await page.request.post('/api/auth/register', {
    data: newUser(testInfo, 'Lista'),
  });
  expect(registered.status()).toBe(201);
  const { accessToken } = (await registered.json()) as { accessToken: string };
  const created = await page.request.post('/api/boards', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: 'Candidaturas', template: 'job-applications' },
  });
  expect(created.status()).toBe(201);
  const { board } = (await created.json()) as { board: { _id: string } };

  // Solo las filas de tareas (la barra lateral también tiene una lista).
  const tasks = page.getByRole('list', { name: 'Tareas' });

  // El tablero se abre en la vista de lista.
  await page.goto(`/boards/${board._id}`);
  await expect(page.getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true');

  await test.step('crear una candidatura con estado, prioridad y fecha límite', async () => {
    await page.getByRole('button', { name: 'Añadir candidatura' }).click();
    let dialog = page.getByRole('dialog', { name: 'Nueva candidatura' });
    await dialog.getByLabel('Puesto').fill('Entrevista en Acme');
    await dialog.getByLabel('Empresa').fill('Acme');
    await chooseOption(dialog.getByRole('button', { name: /^Estado/ }), 'Entrevista');
    await chooseOption(dialog.getByRole('button', { name: /^Prioridad/ }), 'Alta');
    await dialog.getByLabel('Fecha límite').fill('2030-01-15');
    await dialog.getByRole('button', { name: 'Añadir candidatura' }).click();
    await expect(dialog).toBeHidden();

    const row = tasks.getByRole('listitem').filter({ hasText: 'Entrevista en Acme' });
    await expect(row.getByText('Alta', { exact: true })).toBeVisible();
    await expect(row.getByText('15 ene')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Entrevista', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Añadir candidatura' }).click();
    dialog = page.getByRole('dialog', { name: 'Nueva candidatura' });
    await dialog.getByLabel('Puesto').fill('Actualizar CV');
    await dialog.getByRole('button', { name: 'Añadir candidatura' }).click();
    await expect(dialog).toBeHidden();
    await expect(tasks.getByRole('listitem')).toHaveCount(2);
  });

  await test.step('filtrar por prioridad', async () => {
    await chooseOption(page.getByRole('button', { name: /^Filtrar por prioridad/ }), 'Alta');
    await expect(tasks.getByRole('listitem')).toHaveCount(1);
    await expect(tasks.getByRole('listitem')).toContainText('Entrevista en Acme');
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(tasks.getByRole('listitem')).toHaveCount(2);
  });

  await test.step('marcar como hecha y que persista', async () => {
    await page.getByRole('checkbox', { name: 'Marcar «Actualizar CV» como hecha' }).check();
    await page.reload();
    await expect(
      page.getByRole('checkbox', { name: 'Marcar «Actualizar CV» como hecha' }),
    ).toBeChecked();
  });
});
