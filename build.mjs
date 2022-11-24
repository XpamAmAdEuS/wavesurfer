import { build } from 'esbuild';

const formats = [
  { name: 'esm', extension: 'mjs' },
];

/** @type {import('esbuild').BuildOptions} */
const config = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['esnext'],
  logLevel: 'info',
  entryPoints: ['src/index.ts'],
};

for (const { name, extension } of formats) {
  await build({ ...config, format: name, outfile: `./dist/index.${extension}` });
}
