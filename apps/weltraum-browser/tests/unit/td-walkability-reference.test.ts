import { describe, expect, it } from "vitest";
import {
  canonicalAdaptiveJson,
  createAdaptiveBaseFieldDescriptor
} from "../../src/voxel/adaptive/canonical";
import { createAdaptiveBrickKey } from "../../src/voxel/adaptive/coordinates";
import {
  createAdaptiveEditJournal,
  type AdaptiveEditInput
} from "../../src/voxel/adaptive/edits";
import {
  materializeAdaptiveBrick,
  type MaterializeAdaptiveBrickInput
} from "../../src/voxel/adaptive/materialization";
import { authorityRevision, stableAuthorityId } from "../../src/voxel/adaptive/validation";
import { buildTdWalkabilityReference } from "../reference/tdWalkabilityReference";

type Point = Readonly<{ x: number; y: number; z: number }>;

type FixtureEdit = Readonly<{
  editId: string;
  operation: "AddBox" | "SubtractBox";
  min: Point;
  max: Point;
  materialId?: string;
}>;

const origin = { x: 0, y: 0, z: 0 };
const allowedMaterials = new Set(["td.ref.solid"]);

const obstacle: FixtureEdit = {
  editId: "td.ref.obstacle",
  operation: "AddBox",
  min: { x: 6, y: 1, z: 6 },
  max: { x: 8, y: 2, z: 8 },
  materialId: "td.ref.solid"
};

const floorHole: FixtureEdit = {
  editId: "td.ref.floor-hole",
  operation: "SubtractBox",
  min: { x: 3, y: 0, z: 4 },
  max: { x: 4, y: 1, z: 5 }
};

const lowCeiling: FixtureEdit = {
  editId: "td.ref.low-ceiling",
  operation: "AddBox",
  min: { x: 2, y: 2, z: 5 },
  max: { x: 3, y: 3, z: 6 },
  materialId: "td.ref.solid"
};

const combinedEdits = [obstacle, floorHole, lowCeiling];

const translate = (point: Point, by: Point): Point => ({
  x: point.x + by.x,
  y: point.y + by.y,
  z: point.z + by.z
});

const input = (
  edits: readonly FixtureEdit[] = [],
  originQuantum: Point = origin,
  level = 4,
  airOccupancy = 0
): MaterializeAdaptiveBrickInput => {
  const floor: FixtureEdit = {
    editId: "td.ref.floor",
    operation: "AddBox",
    min: { x: 0, y: 0, z: 0 },
    max: { x: 16, y: 1, z: 16 },
    materialId: "td.ref.solid"
  };
  const editInputs: AdaptiveEditInput[] = [floor, ...edits].map((edit, index) => ({
    editId: edit.editId,
    sequence: index + 1,
    expectedRegionRevision: index,
    resultRegionRevision: index + 1,
    actorId: "td.ref.actor",
    sourceId: "td.ref.fixture",
    operation: edit.operation,
    box: {
      min: translate(edit.min, originQuantum),
      max: translate(edit.max, originQuantum)
    },
    ...(edit.materialId === undefined ? {} : { materialId: edit.materialId })
  }));

  return {
    key: createAdaptiveBrickKey({
      bodyId: "td.ref.body",
      surfaceFrameId: "td.ref.surface",
      regionId: "td.ref.region",
      generatorVersion: "td.ref.generator.v1",
      level,
      originQuantum
    }),
    baseField: createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1",
      identity: stableAuthorityId("td.ref.air-base"),
      version: stableAuthorityId("td.ref.base.v1"),
      sourceRevision: authorityRevision(0),
      sample: { density: 0, occupancy: airOccupancy, materialId: null }
    }),
    editJournal: createAdaptiveEditJournal(editInputs)
  };
};

const profiles: ReadonlyArray<{
  name: string;
  edits: readonly FixtureEdit[];
  blocked: readonly number[];
  walkableColumns: number;
}> = [
  { name: "air with floor", edits: [], blocked: [], walkableColumns: 256 },
  { name: "four-cell obstacle", edits: [obstacle], blocked: [102, 103, 118, 119], walkableColumns: 252 },
  { name: "floor hole", edits: [floorHole], blocked: [67], walkableColumns: 255 },
  { name: "low ceiling", edits: [lowCeiling], blocked: [82], walkableColumns: 255 },
  {
    name: "combined obstacles",
    edits: combinedEdits,
    blocked: [67, 82, 102, 103, 118, 119],
    walkableColumns: 250
  }
];

describe("TD walkability reference consumer", () => {
  it.each(profiles)("materializes the literal $name profile", ({ edits, blocked, walkableColumns }) => {
    const result = buildTdWalkabilityReference(input(edits), allowedMaterials);
    const actualBlocked: number[] = [];
    for (let index = 0; index < result.walkable.length; index += 1) {
      if (result.walkable[index] === 0) {
        actualBlocked.push(index);
      }
    }

    expect(result.walkable).toBeInstanceOf(Uint8Array);
    expect(result.walkable.byteLength).toBe(256);
    expect(actualBlocked).toEqual(blocked);
    expect([...result.walkable].reduce((sum, value) => sum + value, 0)).toBe(walkableColumns);
  });

  it("binds its metadata to the real materialized brick", () => {
    const fixture = input();
    const brick = materializeAdaptiveBrick(fixture);
    const result = buildTdWalkabilityReference(fixture, allowedMaterials);

    expect(result.sourceContentHash).toBe(brick.contentHash);
    expect(result.originQuantum).toEqual(brick.key.originQuantum);
    expect(result.cellSizeMeters).toBe(brick.cellSizeMeters);
    expect(Object.isFrozen(result.originQuantum)).toBe(true);
  });

  it("is repeatable and preserves local walkability under an origin translation", () => {
    const first = buildTdWalkabilityReference(input(combinedEdits), allowedMaterials);
    const repeated = buildTdWalkabilityReference(input(combinedEdits), allowedMaterials);
    const translated = buildTdWalkabilityReference(
      input(combinedEdits, { x: 16, y: 16, z: 16 }),
      allowedMaterials
    );

    expect(repeated.walkable).toEqual(first.walkable);
    expect(repeated.sourceContentHash).toBe(first.sourceContentHash);
    expect(translated.walkable).toEqual(first.walkable);
    expect(translated.originQuantum).toEqual({ x: 16, y: 16, z: 16 });
    expect(translated.sourceContentHash).not.toBe(first.sourceContentHash);
  });

  it("rejects unsupported coverage and non-binary occupancy", () => {
    expect(() => buildTdWalkabilityReference(input([], origin, 3), allowedMaterials))
      .toThrow("TD_REF_UNSUPPORTED_COVERAGE");
    expect(() => buildTdWalkabilityReference(input([], origin, 4, 0.5), allowedMaterials))
      .toThrow("TD_REF_UNSUPPORTED_OCCUPANCY");
  });

  it("rejects unknown material in a column already blocked by a floor hole", () => {
    const unknownMaterial: FixtureEdit = {
      editId: "td.ref.unknown-material",
      operation: "AddBox",
      min: { x: 3, y: 1, z: 4 },
      max: { x: 4, y: 2, z: 5 },
      materialId: "td.ref.unregistered"
    };

    expect(() => buildTdWalkabilityReference(input([floorHole, unknownMaterial]), allowedMaterials))
      .toThrow("TD_REF_UNKNOWN_MATERIAL");
  });

  it("preserves source input and gives each consumer result an independent buffer", () => {
    const fixture = input(combinedEdits);
    const inputBefore = canonicalAdaptiveJson(fixture);
    const first = buildTdWalkabilityReference(fixture, allowedMaterials);
    const expected = new Uint8Array(first.walkable);
    first.walkable.fill(0);
    const later = buildTdWalkabilityReference(fixture, allowedMaterials);

    expect(canonicalAdaptiveJson(fixture)).toBe(inputBefore);
    expect(later.walkable.buffer).not.toBe(first.walkable.buffer);
    expect(later.walkable).toEqual(expected);
  });
});
