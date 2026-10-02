import { beforeAll, expect, it } from "vitest";
import { ingestHvpStructuralCells, type HvpStructuralCell } from "../../src/hestia-prototype/terrain/structuralIngest";
import { captureHvpBodyHit, prepareHvpBodyCutOwnedHashSteps, prepareHvpBodyCutSteps } from "../../src/hestia-prototype/physics/bodyCut";
import { prepareHvpLocalBodyCutOwnedHashSteps, prepareHvpLocalBodyCutSteps } from "../../src/hestia-prototype/physics/bodyCutPlan";
import { installHvpRigidBody, prepareHvpRigidBody } from "../../src/hestia-prototype/physics/rigidBody";
import { assertHvpRigidRecipe } from "../../src/hestia-prototype/physics/rigidRecipe";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";

const materials = [
  { materialId: 1, densityKgPerCubicMeter: 2400, structuralClass: "limestone", destructible: true, tags: null },
  { materialId: 3, densityKgPerCubicMeter: 1500, structuralClass: "soil", destructible: true, tags: null }
];
const mixedCells: HvpStructuralCell[] = [-2, -1, 0, 1].map((x) => ({ x, y: -1, z: -1, materialId: x % 2 === 0 ? 1 : 3 }));

beforeAll(initializeHvpRapier);

const drain = <T>(steps: Generator<string, T, unknown>) => {
  const labels: string[] = [];
  for (;;) {
    const step = steps.next();
    if (step.done) {
      return { result: step.value, labels };
    }
    labels.push(step.value);
  }
};

const fixture = (ownerId: string, cells: readonly HvpStructuralCell[]) => {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const source = ingestHvpStructuralCells(ownerId, cells, materials);
  const recipe = prepareHvpRigidBody(source);
  const body = installHvpRigidBody(world, recipe);
  const target = { ownerId, body, recipe };
  const targets = new Map<string, typeof target>([[ownerId, target]]);
  const hit = captureHvpBodyHit(world, targets, { x: cells.length === 1 ? 0.0625 : -0.0625, y: cells.length === 1 ? 0.0625 : -0.0625, z: -1 },
    { x: 0, y: 0, z: 1 }, 0);
  if (hit === null) {
    world.free();
    throw new Error("Expected a native parent hit");
  }
  return { world, source, recipe, target, hit };
};

it.each(["Box", "Sphere"] as const)("reuses the issued parent mass through the hit-owned %s route", (brush) => {
  const f = fixture(`parent-mass-${brush}`, mixedCells);
  try {
    const center = f.recipe.mass.centerOfMassMeters;
    expect(center).not.toBeNull();
    if (center === null) {
      throw new Error("Fixture requires a finite parent center");
    }
    expect(center.x).toBeLessThan(0);
    expect(center.x / 0.125).not.toBe(Math.round(center.x / 0.125));

    const generic = drain(prepareHvpBodyCutSteps(f.hit, f.target, `cut-${brush}`, 1, brush));
    const owned = drain(prepareHvpBodyCutOwnedHashSteps(f.hit, f.target, `cut-${brush}`, 1, brush));
    expect(owned.result).toEqual(generic.result);
    expect(owned.labels).toContain("parentMass");
    expect(generic.result.local.plan.preCutCenter).not.toBe(center);
    expect(owned.result.local.plan.preCutCenter).toBe(center);
    expect(owned.result.local.removedMass).toEqual(generic.result.local.removedMass);
    expect(owned.result.local.removedMass.contentHash).toBe(generic.result.local.removedMass.contentHash);
    expect(owned.result.local.plan.removedMassKg).toBe(generic.result.local.plan.removedMassKg);
    expect(owned.result.local.plan.parts.map((part) => ({
      ownerId: part.ownerId,
      componentId: part.componentId,
      sourceHash: part.recipe.source.contentHash,
      mass: part.recipe.mass,
      colliders: part.recipe.colliders
    }))).toEqual(generic.result.local.plan.parts.map((part) => ({
      ownerId: part.ownerId,
      componentId: part.componentId,
      sourceHash: part.recipe.source.contentHash,
      mass: part.recipe.mass,
      colliders: part.recipe.colliders
    })));

    const directOwned = drain(prepareHvpLocalBodyCutOwnedHashSteps(f.source, [-1, -1, -1], `direct-${brush}`, 1, brush));
    const publicGeneric = drain(prepareHvpLocalBodyCutSteps(f.source, [-1, -1, -1], `direct-${brush}`, 1, brush));
    expect(directOwned.result).toEqual(publicGeneric.result);
    expect(directOwned.result.plan.preCutCenter).not.toBe(center);
    expect(publicGeneric.result.plan.preCutCenter).not.toBe(center);
  } finally {
    f.world.free();
  }
}, 120_000);

it("keeps complete removal empty and reuses the parent mass receipt", () => {
  const f = fixture("parent-mass-empty", [{ x: 0, y: 0, z: 0, materialId: 1 }]);
  try {
    const generic = drain(prepareHvpBodyCutSteps(f.hit, f.target, "empty-sphere", 1, "Sphere"));
    const owned = drain(prepareHvpBodyCutOwnedHashSteps(f.hit, f.target, "empty-sphere", 1, "Sphere"));
    expect(owned.result).toEqual(generic.result);
    expect(owned.result.local.plan.parts).toEqual([]);
    expect(owned.result.local.plan.removedCells).toBe(1);
    expect(owned.result.local.plan.removedMassKg).toBe(f.recipe.mass.totalMassKg);
    expect(owned.result.local.removedMass.totalMassKg).toBe(f.recipe.mass.totalMassKg);
    expect(owned.result.local.plan.preCutCenter).toBe(f.recipe.mass.centerOfMassMeters);
  } finally {
    f.world.free();
  }
}, 120_000);

it("rejects cloned recipes, foreign recipes and recipes for unissued source clones", () => {
  const f = fixture("parent-mass-invalid", mixedCells);
  try {
    const cloneRecipe = Object.freeze({ ...f.recipe });
    expect(() => drain(prepareHvpLocalBodyCutOwnedHashSteps(f.source, [-1, -1, -1], "clone-recipe", 1, "Box", undefined, cloneRecipe)))
      .toThrow(/Unvalidated HVP rigid recipe/);

    const otherSource = ingestHvpStructuralCells("parent-mass-foreign", mixedCells, materials);
    const foreignRecipe = prepareHvpRigidBody(otherSource);
    assertHvpRigidRecipe(foreignRecipe);
    expect(() => drain(prepareHvpLocalBodyCutOwnedHashSteps(f.source, [-1, -1, -1], "foreign-recipe", 1, "Box", undefined, foreignRecipe)))
      .toThrow(/Parent rigid recipe must be issued for this source/);

    const sourceClone = Object.freeze({ ...f.source });
    const cloneSourceRecipe = prepareHvpRigidBody(sourceClone);
    assertHvpRigidRecipe(cloneSourceRecipe);
    expect(() => drain(prepareHvpLocalBodyCutOwnedHashSteps(sourceClone, [-1, -1, -1], "unissued-source", 1, "Box", undefined, cloneSourceRecipe)))
      .toThrow(/Parent rigid recipe must be issued for this source/);
  } finally {
    f.world.free();
  }
}, 120_000);
