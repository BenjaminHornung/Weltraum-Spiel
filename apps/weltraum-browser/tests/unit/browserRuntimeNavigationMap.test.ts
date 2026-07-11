import { describe, expect, it } from "vitest";
import { quaternionFromAxisAngle } from "../../src/flight/flightController";
import { vec3 } from "../../src/core/vector";
import {
  browserObstacles,
  browserTargetCatalog,
  createBrowserRuntime,
  createInitialShip
} from "../../src/runtime/browserRuntime";
import { provingGroundTargets } from "../../src/world/provingGroundWorld";

describe("browser runtime navigation map", () => {
  it("always emits absolute runtime ship, target, route, obstacle, and resident world snapshots", () => {
    const { controller } = createBrowserRuntime();
    const telemetry = controller.getTelemetry();
    const map = telemetry.navigationMap;

    expect(map).toBeDefined();
    expect(map?.absoluteFrameId).toBe("absolute-system");
    expect(map?.ship.absolutePosition.value).toEqual(telemetry.ship.position);
    expect(map?.targets.map((target) => target.id)).toEqual(
      [...browserTargetCatalog].map((target) => target.id).sort()
    );
    expect(map?.selectedTargetId).toBe(telemetry.selectedTarget?.id);
    expect(map?.route?.id).toBe(telemetry.routePreview?.plan?.id);
    expect(map?.route?.segments.map((segment) => segment.id)).toEqual(
      telemetry.routePreview?.plan?.segments.map((segment) => segment.id)
    );
    expect(map?.obstacles.map((obstacle) => obstacle.id)).toEqual(
      [...browserObstacles].map((obstacle) => obstacle.id).sort()
    );
    expect(map?.entities.length).toBeGreaterThan(0);
    expect(map?.entities.every((entity) => entity.residence === "Full" || entity.residence === "Snapshot")).toBe(true);
  });

  it("keeps identical world input deterministic and follows live ship movement", () => {
    const { controller } = createBrowserRuntime();
    const first = controller.getTelemetry().navigationMap;
    const repeated = controller.getTelemetry().navigationMap;

    expect(first).toEqual(repeated);
    const moved = controller.disturbShip(7).navigationMap;
    expect(moved?.ship.absolutePosition.value.x).toBeCloseTo((first?.ship.absolutePosition.value.x ?? 0) + 7, 8);
    expect(moved?.signature).not.toBe(first?.signature);
  });

  it("preserves runtime orientation and exact target selection in the map snapshot", () => {
    const orientation = quaternionFromAxisAngle(vec3(0, 1, 0), -Math.PI / 2);
    const { controller } = createBrowserRuntime({
      initialShip: { ...createInitialShip(), orientation }
    });

    const mapOrientation = controller.getTelemetry().navigationMap?.ship.orientation;
    expect(mapOrientation?.x).toBe(0);
    expect(mapOrientation?.y).toBeCloseTo(orientation.y, 12);
    expect(mapOrientation?.z).toBe(0);
    expect(mapOrientation?.w).toBeCloseTo(orientation.w, 12);
    const selected = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: provingGroundTargets.navigationBeta.id
    });
    expect(selected.success).toBe(true);
    expect(selected.telemetry.navigationMap?.selectedTargetId).toBe(provingGroundTargets.navigationBeta.id);
    expect(selected.telemetry.navigationMap?.route?.targetId).toBe(provingGroundTargets.navigationBeta.id);
  });

  it("uses the locked RoutePlan without silently replanning the map", () => {
    const { controller } = createBrowserRuntime();
    const preview = controller.getTelemetry().routePreview?.plan;
    expect(preview).toBeDefined();

    const engaged = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: preview?.planHash
    });
    expect(engaged.success).toBe(true);
    expect(engaged.telemetry.navigationMap?.route?.id).toBe(engaged.telemetry.lockedPlan?.id);
    expect(engaged.telemetry.navigationMap?.route?.segments.map((segment) => segment.id)).toEqual(
      engaged.telemetry.lockedPlan?.segments.map((segment) => segment.id)
    );
  });
});
