import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';

const lab = process.cwd();
const root = path.resolve(lab, '../..');
const coordination = `${lab}/docs/coordination`;
const run = JSON.parse(readFileSync(`${coordination}/RUN.json`, 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync(run.tools.git, args, { cwd: root, encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== '807e8b4cc4528bd9d02122109e08e2e869305047'
  || git('rev-parse', `${run.productReadBase}^{tree}`) !== run.productReadTree
  || git('branch', '--show-current') !== 'feature/hestia-rd-rd00-2026-10-02') {
  throw new Error('Wrong start/base/tree/branch');
}
const manifest = JSON.parse(readFileSync(`${coordination}/input-package/MANIFEST.json`, 'utf8'));
for (const entry of manifest.files) {
  const bytes = readFileSync(`${coordination}/input-package/${entry.path}`);
  if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
    throw new Error(`Original bytes changed: ${entry.path}`);
  }
}
for (const name of ['EXECPLAN.md', 'RUN.json', 'input-package/MANIFEST.json']) {
  const bytes = readFileSync(`${coordination}/${name}`);
  const pinned = execFileSync(run.tools.git, ['show', `807e8b4cc4528bd9d02122109e08e2e869305047:experiments/hestia-rd-2026-10-02/docs/coordination/${name}`], { cwd: root });
  if (digest(bytes) !== digest(pinned)) { throw new Error(`Pinned file changed: ${name}`); }
}
const versions = {};
for (const name of ['node', 'git', 'python']) {
  if (!existsSync(run.tools[name])) { throw new Error(`Missing executable: ${name}`); }
  versions[name] = execFileSync(run.tools[name], ['--version'], { cwd: lab, encoding: 'utf8' }).trim();
}
versions.npm = execFileSync(run.tools.node, [run.tools.npmCli, '--version'], { cwd: lab, encoding: 'utf8' }).trim();
versions.pwsh = execFileSync(run.tools.pwsh, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], { cwd: lab, encoding: 'utf8' }).trim();
versions.chromium = execFileSync(run.tools.pwsh, ['-NoProfile', '-NonInteractive', '-Command',
  `(Get-Item -LiteralPath '${run.tools.chromium}').VersionInfo.FileVersion`], { cwd: lab, encoding: 'utf8' }).trim();
const server = createServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5280, '127.0.0.1', resolve); });
await new Promise((resolve) => { server.close(resolve); });
console.log(JSON.stringify({ status: 'PASS', base: run.productReadBase, tree: run.productReadTree,
  start: git('rev-parse', 'HEAD'), manifestEntriesVerified: manifest.files.length,
  toolPaths: run.tools, versions, port: '127.0.0.1:5280 free (bind/close)',
  foreignUntracked: git('ls-files', '--others', '--exclude-standard', '--', '.opencode'),
  productIntegrated: false }, null, 2));
