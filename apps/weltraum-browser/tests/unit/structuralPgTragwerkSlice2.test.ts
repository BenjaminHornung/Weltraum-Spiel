import { beforeAll, describe, expect, it } from "vitest";
import R from "@dimforge/rapier3d-compat";
import {
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  deriveStructuralSplitVelocity,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  serializeStructuralCellAddress,
  type StructuralColliderBoxMeters,
  type StructuralPhysicsTransitionBudgets
} from "../../src/voxel/structural";
import {
  PG_DENSITIES,
  pgApplyCanonicalCut,
  pgConnectivityBudgets,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-SLICE2 — Proving-Ground-Scheibe 2, nur G3 (Physikuebergang).
 *
 * Reine Core-Scheibe ohne UI-/Renderaenderung (Evidence-Regel wie Slice 1:
 * JSON-/Markdown-Evidence, kein Screenshot).
 *
 * - Alter Terrain-/Rest-Collider plus neuer Fragment-Body werden am selben
 *   sicheren Step-Grenzpunkt atomar installiert: Belegungspartition
 *   disjunkt und vollstaendig (weder Doppelbelegung noch Loch).
 * - Split ohne Impuls: v_f = v + omega x (c_f - c).
 * - Fragment faellt/rotiert/kollidiert/schlaeft (Rapier-Gegenprobe mit
 *   beiden Collider-Varianten Greedy-Cuboid-Compound UND Voxelshape
 *   gegen dieselbe Occupancy; Entscheidung per Messung).
 * - Fragmentbudgets mit semantischem Fallback (Debris-Body, kein stilles
 *   Loeschen). Kein Body pro Voxel als Freifahrtschein: Budgets gelten.
 *
 * Solver-Provenienz: @dimforge/rapier3d-compat 0.12.0, transitiv ueber
 * @types/three installiert (lockfile-pin), ohne package.json/package-lock-
 * Aenderung importiert. Faellt der transitive Pin weg, bricht dieser Test
 * explizit beim Import (fail-closed), statt still ohne Solver zu laufen.
 */

const SIDE = 0.125;

const generousBudgets: StructuralPhysicsTransitionBudgets = {
  maxFragments: 4,
  maxCollidersPerFragment: 8,
  maxVoxelsPerFragment: 16
};

const componentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;

const restParentMotion = {
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
} as const;

const spinParentMotion = {
  velocityMetersPerSecond: { x: 1, y: 0.5, z: -0.25 },
  angularVelocityRadPerSecond: { x: 0, y: 1.5, z: 2 }
} as const;

describe("PG-TRAGWERK-01 proving-ground slice 2 (G3)", () => {
  it("G3: atomare Installation — Belegung disjunkt/vollstaendig, Split-Regel exakt, Masse geschlossen", () => {
    const cut = pgApplyCanonicalCut();
    const object = cut.object;
    const classification = deriveStructuralComponentClassification(object, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    expect(classification.detachedComponents[0].occupiedCells).toHaveLength(2);

    const plan = deriveStructuralPhysicsTransition(
      object,
      classification,
      spinParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    expect(plan.occupancyProof).toEqual({
      totalOccupiedVoxels: 26,
      anchoredVoxels: 24,
      fragmentVoxels: 2,
      disjoint: true,
      complete: true
    });
    // Jede belegte Zelle steckt in genau einem Body-Plan-Anteil:
    // 24 verankerte Zellen + 2 Fragmentzellen = alle 26 belegten Zellen.
    const anchoredKeys = classification.anchoredComponents
      .flatMap((c) => c.occupiedCells.map((a) => serializeStructuralCellAddress(a)))
      .sort();
    const fragmentKeys = plan.dynamicBodies
      .flatMap((b) => classification.fragments.find((f) => f.fragmentId === b.fragmentId)?.occupiedCells ?? [])
      .map((a) => serializeStructuralCellAddress(a))
      .sort();
    expect(anchoredKeys).toHaveLength(24);
    expect(fragmentKeys).toHaveLength(2);
    expect([...anchoredKeys, ...fragmentKeys].sort()).toEqual(pgOccupiedKeys(object));

    const body = plan.dynamicBodies[0];
    // Analytisch: 2 Beam-Zellen (2700 kg/m3, Kante 0.125 m).
    expect(body.occupiedVoxelCount).toBe(2);
    expect(body.massKg).toBeCloseTo(2 * PG_DENSITIES[3] * SIDE * SIDE * SIDE, 12);
    // Zellen global (17,5,0),(18,5,0) -> COM exakt in der Mitte (18.0 * SIDE).
    expect(body.centerOfMassMeters.x).toBeCloseTo(18 * SIDE, 12);
    expect(body.centerOfMassMeters.y).toBeCloseTo(5.5 * SIDE, 12);
    expect(body.centerOfMassMeters.z).toBeCloseTo(0.5 * SIDE, 12);
    // Split-Regel unabhaengig nachgerechnet: v + omega x (c_f - c).
    const parentMass = deriveStructuralObjectMassProperties(object, { maxVisitedCells: 64 });
    const parent = parentMass.centerOfMassMeters;
    if (parent === null) throw new Error("Fixture requires finite parent center of mass.");
    const omega = spinParentMotion.angularVelocityRadPerSecond;
    const velocity = spinParentMotion.velocityMetersPerSecond;
    const rx = body.centerOfMassMeters.x - parent.x;
    const ry = body.centerOfMassMeters.y - parent.y;
    const rz = body.centerOfMassMeters.z - parent.z;
    expect(body.initialVelocityMetersPerSecond.x).toBeCloseTo(velocity.x + (omega.y * rz - omega.z * ry), 12);
    expect(body.initialVelocityMetersPerSecond.y).toBeCloseTo(velocity.y + (omega.z * rx - omega.x * rz), 12);
    expect(body.initialVelocityMetersPerSecond.z).toBeCloseTo(velocity.z + (omega.x * ry - omega.y * rx), 12);
    // Greedy fasst die 2 Nachbarzellen in genau 1 Cuboid (statt 2 Voxelshapes).
    expect(body.voxelColliders).toHaveLength(2);
    expect(body.greedyColliders).toHaveLength(1);
    expect(body.greedyColliders[0].minMeters).toEqual({ x: 17 * SIDE, y: 5 * SIDE, z: 0 });
    expect(body.greedyColliders[0].maxMeters).toEqual({ x: 19 * SIDE, y: 6 * SIDE, z: SIDE });
    // Direktaufruf der Regel stimmt mit dem Plan ueberein.
    expect(deriveStructuralSplitVelocity(spinParentMotion, parent, body.centerOfMassMeters)).toEqual(
      body.initialVelocityMetersPerSecond
    );
  });

  it("G3: Budget-Fallback ist semantisch und verliert kein Fragment", () => {
    const cut = pgApplyCanonicalCut();
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      restParentMotion,
      { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 1 },
      componentMassBudgets
    );
    expect(plan.status).toBe("Fallback");
    if (plan.status !== "Fallback") throw new Error("Expected explicit fallback plan.");
    expect(plan.fallbackKind).toBe("merge-excess-fragments-into-single-debris-body");
    expect(plan.dynamicBodies).toHaveLength(0);
    expect(plan.mergedDebrisFragmentIds).toHaveLength(1);
    // Kein stilles Loeschen: dynamisch + Debris decken alle Fragmente ab.
    expect([...plan.dynamicFragmentIds, ...plan.mergedDebrisFragmentIds].sort()).toEqual(
      classification.fragments.map((f) => f.fragmentId).sort()
    );
    expect(plan.debris.occupiedVoxelCount).toBe(2);
    expect(plan.debris.massKg).toBeCloseTo(2 * PG_DENSITIES[3] * SIDE * SIDE * SIDE, 12);
    expect(plan.debris.exceedsColliderBudget).toBe(false);
    expect(plan.occupancyProof.complete).toBe(true);
  });

  describe("G3: Rapier-Gegenprobe (Greedy-Cuboid-Compound vs Voxelshape)", () => {
    beforeAll(async () => {
      await R.init();
    }, 120_000);

    const runVariant = (
      variant: "greedy" | "voxel",
      staticBoxes: readonly { box: StructuralColliderBoxMeters; density: number }[],
      bodyColliders: readonly { box: StructuralColliderBoxMeters; density: number }[],
      center: { x: number; y: number; z: number },
      linvel: { x: number; y: number; z: number },
      expectedMass: number
    ) => {
      const installStart = performance.now();
      const world = new R.World({ x: 0, y: -9.81, z: 0 });
      world.timestep = 1 / 60;
      const staticBody = world.createRigidBody(R.RigidBodyDesc.fixed());
      for (const entry of staticBoxes) {
        const hx = (entry.box.maxMeters.x - entry.box.minMeters.x) / 2;
        const hy = (entry.box.maxMeters.y - entry.box.minMeters.y) / 2;
        const hz = (entry.box.maxMeters.z - entry.box.minMeters.z) / 2;
        world.createCollider(
          R.ColliderDesc.cuboid(hx, hy, hz)
            .setTranslation(
              (entry.box.minMeters.x + entry.box.maxMeters.x) / 2,
              (entry.box.minMeters.y + entry.box.maxMeters.y) / 2,
              (entry.box.minMeters.z + entry.box.maxMeters.z) / 2
            )
            .setDensity(entry.density),
          staticBody
        );
      }
      // Atomare Installation am Step-Grenzpunkt: komplette Welt steht VOR dem
      // ersten Step (alter Collider + neuer Body, keine Zwischenschritte).
      const bodyDesc = R.RigidBodyDesc.dynamic()
        .setTranslation(center.x, center.y, center.z)
        .setLinvel(linvel.x, linvel.y, linvel.z)
        .setAngvel({ x: 0, y: 0, z: 2 })
        .setLinearDamping(0.1)
        .setAngularDamping(0.5)
        .setCcdEnabled(true);
      const body = world.createRigidBody(bodyDesc);
      for (const entry of bodyColliders) {
        const hx = (entry.box.maxMeters.x - entry.box.minMeters.x) / 2;
        const hy = (entry.box.maxMeters.y - entry.box.minMeters.y) / 2;
        const hz = (entry.box.maxMeters.z - entry.box.minMeters.z) / 2;
        world.createCollider(
          R.ColliderDesc.cuboid(hx, hy, hz)
            .setTranslation(
              (entry.box.minMeters.x + entry.box.maxMeters.x) / 2 - center.x,
              (entry.box.minMeters.y + entry.box.maxMeters.y) / 2 - center.y,
              (entry.box.minMeters.z + entry.box.maxMeters.z) / 2 - center.z
            )
            .setDensity(entry.density),
          body
        );
      }
      const installMs = performance.now() - installStart;
      // Masse/COM/Traegheit haengen am Body (Dichte x Volumen), nicht an der
      // Collider-Variante: identische Masse in beiden Welten gefordert.
      expect(Math.abs(body.mass() - expectedMass)).toBeLessThan(1e-9);

      const startY = body.translation().y;
      const stepStart = performance.now();
      const maxSteps = 1500;
      let steps = 0;
      for (let i = 0; i < maxSteps; i += 1) {
        world.step();
        steps += 1;
        if (body.isSleeping()) break;
      }
      const stepMs = performance.now() - stepStart;
      const end = body.translation();
      const rot = body.rotation();
      const norm = Math.sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z + rot.w * rot.w);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(rot.w / norm)));
      const measurement = {
        variant,
        rapierVersion: R.version(),
        colliderCount: bodyColliders.length,
        staticColliderCount: staticBoxes.length,
        ccdEnabled: true,
        installMs: Math.round(installMs * 100) / 100,
        stepMs: Math.round(stepMs * 100) / 100,
        steps,
        fellMeters: Math.round((startY - end.y) * 10_000) / 10_000,
        rotatedRad: Math.round(angle * 10_000) / 10_000,
        restY: Math.round(end.y * 10_000) / 10_000,
        slept: body.isSleeping()
      };
      // eslint-disable-next-line no-console
      console.log(`PG-SLICE2-MEASUREMENT ${JSON.stringify(measurement)}`);
      expect(measurement.fellMeters).toBeGreaterThan(0.2);
      expect(measurement.rotatedRad).toBeGreaterThan(0.15);
      // Kontakt: Fragment ruht auf Sockel (Oberkante 0.125) bzw. Grund (0.0),
      // COM-Hoehe eines 2-Zellen-Fragments daher deutlich unter 0.4.
      expect(measurement.restY).toBeLessThan(0.4);
      expect(measurement.restY).toBeGreaterThan(-0.01);
      expect(measurement.slept).toBe(true);
      world.free();
      return measurement;
    };

    it("faellt/rotiert/kollidiert/schlaeft in beiden Varianten mit gleicher Masse", () => {
      const cut = pgApplyCanonicalCut();
      const object = cut.object;
      const classification = deriveStructuralComponentClassification(object, pgConnectivityBudgets);
      const plan = deriveStructuralPhysicsTransition(
        object,
        classification,
        restParentMotion,
        generousBudgets,
        componentMassBudgets
      );
      if (plan.status !== "Installed") throw new Error("Gegenprobe braucht einen installierten Plan.");
      const bodyPlan = plan.dynamicBodies[0];

      const staticBoxes: { box: StructuralColliderBoxMeters; density: number }[] = [];
      for (const component of classification.anchoredComponents) {
        for (const address of component.occupiedCells) {
          const global = globalQuantumForStructuralCell(address);
          const state = getStructuralVoxel(object, address);
          if (state === null || state === undefined) throw new Error("Anchored cell must be occupied.");
          staticBoxes.push({
            box: {
              minMeters: { x: global.x * SIDE, y: global.y * SIDE, z: global.z * SIDE },
              maxMeters: { x: (global.x + 1) * SIDE, y: (global.y + 1) * SIDE, z: (global.z + 1) * SIDE }
            },
            density: PG_DENSITIES[state.materialId]
          });
        }
      }
      // Grundplatte y=0 (statisch): Sockel steht darauf, Fragmentzelle x=18 faellt darueber hinaus.
      staticBoxes.push({
        box: { minMeters: { x: -5, y: -1, z: -5 }, maxMeters: { x: 8, y: 0, z: 5 } },
        density: PG_DENSITIES[1]
      });

      const toEntries = (boxes: readonly StructuralColliderBoxMeters[]) =>
        boxes.map((box) => ({ box, density: PG_DENSITIES[3] }));
      const greedy = runVariant(
        "greedy",
        staticBoxes,
        toEntries(bodyPlan.greedyColliders),
        bodyPlan.centerOfMassMeters,
        bodyPlan.initialVelocityMetersPerSecond,
        bodyPlan.massKg
      );
      const voxel = runVariant(
        "voxel",
        staticBoxes,
        toEntries(bodyPlan.voxelColliders),
        bodyPlan.centerOfMassMeters,
        bodyPlan.initialVelocityMetersPerSecond,
        bodyPlan.massKg
      );
      // Gegenprobe: gleiche Occupancy, gleiche Masse, beide schlafen;
      // Greedy braucht strikt weniger Collider (1 statt 2).
      expect(greedy.colliderCount).toBe(1);
      expect(voxel.colliderCount).toBe(2);
      expect(Math.abs(greedy.restY - voxel.restY)).toBeLessThan(0.05);
    }, 180_000);
  });
});
