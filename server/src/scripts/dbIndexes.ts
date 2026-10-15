// npm run db:indexes [-- --env-file ../.env.atlas.local]
//
// Crea (si faltan) y verifica los índices de todas las colecciones. Es
// idempotente: se puede ejecutar tantas veces como haga falta. La API también
// los crea al arrancar (autoIndex de Mongoose); este script sirve para el
// primer despliegue y para COMPROBAR que existen los que importan.
import { connectOrExit, loadEnvFileFromArgs } from './cli.js';

loadEnvFileFromArgs();

const { default: mongoose } = await import('mongoose');
await Promise.all([
  import('../models/User.js'),
  import('../models/Board.js'),
  import('../models/Column.js'),
  import('../models/Card.js'),
  import('../models/Invitation.js'),
  import('../models/RefreshToken.js'),
  import('../models/Activity.js'),
]);

interface ExpectedIndex {
  collection: string;
  description: string;
  matches: (index: Record<string, unknown>) => boolean;
}

const keyOf = (index: Record<string, unknown>) => JSON.stringify(index.key);

// Los que, si faltan, rompen garantías: unicidad de emails e invitaciones
// pendientes, y limpieza automática (TTL) de refresh tokens y actividad. Las
// invitaciones NO tienen TTL a propósito: caducan por fecha y se marcan como
// "expired" al usarse, para que un enlace viejo diga "ha caducado".
const EXPECTED: ExpectedIndex[] = [
  {
    collection: 'users',
    description: 'email único',
    matches: (i) => keyOf(i) === '{"email":1}' && i.unique === true,
  },
  {
    collection: 'invitations',
    description: 'una invitación pendiente por email y tablero (único parcial)',
    matches: (i) =>
      keyOf(i) === '{"board":1,"email":1}' && i.unique === true && !!i.partialFilterExpression,
  },
  {
    collection: 'refreshtokens',
    description: 'TTL por expiresAt',
    matches: (i) => keyOf(i) === '{"expiresAt":1}' && i.expireAfterSeconds === 0,
  },
  {
    collection: 'activities',
    description: 'TTL de 180 días por createdAt',
    matches: (i) => keyOf(i) === '{"createdAt":1}' && typeof i.expireAfterSeconds === 'number',
  },
  {
    collection: 'cards',
    description: 'orden de tarjetas por columna',
    matches: (i) => keyOf(i) === '{"column":1,"position":1}',
  },
];

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('Falta MONGO_URI (usa --env-file <ruta> o exporta la variable).');
  process.exit(1);
}

await connectOrExit(mongoose, uri, { autoIndex: false });

try {
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).createIndexes();
  }

  let missing = 0;
  for (const name of mongoose.modelNames()) {
    const collection = mongoose.model(name).collection;
    const indexes = (await collection.indexes()) as Record<string, unknown>[];
    console.log(`\n${collection.collectionName}`);
    for (const index of indexes) {
      const extras = [
        index.unique ? 'único' : '',
        index.partialFilterExpression ? 'parcial' : '',
        typeof index.expireAfterSeconds === 'number' ? `TTL ${index.expireAfterSeconds}s` : '',
      ].filter(Boolean);
      console.log(`  - ${keyOf(index)}${extras.length ? ` (${extras.join(', ')})` : ''}`);
    }
    for (const expected of EXPECTED.filter((e) => e.collection === collection.collectionName)) {
      const ok = indexes.some(expected.matches);
      if (!ok) missing += 1;
      console.log(`  ${ok ? '✔' : '✖'} ${expected.description}`);
    }
  }

  if (missing > 0) {
    console.error(`\nFaltan ${missing} índice(s) esperados.`);
    process.exitCode = 1;
  } else {
    console.log('\nTodos los índices esperados existen.');
  }
} finally {
  await mongoose.disconnect();
}
