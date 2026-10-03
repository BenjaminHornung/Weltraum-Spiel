import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url));
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const [label, operation, ...extra] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '')) { throw new Error('New bounded command label required'); }
const commands = {
  install: [npm, 'ci', '--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund'],
  check: [npm, 'run', 'check'],
  unit: [npm, 'run', 'test:unit', '--', 'tests/RD-10', ...extra],
  build: [npm, 'run', 'build'],
  guard: ['scripts/verify-boundary.mjs', '--task', 'RD-10', '--start', '4788520ef7cecc5db62da8d51f0daaa8ac8bdd09', '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'],
  port: ['scripts/verify-boundary.mjs', '--task', 'RD-10', '--port-check'],
  serve: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5280', '--strictPort'],
  browser: ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/RD-10/playwright.config.ts'],
  inspect: ['reports/RD-10/inspect.mjs'],
  audit: ['reports/RD-10/finalize.mjs'],
  candidate: ['reports/RD-10/finalize.mjs', 'candidate'],
  commit: ['commit', '-m', 'RD-10: implement native renderer probe phase 1'],
  validate: ['reports/RD-10/finalize.mjs', 'validate'],
  types: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tests/RD-10/tsconfig.json'],
};
if (!Object.hasOwn(commands, operation)) { throw new Error('Unknown RD10 operation'); }
assertIsolation({ task: 'RD-10', runRoot: run });
const directory = `${run}/commands/${label}`;
if (lstatSync(directory, { throwIfNoEntry: false })) { throw new Error('Command output already exists; do not overwrite'); }
mkdirSync(directory, { recursive: true });
for (const name of ['temp', 'npm-cache']) { mkdirSync(`${run}/${name}`, { recursive: true }); }
const environment = { ...process.env,
  PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
  npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe',
  npm_config_cache: `${run}/npm-cache`, TEMP: `${run}/temp`, TMP: `${run}/temp`,
  HESTIA_RD_TASK: 'RD-10', HESTIA_RD_BROWSER_RUN_ID: label, HESTIA_RD10_BUILD_CLASS: 'DEV',
  HESTIA_RD10_COMMAND_LABEL: label,
};
const args = commands[operation];
const binary = operation === 'commit' ? 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe' : node;
const started = new Date().toISOString();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bindings = ['src/experiments/renderer-probe/index.ts', 'src/experiments/renderer-probe/main.ts', 'src/experiments/renderer-probe/index.html', 'tests/RD-10/unit.test.ts', 'tests/RD-10/browser.spec.ts', 'reports/RD-10/run.mjs']
  .filter((file) => lstatSync(path.join(lab, file), { throwIfNoEntry: false }))
  .map((file) => ({ path: file, sha256: hash(readFileSync(path.join(lab, file))) }));
const chunks = [];
const child = spawn(binary, args, { cwd: lab, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (bytes) => { chunks.push(bytes); process.stdout.write(bytes); });
child.stderr.on('data', (bytes) => { chunks.push(bytes); process.stderr.write(bytes); });
// One sequential heavy job. This wrapper owns only this child; server lifecycle is managed by the caller.
const timeout = operation === 'serve' ? undefined : setTimeout(() => { child.kill(); }, 240_000);
child.once('error', (error) => { chunks.push(Buffer.from(String(error))); });
child.once('close', (exitCode, signal) => {
  clearTimeout(timeout);
  const bytes = Buffer.concat(chunks); writeFileSync(`${directory}/raw.log`, bytes, { flag: 'wx' });
  writeFileSync(`${directory}/receipt.json`, JSON.stringify({ label, operation, binary, args, cwd: lab,
    started, finished: new Date().toISOString(), exitCode, signal, logBytes: bytes.length, logSha256: hash(bytes),
    bindings, processLocal: { PATH: environment.PATH, shell: environment.npm_config_script_shell,
      cache: environment.npm_config_cache, TEMP: environment.TEMP }, productIntegrated: false }, null, 2), { flag: 'wx' });
  process.exitCode = exitCode ?? 1;
});
