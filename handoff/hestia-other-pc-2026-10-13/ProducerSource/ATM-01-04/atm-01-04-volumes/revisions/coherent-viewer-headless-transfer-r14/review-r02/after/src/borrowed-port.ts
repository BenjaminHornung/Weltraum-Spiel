import {validateFrame} from './optics';
import type {AtmosphereFrame, HistoryFrame, OpticalSegment} from './optics';
import type {
  BorrowedImageRef, CommonHistoryState, FrozenSourceRef, OpaqueDepthInput,
  PreToneVolumeContribution, PresentationFrameBinding, PresentedLightChange, WeatherAdmission
} from '../upstream/atm-r04/contracts.proposed.d.ts';

export const PORT_IDS = ['WEATHER', 'FRAME', 'OPTICS', 'DEPTH', 'GL_VOLUME', 'TAKRAM',
  'MATERIAL', 'RAIN', 'WETNESS_WATER', 'VELOCITY', 'LIGHT_REACTIVITY', 'HISTORY', 'OUTPUT_VIEW'] as const;
export type PortId = typeof PORT_IDS[number];
type ImageRole = 'hdrColor' | 'depth' | 'waterDepth' | 'velocity' | 'reactive';
export type ActualSegment = Readonly<OpticalSegment>;
export type LogicalHistoryReference = Readonly<HistoryFrame>; // Not CommonHistoryState or GPU history.
export interface BorrowedPortRequest {
  readonly port: PortId;
  readonly sourceFrame?: AtmosphereFrame;
  readonly weather?: WeatherAdmission;
  readonly segment?: ActualSegment;
  readonly current?: PresentationFrameBinding;
  readonly currentEvidence?: FrozenSourceRef;
  readonly producerOwners?: Readonly<Partial<Record<ImageRole, string>>>;
  readonly contribution?: PreToneVolumeContribution;
  readonly history?: CommonHistoryState;
  readonly historyEvidence?: FrozenSourceRef;
  readonly lighting?: PresentedLightChange;
}
export type BorrowedPortDisposition =
  | {readonly status: 'Pending'; readonly port: PortId | null; readonly reasonCode: string}
  | {readonly status: 'Unsupported'; readonly port: PortId | null; readonly reasonCode: string}
  | {readonly status: 'ValidatedSourceOnly'; readonly port: PortId; readonly temporalReady: false;
     readonly execution: 'NOT_RUN'; readonly selectedOption: null};
type Issue =
  | {readonly status: 'Pending'; readonly reasonCode: string}
  | {readonly status: 'Unsupported'; readonly reasonCode: string};
const pending = (reasonCode: string): Issue => ({status: 'Pending', reasonCode});
const unsupported = (reasonCode: string): Issue => ({status: 'Unsupported', reasonCode});
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const natural = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const vector = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && Array.from(v).every(finite);
const digest = (v: unknown): boolean => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v);
function reference(v: unknown): boolean {
  return record(v) && text(v.sourceId) && text(v.absolutePath) && /^C:[\\/]IFI_SourceCode[\\/]/i.test(v.absolutePath)
    && natural(v.bytes) && v.bytes > 0 && typeof v.sha256 === 'string' && /^[a-f0-9]{64}$/.test(v.sha256);
}
function currentFrame(v: unknown): Issue | null {
  if (!record(v)) return pending('CURRENT_FRAME_MISSING');
  for (const k of ['viewSessionId', 'frameId', 'sourcePresentationRevision'] as const) {
    if (v[k] === undefined) return pending('CURRENT_FRAME_MISSING:' + k);
    if (!text(v[k])) return unsupported('CURRENT_FRAME_INVALID:' + k);
  }
  for (const k of ['resourceGeneration', 'cameraEpoch', 'projectionEpoch', 'atlasEpoch'] as const) {
    if (v[k] === undefined) return pending('EPOCH_MISSING:' + k);
    if (!natural(v[k])) return unsupported('EPOCH_INVALID:' + k);
  }
  if (!digest(v.weatherSnapshotId) || !digest(v.opticsDigest) || !digest(v.atlasDigest) || !vector(v.originMeters, 3))
    return unsupported('CURRENT_FRAME_BINDING_INVALID');
  return null;
}
function coherentFrame(a: unknown, b: PresentationFrameBinding): boolean {
  if (!record(a)) return false;
  const keys = ['viewSessionId', 'frameId', 'sourcePresentationRevision', 'resourceGeneration', 'cameraEpoch',
    'projectionEpoch', 'atlasEpoch', 'weatherSnapshotId', 'opticsDigest', 'atlasDigest'] as const;
  return keys.every(k => a[k] === b[k]) && vector(a.originMeters, 3) && a.originMeters.every((v, i) => v === b.originMeters[i]);
}
function image(v: unknown, current: PresentationFrameBinding, owner: unknown, role: ImageRole): Issue | null {
  if (!record(v)) return pending('IMAGE_MISSING:' + role);
  if (!text(owner)) return pending('PRODUCER_OWNER_MISSING:' + role);
  if (v.ownerId !== owner || v.disposalOwner !== 'PRODUCER_ONLY') return unsupported('BORROWED_OWNERSHIP_INVALID:' + role);
  if (!text(v.resourceKey) || !text(v.format) || !natural(v.width) || !natural(v.height) || v.width < 1 || v.height < 1
    || v.sampleCount !== 1 || !['WebGL', 'WebGPU'].includes(String(v.backend))) return unsupported('IMAGE_METADATA_INVALID:' + role);
  const epoch = currentFrame(v.frame);
  if (epoch) return epoch;
  if (!coherentFrame(v.frame, current) || v.validUntil !== 'FRAME_END_OR_OWNER_GENERATION_CHANGE')
    return unsupported('BORROWED_LEASE_STALE:' + role);
  return null;
}
function depth(v: unknown, current: PresentationFrameBinding, owner: unknown): Issue | null {
  if (!record(v)) return pending('DEPTH_MISSING');
  const header = image(v.image, current, owner, 'depth');
  if (header) return header;
  for (const key of ['projectionKind', 'clipDepthRange', 'nearMeters', 'farMeters', 'reversedZ', 'logarithmicDepth',
    'encoding', 'writers', 'backgroundValidity', 'currentProjectionUnjittered', 'currentView'] as const)
    if (v[key] === undefined) return pending('DEPTH_METADATA_MISSING:' + key);
  const im = v.image as BorrowedImageRef;
  if (!['Perspective', 'Orthographic'].includes(String(v.projectionKind)) || !finite(v.nearMeters) || !finite(v.farMeters)
    || v.nearMeters <= 0 || v.farMeters <= v.nearMeters || typeof v.reversedZ !== 'boolean' || v.logarithmicDepth !== false
    || v.encoding !== 'NATIVE_SINGLE_SAMPLE_DEPTH_ATTACHMENT' || v.writers !== 'OPAQUE_ONLY'
    || v.backgroundValidity !== 'EXPLICIT_SKY_DISPOSITION' || !vector(v.currentProjectionUnjittered, 16) || !vector(v.currentView, 16)
    || v.clipDepthRange !== (im.backend === 'WebGL' ? 'MinusOneToOne' : 'ZeroToOne')) return unsupported('DEPTH_CONVENTION_INVALID');
  return null;
}
function lighting(v: unknown): Issue | null {
  if (!record(v)) return pending('LIGHTNING_LIGHT_PROJECTION_MISSING');
  for (const key of ['bindingRef', 'revision', 'eventId', 'phase', 'sourceStrength', 'sunDirectionBody', 'shadowAtlasLightingDigest'])
    if (v[key] === undefined) return pending('LIGHT_PROJECTION_MISSING:' + key);
  if (!reference(v.bindingRef) || !text(v.revision) || !['STEADY', 'BEGIN', 'CHANGE', 'END'].includes(String(v.phase))
    || !finite(v.sourceStrength) || v.sourceStrength < 0 || !vector(v.sunDirectionBody, 3)
    || Math.abs(Math.hypot(...v.sunDirectionBody) - 1) > 1e-8 || !digest(v.shadowAtlasLightingDigest)
    || (v.eventId !== null && !text(v.eventId)) || (v.phase !== 'STEADY' && v.eventId === null)
    || v.eventId === 'fixture.lightning') return unsupported('LIGHT_PROJECTION_INVALID_OR_COLLAPSED');
  return null;
}

/** Structural source candidate only. No texture reads, file IO, disposal, reset or render calls. */
export function validateBorrowedPort(input: unknown): BorrowedPortDisposition {
  const port = record(input) && PORT_IDS.includes(input.port as PortId) ? input.port as PortId : null;
  const fail = (issue: Issue): BorrowedPortDisposition => ({...issue, port});
  if (!record(input) || port === null) return fail(unsupported('PORT_UNKNOWN'));
  if (!record(input.weather)) return fail(pending('WEATHER_READ_MISSING'));
  const weather = input.weather;
  if (weather.status === 'Pending') return fail(text(weather.dependency) ? pending('WEATHER_PENDING:' + weather.dependency) : unsupported('WEATHER_DEPENDENCY_MISSING'));
  if (weather.status === 'Unsupported' || weather.status === 'UnknownCoverage')
    return fail(unsupported(text(weather.reasonCode) ? 'WEATHER_' + weather.status + ':' + weather.reasonCode : 'WEATHER_REASON_MISSING'));
  if (!['Known', 'NoAtmosphere'].includes(String(weather.status))) return fail(unsupported('WEATHER_STATUS_INVALID'));
  if (weather.frozenResult === undefined) return fail(pending('FROZEN_WEATHER_BINDING_MISSING'));
  if (!reference(weather.frozenResult)) return fail(unsupported('FROZEN_WEATHER_BINDING_INVALID'));
  if (!record(input.sourceFrame)) return fail(pending('ATMOSPHERE_FRAME_MISSING'));
  let frame: AtmosphereFrame;
  try { frame = validateFrame(input.sourceFrame as unknown as AtmosphereFrame); }
  catch (error) { return fail(unsupported('ACTUAL_FRAME_REJECTED:' + (error instanceof Error ? error.message : 'INVALID'))); }
  if (frame.status !== weather.status) return fail(unsupported('WEATHER_FRAME_STATUS_MISMATCH'));
  if (port === 'OPTICS') {
    if (!record(input.segment)) return fail(pending('OPTICAL_SEGMENT_MISSING'));
    const s = input.segment;
    if (!finite(s.T) || s.T < 0 || s.T > 1 || !vector(s.L, 3) || s.L.some(v => v < 0)) return fail(unsupported('OPTICAL_SEGMENT_INVALID'));
    if (frame.status === 'NoAtmosphere' && (s.T !== 1 || s.L.some(v => v !== 0))) return fail(unsupported('NO_ATMOSPHERE_OPTICAL_SEGMENT_NONEMPTY'));
  }
  if (port === 'WEATHER' || port === 'FRAME' || port === 'OPTICS')
    return {status: 'ValidatedSourceOnly', port, temporalReady: false, execution: 'NOT_RUN', selectedOption: null};
  const epoch = currentFrame(input.current);
  if (epoch) return fail(epoch);
  const current = input.current as unknown as PresentationFrameBinding;
  if (input.currentEvidence === undefined) return fail(pending('CURRENT_FRAME_EVIDENCE_MISSING'));
  if (!reference(input.currentEvidence)) return fail(unsupported('CURRENT_FRAME_EVIDENCE_INVALID'));
  if (current.weatherSnapshotId !== frame.weatherSnapshotId || current.opticsDigest !== frame.opticsDigest || current.atlasEpoch !== frame.atlasEpoch
    || current.originMeters.some((v, i) => v !== frame.originMeters[i])) return fail(unsupported('FRAME_ATLAS_ORIGIN_BINDING_MISMATCH'));
  if (!record(input.contribution)) return fail(pending('BORROWED_CONTRIBUTION_MISSING'));
  const c = input.contribution;
  const owners = record(input.producerOwners) ? input.producerOwners : {};
  const d = depth(c.depth, current, owners.depth);
  if (d) return fail(d);
  if (port === 'DEPTH') return {status: 'ValidatedSourceOnly', port, temporalReady: false, execution: 'NOT_RUN', selectedOption: null};
  const hdr = image(c.hdrColor, current, owners.hdrColor, 'hdrColor');
  if (hdr) return fail(hdr);
  if (c.colorSpace !== 'LINEAR_HDR' || c.toneMapped !== false) return fail(unsupported('PRE_TONE_HDR_REQUIRED'));
  const hdrImage = c.hdrColor as BorrowedImageRef;
  const depthImage = (c.depth as OpaqueDepthInput).image;
  if (hdrImage.backend !== depthImage.backend || hdrImage.width !== depthImage.width || hdrImage.height !== depthImage.height)
    return fail(unsupported('COLOR_DEPTH_MISMATCH'));
  if ((port === 'GL_VOLUME' || port === 'TAKRAM') && hdrImage.backend !== 'WebGL') return fail(unsupported('FROZEN_PORT_WEBGL_ONLY'));
  if (c.waterDepth === undefined) return fail(pending('WATER_DEPTH_DISPOSITION_MISSING'));
  if (c.waterStrategy !== 'NEAREST_PLANAR_FRONT_BACK_ALPHA_PRESERVED') return fail(unsupported('TRANSPARENT_WATER_STRATEGY_UNSUPPORTED'));
  if (c.waterDepth !== null) {
    const w = image(c.waterDepth, current, owners.waterDepth, 'waterDepth'); if (w) return fail(w);
    const water = c.waterDepth as BorrowedImageRef;
    if (water.resourceKey === depthImage.resourceKey && water.ownerId === depthImage.ownerId) return fail(unsupported('WATER_IS_NOT_OPAQUE_DEPTH'));
    if (water.backend !== hdrImage.backend || water.width !== hdrImage.width || water.height !== hdrImage.height) return fail(unsupported('WATER_DEPTH_MISMATCH'));
  }
  if (!record(c.velocity) || c.velocity.availability === 'MISSING') return fail(pending('GENUINE_VELOCITY_MISSING'));
  const v = c.velocity;
  if (v.availability !== 'AVAILABLE') return fail(unsupported('VELOCITY_AVAILABILITY_INVALID'));
  const motion = image(v.image, current, owners.velocity, 'velocity'); if (motion) return fail(motion);
  const motionImage = v.image as BorrowedImageRef;
  if (motionImage.backend !== hdrImage.backend || motionImage.width !== hdrImage.width || motionImage.height !== hdrImage.height)
    return fail(unsupported('VELOCITY_IMAGE_MISMATCH'));
  if (v.convention !== 'UNJITTERED_NDC_CURRENT_MINUS_PREVIOUS' || !text(v.previousFrameId) || v.previousFrameId === current.frameId
    || !vector(v.previousProjectionUnjittered, 16) || !vector(v.previousView, 16) || !reference(v.geometryDeformationOracle)
    || v.disocclusionPolicy !== 'NO_PREVIOUS_COLOR_FOR_NEW_SURFACE') return fail(unsupported('VELOCITY_OR_PREVIOUS_FRAME_UNPROVEN'));
  if (!record(c.reactive) || c.reactive.availability === 'MISSING') return fail(pending('REACTIVE_COVERAGE_MISSING'));
  const reactive = c.reactive;
  if (reactive.availability !== 'AVAILABLE') return fail(unsupported('REACTIVE_AVAILABILITY_INVALID'));
  const r = image(reactive.image, current, owners.reactive, 'reactive'); if (r) return fail(r);
  const reactiveImage = reactive.image as BorrowedImageRef;
  if (reactiveImage.backend !== hdrImage.backend || reactiveImage.width !== hdrImage.width || reactiveImage.height !== hdrImage.height)
    return fail(unsupported('REACTIVE_IMAGE_MISMATCH'));
  if (reactive.channel !== 'RED_0_TO_1' || !Array.isArray(reactive.includes) || reactive.includes.length === 0
    || !reactive.includes.every(v => ['Water', 'Volume', 'Rain', 'Lightning', 'NewSurface'].includes(v)) || !reference(reactive.coverageOracle))
    return fail(unsupported('REACTIVE_ORACLE_UNPROVEN'));
  const light = lighting(input.lighting); if (light) return fail(light);
  const reactiveLight = lighting(reactive.lighting); if (reactiveLight) return fail(reactiveLight);
  const l = input.lighting as unknown as PresentedLightChange;
  const rl = reactive.lighting as unknown as PresentedLightChange;
  if ((c.waterDepth !== null && !reactive.includes.includes('Water')) || (frame.rain01 > 0 && !reactive.includes.includes('Rain'))
    || (frame.authoredCloudCoverage > 0 && !reactive.includes.includes('Volume')) || (l.phase !== 'STEADY' && !reactive.includes.includes('Lightning')))
    return fail(unsupported('REACTIVE_EFFECT_COVERAGE_UNBOUND'));
  if (l.revision !== rl.revision || l.eventId !== rl.eventId || l.phase !== rl.phase || l.sourceStrength !== rl.sourceStrength
    || l.shadowAtlasLightingDigest !== rl.shadowAtlasLightingDigest || l.bindingRef.sha256 !== rl.bindingRef.sha256
    || l.sunDirectionBody.some((v, i) => v !== rl.sunDirectionBody[i])) return fail(unsupported('REACTIVE_LIGHT_BINDING_MISMATCH'));
  if (!record(input.history)) return fail(pending('PACKAGE_HISTORY_MISSING'));
  if (input.historyEvidence === undefined) return fail(pending('PACKAGE_HISTORY_CONTRACT_MISSING'));
  if (!reference(input.historyEvidence)) return fail(unsupported('PACKAGE_HISTORY_CONTRACT_INVALID'));
  const h = input.history;
  for (const key of ['generation', 'valid', 'inputResolution', 'displayResolution', 'cameraEpoch', 'projectionEpoch', 'sourceFrameId', 'bufferOwner'])
    if (h[key] === undefined) return fail(pending('HISTORY_METADATA_MISSING:' + key));
  if (h.valid === false) return fail(pending('PACKAGE_HISTORY_INVALID'));
  if (h.valid !== true || !natural(h.generation) || h.bufferOwner !== 'SELECTED_TEMPORAL_PACKAGE_ONLY'
    || h.cameraEpoch !== current.cameraEpoch || h.projectionEpoch !== current.projectionEpoch || !text(h.sourceFrameId)
    || !vector(h.inputResolution, 2) || !vector(h.displayResolution, 2)
    || !h.inputResolution.every(n => natural(n) && n > 0) || !h.displayResolution.every(n => natural(n) && n > 0)
    || h.inputResolution[0] !== hdrImage.width || h.inputResolution[1] !== hdrImage.height) return fail(unsupported('HISTORY_BINDING_INVALID'));
  return {status: 'ValidatedSourceOnly', port, temporalReady: false, execution: 'NOT_RUN', selectedOption: null};
}
