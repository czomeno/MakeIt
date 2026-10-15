// npm run seed:demo [-- --env-file ../.env.atlas.local]
//
// Crea (o actualiza) un usuario de demostración y un tablero de ejemplo. Solo
// se ejecuta a mano, NUNCA al arrancar la API. La contraseña sale de
// DEMO_USER_PASSWORD, nunca del código. Idempotente: si el tablero de demo ya
// existe no se duplica; si cambias DEMO_USER_PASSWORD, se actualiza.
import { connectOrExit, loadEnvFileFromArgs } from './cli.js';

loadEnvFileFromArgs();

const DEMO_BOARD_TITLE = 'Tablero de demostración';
const email = (process.env.DEMO_USER_EMAIL ?? 'demo@makeit.app').toLowerCase();
const password = process.env.DEMO_USER_PASSWORD;

if (!password || password.length < 12) {
  console.error('Define DEMO_USER_PASSWORD (mínimo 12 caracteres) para crear el usuario demo.');
  process.exit(1);
}

// Importados después de cargar el entorno: config/env.ts valida al importarse.
const { default: mongoose } = await import('mongoose');
const { env } = await import('../config/env.js');
const { User } = await import('../models/User.js');
const { Board } = await import('../models/Board.js');
const { hashPassword } = await import('../utils/password.js');
const boardsService = await import('../services/boards.service.js');
const cardsService = await import('../services/cards.service.js');

await connectOrExit(mongoose, env.MONGO_URI);

try {
  const passwordHash = await hashPassword(password);
  let user = await User.findOne({ email });
  if (user) {
    user.passwordHash = passwordHash;
    await user.save();
    console.log(`Usuario demo existente (${email}): contraseña actualizada.`);
  } else {
    user = await User.create({ name: 'Usuario Demo', email, passwordHash });
    console.log(`Usuario demo creado: ${email}`);
  }
  const userId = user._id.toString();

  const existing = await Board.findOne({ owner: user._id, title: DEMO_BOARD_TITLE });
  if (existing) {
    console.log(`El tablero de demo ya existe (${existing._id.toString()}): no se duplica.`);
  } else {
    const board = await boardsService.create(userId, {
      title: DEMO_BOARD_TITLE,
      description: 'Tablero de ejemplo para probar MakeIt.',
      template: 'job-applications',
    });
    const boardId = board._id.toString();
    const { columns } = await boardsService.getWithContent(boardId);
    const examples = [
      { title: 'Desarrollador/a frontend', company: 'Acme Inc.' },
      { title: 'Full-stack junior', company: 'Globex' },
    ];
    for (const [index, example] of examples.entries()) {
      const column = columns[index];
      if (column) {
        await cardsService.create(boardId, column._id.toString(), example, userId);
      }
    }
    console.log(`Tablero de demo creado: "${DEMO_BOARD_TITLE}" (${boardId}).`);
  }
} finally {
  await mongoose.disconnect();
}
