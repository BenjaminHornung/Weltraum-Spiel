import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_CELL_COUNT, ADAPTIVE_BRICK_CELLS_PER_AXIS, ADAPTIVE_BRICK_SCHEMA_VERSION,
  ADAPTIVE_MATERIALIZATION_VERSION, AdaptiveAuthorityError, authorityRevision, canonicalAdaptiveJson,
  cellSizeMetersForLevel, cellSizeQuantumForLevel, createAdaptiveBaseFieldDescriptor, createAdaptiveBrickKey,
  createAdaptiveEditJournal, deepFreeze, evaluateAdaptiveBaseFieldDescriptor, hashAdaptiveBaseFieldDescriptor,
  hashAdaptiveCanonical, isDeepFrozen, materializeAdaptiveBrick, parentOf, requireFinite,
  serializeMaterializedAdaptiveBrick, stableAuthorityId, validateMaterializedAdaptiveBrick,
  type AdaptiveEditInput, type AdaptiveEditRecord, type MaterializeAdaptiveBrickInput,
  type MaterializedAdaptiveBrick, type StableAuthorityId
} from "../../src/voxel/adaptive";

type Point = { x: number; y: number; z: number };
type Footprint = { min: Point; max: Point };
type Edit = Pick<AdaptiveEditInput, "operation" | "box" | "sphere" | "materialId" | "semanticId">;
type Sample = { density: number; occupancy: number; materialId: StableAuthorityId | null; semanticId: StableAuthorityId | null };
const axes = ["x", "y", "z"] as const;
const key = (level = 4, originQuantum: Point = { x: 0, y: 0, z: 0 }) => createAdaptiveBrickKey({
  bodyId: "planet.raster", surfaceFrameId: "frame.surface", regionId: "region.raster",
  generatorVersion: "generator.v1", level, originQuantum
});
const base = (occupancy = 0, density = 0.25) => createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1", identity: stableAuthorityId("base.raster"), version: stableAuthorityId("generator.v1"),
  sourceRevision: authorityRevision(7), sample: {
    density, occupancy, materialId: stableAuthorityId("material.base"), semanticId: stableAuthorityId("semantic.base")
  }
});
const journal = (edits: readonly Edit[]) => createAdaptiveEditJournal(edits.map((edit, index) => ({
  editId: `edit.${index}`, sequence: index + 1, expectedRegionRevision: index, resultRegionRevision: index + 1,
  actorId: "actor.raster", sourceId: "tool.raster", ...edit
})));

// The pre-P02 footprint rule, not a cell-center sphere. BigInt independently
// represents the exact integer squared-distance comparison used by its limb math.
const applies = (cell: Footprint, edit: AdaptiveEditRecord): boolean => {
  if (edit.box !== undefined) {
    return axes.every(axis => cell.min[axis] < edit.box!.max[axis] && cell.max[axis] > edit.box!.min[axis]);
  }
  const sphere = edit.sphere;
  if (sphere === undefined) {
    return false;
  }
  let squaredDistance = 0n;
  let tangentPointIsIncluded = true;
  for (const axis of axes) {
    const coordinate = sphere.center[axis];
    const nearest = coordinate < cell.min[axis] ? cell.min[axis] : coordinate > cell.max[axis] ? cell.max[axis] : coordinate;
    if (nearest === cell.max[axis] && coordinate >= cell.max[axis]) {
      tangentPointIsIncluded = false;
    }
    const delta = Math.abs(coordinate - nearest);
    if (!Number.isSafeInteger(delta) || delta > sphere.radiusQuantum) {
      return false;
    }
    squaredDistance += BigInt(delta) ** 2n;
  }
  const radiusSquared = BigInt(sphere.radiusQuantum) ** 2n;
  return squaredDistance < radiusSquared || (squaredDistance === radiusSquared && tangentPointIsIncluded);
};

const apply = (sample: Sample, edit: AdaptiveEditRecord): void => {
  switch (edit.operation) {
    case "SubtractSphere":
    case "SubtractBox":
      sample.occupancy = 0;
      sample.density = Math.max(Math.abs(sample.density), 1);
      break;
    case "AddSphere":
    case "AddBox":
      sample.occupancy = 1;
      sample.density = -Math.max(Math.abs(sample.density), 1);
      if (edit.materialId !== undefined) {
        sample.materialId = edit.materialId;
      }
      if (edit.semanticId !== undefined) {
        sample.semanticId = edit.semanticId;
      }
      break;
    case "SetMaterialBox":
      if (edit.materialId === undefined) {
        throw new Error("Invalid reference fixture: SetMaterialBox requires material");
      }
      sample.materialId = edit.materialId;
      if (edit.semanticId !== undefined) {
        sample.semanticId = edit.semanticId;
      }
      break;
  }
};

// Frozen test-local reference of the original cells-times-journal construction.
// It deliberately has no candidate raster or brick-prefilter dependency.
const reference = ({ key: brickKey, baseField, editJournal }: MaterializeAdaptiveBrickInput): MaterializedAdaptiveBrick => {
  const initial = evaluateAdaptiveBaseFieldDescriptor(baseField);
  const size = cellSizeQuantumForLevel(brickKey.level);
  const density: number[] = [], occupancy: number[] = [];
  const material: (StableAuthorityId | null)[] = [], semantic: (StableAuthorityId | null)[] = [];
  for (let z = 0; z < ADAPTIVE_BRICK_CELLS_PER_AXIS; z += 1) {
    for (let y = 0; y < ADAPTIVE_BRICK_CELLS_PER_AXIS; y += 1) {
      for (let x = 0; x < ADAPTIVE_BRICK_CELLS_PER_AXIS; x += 1) {
        const min = { x: brickKey.originQuantum.x + x * size, y: brickKey.originQuantum.y + y * size, z: brickKey.originQuantum.z + z * size };
        const cell = { min, max: { x: min.x + size, y: min.y + size, z: min.z + size } };
        const sample: Sample = { ...initial, semanticId: initial.semanticId ?? null };
        for (const edit of editJournal.records) {
          if (applies(cell, edit)) {
            apply(sample, edit);
          }
        }
        density.push(requireFinite(sample.density, `density/${density.length}`));
        occupancy.push(requireFinite(sample.occupancy, `occupancy/${occupancy.length}`));
        material.push(sample.materialId);
        semantic.push(sample.semanticId);
      }
    }
  }
  const channels = { density, occupancy, material, semantic };
  const metadata = {
    baseFieldIdentity: baseField.identity, baseFieldVersion: baseField.version,
    baseFieldDescriptorDigest: hashAdaptiveBaseFieldDescriptor(baseField), sourceRevision: baseField.sourceRevision,
    editRevision: editJournal.revision, journalDigest: editJournal.digest
  };
  const versions = { brickSchemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION, materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION };
  const authorityInputDigest = hashAdaptiveCanonical({
    schemaVersion: "adaptive-microvoxel-authority-input-v1", ...versions, key: brickKey, ...metadata
  });
  const parent = parentOf(brickKey);
  const provenancePayload = {
    schemaVersion: "adaptive-microvoxel-provenance-v1" as const, ...metadata,
    hierarchyKeyHash: hashAdaptiveCanonical(brickKey), materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    parentProvenanceHash: parent === null ? null : hashAdaptiveCanonical({
      schemaVersion: "adaptive-microvoxel-parent-provenance-v1", ...versions, key: parent, ...metadata
    })
  };
  const dimensions = { cellSizeQuantum: size, cellSizeMeters: cellSizeMetersForLevel(brickKey.level), cellCount: ADAPTIVE_BRICK_CELL_COUNT };
  return deepFreeze({
    schemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION, materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    key: brickKey, originQuantum: brickKey.originQuantum, level: brickKey.level, ...dimensions, ...channels,
    baseFieldDescriptorDigest: metadata.baseFieldDescriptorDigest, sourceRevision: metadata.sourceRevision, editRevision: metadata.editRevision,
    contentHash: hashAdaptiveCanonical({ schemaVersion: "adaptive-microvoxel-content-hash-input-v1", authorityInputDigest, ...dimensions, ...channels }),
    provenance: { ...provenancePayload, provenanceHash: hashAdaptiveCanonical(provenancePayload) }
  });
};

const compare = (input: MaterializeAdaptiveBrickInput): MaterializedAdaptiveBrick => {
  const before = canonicalAdaptiveJson(input);
  const expected = reference(input);
  const actual = materializeAdaptiveBrick(input);
  expect(actual.density).toEqual(expected.density);
  expect(actual.occupancy).toEqual(expected.occupancy);
  expect(actual.material).toEqual(expected.material);
  expect(actual.semantic).toEqual(expected.semantic);
  expect(serializeMaterializedAdaptiveBrick(actual)).toBe(serializeMaterializedAdaptiveBrick(expected));
  expect(validateMaterializedAdaptiveBrick(actual)).toEqual(actual);
  expect(isDeepFrozen(actual)).toBe(true);
  expect(canonicalAdaptiveJson(input)).toBe(before);
  return actual;
};

describe("P02 edit raster parity", () => {
  const cellBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };
  it("retains material/semantic on subtract and omitted Add fields, and writes material on air", () => {
    const first: Edit = { operation: "AddBox", box: cellBox, materialId: "material.a", semanticId: "semantic.a" };
    const run = (edits: Edit[]) => compare({ key: key(), baseField: base(), editJournal: journal(edits) });
    const subtracted = run([first, { operation: "SubtractBox", box: cellBox }]);
    expect([subtracted.density[0], subtracted.occupancy[0], subtracted.material[0], subtracted.semantic[0]])
      .toEqual([1, 0, "material.a", "semantic.a"]);
    const air = run([{ operation: "SetMaterialBox", box: cellBox, materialId: "material.b" }]);
    expect([air.density[0], air.occupancy[0], air.material[0], air.semantic[0]])
      .toEqual([0.25, 0, "material.b", "semantic.base"]);
    const omitted = run([first, { operation: "SubtractBox", box: cellBox }, { operation: "AddBox", box: cellBox }]);
    expect([omitted.occupancy[0], omitted.material[0], omitted.semantic[0]]).toEqual([1, "material.a", "semantic.a"]);
    const ordered = run([first, { operation: "SetMaterialBox", box: cellBox, materialId: "material.b" },
      { operation: "SubtractBox", box: cellBox }, { operation: "AddBox", box: cellBox, materialId: "material.c" }]);
    expect([ordered.occupancy[0], ordered.material[0], ordered.semantic[0]]).toEqual([1, "material.c", "semantic.a"]);
  });

  it.each([0, 1, 2, 3, 4])("clips negative Box bounds and excludes the positive cell boundary at level %i", level => {
    const brickKey = key(level, { x: -256, y: -256, z: -256 });
    const size = cellSizeQuantumForLevel(brickKey.level);
    const result = compare({ key: brickKey, baseField: base(), editJournal: journal([{
      operation: "AddBox", box: { min: { x: -257, y: -256, z: -256 }, max: { x: -256 + size, y: -256 + size, z: -256 + size } }
    }]) });
    expect(result.occupancy[0]).toBe(1);
    expect(result.occupancy[1]).toBe(0);
    expect(result.occupancy.filter(value => value === 1)).toHaveLength(1);
  });

  it("keeps external edits in revision, complete journal digest and provenance", () => {
    const input = { key: key(), baseField: base() };
    const empty = compare({ ...input, editJournal: journal([]) });
    const outsideJournal = journal([{ operation: "AddBox", box: { min: { x: 1000, y: 1000, z: 1000 }, max: { x: 1001, y: 1001, z: 1001 } } }]);
    const outside = compare({ ...input, editJournal: outsideJournal });
    for (const channel of ["density", "occupancy", "material", "semantic"] as const) {
      expect(outside[channel]).toEqual(empty[channel]);
    }
    expect(outside.editRevision).toBe(1);
    expect(outside.provenance.journalDigest).toBe(outsideJournal.digest);
    expect(outside.contentHash).not.toBe(empty.contentHash);
    expect(outside.provenance.provenanceHash).not.toBe(empty.provenance.provenanceHash);
  });

  it("uses the exact fallback for an overlapping Box with an unsafe local difference", () => {
    const origin = 2 ** 52;
    const editJournal = journal([{ operation: "AddBox", box: {
      min: { x: -origin, y: 0, z: 0 }, max: { x: origin + 16, y: 16, z: 16 }
    } }]);
    expect(Number.isSafeInteger(editJournal.records[0]!.box!.min.x - origin)).toBe(false);
    const result = compare({ key: key(4, { x: origin, y: 0, z: 0 }), baseField: base(), editJournal });
    expect(result.occupancy.every(value => value === 1)).toBe(true);
  });

  it("preserves inclusive negative and exclusive positive Sphere tangency and exact large squares", () => {
    const run = (center: Point, radiusQuantum: number) => compare({ key: key(), baseField: base(),
      editJournal: journal([{ operation: "AddSphere", sphere: { center, radiusQuantum } }]) });
    expect(run({ x: -2, y: 0, z: 0 }, 2).occupancy[0]).toBe(1);
    expect(run({ x: 3, y: 0, z: 0 }, 2).occupancy[0]).toBe(0);
    // r*r+1 rounds to r*r as Number here; the exact original predicate must reject.
    expect(run({ x: -(2 ** 27), y: -1, z: 0 }, 2 ** 27).occupancy[0]).toBe(0);
  });

  it("retains degenerate-bound, provenance, sparse-channel and accessor rejection", () => {
    expect(() => journal([{ operation: "AddBox", box: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 1 } } }]))
      .toThrow(AdaptiveAuthorityError);
    const brick = compare({ key: key(), baseField: base(), editJournal: journal([]) });
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, provenance: { ...brick.provenance, journalDigest: "fnv1a64-v1:0000000000000000" } }))
      .toThrow(AdaptiveAuthorityError);
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, density: new Array<number>(ADAPTIVE_BRICK_CELL_COUNT) }))
      .toThrow(AdaptiveAuthorityError);
    let getterCalls = 0;
    const density = [...brick.density];
    Object.defineProperty(density, "0", { enumerable: true, get: () => { getterCalls += 1; return 0; } });
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, density })).toThrow(AdaptiveAuthorityError);
    expect(getterCalls).toBe(0);
  });

  it.each(Array.from({ length: 200 }, (_, index) => index))("matches old complete bytes for mixed journal %i at all five levels", pattern => {
    let state = (0x17309a7 + pattern) >>> 0;
    const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
    const origin = { x: ((next() % 5) - 2) * 256, y: ((next() % 5) - 2) * 256, z: ((next() % 5) - 2) * 256 };
    const point = (): Point => ({ x: origin.x + (next() % 40) - 8, y: origin.y + (next() % 40) - 8, z: origin.z + (next() % 40) - 8 });
    const operations = ["AddBox", "SubtractBox", "SetMaterialBox", "AddSphere", "SubtractSphere"] as const;
    const edits: Edit[] = Array.from({ length: 8 }, (_, index) => {
      const operation = operations[index % operations.length]!;
      const min = point();
      return {
        operation,
        ...(operation.endsWith("Sphere") ? { sphere: { center: min, radiusQuantum: 1 + next() % 24 } }
          : { box: { min, max: { x: min.x + 1 + next() % 24, y: min.y + 1 + next() % 24, z: min.z + 1 + next() % 24 } } }),
        ...(operation === "SetMaterialBox" || (operation.startsWith("Add") && next() % 2 === 0) ? { materialId: `material.${next() % 3}` } : {}),
        ...(!operation.startsWith("Subtract") && next() % 2 === 0 ? { semanticId: `semantic.${next() % 3}` } : {})
      };
    });
    const input = { baseField: base((pattern % 3) / 2, (pattern % 3) - 0.5), editJournal: journal(edits) };
    for (const level of [0, 1, 2, 3, 4]) {
      compare({ ...input, key: key(level, origin) });
    }
  });
});
