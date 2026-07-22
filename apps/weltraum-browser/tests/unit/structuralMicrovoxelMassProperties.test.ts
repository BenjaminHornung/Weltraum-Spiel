import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  authorityRevision,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  isDeepFrozen,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  StructuralValidationError,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  deriveStructuralComponentMassProperties,
  deriveStructuralObjectMassProperties
} from "../../src/voxel/structural";

type OccupiedCell = Readonly<{ x: number; y?: number; z?: number }>;

const objectFixture = (occupiedCells: readonly OccupiedCell[]) => {
  const frame = {
    schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
    bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1",
    objectOriginQuantum: { x: 0, y: 0, z: 0 }
  } as const;
  const key = createAdaptiveBrickKey({
    bodyId: frame.bodyId, surfaceFrameId: frame.surfaceFrameId, regionId: frame.regionId,
    generatorVersion: frame.generatorVersion, level: 4, originQuantum: { x: 0, y: 0, z: 0 }
  });
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1", identity: stableAuthorityId("base.mass"), version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1), sample: { density: 0, occupancy: 0, materialId: null }
  });
  const edits: AdaptiveEditInput[] = occupiedCells.map((cell, index) => ({
    editId: `edit.${index + 1}`, sequence: index + 1, expectedRegionRevision: index, resultRegionRevision: index + 1,
    actorId: "actor.fixture", sourceId: "source.fixture", operation: "AddBox",
    box: {
      min: { x: cell.x, y: cell.y ?? 0, z: cell.z ?? 0 },
      max: { x: cell.x + 1, y: (cell.y ?? 0) + 1, z: (cell.z ?? 0) + 1 }
    }, materialId: "material.hull"
  }));
  const editJournal = createAdaptiveEditJournal(edits);
  const brick = materializeAdaptiveBrick({ key, baseField, editJournal });
  const brickRevision = authorityRevision(0);
  const resident = {
    key, readiness: "ready" as const, byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES, work: ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash: brick.contentHash, provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest, journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision, editRevision: brick.editRevision, brickRevision
  };
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId), surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId), generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(1), resident: [resident], activeCoverage: [], refinementRequests: [],
    budgets: { maxBricks: 1, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const [validationProof] = createAdaptiveResidentValidationProofs({ bricks: [brick], brickRevision, snapshot: draft });
  return createStructuralObjectFromAdaptive({
    objectId: "object.mass", frame, authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot: { ...draft, resident: [{ ...resident, validationProof }] },
    materials: [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: null }],
    materialBindings: [{ adaptiveMaterialId: "material.hull", structuralMaterialId: 1 }], bricks: [brick],
    anchors: [], joints: [], objectRevision: 0, editRevision: 0, commandEvidence: []
  });
};

const asymmetricNonCoplanarObjectFixture = () => objectFixture([
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
  { x: 2, y: 0, z: 1 },
  { x: 0, y: 2, z: 3 }
]);

describe("Structural Microvoxel mass properties", () => {
  it("stops object-address collection before reading the first cell beyond maxVisitedCells", () => {
    const object = objectFixture([{ x: 0 }, { x: 1 }]);
    let getterCalls = 0;
    const cells = [object.bricks[0].cells[0], object.bricks[0].cells[1]];
    Object.defineProperty(cells, "1", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return object.bricks[0].cells[1];
      }
    });
    const forged = {
      ...object,
      bricks: [{ ...object.bricks[0], cells }]
    } as typeof object;

    expect(() => deriveStructuralObjectMassProperties(forged, { maxVisitedCells: 1 }))
      .toThrowError(/explicit mass budget/);
    expect(getterCalls).toBe(0);
  });

  it("rejects oversized and accessor Component membership before canonical comparison", () => {
    const object = objectFixture([{ x: 0 }]);
    const [component] = deriveStructuralComponentClassification(object, {
      maxVisitedCells: 1,
      maxComponents: 1,
      maxIndexedFacts: 1
    }).components;
    const budgets = {
      maxVisitedCells: 1,
      maxConnectivityCells: 1,
      maxComponents: 1,
      maxConnectivityFacts: 1
    };
    let getterCalls = 0;
    const accessorCells: unknown[] = [];
    Object.defineProperty(accessorCells, "0", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return component.occupiedCells[0];
      }
    });
    const cases = [new Array(2), accessorCells];
    for (const occupiedCells of cases) {
      try {
        deriveStructuralComponentMassProperties(object, { ...component, occupiedCells } as typeof component, budgets);
        throw new Error("Expected invalid Component membership.");
      } catch (error) {
        expect(error).toBeInstanceOf(StructuralValidationError);
        if (error instanceof StructuralValidationError) expect(error.path).toMatch(/^component\/occupiedCells/);
      }
    }
    expect(getterCalls).toBe(0);
  });

  it("derives analytical mass, COM, bounds, full inertia, and deterministic empty semantics", () => {
    const mass = deriveStructuralObjectMassProperties(objectFixture([{ x: 0 }, { x: 1 }]), { maxVisitedCells: 2 });
    expect(mass.totalMassKg).toBe(2);
    expect(mass.occupiedVoxelCount).toBe(2);
    expect(mass.centerOfMassMeters).toEqual({ x: 0.125, y: 0.0625, z: 0.0625 });
    expect(mass.boundsMeters).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 0.25, y: 0.125, z: 0.125 } });
    expect(mass.inertiaTensorKgMetersSquared.xx).toBeCloseTo(1 / 192, 15);
    expect(mass.inertiaTensorKgMetersSquared.yy).toBeCloseTo(5 / 384, 15);
    expect(mass.inertiaTensorKgMetersSquared.zz).toBeCloseTo(5 / 384, 15);
    expect(mass.inertiaTensorKgMetersSquared.xy).toBe(0);
    expect(mass.inertiaTensorKgMetersSquared.xz).toBe(0);
    expect(mass.inertiaTensorKgMetersSquared.yz).toBe(0);
    expect(Object.values(mass.inertiaTensorKgMetersSquared).every(Number.isFinite)).toBe(true);
    expect(isDeepFrozen(mass)).toBe(true);

    const emptyObject = objectFixture([]);
    const emptyA = deriveStructuralObjectMassProperties(emptyObject, { maxVisitedCells: 1 });
    const emptyB = deriveStructuralObjectMassProperties(emptyObject, { maxVisitedCells: 1 });
    expect(emptyA).toMatchObject({ totalMassKg: 0, centerOfMassMeters: null, boundsMeters: null, occupiedVoxelCount: 0 });
    expect(emptyA.inertiaTensorKgMetersSquared).toEqual({ xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 });
    expect(emptyB.contentHash).toBe(emptyA.contentHash);
  });

  it("revalidates Component identity, membership, content, revision, and Adaptive authority before deriving Component mass", () => {
    const object = objectFixture([{ x: 0 }, { x: 2 }]);
    const connectivityBudgets = { maxVisitedCells: 4, maxComponents: 4, maxIndexedFacts: 1 };
    const classification = deriveStructuralComponentClassification(object, connectivityBudgets);
    expect(classification.components).toHaveLength(2);
    const [component, other] = classification.components;
    const massBudgets = {
      maxVisitedCells: 4,
      maxConnectivityCells: 4,
      maxComponents: 4,
      maxConnectivityFacts: 1
    };
    const mass = deriveStructuralComponentMassProperties(object, component, massBudgets);
    expect(mass.occupiedVoxelCount).toBe(1);
    expect(mass.sourceContentHash).toBe(object.contentHash);

    const forgedIdentity = { ...component, componentId: other.componentId };
    const forgedMembership = { ...component, occupiedCells: other.occupiedCells, smallestOccupiedCellKey: other.smallestOccupiedCellKey };
    const forgedContent = { ...component, componentContentHash: other.componentContentHash };
    const forgedRevision = { ...component, objectRevision: (component.objectRevision + 1) as typeof component.objectRevision };
    const forgedAuthority = { ...component, sourceAdaptiveAuthorityDigest: "fnv1a64-v1:0000000000000401" };
    for (const forged of [forgedIdentity, forgedMembership, forgedContent, forgedRevision, forgedAuthority]) {
      expect(() => deriveStructuralComponentMassProperties(object, forged, massBudgets))
        .toThrowError(/freshly derived canonical Component/);
    }
  });
  it("uses an analytical asymmetric non-coplanar oracle for all signed cross terms", () => {
    const mass = deriveStructuralObjectMassProperties(asymmetricNonCoplanarObjectFixture(), { maxVisitedCells: 4 });

    // Four unit-mass cells at (0,0,0), (1,1,1), (2,0,1), and (0,2,3)
    // have COM (5/32, 5/32, 7/32) metres. With side = 1/8 m, the
    // parallel-axis sums give Ixy = 5/256, Ixz = 3/256, and Iyz = -13/256;
    // the cube diagonal term is m * side^2 / 6 = 1/384 per cell.
    expect(mass.totalMassKg).toBe(4);
    expect(mass.occupiedVoxelCount).toBe(4);
    expect(mass.centerOfMassMeters).toEqual({ x: 5 / 32, y: 5 / 32, z: 7 / 32 });
    expect(mass.boundsMeters).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 3 / 8, y: 3 / 8, z: 1 / 2 }
    });
    expect(mass.inertiaTensorKgMetersSquared.xx).toBeCloseTo(49 / 384, 15);
    expect(mass.inertiaTensorKgMetersSquared.yy).toBeCloseTo(49 / 384, 15);
    expect(mass.inertiaTensorKgMetersSquared.zz).toBeCloseTo(37 / 384, 15);
    expect(mass.inertiaTensorKgMetersSquared.xy).toBeCloseTo(5 / 256, 15);
    expect(mass.inertiaTensorKgMetersSquared.xz).toBeCloseTo(3 / 256, 15);
    expect(mass.inertiaTensorKgMetersSquared.yz).toBeCloseTo(-13 / 256, 15);
  });
});
