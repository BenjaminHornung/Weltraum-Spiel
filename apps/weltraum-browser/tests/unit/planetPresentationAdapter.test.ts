import { describe, expect, it } from "vitest";
import {
  createPlanetTileKey,
  createPlanetTileReadinessSnapshot,
  createPlanetTileVisibilityPlan,
  planetTileId,
  type PlanetTileKey,
  type PlanetTileLoadRequest,
  type PlanetTileReadinessState,
  type PlanetTileVisibilityPlan,
  type PlanetTileVisibilityReason
} from "../../src/planet";
import {
  PLANET_PRESENTATION_HOLD_REASON_CODES,
  adaptPlanetPresentation,
  planetTileRepresentationKey,
  type PlanetPresentationAdapterResult,
  type PlanetPresentationHoldResult,
  type PlanetPresentationPublishResult
} from "../../src/planet/planetPresentationAdapter";
import { resolveVisibility } from "../../src/presentation";

const rootA = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 0, x: 0, y: 0 });
const rootB = createPlanetTileKey({ bodyId: "hestia", face: "-X", level: 0, x: 0, y: 0 });
const childA = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 1, x: 0, y: 0 });
const childB = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 1, x: 1, y: 0 });

const reason = (tileKey: PlanetTileKey, code: PlanetTileVisibilityReason["code"]): PlanetTileVisibilityReason => ({
  tileId: planetTileId(tileKey),
  code
});

const request = (
  tileKey: PlanetTileKey,
  readinessRevision: number,
  requiredForCoverage: boolean,
  requestReason: PlanetTileLoadRequest["reason"] = requiredForCoverage
    ? "root-coverage-required"
    : "requested-child-queued"
): PlanetTileLoadRequest => ({
  tileKey,
  reason: requestReason,
  priority: {
    coverageObligation: requiredForCoverage,
    visible: true,
    ssePixels: requiredForCoverage ? 1000 : 100,
    distanceToBoundMeters: requiredForCoverage ? 0 : 10,
    tileId: planetTileId(tileKey)
  },
  requiredForCoverage,
  expectedReadinessRevision: readinessRevision
});

const readiness = (
  revision: number,
  entries: readonly (readonly [PlanetTileKey, PlanetTileReadinessState])[]
) => createPlanetTileReadinessSnapshot({
  revision,
  entries: entries.map(([tileKey, state]) => ({ tileId: planetTileId(tileKey), state }))
});

const expectedLoadJobs = (requests: readonly PlanetTileLoadRequest[]) => requests.map((entry) => ({
  tileId: planetTileId(entry.tileKey),
  tileKey: entry.tileKey,
  reason: entry.reason,
  priority: entry.priority,
  requiredForCoverage: entry.requiredForCoverage,
  expectedReadinessRevision: entry.expectedReadinessRevision
}));

const expectHold = (result: PlanetPresentationAdapterResult): PlanetPresentationHoldResult => {
  expect(result.status).toBe("hold-last-complete-plan");
  if (result.status !== "hold-last-complete-plan") {
    throw new Error("Expected the adapter to hold the caller's last complete plan.");
  }
  expect("visibilityPlan" in result).toBe(false);
  return result;
};

const expectPublish = (result: PlanetPresentationAdapterResult): PlanetPresentationPublishResult => {
  expect(result.status).toBe("publish");
  if (result.status !== "publish") {
    throw new Error(`Expected a complete publication, received ${result.reasonCode}.`);
  }
  return result;
};

describe("planet presentation adapter", () => {
  it("exports a frozen closed hold-reason contract", () => {
    expect(PLANET_PRESENTATION_HOLD_REASON_CODES).toEqual([
      "readiness-revision-mismatch",
      "coverage-not-ready",
      "active-tile-not-render-ready"
    ]);
    expect(Object.isFrozen(PLANET_PRESENTATION_HOLD_REASON_CODES)).toBe(true);
  });

  it("holds when an active root is missing while retaining its mandatory load job", () => {
    const mandatory = request(rootA, 4, true);
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 12,
      readinessRevision: 4,
      primary: [planetTileId(rootA), planetTileId(rootB)],
      fallback: [],
      culled: [],
      loadRequests: [mandatory],
      reasons: [reason(rootA, "root-coverage-required"), reason(rootB, "primary-max-level")],
      coverageStatus: "NOT_READY"
    });

    const held = expectHold(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(4, [[rootB, "render-ready"]])
    }));

    expect(held.reasonCode).toBe("coverage-not-ready");
    expect(held.missingActiveTileKeys).toEqual([planetTileId(rootA)]);
    expect(held.loadJobs).toEqual(expectedLoadJobs(plan.loadRequests));
  });

  it("gives revision mismatch precedence, reports every active key, and retains exact jobs", () => {
    const optional = request(childB, 8, false);
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 13,
      readinessRevision: 8,
      primary: [planetTileId(rootB)],
      fallback: [planetTileId(rootA)],
      culled: [],
      loadRequests: [optional],
      reasons: [
        reason(rootA, "fallback-incomplete-child-coverage"),
        reason(rootB, "primary-max-level"),
        reason(childB, "requested-child-queued")
      ],
      coverageStatus: "NOT_READY"
    });

    const held = expectHold(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(9, [[rootA, "render-ready"], [rootB, "render-ready"], [childB, "render-ready"]])
    }));

    expect(held.reasonCode).toBe("readiness-revision-mismatch");
    expect(held.missingActiveTileKeys).toEqual([planetTileId(rootA), planetTileId(rootB)]);
    expect(held.loadJobs).toEqual(expectedLoadJobs(plan.loadRequests));
  });

  it("holds without partial visibility when a non-root active primary is missing", () => {
    const mandatory = request(childA, 5, true, "requested-child-not-requested");
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 14,
      readinessRevision: 5,
      primary: [planetTileId(childA), planetTileId(rootB)],
      fallback: [],
      culled: [],
      loadRequests: [mandatory],
      reasons: [reason(childA, "requested-child-not-requested"), reason(rootB, "primary-max-level")],
      coverageStatus: "NOT_READY"
    });

    const held = expectHold(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(5, [[rootB, "render-ready"]])
    }));

    expect(held.reasonCode).toBe("coverage-not-ready");
    expect(held.missingActiveTileKeys).toEqual([planetTileId(childA)]);
    expect(held.loadJobs).toEqual(expectedLoadJobs(plan.loadRequests));
  });

  it("holds a NOT_READY declaration even when all supplied active entries are ready", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 15,
      readinessRevision: 6,
      primary: [planetTileId(rootA)],
      fallback: [],
      culled: [],
      loadRequests: [],
      reasons: [reason(rootA, "primary-max-level")],
      coverageStatus: "NOT_READY"
    });

    const held = expectHold(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(6, [[rootA, "render-ready"]])
    }));

    expect(held.reasonCode).toBe("coverage-not-ready");
    expect(held.missingActiveTileKeys).toEqual([]);
    expect(held.loadJobs).toEqual([]);
  });

  it("publishes complete all-fallback coverage with empty presentation fallback slots", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 16,
      readinessRevision: 7,
      primary: [],
      fallback: [planetTileId(rootA), planetTileId(rootB)],
      culled: [],
      loadRequests: [],
      reasons: [
        reason(rootA, "fallback-incomplete-child-coverage"),
        reason(rootB, "fallback-incomplete-child-coverage")
      ],
      coverageStatus: "READY"
    });
    const published = expectPublish(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(7, [[rootA, "render-ready"], [rootB, "render-ready"]])
    }));
    const visibleKeys = [rootA, rootB]
      .map((tileKey) => planetTileRepresentationKey(planetTileId(tileKey)))
      .sort();
    const resolved = resolveVisibility(published.visibilityPlan, new Set(visibleKeys), new Set(visibleKeys));

    expect(published.visibilityPlan.visibleRepresentationKeys).toEqual(visibleKeys);
    expect(published.visibilityPlan.fallbackRepresentationKeys).toEqual([]);
    expect(published.visibilityPlan.hiddenRepresentationKeys).toEqual([]);
    expect(resolved.visibleRepresentationKeys).toEqual(visibleKeys);
    expect(resolved.allRequestedPrimariesReady).toBe(true);
  });

  it("publishes every complete mixed primary and fallback key while preserving exact jobs", () => {
    const optional = request(childB, 8, false);
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 17,
      readinessRevision: 8,
      primary: [planetTileId(childA), planetTileId(rootB)],
      fallback: [planetTileId(rootA)],
      culled: [],
      loadRequests: [optional],
      reasons: [
        reason(childA, "primary-max-level"),
        reason(rootA, "fallback-incomplete-child-coverage"),
        reason(rootB, "primary-max-level"),
        reason(childB, "requested-child-queued")
      ],
      coverageStatus: "READY"
    });
    const published = expectPublish(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(8, [
        [rootA, "render-ready"],
        [rootB, "render-ready"],
        [childA, "render-ready"],
        [childB, "queued"]
      ])
    }));
    const visibleKeys = [rootA, rootB, childA]
      .map((tileKey) => planetTileRepresentationKey(planetTileId(tileKey)))
      .sort();

    expect(published.visibilityPlan.visibleRepresentationKeys).toEqual(visibleKeys);
    expect(published.visibilityPlan.fallbackRepresentationKeys).toEqual([]);
    expect(published.loadJobs).toEqual(expectedLoadJobs(plan.loadRequests));
  });

  it("fails closed when READY is inconsistent with an active readiness entry", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 18,
      readinessRevision: 9,
      primary: [planetTileId(childA)],
      fallback: [planetTileId(rootA)],
      culled: [],
      loadRequests: [],
      reasons: [reason(childA, "primary-max-level"), reason(rootA, "fallback-incomplete-child-coverage")],
      coverageStatus: "READY"
    });

    const held = expectHold(adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(9, [[rootA, "render-ready"]])
    }));

    expect(held.reasonCode).toBe("active-tile-not-render-ready");
    expect(held.missingActiveTileKeys).toEqual([planetTileId(childA)]);
    expect(held.loadJobs).toEqual([]);
  });

  it("publishes a duplicate active key exactly once", () => {
    const canonicalPlan = createPlanetTileVisibilityPlan({
      selectionRevision: 19,
      readinessRevision: 10,
      primary: [planetTileId(rootA)],
      fallback: [],
      culled: [],
      loadRequests: [],
      reasons: [reason(rootA, "primary-max-level")],
      coverageStatus: "READY"
    });
    const duplicatePlan: PlanetTileVisibilityPlan = Object.freeze({
      ...canonicalPlan,
      primary: Object.freeze([planetTileId(rootA), planetTileId(rootA)]),
      fallback: Object.freeze([planetTileId(rootA)])
    });

    const published = expectPublish(adaptPlanetPresentation({
      corePlan: duplicatePlan,
      readiness: readiness(10, [[rootA, "render-ready"]])
    }));

    expect(published.visibilityPlan.visibleRepresentationKeys).toEqual([
      planetTileRepresentationKey(planetTileId(rootA))
    ]);
  });
});
