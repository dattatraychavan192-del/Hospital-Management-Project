import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRuntime = join(clientRoot, 'node_modules', '@babel', 'runtime');
const helper = join(localRuntime, 'helpers', 'esm', 'asyncToGenerator.js');
if (existsSync(helper)) process.exit(0);

const rootRuntime = join(clientRoot, '..', 'node_modules', '@babel', 'runtime');
if (!existsSync(join(rootRuntime, 'helpers', 'esm', 'asyncToGenerator.js'))) {
  throw new Error('The @babel/runtime test helper is missing. Run npm install from the repository root.');
}
mkdirSync(join(clientRoot, 'node_modules', '@babel'), { recursive: true });
cpSync(rootRuntime, localRuntime, { recursive: true });
