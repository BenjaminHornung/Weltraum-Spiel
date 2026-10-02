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
const OWNED_REPOSITORY = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02';
const OWNED_WORKTREES = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees';
const PLATFORM_FILES = ['.opencode/throughput.jsonl', '.opencode/throughput.md'];
const LOCATION_LOGS = [...PLATFORM_FILES, ...PLATFORM_FILES.map((file) => `${LAB}${file}`)];
const BOARD_SHA256 = 'cd5722dfff73393a2cb9d87fabf4c94f59da310300b79a7c2e87a1ec79b40448';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const within = (root, file) => { const relative = path.relative(root, file); return relative === ''
  || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };

function taskAllowlist(task) {
  const bytes = readFileSync(new URL('../docs/coordination/input-package/05_TASKBOARD.json', import.meta.url));
  if (hash(bytes) !== BOARD_SHA256) { throw new Error('Original taskboard bytes changed'); }
  const board = JSON.parse(bytes.toString('utf8'));
  if (task === 'HEAD') { return ['**']; }
  const entries = board.tasks.find((entry) => entry.id === task)?.write_allowlist
    ?? (board.coordinator_report_roots[task] ? [board.coordinator_report_roots[task]] : undefined);
  if (!entries) { throw new Error(`Unknown task profile: ${task}`); }
  return entries;
}

/** @param {{task?: string, origin?: string, databaseName?: string, runRoot?: string}} options */
export function assertIsolation({ task = 'RD-00', origin = 'http://127.0.0.1:5280', databaseName, runRoot } = {}) {
  if (!/^RD-\d{2}$/.test(task)) { throw new Error('Runtime requires a real RD task profile'); }
  taskAllowlist(task);
  const namespace = `hestia-rd-${task.replace('RD-', 'rd')}`;
  const artifacts = path.resolve(RUN_ROOT, '..', task);
  databaseName ??= namespace;
  runRoot ??= artifacts;
  const url = new URL(origin);
  if (url.href !== 'http://127.0.0.1:5280/' || url.username || url.password) {
    throw new Error('Only task-owned loopback origin http://127.0.0.1:5280 is allowed; no product origin');
  }
  if (!/^[a-z0-9-]+$/.test(databaseName) || (databaseName !== namespace && !databaseName.startsWith(`${namespace}-`))) {
    throw new Error('Shared/product/cross-task database forbidden');
  }
  if (!within(artifacts, path.resolve(runRoot))) { throw new Error(`Run artifacts outside ${task} root`); }
  const ownerRoot = path.dirname(artifacts);
  for (let cursor = path.resolve(runRoot); within(ownerRoot, cursor); cursor = path.dirname(cursor)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) { throw new Error('Run root link/non-directory forbidden'); }
    if (cursor === ownerRoot) { break; }
  }
}

export async function assertPortFree(port = 5280) {
  if (port !== 5280) { throw new Error('Lab requires strict port 5280; no fallback'); }
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', (error) => { reject(new Error(`Port 127.0.0.1:5280 is not free: ${error.message}`)); });
    server.listen({ port, host: '127.0.0.1', exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => { server.close((error) => { if (error) { reject(error); } else { resolve(); } }); });
}

/** @param {{repoRoot?: string, base?: string, start?: string, task?: string, gitPath?: string, verifyPinned?: boolean}} options */
export function inspectBoundary(options = {}) {
  const repoRoot = options.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const base = options.base ?? BASE; const start = options.start ?? START; const task = options.task ?? 'RD-00';
  const gitPath = options.gitPath ?? GIT; const verifyPinned = options.verifyPinned ?? true;
  if (task !== 'RD-00' && !options.start) { throw new Error('Explicit immutable task start SHA required'); }
  if (!/^[0-9a-f]{40}$/.test(base) || !/^[0-9a-f]{40}$/.test(start)) { throw new Error('Full immutable base/start SHA required'); }
  if (verifyPinned && base !== BASE) { throw new Error('Product read base must remain the exact b3 checkpoint'); }
  if (!within('C:/IFI_SourceCode', path.resolve(repoRoot)) || !within('C:/IFI_SourceCode', path.resolve(gitPath))) {
    throw new Error('Execution target outside C:/IFI_SourceCode');
  }
  const gitBytes = (...args) => execFileSync(gitPath, args, { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const git = (...args) => gitBytes(...args).toString('utf8');
  const paths = (...args) => git(...args).split('\0').filter(Boolean);
  git('merge-base', '--is-ancestor', start, 'HEAD');
  const writeAllowlist = taskAllowlist(task);
  const allowed = (file) => file.startsWith(LAB) && !LOCATION_LOGS.includes(file)
    && writeAllowlist.some((entry) => entry === '**' || (entry.endsWith('/**')
      ? file.slice(LAB.length).startsWith(entry.slice(0, -2)) : file.slice(LAB.length) === entry));
  const violations = []; const platformArtifacts = [];
  const ownedRoot = path.resolve(repoRoot).replaceAll('\\', '/');
  const commonDirectory = path.resolve(git('rev-parse', '--path-format=absolute', '--git-common-dir').trim());
  const ownedCheckout = (path.resolve(repoRoot) === path.resolve(OWNED_REPOSITORY) || within(OWNED_WORKTREES, repoRoot))
    && commonDirectory.toLowerCase() === path.resolve(OWNED_REPOSITORY, '.git').toLowerCase();
  const authorizedLogScope = ownedCheckout || (!verifyPinned && ownedRoot.startsWith(`${RUN_ROOT}/oracles/boundary-`));
  function automaticLogIsRegular(file) {
    const full = path.join(repoRoot, file);
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (!stat) { return false; }
    const parent = path.dirname(full);
    const safe = stat.isFile() && !stat.isSymbolicLink() && !lstatSync(parent).isSymbolicLink()
      && within(repoRoot, realpathSync(full)) && within(repoRoot, realpathSync(parent));
    if (!safe) { violations.push(`automatic-log name is not a regular contained file (symlink/junction/escape): ${file}`); }
    return safe;
  }
  // The user's explicit exception is UNTRACKED regular automatic logs only; never a wildcard ignore.
  for (const file of LOCATION_LOGS) { automaticLogIsRegular(file); }
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
        && LOCATION_LOGS.includes(file) && automaticLogIsRegular(file)) {
        platformArtifacts.push(file); continue;
      }
      if (LOCATION_LOGS.includes(file)) { violations.push(`${stage}: automatic logs must never be tracked/staged/committed: ${file}`); }
      if (!file.startsWith(LAB)) { violations.push(`${stage}: outside RD root: ${file}`); }
      if (stage !== 'committed' && !allowed(file)) { violations.push(`${stage}: outside ${task} allowlist: ${file}`); }
    }
  }
  const newCommitted = paths('diff', '--no-renames', '--name-only', '-z', start, 'HEAD');
  for (const file of newCommitted) { if (!allowed(file)) { violations.push(`committed: outside ${task} allowlist: ${file}`); } }
  const initialFiles = new Set(paths('ls-tree', '-r', '--name-only', '-z', start));
  for (const file of new Set([...newCommitted, ...inventories.staged, ...inventories.unstaged])) {
    if (initialFiles.has(file) && (task === 'RD-00' || !allowed(file))) { violations.push(`pinned existing file changed: ${file}`); }
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
      if (hash(scopedBytes(relative)) !== hash(gitBytes('show', `${START}:${relative}`))) {
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
    base, start, task, writeAllowlist, taskboardSha256: BOARD_SHA256, commonDirectory,
    head: git('rev-parse', 'HEAD').trim(),
    tree: git('rev-parse', 'HEAD^{tree}').trim(), inventories, platformArtifacts,
    links, inputHashesVerified, violations, productIntegrated: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const argument = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
    const task = argument('--task', 'RD-00');
    assertIsolation({ task: task.startsWith('RD-') ? task : 'RD-00' });
    if (args.includes('--port-check')) { await assertPortFree(); console.log('PASS: task-owned origin/namespace and free 127.0.0.1:5280'); }
    else {
      const result = inspectBoundary({ base: argument('--base', BASE), task: argument('--task', 'RD-00'), start: argument('--start', undefined) });
      console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
