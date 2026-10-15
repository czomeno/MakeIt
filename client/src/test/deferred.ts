// Promesa que el test resuelve a mano. Sirve para "congelar" una respuesta de
// MSW y comprobar el estado intermedio (p. ej. la UI optimista) sin depender
// de retardos fijos.
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
