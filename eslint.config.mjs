import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTsConfig from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTsConfig,
  globalIgnores([
    '.next/**',
    '.claude/**',
    'out/**',
    'build/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
    '**/*.cjs',
    '**/*.js',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
