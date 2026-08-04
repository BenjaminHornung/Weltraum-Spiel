import { beforeAll, describe, expect, it } from "vitest";
import { isDeepFrozen } from "../../src/voxel/adaptive";
import {
  globalQuantumForStructuralCell,
  serializeStructuralCellAddress
} from "../../src/voxel/structural";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit,
  previewSurfaceTreeCanonicalHit,
  type SurfaceTreeAuthoritySnapshot
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionBinding,
  createSurfaceTreeCollisionSnapshot,
  isSurfaceTreeSpawnClear,
  overlapSurfaceTreeCapsule,
  raycastSurfaceTreeCollision,
  sweepSurfaceTreeCapsule,
  validateSurfaceTreeCollisionSnapshotTransport,
  type SurfaceTreeCollisionSnapshot
} from "../../src/surface-play/vegetation/surfaceTreeCollision";

let authority: SurfaceTreeAuthoritySnapshot;
let snapshot: SurfaceTreeCollisionSnapshot;

beforeAll(() => {
  authority = createSurfaceTreeAuthority(createHestiaUmbrellaTree());
  snapshot = createSurfaceTreeCollisionSnapshot(authority);
}, 120_000);

const playerCapsule = { radiusMeters: 0.35, heightMeters: 1.8 } as const;

const bruteForceSweep = (
  collision: Readonly<SurfaceTreeCollisionSnapshot>,
  start: Readonly<{ x: number; y: number; z: number }>,
  end: Readonly<{ x: number; y: number; z: number }>
): Readonly<{ fraction: number; addressKey: string }> | null => {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };
  const halfHeight = playerCapsule.heightMeters / 2;
  let nearest: Readonly<{ fraction: number; addressKey: string }> | null = null;
  for (const cell of collision.cells) {
    let near = 0;
    let far = 1;
    let missed = false;
    for (const axis of ["x", "y", "z"] as const) {
      const expansion = axis === "y" ? halfHeight : playerCapsule.radiusMeters;
      const minimum = cell.minMeters[axis] - expansion;
      const maximum = cell.maxMeters[axis] + expansion;
      const component = delta[axis];
      if (Math.abs(component) <= Number.EPSILON) {
        if (start[axis] < minimum || start[axis] > maximum) missed = true;
        continue;
      }
      const first = (minimum - start[axis]) / component;
      const second = (maximum - start[axis]) / component;
      near = Math.max(near, Math.min(first, second));
      far = Math.min(far, Math.max(first, second));
      if (far < near) missed = true;
    }
    if (missed || near > 1 || far < 0) continue;
    const fraction = Math.max(0, near);
    if (nearest === null || fraction < nearest.fraction) {
      nearest = {
        fraction,
        addressKey: serializeStructuralCellAddress(cell.address)
      };
    }
  }
  return nearest;
};

describe("Surface Tree revision-bound collision", () => {
  it("raycasts occupied 0.125 m cells in nearest order and returns the canonical address", () => {
    const canonical = deriveSurfaceTreeCanonicalHit(authority, 0);
    const coordinate = globalQuantumForStructuralCell(canonical.address);
    const result = raycastSurfaceTreeCollision(snapshot, {
      binding: createSurfaceTreeCollisionBinding(snapshot),
      originMeters: {
        x: coordinate.x * 0.125 - 2,
        y: (coordinate.y + 0.5) * 0.125,
        z: (coordinate.z + 0.5) * 0.125
      },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 4
    });
    expect(result.status).toBe("Resolved");
    if (result.status !== "Resolved") throw new Error("Tree ray unexpectedly rejected.");
    expect(result.kind).toBe("Hit");
    if (result.kind !== "Hit") throw new Error("Tree ray unexpectedly missed.");
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.hit.materialId).toBe(2);
    expect(result.hit.pointMeters.x).toBeLessThanOrEqual(canonical.pointMeters.x);
    expect(isDeepFrozen(result)).toBe(true);

    const repeat = raycastSurfaceTreeCollision(snapshot, {
      binding: createSurfaceTreeCollisionBinding(snapshot),
      originMeters: {
        x: coordinate.x * 0.125 - 2,
        y: (coordinate.y + 0.5) * 0.125,
        z: (coordinate.z + 0.5) * 0.125
      },
      direction: { x: 5, y: 0, z: 0 },
      maximumDistanceMeters: 4
    });
    expect(repeat).toEqual(result);
  });

  it("blocks capsule overlap, sweep, and spawn admission at the trunk while leaving a distant spawn clear", () => {
    const hit = deriveSurfaceTreeCanonicalHit(authority, 0);
    const trunkCenter = {
      x: (authority.tree.rootQuantum.x + 0.5) * 0.125,
      y: hit.pointMeters.y,
      z: (authority.tree.rootQuantum.z + 0.5) * 0.125
    };
    const binding = createSurfaceTreeCollisionBinding(snapshot);
    const overlap = overlapSurfaceTreeCapsule(snapshot, {
      binding,
      positionMeters: trunkCenter,
      capsule: playerCapsule
    });
    expect(overlap).toMatchObject({ status: "Resolved", overlaps: true });

    const sweep = sweepSurfaceTreeCapsule(snapshot, {
      binding,
      startMeters: { ...trunkCenter, x: trunkCenter.x - 2 },
      endMeters: { ...trunkCenter, x: trunkCenter.x + 2 },
      capsule: playerCapsule
    });
    expect(sweep.status).toBe("Resolved");
    if (sweep.status !== "Resolved") throw new Error("Tree sweep unexpectedly rejected.");
    expect(sweep.hit).not.toBeNull();
    expect(sweep.fraction).toBeGreaterThanOrEqual(0);
    expect(sweep.fraction).toBeLessThan(1);

    expect(isSurfaceTreeSpawnClear(snapshot, {
      binding,
      positionMeters: trunkCenter,
      capsule: playerCapsule
    })).toMatchObject({ status: "Resolved", clear: false });
    expect(isSurfaceTreeSpawnClear(snapshot, {
      binding,
      positionMeters: { ...trunkCenter, x: trunkCenter.x + 20, z: trunkCenter.z + 20 },
      capsule: playerCapsule
    })).toEqual({ status: "Resolved", clear: true, blockingHit: null });
  });

  it("matches the brute-force nearest cell while reusing one coarse index for 600 far sweeps", () => {
    const hit = deriveSurfaceTreeCanonicalHit(authority, 0);
    const trunkCenter = {
      x: (authority.tree.rootQuantum.x + 0.5) * 0.125,
      y: hit.pointMeters.y,
      z: (authority.tree.rootQuantum.z + 0.5) * 0.125
    };
    const start = { ...trunkCenter, x: trunkCenter.x - 2 };
    const end = { ...trunkCenter, x: trunkCenter.x + 2 };
    const reference = bruteForceSweep(snapshot, start, end);
    const optimized = sweepSurfaceTreeCapsule(snapshot, {
      binding: createSurfaceTreeCollisionBinding(snapshot),
      startMeters: start,
      endMeters: end,
      capsule: playerCapsule
    });
    expect(reference).not.toBeNull();
    expect(optimized.status).toBe("Resolved");
    if (optimized.status !== "Resolved" || optimized.hit === null || reference === null) {
      throw new Error("Expected the near Tree sweep to hit in both implementations.");
    }
    expect(optimized.fraction).toBe(reference.fraction);
    expect(serializeStructuralCellAddress(optimized.hit.address)).toBe(reference.addressKey);

    let visitedCells = 0;
    const trackedCells = new Proxy(snapshot.cells, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          return function* () {
            for (let index = 0; index < target.length; index += 1) {
              visitedCells += 1;
              yield target[index];
            }
          };
        }
        return Reflect.get(target, property, receiver);
      }
    });
    const trackedSnapshot: SurfaceTreeCollisionSnapshot = Object.freeze({
      ...snapshot,
      cells: trackedCells
    });
    const trackedBinding = createSurfaceTreeCollisionBinding(trackedSnapshot);
    for (let index = 0; index < 600; index += 1) {
      expect(sweepSurfaceTreeCapsule(trackedSnapshot, {
        binding: trackedBinding,
        startMeters: { x: 10_000, y: 10_000, z: 10_000 },
        endMeters: { x: 10_001, y: 10_000, z: 10_000 },
        capsule: playerCapsule
      })).toEqual({ status: "Resolved", fraction: 1, hit: null });
    }
    expect(visitedCells).toBe(snapshot.cells.length);
  });

  it("fails closed for object, revision, and content-hash mismatches", () => {
    const common = {
      originMeters: { x: -2, y: 1, z: 1 },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 8
    };
    const current = createSurfaceTreeCollisionBinding(snapshot);
    expect(raycastSurfaceTreeCollision(snapshot, {
      ...common,
      binding: { ...current, objectId: "hestia.surface-play.tree-object.other" }
    })).toMatchObject({ status: "Rejected", code: "ObjectMismatch" });
    expect(raycastSurfaceTreeCollision(snapshot, {
      ...common,
      binding: { ...current, objectRevision: current.objectRevision + 1 }
    })).toMatchObject({ status: "Rejected", code: "StaleRevision" });
    expect(raycastSurfaceTreeCollision(snapshot, {
      ...common,
      binding: { ...current, objectContentHash: "fnv1a64-v1:0000000000000000" }
    })).toMatchObject({ status: "Rejected", code: "StaleContentHash" });
  });

  it("publishes a new collision revision after an accepted local edit and rejects the old binding", () => {
    const preview = previewSurfaceTreeCanonicalHit(authority, 0);
    expect(preview.status).toBe("Accepted");
    if (preview.status !== "Accepted") throw new Error("First Tree edit unexpectedly rejected.");
    const updated = createSurfaceTreeCollisionSnapshot(preview.authority);
    const oldBinding = createSurfaceTreeCollisionBinding(snapshot);
    const query = {
      binding: oldBinding,
      positionMeters: preview.hit.pointMeters,
      capsule: playerCapsule
    };
    expect(overlapSurfaceTreeCapsule(updated, query))
      .toMatchObject({ status: "Rejected", code: "StaleRevision" });
    expect(updated.binding.objectRevision).toBe(snapshot.binding.objectRevision + 1);
    expect(updated.binding.objectContentHash).not.toBe(snapshot.binding.objectContentHash);
    expect(isDeepFrozen(updated)).toBe(true);
  }, 120_000);

  it("publishes only anchored component cells so detached bodies never keep ghost static collision", () => {
    const component = authority.classification.anchoredComponents[0];
    if (component === undefined) throw new Error("Tree fixture must publish one anchored component.");
    const detachedOnlyAuthority: SurfaceTreeAuthoritySnapshot = {
      ...authority,
      classification: {
        components: [{ ...component, anchored: false }],
        anchoredComponents: [],
        detachedComponents: [{ ...component, anchored: false }],
        fragments: authority.classification.fragments
      }
    };
    const detachedSnapshot = createSurfaceTreeCollisionSnapshot(detachedOnlyAuthority);
    expect(snapshot.cells.length).toBeGreaterThan(0);
    expect(detachedSnapshot.cells).toEqual([]);
  });

  it("keeps collision results and validation errors unchanged when diagnostics throw", () => {
    const throwingDiagnostics = {
      start() { throw new Error("diagnostic start failed"); },
      finish() { throw new Error("diagnostic finish failed"); },
      startView() { throw new Error("diagnostic view start failed"); },
      finishView() { throw new Error("diagnostic view finish failed"); }
    };
    expect(validateSurfaceTreeCollisionSnapshotTransport(
      authority,
      snapshot,
      throwingDiagnostics
    )).toEqual(snapshot);

    const invalid = { ...snapshot, contentHash: "fnv1a64-v1:0000000000000000" };
    const errorMessage = (diagnostics?: typeof throwingDiagnostics): string => {
      try {
        validateSurfaceTreeCollisionSnapshotTransport(authority, invalid, diagnostics);
        return "no error";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    expect(errorMessage(throwingDiagnostics)).toBe(errorMessage());
  });
});
