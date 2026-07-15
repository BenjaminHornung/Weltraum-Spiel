import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  PLANET_TILE_COVERAGE_STATUSES,
  PLANET_TILE_LOAD_REQUEST_REASON_CODES,
  PLANET_TILE_READINESS_STATES,
  PLANET_TILE_VISIBILITY_REASON_CODES,
  PlanetTileReadinessError,
  PlanetTileSelectorError,
  PlanetTileVisibilityPlanError,
  comparePlanetTileSelectionPriority,
  createPlanetTileReadinessSnapshot,
  createPlanetTileVisibilityPlan,
  parsePlanetTileId,
  planetTileChildren,
  planetTileId,
  selectPlanetTiles,
  type PlanetFace,
  type PlanetTileId,
  type PlanetTileKey,
  type PlanetTileReadinessEntry,
  type PlanetTileSelectorInput,
  type PlanetTileSelectionPriority
} from "../../src/planet";

const rootKey = (face: PlanetFace): PlanetTileKey => ({ bodyId: "hestia", face, level: 0, x: 0, y: 0 });
const rootId = (face: PlanetFace): PlanetTileId => planetTileId(rootKey(face));
const childEntries = (
  face: PlanetFace,
  state: PlanetTileReadinessEntry["state"] = "render-ready"
): PlanetTileReadinessEntry[] => planetTileChildren(rootKey(face)).map((key) => ({ tileId: planetTileId(key), state }));

const rootEntries = (
  state: PlanetTileReadinessEntry["state"] = "render-ready"
): PlanetTileReadinessEntry[] => (['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as const)
  .map((face) => ({ tileId: rootId(face), state }));

const descendantEntries = (
  face: PlanetFace,
  maxLevel: number,
  state: PlanetTileReadinessEntry["state"] = "render-ready"
): PlanetTileReadinessEntry[] => {
  const entries: PlanetTileReadinessEntry[] = [];
  let frontier = [rootKey(face)];
  for (let level = 1; level <= maxLevel; level += 1) {
    frontier = frontier.flatMap(planetTileChildren);
    entries.push(...frontier.map((key) => ({ tileId: planetTileId(key), state })));
  }
  return entries;
};

const baseInput = (): PlanetTileSelectorInput => ({
  selectionRevision: 11,
  acceptedReadinessRevision: 7,
  bodyId: "hestia",
  bodyRadiusMeters: 1_000,
  minHeightMeters: 0,
  maxHeightMeters: 0,
  conservativeHeightMarginMeters: 0,
  cameraPosition: vec3(0, 0, 0),
  viewportHeightPixels: 1_000,
  verticalFovRadians: Math.PI / 2,
  nearClampMeters: 1,
  frustumPlanes: [{ normal: vec3(1, 0, 0), constantMeters: 10_000 }],
  maxLevel: 0,
  geometricErrorMeters: 100,
  splitThresholdPixels: Number.MAX_VALUE,
  readiness: { revision: 7, entries: [] },
  maxSelectedPrimaryTiles: 100,
  maxRequestedChildren: 100
});

const priority = (
  tileId: PlanetTileId,
  overrides: Partial<Omit<PlanetTileSelectionPriority, "tileId">> = {}
): PlanetTileSelectionPriority => ({
  tileId,
  coverageObligation: true,
  visible: true,
  ssePixels: 10,
  distanceToBoundMeters: 100,
  ...overrides
});

describe("deterministic planet tile selector", () => {
  it("implements every priority field in the approved order", () => {
    const plusX = rootId("+X");
    const minusX = rootId("-X");
    expect(comparePlanetTileSelectionPriority(
      priority(minusX, { coverageObligation: true, visible: false, ssePixels: 0, distanceToBoundMeters: 1_000 }),
      priority(plusX, { coverageObligation: false, visible: true, ssePixels: 1_000, distanceToBoundMeters: 0 })
    )).toBeLessThan(0);
    expect(comparePlanetTileSelectionPriority(
      priority(minusX, { visible: true, ssePixels: 0, distanceToBoundMeters: 1_000 }),
      priority(plusX, { visible: false, ssePixels: 1_000, distanceToBoundMeters: 0 })
    )).toBeLessThan(0);
    expect(comparePlanetTileSelectionPriority(
      priority(minusX, { ssePixels: 11, distanceToBoundMeters: 1_000 }),
      priority(plusX, { ssePixels: 10, distanceToBoundMeters: 0 })
    )).toBeLessThan(0);
    expect(comparePlanetTileSelectionPriority(
      priority(minusX, { distanceToBoundMeters: 99 }),
      priority(plusX, { distanceToBoundMeters: 100 })
    )).toBeLessThan(0);
    expect(comparePlanetTileSelectionPriority(priority(plusX), priority(minusX))).toBeLessThan(0);
  });

  it.each([0, 1, 5])("rejects visible root coverage when primary budget %i is insufficient", (budget) => {
    const result = selectPlanetTiles({ ...baseInput(), maxSelectedPrimaryTiles: budget });
    expect(result).toEqual({
      status: "rejected",
      reason: "insufficient-primary-budget",
      selectionRevision: 11,
      readinessRevision: 7,
      requiredVisibleRootTiles: 6,
      maxSelectedPrimaryTiles: budget
    });
    expect("plan" in result).toBe(false);
    expect("loadRequests" in result).toBe(false);
  });

  it("emits exhaustive immutable generic root requests and reports unavailable coverage", () => {
    const result = selectPlanetTiles({
      ...baseInput(),
      maxRequestedChildren: 0
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;

    expect(result.plan.primary).toEqual([
      rootId("+X"), rootId("-X"), rootId("+Y"), rootId("-Y"), rootId("+Z"), rootId("-Z")
    ]);
    expect(result.plan.coverageStatus).toBe("NOT_READY");
    expect(result.plan.loadRequests).toHaveLength(6);
    expect(result.plan.loadRequests.every((request) => request.requiredForCoverage)).toBe(true);
    expect(result.plan.loadRequests.every((request) => request.reason === "root-coverage-required")).toBe(true);
    expect(result.plan.loadRequests.every((request) => request.expectedReadinessRevision === 7)).toBe(true);
    expect(result.plan.loadRequests.every((request) => request.priority.coverageObligation)).toBe(true);
    expect(result.plan.loadRequests.map((request) => planetTileId(request.tileKey))).toEqual(result.plan.primary);
    expect(Object.keys(result.plan.loadRequests[0]).sort()).toEqual([
      "expectedReadinessRevision", "priority", "reason", "requiredForCoverage", "tileKey"
    ]);
    expect(Object.isFrozen(result.plan.loadRequests)).toBe(true);
    expect(Object.isFrozen(result.plan.loadRequests[0])).toBe(true);
    expect(Object.isFrozen(result.plan.loadRequests[0].tileKey)).toBe(true);
    expect(Object.isFrozen(result.plan.loadRequests[0].priority)).toBe(true);
    expect("requestedChildren" in result.plan).toBe(false);
  });

  it("keeps all six roots coarse at budget six even when all level-one and level-two descendants are ready", () => {
    const entries = [
      ...rootEntries(),
      ...(["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const)
        .flatMap((face) => descendantEntries(face, 2))
    ];
    const result = selectPlanetTiles({
      ...baseInput(),
      maxLevel: 2,
      geometricErrorMeters: [100, 50, 25],
      splitThresholdPixels: 0,
      readiness: { revision: 7, entries },
      maxSelectedPrimaryTiles: 6
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;

    expect(result.plan.primary).toEqual([
      rootId("+X"), rootId("-X"), rootId("+Y"), rootId("-Y"), rootId("+Z"), rootId("-Z")
    ]);
    expect(result.plan.fallback).toEqual([]);
    expect(result.plan.loadRequests).toEqual([]);
    expect(result.plan.coverageStatus).toBe("READY");
    expect(result.plan.reasons.filter(({ code }) => code === "primary-budget-deferred-refinement")).toHaveLength(6);
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(result.plan.primary)).toBe(true);
  });

  it("admits exactly one deterministic four-child replacement at budget nine", () => {
    const entries = [
      ...rootEntries(),
      ...(["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const).flatMap((face) => childEntries(face))
    ];
    const result = selectPlanetTiles({
      ...baseInput(),
      maxLevel: 1,
      geometricErrorMeters: [100, 50],
      splitThresholdPixels: 0,
      readiness: { revision: 7, entries },
      maxSelectedPrimaryTiles: 9
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;

    expect(result.plan.primary).toHaveLength(9);
    expect(result.plan.primary).toEqual(expect.arrayContaining([
      ...planetTileChildren(rootKey("+X")).map(planetTileId),
      rootId("-X"), rootId("+Y"), rootId("-Y"), rootId("+Z"), rootId("-Z")
    ]));
    expect(result.plan.primary).not.toContain(rootId("+X"));
    expect(result.plan.fallback).toEqual([]);
    expect(result.plan.reasons).toContainEqual({
      tileId: rootId("+X"),
      code: "parent-hidden-complete-child-coverage"
    });
    expect(result.plan.reasons.filter(({ code }) => code === "primary-budget-deferred-refinement")).toHaveLength(5);
  });

  it("does not descend an all-ready depth-two tree after the active frontier fills", () => {
    const entries = [
      ...rootEntries(),
      ...(["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const)
        .flatMap((face) => descendantEntries(face, 2))
    ];
    const result = selectPlanetTiles({
      ...baseInput(),
      maxLevel: 2,
      geometricErrorMeters: [100, 50, 25],
      splitThresholdPixels: 0,
      readiness: { revision: 7, entries },
      maxSelectedPrimaryTiles: 9
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;

    expect(result.plan.primary).toHaveLength(9);
    expect(result.plan.primary.every((tileId) => parsePlanetTileId(tileId).level <= 1)).toBe(true);
    expect(result.plan.primary.some((tileId) => parsePlanetTileId(tileId).level === 2)).toBe(false);
    expect(result.plan.fallback).toEqual([]);
    expect(result.plan.loadRequests).toEqual([]);
  });

  it("enforces the requested-child budget globally with canonical tie ordering", () => {
    const result = selectPlanetTiles({
      ...baseInput(),
      maxLevel: 1,
      splitThresholdPixels: 0,
      maxRequestedChildren: 3
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;

    const expected = planetTileChildren(rootKey("+X"))
      .map(planetTileId)
      .sort((left, right) => {
        const order = new Map([["0:0", 0], ["0:1", 1], ["1:0", 2], ["1:1", 3]]);
        const leftParts = left.split(":");
        const rightParts = right.split(":");
        return (order.get(`${leftParts[5]}:${leftParts[6]}`) ?? 0) -
          (order.get(`${rightParts[5]}:${rightParts[6]}`) ?? 0);
      })
      .slice(0, 3);
    expect(result.plan.primary).toEqual([]);
    expect(result.plan.fallback).toHaveLength(6);
    const mandatory = result.plan.loadRequests.filter((request) => request.requiredForCoverage);
    const optional = result.plan.loadRequests.filter((request) => !request.requiredForCoverage);
    expect(mandatory.map((request) => planetTileId(request.tileKey))).toEqual(result.plan.fallback);
    expect(mandatory).toHaveLength(6);
    expect(optional.map((request) => planetTileId(request.tileKey))).toEqual(expected);
    expect(optional).toHaveLength(3);
    expect(result.plan.coverageStatus).toBe("NOT_READY");
    expect(result.plan.reasons.filter(({ code }) => code === "request-budget-exhausted")).toHaveLength(21);
  });

  it("is deep-equal for reordered readiness entries", () => {
    const entries = [
      ...childEntries("+X"),
      ...childEntries("-X", "loading"),
      ...childEntries("+Y", "failed")
    ];
    const input = {
      ...baseInput(),
      maxLevel: 1,
      splitThresholdPixels: 0,
      readiness: { revision: 7, entries }
    };
    const forward = selectPlanetTiles(input);
    const reverse = selectPlanetTiles({
      ...input,
      readiness: { revision: 7, entries: [...entries].reverse() }
    });
    expect(reverse).toEqual(forward);
    if (forward.status !== "accepted") return;
    const ids = forward.plan.loadRequests.map((request) => planetTileId(request.tileKey));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("deduplicates coverage over optional intent and orders equal priority by reason then tile ID", () => {
    const plusX = rootKey("+X");
    const minusX = rootKey("-X");
    const plusY = rootKey("+Y");
    const request = (
      tileKey: PlanetTileKey,
      requestReason: "root-coverage-required" | "requested-child-failed" | "requested-child-loading",
      requiredForCoverage: boolean
    ) => ({
      tileKey,
      reason: requestReason,
      priority: {
        coverageObligation: requiredForCoverage,
        visible: true,
        ssePixels: 10,
        distanceToBoundMeters: 100,
        tileId: planetTileId(tileKey)
      },
      requiredForCoverage,
      expectedReadinessRevision: 7
    });
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 1,
      readinessRevision: 7,
      primary: [rootId("+X")],
      fallback: [],
      culled: [],
      loadRequests: [
        request(plusY, "requested-child-loading", false),
        request(plusX, "requested-child-failed", false),
        request(minusX, "requested-child-failed", false),
        request(plusX, "root-coverage-required", true)
      ],
      reasons: [
        { tileId: rootId("+X"), code: "primary-at-or-below-split-threshold" },
        { tileId: rootId("+X"), code: "root-coverage-required" },
        { tileId: rootId("-X"), code: "requested-child-failed" },
        { tileId: rootId("+Y"), code: "requested-child-loading" }
      ],
      coverageStatus: "NOT_READY"
    });

    expect(plan.loadRequests).toHaveLength(3);
    expect(plan.loadRequests[0]).toMatchObject({
      requiredForCoverage: true,
      reason: "root-coverage-required"
    });
    expect(plan.loadRequests.slice(1).map((entry) => [entry.reason, planetTileId(entry.tileKey)])).toEqual([
      ["requested-child-failed", rootId("-X")],
      ["requested-child-loading", rootId("+Y")]
    ]);
  });

  it("transitions coverage status with accepted-revision root readiness and eviction", () => {
    const ready = selectPlanetTiles({
      ...baseInput(),
      readiness: { revision: 7, entries: rootEntries() },
      maxRequestedChildren: 0
    });
    expect(ready.status).toBe("accepted");
    if (ready.status !== "accepted") return;
    expect(ready.plan.coverageStatus).toBe("READY");
    expect(ready.plan.loadRequests).toEqual([]);

    const evicted = selectPlanetTiles({
      ...baseInput(),
      readiness: {
        revision: 7,
        entries: rootEntries().map((entry) => entry.tileId === rootId("+X")
          ? { ...entry, state: "evicted" as const }
          : entry)
      },
      maxRequestedChildren: 0
    });
    expect(evicted.status).toBe("accepted");
    if (evicted.status !== "accepted") return;
    expect(evicted.plan.coverageStatus).toBe("NOT_READY");
    expect(evicted.plan.loadRequests).toHaveLength(1);
    expect(evicted.plan.loadRequests[0]).toMatchObject({
      reason: "root-coverage-required",
      requiredForCoverage: true,
      expectedReadinessRevision: 7
    });
  });

  it("rejects a mismatched readiness revision before traversal and returns no partial plan", () => {
    const result = selectPlanetTiles({
      ...baseInput(),
      bodyRadiusMeters: Number.NaN,
      acceptedReadinessRevision: 8
    });
    expect(result).toEqual({
      status: "rejected",
      reason: "readiness-revision-mismatch",
      selectionRevision: 11,
      acceptedReadinessRevision: 8,
      readinessRevision: 7
    });
    expect("plan" in result).toBe(false);
    expect("loadRequests" in result).toBe(false);
  });

  it("reports conservative culling with explicit reasons", () => {
    const result = selectPlanetTiles({ ...baseInput(), cameraPosition: vec3(3_000, 0, 0) });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.plan.culled).toContain(rootId("-X"));
    expect(result.plan.reasons).toContainEqual({ tileId: rootId("-X"), code: "culled-horizon" });
  });

  it("uses typed finite validation for readiness, budgets, and per-level errors", () => {
    expect(() => createPlanetTileReadinessSnapshot({ revision: Number.NaN, entries: [] })).toThrowError(
      PlanetTileReadinessError
    );
    const duplicate = childEntries("+X")[0];
    expect(() => createPlanetTileReadinessSnapshot({ revision: 1, entries: [duplicate, duplicate] })).toThrowError(
      PlanetTileReadinessError
    );
    expect(() => selectPlanetTiles({ ...baseInput(), maxSelectedPrimaryTiles: Number.POSITIVE_INFINITY })).toThrowError(
      PlanetTileSelectorError
    );
    expect(() => selectPlanetTiles({
      ...baseInput(),
      maxLevel: 1,
      geometricErrorMeters: [100, Number.NaN]
    })).toThrowError(PlanetTileSelectorError);

    const sparseReadiness = new Array<PlanetTileReadinessEntry>(1);
    expect(() => createPlanetTileReadinessSnapshot({ revision: 1, entries: sparseReadiness })).toThrowError(
      expect.objectContaining({ code: "INVALID_READINESS_ENTRY" })
    );

    const sparseUsedError = new Array<number>(1);
    expect(() => selectPlanetTiles({
      ...baseInput(),
      geometricErrorMeters: sparseUsedError
    })).toThrowError(expect.objectContaining({ code: "INVALID_GEOMETRIC_ERROR" }));

    const sparseUnusedError = [100, 50] as number[];
    sparseUnusedError.length = 3;
    expect(() => selectPlanetTiles({
      ...baseInput(),
      maxLevel: 2,
      geometricErrorMeters: sparseUnusedError,
      splitThresholdPixels: Number.MAX_VALUE
    })).toThrowError(expect.objectContaining({ code: "INVALID_GEOMETRIC_ERROR" }));
  });

  it("freezes exported validation authorities and still rejects bogus values", () => {
    expect(Object.isFrozen(PLANET_TILE_READINESS_STATES)).toBe(true);
    expect(Object.isFrozen(PLANET_TILE_VISIBILITY_REASON_CODES)).toBe(true);
    expect(Object.isFrozen(PLANET_TILE_LOAD_REQUEST_REASON_CODES)).toBe(true);
    expect(Object.isFrozen(PLANET_TILE_COVERAGE_STATUSES)).toBe(true);
    expect(() => (PLANET_TILE_READINESS_STATES as unknown as string[]).push("bogus")).toThrow(TypeError);
    expect(() => (PLANET_TILE_VISIBILITY_REASON_CODES as unknown as string[]).push("bogus")).toThrow(TypeError);
    expect(() => (PLANET_TILE_LOAD_REQUEST_REASON_CODES as unknown as string[]).push("bogus")).toThrow(TypeError);
    expect(() => (PLANET_TILE_COVERAGE_STATUSES as unknown as string[]).push("bogus")).toThrow(TypeError);

    expect(() => createPlanetTileReadinessSnapshot({
      revision: 1,
      entries: [{ tileId: rootId("+X"), state: "bogus" as never }]
    })).toThrowError(expect.objectContaining({ code: "INVALID_READINESS_STATE" }));
    expect(() => createPlanetTileVisibilityPlan({
      selectionRevision: 1,
      readinessRevision: 1,
      primary: [],
      fallback: [],
      culled: [],
      loadRequests: [],
      reasons: [{ tileId: rootId("+X"), code: "bogus" as never }],
      coverageStatus: "READY"
    })).toThrowError(PlanetTileVisibilityPlanError);
    expect(() => createPlanetTileVisibilityPlan({
      selectionRevision: 1,
      readinessRevision: 1,
      primary: [],
      fallback: [],
      culled: [],
      loadRequests: [{
        tileKey: rootKey("+X"),
        reason: "bogus" as never,
        priority: priority(rootId("+X")),
        requiredForCoverage: true,
        expectedReadinessRevision: 1
      }],
      reasons: [{ tileId: rootId("+X"), code: "root-coverage-required" }],
      coverageStatus: "READY"
    })).toThrowError(expect.objectContaining({ code: "INVALID_LOAD_REQUEST" }));
    expect(() => createPlanetTileVisibilityPlan({
      selectionRevision: 1,
      readinessRevision: 1,
      primary: [],
      fallback: [],
      culled: [],
      loadRequests: [],
      reasons: [],
      coverageStatus: "bogus" as never
    })).toThrowError(expect.objectContaining({ code: "INVALID_COVERAGE_STATUS" }));
  });
});
