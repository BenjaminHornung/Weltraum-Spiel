import { describe, expect, it } from "vitest";
import { hashAdaptiveCanonical } from "../../src/voxel/adaptive";
import type { SurfaceRigidBodyAabb } from "../../src/surface-play/physics/surfaceRigidBodyRegistry";
import {
  acknowledgeSurfaceRigidBodyIslandWorkReceipt,
  adoptSurfaceRigidBodyIslandCompletionSnapshot,
  advanceSurfaceRigidBodyIslandPlanning,
  createSurfaceRigidBodyIslandCompletionSnapshot,
  createSurfaceRigidBodyIslandCursor,
  createSurfaceRigidBodyIslandPlanningCursor,
  createSurfaceRigidBodyIslandPlanningSession,
  createSurfaceRigidBodyIslandWorkReceipt,
  selectSurfaceRigidBodyIslandWork,
  type SurfaceRigidBodyIslandBodyInput,
  type SurfaceRigidBodyIslandCursor,
  type SurfaceRigidBodyIslandPlan,
  type SurfaceRigidBodyIslandPlanningContext,
  type SurfaceRigidBodyIslandPlanningCursor,
  type SurfaceRigidBodyIslandPlanningSession,
  type SurfaceRigidBodyIslandWorkBudget,
  type SurfaceRigidBodyIslandWorkReceipt,
  type SurfaceRigidBodyIslandWorkSlice
} from "../../src/surface-play/physics/surfaceRigidBodyIslandScheduler";

const aabb = (
  minimumX: number,
  maximumX: number,
  minimumY = 0,
  maximumY = 1,
  minimumZ = 0,
  maximumZ = 1
): SurfaceRigidBodyAabb => ({
  minimumX,
  minimumY,
  minimumZ,
  maximumX,
  maximumY,
  maximumZ
});

const context = (
  overrides: Partial<SurfaceRigidBodyIslandPlanningContext> = {}
): SurfaceRigidBodyIslandPlanningContext => ({
  planningTick: 42,
  fixedDeltaSeconds: 0.25,
  gravityMetersPerSecondSquared: Object.freeze({ x: 0, y: -10, z: 0 }),
  ...overrides
});

const body = (
  bodyId: string,
  range: Readonly<SurfaceRigidBodyAabb>,
  overrides: Partial<SurfaceRigidBodyIslandBodyInput> = {}
): SurfaceRigidBodyIslandBodyInput => {
  const frozenRange = Object.freeze({ ...range });
  return {
    proxy: Object.freeze({
      bodyId,
      recordHash: hashAdaptiveCanonical({ bodyId, range: frozenRange }),
      aabb: frozenRange
    }),
    tier: "ActiveContact",
    lifecycle: "Falling",
    residencyProvenanceHash: hashAdaptiveCanonical({ bodyId, residency: "active" }),
    linearVelocityMetersPerSecond: Object.freeze({ x: 0, y: 0, z: 0 }),
    angularVelocityRadiansPerSecond: Object.freeze({ x: 0, y: 0, z: 0 }),
    rotationPivotWorldMeters: Object.freeze({
      x: (range.minimumX + range.maximumX) / 2,
      y: (range.minimumY + range.maximumY) / 2,
      z: (range.minimumZ + range.maximumZ) / 2
    }),
    accumulatedSimulationSeconds: 0,
    wakeRequested: false,
    ...overrides
  };
};

interface CompletedPlanning {
  readonly session: Readonly<SurfaceRigidBodyIslandPlanningSession>;
  readonly plan: Readonly<SurfaceRigidBodyIslandPlan>;
  readonly maximumObservedPairTests: number;
  readonly sliceCount: number;
}

const completePlanning = (
  inputs: readonly Readonly<SurfaceRigidBodyIslandBodyInput>[],
  planningContext = context(),
  maximumPairTests = 64
): CompletedPlanning => {
  const session = createSurfaceRigidBodyIslandPlanningSession(inputs, planningContext);
  let cursor: Readonly<SurfaceRigidBodyIslandPlanningCursor> =
    createSurfaceRigidBodyIslandPlanningCursor(session);
  let maximumObservedPairTests = 0;
  for (let sliceCount = 1; sliceCount <= 1_000_000; sliceCount += 1) {
    const result = advanceSurfaceRigidBodyIslandPlanning(
      session,
      cursor,
      { maximumPairTests }
    );
    maximumObservedPairTests = Math.max(
      maximumObservedPairTests,
      result.work.broadphasePairTestCount
    );
    expect(result.work.broadphasePairTestCount).toBeLessThanOrEqual(maximumPairTests);
    cursor = result.cursor;
    if (result.status === "Complete") {
      return Object.freeze({
        session,
        plan: result.plan,
        maximumObservedPairTests,
        sliceCount
      });
    }
  }
  throw new Error("Island planning did not complete within the test guard.");
};

const workBudget = Object.freeze({
  maximumBodySteps: 8,
  maximumPairTests: 16,
  maximumContactPairs: 4,
  maximumSubsteps: 1
});

interface CompletedWork {
  readonly work: readonly Readonly<SurfaceRigidBodyIslandWorkSlice>[];
  readonly cursor: Readonly<SurfaceRigidBodyIslandCursor>;
}

const completeWork = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  budget: Readonly<SurfaceRigidBodyIslandWorkBudget> = workBudget
): CompletedWork => {
  let cursor: Readonly<SurfaceRigidBodyIslandCursor> =
    createSurfaceRigidBodyIslandCursor(plan);
  const work: Readonly<SurfaceRigidBodyIslandWorkSlice>[] = [];
  for (let guard = 0; guard < 1_000_000; guard += 1) {
    const selected = selectSurfaceRigidBodyIslandWork(plan, cursor, budget);
    cursor = selected.cursor;
    if (selected.status === "Complete") {
      return Object.freeze({ work: Object.freeze(work), cursor });
    }
    if (selected.status === "AwaitingReceipt") {
      throw new Error("Immediate receipt acknowledgement unexpectedly left all islands pending.");
    }
    expect(selected.work.bodyStepCount).toBeLessThanOrEqual(budget.maximumBodySteps);
    expect(selected.work.broadphasePairTestCount).toBeLessThanOrEqual(
      budget.maximumPairTests
    );
    expect(selected.work.contactPairCount).toBeLessThanOrEqual(
      budget.maximumContactPairs
    );
    expect(selected.work.completedSubstepCount).toBeLessThanOrEqual(
      budget.maximumSubsteps
    );
    work.push(selected.work);
    acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, receipt(selected.work));
  }
  throw new Error("Island work did not complete within the test guard.");
};

const receipt = (
  work: Readonly<SurfaceRigidBodyIslandWorkSlice>
): Readonly<SurfaceRigidBodyIslandWorkReceipt> =>
  createSurfaceRigidBodyIslandWorkReceipt(work, hashAdaptiveCanonical({
    workId: work.workId,
    units: work.units
  }));

describe("Surface rigid-body contact-island scheduler", () => {
  it("binds plans to exact physics, gravity, time, and residency provenance", () => {
    const base = body("body:a", aabb(0, 1));
    const baseline = completePlanning([base]).plan;
    const reverse = completePlanning([
      body("body:b", aabb(4, 5)),
      base
    ]).plan;
    const forward = completePlanning([
      base,
      body("body:b", aabb(4, 5))
    ]).plan;
    expect(reverse).toEqual(forward);
    expect(JSON.stringify(reverse)).toBe(JSON.stringify(forward));

    const variants: readonly Readonly<SurfaceRigidBodyIslandBodyInput>[] = [
      body("body:a", aabb(0, 1), {
        proxy: Object.freeze({
          bodyId: "body:a",
          recordHash: hashAdaptiveCanonical({ changed: "record" }),
          aabb: Object.freeze(aabb(0, 1))
        })
      }),
      body("body:a", aabb(0, 1.1)),
      body("body:a", aabb(0, 1), {
        linearVelocityMetersPerSecond: { x: 1, y: 0, z: 0 }
      }),
      body("body:a", aabb(0, 1), {
        angularVelocityRadiansPerSecond: { x: 0, y: 1, z: 0 }
      }),
      body("body:a", aabb(0, 1), {
        rotationPivotWorldMeters: { x: 0, y: 0, z: 0 }
      }),
      body("body:a", aabb(0, 1), {
        residencyProvenanceHash: hashAdaptiveCanonical({ changed: "residency" })
      })
    ];
    for (const variant of variants) {
      expect(completePlanning([variant]).plan.contentHash)
        .not.toBe(baseline.contentHash);
    }
    expect(completePlanning([base], context({ planningTick: 43 })).plan.contentHash)
      .not.toBe(baseline.contentHash);
    expect(completePlanning([base], context({
      gravityMetersPerSecondSquared: { x: 0, y: -9, z: 0 }
    })).plan.contentHash).not.toBe(baseline.contentHash);
  });

  it("uses conservative gravity and angular swept bounds", () => {
    const gravityPlan = completePlanning([
      body("body:projectile", aabb(0, 1), {
        linearVelocityMetersPerSecond: { x: 0, y: 10, z: 0 }
      }),
      body("body:apex", aabb(0, 1, 5, 6), {
        tier: "SleepingExact",
        lifecycle: "Resting"
      })
    ], context({
      fixedDeltaSeconds: 2,
      gravityMetersPerSecondSquared: { x: 0, y: -10, z: 0 }
    })).plan;
    expect(gravityPlan.islands).toHaveLength(1);
    expect(gravityPlan.islands[0].bodyIds).toEqual(["body:apex", "body:projectile"]);

    const angularPlan = completePlanning([
      body("body:spinner", aabb(0, 4, -0.1, 0.1), {
        angularVelocityRadiansPerSecond: { x: 0, y: 0, z: Math.PI / 2 },
        rotationPivotWorldMeters: { x: 0, y: 0, z: 0 }
      }),
      body("body:angular-target", aabb(-0.5, 0.5, 3.5, 4.5))
    ], context({
      fixedDeltaSeconds: 1,
      gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
    })).plan;
    expect(angularPlan.islands).toHaveLength(1);
    expect(angularPlan.sourceBodies.find((entry) => entry.bodyId === "body:spinner")
      ?.angularSweepExpansionMeters).toBeGreaterThan(0);
  });

  it("refines FarProxy/FarProxy and FarProxy/SleepingExact contacts without losing time", () => {
    const plan = completePlanning([
      body("body:sleep", aabb(0, 2), {
        tier: "SleepingExact",
        lifecycle: "Resting"
      }),
      body("body:far-a", aabb(1, 3), {
        tier: "FarProxy",
        accumulatedSimulationSeconds: 5
      }),
      body("body:far-b", aabb(2, 4), {
        tier: "FarProxy",
        accumulatedSimulationSeconds: 7
      }),
      body("body:far-deferred", aabb(100, 101), {
        tier: "FarProxy",
        accumulatedSimulationSeconds: 11
      })
    ]).plan;

    expect(plan.refinementRequired.map((entry) => ({
      bodyId: entry.bodyId,
      count: entry.overlappingBodyCount,
      first: entry.firstOverlappingBodyId,
      accumulated: entry.accumulatedSimulationSeconds,
      target: entry.targetSimulationSeconds
    }))).toEqual([
      { bodyId: "body:far-a", count: 2, first: "body:far-b", accumulated: 5, target: 5.25 },
      { bodyId: "body:far-b", count: 2, first: "body:far-a", accumulated: 7, target: 7.25 }
    ]);
    expect(plan.deferredFarProxies).toMatchObject([
      {
        bodyId: "body:far-deferred",
        accumulatedSimulationSeconds: 11,
        targetSimulationSeconds: 11.25
      }
    ]);
    expect(plan.sleepingOnlyBodyIds).toEqual(["body:sleep"]);
  });

  it("plans 1,024 densely overlapping pieces through bounded pair slices without E materialization", () => {
    const count = 1_024;
    const inputs = Array.from({ length: count }, (_, ordinal) =>
      body(`body:${String(ordinal).padStart(4, "0")}`, aabb(0, 1)));
    const completed = completePlanning([...inputs].reverse(), context({
      gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
    }), 4_096);
    const expectedPairs = count * (count - 1) / 2;

    expect(completed.maximumObservedPairTests).toBe(4_096);
    expect(completed.sliceCount).toBeGreaterThan(1);
    expect(completed.plan.logicalBodyCount).toBe(count);
    expect(completed.plan.islands).toHaveLength(1);
    expect(completed.plan.islands[0].bodyIds).toHaveLength(count);
    expect(completed.plan.planningCounters).toEqual({
      broadphasePairTestCount: expectedPairs,
      potentialContactCount: expectedPairs
    });
    expect(completed.plan.islands[0]).not.toHaveProperty("potentialContactPairs");
    expect(JSON.stringify(completed.plan).length).toBeLessThan(1_500_000);
  });

  it.each([1, 8, 64, 256, 1_024])(
    "retains and fairly schedules %i separated logical pieces",
    (count) => {
      const inputs = Array.from({ length: count }, (_, ordinal) =>
        body(
          `body:${String(ordinal).padStart(4, "0")}`,
          aabb(ordinal * 4, ordinal * 4 + 1)
        ));
      const plan = completePlanning([...inputs].reverse(), context({
        gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
      }), 17).plan;
      const completed = completeWork(plan, {
        maximumBodySteps: 1,
        maximumPairTests: 1,
        maximumContactPairs: 1,
        maximumSubsteps: 1
      });
      const integrated = completed.work.flatMap((slice) => slice.units.flatMap((unit) =>
        unit.kind === "IntegrateBodies" ? unit.bodyIds : []));

      expect(plan.logicalBodyCount).toBe(count);
      expect(plan.islands).toHaveLength(count);
      expect(integrated).toHaveLength(count);
      expect(new Set(integrated).size).toBe(count);
      expect([...integrated].sort()).toEqual(inputs.map((entry) => entry.proxy.bodyId));
    }
  );

  it("slices dense body, pair, contact, and substep work without rescanning pairs", () => {
    const count = 64;
    const plan = completePlanning(Array.from({ length: count }, (_, ordinal) =>
      body(`body:${String(ordinal).padStart(4, "0")}`, aabb(0, 1))), context({
      gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
    }), 256).plan;
    const completed = completeWork(plan, {
      maximumBodySteps: 7,
      maximumPairTests: 23,
      maximumContactPairs: 11,
      maximumSubsteps: 1
    });
    const expectedPairs = count * (count - 1) / 2;
    const totalPairTests = completed.work.reduce(
      (sum, work) => sum + work.broadphasePairTestCount,
      0
    );
    const totalContacts = completed.work.reduce(
      (sum, work) => sum + work.contactPairCount,
      0
    );
    const totalBodySteps = completed.work.reduce(
      (sum, work) => sum + work.bodyStepCount,
      0
    );
    const totalSubsteps = completed.work.reduce(
      (sum, work) => sum + work.completedSubstepCount,
      0
    );

    expect(totalPairTests).toBe(expectedPairs);
    expect(totalContacts).toBe(expectedPairs);
    expect(totalBodySteps).toBe(count);
    expect(totalSubsteps).toBe(1);
  });

  it("applies the pair-test budget cumulatively across substeps in one slice", () => {
    const plan = completePlanning([
      body("body:a", aabb(0, 1), { accumulatedSimulationSeconds: 0.25 }),
      body("body:b", aabb(0, 1), { accumulatedSimulationSeconds: 0.25 }),
      body("body:c", aabb(0, 1), { accumulatedSimulationSeconds: 0.25 })
    ], context({
      fixedDeltaSeconds: 0.25,
      gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
    })).plan;
    const cursor = createSurfaceRigidBodyIslandCursor(plan);
    const selected = selectSurfaceRigidBodyIslandWork(plan, cursor, {
      maximumBodySteps: 16,
      maximumPairTests: 4,
      maximumContactPairs: 16,
      maximumSubsteps: 2
    });

    expect(selected.status).toBe("Scheduled");
    if (selected.status !== "Scheduled") throw new Error("Expected scheduled work.");
    const contactUnits = selected.work.units.filter((unit) =>
      unit.kind === "EvaluateContacts");
    expect(selected.work.broadphasePairTestCount).toBe(4);
    expect(contactUnits.map((unit) => unit.testedPairCount)).toEqual([3, 1]);
    expect(contactUnits.reduce((sum, unit) => sum + unit.testedPairCount, 0)).toBe(4);
  });

  it("keeps SleepingExact static until a canonical wake request", () => {
    const sleeping = body("body:sleep", aabb(0.5, 1.5), {
      tier: "SleepingExact",
      lifecycle: "Resting"
    });
    const staticPlan = completePlanning([
      body("body:active", aabb(0, 1)),
      sleeping
    ]).plan;
    expect(staticPlan.islands[0]).toMatchObject({
      bodyIds: ["body:active", "body:sleep"],
      dynamicBodyIds: ["body:active"],
      staticBodyIds: ["body:sleep"]
    });

    const woken = completePlanning([{
      ...sleeping,
      wakeRequested: true,
      residencyProvenanceHash: hashAdaptiveCanonical({ bodyId: "body:sleep", wake: true })
    }]).plan;
    expect(woken.islands[0].dynamicBodyIds).toEqual(["body:sleep"]);
  });

  it("holds dependent island progress until a chain-bound receipt is acknowledged", () => {
    const plan = completePlanning([
      body("body:a", aabb(0, 1)),
      body("body:b", aabb(0, 1)),
      body("body:c", aabb(0, 1))
    ], context({ gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 } })).plan;
    const cursor = createSurfaceRigidBodyIslandCursor(plan);
    const first = selectSurfaceRigidBodyIslandWork(plan, cursor, {
      maximumBodySteps: 1,
      maximumPairTests: 1,
      maximumContactPairs: 1,
      maximumSubsteps: 1
    });
    expect(first.status).toBe("Scheduled");
    if (first.status !== "Scheduled") throw new Error("Expected first work slice.");

    const awaiting = selectSurfaceRigidBodyIslandWork(plan, first.cursor, workBudget);
    expect(awaiting.status).toBe("AwaitingReceipt");
    if (awaiting.status !== "AwaitingReceipt") throw new Error("Expected pending receipt state.");
    expect(awaiting.pendingWork).toEqual([first.work]);
    expect(awaiting.pendingWork[0]).toBe(first.work);
    expect(() => createSurfaceRigidBodyIslandCompletionSnapshot(plan))
      .toThrow(/pending|acknowledged|complete/i);

    const valid = receipt(first.work);
    const forgedPredecessor = Object.freeze({
      ...valid,
      predecessorStateHash: hashAdaptiveCanonical({ forged: "predecessor" })
    });
    const disconnectedResult = Object.freeze({
      ...valid,
      resultStateHash: hashAdaptiveCanonical({ forged: "result" })
    });
    const crossIsland = Object.freeze({ ...valid, rootBodyId: "body:other" });
    const otherPlan = completePlanning([
      body("body:other", aabb(10, 11))
    ]).plan;

    expect(() => acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, forgedPredecessor))
      .toThrow(/predecessor/i);
    expect(() => acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, disconnectedResult))
      .toThrow(/result state|state chain/i);
    expect(() => acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, crossIsland))
      .toThrow(/island|root/i);
    expect(() => acknowledgeSurfaceRigidBodyIslandWorkReceipt(otherPlan, valid))
      .toThrow(/another plan/i);
    const stillAwaiting = selectSurfaceRigidBodyIslandWork(plan, awaiting.cursor, workBudget);
    expect(stillAwaiting.status).toBe("AwaitingReceipt");
    if (stillAwaiting.status !== "AwaitingReceipt") throw new Error("Invalid receipt consumed pending work.");
    expect(stillAwaiting.pendingWork[0]).toBe(first.work);

    expect(acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, valid).state).toBe("Committed");
    expect(acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, valid).state).toBe("AlreadyCommitted");
    const second = selectSurfaceRigidBodyIslandWork(plan, stillAwaiting.cursor, workBudget);
    expect(second.status).toBe("Scheduled");
    if (second.status !== "Scheduled") throw new Error("Expected dependent work after acknowledgement.");
    expect(second.work.predecessorStateHash).toBe(valid.resultStateHash);
    expect(second.work.workId).not.toBe(first.work.workId);
  });

  it("allows one pending slice per independent island and seals receipt-order-independent terminal state", () => {
    const inputs = [
      body("body:a", aabb(0, 1)),
      body("body:b", aabb(4, 5))
    ] as const;
    const run = (reverseReceipts: boolean) => {
      const plan = completePlanning(inputs, context({
        gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
      })).plan;
      const cursor = createSurfaceRigidBodyIslandCursor(plan);
      const first = selectSurfaceRigidBodyIslandWork(plan, cursor, workBudget);
      expect(first.status).toBe("Scheduled");
      if (first.status !== "Scheduled") throw new Error("Expected first island work.");
      const second = selectSurfaceRigidBodyIslandWork(plan, first.cursor, workBudget);
      expect(second.status).toBe("Scheduled");
      if (second.status !== "Scheduled") throw new Error("Expected second island work.");
      expect(second.work.rootBodyId).not.toBe(first.work.rootBodyId);
      const awaiting = selectSurfaceRigidBodyIslandWork(plan, second.cursor, workBudget);
      expect(awaiting.status).toBe("AwaitingReceipt");
      if (awaiting.status !== "AwaitingReceipt") throw new Error("Expected both islands pending.");
      expect(awaiting.pendingWork.map((work) => work.rootBodyId)).toEqual(["body:a", "body:b"]);

      const receipts = [receipt(first.work), receipt(second.work)];
      for (const entry of reverseReceipts ? [...receipts].reverse() : receipts) {
        expect(acknowledgeSurfaceRigidBodyIslandWorkReceipt(plan, entry).state).toBe("Committed");
      }
      const completed = selectSurfaceRigidBodyIslandWork(plan, awaiting.cursor, workBudget);
      expect(completed.status).toBe("Complete");
      const snapshot = createSurfaceRigidBodyIslandCompletionSnapshot(plan);
      expect(snapshot.terminalIslandStateHashes).toEqual([
        { rootBodyId: "body:a", stateHash: receipts[0].resultStateHash },
        { rootBodyId: "body:b", stateHash: receipts[1].resultStateHash }
      ]);
      expect(snapshot.preparedPhysicsStateHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
      return Object.freeze({ plan, snapshot });
    };

    const forward = run(false);
    const reverse = run(true);
    expect(reverse.snapshot).toEqual(forward.snapshot);
    expect(JSON.stringify(reverse.snapshot)).toBe(JSON.stringify(forward.snapshot));
  });

  it("makes plan adoption idempotent and rejects cross-plan snapshots", () => {
    const plan = completePlanning([
      body("body:a", aabb(0, 1))
    ], context({ gravityMetersPerSecondSquared: { x: 0, y: 0, z: 0 } })).plan;
    completeWork(plan);
    const snapshot = createSurfaceRigidBodyIslandCompletionSnapshot(plan);

    expect(adoptSurfaceRigidBodyIslandCompletionSnapshot(plan, snapshot).state)
      .toBe("Adopted");
    expect(adoptSurfaceRigidBodyIslandCompletionSnapshot(plan, snapshot).state)
      .toBe("AlreadyAdopted");

    const otherPlan = completePlanning([
      body("body:other", aabb(10, 11))
    ]).plan;
    expect(() => adoptSurfaceRigidBodyIslandCompletionSnapshot(otherPlan, snapshot))
      .toThrow(/another plan/i);
  });

  it("keeps cursor failures atomic and stops at safe-integer exhaustion", () => {
    const input = body("body:a", aabb(0, 1));
    const session = createSurfaceRigidBodyIslandPlanningSession([input], context());
    const planningCursor = createSurfaceRigidBodyIslandPlanningCursor(session, {
      sequence: Number.MAX_SAFE_INTEGER
    });
    expect(() => advanceSurfaceRigidBodyIslandPlanning(
      session,
      planningCursor,
      { maximumPairTests: 1 }
    )).toThrow(/sequence.*exhausted/i);
    expect(() => advanceSurfaceRigidBodyIslandPlanning(
      session,
      planningCursor,
      { maximumPairTests: 1 }
    )).toThrow(/sequence.*exhausted/i);

    const plan = completePlanning([input]).plan;
    const workCursor = createSurfaceRigidBodyIslandCursor(plan, {
      sequence: Number.MAX_SAFE_INTEGER
    });
    expect(() => selectSurfaceRigidBodyIslandWork(plan, workCursor, workBudget))
      .toThrow(/sequence.*exhausted/i);
    expect(() => selectSurfaceRigidBodyIslandWork(plan, workCursor, workBudget))
      .toThrow(/sequence.*exhausted/i);

    const rotationPlan = completePlanning([input]).plan;
    const rotationCursor = createSurfaceRigidBodyIslandCursor(rotationPlan, {
      completedRotations: Number.MAX_SAFE_INTEGER
    });
    expect(() => selectSurfaceRigidBodyIslandWork(rotationPlan, rotationCursor, {
      maximumBodySteps: 1,
      maximumPairTests: 1,
      maximumContactPairs: 1,
      maximumSubsteps: 1
    })).toThrow(/rotation.*exhausted/i);
    expect(() => selectSurfaceRigidBodyIslandWork(rotationPlan, rotationCursor, {
      maximumBodySteps: 1,
      maximumPairTests: 1,
      maximumContactPairs: 1,
      maximumSubsteps: 1
    })).toThrow(/rotation.*exhausted/i);
  });

  it("fails closed on mutable registry proxies", () => {
    const mutableRange = aabb(0, 1);
    expect(() => createSurfaceRigidBodyIslandPlanningSession([{
      ...body("body:mutable", mutableRange),
      proxy: {
        bodyId: "body:mutable",
        recordHash: hashAdaptiveCanonical({ mutableRange }),
        aabb: mutableRange
      }
    }], context())).toThrow(/immutable/i);
  });
});
