#!/usr/bin/env node
// Política de `npm audit` del CI (ver README, «Política de seguridad»):
// falla SOLO si hay vulnerabilidades altas o críticas que YA tienen una
// versión corregida (fixAvailable). Las que no tienen arreglo se listan como
// aviso, pero no bloquean: no hay nada que actualizar todavía y Dependabot
// abrirá el PR en cuanto exista la versión corregida.
//
// Uso: node scripts/audit-policy.mjs [directorio]   (por defecto, el actual)
import { execFileSync } from 'node:child_process';

const cwd = process.argv[2] ?? '.';
const BLOCKING = new Set(['high', 'critical']);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--json'], { cwd, encoding: 'utf8' });
} catch (error) {
  // npm audit sale con código != 0 si encuentra algo; el JSON va en stdout.
  raw = error.stdout;
  if (!raw) throw error;
}

const report = JSON.parse(raw);
const findings = Object.values(report.vulnerabilities ?? {}).filter((v) =>
  BLOCKING.has(v.severity),
);
const fixable = findings.filter((v) => v.fixAvailable !== false);
const unfixable = findings.filter((v) => v.fixAvailable === false);

const describe = (v) => `  - ${v.name} (${v.severity}) ${v.range}`;
if (unfixable.length > 0) {
  console.log(
    `⚠ ${cwd}: ${unfixable.length} alta(s)/crítica(s) SIN arreglo disponible (no bloquean):`,
  );
  console.log(unfixable.map(describe).join('\n'));
}
if (fixable.length > 0) {
  console.error(`✖ ${cwd}: ${fixable.length} alta(s)/crítica(s) CON arreglo disponible:`);
  console.error(fixable.map(describe).join('\n'));
  console.error('Ejecuta `npm audit fix` (o actualiza la dependencia) en ese paquete.');
  process.exit(1);
}
console.log(`✔ ${cwd}: sin vulnerabilidades altas/críticas con arreglo disponible.`);
