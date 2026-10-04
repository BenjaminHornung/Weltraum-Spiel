import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admit, directory, lab, node, git, sha, ownBindings, BASE } from './run.mjs';
import { bound, files, json, regular, rehash, repo, commands as oldCommands, nativeOutput, buildRoot } from './phase2-support.mjs';
import { inspectBoundary } from '../../scripts/verify-boundary.mjs';

const START = '92de788c5f96447330435579ffa20818c81b79d8';
const TREE = 'c6d6344c3475138fb7c3a14ae80f8ffc15bae446';
const root = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/launcher-deadline-repair-92de788c-20261004-a';
const prefix = 'experiments/hestia-rd-2026-10-02/';
const launcher = 'reports/RD-12/phase2-launch.mjs';
const test = 'tests/RD-12/launcher-deadline.test.mjs';
const delta = [launcher, test, 'reports/RD-12/launcher-deadline-repair.mjs',
  'reports/RD-12/PLAN-LAUNCHER-DEADLINE-92de788c.md', 'reports/RD-12/HANDOFF-LAUNCHER-DEADLINE-92de788c-20261004-A.md'];
const [label, operation] = process.argv.slice(2);
assert.match(label ?? '', /^deadline-[a-z0-9-]+$/);
const command = `${root}/${label}`;
if (operation === 'snapshot') { admit(root, { owner: path.dirname(root) }); }
directory(root, root); admit(command, { owner: root }); directory(`${command}/temp`, root);
const fresh = (file, value) => {
  admit(file, { owner: root }); directory(path.dirname(file), root);
  writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: 'wx' });
};
const env = { ...process.env,
  PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
  TEMP: `${command}/temp`, TMP: `${command}/temp`, HESTIA_RD_TASK: 'RD-12' };
Object.assign(process.env, { PATH: env.PATH, TEMP: env.TEMP, TMP: env.TMP });
const gitBytes = (...args) => execFileSync(git, args, { cwd: lab, env, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const gitText = (...args) => gitBytes(...args).toString().trim();
const current = () => ({ head: gitText('rev-parse', 'HEAD'), tree: gitText('rev-parse', 'HEAD^{tree}') });
const started = new Date().toISOString(); const bindings = ownBindings();
fresh(`${command}/started.json`, { label, operation, started, cwd: lab, source: current(), bindings,
  binary: bound(node), script: bound(import.meta.filename), PATH: env.PATH, TEMP: env.TEMP,
  nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', productIntegrated: false });

function preservation() {
  const prior = json(`${oldCommands}/candidate-phase2-final-01.json`, 'cdd528a6be5082e4eb518169da0cd9a7314c71ad38b30547b49c16c37316eb5b');
  json(`${oldCommands}/closeout-phase2-final-01.json`, '585a66675105be5f1f129b88017359d6594861f95b60d27b74cfdff9442ade3d');
  const headProof = bound('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd12-native-head-92de788c.json');
  assert.equal(headProof.sha256, '2c4adf93c3ed18d6963c0bf68b05971e0e7b1c76077648c0c60f74b5cfd9c165');
  assert.equal(prior.evidenceCommit.head, START); assert.equal(prior.evidenceCommit.tree, TREE);
  assert.equal(prior.evidenceCommit.deltaPaths.length, 269); assert.equal(prior.ownBindings.length, 293);
  const original = gitBytes('show', `${START}:${prefix}${launcher}`);
  assert.equal(sha(original), prior.ownBindings.find((entry) => entry.path === launcher).sha256);
  rehash(prior.ownBindings.filter((entry) => entry.path !== launcher), lab);
  const source = prior.executedSource;
  assert.equal(source.source713.length, 713); rehash(source.source713, lab); rehash(source.shared18, lab);
  rehash(source.api33, path.join(lab, 'node_modules')); rehash(source.public429, buildRoot); rehash(source.build509, buildRoot);
  assert.deepEqual(files(buildRoot), [...source.build509].sort((a, b) => a.path.localeCompare(b.path)));
  const preflight = json(source.preflight.path, source.preflight.sha256);
  rehash(preflight.math3, path.join(lab, 'node_modules'));
  for (const entry of [...preflight.executables, ...preflight.packages, preflight.priorCandidate,
    preflight.freeze, preflight.lease, preflight.buildProof, preflight.repairProof]) {
    assert.equal(bound(entry.path).sha256, entry.sha256, entry.path);
  }
  assert.equal(sha(regular(path.join(lab, 'package-lock.json'), lab)), 'b550953c353dacbe7cc8f869fb28d66fdf85e2e2d85827d08dd9e8812fb40404');
  rehash(prior.retainedNativeFiles, nativeOutput); rehash(prior.retainedCommandFiles, oldCommands);
  for (const entry of [...prior.nativeResults, prior.inventory, prior.servedManifest, prior.sliceManifest, prior.cleanup.proof]) {
    assert.equal(bound(entry.path).sha256, entry.sha256, entry.path);
  }
  assert.equal(prior.localLfs.length, 84);
  for (const entry of prior.localLfs) {
    assert.equal(bound(entry.localObject.path).sha256, entry.oid);
    assert.equal(bound(path.join(repo, entry.path), repo).sha256, entry.oid);
    assert.equal(sha(gitBytes('show', `${START}:${entry.path}`)), sha(gitBytes('show', `HEAD:${entry.path}`)));
  }
  const slice = path.join(lab, 'reports/RD-12/phase2-slice-5e4c1b8f'); assert.equal(files(slice).length, 253);
  const boundary = inspectBoundary({ repoRoot: repo, task: 'RD-12', start: START, base: BASE });
  assert.equal(boundary.ok, true); assert.equal(boundary.inputHashesVerified, 52); assert.deepEqual(boundary.links, []);
  return { start: START, tree: TREE, headProof, priorCandidate: bound(`${oldCommands}/candidate-phase2-final-01.json`),
    priorCloseout: bound(`${oldCommands}/closeout-phase2-final-01.json`), executedSource: { start: source.start, tree: source.tree },
    source713: 713, preservedEvidence269ExceptLauncher: 268, shared18: 18, public429: 429, api33: 33,
    slice253: 253, localLfs84: 84, build509: 509, frozenLease: preflight.lease, frozenSnapshot: preflight.freeze,
    nativeResults: prior.nativeResults, sliceManifest: prior.sliceManifest, boundary,
    nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', qualification: 'UNCHANGED_FAIL_PARTIAL', productIntegrated: false };
}

function candidate() {
  const identity = current(); const precommit = operation === 'verify';
  if (precommit) { assert.equal(identity.head, START); assert.equal(identity.tree, TREE); }
  else { assert.equal(gitText('rev-parse', 'HEAD^'), START); }
  assert.equal(gitText('rev-parse', `${START}^{tree}`), TREE);
  assert.equal(gitText('branch', '--show-current'), 'feature/hestia-rd-rd12-2026-10-04');
  const entries = gitText('diff', '--no-renames', '--name-status', ...(precommit ? ['--cached', START] : [START, 'HEAD'])).split(/\r?\n/);
  const changed = entries.map((line) => {
    const [status, file] = line.split('\t'); assert.equal(status, file === `${prefix}${launcher}` ? 'M' : 'A'); return file;
  });
  assert.deepEqual([...changed].sort(), delta.map((file) => `${prefix}${file}`).sort());
  assert.equal(gitText('diff', '--name-only'), '');
  if (!precommit) { assert.equal(gitText('diff', '--cached', '--name-only'), ''); }
  assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all').split(/\r?\n/).filter((line) => line.startsWith('?? ')).join('\n'),
    '?? .opencode/throughput.jsonl\n?? .opencode/throughput.md');
  const original = regular(`${root}/original-launcher-92.mjs`, root).toString();
  const actual = regular(path.join(lab, launcher), lab).toString();
  const marker = 'const accepted = new Set();';
  assert.equal(actual.slice(0, actual.indexOf(marker)), original.slice(0, original.indexOf(marker)), 'Run/job timeout/receipt prefix unchanged');
  const checks = [];
  for (const [name, expected] of [['deadline-red-01', 1], ['deadline-green-01', 0], ['deadline-types-01', 0],
    ['deadline-roottypes-01', 0], ['deadline-syntax-01', 0], ['deadline-review-diff-01', 0], ['deadline-review-check-01', 0],
    ['deadline-guard-01', 0], ...(!precommit ? [['deadline-commit-01', 0], ['deadline-postguard-01', 0]] : [])]) {
    const receipt = json(`${root}/${name}/receipt.json`); assert.equal(receipt.exitCode, expected); assert.equal(receipt.timedOut, false);
    assert.equal(bound(receipt.raw.path).sha256, receipt.raw.sha256); assert.equal(receipt.nativeExecution, 'NOT_RUN_CONTROLLED_CPU_ONLY');
    for (const entry of receipt.bindings.filter((file) => /\.(?:mjs|ts)$/.test(file.path))) {
      const file = name === 'deadline-red-01' && entry.path === launcher ? `${root}/original-launcher-92.mjs` : path.join(lab, entry.path);
      assert.equal(bound(file).sha256, entry.sha256, `${name}: ${entry.path}`);
    }
    if (name === 'deadline-red-01' || name === 'deadline-green-01') {
      assert.equal(receipt.bindings.find((entry) => entry.path === test).sha256, bound(`${root}/deadline-test-seal.mjs`).sha256);
      assert.equal(receipt.tests.passed, name === 'deadline-red-01' ? 2 : 4); assert.equal(receipt.tests.failed, name === 'deadline-red-01' ? 2 : 0);
    }
    if (['deadline-review-diff-01', 'deadline-review-check-01', 'deadline-guard-01', 'deadline-commit-01', 'deadline-postguard-01'].includes(name)) {
      assert.deepEqual(receipt.bindings, bindings, name);
    }
    checks.push({ name, ...bound(`${root}/${name}/receipt.json`), exitCode: expected, timedOut: false, raw: receipt.raw, tests: receipt.tests ?? null });
  }
  for (const file of changed) {
    assert.equal(sha(gitBytes('show', precommit ? `:${file}` : `HEAD:${file}`)), bound(path.join(repo, file), repo).sha256);
  }
  return { status: precommit ? 'PASS_PRECOMMIT_DEADLINE_REPAIR' : 'PASS_POSTCOMMIT_DEADLINE_REPAIR',
    ...identity, directParent: precommit ? null : START, immutableStart: START, changed, bindings, checks,
    originalLauncher: bound(`${root}/original-launcher-92.mjs`), sealedTest: bound(`${root}/deadline-test-seal.mjs`),
    preservation: preservation(), review: 'SELF_REVIEW_ONLY; HEAD independent repair review pending',
    nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', managedRuntimeTiming: 'NOT_RUN', productIntegrated: false };
}

const actions = {
  unit: [node, ['--test', '--test-concurrency=1', '--test-reporter=tap', test]],
  types: [path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'reports/RD-12/tsconfig.json', '--singleThreaded']],
  'root-types': [path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'tsconfig.json', '--singleThreaded']],
  syntax: [node, ['--check', launcher]],
  guard: [node, ['scripts/verify-boundary.mjs', '--task', 'RD-12', '--start', START, '--base', BASE]],
  stage: [git, ['add', '--', 'reports/RD-12/phase2-launch.mjs', 'tests/RD-12/launcher-deadline.test.mjs', 'reports/RD-12/launcher-deadline-repair.mjs',
    'reports/RD-12/PLAN-LAUNCHER-DEADLINE-92de788c.md', 'reports/RD-12/HANDOFF-LAUNCHER-DEADLINE-92de788c-20261004-A.md']],
  'review-diff': [git, ['--no-pager', 'diff', '--cached', '--', 'reports/RD-12/phase2-launch.mjs', 'tests/RD-12/launcher-deadline.test.mjs',
    'reports/RD-12/launcher-deadline-repair.mjs', 'reports/RD-12/PLAN-LAUNCHER-DEADLINE-92de788c.md', 'reports/RD-12/HANDOFF-LAUNCHER-DEADLINE-92de788c-20261004-A.md']],
  'review-check': [git, ['diff', '--cached', '--check']],
  commit: [git, ['commit', '-m', 'RD-12 Fix native launcher deadline latching', '--', 'reports/RD-12/phase2-launch.mjs', 'tests/RD-12/launcher-deadline.test.mjs',
    'reports/RD-12/launcher-deadline-repair.mjs', 'reports/RD-12/PLAN-LAUNCHER-DEADLINE-92de788c.md', 'reports/RD-12/HANDOFF-LAUNCHER-DEADLINE-92de788c-20261004-A.md']],
};
try {
  assert.equal(process.version, 'v22.23.2');
  if (['snapshot', 'preserve', 'verify', 'candidate'].includes(operation)) {
    let result;
    if (operation === 'snapshot') {
      assert.deepEqual(current(), { head: START, tree: TREE }); result = preservation();
      fresh(`${root}/original-launcher-92.mjs`, gitBytes('show', `${START}:${prefix}${launcher}`));
      assert.equal(bound(`${root}/original-launcher-92.mjs`).sha256, bound(path.join(lab, launcher), lab).sha256);
      fresh(`${root}/deadline-test-seal.mjs`, regular(path.join(lab, test), lab));
    } else { result = ['verify', 'candidate'].includes(operation) ? candidate() : preservation(); }
    const artifact = `${root}/${operation}-${label}.json`; fresh(artifact, result);
    fresh(`${command}/raw.log`, JSON.stringify({ status: result.status ?? 'PASS_PRESERVATION', artifact: bound(artifact) }));
    fresh(`${command}/receipt.json`, { label, operation, started, finished: new Date().toISOString(), exitCode: 0, timedOut: false,
      source: current(), bindings, raw: bound(`${command}/raw.log`), artifact: bound(artifact), nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', productIntegrated: false });
    console.log(JSON.stringify({ status: result.status ?? 'PASS_PRESERVATION', artifact: bound(artifact) }));
  } else {
    assert(Object.hasOwn(actions, operation));
    if (operation === 'commit') { assert.deepEqual(current(), { head: START, tree: TREE }); preservation(); }
    const [binary, args] = actions[operation]; const log = `${command}/raw.log`; fresh(log, '');
    const child = spawn(binary, args, { cwd: lab, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    fresh(`${command}/child.json`, { binary: bound(binary), args, pid: child.pid, cwd: lab, PATH: env.PATH, TEMP: env.TEMP });
    const append = (bytes) => { admit(log, { owner: root, fresh: false }); appendFileSync(log, bytes); process.stdout.write(bytes); };
    child.stdout.on('data', append); child.stderr.on('data', append); child.once('error', (error) => append(Buffer.from(String(error))));
    let timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill(); }, 240_000);
    const actual = await new Promise((resolve) => child.once('close', (exitCode, signal) => resolve({ exitCode, signal })));
    clearTimeout(timer); const raw = regular(log, root).toString();
    const tests = operation === 'unit' ? { passed: Number(raw.match(/^# pass (\d+)$/m)?.[1]), failed: Number(raw.match(/^# fail (\d+)$/m)?.[1]) } : null;
    fresh(`${command}/receipt.json`, { label, operation, started, finished: new Date().toISOString(), ...actual, timedOut, binary: bound(binary), args,
      source: current(), bindings, raw: bound(log), tests, nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', productIntegrated: false });
    process.exitCode = actual.exitCode ?? 1;
  }
} catch (error) {
  if (!existsSync(`${command}/receipt.json`)) {
    fresh(`${command}/receipt.json`, { label, operation, started, finished: new Date().toISOString(), exitCode: 1, timedOut: false, error: String(error),
      bindings, nativeExecution: 'NOT_RUN_CONTROLLED_CPU_ONLY', productIntegrated: false });
  }
  throw error;
}
