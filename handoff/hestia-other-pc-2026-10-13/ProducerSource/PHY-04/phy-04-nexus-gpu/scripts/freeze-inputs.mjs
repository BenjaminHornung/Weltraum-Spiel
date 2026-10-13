import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const workspace = 'C:/IFI_SourceCode/Temp/WeltraumSpiel';
const plt = workspace + '/.worktrees/Hestia-Spike-PLT-01-02-2026-10-09/spikes/plt-01-02-numerics';
const phy = workspace + '/.worktrees/Hestia-Spike-PHY-01-2026-10-09/spikes/phy-01-rapier-followup';
const management = workspace + '/artifacts/hestia-cloud-orchestration-2026-10-09';
const pkg = management + '/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09';
const hash = data => createHash('sha256').update(data).digest('hex');
const bare = value => value.replace(/^sha256:/, '');
const json = path => JSON.parse(readFileSync(path));
const records = [];
function bytes(path, expected, length) {
  const data = readFileSync(path);
  if (expected) assert.equal(hash(data), bare(expected), 'INPUT_DIGEST:' + path);
  if (length !== undefined) assert.equal(data.length, length, 'INPUT_LENGTH:' + path);
  return data;
}
function copy(source, destination, expected, length) {
  const data = bytes(source, expected, length);
  const target = resolve(root, destination);
  assert.ok(target.startsWith(root), 'OWN_SCOPE_REQUIRED');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  records.push({ source, path: destination, bytes: data.length, sha256: hash(data), changedPort: false });
}
function tree(base, prefix = '') {
  return readdirSync(resolve(base, prefix)).sort().flatMap(name => {
    const path = prefix ? prefix + '/' + name : name;
    const stat = lstatSync(resolve(base, path));
    assert.ok(!stat.isSymbolicLink(), 'SYMLINK_INPUT');
    return stat.isDirectory() ? tree(base, path) : [{ path, bytes: stat.size, sha256: hash(bytes(resolve(base, path))) }];
  });
}

const pr = json(plt + '/receipt.json');
bytes(plt + '/receipt.json', '5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a', 13793);
const ps = json(plt + '/.runtime/final-seal/scope-seal.json');
bytes(plt + '/.runtime/final-seal/scope-seal.json', 'b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d', 21203);
bytes(plt + '/.runtime/final-seal/review.patch', '6e1a8d6a835c6d7630554d7c6235727edff0d8e9b48ec2ae66741a232cb7fe71', 1300015);
assert.equal(hash(JSON.stringify(ps.changedFiles)), bare(ps.dirtyTreeDigest));
for (const file of ps.changedFiles) bytes(resolve(plt, '../..', file.path), file.digest, file.bytes);
assert.equal(ps.changedFiles.length, 102);
for (const file of pr.browserEvidence.sourceBindings) bytes(resolve(plt, file.path), file.sha256);
for (const file of pr.browserEvidence.servedBindings) {
  assert.equal(file.servedDigest, file.sourceDigest);
  bytes(resolve(plt, file.path), file.sourceDigest);
}
const profile = json(plt + '/NumericsProfile.json');
bytes(plt + '/NumericsProfile.json', 'c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551', 1386);
const { contentDigest, ...content } = profile;
assert.equal(hash(JSON.stringify(content)), bare(contentDigest));
assert.equal(bare(contentDigest), '64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714');
assert.equal(hash(JSON.stringify(profile.implementation)), bare(profile.implementationDigest));
for (const [path, digest] of profile.implementation) bytes(resolve(plt, path), digest);
const pltPaths = new Set([...pr.browserEvidence.sourceBindings.map(x => x.path),
  ...pr.browserEvidence.servedBindings.map(x => x.path),
  'HANDOFF.md', 'receipt.json', 'NumericsProfile.json', 'licenses/Random123.txt',
  'wasm/BUILD.md', '.runtime/final-seal/scope-seal.json', '.runtime/final-seal/review.patch']);
for (const path of [...pltPaths].sort()) copy(resolve(plt, path), 'snapshot/plt/' + path);

bytes(phy + '/delivery/receipt.json', 'f9e0fcac716cee973636822ff62d1db95c7821f7d93ba65d54aabc9c37880ede', 9854);
bytes(phy + '/delivery/seal.json', 'cae9fc22528b2f2788b35cf64b156b35f90f86f80a6d807985534dfb7a32e92e', 829);
const receipt = json(phy + '/delivery/receipt.json');
const seal = json(phy + '/delivery/seal.json');
bytes(phy + '/delivery/manifest.json', seal.manifestSha256);
bytes(phy + '/delivery/dirty-tree.json', seal.dirtyTreeSha256);
assert.equal(seal.receiptSha256, hash(bytes(phy + '/delivery/receipt.json')));
const manifest = json(phy + '/delivery/manifest.json');
assert.equal(manifest.files.length, seal.fileCount);
const phyPrefix = 'spikes/phy-01-rapier-followup/';
const lookup = new Map(manifest.files.filter(x => x.path.startsWith(phyPrefix))
  .map(x => [x.path.slice(phyPrefix.length), x]));
const native = json(phy + '/' + receipt.nativeReceipt.path);
bytes(phy + '/' + receipt.nativeReceipt.path, receipt.nativeReceipt.sha256, receipt.nativeReceipt.bytes);
assert.equal(native.sourceDigests.length, 414);
assert.equal(native.dependencySourceDigests.length, 434);
const pb = json(phy + '/' + receipt.packageBinding.path);
bytes(phy + '/' + receipt.packageBinding.path, receipt.packageBinding.sha256, receipt.packageBinding.bytes);
assert.equal(pb.files.length, 99);
assert.equal(pb.profile.wasmSha256, 'ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9');
function phyCopy(path, digest) {
  const origin = lookup.get(path);
  assert.ok(origin, 'PHY01_MANIFEST_MEMBER:' + path);
  assert.equal(origin.sha256, bare(digest ?? origin.sha256));
  copy(resolve(phy, path), 'snapshot/phy01/' + path, origin.sha256, origin.bytes);
}
const selected = new Map();
for (const file of pb.files) selected.set(file.path, file.sha256);
for (const file of native.sourceDigests) selected.set('upstream/source/' + file.path, file.sha256);
for (const file of native.dependencySourceDigests) selected.set(file.path, file.sha256);
for (const [path, file] of lookup) {
  if (path.startsWith('upstream/candidate-rust/') || path.startsWith('upstream/patches/') || path.startsWith('adapter/') ||
      path.startsWith('src/adapter/') || path.startsWith('snapshot/') ||
      path.startsWith('profiles/') || path.startsWith('src/')) selected.set(path, file.sha256);
}
for (const path of ['HANDOFF.md','delivery/manifest.json','delivery/dirty-tree.json','delivery/toolchain.json',
  'delivery/input-provenance.json','results/package-migration2.binding.json',receipt.nativeReceipt.path,
  'migration-patches.json','upstream/source-provenance.json','upstream/parry-provenance.json',
  'results/legacy-c-sealed-source-unfiltered.json']) {
  if (lookup.has(path)) selected.set(path, lookup.get(path).sha256);
}
for (const [path, digest] of selected) phyCopy(path, digest);
// Producer's four self-controls are outside its payload manifest and bound by its detached seal.
for (const path of ['delivery/receipt.json','delivery/seal.json']) copy(phy + '/' + path, 'snapshot/phy01/' + path);
const state = json(management + '/STATE.json');
const decisionPath = workspace + '/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0/PHY01_PROFILE_DECISION_R01.md';
copy(decisionPath, 'snapshot/phy01/PHY01_PROFILE_DECISION_R01.md',
  'e9b191c097bf4bd2ff1366222cb47bb8c60fcb8b71be47c58c204b1084b53a51', 5349);
const stateBytes = bytes(management + '/STATE.json');
copy(management + '/USER_OVERRIDES_2026-10-09.md', 'snapshot/contracts/USER_OVERRIDES_2026-10-09.md');
const documents = ['00_START_HIER.md','01_PRUEFUNG_UND_ENTSCHEIDUNG.md','03_SCHNITTSTELLEN_UND_UEBERNAHME.md',
  'Cloud/00_GEMEINSAMER_VERTRAG.md','Auftraege/PHY-04.md','Goals/PHY-04.txt','SOURCE_DOCS.json',
  'Quellen/hestia-dimforge-technologie-audit-handoff-2026-10-09.md',
  'Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md'];
for (const path of documents) copy(pkg + '/' + path, 'snapshot/contracts/' + path);
const upstreamRoot = resolve(root, 'upstream/source/nexus-7c94a9664ddd6468de892c2bad6f56db8f992ed7');
const upstreamFiles = tree(upstreamRoot);
const result = { schema: 'phy04.input-bindings.v1', baseline: '17b1db4201a28e7b607c30707bdc2b75e3484a10',
  frozenAt: new Date().toISOString(), originalZipSha256: '0136d515ce6c86e3110bfb7fb91e1ccf1ceb8536cbef56dad9b4d6e4a6dd3d4d',
  state: { sha256: hash(stateBytes), bytes: stateBytes.length, task: state.tasks.find(x => x.id === 'PHY-04'),
    activeIntegratorNativeId: state.a0.activeIntegratorNativeId, capacity: state.capacity.activeIds },
  plt: { dirtyFilesChecked: ps.changedFiles.length, sourceBindingsChecked: pr.browserEvidence.sourceBindings.length,
    servedBindingsChecked: pr.browserEvidence.servedBindings.length, profileFileSha256: hash(bytes(plt + '/NumericsProfile.json')),
    profileContentDigest: contentDigest, implementationDigest: profile.implementationDigest,
    wasmPurpose: 'TRIVIAL_LOAD_AND_BYTEBINDING_PROBE_NOT_PHYSICS', dependencyBindingsFile: 'dependencies.lock.json' },
  phy01: { packageFiles: pb.files.length, nativeFiles: native.sourceDigests.length, parryFiles: native.dependencySourceDigests.length,
    manifestFiles: manifest.files.length, copiedSubset: true, fullProducerPayloadRevalidated: false,
    comparator: receipt.profiles.compatibility, gyroscopicForces: false, wasmSha256: pb.profile.wasmSha256,
    firstProfileDecisionSha256: 'e9b191c097bf4bd2ff1366222cb47bb8c60fcb8b71be47c58c204b1084b53a51' },
  nexus: { repository: 'https://github.com/dimforge/nexus', tag: 'v0.6.0', commit: '7c94a9664ddd6468de892c2bad6f56db8f992ed7',
    archiveSha256: hash(bytes(resolve(root,'upstream/nexus-7c94a966.zip'))), license: 'MIT OR Apache-2.0',
    upstreamFiles, sourceDigest: hash(JSON.stringify(upstreamFiles)) },
  records, copiedFiles: records.length, recordsDigest: hash(JSON.stringify(records)) };
writeFileSync(resolve(root, 'SourceBindings.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', copied: records.length, plt: result.plt, phy01: result.phy01,
  upstreamFiles: upstreamFiles.length, nexusSourceDigest: result.nexus.sourceDigest }));
