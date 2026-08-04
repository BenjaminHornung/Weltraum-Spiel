import { describe, expect, it } from "vitest";
import {
  createSurfaceRigidBodyResidencyCursor,
  createSurfaceRigidBodyResidencyIndex,
  selectSurfaceRigidBodyResidencyWork,
  validateSurfaceRigidBodyResidencyIndex,
  type SurfaceRigidBodyResidencyFact,
  type SurfaceRigidBodyResidencyIndex
} from "../../src/surface-play/physics/surfaceRigidBodyResidencyIndex";

const fact = (
  ordinal: number,
  overrides: Partial<SurfaceRigidBodyResidencyFact> = {}
): SurfaceRigidBodyResidencyFact => ({
  bodyId: `body:${String(ordinal).padStart(6, "0")}`,
  lifecycle: "Resting",
  distanceSquaredToInterestMeters: 0,
  interactionRequested: false,
  supportInvalidated: false,
  ...overrides
});

const policy = Object.freeze({
  activeContactRadiusMeters: 32,
  exactSleepingRadiusMeters: 96
});

describe("Surface rigid-body residency index", () => {
  it("classifies active, sleeping, and far pieces without dropping logical bodies", () => {
    const index = createSurfaceRigidBodyResidencyIndex([
      fact(3, { lifecycle: "Resting", distanceSquaredToInterestMeters: 97 ** 2 }),
      fact(1, { lifecycle: "Falling", distanceSquaredToInterestMeters: 31 ** 2 }),
      fact(2, { lifecycle: "Resting", distanceSquaredToInterestMeters: 64 ** 2 }),
      fact(0, { lifecycle: "Falling", distanceSquaredToInterestMeters: 33 ** 2 }),
      fact(4, {
        lifecycle: "Resting",
        distanceSquaredToInterestMeters: 1_000 ** 2,
        interactionRequested: true
      }),
      fact(5, {
        lifecycle: "Resting",
        distanceSquaredToInterestMeters: 1_000 ** 2,
        supportInvalidated: true
      })
    ], policy);

    expect(index.entries.map((entry) => entry.bodyId)).toEqual([
      "body:000000",
      "body:000001",
      "body:000002",
      "body:000003",
      "body:000004",
      "body:000005"
    ]);
    expect(index.activeContactBodyIds).toEqual([
      "body:000001",
      "body:000004",
      "body:000005"
    ]);
    expect(index.sleepingExactBodyIds).toEqual(["body:000002"]);
    expect(index.farProxyBodyIds).toEqual(["body:000000", "body:000003"]);
    expect(index).toMatchObject({ revision: 0 });
    expect(index.contentHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(Object.isFrozen(index)).toBe(true);
    expect(index.entries.every(Object.isFrozen)).toBe(true);
  });

  it.each([1, 8, 64, 256, 1_024])(
    "retains and enumerates %i pieces exactly once through finite batches",
    (count) => {
      const facts = Array.from({ length: count }, (_, ordinal) => fact(ordinal, {
        lifecycle: "Falling",
        distanceSquaredToInterestMeters: 1
      }));
      const index = createSurfaceRigidBodyResidencyIndex([...facts].reverse(), policy);
      let cursor = createSurfaceRigidBodyResidencyCursor(index);
      const visited: string[] = [];
      while (visited.length < count) {
        const source = cursor;
        const result = selectSurfaceRigidBodyResidencyWork(index, source, 17);
        expect(result.status).toBe("Scheduled");
        if (result.status !== "Scheduled") throw new Error("Expected scheduled residency work.");
        expect(result.entries.length).toBeLessThanOrEqual(17);
        visited.push(...result.entries.map((entry) => entry.bodyId));
        expect(() => selectSurfaceRigidBodyResidencyWork(index, source, 17))
          .toThrow(/consumed/i);
        cursor = result.cursor;
      }

      expect(visited).toEqual(index.entries.map((entry) => entry.bodyId));
      expect(new Set(visited).size).toBe(count);
      expect(cursor.completedCycles).toBe(1);
      expect(cursor.nextBodyId).toBe(index.entries[0]?.bodyId ?? null);
    }
  );

  it("binds cursors to exact index identity, revision, and hash without consuming failures", () => {
    const firstIndex = createSurfaceRigidBodyResidencyIndex([fact(0), fact(1)], policy);
    const secondIndex = createSurfaceRigidBodyResidencyIndex([fact(0), fact(1)], policy);
    const cursor = createSurfaceRigidBodyResidencyCursor(firstIndex);

    expect(firstIndex).toEqual(secondIndex);
    expect(() => selectSurfaceRigidBodyResidencyWork(secondIndex, cursor, 1))
      .toThrow(/foreign|index/i);
    const accepted = selectSurfaceRigidBodyResidencyWork(firstIndex, cursor, 1);
    expect(accepted.status).toBe("Scheduled");
    expect(() => selectSurfaceRigidBodyResidencyWork(firstIndex, cursor, 1))
      .toThrow(/consumed/i);
  });

  it("uses work limits only as continuation controls and never as piece caps", () => {
    const index = createSurfaceRigidBodyResidencyIndex(
      Array.from({ length: 1_024 }, (_, ordinal) => fact(ordinal, {
        lifecycle: "Falling",
        distanceSquaredToInterestMeters: 1
      })),
      policy
    );
    const first = selectSurfaceRigidBodyResidencyWork(
      index,
      createSurfaceRigidBodyResidencyCursor(index),
      1
    );

    expect(first.status).toBe("Scheduled");
    if (first.status !== "Scheduled") throw new Error("Expected continuation work.");
    expect(first.entries).toHaveLength(1);
    expect(first.remainingInCycle).toBe(1_023);
    expect(index.entries).toHaveLength(1_024);
  });

  it("is deterministic across input order and rejects invalid derived facts", () => {
    const facts = [
      fact(2, { lifecycle: "Falling", distanceSquaredToInterestMeters: 100 }),
      fact(0, { distanceSquaredToInterestMeters: 1_000 }),
      fact(1, { interactionRequested: true })
    ];
    expect(createSurfaceRigidBodyResidencyIndex(facts, policy)).toEqual(
      createSurfaceRigidBodyResidencyIndex([...facts].reverse(), policy)
    );
    expect(() => createSurfaceRigidBodyResidencyIndex([fact(0), fact(0)], policy))
      .toThrow(/duplicate/i);
    expect(() => createSurfaceRigidBodyResidencyIndex(
      [fact(0, { distanceSquaredToInterestMeters: Number.NaN })],
      policy
    )).toThrow(/distance/i);
  });

  it("returns an immutable bound idle cursor for an empty logical world", () => {
    const index = createSurfaceRigidBodyResidencyIndex([], policy);
    const result = selectSurfaceRigidBodyResidencyWork(
      index,
      createSurfaceRigidBodyResidencyCursor(index, 7),
      4
    );
    expect(result.status).toBe("Idle");
    expect(result.cursor).toMatchObject({
      indexRevision: index.revision,
      indexContentHash: index.contentHash,
      nextBodyId: null,
      completedCycles: 7
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cursor)).toBe(true);
  });

  it("fails closed before completed-cycle safe-integer exhaustion", () => {
    const index = createSurfaceRigidBodyResidencyIndex([fact(0)], policy);
    const cursor = createSurfaceRigidBodyResidencyCursor(index, Number.MAX_SAFE_INTEGER);
    expect(() => selectSurfaceRigidBodyResidencyWork(index, cursor, 1))
      .toThrow(/cycle|exhausted|safe integer/i);
    expect(() => selectSurfaceRigidBodyResidencyWork(index, cursor, 1))
      .toThrow(/cycle|exhausted|safe integer/i);
  });

  it("canonicalizes mutable external ownership and rejects duplicate or reordered entries", () => {
    const source = createSurfaceRigidBodyResidencyIndex([fact(0), fact(1)], policy);
    const external = JSON.parse(JSON.stringify(source)) as SurfaceRigidBodyResidencyIndex;
    const canonical = validateSurfaceRigidBodyResidencyIndex(external);
    const mutable = external as unknown as {
      entries: Array<{ bodyId: string }>;
    };
    mutable.entries[0].bodyId = "body:poisoned";
    expect(canonical.entries[0].bodyId).toBe("body:000000");
    expect(Object.isFrozen(canonical.entries[0])).toBe(true);

    const duplicate = JSON.parse(JSON.stringify(source)) as {
      entries: Array<{ bodyId: string }>;
    };
    duplicate.entries[1].bodyId = duplicate.entries[0].bodyId;
    expect(() => validateSurfaceRigidBodyResidencyIndex(
      duplicate as unknown as SurfaceRigidBodyResidencyIndex
    )).toThrow(/duplicate|canonical|order/i);

    const reordered = JSON.parse(JSON.stringify(source)) as {
      entries: Array<{ bodyId: string }>;
    };
    reordered.entries.reverse();
    expect(() => validateSurfaceRigidBodyResidencyIndex(
      reordered as unknown as SurfaceRigidBodyResidencyIndex
    )).toThrow(/canonical|order/i);
  });
});
