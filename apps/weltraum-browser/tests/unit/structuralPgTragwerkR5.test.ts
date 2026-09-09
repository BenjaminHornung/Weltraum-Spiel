import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalAdaptiveJson } from "../../src/voxel/adaptive";
import {
  StableWorkerJobQueue,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  jobDeadline,
  planningEpoch,
  contentRevision,
  algorithmVersion,
  byteCount,
  type JobPriority,
  type WorkerJobRequest
} from "../../src/workers";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  extractStructuralMeshData,
  validateStructuralDestructionCommand,
  type StructuralMeshProduct,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  describeR5Scene,
  missingNeighborBrickOrigins,
  prepareR5Bounded,
  selectR5LodColliders,
  withFullKnownCoverage
} from "../../src/voxel/structural/provingGroundR5";
import {
  createPgTragwerk01,
  pgCommandBudgets,
  pgConnectivityBudgets,
  pgCutBounds,
  pgCutCommand,
  pgAccepted,
  pgOccupiedKeys
} from "./pgTragwerkFixture";

/**
 * Paket P-PG-R5 — sichtbarer Zielnachweis und begrenzte Last (Schlusspaket).
 *
 * Reine Core-Scheibe ohne UI-/Render-/Engine-Aenderung: Bestands-Mesher-,
 * Connectivity-, Massen- und Physiktransition-Pfade plus ein additiver R5-Pfad
 * (Coverage/LOD/begrenzte Vorbereitung/Szene). Kein neuer Renderer/Shader,
 * keine Szene im Produkt, kein AO-Pfad im Core (harte Quads, keine
 * Normalen-Mittelung). Vorher-/Nachher-Meshes werden als Dateien abgelegt.
 */

const generousMeshBudgets = {
  maxVisitedCells: 64,
  maxQuads: 1024,
  maxVertices: 4096,
  maxIndices: 6144
} as const;

const generousTransitionBudgets = {
  maxFragments: 8,
  maxCollidersPerFragment: 16,
  maxVoxelsPerFragment: 16
} as const;

const componentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;

const spinParentMotion = {
  velocityMetersPerSecond: { x: 1, y: 0.5, z: -0.25 },
  angularVelocityRadPerSecond: { x: 0, y: 1.5, z: 2 }
} as const;

const r5PrepareBudgets = {
  maxOccupiedCells: 64,
  maxBricks: 16,
  maxTotalWork: 512
} as const;

const producedMesh = (object: StructuralObject): StructuralMeshProduct => {
  const result = extractStructuralMeshData(object, generousMeshBudgets);
  if (result.status !== "Produced") {
    throw new Error(`Expected mesh, received ${result.status} ${(result as { code?: string }).code ?? ""}.`);
  }
  return result.product;
};

const evidenceDir = (): string => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const dir = fileURLToPath(new URL("../../evidence/", import.meta.url));
  void here;
  mkdirSync(dir, { recursive: true });
  return dir;
};

const writeEvidenceMesh = (name: string, product: StructuralMeshProduct): string => {
  const dir = evidenceDir();
  const path = `${dir}${name}`;
  mkdirSync(dirname(path), { recursive: true });
  const serialized = `${canonicalAdaptiveJson(product)}\n`;
  // Vergleich-vor-Schreiben: Eine geaenderte Implementation darf abgelegte
  // Evidence nicht still regenerieren — Abweichung schlaegt hier fehl.
  if (existsSync(path)) {
    expect(readFileSync(path, "utf8")).toBe(serialized);
    return path;
  }
  writeFileSync(path, serialized, "utf8");
  return path;
};

const queueRequest = (
  id: string,
  priority: JobPriority,
  deadline = 10
): WorkerJobRequest<{ readonly value: number }> => ({
  jobId: workerJobId(id),
  jobKind: workerJobKind("TransformBuffer"),
  targetKey: workerTargetKey("object.pg-tragwerk-01"),
  planningEpoch: planningEpoch(1),
  workerEpoch: workerEpoch(0),
  inputRevision: contentRevision(1),
  algorithmVersion: algorithmVersion(1),
  priority,
  deadline: jobDeadline(deadline),
  estimatedInputBytes: byteCount(1),
  estimatedOutputBytes: byteCount(1),
  payload: { value: 1 }
});

const axisNormals = new Set(["-1,0,0", "1,0,0", "0,-1,0", "0,1,0", "0,0,-1", "0,0,1"]);

describe("PG-TRAGWERK-01 proving-ground R5 (Zielnachweis + begrenzte Last)", () => {
  it("R5a: vollstaendige bekannte Coverage erzeugt Mesh; kein erfundener Face-Schein", () => {
    const base = createPgTragwerk01();
    expect(pgOccupiedKeys(base)).toHaveLength(27);
    // Ohne Coverage verweigert der Mesher explizit (K12-Bestand, keine Halluzination).
    const exposed = extractStructuralMeshData(base, generousMeshBudgets);
    expect(exposed.status).toBe("Rejected");

    const missing = missingNeighborBrickOrigins(base);
    expect(missing.length).toBe(5);
    // Bekannte Aussenluft: leere Bricks, keine erfundene Materie.
    const covered = withFullKnownCoverage(base);
    expect(base.bricks).toHaveLength(2);
    expect(covered.bricks.length).toBe(7);
    expect(pgOccupiedKeys(covered)).toEqual(pgOccupiedKeys(base));
    expect(missingNeighborBrickOrigins(covered)).toHaveLength(0);

    const beforeMesh = producedMesh(covered);
    // Kanonischer Schnitt auf der Coverage-Variante (gleiche Geometrie wie Slice 1).
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-01"))
    );
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);
    const afterMesh = producedMesh(cut.object);

    // Geometrie/Material/Licht-Komposition pruefbar: Achsen-Normalen, gueltige
    // Indices, Material-Ranges decken alle Indices, Bounds endlich, bekannte
    // Materialien 1/2/3, keine Normalen-Mittelung (harte Quads).
    for (const mesh of [beforeMesh, afterMesh]) {
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.normals.length).toBe(mesh.positions.length);
      expect(mesh.indices.length % 6).toBe(0);
      expect(mesh.positions.length / 3 / 4).toBe(mesh.indices.length / 6);
      for (let i = 0; i < mesh.normals.length; i += 3) {
        const key = `${mesh.normals[i]},${mesh.normals[i + 1]},${mesh.normals[i + 2]}`;
        expect(axisNormals.has(key)).toBe(true);
      }
      for (const index of mesh.indices) {
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(mesh.positions.length / 3);
      }
      const ranged = mesh.materialRanges.reduce((sum, range) => sum + range.indexCount, 0);
      expect(ranged).toBe(mesh.indices.length);
      for (const range of mesh.materialRanges) {
        expect([1, 2, 3]).toContain(range.materialId);
      }
      expect(mesh.boundsMeters).not.toBeNull();
      expect(mesh.algorithmVersion).toBe("structural-microvoxel-greedy-mesh-v1");
    }
    // Vorher/Nachher ist echt verschieden (Schnitt entfernt eine Zelle), aber
    // gleiche Quellefamilie (gleicher Frame, gleiche Materialien).
    expect(afterMesh.contentHash).not.toBe(beforeMesh.contentHash);
    expect(afterMesh.sourceContentHash).not.toBe(beforeMesh.sourceContentHash);
    expect(beforeMesh.indices.length / 6).toBe(21);
    expect(afterMesh.indices.length / 6).toBe(23);
    expect(afterMesh.boundsMeters).toEqual(beforeMesh.boundsMeters);
    expect(afterMesh.boundsMeters).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 2.375, y: 0.75, z: 0.125 }
    });
    // Coverage nach einem akzeptierten Edit auf unbedecktem Objekt bricht die
    // Evidence-Kette und schlaegt fail-closed fehl (kein stilles Ummodeln).
    // (Auf der Coverage-Variante ist nach dem Schnitt weiterhin alles bedeckt.)
    const uncoveredBase = createPgTragwerk01();
    const uncoveredCut = pgAccepted(
      applyStructuralDestructionCommand(
        uncoveredBase,
        pgCutCommand(uncoveredBase, pgCutBounds, "command.pg-tragwerk-r5-cut-00")
      )
    );
    expect(missingNeighborBrickOrigins(uncoveredCut.object).length).toBeGreaterThan(0);
    expect(() => withFullKnownCoverage(uncoveredCut.object)).toThrow();

    writeEvidenceMesh("pg-tragwerk-r5-mesh-before.json", beforeMesh);
    writeEvidenceMesh("pg-tragwerk-r5-mesh-after.json", afterMesh);
  });

  it("R5b: Low/High/LOD-Wechsel wirklich angewendet; Authority unveraendert", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-02"))
    );
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    expect(classification.fragments).toHaveLength(1);
    const plan = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      generousTransitionBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(plan.status).toBe("Installed");

    // LOD wirklich angewendet: unterschiedliche Collider-Saetze aus demselben Plan.
    const low = selectR5LodColliders(plan, "low");
    const high = selectR5LodColliders(plan, "high");
    expect(plan.dynamicBodies).toHaveLength(1);
    expect(low.length).toBe(plan.dynamicBodies[0].greedyColliders.length);
    expect(high.length).toBe(plan.dynamicBodies[0].voxelColliders.length);
    // 2-Zellen-Fragment: Greedy mergt in 1 Box, Voxel bleibt 2 Boxen.
    expect(low.length).toBe(1);
    expect(high.length).toBe(2);

    // Authority-Gleichheit unter Qualitaetswechsel: gleiche Belegung, gleiche
    // Masse, gleiche Fragmente, gleicher Plan-Hash — LOD ist reine Projektion.
    const mass = deriveStructuralObjectMassProperties(cut.object, { maxVisitedCells: 64 });
    expect(pgOccupiedKeys(cut.object)).toHaveLength(26);
    expect(mass.totalMassKg).toBeGreaterThan(0);
    expect(canonicalAdaptiveJson(classification.fragments)).toBe(
      canonicalAdaptiveJson(deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets).fragments)
    );
    const lowMesh = producedMesh(cut.object);
    const highMesh = producedMesh(cut.object);
    expect(lowMesh.contentHash).toBe(highMesh.contentHash);
    const lowScene = describeR5Scene(cut.object, lowMesh, "low");
    const highScene = describeR5Scene(cut.object, highMesh, "high");
    expect(lowScene.meshContentHash).toBe(highScene.meshContentHash);
    expect(lowScene.sourceContentHash).toBe(highScene.sourceContentHash);
    expect(lowScene.boundsMeters).toEqual(highScene.boundsMeters);
  });

  it("R5c: begrenzte Vorbereitung misst endliche Gesamtarbeit (Ready-Pfad)", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-03"))
    );
    const decision = prepareR5Bounded(cut.object, r5PrepareBudgets);
    expect(decision.status).toBe("Ready");
    expect(decision.occupiedCells).toBe(26);
    expect(decision.brickCount).toBe(covered.bricks.length);
    expect(decision.estimatedWork).toBe(26 + 6 * 26 + 2 * 26);
    expect(decision.estimatedWork).toBeLessThanOrEqual(r5PrepareBudgets.maxTotalWork);
    expect(decision.reason).toBeNull();

    // Schwere Ableitung erst nach Ready: Connectivity + Mesh + Transition bleiben
    // innerhalb derselben Schranken (gemessene Gesamtarbeit endlich).
    const classification = deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets);
    const mesh = producedMesh(cut.object);
    const plan = deriveStructuralPhysicsTransition(
      cut.object,
      classification,
      spinParentMotion,
      generousTransitionBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    const measured =
      decision.occupiedCells +
      classification.components.length +
      classification.fragments.length +
      mesh.indices.length / 6 +
      plan.dynamicBodies.reduce((sum, body) => sum + body.voxelColliders.length + body.greedyColliders.length, 0);
    expect(measured).toBeLessThanOrEqual(512);
  });

  it("R5d: Ueberlast wird explizit deferriert/rejected; Materie geht nicht verloren", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-04"))
    );
    const beforeKeys = pgOccupiedKeys(cut.object);
    const beforeHash = cut.object.contentHash;

    // Harte Rejection bei unmoeglich engem Budget (kein partielles Objekt).
    const rejected = prepareR5Bounded(cut.object, { maxOccupiedCells: 1, maxBricks: 16, maxTotalWork: 512 });
    expect(rejected.status).toBe("Rejected");
    expect(rejected.reason).toBe("r5/budgets/occupied-or-bricks");
    // Sichtbare Verzoegerung statt Verlust bei knappem Gesamtarbeits-Budget.
    const deferred = prepareR5Bounded(cut.object, { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 10 });
    expect(deferred.status).toBe("Deferred");
    expect(deferred.reason).toBe("r5/budgets/total-work");

    // Pending-Strategie ueber die bestehende Queue: Das deferrierte R5-Arbeitspaket
    // wird als Job mit R5-Nutzlast eingereiht — nichts faellt still weg; Cancel
    // gibt den Slot frei, Dispatch liefert dasselbe Paket aus.
    const pending = new StableWorkerJobQueue(1);
    const deferredPayload = { value: deferred.estimatedWork } as const;
    const deferredRequest: WorkerJobRequest<{ readonly value: number }> = {
      ...queueRequest("pg-r5-deferred-0", "Normal", 0),
      payload: deferredPayload
    };
    expect(pending.enqueue(deferredRequest).kind).toBe("Accepted");
    expect(pending.enqueue(queueRequest("pg-r5-deferred-1", "Normal", 0)).kind).toBe("RejectedQueueFull");
    expect(pending.snapshot().jobs.map((job) => job.jobId)).toEqual(["pg-r5-deferred-0"]);
    expect(pending.snapshot().jobs[0].payload).toEqual(deferredPayload);
    expect(pending.cancel(workerJobId("pg-r5-deferred-0"))?.jobId).toBe("pg-r5-deferred-0");
    expect(pending.enqueue(queueRequest("pg-r5-deferred-1", "Normal", 0)).kind).toBe("Accepted");
    expect(pending.dispatchNext()?.jobId).toBe("pg-r5-deferred-1");

    // Persistente Materie unangetastet nach beiden Ueberlast-Entscheidungen.
    expect(pgOccupiedKeys(cut.object)).toEqual(beforeKeys);
    expect(cut.object.contentHash).toBe(beforeHash);
  });

  it("R5d2: ungueltige Budgets werden fail-closed rejected", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-04b"))
    );
    const beforeKeys = pgOccupiedKeys(cut.object);
    const beforeHash = cut.object.contentHash;
    for (const budgets of [
      { maxOccupiedCells: Number.NaN, maxBricks: 16, maxTotalWork: 512 },
      { maxOccupiedCells: 64, maxBricks: Number.POSITIVE_INFINITY, maxTotalWork: 512 },
      { maxOccupiedCells: -0, maxBricks: 16, maxTotalWork: 512 },
      { maxOccupiedCells: -1, maxBricks: 16, maxTotalWork: 512 }
    ] as const) {
      const decision = prepareR5Bounded(cut.object, budgets);
      expect(decision.status).toBe("Rejected");
      expect(decision.reason).toBe("r5/budgets/invalid");
    }
    expect(prepareR5Bounded(cut.object, null as unknown as never).reason).toBe("r5/budgets/invalid");
    expect(prepareR5Bounded(cut.object, undefined as unknown as never).reason).toBe("r5/budgets/invalid");
    expect(pgOccupiedKeys(cut.object)).toEqual(beforeKeys);
    expect(cut.object.contentHash).toBe(beforeHash);
  });

  it("R5e: groesserer Fallback-Fall (>2 Fragmentzellen) bilanziert jede Zelle", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const first = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-05"))
    );
    // Zweiter Schnitt: Stuetzensegment (15,2..3,0) entfernen -> Traeger-Oberteil
    // loest sich zusaetzlich (mehr als 2 Fragmentzellen, mehrere Fragmente).
    const secondShape = {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 15, y: 2, z: 0 }, max: { x: 16, y: 4, z: 1 } }
    } as const;
    const secondCommand = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.pg-tragwerk-r5-cut-06",
      targetObjectId: "object.pg-tragwerk-01",
      expectedObjectRevision: 1,
      resultingObjectRevision: 2,
      expectedAdaptiveSource: first.object.source,
      materialFilter: null,
      actor: "player.pg-tragwerk-01",
      source: "tool.pg-canonical-cut",
      sequence: 2,
      budgets: pgCommandBudgets,
      shape: secondShape
    });
    const second = pgAccepted(applyStructuralDestructionCommand(first.object, secondCommand));
    expect(pgOccupiedKeys(second.object)).toHaveLength(24);
    const classification = deriveStructuralComponentClassification(second.object, pgConnectivityBudgets);
    const fragmentVoxels = classification.fragments.reduce((sum, fragment) => sum + fragment.occupiedCells.length, 0);
    expect(classification.fragments.length).toBeGreaterThanOrEqual(2);
    expect(fragmentVoxels).toBeGreaterThan(2);

    const reference = deriveStructuralPhysicsTransition(
      second.object,
      classification,
      spinParentMotion,
      generousTransitionBudgets,
      componentMassBudgets,
      "live-parent-body"
    );
    expect(reference.status).toBe("Installed");
    const referenceMass = reference.dynamicBodies.reduce((sum, body) => sum + body.massKg, 0);

    // Ueberlast: nur 1 Fragment-Budget gegen mehrere Fragmente -> Fallback.
    const squeezed = deriveStructuralPhysicsTransition(
      second.object,
      classification,
      spinParentMotion,
      { maxFragments: 1, maxCollidersPerFragment: 16, maxVoxelsPerFragment: 16 },
      componentMassBudgets,
      "live-parent-body"
    );
    expect(squeezed.status).toBe("Fallback");
    if (squeezed.status !== "Fallback") return;
    const allIds = classification.fragments.map((fragment) => fragment.fragmentId).sort();
    expect([...squeezed.dynamicFragmentIds, ...squeezed.mergedDebrisFragmentIds].sort()).toEqual(allIds);
    expect(squeezed.occupancyProof.fragmentVoxels).toBe(fragmentVoxels);
    expect(squeezed.occupancyProof.disjoint).toBe(true);
    expect(squeezed.occupancyProof.complete).toBe(true);
    const dynamicVoxels = squeezed.dynamicBodies.reduce((sum, body) => sum + body.occupiedVoxelCount, 0);
    expect(dynamicVoxels + squeezed.debris.occupiedVoxelCount).toBe(fragmentVoxels);
    const dynamicMass = squeezed.dynamicBodies.reduce((sum, body) => sum + body.massKg, 0);
    expect(dynamicMass + squeezed.debris.massKg).toBeCloseTo(referenceMass, 12);
    // Debris-Masse entspricht exakt den zusammengefassten Overflow-Fragmenten.
    const overflowMass = reference.dynamicBodies
      .filter((body) => (squeezed.mergedDebrisFragmentIds as readonly string[]).includes(body.fragmentId))
      .reduce((sum, body) => sum + body.massKg, 0);
    expect(squeezed.debris.massKg).toBeCloseTo(overflowMass, 12);
    const again = deriveStructuralPhysicsTransition(
      second.object,
      classification,
      spinParentMotion,
      { maxFragments: 1, maxCollidersPerFragment: 16, maxVoxelsPerFragment: 16 },
      componentMassBudgets,
      "live-parent-body"
    );
    expect(again.contentHash).toBe(squeezed.contentHash);

    // LOD-Projektion deckt auch den Fallback-Debris ab (keine Materie ohne LOD):
    // Low = alle Greedy-Boxen, High = alle Voxel-Boxen (dynamisch + Debris).
    const lowFallback = selectR5LodColliders(squeezed, "low");
    const highFallback = selectR5LodColliders(squeezed, "high");
    const greedyCount =
      squeezed.dynamicBodies.reduce((sum, body) => sum + body.greedyColliders.length, 0) +
      squeezed.debris.greedyColliders.length;
    const voxelCount =
      squeezed.dynamicBodies.reduce((sum, body) => sum + body.voxelColliders.length, 0) +
      squeezed.debris.voxelColliders.length;
    expect(lowFallback.length).toBe(greedyCount);
    expect(highFallback.length).toBe(voxelCount);
    expect(voxelCount).toBe(fragmentVoxels);
    // Debris-Budgetflagge konkret: Budget 16, kleine Debris-Boxenzahl -> false.
    expect(squeezed.debris.greedyColliders.length).toBeLessThanOrEqual(16);
    expect(squeezed.debris.exceedsColliderBudget).toBe(false);
  });

  it("R5f: Pruef-Szene ist deterministisch; Material/Licht/Komposition aus Authority", () => {
    const covered = withFullKnownCoverage(createPgTragwerk01());
    const cut = pgAccepted(
      applyStructuralDestructionCommand(covered, pgCutCommand(covered, pgCutBounds, "command.pg-tragwerk-r5-cut-07"))
    );
    const mesh = producedMesh(cut.object);
    const scene = describeR5Scene(cut.object, mesh, "high");
    expect(scene.schemaVersion).toBe("pg-tragwerk-r5-scene-v1");
    expect(scene.meshContentHash).toBe(mesh.contentHash);
    expect(scene.sourceContentHash).toBe(mesh.sourceContentHash);
    expect(scene.materials.map((entry) => entry.materialId).sort()).toEqual([1, 2, 3]);
    expect(scene.materials.map((entry) => entry.densityKgPerCubicMeter).sort()).toEqual([1600, 2700, 7800]);
    expect(scene.materials.map((entry) => entry.displayColor).sort()).toEqual(["#7d8ea3", "#8a7f6a", "#c2a15a"]);
    for (const entry of scene.materials) {
      expect(entry.roughness).toBe(0.85);
      expect(entry.structuralClass.length).toBeGreaterThan(0);
    }
    expect(scene.lights).toEqual({ keyIntensity: 2.5, fillIntensity: 0.8, ambientIntensity: 0.4 });
    for (const value of [
      scene.camera.positionMeters.x, scene.camera.positionMeters.y, scene.camera.positionMeters.z,
      scene.camera.targetMeters.x, scene.camera.targetMeters.y, scene.camera.targetMeters.z
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(scene.boundsMeters).toEqual(mesh.boundsMeters);
    expect(scene.quadCount).toBe(mesh.indices.length / 6);
    // Determinismus: gleiche Eingabe -> gleiche Szene (komponierbar, kein Renderer).
    expect(describeR5Scene(cut.object, mesh, "high")).toEqual(scene);
    // Spielerpfad-Anker bleiben lesbar: Sockel- und Stuetzenfuss-Anker vorhanden.
    expect(cut.object.anchors.map((anchor) => anchor.anchorId).sort()).toEqual([
      "anchor.pg-sockel",
      "anchor.pg-stuetzenfuss"
    ]);
    // Fail-closed: veraltetes Mesh (vor dem Schnitt) wird mit neuem Objekt
    // abgelehnt; unbekannte LOD-Stufe wirft statt still "high" zu waehlen.
    const staleMesh = producedMesh(withFullKnownCoverage(createPgTragwerk01()));
    expect(() => describeR5Scene(cut.object, staleMesh, "high")).toThrow();
    expect(() => describeR5Scene(cut.object, mesh, "ultra" as never)).toThrow();
    expect(() => selectR5LodColliders(
      deriveStructuralPhysicsTransition(
        cut.object,
        deriveStructuralComponentClassification(cut.object, pgConnectivityBudgets),
        spinParentMotion,
        generousTransitionBudgets,
        componentMassBudgets,
        "live-parent-body"
      ),
      "ultra" as never
    )).toThrow();
  });
});
