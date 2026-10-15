// Solo sobre los archivos en staging, para que el pre-commit tarde segundos.
// ESLint se ejecuta con la configuración (y las dependencias) de cada paquete;
// los tests completos NO van aquí (los ejecuta el CI).
const quote = (files) => files.map((file) => JSON.stringify(file)).join(' ');

const eslintIn = (pkg) => (files) =>
  `${pkg}/node_modules/.bin/eslint --config ${pkg}/eslint.config.js --fix --max-warnings=0 ${quote(files)}`;

export default {
  'server/**/*.ts': [eslintIn('server'), 'prettier --write'],
  'client/**/*.{ts,tsx}': [eslintIn('client'), 'prettier --write'],
  '*.{js,cjs,mjs,json,md,yml,yaml,css,html}': 'prettier --write',
};
