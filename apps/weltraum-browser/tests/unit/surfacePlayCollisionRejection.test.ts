import { describe, expect, it, vi } from "vitest";
import { createSurfaceRayQuery } from "../../src/surface-play/contracts";
import { createSurfaceVoxelCollisionDelegate } from "../../src/surface-play/surfacePlayCollision";
import type {
  SurfaceRegionVoxelCollisionAdapter,
  SurfaceRegionVoxelState,
  SurfaceVector3
} from "../../src/surface-play/voxel-edit";

const state: SurfaceRegionVoxelState = {
  schemaVersion: "surface-region-voxel-state-v1",
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  regionId: "region:hestia.collision-rejection",
  generatorVersion: "hestia.generator.v1",
  seed: "surface-play-collision-rejection",
  voxelSizeMeters: 0.5,
  sourceRevision: 1,
  regionRevision: 4,
  editRevision: 2,
  planningRevision: 4,
  materializationRevision: 2,
  brickBounds: {
    minInclusive: { x: 0, y: -1, z: 0 },
    maxExclusive: { x: 1, y: 0, z: 1 }
  },
  residentBrickCoordinates: [{ x: 0, y: -1, z: 0 }],
  maxSubtractRadiusMeters: 2,
  maxChangedSamplesPerEdit: 20_000,
  editJournal: [],
  materializedBricks: [],
  currentVoxelContentHash: "fnv1a64:0000000000000000",
  currentRegionContentHash: "fnv1a64:0000000000000000"
};

const unused = () => { throw new Error("Unused collision-adapter method."); };

const ray = (queryId: string, originMeters: Readonly<SurfaceVector3>) => createSurfaceRayQuery({
  kind: "Ray",
  queryId,
  bodyId: state.bodyId,
  regionId: state.regionId,
  surfaceFrameId: state.surfaceFrameId,
  regionRevision: state.regionRevision,
  simulationTick: 9,
  originMeters,
  direction: { x: 0, y: -1, z: 0 },
  maximumDistanceMeters: 1
});

describe("Surface Play collision normal sampling", () => {
  it("returns the typed rejection when one normal offset rejects after a resolved contact center", () => {
    const sampleDensity = vi.fn<SurfaceRegionVoxelCollisionAdapter["sampleDensity"]>((_binding, position) => {
      if (position.x < 8) {
        return {
          status: "Rejected",
          reason: "MissingCoverage",
          message: "normal offset left resident coverage",
          regionRevision: state.regionRevision,
          editRevision: state.editRevision
        };
      }
      return {
        status: "Resolved",
        density: -1,
        materialValue: 1,
        classification: "Solid",
        regionRevision: state.regionRevision,
        editRevision: state.editRevision
      };
    });
    const adapter: SurfaceRegionVoxelCollisionAdapter = {
      sampleDensity,
      sampleSolidAir: unused,
      raycast: unused,
      queryGround: unused
    };
    const delegate = createSurfaceVoxelCollisionDelegate(adapter, state);

    const result = delegate.queryRay(ray("collision:normal-offset-rejected", { x: 8, y: -8, z: 8 }));

    expect(result).toEqual({
      status: "Rejected",
      queryId: "collision:normal-offset-rejected",
      code: "AuthorityUnavailable",
      message: "normal offset left resident coverage"
    });
    const rejectedOffset = sampleDensity.mock.calls
      .map(([, position]) => position)
      .find((position) => position.x < 8);
    expect(rejectedOffset).toBeDefined();
    expect(rejectedOffset?.x).toBeCloseTo(7.75);
    expect(rejectedOffset?.y).toBeCloseTo(-8);
    expect(rejectedOffset?.z).toBeCloseTo(8);
  });

  it("keeps positive normal offsets above the region as explicit air without querying authority", () => {
    const sampleDensity = vi.fn<SurfaceRegionVoxelCollisionAdapter["sampleDensity"]>((_binding, position) => ({
      status: "Resolved",
      density: position.y < 0 ? -1 : 1,
      materialValue: position.y < 0 ? 1 : 0,
      classification: position.y < 0 ? "Solid" : "Air",
      regionRevision: state.regionRevision,
      editRevision: state.editRevision
    }));
    const adapter: SurfaceRegionVoxelCollisionAdapter = {
      sampleDensity,
      sampleSolidAir: unused,
      raycast: unused,
      queryGround: unused
    };
    const delegate = createSurfaceVoxelCollisionDelegate(adapter, state);

    const result = delegate.queryRay(ray("collision:air-above-region", { x: 8, y: -0.1, z: 8 }));

    expect(result).toMatchObject({ status: "Resolved", queryId: "collision:air-above-region", contact: {} });
    expect(sampleDensity.mock.calls.some(([, position]) => position.y >= 0)).toBe(false);
  });
});
