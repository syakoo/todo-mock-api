// @ts-check
import path from 'path';

import typescript from '@rollup/plugin-typescript';

import pkg from './package.json';

console.log(pkg.main);
/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: path.resolve(__dirname, 'src/index.ts'),
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: 'inline',
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: 'inline',
    },
  ],
  plugins: [
    typescript({
      tsconfig: path.resolve(__dirname, './tsconfig.json'),
      declaration: true,
      declarationDir: 'types',
    }),
  ],
};

export default [config];
