import { describe, expect, it } from "vitest";
import {
  createSurfaceDomInputAdapter,
  createSurfacePointerLockController,
  type SurfaceInputDocumentPort,
  type SurfacePointerLockDocumentPort,
  type SurfacePointerLockTarget
} from "../../src/surface-play/player";

class FakeWindow extends EventTarget {}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  pointerLockElement: unknown = null;
  readonly exitCalls: number[] = [];
  exitPointerLock = (): void => {
    this.exitCalls.push(this.exitCalls.length + 1);
  };
}

class FakeTarget extends EventTarget {
  readonly requestCalls: number[] = [];
  requestPointerLock = (): void => {
    this.requestCalls.push(this.requestCalls.length + 1);
  };
}

const eventWith = (type: string, values: Readonly<Record<string, unknown>>): Event => {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  return event;
};

const commandRequest = (simulationTick: number) => ({
  playerId: "player:hestia",
  surfaceFrameId: "frame:hestia-test",
  simulationTick
});

describe("surface player DOM input", () => {
  it("normalizes movement, consumes look once, and edge-latches jump", () => {
    const windowPort = new FakeWindow();
    const documentPort = new FakeDocument();
    const adapter = createSurfaceDomInputAdapter({
      windowPort,
      documentPort: documentPort as SurfaceInputDocumentPort,
      isPointerLocked: () => true,
      lookSensitivityRadiansPerPixel: 0.0025
    });

    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", repeat: false, target: null }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyD", repeat: false, target: null }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "Space", repeat: false, target: null }));
    documentPort.dispatchEvent(eventWith("mousemove", { movementX: 4, movementY: -2 }));

    const first = adapter.consumeCommand(commandRequest(1));
    const second = adapter.consumeCommand(commandRequest(2));

    expect(Math.hypot(first.moveAxes.forward, first.moveAxes.right)).toBeCloseTo(1);
    expect(first.lookDeltaRadians).toEqual({ yaw: -0.01, pitch: 0.005 });
    expect(first.jump).toBe(true);
    expect(second.lookDeltaRadians).toEqual({ yaw: 0, pitch: 0 });
    expect(second.jump).toBe(false);
    adapter.dispose();
    adapter.dispose();
  });

  it("clears held and queued input on blur and hidden visibility", () => {
    const windowPort = new FakeWindow();
    const documentPort = new FakeDocument();
    const adapter = createSurfaceDomInputAdapter({
      windowPort,
      documentPort: documentPort as SurfaceInputDocumentPort,
      isPointerLocked: () => true,
      lookSensitivityRadiansPerPixel: 0.0025
    });

    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", repeat: false, target: null }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "Space", repeat: false, target: null }));
    windowPort.dispatchEvent(new Event("blur"));
    expect(adapter.consumeCommand(commandRequest(1))).toMatchObject({
      moveAxes: { forward: 0, right: 0 },
      jump: false
    });

    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyD", repeat: false, target: null }));
    documentPort.visibilityState = "hidden";
    documentPort.dispatchEvent(new Event("visibilitychange"));
    expect(adapter.consumeCommand(commandRequest(2))).toMatchObject({
      moveAxes: { forward: 0, right: 0 }
    });
    adapter.dispose();
  });
});

describe("surface pointer lock lifecycle", () => {
  it("tracks request, lock truth, escape release, error, and disposal", () => {
    const windowPort = new FakeWindow();
    const documentPort = new FakeDocument();
    const target = new FakeTarget();
    const controller = createSurfacePointerLockController({
      target: target as SurfacePointerLockTarget,
      documentPort: documentPort as SurfacePointerLockDocumentPort,
      windowPort
    });

    target.dispatchEvent(eventWith("pointerdown", { button: 0 }));
    expect(controller.readSnapshot().state).toBe("Requesting");
    expect(target.requestCalls).toHaveLength(1);

    documentPort.pointerLockElement = target;
    documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(controller.readSnapshot()).toMatchObject({ state: "Locked", locked: true });

    windowPort.dispatchEvent(eventWith("keydown", { code: "Escape" }));
    expect(controller.readSnapshot().state).toBe("Releasing");
    expect(documentPort.exitCalls).toHaveLength(1);

    documentPort.pointerLockElement = null;
    documentPort.dispatchEvent(new Event("pointerlockchange"));
    expect(controller.readSnapshot().state).toBe("Unlocked");
    documentPort.dispatchEvent(new Event("pointerlockerror"));
    expect(controller.readSnapshot()).toMatchObject({ state: "Error", locked: false });

    controller.dispose();
    controller.dispose();
    target.dispatchEvent(eventWith("pointerdown", { button: 0 }));
    expect(target.requestCalls).toHaveLength(1);
  });

  it("reports unsupported when the browser exposes no pointer-lock operations", () => {
    const controller = createSurfacePointerLockController({
      target: new EventTarget() as SurfacePointerLockTarget,
      documentPort: new FakeDocument() as SurfacePointerLockDocumentPort,
      windowPort: new FakeWindow()
    });

    controller.request();
    controller.release();
    expect(controller.readSnapshot()).toMatchObject({ state: "Unsupported", locked: false, error: null });
    controller.dispose();
  });
});
