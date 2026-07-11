import { describe, expect, it } from "vitest";
import { quaternionFromAxisAngle } from "../../src/flight/flightController";
import { vec3 } from "../../src/core/vector";
import type { RoutePlan } from "../../src/core/types";
import {
  DEFAULT_ACTIVE_SHIP_PRESENTATION,
  createNavigationMapSnapshot,
  navigationMapObstacleSnapshot,
  navigationMapOrientation,
  navigationMapRouteSnapshot,
  navigationMapShipSnapshot,
  navigationMapTargetSnapshot,
  navigationMapViewportState,
  projectNavigationMapPosition,
  serializeNavigationMapSnapshot
} from "../../src/navigation/map";
import { absoluteVelocity, createLocalPhysicsFrame, worldCoordinate } from "../../src/world/frames";
import type { WorldEntityState } from "../../src/world/floatingOrigin";
import { provingGroundAsteroidField } from "../../src/world/provingGroundWorld";
import {
  createNavigationMapWorldAdapter,
  createProvingGroundNavigationMapWorldAdapter
} from "../../src/world/navigationMapWorldAdapter";

const routePlan = (): RoutePlan => ({
  id: "route-test",
  planner: "ObstacleAvoidanceLocal",
  speedProfile: "Balanced",
  createdAtTick: 12,
  target: {
    id: "target-b",
    label: "Target B",
    kind: "Waypoint",
    position: vec3(80, 0, 40),
    arrivalEnvelope: { radius: 4 }
  },
  segments: [
    { id: "segment-z", kind: "Avoidance", start: vec3(10, 0, 20), end: vec3(40, 0, -30), desiredSpeed: 14, clearanceRadius: 8 },
    { id: "segment-a", kind: "Terminal", start: vec3(40, 0, -30), end: vec3(80, 0, 40), desiredSpeed: 8, clearanceRadius: 4 }
  ],
  validation: { ok: true, issues: [], rejectedReasonCodes: [] },
  score: { distance: 100, segmentCount: 2, clearanceRisk: 0, fuelCostEstimate: 2, authorityRisk: 0, total: 102, reasons: [] },
  planHash: "route-hash"
});

const mapInput = (floatingOriginFrameId: string) => ({
  floatingOriginFrameId,
  ship: navigationMapShipSnapshot({
    absolutePosition: worldCoordinate(vec3(10, 2, 20)),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    presentation: DEFAULT_ACTIVE_SHIP_PRESENTATION
  }),
  targets: [
    navigationMapTargetSnapshot({
      id: "target-z",
      label: "Target Z",
      kind: "Point",
      position: vec3(-20, 0, 10),
      arrivalEnvelope: { radius: 3 }
    }),
    navigationMapTargetSnapshot(routePlan().target)
  ],
  selectedTargetId: "target-b",
  route: navigationMapRouteSnapshot(routePlan()),
  obstacles: [
    navigationMapObstacleSnapshot({ id: "obstacle-z", center: vec3(15, 0, -5), radius: 12, padding: 3 }),
    navigationMapObstacleSnapshot({ id: "obstacle-a", center: vec3(-5, 0, 30), radius: 6, padding: 2 })
  ],
  entities: [],
  world: {
    registrySignature: "registry-signature",
    streamingSignature: "streaming-signature",
    fullChunkIds: ["chunk:1:0:0" as const, "chunk:0:0:0" as const],
    snapshotChunkIds: []
  }
});

describe("navigation map snapshot contracts", () => {
  it("canonicalizes non-semantic collections, freezes deeply, and signs identical input deterministically", () => {
    const first = createNavigationMapSnapshot(mapInput("local-frame-a"));
    const repeatedInput = mapInput("local-frame-a");
    const repeated = createNavigationMapSnapshot({
      ...repeatedInput,
      targets: [...repeatedInput.targets].reverse(),
      obstacles: [...repeatedInput.obstacles].reverse(),
      world: { ...repeatedInput.world, fullChunkIds: [...repeatedInput.world.fullChunkIds].reverse() }
    });

    expect(first.signature).toBe(repeated.signature);
    expect(serializeNavigationMapSnapshot(first)).toBe(serializeNavigationMapSnapshot(repeated));
    expect(first.targets.map((target) => target.id)).toEqual(["target-b", "target-z"]);
    expect(first.obstacles.map((obstacle) => obstacle.id)).toEqual(["obstacle-a", "obstacle-z"]);
    expect(first.world.fullChunkIds).toEqual(["chunk:0:0:0", "chunk:1:0:0"]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.route?.segments)).toBe(true);
    expect(Object.isFrozen(first.ship.absolutePosition.value)).toBe(true);
  });

  it("keeps the signature and absolute relationships stable across floating-origin shifts", () => {
    const beforeFrame = createLocalPhysicsFrame("local-frame-a", vec3(0, 0, 0));
    const afterFrame = createLocalPhysicsFrame("local-frame-b", vec3(1_024, 0, -512));
    const before = createNavigationMapSnapshot(mapInput(beforeFrame.id));
    const after = createNavigationMapSnapshot(mapInput(afterFrame.id));

    expect(before.signature).toBe(after.signature);
    expect(before.ship.absolutePosition.value).toEqual(after.ship.absolutePosition.value);
    expect(before.targets[0].absolutePosition.value.x - before.ship.absolutePosition.value.x)
      .toBe(after.targets[0].absolutePosition.value.x - after.ship.absolutePosition.value.x);
    expect(before.floatingOriginFrameId).not.toBe(after.floatingOriginFrameId);
  });

  it("preserves RoutePlan segment/node order and obstacle center/radius", () => {
    const snapshot = createNavigationMapSnapshot(mapInput("local-frame"));

    expect(snapshot.route?.segments.map((segment) => segment.id)).toEqual(["segment-z", "segment-a"]);
    expect(snapshot.route?.nodes.map((node) => node.absolutePosition.value)).toEqual([
      vec3(10, 0, 20),
      vec3(40, 0, -30),
      vec3(80, 0, 40)
    ]);
    expect(snapshot.obstacles[1]).toMatchObject({
      id: "obstacle-z",
      center: { value: vec3(15, 0, -5) },
      radius: 12
    });
  });
});

describe("navigation map projection", () => {
  it("maps X horizontally and Z vertically", () => {
    const projected = projectNavigationMapPosition(
      worldCoordinate(vec3(20, 400, 30)),
      navigationMapViewportState({ centerAbsoluteX: 10, centerAbsoluteZ: 10, metersPerPixel: 2 }),
      { width: 200, height: 100 }
    );

    expect(projected).toEqual({ x: 105, y: 40 });
  });

  it("derives heading from quaternion-rotated +X and separates north-up from ship-up rotation", () => {
    const facingPositiveZ = quaternionFromAxisAngle(vec3(0, 1, 0), -Math.PI / 2);
    const positiveZHeading = navigationMapOrientation(facingPositiveZ, "north-up");
    const northUp = navigationMapOrientation({ x: 0, y: 0, z: 0, w: 1 }, "north-up");
    const shipUp = navigationMapOrientation({ x: 0, y: 0, z: 0, w: 1 }, "ship-up");

    expect(positiveZHeading.headingDegrees).toBeCloseTo(90, 8);
    expect(northUp.worldRotationDegrees).toBe(0);
    expect(northUp.shipMarkerRotationDegrees).toBe(90);
    expect(shipUp.worldRotationDegrees).toBe(90);
    expect(shipUp.shipMarkerRotationDegrees).toBe(0);
  });

  it("falls back to effective north-up when ship forward projects vertically", () => {
    const verticalForward = quaternionFromAxisAngle(vec3(0, 0, 1), Math.PI / 2);
    expect(navigationMapOrientation(verticalForward, "ship-up")).toEqual({
      requestedOrbit: "ship-up",
      effectiveOrbit: "north-up",
      headingDegrees: 0,
      worldRotationDegrees: 0,
      shipMarkerRotationDegrees: 90
    });
  });
});

describe("navigation map world adapter", () => {
  it("groups the proving-ground field into deterministic 256 metre chunks with the required policy", () => {
    const first = createProvingGroundNavigationMapWorldAdapter();
    const second = createProvingGroundNavigationMapWorldAdapter();

    expect(first.registry).toEqual(second.registry);
    expect(first.registry.chunkSizeMeters).toBe(256);
    expect(first.registry.chunks.flatMap((chunk) => chunk.entityIds).sort()).toEqual(
      provingGroundAsteroidField.map((entity) => entity.id).sort()
    );
    expect(first.policy).toMatchObject({
      fullUpdateRadius: 256,
      snapshotRadius: 3_200,
      nearLodRadius: 512,
      mediumLodRadius: 1_600,
      farLodRadius: 3_200,
      simulationHysteresisMeters: 32,
      renderHysteresisMeters: 32,
      budgets: {
        maxFullChunks: 8,
        maxSnapshotChunks: 64,
        maxVisibleChunks: 64,
        maxEstimatedEntityCount: 256
      }
    });
  });

  it("exposes an entity only when its chunk is Full or Snapshot resident", () => {
    const entities: readonly WorldEntityState[] = [
      {
        id: "resident-candidate",
        absolutePosition: worldCoordinate(vec3(0, 0, 0)),
        absoluteVelocity: absoluteVelocity(vec3())
      },
      {
        id: "far-entity",
        absolutePosition: worldCoordinate(vec3(8_000, 0, 0)),
        absoluteVelocity: absoluteVelocity(vec3())
      }
    ];
    const adapter = createNavigationMapWorldAdapter(entities);
    const far = adapter.snapshot(worldCoordinate(vec3(8_000, 0, 0)));
    const near = adapter.snapshot(worldCoordinate(vec3(0, 0, 0)), far);

    expect(far.entities.map((entity) => entity.id)).not.toContain("resident-candidate");
    expect(near.entities).toContainEqual(expect.objectContaining({
      id: "resident-candidate",
      residence: "Full",
      renderLod: "Near",
      presentationKey: "world-entity"
    }));
    expect(near.streaming.assignments.find((assignment) => assignment.chunkId === near.entities[0].chunkId)?.finalSimulationMode)
      .not.toBe("Dormant");
    expect(adapter.registry.chunks.every((chunk) => chunk.renderBatchKeys.length === 0)).toBe(true);
  });
});
