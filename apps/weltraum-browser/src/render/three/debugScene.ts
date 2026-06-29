import * as THREE from "three";
import { arrivalRadiusForTarget, type RoutePlan } from "../../core";
import type { BrowserRuntimeController } from "../../runtime/browserRuntime";
import { renderStatusHud } from "../../ui/statusHud";

const toVector3 = (value: { x: number; y: number; z: number }) => new THREE.Vector3(value.x, value.y, value.z);
const fromVector3 = (value: THREE.Vector3) => ({ x: value.x, y: value.y, z: value.z });

export interface RenderDebugSnapshot {
  readonly shipPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly targetPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly lockedTargetPosition: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly targetVisible: boolean;
  readonly executorStatus: string;
  readonly distanceToTarget: number;
  readonly arrivalRadius: number | null;
  readonly planHash: string | null;
}

export class DebugScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1_000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ship: THREE.Mesh;
  private readonly routeGroup = new THREE.Group();
  private readonly target: THREE.Mesh;
  private readonly obstacle: THREE.Mesh;
  private frameHandle = 0;
  private lastTime = performance.now();
  private lastDrawnPlanHash: string | null = null;
  private renderSnapshot: RenderDebugSnapshot = {
    shipPosition: { x: 0, y: 0, z: 0 },
    targetPosition: null,
    lockedTargetPosition: null,
    targetVisible: false,
    executorStatus: "Idle",
    distanceToTarget: 0,
    arrivalRadius: null,
    planHash: null
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly runtime: BrowserRuntimeController) {
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

    this.ship = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 5), new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.42 }));
    this.ship.rotation.x = Math.PI / 2;
    this.scene.add(this.ship);

    this.target = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), new THREE.MeshStandardMaterial({ color: 0x80ff9f, emissive: 0x1c5a2a }));
    this.scene.add(this.target);

    this.obstacle = new THREE.Mesh(
      new THREE.IcosahedronGeometry(11, 0),
      new THREE.MeshStandardMaterial({ color: 0x9a6bff, roughness: 0.8, metalness: 0.05 })
    );
    this.scene.add(this.obstacle);
    this.scene.add(this.routeGroup);

    window.addEventListener("resize", this.resize);
    this.resize();
    this.drawPlan(this.runtime.getLockedPlan());
  }

  start(): void {
    const render = (time: number) => {
      const elapsed = Math.min(0.1, (time - this.lastTime) / 1_000);
      this.lastTime = time;
      const telemetry = this.runtime.advance(elapsed);
      const position = toVector3(telemetry.ship.position);
      const targetPosition = telemetry.lockedPlan?.target.position;
      const arrivalRadius = telemetry.lockedPlan ? arrivalRadiusForTarget(telemetry.lockedPlan.target) : null;
      if (telemetry.executor.planHash !== this.lastDrawnPlanHash) {
        this.drawPlan(telemetry.lockedPlan);
      }
      this.ship.position.copy(position);
      if (targetPosition) {
        this.ship.lookAt(toVector3(targetPosition));
        this.target.visible = true;
        this.target.position.copy(toVector3(targetPosition));
      } else {
        this.target.visible = false;
      }
      this.renderSnapshot = {
        shipPosition: fromVector3(this.ship.position),
        targetPosition: this.target.visible ? fromVector3(this.target.position) : null,
        lockedTargetPosition: targetPosition ?? null,
        targetVisible: this.target.visible,
        executorStatus: telemetry.executor.status,
        distanceToTarget: telemetry.executor.distanceToTarget,
        arrivalRadius: arrivalRadius !== null && Number.isFinite(arrivalRadius) ? arrivalRadius : null,
        planHash: telemetry.executor.planHash
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

  private updateHud(): void {
    renderStatusHud(this.runtime.getTelemetry(), {
      dispatch: (command) => {
        const telemetry = this.runtime.dispatchCommand(command);
        this.drawPlan(telemetry.lockedPlan);
      }
    });
  }
}
