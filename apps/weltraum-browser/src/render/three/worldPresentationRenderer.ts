import * as THREE from "three";
import type { Vec3 } from "../../core/vector";
import type { FrameDescriptor } from "../../world/frames";
import type {
  WorldPresentationObstacle,
  WorldPresentationRoute,
  WorldPresentationRouteSegment,
  WorldPresentationSnapshot
} from "../../world/worldPresentation";

export type WorldPresentationRendererOperation = "add" | "update" | "remove" | "dispose";

export interface WorldPresentationCanvasTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface WorldPresentationRendererOptions {
  readonly parent: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly canvas?: WorldPresentationCanvasTarget;
  readonly decorativeAsteroidCount: number;
  readonly decorativeLandmarkCount: number;
}

export interface WorldPresentationRenderSnapshot {
  readonly selectedTargetProxyVisible: boolean;
  readonly selectedTargetProxyId: string | null;
  readonly routeProxyVisible: boolean;
  readonly routeProxyVisibility: "Visible" | "Hidden" | "Blocked" | null;
  readonly routeProxyPlanHash: string | null;
  readonly routeProxySegmentCount: number;
  readonly activeRouteProxySegmentId: string | null;
  readonly routeSegmentIds: readonly string[];
  readonly truthBackedObstacleProxyCount: number;
  readonly runtimeTruthObstacleCount: number;
  readonly decorativeAsteroidCount: number;
  readonly decorativeLandmarkCount: number;
  readonly decorativeObjectsExcludedFromRadar: true;
  readonly rendererOwnsWorldTruth: false;
  readonly worldPresentationSignature: string | null;
  readonly renderFrameRevision: number;
  readonly renderFrameDelta: number;
  readonly presentationRevision: number;
  readonly navigationFocusBeaconCount: number;
  readonly selectedTargetProjectedPosition: Vec3 | null;
  readonly lifecycleOperation: WorldPresentationRendererOperation;
}

interface RouteRecord {
  readonly sourcePlanHash: string;
  readonly geometrySignature: string;
  readonly group: THREE.Group;
  readonly segmentIds: readonly string[];
  readonly resources: readonly (THREE.BufferGeometry | THREE.Material)[];
}

interface ObstacleRecord {
  readonly sourceObstacleId: string;
  readonly group: THREE.Group;
}

const CANVAS_ATTRIBUTES = [
  "data-selected-target-proxy-visible",
  "data-route-proxy-visible",
  "data-route-proxy-visibility",
  "data-route-proxy-segment-count",
  "data-truth-obstacle-proxy-count",
  "data-runtime-truth-obstacle-count",
  "data-navigation-focus-beacon-count",
  "data-decorative-asteroid-count",
  "data-decorative-objects-excluded-from-radar",
  "data-renderer-owns-world-truth"
] as const;

const project = (value: Vec3, frame: FrameDescriptor): Vec3 => ({
  x: value.x - frame.originAbsolutePosition.x,
  y: value.y - frame.originAbsolutePosition.y,
  z: value.z - frame.originAbsolutePosition.z
});

const setPosition = (object: THREE.Object3D, value: Vec3): void => {
  object.position.set(value.x, value.y, value.z);
};

const samePosition = (left: Vec3, right: Vec3): boolean => left.x === right.x && left.y === right.y && left.z === right.z;

const routeGeometrySignature = (route: WorldPresentationRoute): string => JSON.stringify(route.segments.map((segment) => ({
  sourceSegmentId: segment.sourceSegmentId,
  kind: segment.kind,
  start: segment.start,
  end: segment.end,
  desiredSpeed: segment.desiredSpeed,
  clearanceRadius: segment.clearanceRadius,
  brakeMarginMultiplier: segment.brakeMarginMultiplier
})));

const disposeResources = (resources: readonly (THREE.BufferGeometry | THREE.Material)[]): void => {
  for (const resource of resources) {
    resource.dispose();
  }
};

const initialSnapshot = (decorativeAsteroidCount: number, decorativeLandmarkCount: number): WorldPresentationRenderSnapshot => ({
  selectedTargetProxyVisible: false,
  selectedTargetProxyId: null,
  routeProxyVisible: false,
  routeProxyVisibility: null,
  routeProxyPlanHash: null,
  routeProxySegmentCount: 0,
  activeRouteProxySegmentId: null,
  routeSegmentIds: [],
  truthBackedObstacleProxyCount: 0,
  runtimeTruthObstacleCount: 0,
  decorativeAsteroidCount,
  decorativeLandmarkCount,
  decorativeObjectsExcludedFromRadar: true,
  rendererOwnsWorldTruth: false,
  worldPresentationSignature: null,
  renderFrameRevision: 0,
  renderFrameDelta: 0,
  presentationRevision: 0,
  navigationFocusBeaconCount: 0,
  selectedTargetProjectedPosition: null,
  lifecycleOperation: "remove"
});

export class WorldPresentationRenderer {
  readonly root = new THREE.Group();
  readonly selectedTargetGroup = new THREE.Group();
  readonly navigationFocusGroup = new THREE.Group();
  readonly routeGroup = new THREE.Group();
  readonly obstacleGroup = new THREE.Group();

  private readonly selectedTargetGeometry = new THREE.TorusGeometry(1, 0.12, 6, 20);
  private readonly selectedTargetMaterial = new THREE.MeshBasicMaterial({
    color: 0x31d9ff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: false
  });
  private readonly selectedTargetProxy = new THREE.Mesh(this.selectedTargetGeometry, this.selectedTargetMaterial);
  private readonly beaconGeometry = new THREE.OctahedronGeometry(1, 0);
  private readonly beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0x31d9ff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    depthTest: false
  });
  private readonly navigationBeacon = new THREE.Mesh(this.beaconGeometry, this.beaconMaterial);
  private readonly obstacleBodyGeometry = new THREE.DodecahedronGeometry(1, 0);
  private readonly obstacleOutlineGeometry = new THREE.EdgesGeometry(this.obstacleBodyGeometry, 18);
  private readonly obstacleEnvelopeGeometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly obstacleBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b8088,
    roughness: 0.96,
    metalness: 0.03,
    flatShading: true
  });
  private readonly obstacleEnvelopeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb04a,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    wireframe: true,
    depthTest: false
  });
  private readonly obstacleOutlineMaterial = new THREE.LineBasicMaterial({
    color: 0xffb04a,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: false
  });
  private readonly obstacles = new Map<string, ObstacleRecord>();
  private route: RouteRecord | null = null;
  private snapshot: WorldPresentationRenderSnapshot;
  private disposed = false;

  constructor(private readonly options: WorldPresentationRendererOptions) {
    if (!Number.isInteger(options.decorativeAsteroidCount) || options.decorativeAsteroidCount < 0) {
      throw new Error("decorativeAsteroidCount must be a non-negative integer");
    }
    if (!Number.isInteger(options.decorativeLandmarkCount) || options.decorativeLandmarkCount < 0) {
      throw new Error("decorativeLandmarkCount must be a non-negative integer");
    }

    this.root.name = "world-presentation-truth-proxies";
    this.selectedTargetGroup.name = "world-presentation-selected-target";
    this.navigationFocusGroup.name = "world-presentation-navigation-focus";
    this.routeGroup.name = "world-presentation-route";
    this.obstacleGroup.name = "world-presentation-obstacles";
    this.selectedTargetProxy.name = "selected-target-proxy";
    this.navigationBeacon.name = "navigation-focus-beacon";
    this.selectedTargetProxy.frustumCulled = false;
    this.navigationBeacon.frustumCulled = false;
    this.selectedTargetProxy.renderOrder = 8;
    this.navigationBeacon.renderOrder = 7;
    this.selectedTargetGroup.add(this.selectedTargetProxy);
    this.navigationFocusGroup.add(this.navigationBeacon);
    this.root.add(this.selectedTargetGroup, this.navigationFocusGroup, this.routeGroup, this.obstacleGroup);
    options.parent.add(this.root);
    this.snapshot = initialSnapshot(options.decorativeAsteroidCount, options.decorativeLandmarkCount);
  }

  update(source: WorldPresentationSnapshot, frame: FrameDescriptor): WorldPresentationRenderSnapshot {
    this.assertUsable();
    this.validateRoute(source.route);
    const previousRevision = this.snapshot.renderFrameRevision;
    const hadPresentation = this.snapshot.worldPresentationSignature !== null;

    this.updateSelectedTarget(source, frame);
    this.updateNavigationBeacon(source, frame);
    this.updateRoute(source.route, frame);
    this.updateObstacles(source.obstacles, frame);

    const selectedTargetProjectedPosition = source.selectedTarget === null ? null : project(source.selectedTarget.position, frame);
    const next: WorldPresentationRenderSnapshot = Object.freeze({
      selectedTargetProxyVisible: this.selectedTargetGroup.visible,
      selectedTargetProxyId: source.selectedTarget?.sourceTargetId ?? null,
      routeProxyVisible: this.routeGroup.visible && this.route !== null,
      routeProxyVisibility: source.route?.visibility ?? null,
      routeProxyPlanHash: source.route?.sourcePlanHash ?? null,
      routeProxySegmentCount: this.route?.segmentIds.length ?? 0,
      activeRouteProxySegmentId: source.route?.activeSegmentId ?? null,
      routeSegmentIds: Object.freeze([...(this.route?.segmentIds ?? [])]),
      truthBackedObstacleProxyCount: this.obstacles.size,
      runtimeTruthObstacleCount: source.runtimeTruthObstacleCount,
      decorativeAsteroidCount: this.options.decorativeAsteroidCount,
      decorativeLandmarkCount: this.options.decorativeLandmarkCount,
      decorativeObjectsExcludedFromRadar: true,
      rendererOwnsWorldTruth: false,
      worldPresentationSignature: source.signature,
      renderFrameRevision: source.renderFrameRevision,
      renderFrameDelta: source.renderFrameRevision - previousRevision,
      presentationRevision: this.snapshot.presentationRevision + 1,
      navigationFocusBeaconCount: this.navigationFocusGroup.visible ? 1 : 0,
      selectedTargetProjectedPosition,
      lifecycleOperation: hadPresentation ? "update" : "add"
    });
    this.snapshot = next;
    this.publishCanvasEvidence(next);
    return next;
  }

  remove(): WorldPresentationRenderSnapshot {
    this.assertUsable();
    this.selectedTargetGroup.visible = false;
    this.navigationFocusGroup.visible = false;
    this.removeRoute();
    for (const record of this.obstacles.values()) {
      this.obstacleGroup.remove(record.group);
    }
    this.obstacles.clear();
    this.snapshot = Object.freeze({
      ...initialSnapshot(this.options.decorativeAsteroidCount, this.options.decorativeLandmarkCount),
      presentationRevision: this.snapshot.presentationRevision + 1,
      renderFrameRevision: this.snapshot.renderFrameRevision,
      lifecycleOperation: "remove"
    });
    this.publishCanvasEvidence(this.snapshot);
    return this.snapshot;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.removeRoute();
    this.obstacles.clear();
    this.obstacleGroup.clear();
    this.root.clear();
    this.options.parent.remove(this.root);
    disposeResources([
      this.selectedTargetGeometry,
      this.selectedTargetMaterial,
      this.beaconGeometry,
      this.beaconMaterial,
      this.obstacleBodyGeometry,
      this.obstacleOutlineGeometry,
      this.obstacleEnvelopeGeometry,
      this.obstacleBodyMaterial,
      this.obstacleEnvelopeMaterial,
      this.obstacleOutlineMaterial
    ]);
    this.disposed = true;
    this.snapshot = Object.freeze({
      ...initialSnapshot(this.options.decorativeAsteroidCount, this.options.decorativeLandmarkCount),
      presentationRevision: this.snapshot.presentationRevision + 1,
      lifecycleOperation: "dispose"
    });
    this.clearCanvasEvidence();
  }

  getSnapshot(): WorldPresentationRenderSnapshot {
    return this.snapshot;
  }

  private updateSelectedTarget(source: WorldPresentationSnapshot, frame: FrameDescriptor): void {
    const target = source.selectedTarget;
    this.selectedTargetGroup.visible = target !== null;
    if (!target) {
      this.selectedTargetProxy.userData.sourceTargetId = undefined;
      this.selectedTargetProxy.userData.presentationState = undefined;
      return;
    }
    setPosition(this.selectedTargetGroup, project(target.position, frame));
    const distance = Math.hypot(
      target.position.x - source.shipState.position.x,
      target.position.y - source.shipState.position.y,
      target.position.z - source.shipState.position.z
    );
    const scale = distance >= 2_000 ? 22 : distance >= 900 ? 14 : distance >= 400 ? 9 : 5;
    const routeBelongsToSelectedTarget = source.route?.sourceTargetId === target.sourceTargetId
      && source.route.executorAssociation !== null;
    const hasAuthoritativeArrivalState = source.navigationState.executorStatus === "Arrived"
      || source.navigationState.routeLifecycle === "Arrived"
      || source.navigationState.routeLifecycle === "Completed"
      || source.navigationState.routeLifecycle === "Holding";
    const arrived = routeBelongsToSelectedTarget && hasAuthoritativeArrivalState;
    const presentationState = arrived ? "Arrived" : target.locked ? "Locked" : "Selected";
    const stateScale = presentationState === "Arrived" ? 0.82 : presentationState === "Locked" ? 1.12 : 1;
    this.selectedTargetProxy.scale.setScalar(scale * stateScale);
    this.selectedTargetProxy.quaternion.copy(this.options.camera.quaternion);
    this.selectedTargetMaterial.opacity = presentationState === "Arrived" ? 0.94 : presentationState === "Locked" ? 0.82 : 0.62;
    this.selectedTargetProxy.userData.presentationState = presentationState;
    this.selectedTargetProxy.userData.markerShape = presentationState === "Arrived" ? "ArrivalRing" : presentationState === "Locked" ? "LockedRing" : "SelectionRing";
    this.selectedTargetProxy.userData.sourceTargetId = target.sourceTargetId;
  }

  private updateNavigationBeacon(source: WorldPresentationSnapshot, frame: FrameDescriptor): void {
    const beacon = source.navigationBeacon;
    const selectedTarget = source.selectedTarget;
    const duplicatesSelectedTarget = beacon !== null
      && selectedTarget !== null
      && beacon.sourceTargetId === selectedTarget.sourceTargetId
      && samePosition(beacon.position, selectedTarget.position);
    this.navigationFocusGroup.visible = beacon !== null && !duplicatesSelectedTarget;
    if (!beacon || duplicatesSelectedTarget) {
      this.navigationBeacon.userData.sourceTargetId = undefined;
      return;
    }
    setPosition(this.navigationFocusGroup, project(beacon.position, frame));
    const distance = Math.hypot(
      beacon.position.x - source.shipState.position.x,
      beacon.position.y - source.shipState.position.y,
      beacon.position.z - source.shipState.position.z
    );
    const scale = distance >= 2_500 ? 9.5 : distance >= 900 ? 7 : distance >= 400 ? 5.4 : 4.2;
    this.navigationBeacon.scale.setScalar(scale);
    this.navigationBeacon.userData.sourceTargetId = beacon.sourceTargetId;
  }

  private updateRoute(route: WorldPresentationRoute | null, frame: FrameDescriptor): void {
    if (!route) {
      this.removeRoute();
      this.routeGroup.visible = false;
      return;
    }

    if (!this.route || this.route.sourcePlanHash !== route.sourcePlanHash) {
      this.removeRoute();
      this.route = this.createRoute(route);
      this.routeGroup.add(this.route.group);
    }

    this.routeGroup.visible = route.visibility !== "Hidden";
    const lines = this.route.group.children.filter((child): child is THREE.Line => child instanceof THREE.Line);
    for (const [index, segment] of route.segments.entries()) {
      const line = lines[index];
      const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const start = project(segment.start, frame);
      const end = project(segment.end, frame);
      positions.setXYZ(0, start.x, start.y, start.z);
      positions.setXYZ(1, end.x, end.y, end.z);
      positions.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      const material = line.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
      if (material instanceof THREE.LineDashedMaterial) {
        line.computeLineDistances();
      }
      this.applyRouteMaterialState(material, route, segment);
      line.renderOrder = segment.progress === "Active" ? 6 : segment.progress === "Completed" ? 3 : 4;
    }

    const endpointMarkers = this.route.group.children.filter((child) => child.userData.endpointMarker === true);
    for (const [index, marker] of endpointMarkers.entries()) {
      const segment = route.segments[index];
      setPosition(marker, project(segment.end, frame));
      marker.visible = segment.progress === "Active" || index === route.segments.length - 1 || route.visibility === "Blocked";
      marker.scale.setScalar(route.visibility === "Blocked" ? 1.2 : segment.progress === "Active" ? 1.8 : 1.35);
    }
  }

  private createRoute(route: WorldPresentationRoute): RouteRecord {
    const group = new THREE.Group();
    group.name = "world-presentation-route-identity";
    group.userData.sourcePlanHash = route.sourcePlanHash;
    const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
    for (const segment of route.segments) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const material = new THREE.LineDashedMaterial({
        color: segment.kind === "Avoidance" ? 0xffb04a : 0x31d9ff,
        dashSize: 8,
        gapSize: 5,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        depthTest: false
      });
      const line = new THREE.Line(geometry, material);
      line.name = "world-presentation-route-segment";
      line.userData.sourceSegmentId = segment.sourceSegmentId;
      line.frustumCulled = false;
      group.add(line);
      resources.push(geometry, material);

      const markerGeometry = segment.kind === "Terminal"
        ? new THREE.TorusGeometry(1.8, 0.32, 6, 16)
        : new THREE.OctahedronGeometry(1.15, 0);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: segment.kind === "Avoidance" ? 0xffb04a : 0x31d9ff,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        depthTest: false
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.name = "world-presentation-route-endpoint";
      marker.userData.endpointMarker = true;
      marker.userData.sourceSegmentId = segment.sourceSegmentId;
      marker.frustumCulled = false;
      marker.renderOrder = 7;
      group.add(marker);
      resources.push(markerGeometry, markerMaterial);
    }
    return {
      sourcePlanHash: route.sourcePlanHash,
      geometrySignature: routeGeometrySignature(route),
      group,
      segmentIds: Object.freeze(route.segments.map((segment) => segment.sourceSegmentId)),
      resources
    };
  }

  private applyRouteMaterialState(
    material: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
    route: WorldPresentationRoute,
    segment: WorldPresentationRouteSegment
  ): void {
    material.opacity = route.visibility === "Blocked"
      ? 0.22
      : segment.progress === "Completed"
        ? 0.24
        : segment.progress === "Active"
          ? 0.96
          : route.lifecycle === "Preview" ? 0.58 : 0.82;
    if (material instanceof THREE.LineDashedMaterial) {
      material.dashSize = route.visibility === "Blocked" ? 2.2 : segment.kind === "Avoidance" ? 4 : route.lifecycle === "Preview" ? 8 : 100_000;
      material.gapSize = route.visibility === "Blocked" ? 7 : segment.kind === "Avoidance" ? 6 : route.lifecycle === "Preview" ? 5 : 0.01;
    }
  }

  private validateRoute(route: WorldPresentationRoute | null): void {
    if (route && this.route?.sourcePlanHash === route.sourcePlanHash && this.route.geometrySignature !== routeGeometrySignature(route)) {
      throw new Error(`Route geometry changed for stable sourcePlanHash ${route.sourcePlanHash}`);
    }
  }

  private removeRoute(): void {
    if (!this.route) {
      return;
    }
    this.routeGroup.remove(this.route.group);
    disposeResources(this.route.resources);
    this.route = null;
  }

  private updateObstacles(obstacles: readonly WorldPresentationObstacle[], frame: FrameDescriptor): void {
    const eligible = new Set(obstacles.filter((obstacle) => obstacle.renderEligible).map((obstacle) => obstacle.sourceObstacleId));
    for (const [id, record] of this.obstacles) {
      if (!eligible.has(id)) {
        this.obstacleGroup.remove(record.group);
        this.obstacles.delete(id);
      }
    }

    for (const obstacle of obstacles) {
      if (!obstacle.renderEligible) {
        continue;
      }
      let record = this.obstacles.get(obstacle.sourceObstacleId);
      if (!record) {
        const group = new THREE.Group();
        group.name = "world-presentation-truth-obstacle";
        group.userData.sourceObstacleId = obstacle.sourceObstacleId;
        const body = new THREE.Mesh(this.obstacleBodyGeometry, this.obstacleBodyMaterial);
        const outline = new THREE.LineSegments(this.obstacleOutlineGeometry, this.obstacleOutlineMaterial);
        const envelope = new THREE.Mesh(this.obstacleEnvelopeGeometry, this.obstacleEnvelopeMaterial);
        body.name = "truth-obstacle-body";
        outline.name = "truth-obstacle-navigation-outline";
        envelope.name = "truth-obstacle-padding-envelope";
        body.frustumCulled = false;
        outline.frustumCulled = false;
        envelope.frustumCulled = false;
        body.renderOrder = 2;
        outline.renderOrder = 4;
        envelope.renderOrder = 3;
        group.add(body, outline, envelope);
        this.obstacleGroup.add(group);
        record = { sourceObstacleId: obstacle.sourceObstacleId, group };
        this.obstacles.set(obstacle.sourceObstacleId, record);
      }
      setPosition(record.group, project(obstacle.center, frame));
      const [body, outline, envelope] = record.group.children;
      body.scale.setScalar(obstacle.radius);
      outline.scale.setScalar(obstacle.radius);
      envelope.scale.setScalar(obstacle.radius + obstacle.padding);
    }
  }

  private publishCanvasEvidence(snapshot: WorldPresentationRenderSnapshot): void {
    const canvas = this.options.canvas;
    if (!canvas) {
      return;
    }
    canvas.removeAttribute("data-world-presentation-revision");
    const values: readonly (readonly [string, string])[] = [
      ["data-selected-target-proxy-visible", String(snapshot.selectedTargetProxyVisible)],
      ["data-route-proxy-visible", String(snapshot.routeProxyVisible)],
      ["data-route-proxy-visibility", snapshot.routeProxyVisibility ?? "None"],
      ["data-route-proxy-segment-count", String(snapshot.routeProxySegmentCount)],
      ["data-truth-obstacle-proxy-count", String(snapshot.truthBackedObstacleProxyCount)],
      ["data-runtime-truth-obstacle-count", String(snapshot.runtimeTruthObstacleCount)],
      ["data-navigation-focus-beacon-count", String(snapshot.navigationFocusBeaconCount)],
      ["data-decorative-asteroid-count", String(snapshot.decorativeAsteroidCount)],
      ["data-decorative-objects-excluded-from-radar", "true"],
      ["data-renderer-owns-world-truth", "false"]
    ];
    for (const [name, value] of values) {
      canvas.setAttribute(name, value);
    }
    canvas.setAttribute("data-world-presentation-revision", String(snapshot.presentationRevision));
  }

  private clearCanvasEvidence(): void {
    const canvas = this.options.canvas;
    if (!canvas) {
      return;
    }
    canvas.removeAttribute("data-world-presentation-revision");
    for (const name of CANVAS_ATTRIBUTES) {
      canvas.removeAttribute(name);
    }
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error("WorldPresentationRenderer is disposed");
    }
  }
}
