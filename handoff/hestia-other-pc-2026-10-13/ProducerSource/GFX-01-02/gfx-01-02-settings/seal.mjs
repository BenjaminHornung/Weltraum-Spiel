import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const spike = dirname(fileURLToPath(import.meta.url));
const repo = resolve(spike, '../..');
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
const prefix = 'spikes/gfx-01-02-settings/';
const changePrefix = '.devtoolbox/specs/changes/gfx-01-02-2026-10-09/';
const sealPath = prefix + 'seal.json';
const patchPath = prefix + 'review-diff.patch';
const migrationPath = prefix + 'migration.patch';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = args => execFileSync(git, args, { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
const list = bytes => bytes.toString('utf8').split('\0').filter(Boolean);
const allowed = path => !path.includes('..') && !path.includes('\\') && (path.startsWith(prefix) || path.startsWith(changePrefix));
const entry = path => { assert(lstatSync(resolve(repo, path)).isFile(), `Non-regular payload: ${path}`); const bytes = readFileSync(resolve(repo, path)); return { path, bytes: bytes.length, sha256: hash(bytes) }; };
const treeDigest = entries => hash(Buffer.from(JSON.stringify(entries)));
const dirtyPaths = () => [...new Set([
  ...list(command(['diff', '--name-only', '-z', baseline])),
  ...list(command(['diff', '--cached', '--name-only', '-z', baseline])),
  ...list(command(['diff', '--name-only', '-z'])),
  ...list(command(['ls-files', '--others', '--exclude-standard', '-z']))
])].sort();
function scopeCheck() {
  assert.equal(command(['rev-parse', 'HEAD']).toString().trim(), baseline, 'Wrong baseline');
  assert.equal(command(['branch', '--show-current']).toString().trim(), 'feature/gfx-01-02-2026-10-09', 'Wrong branch');
  const paths = dirtyPaths();
  assert(paths.length > 0, 'Empty review is not acceptable');
  for (const path of paths) assert(allowed(path), `Out-of-scope dirty path: ${path}`);
  assert.equal(list(command(['diff', '--cached', '--name-only', '-z', baseline])).length, 0, 'This uncommitted handoff requires a clean index; staging invalidates the seal');
  return paths;
}
function filesUnder(path) {
  const result = [];
  for (const name of readdirSync(resolve(repo, path)).sort()) {
    const child = path + '/' + name;
    const info = lstatSync(resolve(repo, child));
    assert(!info.isSymbolicLink(), `Symlink in build payload: ${child}`);
    if (info.isDirectory()) result.push(...filesUnder(child));
    else result.push(entry(child));
  }
  return result;
}
if (process.argv.includes('--self-test')) {
  assert(allowed(prefix + 'src/quality.ts'));
  for (const path of ['apps/weltraum-browser/src/settings/types.ts', prefix + '../secret', 'C:/foreign', '.devtoolbox/verify.json']) assert.equal(allowed(path), false);
  assert.notEqual(treeDigest([{ path: 'x', sha256: 'a', bytes: 1 }]), treeDigest([{ path: 'x', sha256: 'b', bytes: 1 }]));
  scopeCheck();
  console.log('SEAL_SELF_TEST_PASS: foreign paths and payload tampering rejected');
} else if (process.argv.includes('--write')) {
  const initialPaths = scopeCheck().filter(path => ![sealPath, patchPath, migrationPath].includes(path));
  const omittedPrivateLogs = [];
  const chunks = [];
  // Raw review exports must not invoke repository LFS clean filters.
  const rawDiff = ['-c', 'filter.lfs.process=', '-c', 'filter.lfs.clean=', '-c', 'filter.lfs.required=false'];
  for (const path of initialPaths) {
    assert(lstatSync(resolve(repo, path)).isFile(), `Non-regular review payload: ${path}`);
    const bytes = readFileSync(resolve(repo, path));
    if (/[A-Z]:\\+Users\\+/i.test(bytes.toString('utf8'))) { omittedPrivateLogs.push(entry(path)); continue; }
    const result = spawnSync(git, [...rawDiff, 'diff', '--no-index', '--binary', '--no-renames', '--', '/dev/null', path], { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
    assert([0, 1].includes(result.status), `Diff error for ${path}: ${result.stderr?.toString()}`);
    chunks.push(result.stdout);
  }
  writeFileSync(resolve(repo, patchPath), Buffer.concat(chunks));
  const migration = [];
  for (const name of readdirSync(resolve(spike, 'settings-v2-candidate/src/settings')).sort()) {
    const control = prefix + 'control/src/settings/' + name;
    const candidate = prefix + 'settings-v2-candidate/src/settings/' + name;
    const result = spawnSync(git, ['diff', '--no-index', '--no-renames', '--', control, candidate], { cwd: repo, maxBuffer: 4 * 1024 * 1024 });
    assert([0, 1].includes(result.status), `Migration diff error: ${name}`);
    migration.push(result.stdout.toString('utf8').replaceAll(control, 'apps/weltraum-browser/src/settings/' + name).replaceAll(candidate, 'apps/weltraum-browser/src/settings/' + name).replaceAll('../../../control/src/settings/validation', './legacyV1/validation'));
  }
  for (const name of ['validation.ts', 'schema.ts', 'presets.ts', 'types.ts']) {
    const control = prefix + 'control/src/settings/' + name;
    const result = spawnSync(git, ['diff', '--no-index', '--no-renames', '--', '/dev/null', control], { cwd: repo, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 1, `Legacy migration snapshot diff error: ${name}`);
    migration.push(result.stdout.toString('utf8').replaceAll(control, 'apps/weltraum-browser/src/settings/legacyV1/' + name));
  }
  writeFileSync(resolve(repo, migrationPath), migration.join(''));
  const paths = scopeCheck().filter(path => path !== sealPath);
  const entries = paths.map(entry);
  const builtArtifacts = filesUnder(prefix + 'dist');
  const productTrackedChanges = list(command(['diff', '--name-only', '-z', baseline, '--', 'apps', 'Assets', 'Packages', 'ProjectSettings']));
  assert.equal(productTrackedChanges.length, 0, 'Product changed');
  writeFileSync(resolve(repo, sealPath), JSON.stringify({
    schemaVersion: 1, baseline, branch: 'feature/gfx-01-02-2026-10-09',
    digestAlgorithm: 'SHA256(UTF8(JSON.stringify(entries sorted by path)))',
    selfExclusion: 'seal.json is the sole self-excluded envelope; every other dirty file, including receipt, exports and restricted raw logs, is bound.',
    ignoredGeneratedDirectories: ['node_modules', 'dist'], builtArtifacts,
    gitStatusPorcelain: command(['status', '--porcelain=v1', '--untracked-files=all']).toString(),
    entries, dirtyTreeDigest: treeDigest(entries),
    productTrackedChanges, cleanIndexRequired: true, reviewPatchPrivateLogOmissions: omittedPrivateLogs,
    wasm: { status: 'NOT_APPLICABLE', reason: 'No game/WASM dependency used.' },
    shader: { status: 'NOT_APPLICABLE', reason: 'Probe renderer uses clear/scissor, no custom shaders or product shader changes.' }
  }, null, 2) + '\n');
  console.log(`SEALED ${entries.length} dirty files; ${treeDigest(entries)}`);
} else if (process.argv.includes('--verify')) {
  const sealed = JSON.parse(readFileSync(resolve(repo, sealPath), 'utf8'));
  const paths = scopeCheck().filter(path => path !== sealPath);
  assert.deepEqual(paths, sealed.entries.map(item => item.path), 'Dirty file set changed');
  const actual = paths.map(entry);
  assert.equal(treeDigest(actual), sealed.dirtyTreeDigest, 'Dirty bytes changed');
  assert.deepEqual(actual, sealed.entries, 'Entry changed');
  assert.deepEqual(filesUnder(prefix + 'dist'), sealed.builtArtifacts, 'Build bytes changed');
  console.log(`SEAL_VERIFY_PASS ${actual.length} dirty files; ${sealed.dirtyTreeDigest}`);
} else throw Error('Use --write, --verify or --self-test');
