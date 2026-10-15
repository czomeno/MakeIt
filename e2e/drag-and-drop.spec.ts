import { test, expect, type Locator } from '@playwright/test';
import {
  addCard,
  card,
  column,
  createBoardViaUi,
  dragAnnouncement,
  dragCardWithKeyboard,
  dragOverlay,
  newUser,
  registerViaApi,
} from './helpers';

async function xOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.x;
}

test('mover tarjetas (reordenar y cambiar de columna) y que el orden persista', async ({
  page,
}, testInfo) => {
  await registerViaApi(page, newUser(testInfo, 'Grace'));
  await createBoardViaUi(page, 'Sprint');
  await addCard(page, 'Por hacer', 'Primera');
  await addCard(page, 'Por hacer', 'Segunda');
  await addCard(page, 'Por hacer', 'Tercera');

  await test.step('reordenar dentro de la columna', async () => {
    const segundaX = await xOf(card(page, 'Segunda'));
    await dragCardWithKeyboard(page, 'Primera', 'ArrowRight', async () => {
      // La copia flotante ya está sobre el hueco de "Segunda".
      await expect
        .poll(async () => Math.abs((await xOf(dragOverlay(page, 'Primera'))) - segundaX))
        .toBeLessThan(2);
    });
    expect(await xOf(card(page, 'Segunda'))).toBeLessThan(await xOf(card(page, 'Primera')));
  });

  await test.step('mover a la columna siguiente', async () => {
    await dragCardWithKeyboard(page, 'Tercera', 'ArrowDown', async () => {
      await expect(dragAnnouncement(page, 'Tercera', 'En curso')).toBeAttached();
    });
    await expect(column(page, 'En curso').getByRole('button', { name: 'Tercera' })).toBeVisible();
  });

  await test.step('tras recargar, el orden y la columna se mantienen', async () => {
    await page.reload();
    const porHacer = column(page, 'Por hacer');
    await expect(porHacer.getByRole('button', { name: 'Primera' })).toBeVisible();
    expect(await xOf(card(page, 'Segunda'))).toBeLessThan(await xOf(card(page, 'Primera')));
    await expect(porHacer.getByRole('button', { name: 'Tercera' })).toHaveCount(0);
    await expect(column(page, 'En curso').getByRole('button', { name: 'Tercera' })).toBeVisible();
  });
});
