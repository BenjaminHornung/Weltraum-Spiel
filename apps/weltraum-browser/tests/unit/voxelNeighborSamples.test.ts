import { describe, expect, it } from "vitest";
import {
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  VoxelContractError,
  allocateVoxelChannels,
  coreSampleToStoredCoordinate,
  globalSamplePositionMeters,
  globalSampleToStoredCoordinate,
  storedSampleToCoreCoordinate,
  storedSampleToGlobalCoordinate,
  voxelSampleIndex,
  type VoxelChannels,
  type VoxelCoordinate
} from "../../src/voxel";

const sampleMaterial = (coordinate: VoxelCoordinate): number => {
  const mixed = coordinate.x * 17 + coordinate.y * 31 + coordinate.z * 43;
  return ((mixed % 5) + 5) % 5;
};

const sampleDensity = (coordinate: VoxelCoordinate): number =>
  Math.fround(coordinate.x * 0.25 + coordinate.y * 0.5 - coordinate.z * 0.125);

const generateChannels = (brickCoordinate: VoxelCoordinate): VoxelChannels => {
  const channels = allocateVoxelChannels();
  for (let z = 0; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z; z += 1) {
    for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
      for (let x = 0; x < VOXEL_BRICK_SAMPLE_DIMENSIONS.x; x += 1) {
        const stored = { x, y, z };
        const global = storedSampleToGlobalCoordinate(brickCoordinate, stored);
        const index = voxelSampleIndex(stored);
        channels.densityBuffer[index] = sampleDensity(global);
        channels.materialBuffer[index] = sampleMaterial(global);
      }
    }
  }
  return channels;
};

const densityBits = (channel: Float32Array, index: number): number =>
  new DataView(channel.buffer, channel.byteOffset, channel.byteLength).getUint32(index * 4, true);

const expectPositiveNeighborOverlap = (axis: keyof VoxelCoordinate): void => {
  const baseCoordinate = { x: -2, y: 1, z: 3 };
  const neighborCoordinate = { ...baseCoordinate, [axis]: baseCoordinate[axis] + 1 };
  const base = generateChannels(baseCoordinate);
  const neighbor = generateChannels(neighborCoordinate);
  const dimension = VOXEL_BRICK_CELL_DIMENSIONS[axis];

  const limits = {
    x: axis === "x" ? 3 : VOXEL_BRICK_SAMPLE_DIMENSIONS.x,
    y: axis === "y" ? 3 : VOXEL_BRICK_SAMPLE_DIMENSIONS.y,
    z: axis === "z" ? 3 : VOXEL_BRICK_SAMPLE_DIMENSIONS.z
  };
  for (let z = 0; z < limits.z; z += 1) {
    for (let y = 0; y < limits.y; y += 1) {
      for (let x = 0; x < limits.x; x += 1) {
        const neighborStored = { x, y, z };
        const baseStored = { ...neighborStored, [axis]: dimension + neighborStored[axis] };
        const baseGlobal = storedSampleToGlobalCoordinate(baseCoordinate, baseStored);
        const neighborGlobal = storedSampleToGlobalCoordinate(neighborCoordinate, neighborStored);
        expect(baseGlobal).toEqual(neighborGlobal);
        const baseIndex = voxelSampleIndex(baseStored);
        const neighborIndex = voxelSampleIndex(neighborStored);
        expect(densityBits(base.densityBuffer, baseIndex)).toBe(densityBits(neighbor.densityBuffer, neighborIndex));
        expect(base.materialBuffer[baseIndex]).toBe(neighbor.materialBuffer[neighborIndex]);
      }
    }
  }
};

describe("VoxelBrick apron and neighbor sampling", () => {
  it("maps stored, core, global, and SurfaceLocal coordinates explicitly", () => {
    expect(storedSampleToCoreCoordinate({ x: 0, y: 0, z: 0 })).toEqual({ x: -1, y: -1, z: -1 });
    expect(storedSampleToCoreCoordinate({ x: 34, y: 66, z: 34 })).toEqual({ x: 33, y: 65, z: 33 });
    expect(coreSampleToStoredCoordinate({ x: -1, y: 64, z: 33 })).toEqual({ x: 0, y: 65, z: 34 });

    const brick = { x: -2, y: 1, z: 3 };
    const stored = { x: 34, y: 0, z: 17 };
    const global = storedSampleToGlobalCoordinate(brick, stored);
    expect(global).toEqual({ x: -31, y: 63, z: 112 });
    expect(globalSampleToStoredCoordinate(brick, global)).toEqual(stored);
    expect(globalSamplePositionMeters(global, 0.25)).toEqual({ x: -7.75, y: 15.75, z: 28 });
  });

  it("rejects malformed coordinates and voxel sizes across public mapping helpers", () => {
    const invalidDiscreteValues = [-0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
    for (const value of invalidDiscreteValues) {
      expect(() => storedSampleToCoreCoordinate({ x: value, y: 0, z: 0 })).toThrow(VoxelContractError);
      expect(() => coreSampleToStoredCoordinate({ x: value, y: 0, z: 0 })).toThrow(VoxelContractError);
      expect(() => storedSampleToGlobalCoordinate({ x: value, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toThrow(VoxelContractError);
      expect(() => globalSampleToStoredCoordinate({ x: 0, y: 0, z: 0 }, { x: value, y: 0, z: 0 })).toThrow(VoxelContractError);
      expect(() => globalSamplePositionMeters({ x: value, y: 0, z: 0 }, 0.25)).toThrow(VoxelContractError);
    }
    for (const voxelSizeMeters of [-0, 0, -0.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => globalSamplePositionMeters({ x: 1, y: 2, z: 3 }, voxelSizeMeters)).toThrow(VoxelContractError);
    }
  });

  it("produces byte-identical density and material overlap for X neighbors", () => {
    expectPositiveNeighborOverlap("x");
  });

  it("produces byte-identical density and material overlap for Y neighbors", () => {
    expectPositiveNeighborOverlap("y");
  });

  it("produces byte-identical density and material overlap for Z neighbors", () => {
    expectPositiveNeighborOverlap("z");
  });
});
