import { describe, expect, it } from "vitest";
import {
  createPlanetTileKey,
  createPlanetTileReadinessSnapshot,
  createPlanetTileVisibilityPlan,
  planetTileId,
  type PlanetTileKey,
  type PlanetTileLoadRequest,
  type PlanetTileReadinessState,
  type PlanetTileVisibilityReason
} from "../../src/planet";
import {
  adaptPlanetPresentation,
  planetTileRepresentationKey
} from "../../src/planet/planetPresentationAdapter";
import { resolveVisibility } from "../../src/presentation";

const parent = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 0, x: 0, y: 0 });
const childA = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 1, x: 0, y: 0 });
const childB = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 1, x: 1, y: 0 });

const reason = (tileKey: PlanetTileKey, code: PlanetTileVisibilityReason["code"]): PlanetTileVisibilityReason => ({
  tileId: planetTileId(tileKey),
  code
});

const request = (
  tileKey: PlanetTileKey,
  readinessRevision: number,
  requiredForCoverage: boolean
): PlanetTileLoadRequest => ({
  tileKey,
  reason: requiredForCoverage ? "root-coverage-required" : "requested-child-queued",
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

describe("planet presentation adapter", () => {
  it("flattens only resident accepted-revision primary and core fallback into visible keys", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 12,
      readinessRevision: 4,
      primary: [planetTileId(childA)],
      fallback: [planetTileId(parent)],
      culled: [],
      loadRequests: [],
      reasons: [reason(childA, "primary-max-level"), reason(parent, "fallback-incomplete-child-coverage")],
      coverageStatus: "READY"
    });
    const result = adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(4, [[parent, "render-ready"], [childA, "render-ready"], [childB, "render-ready"]])
    });

    expect(result.visibilityPlan.visibleRepresentationKeys).toEqual([
      planetTileRepresentationKey(planetTileId(parent)),
      planetTileRepresentationKey(planetTileId(childA))
    ].sort());
    expect(result.visibilityPlan.visibleRepresentationKeys).not.toContain(planetTileRepresentationKey(planetTileId(childB)));
    expect(result.visibilityPlan.fallbackRepresentationKeys).toEqual([]);
    expect(result.visibilityPlan.hiddenRepresentationKeys).toEqual([]);
  });

  it("gives requested, nonresident, and stale-revision tiles no visible slot", () => {
    const loadRequest = request(childB, 8, false);
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 13,
      readinessRevision: 8,
      primary: [planetTileId(childA)],
      fallback: [planetTileId(parent)],
      culled: [],
      loadRequests: [loadRequest],
      reasons: [
        reason(childA, "primary-max-level"),
        reason(parent, "fallback-incomplete-child-coverage"),
        reason(childB, "requested-child-queued")
      ],
      coverageStatus: "NOT_READY"
    });

    const accepted = adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(8, [[parent, "render-ready"], [childA, "loading"], [childB, "render-ready"]])
    });
    expect(accepted.visibilityPlan.visibleRepresentationKeys).toEqual([planetTileRepresentationKey(planetTileId(parent))]);
    expect(accepted.visibilityPlan.visibleRepresentationKeys).not.toContain(planetTileRepresentationKey(planetTileId(childB)));

    const stale = adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(9, [[parent, "render-ready"], [childA, "render-ready"], [childB, "render-ready"]])
    });
    expect(stale.visibilityPlan.visibleRepresentationKeys).toEqual([]);
    expect(stale.loadJobs).toHaveLength(1);
  });

  it("translates exactly the explicit load requests in canonical order without visibility inference", () => {
    const mandatory = request(parent, 5, true);
    const optional = request(childB, 5, false);
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 14,
      readinessRevision: 5,
      primary: [planetTileId(parent)],
      fallback: [],
      culled: [],
      loadRequests: [optional, mandatory],
      reasons: [reason(parent, "root-coverage-required"), reason(childB, "requested-child-queued")],
      coverageStatus: "NOT_READY"
    });
    const result = adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(5, [[parent, "queued"], [childA, "render-ready"], [childB, "queued"]])
    });

    expect(result.visibilityPlan.visibleRepresentationKeys).toEqual([]);
    expect(result.loadJobs.map((job) => job.tileId)).toEqual(
      plan.loadRequests.map((entry) => planetTileId(entry.tileKey))
    );
    expect(result.loadJobs).toEqual(plan.loadRequests.map((entry) => ({
      tileId: planetTileId(entry.tileKey),
      tileKey: entry.tileKey,
      reason: entry.reason,
      priority: entry.priority,
      requiredForCoverage: entry.requiredForCoverage,
      expectedReadinessRevision: entry.expectedReadinessRevision
    })));
    expect(result.loadJobs.some((job) => job.tileId === planetTileId(childA))).toBe(false);
  });

  it("keeps all-core-fallback with zero requests hole-free through the existing resolver", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 15,
      readinessRevision: 6,
      primary: [],
      fallback: [planetTileId(parent)],
      culled: [],
      loadRequests: [],
      reasons: [reason(parent, "fallback-incomplete-child-coverage")],
      coverageStatus: "READY"
    });
    const adapted = adaptPlanetPresentation({ corePlan: plan, readiness: readiness(6, [[parent, "render-ready"]]) });
    const key = planetTileRepresentationKey(planetTileId(parent));
    const resolved = resolveVisibility(adapted.visibilityPlan, new Set([key]), new Set([key]));

    expect(adapted.loadJobs).toEqual([]);
    expect(adapted.visibilityPlan.fallbackRepresentationKeys).toEqual([]);
    expect(resolved.visibleRepresentationKeys).toEqual([key]);
    expect(resolved.allRequestedPrimariesReady).toBe(true);
  });

  it("keeps mixed primary/fallback branches hole-free after flattening", () => {
    const plan = createPlanetTileVisibilityPlan({
      selectionRevision: 16,
      readinessRevision: 7,
      primary: [planetTileId(childA)],
      fallback: [planetTileId(parent)],
      culled: [],
      loadRequests: [request(childB, 7, false)],
      reasons: [
        reason(childA, "primary-max-level"),
        reason(parent, "fallback-incomplete-child-coverage"),
        reason(childB, "requested-child-queued")
      ],
      coverageStatus: "READY"
    });
    const adapted = adaptPlanetPresentation({
      corePlan: plan,
      readiness: readiness(7, [[parent, "render-ready"], [childA, "render-ready"], [childB, "queued"]])
    });
    const parentKey = planetTileRepresentationKey(planetTileId(parent));
    const childKey = planetTileRepresentationKey(planetTileId(childA));
    const resident = new Set([parentKey, childKey]);
    const resolved = resolveVisibility(adapted.visibilityPlan, resident, resident);

    expect(resolved.visibleRepresentationKeys).toEqual([parentKey, childKey].sort());
    expect(adapted.visibilityPlan.fallbackRepresentationKeys).toEqual([]);
    expect(resolved.allRequestedPrimariesReady).toBe(true);
  });
});
