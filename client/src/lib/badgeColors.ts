// Colores deterministas por texto: el mismo texto siempre cae en el mismo
// color, sin guardar nada ni añadir un campo de "color" al modelo de datos.
const PILL_COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'gray'] as const;
export type PillColor = (typeof PILL_COLORS)[number];

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-slate-500',
] as const;

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pillColorFor(text: string): PillColor {
  const index = hashText(text.trim().toLowerCase()) % PILL_COLORS.length;
  return PILL_COLORS[index] as PillColor;
}

// Clases completas y literales por color (no interpoladas): Tailwind solo
// genera CSS para clases que aparecen como texto literal en el código, así
// que una plantilla tipo `bg-pill-${color}` no funcionaría.
const PILL_CLASSES: Record<PillColor, string> = {
  blue: 'bg-pill-blue text-pill-blue-ink',
  green: 'bg-pill-green text-pill-green-ink',
  amber: 'bg-pill-amber text-pill-amber-ink',
  red: 'bg-pill-red text-pill-red-ink',
  purple: 'bg-pill-purple text-pill-purple-ink',
  gray: 'bg-pill-gray text-pill-gray-ink',
};

export function pillClassesFor(text: string): string {
  return PILL_CLASSES[pillColorFor(text)];
}

export function avatarColorFor(text: string): string {
  const index = hashText(text.trim().toLowerCase()) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] as string;
}

// Botón de categoría (vista de lista): mismo color de fondo que la pill de
// esa categoría en todo momento; el estado activo se marca con un anillo en
// vez de un color distinto, para no tener que mantener una segunda paleta
// "sólida" por tema claro/oscuro.
export function categoryButtonClasses(text: string, isActive: boolean): string {
  const base = `${PILL_CLASSES[pillColorFor(text)]} border border-transparent`;
  return isActive
    ? `${base} ring-2 ring-accent ring-offset-1 ring-offset-surface font-semibold`
    : `${base} opacity-60 hover:opacity-100`;
}
