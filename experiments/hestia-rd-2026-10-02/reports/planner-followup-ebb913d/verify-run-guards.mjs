import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), id = process.argv[2];
assert(/^[a-z0-9-]+$/.test(id ?? '')); const run = path.join(own, 'runs', id); mkdirSync(run);
const existing = ['focused-units-01.json', 'focused-units-03/report.json', 'ray-original-assertions-01/report.json'];
const hashes = () => existing.map(p => createHash('sha256').update(readFileSync(path.join(own, 'runs', p))).digest('hex'));
const before = hashes(), cases = [];
for (const [config, runId, error] of [
  ['vitest', null, /fresh HESTIA_FOLLOWUP_RUN_ID/], ['playwright', null, /fresh HESTIA_FOLLOWUP_RUN_ID/],
  ['vitest', 'focused-units-01', /prior single-file run/], ['vitest', 'focused-units-03', /EEXIST/],
  ['playwright', 'ray-original-assertions-01', /EEXIST/]]) {
  const env = { ...process.env, HESTIA_FOLLOWUP_SUITE: 'ray' }; delete env.TEST_WORKER_INDEX;
  if (runId) env.HESTIA_FOLLOWUP_RUN_ID = runId; else delete env.HESTIA_FOLLOWUP_RUN_ID;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    'await import(' + JSON.stringify(new URL('./' + config + '.followup.config.mjs', import.meta.url).href) + ')'],
    { cwd: own, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, error);
  cases.push({ config, runId, status: 'PASS', exit: result.status, error: result.stderr });
}
assert.deepEqual(hashes(), before, 'An existing evidence file changed');
writeFileSync(path.join(run, 'report.json'), JSON.stringify({ runId: id, cases,
  existing, before, after: hashes(), unchanged: true, productIntegrated: false }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runId: id, passed: cases.length, unchanged: true }));
