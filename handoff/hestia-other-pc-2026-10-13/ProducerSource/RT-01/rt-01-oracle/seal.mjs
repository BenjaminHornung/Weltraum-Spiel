import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256, canonical } from './fixtures.mjs';

const spike = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(spike, '../..');
const base = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
const gitExe = 'C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe';
const compiler = 'C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-CutV3-Resume-2026-10-05\\apps\\weltraum-browser\\node_modules\\typescript';
const scope = ['spikes/rt-01-oracle/', 'spikes/_shared/rt-2026-10-09/', '.devtoolbox/specs/changes/rt-01-2026-10-09/'];
const envelopePath = 'spikes/rt-01-oracle/binding-manifest.json';
const receiptPath = 'spikes/rt-01-oracle/receipt.json';
const git = args => execFileSync(gitExe, ['-C', root, '-c', 'filter.lfs.process=', '-c', 'filter.lfs.clean=',
  '-c', 'filter.lfs.required=false', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const encoded = value => Buffer.from(`${canonical(value)}\n`);
const record = async (file, label = file) => {
  const info = await lstat(file);
  assert.ok(info.isFile() && !info.isSymbolicLink(), `Regular file required: ${label}`);
  const bytes = await readFile(file);
  return { path: label, byteLength: bytes.length, sha256: sha256(bytes) };
};

async function currentBinding(receipt) {
  assert.equal(git(['rev-parse', 'HEAD']).trim(), base, 'Fixed base HEAD');
  assert.equal(git(['branch', '--show-current']).trim(), 'feature/rt-01-2026-10-09', 'Owned feature branch');
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const files = [];
  for (const entry of status.split('\0').filter(Boolean)) {
    const state = entry.slice(0, 2);
    const name = entry.slice(3);
    assert.ok(!/[DRCU!]/.test(state), `Unsupported dirty operation: ${state} ${name}`);
    assert.ok(scope.some(prefix => name.startsWith(prefix)), `Dirty path outside RT-01: ${name}`);
    if (name === envelopePath) continue; // The envelope cannot hash itself.
    if (name === receiptPath) {
      const normalized = structuredClone(receipt);
      normalized.source.dirtyTreeSha256 = null;
      normalized.source.bindingManifestSha256 = null;
      const bytes = encoded(normalized);
      files.push({ path: name, gitState: state, byteLength: bytes.length, sha256: sha256(bytes),
        normalization: 'Only dirtyTreeSha256 and bindingManifestSha256 are null to remove self reference' });
    } else files.push({ ...(await record(path.join(root, name), name)), gitState: state });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  // Bind staged bytes as Git blob identities as well as current working-tree bytes.
  const index = git(['ls-files', '--stage', '-z', '--', ...scope]).split('\0').filter(Boolean).sort();
  const compiled = [];
  async function compiledFiles(directory, prefix) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      assert.ok(!entry.isSymbolicLink(), 'No compiled symlinks');
      const name = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await compiledFiles(path.join(directory, entry.name), name);
      else compiled.push(await record(path.join(directory, entry.name), name));
    }
  }
  await compiledFiles(path.join(spike, '.build'), 'spikes/rt-01-oracle/.build');
  const evidence = [];
  const evidenceDir = '.devtoolbox/specs/changes/rt-01-2026-10-09/tests';
  for (const name of (await readdir(path.join(root, evidenceDir))).filter(n => n.endsWith('.log')).sort()) {
    evidence.push(await record(path.join(root, evidenceDir, name), `${evidenceDir}/${name}`));
  }
  const external = [];
  const nativeCompiler = (await import(pathToFileURL(path.join(compiler, 'lib', 'getExePath.js')).href)).default();
  assert.ok(path.resolve(nativeCompiler).toLowerCase().startsWith('c:\\ifi_sourcecode\\'), 'Compiler stays in approved execution root');
  for (const [file, label] of [[process.execPath, 'node-executable'], [gitExe, 'git-executable'],
    [path.join(compiler, 'lib', 'tsc.js'), 'typescript/lib/tsc.js'],
    [path.join(compiler, 'lib', 'getExePath.js'), 'typescript/lib/getExePath.js'],
    [path.join(compiler, 'lib', 'version.cjs'), 'typescript/lib/version.cjs'],
    [nativeCompiler, 'typescript-win32-x64/lib/tsc.exe'],
    [path.resolve(path.dirname(nativeCompiler), '../package.json'), 'typescript-win32-x64/package.json'],
    [path.join(compiler, 'package.json'), 'typescript/package.json'],
    [path.join(root, 'apps/weltraum-browser/src/hestia-prototype/terrain/picking.ts'), 'fixed-base-product-control-picking.ts']]) {
    external.push(await record(file, label));
  }
  const receiptFound = files.some(f => f.path === receiptPath);
  assert.ok(receiptFound, 'Receipt must be part of the full dirty inventory');
  return { schema: 'hestia.rt01-byte-binding.v1', baseCommit: base, branch: 'feature/rt-01-2026-10-09',
    files, index, compiled, evidence, external, runtime: process.version,
    exclusions: [
      { path: envelopePath, reason: 'Self-referential seal envelope; its exact SHA256 is stored in receipt.json' },
      { path: 'spikes/rt-01-oracle/tamper-negative-*/', reason: 'Ignored isolated negative-test copies, never consumer/source inputs. Frozen originals are fully bound.' },
    ] };
}

const receipt = JSON.parse(await readFile(path.join(root, receiptPath)));
assert.equal(receipt.source.baseCommit, base);
assert.equal(receipt.status.environmentEvidence, 'LOCAL_WINDOWS_ISOLATED');
assert.equal(receipt.status.productIntegrated, false);
if (process.argv[2] === '--write') {
  receipt.source.lockSha256 = sha256(await readFile(path.join(spike, 'package-lock.json')));
  receipt.source.fixtureManifestSha256 = sha256(await readFile(path.join(root, 'spikes/_shared/rt-2026-10-09/v1/manifest.json')));
}
let current = await currentBinding(receipt);
if (process.argv[2] === '--write') {
  receipt.source.binaryDigests = [...current.compiled, ...current.external];
  current = await currentBinding(receipt);
}
const dirtyDigest = sha256(encoded(current));
if (process.argv[2] === '--write') {
  await writeFile(path.join(root, envelopePath), encoded(current));
  receipt.source.dirtyTreeSha256 = dirtyDigest;
  receipt.source.bindingManifestSha256 = sha256(encoded(current));
  await writeFile(path.join(root, receiptPath), encoded(receipt));
  console.log(JSON.stringify({ status: 'PASS', dirtyTreeSha256: dirtyDigest, dirtyFiles: current.files.length,
    compiledFiles: current.compiled.length, externalBindings: current.external.length }));
} else if (process.argv[2] === '--verify') {
  const actual = await readFile(path.join(root, envelopePath));
  assert.deepEqual(actual, encoded(current), 'Exact full dirty, compiled and use-time source binding');
  assert.equal(receipt.source.dirtyTreeSha256, dirtyDigest);
  assert.equal(receipt.source.bindingManifestSha256, sha256(actual));
  assert.equal(receipt.source.lockSha256, sha256(await readFile(path.join(spike, 'package-lock.json'))));
  assert.equal(receipt.source.fixtureManifestSha256, sha256(await readFile(path.join(root, 'spikes/_shared/rt-2026-10-09/v1/manifest.json'))));
  console.log(JSON.stringify({ status: 'PASS', dirtyTreeSha256: dirtyDigest, dirtyFiles: current.files.length,
    compiledFiles: current.compiled.length, externalBindings: current.external.length }));
} else throw new Error('Use --write once final evidence/docs are complete, then --verify');
