import { MongoMemoryServer } from 'mongodb-memory-server';

// Un único mongod para toda la suite (en vez de uno por archivo de test):
// arrancar 13 a la vez en una máquina cargada era fuente de fallos
// intermitentes. Cada archivo usa su propia base de datos (ver helpers/db.ts),
// así que siguen aislados entre sí aunque corran en paralelo.
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  // Los workers de Jest se crean después y heredan esta variable.
  process.env.MONGO_TEST_URI = mongod.getUri();
}
