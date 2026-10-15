// Estado de apagado compartido: /api/ready deja de responder 200 en cuanto
// empieza el apagado ordenado, para que un balanceador deje de enviar tráfico.
let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}

// Solo para tests.
export function resetLifecycleForTests(): void {
  shuttingDown = false;
}
