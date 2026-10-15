import { config as loadDotenv } from 'dotenv';

// Utilidades de los scripts de operación (db:indexes, seed:demo), pensados
// para ejecutarse a mano desde tu ordenador contra la base de datos de
// producción. `--env-file <ruta>` carga la configuración de un archivo LOCAL
// (ignorado por git) con prioridad sobre el .env de desarrollo: así los
// secretos de producción no pasan por la terminal ni por el historial.
export function loadEnvFileFromArgs(argv = process.argv.slice(2)): void {
  const index = argv.indexOf('--env-file');
  const inline = argv.find((arg) => arg.startsWith('--env-file='));
  const file = inline ? inline.split('=')[1] : index !== -1 ? argv[index + 1] : undefined;
  if (!file) {
    return;
  }
  const result = loadDotenv({ path: file, override: true });
  if (result.error) {
    console.error(`No se pudo leer ${file}: ${result.error.message}`);
    process.exit(1);
  }
}

// Muestra el host al que se conecta, nunca la cadena completa (lleva la contraseña).
export function describeMongoUri(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '(MONGO_URI no válida)';
  }
}

// Conexión de un script: falla rápido y con un mensaje legible (nada de volcar
// la traza del driver), con las causas más habituales al apuntar a Atlas.
export async function connectOrExit(
  mongoose: typeof import('mongoose').default,
  uri: string,
  options: import('mongoose').ConnectOptions = {},
): Promise<void> {
  console.log(`Conectando a ${describeMongoUri(uri)} ...`);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, ...options });
  } catch (error) {
    console.error(`No se pudo conectar: ${(error as Error).message}`);
    console.error(
      'Revisa: la cadena MONGO_URI (usuario y contraseña), que tu IP esté permitida en ' +
        'Atlas (Network Access) y que el clúster esté activo.',
    );
    process.exit(1);
  }
}
