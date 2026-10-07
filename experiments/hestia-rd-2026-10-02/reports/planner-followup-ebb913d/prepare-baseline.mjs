import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), source = process.argv[2];
assert(source && path.isAbsolute(source), 'Pass the absolute unchanged ebb913d LAB directory');
const receipt = JSON.parse(readFileSync(path.join(own, 'runs/control-02-build.json')));
const expected = { ...receipt.sourceHashes,
  'tests/resume/fixtures.ts': '50876d5023aecc63326f66457113cca5fe2f07c830cb39710efe73b05e09a32b' };
const bytes = Object.entries(expected).map(([relative, digest]) => {
  assert(!relative.split('/').includes('..') && !path.isAbsolute(relative));
  const value = readFileSync(path.join(source, relative));
  assert.equal(createHash('sha256').update(value).digest('hex'), digest, relative);
  return [relative, value];
});
const destination = path.join(own, 'runtime/baseline'); mkdirSync(destination);
for (const [relative, value] of bytes) {
  const target = path.join(destination, relative); mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, { flag: 'wx' });
}
// Original package fixtures are validated again by the unchanged inventory/replay loaders.
cpSync(path.join(own, 'reproduction/package-01/fixtures'), path.join(destination, 'fixtures'),
  { recursive: true, force: false, errorOnExist: true });
console.log(JSON.stringify({ source, destination, hashBoundFiles: bytes.length,
  fixtureOrigin: receipt.fixtureOrigin, productIntegrated: false }));
