import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SOURCE_REVISION_V1
} from "../../src/world-generation/hestia";
import {
  SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  reconstructSurfaceRegionVoxelAuthority,
  surfaceVoxelBrickKey,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceVoxelEditIntent
} from "../../src/surface-play/voxel-edit";

const authorityInput = (
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

const intent = (
  editId: string,
  centerGlobalQuantum: Readonly<{ x: number; y: number; z: number }>,
  expectedRegionRevision = 0
): SurfaceVoxelEditIntent => ({
  schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  editId,
  expectedRegionRevision,
  tick: expectedRegionRevision + 1,
  actorId: "actor:surface-player",
  sourceId: "weapon:pulse-cutter",
  sourceImpactIntentId: `impact:${editId}`,
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  regionId: "region:hestia.surface-play",
  operation: "SubtractSphere",
  centerGlobalQuantum,
  quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  radiusMeters: 1
});

describe("SurfaceRegionVoxelAuthority V1", () => {
  it("reconstructs equal Hestia base inputs to equal region and voxel hashes", { timeout: 30_000 }, () => {
    const first = createSurfaceRegionVoxelAuthority(authorityInput());
    const second = createSurfaceRegionVoxelAuthority(authorityInput());

    expect(first.state).toEqual(second.state);
    expect(first.state.currentVoxelContentHash).toBe(second.state.currentVoxelContentHash);
    expect(first.state.currentRegionContentHash).toBe(second.state.currentRegionContentHash);
    expect(first.state.materializedBricks.map((brick) => brick.contentHash))
      .toEqual(second.state.materializedBricks.map((brick) => brick.contentHash));
  });

  it("publishes frozen plain state and defensive materialized VoxelBrick copies", { timeout: 20_000 }, () => {
    const authority = createSurfaceRegionVoxelAuthority(authorityInput());
    const key = surfaceVoxelBrickKey({ x: 0, y: -1, z: 0 });
    const first = authority.materializeBrick(key)!;
    const originalDensity = first.voxelBrick.densityBuffer[0];
    first.voxelBrick.densityBuffer[0] = Math.fround(originalDensity + 100);
    const second = authority.materializeBrick(key)!;

    expect(Object.isFrozen(authority)).toBe(true);
    expect(Object.isFrozen(authority.state)).toBe(true);
    expect(Object.isFrozen(authority.state.brickBounds)).toBe(true);
    expect(Object.isFrozen(authority.state.materializedBricks)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(second.voxelBrick.densityBuffer[0]).toBe(originalDensity);
    expect(second.voxelBrick.contentHash).toBe(first.voxelBrick.contentHash);
  });

  it("replays the immutable ordered journal and never aliases an old revision", { timeout: 30_000 }, () => {
    const base = createSurfaceRegionVoxelAuthority(authorityInput());
    const aThenBFirst = applySurfaceVoxelEdit(base, intent("edit:a", { x: 64, y: -64, z: 64 }));
    expect(aThenBFirst.result.status).toBe("Applied");
    const aThenB = applySurfaceVoxelEdit(
      aThenBFirst.authority,
      intent("edit:b", { x: 192, y: -64, z: 64 }, 1)
    );
    const bThenAFirst = applySurfaceVoxelEdit(base, intent("edit:b", { x: 192, y: -64, z: 64 }));
    const bThenA = applySurfaceVoxelEdit(
      bThenAFirst.authority,
      intent("edit:a", { x: 64, y: -64, z: 64 }, 1)
    );

    expect(aThenB.state.regionRevision).toBe(2);
    expect(aThenB.state.editRevision).toBe(2);
    expect(aThenB.state.currentRegionContentHash).not.toBe(base.state.currentRegionContentHash);
    expect(aThenB.state.currentRegionContentHash).not.toBe(bThenA.state.currentRegionContentHash);
    expect(aThenB.state.editJournal.map((record) => record.editId)).toEqual(["edit:a", "edit:b"]);
    expect(Object.isFrozen(aThenB.state.editJournal)).toBe(true);
    expect(Object.isFrozen(aThenB.state.editJournal[0])).toBe(true);

    const reconstructed = reconstructSurfaceRegionVoxelAuthority(aThenB.state);
    expect(reconstructed.state).toEqual(aThenB.state);
  });

  it("contains no time, randomness, DOM, renderer, or Three.js dependency", () => {
    const directory = join(process.cwd(), "src", "surface-play", "voxel-edit");
    const source = readdirSync(directory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(directory, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/\bDate\b/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\b(document|window|HTMLElement|WebGLRenderer)\b/);
    expect(source).not.toMatch(/from\s+["']three/);
  });
});
