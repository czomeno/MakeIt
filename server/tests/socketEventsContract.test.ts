import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// El cliente no puede importar código del servidor en el build de Vite, así
// que el contrato de eventos de socket (server/src/socket/events.ts) se
// duplica literalmente en client/src/socket/events.ts. Este test falla si
// alguien edita uno de los dos archivos sin replicar el cambio en el otro.
describe('contrato de eventos de socket', () => {
  it('server/src/socket/events.ts y client/src/socket/events.ts son idénticos', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const serverFile = readFileSync(path.resolve(dir, '../src/socket/events.ts'), 'utf8');
    const clientFile = readFileSync(
      path.resolve(dir, '../../client/src/socket/events.ts'),
      'utf8',
    );
    expect(clientFile).toBe(serverFile);
  });
});
