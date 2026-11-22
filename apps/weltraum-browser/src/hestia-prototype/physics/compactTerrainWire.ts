import {materializeCompactCells} from "../../voxel/structural/componentIndex/fragment";
import type {CompactTerrainPart} from "../../voxel/structural/componentIndex/exactShapes";
import { fnv1aHash } from "../../core/hash";
import type { HvpCell } from "../terrain/picking";
import type { HvpStructuralCell } from "../terrain/structuralIngest";

/** Coordinates are local to the original terrain grid. Runs carry exact material and occupancy. */
export interface HvpCompactTerrainSource {
  readonly generation: number;
  readonly cellCount: number;
  readonly parts: readonly CompactTerrainPart[];
}

function validateHeader(source: HvpCompactTerrainSource): void {
  if (!source || !Number.isSafeInteger(source.generation) || source.generation < 1
    || !Number.isSafeInteger(source.cellCount) || source.cellCount < 1 || source.cellCount > 32_768
    || !Array.isArray(source.parts) || !source.parts.length || source.parts.length > source.cellCount) {
    throw new Error("Invalid compact terrain source");
  }
}

/** Copy declared fields only. Bound clone work before copying any run list. */
export function copyHvpCompactTerrainSource(source: HvpCompactTerrainSource): HvpCompactTerrainSource {
  validateHeader(source);
  let runCount = 0;
  const parts = source.parts.map((part: CompactTerrainPart) => {
    if (!part || !Array.isArray(part.origin) || part.origin.length !== 3
      || !part.origin.every((n, axis) => Number.isSafeInteger(n) && n >= 0 && n % 16 === 0 && n < (axis === 1 ? 128 : 256))
      || !Number.isSafeInteger(part.leafRevision) || part.leafRevision < 0
      || !Number.isSafeInteger(part.label) || part.label < 1 || part.label > 4096
      || !Array.isArray(part.runs) || !part.runs.length || part.runs.length > source.cellCount - runCount) {
      throw new Error("Invalid compact terrain component");
    }
    runCount += part.runs.length;
    return {origin:[part.origin[0]!,part.origin[1]!,part.origin[2]!] as HvpCell, leafRevision:part.leafRevision, label:part.label, runs:[...part.runs]};
  });
  return {generation:source.generation, cellCount:source.cellCount, parts};
}

/** Reconstruct exactly once at the current StructuralObject boundary, in canonical cell order. */
export function readCompactTerrainCells(source: HvpCompactTerrainSource, ownerId: string, generation: number): readonly HvpStructuralCell[] {
  const checked = copyHvpCompactTerrainSource(source);
  if (checked.generation !== generation) throw new Error("Stale compact terrain generation");
  const cells = materializeCompactCells(checked);
  if (cells.length !== checked.cellCount || cells.some(c => c.y < 1 || c.y >= 128)) {
    throw new Error("Invalid compact terrain occupancy");
  }
  if (ownerId !== `hvp:terrain-fragment:r${generation}:${fnv1aHash(JSON.stringify(cells))}`) {
    throw new Error("Compact source does not match terrain fragment owner");
  }
  return cells;
}
