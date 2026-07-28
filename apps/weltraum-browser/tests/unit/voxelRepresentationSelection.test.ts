import { describe, expect, it } from "vitest";
import { adaptiveLevel, adaptivePlanningEpoch, brickExtentQuantumForLevel, globalQuantumCoordinate, isDeepFrozen, stableAuthorityId } from "../../src/voxel/adaptive";
import {
  HARD_ADAPTIVE_REFINEMENT_REASONS,
  REPRESENTATION_LADDER_SCHEMA_VERSION,
  REPRESENTATION_MAX_ACTIVE_PINS,
  REPRESENTATION_MAX_FALLBACK_CHILDREN,
  REPRESENTATION_MAX_SELECTION_CANDIDATES,
  REPRESENTATION_MAX_WORK_UNITS,
  computeScreenSpaceError,
  createHardAuthorityRequirement,
  createRepresentationLadderDescriptor,
  createVoxelQualityPolicy,
  deriveEvictionEligibility,
  resolveProxyInteraction,
  selectRepresentation
} from "../../src/voxel/representation";

const makeBand = (rank: number) => ({
  bandId: `band.${String(rank).padStart(2, "0")}`,
  rank,
  productKind: rank === 0 ? "AdaptiveMicrovoxel" as const : "VoxelRenderProxy" as const,
  algorithmVersion: "surface.v2",
  productVersion: "product.v2",
  geometricErrorMeters: 0.125 * (2 ** rank),
  coverageBoundsMeters: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } },
  sourceBindingKinds: ["AdaptiveAuthority" as const],
  readinessRequirements: ["SourceCurrent" as const, "ProductComplete" as const],
  allowedDomains: ["Render" as const],
  visualAdaptiveLevel: rank <= 3 ? 4 : 2,
  costs: { estimatedBytes: 1_000, workUnits: 100, uploadUnits: 10 }
});

const ladder = () => createRepresentationLadderDescriptor({
  schemaVersion: REPRESENTATION_LADDER_SCHEMA_VERSION,
  descriptorId: "selection.ladder.v2",
  bands: Array.from({ length: 12 }, (_, rank) => makeBand(rank))
});

const ultra = () => createVoxelQualityPolicy({ detail: "Ultra", detailDistanceMeters: 10_000, streamingBudget: "Ultra" });
const low = () => createVoxelQualityPolicy({ detail: "Low", detailDistanceMeters: 1_000, streamingBudget: "Low" });

const baseInput = (distance: number, reverse = false) => {
  const descriptor = ladder();
  const candidates = descriptor.bands.map((band) => ({ bandId: band.bandId, readiness: "Ready" as const, sourceCurrent: true }));
  return {
    descriptor,
    candidates: reverse ? [...candidates].reverse() : candidates,
    projection: {
      cameraPosition: { x: 0, y: 0, z: distance },
      boundsCenter: { x: 0, y: 0, z: 0 },
      boundsRadiusMeters: 1,
      viewportHeightPixels: 1_000,
      verticalFovRadians: Math.PI / 2,
      minimumDistanceMeters: 0.1
    },
    qualityPolicy: ultra(),
    thresholds: {
      refineErrorPixels: 10,
      collapseErrorPixels: 8,
      cullDistanceMeters: 100_000,
      cullProjectedBoundsRadiusPixels: 0.01
    },
    priorBandId: null,
    simulationRequirements: ["StructuralSourceCurrent"],
    requiredAuthorityRequests: [],
    fallbackGroup: null,
    readiness: ["DescriptorReady"],
    evictionEligibility: deriveEvictionEligibility({ structuralState: "Settled", activePins: [] })
  } as const;
};

const selectedRank = (result: ReturnType<typeof selectRepresentation>): number => {
  expect(result.status).toBe("Accepted");
  if (result.status !== "Accepted" || result.renderSelection.kind !== "Band") throw new Error("Expected selected band.");
  return Number(result.renderSelection.bandId.slice(-2));
};

describe("voxel representation SSE and selection", () => {
  it("implements focal length, distance-to-bounds, viewport, and FOV vectors", () => {
    const base = {
      cameraPosition: { x: 0, y: 0, z: 11 }, boundsCenter: { x: 0, y: 0, z: 0 }, boundsRadiusMeters: 1,
      geometricErrorMeters: 2, viewportHeightPixels: 1_000, verticalFovRadians: Math.PI / 2, minimumDistanceMeters: 0.1
    };
    const result = computeScreenSpaceError(base);
    expect(result.focalLengthPixels).toBeCloseTo(500);
    expect(result.distanceToBoundsMeters).toBe(10);
    expect(result.projectedErrorPixels).toBeCloseTo(100);
    expect(computeScreenSpaceError({ ...base, viewportHeightPixels: 2_000 }).projectedErrorPixels).toBeCloseTo(200);
    expect(computeScreenSpaceError({ ...base, verticalFovRadians: Math.PI / 3 }).projectedErrorPixels).toBeGreaterThan(result.projectedErrorPixels);
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(() => computeScreenSpaceError({ ...base, geometricErrorMeters: invalid })).toThrow();
    }
    expect(() => computeScreenSpaceError({ ...base, verticalFovRadians: Number.MIN_VALUE })).toThrow();
    expect(() => computeScreenSpaceError({ ...base, geometricErrorMeters: Number.MAX_VALUE, viewportHeightPixels: Number.MAX_VALUE })).toThrow();
  });

  it("uses the finest ready fallback when no band meets the error boundary", () => {
    expect(selectRepresentation(baseInput(1))).toMatchObject({
      renderSelection: { kind: "Band", bandId: "band.00" },
      decisionReasons: ["FinestReadyFallback"]
    });
  });

  it("is distance-monotone and independent of candidate insertion order", () => {
    const near = selectRepresentation(baseInput(100));
    const far = selectRepresentation(baseInput(1_000));
    expect(selectedRank(far)).toBeGreaterThanOrEqual(selectedRank(near));
    const ordered = selectRepresentation(baseInput(250));
    const reversed = selectRepresentation(baseInput(250, true));
    expect(reversed).toEqual(ordered);
    expect(reversed.decisionHash).toBe(ordered.decisionHash);
  });

  it("holds, refines, and collapses only across explicit hysteresis boundaries", () => {
    const atBoundary = baseInput(125);
    const priorBandId = "band.03";
    const held = selectRepresentation({ ...atBoundary, priorBandId });
    expect(held).toMatchObject({ renderSelection: { bandId: priorBandId }, decisionReasons: ["HysteresisHoldBeforeCollapse"] });
    expect(selectRepresentation({ ...baseInput(100), priorBandId: "band.04" })).toMatchObject({ decisionReasons: ["RefinedAcrossBoundary"] });
    expect(selectRepresentation({ ...baseInput(130), priorBandId })).toMatchObject({ decisionReasons: ["CollapsedAcrossBoundary"] });
    expect(selectRepresentation({ ...atBoundary, priorBandId })).toEqual(held);
  });

  it("rejects malformed and unknown prior band IDs", () => {
    const input = baseInput(125);
    expect(() => selectRepresentation({ ...input, priorBandId: "band.unknown" })).toThrow();
    expect(() => selectRepresentation({ ...input, priorBandId: 7 as never })).toThrow();
  });

  it("derives fallback decisions only from complete revision-current groups", () => {
    const input = baseInput(125);
    const fallbackGroup = {
      groupId: "fallback.group", parentId: "parent", revision: 7,
      requiredChildIds: ["child.a", "child.b"],
      children: [
        { childId: "child.a", revision: 7, readiness: "Ready" as const },
        { childId: "child.b", revision: 7, readiness: "Ready" as const }
      ]
    };
    expect(selectRepresentation({ ...input, fallbackGroup })).toMatchObject({
      fallbackDecision: {
        groupId: "fallback.group", settledCoverage: "Children", parentId: null,
        childIds: ["child.a", "child.b"], reason: "AllRequiredCurrentChildrenReady"
      }
    });
    expect(selectRepresentation({ ...input, fallbackGroup: { ...fallbackGroup, children: fallbackGroup.children.slice(0, 1) } })).toMatchObject({
      fallbackDecision: {
        groupId: "fallback.group", settledCoverage: "Parent", parentId: "parent",
        childIds: [], reason: "ParentRetainedUntilAtomicReplacement"
      }
    });
  });

  it("culls deterministically with its separate distance/projected-bounds thresholds", () => {
    const input = baseInput(1_000_000);
    const thresholds = { ...input.thresholds, cullDistanceMeters: 1_000, cullProjectedBoundsRadiusPixels: 1 };
    const first = selectRepresentation({ ...input, thresholds });
    const second = selectRepresentation({ ...baseInput(1_000_000, true), thresholds });
    expect(first).toMatchObject({ status: "Accepted", renderSelection: { kind: "Culled" }, decisionReasons: ["CullingThresholdsMet"] });
    expect(second).toEqual(first);
  });

  it("separates Low/Ultra render choice from simulation and hard Authority requirements", () => {
    const request = createHardAuthorityRequirement({
      requestId: "request.explosion", reason: "Explosion",
      region: { kind: "sphere", center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) }, radiusQuantum: globalQuantumCoordinate(1) },
      priority: 10
    });
    const input = baseInput(100);
    const common = { ...input, requiredAuthorityRequests: [request] };
    const lowResult = selectRepresentation({ ...common, qualityPolicy: low() });
    const ultraResult = selectRepresentation({ ...common, qualityPolicy: ultra() });
    expect(selectedRank(lowResult)).not.toBe(selectedRank(ultraResult));
    if (lowResult.status !== "Accepted" || ultraResult.status !== "Accepted") throw new Error("Expected accepted decisions.");
    expect(lowResult.simulationRequirements).toEqual(ultraResult.simulationRequirements);
    expect(lowResult.requiredAuthorityRequests).toEqual(ultraResult.requiredAuthorityRequests);
    expect(lowResult.requiredAuthorityRequests[0].targetLevel).toBe(4);
    expect(Object.keys(lowResult)).toEqual(expect.arrayContaining([
      "renderSelection", "simulationRequirements", "requiredAuthorityRequests", "fallbackDecision", "readiness",
      "evictionEligibility", "decisionReasons", "decisionHash"
    ]));
    expect(isDeepFrozen(lowResult)).toBe(true);
  });

  it("validates and preserves soft Adaptive requests in selection", () => {
    const softRequest = (reason: "Inspection" | "PlayerProximity", requestId: string) => ({
      requestId: stableAuthorityId(requestId),
      region: {
        kind: "sphere" as const,
        center: { x: globalQuantumCoordinate(1), y: globalQuantumCoordinate(2), z: globalQuantumCoordinate(3) },
        radiusQuantum: globalQuantumCoordinate(2)
      },
      targetLevel: adaptiveLevel(2),
      reason,
      requiredForCoverage: false,
      deadlinePlanningEpoch: adaptivePlanningEpoch(9),
      priority: 3
    });
    const inspection = softRequest("Inspection", "request.soft.inspection");
    const proximity = softRequest("PlayerProximity", "request.soft.proximity");
    const result = selectRepresentation({
      ...baseInput(100),
      requiredAuthorityRequests: [proximity, inspection]
    });

    expect(result.status).toBe("Accepted");
    expect(result.requiredAuthorityRequests).toEqual([inspection, proximity]);
    expect(result.requiredAuthorityRequests.every((request) => request.targetLevel === adaptiveLevel(2))).toBe(true);
    expect(isDeepFrozen(result.requiredAuthorityRequests)).toBe(true);
    (inspection as { priority: number }).priority = 99;
    expect(result.requiredAuthorityRequests[0].priority).toBe(3);
  });

  it("preserves Adaptive request deadlines in published requirements and decision hashes", () => {
    const requirement = (deadlinePlanningEpoch: number) => createHardAuthorityRequirement({
      requestId: "request.deadline",
      reason: "ProjectileImpact",
      region: {
        kind: "sphere",
        center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
        radiusQuantum: globalQuantumCoordinate(1)
      },
      deadlinePlanningEpoch: adaptivePlanningEpoch(deadlinePlanningEpoch),
      priority: 10
    });
    const earlier = selectRepresentation({ ...baseInput(100), requiredAuthorityRequests: [requirement(7)] });
    const later = selectRepresentation({ ...baseInput(100), requiredAuthorityRequests: [requirement(8)] });

    expect(earlier.status).toBe("Accepted");
    expect(later.status).toBe("Accepted");
    expect(earlier.requiredAuthorityRequests[0].deadlinePlanningEpoch).toBe(7);
    expect(later.requiredAuthorityRequests[0].deadlinePlanningEpoch).toBe(8);
    expect(later.decisionHash).not.toBe(earlier.decisionHash);
    let deadlineError: unknown;
    try {
      selectRepresentation({
        ...baseInput(100),
        requiredAuthorityRequests: [{ ...requirement(7), deadlinePlanningEpoch: Number.NaN as never }]
      });
    } catch (error) {
      deadlineError = error;
    }
    expect(deadlineError).toMatchObject({ path: "selection/requiredAuthorityRequests/0/deadlinePlanningEpoch" });
  });

  it("validates request levels at selection ingress and still raises hard reasons to L4", () => {
    const requirement = createHardAuthorityRequirement({
      requestId: "request.hard-level",
      reason: "ProjectileImpact",
      region: {
        kind: "sphere",
        center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
        radiusQuantum: globalQuantumCoordinate(1)
      },
      priority: 10
    });
    let levelError: unknown;
    try {
      selectRepresentation({
        ...baseInput(100),
        requiredAuthorityRequests: [{ ...requirement, targetLevel: 5 as never }]
      });
    } catch (error) {
      levelError = error;
    }
    expect(levelError).toMatchObject({ path: "selection/requiredAuthorityRequests/0/targetLevel" });

    const accepted = selectRepresentation({
      ...baseInput(100),
      requiredAuthorityRequests: [{ ...requirement, targetLevel: adaptiveLevel(2) }]
    });
    expect(accepted.requiredAuthorityRequests[0].targetLevel).toBe(adaptiveLevel(4));
  });

  it("rejects duplicate Authority request IDs before publication", () => {
    const requirement = createHardAuthorityRequirement({
      requestId: "request.duplicate",
      reason: "ProjectileImpact",
      region: {
        kind: "sphere",
        center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
        radiusQuantum: globalQuantumCoordinate(1)
      },
      priority: 10
    });
    expect(() => selectRepresentation({
      ...baseInput(100),
      requiredAuthorityRequests: [requirement, { ...requirement, priority: 11 }]
    })).toThrow();
  });

  it("applies detail distance only to visual render preference", () => {
    const input = baseInput(100);
    const nearPolicy = createVoxelQualityPolicy({ detail: "Ultra", detailDistanceMeters: 1_000, streamingBudget: "Ultra" });
    const farPolicy = createVoxelQualityPolicy({ detail: "Ultra", detailDistanceMeters: 50, streamingBudget: "Ultra" });
    const nearResult = selectRepresentation({ ...input, qualityPolicy: nearPolicy });
    const farResult = selectRepresentation({ ...input, qualityPolicy: farPolicy });

    expect(selectedRank(farResult)).toBeGreaterThan(selectedRank(nearResult));
    if (nearResult.status !== "Accepted" || farResult.status !== "Accepted") throw new Error("Expected accepted decisions.");
    expect(farResult.simulationRequirements).toEqual(nearResult.simulationRequirements);
    expect(farResult.requiredAuthorityRequests).toEqual(nearResult.requiredAuthorityRequests);
  });

  it("preflights candidate caps and publishes an atomic deeply frozen budget rejection", () => {
    const input = baseInput(100);
    let reads = 0;
    const overCap = Array.from({ length: REPRESENTATION_MAX_SELECTION_CANDIDATES + 1 }, () => input.candidates[0]);
    Object.defineProperty(overCap, "0", { enumerable: true, get: () => { reads += 1; throw new Error("must not read"); } });
    expect(() => selectRepresentation({ ...input, candidates: overCap })).toThrow();
    expect(reads).toBe(0);

    let descriptorReads = 0;
    const descriptor = { ...input.descriptor };
    Object.defineProperty(descriptor, "bands", { enumerable: true, get: () => { descriptorReads += 1; throw new Error("must not read"); } });
    expect(() => selectRepresentation({
      ...input,
      descriptor,
      fallbackGroup: {
        groupId: "fallback.over-cap",
        parentId: "parent",
        revision: 1,
        requiredChildIds: Array.from({ length: REPRESENTATION_MAX_FALLBACK_CHILDREN + 1 }, (_, index) => `child.${index}`),
        children: []
      }
    })).toThrow();
    expect(descriptorReads).toBe(0);

    const expensiveDescriptor = createRepresentationLadderDescriptor({
      schemaVersion: REPRESENTATION_LADDER_SCHEMA_VERSION,
      descriptorId: "selection.expensive-ladder.v2",
      bands: Array.from({ length: 12 }, (_, rank) => ({
        ...makeBand(rank),
        costs: { estimatedBytes: 64_000_001, workUnits: 100, uploadUnits: 10 }
      }))
    });
    const rejected = selectRepresentation({
      ...input,
      descriptor: expensiveDescriptor,
      candidates: expensiveDescriptor.bands.map((band) => ({ bandId: band.bandId, readiness: "Ready" as const, sourceCurrent: true })),
      qualityPolicy: low()
    });
    expect(rejected).toMatchObject({
      status: "Rejected",
      code: "BudgetExceeded",
      renderSelection: null,
      simulationRequirements: [],
      requiredAuthorityRequests: [],
      fallbackDecision: null,
      readiness: [],
      evictionEligibility: null
    });
    expect(isDeepFrozen(rejected)).toBe(true);
  });

  it("binds side-effect-empty rejection hashes to canonical non-render inputs", () => {
    const requirement = (requestId: string, deadlinePlanningEpoch: number, centerX = 0) => createHardAuthorityRequirement({
      requestId,
      reason: "ProjectileImpact",
      region: {
        kind: "sphere",
        center: { x: globalQuantumCoordinate(centerX), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
        radiusQuantum: globalQuantumCoordinate(1)
      },
      deadlinePlanningEpoch: adaptivePlanningEpoch(deadlinePlanningEpoch),
      priority: 10
    });
    const expensiveDescriptor = createRepresentationLadderDescriptor({
      schemaVersion: REPRESENTATION_LADDER_SCHEMA_VERSION,
      descriptorId: "selection.rejected-hash.v2",
      bands: Array.from({ length: 12 }, (_, rank) => ({
        ...makeBand(rank),
        costs: { estimatedBytes: 64_000_001, workUnits: 100, uploadUnits: 10 }
      }))
    });
    const rejectedInput = {
      ...baseInput(100),
      descriptor: expensiveDescriptor,
      candidates: expensiveDescriptor.bands.map((band) => ({ bandId: band.bandId, readiness: "Ready" as const, sourceCurrent: true })),
      qualityPolicy: low()
    } as const;
    const rejected = selectRepresentation(rejectedInput);
    const rejectionHashes = [
      rejected.decisionHash,
      selectRepresentation({ ...rejectedInput, requiredAuthorityRequests: [requirement("request.rejected-hash", 7)] }).decisionHash,
      selectRepresentation({ ...rejectedInput, requiredAuthorityRequests: [requirement("request.rejected-hash", 8)] }).decisionHash,
      selectRepresentation({ ...rejectedInput, requiredAuthorityRequests: [requirement("request.rejected-hash", 7, 1)] }).decisionHash,
      selectRepresentation({ ...rejectedInput, simulationRequirements: ["DifferentSimulationRequirement"] }).decisionHash,
      selectRepresentation({
        ...rejectedInput,
        fallbackGroup: {
          groupId: "fallback.rejected-hash", parentId: "parent", revision: 1,
          requiredChildIds: ["child"], children: [{ childId: "child", revision: 1, readiness: "Ready" as const }]
        }
      }).decisionHash,
      selectRepresentation({ ...rejectedInput, readiness: ["DifferentReadiness"] }).decisionHash,
      selectRepresentation({
        ...rejectedInput,
        evictionEligibility: deriveEvictionEligibility({ structuralState: "Dirty", activePins: [] })
      }).decisionHash
    ];
    expect(new Set(rejectionHashes).size).toBe(rejectionHashes.length);

    const requestA = requirement("request.a", 7);
    const requestB = requirement("request.b", 8, 1);
    const ordered = selectRepresentation({
      ...rejectedInput,
      requiredAuthorityRequests: [requestA, requestB],
      simulationRequirements: ["SimulationA", "SimulationB"],
      readiness: ["ReadinessA", "ReadinessB"]
    });
    const reordered = selectRepresentation({
      ...rejectedInput,
      requiredAuthorityRequests: [requestB, requestA],
      simulationRequirements: ["SimulationB", "SimulationA"],
      readiness: ["ReadinessB", "ReadinessA"]
    });
    expect(reordered.decisionHash).toBe(ordered.decisionHash);

    const noReadyInput = baseInput(100);
    const noReadyEarlier = selectRepresentation({
      ...noReadyInput,
      candidates: noReadyInput.candidates.map((candidate) => ({ ...candidate, readiness: "Loading" as const })),
      requiredAuthorityRequests: [requirement("request.no-ready", 7)]
    });
    const noReadyLater = selectRepresentation({
      ...noReadyInput,
      candidates: noReadyInput.candidates.map((candidate) => ({ ...candidate, readiness: "Loading" as const })),
      requiredAuthorityRequests: [requirement("request.no-ready", 8)]
    });
    expect(noReadyEarlier).toMatchObject({ status: "Rejected", code: "NoReadyCandidate" });
    expect(noReadyLater).toMatchObject({ status: "Rejected", code: "NoReadyCandidate" });
    expect(noReadyLater.decisionHash).not.toBe(noReadyEarlier.decisionHash);
  });
});

describe("voxel representation hard pins, interaction, and lifecycle", () => {
  it("maps every hard reason to Adaptive L4 without forcing render L4", () => {
    for (const reason of HARD_ADAPTIVE_REFINEMENT_REASONS) {
      const request = createHardAuthorityRequirement({
        requestId: `request.${reason}`, reason,
        region: { kind: "sphere", center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) }, radiusQuantum: globalQuantumCoordinate(1) },
        priority: 1
      });
      expect(request.targetLevel).toBe(adaptiveLevel(4));
    }
    expect(selectedRank(selectRepresentation({ ...baseInput(100), qualityPolicy: low() }))).toBe(4);
  });

  it("requires hard L4 AABB requirements to align to target bricks", () => {
    const extent = brickExtentQuantumForLevel(adaptiveLevel(4));
    const requirement = (maxX: number) => createHardAuthorityRequirement({
      requestId: "request.aabb",
      reason: "CollisionRequired",
      region: {
        kind: "aabb",
        bounds: {
          min: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
          max: { x: globalQuantumCoordinate(maxX), y: globalQuantumCoordinate(extent), z: globalQuantumCoordinate(extent) }
        }
      },
      priority: 1
    });

    expect(requirement(extent)).toMatchObject({ targetLevel: 4 });
    expect(() => requirement(1)).toThrow();
  });

  it("rejects unknown hard Authority region kinds instead of treating them as spheres", () => {
    expect(() => createHardAuthorityRequirement({
      requestId: "request.unknown-region",
      reason: "CollisionRequired",
      region: {
        kind: "tile",
        center: { x: globalQuantumCoordinate(0), y: globalQuantumCoordinate(0), z: globalQuantumCoordinate(0) },
        radiusQuantum: globalQuantumCoordinate(1)
      } as never,
      priority: 1
    })).toThrow();
  });

  it("never emits coarse or partial edits when proxy Authority coordinates, coverage, or budget are unavailable", () => {
    const common = { requestId: "request.tool", reason: "ToolInteraction" as const, requiredAuthorityWork: 10, authorityWorkBudget: 10, priority: 5 };
    const missing = resolveProxyInteraction({ ...common, authorityCoordinates: null, hasLevel4Coverage: false });
    const coordinates = { x: globalQuantumCoordinate(4), y: globalQuantumCoordinate(5), z: globalQuantumCoordinate(6) };
    const notReady = resolveProxyInteraction({ ...common, authorityCoordinates: coordinates, hasLevel4Coverage: false });
    const blocked = resolveProxyInteraction({ ...common, authorityCoordinates: coordinates, hasLevel4Coverage: true, requiredAuthorityWork: 11 });
    const ready = resolveProxyInteraction({ ...common, authorityCoordinates: coordinates, hasLevel4Coverage: true });
    expect(missing).toMatchObject({ status: "NOT_READY", authorityCoordinates: null, authorityRequest: null });
    expect(notReady).toMatchObject({ status: "NOT_READY", authorityCoordinates: null, authorityRequest: { targetLevel: 4 } });
    expect(blocked).toMatchObject({ status: "Blocked", authorityCoordinates: null, authorityRequest: { targetLevel: 4 } });
    expect(ready).toMatchObject({ status: "READY", authorityCoordinates: coordinates, authorityRequest: { targetLevel: 4 } });
    for (const result of [missing, notReady, blocked, ready]) {
      expect(result).not.toHaveProperty("edit");
      expect(result).not.toHaveProperty("coarseCoordinates");
    }
    expect(resolveProxyInteraction({
      ...common, authorityCoordinates: coordinates, hasLevel4Coverage: true,
      requiredAuthorityWork: REPRESENTATION_MAX_WORK_UNITS, authorityWorkBudget: REPRESENTATION_MAX_WORK_UNITS
    })).toMatchObject({ status: "READY" });
    expect(() => resolveProxyInteraction({
      ...common, authorityCoordinates: coordinates, hasLevel4Coverage: true,
      requiredAuthorityWork: REPRESENTATION_MAX_WORK_UNITS + 1, authorityWorkBudget: REPRESENTATION_MAX_WORK_UNITS
    })).toThrow();
    expect(() => resolveProxyInteraction({
      ...common, authorityCoordinates: coordinates, hasLevel4Coverage: true,
      authorityWorkBudget: REPRESENTATION_MAX_WORK_UNITS + 1
    })).toThrow();
  });

  it("validates proxy work budgets before returning missing-coordinate retry state", () => {
    const common = {
      requestId: "request.missing-coordinates",
      reason: "ToolInteraction" as const,
      authorityCoordinates: null,
      hasLevel4Coverage: false,
      requiredAuthorityWork: 10,
      authorityWorkBudget: 10,
      priority: 5
    };
    for (const invalid of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, REPRESENTATION_MAX_WORK_UNITS + 1]) {
      expect(() => resolveProxyInteraction({ ...common, requiredAuthorityWork: invalid })).toThrow();
      expect(() => resolveProxyInteraction({ ...common, authorityWorkBudget: invalid })).toThrow();
    }
  });

  it("retains dirty/solving/rigid/unsettled/solve/handoff products and releases only explicit unpinned Settled products", () => {
    expect(deriveEvictionEligibility({ structuralState: "Dirty", activePins: [] }).derivedProductsEvictable).toBe(false);
    expect(deriveEvictionEligibility({ structuralState: "Solving", activePins: [] }).derivedProductsEvictable).toBe(false);
    for (const pin of ["ActiveRigidBody", "UnsettledFragment", "StructuralSolvePending", "PhysicsHandoffPending"] as const) {
      expect(deriveEvictionEligibility({ structuralState: "Settled", activePins: [pin] }).derivedProductsEvictable).toBe(false);
    }
    const settled = deriveEvictionEligibility({ structuralState: "Settled", activePins: [] });
    expect(settled.derivedProductsEvictable).toBe(true);
    expect(settled.retainedSourceBindings).toEqual(["AdaptiveAuthority", "EditJournal", "StructuralAuthority"]);
    expect(() => selectRepresentation({
      ...baseInput(100),
      evictionEligibility: { ...settled, reasons: ["StructuralDirty"] }
    })).toThrow();
  });

  it("rejects active lifecycle pins above the finite cap before reading entries", () => {
    let reads = 0;
    const pins = Array.from({ length: REPRESENTATION_MAX_ACTIVE_PINS + 1 }, () => "ActiveRigidBody" as const);
    Object.defineProperty(pins, "0", { enumerable: true, get: () => { reads += 1; throw new Error("must not read"); } });

    expect(() => deriveEvictionEligibility({ structuralState: "Settled", activePins: pins })).toThrow();
    expect(reads).toBe(0);
  });
});
