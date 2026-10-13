import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(root, '../..');
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
const allowed = ['spikes/plt-01-02-numerics/', '.devtoolbox/specs/changes/plt-01-02-2026-10-09/'];
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function command(args, acceptable = [0]) {
  // Export actual dirty binary bytes without invoking repository LFS filters or changing Git config.
  const r = spawnSync(git, ['-c', 'filter.lfs.process=', '-c', 'filter.lfs.clean=', '-c', 'filter.lfs.smudge=',
    '-c', 'filter.lfs.required=false', ...args], { cwd: repo, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (!acceptable.includes(r.status)) throw new Error('GIT_ERROR:' + r.status + ':' + r.stderr);
  return r.stdout;
}
if (command(['rev-parse', 'HEAD']).toString().trim() !== baseline) throw new Error('BASELINE_CHANGED');
if (command(['branch', '--show-current']).toString().trim() !== 'feature/plt-01-02-2026-10-09') throw new Error('BRANCH_CHANGED');
const nulPaths = args => command(args).toString('utf8').split('\0').filter(Boolean);
const changed = new Set([...nulPaths(['diff', '--name-only', '-z', baseline]),
  ...nulPaths(['diff', '--cached', '--name-only', '-z', baseline]),
  ...nulPaths(['ls-files', '--others', '--exclude-standard', '-z'])]);
const files = [...changed].sort().map(path => {
  if (!allowed.some(prefix => path.startsWith(prefix))) throw new Error('OUT_OF_SCOPE:' + path);
  const absolute = resolve(repo, path);
  let data;
  try {
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('NON_REGULAR_FILE:' + path);
    data = readFileSync(absolute);
  } catch (error) {
    // Only a tracked deletion may be missing; all other filesystem errors fail closed.
    if (error.code !== 'ENOENT' || !nulPaths(['diff', '--diff-filter=D', '--name-only', '-z', baseline]).includes(path)) throw error;
    return { path, deleted: true };
  }
  return { path, bytes: data.length, digest: hash(data) };
});
if (files.length === 0) throw new Error('EMPTY_REVIEW');
const trackedPatch = command(['diff', '--binary', baseline]);
const patches = [trackedPatch];
for (const path of nulPaths(['ls-files', '--others', '--exclude-standard', '-z'])) {
  patches.push(command(['diff', '--no-index', '--binary', '--', '/dev/null', path], [1]));
}
const patch = Buffer.concat(patches);
const sidecar = resolve(root, '.runtime/final-seal');
mkdirSync(sidecar, { recursive: true });
const destination = resolve(sidecar, 'scope-seal.json');
const receipt = { baseline, branch: 'feature/plt-01-02-2026-10-09', scope: 'PASS', changedFiles: files,
  dirtyTreeDigest: hash(JSON.stringify(files)), fullTrackedDiffDigest: hash(trackedPatch),
  stagedDiffDigest: hash(command(['diff', '--cached', '--binary', baseline])),
  unstagedDiffDigest: hash(command(['diff', '--binary'])),
  reviewPatchDigest: hash(patch), detachedSeal: '.runtime/final-seal/scope-seal.json',
  definition: 'All baseline changed tracked paths plus staged/unstaged/untracked nonignored paths. Ordered path/length/content SHA256 manifest. This ignored detached seal and review.patch are outside that Git population, avoiding self-referential hashes. Ignored dependency caches/profiles/dist are not source; explicit artifact/source bindings cover distributed code/WASM.' };
if (process.argv.includes('--check')) {
  const prior = JSON.parse(readFileSync(destination));
  if (prior.dirtyTreeDigest !== receipt.dirtyTreeDigest || prior.reviewPatchDigest !== receipt.reviewPatchDigest) throw new Error('SEAL_STALE');
  console.log(JSON.stringify({ status: 'PASS', check: 'full dirty tree and exact review patch unchanged', dirtyTreeDigest: receipt.dirtyTreeDigest }));
} else {
  writeFileSync(resolve(sidecar, 'review.patch'), patch);
  writeFileSync(destination, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', files: files.length, dirtyTreeDigest: receipt.dirtyTreeDigest,
    reviewPatchDigest: receipt.reviewPatchDigest, seal: destination }));
}
