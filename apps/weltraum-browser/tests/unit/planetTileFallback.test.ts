import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  planetTileChildren,
  planetTileId,
  selectPlanetTiles,
  type PlanetTileKey,
  type PlanetTileReadinessEntry,
  type PlanetTileReadinessState,
  type PlanetTileSelectorInput,
  type PlanetTileVisibilityPlan
} from "../../src/planet";

const parent: PlanetTileKey = { bodyId: "hestia", face: "+X", level: 0, x: 0, y: 0 };
const parentId = planetTileId(parent);
const children = planetTileChildren(parent);
const childIds = children.map(planetTileId);
const faces = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const;

const readinessEntries = (
  states: readonly PlanetTileReadinessState[]
): PlanetTileReadinessEntry[] => childIds.map((tileId, index) => ({
  tileId,
  state: states[index] ?? "not-requested"
}));

const selectorInput = (
  revision: number,
  entries: readonly PlanetTileReadinessEntry[]
): PlanetTileSelectorInput => {
  const readinessById = new Map<PlanetTileReadinessEntry["tileId"], PlanetTileReadinessEntry>(faces.map((face) => {
    const tileId = planetTileId({ bodyId: "hestia", face, level: 0, x: 0, y: 0 });
    return [tileId, { tileId, state: "render-ready" as const }] as const;
  }));
  for (const entry of entries) readinessById.set(entry.tileId, entry);
  return {
    selectionRevision: revision,
    acceptedReadinessRevision: revision,
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
    maxLevel: 1,
    geometricErrorMeters: [100, 50],
    splitThresholdPixels: 0,
    readiness: { revision, entries: [...readinessById.values()] },
    maxSelectedPrimaryTiles: 100,
    maxRequestedChildren: 100
  };
};

const requestedIds = (plan: PlanetTileVisibilityPlan): readonly string[] =>
  plan.loadRequests.map((request) => planetTileId(request.tileKey));

const acceptedPlan = (input: PlanetTileSelectorInput) => {
  const result = selectPlanetTiles(input);
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error("Expected an accepted selector result.");
  return result.plan;
};

const expectParentFallbackWithoutActiveChildren = (
  entries: readonly PlanetTileReadinessEntry[]
): void => {
  const plan = acceptedPlan(selectorInput(1, entries));
  expect(plan.fallback).toContain(parentId);
  expect(plan.primary.filter((tileId) => childIds.includes(tileId))).toEqual([]);
  expect(plan.fallback.filter((tileId) => childIds.includes(tileId))).toEqual([]);
};

describe("atomic planet tile parent fallback", () => {
  it("keeps the parent for missing, loading, failed, and partially ready child coverage", () => {
    const transitionRows: readonly (readonly PlanetTileReadinessEntry[])[] = [
      [],
      readinessEntries(["loading", "loading", "loading", "loading"]),
      readinessEntries(["failed", "failed", "failed", "failed"]),
      readinessEntries(["render-ready", "render-ready", "render-ready", "loading"])
    ];
    for (const entries of transitionRows) expectParentFallbackWithoutActiveChildren(entries);
  });

  it("keeps ready siblings resident but hidden while one required child is incomplete", () => {
    const plan = acceptedPlan(selectorInput(1, readinessEntries([
      "render-ready",
      "render-ready",
      "render-ready",
      "loading"
    ])));
    for (const tileId of childIds.slice(0, 3)) {
      expect(plan.primary).not.toContain(tileId);
      expect(plan.fallback).not.toContain(tileId);
      expect(requestedIds(plan)).not.toContain(tileId);
      expect(plan.reasons).toContainEqual({ tileId, code: "ready-child-hidden-incomplete-coverage" });
    }
    expect(requestedIds(plan)).toContain(childIds[3]);
    expect(plan.loadRequests.find((request) => planetTileId(request.tileKey) === childIds[3])).toMatchObject({
      requiredForCoverage: false,
      reason: "requested-child-loading",
      expectedReadinessRevision: 1
    });
    expect(plan.coverageStatus).toBe("READY");
  });

  it("atomically hides the parent only when every required child is render-ready", () => {
    const plan = acceptedPlan(selectorInput(2, readinessEntries([
      "render-ready",
      "render-ready",
      "render-ready",
      "render-ready"
    ])));
    expect(plan.primary).toEqual(expect.arrayContaining(childIds));
    expect(plan.primary.filter((tileId) => childIds.includes(tileId))).toHaveLength(4);
    expect(plan.fallback).not.toContain(parentId);
    expect(plan.primary).not.toContain(parentId);
    expect(plan.reasons).toContainEqual({ tileId: parentId, code: "parent-hidden-complete-child-coverage" });
  });

  it("reactivates the parent atomically after a previously active child is evicted", () => {
    const ready = acceptedPlan(selectorInput(3, readinessEntries([
      "render-ready",
      "render-ready",
      "render-ready",
      "render-ready"
    ])));
    expect(ready.fallback).not.toContain(parentId);

    const evictedEntries = readinessEntries([
      "render-ready",
      "render-ready",
      "evicted",
      "render-ready"
    ]);
    const evicted = acceptedPlan(selectorInput(4, evictedEntries));
    expect(evicted.fallback).toContain(parentId);
    expect(evicted.primary.filter((tileId) => childIds.includes(tileId))).toEqual([]);
    expect(requestedIds(evicted)).toContain(childIds[2]);
    expect(evicted.loadRequests.find((request) => planetTileId(request.tileKey) === childIds[2])).toMatchObject({
      requiredForCoverage: false,
      reason: "requested-child-evicted",
      expectedReadinessRevision: 4
    });
    expect(evicted.reasons).toContainEqual({ tileId: childIds[2], code: "requested-child-evicted" });
    expect(evicted.coverageStatus).toBe("READY");
  });

  it("keeps transition output deterministic when child entries are reordered", () => {
    const entries = readinessEntries(["render-ready", "loading", "failed", "evicted"]);
    const forward = acceptedPlan(selectorInput(5, entries));
    const reversed = acceptedPlan(selectorInput(5, [...entries].reverse()));
    expect(reversed).toEqual(forward);
  });

  it("keeps active coverage unchanged for zero, one, and small request budgets", () => {
    const unlimited = acceptedPlan(selectorInput(6, []));
    for (const requestBudget of [0, 1, 3]) {
      const plan = acceptedPlan({
        ...selectorInput(6, []),
        maxRequestedChildren: requestBudget
      });
      expect(plan.primary).toEqual(unlimited.primary);
      expect(plan.fallback).toEqual(unlimited.fallback);
      expect(plan.culled).toEqual(unlimited.culled);
      expect(plan.loadRequests).toEqual(unlimited.loadRequests.slice(0, requestBudget));
      expect(plan.loadRequests).toHaveLength(requestBudget);
      expect(plan.loadRequests.every((request) => !request.requiredForCoverage)).toBe(true);
      expect(plan.primary.length + plan.fallback.length).toBeLessThanOrEqual(
        selectorInput(6, []).maxSelectedPrimaryTiles
      );
      expect(plan.reasons.filter(({ code }) => code === "request-budget-exhausted")).toHaveLength(
        unlimited.loadRequests.length - requestBudget
      );
    }
  });

  it("keeps a non-ready desired parent mandatory when the optional child budget is zero", () => {
    const plan = acceptedPlan({
      ...selectorInput(6, [{ tileId: parentId, state: "evicted" }]),
      maxRequestedChildren: 0
    });

    expect(plan.fallback).toContain(parentId);
    expect(plan.coverageStatus).toBe("NOT_READY");
    expect(plan.loadRequests).toHaveLength(1);
    expect(plan.loadRequests[0]).toMatchObject({
      reason: "root-coverage-required",
      requiredForCoverage: true,
      expectedReadinessRevision: 6
    });
    expect(planetTileId(plan.loadRequests[0].tileKey)).toBe(parentId);
    expect(plan.reasons.filter(({ code }) => code === "request-budget-exhausted")).toHaveLength(24);
  });

  it("does not request children below a branch that the primary frontier cannot admit", () => {
    const plan = acceptedPlan({
      ...selectorInput(7, []),
      maxSelectedPrimaryTiles: 6,
      maxRequestedChildren: 100
    });

    expect(plan.primary).toHaveLength(6);
    expect(plan.fallback).toEqual([]);
    expect(plan.loadRequests).toEqual([]);
    expect(plan.reasons.filter(({ code }) => code === "primary-budget-deferred-refinement")).toHaveLength(6);
    expect(plan.reasons.some(({ code }) => code.startsWith("requested-child-"))).toBe(false);
  });

  it("atomically replaces a parent using only required non-culled children", () => {
    const plan = acceptedPlan({
      ...selectorInput(7, readinessEntries([
        "render-ready",
        "render-ready",
        "render-ready",
        "render-ready"
      ])),
      frustumPlanes: [{ normal: vec3(0, 1, 0), constantMeters: -200 }],
      maxSelectedPrimaryTiles: 6
    });
    const visibleChildren = children
      .filter((child) => child.y === 1)
      .map(planetTileId);
    const culledChildren = children
      .filter((child) => child.y === 0)
      .map(planetTileId);

    expect(plan.primary).toEqual(expect.arrayContaining(visibleChildren));
    expect(plan.primary).not.toContain(parentId);
    expect(plan.fallback).not.toContain(parentId);
    expect(plan.culled).toEqual(expect.arrayContaining(culledChildren));
    expect(plan.primary.filter((tileId) => childIds.includes(tileId))).toHaveLength(2);
    expect(plan.reasons).toContainEqual({ tileId: parentId, code: "parent-hidden-complete-child-coverage" });
    expect(plan.primary.length + plan.fallback.length).toBeLessThanOrEqual(6);
  });

  it("safely hides a retained parent when all four complete child patches conservatively cull", () => {
    const plan = acceptedPlan({
      ...selectorInput(8, readinessEntries([
        "render-ready",
        "render-ready",
        "render-ready",
        "render-ready"
      ])),
      frustumPlanes: [{ normal: vec3(1, 0, 0), constantMeters: -1_500 }],
      maxSelectedPrimaryTiles: 6
    });

    expect(plan.primary).not.toContain(parentId);
    expect(plan.fallback).not.toContain(parentId);
    expect(plan.culled).toEqual(expect.arrayContaining(childIds));
    expect(plan.culled.filter((tileId) => childIds.includes(tileId))).toHaveLength(4);
    expect(plan.reasons).toContainEqual({ tileId: parentId, code: "parent-hidden-complete-child-coverage" });
  });
});
