import { spawnSync } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01';
const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const npm = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const pwsh = 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe';
const [label, tool, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !['npm', 'node', 'git'].includes(tool)) {
  throw new Error('Usage: run-command.mjs <label> <npm|node|git> <args>');
}
for (const dir of ['logs', 'temp', 'npm-cache']) {
  mkdirSync(`${run}/${dir}`, { recursive: true });
}
const binary = { npm: node, node, git }[tool];
const argv = tool === 'npm' ? [npm, ...args] : args;
const env = { ...process.env, PATH: [path.dirname(node), path.dirname(git), path.dirname(pwsh)].join(';'),
  npm_config_script_shell: pwsh, npm_config_cache: `${run}/npm-cache`, TMP: `${run}/temp`, TEMP: `${run}/temp` };
const started = new Date().toISOString();
const result = spawnSync(binary, argv, { cwd: lab, env, timeout: 240_000,
  maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const exitCode = result.status ?? 1;
const bytes = Buffer.concat([result.stdout ?? Buffer.alloc(0), result.stderr ?? Buffer.alloc(0),
  Buffer.from(result.error ? String(result.error) : '')]);
const log = `${run}/logs/${label}-${Date.now()}.log`;
writeFileSync(log, bytes, { flag: 'wx' });
const record = { label, started, finished: new Date().toISOString(), cwd: lab, binary, args: argv,
  exitCode, signal: result.signal, log, logBytes: bytes.length,
  logSha256: createHash('sha256').update(bytes).digest('hex'),
  processLocal: { PATH: env.PATH, npmScriptShell: env.npm_config_script_shell,
    npmCache: env.npm_config_cache, TEMP: env.TEMP }, productIntegrated: false };
appendFileSync(`${run}/commands.jsonl`, `${JSON.stringify(record)}\n`);
console.log(JSON.stringify(record, null, 2));
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exitCode = exitCode;
