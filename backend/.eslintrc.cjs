module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: { node: true, es2020: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  rules: {
    // TypeScript checks names; core no-undef misidentifies type declarations.
    'no-undef': 'off',
    'no-unused-vars': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
