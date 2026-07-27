import { beforeAll, describe, expect, it } from "vitest";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SOURCE_REVISION_V1
} from "../../src/world-generation/hestia";
import {
  VOXEL_BRICK_CELL_COUNT,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  storedSampleToGlobalCoordinate,
  voxelSampleIndex
} from "../../src/voxel";
import {
  SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  createSurfaceVoxelRemeshPlan,
  surfaceVoxelBrickKey,
  type SurfaceRegionVoxelAuthority,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceVoxelEditIntent
} from "../../src/surface-play/voxel-edit";

const fullInput = (
  overrides: Partial<SurfaceRegionVoxelAuthorityInput> = {}
): SurfaceRegionVoxelAuthorityInput => ({
  schemaVersion: SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  regionId: "region:hestia.surface-play",
  generatorVersion: HESTIA_GENERATOR_VERSION_V1,
  seed: "hestia-surface-impact-fixture",
  voxelSizeMeters: 0.5,
  sourceRevision: HESTIA_SOURCE_REVISION_V1,
  brickBounds: {
    minInclusive: { x: 0, y: -1, z: 0 },
    maxExclusive: { x: 2, y: 0, z: 1 }
  },
  residentBrickCoordinates: [{ x: 0, y: -1, z: 0 }, { x: 1, y: -1, z: 0 }],
  maxSubtractRadiusMeters: 2,
  maxChangedSamplesPerEdit: 20_000,
  ...overrides
});

const editIntent = (
  overrides: Partial<SurfaceVoxelEditIntent> = {}
): SurfaceVoxelEditIntent => ({
  schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  editId: "edit:seam-impact",
  expectedRegionRevision: 0,
  tick: 10,
  actorId: "actor:surface-player",
  sourceId: "weapon:pulse-cutter",
  sourceImpactIntentId: "impact:pulse-cutter:10",
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  regionId: "region:hestia.surface-play",
  operation: "SubtractSphere",
  centerGlobalQuantum: { x: 128, y: -64, z: 64 },
  quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  radiusMeters: 1,
  ...overrides
});

const binding = (authority: SurfaceRegionVoxelAuthority) => ({
  bodyId: authority.state.bodyId,
  regionId: authority.state.regionId,
  surfaceFrameId: authority.state.surfaceFrameId,
  expectedRegionRevision: authority.state.regionRevision
});

let base: SurfaceRegionVoxelAuthority;

beforeAll(() => {
  base = createSurfaceRegionVoxelAuthority(fullInput());
}, 20_000);

describe("Hestia SurfaceRegion SubtractSphere edits", () => {
  it("applies deterministically, removes solid density, and clears removed material", () => {
    const first = applySurfaceVoxelEdit(base, editIntent());
    const second = applySurfaceVoxelEdit(base, editIntent());

    expect(first.result).toEqual(second.result);
    expect(first.state).toEqual(second.state);
    expect(first.result.status).toBe("Applied");
    expect(first.result.changedBrickKeys).toEqual([
      surfaceVoxelBrickKey({ x: 0, y: -1, z: 0 }),
      surfaceVoxelBrickKey({ x: 1, y: -1, z: 0 })
    ]);

    const collision = createSurfaceRegionVoxelCollisionAdapter(first.authority);
    const center = { x: 16, y: -8, z: 8 };
    const sample = collision.sampleDensity(binding(first.authority), center);
    expect(sample.status).toBe("Resolved");
    if (sample.status === "Resolved") {
      expect(sample.classification).toBe("Air");
      expect(sample.density).toBeGreaterThan(0);
      expect(sample.materialValue).toBe(0);
      expect(sample.regionRevision).toBe(first.state.regionRevision);
      expect(sample.editRevision).toBe(first.state.editRevision);
    }
  });

  it("keeps shared apron samples byte-identical and plans exact seam refresh work", () => {
    const transition = applySurfaceVoxelEdit(base, editIntent());
    expect(transition.result.status).toBe("Applied");
    const left = transition.authority.materializeBrick(surfaceVoxelBrickKey({ x: 0, y: -1, z: 0 }))!.voxelBrick;
    const right = transition.authority.materializeBrick(surfaceVoxelBrickKey({ x: 1, y: -1, z: 0 }))!.voxelBrick;

    for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
      for (let z = 0; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z; z += 1) {
        const leftIndex = voxelSampleIndex({ x: 33, y, z });
        const rightIndex = voxelSampleIndex({ x: 1, y, z });
        expect(left.densityBuffer[leftIndex]).toBe(right.densityBuffer[rightIndex]);
        expect(left.materialBuffer[leftIndex]).toBe(right.materialBuffer[rightIndex]);
      }
    }

    const plan = createSurfaceVoxelRemeshPlan(transition.result, {
      bodyId: transition.state.bodyId,
      regionId: transition.state.regionId,
      surfaceFrameId: transition.state.surfaceFrameId,
      regionRevision: transition.state.regionRevision,
      editRevision: transition.state.editRevision,
      residentBrickKeys: transition.state.materializedBricks.map((brick) => brick.key),
      maxRemeshBricks: 4,
      maxEstimatedCellWork: VOXEL_BRICK_CELL_COUNT * 4
    });
    expect(plan.status).toBe("Planned");
    if (plan.status === "Planned") {
      expect(plan.changedBrickKeys).toEqual(transition.result.changedBrickKeys);
      expect(plan.seamNeighborKeys).toEqual([
        surfaceVoxelBrickKey({ x: 0, y: -1, z: 0 }),
        surfaceVoxelBrickKey({ x: 1, y: -1, z: 0 })
      ]);
      expect(plan.orderedRemeshKeys).toEqual(transition.result.requiredRemeshKeys);
      expect(plan.expectedRegionRevision).toBe(1);
      expect(plan.expectedEditRevision).toBe(1);
    }
  });

  it("replaces a removed non-air material channel value with canonical air storage", () => {
    const candidate = base.state.materializedBricks
      .map((descriptor) => base.materializeBrick(descriptor.key)!)
      .flatMap((entry) => {
        const matches: Array<{ global: Readonly<{ x: number; y: number; z: number }>; material: number }> = [];
        for (let z = 2; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z - 2 && matches.length === 0; z += 1) {
          for (let y = 2; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y - 2 && matches.length === 0; y += 1) {
            for (let x = 2; x < VOXEL_BRICK_SAMPLE_DIMENSIONS.x - 2; x += 1) {
              const stored = { x, y, z };
              const index = voxelSampleIndex(stored);
              if (entry.voxelBrick.densityBuffer[index] <= 0 && entry.voxelBrick.materialBuffer[index] > 0) {
                matches.push({
                  global: storedSampleToGlobalCoordinate(entry.coordinate, stored),
                  material: entry.voxelBrick.materialBuffer[index]
                });
                break;
              }
            }
          }
        }
        return matches;
      })[0];
    expect(candidate).toBeDefined();
    expect(candidate.material).toBeGreaterThan(0);
    const transition = applySurfaceVoxelEdit(base, editIntent({
      editId: "edit:material-cleanup",
      sourceImpactIntentId: "impact:material-cleanup",
      centerGlobalQuantum: {
        x: candidate.global.x * 4,
        y: candidate.global.y * 4,
        z: candidate.global.z * 4
      },
      radiusMeters: 0.25
    }));
    expect(transition.result.status).toBe("Applied");
    const sample = createSurfaceRegionVoxelCollisionAdapter(transition.authority).sampleDensity(
      binding(transition.authority),
      { x: candidate.global.x * 0.5, y: candidate.global.y * 0.5, z: candidate.global.z * 0.5 }
    );
    expect(sample).toMatchObject({ status: "Resolved", classification: "Air", materialValue: 0 });
  });

  it("returns journaled NoChange without changing voxel/edit/materialization revisions", () => {
    const transition = applySurfaceVoxelEdit(base, editIntent({
      editId: "edit:empty-air",
      sourceImpactIntentId: "impact:empty-air",
      centerGlobalQuantum: { x: 64, y: -4, z: 64 },
      radiusMeters: 0.125
    }));

    expect(transition.result.status).toBe("NoChange");
    expect(transition.state.regionRevision).toBe(1);
    expect(transition.state.planningRevision).toBe(1);
    expect(transition.state.editRevision).toBe(0);
    expect(transition.state.materializationRevision).toBe(0);
    expect(transition.state.currentVoxelContentHash).toBe(base.state.currentVoxelContentHash);
    expect(transition.state.currentRegionContentHash).not.toBe(base.state.currentRegionContentHash);
    expect(transition.state.editJournal.at(-1)?.outcome).toBe("NoChange");
  });

  it("rejects stale, duplicate, wrong-frame, outside, clipping, missing-coverage, budget, and renderer-shaped inputs atomically", () => {
    const applied = applySurfaceVoxelEdit(base, editIntent());
    expect(applied.result.status).toBe("Applied");
    const cases = [
      applySurfaceVoxelEdit(base, editIntent({ editId: "edit:stale", expectedRegionRevision: 1 })),
      applySurfaceVoxelEdit(applied.authority, editIntent({ expectedRegionRevision: 1 })),
      applySurfaceVoxelEdit(base, editIntent({ editId: "edit:frame", surfaceFrameId: "frame:wrong" })),
      applySurfaceVoxelEdit(base, editIntent({ editId: "edit:outside", centerGlobalQuantum: { x: -1, y: -64, z: 64 } })),
      applySurfaceVoxelEdit(base, editIntent({ editId: "edit:clip", centerGlobalQuantum: { x: 2, y: -64, z: 64 } })),
      applySurfaceVoxelEdit(
        createSurfaceRegionVoxelAuthority(fullInput({ residentBrickCoordinates: [{ x: 0, y: -1, z: 0 }] })),
        editIntent({ editId: "edit:coverage", centerGlobalQuantum: { x: 124, y: -64, z: 64 } })
      ),
      applySurfaceVoxelEdit(
        createSurfaceRegionVoxelAuthority(fullInput({ maxChangedSamplesPerEdit: 1 })),
        editIntent({ editId: "edit:budget" })
      ),
      applySurfaceVoxelEdit(base, { ...editIntent({ editId: "edit:renderer" }), mesh: {} } as unknown as SurfaceVoxelEditIntent)
    ];
    const reasons = cases.map((entry) => entry.result.status === "Rejected" ? entry.result.reason : "not-rejected");

    expect(reasons).toEqual([
      "StaleRevision",
      "DuplicateEditId",
      "FrameMismatch",
      "OutsideRegion",
      "RegionBoundaryClipping",
      "MissingCoverage",
      "BudgetExceeded",
      "InvalidInput"
    ]);
    for (const transition of cases) {
      expect(transition.result.status).toBe("Rejected");
      expect(transition.authority.state.regionRevision).toBe(transition.result.priorRegionRevision);
      expect(transition.state.currentRegionContentHash).toBe(transition.result.priorRegionHash);
      expect(transition.result.changedBrickKeys).toEqual([]);
    }
  });

  it("rejects a remesh plan when seam coverage or budget is missing", () => {
    const transition = applySurfaceVoxelEdit(base, editIntent());
    const common = {
      bodyId: transition.state.bodyId,
      regionId: transition.state.regionId,
      surfaceFrameId: transition.state.surfaceFrameId,
      regionRevision: transition.state.regionRevision,
      editRevision: transition.state.editRevision,
      maxRemeshBricks: 4,
      maxEstimatedCellWork: VOXEL_BRICK_CELL_COUNT * 4
    };
    expect(createSurfaceVoxelRemeshPlan(transition.result, {
      ...common,
      residentBrickKeys: [transition.result.changedBrickKeys[0]]
    })).toMatchObject({ status: "Rejected", reason: "MissingCoverage" });
    expect(createSurfaceVoxelRemeshPlan(transition.result, {
      ...common,
      residentBrickKeys: transition.state.materializedBricks.map((brick) => brick.key),
      maxRemeshBricks: 1
    })).toMatchObject({ status: "Rejected", reason: "BudgetExceeded" });
  });

  it("serves density, raycast, and ground queries from the edited revision rather than a mesh", () => {
    const center = { x: 16, y: -8, z: 8 };
    const beforeAdapter = createSurfaceRegionVoxelCollisionAdapter(base);
    const beforeSample = beforeAdapter.sampleSolidAir(binding(base), center);
    const beforeRay = beforeAdapter.raycast({
      ...binding(base),
      originMeters: center,
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: 4,
      maxSteps: 64
    });
    expect(beforeSample).toMatchObject({ status: "Resolved", classification: "Solid" });
    expect(beforeRay).toMatchObject({ status: "Resolved", hit: { distanceMeters: 0 } });

    const transition = applySurfaceVoxelEdit(base, editIntent());
    const afterAdapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);
    const afterRay = afterAdapter.raycast({
      ...binding(transition.authority),
      originMeters: center,
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: 4,
      maxSteps: 64
    });
    const ground = afterAdapter.queryGround({
      ...binding(transition.authority),
      positionMeters: center,
      maximumDistanceMeters: 4,
      maxSteps: 64
    });

    expect(afterRay.status).toBe("Resolved");
    expect(ground.status).toBe("Resolved");
    if (afterRay.status === "Resolved" && afterRay.hit !== null) {
      expect(afterRay.hit.distanceMeters).toBeGreaterThan(0);
      expect(afterRay.regionRevision).toBe(1);
      expect(afterRay.editRevision).toBe(1);
    }
    expect(ground).toEqual(afterRay);
    expect(afterAdapter.sampleDensity({ ...binding(transition.authority), expectedRegionRevision: 0 }, center))
      .toMatchObject({ status: "Rejected", reason: "StaleRevision" });
  });

  it("preserves caller inputs", () => {
    const input = editIntent({ editId: "edit:immutable-input" });
    const snapshot = JSON.stringify(input);
    applySurfaceVoxelEdit(base, input);
    expect(JSON.stringify(input)).toBe(snapshot);

    const brick = base.materializeBrick(surfaceVoxelBrickKey({ x: 0, y: -1, z: 0 }))!.voxelBrick;
    const stored = { x: 10, y: 40, z: 10 };
    const global = storedSampleToGlobalCoordinate(brick.brickCoordinate, stored);
    expect(voxelSampleIndex(stored)).toBeGreaterThanOrEqual(0);
    expect(global).toEqual({
      x: brick.brickCoordinate.x * 32 + stored.x - 1,
      y: brick.brickCoordinate.y * 64 + stored.y - 1,
      z: brick.brickCoordinate.z * 32 + stored.z - 1
    });
  });
});
