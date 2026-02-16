import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTsConfig from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTsConfig,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'api/**',
    '**/*.cjs',
    '**/*.js',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
