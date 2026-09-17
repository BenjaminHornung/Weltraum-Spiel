import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createHvpCamera } from "../../src/hvp/hvpCamera";

class FakeCanvas extends EventTarget {
  readonly ownerDocument: { pointerLockElement: unknown } = { pointerLockElement: null };
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
  innerWidth = 1920;
  innerHeight = 1080;
}

describe("HVP camera Masterplan contract", () => {
  it("does not capture an inspection drag while native pointer lock already owns the document", () => {
    const camera = new THREE.PerspectiveCamera(), canvas = new FakeCanvas(), windowPort = new FakeWindow();
    const controller = createHvpCamera({ camera, canvas: canvas as unknown as HTMLCanvasElement, windowPort });
    const down = () => Object.assign(new Event("pointerdown", { cancelable: true }), { pointerId: 7, button: 0 });
    const move = () => Object.assign(new Event("pointermove"), { pointerId: 7, movementX: 30, movementY: 10 });
    const before = camera.quaternion.toArray();
    canvas.ownerDocument.pointerLockElement = canvas;
    canvas.dispatchEvent(down()); canvas.dispatchEvent(move());
    expect(canvas.captures).toEqual([]);
    expect(camera.quaternion.toArray()).toEqual(before);
    canvas.ownerDocument.pointerLockElement = null;
    canvas.dispatchEvent(down()); canvas.dispatchEvent(move());
    expect(canvas.captures).toEqual([7]);
    expect(camera.quaternion.toArray()).not.toEqual(before);
    controller.dispose();
  });
  it("restores the actual player-driven view and FOV without replaying stale Orbit state",()=>{
    const camera=new THREE.PerspectiveCamera(),canvas=new FakeCanvas(),windowPort=new FakeWindow();
    const controller=createHvpCamera({camera,canvas:canvas as unknown as HTMLCanvasElement,windowPort});
    camera.position.set(4,2,-3);camera.lookAt(6,1,8);camera.fov=62;
    const saved=JSON.parse(JSON.stringify(controller.checkpoint()));
    expect(saved.mode).toBe("Fly");const position=camera.position.clone(),orientation=camera.quaternion.clone();
    controller.reset();controller.restore(saved);windowPort.dispatchEvent(new Event("resize"));
    expect(camera.position).toEqual(position);expect(camera.quaternion.toArray()).toEqual(orientation.toArray());expect(camera.fov).toBe(62);
    controller.update(1/60);expect(camera.position).toEqual(position);
    expect(()=>controller.restore({...saved,fov:NaN})).toThrow(/restore/);
    controller.dispose();
  });
  it("does not overwrite the active player's FOV on resize and retains it when input is released",()=>{
    const camera=new THREE.PerspectiveCamera(),canvas=new FakeCanvas(),windowPort=new FakeWindow();let blocked=false;
    const controller=createHvpCamera({camera,canvas:canvas as unknown as HTMLCanvasElement,windowPort,isInputBlocked:()=>blocked});
    blocked=true;camera.fov=60;controller.update(1/60);windowPort.dispatchEvent(new Event("resize"));
    expect(camera.fov).toBe(60);
    blocked=false;camera.fov=50;windowPort.dispatchEvent(new Event("resize"));expect(camera.fov).toBe(60);
    controller.dispose();
  });
  it("binds the exact C01-EYE pose with FOV 60", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createHvpCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });

    controller.setPreset("C01-EYE");
    const pose = controller.readPose();
    expect(pose.preset).toBe("C01-EYE");
    expect(pose.position.x).toBeCloseTo(-8);
    expect(pose.position.y).toBeCloseTo(3.15);
    expect(pose.position.z).toBeCloseTo(-11);
    expect(pose.target).toEqual({ x: 0, y: 1, z: 5 });
    expect(camera.fov).toBe(60);
    controller.dispose();
  });

  it("binds the exact C04-WIDE pose with FOV 55", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createHvpCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });

    controller.setPreset("C04-WIDE");
    const pose = controller.readPose();
    expect(pose.preset).toBe("C04-WIDE");
    expect(pose.position.x).toBeCloseTo(-24);
    expect(pose.position.y).toBeCloseTo(18);
    expect(pose.position.z).toBeCloseTo(-28);
    expect(pose.target).toEqual({ x: 0, y: 1, z: 1 });
    expect(camera.fov).toBe(55);
    controller.dispose();
  });

  it("binds the exact C02-SHORE pose with FOV 55", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createHvpCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });

    controller.setPreset("C02-SHORE");
    const pose = controller.readPose();
    expect(pose.preset).toBe("C02-SHORE");
    expect(pose.position.x).toBeCloseTo(-2);
    expect(pose.position.y).toBeCloseTo(1.25);
    expect(pose.position.z).toBeCloseTo(-6);
    expect(pose.target).toEqual({ x: 1, y: -0.5, z: -2 });
    expect(camera.fov).toBe(55);
    controller.dispose();
  });

  it("keeps the C02-SHORE target below the HVP water plane", () => {
    const camera = new THREE.PerspectiveCamera();
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createHvpCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });

    controller.setPreset("C02-SHORE");
    const pose = controller.readPose();
    expect(pose.target.y).toBe(-0.5);
    // Independent underwater oracle: the HVP water surface sits at y=0
    // (see hvp-bootstrap water artifact positions), so the C02 target must
    // look up from below the plane, never from above it.
    expect(pose.target.y).toBeLessThan(0);
    controller.dispose();
  });

  it("never inherits the backend default 50° FOV on preset or resize", () => {
    const camera = new THREE.PerspectiveCamera();
    expect(camera.fov).toBe(50);
    const canvas = new FakeCanvas();
    const windowPort = new FakeWindow();
    const controller = createHvpCamera({
      camera,
      canvas: canvas as unknown as HTMLCanvasElement,
      windowPort: windowPort as unknown as Window
    });
    expect(camera.fov).toBe(55);

    const updateSpy = vi.spyOn(camera, "updateProjectionMatrix");
    controller.setPreset("C01-EYE");
    expect(camera.fov).toBe(60);
    expect(updateSpy).toHaveBeenCalled();

    camera.fov = 50;
    camera.updateProjectionMatrix();
    updateSpy.mockClear();
    windowPort.dispatchEvent(new Event("resize"));
    expect(camera.fov).toBe(60);
    expect(updateSpy).toHaveBeenCalled();
    controller.dispose();
  });
});
