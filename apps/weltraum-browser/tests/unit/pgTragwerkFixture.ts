import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  authorityRevision,
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
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCommandResult,
  type StructuralObject
} from "../../src/voxel/structural";
import { withFullKnownCoverage } from "../../src/voxel/structural/provingGroundR5";

/**
 * Paket P-PG-SLICE2 — wiederverwendetes Fixture PG-TRAGWERK-01 aus Slice 1.
 *
 * Identischer authored Aufbau (Terrain-Sockel y=0 x=0..17, Stuetze x=15/y=1..4,
 * Traeger y=5/x=14..18, 27 Zellen, 2 Bricks, 2 Anker), damit Slice 2 exakt auf
 * der Slice-1-Basis steht. Slice-1-Testdatei bleibt unveraendert.
 */
export const pgFrame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "pg-tragwerk-01",
  surfaceFrameId: "frame.pg-surface",
  regionId: "region.pg-tragwerk-01",
  generatorVersion: "generator.pg-v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;

export const pgKeyAt = (x = 0, y = 0, z = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: pgFrame.bodyId,
  surfaceFrameId: pgFrame.surfaceFrameId,
  regionId: pgFrame.regionId,
  generatorVersion: pgFrame.generatorVersion,
  level: 4,
  originQuantum: { x, y, z }
});

export const PG_MATERIAL_TERRAIN = 1;
export const PG_MATERIAL_STEEL = 2;
export const PG_MATERIAL_BEAM = 3;

export const PG_DENSITIES: Readonly<Record<number, number>> = {
  [PG_MATERIAL_TERRAIN]: 1_600,
  [PG_MATERIAL_STEEL]: 7_800,
  [PG_MATERIAL_BEAM]: 2_700
};

type CellSeed = Readonly<{ x: number; y?: number; z?: number; materialId: number; semanticKey: string }>;
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly CellSeed[] }>;

/** Terrain-Sockel y=0, x=0..17 (ueber Chunkgrenze), Stuetze x=15 y=1..4, Traeger y=5 x=14..18. */
const pgBricks = (): readonly BrickSeed[] => {
  const sockelWest: CellSeed[] = [];
  for (let x = 0; x < 16; x += 1) sockelWest.push({ x, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" });
  const sockelEast: CellSeed[] = [
    { x: 0, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" },
    { x: 1, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" }
  ];
  const stuetze: CellSeed[] = [];
  for (let y = 1; y <= 4; y += 1) stuetze.push({ x: 15, y, z: 0, materialId: PG_MATERIAL_STEEL, semanticKey: "pg.stuetze" });
  return [
    {
      key: pgKeyAt(),
      cells: [...sockelWest, ...stuetze,
        { x: 14, y: 5, z: 0, materialId: PG_MATERIAL_STEEL, semanticKey: "pg.traeger" },
        { x: 15, y: 5, z: 0, materialId: PG_MATERIAL_STEEL, semanticKey: "pg.traeger" }]
    },
    {
      key: pgKeyAt(16, 0, 0),
      cells: [...sockelEast,
        { x: 0, y: 5, z: 0, materialId: PG_MATERIAL_BEAM, semanticKey: "pg.traeger" },
        { x: 1, y: 5, z: 0, materialId: PG_MATERIAL_BEAM, semanticKey: "pg.traeger" },
        { x: 2, y: 5, z: 0, materialId: PG_MATERIAL_BEAM, semanticKey: "pg.traeger" }]
    }
  ];
};

export const createPgTragwerk01 = (): StructuralObject => {
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
    bodyId: stableAuthorityId(pgFrame.bodyId),
    surfaceFrameId: stableAuthorityId(pgFrame.surfaceFrameId),
    regionId: stableAuthorityId(pgFrame.regionId),
    generatorVersion: stableAuthorityId(pgFrame.generatorVersion),
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
    frame: pgFrame,
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot,
    materials: [
      { materialId: PG_MATERIAL_TERRAIN, densityKgPerCubicMeter: PG_DENSITIES[PG_MATERIAL_TERRAIN], structuralClass: "terrain", destructible: false, tags: ["sockel"] },
      { materialId: PG_MATERIAL_STEEL, densityKgPerCubicMeter: PG_DENSITIES[PG_MATERIAL_STEEL], structuralClass: "truss", destructible: true, tags: ["tragwerk"] },
      { materialId: PG_MATERIAL_BEAM, densityKgPerCubicMeter: PG_DENSITIES[PG_MATERIAL_BEAM], structuralClass: "beam", destructible: true, tags: ["tragwerk"] }
    ],
    materialBindings: [PG_MATERIAL_TERRAIN, PG_MATERIAL_STEEL, PG_MATERIAL_BEAM].map((materialId) => ({
      adaptiveMaterialId: `material.${materialId}`,
      structuralMaterialId: materialId
    })),
    bricks: adaptiveBricks,
    anchors: [
      { anchorId: "anchor.pg-sockel", cell: createStructuralCellAddress(pgKeyAt(), { x: 2, y: 0, z: 0 }) },
      { anchorId: "anchor.pg-stuetzenfuss", cell: createStructuralCellAddress(pgKeyAt(), { x: 15, y: 1, z: 0 }) }
    ],
    joints: [],
    objectRevision: 0,
    editRevision: 0,
    commandEvidence: []
  });
};

export const pgCommandBudgets = {
  maxVisitedBricks: 8,
  maxVisitedCells: 64,
  maxSelectedCells: 64,
  maxChangedCells: 64,
  maxConnectivityCells: 64,
  maxConnectivityFacts: 64,
  maxComponents: 16,
  maxMassCells: 64
} as const;

export const pgCutCommand = (object: StructuralObject, shape: unknown, commandId: string) =>
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
    budgets: pgCommandBudgets,
    shape
  });

export const pgAccepted = (result: StructuralCommandResult): StructuralAcceptedCommandResult => {
  if (result.status === "Rejected") throw new Error(`Expected accepted command, received ${result.code} at ${result.path}.`);
  return result;
};

export const pgConnectivityBudgets = {
  maxVisitedCells: 64,
  maxComponents: 16,
  maxIndexedFacts: 64
} as const;

export const pgCutBounds = {
  kind: "box",
  space: "global-quantum",
  boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
} as const;

export const pgOccupiedKeys = (object: StructuralObject): readonly string[] => {
  const keys: string[] = [];
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      keys.push(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)));
    }
  }
  return keys.sort();
};

/** Kanonischer Slice-1-Schnitt auf frischem Fixture; wirft bei Rejection. */
export const pgApplyCanonicalCut = (): StructuralAcceptedCommandResult => {
  const fixture = createPgTragwerk01();
  return pgAccepted(applyStructuralDestructionCommand(
    fixture,
    pgCutCommand(fixture, pgCutBounds, "command.pg-tragwerk-cut-01")
  ));
};

/**
 * Paket P-PG-R5B — geschlossenes authored Fixture mit beigelegter bekannter
 * Aussenluft (7 Bricks, 27 Zellen, Revision 0, leere Evidence). Einzige
 * zugelassene Coverage-Quelle fuer R5B-Nachweise; wiederverwendet das
 * kanonische Fixture statt es zu kopieren.
 */
export const createCoveredPgTragwerk01 = (): StructuralObject =>
  withFullKnownCoverage(createPgTragwerk01());
