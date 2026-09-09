import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  authorityRevision,
  canonicalAdaptiveJson,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  deriveStructuralComponentMassProperties,
  deriveStructuralObjectMassProperties,
  getStructuralVoxel,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCommandResult,
  type StructuralObject
} from "../../src/voxel/structural";

/**
 * Paket P-PG-SLICE1 — Proving-Ground-Scheibe 1 (nur G1+G2).
 *
 * Authored Fixture PG-TRAGWERK-01: Terrain-Sockel plus EINE Traegerstruktur
 * (Stuetze + Traeger) ueber die Chunkgrenze x=16, drei Materialien.
 * Der kanonische Schnitt laeuft ueber den Spielerkommando-Pfad
 * (applyStructuralDestructionCommand); kein Test-only Direct Import,
 * keine Mesh-Mutation. Keine Physik, kein Save, kein Rendering.
 */
const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "pg-tragwerk-01",
  surfaceFrameId: "frame.pg-surface",
  regionId: "region.pg-tragwerk-01",
  generatorVersion: "generator.pg-v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;

const keyAt = (x = 0, y = 0, z = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: frame.bodyId,
  surfaceFrameId: frame.surfaceFrameId,
  regionId: frame.regionId,
  generatorVersion: frame.generatorVersion,
  level: 4,
  originQuantum: { x, y, z }
});

const MATERIAL_TERRAIN = 1;
const MATERIAL_STEEL = 2;
const MATERIAL_BEAM = 3;

const DENSITIES: Readonly<Record<number, number>> = {
  [MATERIAL_TERRAIN]: 1_600,
  [MATERIAL_STEEL]: 7_800,
  [MATERIAL_BEAM]: 2_700
};

type CellSeed = Readonly<{ x: number; y?: number; z?: number; materialId: number; semanticKey: string }>;
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly CellSeed[] }>;

/** Terrain-Sockel y=0, x=0..17 (ueber Chunkgrenze), Stuetze x=15 y=1..4, Traeger y=5 x=14..18. */
const pgBricks = (): readonly BrickSeed[] => {
  const sockelWest: CellSeed[] = [];
  for (let x = 0; x < 16; x += 1) sockelWest.push({ x, y: 0, z: 0, materialId: MATERIAL_TERRAIN, semanticKey: "pg.sockel" });
  const sockelEast: CellSeed[] = [
    { x: 0, y: 0, z: 0, materialId: MATERIAL_TERRAIN, semanticKey: "pg.sockel" },
    { x: 1, y: 0, z: 0, materialId: MATERIAL_TERRAIN, semanticKey: "pg.sockel" }
  ];
  const stuetze: CellSeed[] = [];
  for (let y = 1; y <= 4; y += 1) stuetze.push({ x: 15, y, z: 0, materialId: MATERIAL_STEEL, semanticKey: "pg.stuetze" });
  return [
    {
      key: keyAt(),
      cells: [...sockelWest, ...stuetze,
        { x: 14, y: 5, z: 0, materialId: MATERIAL_STEEL, semanticKey: "pg.traeger" },
        { x: 15, y: 5, z: 0, materialId: MATERIAL_STEEL, semanticKey: "pg.traeger" }]
    },
    {
      key: keyAt(16, 0, 0),
      cells: [...sockelEast,
        { x: 0, y: 5, z: 0, materialId: MATERIAL_BEAM, semanticKey: "pg.traeger" },
        { x: 1, y: 5, z: 0, materialId: MATERIAL_BEAM, semanticKey: "pg.traeger" },
        { x: 2, y: 5, z: 0, materialId: MATERIAL_BEAM, semanticKey: "pg.traeger" }]
    }
  ];
};

const pgFixture = (): StructuralObject => {
  const bricks = pgBricks();
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId("base.pg-tragwerk-01"),
    version: stableAuthorityId("generator.pg-v1"),
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy: 0, materialId: null }
  });
  const seeds = bricks.flatMap((brick) => brick.cells.map((cell) => ({ brick, cell })));
  const records: AdaptiveEditInput[] = seeds.map(({ brick, cell }, index) => {
    const min = {
      x: brick.key.originQuantum.x + cell.x,
      y: brick.key.originQuantum.y + (cell.y ?? 0),
      z: brick.key.originQuantum.z + (cell.z ?? 0)
    };
    return {
      editId: `edit.pg-${String(index + 1).padStart(4, "0")}`,
      sequence: index + 1,
      expectedRegionRevision: index,
      resultRegionRevision: index + 1,
      actorId: "actor.pg-author",
      sourceId: "source.pg-authored-fixture",
      operation: "AddBox",
      box: { min, max: { x: min.x + 1, y: min.y + 1, z: min.z + 1 } },
      materialId: `material.${cell.materialId}`,
      semanticId: cell.semanticKey
    };
  });
  const editJournal = createAdaptiveEditJournal(records);
  const adaptiveBricks = bricks.map((entry) => materializeAdaptiveBrick({ key: entry.key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const summaries = adaptiveBricks.map((brick) => ({
    key: brick.key,
    readiness: "ready" as const,
    byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES,
    work: ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash: brick.contentHash,
    provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
    journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision,
    editRevision: brick.editRevision,
    brickRevision
  }));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId),
    surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId),
    generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(7),
    resident: summaries,
    activeCoverage: [],
    refinementRequests: [],
    budgets: { maxBricks: 16, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  const snapshot: AdaptivePlannerSnapshot = { ...draft, resident: summaries.map((summary, index) => ({ ...summary, validationProof: proofs[index] })) };
  return createStructuralObjectFromAdaptive({
    objectId: "object.pg-tragwerk-01",
    frame,
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot,
    materials: [
      { materialId: MATERIAL_TERRAIN, densityKgPerCubicMeter: DENSITIES[MATERIAL_TERRAIN], structuralClass: "terrain", destructible: false, tags: ["sockel"] },
      { materialId: MATERIAL_STEEL, densityKgPerCubicMeter: DENSITIES[MATERIAL_STEEL], structuralClass: "truss", destructible: true, tags: ["tragwerk"] },
      { materialId: MATERIAL_BEAM, densityKgPerCubicMeter: DENSITIES[MATERIAL_BEAM], structuralClass: "beam", destructible: true, tags: ["tragwerk"] }
    ],
    materialBindings: [MATERIAL_TERRAIN, MATERIAL_STEEL, MATERIAL_BEAM].map((materialId) => ({
      adaptiveMaterialId: `material.${materialId}`,
      structuralMaterialId: materialId
    })),
    bricks: adaptiveBricks,
    anchors: [
      { anchorId: "anchor.pg-sockel", cell: createStructuralCellAddress(keyAt(), { x: 2, y: 0, z: 0 }) },
      { anchorId: "anchor.pg-stuetzenfuss", cell: createStructuralCellAddress(keyAt(), { x: 15, y: 1, z: 0 }) }
    ],
    joints: [],
    objectRevision: 0,
    editRevision: 0,
    commandEvidence: []
  });
};

const commandBudgets = {
  maxVisitedBricks: 8,
  maxVisitedCells: 64,
  maxSelectedCells: 64,
  maxChangedCells: 64,
  maxConnectivityCells: 64,
  maxConnectivityFacts: 64,
  maxComponents: 16,
  maxMassCells: 64
} as const;

const cutCommand = (object: StructuralObject, shape: unknown, commandId: string) =>
  validateStructuralDestructionCommand({
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    kind: "SubtractBox",
    commandId,
    targetObjectId: "object.pg-tragwerk-01",
    expectedObjectRevision: 0,
    resultingObjectRevision: 1,
    expectedAdaptiveSource: object.source,
    materialFilter: null,
    actor: "player.pg-tragwerk-01",
    source: "tool.pg-canonical-cut",
    sequence: 1,
    budgets: commandBudgets,
    shape
  });

const accepted = (result: StructuralCommandResult): StructuralAcceptedCommandResult => {
  if (result.status === "Rejected") throw new Error(`Expected accepted command, received ${result.code} at ${result.path}.`);
  return result;
};

const connectivityBudgets = {
  maxVisitedCells: 64,
  maxComponents: 16,
  maxIndexedFacts: 64
} as const;

const occupiedKeys = (object: StructuralObject): readonly string[] => {
  const keys: string[] = [];
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      keys.push(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)));
    }
  }
  return keys.sort();
};

describe("PG-TRAGWERK-01 proving-ground slice 1 (G1+G2)", () => {
  it("authored fixture spans the chunk seam with terrain socket, one support structure, and three materials", () => {
    const object = pgFixture();
    expect(object.bricks).toHaveLength(2);
    expect(object.bricks.map((brick) => brick.key.originQuantum.x)).toEqual([0, 16]);
    const occupied = object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
    expect(occupied).toBe(27);
    expect(object.materials.map((material) => material.materialId)).toEqual([1, 2, 3]);
    expect(object.anchors.map((anchor) => anchor.anchorId)).toEqual(["anchor.pg-sockel", "anchor.pg-stuetzenfuss"]);
    const classification = deriveStructuralComponentClassification(object, connectivityBudgets);
    expect(classification.components).toHaveLength(1);
    expect(classification.anchoredComponents).toHaveLength(1);
    expect(classification.detachedComponents).toHaveLength(0);
  });

  it("G1: canonical player-command cut at the chunk seam removes exactly one beam cell", () => {
    const original = pgFixture();
    const result = accepted(applyStructuralDestructionCommand(original, cutCommand(original, {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
    }, "command.pg-tragwerk-cut-01")));
    expect(result.status).toBe("Applied");
    expect(result.selectedVoxelCount).toBe(1);
    expect(result.changedVoxelCount).toBe(1);
    expect(result.changedBrickKeys.map((key) => key.originQuantum.x)).toEqual([16]);
    expect(result.object.objectRevision).toBe(1);
    expect(result.object.editRevision).toBe(1);
    expect(result.object.commandEvidence).toHaveLength(1);
    expect(result.invalidations.map((entry) => entry.kind)).toEqual(["Components", "MassProperties", "Mesh"]);
    expect(getStructuralVoxel(result.object, createStructuralCellAddress(keyAt(16, 0, 0), { x: 0, y: 5, z: 0 }))).toBeNull();
    expect(getStructuralVoxel(result.object, createStructuralCellAddress(keyAt(16, 0, 0), { x: 1, y: 5, z: 0 }))).not.toBeNull();
    expect(original.bricks.reduce((sum, brick) => sum + brick.cells.length, 0)).toBe(27);
  });

  it("G1: cut against unknown coverage at the seam is rejected fail-closed, never invented as air", () => {
    const original = pgFixture();
    const result = applyStructuralDestructionCommand(original, cutCommand(original, {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 32, y: 0, z: 0 }, max: { x: 33, y: 1, z: 1 } }
    }, "command.pg-tragwerk-unknown-01"));
    expect(result.status).toBe("Rejected");
    if (result.status === "Rejected") {
      expect(result.code).toBe("MissingBrickCoverage");
      expect(result.path).toBe("command/shape");
    }
    expect(result.object).toBe(original);
    expect(result.object.commandEvidence).toHaveLength(0);
  });

  it("G2: components assign every occupied cell exactly once and are deterministic", () => {
    const original = pgFixture();
    const cut = accepted(applyStructuralDestructionCommand(original, cutCommand(original, {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
    }, "command.pg-tragwerk-cut-01")));
    const first = deriveStructuralComponentClassification(cut.object, connectivityBudgets);
    const second = deriveStructuralComponentClassification(cut.object, connectivityBudgets);
    expect(canonicalAdaptiveJson(first)).toBe(canonicalAdaptiveJson(second));
    expect(first.components).toHaveLength(2);
    expect(first.anchoredComponents).toHaveLength(1);
    expect(first.detachedComponents).toHaveLength(1);
    expect(first.fragments).toHaveLength(1);
    const memberKeys = first.components.flatMap((component) => component.occupiedCells.map(serializeStructuralCellAddress)).sort();
    expect(memberKeys).toEqual(occupiedKeys(cut.object));
    expect(new Set(memberKeys).size).toBe(memberKeys.length);
    expect(first.detachedComponents[0].occupiedCells).toHaveLength(2);
    const fresh = pgFixture();
    expect(fresh.contentHash).toBe(original.contentHash);
    const recut = accepted(applyStructuralDestructionCommand(fresh, cutCommand(fresh, {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
    }, "command.pg-tragwerk-cut-01")));
    expect(recut.object.contentHash).toBe(cut.object.contentHash);
    expect(recut.resultHash).toBe(cut.resultHash);
  });

  it("G2: mass balance is closed and deterministic", () => {
    const original = pgFixture();
    const cut = accepted(applyStructuralDestructionCommand(original, cutCommand(original, {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
    }, "command.pg-tragwerk-cut-01")));
    const before = deriveStructuralObjectMassProperties(original, { maxVisitedCells: 64 });
    const after = deriveStructuralObjectMassProperties(cut.object, { maxVisitedCells: 64 });
    const again = deriveStructuralObjectMassProperties(cut.object, { maxVisitedCells: 64 });
    expect(again.contentHash).toBe(after.contentHash);
    expect(before.occupiedVoxelCount).toBe(27);
    expect(after.occupiedVoxelCount).toBe(26);
    const side = MICROVOXEL_BASE_QUANTUM_METERS;
    const removedKg = DENSITIES[MATERIAL_BEAM] * side * side * side;
    expect(before.totalMassKg - after.totalMassKg).toBeCloseTo(removedKg, 9);
    expect(after.centerOfMassMeters).not.toBeNull();
    expect(after.inertiaTensorKgMetersSquared.xx).toBeGreaterThanOrEqual(0);
    expect(after.inertiaTensorKgMetersSquared.yy).toBeGreaterThanOrEqual(0);
    expect(after.inertiaTensorKgMetersSquared.zz).toBeGreaterThanOrEqual(0);
    const classification = deriveStructuralComponentClassification(cut.object, connectivityBudgets);
    let componentSum = 0;
    for (const component of classification.components) {
      const mass = deriveStructuralComponentMassProperties(cut.object, component, {
        maxVisitedCells: 64,
        maxConnectivityCells: 64,
        maxComponents: 16,
        maxConnectivityFacts: 64
      });
      componentSum += mass.totalMassKg;
    }
    expect(componentSum).toBeCloseTo(after.totalMassKg, 9);
  });
});
