export function greetingFor(hour: number): string {
  if (hour < 6) return 'Buenas noches';
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function greetingNow(): string {
  return greetingFor(new Date().getHours());
}
