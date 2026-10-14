// Seed opcional de desarrollo: un usuario demo y un tablero de ejemplo.
// Uso: npm run seed
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { User } from './models/User.js';
import { hashPassword } from './utils/password.js';
import * as boardsService from './services/boards.service.js';
import * as columnsService from './services/columns.service.js';
import * as cardsService from './services/cards.service.js';

const DEMO_EMAIL = 'demo@makeit.test';
const DEMO_PASSWORD = 'demo123456';

async function seed(): Promise<void> {
  await connectDB(env.MONGO_URI);

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    user = await User.create({ name: 'Usuario Demo', email: DEMO_EMAIL, passwordHash });
    console.log(`Usuario demo creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`Usuario demo ya existía: ${DEMO_EMAIL}`);
  }

  const board = await boardsService.create(user._id.toString(), {
    title: 'Búsqueda de empleo',
    description: 'Tablero de ejemplo generado por npm run seed',
    template: 'job-applications',
  });
  console.log(`Tablero creado: "${board.title}" (${board._id.toString()})`);

  const content = await boardsService.getWithContent(board._id.toString());
  const primeraColumna = content.columns[0];
  if (primeraColumna) {
    const column = await columnsService.create(
      board._id.toString(),
      { title: 'Observaciones' },
      user._id.toString(),
    );
    await cardsService.create(
      board._id.toString(),
      primeraColumna._id.toString(),
      { title: 'Candidatura de ejemplo', company: 'Acme Inc.', jobUrl: 'https://example.com/empleos/1' },
      user._id.toString(),
    );
    console.log(`Columna extra "${column.title}" y tarjeta de ejemplo creadas`);
  }

  await disconnectDB();
  console.log('Seed completado.');
}

seed().catch((error: unknown) => {
  console.error('Error al ejecutar el seed:', error);
  process.exit(1);
});
