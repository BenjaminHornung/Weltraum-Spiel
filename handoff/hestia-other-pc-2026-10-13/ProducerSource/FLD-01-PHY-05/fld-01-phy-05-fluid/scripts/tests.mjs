import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, verifyBuild } from './bindings.mjs';

verifyBuild();
// One process and node:test's default serial execution; no extra test-worker wave.
for (const name of readdirSync(resolve(root, 'tests')).filter(x => x.endsWith('.test.mjs')).sort()) await import(pathToFileURL(resolve(root, 'tests', name)));
