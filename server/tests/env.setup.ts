// Se carga antes de cualquier test: config/env.ts valida estas variables al
// importarse, así que deben existir antes de importar createApp() en los tests.
// dotenv no sobrescribe variables ya definidas, por eso basta con asignarlas aquí.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/makeit-test-placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-for-production-use';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-production';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.BCRYPT_ROUNDS = '4';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.PORT = '4000';
