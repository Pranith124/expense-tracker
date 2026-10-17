import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
console.log('VERCEL DIRECTORY:', process.cwd());
console.log('PROJECT ROOT:', projectRoot);
console.log('VERCEL ROOT DIRECTORY:', process.env.VERCEL_ROOT_DIRECTORY || '(not set)');
console.log('FILES:', readdirSync(process.cwd()));
for (const directory of new Set([resolve('dist'), resolve('../dist'), resolve(projectRoot, 'dist')])) {
  console.log('OUTPUT CHECK:', directory, 'index.html exists:', existsSync(resolve(directory, 'index.html')));
}
