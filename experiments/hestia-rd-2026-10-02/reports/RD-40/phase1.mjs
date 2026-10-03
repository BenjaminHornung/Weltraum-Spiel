import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const lab = fileURLToPath(new URL('../../', import.meta.url));
export const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
export const node = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
export const start = 'c531783536cc0fc617e928781633101b43cd2bfa';
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function freshRoot(id) {
  if (!/^c5317835-phase1-[a-z0-9-]+$/.test(id)) { throw new Error('Fresh RD40 phase1 run ID required'); }
  const root = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/${id}`;
  if (existsSync(root)) { throw new Error('Preserve prior attempt; use a fresh ID'); }
  mkdirSync(root, { recursive: true }); return root;
}
export function environment(root) {
  for (const dir of ['temp', 'npm-cache']) { mkdirSync(path.join(root, dir), { recursive: true }); }
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(path|temp|tmp|npm_config_cache|npm_config_script_shell)$/i.test(key)) { delete env[key]; }
  }
  return { ...env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    RD40_CPU_EVIDENCE_ROOT: root,
    TEMP: path.join(root, 'temp'), TMP: path.join(root, 'temp'), npm_config_cache: path.join(root, 'npm-cache'),
    npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe' };
}
export function run(root, name, binary, args) {
  if (!/^C:[/\\]IFI_SourceCode[/\\]/i.test(binary)) { throw new Error('C-only binary required'); }
  const began = new Date().toISOString();
  const result = spawnSync(binary, args, { cwd: lab, env: environment(root), encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
  const bytes = Buffer.from(`${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
  writeFileSync(path.join(root, `${name}.log`), bytes, { flag: 'wx' });
  const receipt = { name, binary, args, cwd: lab, began, ended: new Date().toISOString(), exitCode: result.status, signal: result.signal,
    logBytes: bytes.length, logSha256: sha(bytes), productIntegrated: false };
  writeFileSync(path.join(root, `${name}.json`), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(receipt));
  if (result.status === 0 && (name === 'boundary' || name === 'full-guard')) {
    const guard = JSON.parse(bytes.toString()); console.log(JSON.stringify({ ok: guard.ok, originalAllFilesGate: guard.originalAllFilesGate, inputHashesVerified: guard.inputHashesVerified, violations: guard.violations }));
  } else { console.log(bytes.toString()); }
  return result.status ?? 1;
}
export function verifyFreeze(root) {
  const heads = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/';
  const pins = [
    ['SO05-PREPARATION-c5317835.md', 'ed793e996112a0e1db3fb848822c49c2f42b6f4e20ba6ebe939ec81a9cfacec3'],
    ['rd40-prelaunch-boundary-c5317835.json', 'd2b6b5055264c719430ce8bc1d09540b2c4966afbadd0a6c814698bbb11e10df'],
    [`freezes/${start}.json`, '282c235f1479bdfe71fa9d1d6f6a03973fedf477583337876ab0a15d8753ad96'],
  ];
  for (const [file, expected] of pins) { if (sha(readFileSync(heads + file)) !== expected) { throw new Error(`HEAD pin mismatch: ${file}`); } }
  const freeze = JSON.parse(readFileSync(`${heads}freezes/${start}.json`, 'utf8'));
  const head = execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim();
  if (head !== start) { throw new Error('This pre-edit admission requires exact START'); }
  const shared = freeze.frozenFiles.map((row) => ({ path: row.path, sha256: sha(readFileSync(path.join(lab, row.path))), expected: row.sha256 }));
  if (shared.length !== 18 || shared.some((row) => row.sha256 !== row.expected)) { throw new Error('Current shared18 mismatch'); }
  const file = path.join(lab, 'node_modules'); const stat = lstatSync(file, { throwIfNoEntry: false });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) { throw new Error('Own dependencies must be regular contained directory'); }
  writeFileSync(path.join(root, 'admission.json'), JSON.stringify({ head, tree: freeze.tree, pins, shared, dependenciesPresent: Boolean(stat), productIntegrated: false }, null, 2), { flag: 'wx' });
  return Boolean(stat);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, id] = process.argv.slice(2); const root = freshRoot(id);
  if (action === 'prepare') {
    const installed = verifyFreeze(root);
    if (!installed) {
      const exit = run(root, 'npm-ci', node, ['C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
      if (exit !== 0) { process.exitCode = exit; }
    }
  } else if (action === 'red') {
    process.exitCode = run(root, 'focused-red', node, [path.join(lab, 'node_modules/vitest/vitest.mjs'), 'run', 'tests/RD-40/unit.test.ts']);
  } else if (action === 'verify') {
    const jobs = [
      ['root-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'tsconfig.json']],
      ['focused-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'reports/RD-40/tsconfig.json']],
      ['focused-unit', node, [path.join(lab, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'reports/RD-40/vitest.phase1.config.ts', 'tests/RD-40/unit.test.ts', '--reporter=json', `--outputFile=${path.join(root, 'unit.json')}`]],
      ['gallery-build', node, [path.join(lab, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'reports/RD-40/vite.phase1.config.ts', '--configLoader', 'native', '--outDir', path.join(root, 'build')]],
      ['boundary', node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-40', '--start', start, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']],
    ];
    for (const [name, binary, args] of jobs) { const exit = run(root, name, binary, args); if (exit !== 0) { process.exitCode = exit; break; } }
  } else if (action === 'commit') {
    const check = (...args) => execFileSync(git, args, { cwd: lab, env: environment(root), encoding: 'utf8', timeout: 120_000 }).trim();
    if (check('rev-parse', 'HEAD') !== start || check('branch', '--show-current') !== 'feature/hestia-rd-rd40-2026-10-04' || check('diff', '--name-only')) { throw new Error('Exact START/branch and no unstaged changes required'); }
    const staged = check('diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
    if (staged.length !== 17 || staged.some((file) => !['src/tools/variant-gallery/', 'tests/RD-40/', 'reports/RD-40/'].some((owned) => file.startsWith(`experiments/hestia-rd-2026-10-02/${owned}`)))) { throw new Error('Exactly the 17 reviewed owned files must be staged'); }
    const clean = run(root, 'staged-diff-check', git, ['diff', '--cached', '--check']);
    if (clean !== 0) { process.exitCode = clean; }
    else { process.exitCode = run(root, 'local-commit', git, ['commit', '-m', 'RD40 Implement usable variant gallery phase 1', '-m', 'Real C0/C1/C2 UI, serialized comparison state and byte-bound evidence. Focused controlled CPU checks and leaf build; HEAD wiring/browser acceptance remain separate. ProductIntegrated=false.']); }
  } else { throw new Error('Unknown phase1 action'); }
}
