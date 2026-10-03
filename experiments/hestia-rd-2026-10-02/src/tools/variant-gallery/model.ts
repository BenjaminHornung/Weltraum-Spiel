import type { LabFrameInput } from '../../contracts/experiment';
import { getFixtureDigest, type SourceRef } from '../../contracts/fixture';
import { createScenario, getScenarioDigest, type sampleScenario } from '../../contracts/scenario';
import { canonicalJson, finite, integer, requireValue } from '../../contracts/validation';
import type { loadReplay } from '../../runner/assets';

export type Variant = 'fixture-control' | 'C1' | 'C2';
export class GalleryDisposalError extends Error {}
export interface Selection { readonly scenarioId: string; readonly variant: Variant; readonly cameraId: string;
  readonly width: number; readonly height: number; readonly dpr: number; }
export type Replay = Awaited<ReturnType<typeof loadReplay>>;
export type Sample = ReturnType<typeof sampleScenario>;
export const NATIVE_SCENARIOS = ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY'] as const;
export function cameras(replay: Replay): readonly string[] {
  return replay.initialFixture.cameras.map((camera) => camera.id).filter((id) => replay.scenario.snapshots.every((event) => event.manifest.cameras.some((camera) => camera.id === id)));
}
export async function deriveReplay(replay: Replay, selection: Selection) {
  requireValue(replay.scenario.id === selection.scenarioId, 'Scenario selection mismatch');
  requireValue(['fixture-control', 'C1', 'C2'].includes(selection.variant), 'Unknown gallery factory');
  requireValue(selection.variant === 'fixture-control' || (NATIVE_SCENARIOS as readonly string[]).includes(selection.scenarioId), 'C1/C2 only support F01, F04, F06 in this slice');
  integer(selection.width, 1); integer(selection.height, 1); finite(selection.dpr, 1, 2);
  requireValue(selection.width <= 4096 && selection.height <= 4096, 'Viewport exceeds gallery limit');
  requireValue(cameras(replay).includes(selection.cameraId), 'Fixed camera must exist in every frozen snapshot');
  const effective = createScenario({ ...replay.scenario, initialCameraId: selection.cameraId,
    keyframes: replay.scenario.keyframes.filter((event) => event.type !== 'SelectCamera') }, replay.initialFixture);
  return { ...replay, effective, originalDigest: replay.scenarioDigest, effectiveDigest: await getScenarioDigest(effective) };
}
export type PreparedReplay = Awaited<ReturnType<typeof deriveReplay>>;
export interface Submission {
  readonly frame: LabFrameInput; readonly fixtureDigest: string; readonly resetTick: number | null;
  readonly backend: { readonly requested: string; readonly actual: string; readonly label: string };
  readonly resolution: { readonly width: number; readonly height: number; readonly dpr: number; readonly bufferWidth: number; readonly bufferHeight: number };
  readonly presentationProfile: string; readonly sourceRefs: readonly SourceRef[];
  readonly quality: { readonly requested: unknown; readonly observed: unknown };
  readonly submittedFrames: number; readonly projectionGeneration: number | null;
  readonly rendered: { readonly tick: number; readonly fixtureDigest: string; readonly sourceRevision: number; readonly resetTick: number | null;
    readonly cameraId: string | null; readonly projectionGeneration: number | null } | null;
  readonly errors: readonly string[]; readonly unsupportedFeatures: readonly string[]; readonly logicalCosts: unknown;
}
/** C0 has no rendered camera/resize generation: current frame plus NEW submission is essential. */
export function matchesSubmission(value: Submission, sample: Sample, selection: Selection, baseline: number): boolean {
  const rendered = value.rendered; const requested = selection.variant === 'C2' ? 'webgpu' : 'webgl2';
  return value.submittedFrames > baseline && rendered !== null && value.errors.length === 0
    && value.backend.requested === requested && value.backend.actual === requested
    && value.fixtureDigest === getFixtureDigest(sample.fixture) && value.resetTick === sample.resetTick
    && canonicalJson(value.frame) === canonicalJson(sample.frame)
    && value.resolution.width === selection.width && value.resolution.height === selection.height && value.resolution.dpr === selection.dpr
    && value.resolution.bufferWidth === Math.floor(selection.width * selection.dpr) && value.resolution.bufferHeight === Math.floor(selection.height * selection.dpr)
    && rendered.tick === sample.frame.tick && rendered.fixtureDigest === value.fixtureDigest
    && rendered.sourceRevision === sample.frame.sourceRevision && rendered.resetTick === sample.resetTick
    && (selection.variant === 'fixture-control' || (value.projectionGeneration !== null
      && rendered.projectionGeneration === value.projectionGeneration && rendered.cameraId === sample.frame.cameraId));
}
export function comparison(prepared: PreparedReplay, value: Submission) {
  const fixture = prepared.fixtures.get(value.fixtureDigest); requireValue(fixture, 'Submitted fixture was not frozen/imported');
  return { scenarioId: prepared.scenario.id, originalScenarioDigest: prepared.originalDigest, effectiveScenarioDigest: prepared.effectiveDigest,
    fixtureDigest: value.fixtureDigest, sourceRefs: value.sourceRefs, presentationProfile: value.presentationProfile,
    payloadBindings: fixture.payloads.map(({ id, path, sha256, byteLength }) => ({ id, path, sha256, byteLength })),
    frame: value.frame, resetTick: value.resetTick, viewport: value.resolution };
}
export type Comparison = ReturnType<typeof comparison>;
