// dueDate llega como medianoche UTC del día elegido ("2024-10-16T00:00:00Z"),
// así que se compara y se muestra por la parte de fecha, en UTC: en América
// un toLocaleDateString sin zona lo pintaría como el día anterior.

export function dueDay(iso: string): string {
  return iso.slice(0, 10);
}

export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// "16 oct"
export function formatDueDate(iso: string): string {
  return new Date(`${dueDay(iso)}T00:00:00Z`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
