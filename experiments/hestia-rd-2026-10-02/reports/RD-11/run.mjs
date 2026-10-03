import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const lab = fileURLToPath(new URL('../../', import.meta.url));
export const out = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/phase1-e42bf9e7-20261003';
export const START = 'e42bf9e771e651306b6cece5e4116d4e4e25af9c';
export const BASE = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
export const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const within = (root, file) => { const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); };

/** Native lstat catches dangling links; realpath checks every existing ancestor, including C root.
 * On Windows lstat is case-insensitive: case aliases cannot bypass existing-leaf rejection. */
export function admit(file, { fresh = true, directory = false, owner = out } = {}) {
  const target = path.resolve(file); assert(within(owner, target), 'Sink outside task-owned root');
  for (let cursor = target; ; cursor = path.dirname(cursor)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat) {
      assert(!stat.isSymbolicLink(), `Link/dangling link forbidden: ${cursor}`);
      assert.equal(realpathSync.native(cursor).toLowerCase(), cursor.toLowerCase(), `Native path alias: ${cursor}`);
      if (cursor === target) {
        assert(!fresh, `Existing sink forbidden: ${target}`);
        assert(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1, 'Invalid sink kind/hardlink');
      } else { assert(stat.isDirectory(), `Ancestor is not a directory: ${cursor}`); }
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
      const name = `${relative}/${entry.name}`; const stat = lstatSync(path.join(lab, name));
      assert(!stat.isSymbolicLink(), 'Own source link forbidden');
      if (entry.isDirectory()) { walk(name); } else {
        assert(stat.isFile() && stat.nlink === 1, 'Own source must be a regular single-link file');
        files.push({ path: name, sha256: sha(readFileSync(path.join(lab, name))) });
      }
    }
  }
  for (const root of ['src/experiments/three-webgpu', 'tests/RD-11', 'reports/RD-11']) { walk(root); }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [label, operation] = process.argv.slice(2); assert.match(label ?? '', /^[a-z0-9-]+$/);
  const commands = {
    install: [npm, 'ci', '--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund'],
    'unit-red': ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-11'],
    unit: ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-11'],
    check: [npm, 'run', 'check'],
    syntax: ['--input-type=module', '-e', "import{stripTypeScriptTypes}from'node:module';import{readFileSync}from'node:fs';import{lab,ownBindings,sha}from'./reports/RD-11/run.mjs';import path from'node:path';const files=ownBindings().filter(row=>row.path.endsWith('.ts'));for(const row of files){const js=stripTypeScriptTypes(readFileSync(path.join(lab,row.path),'utf8'),{mode:'transform'});console.log(JSON.stringify({...row,transformedSha256:sha(js),status:'PASS_SYNTAX_ONLY_NOT_TYPES',productIntegrated:false}));}"],
    types: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'reports/RD-11/tsconfig.json'],
    'types-trace': ['--noEmit', '-p', 'reports/RD-11/tsconfig.json', '--extendedDiagnostics', '--generateTrace', `${out}/commands/${label}/trace`],
    'types-single': ['--noEmit', '-p', 'reports/RD-11/tsconfig.json', '--singleThreaded', '--extendedDiagnostics'],
    'check-single': ['--noEmit', '-p', 'tsconfig.json', '--singleThreaded', '--extendedDiagnostics'],
    'types-smoke': ['--noEmit', '-p', 'reports/RD-11/tsconfig.smoke.json', '--singleThreaded', '--extendedDiagnostics'],
    'types-runtime': ['--noEmit', '-p', 'reports/RD-11/tsconfig.runtime.json', '--singleThreaded', '--extendedDiagnostics'],
    build: [npm, 'run', 'build', '--', '--configLoader', 'native', '--outDir', `${out}/build-${label}`, '--emptyOutDir', 'false'],
    bindings: ['reports/RD-11/bindings.mjs', 'verify', label],
    guard: ['scripts/verify-boundary.mjs', '--task', 'RD-11', '--start', START, '--base', BASE],
    commit: ['commit', '-m', 'RD-11: implement frozen Three WebGPU and TSL profiles phase 1'],
    candidate: ['reports/RD-11/bindings.mjs', 'candidate', label],
  };
  assert(Object.hasOwn(commands, operation), 'Unknown bounded RD11 operation');
  const commandRoot = `${out}/commands/${label}`; admit(commandRoot); directory(commandRoot);
  for (const name of ['temp', 'npm-cache']) { directory(`${commandRoot}/${name}`); }
  if (operation === 'install') { admit(path.join(lab, 'node_modules'), { owner: lab }); }
  if (operation === 'build') { admit(`${out}/build-${label}`); }
  if (operation === 'commit') { assert.equal(execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim(), START); }
  const environment = { ...process.env,
    PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', npm_config_cache: `${commandRoot}/npm-cache`,
    TEMP: `${commandRoot}/temp`, TMP: `${commandRoot}/temp`, HESTIA_RD_TASK: 'RD-11',
  };
  const nativeTypes = ['types-trace', 'types-single', 'check-single', 'types-smoke', 'types-runtime'].includes(operation);
  const binary = operation === 'commit' ? git : nativeTypes ? path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe') : node;
  const args = commands[operation];
  if (operation === 'types-trace') { admit(`${commandRoot}/trace`); }
  const testResults = ['unit', 'unit-red'].includes(operation) ? `${commandRoot}/test-results.json` : undefined;
  if (testResults) { admit(testResults); args.push('--configLoader', 'native', '--reporter=json', `--outputFile=${testResults}`); }
  const started = new Date().toISOString(); const bindings = ownBindings(); const chunks = [];
  const log = `${commandRoot}/raw.log`; writeNew(log, '');
  const child = spawn(binary, args, { cwd: lab, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  writeNew(`${commandRoot}/started.json`, JSON.stringify({ label, operation, binary, args, cwd: lab, started, pid: child.pid,
    bindings, processLocal: { PATH: environment.PATH, scriptShell: environment.npm_config_script_shell, cache: environment.npm_config_cache,
      TEMP: environment.TEMP, TMP: environment.TMP }, productIntegrated: false }, null, 2));
  const append = (bytes) => { admit(log, { fresh: false }); appendFileSync(log, bytes); chunks.push(bytes); };
  child.stdout.on('data', (bytes) => { append(bytes); process.stdout.write(bytes); });
  child.stderr.on('data', (bytes) => { append(bytes); process.stderr.write(bytes); });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill(); }, nativeTypes ? 90_000 : 240_000);
  child.once('error', (error) => { append(Buffer.from(String(error))); });
  child.once('close', (exitCode, signal) => {
    clearTimeout(timeout); const bytes = Buffer.concat(chunks);
    writeNew(`${commandRoot}/receipt.json`, JSON.stringify({ label, operation, binary, args, cwd: lab, started,
      finished: new Date().toISOString(), exitCode, signal, timedOut, rawSha256: sha(bytes), rawBytes: bytes.length,
      bindings, testResults: testResults && lstatSync(testResults, { throwIfNoEntry: false }) ? { path: testResults, sha256: sha(readFileSync(testResults)) } : null,
      productIntegrated: false }, null, 2));
    process.exitCode = exitCode ?? 1;
  });
}
