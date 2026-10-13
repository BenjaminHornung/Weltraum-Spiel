import { createHash } from 'node:crypto';
import { validateVolume, assertExclusiveOwners } from './imported/rt01/src/validate.mts';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(value);
export const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const materials = [
  { id: 1, role: 'limestone-dry', source: 'rt01-analytical-materials-v1/limestone' },
  { id: 2, role: 'wood', source: 'rt01-analytical-materials-v1/wood' },
  { id: 3, role: 'metal', source: 'rt01-analytical-materials-v1/metal' },
];

export function bindSource(v) {
  v.binding.sourceDigest = sha256(canonical({ size: v.size, cellMeters: v.cellMeters, origin: v.origin,
    cells: v.cells, cellIds: v.cellIds, authorityLeafEdge: v.authorityLeafEdge,
    rayPageEdge: v.rayPageEdge, coverage: v.coverage, exteriorCoverage: v.exteriorCoverage }));
  v.binding.materialDigest = sha256(canonical(v.materials));
  validateVolume(v);
  return v;
}

export function analyticalVolume(cellMeters = 0.125, size = [18, 4, 4], id = `grid-${cellMeters}`) {
  const count = size.reduce((a, b) => a * b, 1);
  return bindSource({ id, provenance: 'ANALYTICAL', size, cellMeters, origin: [-2, -0.5, -0.5],
    rotation: [...identity], translation: [0, 0, 0], authorityLeafEdge: 16, rayPageEdge: 8,
    coverage: 'complete', exteriorCoverage: 'KnownEmpty', cells: Array(count).fill(0),
    cellIds: Array.from({ length: count }, (_, i) => `${id}/cell/${i}`), materials: structuredClone(materials),
    binding: { domain: 'hestia-ray-lab', world: 'rt01-analytical-v1', session: 'rt01-replay-v1', epoch: 'epoch-1',
      owner: 'terrain', sourceRevision: 0, sourceGeneration: 0, sourceDigest: '0'.repeat(64),
      frame: 'local-y-up', originEpoch: 0, transformGeneration: 0, materialDigest: '0'.repeat(64),
      algorithm: 'rt01-direction-owned-positive-interval-v1' } });
}

export const cellIndex = (v, [x, y, z]) => x + v.size[0] * (y + v.size[1] * z);
export function setCell(v, cell, material) { v.cells[cellIndex(v, cell)] = material; return bindSource(v); }

export function makeSnapshots() {
  const before = analyticalVolume();
  for (const [cell, material] of [[[5, 1, 1], 2], [[16, 1, 1], 1], [[17, 2, 1], 3], [[8, 2, 2], 1]]) setCell(before, cell, material);
  const afterCut = structuredClone(before);
  afterCut.id = 'after-cut';
  afterCut.binding.sourceRevision++;
  afterCut.binding.sourceGeneration++;
  setCell(afterCut, [5, 1, 1], 0);
  const terrain = structuredClone(afterCut);
  terrain.id = 'after-transfer-terrain';
  terrain.binding.sourceRevision++;
  terrain.binding.sourceGeneration++;
  setCell(terrain, [16, 1, 1], 0);
  const fragment = analyticalVolume(0.125, [2, 2, 2], 'fragment');
  fragment.origin = [0, 0, 0];
  fragment.translation = before.origin.map((n, a) => n + [16, 1, 1][a] * before.cellMeters);
  fragment.binding.owner = 'fragment-1';
  fragment.binding.sourceRevision = 2;
  fragment.binding.sourceGeneration = 2;
  fragment.cellIds[0] = before.cellIds[cellIndex(before, [16, 1, 1])];
  setCell(fragment, [0, 0, 0], 1);
  const rotated = structuredClone(fragment);
  rotated.id = 'fragment-rotated';
  rotated.rotation = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  rotated.translation = [-0.25, -0.25, 0.125];
  rotated.binding.transformGeneration = 1;
  validateVolume(rotated);
  const shifted = structuredClone(before);
  shifted.id = 'origin-shift';
  shifted.translation = [-1000, 0, 2000];
  shifted.binding.originEpoch = 1;
  shifted.binding.frame = 'shifted-y-up';
  const coarse = analyticalVolume(0.25);
  for (const [cell, material] of [[[5, 1, 1], 2], [[16, 1, 1], 1], [[8, 2, 2], 3]]) setCell(coarse, cell, material);
  const missing = structuredClone(before);
  missing.id = 'missing-neighbor';
  missing.coverage = 'partial';
  for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 16; x < 18; x++) missing.cells[cellIndex(missing, [x, y, z])] = -1;
  bindSource(missing);
  const snapshots = [before, afterCut, terrain, fragment, rotated, shifted, coarse, missing];
  snapshots.forEach(validateVolume);
  assertExclusiveOwners([terrain, fragment]);
  return { snapshots, commands: [
    { sequence: 1, kind: 'Cut', mode: 'ANALYTICAL_SNAPSHOT_REPLAY', before: before.id, after: afterCut.id,
      removeCellIds: [before.cellIds[cellIndex(before, [5, 1, 1])]] },
    { sequence: 2, kind: 'FragmentTransfer', mode: 'ANALYTICAL_SNAPSHOT_REPLAY', before: afterCut.id,
      after: [terrain.id, fragment.id], transferCellIds: [fragment.cellIds[0]], fromOwner: 'terrain', toOwner: 'fragment-1' },
    { sequence: 3, kind: 'RotateAndTranslate', mode: 'ANALYTICAL_SNAPSHOT_REPLAY', before: fragment.id,
      after: rotated.id, sourceDigestUnchanged: true, transformGeneration: 1 },
    { sequence: 4, kind: 'OriginShift', mode: 'ANALYTICAL_SNAPSHOT_REPLAY', before: before.id, after: shifted.id,
      sourceDigestUnchanged: true, originEpoch: 1, offset: shifted.translation },
  ] };
}

/** Exactly representable seed arithmetic; duplicate numeric rays are rejected by tests. */
export function deterministicRays(volumes, count = 1000) {
  let state = 20261009;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: count }, (_, i) => {
    const v = volumes[i % volumes.length];
    const local = v.origin.map((n, a) => n + (-0.2 + 1.4 * random()) * v.size[a] * v.cellMeters);
    const d = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
    if (i % 7 === 0) d[i % 3] = 0;
    const length = Math.hypot(...d);
    const transform = p => [0, 1, 2].map(a => v.rotation[a * 3] * p[0] + v.rotation[a * 3 + 1] * p[1] + v.rotation[a * 3 + 2] * p[2]);
    return { volumeId: v.id, ray: { id: `golden-${String(i).padStart(4, '0')}`,
      origin: transform(local).map((n, a) => n + v.translation[a]), direction: transform(d.map(n => n / length)),
      maxDistance: 8, maxSteps: i % 13 === 0 ? i % 5 : 256 } };
  });
}
