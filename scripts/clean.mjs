import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const generatedTargets = ['dist', 'server.js'];

for (const target of generatedTargets) {
  const absoluteTarget = resolve(projectRoot, target);
  if (!absoluteTarget.startsWith(`${projectRoot}\\`) && absoluteTarget !== projectRoot) {
    throw new Error(`Target pembersihan keluar dari workspace: ${absoluteTarget}`);
  }
  rmSync(absoluteTarget, { recursive: true, force: true });
}

console.log(`Output build dibersihkan: ${generatedTargets.join(', ')}`);
