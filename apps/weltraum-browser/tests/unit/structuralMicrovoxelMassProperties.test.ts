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
  createStructuralObjectFromAdaptive,
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
