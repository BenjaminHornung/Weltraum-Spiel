import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repo = path.resolve(lab, '../..');
const labPrefix = 'experiments/hestia-rd-2026-10-02/';
const start = '89b55315fa7800a7a417c49e5e5a272f17410b4b';
const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBytes = (...args) => execFileSync(git, args, { cwd: repo, maxBuffer: 8 * 1024 * 1024, timeout: 30_000 });
const gitText = (...args) => gitBytes(...args).toString('utf8').trim();
const freezePath = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`;
const freezeBytes = readFileSync(freezePath);
const freeze = JSON.parse(freezeBytes);
const frozenFiles = freeze.frozenFiles.map((entry) => {
  const bytes = readFileSync(path.join(lab, entry.path));
  return { ...entry, actualSha256: sha256(bytes), byteLength: bytes.length, matches: entry.sha256 === sha256(bytes) };
});
const controls = [
  ['docs/coordination/input-package/05_TASKBOARD.json', 'cd5722dfff73393a2cb9d87fabf4c94f59da310300b79a7c2e87a1ec79b40448'],
  ['fixtures/inventory.json', 'cc802f0d9044f7d7ee3c3a251870c6ae2fce926ad5785fc0bb82ab93be54723f']
].map(([relative, expectedSha256]) => {
  const bytes = readFileSync(path.join(lab, relative));
  return { path: relative, expectedSha256, sha256: sha256(bytes), byteLength: bytes.length, matches: sha256(bytes) === expectedSha256 };
});
const binding = (relative) => {
  const bytes = readFileSync(path.join(lab, relative));
  const gitPath = `${labPrefix}${relative}`;
  const original = gitBytes('show', `${start}:${gitPath}`);
  if (!bytes.equals(original)) {
    throw new Error(`Changed source bytes: ${gitPath}`);
  }
  return { path: relative, gitCommit: start, blob: gitText('rev-parse', `${start}:${gitPath}`), byteLength: bytes.length, sha256: sha256(bytes) };
};
const packagePrefix = 'docs/coordination/input-package/';
const originals = JSON.parse(readFileSync(path.join(lab, packagePrefix, 'sources/project_sources.json'))).sources;
const inputs = [...originals.map((source) => `${packagePrefix}${source.package_path}`),
  `${packagePrefix}02_QUELLEN_UND_REDDIT.md`, `${packagePrefix}sources/web_sources.json`,
  `${packagePrefix}sources/project_sources.json`, `${packagePrefix}tasks/RD-01.md`].sort().map(binding);
for (const source of originals) {
  const input = inputs.find((entry) => entry.path === `${packagePrefix}${source.package_path}`);
  if (input.sha256 !== source.sha256 || input.byteLength !== source.bytes) {
    throw new Error(`Original manifest mismatch: ${input.path}`);
  }
}
const tree = gitText('rev-parse', `${base}^{tree}`);
const entries = gitText('ls-tree', '-r', '--long', base).split('\n').map((line) => {
  const match = line.match(/^(\d+) blob ([0-9a-f]+)\s+(\d+)\t(.+)$/);
  return match ? { mode: match[1], blob: match[2], byteLength: Number(match[3]), path: match[4] } : null;
}).filter(Boolean);
const targets = ['target-01-coastal-valley.png', 'target-02-archipelago-mountain.png', 'target-03-wetland-roots.png',
  'target-04-terraced-coast.png', 'target-05-lagoon-channel.png', 'target-06-forested-island.png'];
const assets = targets.map((name, index) => {
  const matches = entries.filter((entry) => path.posix.basename(entry.path) === name);
  if (matches.length !== 0) {
    throw new Error(`Expected missing target changed; inspect actual pinned bytes: ${name}`);
  }
  return { id: `TARGET-0${index + 1}`, role: 'HISTORICAL_CONCEPT_TARGET', requestedBasename: name,
    gitCommit: base, searchedTree: tree, searchScope: 'ENTIRE_PINNED_GIT_TREE_EXACT_BASENAME',
    path: null, blob: null, byteLength: null, sha256: null, availability: 'MISSING_AT_PIN', license: 'UNKNOWN' };
});
for (const entry of entries.filter((item) => item.path.startsWith('apps/weltraum-browser/evidence/hvp13-candidate05/') && item.path.endsWith('.png'))) {
  const bytes = gitBytes('cat-file', 'blob', entry.blob);
  const pointer = bytes.toString('ascii').match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)\n$/);
  if (!pointer) {
    throw new Error(`Expected pointer changed; inspect image without promoting Art acceptance: ${entry.path}`);
  }
  assets.push({ id: path.posix.basename(entry.path, '.png').toUpperCase(), role: 'HISTORICAL_RUNTIME_EVIDENCE_NOT_CONCEPT_SUBSTITUTE',
    gitCommit: base, path: entry.path, blob: entry.blob, byteLength: bytes.length, sha256: sha256(bytes),
    availability: 'LFS_POINTER_ONLY', lfsPayloadOidSha256: pointer[1], lfsPayloadExpectedBytes: Number(pointer[2]),
    lfsPayloadRetrieved: false, license: 'UNKNOWN' });
}
if (frozenFiles.length !== 18 || !frozenFiles.every((entry) => entry.matches) || !controls.every((entry) => entry.matches) || assets.length !== 11) {
  throw new Error('Freeze/control/concept inventory mismatch');
}
const result = { taskId: 'RD-01', auditedAt: new Date().toISOString(), productIntegrated: false,
  start, startTree: gitText('rev-parse', `${start}^{tree}`), productReadBase: base, productReadTree: tree,
  freezePath, freezeSha256: sha256(freezeBytes), frozenFiles, controls, inputs, assets,
  observedIntervals: [], mediaStatus: 'NOT_VIEWED', artStatus: 'NOT_RUN',
  policy: 'Local immutable Git blobs only. No LFS pull/fetch, image playback, product or Art writes. Pointer hash is not image payload hash.' };
if (process.argv.includes('--write-report')) {
  writeFileSync(new URL('./source-audit.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
}
console.log(JSON.stringify(result, null, 2));
