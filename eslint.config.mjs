import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      // `ignoreRestSiblings` cobre o idioma de omitir campo por destructuring
      // (`const { id: _drop, ...row } = x`), que o repo usa de propósito em
      // report-drafts.ts. Sem isso, o único aviso do projeto derrubava
      // `npm run lint --max-warnings=0` e portanto o gate inteiro do CI.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/report/*.tsx'],
    rules: {
      'jsx-a11y/alt-text': 'off',
    },
  },
  {
    files: ['src/components/news/NewsPage.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**']),
])
