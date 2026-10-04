import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const lab = fileURLToPath(new URL('../../', import.meta.url));
export const out = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/phase1-303e6d65-20261004-a';
export const START = '303e6d651482338cc876696792acdd344603232e';
export const REPAIR_PARENT = '09ca699f1fab6bbe280556ddc660f56cbb383dba';
export const BASE = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
export const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const within = (root, file) => { const rel = path.relative(path.resolve(root), path.resolve(file));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)); };

export function admit(file, { fresh = true, directory = false, owner = out } = {}) {
  const target = path.resolve(file); assert(within(owner, target) && within('C:/IFI_SourceCode', target));
  for (let cursor = target; ; cursor = path.dirname(cursor)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat) {
      assert(!stat.isSymbolicLink(), `Link forbidden: ${cursor}`);
      assert.equal(realpathSync.native(cursor).toLowerCase(), cursor.toLowerCase(), `Path alias: ${cursor}`);
      if (cursor === target) {
        assert(!fresh, `Existing sink forbidden: ${target}`);
        assert(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1);
      } else { assert(stat.isDirectory()); }
    }
    if (path.dirname(cursor) === cursor) { break; }
  }
  return target;
}
export function directory(file, owner = out) { admit(file, { fresh: false, directory: true, owner }); mkdirSync(file, { recursive: true }); }
export function writeNew(file, data) { admit(file); directory(path.dirname(file)); admit(file); writeFileSync(file, data, { flag: 'wx' }); }
export function ownBindings() {
  const files = [];
  function walk(relative) {
    const full = path.join(lab, relative); if (!lstatSync(full, { throwIfNoEntry: false })) { return; }
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`; const stat = lstatSync(path.join(lab, name)); assert(!stat.isSymbolicLink());
      if (entry.isDirectory()) { walk(name); } else {
        assert(stat.isFile() && stat.nlink === 1); files.push({ path: name, sha256: sha(readFileSync(path.join(lab, name))) });
      }
    }
  }
  for (const root of ['src/experiments/babylon', 'tests/RD-12', 'reports/RD-12']) { walk(root); }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [label, operation] = process.argv.slice(2); assert.match(label ?? '', /^[a-z0-9-]+$/);
  const commands = {
    install: [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    baseline: ['reports/RD-12/bindings.mjs', 'baseline', label],
    seal: ['reports/RD-12/bindings.mjs', 'seal', label],
    bindings: ['reports/RD-12/bindings.mjs', 'verify', label],
    candidate: ['reports/RD-12/bindings.mjs', 'candidate', label],
    'unit-red': ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-12/unit.test.ts', '--config', 'reports/RD-12/vitest.config.ts'],
    unit: ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-12/unit.test.ts', 'tests/RD-12/ownership.unit.test.ts', 'tests/RD-12/repair.unit.test.ts', 'tests/RD-12/native-config.unit.test.ts', '--config', 'reports/RD-12/vitest.config.ts'],
    'unit-repair': ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-12/repair.unit.test.ts', 'tests/RD-12/native-config.unit.test.ts', '--config', 'reports/RD-12/vitest.config.ts'],
    'unit-supplement': ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-12/ownership.unit.test.ts', '--config', 'reports/RD-12/vitest.config.ts'],
    types: ['--noEmit', '-p', 'reports/RD-12/tsconfig.json', '--singleThreaded', '--extendedDiagnostics'],
    'root-types': ['--noEmit', '-p', 'tsconfig.json', '--singleThreaded', '--extendedDiagnostics'],
    build: ['node_modules/vite/bin/vite.js', 'build', '--config', 'reports/RD-12/vite.config.ts', '--configLoader', 'native', '--outDir', `${out}/build-${label}`, '--emptyOutDir', 'false'],
    'review-diff': ['--no-pager', 'diff', '--cached', '--', 'src/experiments/babylon', 'tests/RD-12', 'reports/RD-12'],
    'review-check': ['diff', '--cached', '--check'],
    commit: ['commit', '-m', 'RD-12 Implement actual Babylon fixture adapter Phase1', '--', 'src/experiments/babylon', 'tests/RD-12', 'reports/RD-12'],
    'repair-commit': ['commit', '-m', 'RD-12 Repair parity qualification, output admission and root transforms', '--', 'src/experiments/babylon', 'tests/RD-12', 'reports/RD-12'],
    guard: ['scripts/verify-boundary.mjs', '--task', 'RD-12', '--start', START, '--base', BASE],
  };
  assert(Object.hasOwn(commands, operation)); const commandRoot = `${out}/commands/${label}`;
  admit(commandRoot); directory(commandRoot); directory(`${commandRoot}/temp`); directory(`${commandRoot}/npm-cache`);
  if (operation === 'install') { admit(path.join(lab, 'node_modules'), { owner: lab }); }
  if (operation === 'build') { admit(`${out}/build-${label}`); }
  const environment = { ...process.env,
    PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', npm_config_cache: `${commandRoot}/npm-cache`,
    TEMP: `${commandRoot}/temp`, TMP: `${commandRoot}/temp`, HESTIA_RD_TASK: 'RD-12', HESTIA_RD12_COMMAND_ROOT: commandRoot };
  const binary = ['types', 'root-types'].includes(operation) ? path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe') : operation.startsWith('review-') || operation === 'commit' || operation === 'repair-commit' ? git : node;
  const args = [...commands[operation]]; const testResults = operation.startsWith('unit') ? `${commandRoot}/test-results.json` : null;
  if (testResults) { admit(testResults); args.push('--configLoader', 'native', '--reporter=verbose', '--reporter=json', `--outputFile.json=${testResults}`); }
  const started = new Date().toISOString(); const bindings = ownBindings(); const chunks = []; const log = `${commandRoot}/raw.log`; writeNew(log, '');
  const child = spawn(binary, args, { cwd: lab, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  writeNew(`${commandRoot}/started.json`, JSON.stringify({ label, operation, binary, args, cwd: lab, started, pid: child.pid, bindings,
    temp: environment.TEMP, cache: environment.npm_config_cache, PATH: environment.PATH, nativeExecution: 'NOT_RUN_PHASE1_CPU_ONLY', productIntegrated: false }, null, 2));
  const append = (bytes) => { admit(log, { fresh: false }); appendFileSync(log, bytes); chunks.push(bytes); };
  child.stdout.on('data', (bytes) => { append(bytes); process.stdout.write(bytes); }); child.stderr.on('data', (bytes) => { append(bytes); process.stderr.write(bytes); });
  let timedOut = false; const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 240_000);
  child.once('error', (error) => { append(Buffer.from(String(error))); });
  child.once('close', (exitCode, signal) => {
    clearTimeout(timeout); const bytes = Buffer.concat(chunks);
    writeNew(`${commandRoot}/receipt.json`, JSON.stringify({ label, operation, binary, args, cwd: lab, started, finished: new Date().toISOString(),
      exitCode, signal, timedOut, rawSha256: sha(bytes), rawBytes: bytes.length, bindings,
      testResults: testResults && lstatSync(testResults, { throwIfNoEntry: false }) ? { path: testResults, sha256: sha(readFileSync(testResults)) } : null,
      nativeExecution: 'NOT_RUN_PHASE1_CPU_ONLY', productIntegrated: false }, null, 2)); process.exitCode = exitCode ?? 1;
  });
}
