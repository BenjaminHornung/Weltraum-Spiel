import { describe, expect, it } from "vitest";
import {
  deriveStructuralComponentClassification,
  type StructuralComponentClassification,
  type StructuralObject
} from "../../src/voxel/structural";
import { isIssuedStructuralObject, reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "../../src/voxel/structural/model";
import * as classificationSteps from "../../src/voxel/structural/classificationSteps";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";

const budgets = { maxVisitedCells: 32_768, maxComponents: 32, maxIndexedFacts: 262_144 };
const materials = [{
  materialId: 1,
  densityKgPerCubicMeter: 512,
  structuralClass: "hull",
  destructible: true,
  tags: null
}];
const MAX_CLASSIFICATION_STEPS = 10_000;

const firstCellAddress = (object: StructuralObject) => {
  const brick = object.bricks[0];
  const cell = brick?.cells[0];
  if (brick === undefined || cell === undefined) {
    throw new Error("Classification control fixture requires an occupied cell");
  }
  return structuralAddressForBrickCell(brick, cell.localIndex);
};

const issueWithJoints = (base: StructuralObject, joints: readonly unknown[]) =>
  reconstructStructuralObjectInternal({
    objectId: base.objectId,
    frame: base.frame,
    source: base.source,
    materials: base.materials,
    bricks: base.bricks,
    anchors: [],
    joints,
    objectRevision: base.objectRevision,
    editRevision: base.editRevision,
    commandEvidence: base.commandEvidence
  });

const jointsAt = (cell: ReturnType<typeof firstCellAddress>) => Array.from({ length: 65 }, (_, index) => ({
  jointId: `joint.classification.${String(index).padStart(3, "0")}`,
  jointClass: "weld",
  endpointA: { cell, role: "primary" },
  endpointB: { cell, role: "secondary" }
}));

const drainIssued = (object: StructuralObject) => {
  // b3 lacks the new issued finalizer: keep its generic baseline collectable for A/B.
  const classify = classificationSteps.structuralIssuedComponentClassificationSteps
    ?? classificationSteps.structuralComponentClassificationSteps;
  const steps = classify(object, budgets);
  const labels: string[] = [];
  for (let stepCount = 0; stepCount < MAX_CLASSIFICATION_STEPS; stepCount += 1) {
    const step = steps.next();
    if (step.done) {
      return { classification: step.value, labels, totalSteps: stepCount + 1 };
    }
    labels.push(step.value);
  }
  throw new Error(`Issued classification exceeded ${MAX_CLASSIFICATION_STEPS} total steps`);
};

describe("Structural classification contract controls", () => {
  it("R03 retains b3 constructor observations without exposing private component/cell-key wrappers", () => {
    const source = ingestHvpStructuralCells("classification-r03-single", [{ x: 0, y: 0, z: 0, materialId: 1 }], materials);
    const control = deriveStructuralComponentClassification(source, budgets);
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "constructor");
    if (descriptor === undefined) {
      throw new Error("Array.prototype.constructor descriptor is unavailable");
    }
    const sentinel = Object.freeze({ sentinel: "classification-array-species" });
    let result: StructuralComponentClassification | undefined;
    let failure: unknown;

    try {
      Object.defineProperty(Array.prototype, "constructor", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get(this: unknown) {
          if (Array.isArray(this)) {
            const firstEntry = Object.getOwnPropertyDescriptor(this, "0")?.value;
            if (firstEntry !== null && typeof firstEntry === "object"
              && Object.prototype.hasOwnProperty.call(firstEntry, "component")
              && Object.prototype.hasOwnProperty.call(firstEntry, "cellKeys")) {
              throw sentinel;
            }
          }
          return Array;
        }
      });
      try {
        result = deriveStructuralComponentClassification(source, budgets);
      } catch (error) {
        failure = error;
      }
    } finally {
      Object.defineProperty(Array.prototype, "constructor", descriptor);
    }

    expect(failure).not.toBe(sentinel);
    expect(failure).toBeUndefined();
    expect(result).toEqual(control);
    expect(JSON.stringify(result)).toBe(JSON.stringify(control));
  });

  it("R02 yields for fact-heavy issued inputs and above-threshold sources within a bounded step count", () => {
    const oneCell = ingestHvpStructuralCells("classification-r02-single", [{ x: 0, y: 0, z: 0, materialId: 1 }], materials);
    const oneCellAddress = firstCellAddress(oneCell);
    const noFacts = issueWithJoints(oneCell, []);
    const factHeavy = issueWithJoints(oneCell, jointsAt(oneCellAddress));
    expect(isIssuedStructuralObject(noFacts)).toBe(true);
    expect(isIssuedStructuralObject(factHeavy)).toBe(true);

    const largeBase = ingestHvpStructuralCells("classification-r02-large", Array.from({ length: 257 }, (_, x) => ({
      x, y: 0, z: 0, materialId: 1
    })), materials);
    const large = issueWithJoints(largeBase, jointsAt(firstCellAddress(largeBase)));
    expect(isIssuedStructuralObject(large)).toBe(true);
    // Drain all three controls before the fact-yield assertion can fail.
    const noFactsRun = drainIssued(noFacts);
    const factHeavyRun = drainIssued(factHeavy);
    const largeRun = drainIssued(large);
    const noFactsFinalizationYields = noFactsRun.labels.filter((label) => label === "classification").length;
    const factHeavyFinalizationYields = factHeavyRun.labels.filter((label) => label === "classification").length;
    expect(noFactsFinalizationYields).toBe(0);
    expect(factHeavyRun.classification.components[0]!.activeJoints).toHaveLength(130);
    expect(factHeavyRun.totalSteps).toBeLessThanOrEqual(MAX_CLASSIFICATION_STEPS);
    expect(largeRun.classification.components[0]!.occupiedCells).toHaveLength(257);
    expect(largeRun.classification.components[0]!.activeJoints).toHaveLength(130);
    expect(largeRun.totalSteps).toBeLessThanOrEqual(MAX_CLASSIFICATION_STEPS);
    expect(largeRun.labels).toContain("classification");
    expect(factHeavyFinalizationYields).toBeGreaterThan(noFactsFinalizationYields);
  });
});
