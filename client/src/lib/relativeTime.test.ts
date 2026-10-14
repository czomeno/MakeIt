import { describe, it, expect } from 'vitest';
import { relativeTimeFromNow } from './relativeTime';

describe('relativeTimeFromNow', () => {
  const now = new Date('2024-06-15T12:00:00.000Z').getTime();

  it('dice "justo ahora" para menos de un minuto', () => {
    expect(relativeTimeFromNow(new Date(now - 30_000).toISOString(), now)).toBe('justo ahora');
  });

  it('muestra minutos entre 1 minuto y 1 hora', () => {
    expect(relativeTimeFromNow(new Date(now - 5 * 60_000).toISOString(), now)).toBe('hace 5 min');
  });

  it('muestra horas entre 1 hora y 1 día', () => {
    expect(relativeTimeFromNow(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('hace 3 h');
  });

  it('muestra días entre 1 día y 1 semana', () => {
    expect(relativeTimeFromNow(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('hace 2 d');
  });

  it('muestra una fecha a partir de una semana', () => {
    const result = relativeTimeFromNow(new Date(now - 10 * 86_400_000).toISOString(), now);
    expect(result).not.toMatch(/^hace/);
  });
});
