import type { SurfaceInputEventPort } from "./domInputAdapter";

export type SurfacePointerLockState =
  | "Unsupported"
  | "Unlocked"
  | "Requesting"
  | "Locked"
  | "Releasing"
  | "Error";

export interface SurfacePointerLockTarget extends SurfaceInputEventPort {
  requestPointerLock?: () => void | Promise<void>;
}

export interface SurfacePointerLockDocumentPort extends SurfaceInputEventPort {
  readonly pointerLockElement: unknown;
  exitPointerLock?: () => void | Promise<void>;
}

export interface SurfacePointerLockOptions {
  readonly target: SurfacePointerLockTarget;
  readonly documentPort?: SurfacePointerLockDocumentPort;
  readonly windowPort?: SurfaceInputEventPort;
}

export interface SurfacePointerLockSnapshot {
  readonly state: SurfacePointerLockState;
  readonly locked: boolean;
  readonly error: string | null;
}

export interface SurfacePointerLockController {
  request(): void;
  release(): void;
  isLocked(): boolean;
  readSnapshot(): Readonly<SurfacePointerLockSnapshot>;
  dispose(): void;
}

export const createSurfacePointerLockController = (
  options: SurfacePointerLockOptions
): SurfacePointerLockController => {
  const documentPort = options.documentPort ?? document;
  const windowPort = options.windowPort ?? window;
  const supported = typeof options.target.requestPointerLock === "function"
    && typeof documentPort.exitPointerLock === "function";
  let state: SurfacePointerLockState = supported
    ? documentPort.pointerLockElement === options.target ? "Locked" : "Unlocked"
    : "Unsupported";
  let error: string | null = null;
  let disposed = false;

  const setError = (message: string): void => {
    if (disposed) return;
    state = "Error";
    error = message;
  };

  const pointerLockChange = (): void => {
    if (disposed || !supported) return;
    state = documentPort.pointerLockElement === options.target ? "Locked" : "Unlocked";
    error = null;
  };

  const pointerLockError = (): void => {
    setError("Pointer lock request failed.");
  };

  const request = (): void => {
    if (disposed || !supported || state === "Locked" || state === "Requesting") return;
    state = "Requesting";
    error = null;
    try {
      const result = options.target.requestPointerLock?.();
      if (result instanceof Promise) {
        void result.catch(() => setError("Pointer lock request failed."));
      }
    } catch {
      setError("Pointer lock request failed.");
    }
  };

  const release = (): void => {
    if (disposed || !supported || state === "Unlocked" || state === "Unsupported" || state === "Releasing") return;
    state = "Releasing";
    error = null;
    try {
      const result = documentPort.exitPointerLock?.();
      if (result instanceof Promise) {
        void result.catch(() => setError("Pointer lock release failed."));
      }
    } catch {
      setError("Pointer lock release failed.");
    }
  };

  const pointerDown = (rawEvent: Event): void => {
    const event = rawEvent as MouseEvent;
    if (event.button === 0) request();
  };

  const keyDown = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    if (event.code === "Escape") release();
  };

  const isLocked = (): boolean => !disposed && state === "Locked";

  const readSnapshot = (): Readonly<SurfacePointerLockSnapshot> => Object.freeze({
    state,
    locked: isLocked(),
    error
  });

  const dispose = (): void => {
    if (disposed) return;
    if (state === "Locked" && supported) {
      try {
        void documentPort.exitPointerLock?.();
      } catch {
        // Disposal is best-effort and leaves no retained gameplay state.
      }
    }
    disposed = true;
    options.target.removeEventListener("pointerdown", pointerDown);
    windowPort.removeEventListener("keydown", keyDown);
    documentPort.removeEventListener("pointerlockchange", pointerLockChange);
    documentPort.removeEventListener("pointerlockerror", pointerLockError);
    state = supported ? "Unlocked" : "Unsupported";
    error = null;
  };

  options.target.addEventListener("pointerdown", pointerDown);
  windowPort.addEventListener("keydown", keyDown);
  documentPort.addEventListener("pointerlockchange", pointerLockChange);
  documentPort.addEventListener("pointerlockerror", pointerLockError);

  return { request, release, isLocked, readSnapshot, dispose };
};
