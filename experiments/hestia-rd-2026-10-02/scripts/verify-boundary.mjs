import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LAB = 'experiments/hestia-rd-2026-10-02/';
const BASE = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const START = '807e8b4cc4528bd9d02122109e08e2e869305047';
const GIT = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const RUN_ROOT = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
const PLATFORM_FILES = ['.opencode/throughput.jsonl', '.opencode/throughput.md'];
const leafFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts',
  'playwright.config.ts', 'index.html', '.gitignore', 'src/registration.ts', 'scripts/verify-boundary.mjs'];
const leafDirectories = ['src/contracts/', 'docs/coordination/', 'tests/RD-00/', 'reports/RD-00/'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const within = (root, file) => { const relative = path.relative(root, file); return relative === ''
  || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const allowed = (file) => file.startsWith(LAB) && (leafFiles.includes(file.slice(LAB.length))
  || leafDirectories.some((directory) => file.slice(LAB.length).startsWith(directory)));

export function assertIsolation({ origin = 'http://127.0.0.1:5280', databaseName = 'hestia-rd-rd00', runRoot = RUN_ROOT } = {}) {
  const url = new URL(origin);
  if (url.href !== 'http://127.0.0.1:5280/' || url.username || url.password) {
    throw new Error('Only task-owned loopback origin http://127.0.0.1:5280 is allowed; no product origin');
  }
  if (!/^hestia-rd-[a-z0-9-]+$/.test(databaseName)) { throw new Error('Shared/product database forbidden'); }
  if (!within(path.resolve(RUN_ROOT), path.resolve(runRoot))) { throw new Error('Run artifacts outside RD-00 root'); }
}

export async function assertPortFree(port = 5280) {
  if (port !== 5280) { throw new Error('RD-00 requires strict port 5280; no fallback'); }
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', (error) => { reject(new Error(`Port 127.0.0.1:5280 is not free: ${error.message}`)); });
    server.listen({ port, host: '127.0.0.1', exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => { server.close((error) => { if (error) { reject(error); } else { resolve(); } }); });
}

/** @param {{repoRoot?: string, base?: string, start?: string, gitPath?: string, verifyPinned?: boolean}} options */
export function inspectBoundary(options = {}) {
  const repoRoot = options.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const base = options.base ?? BASE; const start = options.start ?? START;
  const gitPath = options.gitPath ?? GIT; const verifyPinned = options.verifyPinned ?? true;
  if (!/^[0-9a-f]{40}$/.test(base) || !/^[0-9a-f]{40}$/.test(start)) { throw new Error('Full immutable base/start SHA required'); }
  if (!within('C:/IFI_SourceCode', path.resolve(repoRoot)) || !within('C:/IFI_SourceCode', path.resolve(gitPath))) {
    throw new Error('Execution target outside C:/IFI_SourceCode');
  }
  const gitBytes = (...args) => execFileSync(gitPath, args, { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const git = (...args) => gitBytes(...args).toString('utf8');
  const paths = (...args) => git(...args).split('\0').filter(Boolean);
  const violations = []; const platformArtifacts = [];
  const ownedRoot = path.resolve(repoRoot).replaceAll('\\', '/');
  const authorizedLogScope = ownedRoot === 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD00'
    || ownedRoot.startsWith(`${RUN_ROOT}/oracles/boundary-`);
  function automaticLogIsRegular(file) {
    const full = path.join(repoRoot, file);
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (!stat) { return false; }
    const parent = path.join(repoRoot, '.opencode');
    const safe = stat.isFile() && !stat.isSymbolicLink() && !lstatSync(parent).isSymbolicLink()
      && within(repoRoot, realpathSync(full)) && within(repoRoot, realpathSync(parent));
    if (!safe) { violations.push(`automatic-log name is not a regular contained file (symlink/junction/escape): ${file}`); }
    return safe;
  }
  // The user's explicit exception is UNTRACKED regular automatic logs only; never a wildcard ignore.
  for (const file of PLATFORM_FILES) { automaticLogIsRegular(file); }
  const inventories = {
    committed: paths('diff', '--no-renames', '--name-only', '-z', base, 'HEAD'),
    staged: paths('diff', '--no-renames', '--cached', '--name-only', '-z'),
    unstaged: paths('diff', '--no-renames', '--name-only', '-z'),
    untracked: paths('ls-files', '--others', '--exclude-standard', '-z'),
    untrackedIgnored: paths('ls-files', '--others', '--ignored', '--exclude-standard', '-z')
      .filter((file) => !file.startsWith(LAB)),
  };
  for (const [stage, files] of Object.entries(inventories)) {
    for (const file of files) {
      if ((stage === 'untracked' || stage === 'untrackedIgnored') && authorizedLogScope
        && PLATFORM_FILES.includes(file) && automaticLogIsRegular(file)) {
        platformArtifacts.push(file); continue;
      }
      if (!file.startsWith(LAB)) { violations.push(`${stage}: outside RD root: ${file}`); }
      if (stage !== 'committed' && !allowed(file)) { violations.push(`${stage}: outside RD-00 allowlist: ${file}`); }
    }
  }
  const newCommitted = paths('diff', '--no-renames', '--name-only', '-z', start, 'HEAD');
  for (const file of newCommitted) { if (!allowed(file)) { violations.push(`committed: outside RD-00 allowlist: ${file}`); } }
  const initialFiles = new Set(paths('ls-tree', '-r', '--name-only', '-z', start));
  for (const file of new Set([...newCommitted, ...inventories.staged, ...inventories.unstaged])) {
    if (initialFiles.has(file)) { violations.push(`pinned existing file changed: ${file}`); }
  }
  const labRoot = path.join(repoRoot, LAB);
  const links = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name); const stat = lstatSync(file);
      let real;
      try { real = realpathSync(file); }
      catch { violations.push(`unresolved link/reparse path: ${path.relative(repoRoot, file)}`); continue; }
      if (!within(labRoot, real)) { violations.push(`symlink/reparse escape: ${path.relative(repoRoot, file)} -> ${real}`); continue; }
      if (stat.isSymbolicLink()) { links.push(path.relative(repoRoot, file)); continue; }
      if (stat.isDirectory()) { walk(file); }
    }
  }
  if (existsSync(labRoot)) {
    if (!within(repoRoot, realpathSync(labRoot)) || lstatSync(labRoot).isSymbolicLink()) { violations.push('Lab root is a symlink/reparse escape'); }
    else { walk(labRoot); }
  }
  for (const tree of ['HEAD', start]) {
    for (const entry of paths('ls-tree', '-r', '-z', tree, '--', LAB)) {
      const [metadata, file] = entry.split('\t');
      if (metadata.startsWith('120000')) {
        const target = git('show', `${tree}:${file}`);
        if (!within(labRoot, path.resolve(repoRoot, path.dirname(file), target))) { violations.push(`committed symlink escape: ${file}`); }
      }
    }
  }
  for (const entry of paths('ls-files', '--stage', '-z', '--', LAB)) {
    const [metadata, file] = entry.split('\t');
    if (metadata.startsWith('120000')) {
      const target = git('show', `:${file}`);
      if (!within(labRoot, path.resolve(repoRoot, path.dirname(file), target))) { violations.push(`staged symlink escape: ${file}`); }
    }
  }
  let inputHashesVerified = 0;
  if (verifyPinned) {
    const coordination = `${LAB}docs/coordination/`;
    function scopedBytes(relative) {
      const full = path.join(repoRoot, relative);
      if (!within(labRoot, realpathSync(full))) { throw new Error(`Pinned source symlink/reparse escape: ${relative}`); }
      return readFileSync(full);
    }
    for (const file of ['RUN.json', 'EXECPLAN.md', '.gitattributes', 'input-package/MANIFEST.json']) {
      const relative = `${coordination}${file}`;
      if (hash(scopedBytes(relative)) !== hash(gitBytes('show', `${start}:${relative}`))) {
        violations.push(`Pinned coordination bytes changed: ${file}`);
      }
    }
    const manifest = JSON.parse(scopedBytes(`${coordination}input-package/MANIFEST.json`).toString('utf8'));
    for (const entry of manifest.files) {
      if (typeof entry.path !== 'string' || entry.path.split('/').some((part) => part === '..') || path.isAbsolute(entry.path)) {
        throw new Error('Unsafe input manifest path');
      }
      const bytes = scopedBytes(`${coordination}input-package/${entry.path}`);
      if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) { violations.push(`Original input bytes changed: ${entry.path}`); }
      else { inputHashesVerified += 1; }
    }
    if (git('rev-parse', `${base}^{tree}`).trim() !== 'cdf8a92b17eecd764bac4588054167bd566485f1') {
      violations.push('Wrong product base tree');
    }
  }
  return { ok: violations.length === 0, originalAllFilesGate: violations.length > 0 ? 'FAIL'
    : platformArtifacts.length === 0 ? 'PASS' : 'FAIL_ACCEPTED_NARROW_EXCEPTION',
    acceptedScopeDeviation: 'User authorized only two untracked regular contained automatically generated throughput logs; no agent edits/cleanup/publication',
    base, start, head: git('rev-parse', 'HEAD').trim(),
    tree: git('rev-parse', 'HEAD^{tree}').trim(), inventories, platformArtifacts,
    links, inputHashesVerified, violations, productIntegrated: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); const baseIndex = args.indexOf('--base');
    assertIsolation();
    if (args.includes('--port-check')) { await assertPortFree(); console.log('PASS: task-owned origin/namespace and free 127.0.0.1:5280'); }
    else {
      const result = inspectBoundary({ base: baseIndex >= 0 ? args[baseIndex + 1] : BASE });
      console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
