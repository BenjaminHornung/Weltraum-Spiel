import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSurfaceLabCamera } from "../../src/surface-lab/surfaceLabCamera";

class FakeCanvas extends EventTarget {
  readonly captures: number[] = [];
  readonly releases: number[] = [];
  readonly focusOptions: FocusOptions[] = [];
  readonly attributes = new Map<string, string>();
  setPointerCapture(pointerId: number): void { this.captures.push(pointerId); }
  releasePointerCapture(pointerId: number): void { this.releases.push(pointerId); }
  focus(options?: FocusOptions): void { this.focusOptions.push(options ?? {}); }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
}

class FakeWindow extends EventTarget {
  innerWidth = 1600;
  innerHeight = 900;
}

const eventWith = (type: string, values: Readonly<Record<string, unknown>>): Event => {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  return event;
};

describe("Surface Lab camera", () => {
  it("provides a deterministic reset pose and camera-only resize mitigation", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });

    const pose = controller.readPose();
    expect(pose.mode).toBe("Orbit");
    expect(pose.position.x).toBeCloseTo(46);
    expect(pose.position.y).toBeCloseTo(34);
    expect(pose.position.z).toBeCloseTo(52);
    expect(pose.target).toEqual({ x: 0, y: -4, z: 0 });
    expect(camera.aspect).toBeCloseTo(16 / 9);

    windowPort.innerWidth = 1024;
    windowPort.innerHeight = 768;
    windowPort.dispatchEvent(new Event("resize"));
    expect(camera.aspect).toBeCloseTo(4 / 3);
    controller.dispose();
  });

  it("captures orbit input, dollies, and moves in fly mode with vertical and speed modifiers", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    const resetPosition = camera.position.clone();

    canvas.dispatchEvent(eventWith("pointerdown", { pointerId: 7, button: 0 }));
    canvas.dispatchEvent(eventWith("pointermove", { pointerId: 7, movementX: 20, movementY: -10 }));
    canvas.dispatchEvent(eventWith("pointerup", { pointerId: 7 }));
    expect(canvas.captures).toEqual([7]);
    expect(canvas.releases).toEqual([7]);
    expect(camera.position.equals(resetPosition)).toBe(false);

    const beforeDolly = camera.position.distanceTo(new THREE.Vector3(0, -4, 0));
    canvas.dispatchEvent(eventWith("wheel", { deltaY: -120 }));
    expect(camera.position.distanceTo(new THREE.Vector3(0, -4, 0))).toBeLessThan(beforeDolly);

    controller.setMode("Fly");
    expect(canvas.focusOptions).toEqual([{ preventScroll: true }, { preventScroll: true }]);
    const beforeFly = camera.position.clone();
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", target: canvas }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyE", target: canvas }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "ShiftLeft", target: canvas }));
    controller.update(0.1);
    expect(camera.position.distanceTo(beforeFly)).toBeCloseTo(5.4);
    expect(camera.position.y).toBeGreaterThan(beforeFly.y);
    windowPort.dispatchEvent(eventWith("keyup", { code: "KeyW" }));
    windowPort.dispatchEvent(eventWith("keyup", { code: "KeyE" }));
    windowPort.dispatchEvent(eventWith("keyup", { code: "ShiftLeft" }));

    const disposedPosition = camera.position.clone();
    controller.dispose();
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW" }));
    controller.update(0.1);
    expect(camera.position.equals(disposedPosition)).toBe(true);
  });

  it("focuses the viewport for fly and pointer input while editable controls remain guarded", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    expect(canvas.getAttribute("tabindex")).toBe("0");

    controller.setMode("Fly");
    expect(canvas.focusOptions).toEqual([{ preventScroll: true }]);

    const beforeGuardedInput = camera.position.clone();
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", target: { tagName: "INPUT" } }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", target: { tagName: "BUTTON" } }));
    controller.update(0.1);
    expect(camera.position.equals(beforeGuardedInput)).toBe(true);

    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", target: canvas }));
    controller.update(0.1);
    expect(camera.position.equals(beforeGuardedInput)).toBe(false);
    windowPort.dispatchEvent(eventWith("keyup", { code: "KeyW", target: canvas }));

    canvas.dispatchEvent(eventWith("pointerdown", { pointerId: 11, button: 0 }));
    expect(canvas.focusOptions).toEqual([
      { preventScroll: true },
      { preventScroll: true }
    ]);
    controller.dispose();
  });

  it("restores the exact prior tabindex and leaves focus and input inert after idempotent disposal", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    canvas.setAttribute("tabindex", "-1");
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    expect(canvas.getAttribute("tabindex")).toBe("0");

    controller.setMode("Fly");
    const disposedPosition = camera.position.clone();
    controller.dispose();
    expect(canvas.getAttribute("tabindex")).toBe("-1");

    canvas.dispatchEvent(eventWith("pointerdown", { pointerId: 12, button: 0 }));
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW", target: canvas }));
    controller.update(0.1);
    expect(canvas.focusOptions).toHaveLength(1);
    expect(camera.position.equals(disposedPosition)).toBe(true);

    canvas.setAttribute("tabindex", "7");
    controller.dispose();
    expect(canvas.getAttribute("tabindex")).toBe("7");
  });

  it("removes a camera-owned tabindex when the canvas originally had none", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    expect(canvas.getAttribute("tabindex")).toBe("0");
    controller.dispose();
    expect(canvas.hasAttribute("tabindex")).toBe(false);
  });

  it("clears held movement on window blur and removes the blur listener on disposal", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createSurfaceLabCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    controller.setMode("Fly");
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW" }));
    windowPort.dispatchEvent(new Event("blur"));
    const blurredPosition = camera.position.clone();
    controller.update(0.1);
    expect(camera.position.equals(blurredPosition)).toBe(true);

    controller.dispose();
    windowPort.dispatchEvent(eventWith("keydown", { code: "KeyW" }));
    windowPort.dispatchEvent(new Event("blur"));
    controller.update(0.1);
    expect(camera.position.equals(blurredPosition)).toBe(true);
  });
});
