// @ts-check
import path from 'path';

import typescript from '@rollup/plugin-typescript';
import ttypescript from 'ttypescript';

import pkg from './package.json';

const banner = `/*!
  ${pkg.name} v${pkg.version}
  ${pkg.homepage}
  Released under the ${pkg.license} License.
*/`;

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
      banner,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: 'inline',
      banner,
    },
  ],
  plugins: [
    typescript({
      tsconfig: path.resolve(__dirname, './tsconfig.json'),
      declaration: true,
      declarationDir: 'types',
      typescript: ttypescript,
    }),
  ],
};

export default [config];
