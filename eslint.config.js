import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'server/**', '*.config.*', 'src/components/ui/ds/Tooltip.tsx'],
  }
)
