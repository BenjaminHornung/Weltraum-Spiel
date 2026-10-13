import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const producer = resolve(root, '../../../../.worktrees/Hestia-Spike-PLT-01-02-2026-10-09/spikes/plt-01-02-numerics');
const packageRoot = resolve(root, '../../../../artifacts/hestia-cloud-orchestration-2026-10-09/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const anchors = {
  'receipt.json': [13793, '5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a'],
  'NumericsProfile.json': [1386, 'c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551'],
  'SourceBindings.json': [2186, 'bd7ff8d2e7bb764b1a963234af8c1c1bc7377a92c844504623444bb28aafc82e'],
  'dependencies.lock.json': [1142, 'f40f0fa6dc38599731845822fa88e5596d5fd845a220939536fccadef935bd56'],
  'package-lock.json': [253, 'f5b5fbf862539b97a9e851252af96d5b502dbae3aa38b59ef065dcc222be84a6'],
  '.runtime/final-seal/scope-seal.json': [21203, 'b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d'],
  '.runtime/final-seal/review.patch': [1300015, '6e1a8d6a835c6d7630554d7c6235727edff0d8e9b48ec2ae66741a232cb7fe71']
};
function checked(path, expected) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('NON_REGULAR_INPUT:' + path);
  const bytes = readFileSync(path);
  if (bytes.length !== expected[0] || hash(bytes) !== expected[1]) throw Error('INPUT_DRIFT:' + path);
  return bytes;
}
const anchorBytes = Object.fromEntries(Object.entries(anchors).map(([path, expected]) => [path, checked(resolve(producer, path), expected)]));
const seal = JSON.parse(anchorBytes['.runtime/final-seal/scope-seal.json']);
if (seal.baseline !== '17b1db4201a28e7b607c30707bdc2b75e3484a10' || seal.changedFiles.length !== 102 || seal.dirtyTreeDigest !== 'sha256:e97130b2dc276016649b86f1a6452edeea11d462dc4dc3c3daa418761d3ddd57') throw Error('PRODUCER_SEAL_IDENTITY');
if ('sha256:' + hash(JSON.stringify(seal.changedFiles)) !== seal.dirtyTreeDigest) throw Error('PRODUCER_MEMBER_DIGEST');
const producerRepo = resolve(producer, '../..');
for (const member of seal.changedFiles) {
  if (!member.path.startsWith('spikes/plt-01-02-numerics/') && !member.path.startsWith('.devtoolbox/specs/changes/plt-01-02-2026-10-09/')) throw Error('FOREIGN_PRODUCER_MEMBER');
  checked(resolve(producerRepo, member.path), [member.bytes, member.digest.replace('sha256:', '')]);
}
const members = [];
function copy(source, destination, expected, provenance) {
  const stat = lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('NON_REGULAR_INPUT:' + source);
  const before = expected ? checked(source, expected) : readFileSync(source);
  const target = resolve(root, destination);
  mkdirSync(dirname(target), { recursive: true });
  if (process.argv.includes('--check')) checked(target, [before.length, hash(before)]);
  else {
    // Existing snapshots are never overwritten on drift or replay.
    try { checked(target, [before.length, hash(before)]); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      writeFileSync(target, before, { flag: 'wx' });
    }
  }
  checked(source, [before.length, hash(before)]);
  checked(target, [before.length, hash(before)]);
  members.push({ path: destination, bytes: before.length, sha256: hash(before), provenance });
}
const selected = ['README.md', 'HANDOFF.md', 'receipt.json', 'NumericsProfile.json', 'SourceBindings.json', 'dependencies.lock.json', 'package-lock.json',
  'src/numerics.mjs', 'src/fixture.mjs', 'snapshot/time.mjs', 'snapshot/time.ts', 'snapshot/ids.ts', 'snapshot/manifest.json',
  'fixtures/queries.json', 'fixtures/smoothstep-goldens.json', 'licenses/Random123.txt'];
for (const path of selected) {
  const member = seal.changedFiles.find(x => x.path === 'spikes/plt-01-02-numerics/' + path);
  if (!member) throw Error('MISSING_PRODUCER_MEMBER:' + path);
  copy(resolve(producer, path), 'inputs/plt/' + path, [member.bytes, member.digest.replace('sha256:', '')], 'PLT-01-02 frozen same-name member; unchanged');
}
copy(resolve(producer, '.runtime/final-seal/scope-seal.json'), 'inputs/plt/producer-scope-seal.json', anchors['.runtime/final-seal/scope-seal.json'], 'Detached producer seal; original location .runtime/final-seal');
const documents = ['00_START_HIER.md', '01_PRUEFUNG_UND_ENTSCHEIDUNG.md', '03_SCHNITTSTELLEN_UND_UEBERNAHME.md', 'Cloud/00_GEMEINSAMER_VERTRAG.md',
  'Auftraege/FLD-01-PHY-05.md', 'Goals/FLD-01-PHY-05.txt', 'SOURCE_DOCS.json',
  'Quellen/hestia-dimforge-technologie-audit-handoff-2026-10-09.md', 'Quellen/hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md',
  'Quellen/hestia-dynamisches-volumetrisches-wetter-architekturkonzept-2026-10-09.md'];
for (const path of documents) copy(resolve(packageRoot, path), 'inputs/contracts/' + path, null, 'Original assignment package');
for (const [path, expected] of Object.entries(anchors)) checked(resolve(producer, path), expected);
for (const member of seal.changedFiles) checked(resolve(producerRepo, member.path), [member.bytes, member.digest.replace('sha256:', '')]);
const manifest = { schema: 'fluid-input-bindings/v1', baseline: seal.baseline, producerReceiptSha256: anchors['receipt.json'][1],
  producerSealSha256: anchors['.runtime/final-seal/scope-seal.json'][1], producerReviewPatch: anchors['.runtime/final-seal/review.patch'],
  producerMembershipVerified: 102, producerDirtyDigest: seal.dirtyTreeDigest,
  profileFileSha256: anchors['NumericsProfile.json'][1], profileContentDigest: JSON.parse(anchorBytes['NumericsProfile.json']).contentDigest,
  copiedMembers: members, algorithm: 'File-byte SHA256; complete producer seal membership checked before and after each needed copy. Not a fresh producer execution or reference acceptance.' };
const manifestPath = resolve(root, 'InputBindings.json');
if (process.argv.includes('--check')) {
  const prior = JSON.parse(readFileSync(manifestPath));
  if (JSON.stringify(prior) !== JSON.stringify(manifest)) throw Error('INPUT_MANIFEST_DRIFT');
} else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS', producerMembers: 102, copiedMembers: members.length, manifestDigest: hash(readFileSync(manifestPath)) }));
