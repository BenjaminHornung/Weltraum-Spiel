import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url));
const out = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/phase2-84aeadb1-20261003';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const [label, operation, ...extra] = process.argv.slice(2);
assert.match(label ?? '', /^[a-z0-9-]+$/); assertIsolation({ task: 'RD-10', runRoot: out });
const commands = {
  preflight: ['reports/RD-10/phase2-evidence.mjs', 'preflight'],
  check: [npm, 'run', 'check'], types: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tests/RD-10/tsconfig.json'],
  unit: [npm, 'run', 'test:unit', '--', 'tests/RD-10', ...extra],
  admission: [npm, 'run', 'test:unit', '--', 'tests/RD-10/phase2', ...extra],
  build: [npm, 'run', 'build'], disk: ['reports/RD-10/phase2-evidence.mjs', 'disk'],
  http: ['reports/RD-10/phase2-evidence.mjs', 'http'],
  port: ['scripts/verify-boundary.mjs', '--task', 'RD-10', '--port-check'],
  preview: ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5280', '--strictPort'],
  browser: ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/RD-10/phase2.playwright.config.ts', ...extra],
  guard: ['scripts/verify-boundary.mjs', '--task', 'RD-10', '--start', '84aeadb11a2cf49acf83c8326f7eeac1898c6da9', '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'],
  verify: ['reports/RD-10/phase2-evidence.mjs', 'verify'], report: ['reports/RD-10/phase2-evidence.mjs', 'report'],
  candidate: ['reports/RD-10/phase2-evidence.mjs', 'candidate'],
  commit: ['commit', '-m', 'RD-10: verify optimized native renderer probe phase 2'],
};
assert(Object.hasOwn(commands, operation), 'Unknown phase2 operation');
const environment = { ...process.env,
  PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
  npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', npm_config_cache: `${out}/npm-cache`,
  TEMP: `${out}/temp`, TMP: `${out}/temp`, HESTIA_RD_TASK: 'RD-10', HESTIA_RD10_BUILD_CLASS: 'OPTIMIZED',
  HESTIA_RD_BROWSER_RUN_ID: label, HESTIA_RD10_COMMAND_LABEL: label,
};
if (operation === 'browser') {
  const browserRoot = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/browser/${label}`;
  assertIsolation({ task: 'RD-10', runRoot: browserRoot });
  assert(!existsSync(browserRoot), 'Caller must admit a fresh browser root before Playwright can mutate it');
  environment.HESTIA_RD10_ADMITTED_BROWSER_ROOT = browserRoot;
}
if (operation === 'commit') {
  assert.equal(execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, env: environment, encoding: 'utf8' }).trim(), '84aeadb11a2cf49acf83c8326f7eeac1898c6da9');
}
const directory = `${out}/commands/${label}`; assert(!existsSync(directory), 'Never reuse/overwrite a command directory');
mkdirSync(directory, { recursive: true });
for (const name of ['temp', 'npm-cache']) { mkdirSync(`${out}/${name}`, { recursive: true }); }
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bindings = ['src/experiments/renderer-probe/index.ts', 'src/experiments/renderer-probe/main.ts', 'src/experiments/renderer-probe/index.html',
  'tests/RD-10/unit.test.ts', 'tests/RD-10/browser.spec.ts', 'tests/RD-10/phase2/unit.test.ts', 'tests/RD-10/phase2-artifacts.ts',
  'tests/RD-10/phase2.browser.spec.ts', 'tests/RD-10/phase2.playwright.config.ts', 'reports/RD-10/phase2-run.mjs', 'reports/RD-10/phase2-evidence.mjs']
  .filter((file) => existsSync(path.join(lab, file))).map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) }));
const binary = operation === 'commit' ? git : node; const args = commands[operation];
const started = new Date().toISOString(); const log = `${directory}/raw.log`; writeFileSync(log, '', { flag: 'wx' });
const child = spawn(binary, args, { cwd: lab, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(`${directory}/started.json`, JSON.stringify({ label, operation, binary, args, cwd: lab, started, pid: child.pid,
  bindings, processLocal: { PATH: environment.PATH, shell: environment.npm_config_script_shell, TEMP: environment.TEMP, cache: environment.npm_config_cache,
    admittedBrowserRoot: environment.HESTIA_RD10_ADMITTED_BROWSER_ROOT },
  productIntegrated: false }, null, 2), { flag: 'wx' });
child.stdout.on('data', (bytes) => { appendFileSync(log, bytes); process.stdout.write(bytes); });
child.stderr.on('data', (bytes) => { appendFileSync(log, bytes); process.stderr.write(bytes); });
let timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill(); }, operation === 'preview' ? 180_000 : 240_000);
child.once('error', (error) => { appendFileSync(log, String(error)); });
child.once('close', (exitCode, signal) => {
  clearTimeout(timeout); const bytes = readFileSync(log);
  writeFileSync(`${directory}/receipt.json`, JSON.stringify({ ...JSON.parse(readFileSync(`${directory}/started.json`)), finished: new Date().toISOString(),
    exitCode, signal, timedOut, logBytes: bytes.length, logSha256: sha(bytes), productIntegrated: false }, null, 2), { flag: 'wx' });
  process.exitCode = exitCode ?? 1;
});
