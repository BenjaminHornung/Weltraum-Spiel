import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { deriveStructuralComponentClassification, type StructuralObject } from "../../src/voxel/structural";
import { reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "../../src/voxel/structural/model";
import { createStructuralCellAddress } from "../../src/voxel/structural/coordinates";
import { structuralIssuedComponentClassificationSteps } from "../../src/voxel/structural/classificationSteps";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";

const hashProbe = vi.hoisted(() => ({ cursors: 0, disposed: 0, suspended: false }));
vi.mock("../../src/voxel/adaptive/ownedCanonicalHashSteps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/voxel/adaptive/ownedCanonicalHashSteps")>();
  return {
    ...actual,
    createOwnedCanonicalHashCursor(payload: unknown) {
      const cursor = actual.createOwnedCanonicalHashCursor(payload);
      hashProbe.cursors += 1;
      return {
        advance(units: number) {
          const result = cursor.advance(units);
          hashProbe.suspended = result === undefined;
          return result;
        },
        dispose() {
          hashProbe.disposed += 1;
          hashProbe.suspended = false;
          cursor.dispose();
        }
      };
    }
  };
});

const budgets = { maxVisitedCells: 32_768, maxComponents: 32, maxIndexedFacts: 262_144 };
const materials = [
  { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null },
  { materialId: 2, densityKgPerCubicMeter: 2400, structuralClass: "stone", destructible: true, tags: null }
];

const drain = (object: StructuralObject, budgetValue = budgets, labels: string[] = []) => {
  const steps = structuralIssuedComponentClassificationSteps(object, budgetValue);
  for (;;) {
    const step = steps.next();
    if (step.done) {
      return step.value;
    }
    labels.push(step.value);
  }
};

const authoredRows = () => ingestHvpStructuralCells("owned-classification-352", Array.from({ length: 352 }, (_, index) => ({
  x: index - 176,
  y: 0,
  z: 0,
  materialId: index % 7 === 0 ? 2 : 1
})), materials);

const addressAtX = (object: StructuralObject, x: number) => {
  for (const brick of object.bricks) {
    const cell = brick.cells.find((entry) => brick.key.originQuantum.x + entry.localIndex % 16 === x);
    if (cell !== undefined) {
      return structuralAddressForBrickCell(brick, cell.localIndex);
    }
  }
  const brick = object.bricks.find((entry) => entry.key.originQuantum.x === Math.floor(x / 16) * 16);
  if (brick === undefined) {
    throw new Error(`No issued brick for x=${x}`);
  }
  return createStructuralCellAddress(brick.key, { x: x - brick.key.originQuantum.x, y: 0, z: 0 });
};

const captureError = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      const value = error as Error & { code?: unknown; path?: unknown };
      return { name: value.name, message: value.message, code: value.code, path: value.path };
    }
    return error;
  }
  return null;
};

describe("issued Structural classification steps", () => {
  it("matches the generic full output and keeps finalization task-sliced for the 352-cell owner workload", () => {
    const source = authoredRows();
    const generic = deriveStructuralComponentClassification(source, budgets);
    const labels: string[] = [];
    const owned = drain(source, budgets, labels);

    expect(owned).toEqual(generic);
    expect(createHash("sha256").update(JSON.stringify(owned)).digest("hex"))
      .toBe(createHash("sha256").update(JSON.stringify(generic)).digest("hex"));
    const lastCellBatch = labels.lastIndexOf("classificationCells");
    expect(lastCellBatch).toBeGreaterThanOrEqual(0);
    expect(labels.slice(lastCellBatch + 1)).toContain("classification");
    expect(Object.isFrozen(owned)).toBe(true);
    expect(Object.isFrozen(owned.components[0]!.occupiedCells)).toBe(true);
    expect(Object.isFrozen(owned.components[0]!.occupiedCells[0])).toBe(true);
  });

  it("preserves active anchor/joint membership, canonical facts, and budget errors", () => {
    const base = ingestHvpStructuralCells("owned-classification-facts", [
      { x: -1, y: 0, z: 0, materialId: 1 },
      { x: 0, y: 0, z: 0, materialId: 2 },
      { x: 1, y: 0, z: 0, materialId: 1 },
      { x: 9, y: 0, z: 0, materialId: 2 }
    ], materials, [{ x: -1, y: 0, z: 0 }]);
    const facts = reconstructStructuralObjectInternal({
      objectId: base.objectId,
      frame: base.frame,
      source: base.source,
      materials: base.materials,
      bricks: base.bricks,
      anchors: base.anchors,
      joints: [{
        jointId: "joint.bridge",
        jointClass: "weld",
        endpointA: { cell: addressAtX(base, 0), role: "primary" },
        endpointB: { cell: addressAtX(base, 9), role: "secondary" }
      }],
      objectRevision: base.objectRevision,
      editRevision: base.editRevision,
      commandEvidence: base.commandEvidence
    });
    const generic = deriveStructuralComponentClassification(facts, { ...budgets, maxVisitedCells: 8 });
    const owned = drain(facts, { ...budgets, maxVisitedCells: 8 });
    expect(owned).toEqual(generic);
    expect(owned.components.find((component) => component.anchored)?.activeAnchors.map((fact) => fact.anchorId))
      .toEqual([facts.anchors[0]!.anchorId]);
    const jointEndpoints = owned.components.flatMap((component) => component.activeJoints)
      .map((fact) => `${fact.jointId}:${fact.endpoint}`).sort();
    expect(jointEndpoints).toEqual(["joint.bridge:A", "joint.bridge:B"]);

    const budgetCases = [
      { ...budgets, maxVisitedCells: 3 },
      { ...budgets, maxComponents: 1 },
      { ...budgets, maxIndexedFacts: 2 }
    ];
    for (const budget of budgetCases) {
      const genericError = captureError(() => deriveStructuralComponentClassification(facts, budget));
      expect(captureError(() => drain(facts, budget))).toEqual(genericError);
    }
  });

  it("rejects copied sources and releases the owned hash cursor when cancelled during finalization", () => {
    const source = authoredRows();
    const copy = { ...source } as StructuralObject;
    const copiedSteps = structuralIssuedComponentClassificationSteps(copy, budgets);
    expect(() => copiedSteps.next()).toThrow(/issued structural source/);

    hashProbe.cursors = 0;
    hashProbe.disposed = 0;
    hashProbe.suspended = false;
    const steps = structuralIssuedComponentClassificationSteps(source, budgets);
    for (;;) {
      const step = steps.next();
      if (step.done) {
        throw new Error("Expected a bounded owned-hash yield before classification completed");
      }
      if (hashProbe.suspended) {
        break;
      }
    }
    expect(hashProbe.cursors).toBeGreaterThan(0);
    expect(hashProbe.disposed).toBeLessThan(hashProbe.cursors);
    const cancelled = new Error("cancel classification");
    expect(() => steps.throw(cancelled)).toThrow(cancelled);
    expect(hashProbe.disposed).toBe(hashProbe.cursors);
    expect(steps.next().done).toBe(true);
  });
});
