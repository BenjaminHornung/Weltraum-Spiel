import {beforeAll, expect, it} from "vitest";
import {decodeStructuralObject, encodeStructuralObject} from "../../src/voxel/structural";
import {createStructuralOwnerLedger, isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {decodeHvpBody, encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {initializeHvpRapier, R} from "../../src/hestia-prototype/physics/rapierPort";
import {restoreHvpBody} from "../../src/hestia-prototype/physics/restoreBody";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {admitHvpTransferredRigidBodyOwnedSteps, hvpRigidColliderBoxes, prepareHvpRigidBody,
  type HvpRigidRecipe, type HvpTransferredColliderBox} from "../../src/hestia-prototype/physics/rigidRecipe";
import {ingestHvpStructuralCells, prepareHvpStructuralIngestOwnedSteps,
  type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";

import {createOwnedAdaptiveBrickScope, adaptiveMaterializeBrickSteps, materializeAdaptiveBrick} from "../../src/voxel/adaptive/materialization";
import {adaptiveEditJournalSteps, adaptiveValidateEditJournalSteps, type AdaptiveEditInput} from "../../src/voxel/adaptive/edits";
import {authorityRevision, createAdaptiveBaseFieldDescriptor, createAdaptiveBrickKey, stableAuthorityId} from "../../src/voxel/adaptive";

const materials = [1, 2, 3, 4].map(i => ({materialId: i, densityKgPerCubicMeter: 2400 - i * 63,
  structuralClass: `m${i}`, destructible: true, tags: null}));
type Triple = readonly [number, number, number];
function cuboid([x, y, z]: Triple, [width, height, depth]: Triple): HvpStructuralCell[] {
  const cells: HvpStructuralCell[] = [];
  for (let k = 0; k < depth; k++) for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    cells.push({x: x + i, y: y + j, z: z + k, materialId: 1 + (i + 3 * j + k) % 4});
  }
  return cells;
}
function drain<T>(steps: Generator<unknown, T, unknown>, phases?: Set<unknown>): T {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    phases?.add(step.value);
  }
}
function withinBudget<T>(run: (reserve: ReturnType<typeof createStructuralOwnerLedger>["reserve"]) => T): T {
  const ledger = createStructuralOwnerLedger(0, 96 * 1024 * 1024, 128);
  try { return run(ledger.reserve); } finally { ledger.release(); }
}
function fastSource(id: string, cells: readonly HvpStructuralCell[], anchors: readonly HvpStructuralCell[] = []) {
  return withinBudget(reserve => drain(prepareHvpStructuralIngestOwnedSteps(id, cells, materials, anchors, reserve, undefined, true)));
}
function fastRecipe(source: HvpRigidRecipe["source"], massKg: number, colliderBoxes: readonly HvpTransferredColliderBox[], phases?: Set<unknown>) {
  return withinBudget(reserve => drain(admitHvpTransferredRigidBodyOwnedSteps(source, {massKg, colliderBoxes}, undefined, reserve, true), phases));
}
const mixed = cuboid([176, 82, 76], [24, 4, 4]).map(c => ({...c, materialId: c.x < 196 ? 1 : 3}));
const cases = {
  single: cuboid([7, 9, 32], [1, 1, 1]),
  negative: cuboid([-17, -16, -15], [4, 2, 2]),
  reversed: cuboid([15, 15, 15], [4, 2, 2]).reverse(),
  mixed,
  scattered: cuboid([6, 7, 8], [9, 5, 3]).filter((_, i) => i % 11 === 0),
  holes: cuboid([13, 7, 13], [9, 4, 6]).filter(c => (c.x + c.z + c.y) % 5 !== 0),
  manyRuns: cuboid([1, 1, 1], [12, 4, 3]),
  large: cuboid([0, 0, 0], [16, 8, 9]).map(c => ({...c, materialId: 1})),
  anchored: cuboid([2, 2, 2], [8, 2, 1]),
};

beforeAll(initializeHvpRapier);

it.each(Object.entries(cases))("keeps source bytes, resident proof digests and cold reconstruction exact for %s", (name, cells) => {
  const id = name === "mixed" ? "hvp-native-proof:mixed-run" : `native-source:${name}`;
  const anchors = name === "anchored" ? [cells[0]!] : [];
  const reference = ingestHvpStructuralCells(id, cells, materials, anchors);
  const candidate = fastSource(id, cells, anchors);
  const bytes = encodeStructuralObject(reference);
  expect(isIssuedStructuralObject(candidate)).toBe(true);
  expect(candidate.source).toEqual(reference.source);
  expect(encodeStructuralObject(candidate)).toBe(bytes);
  expect(decodeStructuralObject(bytes).contentHash).toBe(candidate.contentHash);
  if (name === "mixed") expect(candidate.contentHash).toBe("fnv1a64-v1:61ddd07e19e6a3ba");
});

it("rejects duplicate source coordinates and unknown source materials", () => {
  const [cell] = cases.single;
  expect(() => fastSource("duplicate", [cell!, cell!])).toThrow(/duplicate/i);
  expect(() => fastSource("foreign-material", [{...cell!, materialId: 99}])).toThrow(/material/i);
});

it("proves one exact mixed-density cuboid and rejects narrow, wide, shifted, split and foreign claims", () => {
  const cells = cuboid([-2, 2, 4], [4, 2, 2]);
  const source = fastSource("test-cuboid", cells);
  const reference = prepareHvpRigidBody(source);
  const count = reference.mass.occupiedVoxelCount;
  const kg = reference.mass.totalMassKg;
  const phases = new Set<unknown>();
  const requested = hvpRigidColliderBoxes(reference);
  expect(count).toBe(16);
  expect(requested).toEqual([{min: [-2, 2, 4], max: [2, 4, 6]}]);
  expect(fastRecipe(source, kg, requested, phases)).toEqual(reference);
  expect(phases.has("terrainNativeConnectivity")).toBe(false);
  const box = (min: Triple, max: Triple): HvpTransferredColliderBox => ({min, max});
  for (const invalid of [
    [box([-2, 2, 4], [1, 4, 6])], [box([-2, 2, 4], [3, 4, 6])],
    [box([-1, 2, 4], [3, 4, 6])], [box([-2, 3, 4], [2, 5, 6])], [box([-2, 2, 3], [2, 4, 5])],
    [box([-2, 2, 4], [0, 4, 6]), box([0, 2, 4], [2, 4, 6])],
    [box([-2, 2, 4], [1, 4, 6]), box([0, 2, 4], [1, 4, 6])],
  ]) expect(() => fastRecipe(source, kg, invalid)).toThrow(/coverage|partition/);
  expect(() => fastRecipe(source, kg + 1, requested)).toThrow(/mass mismatch/);
  expect(() => fastRecipe({...source}, kg, requested)).toThrow(/issued source/);
});

it("keeps the generic exact cover for connected holes and rejects disconnected occupancy", () => {
  const cells = cuboid([-2, 2, 4], [4, 3, 1]);
  const hole = fastSource("hole", cells.filter(c => c.x !== 0 || c.y !== 3));
  const reference = prepareHvpRigidBody(hole);
  const phases = new Set<unknown>();
  expect(fastRecipe(hole, reference.mass.totalMassKg, hvpRigidColliderBoxes(reference), phases)).toEqual(reference);
  expect(phases.has("terrainNativeConnectivity")).toBe(true);
  expect(() => fastRecipe(hole, reference.mass.totalMassKg, [{min: [-2, 2, 4], max: [2, 5, 5]}])).toThrow(/coverage/);
  const disconnected = fastSource("disconnected", [cells[0]!, cells.at(-1)!]);
  const kg = [cells[0]!, cells.at(-1)!].reduce((sum, c) => sum + materials[c.materialId - 1]!.densityKgPerCubicMeter / 512, 0);
  expect(() => fastRecipe(disconnected, kg, [{min: [-2, 2, 4], max: [2, 5, 5]}])).toThrow(/connected component/);
});

it("installs identical R05 bodies, restores their checkpoint and recuts the restored source", () => {
  const cells = cuboid([14, 2, 3], [5, 2, 2]);
  const id = "hvp:terrain-fragment:r1:12345678";
  const original = prepareHvpRigidBody(ingestHvpStructuralCells(id, cells, materials));
  const candidate = fastRecipe(fastSource(id, cells), original.mass.totalMassKg, hvpRigidColliderBoxes(original));
  const snapshot = (body: R.RigidBody) => ({position: {...body.translation()}, velocity: {...body.linvel()},
    rotation: {...body.rotation()}, omega: {...body.angvel()}, mass: body.mass(), halfExtents: {...body.collider(0).halfExtents()}});
  const worlds = Array.from({length: 3}, () => new R.World({x: 0, y: -9.81, z: 0}));
  try {
    const bodies = [original, candidate].map((recipe, i) => {
      const body = installHvpRigidBody(worlds[i]!, recipe);
      body.applyImpulseAtPoint({x: 0.5, y: 1, z: 0.2}, {x: 0.3, y: 0, z: 0.4}, true);
      worlds[i]!.step();
      return body;
    });
    expect(snapshot(bodies[1]!)).toEqual(snapshot(bodies[0]!));
    const saved = encodeHvpBody(id, "terrain", candidate, bodies[1]!);
    expect(saved).toEqual(encodeHvpBody(id, "terrain", original, bodies[0]!));
    const decoded = decodeHvpBody(saved);
    const restored = restoreHvpBody(worlds[2]!, decoded);
    expect(restored.numColliders()).toBe(1);
    expect(decoded.recipe.source.contentHash).toBe(original.source.contentHash);
    const hit: Triple = [14, 2, 3];
    expect(prepareHvpLocalBodyCut(decoded.recipe.source, hit, "recut", 2, "Box"))
      .toEqual(prepareHvpLocalBodyCut(original.source, hit, "recut", 2, "Box"));
  } finally { for (const world of worlds) world.free(); }
}, 30_000);


it("reuses only its own issued journal until disposal and rasterizes clipped overlapping runs in journal order", () => {
  withinBudget(reserve => {
    const run = (index: number, x: number, width: number): AdaptiveEditInput => ({
      operation: "AddBox", sequence: index, expectedRegionRevision: index - 1, resultRegionRevision: index,
      editId: "overlay." + index, actorId: "test", sourceId: "fixture", materialId: "hvp.material." + index,
      box: {min: {x, y: -1, z: 0}, max: {x: x + width, y: 0, z: 1}},
    });
    const scope = createOwnedAdaptiveBrickScope(reserve, true);
    let disposed = false;
    try {
      const journal = drain(adaptiveEditJournalSteps([run(1, -4, 12), run(2, 5, 15)], 0, scope.options));
      expect(drain(adaptiveValidateEditJournalSteps(journal, scope.options))).toBe(journal);
      const corrupt = Object.freeze({...journal, digest: "fnv1a64-v1:0000000000000000"});
      expect(() => drain(adaptiveValidateEditJournalSteps(corrupt, scope.options))).toThrow(/digest/i);
      const sparse = Array(2);
      sparse[1] = journal.records[1];
      expect(() => drain(adaptiveValidateEditJournalSteps(Object.freeze({...journal, records: Object.freeze(sparse)}), scope.options))).toThrow();

      const key = createAdaptiveBrickKey({bodyId: "body.hestia", surfaceFrameId: "frame.hvp", regionId: "region.raster",
        generatorVersion: "test", level: 4, originQuantum: {x: 0, y: -16, z: 0}});
      const baseField = createAdaptiveBaseFieldDescriptor({kind: "constant-v1", identity: stableAuthorityId("base.raster"),
        version: stableAuthorityId("v1"), sourceRevision: authorityRevision(1), sample: {density: 0, occupancy: 0, materialId: null}});
      const input = {key, baseField, editJournal: journal};
      const candidate = drain(adaptiveMaterializeBrickSteps(input, scope.options));
      expect(candidate).toEqual(materializeAdaptiveBrick(input));
      expect(candidate.material.slice(240, 256)).toEqual([...Array(5).fill("hvp.material.1"), ...Array(11).fill("hvp.material.2")]);
      scope.dispose();
      disposed = true;
      const revalidated = drain(adaptiveValidateEditJournalSteps(journal, scope.options));
      expect(revalidated).toEqual(journal);
      expect(revalidated).not.toBe(journal);
    } finally { if (!disposed) scope.dispose(); }
  });
});
