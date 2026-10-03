import { importRunResult } from '../../contracts/result';
import { canonicalJson, digest, freezeJson, keys, parseBoundedJson, record, relativePath, requireValue, sha256 } from '../../contracts/validation';
import type { GalleryState } from './session';
import type { SourceBinding } from './source';
import type { Variant } from './model';

export const EVIDENCE_LIMIT = 32 * 1024 * 1024;
export type EvidenceKey = 'run' | 'image' | 'original' | 'effective' | 'fixture';
export type EvidenceFiles = Readonly<Record<EvidenceKey, { readonly name: string; readonly bytes: Uint8Array<ArrayBuffer> }>>;
export function runtimeBinding(state: GalleryState, source: SourceBinding) {
  requireValue(state.status === 'READY' && !state.busy && state.comparison && state.submission && state.selection,
    'Evidence export requires READY, settled, matching runtime');
  requireValue(state.comparison.frame.paused, 'Pause before binding a comparison image');
  return { selection: state.selection, comparison: state.comparison, backend: state.submission.backend, quality: state.submission.quality,
    source: { sourceDigest: source.sourceDigest, sourceBytesDigest: source.sourceBytesDigest, lockDigest: source.lockDigest } };
}
export function bindingTemplate(state: GalleryState, source: SourceBinding) {
  return { schema: 'rd40-comparison-binding-v1', productIntegrated: false, runtime: runtimeBinding(state, source),
    provenance: { sourceCommit: null, sourceTree: null, buildDigest: null }, files: null,
    instructions: 'HEAD capture fills real commit/tree/build and file path/SHA receipts; null/pending cannot export. LabRunResultV1 stays strict; scenarioDigest is the effective fixed-camera scenario.' };
}
export async function bindEvidence(state: GalleryState, source: SourceBinding, sidecarBytes: Uint8Array<ArrayBuffer>, files: EvidenceFiles) {
  const current = runtimeBinding(state, source); const sidecar = record(parseBoundedJson(sidecarBytes));
  keys(sidecar, ['schema', 'productIntegrated', 'runtime', 'provenance', 'files', 'instructions'], ['schema', 'productIntegrated', 'runtime', 'provenance', 'files']);
  requireValue(sidecar.schema === 'rd40-comparison-binding-v1' && sidecar.productIntegrated === false, 'Invalid tool-sidecar schema');
  requireValue(canonicalJson(sidecar.runtime) === canonicalJson(current), 'Evidence runtime/source/profile/frame/quality binding mismatch');
  const provenance = record(sidecar.provenance); keys(provenance, ['sourceCommit', 'sourceTree', 'buildDigest']);
  for (const key of ['sourceCommit', 'sourceTree']) { requireValue(typeof provenance[key] === 'string' && /^[0-9a-f]{40}$/.test(provenance[key] as string), `Missing full ${key}`); }
  digest(provenance.buildDigest); const receipts = record(sidecar.files); keys(receipts, ['run', 'image', 'original', 'effective', 'fixture']);
  const verified = await Promise.all((['run', 'image', 'original', 'effective', 'fixture'] as const).map(async (key) => {
    const file = files[key]; requireValue(file && file.bytes.length > 0 && file.bytes.length <= (key === 'image' ? EVIDENCE_LIMIT : 1024 * 1024), `Missing/oversized ${key} bytes`);
    const receipt = record(receipts[key]); keys(receipt, ['path', 'sha256']); relativePath(receipt.path); digest(receipt.sha256);
    requireValue((receipt.path as string).split('/').at(-1) === file.name, `${key} filename mismatch`);
    const hash = await sha256(file.bytes); requireValue(hash === receipt.sha256, `${key} byte hash mismatch`); return { key, path: receipt.path as string, sha256: hash };
  }));
  const hash = (key: EvidenceKey) => verified.find((item) => item.key === key)!.sha256;
  // These are complete canonical validated inputs (including snapshot manifests and payload hashes), not invented scene data.
  requireValue(hash('original') === state.comparison!.originalScenarioDigest && hash('effective') === state.comparison!.effectiveScenarioDigest
    && hash('fixture') === state.comparison!.fixtureDigest, 'Original/effective/fixture input mismatch');
  const result = importRunResult(files.run.bytes); const c = state.comparison!;
  requireValue(result.scenarioId === c.scenarioId && result.scenarioDigest === c.effectiveScenarioDigest && result.fixtureDigest === c.fixtureDigest
    && result.variantId === state.selection!.variant && canonicalJson(result.sourceRefs) === canonicalJson(c.sourceRefs), 'Strict run scenario/fixture/source mismatch');
  requireValue(result.sourceDigest === source.sourceDigest && result.sourceBytesDigest === source.sourceBytesDigest && result.lockDigest === source.lockDigest
    && result.buildDigest === provenance.buildDigest && result.backend === state.submission!.backend.label, 'Strict run source/build/backend mismatch');
  requireValue(result.runClass === 'image-motion' && result.errors.length === 0 && result.samples.failed === 0 && result.samples.observed > 0, 'Run failed, pending or not image evidence');
  requireValue(result.media.some((media) => media.kind === 'image' && media.path === verified.find((file) => file.key === 'image')!.path && media.sha256 === hash('image')), 'Image is not bound by strict run');
  const view = new DataView(files.image.bytes.buffer, files.image.bytes.byteOffset, files.image.bytes.byteLength);
  requireValue(files.image.bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a
    && view.getUint32(12) === 0x49484452 && view.getUint32(16) === c.viewport.bufferWidth && view.getUint32(20) === c.viewport.bufferHeight, 'PNG viewport binding mismatch');
  const card = freezeJson({ schema: 'rd40-comparison-card-v1', productIntegrated: false, runtime: current, provenance,
    provenanceStatus: 'EXTERNAL_RECEIPT_GIT_AND_BUILD_VERIFICATION_REQUIRED', files: verified,
    sidecarSha256: await sha256(sidecarBytes), run: result,
    limits: ['REN12 original vertex-color-omission oracle FAIL; visual adoption DEFER', 'No qualified GPU/performance/art/product evidence implied'] });
  return { card, cardHash: await sha256(new TextEncoder().encode(canonicalJson(card))) };
}
export function canExportPair(state: GalleryState, source: SourceBinding, cards: {
  readonly A?: Awaited<ReturnType<typeof bindEvidence>>['card']; readonly B?: Awaited<ReturnType<typeof bindEvidence>>['card'];
}, variants: { readonly A: Variant; readonly B: Variant }): boolean {
  if (state.status !== 'READY' || state.busy || !state.selection || !state.submission || !state.comparison?.frame.paused || !cards.A || !cards.B) { return false; }
  const current = runtimeBinding(state, source);
  return (['A', 'B'] as const).every((slot) => {
    const captured = cards[slot]!.runtime;
    return captured.selection.variant === variants[slot] && canonicalJson(captured.comparison) === canonicalJson(current.comparison)
      && canonicalJson(captured.source) === canonicalJson(current.source)
      && (captured.selection.variant !== current.selection.variant || canonicalJson(captured) === canonicalJson(current));
  });
}
