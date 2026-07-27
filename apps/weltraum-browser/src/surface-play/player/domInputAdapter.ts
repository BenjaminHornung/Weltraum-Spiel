import {
  createSurfacePlayerCommand,
  type SurfacePlayerCommand,
  type SurfacePointerLockIntent,
  type SurfaceRecoveryReset
} from "../contracts";

export interface SurfaceInputEventPort {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface SurfaceInputDocumentPort extends SurfaceInputEventPort {
  readonly visibilityState: DocumentVisibilityState;
}

export interface SurfaceDomInputAdapterOptions {
  readonly windowPort?: SurfaceInputEventPort;
  readonly documentPort?: SurfaceInputDocumentPort;
  readonly isPointerLocked: () => boolean;
  readonly lookSensitivityRadiansPerPixel: number;
}

export interface SurfaceDomCommandRequest {
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly simulationTick: number;
  readonly pointerLockIntent?: SurfacePointerLockIntent;
  readonly reset?: SurfaceRecoveryReset;
}

export interface SurfaceDomInputAdapter {
  consumeCommand(request: SurfaceDomCommandRequest): Readonly<SurfacePlayerCommand>;
  clearHeldInputs(): void;
  dispose(): void;
}

const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"]);

const editableTarget = (target: EventTarget | null): boolean => {
  const tagName = (target as { readonly tagName?: string } | null)?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "select" || tagName === "textarea" || tagName === "button";
};

export const createSurfaceDomInputAdapter = (
  options: SurfaceDomInputAdapterOptions
): SurfaceDomInputAdapter => {
  if (!Number.isFinite(options.lookSensitivityRadiansPerPixel) || options.lookSensitivityRadiansPerPixel <= 0) {
    throw new Error("Look sensitivity must be finite and positive.");
  }

  const windowPort = options.windowPort ?? window;
  const documentPort = options.documentPort ?? document;
  const heldKeys = new Set<string>();
  let lookX = 0;
  let lookY = 0;
  let jumpQueued = false;
  let disposed = false;

  const clearHeldInputs = (): void => {
    heldKeys.clear();
    lookX = 0;
    lookY = 0;
    jumpQueued = false;
  };

  const keyDown = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    if (editableTarget(event.target) || !MOVEMENT_KEYS.has(event.code)) return;
    if (event.code === "Space" && !heldKeys.has("Space") && !event.repeat) jumpQueued = true;
    heldKeys.add(event.code);
    event.preventDefault();
  };

  const keyUp = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    heldKeys.delete(event.code);
  };

  const mouseMove = (rawEvent: Event): void => {
    if (!options.isPointerLocked()) return;
    const event = rawEvent as MouseEvent;
    if (!Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return;
    lookX += event.movementX;
    lookY += event.movementY;
  };

  const visibilityChange = (): void => {
    if (documentPort.visibilityState !== "visible") clearHeldInputs();
  };

  const consumeCommand = (request: SurfaceDomCommandRequest): Readonly<SurfacePlayerCommand> => {
    const forward = (heldKeys.has("KeyW") ? 1 : 0) - (heldKeys.has("KeyS") ? 1 : 0);
    const right = (heldKeys.has("KeyD") ? 1 : 0) - (heldKeys.has("KeyA") ? 1 : 0);
    const length = Math.hypot(forward, right);
    const normalization = length > 1 ? 1 / length : 1;
    const command = createSurfacePlayerCommand({
      playerId: request.playerId,
      surfaceFrameId: request.surfaceFrameId,
      simulationTick: request.simulationTick,
      moveAxes: { forward: forward * normalization, right: right * normalization },
      lookDeltaRadians: {
        yaw: -lookX * options.lookSensitivityRadiansPerPixel,
        pitch: -lookY * options.lookSensitivityRadiansPerPixel
      },
      sprint: heldKeys.has("ShiftLeft") || heldKeys.has("ShiftRight"),
      crouch: null,
      jump: jumpQueued,
      fire: false,
      pointerLockIntent: request.pointerLockIntent ?? "Unchanged",
      reset: request.reset ?? "None"
    });
    lookX = 0;
    lookY = 0;
    jumpQueued = false;
    return command;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    windowPort.removeEventListener("keydown", keyDown);
    windowPort.removeEventListener("keyup", keyUp);
    windowPort.removeEventListener("blur", clearHeldInputs);
    documentPort.removeEventListener("mousemove", mouseMove);
    documentPort.removeEventListener("visibilitychange", visibilityChange);
    clearHeldInputs();
  };

  windowPort.addEventListener("keydown", keyDown);
  windowPort.addEventListener("keyup", keyUp);
  windowPort.addEventListener("blur", clearHeldInputs);
  documentPort.addEventListener("mousemove", mouseMove);
  documentPort.addEventListener("visibilitychange", visibilityChange);

  return { consumeCommand, clearHeldInputs, dispose };
};
