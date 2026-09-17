import { describe, expect, it } from "vitest";
import { pickHvpCell } from "../../src/hestia-prototype/terrain/picking";
import { assertHvpSafeQuarry, createHvpTerrainRoot, selectHvpCutCells } from "../../src/hestia-prototype/terrain/cutPlan";

const source = (readSlot = (x: number, y: number, z: number): number | undefined => x === 2 && y < 3 && z === 2 ? 1 : 0) => ({
  sizeX: 5, sizeY: 5, sizeZ: 5, cellMeters: 0.125, originMeters: { x: -0.25, y: 0, z: -0.25 }, sourceDigest: "fixture",
  readSlot
});
describe("HVP canonical cutter prepare", () => {
  it("admits only contiguous dry quarry tops and rejects cavity, support, depth and side cuts", () => {
    const make = (hole = false) => createHvpTerrainRoot({ ...source(), sizeX: 256, sizeY: 128, sizeZ: 256,
      originMeters: { x: -16, y: -8, z: -16 }, readSlot: (_x: number, y: number) => y < 82 && !(hole && y === 60) ? 1 : 0 }, "s", 1);
    const root = make();
    const request = { sessionId: "s", epoch: 1, revision: 0, sourceDigest: "fixture", commandId: "q", toolPolicy: "hvp-plasma-v1" as const,
      shape: { kind: "Box" as const, min: [34,78,50] as const, max: [38,82,54] as const } };
    expect(() => assertHvpSafeQuarry(root.prepare(request))).not.toThrow();
    expect(() => assertHvpSafeQuarry(make(true).prepare(request))).toThrow(/cavity/);
    expect(() => assertHvpSafeQuarry(root.prepare(request), [{ x: -11.5, z: -9.5 }])).toThrow(/supported object/);
    expect(() => assertHvpSafeQuarry(root.prepare({ ...request, shape: { kind: "Box", min: [34,77,50], max: [38,82,54] } }))).toThrow(/depth/);
    expect(() => assertHvpSafeQuarry(root.prepare({ ...request, shape: { kind: "Box", min: [34,76,50], max: [38,80,54] } }))).toThrow(/top-only/);
    expect(() => assertHvpSafeQuarry(root.prepare({ ...request, shape: { kind: "Box", min: [50,80,50], max: [51,82,51] } }))).toThrow(/outside/);
    expect(root.read().revision).toBe(0);
  });
  it("picks canonical cells without any render geometry and owns negative boundaries by direction", () => {
    const solid = source(() => 1);
    expect(pickHvpCell(solid, [0, 0.2, 0], [1, 0, 0])).toMatchObject({ kind: "Hit", cell: [2, 1, 2], distance: 0 });
    expect(pickHvpCell(solid, [0, 0.2, 0], [-1, 0, 0])).toMatchObject({ kind: "Hit", cell: [1, 1, 2] });
    expect(pickHvpCell(solid, [-0.125, 0.2, 0], [-1, 0, 0])).toMatchObject({ kind: "Hit", cell: [0, 1, 2] });
    expect(pickHvpCell(source(), [0.0625, 0.5, 0.0625], [0, -1, 0])).toMatchObject({ kind: "Hit", cell: [2, 2, 2], distance: 0.125 });
  });
  it("keeps unknown, miss and range separate and rejects invalid rays", () => {
    expect(pickHvpCell(source(() => undefined), [0, 0.2, 0], [1, 0, 0]).kind).toBe("Unknown");
    const long = { ...source(), sizeX: 64, originMeters: { x: 0, y: 0, z: 0 }, readSlot: (x: number) => x === 40 ? 1 : 0 };
    expect(pickHvpCell(long, [0, 0.2, 0.2], [1, 0, 0]).kind).toBe("Miss");
    expect(pickHvpCell({ ...long, readSlot: (x: number) => x === 16 ? 1 : 0 }, [0, 0.2, 0.2], [1, 0, 0])).toMatchObject({ kind: "Hit", distance: 2 });
    expect(() => pickHvpCell(long, [NaN, 0, 0], [1, 0, 0])).toThrow();
    expect(() => pickHvpCell(long, [0, 0, 0], [0, 0, 0])).toThrow();
  });
  it("enumerates half-open boxes and inclusive doubled-integer spheres exactly", () => {
    expect(selectHvpCutCells({ kind: "Box", min: [1, 1, 1], max: [3, 3, 3] })).toHaveLength(8);
    const sphere = selectHvpCutCells({ kind: "Sphere", center2: [5, 5, 5], radius2: 2 });
    const expected = [];
    for (let z = 0; z < 5; z += 1) { for (let y = 0; y < 5; y += 1) { for (let x = 0; x < 5; x += 1) {
      if ((2*x+1-5)**2 + (2*y+1-5)**2 + (2*z+1-5)**2 <= 4) { expected.push([x,y,z]); }
    } } }
    expect(sphere).toEqual(expected);
    expect(sphere).toHaveLength(7);
    expect(() => selectHvpCutCells({ kind: "Box", min: [0,0,0], max: [9,8,8] })).toThrow(/Budget/);
    expect(() => selectHvpCutCells({ kind: "Sphere", center2: [Number.MAX_SAFE_INTEGER,0,0], radius2: 8 })).toThrow();
  });
  it("prepares defensive leaves without writes and rejects stale, protected or unknown mixed edits", () => {
    const root = createHvpTerrainRoot(source(), "session", 1);
    const before = root.read();
    const request = { sessionId: "session", epoch: 1, revision: 0, sourceDigest: before.sourceDigest, commandId: "cut-1",
      toolPolicy: "hvp-plasma-v1" as const, shape: { kind: "Box" as const, min: [2,2,2] as const, max: [3,3,3] as const } };
    const plan = root.prepare(request);
    expect(root.read()).toBe(before);
    expect(before.readSlot(2,2,2)).toBe(1);
    expect(plan.after.readSlot(2,2,2)).toBe(0);
    expect(plan.changed).toEqual([{ cell: [2,2,2], before: 1, after: 0 }]);
    const copy = plan.after.copyLeaf(0,0,0); copy.fill(4);
    expect(plan.after.readSlot(2,2,2)).toBe(0);
    root.commit(plan);
    expect(root.read().revision).toBe(1);
    expect(() => root.prepare(request)).toThrow(/Stale/);
    expect(() => root.commit(plan)).toThrow(/Stale/);
    expect(() => root.prepare({ ...request, revision: 1, sourceDigest: root.read().sourceDigest,
      shape: { kind: "Box", min: [2,0,2], max: [3,2,3] } })).toThrow(/Protected/);
    expect(root.read().readSlot(2,1,2)).toBe(1);
    expect(() => root.prepare({ ...request, revision: 1, sourceDigest: root.read().sourceDigest,
      shape: { kind: "Box", min: [4,2,2], max: [6,3,3] } })).toThrow(/Unknown/);
  });
  it("keeps no-ops revision-neutral and distinguishes content leaves from halo dependants", () => {
    const root = createHvpTerrainRoot({ ...source(() => 1), sizeX: 32, sizeY: 32, sizeZ: 32 }, "s", 1);
    const request = { sessionId: "s", epoch: 1, revision: 0, sourceDigest: "fixture", commandId: "a", toolPolicy: "hvp-plasma-v1" as const,
      shape: { kind: "Box" as const, min: [15,15,15] as const, max: [16,16,16] as const } };
    const cut = root.prepare(request);
    expect(cut.contentLeaves).toEqual(["0:0:0"]);
    expect(cut.dependencyLeaves).toContain("1:1:1");
    root.commit(cut);
    expect(root.read().leafRevision(0,0,0)).toBe(1);
    expect(root.read().leafRevision(1,1,1)).toBe(0);
    const noOp = root.prepare({ ...request, commandId: "b", revision: 1, sourceDigest: root.read().sourceDigest });
    expect(noOp.changed).toHaveLength(0);
    root.commit(noOp);
    expect(root.read().revision).toBe(1);
  });
});
