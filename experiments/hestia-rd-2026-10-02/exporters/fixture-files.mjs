import { readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { PAYLOAD_CAP, exportImportedFixture, sha } from './fixture-export.mjs';
import { ownedPath, writeOwned } from './stage-source.mjs';

export function writeBundle(directory, bundle, recipe, contracts) {
  ownedPath(directory, true);
  const roundtrip = exportImportedFixture(bundle.fixture, contracts);
  if (!Buffer.from(roundtrip.manifestBytes).equals(Buffer.from(bundle.manifestBytes))) { throw new Error('Canonical manifest roundtrip mismatch'); }
  for (const descriptor of bundle.manifest.payloads) {
    const bytes = bundle.payloads.get(descriptor.id);
    if (!Buffer.from(roundtrip.payloads.get(descriptor.id)).equals(Buffer.from(bytes)) || sha(bytes) !== descriptor.sha256) {
      throw new Error('Payload roundtrip/hash mismatch');
    }
    writeOwned(path.join(directory, descriptor.path), bytes, true);
  }
  writeOwned(path.join(directory, 'manifest.json'), bundle.manifestBytes, true);
  writeOwned(path.join(directory, 'recipe.json'), `${contracts.canonicalJson(recipe)}\n`, true);
}
/** @returns {Promise<{fixture: import('../src/contracts/fixture').LabFixtureV1, manifestBytes: Uint8Array, payloads: Map<string, Uint8Array>}>} */
export async function readFixtureDirectory(directory, contracts) {
  const root = ownedPath(directory, true);
  const manifestPath = path.join(root, 'manifest.json');
  if (!lstatSync(manifestPath).isFile() || lstatSync(manifestPath).size > 1_048_576) { throw new Error('Manifest exceeds 1 MiB or is not regular'); }
  const bytes = readFileSync(manifestPath); const manifest = contracts.parseBoundedJson(bytes);
  contracts.validateSourceRefs(manifest.sourceRefs, manifest.kind);
  contracts.array(manifest.payloads);
  let advertised = 0;
  // Every descriptor and actual regular-file size before reading/copying any
  // binary data. Frozen import performs complete schema/content validation.
  for (const payload of manifest.payloads) {
    contracts.relativePath(payload.path); contracts.id(payload.id); contracts.digest(payload.sha256);
    contracts.integer(payload.byteLength); advertised += payload.byteLength;
    if (!Number.isSafeInteger(advertised) || advertised > PAYLOAD_CAP) { throw new Error('Scene payload exceeds 128 MiB'); }
  }
  for (const payload of manifest.payloads) {
    const file = ownedPath(path.join(root, payload.path), true); const stat = lstatSync(file);
    if (!file.startsWith(`${root}${path.sep}`) || !stat.isFile() || stat.size !== payload.byteLength) { throw new Error('Payload file size/type mismatch'); }
  }
  const payloads = new Map(manifest.payloads.map(p => [p.id, readFileSync(path.join(root, p.path))]));
  const fixture = await contracts.importFixture(bytes, payloads);
  const roundtrip = exportImportedFixture(fixture, contracts);
  if (!Buffer.from(bytes).equals(Buffer.from(roundtrip.manifestBytes))
    || [...payloads].some(([id, data]) => !data.equals(Buffer.from(roundtrip.payloads.get(id))))) {
    throw new Error('Static artifact is not a canonical exact roundtrip');
  }
  return { fixture, manifestBytes: bytes, payloads };
}
