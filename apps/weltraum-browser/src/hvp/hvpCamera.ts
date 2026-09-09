import * as THREE from "three";

export type HvpCameraMode = "Orbit" | "Fly";
export type HvpCameraPreset = "C01-EYE" | "C04-WIDE";

export interface HvpCameraPose {
  readonly mode: HvpCameraMode;
  readonly preset: HvpCameraPreset;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly quaternion: Readonly<{ x: number; y: number; z: number; w: number }>;
}

export interface HvpCameraController {
  readonly mode: HvpCameraMode;
  readonly preset: HvpCameraPreset;
  setMode(mode: HvpCameraMode): void;
  setPreset(preset: HvpCameraPreset): void;
  reset(): void;
  update(deltaSeconds: number): void;
  readPose(): HvpCameraPose;
  dispose(): void;
}

export interface HvpCameraOptions {
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly windowPort?: Pick<Window, "innerWidth" | "innerHeight" | "addEventListener" | "removeEventListener">;
}

const HVP_CAMERA_PRESETS: Record<HvpCameraPreset, { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }> = {
  "C01-EYE": {
    position: { x: 6, y: 2.4, z: 10 },
    target: { x: 0, y: 0.2, z: 0 }
  },
  "C04-WIDE": {
    position: { x: 20, y: 15, z: 24 },
    target: { x: 0, y: -1, z: 0 }
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

export const createHvpCamera = (options: HvpCameraOptions): HvpCameraController => {
  const camera = options.camera;
  const canvas = options.canvas;
  const windowPort = options.windowPort ?? window;
  const target = new THREE.Vector3();
  const pressedKeys = new Set<string>();
  const hadTabIndex = canvas.hasAttribute("tabindex");
  const originalTabIndex = canvas.getAttribute("tabindex");
  let mode: HvpCameraMode = "Orbit";
  let preset: HvpCameraPreset = "C04-WIDE";
  let yaw = 0;
  let pitch = 0;
  let orbitRadius = 1;
  let activePointer: number | undefined;
  let disposed = false;

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
    focusViewport();
    if (activePointer !== undefined || event.button !== 0) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent): void => {
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
    event.preventDefault();
    if (mode === "Orbit") {
      orbitRadius = THREE.MathUtils.clamp(orbitRadius * Math.exp(event.deltaY * 0.001), 2, 240);
    } else {
      camera.position.addScaledVector(forwardVector(), -event.deltaY * 0.025);
    }
    applyView();
  };

  const keyDown = (event: KeyboardEvent): void => {
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
    camera.updateProjectionMatrix();
  };

  const update = (deltaSeconds: number): void => {
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

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (activePointer !== undefined) canvas.releasePointerCapture?.(activePointer);
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerup", releasePointer);
    canvas.removeEventListener("pointercancel", releasePointer);
    canvas.removeEventListener("wheel", wheel);
    windowPort.removeEventListener("keydown", keyDown);
    windowPort.removeEventListener("keyup", keyUp);
    windowPort.removeEventListener("blur", blur);
    windowPort.removeEventListener("resize", resize);
    pressedKeys.clear();
    activePointer = undefined;
    if (hadTabIndex) canvas.setAttribute("tabindex", originalTabIndex ?? "");
    else canvas.removeAttribute("tabindex");
  };

  canvas.setAttribute("tabindex", "0");
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", wheel, { passive: false });
  windowPort.addEventListener("keydown", keyDown);
  windowPort.addEventListener("keyup", keyUp);
  windowPort.addEventListener("blur", blur);
  windowPort.addEventListener("resize", resize);
  resize();
  reset();

  return {
    get mode() { return mode; },
    get preset() { return preset; },
    setMode,
    setPreset,
    reset,
    update,
    readPose,
    dispose
  };
};
