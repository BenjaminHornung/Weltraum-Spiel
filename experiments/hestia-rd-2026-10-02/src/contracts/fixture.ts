import { PRODUCT_READ_BASE, MAX_PAYLOAD_BYTES, array, canonicalJson, digest, finite,
  freezeJson, id, integer, keys, parseBoundedJson, relativePath, requireValue, sha256,
  text, unique, vector } from './validation';

export type Vec3 = readonly [number, number, number];
export interface LabFrame { readonly id: string; readonly originMeters: Vec3;
  readonly rotationXyzw: readonly [number, number, number, number]; readonly basis: 'right-handed-y-up'; }
export type SourceRef = {
  readonly kind: 'synthetic'; readonly generatorPath: string; readonly generatorCodeSha256: string;
  readonly generatorVersion: string; readonly seed: number; readonly testOnly: true; readonly sourceDigest: string;
} | {
  readonly kind: 'product'; readonly repository: 'BenjaminHornung/Weltraum-Spiel';
  readonly commit: typeof PRODUCT_READ_BASE;
  readonly files: readonly { readonly path: string; readonly sha256: string; readonly blobSha?: string }[];
  readonly generatorVersion: string; readonly sourceDigest: string;
};
export interface LabPresentationProfile {
  readonly id: string; readonly sourcePaths: readonly string[];
  readonly materialColorSpace: 'linear-srgb'; readonly outputColorSpace: 'srgb';
  readonly toneMapping: 'none' | 'aces-filmic' | 'reinhard'; readonly exposure: number;
  readonly lighting: { readonly ambient: { readonly colorSrgb24: number; readonly groundColorSrgb24: number;
    readonly intensity: number; readonly positionMeters: Vec3 };
    readonly key: { readonly colorSrgb24: number; readonly intensity: number; readonly positionMeters: Vec3 };
    readonly fill: { readonly colorSrgb24: number; readonly intensity: number; readonly positionMeters: Vec3 } };
  readonly background: { readonly colorSrgb24: number; readonly fogNearMeters: number; readonly fogFarMeters: number };
}
export type PayloadElementType = 'uint8' | 'uint16' | 'uint32' | 'int32' | 'float32' | 'float64';
export interface LabPayload { readonly id: string; readonly path: string; readonly elementType: PayloadElementType;
  readonly byteOrder: 'little' | 'big'; readonly length: number; readonly byteLength: number; readonly sha256: string; }
export interface LabObject { readonly ownerId: string; readonly sourceRevision: number; readonly sourceIds: readonly string[];
  readonly sourceNamespace: string; readonly frame: LabFrame; readonly materialRoles: readonly string[];
  readonly meshes: readonly { readonly positions: string; readonly indices: string; readonly materialId: string;
    readonly normals?: string; readonly colors?: string; readonly colorSpace?: 'linear-srgb'; readonly presentationOnly?: boolean }[];
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 }; }
export interface LabVoxelRegion { readonly id: string; readonly ownerId: string; readonly originMeters: Vec3;
  readonly dimensions: readonly [number, number, number]; readonly occupancyPayload: string; readonly knownCoveragePayload: string; }
export interface LabFixtureV1 { readonly schema: 'hestia-rd-fixture-v1'; readonly id: string;
  readonly kind: 'synthetic' | 'product-derived'; readonly sourceRefs: readonly SourceRef[];
  readonly sourceRevision: number; readonly units: 'meter'; readonly quantumMeters: number; readonly frame: LabFrame;
  readonly presentation?: LabPresentationProfile;
  readonly materials: readonly { readonly id: string; readonly role: string; readonly colorLinearRgb: Vec3;
    readonly opacity?: number; readonly depthWrite?: boolean; readonly doubleSided?: boolean }[];
  readonly objects: readonly LabObject[]; readonly payloads: readonly LabPayload[];
  readonly voxelRegions?: readonly LabVoxelRegion[];
  readonly attachments?: readonly { readonly id: string; readonly ownerId: string;
    readonly sourceIds: readonly string[]; readonly supportOwnerId: string; readonly supportIds: readonly string[] }[];
  readonly cameras: readonly { readonly id: string; readonly positionMeters: Vec3; readonly targetMeters: Vec3;
    readonly up: Vec3; readonly verticalFovDegrees: number }[]; }
export type LabTypedPayload = Uint8Array | Uint16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

const imported = new WeakMap<LabFixtureV1, { digest: string; buffers: Map<string, Uint8Array<ArrayBuffer>> }>();
const sizes: Record<PayloadElementType, number> = { uint8: 1, uint16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 };

export function validateSourceRefs(value: unknown, kind?: LabFixtureV1['kind']): asserts value is readonly SourceRef[] {
  array(value);
  requireValue(value.length > 0, 'Missing source provenance');
  for (const raw of value) {
    const ref = raw as SourceRef;
    if (ref.kind === 'synthetic') {
      keys(ref, ['kind', 'generatorPath', 'generatorCodeSha256', 'generatorVersion', 'seed', 'testOnly', 'sourceDigest']);
      relativePath(ref.generatorPath); digest(ref.generatorCodeSha256); integer(ref.seed);
      requireValue(ref.testOnly === true && kind !== 'product-derived', 'Synthetic data is explicitly test-only');
    } else {
      keys(ref, ['kind', 'repository', 'commit', 'files', 'generatorVersion', 'sourceDigest']);
      requireValue(ref.kind === 'product' && ref.repository === 'BenjaminHornung/Weltraum-Spiel'
        && ref.commit === PRODUCT_READ_BASE && kind !== 'synthetic', 'Unpinned product provenance');
      array(ref.files); requireValue(ref.files.length > 0, 'Missing concrete source files');
      for (const file of ref.files) {
        keys(file, ['path', 'sha256', 'blobSha'], ['path', 'sha256']); relativePath(file.path); digest(file.sha256);
        if (file.blobSha !== undefined) { requireValue(/^[0-9a-f]{40}$/.test(file.blobSha), 'Expected full blob SHA'); }
      }
      unique(ref.files.map((file) => file.path));
    }
    text(ref.generatorVersion);
    // Product FNV/semantic identity is not a byte SHA. Concrete file/payload SHA-256 stays separate.
    if (ref.kind === 'synthetic') { digest(ref.sourceDigest); } else { id(ref.sourceDigest); }
  }
}

function validateFrame(frame: LabFrame): void {
  keys(frame, ['id', 'originMeters', 'rotationXyzw', 'basis']); id(frame.id); vector(frame.originMeters);
  vector(frame.rotationXyzw, 4); requireValue(frame.basis === 'right-handed-y-up', 'Invalid frame basis');
  requireValue(Math.abs(Math.hypot(...frame.rotationXyzw) - 1) <= 1e-6, 'Rotation must be unit quaternion');
}

function validateManifest(value: unknown): asserts value is LabFixtureV1 {
  const fixture = value as LabFixtureV1;
  keys(fixture, ['schema', 'id', 'kind', 'sourceRefs', 'units', 'quantumMeters', 'frame', 'materials', 'objects',
    'payloads', 'voxelRegions', 'attachments', 'cameras', 'sourceRevision', 'presentation'],
  ['schema', 'id', 'kind', 'sourceRefs', 'sourceRevision', 'units', 'quantumMeters', 'frame', 'materials', 'objects', 'payloads', 'cameras']);
  requireValue(fixture.schema === 'hestia-rd-fixture-v1', 'Unsupported fixture version'); id(fixture.id);
  requireValue(fixture.kind === 'synthetic' || fixture.kind === 'product-derived', 'Invalid fixture kind');
  validateSourceRefs(fixture.sourceRefs, fixture.kind);
  integer(fixture.sourceRevision);
  requireValue(fixture.kind !== 'product-derived' || fixture.presentation !== undefined, 'Product-derived control requires a bound presentation profile');
  if (fixture.presentation) { validatePresentation(fixture.presentation, fixture.sourceRefs); }
  requireValue(fixture.units === 'meter', 'Only meter units supported'); finite(fixture.quantumMeters, Number.MIN_VALUE);
  validateFrame(fixture.frame); array(fixture.payloads);
  let bytes = 0;
  for (const payload of fixture.payloads) {
    keys(payload, ['id', 'path', 'elementType', 'byteOrder', 'length', 'byteLength', 'sha256']);
    id(payload.id); relativePath(payload.path); digest(payload.sha256); integer(payload.length); integer(payload.byteLength);
    requireValue(Object.hasOwn(sizes, payload.elementType), 'Unsupported element type');
    requireValue(payload.byteOrder === 'little' || payload.byteOrder === 'big', 'Invalid byte order');
    requireValue(Number.isSafeInteger(payload.length * sizes[payload.elementType])
      && payload.byteLength === payload.length * sizes[payload.elementType], 'Invalid typed byte length');
    bytes += payload.byteLength;
    requireValue(Number.isSafeInteger(bytes) && bytes <= MAX_PAYLOAD_BYTES, 'Scene payload exceeds 128 MiB');
  }
  unique(fixture.payloads.map((payload) => payload.id)); unique(fixture.payloads.map((payload) => payload.path));
  array(fixture.materials);
  for (const material of fixture.materials) {
    keys(material, ['id', 'role', 'colorLinearRgb', 'opacity', 'depthWrite', 'doubleSided'],
      fixture.kind === 'product-derived' ? ['id', 'role', 'colorLinearRgb', 'opacity', 'depthWrite', 'doubleSided'] : ['id', 'role', 'colorLinearRgb']);
    id(material.id); id(material.role); vector(material.colorLinearRgb);
    material.colorLinearRgb.forEach((color) => { finite(color, 0, 1); });
    if (material.opacity !== undefined) { finite(material.opacity, 0, 1); }
    for (const flag of [material.depthWrite, material.doubleSided]) { requireValue(flag === undefined || typeof flag === 'boolean', 'Invalid material flag'); }
  }
  unique(fixture.materials.map((material) => material.id)); array(fixture.objects);
  const materialIds = new Set(fixture.materials.map((material) => material.id));
  for (const object of fixture.objects) {
    keys(object, ['ownerId', 'sourceRevision', 'sourceNamespace', 'sourceIds', 'frame', 'materialRoles', 'meshes', 'bounds']);
    id(object.ownerId); integer(object.sourceRevision); id(object.sourceNamespace);
    array(object.sourceIds); object.sourceIds.forEach(id); unique(object.sourceIds);
    validateFrame(object.frame); array(object.materialRoles); object.materialRoles.forEach(id);
    requireValue(object.materialRoles.every((role) => fixture.materials.some((material) => material.role === role)), 'Unknown material role');
    keys(object.bounds, ['min', 'max']); vector(object.bounds.min); vector(object.bounds.max);
    requireValue(object.bounds.min.every((min, axis) => min <= object.bounds.max[axis]), 'Invalid geometric bounds');
    array(object.meshes);
    for (const mesh of object.meshes) {
      keys(mesh, ['positions', 'indices', 'materialId', 'normals', 'colors', 'colorSpace', 'presentationOnly'], ['positions', 'indices', 'materialId']);
      const positions = fixture.payloads.find((payload) => payload.id === mesh.positions);
      const indices = fixture.payloads.find((payload) => payload.id === mesh.indices);
      requireValue(positions && ['float32', 'float64'].includes(positions.elementType)
        && positions.length > 0 && positions.length % 3 === 0, 'Invalid mesh positions');
      requireValue(indices && ['uint16', 'uint32'].includes(indices.elementType) && indices.length % 3 === 0, 'Invalid mesh indices');
      requireValue(materialIds.has(mesh.materialId), 'Unknown mesh material');
      requireValue(mesh.presentationOnly === undefined || typeof mesh.presentationOnly === 'boolean', 'Invalid presentation-only flag');
      for (const payloadId of [mesh.normals, mesh.colors]) {
        if (payloadId === undefined) { continue; }
        const payload = fixture.payloads.find((entry) => entry.id === payloadId);
        requireValue(payload && ['float32', 'float64'].includes(payload.elementType) && payload.length === positions.length, 'Invalid per-vertex payload');
      }
      requireValue(mesh.colors === undefined ? mesh.colorSpace === undefined : mesh.colorSpace === 'linear-srgb', 'Vertex-color payload needs explicit linear-sRGB binding');
    }
  }
  unique(fixture.objects.map((object) => object.ownerId));
  if (fixture.voxelRegions !== undefined) {
    array(fixture.voxelRegions);
    for (const region of fixture.voxelRegions) {
      keys(region, ['id', 'ownerId', 'originMeters', 'dimensions', 'occupancyPayload', 'knownCoveragePayload']); id(region.id);
      requireValue(fixture.objects.some((object) => object.ownerId === region.ownerId), 'Missing voxel owner');
      vector(region.originMeters); vector(region.dimensions); region.dimensions.forEach((dimension) => { integer(dimension, 1); });
      const count = region.dimensions.reduce((total, dimension) => total * dimension, 1);
      integer(count, 1); requireValue(count <= MAX_PAYLOAD_BYTES, 'Scene payload exceeds 128 MiB');
      requireValue(region.occupancyPayload !== region.knownCoveragePayload, 'Coverage is separate from occupancy');
      for (const payloadId of [region.occupancyPayload, region.knownCoveragePayload]) {
        const payload = fixture.payloads.find((entry) => entry.id === payloadId);
        requireValue(payload?.elementType === 'uint8' && payload.length === count, 'Missing occupancy/knownCoverage payload');
      }
    }
    unique(fixture.voxelRegions.map((region) => region.id));
  }
  if (fixture.attachments !== undefined) {
    array(fixture.attachments);
    for (const attachment of fixture.attachments) {
      keys(attachment, ['id', 'ownerId', 'sourceIds', 'supportOwnerId', 'supportIds']); id(attachment.id);
      const owner = fixture.objects.find((object) => object.ownerId === attachment.ownerId);
      const supportOwner = fixture.objects.find((object) => object.ownerId === attachment.supportOwnerId);
      requireValue(owner && supportOwner, 'Missing attachment/source support owner');
      for (const [ids, binding] of [[attachment.sourceIds, owner], [attachment.supportIds, supportOwner]] as const) {
        array(ids); requireValue(ids.length > 0, 'Missing source/support binding'); ids.forEach(id); unique(ids);
        requireValue(ids.every((sourceId) => binding.sourceIds.includes(sourceId)), 'Unknown source/support ID in owner namespace');
      }
    }
    unique(fixture.attachments.map((attachment) => attachment.id));
  }
  array(fixture.cameras); requireValue(fixture.cameras.length > 0, 'Missing cameras');
  for (const camera of fixture.cameras) {
    keys(camera, ['id', 'positionMeters', 'targetMeters', 'up', 'verticalFovDegrees']); id(camera.id);
    vector(camera.positionMeters); vector(camera.targetMeters); vector(camera.up); finite(camera.verticalFovDegrees, 1, 179);
    requireValue(Math.hypot(...camera.up) > 0 && camera.positionMeters.some((value, axis) => value !== camera.targetMeters[axis]), 'Degenerate camera');
  }
  unique(fixture.cameras.map((camera) => camera.id));
}

function validatePresentation(profile: LabPresentationProfile, refs: readonly SourceRef[]): void {
  keys(profile, ['id', 'sourcePaths', 'materialColorSpace', 'outputColorSpace', 'toneMapping', 'exposure', 'lighting', 'background']);
  id(profile.id); array(profile.sourcePaths); requireValue(profile.sourcePaths.length > 0, 'Presentation must name its sources');
  profile.sourcePaths.forEach(relativePath); unique(profile.sourcePaths);
  requireValue(profile.sourcePaths.every((sourcePath) => refs.some((ref) => ref.kind === 'product'
    ? ref.files.some((file) => file.path === sourcePath) : ref.generatorPath === sourcePath)), 'Unbound presentation source');
  requireValue(profile.materialColorSpace === 'linear-srgb' && profile.outputColorSpace === 'srgb', 'Explicit color-space binding required');
  requireValue(['none', 'aces-filmic', 'reinhard'].includes(profile.toneMapping), 'Unsupported bound tone mapper'); finite(profile.exposure, Number.MIN_VALUE);
  keys(profile.lighting, ['ambient', 'key', 'fill']);
  for (const role of ['ambient', 'key', 'fill'] as const) {
    const light = profile.lighting[role];
    keys(light, role === 'ambient' ? ['colorSrgb24', 'groundColorSrgb24', 'intensity', 'positionMeters'] : ['colorSrgb24', 'intensity', 'positionMeters']);
    integer(light.colorSrgb24); finite(light.colorSrgb24, 0, 0xffffff); finite(light.intensity, 0); vector(light.positionMeters);
    if (role === 'ambient') { integer(profile.lighting.ambient.groundColorSrgb24); finite(profile.lighting.ambient.groundColorSrgb24, 0, 0xffffff); }
  }
  keys(profile.background, ['colorSrgb24', 'fogNearMeters', 'fogFarMeters']); integer(profile.background.colorSrgb24); finite(profile.background.colorSrgb24, 0, 0xffffff);
  finite(profile.background.fogNearMeters, 0); finite(profile.background.fogFarMeters, Number.MIN_VALUE);
  requireValue(profile.background.fogNearMeters < profile.background.fogFarMeters, 'Invalid bound fog range');
}

function scalar(bytes: Uint8Array, payload: LabPayload, index: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = index * sizes[payload.elementType]; const little = payload.byteOrder === 'little';
  switch (payload.elementType) {
    case 'uint8': return view.getUint8(offset);
    case 'uint16': return view.getUint16(offset, little);
    case 'uint32': return view.getUint32(offset, little);
    case 'int32': return view.getInt32(offset, little);
    case 'float32': return view.getFloat32(offset, little);
    case 'float64': return view.getFloat64(offset, little);
  }
}

function validatePayloadContents(fixture: LabFixtureV1, buffers: Map<string, Uint8Array>): void {
  for (const payload of fixture.payloads) {
    if (payload.elementType.startsWith('float')) {
      for (let index = 0; index < payload.length; index += 1) { finite(scalar(buffers.get(payload.id)!, payload, index)); }
    }
  }
  for (const region of fixture.voxelRegions ?? []) {
    const occupancy = buffers.get(region.occupancyPayload)!; const coverage = buffers.get(region.knownCoveragePayload)!;
    for (let index = 0; index < occupancy.length; index += 1) {
      requireValue(occupancy[index] <= 1 && coverage[index] <= 1
        && (occupancy[index] === 0 || coverage[index] === 1), 'Invalid occupancy/coverage');
    }
  }
  for (const object of fixture.objects) {
    if (object.meshes.length === 0) { continue; }
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of object.meshes) {
      const positions = fixture.payloads.find((payload) => payload.id === mesh.positions)!;
      const indices = fixture.payloads.find((payload) => payload.id === mesh.indices)!;
      if (mesh.colors) {
        const colors = fixture.payloads.find((payload) => payload.id === mesh.colors)!;
        for (let index = 0; index < colors.length; index += 1) { finite(scalar(buffers.get(colors.id)!, colors, index), 0, 1); }
      }
      for (let index = 0; index < positions.length; index += 1) {
        const value = scalar(buffers.get(positions.id)!, positions, index); const axis = index % 3;
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
      for (let index = 0; index < indices.length; index += 1) {
        requireValue(scalar(buffers.get(indices.id)!, indices, index) < positions.length / 3, 'Mesh index outside vertex data');
      }
    }
    requireValue(min.every((value, axis) => value === object.bounds.min[axis])
      && max.every((value, axis) => value === object.bounds.max[axis]), 'Bounds do not match actual geometry');
  }
}

export async function importFixture(manifestBytes: Uint8Array, payloads: ReadonlyMap<string, Uint8Array> = new Map()): Promise<LabFixtureV1> {
  const fixture = parseBoundedJson(manifestBytes); validateManifest(fixture);
  // All advertised and actual byte limits precede private copies, hashes and numeric decoding.
  requireValue(payloads.size === fixture.payloads.length, 'Unexpected/missing payloads');
  for (const payload of fixture.payloads) {
    const bytes = payloads.get(payload.id);
    requireValue(bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer
      && bytes.byteLength === payload.byteLength, 'Payload size/buffer mismatch');
  }
  const buffers = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const payload of fixture.payloads) {
    const privateBytes = new Uint8Array(payload.byteLength); privateBytes.set(payloads.get(payload.id)!);
    buffers.set(payload.id, privateBytes);
  }
  for (const payload of fixture.payloads) {
    requireValue(await sha256(buffers.get(payload.id)!) === payload.sha256, 'Payload SHA-256 mismatch');
  }
  validatePayloadContents(fixture, buffers);
  const fixtureDigest = await sha256(new TextEncoder().encode(canonicalJson(fixture)));
  imported.set(fixture, { digest: fixtureDigest, buffers });
  return freezeJson(fixture);
}

export function getFixtureDigest(fixture: LabFixtureV1): string {
  const snapshot = imported.get(fixture); requireValue(snapshot, 'Fixture must pass the import boundary'); return snapshot.digest;
}

export function fixtureRevision(fixture: LabFixtureV1): number {
  getFixtureDigest(fixture); return fixture.sourceRevision;
}

export function copyFixturePayload(fixture: LabFixtureV1, payloadId: string): LabTypedPayload {
  const snapshot = imported.get(fixture); requireValue(snapshot, 'Fixture must pass the import boundary');
  const payload = fixture.payloads.find((entry) => entry.id === payloadId); requireValue(payload, 'Unknown payload');
  const constructors = { uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array,
    int32: Int32Array, float32: Float32Array, float64: Float64Array };
  const result = new constructors[payload.elementType](payload.length);
  for (let index = 0; index < payload.length; index += 1) { result[index] = scalar(snapshot.buffers.get(payloadId)!, payload, index); }
  return result;
}

export function readVoxel(fixture: LabFixtureV1, regionId: string, x: number, y: number, z: number): 'unknown' | 'air' | 'occupied' {
  const snapshot = imported.get(fixture); requireValue(snapshot, 'Fixture must pass the import boundary');
  const region = fixture.voxelRegions?.find((entry) => entry.id === regionId); requireValue(region, 'Unknown voxel region');
  [x, y, z].forEach((coordinate) => { requireValue(Number.isSafeInteger(coordinate), 'Invalid cell coordinate'); });
  if ([x, y, z].some((coordinate, axis) => coordinate < 0 || coordinate >= region.dimensions[axis])) { return 'unknown'; }
  const index = x + region.dimensions[0] * (y + region.dimensions[1] * z);
  if (snapshot.buffers.get(region.knownCoveragePayload)![index] === 0) { return 'unknown'; }
  return snapshot.buffers.get(region.occupancyPayload)![index] === 0 ? 'air' : 'occupied';
}
