import * as THREE from "three";
import { arrivalRadiusForTarget, vec3, type RoutePlan } from "../../core";
import type { BrowserRuntimeController } from "../../runtime/browserRuntime";
import type { CameraMode } from "../../runtime/input";
import { renderStatusHud } from "../../ui/statusHud";
import type { LowPolyInstanceBatch } from "../../world/lowPolyInstances";
import { createProceduralShipVisual, type ShipVisualSnapshot } from "./shipVisual";

const toVector3 = (value: { x: number; y: number; z: number }) => new THREE.Vector3(value.x, value.y, value.z);
const fromVector3 = (value: THREE.Vector3) => ({ x: value.x, y: value.y, z: value.z });

export interface RenderDebugSnapshot {
  readonly shipPosition: { readonly x: number; readonly y: number; readonly z: number };
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
}

export interface DebugSceneOptions {
  readonly lowPolyInstanceBatch: LowPolyInstanceBatch;
}

export class DebugScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1_000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly shipVisual = createProceduralShipVisual();
  private readonly asteroidBatch: LowPolyInstanceBatch;
  private readonly asteroidField: THREE.InstancedMesh;
  private readonly routeGroup = new THREE.Group();
  private readonly target: THREE.Mesh;
  private readonly obstacle: THREE.Mesh;
  private frameHandle = 0;
  private lastTime = performance.now();
  private lastDrawnPlanHash: string | null = null;
  private readonly pressedKeys = new Set<string>();
  private orbitYaw = -0.35;
  private orbitPitch = 0.28;
  private orbitDistance = 42;
  private isOrbiting = false;
  private pointerLast = { x: 0, y: 0 };
  private renderSnapshot: RenderDebugSnapshot;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly runtime: BrowserRuntimeController, options: DebugSceneOptions) {
    this.asteroidBatch = options.lowPolyInstanceBatch;
    this.renderSnapshot = this.createInitialRenderSnapshot();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0x080b12);
    this.camera.position.set(0, 80, 150);
    this.camera.lookAt(55, 0, -20);

    const ambient = new THREE.AmbientLight(0x9fb8ff, 1.1);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(40, 80, 60);
    this.scene.add(ambient, key);

    const grid = new THREE.GridHelper(240, 24, 0x294568, 0x152236);
    grid.position.y = -6;
    this.scene.add(grid);

    this.scene.add(this.shipVisual.group);

    this.asteroidField = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(3.2, 0),
      new THREE.MeshStandardMaterial({ color: 0xb6a27a, roughness: 0.95, metalness: 0.02 }),
      this.asteroidBatch.instances.length
    );
    this.writeAsteroidInstanceMatrices();
    this.scene.add(this.asteroidField);

    this.target = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), new THREE.MeshStandardMaterial({ color: 0x80ff9f, emissive: 0x1c5a2a }));
    this.scene.add(this.target);

    this.obstacle = new THREE.Mesh(
      new THREE.IcosahedronGeometry(11, 0),
      new THREE.MeshStandardMaterial({ color: 0x9a6bff, roughness: 0.8, metalness: 0.05 })
    );
    this.scene.add(this.obstacle);
    this.scene.add(this.routeGroup);

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("contextmenu", this.preventContextMenu);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.resize();
    this.drawPlan(this.runtime.getLockedPlan());
  }

  start(): void {
    const render = (time: number) => {
      const elapsed = Math.min(0.1, (time - this.lastTime) / 1_000);
      this.lastTime = time;
      this.dispatchManualInput(elapsed);
      const telemetry = this.runtime.advance(elapsed);
      const position = toVector3(telemetry.ship.position);
      const orientation = telemetry.ship.orientation;
      const routePlan = telemetry.lockedPlan ?? telemetry.routePreview?.plan ?? null;
      const targetDescriptor = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? telemetry.routePreview?.target ?? null;
      const targetPosition = targetDescriptor?.position;
      const arrivalRadius = targetDescriptor ? arrivalRadiusForTarget(targetDescriptor) : null;
      const drawnPlanHash = routePlan?.planHash ?? null;
      if (drawnPlanHash !== this.lastDrawnPlanHash) {
        this.drawPlan(routePlan);
      }
      this.shipVisual.updatePose(position, orientation);
      this.shipVisual.updateVfx(telemetry.ship.actuatorTelemetry);
      const cameraSnapshot = this.updateCamera(telemetry.manualInput?.cameraMode ?? "ChaseLocked", position, orientation);
      if (targetPosition) {
        this.target.visible = true;
        this.target.position.copy(toVector3(targetPosition));
      } else {
        this.target.visible = false;
      }
      this.renderSnapshot = {
        shipPosition: fromVector3(position),
        targetPosition: this.target.visible ? fromVector3(this.target.position) : null,
        lockedTargetPosition: telemetry.lockedPlan?.target.position ?? null,
        selectedTargetId: targetDescriptor?.id ?? null,
        selectedTargetLabel: targetDescriptor?.label ?? null,
        routePreviewPlanHash: telemetry.routePreview?.plan?.planHash ?? null,
        routePreviewTargetPosition: telemetry.routePreview?.target?.position ?? null,
        routePreviewSegmentCount: telemetry.routePreview?.plan?.segments.length ?? 0,
        targetVisible: this.target.visible,
        executorStatus: telemetry.executor.status,
        distanceToTarget: telemetry.executor.distanceToTarget,
        arrivalRadius: arrivalRadius !== null && Number.isFinite(arrivalRadius) ? arrivalRadius : null,
        planHash: telemetry.executor.planHash,
        shipOrientation: orientation,
        shipVisual: this.shipVisual.getSnapshot(),
        camera: cameraSnapshot,
        lowPolyInstanceBatch: this.createLowPolyInstanceBatchSnapshot()
      };
      this.obstacle.position.set(58, 0, -14);
      this.updateHud();
      this.renderer.render(this.scene, this.camera);
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
  }

  getRenderSnapshot(): RenderDebugSnapshot {
    return this.renderSnapshot;
  }

  private readonly resize = () => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private drawPlan(plan: RoutePlan | null): void {
    this.routeGroup.clear();
    this.lastDrawnPlanHash = plan?.planHash ?? null;
    if (!plan) {
      return;
    }

    for (const segment of plan.segments) {
      const points = [toVector3(segment.start), toVector3(segment.end)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: segment.kind === "Avoidance" ? 0xffd166 : 0x66d9ef });
      this.routeGroup.add(new THREE.Line(geometry, material));
    }
  }

  private writeAsteroidInstanceMatrices(): void {
    const matrix = new THREE.Matrix4();
    for (const [index, instance] of this.asteroidBatch.instances.entries()) {
      const position = toVector3(instance.localPosition.value);
      const scale = new THREE.Vector3(instance.localScale, instance.localScale, instance.localScale);
      matrix.compose(position, new THREE.Quaternion(), scale);
      this.asteroidField.setMatrixAt(index, matrix);
    }
    this.asteroidField.instanceMatrix.needsUpdate = true;
  }

  private createInitialRenderSnapshot(): RenderDebugSnapshot {
    return {
      shipPosition: { x: 0, y: 0, z: 0 },
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
        distanceToShip: 0
      },
      lowPolyInstanceBatch: this.createLowPolyInstanceBatchSnapshot()
    };
  }

  private dispatchManualInput(elapsedSeconds: number): void {
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

  private updateCamera(mode: CameraMode, shipPosition: THREE.Vector3, orientation: { x: number; y: number; z: number; w: number }): RenderDebugSnapshot["camera"] {
    const shipQuaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w).normalize();
    const descriptor = this.shipVisual.descriptor.cameraAnchor;
    const localAnchor = toVector3(descriptor.localPosition).applyQuaternion(shipQuaternion);
    const followTarget = shipPosition.clone().add(localAnchor);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(shipQuaternion);
    const lookTarget = followTarget.clone().addScaledVector(forward, descriptor.lookAhead);
    const chaseOffset = toVector3(descriptor.chaseOffset).applyQuaternion(shipQuaternion);
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

    this.camera.position.lerp(cameraPosition, mode === "ChaseLocked" ? 0.24 : 0.18);
    this.camera.lookAt(mode === "FreeInspect" ? followTarget : lookTarget);
    return {
      mode,
      position: fromVector3(this.camera.position),
      followTarget: fromVector3(followTarget),
      followsShip: mode === "ChaseLocked" || mode === "Side",
      distanceToShip: Number(this.camera.position.distanceTo(shipPosition).toFixed(4))
    };
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
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
    this.orbitDistance = Math.max(16, Math.min(120, this.orbitDistance + event.deltaY * 0.04));
    event.preventDefault();
  };

  private isPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  private axis(positive: string, negative: string): number {
    return (this.isPressed(positive) ? 1 : 0) - (this.isPressed(negative) ? 1 : 0);
  }

  private isFlightKey(event: KeyboardEvent): boolean {
    return ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyX", "KeyY", "KeyZ", "KeyR", "KeyT", "CapsLock", "KeyH", "KeyN", "KeyV"].includes(event.code);
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
    renderStatusHud(this.runtime.getTelemetry(), {
      dispatch: (command) => {
        const telemetry = this.runtime.dispatchCommand(command);
        this.drawPlan(telemetry.lockedPlan ?? telemetry.routePreview?.plan ?? null);
      }
    });
  }
}
