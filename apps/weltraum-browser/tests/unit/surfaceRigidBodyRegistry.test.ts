import { describe, expect, it } from "vitest";
import { hashAdaptiveCanonical } from "../../src/voxel/adaptive";
import {
  SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION,
  advanceSurfaceRigidBodyRegistryTraversal,
  createSurfaceRigidBodyRegistry,
  createSurfaceRigidBodyRegistryTraversalCursor,
  getSurfaceRigidBodyRegistryRecord,
  insertSurfaceRigidBodyRegistryRecord,
  readSurfaceRigidBodyRegistryDiagnostics,
  removeSurfaceRigidBodyRegistryRecord,
  updateSurfaceRigidBodyRegistryRecord,
  validateSurfaceRigidBodyRegistry,
  type SurfaceRigidBodyRegistry,
  type SurfaceRigidBodyRegistryRecord,
  type SurfaceRigidBodyRegistryRecordInput,
  type SurfaceRigidBodyRegistryRecordNode
} from "../../src/surface-play/physics/surfaceRigidBodyRegistry";

const record = (
  ordinal: number,
  overrides: Partial<SurfaceRigidBodyRegistryRecordInput> = {}
): SurfaceRigidBodyRegistryRecordInput => ({
  bodyId: `body:${String(ordinal).padStart(6, "0")}`,
  stateRevision: 0,
  stateContentHash: hashAdaptiveCanonical({ ordinal, revision: 0 }),
  aabb: {
    minimumX: ordinal * 10,
    minimumY: -1,
    minimumZ: -1,
    maximumX: ordinal * 10 + 1,
    maximumY: 1,
    maximumZ: 1
  },
  ...overrides
});

const collectRecords = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  workLimit = 17
): readonly Readonly<SurfaceRigidBodyRegistryRecord>[] => {
  let cursor = createSurfaceRigidBodyRegistryTraversalCursor(registry);
  const records: Readonly<SurfaceRigidBodyRegistryRecord>[] = [];
  while (true) {
    const work = advanceSurfaceRigidBodyRegistryTraversal(registry, cursor, workLimit);
    expect(work.workUnitCount).toBeLessThanOrEqual(workLimit);
    records.push(...work.records);
    if (work.status === "Complete") return records;
    cursor = work.cursor;
  }
};

const findMutableNode = (
  sourceRoot: SurfaceRigidBodyRegistryRecordNode | null,
  bodyId: string
): SurfaceRigidBodyRegistryRecordNode => {
  let current = sourceRoot;
  while (current !== null) {
    if (current.record.bodyId === bodyId) return current;
    current = bodyId < current.record.bodyId ? current.left : current.right;
  }
  throw new Error(`Missing mutable test node ${bodyId}.`);
};

describe("Surface rigid-body logical registry", () => {
  it.each([1, 8, 64, 256, 1_024])(
    "retains %i immutable logical pieces in canonical bounded traversal order",
    (count) => {
      const inputs = Array.from({ length: count }, (_, ordinal) => record(ordinal));
      const registry = createSurfaceRigidBodyRegistry([...inputs].reverse());
      const records = collectRecords(registry);

      expect(registry.recordCount).toBe(count);
      expect("records" in registry).toBe(false);
      expect(records.map((entry) => entry.bodyId)).toEqual(
        inputs.map((entry) => entry.bodyId)
      );
      expect(records.every((entry) =>
        Object.isFrozen(entry) && Object.isFrozen(entry.aabb)
      )).toBe(true);
      expect(Object.isFrozen(registry)).toBe(true);
      expect(registry.recordRoot === null || Object.isFrozen(registry.recordRoot)).toBe(true);
      const forward = createSurfaceRigidBodyRegistry(inputs);
      expect(forward).toEqual(registry);
      expect(JSON.stringify(forward)).toBe(JSON.stringify(registry));
      expect(registry.height).toBeLessThanOrEqual(Math.ceil(Math.log2(count + 1)));
      expect(registry.contentHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    }
  );

  it("inserts, updates, looks up, and explicitly removes without mutating prior revisions", () => {
    const empty = createSurfaceRigidBodyRegistry();
    const inserted = insertSurfaceRigidBodyRegistryRecord(empty, record(2));
    const updated = updateSurfaceRigidBodyRegistryRecord(inserted, record(2, {
      stateRevision: 1,
      stateContentHash: hashAdaptiveCanonical({ ordinal: 2, revision: 1 }),
      aabb: {
        minimumX: 200,
        minimumY: 10,
        minimumZ: -20,
        maximumX: 204,
        maximumY: 14,
        maximumZ: -16
      }
    }));
    const removed = removeSurfaceRigidBodyRegistryRecord(updated, "body:000002");

    expect(empty).toMatchObject({ revision: 0, recordCount: 0, height: -1 });
    expect(empty.previousContentHash).toBeNull();
    expect(inserted.previousContentHash).toBe(empty.contentHash);
    expect(getSurfaceRigidBodyRegistryRecord(inserted, "body:000002")?.aabb.minimumX).toBe(20);
    expect(updated.previousContentHash).toBe(inserted.contentHash);
    expect(getSurfaceRigidBodyRegistryRecord(updated, "body:000002")).toMatchObject({
      stateRevision: 1,
      aabb: { minimumX: 200, maximumX: 204 }
    });
    expect(removed).toMatchObject({ revision: 3, recordCount: 0, height: -1 });
    expect(collectRecords(inserted).map((entry) => entry.bodyId)).toEqual(["body:000002"]);
    expect(new Set([
      empty.contentHash,
      inserted.contentHash,
      updated.contentHash,
      removed.contentHash
    ]).size).toBe(4);
  });

  it("supports finite AABBs near the largest coordinates without recentering truth", () => {
    const large = Number.MAX_VALUE / 2;
    const registry = createSurfaceRigidBodyRegistry([
      record(0, {
        aabb: {
          minimumX: -large,
          minimumY: large / 2,
          minimumZ: -large / 2,
          maximumX: large,
          maximumY: large,
          maximumZ: large / 2
        }
      })
    ]);

    expect(getSurfaceRigidBodyRegistryRecord(registry, "body:000000")?.aabb).toEqual({
      minimumX: -large,
      minimumY: large / 2,
      minimumZ: -large / 2,
      maximumX: large,
      maximumY: large,
      maximumZ: large / 2
    });
    expect(validateSurfaceRigidBodyRegistry(registry)).toBe(registry);
  });

  it("rejects duplicate identities, invalid AABBs, stale state updates, and implicit removal", () => {
    expect(() => createSurfaceRigidBodyRegistry([record(0), record(0)]))
      .toThrow(/duplicate/i);
    expect(() => createSurfaceRigidBodyRegistry([
      record(0, {
        aabb: {
          minimumX: 1,
          minimumY: 0,
          minimumZ: 0,
          maximumX: 0,
          maximumY: 1,
          maximumZ: 1
        }
      })
    ])).toThrow(/minimum/i);
    const registry = createSurfaceRigidBodyRegistry([record(0)]);
    expect(() => insertSurfaceRigidBodyRegistryRecord(registry, record(0)))
      .toThrow(/already exists/i);
    expect(() => updateSurfaceRigidBodyRegistryRecord(registry, record(0)))
      .toThrow(/advance/i);
    expect(() => updateSurfaceRigidBodyRegistryRecord(registry, record(9, { stateRevision: 1 })))
      .toThrow(/does not exist/i);
    expect(() => removeSurfaceRigidBodyRegistryRecord(registry, "body:999999"))
      .toThrow(/does not exist/i);
  });

  it("keeps repeated revisions flat instead of retaining an object parent chain", () => {
    let registry = createSurfaceRigidBodyRegistry([record(0)]);
    for (let revision = 1; revision <= 1_024; revision += 1) {
      registry = updateSurfaceRigidBodyRegistryRecord(registry, record(0, {
        stateRevision: revision,
        stateContentHash: hashAdaptiveCanonical({ ordinal: 0, revision }),
        aabb: {
          minimumX: revision,
          minimumY: 0,
          minimumZ: 0,
          maximumX: revision + 1,
          maximumY: 1,
          maximumZ: 1
        }
      }));
    }

    expect(registry).toMatchObject({ revision: 1_024, recordCount: 1, height: 0 });
    expect(getSurfaceRigidBodyRegistryRecord(registry, "body:000000")?.stateRevision)
      .toBe(1_024);
    expect(typeof registry.previousContentHash).toBe("string");
    expect(JSON.stringify(registry)).not.toMatch(/"parent"|"previousRegistry"/i);
    expect(JSON.stringify(registry).length).toBeLessThan(2_000);
  });

  it("canonicalizes a JSON roundtrip into detached deeply frozen tree ownership", () => {
    const source = updateSurfaceRigidBodyRegistryRecord(
      createSurfaceRigidBodyRegistry([record(0), record(1)]),
      record(1, {
        stateRevision: 1,
        stateContentHash: hashAdaptiveCanonical({ ordinal: 1, revision: 1 }),
        aabb: {
          minimumX: 100,
          minimumY: 10,
          minimumZ: -10,
          maximumX: 101,
          maximumY: 11,
          maximumZ: -9
        }
      })
    );
    const roundtripped = JSON.parse(JSON.stringify(source)) as SurfaceRigidBodyRegistry;
    const canonical = validateSurfaceRigidBodyRegistry(roundtripped);

    expect(canonical.contentHash).toBe(source.contentHash);
    expect(collectRecords(canonical)).toEqual(collectRecords(source));
    expect(canonical).not.toBe(roundtripped);
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(canonical.recordRoot === null || Object.isFrozen(canonical.recordRoot)).toBe(true);

    const mutableNode = findMutableNode(
      roundtripped.recordRoot as SurfaceRigidBodyRegistryRecordNode | null,
      "body:000001"
    ) as unknown as {
      record: { bodyId: string; aabb: { minimumX: number } };
    };
    mutableNode.record.aabb.minimumX = -999;
    mutableNode.record.bodyId = "body:poisoned";
    expect(getSurfaceRigidBodyRegistryRecord(canonical, "body:000001")).toMatchObject({
      bodyId: "body:000001",
      aabb: { minimumX: 100 }
    });

    const structurallyChanged = removeSurfaceRigidBodyRegistryRecord(
      insertSurfaceRigidBodyRegistryRecord(source, record(9)),
      "body:000000"
    );
    const changedRoundtrip = validateSurfaceRigidBodyRegistry(
      JSON.parse(JSON.stringify(structurallyChanged)) as SurfaceRigidBodyRegistry
    );
    expect(changedRoundtrip.contentHash).toBe(structurallyChanged.contentHash);
    expect(collectRecords(changedRoundtrip)).toEqual(collectRecords(structurallyChanged));
  });

  it("accounts for O(log N) path copies and zero full materialization on every mutation kind", () => {
    const initial = createSurfaceRigidBodyRegistry(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal))
    );
    const updated = updateSurfaceRigidBodyRegistryRecord(initial, record(512, {
      stateRevision: 1,
      stateContentHash: hashAdaptiveCanonical({ ordinal: 512, revision: 1 })
    }));
    const inserted = insertSurfaceRigidBodyRegistryRecord(initial, record(1_024));
    const removed = removeSurfaceRigidBodyRegistryRecord(initial, "body:000512");

    for (const registry of [updated, inserted, removed]) {
      const diagnostics = readSurfaceRigidBodyRegistryDiagnostics(registry);
      expect(diagnostics.materializedRecordCount).toBe(0);
      expect(diagnostics.copiedRecordCount).toBeLessThanOrEqual(1);
      expect(diagnostics.visitedNodeCount).toBeLessThanOrEqual(6 * (initial.height + 2));
      expect(diagnostics.createdNodeCount).toBeLessThanOrEqual(8 * (initial.height + 2));
    }
  });

  it("keeps adversarial selectable body-ID insertion sequences AVL-height bounded", () => {
    const large = createSurfaceRigidBodyRegistry(
      Array.from({ length: 4_096 }, (_, ordinal) => record(ordinal))
    );
    expect(large.recordCount).toBe(4_096);
    expect(large.height).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(4_097)));

    let ascending = createSurfaceRigidBodyRegistry();
    for (let ordinal = 0; ordinal < 1_024; ordinal += 1) {
      ascending = insertSurfaceRigidBodyRegistryRecord(ascending, record(ordinal));
    }
    expect(ascending.height).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(1_025)));
    expect(collectRecords(ascending, 29).map((entry) => entry.bodyId)).toEqual(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal).bodyId)
    );
  });

  it("consumes bounded canonical traversal cursors exactly once", () => {
    const registry = createSurfaceRigidBodyRegistry(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal))
    );
    let cursor = createSurfaceRigidBodyRegistryTraversalCursor(registry);
    const bodyIds: string[] = [];
    while (true) {
      const source = cursor;
      const work = advanceSurfaceRigidBodyRegistryTraversal(registry, source, 7);
      expect(work.workUnitCount).toBeLessThanOrEqual(7);
      bodyIds.push(...work.records.map((entry) => entry.bodyId));
      expect(() => advanceSurfaceRigidBodyRegistryTraversal(registry, source, 7))
        .toThrow(/consumed/i);
      if (work.status === "Complete") break;
      cursor = work.cursor;
    }
    expect(bodyIds).toEqual(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal).bodyId)
    );
    expect(new Set(bodyIds).size).toBe(1_024);
  });

  it("fails closed before a registry revision safe-integer overflow", () => {
    const source = createSurfaceRigidBodyRegistry([record(0)]);
    const external = JSON.parse(JSON.stringify(source)) as SurfaceRigidBodyRegistry & {
      revision: number;
      previousContentHash: string | null;
      contentHash: string;
    };
    external.revision = Number.MAX_SAFE_INTEGER;
    external.previousContentHash = source.contentHash;
    external.contentHash = hashAdaptiveCanonical({
      schemaVersion: SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION,
      revision: external.revision,
      previousContentHash: external.previousContentHash,
      recordCount: external.recordCount,
      recordSequenceHash: external.recordRoot?.sequenceHash ?? null
    });
    const exhausted = validateSurfaceRigidBodyRegistry(external);

    expect(() => insertSurfaceRigidBodyRegistryRecord(exhausted, record(1)))
      .toThrow(/revision|exhausted/i);
    expect(exhausted.recordCount).toBe(1);
  });
});
