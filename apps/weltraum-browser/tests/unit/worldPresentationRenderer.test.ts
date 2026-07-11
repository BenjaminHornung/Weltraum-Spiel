import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  applyDecorativePresentationMetadata,
  deriveDecorativePresentationInventory,
  mergeWorldPresentationRenderEvidence
} from "../../src/render/three/debugScene";
import {
  WorldPresentationRenderer,
  type WorldPresentationCanvasTarget
} from "../../src/render/three/worldPresentationRenderer";
import { createLocalPhysicsFrame } from "../../src/world/frames";
import { playableLargeFieldVisualLandmarks, provingGroundAsteroidField } from "../../src/world/provingGroundWorld";
import type { WorldPresentationSnapshot } from "../../src/world/worldPresentation";

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const fixture = (overrides: {
  readonly sourcePlanHash?: string;
  readonly lifecycle?: "Preview" | "Locked";
  readonly visibility?: "Visible" | "Hidden" | "Blocked";
  readonly renderFrameRevision?: number;
  readonly firstSegmentEndX?: number;
  readonly firstSegmentDesiredSpeed?: number;
  readonly firstSegmentClearanceRadius?: number;
  readonly firstSegmentBrakeMarginMultiplier?: number | null;
  readonly obstacleIds?: readonly string[];
  readonly signature?: string;
  readonly executorStatus?: "Idle" | "Executing" | "Arrived";
  readonly executorRouteLifecycle?: "Idle" | "Executing" | "Arrived" | "Completed" | "Holding";
  readonly zeroRadiusObstacle?: boolean;
  readonly selectedTargetId?: string;
  readonly selectedTargetLocked?: boolean;
  readonly routeTargetId?: string;
  readonly focusTargetId?: string;
  readonly focusPosition?: { readonly x: number; readonly y: number; readonly z: number };
} = {}): WorldPresentationSnapshot => {
  const sourcePlanHash = overrides.sourcePlanHash ?? "plan-a";
  const lifecycle = overrides.lifecycle ?? "Preview";
  const visibility = overrides.visibility ?? "Visible";
  const selectedTarget = {
    sourceTargetId: overrides.selectedTargetId ?? "target-full-internal-id",
    label: "Target",
    kind: "Point" as const,
    position: { x: 310, y: 25, z: -10 },
    arrivalRadius: 3,
    terminalSpeed: 1,
    stopBehavior: "StopWithinEnvelope" as const,
    selected: true,
    locked: overrides.selectedTargetLocked ?? (lifecycle === "Locked"),
    truthBacked: true as const
  };
  const routeTarget = {
    ...selectedTarget,
    sourceTargetId: overrides.routeTargetId ?? selectedTarget.sourceTargetId,
    label: overrides.routeTargetId ? `Target ${overrides.routeTargetId}` : selectedTarget.label
  };
  const focusTarget = {
    ...routeTarget,
    sourceTargetId: overrides.focusTargetId ?? routeTarget.sourceTargetId,
    position: overrides.focusPosition ?? routeTarget.position
  };
  const segments = [
    {
      sourceSegmentId: "segment-direct",
      kind: "Direct" as const,
      start: { x: 110, y: 5, z: -20 },
      end: { x: overrides.firstSegmentEndX ?? 210, y: 15, z: -15 },
      desiredSpeed: overrides.firstSegmentDesiredSpeed ?? 18,
      clearanceRadius: overrides.firstSegmentClearanceRadius ?? 4,
      brakeMarginMultiplier: overrides.firstSegmentBrakeMarginMultiplier === undefined
        ? null
        : overrides.firstSegmentBrakeMarginMultiplier,
      progress: "Completed" as const
    },
    {
      sourceSegmentId: "segment-avoidance",
      kind: "Avoidance" as const,
      start: { x: overrides.firstSegmentEndX ?? 210, y: 15, z: -15 },
      end: { x: 270, y: 30, z: -12 },
      desiredSpeed: 12,
      clearanceRadius: 8,
      brakeMarginMultiplier: 1.2,
      progress: "Active" as const
    },
    {
      sourceSegmentId: "segment-terminal",
      kind: "Terminal" as const,
      start: { x: 270, y: 30, z: -12 },
      end: routeTarget.position,
      desiredSpeed: 3,
      clearanceRadius: 3,
      brakeMarginMultiplier: null,
      progress: "Pending" as const
    }
  ];
  const obstacles = (overrides.obstacleIds ?? ["obstacle-a", "obstacle-b"]).map((id, index) => ({
    sourceObstacleId: id,
    center: { x: 150 + index * 50, y: index * 4, z: -30 },
    radius: overrides.zeroRadiusObstacle && index === 0 ? 0 : 10 + index,
    padding: overrides.zeroRadiusObstacle && index === 0 ? 0 : 3 + index,
    renderEligible: id !== "obstacle-hidden",
    truthBacked: true as const,
    renderOnly: false as const,
    radarVisible: true as const,
    collisionRelevant: true as const,
    visualProxyStyle: {
      geometry: "SolidLowPoly" as const,
      outline: "Restrained" as const,
      radiusSource: "RuntimeTruth" as const
    }
  }));
  return deepFreeze({
    frameId: "semantic-frame",
    renderFrameRevision: overrides.renderFrameRevision ?? 4,
    signature: overrides.signature ?? "signature-stable",
    shipState: {
      position: { x: 100, y: 5, z: -20 },
      velocity: { x: 1, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    navigationState: {
      executorStatus: overrides.executorStatus ?? (lifecycle === "Locked" ? "Executing" : "Idle"),
      routeLifecycle: overrides.executorRouteLifecycle ?? (lifecycle === "Locked" ? "Executing" : null),
      distanceToTarget: lifecycle === "Locked" ? 210 : null,
      offRouteDistance: lifecycle === "Locked" ? 2 : null
    },
    selectedTarget,
    navigationFocusTarget: focusTarget,
    navigationBeacon: {
      sourceTargetId: focusTarget.sourceTargetId,
      label: focusTarget.label,
      position: focusTarget.position,
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: false
    },
    route: {
      sourceRouteId: "route-internal-id",
      sourcePlanHash,
      sourceTargetId: routeTarget.sourceTargetId,
      lifecycle,
      executorLifecycle: lifecycle === "Locked" ? "Executing" : null,
      executorAssociation: lifecycle === "Locked" ? "Current" : null,
      visibility,
      blockerCode: visibility === "Blocked" ? "FlightAdmissionRejected" : null,
      admissionReady: visibility === "Visible",
      activeSegmentId: lifecycle === "Locked" ? "segment-avoidance" : null,
      segments,
      goal: routeTarget,
      truthBacked: true
    },
    obstacles,
    landmarks: [],
    decorations: [],
    residency: [],
    runtimeTruthObstacleCount: obstacles.length,
    truthBackedObstacleProxyCount: obstacles.filter((obstacle) => obstacle.renderEligible).length,
    decorativeObjectCount: 14,
    rendererOwnsWorldTruth: false
  });
};

class CanvasEvidence implements WorldPresentationCanvasTarget {
  readonly attributes = new Map<string, string>();
  readonly writes: string[] = [];
  onSet?: (name: string, attributes: ReadonlyMap<string, string>) => void;
  onRemove?: (name: string, attributes: ReadonlyMap<string, string>) => void;

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    this.writes.push(name);
    this.onSet?.(name, this.attributes);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    this.writes.push(`remove:${name}`);
    this.onRemove?.(name, this.attributes);
  }
}

const setup = () => {
  const parent = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  const canvas = new CanvasEvidence();
  const renderer = new WorldPresentationRenderer({
    parent,
    camera,
    canvas,
    decorativeAsteroidCount: 156,
    decorativeLandmarkCount: 8
  });
  return { parent, camera, canvas, renderer };
};

const frame = (x = 100, y = 5, z = -20) => createLocalPhysicsFrame("render-frame", { x, y, z });

describe("WorldPresentationRenderer", () => {
  it("adds, updates, removes, and disposes keyed truth proxies without mutating deep-frozen input", () => {
    const { parent, renderer } = setup();
    const source = fixture();
    const before = JSON.stringify(source);
    const added = renderer.update(source, frame());

    expect(added.lifecycleOperation).toBe("add");
    expect(added.selectedTargetProxyVisible).toBe(true);
    expect(added.routeProxySegmentCount).toBe(3);
    expect(added.truthBackedObstacleProxyCount).toBe(2);
    expect(renderer.root.parent).toBe(parent);
    expect(JSON.stringify(source)).toBe(before);

    const updated = renderer.update(fixture({ lifecycle: "Locked", renderFrameRevision: 5 }), frame());
    expect(updated.lifecycleOperation).toBe("update");
    expect(updated.presentationRevision).toBe(2);
    expect(updated.renderFrameDelta).toBe(1);

    const removed = renderer.remove();
    expect(removed.lifecycleOperation).toBe("remove");
    expect(renderer.routeGroup.children).toHaveLength(0);
    expect(renderer.obstacleGroup.children).toHaveLength(0);

    renderer.dispose();
    expect(renderer.getSnapshot().lifecycleOperation).toBe("dispose");
    expect(renderer.root.parent).toBeNull();
    expect(() => renderer.update(source, frame())).toThrow(/disposed/);
  });

  it("rejects same-hash geometry drift before changing any rendered state", () => {
    const { renderer } = setup();
    renderer.update(fixture(), frame());
    const targetPositionBefore = renderer.selectedTargetGroup.position.clone();
    const routeBefore = renderer.routeGroup.children[0];

    expect(() => renderer.update(fixture({ firstSegmentEndX: 211, renderFrameRevision: 5 }), frame(50))).toThrow(
      /Route geometry changed for stable sourcePlanHash plan-a/
    );
    expect(renderer.routeGroup.children[0]).toBe(routeBefore);
    expect(renderer.selectedTargetGroup.position.equals(targetPositionBefore)).toBe(true);
    expect(renderer.getSnapshot().presentationRevision).toBe(1);
  });

  it.each([
    ["desired speed", { firstSegmentDesiredSpeed: 19 }],
    ["clearance radius", { firstSegmentClearanceRadius: 5 }],
    ["brake margin", { firstSegmentBrakeMarginMultiplier: 1.1 }]
  ] as const)("rejects same-hash %s drift", (_label, drift) => {
    const { renderer } = setup();
    renderer.update(fixture(), frame());

    expect(() => renderer.update(fixture({ ...drift, renderFrameRevision: 5 }), frame())).toThrow(
      /Route geometry changed for stable sourcePlanHash plan-a/
    );
    expect(renderer.getSnapshot().presentationRevision).toBe(1);
  });

  it("replaces route identity for every different hash even when geometry is equal", () => {
    const { renderer } = setup();
    renderer.update(fixture({ sourcePlanHash: "plan-a" }), frame());
    const firstIdentity = renderer.routeGroup.children[0];
    renderer.update(fixture({ sourcePlanHash: "plan-b", renderFrameRevision: 5 }), frame());

    expect(renderer.routeGroup.children[0]).not.toBe(firstIdentity);
    expect(renderer.getSnapshot().routeProxyPlanHash).toBe("plan-b");
  });

  it("preserves exact route order and internal IDs while canvas evidence exposes no full IDs", () => {
    const { canvas, renderer } = setup();
    const rendered = renderer.update(fixture(), frame());

    expect(rendered.routeSegmentIds).toEqual(["segment-direct", "segment-avoidance", "segment-terminal"]);
    expect(rendered.selectedTargetProxyId).toBe("target-full-internal-id");
    expect([...canvas.attributes.keys()].some((key) => /target-id|segment-id|plan-hash|signature/.test(key))).toBe(false);
    expect([...canvas.attributes.values()]).not.toContain("target-full-internal-id");
  });

  it("reprojects target, route, and obstacle transforms on frame-origin changes without semantic mutation", () => {
    const { renderer } = setup();
    const source = fixture();
    const first = renderer.update(source, frame(100, 5, -20));
    expect(first.selectedTargetProjectedPosition).toEqual({ x: 210, y: 20, z: 10 });
    expect(renderer.selectedTargetGroup.position.toArray()).toEqual([210, 20, 10]);
    expect(renderer.obstacleGroup.children[0].position.toArray()).toEqual([50, -5, -10]);

    const signature = source.signature;
    const second = renderer.update(source, frame(150, 10, -30));
    expect(second.worldPresentationSignature).toBe(signature);
    expect(second.presentationRevision).toBe(2);
    expect(second.selectedTargetProjectedPosition).toEqual({ x: 160, y: 15, z: 20 });
    expect(renderer.obstacleGroup.children[0].position.toArray()).toEqual([0, -10, 0]);
    const routeLine = renderer.routeGroup.children[0].children[0] as THREE.Line;
    expect(Array.from((routeLine.geometry.getAttribute("position") as THREE.BufferAttribute).array)).toEqual([ -40, -5, 10, 60, 5, 15 ]);
  });

  it("uses non-color dash, gap, opacity, endpoint, and layering distinctions for route states", () => {
    const { renderer } = setup();
    renderer.update(fixture({ lifecycle: "Preview" }), frame());
    const identity = renderer.routeGroup.children[0];
    const previewLine = identity.children[0] as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
    expect(previewLine.material.dashSize).toBe(8);
    expect(previewLine.material.gapSize).toBe(5);
    expect(previewLine.material.depthWrite).toBe(false);
    expect(previewLine.material.depthTest).toBe(false);

    renderer.update(fixture({ lifecycle: "Locked", renderFrameRevision: 5 }), frame());
    const completed = identity.children[0] as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
    const active = identity.children[2] as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
    const terminalMarker = identity.children[5] as THREE.Mesh;
    expect(completed.material.gapSize).toBe(0.01);
    expect(completed.material.opacity).toBeLessThan(active.material.opacity);
    expect(active.renderOrder).toBeGreaterThan(completed.renderOrder);
    expect(terminalMarker.geometry).toBeInstanceOf(THREE.TorusGeometry);
    expect((terminalMarker.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
    expect((terminalMarker.material as THREE.MeshBasicMaterial).depthTest).toBe(false);

    renderer.update(fixture({ lifecycle: "Locked", visibility: "Blocked", renderFrameRevision: 6 }), frame());
    expect(completed.material.dashSize).toBe(2.2);
    expect(completed.material.gapSize).toBe(7);
    expect(completed.material.opacity).toBe(0.22);
  });

  it("updates and removes obstacle proxies from runtime center, radius, padding, and eligibility", () => {
    const { renderer } = setup();
    renderer.update(fixture(), frame());
    const first = renderer.obstacleGroup.children[0];
    expect(first.children[0].scale.toArray()).toEqual([10, 10, 10]);
    expect(first.children[1].scale.toArray()).toEqual([10, 10, 10]);
    expect(first.children[2].scale.toArray()).toEqual([13, 13, 13]);
    expect(first.children[0]).toBeInstanceOf(THREE.Mesh);
    expect((first.children[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.DodecahedronGeometry);
    expect(first.children[1]).toBeInstanceOf(THREE.LineSegments);
    expect((first.children[1] as THREE.LineSegments).geometry).toBeInstanceOf(THREE.EdgesGeometry);
    expect(first.children[1].name).toBe("truth-obstacle-navigation-outline");
    expect((first.children[1] as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>).material.depthTest).toBe(false);
    expect((first.children[2] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity).toBeLessThan(0.1);

    const rendered = renderer.update(fixture({ obstacleIds: ["obstacle-b", "obstacle-hidden"], renderFrameRevision: 5 }), frame());
    expect(rendered.runtimeTruthObstacleCount).toBe(2);
    expect(rendered.truthBackedObstacleProxyCount).toBe(1);
    expect(renderer.obstacleGroup.children).toHaveLength(1);
    expect(renderer.obstacleGroup.children[0].userData.sourceObstacleId).toBe("obstacle-b");
  });

  it("preserves exact zero runtime radius and zero padding", () => {
    const { renderer } = setup();
    renderer.update(fixture({ obstacleIds: ["zero-obstacle"], zeroRadiusObstacle: true }), frame());
    const obstacle = renderer.obstacleGroup.children[0];

    expect(obstacle.children[0].scale.toArray()).toEqual([0, 0, 0]);
    expect(obstacle.children[1].scale.toArray()).toEqual([0, 0, 0]);
    expect(obstacle.children[2].scale.toArray()).toEqual([0, 0, 0]);
  });

  it("uses stable non-color selected, locked, and authoritative arrival target styles", () => {
    const { camera, renderer } = setup();
    camera.rotation.set(0.2, -0.35, 0.1);
    camera.updateMatrixWorld();
    renderer.update(fixture({ lifecycle: "Preview" }), frame());
    const marker = renderer.selectedTargetGroup.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const selectedScale = marker.scale.x;
    expect(marker.userData.presentationState).toBe("Selected");
    expect(marker.userData.markerShape).toBe("SelectionRing");
    expect(marker.material.opacity).toBe(0.62);
    expect(marker.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);

    camera.rotation.set(-0.1, 0.45, -0.2);
    renderer.update(fixture({ lifecycle: "Locked", renderFrameRevision: 5 }), frame());
    const lockedScale = marker.scale.x;
    expect(marker.userData.presentationState).toBe("Locked");
    expect(marker.userData.markerShape).toBe("LockedRing");
    expect(marker.material.opacity).toBe(0.82);
    expect(marker.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
    expect(lockedScale).toBeGreaterThan(selectedScale);

    renderer.update(fixture({
      lifecycle: "Locked",
      executorStatus: "Arrived",
      executorRouteLifecycle: "Arrived",
      renderFrameRevision: 6
    }), frame());
    const arrivedScale = marker.scale.x;
    expect(marker.userData.presentationState).toBe("Arrived");
    expect(marker.userData.markerShape).toBe("ArrivalRing");
    expect(marker.material.opacity).toBe(0.94);
    expect(arrivedScale).toBeLessThan(lockedScale);

    renderer.update(fixture({
      lifecycle: "Locked",
      executorStatus: "Arrived",
      executorRouteLifecycle: "Arrived",
      renderFrameRevision: 7
    }), frame(150, 10, -30));
    expect(marker.userData.presentationState).toBe("Arrived");
    expect(marker.scale.x).toBe(arrivedScale);
    expect(marker.material.opacity).toBe(0.94);

    renderer.update(fixture({ lifecycle: "Locked", renderFrameRevision: 8 }), frame());
    expect(marker.userData.presentationState).toBe("Locked");
  });

  it("does not apply route A arrival styling to divergent selected target B", () => {
    const { renderer } = setup();
    renderer.update(fixture({
      lifecycle: "Locked",
      selectedTargetId: "target-b",
      selectedTargetLocked: false,
      routeTargetId: "target-a",
      focusTargetId: "target-a",
      executorStatus: "Arrived",
      executorRouteLifecycle: "Completed"
    }), frame());
    const marker = renderer.selectedTargetGroup.children[0];

    expect(marker.userData.presentationState).toBe("Selected");
    expect(marker.userData.markerShape).toBe("SelectionRing");
  });

  it("keeps selected target A arrived when navigation focus moves to B", () => {
    const { renderer } = setup();
    renderer.update(fixture({
      lifecycle: "Locked",
      focusTargetId: "target-b",
      executorStatus: "Arrived",
      executorRouteLifecycle: "Completed"
    }), frame());
    const marker = renderer.selectedTargetGroup.children[0];

    expect(marker.userData.presentationState).toBe("Arrived");
    expect(marker.userData.markerShape).toBe("ArrivalRing");
  });

  it("deduplicates same-target focus and scales a divergent distant focus beacon", () => {
    const { renderer } = setup();
    const sameTarget = renderer.update(fixture(), frame());
    expect(sameTarget.selectedTargetProxyVisible).toBe(true);
    expect(sameTarget.navigationFocusBeaconCount).toBe(0);
    expect(renderer.navigationFocusGroup.visible).toBe(false);

    const divergent = renderer.update(fixture({
      focusTargetId: "navigation-focus-b",
      focusPosition: { x: 2_700, y: 5, z: -20 },
      renderFrameRevision: 5
    }), frame());
    const beacon = renderer.navigationFocusGroup.children[0];
    expect(divergent.navigationFocusBeaconCount).toBe(1);
    expect(renderer.navigationFocusGroup.visible).toBe(true);
    expect(beacon.scale.toArray()).toEqual([9.5, 9.5, 9.5]);
  });

  it("disposes each exact owned resource identity once and is idempotent", () => {
    const { canvas, renderer } = setup();
    renderer.update(fixture(), frame());
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    renderer.root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      }
    });
    expect(geometries.size).toBe(11);
    expect(materials.size).toBe(11);
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, "dispose"));

    renderer.dispose();
    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(canvas.attributes.size).toBe(0);
    renderer.dispose();
    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    geometrySpies.forEach((spy) => spy.mockRestore());
    materialSpies.forEach((spy) => spy.mockRestore());
  });

  it("publishes evidence only after the keyed diff and commits each atomic set with a monotonic revision", () => {
    const { canvas, renderer } = setup();
    renderer.update(fixture(), frame());
    expect(canvas.writes.at(-1)).toBe("data-world-presentation-revision");
    expect(canvas.attributes.get("data-world-presentation-revision")).toBe("1");
    expect(canvas.attributes.get("data-truth-obstacle-proxy-count")).toBe("2");

    canvas.writes.length = 0;
    const intermediateRevisions: (string | undefined)[] = [];
    canvas.onSet = (name, attributes) => {
      if (name !== "data-world-presentation-revision") {
        intermediateRevisions.push(attributes.get("data-world-presentation-revision"));
      }
    };
    renderer.update(fixture({ renderFrameRevision: 5 }), frame());
    expect(canvas.writes[0]).toBe("remove:data-world-presentation-revision");
    expect(intermediateRevisions.every((revision) => revision === undefined)).toBe(true);
    expect(canvas.writes.at(-1)).toBe("data-world-presentation-revision");
    expect(canvas.attributes.get("data-world-presentation-revision")).toBe("2");
  });

  it("invalidates canvas revision before every intermediate dispose removal", () => {
    const { canvas, renderer } = setup();
    renderer.update(fixture(), frame());
    const captured: [string, string | undefined][] = [];
    canvas.onRemove = (name, attributes) => captured.push([name, attributes.get("data-world-presentation-revision")]);

    renderer.dispose();
    expect(canvas.writes.at(-11)).toBe("remove:data-world-presentation-revision");
    expect(captured.length).toBeGreaterThan(1);
    expect(captured.every(([, revision]) => revision === undefined)).toBe(true);
  });

  it("keeps legacy snapshot fields intact through the production evidence merger", () => {
    const { renderer } = setup();
    const rendered = renderer.update(fixture(), frame());
    const legacy = deepFreeze({
      shipPosition: { x: 0, y: 0, z: 0 },
      targetVisible: false,
      targetBeaconCount: 3,
      runtimeObstacleCount: 7
    });
    const merged = mergeWorldPresentationRenderEvidence(legacy, rendered);

    expect(merged).toMatchObject({
      shipPosition: { x: 0, y: 0, z: 0 },
      targetVisible: false,
      targetBeaconCount: 3,
      runtimeObstacleCount: 7,
      selectedTargetProxyId: "target-full-internal-id",
      decorativeLandmarkCount: 8,
      rendererOwnsWorldTruth: false
    });
    expect(merged.shipPosition).toBe(legacy.shipPosition);
    expect(rendered.rendererOwnsWorldTruth).toBe(false);
    expect(rendered.navigationFocusBeaconCount).toBe(0);
  });

  it("derives six base plus actual belt asteroids separately from eight actual landmarks", () => {
    const belt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1), new THREE.MeshBasicMaterial(), 150);
    const inventory = deriveDecorativePresentationInventory(
      provingGroundAsteroidField,
      playableLargeFieldVisualLandmarks,
      belt.count
    );
    const { renderer } = setup();
    const rendered = renderer.update(fixture(), frame());

    expect(inventory.baseAsteroidSources.map((source) => source.id)).toEqual([
      "asteroid-a",
      "asteroid-b",
      "asteroid-c",
      "asteroid-d",
      "asteroid-e",
      "asteroid-f"
    ]);
    expect(inventory.baseAsteroidCount).toBe(6);
    expect(inventory.beltAsteroidCount).toBe(belt.count);
    expect(inventory.decorativeAsteroidCount).toBe(156);
    expect(inventory.landmarkCount).toBe(8);
    expect(rendered.decorativeAsteroidCount).toBe(inventory.decorativeAsteroidCount);
    expect(rendered.decorativeLandmarkCount).toBe(inventory.landmarkCount);
    expect(rendered.decorativeObjectsExcludedFromRadar).toBe(true);
    expect(rendered.truthBackedObstacleProxyCount).toBe(2);
    expect(rendered.runtimeTruthObstacleCount).toBe(2);
    belt.geometry.dispose();
    (belt.material as THREE.Material).dispose();
  });

  it("applies the complete decorative exclusion contract to real Three object types", () => {
    const objects = [
      applyDecorativePresentationMetadata(new THREE.Group()),
      applyDecorativePresentationMetadata(new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial())),
      applyDecorativePresentationMetadata(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1), new THREE.MeshBasicMaterial(), 2))
    ];

    for (const object of objects) {
      expect(object.userData).toMatchObject({
        renderOnly: true,
        truthBacked: false,
        radarVisible: false,
        collisionRelevant: false
      });
    }
  });
});
