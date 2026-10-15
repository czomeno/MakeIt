import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pwaMock } from '../test/pwaRegisterMock';
import { UpdatePrompt } from './UpdatePrompt';

afterEach(() => pwaMock.reset());

describe('UpdatePrompt', () => {
  it('sin versión nueva no muestra nada', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('con versión nueva avisa y "Recargar" activa el service worker nuevo', async () => {
    pwaMock.needRefresh = true;
    const user = userEvent.setup();
    render(<UpdatePrompt />);

    expect(
      screen.getByRole('alertdialog', { name: 'Hay una versión nueva de MakeIt.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(pwaMock.updateCalls).toEqual([true]);
  });

  it('"Más tarde" cierra el aviso sin recargar', async () => {
    pwaMock.needRefresh = true;
    const user = userEvent.setup();
    render(<UpdatePrompt />);

    await user.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(pwaMock.updateCalls).toEqual([]);
  });
});
