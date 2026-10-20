import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', '.astro/', 'rust/', 'src/kernel/kernel.wasm.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Build scripts and the Astro config run in Node.
    files: ['scripts/**/*.mjs', 'astro.config.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    rules: {
      // Unused arguments are allowed when prefixed with _ (interface conformance).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Canvas code returns early from expression statements like `x === 0 ? moveTo : lineTo`.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },
);
