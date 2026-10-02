import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex } from './catalog.mjs';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
if (args.some((arg) => !['--reverse', '--write'].includes(arg)) || new Set(args).size !== args.length) {
  throw new Error('Usage: cli.mjs [--reverse] [--write]; stdout JSON, --write also updates reference-cards/index.json');
}
const inputBindings = new Map();
const readInput = (relative) => {
  const fullPath = realpathSync(path.resolve(lab, relative));
  if (!fullPath.startsWith(`${realpathSync(lab)}${path.sep}`)) {
    throw new Error(`Input escaped own Lab: ${relative}`);
  }
  const bytes = readFileSync(fullPath);
  inputBindings.set(relative, { path: relative, byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes;
};
const filenames = readdirSync(path.join(lab, 'reference-cards')).filter((name) => /^RR-\d{2}\.json$/.test(name)).sort();
if (args.includes('--reverse')) {
  filenames.reverse();
}
const cards = filenames.map((name) => JSON.parse(readInput(`reference-cards/${name}`)));
const concepts = JSON.parse(readInput('reference-cards/concepts.json'));
const sources = JSON.parse(readInput('docs/coordination/input-package/sources/web_sources.json')).sources
  .filter((source) => source.id.startsWith('RR-'));
for (const entry of [...cards, concepts]) {
  for (const binding of Object.values(entry.sourceRef)) {
    if (binding && typeof binding === 'object' && binding.path && binding.sha256) {
      const bytes = readInput(binding.path);
      if (createHash('sha256').update(bytes).digest('hex') !== binding.sha256) {
        throw new Error(`Source byte binding mismatch: ${entry.id}: ${binding.path}`);
      }
    }
  }
}
const index = { ...buildIndex({ cards, concepts, sources }),
  inputBindings: [...inputBindings.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
const output = `${JSON.stringify(index, null, 2)}\n`;
if (args.includes('--write')) {
  const target = path.join(lab, 'reference-cards/index.json');
  // Existing output must not redirect this explicitly owned write through a link.
  if (realpathSync(path.dirname(target)) !== path.dirname(target)
    || (readdirSync(path.dirname(target)).includes('index.json') && realpathSync(target) !== target)) {
    throw new Error('Index output is not an own regular path');
  }
  writeFileSync(target, output);
}
process.stdout.write(output);
process.exitCode = index.issues.length === 0 ? 0 : 1;
