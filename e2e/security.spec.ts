import { test, expect } from '@playwright/test';
import { newUser, registerViaApi } from './helpers';

test('un usuario sin relación con un tablero recibe "no encontrado" al abrir su URL', async ({
  browser,
}, testInfo) => {
  const owner = await browser.newContext();
  const outsider = await browser.newContext();
  try {
    const ownerPage = await owner.newPage();
    const register = await ownerPage.request.post('/api/auth/register', {
      data: newUser(testInfo, 'Propietaria'),
    });
    const { accessToken } = (await register.json()) as { accessToken: string };
    const created = await ownerPage.request.post('/api/boards', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: 'Privado', template: 'generic' },
    });
    const { board } = (await created.json()) as { board: { _id: string } };

    const outsiderPage = await outsider.newPage();
    await registerViaApi(outsiderPage, newUser(testInfo, 'Ajena'));
    await outsiderPage.goto(`/boards/${board._id}`);

    await expect(
      outsiderPage.getByRole('heading', { level: 1, name: 'Tablero no encontrado' }),
    ).toBeVisible();
    // Ni el título ni el contenido del tablero llegan a mostrarse.
    await expect(outsiderPage.getByText('Privado')).toHaveCount(0);
  } finally {
    await owner.close();
    await outsider.close();
  }
});
