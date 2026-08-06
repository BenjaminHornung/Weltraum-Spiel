import { VOXEL_SIZE_METERS } from "../domain/constants";
import { treeAnchorsForChunk, type VoxelTreeAnchor } from "../domain/generator";
import { mix32, sampleMacroWorld, type MacroWorldDescriptor } from "../domain/macroDescriptor";
import type { EditChunkChange, MacroTreeArchetype, CellCoord, Vec3 } from "../domain/types";

export type VoxelV2VegetationBand = "near" | "mid" | "far";
export type VoxelV2VegetationKind = "trunk" | "canopy" | "branch" | "flora";

export const VOXEL_V2_VEGETATION_BANDS = Object.freeze({
  near: Object.freeze({ innerRadiusMeters: 0, outerRadiusMeters: 40 }),
  mid: Object.freeze({ innerRadiusMeters: 40, outerRadiusMeters: 96 }),
  far: Object.freeze({ innerRadiusMeters: 96, outerRadiusMeters: 320 })
});

const QUERY_GRID_METERS = 16;
const FLORA_GRID_METERS = 10;
const TREE_QUERY_MARGIN_METERS = 12;
const MAX_TREE_ANCHORS = 768;
const MAX_FLORA_ANCHORS = 512;

interface VegetationBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface VoxelV2VegetationAnchor {
  readonly id: string;
  readonly base: CellCoord;
  readonly archetype: MacroTreeArchetype | "flora";
  readonly variant: number;
  readonly band: VoxelV2VegetationBand;
  readonly bounds: VegetationBounds;
}

export interface VoxelV2VegetationInstance {
  readonly id: string;
  readonly anchorId: string;
  readonly parentId: string | null;
  readonly band: VoxelV2VegetationBand;
  readonly kind: VoxelV2VegetationKind;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
}

export interface VoxelV2VegetationProjection {
  readonly anchors: readonly VoxelV2VegetationAnchor[];
  readonly instances: readonly VoxelV2VegetationInstance[];
}

export interface VoxelV2VegetationBatch {
  readonly band: VoxelV2VegetationBand;
  readonly kind: VoxelV2VegetationKind;
  readonly instances: readonly VoxelV2VegetationInstance[];
}

const freezeVec3 = (value: Vec3): Vec3 => Object.freeze({ x: value.x, y: value.y, z: value.z });

const cellPosition = (cell: CellCoord): Vec3 => ({
  x: (cell.x + 0.5) * VOXEL_SIZE_METERS,
  y: cell.y * VOXEL_SIZE_METERS,
  z: (cell.z + 0.5) * VOXEL_SIZE_METERS
});

const bandForRadius = (radius: number): VoxelV2VegetationBand | null => {
  if (radius >= VOXEL_V2_VEGETATION_BANDS.near.innerRadiusMeters
    && radius < VOXEL_V2_VEGETATION_BANDS.near.outerRadiusMeters) return "near";
  if (radius >= VOXEL_V2_VEGETATION_BANDS.mid.innerRadiusMeters
    && radius < VOXEL_V2_VEGETATION_BANDS.mid.outerRadiusMeters) return "mid";
  if (radius >= VOXEL_V2_VEGETATION_BANDS.far.innerRadiusMeters
    && radius <= VOXEL_V2_VEGETATION_BANDS.far.outerRadiusMeters) return "far";
  return null;
};

const bandForBase = (base: CellCoord): VoxelV2VegetationBand | null => {
  const position = cellPosition(base);
  return bandForRadius(Math.hypot(position.x, position.z));
};

const baseIsSupported = (descriptor: MacroWorldDescriptor, base: CellCoord): boolean => {
  const sample = sampleMacroWorld(
    descriptor,
    (base.x + 0.5) * VOXEL_SIZE_METERS,
    (base.z + 0.5) * VOXEL_SIZE_METERS
  );
  return !sample.isWater
    && !sample.spawnClearing
    && sample.terrainFamily !== "water"
    && base.y === sample.surfaceLevelCells + 1;
};

const supportCellForAnchor = (base: CellCoord): CellCoord => ({
  x: base.x,
  y: base.y - 1,
  z: base.z
});

const isSameCell = (left: CellCoord, right: CellCoord): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z;

const anchorIdForTree = (anchor: VoxelTreeAnchor): string =>
  `tree:${anchor.base.x}:${anchor.base.y}:${anchor.base.z}:${anchor.archetype}:${anchor.variant}`;

const anchorIdForFlora = (gridX: number, gridZ: number, base: CellCoord, variant: number): string =>
  `flora:${gridX}:${gridZ}:${base.x}:${base.y}:${base.z}:${variant}`;

const treeHeight = (archetype: MacroTreeArchetype, variant: number): number => {
  const variation = (variant % 5) * 0.32;
  if (archetype === "mangrove") return 3.5 + variation;
  if (archetype === "coast-savanna") return 4.2 + variation;
  if (archetype === "buttress-root") return 4.7 + variation;
  return 4.4 + variation;
};

const treeCanopyScale = (archetype: MacroTreeArchetype, variant: number): Vec3 => {
  const variation = (variant % 3) * 0.18;
  if (archetype === "mangrove") return { x: 2.2 + variation, y: 1.35 + variation * 0.4, z: 2.1 + variation };
  if (archetype === "coast-savanna") return { x: 2.7 + variation, y: 1.45 + variation * 0.4, z: 2.35 + variation };
  if (archetype === "buttress-root") return { x: 2.55 + variation, y: 1.6 + variation * 0.4, z: 2.65 + variation };
  return { x: 2.8 + variation, y: 1.55 + variation * 0.4, z: 2.5 + variation };
};

const boundsWithinBand = (bounds: VegetationBounds, band: VoxelV2VegetationBand): boolean => {
  const nearestX = Math.max(bounds.min.x, Math.min(0, bounds.max.x));
  const nearestZ = Math.max(bounds.min.z, Math.min(0, bounds.max.z));
  const outerRadius = Math.max(
    Math.hypot(bounds.min.x, bounds.min.z),
    Math.hypot(bounds.min.x, bounds.max.z),
    Math.hypot(bounds.max.x, bounds.min.z),
    Math.hypot(bounds.max.x, bounds.max.z)
  );
  return Math.hypot(nearestX, nearestZ) >= VOXEL_V2_VEGETATION_BANDS[band].innerRadiusMeters
    && outerRadius <= VOXEL_V2_VEGETATION_BANDS[band].outerRadiusMeters;
};

const branchDirection = (index: number, variant: number): { readonly x: number; readonly z: number } => {
  const angle = ((index * 2 + variant % 4) * Math.PI) / 4;
  return { x: Math.cos(angle), z: Math.sin(angle) };
};

const createInstance = (
  anchorId: string,
  parentId: string | null,
  band: VoxelV2VegetationBand,
  kind: VoxelV2VegetationKind,
  index: number,
  position: Vec3,
  rotation: Vec3,
  scale: Vec3
): VoxelV2VegetationInstance => Object.freeze({
  id: `${anchorId}:${kind}:${index}`,
  anchorId,
  parentId,
  band,
  kind,
  position: freezeVec3(position),
  rotation: freezeVec3(rotation),
  scale: freezeVec3(scale)
});

const treeProducts = (
  descriptor: MacroWorldDescriptor,
  anchor: VoxelTreeAnchor,
  band: VoxelV2VegetationBand,
  anchorId: string
): { readonly anchor: VoxelV2VegetationAnchor; readonly instances: readonly VoxelV2VegetationInstance[] } | null => {
  if (!baseIsSupported(descriptor, anchor.base)) return null;
  const base = cellPosition(anchor.base);
  const height = treeHeight(anchor.archetype, anchor.variant);
  const canopy = treeCanopyScale(anchor.archetype, anchor.variant);
  const trunkId = `${anchorId}:trunk:0`;
  const instances: VoxelV2VegetationInstance[] = [
    createInstance(anchorId, null, band, "trunk", 0, {
      x: base.x,
      y: base.y + height / 2,
      z: base.z
    }, { x: 0, y: (anchor.variant % 7) * 0.13, z: 0 }, {
      x: 0.26 + (anchor.variant % 2) * 0.04,
      y: height,
      z: 0.26 + (anchor.variant % 2) * 0.04
    }),
    createInstance(anchorId, trunkId, band, "canopy", 0, {
      x: base.x + (anchor.variant % 3 - 1) * 0.18,
      y: base.y + height * 0.82,
      z: base.z + ((anchor.variant >>> 2) % 3 - 1) * 0.16
    }, { x: 0, y: (anchor.variant % 5) * 0.22, z: 0 }, canopy)
  ];

  const branchLength = anchor.archetype === "buttress-root" || anchor.archetype === "mangrove" ? 1.35 : 1.05;
  const branchCount = anchor.archetype === "coast-savanna" ? 3 : 4;
  for (let index = 0; index < branchCount; index += 1) {
    const direction = branchDirection(index, anchor.variant);
    const isRoot = (anchor.archetype === "buttress-root" || anchor.archetype === "mangrove") && index < 2;
    const length = isRoot ? branchLength * 1.25 : branchLength;
    instances.push(createInstance(anchorId, trunkId, band, "branch", index, {
      x: base.x + direction.x * length * 0.5,
      y: base.y + (isRoot ? 0.14 : height * (0.48 + (index % 2) * 0.08)),
      z: base.z + direction.z * length * 0.5
      }, { x: Math.PI / 2, y: 0, z: Math.atan2(-direction.x, direction.z) }, {
      x: 0.14,
      y: length,
      z: 0.14
    }));
  }

  const boundsRadius = Math.max(canopy.x, canopy.z) + 0.35;
  const bounds = {
    min: { x: base.x - boundsRadius, y: base.y, z: base.z - boundsRadius },
    max: { x: base.x + boundsRadius, y: base.y + height + canopy.y, z: base.z + boundsRadius }
  };
  return {
    anchor: Object.freeze({
      id: anchorId,
      base: Object.freeze({ ...anchor.base }),
      archetype: anchor.archetype,
      variant: anchor.variant,
      band,
      bounds: Object.freeze({ min: freezeVec3(bounds.min), max: freezeVec3(bounds.max) })
    }),
    instances: Object.freeze(instances)
  };
};

const queryTreeAnchors = (descriptor: MacroWorldDescriptor): readonly VoxelTreeAnchor[] => {
  const minimumGrid = Math.floor((-VOXEL_V2_VEGETATION_BANDS.far.outerRadiusMeters - TREE_QUERY_MARGIN_METERS) / QUERY_GRID_METERS);
  const maximumGrid = Math.ceil((VOXEL_V2_VEGETATION_BANDS.far.outerRadiusMeters + TREE_QUERY_MARGIN_METERS) / QUERY_GRID_METERS);
  const anchors = new Map<string, { readonly anchor: VoxelTreeAnchor; readonly priority: number }>();
  for (let gridZ = minimumGrid; gridZ <= maximumGrid; gridZ += 1) {
    for (let gridX = minimumGrid; gridX <= maximumGrid; gridX += 1) {
      const chunk = { x: gridX * 2, y: 0, z: gridZ * 2 };
      for (const anchor of treeAnchorsForChunk(descriptor, chunk)) {
        const band = bandForBase(anchor.base);
        if (band === null || !baseIsSupported(descriptor, anchor.base)) continue;
        const id = anchorIdForTree(anchor);
        if (!anchors.has(id)) anchors.set(id, {
          anchor,
          priority: mix32(descriptor.seedHash, anchor.base.x, anchor.base.z, 0x6c3d2a11)
        });
      }
    }
  }
  return Object.freeze([...anchors.values()]
    .sort((left, right) => left.priority - right.priority || anchorIdForTree(left.anchor).localeCompare(anchorIdForTree(right.anchor)))
    .slice(0, MAX_TREE_ANCHORS)
    .map((entry) => entry.anchor));
};

const floraProducts = (
  descriptor: MacroWorldDescriptor,
  gridX: number,
  gridZ: number
): { readonly anchor: VoxelV2VegetationAnchor; readonly instances: readonly VoxelV2VegetationInstance[] } | null => {
  const placement = mix32(descriptor.seedHash, gridX, gridZ, 0x1f6c3d95);
  if (placement % 100 >= 34) return null;
  const x = gridX * FLORA_GRID_METERS + ((placement % 17) - 8) * 0.12;
  const z = gridZ * FLORA_GRID_METERS + (((placement >>> 8) % 17) - 8) * 0.12;
  const radius = Math.hypot(x, z);
  const band = bandForRadius(radius);
  if (band === null) return null;
  const sample = sampleMacroWorld(descriptor, x, z);
  if (sample.isWater || sample.spawnClearing || sample.terrainFamily === "water") return null;
  const base = {
    x: Math.floor(x / VOXEL_SIZE_METERS),
    y: sample.surfaceLevelCells + 1,
    z: Math.floor(z / VOXEL_SIZE_METERS)
  };
  if (!baseIsSupported(descriptor, base)) return null;
  const variant = placement >>> 16;
  const anchorId = anchorIdForFlora(gridX, gridZ, base, variant);
  const basePosition = cellPosition(base);
  const count = 3 + (placement % 3);
  const instances: VoxelV2VegetationInstance[] = [];
  for (let index = 0; index < count; index += 1) {
    const offsetX = ((placement >>> (index % 4)) % 5 - 2) * 0.28;
    const offsetZ = ((placement >>> (8 + index % 4)) % 5 - 2) * 0.28;
    const height = 0.55 + ((placement >>> (12 + index % 4)) % 4) * 0.12;
    instances.push(createInstance(anchorId, null, band, "flora", index, {
      x: basePosition.x + offsetX,
      y: basePosition.y + height / 2,
      z: basePosition.z + offsetZ
    }, { x: 0, y: ((variant + index) % 8) * Math.PI / 4, z: 0 }, {
      x: 0.72 + (variant % 3) * 0.08,
      y: height,
      z: 0.72 + ((variant >>> 2) % 3) * 0.08
    }));
  }
  const boundsRadius = 1.4;
  const product = {
    anchor: Object.freeze({
      id: anchorId,
      base: Object.freeze(base),
      archetype: "flora",
      variant,
      band,
      bounds: Object.freeze({
        min: freezeVec3({ x: basePosition.x - boundsRadius, y: basePosition.y, z: basePosition.z - boundsRadius }),
        max: freezeVec3({ x: basePosition.x + boundsRadius, y: basePosition.y + 1.1, z: basePosition.z + boundsRadius })
      })
    }),
    instances: Object.freeze(instances)
  };
  return boundsWithinBand(product.anchor.bounds, band) ? product : null;
};

const queryFlora = (descriptor: MacroWorldDescriptor): readonly { gridX: number; gridZ: number }[] => {
  const minimumGrid = Math.floor(-VOXEL_V2_VEGETATION_BANDS.far.outerRadiusMeters / FLORA_GRID_METERS) - 1;
  const maximumGrid = Math.ceil(VOXEL_V2_VEGETATION_BANDS.far.outerRadiusMeters / FLORA_GRID_METERS) + 1;
  const candidates: { gridX: number; gridZ: number; key: string; priority: number }[] = [];
  for (let gridZ = minimumGrid; gridZ <= maximumGrid; gridZ += 1) {
    for (let gridX = minimumGrid; gridX <= maximumGrid; gridX += 1) {
      const product = floraProducts(descriptor, gridX, gridZ);
      if (product !== null) candidates.push({
        gridX,
        gridZ,
        key: product.anchor.id,
        priority: mix32(descriptor.seedHash, gridX, gridZ, 0x62b74e03)
      });
    }
  }
  return Object.freeze(candidates
    .sort((left, right) => left.priority - right.priority || left.key.localeCompare(right.key))
    .slice(0, MAX_FLORA_ANCHORS)
    .map(({ gridX, gridZ }) => ({ gridX, gridZ })));
};

export const createVoxelV2VegetationProjection = (descriptor: MacroWorldDescriptor): VoxelV2VegetationProjection => {
  const anchors: VoxelV2VegetationAnchor[] = [];
  const instances: VoxelV2VegetationInstance[] = [];
  for (const tree of queryTreeAnchors(descriptor)) {
    const band = bandForBase(tree.base);
    if (band === null) continue;
    const product = treeProducts(descriptor, tree, band, anchorIdForTree(tree));
    if (product === null || !boundsWithinBand(product.anchor.bounds, band)) continue;
    anchors.push(product.anchor);
    instances.push(...product.instances);
  }
  for (const candidate of queryFlora(descriptor)) {
    const product = floraProducts(descriptor, candidate.gridX, candidate.gridZ);
    if (product === null) continue;
    anchors.push(product.anchor);
    instances.push(...product.instances);
  }
  return Object.freeze({ anchors: Object.freeze(anchors), instances: Object.freeze(instances) });
};

export const groupVoxelV2Vegetation = (
  projection: VoxelV2VegetationProjection
): readonly VoxelV2VegetationBatch[] => {
  const grouped = new Map<string, VoxelV2VegetationInstance[]>();
  for (const instance of projection.instances) {
    const key = `${instance.band}:${instance.kind}`;
    const batch = grouped.get(key) ?? [];
    batch.push(instance);
    grouped.set(key, batch);
  }
  return Object.freeze([...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, instances]) => {
      const [band, kind] = key.split(":") as [VoxelV2VegetationBand, VoxelV2VegetationKind];
      return Object.freeze({ band, kind, instances: Object.freeze(instances) });
    }));
};

export const voxelV2VegetationInvalidationKeys = (
  projection: VoxelV2VegetationProjection,
  changes: readonly EditChunkChange[]
): readonly string[] => {
  const invalidated = new Set<string>();
  for (const change of changes) {
    for (const anchor of projection.anchors) {
      const supportCell = supportCellForAnchor(anchor.base);
      if (change.changedCells.some((cell) => isSameCell(cell, anchor.base) || isSameCell(cell, supportCell))) {
        invalidated.add(anchor.id);
      }
    }
  }
  return Object.freeze([...invalidated].sort());
};

export const removeVoxelV2VegetationAnchors = (
  projection: VoxelV2VegetationProjection,
  anchorIds: readonly string[]
): VoxelV2VegetationProjection => {
  if (anchorIds.length === 0) return projection;
  const invalidated = new Set(anchorIds);
  return Object.freeze({
    anchors: Object.freeze(projection.anchors.filter((anchor) => !invalidated.has(anchor.id))),
    instances: Object.freeze(projection.instances.filter((instance) => !invalidated.has(instance.anchorId)))
  });
};

export const voxelV2VegetationBatchKey = (
  band: VoxelV2VegetationBand,
  kind: VoxelV2VegetationKind
): string => `${band}:${kind}`;
