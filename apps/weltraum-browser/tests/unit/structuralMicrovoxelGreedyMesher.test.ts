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
  isDeepFrozen,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
  STRUCTURAL_MESH_FACE_ORDER,
  STRUCTURAL_MESH_SCHEMA_VERSION,
  createStructuralObjectFromAdaptive,
  decodeStructuralObject,
  encodeStructuralObject,
  extractStructuralMeshData,
  hashStructuralObjectContent,
  validateStructuralVoxelState,
  type StructuralMeshProduct,
  type StructuralObject
} from "../../src/voxel/structural";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;
const keyAt = (x = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: frame.bodyId, surfaceFrameId: frame.surfaceFrameId, regionId: frame.regionId,
  generatorVersion: frame.generatorVersion, level: 4, originQuantum: { x, y: 0, z: 0 }
});
type CellSeed = Readonly<{ x: number; y?: number; z?: number; materialId?: number; semanticKey?: string }>;
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly CellSeed[] }>;

const objectFixture = (bricks: readonly BrickSeed[]): StructuralObject => {
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1", identity: stableAuthorityId("base.mesh"), version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1), sample: { density: 0, occupancy: 0, materialId: null }
  });
  const records: AdaptiveEditInput[] = [];
  for (const brick of bricks) for (const cell of brick.cells) {
    const index = records.length;
    const min = { x: brick.key.originQuantum.x + cell.x, y: cell.y ?? 0, z: cell.z ?? 0 };
    records.push({
      editId: `edit.${String(index + 1).padStart(4, "0")}`, sequence: index + 1,
      expectedRegionRevision: index, resultRegionRevision: index + 1,
      actorId: "actor.fixture", sourceId: "source.fixture", operation: "AddBox",
      box: { min, max: { x: min.x + 1, y: min.y + 1, z: min.z + 1 } },
      materialId: `material.${cell.materialId ?? 1}`, semanticId: cell.semanticKey ?? "semantic.hull"
    });
  }
  const editJournal = createAdaptiveEditJournal(records);
  const adaptiveBricks = bricks.map((brick) => materializeAdaptiveBrick({ key: brick.key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const resident = adaptiveBricks.map((brick) => ({
    key: brick.key, readiness: "ready" as const, byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES, work: ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash: brick.contentHash, provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest, journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision, editRevision: brick.editRevision, brickRevision
  }));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId), surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId), generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(1), resident, activeCoverage: [], refinementRequests: [],
    budgets: { maxBricks: 8, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  return createStructuralObjectFromAdaptive({
    objectId: "object.mesh", frame, authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot: { ...draft, resident: resident.map((entry, index) => ({ ...entry, validationProof: proofs[index] })) },
    materials: [
      { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: null },
      { materialId: 2, densityKgPerCubicMeter: 512, structuralClass: "metal", destructible: true, tags: null }
    ],
    materialBindings: [1, 2].map((materialId) => ({ adaptiveMaterialId: `material.${materialId}`, structuralMaterialId: materialId })),
    bricks: adaptiveBricks, anchors: [], joints: [], objectRevision: 0, editRevision: 0, commandEvidence: []
  });
};

const produced = (object: StructuralObject): StructuralMeshProduct => {
  const result = extractStructuralMeshData(object, { maxVisitedCells: 64, maxQuads: 128, maxVertices: 512, maxIndices: 768 });
  if (result.status === "Rejected") throw new Error(`Expected mesh, received ${result.code}.`);
  return result.product;
};

const withPersistedMetadata = (object: StructuralObject, overrides: Readonly<Record<string, unknown>>): StructuralObject => {
  const projection: {
    bricks: Array<{ cells: Array<{ state: Record<string, unknown> }> }>;
    contentHash: string;
  } = JSON.parse(encodeStructuralObject(object));
  const candidate: StructuralObject = {
    ...object,
    bricks: object.bricks.map((brick, brickIndex) => brickIndex === 0 ? {
      ...brick,
      cells: brick.cells.map((cell, cellIndex) => cellIndex === 1 ? {
        ...cell,
        state: validateStructuralVoxelState({ ...cell.state, ...overrides })
      } : cell)
    } : brick)
  };
  projection.bricks[0].cells[1].state = { ...projection.bricks[0].cells[1].state, ...overrides };
  projection.contentHash = hashStructuralObjectContent(candidate);
  return decodeStructuralObject(canonicalAdaptiveJson(projection));
};

describe("Structural Microvoxel greedy mesher", () => {
  it("emits deterministic exposed-face order, culls internal and cross-brick seam faces, and freezes arrays and hashes", () => {
    const single = produced(objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }] }]));
    expect(STRUCTURAL_MESH_FACE_ORDER).toEqual(["-x", "+x", "-y", "+y", "-z", "+z"]);
    expect(single.schemaVersion).toBe(STRUCTURAL_MESH_SCHEMA_VERSION);
    expect(single.algorithmVersion).toBe(STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION);
    expect(single.positions).toHaveLength(6 * 4 * 3);
    expect(single.indices).toHaveLength(6 * 6);
    expect(Array.from({ length: 6 }, (_, faceIndex) => single.normals.slice(faceIndex * 12, faceIndex * 12 + 3))).toEqual([
      [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]
    ]);
    expect(isDeepFrozen(single)).toBe(true);
    expect(Object.isFrozen(single.positions)).toBe(true);
    expect(produced(objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }] }])).contentHash).toBe(single.contentHash);

    const adjacent = produced(objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 1 }] }]));
    expect(adjacent.positions).toHaveLength(6 * 4 * 3);
    expect(adjacent.indices).toHaveLength(6 * 6);
    const acrossSeam = produced(objectFixture([
      { key: keyAt(16), cells: [{ x: 0, y: 1, z: 1 }] },
      { key: keyAt(), cells: [{ x: 15, y: 1, z: 1 }] }
    ]));
    expect(acrossSeam.positions).toHaveLength(24 * 3);
    expect(acrossSeam.indices).toHaveLength(6 * 6);
  });

  it("checks every approved mesh budget before output and fails closed for missing neighbor coverage", () => {
    const twoCells = objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 1 }] }]);
    const single = objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }] }]);
    const budgetCases = [
      [twoCells, { maxVisitedCells: 1, maxQuads: 64, maxVertices: 256, maxIndices: 384 }],
      [single, { maxVisitedCells: 1, maxQuads: 5, maxVertices: 256, maxIndices: 384 }],
      [single, { maxVisitedCells: 1, maxQuads: 6, maxVertices: 23, maxIndices: 384 }],
      [single, { maxVisitedCells: 1, maxQuads: 6, maxVertices: 24, maxIndices: 35 }]
    ] as const;
    expect(Object.keys(budgetCases[0][1])).toEqual(["maxVisitedCells", "maxQuads", "maxVertices", "maxIndices"]);
    for (const [object, budgets] of budgetCases) {
      const result = extractStructuralMeshData(object, budgets);
      expect(result).toEqual({ status: "Rejected", code: "BudgetExceeded", missingNeighborKey: null });
      expect("product" in result).toBe(false);
    }
    const missing = extractStructuralMeshData(objectFixture([{ key: keyAt(), cells: [{ x: 15 }] }]), {
      maxVisitedCells: 4, maxQuads: 16, maxVertices: 64, maxIndices: 96
    });
    expect(missing.status).toBe("Rejected");
    if (missing.status === "Rejected") {
      expect(missing.code).toBe("MissingNeighborCoverage");
      expect(missing.missingNeighborKey?.originQuantum.x).toBe(16);
    }
    expect("product" in missing).toBe(false);
  });

  it("does not merge otherwise coplanar faces across material, part, semantic, or damage metadata keys", () => {
    const base = objectFixture([{ key: keyAt(), cells: [{ x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 1 }] }]);
    const discriminatorCases = [
      ["material", { materialId: 2 }],
      ["part", { partId: "part.other" }],
      ["semantic", { semanticKey: "semantic.other" }],
      ["damage", { damageKey: "damage.hit" }]
    ] as const;
    for (const [discriminator, state] of discriminatorCases) {
      const object = withPersistedMetadata(base, state);
      const first = produced(object);
      const second = produced(withPersistedMetadata(base, state));
      expect(first.positions).toHaveLength(10 * 4 * 3);
      expect(first.indices).toHaveLength(10 * 6);
      expect(first.contentHash, discriminator).toBe(second.contentHash);

      if (discriminator === "material") {
        expect(first.schemaVersion).toBe(STRUCTURAL_MESH_SCHEMA_VERSION);
        expect(first.algorithmVersion).toBe(STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION);
        expect(first.materialRanges).toEqual([
          { materialId: 1, firstIndex: 0, indexCount: 6 },
          { materialId: 2, firstIndex: 6, indexCount: 6 },
          { materialId: 1, firstIndex: 12, indexCount: 6 },
          { materialId: 2, firstIndex: 18, indexCount: 6 },
          { materialId: 1, firstIndex: 24, indexCount: 6 },
          { materialId: 2, firstIndex: 30, indexCount: 6 },
          { materialId: 1, firstIndex: 36, indexCount: 6 },
          { materialId: 2, firstIndex: 42, indexCount: 6 },
          { materialId: 1, firstIndex: 48, indexCount: 6 },
          { materialId: 2, firstIndex: 54, indexCount: 6 }
        ]);
        expect(first.boundsMeters).toEqual({
          min: { x: 0.125, y: 0.125, z: 0.125 },
          max: { x: 0.375, y: 0.25, z: 0.25 }
        });
        expect(first.sourceRevision).toBe(object.objectRevision);
        expect(first.sourceContentHash).toBe(object.contentHash);
        expect(first.contentHash).toBe(second.contentHash);
        expect(first.contentHash).not.toBe(produced(base).contentHash);
      }
    }
  });
});
