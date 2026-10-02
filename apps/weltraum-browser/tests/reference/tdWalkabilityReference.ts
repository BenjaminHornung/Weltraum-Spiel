import {
  materializeAdaptiveBrick,
  type MaterializeAdaptiveBrickInput
} from "../../src/voxel/adaptive/materialization";

export function buildTdWalkabilityReference(
  input: MaterializeAdaptiveBrickInput,
  allowedMaterials: ReadonlySet<string>
) {
  const brick = materializeAdaptiveBrick(input);
  if (
    brick.cellCount !== 4_096 ||
    brick.cellSizeQuantum !== 1 ||
    brick.occupancy.length !== 4_096 ||
    brick.material.length !== 4_096
  ) {
    throw new Error("TD_REF_UNSUPPORTED_COVERAGE");
  }

  const occupied = (x: number, y: number, z: number): boolean => {
    const index = x + 16 * (y + 16 * z);
    const value = brick.occupancy[index];
    const material = brick.material[index];
    if (value !== 0 && value !== 1) {
      throw new Error("TD_REF_UNSUPPORTED_OCCUPANCY");
    }
    if (value === 1 && (typeof material !== "string" || !allowedMaterials.has(material))) {
      throw new Error("TD_REF_UNKNOWN_MATERIAL");
    }
    return value === 1;
  };

  const walkable = new Uint8Array(256);
  for (let z = 0; z < 16; z += 1) {
    for (let x = 0; x < 16; x += 1) {
      const floor = occupied(x, 0, z);
      const low = occupied(x, 1, z);
      const high = occupied(x, 2, z);
      walkable[x + 16 * z] = floor && !low && !high ? 1 : 0;
    }
  }

  return {
    sourceContentHash: brick.contentHash,
    originQuantum: brick.key.originQuantum,
    cellSizeMeters: brick.cellSizeMeters,
    walkable
  };
}
