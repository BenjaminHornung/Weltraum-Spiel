import { describe, expect, it } from "vitest";
import {
  hashAdaptiveCanonical,
  isDeepFrozen
} from "../../src/voxel/adaptive";
import {
  getStructuralVoxel,
  serializeStructuralCellAddress
} from "../../src/voxel/structural";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics";
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
  createSurfaceTreeCollisionSnapshotFromAcceptedChanges,
  isSurfaceTreeSpawnClear,
  overlapSurfaceTreeCapsule,
  raycastSurfaceTreeCollision,
  readSurfaceTreeCollisionDerivationStats,
  sweepSurfaceTreeCapsule,
  type SurfaceTreeCollisionSnapshot
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import {
  createSurfaceTreeRuntimeStateFromAuthority,
  preflightSurfaceTreeFire
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

const playerCapsule = { radiusMeters: 0.35, heightMeters: 1.8 } as const;

const cellKey = (
  cell: Readonly<SurfaceTreeCollisionSnapshot["cells"][number]>
): string => serializeStructuralCellAddress(cell.address);

const collisionHash = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>
): string => hashAdaptiveCanonical({
  schemaVersion: snapshot.schemaVersion,
  binding: snapshot.binding,
  cells: snapshot.cells.map((cell) => ({
    address: cell.address,
    materialId: cell.materialId,
    semanticKey: cell.semanticKey
  }))
});

const expectExactFreshParity = (
  incremental: Readonly<SurfaceTreeCollisionSnapshot>,
  fresh: Readonly<SurfaceTreeCollisionSnapshot>,
  previous: Readonly<SurfaceTreeCollisionSnapshot>
): void => {
  expect(incremental).toEqual(fresh);
  expect(incremental.cells.map(cellKey)).toEqual(fresh.cells.map(cellKey));
  expect(incremental.contentHash).toBe(fresh.contentHash);
  expect(incremental.contentHash).toBe(collisionHash(incremental));
  expect(isDeepFrozen(incremental)).toBe(true);

  const target = incremental.cells[0];
  if (target === undefined) throw new Error("Canonical Tree sequence must retain a current stump.");
  const center = {
    x: (target.minMeters.x + target.maxMeters.x) / 2,
    y: (target.minMeters.y + target.maxMeters.y) / 2,
    z: (target.minMeters.z + target.maxMeters.z) / 2
  };
  const binding = createSurfaceTreeCollisionBinding(incremental);
  const freshBinding = createSurfaceTreeCollisionBinding(fresh);
  const ray = {
    originMeters: center,
    direction: { x: 1, y: 0, z: 0 },
    maximumDistanceMeters: 0.05
  } as const;
  const overlap = {
    positionMeters: center,
    capsule: playerCapsule
  } as const;
  const sweep = {
    startMeters: { ...center, x: center.x - 1 },
    endMeters: { ...center, x: center.x + 1 },
    capsule: playerCapsule
  } as const;
  expect(raycastSurfaceTreeCollision(incremental, { binding, ...ray }))
    .toEqual(raycastSurfaceTreeCollision(fresh, { binding: freshBinding, ...ray }));
  expect(overlapSurfaceTreeCapsule(incremental, { binding, ...overlap }))
    .toEqual(overlapSurfaceTreeCapsule(fresh, { binding: freshBinding, ...overlap }));
  expect(sweepSurfaceTreeCapsule(incremental, { binding, ...sweep }))
    .toEqual(sweepSurfaceTreeCapsule(fresh, { binding: freshBinding, ...sweep }));
  expect(isSurfaceTreeSpawnClear(incremental, { binding, ...overlap }))
    .toEqual(isSurfaceTreeSpawnClear(fresh, { binding: freshBinding, ...overlap }));

  const staleBinding = createSurfaceTreeCollisionBinding(previous);
  const staleIncremental = raycastSurfaceTreeCollision(incremental, {
    binding: staleBinding,
    ...ray
  });
  const staleFresh = raycastSurfaceTreeCollision(fresh, {
    binding: staleBinding,
    ...ray
  });
  expect(staleIncremental).toEqual(staleFresh);
  expect(staleIncremental).toMatchObject({ status: "Rejected", code: "StaleRevision" });
};

const expectReuseAccounting = (
  previous: Readonly<SurfaceTreeCollisionSnapshot>,
  next: Readonly<SurfaceTreeCollisionSnapshot>
): void => {
  const stats = readSurfaceTreeCollisionDerivationStats(next);
  if (stats === undefined) throw new Error("Incremental collision must publish derivation stats.");
  const previousByKey = new Map(previous.cells.map((cell) => [cellKey(cell), cell] as const));
  const sharedCells = next.cells.filter((cell) => previousByKey.get(cellKey(cell)) === cell).length;

  expect(stats.mode).toBe("Incremental");
  expect(stats.reusedCellCount).toBe(sharedCells);
  expect(stats.reusedCellCount + stats.recomputedCellCount).toBe(next.cells.length);
  expect(stats.reusedCellCount + stats.invalidatedCellCount).toBe(previous.cells.length);
  expect(stats.materializationOperationCount)
    .toBe(stats.changedBrickCount + stats.recomputedCellCount);
  expect(stats.canonicalHashCellCount).toBe(next.cells.length);
};

const initialAuthority = (): SurfaceTreeAuthoritySnapshot =>
  createSurfaceTreeAuthority(createHestiaUmbrellaTree());

const physicsWorld = () => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: 9.81,
  terrainColliders: []
});

describe("incremental Surface Tree collision derivation", () => {
  it("matches a fresh full reference for anchored hits 1 and 2 while rebuilding only changed bricks", () => {
    let authority = initialAuthority();
    let collision = createSurfaceTreeCollisionSnapshot(authority);
    const timings: Array<Readonly<{
      ordinal: number;
      incrementalMilliseconds: number;
      freshMilliseconds: number;
      changedBrickCount: number;
      recomputedCellCount: number;
      reusedCellCount: number;
      invalidatedCellCount: number;
      materializationOperationCount: number;
    }>> = [];

    for (const ordinal of [0, 1] as const) {
      const preview = previewSurfaceTreeCanonicalHit(authority, ordinal);
      expect(preview.status).toBe("Accepted");
      if (preview.status !== "Accepted") throw new Error("Canonical anchored hit was rejected.");
      expect(preview.authority.classification.detachedComponents).toEqual([]);

      const incrementalStarted = performance.now();
      const incremental = createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
        authority,
        collision,
        preview.authority,
        Object.freeze([preview.result])
      );
      const incrementalMilliseconds = performance.now() - incrementalStarted;
      const freshStarted = performance.now();
      const fresh = createSurfaceTreeCollisionSnapshot(preview.authority);
      const freshMilliseconds = performance.now() - freshStarted;

      expectExactFreshParity(incremental, fresh, collision);
      expectReuseAccounting(collision, incremental);
      const stats = readSurfaceTreeCollisionDerivationStats(incremental)!;
      timings.push(Object.freeze({
        ordinal,
        incrementalMilliseconds,
        freshMilliseconds,
        changedBrickCount: stats.changedBrickCount,
        recomputedCellCount: stats.recomputedCellCount,
        reusedCellCount: stats.reusedCellCount,
        invalidatedCellCount: stats.invalidatedCellCount,
        materializationOperationCount: stats.materializationOperationCount
      }));
      expect(stats.changedBrickCount).toBeLessThan(stats.sourceBrickCount);
      expect(stats.recomputedCellCount).toBeLessThan(collision.cells.length / 4);
      expect(stats.reusedCellCount).toBeGreaterThan(collision.cells.length * 0.75);

      authority = preview.authority;
      collision = incremental;
    }

    expect(timings.map((entry) => ({
      ordinal: entry.ordinal,
      changedBrickCount: entry.changedBrickCount,
      recomputedCellCount: entry.recomputedCellCount,
      reusedCellCount: entry.reusedCellCount,
      invalidatedCellCount: entry.invalidatedCellCount,
      materializationOperationCount: entry.materializationOperationCount
    }))).toEqual([
      {
        ordinal: 0,
        changedBrickCount: 1,
        recomputedCellCount: 310,
        reusedCellCount: 3_090,
        invalidatedCellCount: 400,
        materializationOperationCount: 311
      },
      {
        ordinal: 1,
        changedBrickCount: 1,
        recomputedCellCount: 290,
        reusedCellCount: 3_090,
        invalidatedCellCount: 310,
        materializationOperationCount: 291
      }
    ]);
    console.info("surface-tree-collision-profile " + JSON.stringify(timings));
  }, 180_000);

  it("keeps full parity through detach transfer on hit 3 and the current-stump hit 4 without ghosts", () => {
    const authority = initialAuthority();
    let state = createSurfaceTreeRuntimeStateFromAuthority(authority, physicsWorld());
    let detachedKeys: ReadonlySet<string> | null = null;
    let archivedBodySource = state.bodySources[0];

    for (let ordinal = 0; ordinal < 4; ordinal += 1) {
      const previous = state;
      const hit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
      const voxel = getStructuralVoxel(state.authority.object, hit.address);
      const preflight = preflightSurfaceTreeFire(state, {
        fireCommandId: "fire:tree-collision-incremental:" + (ordinal + 1),
        hit: {
          address: hit.address,
          materialId: hit.materialId,
          semanticKey: voxel?.semanticKey ?? null,
          pointMeters: hit.pointMeters,
          normal: { x: -1, y: 0, z: 0 }
        },
        simulationTick: ordinal + 1
      });
      expect(preflight.status).toBe("Ready");
      if (preflight.status !== "Ready") throw new Error("Canonical runtime hit was rejected.");
      state = preflight.state;

      const fresh = createSurfaceTreeCollisionSnapshot(state.authority);
      expectExactFreshParity(state.collision, fresh, previous.collision);
      expectReuseAccounting(previous.collision, state.collision);

      if (ordinal === 2) {
        expect(preflight.supportResult).toBe("Detached");
        expect(state.bodySources).toHaveLength(1);
        archivedBodySource = state.bodySources[0];
        detachedKeys = new Set(archivedBodySource.fragment.occupiedCells
          .map(serializeStructuralCellAddress));
        expect(state.collision.cells.every((cell) => !detachedKeys!.has(cellKey(cell)))).toBe(true);
      }
      if (ordinal === 3) {
        expect(preflight.supportResult).toBe("Anchored");
        expect(state.bodySources).toHaveLength(1);
        expect(state.bodySources[0]).toBe(archivedBodySource);
        expect(state.collision.cells.every((cell) => !detachedKeys!.has(cellKey(cell)))).toBe(true);
        const stats = readSurfaceTreeCollisionDerivationStats(state.collision)!;
        expect(stats.changedBrickCount).toBeLessThan(stats.sourceBrickCount);
        expect(stats.reusedCellCount).toBeGreaterThan(stats.recomputedCellCount);
      }
    }
  }, 180_000);

  it("accepts transported sources while failing closed for tampered evidence, detached finals, and delta-budget overflow", () => {
    const authority = initialAuthority();
    const collision = createSurfaceTreeCollisionSnapshot(authority);
    const first = previewSurfaceTreeCanonicalHit(authority, 0);
    expect(first.status).toBe("Accepted");
    if (first.status !== "Accepted") throw new Error("Canonical first hit was rejected.");

    const transportedCollision = Object.freeze({ ...collision });
    const trackedNextCollision = createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      authority,
      collision,
      first.authority,
      Object.freeze([first.result])
    );
    const transportedNextCollision = createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      authority,
      transportedCollision,
      first.authority,
      Object.freeze([first.result])
    );
    expect(transportedCollision).not.toBe(collision);
    expectExactFreshParity(transportedNextCollision, trackedNextCollision, collision);
    expectReuseAccounting(transportedCollision, transportedNextCollision);
    const trackedStats = readSurfaceTreeCollisionDerivationStats(trackedNextCollision);
    const transportedStats = readSurfaceTreeCollisionDerivationStats(transportedNextCollision);
    expect(transportedStats).toEqual(trackedStats);
    expect(transportedStats!.reusedCellCount).toBeGreaterThan(0);

    const missingChanges = Object.freeze({
      ...first.result,
      changedBrickKeys: Object.freeze([])
    });
    expect(() => createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      authority,
      collision,
      first.authority,
      Object.freeze([missingChanges])
    )).toThrow(/changed-brick evidence/i);

    const firstChangedKey = first.result.changedBrickKeys[0];
    if (firstChangedKey === undefined) throw new Error("Canonical first hit must change a brick.");
    const oversizedChanges = Object.freeze({
      ...first.result,
      changedBrickKeys: Object.freeze(Array.from({ length: 4_097 }, () => firstChangedKey))
    });
    expect(() => createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      authority,
      collision,
      first.authority,
      Object.freeze([oversizedChanges])
    )).toThrow(/changed-brick budget/i);

    const second = previewSurfaceTreeCanonicalHit(first.authority, 1);
    if (second.status !== "Accepted") throw new Error("Canonical second hit was rejected.");
    const secondCollision = createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      authority,
      collision,
      first.authority,
      Object.freeze([first.result])
    );
    const third = previewSurfaceTreeCanonicalHit(second.authority, 2);
    if (third.status !== "Accepted") throw new Error("Canonical third hit was rejected.");
    expect(third.authority.classification.detachedComponents.length).toBeGreaterThan(0);
    expect(() => createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      second.authority,
      createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
        first.authority,
        secondCollision,
        second.authority,
        Object.freeze([second.result])
      ),
      third.authority,
      Object.freeze([third.result])
    )).toThrow(/Attached-only/i);
  }, 180_000);
});
