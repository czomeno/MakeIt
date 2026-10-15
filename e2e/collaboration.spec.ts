import { test, expect, type Page } from '@playwright/test';
import {
  addCard,
  chooseOption,
  column,
  createBoardViaUi,
  dragAnnouncement,
  dragCardWithKeyboard,
  liveConnection,
  newUser,
  registerViaApi,
  showBoardView,
} from './helpers';

async function openCollaborationTab(page: Page, tab: 'Miembros' | 'Invitar') {
  await page.getByRole('button', { name: 'Colaboración' }).click();
  const dialog = page.getByRole('dialog', { name: 'Colaboración' });
  await dialog.getByRole('tab', { name: tab }).click();
  return dialog;
}

test('dos usuarios: invitación, movimiento en vivo, cambio de rol y expulsión', async ({
  browser,
}, testInfo) => {
  // Dos contextos = dos navegadores independientes (cookies y sesión propias).
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const userA = newUser(testInfo, 'Admin');
  const userB = newUser(testInfo, 'Invitada');

  try {
    await registerViaApi(pageA, userA);
    await registerViaApi(pageB, userB);
    const boardTitle = 'Proyecto compartido';
    await createBoardViaUi(pageA, boardTitle);
    await addCard(pageA, 'Por hacer', 'Compartida');

    await test.step('A invita a B por enlace y B acepta', async () => {
      const dialog = await openCollaborationTab(pageA, 'Invitar');
      await dialog.getByLabel('Email').fill(userB.email);
      await chooseOption(dialog.getByLabel('Rol', { exact: false }), 'Editor');
      await dialog.getByRole('button', { name: 'Invitar' }).click();
      const link = await dialog.getByRole('textbox', { name: 'Enlace de invitación' }).inputValue();
      await pageA.keyboard.press('Escape');

      await pageB.goto(new URL(link).pathname);
      await expect(
        pageB.getByRole('heading', { level: 1, name: boardTitle, exact: true }),
      ).toBeVisible();
      await showBoardView(pageB);
      await expect(liveConnection(pageB)).toBeVisible();
      await expect(liveConnection(pageA)).toBeVisible();
    });

    await test.step('A mueve una tarjeta y B la ve moverse sin recargar', async () => {
      await dragCardWithKeyboard(pageA, 'Compartida', 'ArrowDown', async () => {
        await expect(dragAnnouncement(pageA, 'Compartida', 'En curso')).toBeAttached();
      });

      await expect(
        column(pageB, 'En curso').getByRole('button', { name: 'Compartida' }),
      ).toBeVisible();
    });

    await test.step('A pasa a B a lector y B pierde los controles de edición', async () => {
      await expect(
        pageB.getByRole('textbox', { name: 'Añadir tarjeta a Por hacer' }),
      ).toBeVisible();

      const dialog = await openCollaborationTab(pageA, 'Miembros');
      await chooseOption(
        dialog.getByRole('button', { name: new RegExp(`^Rol de ${userB.name}`) }),
        'Lector',
      );

      await expect(pageB.getByRole('textbox', { name: 'Añadir tarjeta a Por hacer' })).toHaveCount(
        0,
      );
      await expect(pageB.getByLabel('Nueva columna')).toHaveCount(0);
    });

    await test.step('A expulsa a B y B ve que ya no tiene acceso', async () => {
      const dialog = pageA.getByRole('dialog', { name: 'Colaboración' });
      await dialog.getByRole('button', { name: `Expulsar a ${userB.name}` }).click();
      await pageA
        .getByRole('dialog', { name: 'Expulsar miembro' })
        .getByRole('button', { name: 'Expulsar' })
        .click();

      await expect(pageB.getByText('Ya no tienes acceso a este tablero')).toBeVisible();
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
