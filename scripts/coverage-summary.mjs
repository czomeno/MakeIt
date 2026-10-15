#!/usr/bin/env node
// Convierte coverage/coverage-summary.json (reporter "json-summary" de Jest y
// Vitest) en una tabla Markdown para el resumen del job en GitHub Actions.
// Uso: node scripts/coverage-summary.mjs <server|client>
import { readFileSync } from 'node:fs';

const pkg = process.argv[2];
if (!pkg) {
  console.error('Uso: node scripts/coverage-summary.mjs <server|client>');
  process.exit(2);
}

let total;
try {
  total = JSON.parse(readFileSync(`${pkg}/coverage/coverage-summary.json`, 'utf8')).total;
} catch {
  console.log(`### Cobertura de \`${pkg}\`\n\nNo se generó el informe de cobertura.`);
  process.exit(0);
}

const rows = ['lines', 'statements', 'functions', 'branches'].map((metric) => {
  const { pct, covered, total: count } = total[metric];
  return `| ${metric} | ${pct.toFixed(1)} % | ${covered}/${count} |`;
});

console.log(
  [
    `### Cobertura de \`${pkg}\``,
    '',
    '| Métrica | % | Cubierto |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n'),
);
