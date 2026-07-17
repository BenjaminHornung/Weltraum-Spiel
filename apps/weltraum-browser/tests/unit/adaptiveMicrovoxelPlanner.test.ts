import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  AdaptiveAuthorityError,
  authorityRevision,
  canonicalAdaptiveJson,
  childrenOf,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptivePlannerSnapshotProjection,
  createAdaptiveResidentValidationProof,
  createAdaptiveResidentValidationProofs,
  globalQuantumCoordinate,
  hashAdaptiveCanonical,
  isDeepFrozen,
  materializeAdaptiveBrick,
  planAdaptiveMicrovoxels,
  quantumBoundsForKey,
  releaseAdaptiveResidency,
  serializeAdaptiveKey,
  stableAuthorityId,
  type AdaptiveBaseFieldDescriptor,
  type AdaptiveBrickKey,
  type AdaptivePlanRequest,
  type AdaptivePlannerBudgets,
  type AdaptivePlannerSnapshot,
  type AdaptiveResidentBrick,
  type AdaptiveReadiness
} from "../../src/voxel/adaptive";

const key = (level: number, x = 0, y = 0, z = 0): AdaptiveBrickKey =>
  createAdaptiveBrickKey({ bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1", level, originQuantum: { x, y, z } });

const parent = key(2);
const region = quantumBoundsForKey(parent);
const request: AdaptivePlanRequest = {
  requestId: stableAuthorityId("request.explosion"),
  region: { kind: "aabb", bounds: region },
  targetLevel: 4 as AdaptivePlanRequest["targetLevel"],
  reason: "Explosion",
  requiredForCoverage: true,
  priority: 10
};
const budgets: AdaptivePlannerBudgets = {
  maxBricks: 4_096,
  maxBytes: Number.MAX_SAFE_INTEGER,
  maxWork: Number.MAX_SAFE_INTEGER,
  maxCoverageQuantum: Number.MAX_SAFE_INTEGER
};

const baseField: AdaptiveBaseFieldDescriptor = createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId("base.test"),
  version: stableAuthorityId("base.v1"),
  sourceRevision: authorityRevision(1),
  sample: {
    density: 0,
    occupancy: 1,
    materialId: stableAuthorityId("material.rock")
  }
});
const planningJournal = createAdaptiveEditJournal([]);
const plannerBrickRevision = authorityRevision(0);
const materialized = new Map<string, ReturnType<typeof materializeAdaptiveBrick>>();
const brickFor = (brickKey: AdaptiveBrickKey) => {
  const id = serializeAdaptiveKey(brickKey);
  const cached = materialized.get(id);
  if (cached !== undefined) return cached;
  const brick = materializeAdaptiveBrick({ key: brickKey, baseField, editJournal: planningJournal });
  materialized.set(id, brick);
  return brick;
};
type ResidentSeed = Readonly<{ key: AdaptiveBrickKey; readiness: AdaptiveReadiness }>;
const resident = (brickKey: AdaptiveBrickKey, readiness: AdaptiveReadiness = "ready"): ResidentSeed => ({ key: brickKey, readiness });
const residentSummary = ({ key: brickKey, readiness }: ResidentSeed): AdaptiveResidentBrick => {
  const brick = brickFor(brickKey);
  return {
    key: brickKey,
    readiness,
    byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES,
    work: ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash: brick.contentHash,
    provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
    journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision,
    editRevision: brick.editRevision,
    brickRevision: plannerBrickRevision
  };
};

const snapshot = (
  entries: readonly ResidentSeed[],
  refinementRequests: AdaptivePlannerSnapshot["refinementRequests"] = [request],
  budgetValues: AdaptivePlannerBudgets = budgets
): AdaptivePlannerSnapshot => {
  const summaries = entries.map(residentSummary);
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId("planet.test"),
    surfaceFrameId: stableAuthorityId("frame.surface"),
    regionId: stableAuthorityId("region.test"),
    generatorVersion: stableAuthorityId("generator.v1"),
    authority: {
      schemaVersion: "adaptive-microvoxel-planner-authority-v1",
      baseField,
      editJournal: planningJournal,
      brickRevision: plannerBrickRevision
    },
    planningEpoch: authorityRevision(7),
    resident: summaries,
    activeCoverage: [],
    refinementRequests,
    budgets: budgetValues
  };
  const proofs = createAdaptiveResidentValidationProofs({
    bricks: summaries.filter((entry) => entry.readiness === "ready").map((entry) => brickFor(entry.key)),
    brickRevision: plannerBrickRevision,
    snapshot: draft
  });
  let proofIndex = 0;
  return {
    ...draft,
    resident: summaries.map((entry) => entry.readiness === "ready"
      ? { ...entry, validationProof: proofs[proofIndex++] }
      : entry)
  };
};

const allFineChildren = (): readonly AdaptiveBrickKey[] => {
  const level3 = childrenOf(parent);
  return level3.flatMap((entry) => childrenOf(entry));
};

const requestForKey = (
  brickKey: AdaptiveBrickKey,
  requestId: string,
  overrides: Partial<Pick<AdaptivePlanRequest, "priority" | "requiredForCoverage" | "reason">> = {}
): AdaptivePlanRequest => ({
  requestId: stableAuthorityId(requestId),
  region: { kind: "aabb", bounds: quantumBoundsForKey(brickKey) },
  targetLevel: brickKey.level,
  reason: overrides.reason ?? "Inspection",
  requiredForCoverage: overrides.requiredForCoverage ?? true,
  priority: overrides.priority ?? 1
});

const coverageVolume = (entries: readonly { readonly bounds: ReturnType<typeof quantumBoundsForKey> }[]): number =>
  entries.reduce((sum, entry) => sum
    + (entry.bounds.max.x - entry.bounds.min.x)
    * (entry.bounds.max.y - entry.bounds.min.y)
    * (entry.bounds.max.z - entry.bounds.min.z), 0);

describe("adaptive microvoxel planner and residency obligations 13-20", () => {
  it("[13] produces the same canonical plan for equal snapshots regardless of caller order and preserves inputs", () => {
    const fine = allFineChildren();
    const entries = [resident(key(4, 128)), resident(fine[1]), resident(fine[0])];
    const firstSnapshot = snapshot(entries);
    const before = canonicalAdaptiveJson(firstSnapshot);
    const first = planAdaptiveMicrovoxels({ snapshot: firstSnapshot });
    const second = planAdaptiveMicrovoxels({ snapshot: snapshot([...entries].reverse()) });
    expect(first).toEqual(second);
    expect(canonicalAdaptiveJson(firstSnapshot)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.desired)).toBe(true);
    expect(isDeepFrozen(first)).toBe(true);
    expect(first.desiredKeys).toBe(first.desired);
    const otherRequest = { ...request, requestId: stableAuthorityId("request.inspection"), priority: 5, reason: "Inspection" as const };
    expect(planAdaptiveMicrovoxels({ snapshot: snapshot([], [request, otherRequest]) })).toEqual(
      planAdaptiveMicrovoxels({ snapshot: snapshot([], [otherRequest, request]) })
    );
  });

  it("[14] uses only a ready validated coarser ancestor as explicit fallback", () => {
    const accepted = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(parent)]) });
    expect(accepted.status).toBe("accepted");
    expect(accepted.fallback).toHaveLength(1);
    expect(accepted.coverage.map((entry) => entry.kind)).toEqual(["fallback"]);
    expect(accepted.fallback[0].requiredChildren).toHaveLength(64);
    for (const readiness of ["stale", "invalid", "incomplete", "cancelled"] as const) {
      const result = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(parent, readiness)]) });
      expect(result.fallback).toEqual([]);
      expect(result.coverage).toEqual([]);
    }
    expect(() => planAdaptiveMicrovoxels({ snapshot: snapshot([{ ...resident(parent), key: { ...parent, level: 9 } as never }]) }))
      .toThrow(AdaptiveAuthorityError);
  });

  it("[15] checks brick, byte, work, and coverage budgets before returning any partial plan", () => {
    const requiredBricks = 64;
    const cases: readonly [Partial<AdaptivePlannerBudgets>, string][] = [
      [{ maxBricks: requiredBricks - 1 }, "brick-count"],
      [{ maxBytes: requiredBricks * ADAPTIVE_BRICK_ESTIMATED_BYTES - 1 }, "bytes"],
      [{ maxWork: requiredBricks * ADAPTIVE_BRICK_ESTIMATED_WORK - 1 }, "work"],
      [{ maxCoverageQuantum: 64 ** 3 - 1 }, "coverage"]
    ];
    for (const [budgetOverride, expectedBudget] of cases) {
      const result = planAdaptiveMicrovoxels({ snapshot: snapshot([], [request], { ...budgets, ...budgetOverride }) });
      expect(result).toMatchObject({ status: "rejected", code: "BudgetExceeded", budget: expectedBudget });
      expect(result.desired).toEqual([]);
      expect(result.keep).toEqual([]);
      expect(result.materialize).toEqual([]);
      expect(result.coverage).toEqual([]);
    }
  });

  // First fixture to materialize and constructor-validate all 64 distinct ready child bricks/proofs; later tests reuse the cache.
  it("[16] emits half-open gap-free non-overlapping settled coverage with fallback distinguished", () => {
    const fine = allFineChildren();
    const settled = planAdaptiveMicrovoxels({ snapshot: snapshot(fine.map((entry) => resident(entry))) });
    expect(settled.coverage).toHaveLength(64);
    expect(settled.coverage.every((entry) => entry.kind === "selected")).toBe(true);
    const volume = settled.coverage.reduce((sum, entry) => {
      const bounds = entry.bounds;
      return sum + (bounds.max.x - bounds.min.x) * (bounds.max.y - bounds.min.y) * (bounds.max.z - bounds.min.z);
    }, 0);
    expect(volume).toBe(64 ** 3);
    const ids = settled.coverage.map((entry) => serializeAdaptiveKey(entry.key));
    expect(new Set(ids).size).toBe(ids.length);
  }, 15_000);

  it("[17] retains the parent fallback until every required fine child is ready, then replaces it atomically", () => {
    const fine = allFineChildren();
    const partial = planAdaptiveMicrovoxels({
      snapshot: snapshot([resident(parent), ...fine.slice(0, -1).map((entry) => resident(entry))])
    });
    expect(partial.fallback).toHaveLength(1);
    expect(partial.fallback[0].requiredChildren).toHaveLength(64);
    expect(partial.coverage).toHaveLength(1);
    expect(partial.coverage.map((entry) => entry.kind)).toEqual(["fallback"]);
    expect(partial.coverage[0].bounds).toEqual(region);
    const complete = planAdaptiveMicrovoxels({
      snapshot: snapshot([resident(parent), ...fine.map((entry) => resident(entry))])
    });
    expect(complete.fallback).toEqual([]);
    expect(complete.coverage).toHaveLength(64);
    expect(complete.evict.map(serializeAdaptiveKey)).toContain(serializeAdaptiveKey(parent));
  });

  it("[18] isolates stale, cancelled, malformed, incomplete, and over-budget results from authority and success coverage", () => {
    const target = allFineChildren()[0];
    for (const readiness of ["stale", "cancelled", "invalid", "incomplete"] as const) {
      const result = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(target, readiness)]) });
      expect(result.keep).not.toContainEqual(target);
      expect(result.coverage).not.toContainEqual(expect.objectContaining({ key: target }));
      expect(result.materialize).toContainEqual(target);
    }
    const rejected = planAdaptiveMicrovoxels({ snapshot: snapshot([], [request], { ...budgets, maxBricks: 0 }) });
    expect(rejected.status).toBe("rejected");
    expect(rejected.coverage).toEqual([]);
  });

  it("keeps two disjoint request fallback groups exact and independently ordered", () => {
    const left = key(4, 0);
    const right = key(4, 48);
    const requests = [requestForKey(left, "request.left"), requestForKey(right, "request.right")];
    const first = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(parent)], requests) });
    const reversed = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(parent)], [...requests].reverse()) });
    expect(first).toEqual(reversed);
    expect(first.fallback).toHaveLength(2);
    expect(first.coverage.map((entry) => entry.bounds)).toEqual([quantumBoundsForKey(left), quantumBoundsForKey(right)]);
    expect(first.coverage.map((entry) => entry.kind)).toEqual(["fallback", "fallback"]);
    expect(coverageVolume(first.coverage)).toBe(2 * 16 ** 3);
    expect(first.coverageStatus).toMatchObject({ complete: true, uncoveredRequiredKeyCount: 0 });
  });

  it("retains the coarser active fallback and suppresses nested fallback coverage atomically", () => {
    const deeper = key(3, 0);
    const result = planAdaptiveMicrovoxels({ snapshot: snapshot([resident(parent), resident(deeper)]) });
    expect(result.fallback.map((entry) => serializeAdaptiveKey(entry.ancestor))).toEqual([serializeAdaptiveKey(parent)]);
    expect(result.parentFallbackKeys.map(serializeAdaptiveKey)).toEqual([serializeAdaptiveKey(parent)]);
    expect(result.coverageStatus.complete).toBe(true);
    expect(coverageVolume(result.coverage)).toBe(64 ** 3);
    expect(result.coverage).toHaveLength(1);
    expect(result.coverage.some((entry) => serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(parent))).toBe(true);
    expect(result.coverage.some((entry) => serializeAdaptiveKey(entry.key) === serializeAdaptiveKey(deeper))).toBe(false);
  });

  it("materializes optional desired bricks without counting them as uncovered required authority", () => {
    const optionalOnly = requestForKey(key(4), "request.optional", { requiredForCoverage: false });
    const optionalResult = planAdaptiveMicrovoxels({ snapshot: snapshot([], [optionalOnly]) });
    expect(optionalResult.materialize).toEqual([key(4)]);
    expect(optionalResult.coverageStatus).toMatchObject({ complete: true, uncoveredRequiredKeyCount: 0 });

    const requiredCoarse = key(3);
    const optionalFine = key(4);
    const mixed = planAdaptiveMicrovoxels({
      snapshot: snapshot(
        [resident(optionalFine)],
        [requestForKey(requiredCoarse, "request.required"), requestForKey(optionalFine, "request.optional-fine", { requiredForCoverage: false })]
      )
    });
    expect(mixed.coverageStatus).toMatchObject({ complete: false, uncoveredRequiredKeyCount: 1 });
  });

  it("deduplicates desired bricks and requested coverage for budgets while rejecting duplicate request IDs", () => {
    const target = key(4);
    const duplicateGeometry = [requestForKey(target, "request.a"), requestForKey(target, "request.b")];
    const exactOneBrick: AdaptivePlannerBudgets = {
      maxBricks: 1,
      maxBytes: ADAPTIVE_BRICK_ESTIMATED_BYTES,
      maxWork: ADAPTIVE_BRICK_ESTIMATED_WORK,
      maxCoverageQuantum: 16 ** 3
    };
    const active = { bounds: quantumBoundsForKey(target), key: target, kind: "selected" as const };
    const input = snapshot([], duplicateGeometry, exactOneBrick);
    const result = planAdaptiveMicrovoxels({ snapshot: { ...input, activeCoverage: [active, active] } });
    expect(result.status).toBe("accepted");
    expect(result.desired).toEqual([target]);
    expect(() => planAdaptiveMicrovoxels({
      snapshot: snapshot([], [requestForKey(target, "request.duplicate"), requestForKey(target, "request.duplicate")])
    })).toThrow(AdaptiveAuthorityError);
  });

  it("validates but never trusts active coverage as canonical planner authority", () => {
    const target = key(4);
    const active = { bounds: quantumBoundsForKey(target), key: target, kind: "selected" as const };
    const without = planAdaptiveMicrovoxels({ snapshot: snapshot([], [requestForKey(target, "request.target")]) });
    const withCoverageSnapshot = snapshot([], [requestForKey(target, "request.target")]);
    const withCoverage = planAdaptiveMicrovoxels({ snapshot: { ...withCoverageSnapshot, activeCoverage: [active] } });
    expect(withCoverage.snapshotProjectionDigest).not.toBe(without.snapshotProjectionDigest);
    expect(withCoverage.planHash).not.toBe(without.planHash);
    expect({ ...withCoverage, snapshotProjectionDigest: without.snapshotProjectionDigest, planHash: without.planHash }).toEqual(without);
    expect(withCoverage.coverage).toEqual([]);
    expect(withCoverage.coverageStatus.complete).toBe(false);

    const badBounds = { min: active.bounds.min, max: { ...active.bounds.max, x: globalQuantumCoordinate(active.bounds.max.x + 16) } };
    expect(() => planAdaptiveMicrovoxels({ snapshot: { ...withCoverageSnapshot, activeCoverage: [{ ...active, bounds: badBounds }] } })).toThrow(AdaptiveAuthorityError);
    const foreign = createAdaptiveBrickKey({ bodyId: "planet.other", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1", level: 4, originQuantum: { x: 0, y: 0, z: 0 } });
    expect(() => planAdaptiveMicrovoxels({ snapshot: { ...withCoverageSnapshot, activeCoverage: [{ ...active, key: foreign, bounds: quantumBoundsForKey(foreign) }] } })).toThrow(AdaptiveAuthorityError);
  });

  it("accepts exact budget boundaries and preserves priority, request ID, then key materialization order", () => {
    const exact = planAdaptiveMicrovoxels({
      snapshot: snapshot([], [request], {
        maxBricks: 64,
        maxBytes: 64 * ADAPTIVE_BRICK_ESTIMATED_BYTES,
        maxWork: 64 * ADAPTIVE_BRICK_ESTIMATED_WORK,
        maxCoverageQuantum: 64 ** 3
      })
    });
    expect(exact.status).toBe("accepted");

    const orderedRequests = [
      requestForKey(key(4, 0), "request.z-low", { priority: 1 }),
      requestForKey(key(4, 32), "request.z-high", { priority: 10 }),
      requestForKey(key(4, 16), "request.b", { priority: 5 }),
      requestForKey(key(4, 48), "request.a", { priority: 5 })
    ];
    const ordered = planAdaptiveMicrovoxels({ snapshot: snapshot([], orderedRequests) });
    expect(ordered.materializeRequests.map(serializeAdaptiveKey)).toEqual([key(4, 32), key(4, 48), key(4, 16), key(4, 0)].map(serializeAdaptiveKey));
  });

  it("rejects more than 4096 target bricks through bounded enumeration without a partial plan", () => {
    const huge: AdaptivePlanRequest = {
      ...request,
      requestId: stableAuthorityId("request.huge"),
      region: {
        kind: "aabb",
        bounds: {
          min: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
          max: { x: globalQuantumCoordinate(16 * 4_097), y: globalQuantumCoordinate(16), z: globalQuantumCoordinate(16) }
        }
      },
      targetLevel: 4 as AdaptivePlanRequest["targetLevel"]
    };
    const result = planAdaptiveMicrovoxels({ snapshot: snapshot([], [huge]) });
    expect(result).toMatchObject({ status: "rejected", budget: "brick-count", required: 4_097, limit: 4_096 });
    expect(result.desired).toEqual([]);
    expect(result.keep).toEqual([]);
    expect(result.materialize).toEqual([]);
    expect(result.evict).toEqual([]);
    expect(result.fallback).toEqual([]);
    expect(result.coverage).toEqual([]);
  });

  it("fails closed for ready residency without an exact constructor-issued validation proof", () => {
    const validSnapshot = snapshot([resident(parent)]);
    const readyWithoutProof = residentSummary(resident(parent));
    expect(() => planAdaptiveMicrovoxels({ snapshot: { ...validSnapshot, resident: [readyWithoutProof] } })).toThrow(AdaptiveAuthorityError);
    const valid = validSnapshot.resident[0];
    const mismatched = {
      ...valid,
      validationProof: { ...valid.validationProof!, key: key(2, 64) }
    };
    expect(() => planAdaptiveMicrovoxels({ snapshot: { ...validSnapshot, resident: [mismatched] } })).toThrow(AdaptiveAuthorityError);
  });

  it("accepts only a deeply frozen proof bound to the exact authority, epoch, and non-circular snapshot projection", () => {
    const validSnapshot = snapshot([resident(parent)]);
    const proof = validSnapshot.resident[0].validationProof!;
    const prooflessSnapshot: AdaptivePlannerSnapshot = {
      ...validSnapshot,
      resident: validSnapshot.resident.map(({ validationProof: _proof, ...entry }) => entry)
    };
    const singularProof = createAdaptiveResidentValidationProof({
      brick: brickFor(parent),
      brickRevision: plannerBrickRevision,
      snapshot: prooflessSnapshot
    });
    const accepted = planAdaptiveMicrovoxels({ snapshot: validSnapshot });
    expect(accepted.status).toBe("accepted");
    expect(isDeepFrozen(proof)).toBe(true);
    expect(singularProof).toEqual(proof);
    expect(proof.snapshotProjectionDigest).toBe(accepted.snapshotProjectionDigest);
    expect(proof.proofDigest).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);

    const staleEpoch = { ...validSnapshot, planningEpoch: authorityRevision(validSnapshot.planningEpoch + 1) };
    expect(() => planAdaptiveMicrovoxels({ snapshot: staleEpoch })).toThrow(AdaptiveAuthorityError);

    const wrongProjection = { ...validSnapshot, budgets: { ...validSnapshot.budgets, maxBricks: validSnapshot.budgets.maxBricks - 1 } };
    expect(() => planAdaptiveMicrovoxels({ snapshot: wrongProjection })).toThrow(AdaptiveAuthorityError);

    const wrongDescriptor = createAdaptiveBaseFieldDescriptor({
      ...baseField,
      identity: stableAuthorityId("base.other")
    });
    expect(() => planAdaptiveMicrovoxels({ snapshot: {
      ...validSnapshot,
      authority: { ...validSnapshot.authority, baseField: wrongDescriptor }
    } })).toThrow(AdaptiveAuthorityError);

    const wrongJournal = createAdaptiveEditJournal([{
      editId: "edit.other",
      sequence: 1,
      expectedRegionRevision: 0,
      resultRegionRevision: 1,
      actorId: "actor.test",
      sourceId: "tool.test",
      operation: "SubtractBox",
      box: { min: { x: 1_000, y: 1_000, z: 1_000 }, max: { x: 1_001, y: 1_001, z: 1_001 } }
    }]);
    expect(() => planAdaptiveMicrovoxels({ snapshot: {
      ...validSnapshot,
      authority: { ...validSnapshot.authority, editJournal: wrongJournal }
    } })).toThrow(AdaptiveAuthorityError);
  });

  it("refuses proof publication until snapshot ownership, request bounds, and active coverage semantics are valid", () => {
    const validSnapshot = snapshot([resident(parent)]);
    const proofless: AdaptivePlannerSnapshot = {
      ...validSnapshot,
      resident: validSnapshot.resident.map(({ validationProof: _proof, ...entry }) => entry)
    };
    const issue = (candidate: AdaptivePlannerSnapshot) => createAdaptiveResidentValidationProof({
      brick: brickFor(parent),
      brickRevision: plannerBrickRevision,
      snapshot: candidate
    });

    const foreignKey = createAdaptiveBrickKey({
      bodyId: "planet.other",
      surfaceFrameId: "frame.surface",
      regionId: "region.test",
      generatorVersion: "generator.v1",
      level: 2,
      originQuantum: { x: 0, y: 0, z: 0 }
    });
    expect(() => issue({
      ...proofless,
      resident: [{ ...proofless.resident[0], key: foreignKey }]
    })).toThrow(AdaptiveAuthorityError);

    const malformedBounds = {
      min: request.region.kind === "aabb" ? request.region.bounds.min : region.min,
      max: { ...(request.region.kind === "aabb" ? request.region.bounds.max : region.max), x: globalQuantumCoordinate(region.max.x - 1) }
    };
    expect(() => issue({
      ...proofless,
      refinementRequests: [{ ...request, region: { kind: "aabb", bounds: malformedBounds } } as AdaptivePlanRequest]
    })).toThrow(AdaptiveAuthorityError);

    const active = { bounds: quantumBoundsForKey(parent), key: parent, kind: "fallback" as const };
    expect(() => issue({
      ...proofless,
      activeCoverage: [{ ...active, bounds: { min: active.bounds.min, max: { ...active.bounds.max, x: globalQuantumCoordinate(active.bounds.max.x - 1) } } }]
    })).toThrow(AdaptiveAuthorityError);

    expect(createAdaptiveResidentValidationProofs({
      bricks: [brickFor(parent)],
      brickRevision: plannerBrickRevision,
      snapshot: proofless
    })).toHaveLength(1);
  });

  it("rejects every resident binding mismatch, forged shape, and tampered digest before request or coverage work", () => {
    const validSnapshot = snapshot([resident(parent)]);
    const valid = validSnapshot.resident[0];
    const canonicalHash = hashAdaptiveCanonical({ different: true });
    const fieldMutations: readonly [keyof AdaptiveResidentBrick, unknown][] = [
      ["key", key(2, 64)],
      ["contentHash", canonicalHash],
      ["provenanceHash", canonicalHash],
      ["baseFieldDescriptorDigest", canonicalHash],
      ["journalDigest", canonicalHash],
      ["sourceRevision", authorityRevision(2)],
      ["editRevision", authorityRevision(1)],
      ["brickRevision", authorityRevision(1)]
    ];
    for (const [field, value] of fieldMutations) {
      expect(() => planAdaptiveMicrovoxels({ snapshot: {
        ...validSnapshot,
        resident: [{ ...valid, [field]: value } as AdaptiveResidentBrick]
      } })).toThrow(AdaptiveAuthorityError);
    }

    const forged = JSON.parse(canonicalAdaptiveJson(valid.validationProof)) as typeof valid.validationProof;
    expect(() => planAdaptiveMicrovoxels({ snapshot: { ...validSnapshot, resident: [{ ...valid, validationProof: forged }] } })).toThrow(AdaptiveAuthorityError);
    expect(() => planAdaptiveMicrovoxels({ snapshot: {
      ...validSnapshot,
      resident: [{ ...valid, validationProof: { ...valid.validationProof!, proofDigest: canonicalHash } }]
    } })).toThrow(AdaptiveAuthorityError);
    expect(() => planAdaptiveMicrovoxels({ snapshot: {
      ...validSnapshot,
      resident: [{ ...valid, validationProof: { ...valid.validationProof!, extra: true } as never }]
    } })).toThrow(AdaptiveAuthorityError);

    const malformedRequest = { ...request, reason: "NotAReason" as never };
    try {
      planAdaptiveMicrovoxels({ snapshot: {
        ...validSnapshot,
        refinementRequests: [malformedRequest],
        resident: [{ ...valid, validationProof: { ...valid.validationProof!, proofDigest: canonicalHash } }]
      } });
      throw new Error("expected proof rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AdaptiveAuthorityError);
      expect((error as AdaptiveAuthorityError).path).toContain("validationProof");
    }
  });

  it("binds accepted and rejected plan hashes to the canonical snapshot projection", () => {
    const acceptedA = planAdaptiveMicrovoxels({ snapshot: snapshot([], [requestForKey(key(4), "request.digest")]) });
    const epochB = snapshot([], [requestForKey(key(4), "request.digest")]);
    const acceptedB = planAdaptiveMicrovoxels({ snapshot: { ...epochB, planningEpoch: authorityRevision(epochB.planningEpoch + 1) } });
    expect(acceptedA.snapshotProjectionDigest).not.toBe(acceptedB.snapshotProjectionDigest);
    expect(acceptedA.planHash).not.toBe(acceptedB.planHash);

    const rejectedA = planAdaptiveMicrovoxels({ snapshot: snapshot([], [request], { ...budgets, maxBricks: 0 }) });
    const rejectionBInput = snapshot([], [request], { ...budgets, maxBricks: 0 });
    const rejectedB = planAdaptiveMicrovoxels({ snapshot: { ...rejectionBInput, planningEpoch: authorityRevision(rejectionBInput.planningEpoch + 1) } });
    expect(rejectedA.status).toBe("rejected");
    expect(rejectedB.status).toBe("rejected");
    expect(rejectedA.snapshotProjectionDigest).not.toBe(rejectedB.snapshotProjectionDigest);
    expect(rejectedA.planHash).not.toBe(rejectedB.planHash);
  });

  it("cross-checks independently derived production planner vectors", () => {
    // Independently derived; schema/version changes need deliberate review, never blind regeneration.
    const requestedSnapshot = snapshot([], [request]);
    const accepted = planAdaptiveMicrovoxels({ snapshot: requestedSnapshot });
    expect(accepted.snapshotProjectionDigest).toBe("fnv1a64-v1:a4742926bffe485b");
    expect(accepted).toMatchObject({
      status: "accepted",
      planHash: "fnv1a64-v1:29d23cf307090000",
      desired: expect.any(Array),
      keep: [],
      materialize: expect.any(Array),
      evict: [],
      fallback: [],
      coverage: [],
      coverageStatus: { complete: false, uncoveredRequiredKeyCount: 64 },
      reasons: [
        "Requested 64 unique target bricks across 1 refinement requests.",
        "0 validated parent fallback regions remain active.",
        "64 required target bricks have no validated fallback."
      ]
    });
    expect(accepted.desired).toHaveLength(64);
    expect(accepted.materialize).toHaveLength(64);
    expect(accepted.desired[0].originQuantum).toEqual({ x: 0, y: 0, z: 0 });
    expect(accepted.desired[63].originQuantum).toEqual({ x: 48, y: 48, z: 48 });

    const residentSnapshot = snapshot([resident(parent)]);
    expect(residentSnapshot.resident[0].validationProof).toMatchObject({
      schemaVersion: "adaptive-microvoxel-resident-validation-proof-v1",
      proofVersion: "adaptive-microvoxel-resident-validation-proof-issuer-v1",
      key: {
        schemaVersion: "adaptive-microvoxel-key-v1",
        bodyId: "planet.test",
        surfaceFrameId: "frame.surface",
        regionId: "region.test",
        generatorVersion: "generator.v1",
        level: 2,
        originQuantum: { x: 0, y: 0, z: 0 }
      },
      contentHash: "fnv1a64-v1:6fa95b9c11f2b5f6",
      provenanceHash: "fnv1a64-v1:52acc30fb9b5da37",
      baseFieldDescriptorDigest: "fnv1a64-v1:e37982c711163a94",
      journalDigest: "fnv1a64-v1:4144927f889a3178",
      sourceRevision: 1,
      editRevision: 0,
      brickRevision: 0,
      planningEpoch: 7,
      snapshotProjectionDigest: "fnv1a64-v1:a756afcc8e9eb4cf",
      proofDigest: "fnv1a64-v1:7ff499bc651aab0e"
    });

    const rejected = planAdaptiveMicrovoxels({
      snapshot: snapshot([], [request], { ...budgets, maxBricks: 0 })
    });
    expect(rejected).toMatchObject({
      snapshotProjectionDigest: "fnv1a64-v1:2d171393565cf1be",
      planHash: "fnv1a64-v1:0c86d956b8677bce",
      status: "rejected",
      code: "BudgetExceeded",
      budget: "brick-count",
      required: 64,
      limit: 0
    });
  });

  it("pins complete non-circular snapshot and constructor-proof UTF-8 bytes independently", () => {
    const vectorKey = createAdaptiveBrickKey({
      bodyId: "p", surfaceFrameId: "f", regionId: "r", generatorVersion: "g",
      level: 0, originQuantum: { x: 0, y: 0, z: 0 }
    });
    const vectorBase = createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1", identity: stableAuthorityId("b"), version: stableAuthorityId("v"), sourceRevision: authorityRevision(0),
      sample: { density: 0, occupancy: 1, materialId: stableAuthorityId("m") }
    });
    const vectorJournal = createAdaptiveEditJournal([]);
    const vectorBrick = materializeAdaptiveBrick({ key: vectorKey, baseField: vectorBase, editJournal: vectorJournal });
    const residentEntry: AdaptiveResidentBrick = {
      key: vectorKey,
      readiness: "ready",
      byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES,
      work: ADAPTIVE_BRICK_ESTIMATED_WORK,
      contentHash: vectorBrick.contentHash,
      provenanceHash: vectorBrick.provenance.provenanceHash,
      baseFieldDescriptorDigest: vectorBrick.baseFieldDescriptorDigest,
      journalDigest: vectorBrick.provenance.journalDigest,
      sourceRevision: vectorBrick.sourceRevision,
      editRevision: vectorBrick.editRevision,
      brickRevision: authorityRevision(0)
    };
    const prooflessSnapshot: AdaptivePlannerSnapshot = {
      schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
      bodyId: stableAuthorityId("p"),
      surfaceFrameId: stableAuthorityId("f"),
      regionId: stableAuthorityId("r"),
      generatorVersion: stableAuthorityId("g"),
      authority: {
        schemaVersion: "adaptive-microvoxel-planner-authority-v1",
        baseField: vectorBase,
        editJournal: vectorJournal,
        brickRevision: authorityRevision(0)
      },
      planningEpoch: authorityRevision(0),
      resident: [residentEntry],
      activeCoverage: [],
      refinementRequests: [],
      budgets: { maxBricks: 0, maxBytes: 0, maxWork: 0, maxCoverageQuantum: 0 }
    };
    const projection = createAdaptivePlannerSnapshotProjection(prooflessSnapshot);
    const proof = createAdaptiveResidentValidationProof({ brick: vectorBrick, brickRevision: authorityRevision(0), snapshot: prooflessSnapshot });

    // Explicit strings were pasted from an independent Python projection and UTF-8/FNV implementation.
    // Any change requires deliberate schema/version review; never blindly regenerate these vectors.
     const expectedProjection = '{"activeCoverage":[],"authority":{"baseField":{"identity":"b","kind":"constant-v1","sample":{"density":0,"materialId":"m","occupancy":1,"semanticId":null},"sourceRevision":0,"version":"v"},"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","bodyId":"p","brickRevision":0,"editJournal":{"digest":"fnv1a64-v1:4144927f889a3178","initialRegionRevision":0,"records":[],"revision":0,"schemaVersion":"adaptive-microvoxel-journal-v1"},"editRevision":0,"generatorVersion":"g","journalDigest":"fnv1a64-v1:4144927f889a3178","planningEpoch":0,"regionId":"r","schemaVersion":"adaptive-microvoxel-planner-authority-v1","sourceRevision":0,"surfaceFrameId":"f"},"budgets":{"maxBricks":0,"maxBytes":0,"maxCoverageQuantum":0,"maxWork":0},"refinementRequests":[],"resident":[{"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","brickRevision":0,"byteSize":131072,"contentHash":"fnv1a64-v1:9f29dfdc70de51ff","editRevision":0,"journalDigest":"fnv1a64-v1:4144927f889a3178","key":{"bodyId":"p","generatorVersion":"g","level":0,"originQuantum":{"x":0,"y":0,"z":0},"regionId":"r","schemaVersion":"adaptive-microvoxel-key-v1","surfaceFrameId":"f"},"provenanceHash":"fnv1a64-v1:f1d62e52a9041bae","readiness":"ready","sourceRevision":0,"work":4096}],"schemaVersion":"adaptive-microvoxel-snapshot-projection-v1"}';
     const expectedProof = '{"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","brickRevision":0,"contentHash":"fnv1a64-v1:9f29dfdc70de51ff","editRevision":0,"journalDigest":"fnv1a64-v1:4144927f889a3178","key":{"bodyId":"p","generatorVersion":"g","level":0,"originQuantum":{"x":0,"y":0,"z":0},"regionId":"r","schemaVersion":"adaptive-microvoxel-key-v1","surfaceFrameId":"f"},"planningEpoch":0,"proofDigest":"fnv1a64-v1:db81963893ef243d","proofVersion":"adaptive-microvoxel-resident-validation-proof-issuer-v1","provenanceHash":"fnv1a64-v1:f1d62e52a9041bae","schemaVersion":"adaptive-microvoxel-resident-validation-proof-v1","snapshotProjectionDigest":"fnv1a64-v1:65c99718f9e33b8b","sourceRevision":0}';
    const encoder = new TextEncoder();
    const actualProjection = canonicalAdaptiveJson(projection);
    const actualProof = canonicalAdaptiveJson(proof);

    expect(actualProjection).toBe(expectedProjection);
    expect(encoder.encode(actualProjection)).toEqual(encoder.encode(expectedProjection));
     expect(encoder.encode(actualProjection).byteLength).toBe(1_297);
     expect(hashAdaptiveCanonical(projection)).toBe("fnv1a64-v1:65c99718f9e33b8b");
    expect(actualProof).toBe(expectedProof);
    expect(encoder.encode(actualProof)).toEqual(encoder.encode(expectedProof));
    expect(encoder.encode(actualProof).byteLength).toBe(680);
     expect(proof.proofDigest).toBe("fnv1a64-v1:db81963893ef243d");
  });

  it("pins complete accepted and rejected plan-hash payload UTF-8 bytes independently", () => {
    const vectorBase = createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1", identity: stableAuthorityId("b"), version: stableAuthorityId("v"), sourceRevision: authorityRevision(0),
      sample: { density: 0, occupancy: 1, materialId: stableAuthorityId("m") }
    });
    const vectorJournal = createAdaptiveEditJournal([]);
    const vectorSnapshot = (
      refinementRequests: AdaptivePlannerSnapshot["refinementRequests"],
      budgetValues: AdaptivePlannerBudgets
    ): AdaptivePlannerSnapshot => ({
      schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
      bodyId: stableAuthorityId("p"), surfaceFrameId: stableAuthorityId("f"), regionId: stableAuthorityId("r"), generatorVersion: stableAuthorityId("g"),
      authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField: vectorBase, editJournal: vectorJournal, brickRevision: authorityRevision(0) },
      planningEpoch: authorityRevision(0), resident: [], activeCoverage: [], refinementRequests, budgets: budgetValues
    });
    const accepted = planAdaptiveMicrovoxels({
      snapshot: vectorSnapshot([], { maxBricks: 0, maxBytes: 0, maxWork: 0, maxCoverageQuantum: 0 })
    });
    const rejectedRequest: AdaptivePlanRequest = {
      requestId: stableAuthorityId("q"),
       region: { kind: "aabb", bounds: { min: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) }, max: { x: globalQuantumCoordinate(16), y: globalQuantumCoordinate(16), z: globalQuantumCoordinate(16) } } },
      targetLevel: 4 as AdaptivePlanRequest["targetLevel"], reason: "Inspection", requiredForCoverage: true, priority: 1
    };
    const rejected = planAdaptiveMicrovoxels({
      snapshot: vectorSnapshot([rejectedRequest], { maxBricks: 0, maxBytes: 131_072, maxWork: 4_096, maxCoverageQuantum: 4_096 })
    });
    const { planHash: acceptedHash, ...acceptedPayload } = accepted;
    const { planHash: rejectedHash, ...rejectedPayload } = rejected;

    // Explicit strings were pasted from an independent Python projection and UTF-8/FNV implementation.
    // Any change requires deliberate schema/version review; never blindly regenerate these vectors.
     const expectedAccepted = '{"coverage":[],"coverageStatus":{"complete":true,"coverage":[],"uncoveredRequiredKeyCount":0},"desired":[],"desiredKeys":[],"deterministicReasons":["Requested 0 unique target bricks across 0 refinement requests.","0 validated parent fallback regions remain active.","0 required target bricks have no validated fallback."],"evict":[],"evictCandidates":[],"fallback":[],"keep":[],"keepKeys":[],"materialize":[],"materializeRequests":[],"parentFallbackKeys":[],"reasons":["Requested 0 unique target bricks across 0 refinement requests.","0 validated parent fallback regions remain active.","0 required target bricks have no validated fallback."],"schemaVersion":"adaptive-microvoxel-plan-v1","snapshotProjectionDigest":"fnv1a64-v1:be5f9fef12ece341","status":"accepted"}';
     const expectedRejected = '{"budget":"brick-count","code":"BudgetExceeded","coverage":[],"coverageStatus":{"complete":false,"coverage":[],"uncoveredRequiredKeyCount":0},"desired":[],"desiredKeys":[],"deterministicReasons":["Required brick-count budget 1 exceeds limit 0."],"evict":[],"evictCandidates":[],"fallback":[],"keep":[],"keepKeys":[],"limit":0,"materialize":[],"materializeRequests":[],"parentFallbackKeys":[],"reasons":["Required brick-count budget 1 exceeds limit 0."],"required":1,"schemaVersion":"adaptive-microvoxel-plan-v1","snapshotProjectionDigest":"fnv1a64-v1:08cb7c4c512c07ee","status":"rejected"}';
    const encoder = new TextEncoder();
    const actualAccepted = canonicalAdaptiveJson(acceptedPayload);
    const actualRejected = canonicalAdaptiveJson(rejectedPayload);

    expect(actualAccepted).toBe(expectedAccepted);
    expect(encoder.encode(actualAccepted)).toEqual(encoder.encode(expectedAccepted));
    expect(encoder.encode(actualAccepted).byteLength).toBe(766);
     expect(acceptedHash).toBe("fnv1a64-v1:a74faaef589aba9c");
    expect(actualRejected).toBe(expectedRejected);
    expect(encoder.encode(actualRejected)).toEqual(encoder.encode(expectedRejected));
    expect(encoder.encode(actualRejected).byteLength).toBe(589);
     expect(rejectedHash).toBe("fnv1a64-v1:4195b23fded4ab7c");
  });

  it("copies validated nested request inputs so recursive result freezing never freezes caller state", () => {
    const mutableBounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 16, y: 16, z: 16 } };
    const mutableRequest = {
      requestId: stableAuthorityId("request.mutable"),
      region: { kind: "aabb" as const, bounds: mutableBounds },
      targetLevel: 4 as AdaptivePlanRequest["targetLevel"],
      reason: "Inspection" as const,
      requiredForCoverage: true,
      priority: 1
    };
    const result = planAdaptiveMicrovoxels({ snapshot: snapshot([], [mutableRequest as AdaptivePlanRequest]) });
    expect(isDeepFrozen(result)).toBe(true);
    expect(Object.isFrozen(mutableRequest)).toBe(false);
    expect(Object.isFrozen(mutableRequest.region)).toBe(false);
    expect(Object.isFrozen(mutableBounds)).toBe(false);
    expect(Object.isFrozen(mutableBounds.min)).toBe(false);
    mutableBounds.min.x = -16;
    expect(mutableBounds.min.x).toBe(-16);
  });

  it("[19] collapse releases only derived children and re-expansion reproduces canonical bytes and hashes", () => {
    const child = allFineChildren()[0];
    const edits = createAdaptiveEditJournal([]);
    const before = materializeAdaptiveBrick({ key: child, baseField, editJournal: edits });
    const authority = createAdaptiveAuthorityRetention({ baseField, editJournal: edits });
    const collapse = releaseAdaptiveResidency([parent, child], [child], "collapse", authority);
    expect(collapse.authorityRetained).toBe(true);
    expect(collapse.residentKeys).toEqual([parent]);
    expect(collapse.releasedKeys).toEqual([child]);
    expect(collapse.authority).toBe(authority);
    const expanded = materializeAdaptiveBrick({ key: child, baseField: collapse.authority.baseField, editJournal: collapse.authority.editJournal });
    expect(expanded.contentHash).toBe(before.contentHash);
    expect(expanded.provenance.provenanceHash).toBe(before.provenance.provenanceHash);
    expect(expanded).toEqual(before);
  });

  it("[20] eviction is idempotent and reload keeps the full journal and canonical authority", () => {
    const child = allFineChildren()[0];
    const edits = createAdaptiveEditJournal([
      {
        editId: "edit.cut",
        sequence: 1,
        expectedRegionRevision: 0,
        resultRegionRevision: 1,
        actorId: "actor.test",
        sourceId: "tool.test",
        operation: "SubtractBox",
        box: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } }
      }
    ]);
    const before = materializeAdaptiveBrick({ key: child, baseField, editJournal: edits });
    const authority = createAdaptiveAuthorityRetention({ baseField, editJournal: edits });
    const first = releaseAdaptiveResidency([child], [child], "evict", authority);
    const second = releaseAdaptiveResidency(first.residentKeys, [child], "evict", first.authority);
    expect(first.releasedKeys).toEqual([child]);
    expect(second.releasedKeys).toEqual([]);
    const reloaded = materializeAdaptiveBrick({ key: child, baseField: second.authority.baseField, editJournal: second.authority.editJournal });
    expect(reloaded).toEqual(before);
    expect(edits.records).toHaveLength(1);
    expect(() => releaseAdaptiveResidency([child], [child], "evict", undefined as never)).toThrow(AdaptiveAuthorityError);
  });
});
