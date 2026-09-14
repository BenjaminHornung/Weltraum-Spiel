/**
 * HVP authored coast source boundary (HVP-TERRAIN-0125-v1, HVP-02 correction).
 *
 * Versioned, fully data-driven basis `hvp-authored-coast-v3` with the named
 * seed `hestia-hvp-lagoon-001`. The active region x/z [-16, 16) m and
 * y [-8, 8) m holds 256 x 128 x 256 compact Uint8 material slots
 * (8,388,608 bytes) in X-fastest adaptive order (x, then y, then z),
 * organized as 16^3-slot 2 m leaves (2,048 addressable leaves,
 * materialized as pages, never as JS object graphs).
 *
 * Slot 0 is known air only after successful validated base materialization;
 * unknown coverage outside the region is never slot 0. Public readers return
 * scalars or defensive copies, never the live authority array. Consumers
 * bind through prepareHvpCoastSource so mesh, water, and reads share one
 * validated owned copy.
 */

import { fnv1aHash } from "../core/hash";
import type { HvpCoverageState } from "./hvpTerrain";

export const HVP_COAST_SOURCE_VERSION = "hvp-authored-coast-v3";
export const HVP_COAST_SEED_NAME = "hestia-hvp-lagoon-001";

/** Addressable quantum: real 0.125 m runtime cells, not metadata. */
export const HVP_SOURCE_CELL_METERS = 0.125;

export const HVP_SOURCE_MIN_METERS = Object.freeze({ x: -16, y: -8, z: -16 });
export const HVP_SOURCE_MAX_METERS = Object.freeze({ x: 16, y: 8, z: 16 });

export const HVP_SOURCE_SIZE_X = 256;
export const HVP_SOURCE_SIZE_Y = 128;
export const HVP_SOURCE_SIZE_Z = 256;
export const HVP_SOURCE_SLOT_COUNT = HVP_SOURCE_SIZE_X * HVP_SOURCE_SIZE_Y * HVP_SOURCE_SIZE_Z;

export const HVP_SOURCE_LEAF_EDGE_SLOTS = 16;
export const HVP_SOURCE_LEAF_COUNT_X = HVP_SOURCE_SIZE_X / HVP_SOURCE_LEAF_EDGE_SLOTS;
export const HVP_SOURCE_LEAF_COUNT_Y = HVP_SOURCE_SIZE_Y / HVP_SOURCE_LEAF_EDGE_SLOTS;
export const HVP_SOURCE_LEAF_COUNT_Z = HVP_SOURCE_SIZE_Z / HVP_SOURCE_LEAF_EDGE_SLOTS;
export const HVP_SOURCE_LEAF_COUNT =
  HVP_SOURCE_LEAF_COUNT_X * HVP_SOURCE_LEAF_COUNT_Y * HVP_SOURCE_LEAF_COUNT_Z;

export const HVP_SLOT_KNOWN_AIR = 0;
export const HVP_SLOT_LIMESTONE_DRY = 1;
export const HVP_SLOT_LIMESTONE_WET = 2;
export const HVP_SLOT_SOIL = 3;
export const HVP_SLOT_MOSS = 4;

export type HvpCoastMaterialRole = "limestone-dry" | "limestone-wet" | "soil" | "moss";

export interface HvpCoastMaterialEntry {
  readonly slot: number;
  readonly key: string;
  readonly role: HvpCoastMaterialRole;
  readonly densityKgPerM3: number;
  /**
   * No accepted Hestia physics profile exists for these densities; they are
   * explicit unapproved prototype tuning assumptions pending the HVP-04 gate,
   * never accepted physical authority.
   */
  readonly provenance: "prototype-tuning-unapproved";
}

/** Slot to stable material key, policy role, and density. Bound by digest. */
export const HVP_COAST_MATERIAL_REGISTRY: readonly HvpCoastMaterialEntry[] = Object.freeze([
  Object.freeze({ slot: HVP_SLOT_LIMESTONE_DRY, key: "hestia:limestone-dry", role: "limestone-dry", densityKgPerM3: 2_400, provenance: "prototype-tuning-unapproved" }),
  Object.freeze({ slot: HVP_SLOT_LIMESTONE_WET, key: "hestia:limestone-wet", role: "limestone-wet", densityKgPerM3: 2_400, provenance: "prototype-tuning-unapproved" }),
  Object.freeze({ slot: HVP_SLOT_SOIL, key: "hestia:soil", role: "soil", densityKgPerM3: 1_500, provenance: "prototype-tuning-unapproved" }),
  Object.freeze({ slot: HVP_SLOT_MOSS, key: "hestia:moss", role: "moss", densityKgPerM3: 1_200, provenance: "prototype-tuning-unapproved" })
]);

export const HVP_COAST_REGISTRY_DIGEST = fnv1aHash(
  HVP_COAST_MATERIAL_REGISTRY.map((entry) => `${entry.slot}:${entry.key}:${entry.role}:${entry.densityKgPerM3}:${entry.provenance}`).join("\n")
);

/** Normative macro channel polyline as [x, z] meters (lagoon S-channel). */
export const HVP_CHANNEL_POLYLINE_XZ: readonly (readonly [number, number])[] = Object.freeze([
  [-3, -16],
  [-4, -10],
  [3, -4],
  [2, 3],
  [-3, 9],
  [0, 16]
] as const);

/** The agreed active excerpt continues through the northern shelf into sea. */
const HVP_COAST_CHANNEL_XZ: readonly (readonly [number, number])[] = Object.freeze([
  ...HVP_CHANNEL_POLYLINE_XZ,
  [3, 23],
  [-1, 31],
  [2, 42],
  [0, 56]
] as const);

export const HVP_SOURCE_CHANNEL_CORE_HALF_WIDTH_METERS = 1.5;
export const HVP_SOURCE_CHANNEL_MARGIN_METERS = 1.5;
export const HVP_SOURCE_CHANNEL_FLOOR_METERS = -1.5;
const HVP_CHANNEL_OUTER_METERS = HVP_SOURCE_CHANNEL_CORE_HALF_WIDTH_METERS + HVP_SOURCE_CHANNEL_MARGIN_METERS;

/** Controlled payload admission for the HVP scene (global caps). */
export const HVP_COAST_CPU_BUDGET_BYTES = 256 * 1024 * 1024;
export const HVP_COAST_MESH_BUDGET_BYTES = 128 * 1024 * 1024;
export const HVP_COAST_TRIANGLE_BUDGET = 500_000;
export const HVP_COAST_DRAW_CALL_BUDGET = 300;

const assertFinite = (value: number, owner: string): void => {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${owner} requires a finite number`);
  }
};

export interface HvpChannelDistance {
  /** Euclidean distance in meters to the closest polyline segment. */
  readonly distance: number;
  /** Geographic side: +1 east (x at or right of the closest point), -1 west. */
  readonly side: 1 | -1;
  /** Winning segment index; exact ties keep the lower index. */
  readonly segmentIndex: number;
}

/**
 * Distance from world (x, z) to the piecewise linear channel centerline.
 * Segments are checked in fixed order and a strict improvement replaces the
 * best, so an exact tie (shared vertex) deterministically keeps the lower
 * segment index.
 */
export const hvpChannelSignedDistanceMeters = (x: number, z: number): HvpChannelDistance => {
  assertFinite(x, "hvpChannelSignedDistanceMeters");
  assertFinite(z, "hvpChannelSignedDistanceMeters");
  const line = HVP_COAST_CHANNEL_XZ;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSide: 1 | -1 = 1;
  let bestSegment = 0;
  for (let index = 0; index + 1 < line.length; index += 1) {
    const ax = line[index]![0];
    const az = line[index]![1];
    const bx = line[index + 1]![0];
    const bz = line[index + 1]![1];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    let t = 0;
    if (lengthSquared > 0) {
      t = ((x - ax) * dx + (z - az) * dz) / lengthSquared;
      if (t < 0) {
        t = 0;
      } else if (t > 1) {
        t = 1;
      }
    }
    const qx = ax + dx * t;
    const qz = az + dz * t;
    const ex = x - qx;
    const ez = z - qz;
    const distance = Math.sqrt(ex * ex + ez * ez);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSegment = index;
      bestSide = x >= qx ? 1 : -1;
    }
  }
  return Object.freeze({ distance: bestDistance, side: bestSide, segmentIndex: bestSegment });
};

export interface HvpCoastHill {
  readonly centerX: number;
  readonly centerZ: number;
  readonly height: number;
  readonly baseRadius: number;
  /** First angular lobe weight/phase: breaks the circular outline. */
  readonly lobe1: number;
  readonly phase1: number;
  /** Second angular lobe weight/phase: directional ledges. */
  readonly lobe2: number;
  readonly phase2: number;
  /** Radial notch bearings that gash the outline into separate ledges. */
  readonly notchBearings: readonly number[];
  readonly notchWidth: number;
  readonly notchDepth: number;
}

/**
 * Authored macro relief. Bank hills keep their agreed positions and heights;
 * far islands are part of the same versioned descriptor (not proxy geometry).
 */
export const HVP_COAST_HILLS: readonly HvpCoastHill[] = Object.freeze([
  Object.freeze({
    centerX: -10, centerZ: -5, height: 3.2, baseRadius: 4.6,
    lobe1: 0.28, phase1: 0.7, lobe2: 0.16, phase2: 2.4,
    notchBearings: Object.freeze([Math.PI * 0.58, Math.PI * 1.55]), notchWidth: 0.18, notchDepth: 0.98
  }),
  Object.freeze({
    centerX: -9, centerZ: 8, height: 2.4, baseRadius: 4.0,
    lobe1: 0.32, phase1: 2.1, lobe2: 0.14, phase2: 4.4,
    notchBearings: Object.freeze([Math.PI * 0.65, Math.PI * 1.35]), notchWidth: 0.22, notchDepth: 0.98
  }),
  Object.freeze({
    centerX: 9, centerZ: 4, height: 2.6, baseRadius: 4.2,
    lobe1: 0.3, phase1: 5.2, lobe2: 0.18, phase2: 1.2,
    notchBearings: Object.freeze([Math.PI * 1.52, Math.PI * 1.1]), notchWidth: 0.22, notchDepth: 0.98
  }),
  Object.freeze({
    centerX: 55, centerZ: 25, height: 7, baseRadius: 12,
    lobe1: 0.3, phase1: 1.1, lobe2: 0.2, phase2: 3.6,
    notchBearings: Object.freeze([Math.PI * 0.4, Math.PI * 1.3]), notchWidth: 0.2, notchDepth: 0.45
  }),
  Object.freeze({
    centerX: -52, centerZ: -30, height: 8.5, baseRadius: 13,
    lobe1: 0.34, phase1: 4.0, lobe2: 0.16, phase2: 0.6,
    notchBearings: Object.freeze([Math.PI * 1.7]), notchWidth: 0.22, notchDepth: 0.5
  }),
  Object.freeze({
    centerX: 8, centerZ: 68, height: 8, baseRadius: 10,
    lobe1: 0.26, phase1: 2.8, lobe2: 0.22, phase2: 5.1,
    notchBearings: Object.freeze([Math.PI * 0.9, Math.PI * 1.9]), notchWidth: 0.2, notchDepth: 0.45
  })
]);

/**
 * Lobed hill footprint: radius varies with bearing (never a ring stack) and
 * explicit radial notches gash the outline into directional ledges. The peak
 * stays exactly height at the authored center.
 */
const hillMeters = (x: number, z: number, hill: HvpCoastHill): number => {
  const dx = x - hill.centerX;
  const dz = z - hill.centerZ;
  const radius = Math.sqrt(dx * dx + dz * dz);
  if (radius >= hill.baseRadius * 1.6) {
    return 0;
  }
  const bearing = Math.atan2(dz, dx);
  const outline =
    hill.baseRadius
    * (1 + hill.lobe1 * Math.cos(bearing - hill.phase1) + hill.lobe2 * Math.cos(2 * (bearing - hill.phase2)));
  if (radius >= outline) {
    return 0;
  }
  const t = 1 - (radius / outline) * (radius / outline);
  let height = hill.height * t * t * (3 - 2 * t);
  for (const notch of hill.notchBearings) {
    let delta = Math.abs(bearing - notch) % (Math.PI * 2);
    if (delta > Math.PI) {
      delta = Math.PI * 2 - delta;
    }
    const gash = Math.exp(-(delta * delta) / (2 * hill.notchWidth * hill.notchWidth));
    height *= 1 - hill.notchDepth * gash * Math.min(1, radius / (hill.baseRadius * 0.35) + 0.25);
  }
  return Math.max(0, height);
};

/** Explicit sheltered cove notch subtracted from the banks (bay, not noise). */
const coveMeters = (x: number, z: number, centerX: number, centerZ: number, depth: number, sigma: number): number => {
  const dx = x - centerX;
  const dz = z - centerZ;
  return depth * Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
};

const mesoUndulationMeters = (x: number, z: number): number => {
  // Shore relief belongs to the coastal shelf, not an endlessly tiled deep
  // seabed. All authored hills and the active/join regions remain unchanged.
  const shelf = Math.max(0, Math.min(1, (90 - Math.hypot(x, z)) / 20));
  return shelf * (0.28 * Math.sin(x * 0.55 + 1.7) * Math.cos(z * 0.48 - 0.6)
    + 0.14 * Math.sin((x - z) * 0.9 + 0.4));
};

/**
 * Spatially coherent vegetation patch fields. Low-frequency authored fields
 * with organic edges grow soil and moss zones; no per-cell hash speckle.
 */
const soilPatchField = (x: number, z: number): number =>
  0.5 + 0.5 * Math.sin(x * 0.23 + 1.1) * Math.cos(z * 0.19 - 0.5) + 0.25 * Math.sin((x + z) * 0.31 + 0.7);

const mossPatchField = (x: number, z: number): number =>
  0.5 + 0.5 * Math.sin(x * 0.31 + 4.0) * Math.cos(z * 0.27 + 1.9) + 0.25 * Math.sin((x - z) * 0.23 + 2.2);

/**
 * Open-sea ease of the same macro descriptor: beyond 30 m radial distance
 * the base dives gently below sea level so the lagoon shelf meets open water
 * with staggered island forms instead of an endless plain or a square edge.
 */
const farSeaEaseMeters = (x: number, z: number): number => {
  const radius = Math.sqrt(x * x + z * z);
  if (radius <= 30) {
    return 0;
  }
  return Math.min(4.0, (radius - 30) * 0.1);
};

/**
 * Continuous macro surface in meters: asymmetric plateaus (west 1.5 m,
 * east 0.75 m) with lobed, notched hills at their authored positions and
 * heights, gentle meso undulation, explicit shoreline coves, and the
 * S-channel carved to the -1.5 m floor with a linear east profile and a
 * smoothstep west profile. Far islands and the open-sea ease belong to the
 * same versioned descriptor and vanish inside the active region.
 */
export const hvpSourceSurfaceMeters = (x: number, z: number): number => {
  assertFinite(x, "hvpSourceSurfaceMeters");
  assertFinite(z, "hvpSourceSurfaceMeters");
  const channel = hvpChannelSignedDistanceMeters(x, z);
  let plateau = channel.side > 0 ? 0.75 : 1.5;
  for (const hill of HVP_COAST_HILLS) {
    plateau += hillMeters(x, z, hill);
  }
  plateau += mesoUndulationMeters(x, z);
  plateau -= coveMeters(x, z, 6.5, 2.5, 1.2, 1.5);
  plateau -= coveMeters(x, z, -6, 6.5, 0.7, 1.0);
  plateau -= coveMeters(x, z, 4.5, -7.5, 0.8, 1.2);
  plateau -= coveMeters(x, z, -3.5, 10.5, 0.65, 0.9);
  plateau -= coveMeters(x, z, -9.6, -7.5, 1.4, 1.1);
  plateau -= farSeaEaseMeters(x, z);
  // Carving the outlet must never lift the already deeper coastal seabed.
  const floor = Math.min(HVP_SOURCE_CHANNEL_FLOOR_METERS, plateau);
  if (channel.distance <= HVP_SOURCE_CHANNEL_CORE_HALF_WIDTH_METERS) {
    return floor;
  }
  if (channel.distance >= HVP_CHANNEL_OUTER_METERS) {
    return plateau;
  }
  const t = (channel.distance - HVP_SOURCE_CHANNEL_CORE_HALF_WIDTH_METERS) / HVP_SOURCE_CHANNEL_MARGIN_METERS;
  const profile = channel.side > 0 ? t : t * t * (3 - 2 * t);
  // Blend toward the local bank height so the margin meets the plateau
  // continuously; the carved surface never exceeds the plateau.
  return floor + (plateau - floor) * profile;
};

/**
 * Terrace step for a surface height: fine 0.125 m steps at the shore and in
 * the shallows, 0.25 m on the lower banks, 0.5 m up high. Height-banded
 * steps keep neighboring column tops within 0.5 m of each other.
 */
const terraceStepMeters = (surfaceMeters: number): number => {
  if (surfaceMeters < 0.75) {
    return 0.125;
  }
  if (surfaceMeters < 2.0) {
    return 0.25;
  }
  return 0.5;
};

/** Quantized column top in meters for world (x, z): whole steps on the 0.125 m grid. */
export const hvpSourceColumnTopMeters = (x: number, z: number): number => {
  const surface = hvpSourceSurfaceMeters(x, z);
  const step = terraceStepMeters(surface);
  return Math.floor(surface / step + 1e-6) * step;
};

/**
 * Installed far footprint: horizontal 1 m sampling, unchanged source terrace
 * heights. Water and join ghosts query this footprint, not a second grid of
 * continuous samples or a second vertical quantization.
 */
export const hvpFarColumnTopMeters = (x: number, z: number): number => {
  assertFinite(x, "hvpFarColumnTopMeters");
  assertFinite(z, "hvpFarColumnTopMeters");
  return hvpSourceColumnTopMeters(Math.floor(x) + 0.5, Math.floor(z) + 0.5);
};

export const hvpSourceSlotRole = (slot: number): HvpCoastMaterialRole => {
  const entry = HVP_COAST_MATERIAL_REGISTRY.find((candidate) => candidate.slot === slot);
  if (entry === undefined) {
    throw new RangeError(`Unknown HVP coast material slot: ${String(slot)}`);
  }
  return entry.role;
};

/** Byte-wise FNV-1a over raw slot bytes, seeded so header and body mix into one digest. */
const fnv1aBytes = (data: Uint8Array, initial: number): number => {
  let hash = initial >>> 0;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data[index]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const headerDigestSeed = (): number => {
  const header = `${HVP_COAST_SOURCE_VERSION}\n${HVP_COAST_SEED_NAME}\n${HVP_COAST_REGISTRY_DIGEST}\n${HVP_SOURCE_SIZE_X}x${HVP_SOURCE_SIZE_Y}x${HVP_SOURCE_SIZE_Z}@${HVP_SOURCE_CELL_METERS}`;
  const headerHash = fnv1aHash(header);
  return Number.parseInt(headerHash, 16) >>> 0;
};

export interface HvpCoastSourceSnapshot {
  readonly version: string;
  readonly seedName: string;
  readonly registryDigest: string;
  readonly sourceDigest: string;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellMeters: number;
  readonly originMeters: { readonly x: number; readonly y: number; readonly z: number };
  readSlot(ix: number, iy: number, iz: number): number;
  copySlots(): Uint8Array;
}

/** Global slot address in X-fastest adaptive order: x, then y, then z. */
const snapshotIndex = (ix: number, iy: number, iz: number): number =>
  ix + HVP_SOURCE_SIZE_X * (iy + HVP_SOURCE_SIZE_Y * iz);

export interface HvpSourceColumn {
  readonly topMeters: number;
  readonly slot: number;
}

/**
 * Single sampling path for one world column: surface, terrace top, and
 * registry-bound top slot. Used by the authority materializer, the join
 * ring, and the continuity tests alike.
 */
export const readHvpSourceColumnWorld = (x: number, z: number): HvpSourceColumn => {
  assertFinite(x, "readHvpSourceColumnWorld");
  assertFinite(z, "readHvpSourceColumnWorld");
  const surface = hvpSourceSurfaceMeters(x, z);
  const step = terraceStepMeters(surface);
  const top = Math.floor(surface / step + 1e-6) * step;
  const channel = hvpChannelSignedDistanceMeters(x, z);
  let slot: number;
  if (top < 0) {
    slot = HVP_SLOT_LIMESTONE_WET;
  } else if (top < 0.375) {
    slot = HVP_SLOT_LIMESTONE_WET;
  } else {
    const moist = channel.distance < 7;
    const slope =
      Math.abs(hvpSourceSurfaceMeters(x + 0.25, z) - surface)
      + Math.abs(hvpSourceSurfaceMeters(x, z + 0.25) - surface);
    if (moist && slope < 0.3 && soilPatchField(x, z) > 0.55) {
      slot = mossPatchField(x, z) > 0.62 && slope < 0.2 ? HVP_SLOT_MOSS : HVP_SLOT_SOIL;
    } else {
      slot = HVP_SLOT_LIMESTONE_DRY;
    }
  }
  return Object.freeze({ topMeters: top, slot });
};

const fillHvpColumn = (slots: Uint8Array, ix: number, iz: number, top: number, topSlot: number): void => {
  const topExclusive = Math.floor((top - HVP_SOURCE_MIN_METERS.y) / HVP_SOURCE_CELL_METERS + 1e-6);
  if (topExclusive <= 0) {
    return;
  }
  const clampedTop = Math.min(topExclusive, HVP_SOURCE_SIZE_Y);
  for (let iy = 0; iy < clampedTop; iy += 1) {
    const isTop = iy === clampedTop - 1;
    const isSecond = iy === clampedTop - 2;
    if (isTop) {
      slots[snapshotIndex(ix, iy, iz)] = topSlot;
    } else if (isSecond && top < 0 && topSlot === HVP_SLOT_LIMESTONE_WET) {
      slots[snapshotIndex(ix, iy, iz)] = HVP_SLOT_LIMESTONE_WET;
    } else {
      slots[snapshotIndex(ix, iy, iz)] = HVP_SLOT_LIMESTONE_DRY;
    }
  }
};

const materializeSlab = (slots: Uint8Array, izStart: number, izExclusive: number): void => {
  for (let iz = izStart; iz < izExclusive; iz += 1) {
    const worldZ = -16 + (iz + 0.5) * HVP_SOURCE_CELL_METERS;
    for (let ix = 0; ix < HVP_SOURCE_SIZE_X; ix += 1) {
      const worldX = -16 + (ix + 0.5) * HVP_SOURCE_CELL_METERS;
      const column = readHvpSourceColumnWorld(worldX, worldZ);
      fillHvpColumn(slots, ix, iz, column.topMeters, column.slot);
    }
  }
};

const materializeSlots = (progress?: (doneSlabs: number, totalSlabs: number) => void): Uint8Array => {
  const slots = new Uint8Array(HVP_SOURCE_SLOT_COUNT);
  const slabRows = 16;
  const totalSlabs = HVP_SOURCE_SIZE_Z / slabRows;
  for (let slab = 0; slab < totalSlabs; slab += 1) {
    materializeSlab(slots, slab * slabRows, (slab + 1) * slabRows);
    if (progress !== undefined) {
      progress(slab + 1, totalSlabs);
    }
  }
  return slots;
};

/**
 * Source digest over canonical 16^3 leaf order (leaf X-fastest, then Y,
 * then Z): each leaf binds its bytes in adaptive X-fastest local order and
 * the fold binds the ordered leaf digests, so the digest proves the page
 * structure that leaf readers observe.
 */
const digestSourceSlots = (slots: Uint8Array): string => {
  let hash = headerDigestSeed();
  const leaf = new Uint8Array(
    HVP_SOURCE_LEAF_EDGE_SLOTS * HVP_SOURCE_LEAF_EDGE_SLOTS * HVP_SOURCE_LEAF_EDGE_SLOTS
  );
  for (let lz = 0; lz < HVP_SOURCE_LEAF_COUNT_Z; lz += 1) {
    for (let ly = 0; ly < HVP_SOURCE_LEAF_COUNT_Y; ly += 1) {
      for (let lx = 0; lx < HVP_SOURCE_LEAF_COUNT_X; lx += 1) {
        for (let z = 0; z < HVP_SOURCE_LEAF_EDGE_SLOTS; z += 1) {
          for (let y = 0; y < HVP_SOURCE_LEAF_EDGE_SLOTS; y += 1) {
            for (let x = 0; x < HVP_SOURCE_LEAF_EDGE_SLOTS; x += 1) {
              const ix = lx * HVP_SOURCE_LEAF_EDGE_SLOTS + x;
              const iy = ly * HVP_SOURCE_LEAF_EDGE_SLOTS + y;
              const iz = lz * HVP_SOURCE_LEAF_EDGE_SLOTS + z;
              leaf[x + HVP_SOURCE_LEAF_EDGE_SLOTS * (y + HVP_SOURCE_LEAF_EDGE_SLOTS * z)] =
                slots[snapshotIndex(ix, iy, iz)];
            }
          }
        }
        const leafDigest = fnv1aBytes(leaf, headerDigestSeed());
        hash ^= leafDigest;
        hash = Math.imul(hash, 0x01000193);
      }
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const wrapSnapshot = (slots: Uint8Array): HvpCoastSourceSnapshot => {
  const sourceDigest = digestSourceSlots(slots);
  return Object.freeze({
    version: HVP_COAST_SOURCE_VERSION,
    seedName: HVP_COAST_SEED_NAME,
    registryDigest: HVP_COAST_REGISTRY_DIGEST,
    sourceDigest,
    sizeX: HVP_SOURCE_SIZE_X,
    sizeY: HVP_SOURCE_SIZE_Y,
    sizeZ: HVP_SOURCE_SIZE_Z,
    cellMeters: HVP_SOURCE_CELL_METERS,
    originMeters: Object.freeze({ x: -16, y: -8, z: -16 }),
    readSlot: (ix: number, iy: number, iz: number): number => {
      if (!Number.isInteger(ix) || !Number.isInteger(iy) || !Number.isInteger(iz)) {
        throw new TypeError("readSlot requires integer slot indices");
      }
      if (ix < 0 || ix >= HVP_SOURCE_SIZE_X || iy < 0 || iy >= HVP_SOURCE_SIZE_Y || iz < 0 || iz >= HVP_SOURCE_SIZE_Z) {
        throw new RangeError(`Slot (${String(ix)},${String(iy)},${String(iz)}) is outside the HVP coast source`);
      }
      return slots[snapshotIndex(ix, iy, iz)];
    },
    copySlots: (): Uint8Array => slots.slice()
  });
};

/** Fully materialized, validated coast pages for the named seed. */
export const materializeHvpCoastSource = (): HvpCoastSourceSnapshot => wrapSnapshot(materializeSlots());

/**
 * Chunked materialization with a genuine event-loop yield between slabs so a
 * Loading state can paint; the result is bit-identical to the sync build.
 */
export const materializeHvpCoastSourceAsync = async (
  onProgress?: (doneSlabs: number, totalSlabs: number) => void
): Promise<HvpCoastSourceSnapshot> => {
  const slots = new Uint8Array(HVP_SOURCE_SLOT_COUNT);
  const slabRows = 16;
  const totalSlabs = HVP_SOURCE_SIZE_Z / slabRows;
  for (let slab = 0; slab < totalSlabs; slab += 1) {
    materializeSlab(slots, slab * slabRows, (slab + 1) * slabRows);
    if (onProgress !== undefined) {
      onProgress(slab + 1, totalSlabs);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  return wrapSnapshot(slots);
};

export const readHvpSourceSlot = (
  snapshot: HvpCoastSourceSnapshot,
  ix: number,
  iy: number,
  iz: number
): number => {
  if (snapshot === undefined || snapshot === null || typeof snapshot.readSlot !== "function") {
    throw new TypeError("readHvpSourceSlot requires a materialized HVP coast source");
  }
  return snapshot.readSlot(ix, iy, iz);
};

/**
 * Fail-closed source gate: only the exact versioned, seeded, digested source
 * with the normative dimensions may claim readiness.
 */
export const assertHvpSourceComplete = (snapshot: HvpCoastSourceSnapshot): void => {
  if (snapshot === undefined || snapshot === null) {
    throw new Error("HVP coast source is missing: materialize the named seed before claiming readiness.");
  }
  const problems: string[] = [];
  if (snapshot.version !== HVP_COAST_SOURCE_VERSION) {
    problems.push(`version ${String(snapshot.version)}`);
  }
  if (snapshot.seedName !== HVP_COAST_SEED_NAME) {
    problems.push(`seed ${String(snapshot.seedName)}`);
  }
  if (snapshot.registryDigest !== HVP_COAST_REGISTRY_DIGEST) {
    problems.push("registry digest");
  }
  if (typeof snapshot.sourceDigest !== "string" || !/^[0-9a-f]{8}$/.test(snapshot.sourceDigest)) {
    problems.push("source digest");
  }
  if (
    snapshot.sizeX !== HVP_SOURCE_SIZE_X
    || snapshot.sizeY !== HVP_SOURCE_SIZE_Y
    || snapshot.sizeZ !== HVP_SOURCE_SIZE_Z
    || snapshot.cellMeters !== HVP_SOURCE_CELL_METERS
  ) {
    problems.push("dimensions");
  }
  if (typeof snapshot.readSlot !== "function" || typeof snapshot.copySlots !== "function") {
    problems.push("readers");
  } else {
    const slots = snapshot.copySlots();
    if (!(slots instanceof Uint8Array) || slots.length !== HVP_SOURCE_SLOT_COUNT) {
      problems.push("slot pages");
    } else {
      const recomputed = digestSourceSlots(slots);
      if (recomputed !== snapshot.sourceDigest) {
        problems.push("source digest");
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`HVP coast source incomplete: ${problems.join(", ")}`);
  }
};

export interface HvpCoastLeaf {
  readonly lx: number;
  readonly ly: number;
  readonly lz: number;
  /** Defensive 4096-slot copy in adaptive X-fastest local order. */
  readonly slots: Uint8Array;
  readonly digest: string;
}

export interface HvpPreparedCoastSource {
  readonly version: string;
  readonly seedName: string;
  readonly registryDigest: string;
  readonly sourceDigest: string;
  readonly combinedLeafDigest: string;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellMeters: number;
  readonly originMeters: { readonly x: number; readonly y: number; readonly z: number };
  readSlot(ix: number, iy: number, iz: number): number;
  readCoverage(ix: number, iy: number, iz: number): HvpCoverageState;
  readLeaf(lx: number, ly: number, lz: number): HvpCoastLeaf;
  copyBytes(): Uint8Array;
}

/** Canonical leaf address for a global slot; out-of-region indices throw. */
export const hvpLeafAddressForSlot = (
  ix: number,
  iy: number,
  iz: number
): { readonly lx: number; readonly ly: number; readonly lz: number } => {
  if (!Number.isInteger(ix) || !Number.isInteger(iy) || !Number.isInteger(iz)) {
    throw new TypeError("hvpLeafAddressForSlot requires integer slot indices");
  }
  if (ix < 0 || ix >= HVP_SOURCE_SIZE_X || iy < 0 || iy >= HVP_SOURCE_SIZE_Y || iz < 0 || iz >= HVP_SOURCE_SIZE_Z) {
    throw new RangeError(`Slot (${String(ix)},${String(iy)},${String(iz)}) is outside the HVP coast source`);
  }
  return Object.freeze({
    lx: Math.floor(ix / HVP_SOURCE_LEAF_EDGE_SLOTS),
    ly: Math.floor(iy / HVP_SOURCE_LEAF_EDGE_SLOTS),
    lz: Math.floor(iz / HVP_SOURCE_LEAF_EDGE_SLOTS)
  });
};

const assertLeafAddress = (lx: number, ly: number, lz: number): void => {
  if (!Number.isInteger(lx) || !Number.isInteger(ly) || !Number.isInteger(lz)) {
    throw new TypeError("leaf reads require integer leaf coordinates");
  }
  if (lx < 0 || lx >= HVP_SOURCE_LEAF_COUNT_X || ly < 0 || ly >= HVP_SOURCE_LEAF_COUNT_Y || lz < 0 || lz >= HVP_SOURCE_LEAF_COUNT_Z) {
    throw new RangeError(`Leaf (${String(lx)},${String(ly)},${String(lz)}) is outside the HVP coast source`);
  }
};

/**
 * Ownership boundary: validates once and copies the pages once. Mesh, water,
 * and every read share this exact owned content and frame instead of trusting
 * unrelated snapshot reader closures.
 */
export const prepareHvpCoastSource = (snapshot: HvpCoastSourceSnapshot): HvpPreparedCoastSource => {
  assertHvpSourceComplete(snapshot);
  const bytes = snapshot.copySlots();
  const origin = Object.freeze({ x: snapshot.originMeters.x, y: snapshot.originMeters.y, z: snapshot.originMeters.z });
  const readSlot = (ix: number, iy: number, iz: number): number => {
    if (!Number.isInteger(ix) || !Number.isInteger(iy) || !Number.isInteger(iz)) {
      throw new TypeError("readSlot requires integer slot indices");
    }
    if (ix < 0 || ix >= HVP_SOURCE_SIZE_X || iy < 0 || iy >= HVP_SOURCE_SIZE_Y || iz < 0 || iz >= HVP_SOURCE_SIZE_Z) {
      throw new RangeError(`Slot (${String(ix)},${String(iy)},${String(iz)}) is outside the HVP coast source`);
    }
    return bytes[snapshotIndex(ix, iy, iz)];
  };
  const readCoverage = (ix: number, iy: number, iz: number): HvpCoverageState => {
    if (!Number.isInteger(ix) || !Number.isInteger(iy) || !Number.isInteger(iz)) {
      throw new TypeError("readCoverage requires integer slot indices");
    }
    if (ix < 0 || ix >= HVP_SOURCE_SIZE_X || iy < 0 || iy >= HVP_SOURCE_SIZE_Y || iz < 0 || iz >= HVP_SOURCE_SIZE_Z) {
      return "UnknownCoverage";
    }
    return bytes[snapshotIndex(ix, iy, iz)] === HVP_SLOT_KNOWN_AIR ? "KnownAir" : "KnownSolid";
  };
  const readLeaf = (lx: number, ly: number, lz: number): HvpCoastLeaf => {
    assertLeafAddress(lx, ly, lz);
    const slots = new Uint8Array(
      HVP_SOURCE_LEAF_EDGE_SLOTS * HVP_SOURCE_LEAF_EDGE_SLOTS * HVP_SOURCE_LEAF_EDGE_SLOTS
    );
    for (let z = 0; z < HVP_SOURCE_LEAF_EDGE_SLOTS; z += 1) {
      for (let y = 0; y < HVP_SOURCE_LEAF_EDGE_SLOTS; y += 1) {
        for (let x = 0; x < HVP_SOURCE_LEAF_EDGE_SLOTS; x += 1) {
          const ix = lx * HVP_SOURCE_LEAF_EDGE_SLOTS + x;
          const iy = ly * HVP_SOURCE_LEAF_EDGE_SLOTS + y;
          const iz = lz * HVP_SOURCE_LEAF_EDGE_SLOTS + z;
          slots[x + HVP_SOURCE_LEAF_EDGE_SLOTS * (y + HVP_SOURCE_LEAF_EDGE_SLOTS * z)] =
            bytes[snapshotIndex(ix, iy, iz)];
        }
      }
    }
    const digest = fnv1aBytes(slots, headerDigestSeed()).toString(16).padStart(8, "0");
    return Object.freeze({ lx, ly, lz, slots, digest });
  };
  let combined = headerDigestSeed();
  for (let lz = 0; lz < HVP_SOURCE_LEAF_COUNT_Z; lz += 1) {
    for (let ly = 0; ly < HVP_SOURCE_LEAF_COUNT_Y; ly += 1) {
      for (let lx = 0; lx < HVP_SOURCE_LEAF_COUNT_X; lx += 1) {
        const leafDigest = Number.parseInt(readLeaf(lx, ly, lz).digest, 16) >>> 0;
        combined ^= leafDigest;
        combined = Math.imul(combined, 0x01000193) >>> 0;
      }
    }
  }
  const combinedLeafDigest = (combined >>> 0).toString(16).padStart(8, "0");
  return Object.freeze({
    version: snapshot.version,
    seedName: snapshot.seedName,
    registryDigest: snapshot.registryDigest,
    sourceDigest: snapshot.sourceDigest,
    combinedLeafDigest,
    sizeX: HVP_SOURCE_SIZE_X,
    sizeY: HVP_SOURCE_SIZE_Y,
    sizeZ: HVP_SOURCE_SIZE_Z,
    cellMeters: HVP_SOURCE_CELL_METERS,
    originMeters: origin,
    readSlot,
    readCoverage,
    readLeaf,
    copyBytes: (): Uint8Array => bytes.slice()
  });
};

export interface HvpOuterWaterMask {
  /** Outer square half-size in meters; the authority footprint ends at 16 m. */
  readonly halfMeters: number;
  readonly cellMeters: number;
  readonly cells: Uint8Array;
  readonly waterCellCount: number;
}

export interface HvpWaterMask {
  readonly sizeX: number;
  readonly sizeZ: number;
  readonly cells: Uint8Array;
  readonly waterCellCount: number;
  readonly join: HvpOuterWaterMask;
  readonly outer: HvpOuterWaterMask;
  readonly digest: string;
  readonly sourceDigest: string;
}

/** Far water grid subdivides the installed 1 m land footprints exactly. */
export const HVP_JOIN_WATER_HALF_METERS = 20;
export const HVP_OUTER_WATER_HALF_METERS = 240;
export const HVP_OUTER_WATER_CELL_METERS = 0.5;

/**
 * Single water presentation mask for one y=0 plane with no duplicate
 * overlap: authority columns (0.125 m, top strictly below sea) plus the
 * join ring (0.125 m footprints, 16–20 m) and far ring (0.5 m footprints
 * starting exactly at 20 m). Dry columns and coplanar tops
 * are excluded on both grids.
 */
export const deriveHvpWaterMask = (prepared: HvpPreparedCoastSource): HvpWaterMask => {
  const bytes = prepared.copyBytes();
  const cells = new Uint8Array(HVP_SOURCE_SIZE_X * HVP_SOURCE_SIZE_Z);
  let waterCellCount = 0;
  for (let iz = 0; iz < HVP_SOURCE_SIZE_Z; iz += 1) {
    for (let ix = 0; ix < HVP_SOURCE_SIZE_X; ix += 1) {
      let solidCount = 0;
      for (let iy = HVP_SOURCE_SIZE_Y - 1; iy >= 0; iy -= 1) {
        if (bytes[snapshotIndex(ix, iy, iz)] !== HVP_SLOT_KNOWN_AIR) {
          solidCount = iy + 1;
          break;
        }
      }
      const topMeters = HVP_SOURCE_MIN_METERS.y + solidCount * HVP_SOURCE_CELL_METERS;
      if (solidCount > 0 && topMeters < -1e-9) {
        cells[iz * HVP_SOURCE_SIZE_X + ix] = 1;
        waterCellCount += 1;
      }
    }
  }
  const joinDim = Math.round((HVP_JOIN_WATER_HALF_METERS * 2) / HVP_SOURCE_CELL_METERS);
  const join = new Uint8Array(joinDim * joinDim);
  let joinWater = 0;
  for (let z = 0; z < joinDim; z += 1) {
    for (let x = 0; x < joinDim; x += 1) {
      const cx = -HVP_JOIN_WATER_HALF_METERS + (x + 0.5) * HVP_SOURCE_CELL_METERS;
      const cz = -HVP_JOIN_WATER_HALF_METERS + (z + 0.5) * HVP_SOURCE_CELL_METERS;
      if (Math.max(Math.abs(cx), Math.abs(cz)) >= 16 && hvpSourceColumnTopMeters(cx, cz) < -1e-9) {
        join[z * joinDim + x] = 1;
        joinWater += 1;
      }
    }
  }
  const outerDim = Math.round((HVP_OUTER_WATER_HALF_METERS * 2) / HVP_OUTER_WATER_CELL_METERS);
  const outer = new Uint8Array(outerDim * outerDim);
  let outerWater = 0;
  for (let oz = 0; oz < outerDim; oz += 1) {
    for (let ox = 0; ox < outerDim; ox += 1) {
      const x0 = -HVP_OUTER_WATER_HALF_METERS + ox * HVP_OUTER_WATER_CELL_METERS;
      const z0 = -HVP_OUTER_WATER_HALF_METERS + oz * HVP_OUTER_WATER_CELL_METERS;
      if (
        x0 >= -HVP_JOIN_WATER_HALF_METERS
        && x0 + HVP_OUTER_WATER_CELL_METERS <= HVP_JOIN_WATER_HALF_METERS
        && z0 >= -HVP_JOIN_WATER_HALF_METERS
        && z0 + HVP_OUTER_WATER_CELL_METERS <= HVP_JOIN_WATER_HALF_METERS
      ) {
        continue;
      }
      const centerX = x0 + HVP_OUTER_WATER_CELL_METERS / 2;
      const centerZ = z0 + HVP_OUTER_WATER_CELL_METERS / 2;
      const top = hvpFarColumnTopMeters(centerX, centerZ);
      if (top < -1e-9) {
        outer[oz * outerDim + ox] = 1;
        outerWater += 1;
      }
    }
  }
  let digest = Number.parseInt(prepared.sourceDigest, 16) >>> 0;
  digest ^= fnv1aBytes(cells, headerDigestSeed());
  digest = Math.imul(digest, 0x01000193) >>> 0;
  digest ^= fnv1aBytes(join, headerDigestSeed());
  digest = Math.imul(digest, 0x01000193) >>> 0;
  digest ^= fnv1aBytes(outer, headerDigestSeed());
  digest = Math.imul(digest, 0x01000193) >>> 0;
  return Object.freeze({
    sizeX: HVP_SOURCE_SIZE_X,
    sizeZ: HVP_SOURCE_SIZE_Z,
    cells,
    waterCellCount,
    join: Object.freeze({
      halfMeters: HVP_JOIN_WATER_HALF_METERS,
      cellMeters: HVP_SOURCE_CELL_METERS,
      cells: join,
      waterCellCount: joinWater
    }),
    outer: Object.freeze({
      halfMeters: HVP_OUTER_WATER_HALF_METERS,
      cellMeters: HVP_OUTER_WATER_CELL_METERS,
      cells: outer,
      waterCellCount: outerWater
    }),
    digest: (digest >>> 0).toString(16).padStart(8, "0"),
    sourceDigest: prepared.sourceDigest
  });
};
