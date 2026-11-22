import { expect, it } from "vitest";
import { fnv1aHash } from "../../src/core/hash";
import { HVP_COAST_MATERIAL_REGISTRY, materializeHvpCoastSource, prepareHvpCoastSource } from "../../src/hvp/hvpCoastSource";
import { createTerrainComponentIndex } from "../../src/voxel/structural/componentIndex";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { analyzeHvpTerrainSupport } from "../../src/hestia-prototype/terrain/supportPlan";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { hvpRigidColliderBoxes, prepareHvpRigidBody } from "../../src/hestia-prototype/physics/rigidRecipe";

it("passes the indexed rock arm through the existing exact rigid-body preparation", () => {
  const source = prepareHvpCoastSource(materializeHvpCoastSource());
  const root = createHvpTerrainRoot(source, "indexed-recipe", 1);
  const before = root.read();
  const cut = root.prepare({
    sessionId: before.sessionId, epoch: before.epoch, revision: before.revision, sourceDigest: before.sourceDigest,
    commandId: "compare", toolPolicy: "hvp-plasma-v1", shape: {kind:"Box", min:[176,78,76], max:[180,82,80]},
  });
  const oracle = analyzeHvpTerrainSupport(cut);
  const indexed = createTerrainComponentIndex(before).prepare(cut);
  expect(oracle.status).toBe("Ready");
  expect(indexed.status).toBe("Ready");
  expect(indexed.fragments).toHaveLength(1);
  const cells = indexed.fragments[0]!;
  const expected = oracle.fragments[0]!;
  const digest = fnv1aHash(JSON.stringify(cells));
  expect(digest).toBe(expected.digest);
  const materials = HVP_COAST_MATERIAL_REGISTRY.map(m => ({
    materialId:m.slot, densityKgPerCubicMeter:m.densityKgPerM3, structuralClass:m.role, destructible:true, tags:null,
  }));
  const started = performance.now();
  const object = ingestHvpStructuralCells(expected.id, cells, materials);
  const ingested = performance.now();
  const recipe = prepareHvpRigidBody(object);
  const finished = performance.now();
  expect(recipe.mass.totalMassKg).toBe(expected.massKg);
  expect(hvpRigidColliderBoxes(recipe)).toEqual(expected.colliderBoxes);
  // Independent point coordinates and uniform-cube self-inertia, including mixed densities.
  const h = before.cellMeters;
  const weighted = cells.map(c => ({
    x:(c.x + .5)*h, y:(c.y + .5)*h, z:(c.z + .5)*h,
    m:materials.find(material => material.materialId === c.materialId)!.densityKgPerCubicMeter*h**3,
  }));
  const mass = weighted.reduce((sum,c) => sum+c.m, 0);
  const centroid = (axis:"x"|"y"|"z") => weighted.reduce((sum,c) => sum+c[axis]*c.m,0)/mass;
  const cx = centroid("x"), cy = centroid("y"), cz = centroid("z");
  const center = recipe.mass.centerOfMassMeters;
  if (!center) throw new Error("The detached rock arm must have a center of mass");
  expect(center.x).toBeCloseTo(cx, 9);
  expect(center.y).toBeCloseTo(cy, 9);
  expect(center.z).toBeCloseTo(cz, 9);
  const tensor = {xx:0, yy:0, zz:0, xy:0, xz:0, yz:0};
  for (const c of weighted) {
    const x=c.x-cx, y=c.y-cy, z=c.z-cz;
    tensor.xx += c.m*(h*h/6 + y*y + z*z);
    tensor.yy += c.m*(h*h/6 + x*x + z*z);
    tensor.zz += c.m*(h*h/6 + x*x + y*y);
    tensor.xy -= c.m*x*y;
    tensor.xz -= c.m*x*z;
    tensor.yz -= c.m*y*z;
  }
  for (const k of Object.keys(tensor) as (keyof typeof tensor)[]) {
    expect(recipe.mass.inertiaTensorKgMetersSquared[k]).toBeCloseTo(tensor[k], 8);
  }
  console.info("indexed fragment admission", JSON.stringify({cells:cells.length, digest, massKg:mass,
    colliders:recipe.colliders.length, ingestMs:ingested-started, recipeMs:finished-ingested}));
}, 60000);
