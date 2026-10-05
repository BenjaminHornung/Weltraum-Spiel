import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createHvpPlayerVisualPose } from "../../src/hestia-prototype/player/presentation";
import { createHvpCamera, type HvpCameraController, type HvpCameraOptions, type HvpCameraPreset } from "../../src/hvp/hvpCamera";
import { B3_AVATAR_SOURCE, createB3Camera, createB3PlayerVisualPose, P03_REFERENCE_SOURCE } from "../reference/hvp-parallel-p03-camera-reference";

// Counts only direct module-boundary construction; internal Three.js/clone is not counted.
const allocation = vi.hoisted(() => ({ enabled: false, count: 0 }));
vi.mock("three", async (importOriginal) => {
  const real = await importOriginal<typeof import("three")>();
  return { ...real, Vector3: new Proxy(real.Vector3, {
    construct(target, args, newTarget) {
      if (allocation.enabled) { allocation.count += 1; }
      return Reflect.construct(target, args, newTarget);
    }
  }) };
});

// The same population can first exercise b3; T09 is its expected allocation negative.
const playerFactory = process.env.P03_USE_B3 === "1" ? createB3PlayerVisualPose : createHvpPlayerVisualPose;
const cameraFactory = process.env.P03_USE_B3 === "1" ? createB3Camera : createHvpCamera;
const presets: HvpCameraPreset[] = ["C01-EYE", "C02-SHORE", "C03-ROOTS", "C04-WIDE", "C05-ROCKARM", "C07-QUARRY"];
const deltas = [0, -0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MIN_VALUE, 1 / 144, 1 / 30, 0.1, 100];

class FakePort {
  readonly handlers = new Map<string, EventListener[]>();
  addEventListener(type: string, handler: EventListener): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  removeEventListener(type: string, handler: EventListener): void {
    this.handlers.set(type, (this.handlers.get(type) ?? []).filter((value) => value !== handler));
  }
  emit(type: string, values: Record<string, unknown> = {}): Event {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(values)) { Object.defineProperty(event, key, { value }); }
    for (const handler of this.handlers.get(type) ?? []) { handler(event); }
    return event;
  }
  get size(): number {
    return [...this.handlers.values()].reduce((count, handlers) => count + handlers.length, 0);
  }
}
class FakeCanvas extends FakePort {
  readonly ownerDocument: { pointerLockElement: unknown } = { pointerLockElement: null };
  readonly attributes = new Map<string, string>();
  readonly captured: number[] = [];
  readonly released: number[] = [];
  readonly focused: unknown[] = [];
  hasAttribute(key: string): boolean { return this.attributes.has(key); }
  getAttribute(key: string): string | null { return this.attributes.get(key) ?? null; }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  removeAttribute(key: string): void { this.attributes.delete(key); }
  setPointerCapture(id: number): void { this.captured.push(id); }
  releasePointerCapture(id: number): void { this.released.push(id); }
  focus(options: unknown): void { this.focused.push(options); }
}
class FakeWindow extends FakePort { innerWidth = 1920; innerHeight = 1080; }

const harness = (factory: (options: HvpCameraOptions) => HvpCameraController, tabIndex?: string) => {
  const canvas = new FakeCanvas(), windowPort = new FakeWindow(), camera = new THREE.PerspectiveCamera();
  if (tabIndex !== undefined) { canvas.setAttribute("tabindex", tabIndex); }
  const state = { blocked: false };
  const controller = factory({ camera, canvas: canvas as unknown as HTMLCanvasElement,
    windowPort: windowPort as unknown as HvpCameraOptions["windowPort"], isInputBlocked: () => state.blocked });
  return { canvas, windowPort, camera, state, controller };
};
type Harness = ReturnType<typeof harness>;
const assertSame = (a: Harness, b: Harness): void => {
  expect(a.controller.readPose()).toStrictEqual(b.controller.readPose());
  expect(a.controller.checkpoint()).toStrictEqual(b.controller.checkpoint());
  expect([a.camera.fov, a.camera.aspect, a.camera.projectionMatrix.elements]).toStrictEqual(
    [b.camera.fov, b.camera.aspect, b.camera.projectionMatrix.elements]);
  expect([a.controller.listenerCount, a.canvas.size, a.windowPort.size]).toStrictEqual(
    [b.controller.listenerCount, b.canvas.size, b.windowPort.size]);
  expect([a.canvas.focused, a.canvas.captured, a.canvas.released, [...a.canvas.attributes]]).toStrictEqual(
    [b.canvas.focused, b.canvas.captured, b.canvas.released, [...b.canvas.attributes]]);
};
const withPair = (run: (a: Harness, b: Harness, step: (action: (value: Harness) => void) => void) => void): void => {
  const a = harness(cameraFactory), b = harness(createB3Camera);
  const step = (action: (value: Harness) => void): void => { action(a); action(b); assertSame(a, b); };
  try { assertSame(a, b); run(a, b, step); } finally { a.controller.dispose(); b.controller.dispose(); }
};
const keys = (h: Harness, codes: readonly string[], type = "keydown"): void => {
  for (const code of codes) { h.windowPort.emit(type, { code }); }
};
const pointer = (h: Harness, type: string, movementX = 0, movementY = 0, pointerId = 7): Event =>
  h.canvas.emit(type, { pointerId, button: 0, movementX, movementY });

describe("P03 frozen b3 camera / player parity", () => {
  it("P03-T01 preserves reset boundaries, stable position identity and lag without prediction", () => {
    const a = playerFactory(), b = createB3PlayerVisualPose(), identity = a.position;
    const samples: [number, number, number, number, boolean?][] = [
      [0, 0, 0, 0], [2, 0, 0, 0.01], [2, 0, 0, 0.045], [0.25, -0.1, 0.1, 0],
      [0.25, -0.1, 0.1, 0.045, true], [2.25, -0.1, 0.1, 0.01], [10, 3, -4, 0.01],
      [-0, -0, -0, 0, true], [Number.MIN_VALUE, 0, -Number.MIN_VALUE, 1 / 144]
    ];
    for (const [x, y, z, dt, reset] of samples) {
      a.update({ x, y, z }, dt, reset); b.update({ x, y, z }, dt, reset);
      expect(a.position).toBe(identity); expect(a.position.toArray()).toStrictEqual(b.position.toArray());
    }
    for (const hz of [30, 60, 144]) {
      a.update({ x: 0, y: 0, z: 0 }, 0, true); b.update({ x: 0, y: 0, z: 0 }, 0, true);
      for (let i = 0; i < hz; i += 1) {
        a.update({ x: 1, y: 0.5, z: -0.25 }, 1 / hz); b.update({ x: 1, y: 0.5, z: -0.25 }, 1 / hz);
        expect(a.position.toArray()).toStrictEqual(b.position.toArray());
        expect(a.position.x).toBeLessThanOrEqual(1);
      }
    }
  });

  it("P03-T02 preserves invalid-sample RangeError and valid adversarial values", () => {
    const a = playerFactory(), b = createB3PlayerVisualPose();
    for (const dt of deltas) {
      for (const view of [a, b]) {
        if (!Number.isFinite(dt) || dt < 0) {
          const before = view.position.toArray();
          expect(() => view.update({ x: 1, y: 0, z: 0 }, dt, true)).toThrow(new RangeError("Invalid player presentation sample"));
          expect(view.position.toArray()).toStrictEqual(before);
        } else { view.update({ x: 1, y: 0, z: 0 }, dt); }
      }
      expect(a.position.toArray()).toStrictEqual(b.position.toArray());
    }
    for (const axis of ["x", "y", "z"] as const) {
      for (const bad of [Number.NaN, Infinity, -Infinity]) {
        for (const view of [a, b]) {
          expect(() => view.update({ x: 0, y: 0, z: 0, [axis]: bad }, 0)).toThrow(RangeError);
        }
      }
    }
    for (const x of [Number.MAX_VALUE, -Number.MAX_VALUE, 2, -2, Number.MIN_VALUE]) {
      a.update({ x, y: x, z: -x }, 0.01); b.update({ x, y: x, z: -x }, 0.01);
      expect(a.position.toArray()).toStrictEqual(b.position.toArray());
    }
  });

  it("P03-T02 preserves repeated getter/default/throw order after validation", () => {
    for (const reset of [false, true]) {
      for (const throwAt of [-1, 0, 3, 6]) {
        const results = [playerFactory, createB3PlayerVisualPose].map((factory) => {
          const view = factory(); view.update({ x: 0, y: 0, z: 0 }, 0);
          const reads: string[] = [], sentinel = new Error("sample getter");
          const phases = [[1, 0.5, -0.2], [undefined, 0.7, undefined], [1.5, undefined, -0]];
          const sample = Object.fromEntries(["x", "y", "z"].map((axis) => [axis, 0]));
          for (const [index, axis] of ["x", "y", "z"].entries()) {
            Object.defineProperty(sample, axis, { get: () => {
              const read = reads.length; reads.push(axis);
              if (read === throwAt) { throw sentinel; }
              return phases[Math.floor(read / 3)]?.[index];
            } });
          }
          let error: unknown;
          try { view.update(sample as { x: number; y: number; z: number }, 0.02, reset); } catch (value) { error = value; }
          if (throwAt >= 0) { expect(error).toBe(sentinel); } else { expect(error).toBeUndefined(); }
          return { reads, position: view.position.toArray() };
        });
        expect(results[0]).toStrictEqual(results[1]);
      }
    }
  });

  it.each(presets)("P03-T03 Fly movement order, modifiers, dt and pitch: %s", (preset) => {
    withPair((_a, _b, step) => {
      const combinations = [["KeyW"], ["KeyS"], ["KeyA"], ["KeyD"], ["KeyQ"], ["KeyE"],
        ["KeyW", "KeyD"], ["KeyW", "KeyA", "KeyE"], ["KeyS", "KeyD", "KeyQ"],
        ["KeyW", "KeyS"], ["KeyA", "KeyD"], ["KeyQ", "KeyE"], ["ShiftLeft"],
        ["KeyW", "ShiftLeft"], ["KeyW", "ShiftRight"], ["KeyW", "AltLeft"], ["KeyW", "AltRight"],
        ["KeyW", "KeyD", "KeyE", "ShiftLeft", "AltRight"]];
      for (const codes of combinations) {
        step((h) => { h.windowPort.emit("blur"); h.controller.setPreset(preset); h.controller.setMode("Fly"); keys(h, codes); });
        for (const dt of deltas) { step((h) => h.controller.update(dt)); }
        step((h) => keys(h, codes, "keyup")); step((h) => h.controller.update(0.1));
      }
      for (const pitchMove of [-1e6, 1e6, 30]) {
        step((h) => pointer(h, "pointerdown")); step((h) => pointer(h, "pointermove", 35, pitchMove));
        step((h) => pointer(h, "pointerup")); step((h) => keys(h, ["KeyW", "KeyD", "KeyE"]));
        step((h) => h.controller.update(1 / 60)); step((h) => h.windowPort.emit("blur"));
      }
    });
  });

  it.each(presets)("P03-T04 Orbit/Fly wheel, pointer, restore, reset and resize: %s", (preset) => {
    withPair((_a, _b, step) => {
      for (const mode of ["Orbit", "Fly"] as const) {
        step((h) => { h.controller.setPreset(preset); h.controller.setMode(mode); h.controller.setMode(mode); });
        for (const deltaY of [0, -10, 10, -1e6, 1e6]) {
          step((h) => expect(h.canvas.emit("wheel", { deltaY }).defaultPrevented).toBe(true));
        }
        step((h) => pointer(h, "pointermove", 20, 10)); // No captured pointer.
        step((h) => pointer(h, "pointerdown")); step((h) => pointer(h, "pointerdown", 0, 0, 8));
        step((h) => pointer(h, "pointermove", 20, 10, 8)); step((h) => pointer(h, "pointermove", 20, 10));
        step((h) => pointer(h, "pointercancel")); step((h) => pointer(h, "pointerdown"));
        step((h) => { keys(h, ["KeyW"]); h.controller.restore(h.controller.checkpoint()); });
        step((h) => h.controller.update(0.1));
        step((h) => { h.windowPort.innerWidth = 0; h.windowPort.innerHeight = 0; h.windowPort.emit("resize"); });
        step((h) => h.controller.reset());
      }
    });
  });

  it("P03-T05 native lock/inputBlocked, editable focus, blur and FOV ownership", () => {
    withPair((a, _b, step) => {
      step((h) => h.controller.setMode("Fly"));
      for (const tagName of ["INPUT", "select", "textarea", "button"]) {
        step((h) => expect(h.windowPort.emit("keydown", { code: "KeyW", target: { tagName } }).defaultPrevented).toBe(false));
        step((h) => h.controller.update(0.1));
      }
      step((h) => expect(h.windowPort.emit("keydown", { code: "KeyZ" }).defaultPrevented).toBe(false));
      for (const block of ["native", "callback"] as const) {
        step((h) => { keys(h, ["KeyW"]); h.state.blocked = block === "callback";
          h.canvas.ownerDocument.pointerLockElement = block === "native" ? h.canvas : null; });
        const before = a.controller.readPose();
        step((h) => { pointer(h, "pointerdown"); pointer(h, "pointermove", 50, 50);
          expect(h.canvas.emit("wheel", { deltaY: 20 }).defaultPrevented).toBe(false);
          keys(h, ["KeyD"]); h.camera.fov = 62; h.controller.update(0.1); h.windowPort.emit("resize"); });
        expect(a.controller.readPose()).toStrictEqual(before);
        step((h) => expect(() => h.controller.restore(h.controller.checkpoint())).toThrow("Invalid camera restore"));
        step((h) => { h.state.blocked = false; h.canvas.ownerDocument.pointerLockElement = null; h.controller.update(0.1); h.windowPort.emit("resize"); });
        expect(a.controller.readPose()).toStrictEqual(before); expect(a.camera.fov).toBe(62);
      }
      step((h) => { keys(h, ["KeyW"]); h.windowPort.emit("blur"); h.windowPort.emit("focus"); });
      const before = a.controller.readPose(); step((h) => h.controller.update(0.1));
      expect(a.controller.readPose()).toStrictEqual(before);
    });
  });

  it("P03-T06 snapshots stay deep-frozen, independent and detached from player-driven camera", () => {
    withPair((a, b, step) => {
      const saved = [a, b].map((h) => [h.controller.readPose(), h.controller.checkpoint()] as const);
      const bytes = saved.map((value) => JSON.stringify(value));
      for (const [pose, checkpoint] of saved) {
        for (const value of [pose, checkpoint]) {
          expect(Object.isFrozen(value)).toBe(true);
          for (const part of [value.position, value.target, value.quaternion]) { expect(Object.isFrozen(part)).toBe(true); }
          expect(Reflect.set(value.position, "x", 123)).toBe(false);
        }
        expect(pose.position).not.toBe(checkpoint.position); expect(pose.target).not.toBe(checkpoint.target);
        expect(pose.quaternion).not.toBe(checkpoint.quaternion);
      }
      step((h) => { h.camera.position.set(4, 2, -3); h.camera.lookAt(6, 1, 8); h.camera.fov = 62; });
      expect(a.controller.checkpoint().mode).toBe("Fly");
      step((h) => h.controller.restore(h.controller.checkpoint()));
      step((h) => { keys(h, ["KeyW", "KeyD"]); h.controller.update(0.1); });
      step((h) => { h.controller.setMode("Orbit"); h.controller.setPreset("C05-ROCKARM"); h.controller.reset(); });
      expect(saved.map((value) => JSON.stringify(value))).toStrictEqual(bytes);
      expect(a.controller.readPose()).not.toBe(a.controller.readPose());
    });
  });

  it("P03-T06 interleaved instances do not share scratch/position/target", () => {
    const a = harness(cameraFactory), b = harness(cameraFactory), oracle = harness(createB3Camera);
    const p = playerFactory(), q = playerFactory(), r = createB3PlayerVisualPose();
    try {
      expect(p.position).not.toBe(q.position);
      b.controller.setPreset("C02-SHORE"); b.controller.setMode("Fly"); keys(b, ["KeyS", "KeyQ"]);
      a.controller.setMode("Fly"); oracle.controller.setMode("Fly"); keys(a, ["KeyW", "KeyD"]); keys(oracle, ["KeyW", "KeyD"]);
      p.update({ x: 0, y: 0, z: 0 }, 0); r.update({ x: 0, y: 0, z: 0 }, 0);
      for (let i = 0; i < 32; i += 1) {
        const old = a.controller.readPose(); b.controller.update(0.03); pointer(b, "pointerdown"); pointer(b, "pointermove", i, -i);
        expect(a.controller.readPose()).toStrictEqual(old);
        a.controller.update(0.01); oracle.controller.update(0.01); assertSame(a, oracle);
        const position = p.position.toArray(); q.update({ x: 100 + i, y: -20, z: 0 }, 0.03);
        expect(p.position.toArray()).toStrictEqual(position);
        p.update({ x: 1, y: 0.5, z: -0.5 }, 0.01); r.update({ x: 1, y: 0.5, z: -0.5 }, 0.01);
        expect(p.position.toArray()).toStrictEqual(r.position.toArray());
      }
    } finally { a.controller.dispose(); b.controller.dispose(); oracle.controller.dispose(); }
  });

  it("P03-T07 invalid restore is rejected without mutation and preserves getter errors", () => {
    withPair((a, _b, step) => {
      const before = a.controller.checkpoint();
      for (const change of [{ fov: 0 }, { fov: 180 }, { fov: NaN }, { mode: "Other" }, { preset: "Other" },
        { position: { x: Infinity, y: 0, z: 0 } }, { target: { x: 0, y: NaN, z: 0 } }, { quaternion: { x: 0, y: 0, z: 0, w: 2 } }]) {
        step((h) => expect(() => h.controller.restore({ ...before, ...change } as Parameters<HvpCameraController["restore"]>[0])).toThrow("Invalid camera restore"));
        expect(a.controller.checkpoint()).toStrictEqual(before);
      }
      const sentinel = new Error("restore getter");
      step((h) => expect(() => h.controller.restore({ ...before, get fov(): number { throw sentinel; } })).toThrow(sentinel));
      expect(a.controller.checkpoint()).toStrictEqual(before);
    });
  });

  it.each([undefined, "", "-1"])("P03-T07 dispose clears capture/listeners and restores tabindex %s", (tabIndex) => {
    const a = harness(cameraFactory, tabIndex), b = harness(createB3Camera, tabIndex);
    try {
      for (const h of [a, b]) {
        h.controller.setMode("Fly"); keys(h, ["KeyW"]); pointer(h, "pointerdown");
        const before = h.controller.readPose(); h.controller.dispose(); h.controller.dispose();
        h.controller.update(0.1); h.controller.setMode("Orbit"); h.controller.setPreset("C01-EYE"); h.controller.reset();
        pointer(h, "pointermove", 100, 100); h.canvas.emit("wheel", { deltaY: 100 }); keys(h, ["KeyD"]);
        expect(h.controller.readPose()).toStrictEqual(before);
        expect(h.controller.listenerCount + h.canvas.size + h.windowPort.size).toBe(0);
        expect(h.canvas.getAttribute("tabindex")).toBe(tabIndex ?? null);
        expect(h.canvas.released).toStrictEqual([7]);
        expect(() => h.controller.restore(h.controller.checkpoint())).toThrow("Invalid camera restore");
      }
      assertSame(a, b);
    } finally { a.controller.dispose(); b.controller.dispose(); }
  });

  it("P03-T07 capture/release and inputBlocked exceptions are not swallowed", () => {
    withPair((_a, _b, step) => {
      step((h) => {
        const sentinel = new Error("capture failed");
        const capture = vi.spyOn(h.canvas, "setPointerCapture").mockImplementationOnce(() => { throw sentinel; });
        expect(() => pointer(h, "pointerdown")).toThrow(sentinel); capture.mockRestore();
        pointer(h, "pointermove", 20, 20); pointer(h, "pointerdown");
        const release = vi.spyOn(h.canvas, "releasePointerCapture").mockImplementationOnce(() => { throw sentinel; });
        expect(() => pointer(h, "pointerup")).toThrow(sentinel); release.mockRestore();
        pointer(h, "pointermove", 20, 20); pointer(h, "pointerup");
      });
    });
    for (const factory of [cameraFactory, createB3Camera]) {
      const canvas = new FakeCanvas(), windowPort = new FakeWindow(), sentinel = new Error("input blocked getter");
      let fail = false;
      const controller = factory({ camera: new THREE.PerspectiveCamera(), canvas: canvas as unknown as HTMLCanvasElement,
        windowPort: windowPort as unknown as HvpCameraOptions["windowPort"], isInputBlocked: () => {
          if (fail) { throw sentinel; } return false;
        } });
      try {
        fail = true; expect(() => controller.update(0.1)).toThrow(sentinel);
        expect(() => canvas.emit("pointerdown", { pointerId: 7, button: 0 })).toThrow(sentinel);
        controller.dispose(); expect(() => controller.update(0.1)).toThrow(sentinel);
      } finally { fail = false; controller.dispose(); }
    }
  });

  it("P03-T08 frozen oracle matches b3 blobs and protected avatar suffix is byte-identical", () => {
    const git = "C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
    const source = (path: string): string => execFileSync(git, ["show", `${P03_REFERENCE_SOURCE.commit}:apps/weltraum-browser/src/${path}`],
      { cwd: new URL("../../../../", import.meta.url), encoding: "utf8", timeout: 10000 });
    const player = source("hestia-prototype/player/presentation.ts"), camera = source("hvp/hvpCamera.ts");
    const blob = (text: string): string => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
    expect(blob(player)).toBe(P03_REFERENCE_SOURCE.playerBlob); expect(blob(camera)).toBe(P03_REFERENCE_SOURCE.cameraBlob);
    const oracle = readFileSync(new URL("../reference/hvp-parallel-p03-camera-reference.ts", import.meta.url), "utf8");
    expect(oracle.slice(oracle.indexOf("/** Render-only"), oracle.indexOf("\n\nexport type HvpCameraMode"))
      .replace("createB3PlayerVisualPose", "createHvpPlayerVisualPose"))
      .toBe(player.slice(player.indexOf("/** Render-only"), player.indexOf("\n\n/** Small authored")));
    expect(oracle.slice(oracle.indexOf("export type HvpCameraMode"), oracle.indexOf("\n// Verbatim protected"))
      .replace("createB3Camera", "createHvpCamera")).toBe(camera.slice(camera.indexOf("export type HvpCameraMode")));
    const candidate = readFileSync(new URL("../../src/hestia-prototype/player/presentation.ts", import.meta.url));
    const marker = Buffer.from("/** Small authored suit mesh");
    expect(candidate.subarray(candidate.indexOf(marker))).toStrictEqual(Buffer.from(B3_AVATAR_SOURCE));
    expect(Buffer.from(player.slice(player.indexOf(marker.toString())))).toStrictEqual(Buffer.from(B3_AVATAR_SOURCE));
  });

  it("P03-T09 measures direct construction removal, not app-wide allocation or FPS", () => {
    const n = 128;
    const count = (action: () => void): number => {
      allocation.count = 0; allocation.enabled = true;
      try { action(); return allocation.count; } finally { allocation.enabled = false; }
    };
    const results: Record<string, { b3: number; candidate: number }> = {};
    for (const scenario of ["playerLag", "playerReset"]) {
      const counts = [createB3PlayerVisualPose, playerFactory].map((factory) => {
        const view = factory(); view.update({ x: 0, y: 0, z: 0 }, 0);
        return count(() => {
          for (let i = 0; i < n; i += 1) { view.update({ x: 1, y: 0.5, z: -0.25 }, 1 / 60, scenario === "playerReset"); }
        });
      });
      results[scenario] = { b3: counts[0]!, candidate: counts[1]! };
    }
    for (const scenario of ["flyMove", "flyOpposite", "flyIdle", "orbitIdle", "flyWheel", "orbitWheel", "flyPointer", "orbitPointer"]) {
      const counts = [createB3Camera, cameraFactory].map((factory) => {
        const h = harness(factory);
        try {
          if (scenario.startsWith("fly")) { h.controller.setMode("Fly"); }
          if (scenario === "flyMove") { keys(h, ["KeyW", "KeyD", "KeyE", "ShiftLeft", "AltRight"]); }
          if (scenario === "flyOpposite") { keys(h, ["KeyW", "KeyS"]); }
          if (scenario.endsWith("Pointer")) { pointer(h, "pointerdown"); }
          return count(() => {
            for (let i = 0; i < n; i += 1) {
              if (scenario.endsWith("Wheel")) { h.canvas.emit("wheel", { deltaY: 1 }); }
              else if (scenario.endsWith("Pointer")) { pointer(h, "pointermove", 1, -1); }
              else { h.controller.update(1 / 60); }
            }
          });
        } finally { h.controller.dispose(); }
      });
      results[scenario] = { b3: counts[0]!, candidate: counts[1]! };
    }
    console.info(JSON.stringify({ kind: "P03_DIRECT_VECTOR3_CONSTRUCTIONS", source: P03_REFERENCE_SOURCE.commit,
      candidateSelection: process.env.P03_USE_B3 === "1" ? "b3-negative" : "worktree", callsPerScenario: n,
      excludes: "initialization,snapshots,Three-internals,clone,heap-bytes,GC,FPS,BodyHold", results }));
    expect(results.playerLag).toStrictEqual({ b3: 2 * n, candidate: 0 });
    expect(results.playerReset).toStrictEqual({ b3: n, candidate: 0 });
    const perCall: Record<string, number> = { flyMove: 5, flyOpposite: 4, flyIdle: 0, orbitIdle: 0,
      flyWheel: 2, orbitWheel: 1, flyPointer: 1, orbitPointer: 1 };
    for (const [scenario, expected] of Object.entries(perCall)) {
      expect(results[scenario]).toStrictEqual({ b3: expected * n, candidate: 0 });
    }
  });
});
