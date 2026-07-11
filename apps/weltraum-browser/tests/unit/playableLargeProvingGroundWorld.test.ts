import { describe, expect, it } from "vitest";
import { distance, vec3 } from "../../src/core";
import { browserObstacles, browserTargetCatalog, createBrowserRuntime } from "../../src/runtime/browserRuntime";
import {
  createProvingGroundLowPolyRenderBatch,
  playableLargeFieldObstacles,
  playableLargeFieldRuntimeObstacles,
  playableLargeFieldTargets,
  playableLargeFieldVisualLandmarks
} from "../../src/world/provingGroundWorld";

const targetDistance = (target: { readonly position: { readonly x: number; readonly y: number; readonly z: number } }): number =>
  distance(vec3(0, 0, 0), target.position);

const targetIds = ["range-500m", "range-1000m", "range-2500m"] as const;

describe("playable large proving-ground world", () => {
  it("declares selectable 500m, 1000m, and 2500m playable targets", () => {
    const targets = Object.values(playableLargeFieldTargets);

    expect(targets.map((target) => target.id)).toEqual(targetIds);
    expect(targetDistance(playableLargeFieldTargets.range500)).toBeCloseTo(500, 4);
    expect(targetDistance(playableLargeFieldTargets.range1000)).toBeCloseTo(1_000, 4);
    expect(targetDistance(playableLargeFieldTargets.range2500)).toBeCloseTo(2_500, 4);
    expect(targets.every((target) => target.arrivalEnvelope.stopBehavior === "StopWithinEnvelope")).toBe(true);
    expect(targets.every((target) => target.arrivalEnvelope.terminalSpeed === 0.5)).toBe(true);
  });

  it("exposes the large targets through the normal browser runtime catalog", () => {
    const ids = browserTargetCatalog.map((target) => target.id);
    const { controller } = createBrowserRuntime();

    expect(ids).toEqual(expect.arrayContaining([...targetIds]));
    expect(new Set(ids).size).toBe(ids.length);

    for (const targetId of targetIds) {
      const result = controller.dispatchCommand({ type: "SelectTarget", targetId });
      const telemetry = result.telemetry;

      expect(result.success).toBe(true);
      expect(result.code).toBe("TargetSelected");
      expect(telemetry.selectedTarget?.id).toBe(targetId);
      expect(telemetry.selectableTargets?.map((target) => target.id)).toEqual(expect.arrayContaining([...targetIds]));
      expect(telemetry.routePreview?.state).toBe("Ready");
      expect(telemetry.routePreview?.plan?.target.id).toBe(targetId);
      expect(telemetry.routePreview?.plan?.score.distance ?? 0).toBeGreaterThanOrEqual(targetId === "range-500m" ? 500 : targetId === "range-1000m" ? 1_000 : 2_500);
    }
  });

  it("keeps large runtime obstacles separate from visual-only landmarks", () => {
    const runtimeObstacleIds = new Set(playableLargeFieldRuntimeObstacles.map((obstacle) => obstacle.id));
    const visualLandmarkIds = new Set(playableLargeFieldVisualLandmarks.map((landmark) => landmark.id));
    const overlappingIds = [...runtimeObstacleIds].filter((id) => visualLandmarkIds.has(id));
    const renderBatch = createProvingGroundLowPolyRenderBatch();

    expect(playableLargeFieldObstacles.map((obstacle) => obstacle.id)).toEqual(expect.arrayContaining([
      "playable-single-rock-500m",
      "playable-corridor-upper-1000m",
      "playable-corridor-lower-1000m",
      "playable-corridor-center-1000m"
    ]));
    expect(browserObstacles.map((obstacle) => obstacle.id)).toEqual(expect.arrayContaining([...runtimeObstacleIds]));
    expect(overlappingIds).toEqual([]);
    expect(playableLargeFieldVisualLandmarks.length).toBeGreaterThanOrEqual(6);
    expect(playableLargeFieldVisualLandmarks.every((landmark) => landmark.renderBatchKey === "low-poly-asteroid")).toBe(true);
    expect(playableLargeFieldVisualLandmarks.every((landmark) => !("center" in landmark) && !("radius" in landmark))).toBe(true);
    expect(renderBatch.renderOnly).toBe(true);
    expect(renderBatch.rendererOwnsWorldTruth).toBe(false);
  });

  it("does not duplicate target IDs across the full runtime catalog", () => {
    const ids = browserTargetCatalog.map((target) => target.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
