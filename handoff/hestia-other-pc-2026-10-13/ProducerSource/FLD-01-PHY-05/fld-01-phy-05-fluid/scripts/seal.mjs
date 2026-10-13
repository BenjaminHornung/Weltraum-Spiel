// Scoped port of frozen PLT-01-02 scripts/seal.mjs; original bytes in SourceBindings.json.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, hash, fileBinding } from './bindings.mjs';

const repo = resolve(root, '../..');
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
const branch = 'feature/fld-01-phy-05-2026-10-09';
const allowed = ['spikes/fld-01-phy-05-fluid/', '.devtoolbox/specs/changes/fld-01-phy-05-2026-10-09/'];
function command(args, acceptable = [0]) {
  const result = spawnSync(git, ['-c', 'filter.lfs.process=', '-c', 'filter.lfs.clean=', '-c', 'filter.lfs.smudge=', '-c', 'filter.lfs.required=false', ...args],
    { cwd: repo, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 16 * 1024 * 1024 });
  if (!acceptable.includes(result.status)) throw Error('GIT_ERROR:' + result.status + ':' + result.stderr + ':' + (result.error?.code ?? ''));
  return result.stdout;
}
if (command(['rev-parse', 'HEAD']).toString().trim() !== baseline) throw Error('BASELINE_CHANGED');
if (command(['branch', '--show-current']).toString().trim() !== branch) throw Error('BRANCH_CHANGED');
const paths = args => command(args).toString('utf8').split('\0').filter(Boolean);
const untracked = paths(['ls-files', '--others', '--exclude-standard', '-z']);
const changed = [...new Set([...paths(['diff', '--name-only', '-z', baseline]), ...paths(['diff', '--cached', '--name-only', '-z', baseline]), ...untracked])].sort();
if (!changed.length) throw Error('EMPTY_REVIEW');
const changedFiles = changed.map(path => {
  if (!allowed.some(prefix => path.startsWith(prefix))) throw Error('OUT_OF_SCOPE:' + path);
  const stat = lstatSync(resolve(repo, path));
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('NON_REGULAR_FILE:' + path);
  return fileBinding(path, repo);
});
const tracked = command(['diff', '--binary', baseline]);
const staged = command(['diff', '--cached', '--binary', baseline]);
const unstaged = command(['diff', '--binary']);
const patch = Buffer.concat([tracked, ...untracked.sort().map(path => command(['diff', '--no-index', '--binary', '--', '/dev/null', path], [1]))]);
const indexPath = command(['rev-parse', '--git-path', 'index']).toString().trim();
const indexBytes = readFileSync(resolve(repo, indexPath));
const seal = { schema: 'fluid-scope-seal/v1', baseline, branch, scope: 'PASS', changedFiles,
  dirtyTreeDigest: 'sha256:' + hash(JSON.stringify(changedFiles)), fullTrackedDiffDigest: 'sha256:' + hash(tracked),
  stagedDiffDigest: 'sha256:' + hash(staged), unstagedDiffDigest: 'sha256:' + hash(unstaged), indexBytes: indexBytes.length, indexDigest: 'sha256:' + hash(indexBytes),
  indexEntriesDigest: 'sha256:' + hash(command(['ls-files', '--stage', '-z'])), reviewPatchDigest: 'sha256:' + hash(patch), reviewPatchBytes: patch.length,
  definition: 'Every baseline-changed tracked/staged/unstaged and nonignored-untracked path, exact index bytes/entries and full binary/new-file review patch. Ignored .runtime seal/patch, node_modules/cache/dist and ignored raw evidence are outside this Git population; explicit BuildBindings and receipt evidence bindings cover used code/tools and raw reports. No approval is asserted.' };
const destination = resolve(root, '.runtime/final-seal');
mkdirSync(destination, { recursive: true });
if (process.argv.includes('--check')) {
  const prior = JSON.parse(readFileSync(resolve(destination, 'scope-seal.json')));
  if (JSON.stringify(prior) !== JSON.stringify(seal) || hash(readFileSync(resolve(destination, 'review.patch'))) !== hash(patch)) throw Error('SEAL_STALE');
} else {
  writeFileSync(resolve(destination, 'scope-seal.json'), JSON.stringify(seal, null, 2) + '\n');
  writeFileSync(resolve(destination, 'review.patch'), patch);
}
console.log(JSON.stringify({ status: 'PASS', checked: process.argv.includes('--check'), changedFiles: changedFiles.length,
  dirtyTreeDigest: seal.dirtyTreeDigest, indexDigest: seal.indexDigest, reviewPatchDigest: seal.reviewPatchDigest, reviewPatchBytes: patch.length }));
