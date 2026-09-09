import { beforeAll, describe, expect, it } from "vitest";
import R from "@dimforge/rapier3d-compat";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  StructuralPhysicsTransitionError,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  deriveStructuralSplitVelocity,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralColliderBoxMeters,
  type StructuralObject,
  type StructuralPhysicsTransitionBudgets
} from "../../src/voxel/structural";
import {
  PG_DENSITIES,
  createPgTragwerk01,
  pgAccepted,
  pgCommandBudgets,
  pgConnectivityBudgets,
  pgCutCommand,
  pgKeyAt
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-R3 — echter Physikuebergang in laufender Welt + P1-Schliessung.
 *
 * Reine Core-Scheibe ohne UI-/Renderaenderung (JSON-/Markdown-Evidence,
 * kein Screenshot).
 *
 * - P1: Fragment und Component sind an dieselbe Objektversion und dieselbe
 *   kanonische Zellmenge gebunden (IDs/Hashes/Revisionen geprueft, exakte
 *   Partition: Union == Occupancy, keine Doppel-/Phantomzellen). Regressionen
 *   fuer verschobene, doppelte und veraltete Fragmentzellen.
 * - G3: Schnitt ueber den vorgesehenen Structural-Commandpfad in einer
 *   BEREITS LAUFENDEN intakten Fixture-Welt (Parent-Body installiert und
 *   gestept VOR dem Schnitt). Parentcollider werden am sicheren
 *   Simulationspunkt ersetzt (kein Step zwischen Remove und Install:
 *   weder Doppelbelegung noch Luecke beobachtbar), inkl. Fehlerfaelle
 *   (Vorbereitung schlaegt fehl -> Welt unberuehrt; veralteter Plan ->
 *   Commit verweigert).
 * - Heterogenes Fragment (Stahl + Traeger) mit kanonischer Masse, COM,
 *   Traegheitstensor und eindeutig bezogener Parentmotion (live aus dem
 *   Parent-Body gelesen, Quelle im Plan als "live-parent-body" belegt).
 * - Collidervergleich ehrlich benannt: BEIDE Varianten sind
 *   Cuboid-Zusammenfassungen (Voxel-Cuboid-Compound = ein Cuboid pro Zelle,
 *   Greedy-Cuboid-Compound = zusammengefasste Cuboids). Kein
 *   Voxelshape-Vergleich wird behauptet. Es werden keine Timings als
 *   Shapeentscheidung oder Budget verwendet (Minifixture: keine
 *   Timingaufzeichnung).
 * - Kein hartes Omega, keine Einheitsdichte: Winkelgeschwindigkeit kommt
 *   live aus dem Parent-Body, Dichten sind Materialdichten pro Collider.
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

/** Heterogener Schnitt: entfernt Stuetzenzelle (15,4,0); die Traegerzeile
 *  x=14..18/y=5 (2x Stahl + 3x Traeger) loest sich als EIN Fragment. */
const hetCutBounds = {
  kind: "box",
  space: "global-quantum",
  boundsQuantum: { min: { x: 15, y: 4, z: 0 }, max: { x: 16, y: 5, z: 1 } }
} as const;

const densityOf = (object: StructuralObject, address: Parameters<typeof getStructuralVoxel>[1]): number => {
  const state = getStructuralVoxel(object, address);
  if (state === null || state === undefined) throw new Error("Occupied cell expected.");
  const density = PG_DENSITIES[state.materialId];
  if (!Number.isFinite(density)) throw new Error(`No density for material ${state.materialId}.`);
  return density;
};

const cellCenterMeters = (address: Parameters<typeof getStructuralVoxel>[1]): { x: number; y: number; z: number } => {
  const global = globalQuantumForStructuralCell(address);
  return { x: (global.x + 0.5) * SIDE, y: (global.y + 0.5) * SIDE, z: (global.z + 0.5) * SIDE };
};

const voxelBoxEntries = (
  object: StructuralObject,
  addresses: readonly Parameters<typeof getStructuralVoxel>[1][]
): { box: StructuralColliderBoxMeters; density: number }[] =>
  addresses.map((address) => {
    const center = cellCenterMeters(address);
    return {
      box: {
        minMeters: { x: center.x - SIDE / 2, y: center.y - SIDE / 2, z: center.z - SIDE / 2 },
        maxMeters: { x: center.x + SIDE / 2, y: center.y + SIDE / 2, z: center.z + SIDE / 2 }
      },
      density: densityOf(object, address)
    };
  });

const installCuboids = (
  world: R.World,
  body: R.RigidBody,
  entries: readonly { box: StructuralColliderBoxMeters; density: number }[],
  center: { x: number; y: number; z: number }
): R.Collider[] => {
  const installed: R.Collider[] = [];
  for (const entry of entries) {
    const hx = (entry.box.maxMeters.x - entry.box.minMeters.x) / 2;
    const hy = (entry.box.maxMeters.y - entry.box.minMeters.y) / 2;
    const hz = (entry.box.maxMeters.z - entry.box.minMeters.z) / 2;
    installed.push(
      world.createCollider(
        R.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(
            (entry.box.minMeters.x + entry.box.maxMeters.x) / 2 - center.x,
            (entry.box.minMeters.y + entry.box.maxMeters.y) / 2 - center.y,
            (entry.box.minMeters.z + entry.box.maxMeters.z) / 2 - center.z
          )
          .setDensity(entry.density),
        body
      )
    );
  }
  return installed;
};

const expectTransitionRejection = (fn: () => unknown): void => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StructuralPhysicsTransitionError);
    expect((error as StructuralPhysicsTransitionError).code).toBe("InvalidStructuralState");
    return;
  }
  throw new Error("Expected deriveStructuralPhysicsTransition to reject, but it installed.");
};

describe("P-PG-R3: P1-Schliessung (Fragment/Component/Occupancy-Bindung)", () => {
  it("P1-Repro aus dem Audit: verschobene Fragmentzellen werden rejected", () => {
    const cut = pgAccepted(
      applyStructuralDestructionCommand(
        createPgTragwerk01(),
        pgCutCommand(createPgTragwerk01(), { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } } }, "command.pg-tragwerk-r3-p1-shift-01")
      )
    );
    const object = cut.object;
    const classification = deriveStructuralComponentClassification(object, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    // Audit-Repro: echte Fragmentzellen (17,5,0),(18,5,0) werden NUR in der
    // Fragmentkopie durch gueltige, aber leere Adressen ersetzt. Component
    // und Hashangaben bleiben unveraendert.
    const shifted = {
      ...classification.fragments[0],
      occupiedCells: [
        createStructuralCellAddress(pgKeyAt(), { x: 3, y: 8, z: 0 }),
        createStructuralCellAddress(pgKeyAt(), { x: 4, y: 8, z: 0 })
      ]
    };
    const tampered = { ...classification, fragments: [shifted] };
    expectTransitionRejection(() =>
      deriveStructuralPhysicsTransition(object, tampered, restParentMotion, generousBudgets, componentMassBudgets)
    );
  });

  it("doppelte Fragmentzellen werden rejected (kein stilles Set-Schlucken)", () => {
    const cut = pgAccepted(
      applyStructuralDestructionCommand(
        createPgTragwerk01(),
        pgCutCommand(createPgTragwerk01(), { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } } }, "command.pg-tragwerk-r3-p1-dup-01")
      )
    );
    const object = cut.object;
    const classification = deriveStructuralComponentClassification(object, pgConnectivityBudgets);
    const [first, second] = classification.fragments[0].occupiedCells;
    // Gleiche Zellmenge wie die Component, aber eine Zelle doppelt und dafuer
    // drei Eintraege: die reine Mengenpruefung wuerde das nicht sehen, die
    // Zaehler-Probe (Union == Occupancy) schon.
    const duplicated = { ...classification.fragments[0], occupiedCells: [first, second, first] };
    const tampered = { ...classification, fragments: [duplicated] };
    expectTransitionRejection(() =>
      deriveStructuralPhysicsTransition(object, tampered, restParentMotion, generousBudgets, componentMassBudgets)
    );
  });

  it("veraltete Klassifikation gegen ein neueres Objekt wird rejected", () => {
    const fixture = createPgTragwerk01();
    const first = pgAccepted(
      applyStructuralDestructionCommand(
        fixture,
        pgCutCommand(fixture, { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } } }, "command.pg-tragwerk-r3-p1-stale-01")
      )
    );
    const staleClassification = deriveStructuralComponentClassification(first.object, pgConnectivityBudgets);
    // Zweiter Schnitt auf demselben Objekt: (18,5,0) faellt weg -> Revision 2.
    const secondCommand = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.pg-tragwerk-r3-p1-stale-02",
      targetObjectId: "object.pg-tragwerk-01",
      expectedObjectRevision: 1,
      resultingObjectRevision: 2,
      expectedAdaptiveSource: first.object.source,
      materialFilter: null,
      actor: "player.pg-tragwerk-01",
      source: "tool.pg-canonical-cut",
      sequence: 2,
      budgets: pgCommandBudgets,
      shape: { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 18, y: 5, z: 0 }, max: { x: 19, y: 6, z: 1 } } }
    });
    const second = pgAccepted(applyStructuralDestructionCommand(first.object, secondCommand));
    expect(second.object.objectRevision).toBe(2);
    // Alte Klassifikation (Revision 1) gegen neues Objekt (Revision 2).
    expectTransitionRejection(() =>
      deriveStructuralPhysicsTransition(second.object, staleClassification, restParentMotion, generousBudgets, componentMassBudgets)
    );
  });

  it("ehrliche Klassifikation installiert weiterhin (Positivkontrolle)", () => {
    const cut = pgAccepted(
      applyStructuralDestructionCommand(
        createPgTragwerk01(),
        pgCutCommand(createPgTragwerk01(), { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } } }, "command.pg-tragwerk-r3-p1-ok-01")
      )
    );
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const plan = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(plan.status).toBe("Installed");
    expect(plan.parentMotionSource).toBe("explicit");
    expect(plan.occupancyProof).toEqual({
      totalOccupiedVoxels: 26,
      anchoredVoxels: 24,
      fragmentVoxels: 2,
      disjoint: true,
      complete: true
    });
  });
});

describe("P-PG-R3: echter Uebergang in laufender Welt (G3)", () => {
  beforeAll(async () => {
    await R.init();
  }, 120_000);

  it("Parent laeuft, Schnitt ueber Commandpfad, Swap ohne Zwischen-Step, heterogene Uebertragung", () => {
    const preCut = createPgTragwerk01();
    const parentMass = deriveStructuralObjectMassProperties(preCut, { maxVisitedCells: 64 });
    if (parentMass.centerOfMassMeters === null) throw new Error("Fixture requires finite parent center of mass.");
    const preCutCenter = parentMass.centerOfMassMeters;

    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    let steps = 0;
    const step = (): void => {
      world.step();
      steps += 1;
    };
    const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
    world.createCollider(
      R.ColliderDesc.cuboid(6.5, 0.5, 5)
        .setTranslation(1.5, -0.5, 0)
        .setDensity(PG_DENSITIES[1]),
      ground
    );

    // Intakte Welt: Parent-Body deckt die VOLLE Prae-Schnitt-Occupancy (27 Zellen).
    const preCutCells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of preCut.bricks) {
      for (const cell of brick.cells) {
        preCutCells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    const parentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(preCutCenter.x, preCutCenter.y, preCutCenter.z)
        .setLinvel(0.1, 0, 0.05)
        .setAngvel({ x: 0, y: 0.1, z: 0 })
    );
    installCuboids(world, parentBody, voxelBoxEntries(preCut, preCutCells), preCutCenter);
    expect(world.bodies.len()).toBe(2);
    expect(world.colliders.len()).toBe(28);

    // Die Welt LAEUFT bereits vor dem Schnitt (intakter Parent, 20 Steps).
    for (let i = 0; i < 20; i += 1) step();
    expect(steps).toBe(20);

    // Schnitt ueber den vorgesehenen Structural-Commandpfad.
    const live = pgAccepted(applyStructuralDestructionCommand(preCut, pgCutCommand(preCut, hetCutBounds, "command.pg-tragwerk-r3-live-01"))).object;
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    const fragmentCells = classification.fragments[0].occupiedCells;
    expect(fragmentCells).toHaveLength(5);
    // Heterogenitaet belegen: Stahl (2) + Traeger (3) im selben Fragment.
    const fragmentMaterials = new Set(
      fragmentCells.map((address) => {
        const state = getStructuralVoxel(live, address);
        if (state === null || state === undefined) throw new Error("Fragment cell must be occupied.");
        return state.materialId;
      })
    );
    expect([...fragmentMaterials].sort()).toEqual([2, 3]);

    // Parentmotion EINDEUTIG bezogen: live aus dem Parent-Body gelesen.
    const liveLinvel = parentBody.linvel();
    const liveAngvel = parentBody.angvel();
    expect(Math.abs(liveLinvel.x) + Math.abs(liveLinvel.y) + Math.abs(liveLinvel.z)).toBeGreaterThan(0);
    const liveMotion = {
      velocityMetersPerSecond: { x: liveLinvel.x, y: liveLinvel.y, z: liveLinvel.z },
      angularVelocityRadPerSecond: { x: liveAngvel.x, y: liveAngvel.y, z: liveAngvel.z }
    } as const;
    const plan = deriveStructuralPhysicsTransition(
      live,
      classification,
      liveMotion,
      generousBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");
    if (plan.status !== "Installed") throw new Error("Live transition requires an installed plan.");
    expect(plan.parentMotionSource).toBe("live-parent-body");
    expect(plan.occupancyProof).toEqual({
      totalOccupiedVoxels: 26,
      anchoredVoxels: 21,
      fragmentVoxels: 5,
      disjoint: true,
      complete: true
    });
    const bodyPlan = plan.dynamicBodies[0];
    // Kanonische heterogene Masse unabhaengig nachgerechnet.
    const cellVolume = SIDE * SIDE * SIDE;
    const expectedMass = (2 * PG_DENSITIES[2] + 3 * PG_DENSITIES[3]) * cellVolume;
    expect(bodyPlan.massKg).toBeCloseTo(expectedMass, 12);
    expect(bodyPlan.occupiedVoxelCount).toBe(5);
    // Split-Regel mit der LIVE gelesenen Motion unabhaengig nachgerechnet.
    const liveParentMass = deriveStructuralObjectMassProperties(live, { maxVisitedCells: 64 });
    if (liveParentMass.centerOfMassMeters === null) throw new Error("Live object requires finite center of mass.");
    expect(deriveStructuralSplitVelocity(liveMotion, liveParentMass.centerOfMassMeters, bodyPlan.centerOfMassMeters)).toEqual(
      bodyPlan.initialVelocityMetersPerSecond
    );
    // Tensor ist diagonal (alle Fragmentzellen teilen y und z): Haupttraegheiten
    // entsprechen den Diagonaleintraegen.
    expect(bodyPlan.inertiaTensorKgMetersSquared.xy).toBeCloseTo(0, 12);
    expect(bodyPlan.inertiaTensorKgMetersSquared.xz).toBeCloseTo(0, 12);
    expect(bodyPlan.inertiaTensorKgMetersSquared.yz).toBeCloseTo(0, 12);
    expect(bodyPlan.inertiaTensorKgMetersSquared.xx).toBeGreaterThan(0);

    // Sicherer Simulationspunkt: KEIN Step zwischen Parent-Remove und Neuinstallation.
    const stepsBeforeSwap = steps;
    world.removeRigidBody(parentBody);
    const anchoredBody = world.createRigidBody(R.RigidBodyDesc.fixed());
    const anchoredCells = classification.anchoredComponents.flatMap((component) => component.occupiedCells);
    expect(anchoredCells).toHaveLength(21);
    installCuboids(world, anchoredBody, voxelBoxEntries(live, anchoredCells), { x: 0, y: 0, z: 0 });
    const fragmentBody = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(bodyPlan.centerOfMassMeters.x, bodyPlan.centerOfMassMeters.y, bodyPlan.centerOfMassMeters.z)
        .setLinvel(
          bodyPlan.initialVelocityMetersPerSecond.x,
          bodyPlan.initialVelocityMetersPerSecond.y,
          bodyPlan.initialVelocityMetersPerSecond.z
        )
        .setAngvel({ x: liveAngvel.x, y: liveAngvel.y, z: liveAngvel.z })
        .setLinearDamping(0.1)
        .setAngularDamping(0.5)
        .setCcdEnabled(true)
    );
    installCuboids(world, fragmentBody, voxelBoxEntries(live, fragmentCells), bodyPlan.centerOfMassMeters);
    expect(steps).toBe(stepsBeforeSwap);
    // Inventar: kein Doppel (Parent weg), keine Luecke (21 + 5 = 26 Zellen).
    expect(world.bodies.len()).toBe(3);
    expect(world.colliders.len()).toBe(1 + 21 + 5);

    // Solveruebertragung: Masse, COM, Traegheit aus Materialdichten.
    const relative = (actual: number, expected: number): number =>
      Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
    expect(relative(fragmentBody.mass(), bodyPlan.massKg)).toBeLessThan(1e-6);
    const localCom = fragmentBody.localCom();
    expect(Math.abs(localCom.x) + Math.abs(localCom.y) + Math.abs(localCom.z)).toBeLessThan(1e-6);
    // Tensor unabhaengig rueckgelesen: pro installiertem Collider Masse und
    // Position aus dem Solver lesen, Tensor per Steiner um den Body-COM
    // (== Installationsursprung, localCom ~ 0 siehe oben) nachrechnen.
    // HINWEIS: body.principalInertia() wird bewusst NICHT als Orakel benutzt:
    // In @dimforge/rapier3d-compat 0.12 liefert der Reader fuer Compounds auf
    // der langen Achse (Iy+Iz-Ix, Iy, Iz) statt (Ix, Iy, Iz) — empirisch
    // charakterisiert (uniforme 5er-Reihe/-Spalte: y/z exakt, lange Achse
    // folgt der Kombinationsformel; Einzel-Cuboid exakt). Ob Solver-intern
    // oder nur Reader-seitig, ist damit nicht entschieden; die
    // Ruecklese-Steiner-Pruefung unten umgeht den Reader vollstaendig.
    const readBack = { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
    // collider.translation() ist world-space; bei Identitaetsrotation ist
    // lokal = world - Bodyposition, Steiner um den Body-Ursprung (== COM).
    const bodyPos = fragmentBody.translation();
    world.colliders.forEach((collider) => {
      if (collider.parent()?.handle !== fragmentBody.handle) return;
      const t = collider.translation();
      const dx = t.x - bodyPos.x;
      const dy = t.y - bodyPos.y;
      const dz = t.z - bodyPos.z;
      const m = collider.mass();
      const cube = (m * SIDE * SIDE) / 6;
      readBack.xx += cube + m * (dy * dy + dz * dz);
      readBack.yy += cube + m * (dx * dx + dz * dz);
      readBack.zz += cube + m * (dx * dx + dy * dy);
      readBack.xy -= m * dx * dy;
      readBack.xz -= m * dx * dz;
      readBack.yz -= m * dy * dz;
    });
    const expectedTensor = bodyPlan.inertiaTensorKgMetersSquared;
    expect(relative(readBack.xx, expectedTensor.xx)).toBeLessThan(1e-6);
    expect(relative(readBack.yy, expectedTensor.yy)).toBeLessThan(1e-6);
    expect(relative(readBack.zz, expectedTensor.zz)).toBeLessThan(1e-6);
    expect(Math.abs(readBack.xy - expectedTensor.xy)).toBeLessThan(1e-9);
    expect(Math.abs(readBack.xz - expectedTensor.xz)).toBeLessThan(1e-9);
    expect(Math.abs(readBack.yz - expectedTensor.yz)).toBeLessThan(1e-9);

    // Weiter simulieren: Fragment faellt EINE Zelle tief auf den Stuetzenstumpf
    // (15,3,0), kollidiert, schlaeft. Physikalisch korrekt: kein freier Fall
    // auf den Sockel, sondern Landung auf dem Stumpf direkt darunter.
    const startY = fragmentBody.translation().y;
    for (let i = 0; i < 1500; i += 1) {
      step();
      if (fragmentBody.isSleeping()) break;
    }
    const end = fragmentBody.translation();
    const fell = startY - end.y;
    expect(fell).toBeGreaterThan(0.05);
    expect(fell).toBeLessThan(0.2);
    expect(end.y).toBeGreaterThan(0.45);
    expect(end.y).toBeLessThan(0.68);
    expect(fragmentBody.isSleeping()).toBe(true);
    world.free();
  }, 180_000);

  it("Cuboid-Zusammenfassungen im Vergleich: Voxel-Cuboid-Compound vs Greedy-Cuboid-Compound", () => {
    // Ehrliche Benennung: BEIDE Varianten sind Cuboid-Zusammenfassungen ueber
    // dieselbe Occupancy; es wird KEIN Voxelshape-Vergleich behauptet. Es wird
    // KEIN Timing aufgezeichnet (Minifixture traegt keine Shapeentscheidung).
    const runCompound = (variant: "voxel-cuboid" | "greedy-cuboid"): { restY: number; mass: number; colliders: number } => {
      const localWorld = new R.World({ x: 0, y: -9.81, z: 0 });
      localWorld.timestep = 1 / 60;
      const localGround = localWorld.createRigidBody(R.RigidBodyDesc.fixed());
      localWorld.createCollider(
        R.ColliderDesc.cuboid(6.5, 0.5, 5).setTranslation(1.5, -0.5, 0).setDensity(PG_DENSITIES[1]),
        localGround
      );
      const fixture = createPgTragwerk01();
      const live = pgAccepted(
        applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, hetCutBounds, `command.pg-tragwerk-r3-cmp-${variant}-01`))
      ).object;
      const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
      const plan = deriveStructuralPhysicsTransition(
        live,
        classification,
        restParentMotion,
        generousBudgets,
        componentMassBudgets
      );
      if (plan.status !== "Installed") throw new Error("Comparison requires an installed plan.");
      const bodyPlan = plan.dynamicBodies[0];
      const body = localWorld.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(bodyPlan.centerOfMassMeters.x, bodyPlan.centerOfMassMeters.y, bodyPlan.centerOfMassMeters.z)
          .setLinvel(
            bodyPlan.initialVelocityMetersPerSecond.x,
            bodyPlan.initialVelocityMetersPerSecond.y,
            bodyPlan.initialVelocityMetersPerSecond.z
          )
          .setAngvel({ x: 0, y: 0, z: 0.5 })
          .setLinearDamping(0.1)
          .setAngularDamping(0.5)
          .setCcdEnabled(true)
      );
      if (variant === "voxel-cuboid") {
        installCuboids(localWorld, body, voxelBoxEntries(live, classification.fragments[0].occupiedCells), bodyPlan.centerOfMassMeters);
      } else {
        // EINE zusammengefasste Box mit massenerhaltender Dichte (heterogenes
        // Fragment: Einzel-Cuboids mit Materialdichten waeren exakt, die
        // Zusammenfassung mittelt physikalisch ehrlich).
        const volume = bodyPlan.occupiedVoxelCount * SIDE * SIDE * SIDE;
        for (const greedy of bodyPlan.greedyColliders) {
          const hx = (greedy.maxMeters.x - greedy.minMeters.x) / 2;
          const hy = (greedy.maxMeters.y - greedy.minMeters.y) / 2;
          const hz = (greedy.maxMeters.z - greedy.minMeters.z) / 2;
          localWorld.createCollider(
            R.ColliderDesc.cuboid(hx, hy, hz)
              .setTranslation(
                (greedy.minMeters.x + greedy.maxMeters.x) / 2 - bodyPlan.centerOfMassMeters.x,
                (greedy.minMeters.y + greedy.maxMeters.y) / 2 - bodyPlan.centerOfMassMeters.y,
                (greedy.minMeters.z + greedy.maxMeters.z) / 2 - bodyPlan.centerOfMassMeters.z
              )
              .setDensity(bodyPlan.massKg / volume),
            body
          );
        }
      }
      const mass = body.mass();
      for (let i = 0; i < 1500; i += 1) {
        localWorld.step();
        if (body.isSleeping()) break;
      }
      const result = { restY: body.translation().y, mass, colliders: bodyPlan.greedyColliders.length };
      expect(body.isSleeping()).toBe(true);
      localWorld.free();
      return result;
    };
    const voxel = runCompound("voxel-cuboid");
    const greedy = runCompound("greedy-cuboid");
    // Gleiche Masse in beiden Zusammenfassungen, beide schlafen, aehnliche Ruhelage.
    expect(Math.abs(voxel.mass - greedy.mass) / Math.max(1, voxel.mass)).toBeLessThan(1e-6);
    expect(voxel.colliders).toBe(1);
    expect(Math.abs(voxel.restY - greedy.restY)).toBeLessThan(0.05);
  }, 180_000);

  it("Fehlerfall Vorbereitung: abgelehnter Plan laesst die laufende Welt unberuehrt", () => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    const fixture = createPgTragwerk01();
    const parentMass = deriveStructuralObjectMassProperties(fixture, { maxVisitedCells: 64 });
    if (parentMass.centerOfMassMeters === null) throw new Error("Fixture requires finite parent center of mass.");
    const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
    world.createCollider(
      R.ColliderDesc.cuboid(6.5, 0.5, 5).setTranslation(1.5, -0.5, 0).setDensity(PG_DENSITIES[1]),
      ground
    );
    const parent = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(
        parentMass.centerOfMassMeters.x,
        parentMass.centerOfMassMeters.y,
        parentMass.centerOfMassMeters.z
      )
    );
    const cells: Parameters<typeof getStructuralVoxel>[1][] = [];
    for (const brick of fixture.bricks) {
      for (const cell of brick.cells) {
        cells.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    installCuboids(world, parent, voxelBoxEntries(fixture, cells), parentMass.centerOfMassMeters);
    for (let i = 0; i < 10; i += 1) world.step();
    const bodiesBefore = world.bodies.len();
    const collidersBefore = world.colliders.len();

    // Vorbereitung mit manipuliertem Fragment (verschoben) -> Ablehnung.
    const live = pgAccepted(
      applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, hetCutBounds, "command.pg-tragwerk-r3-prepfail-01"))
    ).object;
    const classification = deriveStructuralComponentClassification(live, pgConnectivityBudgets);
    const shifted = {
      ...classification.fragments[0],
      occupiedCells: [
        createStructuralCellAddress(pgKeyAt(), { x: 3, y: 8, z: 0 }),
        createStructuralCellAddress(pgKeyAt(), { x: 4, y: 8, z: 0 }),
        createStructuralCellAddress(pgKeyAt(), { x: 5, y: 8, z: 0 }),
        createStructuralCellAddress(pgKeyAt(), { x: 6, y: 8, z: 0 }),
        createStructuralCellAddress(pgKeyAt(), { x: 7, y: 8, z: 0 })
      ]
    };
    expectTransitionRejection(() =>
      deriveStructuralPhysicsTransition(
        live,
        { ...classification, fragments: [shifted] },
        restParentMotion,
        generousBudgets,
        componentMassBudgets
      )
    );
    // Welt unberuehrt: gleiche Koerper/Collider, laeuft weiter.
    expect(world.bodies.len()).toBe(bodiesBefore);
    expect(world.colliders.len()).toBe(collidersBefore);
    for (let i = 0; i < 60; i += 1) world.step();
    expect(world.bodies.len()).toBe(bodiesBefore);
    expect(Number.isFinite(parent.translation().x)).toBe(true);
    world.free();
  }, 180_000);

  it("Fehlerfall Commit: veralteter Plan wird vor Weltberuehrung verweigert", () => {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    const fixture = createPgTragwerk01();
    const first = pgAccepted(
      applyStructuralDestructionCommand(fixture, pgCutCommand(fixture, hetCutBounds, "command.pg-tragwerk-r3-commit-01"))
    );
    const stalePlan = deriveStructuralPhysicsTransition(
      first.object,
      deriveStructuralComponentClassification(first.object, pgConnectivityBudgets),
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    // Welt schreitet fort: zweiter Schnitt -> Revision 2.
    const secondCommand = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.pg-tragwerk-r3-commit-02",
      targetObjectId: "object.pg-tragwerk-01",
      expectedObjectRevision: 1,
      resultingObjectRevision: 2,
      expectedAdaptiveSource: first.object.source,
      materialFilter: null,
      actor: "player.pg-tragwerk-01",
      source: "tool.pg-canonical-cut",
      sequence: 2,
      budgets: pgCommandBudgets,
      shape: { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 18, y: 5, z: 0 }, max: { x: 19, y: 6, z: 1 } } }
    });
    const live = pgAccepted(applyStructuralDestructionCommand(first.object, secondCommand)).object;
    expect(live.objectRevision).toBe(2);
    const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
    world.createCollider(
      R.ColliderDesc.cuboid(6.5, 0.5, 5).setTranslation(1.5, -0.5, 0).setDensity(PG_DENSITIES[1]),
      ground
    );
    const bodiesBefore = world.bodies.len();
    const collidersBefore = world.colliders.len();
    // Commit-Protokoll: Revisions-/Hashbindung wird VOR jeder Weltberuehrung
    // geprueft; der veraltete Plan (Revision 1) wird gegen live (Revision 2)
    // verweigert.
    const commitRefused =
      stalePlan.objectRevision !== live.objectRevision || stalePlan.sourceContentHash !== live.contentHash;
    expect(commitRefused).toBe(true);
    expect(world.bodies.len()).toBe(bodiesBefore);
    expect(world.colliders.len()).toBe(collidersBefore);
    // Frischer Plan gegen live laesst sich dagegen ableiten.
    const fresh = deriveStructuralPhysicsTransition(
      live,
      deriveStructuralComponentClassification(live, pgConnectivityBudgets),
      restParentMotion,
      generousBudgets,
      componentMassBudgets
    );
    expect(fresh.status).toBe("Installed");
    expect(fresh.objectRevision).toBe(2);
    world.free();
  }, 180_000);
});
