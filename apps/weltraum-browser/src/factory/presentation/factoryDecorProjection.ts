import { readHvpSourceColumnWorld, type HvpSourceColumn } from "../../hvp/hvpCoastSource";
import type { HvpMeshOccupancy } from "../../hvp/hvpCoastMesher";
import type { HvpPlantSource, HvpVegetationSourceProfile } from "../../hestia-prototype/presentation/vegetation";

const CELL_METERS = 0.125;
const DECOR_COLUMN_COUNT = 22 * 22;
const MAX_FACTORY_INSTALLATIONS = 16;

export interface FactoryDecorInstallationBounds {
  readonly instanceId: string;
  /** Exact already-validated logical/Native owner binding; retained only to invalidate stale masks. */
  readonly ownerWitness: string;
  readonly boundsMm: Readonly<{ min: readonly number[]; max: readonly number[] }>;
}

export interface FactoryDecorHullFootprint {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export const readFactoryDecorHullFootprint = (footprints: FactoryDecorFootprints): FactoryDecorHullFootprint | undefined => {
  if (!footprints.hullIncluded) return undefined;
  const offset = footprints.ownerCount * 6;
  return Object.freeze({ minX: footprints.boundsMeters[offset]!, minY: footprints.boundsMeters[offset + 1]!,
    minZ: footprints.boundsMeters[offset + 2]!, maxX: footprints.boundsMeters[offset + 3]!,
    maxY: footprints.boundsMeters[offset + 4]!, maxZ: footprints.boundsMeters[offset + 5]! });
};

export const factoryDecorHullFootprintFromNativeSectors = (
  sectors: readonly Readonly<{ vertices: Float32Array; indices: Uint32Array }>[]
): FactoryDecorHullFootprint => {
  if (sectors.length !== 8) throw new Error("Factory decoration requires the eight admitted Hull Native sectors");
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const sector of sectors) {
    if (sector.vertices.length === 0 || sector.vertices.length % 3 !== 0) throw new Error("Factory Hull Native footprint is malformed");
    for (let i = 0; i < sector.vertices.length; i += 3) {
      const x = sector.vertices[i]!, y = sector.vertices[i + 1]!, z = sector.vertices[i + 2]!;
      if (![x, y, z].every(Number.isFinite)) throw new Error("Factory Hull Native footprint is non-finite");
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    }
  }
  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)
    || minX >= maxX || minY >= maxY || minZ >= maxZ) throw new Error("Factory Hull Native footprint is empty");
  return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
};

/** Compact current committed-owner AABBs; no Native, presentation, or checkpoint object is retained. */
export interface FactoryDecorFootprints {
  readonly ownerIds: readonly string[];
  readonly ownerWitnesses: readonly string[];
  /** Six world-meter bounds per sorted owner, followed by the optional Hull Native-sector AABB. */
  readonly boundsMeters: Float64Array;
  readonly ownerCount: number;
  readonly hullIncluded: boolean;
  readonly retainedBytes: number;
}

const validatedBounds = (owners: readonly FactoryDecorInstallationBounds[], hull?: FactoryDecorHullFootprint): number => {
  if (owners.length > MAX_FACTORY_INSTALLATIONS) throw new RangeError("Factory decoration owner limit exceeded");
  const ids = new Set<string>();
  let idBytes = 0;
  for (const owner of owners) {
    if (typeof owner.instanceId !== "string" || owner.instanceId.length === 0 || ids.has(owner.instanceId)) {
      throw new TypeError("Factory decoration owner identity is invalid");
    }
    if (typeof owner.ownerWitness !== "string" || owner.ownerWitness.length === 0) throw new TypeError("Factory decoration owner witness is invalid");
    ids.add(owner.instanceId);
    idBytes += (owner.instanceId.length + owner.ownerWitness.length) * 2;
    const { min, max } = owner.boundsMm;
    if (min.length !== 3 || max.length !== 3 || ![...min, ...max].every(Number.isSafeInteger)
      || min.some((value, axis) => value >= max[axis]!)) {
      throw new TypeError("Factory decoration installation bounds are invalid");
    }
  }
  if (hull && (![hull.minX, hull.minY, hull.minZ, hull.maxX, hull.maxY, hull.maxZ].every(Number.isFinite)
    || hull.minX >= hull.maxX || hull.minY >= hull.maxY || hull.minZ >= hull.maxZ)) {
    throw new TypeError("Factory decoration Hull footprint is invalid");
  }
  const boxCount = owners.length + (hull ? 1 : 0);
  const boundsBytes = boxCount * 6 * Float64Array.BYTES_PER_ELEMENT;
  // Account the retained arrays, owner strings, entries, and the small wrapper
  // using the same bounded object/edge allowances as the Factory CPU ledger.
  return boundsBytes + idBytes + 64 * (owners.length * 2 + 4) + 16 * (owners.length * 2 + 8);
};

export const estimateFactoryDecorFootprintBytes = (
  owners: readonly FactoryDecorInstallationBounds[], hull?: FactoryDecorHullFootprint
): number => validatedBounds(owners, hull);

export const createFactoryDecorFootprints = (
  owners: readonly FactoryDecorInstallationBounds[], hull?: FactoryDecorHullFootprint
): FactoryDecorFootprints => {
  const retainedBytes = validatedBounds(owners, hull);
  const sorted = [...owners].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
  const ownerIds = Object.freeze(sorted.map(owner => owner.instanceId));
  const ownerWitnesses = Object.freeze(sorted.map(owner => owner.ownerWitness));
  const boundsMeters = new Float64Array((sorted.length + (hull ? 1 : 0)) * 6);
  let offset = 0;
  for (const owner of sorted) {
    for (let axis = 0; axis < 3; axis += 1) boundsMeters[offset++] = owner.boundsMm.min[axis]! / 1000;
    for (let axis = 0; axis < 3; axis += 1) boundsMeters[offset++] = owner.boundsMm.max[axis]! / 1000;
  }
  if (hull) {
    for (const value of [hull.minX, hull.minY, hull.minZ, hull.maxX, hull.maxY, hull.maxZ]) boundsMeters[offset++] = value;
  }
  return Object.freeze({ ownerIds, ownerWitnesses, boundsMeters, ownerCount: sorted.length, hullIncluded: hull !== undefined, retainedBytes });
};

export const sameFactoryDecorFootprints = (left: FactoryDecorFootprints, right: FactoryDecorFootprints): boolean =>
  left.ownerCount === right.ownerCount && left.hullIncluded === right.hullIncluded
  && left.ownerIds.every((id, index) => id === right.ownerIds[index])
  && left.ownerWitnesses.every((value, index) => value === right.ownerWitnesses[index])
  && left.boundsMeters.length === right.boundsMeters.length
  && left.boundsMeters.every((value, index) => value === right.boundsMeters[index]);

/** Compare a bounded current read without allocating another retained footprint generation. */
export const factoryDecorFootprintsMatchOwners = (
  current: FactoryDecorFootprints,
  owners: readonly FactoryDecorInstallationBounds[],
  hull: FactoryDecorHullFootprint | undefined,
  includeWitnesses = true
): boolean => {
  if (owners.length !== current.ownerCount || (hull !== undefined) !== current.hullIncluded) return false;
  for (let index = 0; index < current.ownerCount; index += 1) {
    const id = current.ownerIds[index]!;
    const owner = owners.find(value => value.instanceId === id);
    if (!owner || (includeWitnesses && owner.ownerWitness !== current.ownerWitnesses[index])) return false;
    const offset = index * 6;
    for (let axis = 0; axis < 3; axis += 1) {
      if (owner.boundsMm.min[axis]! / 1000 !== current.boundsMeters[offset + axis]
        || owner.boundsMm.max[axis]! / 1000 !== current.boundsMeters[offset + 3 + axis]) return false;
    }
  }
  if (hull) {
    const offset = current.ownerCount * 6;
    for (const [index, value] of [hull.minX, hull.minY, hull.minZ, hull.maxX, hull.maxY, hull.maxZ].entries()) {
      if (value !== current.boundsMeters[offset + index]) return false;
    }
  }
  return true;
};

export const factoryDecorFootprintGeometryMatchesOwners = (
  current: FactoryDecorFootprints,
  owners: readonly FactoryDecorInstallationBounds[],
  hull: FactoryDecorHullFootprint | undefined
): boolean => factoryDecorFootprintsMatchOwners(current, owners, hull, false);

export interface FactoryDecorProjection {
  readonly occupancy: HvpMeshOccupancy;
  readonly offsetBytes: number;
}

const topAt = (read: (x: number, z: number) => HvpSourceColumn, x: number, z: number): number => {
  const top = read(x, z).topMeters;
  if (!Number.isFinite(top)) throw new Error("Factory decoration ground is non-finite");
  return top;
};

/** Read-only render occupancy. Source slots, digest, anchors, and Native wood are never copied or changed. */
export const createFactoryDecorProjection = (
  source: HvpPlantSource,
  profile: HvpVegetationSourceProfile | undefined,
  footprints: FactoryDecorFootprints
): FactoryDecorProjection => {
  const volume = source.decoration;
  let offsets: Int16Array | undefined;
  let minShift = 0, maxShift = 0, hasShift = false;
  if (profile && source.instance.kind !== "tree") {
    if (volume.sizeX !== 22 || volume.sizeZ !== 22 || volume.cellMeters !== CELL_METERS) {
      throw new Error("Factory decorative bed dimensions are not the admitted projection");
    }
    offsets = new Int16Array(DECOR_COLUMN_COUNT);
    for (let z = 0; z < volume.sizeZ; z += 1) {
      for (let x = 0; x < volume.sizeX; x += 1) {
        const worldX = source.instance.position.x + volume.originMeters.x + (x + 0.5) * CELL_METERS;
        const worldZ = source.instance.position.z + volume.originMeters.z + (z + 0.5) * CELL_METERS;
        const factoryGround = topAt(profile.readColumn, worldX, worldZ);
        const legacyGround = topAt(readHvpSourceColumnWorld, worldX, worldZ);
        const shift = (factoryGround - legacyGround) / CELL_METERS;
        if (!Number.isSafeInteger(shift) || shift < -32768 || shift > 32767) {
          throw new Error("Factory decoration ground shift is not an exact bounded cell offset");
        }
        offsets[x + volume.sizeX * z] = shift;
        if (!hasShift) { minShift = shift; maxShift = shift; hasShift = true; }
        else { minShift = Math.min(minShift, shift); maxShift = Math.max(maxShift, shift); }
      }
    }
  }
  const sizeY = volume.sizeY + maxShift - minShift;
  if (!Number.isSafeInteger(sizeY) || sizeY <= 0 || sizeY > 256) {
    throw new Error("Factory decoration projected height exceeds the existing mesher bound");
  }
  const originMeters = Object.freeze({ x: volume.originMeters.x, y: volume.originMeters.y + minShift * CELL_METERS,
    z: volume.originMeters.z });
  const slotAt = (x: number, y: number, z: number): number => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)
      || x < 0 || y < 0 || z < 0 || x >= volume.sizeX || y >= sizeY || z >= volume.sizeZ) return 0;
    const rawY = y + minShift - (offsets?.[x + volume.sizeX * z] ?? 0);
    const slot = volume.slotAt(x, rawY, z);
    if (slot === 0 || footprints.boundsMeters.length === 0) return slot;
    const minX = source.instance.position.x + originMeters.x + x * CELL_METERS;
    const minY = source.instance.position.y + originMeters.y + y * CELL_METERS;
    const minZ = source.instance.position.z + originMeters.z + z * CELL_METERS;
    const maxX = minX + CELL_METERS, maxY = minY + CELL_METERS, maxZ = minZ + CELL_METERS;
    for (let i = 0; i < footprints.boundsMeters.length; i += 6) {
      if (maxX > footprints.boundsMeters[i]! && minX < footprints.boundsMeters[i + 3]!
        && maxY > footprints.boundsMeters[i + 1]! && minY < footprints.boundsMeters[i + 4]!
        && maxZ > footprints.boundsMeters[i + 2]! && minZ < footprints.boundsMeters[i + 5]!) return 0;
    }
    return slot;
  };
  const occupancy: HvpMeshOccupancy = Object.freeze({ sizeX: volume.sizeX, sizeY, sizeZ: volume.sizeZ,
    cellMeters: volume.cellMeters, originMeters, slotAt });
  return Object.freeze({ occupancy, offsetBytes: offsets?.byteLength ?? 0 });
};

/** Exact bounded exposed-unit-face count used before the existing greedy mesher allocates output arrays. */
export const countFactoryDecorFaces = (occupancy: HvpMeshOccupancy): Readonly<{ occupiedCells: number; exposedFaces: number }> => {
  let occupiedCells = 0, exposedFaces = 0;
  for (let z = 0; z < occupancy.sizeZ; z += 1) {
    for (let y = 0; y < occupancy.sizeY; y += 1) {
      for (let x = 0; x < occupancy.sizeX; x += 1) {
        if (occupancy.slotAt(x, y, z) === 0) continue;
        occupiedCells += 1;
        if (occupancy.slotAt(x - 1, y, z) === 0) exposedFaces += 1;
        if (occupancy.slotAt(x + 1, y, z) === 0) exposedFaces += 1;
        if (occupancy.slotAt(x, y - 1, z) === 0) exposedFaces += 1;
        if (occupancy.slotAt(x, y + 1, z) === 0) exposedFaces += 1;
        if (occupancy.slotAt(x, y, z - 1) === 0) exposedFaces += 1;
        if (occupancy.slotAt(x, y, z + 1) === 0) exposedFaces += 1;
      }
    }
  }
  return Object.freeze({ occupiedCells, exposedFaces });
};

export const factoryDecorFaceBytes = (faces: number, ao: boolean): Readonly<{ mesh: number; temp: number; triangles: number }> => {
  if (!Number.isSafeInteger(faces) || faces < 0) throw new RangeError("Factory decoration face count is invalid");
  // Every exposed unit face is a conservative greedy-quad bound. Vertex colors
  // (palette or AO) are included in both the retained mesh and copy accounting.
  return Object.freeze({ mesh: faces * 168, temp: faces * (ao ? 440 : 344), triangles: faces * 2 });
};
