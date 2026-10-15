import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

// Conecta a una base de datos nueva y exclusiva de este archivo de test, en el
// mongod compartido que arranca tests/globalSetup.js.
export async function connectTestDB(): Promise<void> {
  const uri = process.env.MONGO_TEST_URI;
  if (!uri) {
    throw new Error('MONGO_TEST_URI no definida: ¿se ha ejecutado tests/globalSetup.js?');
  }
  await mongoose.connect(uri, { dbName: `test-${randomUUID()}` });
  // Mongoose crea los índices (p. ej. el `unique` del email) en segundo plano
  // al conectar. Se espera a que existan: si no, el primer test del archivo
  // podría ejecutarse antes y no ver, por ejemplo, el conflicto de un email
  // duplicado.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function clearTestDB(): Promise<void> {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
}

export async function closeTestDB(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}
