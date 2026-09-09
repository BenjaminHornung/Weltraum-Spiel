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
} from "../voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  commitStructuralPhysicsTransition,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  decodeStructuralRegionSave,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,
  encodeStructuralRegionSave,
  validateStructuralDestructionCommand,
  withFullKnownCoverage,
  type StructuralBodyPoseMotion,
  type StructuralColliderMassSpec,
  type StructuralObject,
  type StructuralPhysicsWorldPort,
  type StructuralWorldCuboid
} from "../voxel/structural";

/**
 * P-PROD-P12 Spielerpfad-Slice: produktiver Seed + Controller fuer
 * PG-TRAGWERK-01. Baut dasselbe authored Fixture wie der Test-Adapter
 * (Terrain-Sockel, Stuetze, Traeger; 27 Zellen, volle bekannte Coverage),
 * importiert aber NIEMALS tests/support.
 */

const pgFrame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "pg-tragwerk-01",
  surfaceFrameId: "frame.pg-surface",
  regionId: "region.pg-tragwerk-01",
  generatorVersion: "generator.pg-v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;

const pgKeyAt = (x = 0, y = 0, z = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: pgFrame.bodyId,
  surfaceFrameId: pgFrame.surfaceFrameId,
  regionId: pgFrame.regionId,
  generatorVersion: pgFrame.generatorVersion,
  level: 4,
  originQuantum: { x, y, z }
});

const PG_MATERIAL_TERRAIN = 1;
const PG_MATERIAL_STEEL = 2;
const PG_MATERIAL_BEAM = 3;

const PG_DENSITIES: Readonly<Record<number, number>> = {
  [PG_MATERIAL_TERRAIN]: 1_600,
  [PG_MATERIAL_STEEL]: 7_800,
  [PG_MATERIAL_BEAM]: 2_700
};

type CellSeed = Readonly<{ x: number; y?: number; z?: number; materialId: number; semanticKey: string }>;
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly CellSeed[] }>;

/** Terrain-Sockel y=0, x=0..17 (ueber Chunkgrenze), Stuetze x=15 y=1..4, Traeger y=5 x=14..18. */
const pgBricks = (): readonly BrickSeed[] => {
  const sockelWest: CellSeed[] = [];
  for (let x = 0; x < 16; x += 1) {
    sockelWest.push({ x, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" });
  }
  const sockelEast: CellSeed[] = [
    { x: 0, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" },
    { x: 1, y: 0, z: 0, materialId: PG_MATERIAL_TERRAIN, semanticKey: "pg.sockel" }
  ];
  const stuetze: CellSeed[] = [];
  for (let y = 1; y <= 4; y += 1) {
    stuetze.push({ x: 15, y, z: 0, materialId: PG_MATERIAL_STEEL, semanticKey: "pg.stuetze" });
  }
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

const createPgTragwerk01Seed = (): StructuralObject => {
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

export const PG_TRAGWERK_PLAYER_OBJECT_ID = "object.pg-tragwerk-01";
export const PG_TRAGWERK_PLAYER_ACTOR = "player.pg-tragwerk-01";
export const PG_TRAGWERK_PLAYER_SOURCE = "tool.pg-canonical-cut";
export const PG_TRAGWERK_PLAYER_COMMAND_ID = "command.pg-tragwerk-player-01";

export const pgTragwerkPlayerCutBounds = {
  kind: "box",
  space: "global-quantum",
  boundsQuantum: { min: { x: 16, y: 5, z: 0 }, max: { x: 17, y: 6, z: 1 } }
} as const;

const pgCommandBudgets = {
  maxVisitedBricks: 8,
  maxVisitedCells: 64,
  maxSelectedCells: 64,
  maxChangedCells: 64,
  maxConnectivityCells: 64,
  maxConnectivityFacts: 64,
  maxComponents: 16,
  maxMassCells: 64
} as const;

const pgConnectivityBudgets = { maxVisitedCells: 64, maxComponents: 16, maxIndexedFacts: 64 } as const;
const pgTransitionBudgets = { maxFragments: 4, maxCollidersPerFragment: 8, maxVoxelsPerFragment: 16 } as const;
const pgComponentMassBudgets = {
  maxVisitedCells: 64,
  maxConnectivityCells: 64,
  maxComponents: 16,
  maxConnectivityFacts: 64
} as const;
const pgRestParentMotion = {
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  angularVelocityRadPerSecond: { x: 0, y: 0, z: 0 }
} as const;

interface CountingBody {
  id: number;
  pose: StructuralBodyPoseMotion;
  cuboids: { cuboid: StructuralWorldCuboid; mass: StructuralColliderMassSpec }[];
  removed: boolean;
}

/** Solver-neutraler Zaehl-Port fuer die Commitgrenze (kein Rapier im Produktpfad). */
const createCountingPort = (): { port: StructuralPhysicsWorldPort<CountingBody>; bodies: CountingBody[] } => {
  const bodies: CountingBody[] = [];
  let nextId = 0;
  const live = (body: CountingBody): boolean => !body.removed;
  const port: StructuralPhysicsWorldPort<CountingBody> = {
    bodiesLen: () => bodies.filter(live).length,
    collidersLen: () => bodies.filter(live).reduce((sum, body) => sum + body.cuboids.length, 0),
    createBody: (pose: StructuralBodyPoseMotion): CountingBody => {
      const body: CountingBody = { id: (nextId += 1), pose, cuboids: [], removed: false };
      bodies.push(body);
      return body;
    },
    addCollider: (body: CountingBody, cuboid: StructuralWorldCuboid, mass: StructuralColliderMassSpec): void => {
      body.cuboids.push({ cuboid, mass });
    },
    bodyColliderCount: (body: CountingBody): number => body.cuboids.length,
    removeBody: (body: CountingBody): void => {
      body.removed = true;
    }
  };
  return { port, bodies };
};

export interface PgTragwerkPlayerDestroyOutcome {
  readonly status: "Applied" | "NoChange" | "Rejected";
  readonly code: string;
  readonly message: string;
  readonly commandId: string;
  readonly actor: string;
  readonly source: string;
  readonly objectId: string;
  readonly objectRevision: number;
  readonly contentHash: string;
  readonly cellsBefore: number;
  readonly cellsAfter: number;
  readonly massBeforeKg: number;
  readonly massAfterKg: number;
  readonly bodiesBefore: number;
  readonly bodiesAfter: number;
  readonly collidersBefore: number;
  readonly collidersAfter: number;
  readonly anchoredColliderCount: number;
  readonly fragmentCount: number;
  readonly regionSaveHash: string;
}

export interface PgTragwerkPlayerSnapshot {
  readonly ready: boolean;
  readonly readyError: string | null;
  readonly applied: boolean;
  readonly cellsBefore: number | null;
  readonly cellsAfter: number | null;
  readonly massBeforeKg: number | null;
  readonly massAfterKg: number | null;
  readonly cutStatus: string;
  readonly actor: string;
  readonly source: string;
  readonly objectId: string;
  readonly objectRevision: number | null;
  readonly contentHash: string | null;
  readonly bodiesBefore: number | null;
  readonly bodiesAfter: number | null;
  readonly collidersBefore: number | null;
  readonly collidersAfter: number | null;
  readonly fragmentCount: number | null;
  readonly regionSaveHash: string | null;
  readonly lastError: string | null;
}

export const createPgTragwerkPlayerSlice = (): {
  snapshot(): PgTragwerkPlayerSnapshot;
  destroy(): PgTragwerkPlayerDestroyOutcome;
} => {
  let object: StructuralObject | null = null;
  let readyError: string | null = null;
  try {
    object = withFullKnownCoverage(createPgTragwerk01Seed());
  } catch (error) {
    readyError = error instanceof Error ? error.message : "PG seed failed.";
  }
  // Seed-Revision einmalig binden: ein Zweitklick trifft denselben Command
  // gegen das revidierte Objekt und wird als RevisionConflict abgewiesen.
  const seedRevision = object?.objectRevision ?? 0;
  const massOf = (candidate: StructuralObject): { cells: number; massKg: number } => {
    const cells = candidate.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
    const mass = deriveStructuralObjectMassProperties(candidate, { maxVisitedCells: 64 });
    return { cells, massKg: mass.totalMassKg };
  };
  const seedMass = object ? massOf(object) : null;
  let applied = false;
  let lastOutcome: PgTragwerkPlayerDestroyOutcome | null = null;
  let appliedOutcome: PgTragwerkPlayerDestroyOutcome | null = null;
  let lastError: string | null = readyError;

  const snapshot = (): PgTragwerkPlayerSnapshot => {
    // Nach dem Applied-Cut bleibt die Anzeige am appliedOutcome verankert:
    // ein spaeter abgewiesener Zweitklick (Rejected) aktualisiert nur lastOutcome/lastError,
    // darf die Applied-Werte aber nicht korrumpieren.
    const appliedView = applied ? appliedOutcome : null;
    return {
      ready: object !== null,
      readyError,
      applied,
      cellsBefore: seedMass?.cells ?? null,
      cellsAfter: appliedView?.cellsAfter ?? null,
      massBeforeKg: seedMass?.massKg ?? null,
      massAfterKg: appliedView?.massAfterKg ?? null,
      cutStatus: appliedOutcome ? appliedOutcome.status : (lastOutcome ? lastOutcome.status : "Pending"),
      actor: PG_TRAGWERK_PLAYER_ACTOR,
      source: PG_TRAGWERK_PLAYER_SOURCE,
      objectId: PG_TRAGWERK_PLAYER_OBJECT_ID,
      objectRevision: appliedView?.objectRevision ?? lastOutcome?.objectRevision ?? object?.objectRevision ?? null,
      contentHash: appliedView?.contentHash ?? lastOutcome?.contentHash ?? object?.contentHash ?? null,
      bodiesBefore: appliedOutcome?.bodiesBefore ?? null,
      bodiesAfter: appliedOutcome?.bodiesAfter ?? null,
      collidersBefore: appliedOutcome?.collidersBefore ?? null,
      collidersAfter: appliedOutcome?.collidersAfter ?? null,
      fragmentCount: appliedOutcome?.fragmentCount ?? null,
      regionSaveHash: appliedOutcome?.regionSaveHash ?? null,
      lastError
    };
  };

  const destroy = (): PgTragwerkPlayerDestroyOutcome => {
    const live = object;
    if (!live) {
      lastError = readyError ?? "PG seed unavailable.";
      lastOutcome = {
        status: "Rejected",
        code: "PgSeedUnavailable",
        message: lastError,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: PG_TRAGWERK_PLAYER_OBJECT_ID,
        objectRevision: seedRevision,
        contentHash: "",
        cellsBefore: seedMass?.cells ?? 0,
        cellsAfter: seedMass?.cells ?? 0,
        massBeforeKg: seedMass?.massKg ?? 0,
        massAfterKg: seedMass?.massKg ?? 0,
        bodiesBefore: 0,
        bodiesAfter: 0,
        collidersBefore: 0,
        collidersAfter: 0,
        anchoredColliderCount: 0,
        fragmentCount: 0,
        regionSaveHash: ""
      };
      return lastOutcome;
    }
    const before = massOf(live);
    let result: ReturnType<typeof applyStructuralDestructionCommand>;
    try {
      const command = validateStructuralDestructionCommand({
        schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
        kind: "SubtractBox",
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        targetObjectId: PG_TRAGWERK_PLAYER_OBJECT_ID,
        expectedObjectRevision: seedRevision,
        resultingObjectRevision: seedRevision + 1,
        expectedAdaptiveSource: live.source,
        materialFilter: null,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        sequence: 1,
        budgets: pgCommandBudgets,
        shape: pgTragwerkPlayerCutBounds
      });
      result = applyStructuralDestructionCommand(live, command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid PG destroy command.";
      lastError = message;
      return {
        status: "Rejected",
        code: "InvalidContract",
        message,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: PG_TRAGWERK_PLAYER_OBJECT_ID,
        objectRevision: live.objectRevision,
        contentHash: live.contentHash,
        cellsBefore: before.cells,
        cellsAfter: before.cells,
        massBeforeKg: before.massKg,
        massAfterKg: before.massKg,
        bodiesBefore: 0,
        bodiesAfter: 0,
        collidersBefore: 0,
        collidersAfter: 0,
        anchoredColliderCount: 0,
        fragmentCount: 0,
        regionSaveHash: ""
      };
    }
    if (result.status === "Rejected") {
      lastError = `${result.code} at ${result.path}.`;
      lastOutcome = {
        status: "Rejected",
        code: result.code,
        message: lastError,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: result.object.objectId,
        objectRevision: result.object.objectRevision,
        contentHash: result.object.contentHash,
        cellsBefore: before.cells,
        cellsAfter: before.cells,
        massBeforeKg: before.massKg,
        massAfterKg: before.massKg,
        bodiesBefore: 0,
        bodiesAfter: 0,
        collidersBefore: 0,
        collidersAfter: 0,
        anchoredColliderCount: 0,
        fragmentCount: 0,
        regionSaveHash: lastOutcome?.regionSaveHash ?? ""
      };
      return lastOutcome;
    }
    if (result.status === "NoChange") {
      lastError = "NoChange: the canonical cut selected no occupied cell.";
      lastOutcome = {
        status: "NoChange",
        code: "NoChange",
        message: lastError,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: result.object.objectId,
        objectRevision: result.object.objectRevision,
        contentHash: result.object.contentHash,
        cellsBefore: before.cells,
        cellsAfter: before.cells,
        massBeforeKg: before.massKg,
        massAfterKg: before.massKg,
        bodiesBefore: 0,
        bodiesAfter: 0,
        collidersBefore: 0,
        collidersAfter: 0,
        anchoredColliderCount: 0,
        fragmentCount: 0,
        regionSaveHash: lastOutcome?.regionSaveHash ?? ""
      };
      return lastOutcome;
    }
    try {
      const next = result.object;
      const after = massOf(next);
      const classification = deriveStructuralComponentClassification(next, pgConnectivityBudgets);
      const plan = deriveStructuralPhysicsTransition(
        next,
        classification,
        pgRestParentMotion,
        pgTransitionBudgets,
        pgComponentMassBudgets,
        "explicit"
      );
      if (plan.status !== "Installed") {
        throw new Error(`Physics transition not installed: ${plan.status}.`);
      }
      // Frischer Commit ohne Restore-Motions: kein persistierter Vorzustand,
      // Fragmente starten aus der Author-Geometrie in Ruhe.
      const harness = createCountingPort();
      const parentBody = harness.port.createBody({
        dynamic: true,
        translationMeters: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
        angvelRadPerSecond: { x: 0, y: 0, z: 0 }
      });
      const receipt = commitStructuralPhysicsTransition({ port: harness.port, parentBody, plan, live: next, classification });
      const artifact = encodeStructuralRegionSave({
        object: next,
        parentMotionSource: "explicit",
        parentMotion: {
          velocityMetersPerSecond: { ...pgRestParentMotion.velocityMetersPerSecond },
          angularVelocityRadPerSecond: { ...pgRestParentMotion.angularVelocityRadPerSecond }
        },
        motions: classification.fragments.map((fragment) => ({
          fragmentId: fragment.fragmentId,
          objectRevision: next.objectRevision,
          sourceContentHash: next.contentHash,
          translationMeters: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          linvelMetersPerSecond: { x: 0, y: 0, z: 0 },
          angvelRadPerSecond: { x: 0, y: 0, z: 0 }
        }))
      });
      const roundtrip = decodeStructuralRegionSave(artifact);
      if (roundtrip.saveHash !== JSON.parse(artifact).saveHash) {
        throw new Error("Region save roundtrip hash mismatch.");
      }
      object = next;
      applied = true;
      lastError = null;
      lastOutcome = {
        status: "Applied",
        code: "Applied",
        message: `Cut applied: ${before.cells}→${after.cells} cells, ${receipt.bodiesBefore}→${receipt.bodiesAfter} bodies.`,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: next.objectId,
        objectRevision: next.objectRevision,
        contentHash: next.contentHash,
        cellsBefore: before.cells,
        cellsAfter: after.cells,
        massBeforeKg: before.massKg,
        massAfterKg: after.massKg,
        bodiesBefore: receipt.bodiesBefore,
        bodiesAfter: receipt.bodiesAfter,
        collidersBefore: receipt.collidersBefore,
        collidersAfter: receipt.collidersAfter,
        anchoredColliderCount: receipt.anchoredColliderCount,
        fragmentCount: receipt.fragments.length,
        regionSaveHash: roundtrip.saveHash
      };
      appliedOutcome = lastOutcome;
      return lastOutcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : "PG commit boundary failed.";
      lastError = message;
      lastOutcome = {
        status: "Rejected",
        code: "CommitRejected",
        message,
        commandId: PG_TRAGWERK_PLAYER_COMMAND_ID,
        actor: PG_TRAGWERK_PLAYER_ACTOR,
        source: PG_TRAGWERK_PLAYER_SOURCE,
        objectId: live.objectId,
        objectRevision: live.objectRevision,
        contentHash: live.contentHash,
        cellsBefore: before.cells,
        cellsAfter: before.cells,
        massBeforeKg: before.massKg,
        massAfterKg: before.massKg,
        bodiesBefore: 0,
        bodiesAfter: 0,
        collidersBefore: 0,
        collidersAfter: 0,
        anchoredColliderCount: 0,
        fragmentCount: 0,
        regionSaveHash: lastOutcome?.regionSaveHash ?? ""
      };
      return lastOutcome;
    }
  };

  return { snapshot, destroy };
};
