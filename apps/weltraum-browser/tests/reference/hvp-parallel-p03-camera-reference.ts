// Frozen b3 oracle: no candidate camera/filter import. Historical syntax retained.
// Only factory export names and the listener import address differ from b3 bodies.
import * as THREE from "three";
import { Vector3 } from "three";
import {createHvpListeners} from "../../src/hestia-prototype/runtime/listeners";

export const P03_REFERENCE_SOURCE = Object.freeze({
  commit: "b3c6523a94cd050f5a9a22dc27f4777fcc03363e",
  cameraBlob: "3f87cadac0664db2b32aae04b25356bb0ead8c8d",
  playerBlob: "8bd196b8e2f6d05362e8368c0bec3167494b1463"
});

/** Render-only lag filter: never extrapolates or changes the solver position. */
export const createB3PlayerVisualPose = () => {
  const position = new Vector3();
  let initialized = false;
  return {
    position,
    update(target: Readonly<{ x: number; y: number; z: number }>, seconds: number, reset = false): void {
      if (![target.x, target.y, target.z, seconds].every(Number.isFinite) || seconds < 0) {
        throw new RangeError("Invalid player presentation sample");
      }
      const distance = position.distanceTo(new Vector3(target.x, target.y, target.z));
      if (!initialized || reset || distance > 2) {
        position.set(target.x, target.y, target.z); initialized = true; return;
      }
      const alpha = 1 - Math.exp(-seconds / 0.045);
      position.lerp(new Vector3(target.x, target.y, target.z), alpha);
    }
  };
};

export type HvpCameraMode = "Orbit" | "Fly";
export type HvpCameraPreset = "C01-EYE" | "C02-SHORE" | "C03-ROOTS" | "C04-WIDE" | "C05-ROCKARM" | "C07-QUARRY";

export interface HvpCameraPose {
  readonly mode: HvpCameraMode;
  readonly preset: HvpCameraPreset;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly quaternion: Readonly<{ x: number; y: number; z: number; w: number }>;
}

export interface HvpCameraController {
  readonly listenerCount:number;
  readonly mode: HvpCameraMode;
  readonly preset: HvpCameraPreset;
  setMode(mode: HvpCameraMode): void;
  setPreset(preset: HvpCameraPreset): void;
  reset(): void;
  update(deltaSeconds: number): void;
  readPose(): HvpCameraPose;
  checkpoint(): HvpCameraCheckpoint;
  restore(value:HvpCameraCheckpoint):void;
  dispose(): void;
}
export interface HvpCameraCheckpoint extends HvpCameraPose {readonly fov:number}

export interface HvpCameraOptions {
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly isInputBlocked?: () => boolean;
  readonly windowPort?: Pick<Window, "innerWidth" | "innerHeight" | "addEventListener" | "removeEventListener">;
}

const HVP_CAMERA_PRESETS: Record<HvpCameraPreset, { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number }> = {
  "C05-ROCKARM": {position:{x:4,y:2.5,z:-9},target:{x:7,y:1.5,z:-6},fov:50},
  "C07-QUARRY": {position:{x:-10,y:3.2,z:-12},target:{x:-10.5,y:1,z:-9},fov:55},
  "C01-EYE": {
    position: { x: -8, y: 3.15, z: -11 },
    target: { x: 0, y: 1, z: 5 },
    fov: 60
  },
  "C02-SHORE": {
    position: { x: -2, y: 1.25, z: -6 },
    target: { x: 1, y: -0.5, z: -2 },
    fov: 55
  },
  "C04-WIDE": {
    position: { x: -24, y: 18, z: -28 },
    target: { x: 0, y: 1, z: 1 },
    fov: 55
  },
  "C03-ROOTS": {
    position: { x: 3, y: 2.5, z: 4 },
    target: { x: 8, y: 4.5, z: 7 },
    fov: 60
  }
};

const MIN_PITCH = -Math.PI * 0.47;
const MAX_PITCH = Math.PI * 0.47;
const CAMERA_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight"]);

const isEditableTarget = (target: EventTarget | null): boolean => {
  const tagName = (target as { readonly tagName?: string } | null)?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "select" || tagName === "textarea" || tagName === "button";
};

const finiteDelta = (value: number): number => (Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.1) : 0);

export const createB3Camera = (options: HvpCameraOptions): HvpCameraController => {
  const listeners=createHvpListeners();
  const camera = options.camera;
  const canvas = options.canvas;
  const windowPort = options.windowPort ?? window;
  const target = new THREE.Vector3();
  const pressedKeys = new Set<string>();
  const hadTabIndex = canvas.hasAttribute("tabindex");
  const originalTabIndex = canvas.getAttribute("tabindex");
  let mode: HvpCameraMode = "Orbit";
  let preset: HvpCameraPreset = "C04-WIDE";
  let viewFov = HVP_CAMERA_PRESETS[preset].fov;
  let yaw = 0;
  let pitch = 0;
  let orbitRadius = 1;
  let activePointer: number | undefined;
  let disposed = false;
  // Native lock can precede the player's pointerlockchange/Play acknowledgement.
  const inputBlocked = (): boolean => options.isInputBlocked?.() === true || Boolean(canvas.ownerDocument?.pointerLockElement);

  const focusViewport = (): void => {
    if (disposed) return;
    canvas.focus({ preventScroll: true });
  };

  const forwardVector = (): THREE.Vector3 => new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).normalize();

  const applyView = (): void => {
    if (mode === "Orbit") {
      const offset = forwardVector().multiplyScalar(orbitRadius);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      return;
    }
    target.copy(camera.position).add(forwardVector().multiplyScalar(Math.max(orbitRadius, 10)));
    camera.lookAt(target);
  };

  const deriveOrbitAngles = (): void => {
    const offset = camera.position.clone().sub(target);
    orbitRadius = Math.max(2, offset.length());
    yaw = Math.atan2(offset.x, offset.z);
    pitch = Math.asin(THREE.MathUtils.clamp(offset.y / orbitRadius, -1, 1));
  };

  const applyPreset = (next: HvpCameraPreset): void => {
    preset = next;
    const pose = HVP_CAMERA_PRESETS[next];
    target.set(pose.target.x, pose.target.y, pose.target.z);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    viewFov = pose.fov;
    camera.fov = viewFov;
    camera.updateProjectionMatrix();
    deriveOrbitAngles();
    applyView();
  };

  const reset = (): void => {
    if (disposed) return;
    mode = "Orbit";
    applyPreset("C04-WIDE");
  };

  const setPreset = (next: HvpCameraPreset): void => {
    if (disposed) return;
    mode = "Orbit";
    applyPreset(next);
  };

  const setMode = (nextMode: HvpCameraMode): void => {
    if (disposed) return;
    if (nextMode === "Fly") focusViewport();
    if (mode === nextMode) return;
    if (nextMode === "Fly") {
      const direction = target.clone().sub(camera.position).normalize();
      yaw = Math.atan2(direction.x, direction.z);
      pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    } else {
      target.copy(camera.position).add(forwardVector().multiplyScalar(orbitRadius));
      deriveOrbitAngles();
    }
    mode = nextMode;
    applyView();
  };

  const pointerDown = (event: PointerEvent): void => {
    if (inputBlocked()) { return; }
    focusViewport();
    if (activePointer !== undefined || event.button !== 0) return;
    canvas.setPointerCapture?.(event.pointerId);
    activePointer = event.pointerId;
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent): void => {
    if (inputBlocked()) { return; }
    if (activePointer !== event.pointerId) return;
    yaw -= event.movementX * 0.005;
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.005, MIN_PITCH, MAX_PITCH);
    applyView();
  };

  const releasePointer = (event: PointerEvent): void => {
    if (activePointer !== event.pointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    activePointer = undefined;
  };

  const wheel = (event: WheelEvent): void => {
    if (inputBlocked()) { return; }
    event.preventDefault();
    if (mode === "Orbit") {
      orbitRadius = THREE.MathUtils.clamp(orbitRadius * Math.exp(event.deltaY * 0.001), 2, 240);
    } else {
      camera.position.addScaledVector(forwardVector(), -event.deltaY * 0.025);
    }
    applyView();
  };

  const keyDown = (event: KeyboardEvent): void => {
    if (inputBlocked()) { return; }
    if (isEditableTarget(event.target) || !CAMERA_KEYS.has(event.code)) return;
    pressedKeys.add(event.code);
    event.preventDefault();
  };

  const keyUp = (event: KeyboardEvent): void => {
    pressedKeys.delete(event.code);
  };

  const blur = (): void => {
    pressedKeys.clear();
  };

  const resize = (): void => {
    const width = Math.max(1, windowPort.innerWidth);
    const height = Math.max(1, windowPort.innerHeight);
    camera.aspect = width / height;
    if (!inputBlocked()) { camera.fov = viewFov; }
    camera.updateProjectionMatrix();
  };

  const update = (deltaSeconds: number): void => {
    if (inputBlocked()) { viewFov = camera.fov; pressedKeys.clear(); return; }
    if (disposed) return;
    if (mode !== "Fly" || pressedKeys.size === 0) return;
    const delta = finiteDelta(deltaSeconds);
    const speedMultiplier = pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")
      ? 3
      : pressedKeys.has("AltLeft") || pressedKeys.has("AltRight")
        ? 0.3
        : 1;
    const distance = 18 * speedMultiplier * delta;
    const forward = forwardVector();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const movement = new THREE.Vector3();
    if (pressedKeys.has("KeyW")) movement.add(forward);
    if (pressedKeys.has("KeyS")) movement.sub(forward);
    if (pressedKeys.has("KeyD")) movement.add(right);
    if (pressedKeys.has("KeyA")) movement.sub(right);
    if (pressedKeys.has("KeyE")) movement.y += 1;
    if (pressedKeys.has("KeyQ")) movement.y -= 1;
    if (movement.lengthSq() === 0) return;
    camera.position.addScaledVector(movement.normalize(), distance);
    applyView();
  };

  const readPose = (): HvpCameraPose => Object.freeze({
    mode,
    preset,
    position: Object.freeze({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    target: Object.freeze({ x: target.x, y: target.y, z: target.z }),
    quaternion: Object.freeze({ x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w })
  });
  const checkpoint=():HvpCameraCheckpoint=>{
    const pose=readPose(),direction=camera.getWorldDirection(new THREE.Vector3());
    const toTarget=target.clone().sub(camera.position);
    // Player readback may have moved the actual camera independently of Orbit.
    if(toTarget.lengthSq()>1e-12&&toTarget.normalize().dot(direction)>1-1e-10){return Object.freeze({...pose,fov:camera.fov});}
    const point=camera.position.clone().addScaledVector(direction,10);
    return Object.freeze({...pose,mode:"Fly",target:Object.freeze({x:point.x,y:point.y,z:point.z}),fov:camera.fov});
  };
  const restore=(pose:HvpCameraCheckpoint):void=>{
    if(disposed||inputBlocked()||!Object.hasOwn(HVP_CAMERA_PRESETS,pose.preset)||!["Orbit","Fly"].includes(pose.mode)
      ||!Number.isFinite(pose.fov)||pose.fov<=0||pose.fov>=180
      ||![pose.position.x,pose.position.y,pose.position.z,pose.target.x,pose.target.y,pose.target.z,
        pose.quaternion.x,pose.quaternion.y,pose.quaternion.z,pose.quaternion.w].every(Number.isFinite)
      ||Math.abs(Math.hypot(pose.quaternion.x,pose.quaternion.y,pose.quaternion.z,pose.quaternion.w)-1)>1e-6){throw new Error("Invalid camera restore");}
    pressedKeys.clear();if(activePointer!==undefined){canvas.releasePointerCapture?.(activePointer);activePointer=undefined;}
    mode=pose.mode;preset=pose.preset;target.set(pose.target.x,pose.target.y,pose.target.z);
    camera.position.set(pose.position.x,pose.position.y,pose.position.z);
    camera.quaternion.set(pose.quaternion.x,pose.quaternion.y,pose.quaternion.z,pose.quaternion.w);
    deriveOrbitAngles();
    if(mode==="Fly"){const d=camera.getWorldDirection(new THREE.Vector3());yaw=Math.atan2(d.x,d.z);pitch=Math.asin(THREE.MathUtils.clamp(d.y,-1,1));}
    viewFov=pose.fov;camera.fov=viewFov;camera.updateProjectionMatrix();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (activePointer !== undefined) canvas.releasePointerCapture?.(activePointer);
    listeners.dispose();
    pressedKeys.clear();
    activePointer = undefined;
    if (hadTabIndex) canvas.setAttribute("tabindex", originalTabIndex ?? "");
    else canvas.removeAttribute("tabindex");
  };

  canvas.setAttribute("tabindex", "0");
  listeners.add(canvas,"pointerdown",pointerDown as EventListener);
  listeners.add(canvas,"pointermove",pointerMove as EventListener);
  listeners.add(canvas,"pointerup",releasePointer as EventListener);
  listeners.add(canvas,"pointercancel",releasePointer as EventListener);
  listeners.add(canvas,"wheel",wheel as EventListener,{passive:false});
  listeners.add(windowPort,"keydown",keyDown as EventListener);
  listeners.add(windowPort,"keyup",keyUp as EventListener);
  listeners.add(windowPort,"blur",blur);
  listeners.add(windowPort,"resize",resize);
  resize();
  reset();

  return {
    get listenerCount(){return listeners.size;},
    get mode() { return mode; },
    get preset() { return preset; },
    setMode,
    setPreset,
    reset,
    update,
    readPose,
    checkpoint,restore,
    dispose
  };
};

// Verbatim protected source suffix, not an executable alternate avatar builder.
export const B3_AVATAR_SOURCE = `/** Small authored suit mesh at the capsule's real 1.8 m height, not a voxel source. */
export const createHvpAvatarMesh = (): HvpCompactMesh => {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  // Width/height/depth, then center relative to feet. All parts share one draw.
  const parts: readonly (readonly [number, number, number, number, number, number, number])[] = [
    [0.34, 0.32, 0.34, 0, 1.64, 0, 0xdee8e5],
    [0.29, 0.14, 0.025, 0, 1.65, -0.18, 0x155867],
    [0.45, 0.57, 0.28, 0, 1.18, 0, 0xcee2df],
    [0.25, 0.30, 0.06, 0, 1.21, -0.17, 0x268b8b],
    [0.34, 0.22, 0.27, 0, 0.79, 0, 0x305464],
    [0.17, 0.63, 0.19, -0.13, 0.39, 0, 0x54717b],
    [0.17, 0.63, 0.19, 0.13, 0.39, 0, 0x54717b],
    [0.20, 0.12, 0.29, -0.13, 0.06, -0.045, 0x263b47],
    [0.20, 0.12, 0.29, 0.13, 0.06, -0.045, 0x263b47],
    [0.14, 0.54, 0.16, -0.30, 1.17, 0, 0xd7e0d8],
    [0.14, 0.54, 0.16, 0.30, 1.17, 0, 0xd7e0d8],
    [0.14, 0.13, 0.17, -0.30, 0.84, 0, 0xba702c],
    [0.14, 0.13, 0.17, 0.30, 0.84, 0, 0xba702c],
    [0.32, 0.40, 0.16, 0, 1.2, 0.21, 0x37636c]
  ];
  for (const [w, h, d, x, y, z, tint] of parts) {
    const box = new BoxGeometry(w, h, d);
    const rgb = new Color(tint);
    try {
      const p = box.getAttribute("position"), n = box.getAttribute("normal"), base = positions.length / 3;
      for (let v = 0; v < p.count; v += 1) {
        positions.push(p.getX(v) + x, p.getY(v) + y - HVP_PLAYER_PROFILE.height / 2, p.getZ(v) + z);
        normals.push(n.getX(v), n.getY(v), n.getZ(v)); colors.push(rgb.r, rgb.g, rgb.b);
      }
      for (const index of box.index!.array) { indices.push(base + index); }
    } finally { box.dispose(); }
  }
  return { faceCount: parts.length * 6, unitFaceCount: parts.length * 6, outerFaceCount: parts.length * 6, cavityFaceCount: 0,
    positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), indices: new Uint16Array(indices),
    materialRanges: [{ slot: 1, startIndex: 0, indexCount: indices.length }],
    boundsMeters: { min: { x: -0.38, y: -0.9, z: -0.21 }, max: { x: 0.38, y: 0.9, z: 0.30 } },
    sourceDigest: "hvp-suit-model-v1", algorithmVersion: "authored-box-model-v1",
    tempEstimateBytes: (positions.length + normals.length + colors.length + indices.length) * 8 };
};
`;
