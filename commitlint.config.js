// Conventional Commits: <tipo>(<ámbito opcional>): <descripción>
// p. ej. "feat(client): arrastrar columnas con el teclado". Lo valida el hook
// commit-msg de Husky; ver CONTRIBUTING.md.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Los mensajes van en español: no forzar minúscula/mayúscula en el asunto.
    'subject-case': [0],
    'scope-enum': [1, 'always', ['server', 'client', 'e2e', 'ci', 'docker', 'deps', 'docs']],
  },
};
