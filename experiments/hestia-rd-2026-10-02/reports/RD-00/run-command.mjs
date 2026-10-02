import { spawnSync } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const pwsh = 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe';
const python = 'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe';
const [label, tool, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !['npm', 'node', 'git', 'python', 'pwsh'].includes(tool)) {
  throw new Error('Usage: run-command.mjs <label> <npm|node|git|python|pwsh> <args>');
}
for (const dir of ['logs', 'temp', 'npm-cache', 'browser']) {
  mkdirSync(path.join(run, dir), { recursive: true });
}
const binary = { npm: node, node, git, pwsh, python }[tool];
const argv = tool === 'npm' ? [npm, ...args] : args;
const started = new Date().toISOString();
const env = { ...process.env,
  PATH: [path.dirname(node), path.dirname(git), path.dirname(pwsh)].join(';'),
  npm_config_script_shell: pwsh, npm_config_cache: `${run}/npm-cache`,
  TMP: `${run}/temp`, TEMP: `${run}/temp`,
  PLAYWRIGHT_BROWSERS_PATH: `${run}/browser`,
};
if (args.includes('test:browser')) { env.DEBUG = 'pw:browser'; env.RD00_BROWSER_RUN_ID = `${label}-${Date.now()}`; }
const result = spawnSync(binary, argv, { cwd: lab, env, encoding: 'utf8',
  timeout: 240_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const exitCode = result.status ?? 1;
const log = `${run}/logs/${label}-${Date.now()}.log`;
writeFileSync(log, `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
const record = { label, started, finished: new Date().toISOString(), cwd: lab,
  binary, args: argv, exitCode, signal: result.signal, log,
  processLocal: { PATH: env.PATH, npmScriptShell: env.npm_config_script_shell, npmCache: env.npm_config_cache,
    TEMP: env.TEMP, playwrightBrowsers: env.PLAYWRIGHT_BROWSERS_PATH, browserRunId: env.RD00_BROWSER_RUN_ID ?? null } };
appendFileSync(`${run}/commands.jsonl`, `${JSON.stringify(record)}\n`);
console.log(JSON.stringify(record, null, 2));
console.log(result.stdout ?? '');
console.error(result.stderr ?? '');
process.exitCode = exitCode;
