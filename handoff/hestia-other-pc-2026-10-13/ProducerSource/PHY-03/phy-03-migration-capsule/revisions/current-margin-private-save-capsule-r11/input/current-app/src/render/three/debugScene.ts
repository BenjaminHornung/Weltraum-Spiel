import * as THREE from "three";
import { vec3 } from "../../core";
import { browserObstacles, browserTargetCatalog, type BrowserRuntimeController } from "../../runtime/browserRuntime";
import type { GraphicsRuntimePort } from "../../settings";
import type { CameraMode } from "../../runtime/input";
import { renderStatusHud } from "../../ui/statusHud";
import type { FrameDescriptor } from "../../world/frames";
import type { LowPolyInstanceBatch } from "../../world/lowPolyInstances";
import { playableLargeFieldVisualLandmarks, provingGroundAsteroidField } from "../../world/provingGroundWorld";
import {
  buildWorldPresentationSnapshot,
  type WorldPresentationEntity,
  type WorldPresentationRoute,
  type WorldPresentationRouteSegment,
  type WorldPresentationTarget,
  type WorldPresentationWorldProvenance
} from "../../world/worldPresentation";
import type { WorldEntityState } from "../../world/floatingOrigin";
import { createDemoScoutShipVisual, type ShipVisualSnapshot } from "./shipVisual";
import { ThreeGraphicsSettingsAdapter } from "./graphicsSettingsAdapter";
import { WorldPresentationRenderer, type WorldPresentationRenderSnapshot } from "./worldPresentationRenderer";

const toVector3 = (value: { x: number; y: number; z: number }) => new THREE.Vector3(value.x, value.y, value.z);
const fromVector3 = (value: THREE.Vector3) => ({ x: value.x, y: value.y, z: value.z });

export const applyDecorativePresentationMetadata = <T extends THREE.Object3D>(object: T): T => {
  Object.assign(object.userData, {
    renderOnly: true,
    truthBacked: false,
    radarVisible: false,
    collisionRelevant: false
  });
  return object;
};

export const applyWorldEntityPresentationMetadata = <T extends THREE.Object3D>(object: T): T => {
  Object.assign(object.userData, {
    renderOnly: false,
    truthBacked: true,
    radarVisible: true,
    collisionRelevant: false
  });
  return object;
};

export interface WorldEntityInstanceTransform {
  readonly sourceEntityId: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationEuler: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale: number;
}

export const resolveWorldEntityInstanceTransforms = (
  batch: LowPolyInstanceBatch,
  entities: readonly WorldPresentationEntity[],
  frame: FrameDescriptor
): readonly WorldEntityInstanceTransform[] => {
  const entityById = new Map<string, WorldPresentationEntity>();
  for (const entity of entities) {
    if (entityById.has(entity.sourceEntityId)) {
      throw new Error(`Duplicate world presentation entity id: ${entity.sourceEntityId}`);
    }
    entityById.set(entity.sourceEntityId, entity);
  }
  return Object.freeze(batch.instances.map((instance, index): WorldEntityInstanceTransform => {
    const entity = entityById.get(instance.sourceEntityId);
    const position = entity
      ? {
        x: entity.absolutePosition.x - frame.originAbsolutePosition.x,
        y: entity.absolutePosition.y - frame.originAbsolutePosition.y,
        z: entity.absolutePosition.z - frame.originAbsolutePosition.z
      }
      : { x: 0, y: 0, z: 0 };
    return Object.freeze({
      sourceEntityId: instance.sourceEntityId,
      position,
      rotationEuler: {
        x: (index % 7) * 0.31,
        y: (index % 11) * 0.23,
        z: (index % 5) * 0.41
      },
      scale: entity?.renderEligible ? instance.localScale : 0
    });
  }));
};

export interface DecorativePresentationInventory {
  readonly baseAsteroidSources: readonly WorldEntityState[];
  readonly baseAsteroidCount: number;
  readonly beltAsteroidCount: number;
  readonly decorativeAsteroidCount: number;
  readonly landmarkCount: number;
  readonly worldEntityCount: number;
  readonly worldEntityLandmarkCount: number;
}

export const deriveDecorativePresentationInventory = (
  sources: readonly WorldEntityState[],
  landmarks: readonly WorldEntityState[],
  beltAsteroidCount: number
): DecorativePresentationInventory => {
  if (!Number.isInteger(beltAsteroidCount) || beltAsteroidCount < 0) {
    throw new Error("beltAsteroidCount must be a non-negative integer");
  }
  const landmarkIds = new Set(landmarks.map((landmark) => landmark.id));
  const baseAsteroidSources = Object.freeze(sources.filter((source) => !landmarkIds.has(source.id)));
  return Object.freeze({
    baseAsteroidSources,
    baseAsteroidCount: baseAsteroidSources.length,
    beltAsteroidCount,
    decorativeAsteroidCount: beltAsteroidCount,
    landmarkCount: 0,
    worldEntityCount: sources.length,
    worldEntityLandmarkCount: landmarks.length
  });
};

export interface RenderPresentationEvidence {
  readonly selectedTargetProxyVisible: boolean;
  readonly selectedTargetProxyId: string | null;
  readonly routeProxyVisible: boolean;
  readonly routeProxyVisibility: "Visible" | "Hidden" | "Blocked" | null;
  readonly routeProxyPlanHash: string | null;
  readonly routeProxySegmentCount: number;
  readonly activeRouteProxySegmentId: string | null;
  readonly routeSegmentIds: readonly string[];
  readonly routeSegments: readonly WorldPresentationRouteSegment[];
  readonly selectedTarget: WorldPresentationTarget | null;
  readonly sourceNavigationMapSignature: string | null;
  readonly worldEntities: readonly WorldPresentationEntity[];
  readonly worldProvenance: WorldPresentationWorldProvenance | null;
  readonly truthBackedObstacleProxyCount: number;
  readonly runtimeTruthObstacleCount: number;
  readonly worldEntitySlotCount: number;
  readonly worldEntityCount: number;
  readonly residentWorldEntityCount: number;
  readonly visibleWorldEntityCount: number;
  readonly landmarkWorldEntityCount: number;
  readonly ambientWorldEntityCount: number;
  readonly decorativeAsteroidCount: number;
  readonly decorativeLandmarkCount: number;
  readonly decorativeObjectsExcludedFromRadar: true;
  readonly rendererOwnsWorldTruth: false;
  readonly worldPresentationSignature: string | null;
  readonly renderFrameRevision: number;
  readonly renderFrameDelta: number;
  readonly navigationFocusBeaconCount: number;
  readonly selectedTargetProjectedPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
}

export const mergeWorldPresentationRenderEvidence = <T extends object>(
  legacySnapshot: T,
  presentation: WorldPresentationRenderSnapshot
): T & RenderPresentationEvidence => ({
  ...legacySnapshot,
  selectedTargetProxyVisible: presentation.selectedTargetProxyVisible,
  selectedTargetProxyId: presentation.selectedTargetProxyId,
  routeProxyVisible: presentation.routeProxyVisible,
  routeProxyVisibility: presentation.routeProxyVisibility,
  routeProxyPlanHash: presentation.routeProxyPlanHash,
  routeProxySegmentCount: presentation.routeProxySegmentCount,
  activeRouteProxySegmentId: presentation.activeRouteProxySegmentId,
  routeSegmentIds: presentation.routeSegmentIds,
  routeSegments: presentation.routeSegments,
  selectedTarget: presentation.selectedTarget,
  sourceNavigationMapSignature: presentation.sourceNavigationMapSignature,
  worldEntities: presentation.worldEntities,
  worldProvenance: presentation.worldProvenance,
  truthBackedObstacleProxyCount: presentation.truthBackedObstacleProxyCount,
  runtimeTruthObstacleCount: presentation.runtimeTruthObstacleCount,
  worldEntitySlotCount: presentation.worldEntitySlotCount,
  worldEntityCount: presentation.worldEntityCount,
  residentWorldEntityCount: presentation.residentWorldEntityCount,
  visibleWorldEntityCount: presentation.visibleWorldEntityCount,
  landmarkWorldEntityCount: presentation.landmarkWorldEntityCount,
  ambientWorldEntityCount: presentation.ambientWorldEntityCount,
  decorativeAsteroidCount: presentation.decorativeAsteroidCount,
  decorativeLandmarkCount: presentation.decorativeLandmarkCount,
  decorativeObjectsExcludedFromRadar: presentation.decorativeObjectsExcludedFromRadar,
  rendererOwnsWorldTruth: presentation.rendererOwnsWorldTruth,
  worldPresentationSignature: presentation.worldPresentationSignature,
  renderFrameRevision: presentation.renderFrameRevision,
  renderFrameDelta: presentation.renderFrameDelta,
  navigationFocusBeaconCount: presentation.navigationFocusBeaconCount,
  selectedTargetProjectedPosition: presentation.selectedTargetProjectedPosition
});

export interface RenderDebugSnapshot extends RenderPresentationEvidence {
  readonly shipPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly usesInterpolatedPose: boolean;
  readonly interpolationAlpha: number;
  readonly truthShipPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly renderedShipPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly truthShipOrientation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly renderedShipOrientation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly fixedStepCountThisFrame: number;
  readonly frameDeltaSeconds: number;
  readonly cameraSmoothingAlpha: number;
  readonly targetPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly lockedTargetPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly selectedTargetId: string | null;
  readonly selectedTargetLabel: string | null;
  readonly routePreviewPlanHash: string | null;
  readonly routePreviewTargetPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly routePreviewSegmentCount: number;
  readonly targetVisible: boolean;
  readonly executorStatus: string;
  readonly distanceToTarget: number;
  readonly arrivalRadius: number | null;
  readonly planHash: string | null;
  readonly shipOrientation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
  readonly shipVisual: ShipVisualSnapshot;
  readonly camera: {
    readonly mode: CameraMode;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly followTarget: { readonly x: number; readonly y: number; readonly z: number };
    readonly followsShip: boolean;
    readonly distanceToShip: number;
    readonly anchorId: string;
    readonly anchorSource: string;
    readonly anchorLocalPosition: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly lowPolyInstanceBatch: {
    readonly id: string;
    readonly batchKey: string;
    readonly sourceId: string | null;
    readonly frameId: string;
    readonly count: number;
    readonly maxInstances: number;
    readonly renderOnly: true;
    readonly rendererOwnsWorldTruth: false;
  };
  readonly targetBeaconCount: number;
  readonly runtimeObstacleCount: number;
}

export interface DebugSceneOptions {
  readonly lowPolyInstanceBatch: LowPolyInstanceBatch;
  readonly antiAliasing?: boolean;
  readonly showDebugGrid?: boolean;
  readonly surface?: "flight" | "combat";
  readonly showDebugHelpers?: boolean;
}

export class DebugScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1_000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly shipVisual = createDemoScoutShipVisual();
  private readonly asteroidBatch: LowPolyInstanceBatch;
  private readonly asteroidField: THREE.InstancedMesh;
  private readonly cinematicAsteroidBelt: THREE.InstancedMesh;
  private readonly decorativeInventory: DecorativePresentationInventory;
  private readonly worldPresentationRenderer: WorldPresentationRenderer;
  private readonly graphicsSettingsAdapter: ThreeGraphicsSettingsAdapter;
  private readonly routeGroup = new THREE.Group();
  private readonly targetBeaconGroup = new THREE.Group();
  private readonly obstacleGroup = new THREE.Group();
  private readonly target: THREE.Mesh;
  private frameHandle = 0;
  private lastTime = performance.now();
  private lastDrawnPlanHash: string | null = null;
  private readonly pressedKeys = new Set<string>();
  private orbitYaw = -0.35;
  private orbitPitch = 0.28;
  private orbitDistance = 42;
  private isOrbiting = false;
  private modalWasOpen = false;
  private shipVisualSourceState = this.shipVisual.getSnapshot().visualSource.state;
  private pointerLast = { x: 0, y: 0 };
  private renderSnapshot: RenderDebugSnapshot;
  private readonly surface: NonNullable<DebugSceneOptions["surface"]>;
  private readonly showDebugHelpers: boolean;
  private worldPresentationFrameRevision = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly runtime: BrowserRuntimeController, options: DebugSceneOptions) {
    this.surface = options.surface ?? "flight";
    this.showDebugHelpers = options.showDebugHelpers ?? false;
    this.asteroidBatch = options.lowPolyInstanceBatch;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: options.antiAliasing ?? true, alpha: false });
    this.renderer.setClearColor(0x020713, 1);
    this.scene.background = new THREE.Color(0x020713);
    this.scene.fog = new THREE.FogExp2(0x061224, 0.00042);
    this.camera.far = 5_000;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 80, 150);
    this.camera.lookAt(55, 0, -20);

    const ambient = new THREE.AmbientLight(0x7ea6ff, 0.92);
    const key = new THREE.DirectionalLight(0xffffff, 2.85);
    key.position.set(-42, 96, 72);
    const rim = new THREE.DirectionalLight(0x35d9ff, 1.45);
    rim.position.set(-120, 28, -90);
    const fill = new THREE.PointLight(0xffb04a, 36, 620, 1.6);
    fill.position.set(-72, 18, 44);
    this.scene.add(ambient, key, rim, fill);

    if (options.showDebugGrid) {
      const grid = new THREE.GridHelper(3_000, 30, 0x294568, 0x152236);
      grid.position.y = -6;
      this.scene.add(grid);
    }

    this.cinematicAsteroidBelt = this.createCinematicAsteroidBelt();
    this.scene.add(this.createStarField(), this.createDistantPlanet(), this.cinematicAsteroidBelt);

    this.scene.add(this.shipVisual.group);

    this.asteroidField = applyWorldEntityPresentationMetadata(new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(3.2, 0),
      new THREE.MeshStandardMaterial({ color: 0x8d8f94, roughness: 0.96, metalness: 0.03, flatShading: true }),
      this.asteroidBatch.instances.length
    ));
    this.asteroidField.name = "navigation-map-world-entities";
    this.asteroidField.userData.sourceEntityIds = this.asteroidBatch.instances.map((instance) => instance.sourceEntityId);
    this.writeWorldEntityInstanceMatrices([]);
    this.asteroidField.visible = this.surface === "flight";
    this.scene.add(this.asteroidField);

    this.target = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), new THREE.MeshStandardMaterial({
      color: 0x31d9ff,
      emissive: 0x0f7fa0,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.62,
      roughness: 0.3
    }));
    this.scene.add(this.target);

    this.populateTargetBeaconMarkers();
    this.populateObstacleMarkers();
    this.scene.add(this.targetBeaconGroup);
    this.scene.add(this.obstacleGroup);
    this.scene.add(this.routeGroup);
    this.routeGroup.visible = this.showDebugHelpers;
    this.targetBeaconGroup.visible = this.showDebugHelpers;
    this.obstacleGroup.visible = this.showDebugHelpers;

    this.decorativeInventory = deriveDecorativePresentationInventory(
      provingGroundAsteroidField,
      playableLargeFieldVisualLandmarks,
      this.cinematicAsteroidBelt.count
    );
    this.worldPresentationRenderer = new WorldPresentationRenderer({
      parent: this.scene,
      camera: this.camera,
      canvas,
      decorativeAsteroidCount: this.decorativeInventory.decorativeAsteroidCount,
      decorativeLandmarkCount: this.decorativeInventory.landmarkCount,
      worldEntitySlotCount: this.asteroidBatch.instances.length
    });
    this.graphicsSettingsAdapter = new ThreeGraphicsSettingsAdapter({
      renderer: this.renderer,
      camera: this.camera,
      scene: this.scene,
      canvas,
      fullscreenElement: document.documentElement
    });
    this.renderSnapshot = this.createInitialRenderSnapshot();

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("contextmenu", this.preventContextMenu);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.resize();
    this.drawPlan(null, null);
  }

  start(): void {
    const render = (time: number) => {
      const elapsed = Math.min(0.1, (time - this.lastTime) / 1_000);
      this.lastTime = time;
      this.dispatchManualInput(elapsed);
      const telemetry = this.runtime.advance(elapsed);
      const presentation = this.runtime.getPresentationSnapshot();
      const position = toVector3(presentation.renderedShip.position);
      const orientation = presentation.renderedShip.orientation;
      const worldPresentation = buildWorldPresentationSnapshot({
        telemetry,
        renderFrameRevision: ++this.worldPresentationFrameRevision,
        landmarkEntityIds: playableLargeFieldVisualLandmarks.map((landmark) => landmark.id)
      });
      const targetDescriptor = worldPresentation.selectedTarget;
      const targetPosition = targetDescriptor?.position;
      const arrivalRadius = targetDescriptor?.arrivalRadius ?? null;
      this.writeWorldEntityInstanceMatrices(worldPresentation.entities);
      const drawnPlanHash = worldPresentation.route === null
        ? null
        : `${worldPresentation.route.sourcePlanHash}:${worldPresentation.route.lifecycle}:${worldPresentation.route.visibility}:${worldPresentation.route.segments.map((segment) => segment.sourceSegmentId).join(",")}`;
      if (drawnPlanHash !== this.lastDrawnPlanHash) {
        this.drawPlan(worldPresentation.route, drawnPlanHash);
      }
      this.shipVisual.updatePose(position, orientation);
      this.shipVisual.updateVfx(telemetry.ship.actuatorTelemetry, telemetry.ship.orientation);
      const cameraSnapshot = this.updateCamera(telemetry.manualInput?.cameraMode ?? "ChaseLocked", position, orientation, elapsed);
      const worldPresentationRender = this.worldPresentationRenderer.update(worldPresentation, this.asteroidBatch.frame);
      if (targetPosition && this.showDebugHelpers) {
        this.target.visible = true;
        this.target.position.copy(toVector3(targetPosition));
        const selectedTargetDistance = this.target.position.distanceTo(position);
        const selectedTargetScale = selectedTargetDistance >= 2_000 ? 4.5 : selectedTargetDistance >= 900 ? 3.1 : selectedTargetDistance >= 400 ? 2 : 1;
        this.target.scale.setScalar(selectedTargetScale);
      } else {
        this.target.visible = false;
      }
      const shipVisualSnapshot = this.shipVisual.getSnapshot();
      if (this.shipVisualSourceState === "Loading" && shipVisualSnapshot.visualSource.state !== "Loading") {
        this.graphicsSettingsAdapter.refreshManagedTextures();
      }
      this.shipVisualSourceState = shipVisualSnapshot.visualSource.state;
      this.renderSnapshot = mergeWorldPresentationRenderEvidence({
        shipPosition: fromVector3(position),
        usesInterpolatedPose: true,
        interpolationAlpha: Number(presentation.interpolationAlpha.toFixed(4)),
        truthShipPosition: telemetry.ship.position,
        renderedShipPosition: fromVector3(position),
        truthShipOrientation: telemetry.ship.orientation,
        renderedShipOrientation: orientation,
        fixedStepCountThisFrame: presentation.fixedStepCountThisFrame,
        frameDeltaSeconds: Number(presentation.frameDeltaSeconds.toFixed(6)),
        cameraSmoothingAlpha: cameraSnapshot.smoothingAlpha,
        targetPosition: this.target.visible ? fromVector3(this.target.position) : null,
        lockedTargetPosition: worldPresentation.route?.lifecycle === "Locked" ? worldPresentation.route.goal.position : null,
        selectedTargetId: targetDescriptor?.sourceTargetId ?? null,
        selectedTargetLabel: targetDescriptor?.label ?? null,
        routePreviewPlanHash: worldPresentation.route?.lifecycle === "Preview" ? worldPresentation.route.sourcePlanHash : null,
        routePreviewTargetPosition: worldPresentation.route?.lifecycle === "Preview" ? worldPresentation.route.goal.position : null,
        routePreviewSegmentCount: worldPresentation.route?.lifecycle === "Preview" ? worldPresentation.route.segments.length : 0,
        targetVisible: this.target.visible,
        executorStatus: telemetry.executor.status,
        distanceToTarget: telemetry.executor.distanceToTarget,
        arrivalRadius: arrivalRadius !== null && Number.isFinite(arrivalRadius) ? arrivalRadius : null,
        planHash: telemetry.executor.planHash,
        shipOrientation: orientation,
        shipVisual: shipVisualSnapshot,
        camera: cameraSnapshot,
        lowPolyInstanceBatch: this.createLowPolyInstanceBatchSnapshot(),
        targetBeaconCount: this.targetBeaconGroup.children.length,
        runtimeObstacleCount: this.obstacleGroup.children.length
      }, worldPresentationRender);
      this.updateHud();
      if (this.graphicsSettingsAdapter.scheduler.shouldPresent(time)) {
        this.renderer.render(this.scene, this.camera);
      }
      this.frameHandle = requestAnimationFrame(render);
    };

    this.frameHandle = requestAnimationFrame(render);
  }

  stop(): void {
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.worldPresentationRenderer.dispose();
  }

  getRenderSnapshot(): RenderDebugSnapshot {
    return this.renderSnapshot;
  }

  getGraphicsSettingsPort(): GraphicsRuntimePort {
    return this.graphicsSettingsAdapter;
  }

  private readonly resize = () => {
    this.graphicsSettingsAdapter.resize();
  };

  private drawPlan(plan: WorldPresentationRoute | null, renderKey: string | null): void {
    for (const child of this.routeGroup.children) {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    }
    this.routeGroup.clear();
    this.lastDrawnPlanHash = renderKey;
    this.routeGroup.visible = this.showDebugHelpers && plan !== null && plan.visibility !== "Hidden";
    if (!plan || plan.visibility === "Hidden") {
      return;
    }

    for (const segment of plan.segments) {
      const points = [toVector3(segment.start), toVector3(segment.end)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: segment.kind === "Avoidance" ? 0xff9d2e : 0x31d9ff, transparent: true, opacity: 0.78 });
      this.routeGroup.add(new THREE.Line(geometry, material));
    }
  }

  private seededUnit(index: number, salt: number): number {
    const raw = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;
    return raw - Math.floor(raw);
  }

  private createStarField(): THREE.Points {
    const count = 1_800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 900 + this.seededUnit(index, 1) * 3_700;
      const theta = this.seededUnit(index, 2) * Math.PI * 2;
      const phi = Math.acos(2 * this.seededUnit(index, 3) - 1);
      const x = Math.sin(phi) * Math.cos(theta) * radius + 520;
      const y = Math.cos(phi) * radius * 0.55;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      const offset = index * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      const cool = 0.78 + this.seededUnit(index, 4) * 0.22;
      colors[offset] = cool;
      colors[offset + 1] = 0.84 + this.seededUnit(index, 5) * 0.16;
      colors[offset + 2] = 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 5.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      vertexColors: true
    });
    const field = applyDecorativePresentationMetadata(new THREE.Points(geometry, material));
    field.name = "presentation-starfield";
    field.userData.graphicsDensityMode = "drawRange";
    field.userData.graphicsDensityBaseCount = count;
    field.renderOrder = -20;
    return field;
  }

  private createDistantPlanet(): THREE.Group {
    const group = applyDecorativePresentationMetadata(new THREE.Group());
    group.name = "presentation-distant-planet";
    const planet = applyDecorativePresentationMetadata(new THREE.Mesh(
      new THREE.SphereGeometry(68, 32, 18),
      new THREE.MeshStandardMaterial({ color: 0x496c87, roughness: 1, metalness: 0, flatShading: true })
    ));
    planet.position.set(720, 210, -520);
    const haze = applyDecorativePresentationMetadata(new THREE.Mesh(
      new THREE.SphereGeometry(75, 32, 18),
      new THREE.MeshBasicMaterial({ color: 0x31d9ff, transparent: true, opacity: 0.055, depthWrite: false })
    ));
    haze.position.copy(planet.position);
    group.add(planet, haze);
    return group;
  }

  private createCinematicAsteroidBelt(): THREE.InstancedMesh {
    const count = 150;
    const mesh = applyDecorativePresentationMetadata(new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x6f7075, roughness: 0.98, metalness: 0.02, flatShading: true }),
      count
    ));
    mesh.name = "presentation-render-only-asteroid-belt";
    mesh.userData.graphicsDensityMode = "instanceCount";
    mesh.userData.graphicsDensityBaseCount = count;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    for (let index = 0; index < count; index += 1) {
      const lane = index % 3;
      const x = 120 + this.seededUnit(index, 11) * 2_650;
      const y = -150 + this.seededUnit(index, 12) * 280 + lane * 8;
      const z = -820 + this.seededUnit(index, 13) * 1_640;
      const scaleValue = 2.4 + Math.pow(this.seededUnit(index, 14), 2.15) * 18;
      euler.set(
        this.seededUnit(index, 15) * Math.PI,
        this.seededUnit(index, 16) * Math.PI,
        this.seededUnit(index, 17) * Math.PI
      );
      rotation.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, y, z), rotation, new THREE.Vector3(scaleValue, scaleValue * (0.68 + this.seededUnit(index, 18) * 0.58), scaleValue));
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private writeWorldEntityInstanceMatrices(entities: readonly WorldPresentationEntity[]): void {
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const transforms = resolveWorldEntityInstanceTransforms(this.asteroidBatch, entities, this.asteroidBatch.frame);
    for (const [index, transform] of transforms.entries()) {
      const position = toVector3(transform.position);
      const scale = new THREE.Vector3(transform.scale, transform.scale, transform.scale);
      euler.set(transform.rotationEuler.x, transform.rotationEuler.y, transform.rotationEuler.z);
      rotation.setFromEuler(euler);
      matrix.compose(position, rotation, scale);
      this.asteroidField.setMatrixAt(index, matrix);
    }
    this.asteroidField.instanceMatrix.needsUpdate = true;
    this.asteroidField.computeBoundingSphere();
  }

  private createInitialRenderSnapshot(): RenderDebugSnapshot {
    return mergeWorldPresentationRenderEvidence({
      shipPosition: { x: 0, y: 0, z: 0 },
      usesInterpolatedPose: true,
      interpolationAlpha: 0,
      truthShipPosition: { x: 0, y: 0, z: 0 },
      renderedShipPosition: { x: 0, y: 0, z: 0 },
      truthShipOrientation: { x: 0, y: 0, z: 0, w: 1 },
      renderedShipOrientation: { x: 0, y: 0, z: 0, w: 1 },
      fixedStepCountThisFrame: 0,
      frameDeltaSeconds: 0,
      cameraSmoothingAlpha: 0,
      targetPosition: null,
      lockedTargetPosition: null,
      selectedTargetId: null,
      selectedTargetLabel: null,
      routePreviewPlanHash: null,
      routePreviewTargetPosition: null,
      routePreviewSegmentCount: 0,
      targetVisible: false,
      executorStatus: "Idle",
      distanceToTarget: 0,
      arrivalRadius: null,
      planHash: null,
      shipOrientation: { x: 0, y: 0, z: 0, w: 1 },
      shipVisual: this.shipVisual.getSnapshot(),
      camera: {
        mode: "ChaseLocked",
        position: fromVector3(this.camera.position),
        followTarget: { x: 0, y: 0, z: 0 },
        followsShip: true,
        distanceToShip: 0,
        anchorId: "chase-camera-anchor",
        anchorSource: "ManifestFallback",
        anchorLocalPosition: { x: -1.5, y: 1.3, z: 0 }
      },
      lowPolyInstanceBatch: this.createLowPolyInstanceBatchSnapshot(),
      targetBeaconCount: this.targetBeaconGroup.children.length,
      runtimeObstacleCount: this.obstacleGroup.children.length
    }, this.worldPresentationRenderer.getSnapshot());
  }

  private populateTargetBeaconMarkers(): void {
    const material = new THREE.MeshBasicMaterial({ color: 0x31d9ff, transparent: true, opacity: 0.54, depthWrite: false, depthTest: false });
    for (const target of browserTargetCatalog) {
      const distanceFromOrigin = Math.hypot(target.position.x, target.position.y, target.position.z);
      const markerScale = distanceFromOrigin >= 2_000 ? 5.8 : distanceFromOrigin >= 900 ? 3.6 : distanceFromOrigin >= 400 ? 2.4 : 0.9;
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), material);
      marker.name = `runtime-target-beacon:${target.id}`;
      marker.position.copy(toVector3(target.position));
      marker.scale.setScalar(markerScale);
      marker.renderOrder = 2;
      this.targetBeaconGroup.add(marker);
    }
  }

  private populateObstacleMarkers(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0x7b8088, transparent: true, opacity: 0.76, roughness: 0.96, metalness: 0.03, flatShading: true });
    for (const obstacle of browserObstacles) {
      const marker = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(1, obstacle.radius), 0), material);
      marker.name = `runtime-obstacle-truth:${obstacle.id}`;
      marker.position.copy(toVector3(obstacle.center));
      this.obstacleGroup.add(marker);
    }
  }

  private dispatchManualInput(elapsedSeconds: number): void {
    const inputBlocked = this.isPlayerInputBlocked();
    if (inputBlocked) {
      if (!this.modalWasOpen) {
        const input = this.runtime.getManualInput();
        const hasHeldFlightKey = [...this.pressedKeys].some((code) => this.isFlightKeyCode(code));
        const hasActiveManualAxis = Math.hypot(
          input.translationCommand.x,
          input.translationCommand.y,
          input.translationCommand.z,
          input.rotationCommand.x,
          input.rotationCommand.y,
          input.rotationCommand.z
        ) > 0.000001;
        if (hasHeldFlightKey || hasActiveManualAxis || this.isOrbiting) {
          void this.runtime.dispatchCommand({
            type: "SetManualFlightInput",
            input: {
              mainThrottleCommand: input.mainThrottleCommand,
              translationCommand: vec3(),
              rotationCommand: vec3()
            }
          });
        }
      }
      this.pressedKeys.clear();
      this.isOrbiting = false;
      this.modalWasOpen = true;
      return;
    }
    this.modalWasOpen = false;

    const input = this.runtime.getManualInput();
    let throttle = input.mainThrottleCommand;
    const throttleDelta = 0.85 * Math.max(0, elapsedSeconds);
    if (this.isPressed("ShiftLeft") || this.isPressed("ShiftRight") || this.isPressed("Shift")) {
      throttle += throttleDelta;
    }
    if (this.isPressed("ControlLeft") || this.isPressed("ControlRight") || this.isPressed("Control")) {
      throttle -= throttleDelta;
    }

    const pitch = this.axis("KeyW", "KeyS");
    const yaw = this.axis("KeyA", "KeyD");
    const roll = this.axis("KeyQ", "KeyE");
    const translationForward = this.axis("KeyW", "KeyS");
    const translationSide = this.axis("KeyD", "KeyA");
    const translationVertical = this.axis("KeyH", "KeyN");
    const translationCommand = input.controlMode === "Translation" ? vec3(translationForward, translationVertical, translationSide) : vec3();
    const rotationCommand = input.controlMode === "Translation" ? vec3(roll, 0, 0) : vec3(roll, -yaw, pitch);

    void this.runtime.dispatchCommand({
      type: "SetManualFlightInput",
      input: {
        mainThrottleCommand: throttle,
        translationCommand,
        rotationCommand
      }
    });
  }

  private updateCamera(mode: CameraMode, shipPosition: THREE.Vector3, orientation: { x: number; y: number; z: number; w: number }, deltaSeconds: number): RenderDebugSnapshot["camera"] & { readonly smoothingAlpha: number } {
    const shipQuaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w).normalize();
    const shipVisualSnapshot = this.shipVisual.getSnapshot();
    const descriptor = shipVisualSnapshot.descriptor.cameraAnchor;
    const cameraAnchorBinding = shipVisualSnapshot.cameraAnchorBinding;
    const localAnchor = toVector3(descriptor.localPosition).applyQuaternion(shipQuaternion);
    const followTarget = shipPosition.clone().add(localAnchor);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(shipQuaternion);
    const lookTarget = followTarget.clone().addScaledVector(forward, descriptor.lookAhead + 6);
    const chaseOffset = toVector3({ x: -22, y: 8, z: 0 }).applyQuaternion(shipQuaternion);
    let cameraPosition: THREE.Vector3;

    if (mode === "ChaseLocked") {
      cameraPosition = followTarget.clone().add(chaseOffset);
    } else if (mode === "Side") {
      cameraPosition = followTarget.clone().add(new THREE.Vector3(0, 12, 34).applyQuaternion(shipQuaternion));
    } else {
      const radius = this.orbitDistance;
      const cosPitch = Math.cos(this.orbitPitch);
      cameraPosition = followTarget.clone().add(
        new THREE.Vector3(
          Math.cos(this.orbitYaw) * cosPitch * radius,
          Math.sin(this.orbitPitch) * radius,
          Math.sin(this.orbitYaw) * cosPitch * radius
        )
      );
    }

    const smoothingLambda = mode === "ChaseLocked" ? 16 : 11;
    const smoothingAlpha = 1 - Math.exp(-smoothingLambda * Math.max(0, Math.min(0.1, deltaSeconds)));
    this.camera.position.lerp(cameraPosition, smoothingAlpha);
    this.camera.lookAt(mode === "FreeInspect" ? followTarget : lookTarget);
    return {
      mode,
      position: fromVector3(this.camera.position),
      followTarget: fromVector3(followTarget),
      followsShip: mode === "ChaseLocked" || mode === "Side",
      distanceToShip: Number(this.camera.position.distanceTo(shipPosition).toFixed(4)),
      anchorId: descriptor.id,
      anchorSource: cameraAnchorBinding.source,
      anchorLocalPosition: cameraAnchorBinding.localPosition,
      smoothingAlpha: Number(smoothingAlpha.toFixed(6))
    };
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (this.isPlayerInputBlocked()) {
      this.pressedKeys.clear();
      this.isOrbiting = false;
      if (this.isFlightKey(event)) {
        event.preventDefault();
      }
      return;
    }

    this.pressedKeys.add(event.code || event.key);
    if (this.isFlightKey(event)) {
      event.preventDefault();
    }
    if (event.repeat) {
      return;
    }
    if (event.code === "KeyX") {
      void this.runtime.dispatchCommand({ type: "SetThrottle", throttle: 0 });
    } else if (event.code === "KeyY" || event.code === "KeyZ") {
      void this.runtime.dispatchCommand({ type: "SetThrottle", throttle: 1 });
    } else if (event.code === "KeyR") {
      void this.runtime.dispatchCommand({ type: "ToggleRcs" });
    } else if (event.code === "KeyT") {
      void this.runtime.dispatchCommand({ type: "ToggleSas" });
    } else if (event.code === "CapsLock") {
      void this.runtime.dispatchCommand({ type: "CycleControlMode" });
    } else if (event.code === "KeyV") {
      void this.runtime.dispatchCommand({ type: "CycleCameraMode" });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code || event.key);
    if (this.isFlightKey(event)) {
      event.preventDefault();
    }
  };

  private readonly preventContextMenu = (event: Event) => event.preventDefault();

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (this.isPlayerInputBlocked()) {
      this.isOrbiting = false;
      return;
    }

    if (event.button !== 2) {
      return;
    }
    this.isOrbiting = true;
    this.pointerLast = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.button === 2) {
      this.isOrbiting = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.isPlayerInputBlocked()) {
      this.isOrbiting = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (!this.isOrbiting) {
      return;
    }
    const dx = event.clientX - this.pointerLast.x;
    const dy = event.clientY - this.pointerLast.y;
    this.pointerLast = { x: event.clientX, y: event.clientY };
    this.orbitYaw -= dx * 0.006;
    this.orbitPitch = Math.max(-1.1, Math.min(1.1, this.orbitPitch - dy * 0.006));
    event.preventDefault();
  };

  private readonly handleWheel = (event: WheelEvent) => {
    if (this.isPlayerInputBlocked()) {
      return;
    }

    this.orbitDistance = Math.max(16, Math.min(120, this.orbitDistance + event.deltaY * 0.04));
    event.preventDefault();
  };

  private isPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  private isPlayerInputBlocked(): boolean {
    const flightHud = document.getElementById("flight-hud");
    return flightHud?.getAttribute("data-planner-open") === "true"
      || flightHud?.getAttribute("data-flight-input-blocked") === "true";
  }

  private axis(positive: string, negative: string): number {
    return (this.isPressed(positive) ? 1 : 0) - (this.isPressed(negative) ? 1 : 0);
  }

  private isFlightKey(event: KeyboardEvent): boolean {
    return this.isFlightKeyCode(event.code);
  }

  private isFlightKeyCode(code: string): boolean {
    return ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyX", "KeyY", "KeyZ", "KeyR", "KeyT", "CapsLock", "KeyH", "KeyN", "KeyV"].includes(code);
  }

  private createLowPolyInstanceBatchSnapshot(): RenderDebugSnapshot["lowPolyInstanceBatch"] {
    return {
      id: this.asteroidBatch.id,
      batchKey: this.asteroidBatch.batchKey,
      sourceId: this.asteroidBatch.sourceId ?? null,
      frameId: this.asteroidBatch.frame.id,
      count: this.asteroidBatch.instances.length,
      maxInstances: this.asteroidBatch.maxInstances,
      renderOnly: this.asteroidBatch.renderOnly,
      rendererOwnsWorldTruth: this.asteroidBatch.rendererOwnsWorldTruth
    };
  }

  private updateHud(): void {
    const shipVisualSnapshot = this.shipVisual.getSnapshot();
    renderStatusHud(this.runtime.getTelemetry(), {
      dispatch: (command) => {
        return this.runtime.dispatchCommand(command);
      }
    }, shipVisualSnapshot.visualSource);
  }
}
