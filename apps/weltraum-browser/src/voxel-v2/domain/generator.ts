import {
  CHUNK_CELL_COUNT,
  CHUNK_EDGE,
  DEFAULT_WORLD_SEED,
  SEA_LEVEL_CELL,
  VOXEL_SIZE_METERS,
  WORLD_MAX_CELL_Y,
  WORLD_VERSION,
  isWorldChunk
} from "./constants";
import { localCellIndex } from "./coordinates";
import {
  createMacroWorldDescriptor,
  hashString32,
  mix32,
  sampleMacroWorld,
  type MacroWorldDescriptor
} from "./macroDescriptor";
import { VoxelMaterial } from "./palette";
import type {
  CellCoord,
  ChunkCoord,
  GeneratedChunk,
  MacroTreeArchetype,
  MacroWorldSample
} from "./types";

export interface GenerateChunkInput {
  readonly coord: ChunkCoord;
  readonly seed?: string;
  readonly worldVersion?: string;
}

interface SurfaceProfile {
  readonly topY: number;
  readonly sample: MacroWorldSample;
}

interface TreeVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly material: number;
  readonly parent: CellCoord | null;
}

const SPAWN_X_CELL = 34;
const SPAWN_Z_CELL = 56;
const TREE_ANCHOR_SPACING_METERS = 16;
const TREE_FEATURE_RADIUS_CELLS = 11;
const FLORA_SPACING_CELLS = 8;
const FLORA_FEATURE_RADIUS_CELLS = 4;

const cellMeters = (cell: number): number => (cell + 0.5) * VOXEL_SIZE_METERS;

const profileAt = (descriptor: MacroWorldDescriptor, cellX: number, cellZ: number): SurfaceProfile => {
  const sample = sampleMacroWorld(descriptor, cellMeters(cellX), cellMeters(cellZ));
  return {
    topY: Math.max(3, Math.min(WORLD_MAX_CELL_Y - 28, sample.surfaceLevelCells)),
    sample
  };
};

const terrainMaterial = (profile: SurfaceProfile, y: number): number => {
  const { sample, topY } = profile;
  const depth = topY - y;
  if (depth === 0) {
    if (sample.isWater || sample.isShore || sample.terrainFamily === "wet-rock") return VoxelMaterial.WetBoundary;
    if (sample.terrainFamily === "sand") return VoxelMaterial.Sand;
    return VoxelMaterial.MossGrass;
  }
  if (depth <= 3) {
    if (sample.terrainFamily === "sand") return VoxelMaterial.Sand;
    if (sample.moisture > 0.68) return VoxelMaterial.DarkWetRock;
    return VoxelMaterial.Soil;
  }
  const stratum = (Math.floor(y / 3) + sample.strataIndex + Math.floor(sample.curvature)) % 4;
  if (sample.moisture > 0.72 || stratum === 1) return VoxelMaterial.DarkWetRock;
  return stratum === 3 || sample.terrainFamily === "rock" ? VoxelMaterial.LightRock : VoxelMaterial.DarkWetRock;
};

const insideSpawnClearing = (cellX: number, cellZ: number): boolean =>
  Math.hypot(cellX - SPAWN_X_CELL, cellZ - SPAWN_Z_CELL) < 24;

const writeGlobalCell = (
  cells: Uint8Array,
  chunk: ChunkCoord,
  global: CellCoord,
  material: number,
  onlyIfAir: boolean
): boolean => {
  const local = {
    x: global.x - chunk.x * CHUNK_EDGE,
    y: global.y - chunk.y * CHUNK_EDGE,
    z: global.z - chunk.z * CHUNK_EDGE
  };
  if (
    local.x < 0 || local.x >= CHUNK_EDGE
    || local.y < 0 || local.y >= CHUNK_EDGE
    || local.z < 0 || local.z >= CHUNK_EDGE
  ) return false;
  const index = localCellIndex(local);
  if (onlyIfAir && cells[index] !== VoxelMaterial.Air) return false;
  cells[index] = material;
  return true;
};

const cellValueInChunk = (cells: Uint8Array, chunk: ChunkCoord, global: CellCoord): number | null => {
  const local = {
    x: global.x - chunk.x * CHUNK_EDGE,
    y: global.y - chunk.y * CHUNK_EDGE,
    z: global.z - chunk.z * CHUNK_EDGE
  };
  if (
    local.x < 0 || local.x >= CHUNK_EDGE
    || local.y < 0 || local.y >= CHUNK_EDGE
    || local.z < 0 || local.z >= CHUNK_EDGE
  ) return null;
  return cells[localCellIndex(local)] ?? VoxelMaterial.Air;
};

const voxelKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;

const putTreeVoxel = (
  voxels: Map<string, TreeVoxel>,
  x: number,
  y: number,
  z: number,
  material: number,
  parent: CellCoord | null
): void => {
  const key = voxelKey(x, y, z);
  const existing = voxels.get(key);
  if (!existing || (existing.material === VoxelMaterial.Leaves && material === VoxelMaterial.Wood)) {
    voxels.set(key, { x, y, z, material, parent });
  }
};

const addLine = (
  voxels: Map<string, TreeVoxel>,
  start: CellCoord,
  end: CellCoord,
  material: number
): void => {
  let previous: CellCoord | null = null;
  const current = { ...start };
  while (true) {
    putTreeVoxel(voxels, current.x, current.y, current.z, material, previous);
    if (current.x === end.x && current.y === end.y && current.z === end.z) break;
    previous = { ...current };
    const remaining = {
      x: Math.abs(end.x - current.x),
      y: Math.abs(end.y - current.y),
      z: Math.abs(end.z - current.z)
    };
    if (remaining.x >= remaining.z && remaining.x >= remaining.y && remaining.x > 0) current.x += Math.sign(end.x - current.x);
    else if (remaining.z >= remaining.y && remaining.z > 0) current.z += Math.sign(end.z - current.z);
    else current.y += Math.sign(end.y - current.y);
  }
};

const addTrunk = (
  voxels: Map<string, TreeVoxel>,
  center: CellCoord,
  height: number,
  leanX = 0,
  leanZ = 0
): void => {
  let previous = center;
  for (let offsetY = 0; offsetY <= height; offsetY += 1) {
    const current = {
      x: center.x + Math.round(leanX * offsetY / Math.max(1, height)),
      y: center.y + offsetY,
      z: center.z + Math.round(leanZ * offsetY / Math.max(1, height))
    };
    addLine(voxels, previous, current, VoxelMaterial.Wood);
    if (offsetY < 4) {
      putTreeVoxel(voxels, current.x + 1, current.y, current.z, VoxelMaterial.Wood, current);
      putTreeVoxel(voxels, current.x, current.y, current.z + 1, VoxelMaterial.Wood, current);
    }
    previous = current;
  }
};

const addCanopy = (
  voxels: Map<string, TreeVoxel>,
  center: CellCoord,
  radiusX: number,
  radiusZ: number,
  layers: number,
  salt: number
): void => {
  const halfLayers = Math.floor(layers / 2);
  for (let layer = 0; layer < layers; layer += 1) {
    const y = center.y + layer - halfLayers;
    const layerRadiusX = Math.max(2, radiusX - Math.abs(layer - halfLayers));
    const layerRadiusZ = Math.max(2, radiusZ - Math.abs(layer - halfLayers));
    for (let z = -layerRadiusZ; z <= layerRadiusZ; z += 1) {
      for (let x = -layerRadiusX; x <= layerRadiusX; x += 1) {
        const shape = (x * x) / (layerRadiusX * layerRadiusX) + (z * z) / (layerRadiusZ * layerRadiusZ);
        const edgeBreakup = mix32(salt, center.x + x, center.z + z, y) % 7;
        if (shape > 1 || (shape > 0.72 && edgeBreakup === 0)) continue;
        const inwardParent = x > 0
          ? { x: center.x + x - 1, y, z: center.z + z }
          : x < 0
            ? { x: center.x + x + 1, y, z: center.z + z }
            : z > 0
              ? { x: center.x + x, y, z: center.z + z - 1 }
              : z < 0
                ? { x: center.x + x, y, z: center.z + z + 1 }
                : { x: center.x, y: y - 1, z: center.z };
        putTreeVoxel(voxels, center.x + x, y, center.z + z, VoxelMaterial.Leaves, inwardParent);
      }
    }
  }
};

const addUmbrellaTree = (voxels: Map<string, TreeVoxel>, base: CellCoord, variant: number): void => {
  const height = 12 + (variant % 5);
  addTrunk(voxels, base, height);
  const branchY = base.y + height - 4;
  const branchLength = 4 + (variant % 3);
  const branchDirections = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 1 }
  ];
  for (let index = 0; index < branchDirections.length; index += 1) {
    const direction = branchDirections[(index + variant) % branchDirections.length];
    addLine(voxels, { x: base.x, y: branchY - index % 2, z: base.z }, {
      x: base.x + direction.x * (branchLength - index % 2),
      y: branchY - 1 - index % 2,
      z: base.z + direction.z * (branchLength - index % 2)
    }, VoxelMaterial.Wood);
  }
  addCanopy(voxels, { x: base.x, y: base.y + height - 3, z: base.z }, 7 + variant % 2, 6 + (variant + 1) % 3, 5, variant);
};

const addButtressTree = (voxels: Map<string, TreeVoxel>, base: CellCoord, variant: number): void => {
  const height = 10 + (variant % 6);
  addTrunk(voxels, base, height, variant % 2 === 0 ? 1 : -1, variant % 3 === 0 ? 1 : 0);
  const rootDirections = [
    { x: 1, z: 1 },
    { x: -1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: -1 }
  ];
  for (const direction of rootDirections) {
    addLine(voxels, base, {
      x: base.x + direction.x * (3 + variant % 2),
      y: base.y,
      z: base.z + direction.z * (3 + (variant + 1) % 2)
    }, VoxelMaterial.Wood);
  }
  const branchY = base.y + height - 3;
  addLine(voxels, { x: base.x, y: branchY, z: base.z }, { x: base.x + 5, y: branchY - 1, z: base.z + 1 }, VoxelMaterial.Wood);
  addLine(voxels, { x: base.x, y: branchY - 1, z: base.z }, { x: base.x - 3, y: branchY + 1, z: base.z - 3 }, VoxelMaterial.Wood);
  addCanopy(voxels, { x: base.x + 1, y: base.y + height - 2, z: base.z }, 6, 5 + variant % 3, 4, variant + 17);
};

const addCoastTree = (voxels: Map<string, TreeVoxel>, base: CellCoord, variant: number): void => {
  const height = 13 + (variant % 6);
  const lean = variant % 2 === 0 ? 2 : -2;
  addTrunk(voxels, base, height, lean, variant % 3 === 0 ? 1 : 0);
  const crownX = base.x + lean;
  const crownZ = base.z + (variant % 3 === 0 ? 1 : 0);
  addLine(voxels, { x: base.x + Math.round(lean * 0.5), y: base.y + height - 4, z: base.z }, { x: crownX - lean, y: base.y + height - 5, z: crownZ }, VoxelMaterial.Wood);
  addLine(voxels, { x: crownX, y: base.y + height - 5, z: crownZ }, { x: crownX + (lean >= 0 ? 3 : -3), y: base.y + height - 3, z: crownZ + 2 }, VoxelMaterial.Wood);
  addCanopy(voxels, { x: crownX, y: base.y + height - 2, z: crownZ }, 4 + variant % 2, 4, 4, variant + 31);
};

const addMangroveTree = (voxels: Map<string, TreeVoxel>, base: CellCoord, variant: number): void => {
  const height = 9 + (variant % 5);
  addTrunk(voxels, base, height, variant % 2 === 0 ? 1 : -1, 0);
  const rootDirections = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: -1 }
  ];
  for (let index = 0; index < rootDirections.length; index += 1) {
    const direction = rootDirections[(index + variant) % rootDirections.length];
    addLine(voxels, base, {
      x: base.x + direction.x * (2 + index % 3),
      y: base.y,
      z: base.z + direction.z * (2 + (index + 1) % 3)
    }, VoxelMaterial.Wood);
  }
  addLine(voxels, { x: base.x, y: base.y + height - 4, z: base.z }, { x: base.x + 3, y: base.y + height - 3, z: base.z - 2 }, VoxelMaterial.Wood);
  addCanopy(voxels, { x: base.x + 1, y: base.y + height - 2, z: base.z - 1 }, 5 + variant % 2, 5, 4, variant + 53);
};

const treeVoxels = (base: CellCoord, archetype: MacroTreeArchetype, variant: number): readonly TreeVoxel[] => {
  const voxels = new Map<string, TreeVoxel>();
  if (archetype === "umbrella") addUmbrellaTree(voxels, base, variant);
  else if (archetype === "buttress-root") addButtressTree(voxels, base, variant);
  else if (archetype === "coast-savanna") addCoastTree(voxels, base, variant);
  else addMangroveTree(voxels, base, variant);
  return [...voxels.values()];
};

const faceAdjacent = (left: CellCoord, right: CellCoord): boolean =>
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y) + Math.abs(left.z - right.z) === 1;

const supportedDecorativeCell = (descriptor: MacroWorldDescriptor, cell: CellCoord): boolean => {
  const profile = profileAt(descriptor, cell.x, cell.z);
  return !profile.sample.isWater && !profile.sample.spawnClearing && cell.y > profile.topY;
};

const addTree = (
  cells: Uint8Array,
  descriptor: MacroWorldDescriptor,
  coord: ChunkCoord,
  base: CellCoord,
  archetype: MacroTreeArchetype,
  variant: number
): void => {
  const voxels = treeVoxels(base, archetype, variant);
  const eligible = new Set(voxels.filter((voxel) => supportedDecorativeCell(descriptor, voxel)).map((voxel) => voxelKey(voxel.x, voxel.y, voxel.z)));
  const byKey = new Map(voxels.map((voxel) => [voxelKey(voxel.x, voxel.y, voxel.z), voxel]));
  const supportCache = new Map<string, boolean>();
  const hasSupportedParent = (voxel: TreeVoxel): boolean => {
    const key = voxelKey(voxel.x, voxel.y, voxel.z);
    const cached = supportCache.get(key);
    if (cached !== undefined) return cached;
    if (!eligible.has(key)) {
      supportCache.set(key, false);
      return false;
    }
    const supported = voxel.parent === null
      ? voxel.y === profileAt(descriptor, voxel.x, voxel.z).topY + 1
      : faceAdjacent(voxel, voxel.parent)
        && byKey.has(voxelKey(voxel.parent.x, voxel.parent.y, voxel.parent.z))
        && hasSupportedParent(byKey.get(voxelKey(voxel.parent.x, voxel.parent.y, voxel.parent.z)) as TreeVoxel);
    supportCache.set(key, supported);
    return supported;
  };
  let pending = voxels.filter(hasSupportedParent);
  while (pending.length > 0) {
    let progress = false;
    const next: TreeVoxel[] = [];
    for (const voxel of pending) {
      const parentValue = voxel.parent === null ? VoxelMaterial.Air : cellValueInChunk(cells, coord, voxel.parent);
      if (voxel.parent !== null && parentValue !== null && parentValue === VoxelMaterial.Air) {
        next.push(voxel);
        continue;
      }
      writeGlobalCell(cells, coord, { x: voxel.x, y: voxel.y, z: voxel.z }, voxel.material, true);
      if (cellValueInChunk(cells, coord, voxel) !== null) progress = true;
    }
    if (!progress) break;
    pending = next;
  }
};

export interface VoxelTreeAnchor {
  readonly base: CellCoord;
  readonly archetype: MacroTreeArchetype;
  readonly variant: number;
}

export const treeAnchorsForChunk = (
  descriptor: MacroWorldDescriptor,
  coord: ChunkCoord
): readonly VoxelTreeAnchor[] => {
  const minX = coord.x * CHUNK_EDGE - TREE_FEATURE_RADIUS_CELLS;
  const maxX = (coord.x + 1) * CHUNK_EDGE - 1 + TREE_FEATURE_RADIUS_CELLS;
  const minZ = coord.z * CHUNK_EDGE - TREE_FEATURE_RADIUS_CELLS;
  const maxZ = (coord.z + 1) * CHUNK_EDGE - 1 + TREE_FEATURE_RADIUS_CELLS;
  const minGridX = Math.floor((minX * VOXEL_SIZE_METERS) / TREE_ANCHOR_SPACING_METERS);
  const maxGridX = Math.floor((maxX * VOXEL_SIZE_METERS) / TREE_ANCHOR_SPACING_METERS);
  const minGridZ = Math.floor((minZ * VOXEL_SIZE_METERS) / TREE_ANCHOR_SPACING_METERS);
  const maxGridZ = Math.floor((maxZ * VOXEL_SIZE_METERS) / TREE_ANCHOR_SPACING_METERS);
  const anchors: VoxelTreeAnchor[] = [];
  const seenAnchorKeys = new Set<string>();

  for (let gridZ = minGridZ; gridZ <= maxGridZ; gridZ += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      const macroSample = sampleMacroWorld(
        descriptor,
        gridX * TREE_ANCHOR_SPACING_METERS + TREE_ANCHOR_SPACING_METERS / 2,
        gridZ * TREE_ANCHOR_SPACING_METERS + TREE_ANCHOR_SPACING_METERS / 2
      );
      const anchor = macroSample.anchor;
      if (seenAnchorKeys.has(anchor.key)) continue;
      seenAnchorKeys.add(anchor.key);
      const placement = mix32(descriptor.seedHash, gridX, gridZ, 0x4d3a2f11);
      const centerX = Math.floor(anchor.x / VOXEL_SIZE_METERS);
      const centerZ = Math.floor(anchor.z / VOXEL_SIZE_METERS);
      if (insideSpawnClearing(centerX, centerZ)) continue;
      const profile = profileAt(descriptor, centerX, centerZ);
      if (profile.sample.isWater || profile.topY <= SEA_LEVEL_CELL) continue;
      const archetype = anchor.recommendedTreeArchetype;
      const density = archetype === "mangrove" ? 74 : archetype === "coast-savanna" ? 48 : 58;
      if (placement % 100 >= density) continue;
      const slope = Math.max(
        Math.abs(profileAt(descriptor, centerX + 2, centerZ).topY - profile.topY),
        Math.abs(profileAt(descriptor, centerX, centerZ + 2).topY - profile.topY)
      );
      if (slope > 6) continue;
      anchors.push({
        base: { x: centerX, y: profile.topY + 1, z: centerZ },
        archetype,
        variant: placement >>> 16
      });
    }
  }
  return Object.freeze(anchors);
};

const addTrees = (cells: Uint8Array, descriptor: MacroWorldDescriptor, coord: ChunkCoord): void => {
  for (const anchor of treeAnchorsForChunk(descriptor, coord)) {
    addTree(cells, descriptor, coord, anchor.base, anchor.archetype, anchor.variant);
  }
};

const addFlora = (cells: Uint8Array, descriptor: MacroWorldDescriptor, coord: ChunkCoord): void => {
  const minX = coord.x * CHUNK_EDGE - FLORA_FEATURE_RADIUS_CELLS;
  const maxX = (coord.x + 1) * CHUNK_EDGE - 1 + FLORA_FEATURE_RADIUS_CELLS;
  const minZ = coord.z * CHUNK_EDGE - FLORA_FEATURE_RADIUS_CELLS;
  const maxZ = (coord.z + 1) * CHUNK_EDGE - 1 + FLORA_FEATURE_RADIUS_CELLS;
  const minGridX = Math.floor(minX / FLORA_SPACING_CELLS);
  const maxGridX = Math.floor(maxX / FLORA_SPACING_CELLS);
  const minGridZ = Math.floor(minZ / FLORA_SPACING_CELLS);
  const maxGridZ = Math.floor(maxZ / FLORA_SPACING_CELLS);

  for (let gridZ = minGridZ; gridZ <= maxGridZ; gridZ += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      const placement = mix32(descriptor.seedHash, gridX, gridZ, 0x1f6c3d95);
      if (placement % 100 >= 43) continue;
      const centerX = gridX * FLORA_SPACING_CELLS + 4 + (placement % 5) - 2;
      const centerZ = gridZ * FLORA_SPACING_CELLS + 4 + ((placement >>> 8) % 5) - 2;
      if (insideSpawnClearing(centerX, centerZ)) continue;
      const center = profileAt(descriptor, centerX, centerZ);
      if (center.sample.isWater || center.topY <= SEA_LEVEL_CELL) continue;
      const count = 3 + ((placement >>> 16) % 4);
      const material = VoxelMaterial.FloraCoral + ((placement >>> 24) % 3);
      for (let index = 0; index < count; index += 1) {
        const offsetX = ((placement >>> (index % 4)) % 5) - 2;
        const offsetZ = ((placement >>> (8 + index % 4)) % 5) - 2;
        const cellX = centerX + offsetX;
        const cellZ = centerZ + offsetZ;
        const profile = profileAt(descriptor, cellX, cellZ);
        if (profile.sample.isWater || profile.sample.spawnClearing || profile.topY <= SEA_LEVEL_CELL) continue;
        const height = 1 + ((placement >>> (12 + index % 4)) % 4);
        let supported = true;
        for (let offsetY = 1; offsetY <= height; offsetY += 1) {
          if (!supported) break;
          const cell = { x: cellX, y: profile.topY + offsetY, z: cellZ };
          const written = writeGlobalCell(cells, coord, cell, material, true);
          if (!written && cellValueInChunk(cells, coord, cell) !== null) supported = false;
        }
      }
    }
  }
};

export const suggestedSpawnCell = (seed = DEFAULT_WORLD_SEED): CellCoord => {
  const descriptor = createMacroWorldDescriptor(seed, WORLD_VERSION);
  return {
    x: SPAWN_X_CELL,
    y: profileAt(descriptor, SPAWN_X_CELL, SPAWN_Z_CELL).topY + 1,
    z: SPAWN_Z_CELL
  };
};

export const generateHestiaChunk = (input: GenerateChunkInput): GeneratedChunk => {
  if (!isWorldChunk(input.coord.x, input.coord.y, input.coord.z)) throw new Error("V2 generation chunk is outside the bounded world.");
  const seed = input.seed ?? DEFAULT_WORLD_SEED;
  const worldVersion = input.worldVersion ?? WORLD_VERSION;
  const descriptor = createMacroWorldDescriptor(seed, worldVersion);
  const cells = new Uint8Array(CHUNK_CELL_COUNT);

  for (let localZ = 0; localZ < CHUNK_EDGE; localZ += 1) {
    for (let localX = 0; localX < CHUNK_EDGE; localX += 1) {
      const globalX = input.coord.x * CHUNK_EDGE + localX;
      const globalZ = input.coord.z * CHUNK_EDGE + localZ;
      const profile = profileAt(descriptor, globalX, globalZ);
      for (let localY = 0; localY < CHUNK_EDGE; localY += 1) {
        const globalY = input.coord.y * CHUNK_EDGE + localY;
        if (globalY <= profile.topY) {
          cells[localCellIndex({ x: localX, y: localY, z: localZ })] = terrainMaterial(profile, globalY);
        }
      }
    }
  }

  addTrees(cells, descriptor, input.coord);
  addFlora(cells, descriptor, input.coord);

  return { coord: { ...input.coord }, sourceRevision: hashString32(`${worldVersion}:${seed}`), cells };
};
