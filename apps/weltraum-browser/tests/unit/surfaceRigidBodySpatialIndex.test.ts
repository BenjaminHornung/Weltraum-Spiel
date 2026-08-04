import { describe, expect, it } from "vitest";
import { hashAdaptiveCanonical } from "../../src/voxel/adaptive";
import {
  createSurfaceRigidBodyRegistry,
  insertSurfaceRigidBodyRegistryRecord,
  removeSurfaceRigidBodyRegistryRecord,
  updateSurfaceRigidBodyRegistryRecord,
  type SurfaceRigidBodyAabb,
  type SurfaceRigidBodyRegistry,
  type SurfaceRigidBodyRegistryRecordInput
} from "../../src/surface-play/physics/surfaceRigidBodyRegistry";
import {
  advanceSurfaceRigidBodySpatialIndexBuild,
  advanceSurfaceRigidBodySpatialQuery,
  createSurfaceRigidBodySpatialIndex,
  createSurfaceRigidBodySpatialIndexBuildCursor,
  createSurfaceRigidBodySpatialQueryCursor,
  querySurfaceRigidBodySpatialIndex,
  readSurfaceRigidBodySpatialIndexDiagnostics,
  synchronizeSurfaceRigidBodySpatialIndex,
  validateSurfaceRigidBodySpatialIndex,
  type SurfaceRigidBodySpatialIndex,
  type SurfaceRigidBodySpatialQuery
} from "../../src/surface-play/physics/surfaceRigidBodySpatialIndex";

const aabb = (
  minimumX: number,
  minimumY: number,
  minimumZ: number,
  maximumX: number,
  maximumY: number,
  maximumZ: number
): SurfaceRigidBodyAabb => ({
  minimumX,
  minimumY,
  minimumZ,
  maximumX,
  maximumY,
  maximumZ
});

const record = (
  ordinal: number,
  overrides: Partial<SurfaceRigidBodyRegistryRecordInput> = {}
): SurfaceRigidBodyRegistryRecordInput => ({
  bodyId: `body:${String(ordinal).padStart(6, "0")}`,
  stateRevision: 0,
  stateContentHash: hashAdaptiveCanonical({ ordinal, revision: 0 }),
  aabb: aabb(ordinal * 10, 0, 0, ordinal * 10 + 1, 1, 1),
  ...overrides
});

const buildSpatialIndex = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  recordLimit = 31
): Readonly<SurfaceRigidBodySpatialIndex> => {
  let cursor = createSurfaceRigidBodySpatialIndexBuildCursor(registry);
  while (true) {
    const source = cursor;
    const work = advanceSurfaceRigidBodySpatialIndexBuild(registry, source, recordLimit);
    expect(work.processedRecordCount).toBeLessThanOrEqual(recordLimit);
    expect(() => advanceSurfaceRigidBodySpatialIndexBuild(registry, source, recordLimit))
      .toThrow(/consumed/i);
    if (work.status === "Complete") return work.index;
    cursor = work.cursor;
  }
};

const queryWithContinuation = (
  index: Readonly<SurfaceRigidBodySpatialIndex>,
  range: Readonly<SurfaceRigidBodyAabb>,
  workLimit = 17
): Readonly<SurfaceRigidBodySpatialQuery> => {
  let cursor = createSurfaceRigidBodySpatialQueryCursor(index, range);
  while (true) {
    const source = cursor;
    const work = advanceSurfaceRigidBodySpatialQuery(index, source, workLimit);
    expect(() => advanceSurfaceRigidBodySpatialQuery(index, source, workLimit))
      .toThrow(/consumed/i);
    if (work.status === "Complete") return work.result;
    expect(work.cursor.workUnitCount - source.workUnitCount).toBeLessThanOrEqual(workLimit);
    cursor = work.cursor;
  }
};

describe("Surface rigid-body deterministic spatial index", () => {
  it.each([1, 8, 64, 256, 1_024])(
    "queries one of %i separated pieces through bounded spatial work",
    (count) => {
      const records = Array.from({ length: count }, (_, ordinal) => record(ordinal));
      const registry = createSurfaceRigidBodyRegistry([...records].reverse());
      const index = buildSpatialIndex(registry);
      const ordinal = Math.floor(count / 2);
      const result = queryWithContinuation(
        index,
        aabb(ordinal * 10 + 0.25, 0.25, 0.25, ordinal * 10 + 0.75, 0.75, 0.75)
      );

      expect(index.proxyCount).toBe(count);
      expect("proxies" in index).toBe(false);
      expect(result.bodyIds).toEqual([records[ordinal].bodyId]);
      expect(result.visitedNodeCount).toBeLessThanOrEqual(4 * (index.height + 1));
      expect(index.height).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(count + 1)));
      expect(Object.isFrozen(index)).toBe(true);
      expect(index.spatialRoot === null || Object.isFrozen(index.spatialRoot)).toBe(true);
    }
  );

  it("uses continuation rather than a synchronous piece-admission cap for large builds", () => {
    const registry = createSurfaceRigidBodyRegistry(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal))
    );
    expect(() => createSurfaceRigidBodySpatialIndex(registry)).toThrow(/bounded build cursor/i);
    const index = buildSpatialIndex(registry, 7);
    expect(index.proxyCount).toBe(1_024);
    expect(readSurfaceRigidBodySpatialIndexDiagnostics(index)).toMatchObject({
      operation: "Built",
      materializedProxyCount: 0,
      fullTraversalProxyCount: 1_024
    });
  });

  it("returns overlapping hits in canonical body-ID order independently of input order", () => {
    const records = [
      record(8, { aabb: aabb(-2, -2, -2, 2, 2, 2) }),
      record(1, { aabb: aabb(-3, -3, -3, 3, 3, 3) }),
      record(3, { aabb: aabb(-1, -1, -1, 1, 1, 1) })
    ];
    const forward = buildSpatialIndex(createSurfaceRigidBodyRegistry(records));
    const reverse = buildSpatialIndex(createSurfaceRigidBodyRegistry([...records].reverse()));
    const range = aabb(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5);

    expect(queryWithContinuation(forward, range).bodyIds).toEqual([
      "body:000001",
      "body:000003",
      "body:000008"
    ]);
    expect(reverse).toEqual(forward);
    expect(queryWithContinuation(reverse, range)).toEqual(queryWithContinuation(forward, range));
  });

  it("synchronizes insert, spatial update, and removal while preserving old indexes", () => {
    const initialRegistry = createSurfaceRigidBodyRegistry([record(0)]);
    const initialIndex = createSurfaceRigidBodySpatialIndex(initialRegistry);
    const insertedRegistry = insertSurfaceRigidBodyRegistryRecord(initialRegistry, record(1));
    const insertedIndex = synchronizeSurfaceRigidBodySpatialIndex(initialIndex, insertedRegistry);

    const updatedRegistry = updateSurfaceRigidBodyRegistryRecord(insertedRegistry, record(1, {
      stateRevision: 1,
      stateContentHash: hashAdaptiveCanonical({ ordinal: 1, revision: 1 }),
      aabb: aabb(100, 0, 0, 101, 1, 1)
    }));
    const updatedIndex = synchronizeSurfaceRigidBodySpatialIndex(insertedIndex, updatedRegistry);
    const removedRegistry = removeSurfaceRigidBodyRegistryRecord(updatedRegistry, "body:000000");
    const removedIndex = synchronizeSurfaceRigidBodySpatialIndex(updatedIndex, removedRegistry);

    expect(querySurfaceRigidBodySpatialIndex(insertedIndex, aabb(9, -1, -1, 12, 2, 2)).bodyIds)
      .toEqual(["body:000001"]);
    expect(querySurfaceRigidBodySpatialIndex(updatedIndex, aabb(9, -1, -1, 12, 2, 2)).bodyIds)
      .toEqual([]);
    expect(querySurfaceRigidBodySpatialIndex(updatedIndex, aabb(99, -1, -1, 102, 2, 2)).bodyIds)
      .toEqual(["body:000001"]);
    expect(removedIndex.proxyCount).toBe(1);
    expect(initialIndex.proxyCount).toBe(1);
    expect(querySurfaceRigidBodySpatialIndex(initialIndex, aabb(-1, -1, -1, 2, 2, 2)).bodyIds)
      .toEqual(["body:000000"]);
  });

  it("path-copies O(log N) nodes with zero full proxy materialization on synchronization", () => {
    const initialRegistry = createSurfaceRigidBodyRegistry(
      Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal))
    );
    const initialIndex = buildSpatialIndex(initialRegistry);
    const updatedRegistry = updateSurfaceRigidBodyRegistryRecord(initialRegistry, record(512, {
      stateRevision: 1,
      stateContentHash: hashAdaptiveCanonical({ ordinal: 512, revision: 1 }),
      aabb: aabb(-101, -1, -1, -100, 1, 1)
    }));
    const updatedIndex = synchronizeSurfaceRigidBodySpatialIndex(initialIndex, updatedRegistry);
    const removedRegistry = removeSurfaceRigidBodyRegistryRecord(updatedRegistry, "body:000000");
    const removedIndex = synchronizeSurfaceRigidBodySpatialIndex(updatedIndex, removedRegistry);
    const insertedRegistry = insertSurfaceRigidBodyRegistryRecord(removedRegistry, record(1_024));
    const insertedIndex = synchronizeSurfaceRigidBodySpatialIndex(removedIndex, insertedRegistry);

    expect(insertedIndex.proxyCount).toBe(1_024);
    expect(queryWithContinuation(insertedIndex, aabb(-102, -2, -2, -99, 2, 2)).bodyIds)
      .toEqual(["body:000512"]);
    expect(queryWithContinuation(insertedIndex, aabb(-1, -1, -1, 2, 2, 2)).bodyIds)
      .toEqual([]);
    expect(queryWithContinuation(insertedIndex, aabb(10_239, -1, -1, 10_242, 2, 2)).bodyIds)
      .toEqual(["body:001024"]);
    for (const current of [updatedIndex, removedIndex, insertedIndex]) {
      const diagnostics = readSurfaceRigidBodySpatialIndexDiagnostics(current);
      expect(diagnostics.operation).not.toBe("Built");
      expect(diagnostics.comparedRecordCount).toBe(1);
      expect(diagnostics.materializedProxyCount).toBe(0);
      expect(diagnostics.fullTraversalProxyCount).toBe(0);
      expect(diagnostics.visitedNodeCount).toBeLessThanOrEqual(8 * (initialIndex.height + 2));
      expect(diagnostics.createdNodeCount).toBeLessThanOrEqual(12 * (initialIndex.height + 2));
    }
  });

  it("queries exact finite proxies at extreme coordinates without overflow aliases", () => {
    const large = Number.MAX_VALUE / 2;
    const index = buildSpatialIndex(createSurfaceRigidBodyRegistry([
      record(0, { aabb: aabb(-large, -large, -large, -large / 2, -large / 2, -large / 2) }),
      record(1, { aabb: aabb(large / 2, large / 2, large / 2, large, large, large) })
    ]));

    expect(queryWithContinuation(
      index,
      aabb(large * 0.75, large * 0.75, large * 0.75, large, large, large)
    ).bodyIds).toEqual(["body:000001"]);
    expect(queryWithContinuation(
      index,
      aabb(-large, -large, -large, -large * 0.75, -large * 0.75, -large * 0.75)
    ).bodyIds).toEqual(["body:000000"]);
  });

  it("keeps repeated synchronized updates bounded and rejects stale index adoption", () => {
    const initialRegistry = createSurfaceRigidBodyRegistry([record(0)]);
    let registry = initialRegistry;
    let index = createSurfaceRigidBodySpatialIndex(registry);
    const originalIndex = index;
    expect(synchronizeSurfaceRigidBodySpatialIndex(index, registry)).toBe(index);

    for (let revision = 1; revision <= 256; revision += 1) {
      registry = updateSurfaceRigidBodyRegistryRecord(registry, record(0, {
        stateRevision: revision,
        stateContentHash: hashAdaptiveCanonical({ ordinal: 0, revision }),
        aabb: aabb(revision, 0, 0, revision + 1, 1, 1)
      }));
      index = synchronizeSurfaceRigidBodySpatialIndex(index, registry);
    }

    expect(index).toMatchObject({ registryRevision: 256, proxyCount: 1, height: 0 });
    expect(JSON.stringify(index)).not.toMatch(/parent|previousIndex/i);
    expect(JSON.stringify(index).length).toBeLessThan(2_000);
    expect(() => synchronizeSurfaceRigidBodySpatialIndex(index, initialRegistry))
      .toThrow(/stale|branched/i);
    expect(querySurfaceRigidBodySpatialIndex(
      originalIndex,
      aabb(-1, -1, -1, 2, 2, 2)
    ).bodyIds).toEqual(["body:000000"]);
  });

  it("binds synchronization to the exact predecessor content hash", () => {
    const initial = createSurfaceRigidBodyRegistry([record(0)]);
    const acceptedBranch = insertSurfaceRigidBodyRegistryRecord(initial, record(1));
    const index = buildSpatialIndex(acceptedBranch);
    const foreignBranch = updateSurfaceRigidBodyRegistryRecord(
      insertSurfaceRigidBodyRegistryRecord(initial, record(2)),
      record(2, {
        stateRevision: 1,
        stateContentHash: hashAdaptiveCanonical({ ordinal: 2, revision: 1 })
      })
    );

    expect(foreignBranch.revision).toBeGreaterThan(index.registryRevision);
    expect(foreignBranch.previousContentHash).not.toBe(index.registryContentHash);
    expect(() => synchronizeSurfaceRigidBodySpatialIndex(index, foreignBranch))
      .toThrow(/predecessor|branched/i);
  });

  it("canonicalizes mutable external index ownership and preserves query truth", () => {
    const source = buildSpatialIndex(createSurfaceRigidBodyRegistry([
      record(0, { aabb: aabb(0, 0, 0, 1, 1, 1) }),
      record(1, { aabb: aabb(10, 0, 0, 11, 1, 1) })
    ]));
    const external = JSON.parse(JSON.stringify(source)) as SurfaceRigidBodySpatialIndex;
    const canonical = validateSurfaceRigidBodySpatialIndex(external);
    const mutableRoot = external.spatialRoot as unknown as {
      proxy: { aabb: { minimumX: number; maximumX: number } };
    };
    mutableRoot.proxy.aabb.minimumX = 1_000;
    mutableRoot.proxy.aabb.maximumX = 1_001;

    expect(queryWithContinuation(canonical, aabb(-1, -1, -1, 2, 2, 2)).bodyIds)
      .toEqual(["body:000000"]);
    expect(queryWithContinuation(canonical, aabb(999, -1, -1, 1_002, 2, 2)).bodyIds)
      .toEqual([]);
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(canonical.spatialRoot === null || Object.isFrozen(canonical.spatialRoot)).toBe(true);
  });

  it("rejects delta synchronization after JSON transport and rebuilds it bounded", () => {
    const initial = createSurfaceRigidBodyRegistry([record(0), record(2)]);
    const index = buildSpatialIndex(initial);
    const successor = insertSurfaceRigidBodyRegistryRecord(initial, record(1));
    const roundtripped = JSON.parse(JSON.stringify(successor)) as SurfaceRigidBodyRegistry;

    expect(() => synchronizeSurfaceRigidBodySpatialIndex(index, roundtripped))
      .toThrow(/delta metadata|rebuild/i);
    const rebuilt = buildSpatialIndex(roundtripped, 2);
    expect(rebuilt.registryContentHash).toBe(successor.contentHash);
    expect(queryWithContinuation(rebuilt, aabb(-1, -1, -1, 22, 2, 2)).bodyIds).toEqual([
      "body:000000",
      "body:000001",
      "body:000002"
    ]);
    expect(readSurfaceRigidBodySpatialIndexDiagnostics(rebuilt)).toMatchObject({
      operation: "Built",
      fullTraversalProxyCount: 3
    });
  });

  it("continues a broad 1,024-piece query without losing or duplicating hits", () => {
    const records = Array.from({ length: 1_024 }, (_, ordinal) => record(ordinal));
    const index = buildSpatialIndex(createSurfaceRigidBodyRegistry(records));
    let cursor = createSurfaceRigidBodySpatialQueryCursor(
      index,
      aabb(-1, -1, -1, 10_242, 2, 2)
    );
    let slices = 0;

    while (true) {
      const source = cursor;
      const work = advanceSurfaceRigidBodySpatialQuery(index, source, 17);
      slices += 1;
      expect(() => advanceSurfaceRigidBodySpatialQuery(index, source, 17))
        .toThrow(/consumed/i);
      if (work.status === "Complete") {
        expect(work.result.bodyIds).toEqual(records.map((entry) => entry.bodyId));
        expect(new Set(work.result.bodyIds).size).toBe(1_024);
        break;
      }
      expect(work.cursor.workUnitCount - source.workUnitCount).toBeLessThanOrEqual(17);
      expect(work.cursor.remainingNodeCount).toBeGreaterThan(0);
      cursor = work.cursor;
    }

    expect(slices).toBeGreaterThan(1);
  });

  it("spatially prunes adversarial alternating left, right, and middle null hits", () => {
    const count = 4_096;
    const records = Array.from({ length: count }, (_, ordinal) => {
      const lane = ordinal % 3;
      const x = lane === 0 ? -10_000 - ordinal : lane === 1 ? 10_000 + ordinal : 0;
      const y = lane === 2 ? (ordinal % 2 === 0 ? -10_000 : 10_000) : 0;
      return record(ordinal, { aabb: aabb(x, y, 0, x + 1, y + 1, 1) });
    });
    const index = buildSpatialIndex(createSurfaceRigidBodyRegistry(records), 23);
    const nullRanges = [
      aabb(-5_000.25, -0.25, -0.25, -4_999.75, 0.25, 0.25),
      aabb(-0.25, -0.25, -0.25, 0.25, 0.25, 0.25),
      aabb(4_999.75, -0.25, -0.25, 5_000.25, 0.25, 0.25)
    ];

    for (const range of nullRanges) {
      const result = queryWithContinuation(index, range, 11);
      expect(result.bodyIds).toEqual([]);
      expect(result.visitedNodeCount).toBeLessThanOrEqual(16 * (index.height + 1));
    }
    expect(index.height).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(count + 1)));
  });
});
