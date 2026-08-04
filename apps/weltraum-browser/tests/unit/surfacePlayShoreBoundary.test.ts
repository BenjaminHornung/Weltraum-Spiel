import { describe, expect, it } from "vitest";
import {
  createSurfaceCapsuleSweepQuery,
  type SurfaceCapsuleSweepResultInput
} from "../../src/surface-play/contracts";
import {
  createShoreBoundSurfaceCollisionDelegate
} from "../../src/surface-play/surfacePlayCollision";
import {
  findHestiaShoreBoundaryFraction,
  selectHestiaSurfaceWorld,
  type HestiaSurfaceGroundProbe
} from "../../src/surface-play/world/hestiaSurfaceWorld";

const identity = Object.freeze({
  bodyId: "body:hestia",
  regionId: "region:hestia.surface-play",
  surfaceFrameId: "frame:surface.hestia-play",
  regionRevision: 7
});

const dryIslandProbe: HestiaSurfaceGroundProbe = {
  sampleGround(xMeters, zMeters) {
    if (Math.abs(xMeters) > 20 || Math.abs(zMeters) > 20) return null;
    return {
      heightMeters: 8,
      normal: { x: 0, y: 1, z: 0 },
      capsuleClear: true
    };
  }
};

const worldResult = selectHestiaSurfaceWorld({
  identity,
  rootSeed: "hestia-shore-boundary-unit",
  voxelSizeMeters: 0.5,
  frameOriginMeters: { x: 0, y: 0, z: 0 },
  waterSurfaceHeightMeters: 0,
  probe: dryIslandProbe
});

if (worldResult.status !== "Selected") throw new Error(worldResult.failure.message);
const boundary = worldResult.world.shoreBoundary;

describe("Surface Play ShoreBoundary collision seam", () => {
  it("clips a point ray and a capsule before either can enter a non-dry cell", () => {
    const pointFraction = findHestiaShoreBoundaryFraction(
      boundary,
      { x: 0, z: 0 },
      { x: 30, z: 0 },
      0
    );
    const capsuleFraction = findHestiaShoreBoundaryFraction(
      boundary,
      { x: 0, z: 0 },
      { x: 30, z: 0 },
      0.35
    );

    expect(pointFraction).not.toBeNull();
    expect(capsuleFraction).not.toBeNull();
    expect(pointFraction).toBeLessThan(1);
    expect(capsuleFraction).toBeLessThan(pointFraction ?? 0);
  });

  it("returns the nearer revision-bound shore contact instead of crossing the domain", () => {
    const noTerrainHit: SurfaceCapsuleSweepResultInput = {
      status: "Resolved",
      queryId: "unused",
      fraction: 1,
      contact: null
    };
    const delegate = createShoreBoundSurfaceCollisionDelegate({
      boundary,
      delegate: {
        queryGroundContact: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
        sweepCapsule: (query) => ({ ...noTerrainHit, queryId: query.queryId }),
        queryRay: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
        queryLine: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null })
      }
    });
    const query = createSurfaceCapsuleSweepQuery({
      ...identity,
      simulationTick: 12,
      queryId: "shore:test:1",
      kind: "CapsuleSweep",
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0, y: 8.9, z: 0 },
      displacementMeters: { x: 30, y: 0, z: 0 }
    });

    const result = delegate.sweepCapsule(query);

    expect(result.status).toBe("Resolved");
    if (result.status !== "Resolved") throw new Error(result.message);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThan(1);
    expect(result.contact?.colliderId).toBe("shore-boundary:region:hestia.surface-play:7");
    const finalX = query.startPositionMeters.x + query.displacementMeters.x * result.fraction;
    expect(finalX).toBeLessThan(20);
  });

  it("fails closed when the immutable boundary identity is not the query identity", () => {
    const delegate = createShoreBoundSurfaceCollisionDelegate({
      boundary,
      delegate: {
        queryGroundContact: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
        sweepCapsule: (query) => ({ status: "Resolved", queryId: query.queryId, fraction: 1, contact: null }),
        queryRay: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
        queryLine: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null })
      }
    });
    const query = createSurfaceCapsuleSweepQuery({
      ...identity,
      regionRevision: identity.regionRevision + 1,
      simulationTick: 12,
      queryId: "shore:test:stale",
      kind: "CapsuleSweep",
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0, y: 8.9, z: 0 },
      displacementMeters: { x: 1, y: 0, z: 0 }
    });

    const result = delegate.sweepCapsule(query);

    expect(result).toMatchObject({
      status: "Rejected",
      queryId: query.queryId,
      code: "StaleRevision"
    });
  });

  it("builds one dry-cell lookup per immutable boundary identity across repeated sweeps", () => {
    let dryCellReads = 0;
    const trackedBoundary = new Proxy(boundary, {
      get(target, property, receiver) {
        if (property === "dryCellKeys") dryCellReads += 1;
        return Reflect.get(target, property, receiver);
      }
    });
    const before = JSON.stringify(boundary);

    for (let index = 0; index < 600; index += 1) {
      expect(findHestiaShoreBoundaryFraction(
        trackedBoundary,
        { x: 0, z: 0 },
        { x: 0, z: 0 },
        0.35
      )).toBeNull();
    }

    expect(dryCellReads).toBe(1);
    expect(JSON.stringify(boundary)).toBe(before);
  });
});
