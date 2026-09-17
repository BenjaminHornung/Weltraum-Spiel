import { describe, expect, it } from "vitest";
import { createHvpAvatarMesh, createHvpPlayerVisualPose } from "../../src/hestia-prototype/player/presentation";

describe("HVP player presentation", () => {
  it("smooths verified step poses only, stays bounded and leaves simulation samples unchanged", () => {
    const view = createHvpPlayerVisualPose();
    view.update({ x: 0, y: 0.9, z: 0 }, 0);
    const target = Object.freeze({ x: 0, y: 1.15, z: 0.05 });
    view.update(target, 1 / 60);
    expect(view.position.y).toBeGreaterThan(0.9); expect(view.position.y).toBeLessThan(1.15);
    const first = view.position.y;
    view.update(target, 1 / 60);
    expect(view.position.y).toBeGreaterThan(first); expect(view.position.y).toBeLessThan(1.15);
    expect(target).toEqual({ x: 0, y: 1.15, z: 0.05 });
    view.update(target, 0, true); expect(view.position.toArray()).toEqual([0, 1.15, 0.05]);
    expect(() => view.update({ ...target, x: NaN }, 1 / 60)).toThrow();
  });
  it("is refresh-rate independent at fixed targets and does not blend teleports", () => {
    const result = (hz: number) => { const v = createHvpPlayerVisualPose(); v.update({ x: 0, y: 0, z: 0 }, 0);
      for (let i = 0; i < hz; i += 1) { v.update({ x: 1, y: 0, z: 0 }, 1 / hz); } return v.position.x; };
    expect(result(30)).toBeCloseTo(result(144), 10);
    const v = createHvpPlayerVisualPose(); v.update({ x: 0, y: 0, z: 0 }, 0);
    v.update({ x: 10, y: 0, z: 0 }, 1 / 60); expect(v.position.x).toBe(10);
  });
  it("renders an actual 1.8 m suit with one bounded material group", () => {
    const mesh = createHvpAvatarMesh(); let min = Infinity, max = -Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) { min = Math.min(min, mesh.positions[i]!); max = Math.max(max, mesh.positions[i]!); }
    expect(max - min).toBeCloseTo(1.8, 5); expect(mesh.indices.length / 3).toBeLessThan(200);
    expect(mesh.materialRanges).toHaveLength(1); expect(mesh.colors!.length).toBe(mesh.positions.length);
  });
});
