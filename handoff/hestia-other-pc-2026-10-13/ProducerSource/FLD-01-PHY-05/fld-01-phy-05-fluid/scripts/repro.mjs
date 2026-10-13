import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, verifyBuild, fileBinding } from './bindings.mjs';

const nameAt = process.argv.indexOf('--run-id');
const runId = nameAt >= 0 ? process.argv[nameAt + 1] : undefined;
if (!runId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(runId)) throw Error('USE_UNIQUE_RUN_ID');
const evidenceRoot = resolve(root, '../../.devtoolbox/specs/changes/fld-01-phy-05-2026-10-09/tests');
mkdirSync(evidenceRoot, { recursive: true });
const destination = resolve(evidenceRoot, runId);
mkdirSync(destination); // Never overwrite an existing raw run.
const records = [];
const runs = [['binding-check', 'scripts/register-bindings.mjs', '--check'], ['build', 'scripts/build.mjs'], ['tests', 'scripts/tests.mjs'], ['basin', 'scripts/run-basin.mjs'],
  ['cave', 'scripts/run-cave.mjs'], ['pipe-hidden', 'scripts/run-pipe.mjs'], ['pipe-projection', 'scripts/run-pipe.mjs', '--show-projection'], ['salva-source', 'scripts/check-salva.mjs']];
let failed = false;
for (const [name, ...args] of runs) {
  const result = spawnSync(process.execPath, args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  const log = (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? '\nPROCESS_ERROR:' + result.error.code : '');
  writeFileSync(resolve(destination, name + '.log'), log, { flag: 'wx' });
  records.push({ name, command: [process.execPath, ...args], exitCode: result.status, signal: result.signal,
    status: result.status === 0 ? 'PASS' : 'FAIL', log: fileBinding(name + '.log', destination) });
  if (result.status !== 0) { failed = true; break; }
}
let particleParity = 'NOT_RUN';
if (!failed) {
  const hidden = JSON.parse(readFileSync(resolve(destination, 'pipe-hidden.log'))), shown = JSON.parse(readFileSync(resolve(destination, 'pipe-projection.log')));
  if (hidden.authorityDigest !== shown.authorityDigest) { particleParity = 'FAIL'; failed = true; }
  else particleParity = 'PASS_SAME_AUTHORITY_BYTES';
}
const build = failed ? null : verifyBuild();
const summary = { schema: 'fluid-repro/v1', runId, status: failed ? 'FAIL' : 'PASS', exitCode: failed ? 1 : 0, environment: 'LOCAL_WINDOWS_ISOLATED',
  productIntegration: 'NO', hardware: 'NOT_RUN', caveDomain: 'UNSUPPORTED', particleParity, hostLoad: 'UNCONTROLLED_CONCURRENT_SESSIONS',
  actualAdapter: 'NOT_REQUESTED_CPU_ONLY', gpuTimer: 'NOT_REQUESTED', sourceDigest: build?.sourceDigest ?? null, outputDigest: build?.outputDigest ?? null,
  buildBindings: fileBinding('BuildBindings.json'), records };
writeFileSync(resolve(destination, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: summary.status, exitCode: summary.exitCode, particleParity, evidence: destination }));
process.exit(summary.exitCode);
