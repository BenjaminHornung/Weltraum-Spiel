import { ingestHvpStructuralCells } from "../../../src/hestia-prototype/terrain/structuralIngest";
import { deriveStructuralComponentClassification } from "../../../src/voxel/structural/connectivity";
import { isIssuedStructuralObject, reconstructStructuralObjectInternal, structuralAddressForBrickCell } from "../../../src/voxel/structural/model";
import * as classificationSteps from "../../../src/voxel/structural/classificationSteps";
import type { StructuralComponentClassification, StructuralConnectivityBudgets, StructuralObject } from "../../../src/voxel/structural/types";

export const p05ClassificationBudgets: StructuralConnectivityBudgets = {
  maxVisitedCells: 257, maxComponents: 1, maxIndexedFacts: 130
};

export const createP05JointFixture = (count: 0 | 65, cellCount: 1 | 257 = 1): StructuralObject => {
  const cells = Array.from({ length: cellCount }, (_, x) => ({ x, y: 0, z: 0, materialId: 1 }));
  const base = ingestHvpStructuralCells("p05-classification", cells,
    [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null }]);
  const cell = structuralAddressForBrickCell(base.bricks[0]!, base.bricks[0]!.cells[0]!.localIndex);
  const joints = [];
  for (let index = 0; index < count; index += 1) {
    joints.push({ jointId: `p05:joint:${String(index).padStart(3, "0")}`, jointClass: "p05-joint",
      endpointA: { cell, role: "A" }, endpointB: { cell, role: "B" } });
  }
  // Real issuer and all its validation; no fabricated WeakSet membership or copied WIP algorithm.
  return reconstructStructuralObjectInternal({ objectId: base.objectId, frame: base.frame, source: base.source,
    materials: base.materials, bricks: base.bricks, anchors: [], joints,
    objectRevision: base.objectRevision, editRevision: base.editRevision, commandEvidence: [] });
};

export const observeP05FactSteps = (source: StructuralObject, role: "baseline" | "candidate") => {
  if (!isIssuedStructuralObject(source)) {
    throw new Error("P05 fixture is not issued");
  }
  // b3 has no issued export. Never silently substitute the generic route in a candidate run.
  const run = role === "baseline" ? classificationSteps.structuralComponentClassificationSteps
    : Reflect.get(classificationSteps, "structuralIssuedComponentClassificationSteps") as
      ((source: StructuralObject, budgets: StructuralConnectivityBudgets) => Generator<string, StructuralComponentClassification, unknown>) | undefined;
  if (typeof run !== "function") {
    throw new Error("P05 candidate lacks the reviewed issued classification export; stop and rebind");
  }
  const before = JSON.stringify(source), steps = run(source, p05ClassificationBudgets), labels: string[] = [];
  try {
    for (let advance = 0; advance < 4096; advance += 1) {
      const step = steps.next();
      if (step.done) {
        return { labels, output: step.value, inputUnchanged: JSON.stringify(source) === before };
      }
      labels.push(step.value);
    }
    throw new Error("P05 fixture exceeded 4096 advances; no larger or timed run authorized");
  } finally { steps.return(undefined as never); }
};

export const observeP05ArrayReads = (source: StructuralObject, hook: "none" | "trace" | "wrapper-throw" | "species-throw") => {
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, "constructor");
  if (saved?.value !== Array || !saved.configurable) {
    throw new Error("P05 requires the ordinary restorable Array constructor descriptor");
  }
  const before = JSON.stringify(source), trace: string[] = [], sentinel = new Error(`p05 ${hook} sentinel`);
  let current = "", componentArray = false, output: StructuralComponentClassification | undefined, caught: unknown;
  const observedConstructor = {
    get [Symbol.species]() {
      trace.push(`species:${current}`);
      if (hook === "species-throw" && componentArray) {
        throw sentinel;
      }
      return Array;
    }
  };
  try {
    if (hook !== "none") {
      Object.defineProperty(Array.prototype, "constructor", { configurable: true, enumerable: saved.enumerable,
        get: function (this: unknown[]) {
          const first: unknown = Object.getOwnPropertyDescriptor(this, "0")?.value;
          const record = first !== null && typeof first === "object";
          const wrapper = record && Object.hasOwn(first, "component") && Object.hasOwn(first, "cellKeys");
          componentArray = record && Object.hasOwn(first, "componentId") && Object.hasOwn(first, "occupiedCells");
          const keys = record ? Object.keys(first).sort().join(",") : typeof first;
          current = `${this.length}:${Object.isFrozen(this)}:${keys}`;
          trace.push(`constructor:${current}`);
          if (hook === "wrapper-throw" && wrapper) {
            throw sentinel;
          }
          return observedConstructor;
        } });
    }
    // No await, assertions, logging or fixture creation while the global hook is installed.
    output = deriveStructuralComponentClassification(source, p05ClassificationBudgets);
  } catch (error) { caught = error; }
  finally { Object.defineProperty(Array.prototype, "constructor", saved); }
  const restored = Object.getOwnPropertyDescriptor(Array.prototype, "constructor")!;
  return { trace, output: output === undefined ? null : JSON.stringify(output),
    error: caught === undefined ? null : { name: caught instanceof Error ? caught.name : typeof caught,
      message: caught instanceof Error ? caught.message : String(caught), sameSentinel: caught === sentinel },
    inputUnchanged: JSON.stringify(source) === before,
    descriptorRestored: restored.value === saved.value && restored.get === saved.get && restored.set === saved.set
      && restored.writable === saved.writable && restored.configurable === saved.configurable && restored.enumerable === saved.enumerable };
};
