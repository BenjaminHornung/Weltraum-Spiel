import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(resolve(root, 'source-manifest.json'), 'utf8'));
const verifyEntry = (entry, bytes) => {
  assert.equal(bytes.length, entry.bytes, `Control size: ${entry.snapshotPath}`);
  assert.equal(digest(bytes), entry.sha256, `Control digest: ${entry.snapshotPath}`);
};
for (const entry of manifest.entries) verifyEntry(entry, readFileSync(resolve(root, entry.snapshotPath)));
assert.match(process.execPath.replaceAll('\\', '/'), /^C:\/IFI_SourceCode\//i, 'Run only an approved binary under C:/IFI_SourceCode');
assert.match(process.version, /^v22\./, 'Use the pinned Node22 runtime');
if (process.argv.includes('--self-test')) {
  const entry = manifest.entries[0];
  const bytes = readFileSync(resolve(root, entry.snapshotPath));
  assert.throws(() => verifyEntry({ ...entry, sha256: '0'.repeat(64) }, bytes), /Control digest/);
  console.log('REPRO_SELF_TEST_PASS: exact controls accepted, tampered digest rejected');
} else {
  const temp = resolve(root, 'node_modules/.tmp');
  const output = resolve(root, 'node_modules/.repro');
  mkdirSync(temp, { recursive: true }); mkdirSync(output, { recursive: true });
  const env = { ...process.env, TMP: temp, TEMP: temp, PATH: dirname(process.execPath) + ';' + process.env.PATH };
  const checks = [];
  for (const [name, args] of [
    ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
    ['build', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json']],
    ['unit', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1']]
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: root, env, timeout: 60000, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const exitCode = result.status ?? 255;
    writeFileSync(resolve(output, name + '.txt'), (result.stdout ?? '') + (result.stderr ?? '') + (result.error?.message ?? ''));
    checks.push({ name, args, exitCode, status: exitCode === 0 ? 'PASS' : 'FAIL' });
    console.log(`${name}: exit ${exitCode}`);
    if (exitCode !== 0) break;
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ environment: 'LOCAL_WINDOWS_ISOLATED', controlCount: manifest.entries.length, checks }, null, 2));
  process.exitCode = checks.length === 3 && checks.every(check => check.exitCode === 0) ? 0 : 1;
}
