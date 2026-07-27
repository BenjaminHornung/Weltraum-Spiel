import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HESTIA_SURFACE_MATERIAL_PROFILES,
  createHestiaSurfacePresentationSnapshot,
  hestiaSurfaceMaterialProfileIdForKey,
  type HestiaSurfaceRegionPresentationSnapshotInput
} from "../../src/surface-play/environment";
import { createSurfaceTerrainPresentationSnapshot } from "../../src/surface-play/contracts";

const brickCoordinates = Object.freeze([
  { x: -1, y: -1, z: -1 },
  { x: 0, y: -1, z: -1 },
  { x: -1, y: -1, z: 0 },
  { x: 0, y: -1, z: 0 }
]);

const presentationInput = (
  overrides: Partial<HestiaSurfaceRegionPresentationSnapshotInput> = {}
): HestiaSurfaceRegionPresentationSnapshotInput => {
  const bricks = brickCoordinates.map((coordinate, index) => ({
    brickId: `brick:hestia:${index}`,
    coordinate,
    terrainHash: `terrain-hash:${index}`
  }));
  return {
    terrain: createSurfaceTerrainPresentationSnapshot({
      bodyId: "planet.hestia",
      regionId: "region:hestia.surface-play.v1",
      surfaceFrameId: "frame:surface_hestia_surface_play_v1",
      regionRevision: 7,
      visibleBrickIds: bricks.map((brick) => brick.brickId)
    }),
    rootSeed: "hestia-surface-play-v1",
    voxelSizeMeters: 0.5,
    bricks,
    ...overrides
  };
};

describe("Hestia surface presentation facts", () => {
  it("derives stable scatter, water and presentation identity from equal region facts", () => {
    const first = createHestiaSurfacePresentationSnapshot(presentationInput());
    const reversed = presentationInput();
    const second = createHestiaSurfacePresentationSnapshot({
      ...reversed,
      bricks: [...reversed.bricks].reverse()
    });

    expect(second).toEqual(first);
    expect(second.presentationSignature).toBe(first.presentationSignature);
    expect(first.scatter.length).toBeGreaterThan(0);
    expect(first.waterPatches.length).toBeGreaterThan(0);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.bricks)).toBe(true);
    expect(Object.isFrozen(first.scatter)).toBe(true);
    expect(Object.isFrozen(first.waterPatches)).toBe(true);
  });

  it("does not include camera pose or visibility toggles in the presentation signature", () => {
    const snapshot = createHestiaSurfacePresentationSnapshot(presentationInput());
    const camera = {
      position: { x: 0, y: 1.72, z: -4 },
      yawRadians: 0,
      pitchRadians: 0,
      fogEnabled: true,
      waterEnabled: true,
      vegetationEnabled: true
    };
    const signature = snapshot.presentationSignature;

    camera.position.x = 120;
    camera.position.y = 60;
    camera.yawRadians = Math.PI;
    camera.pitchRadians = -0.4;
    camera.fogEnabled = false;
    camera.waterEnabled = false;
    camera.vegetationEnabled = false;

    expect(snapshot.presentationSignature).toBe(signature);
  });

  it("preserves terrain hashes and creates no random placement", () => {
    const input = presentationInput();
    const originalHashes = input.bricks.map((brick) => brick.terrainHash);
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random input is forbidden");
    });

    const snapshot = createHestiaSurfacePresentationSnapshot(input);

    expect(random).not.toHaveBeenCalled();
    expect(input.bricks.map((brick) => brick.terrainHash)).toEqual(originalHashes);
    expect(snapshot.bricks.map((brick) => brick.terrainHash)).toEqual(originalHashes);
    expect(snapshot.scatter.every((fact) =>
      Math.abs(fact.positionMeters.x) > 2.25
      || fact.positionMeters.z < -6
      || fact.positionMeters.z > 18
    )).toBe(true);
    random.mockRestore();
  });

  it("exports the five grouped Hestia terrain material profiles", () => {
    expect(HESTIA_SURFACE_MATERIAL_PROFILES.map((profile) => profile.id)).toEqual([
      "hestia-surface:dark_rock",
      "hestia-surface:wet_soil",
      "hestia-surface:moss",
      "hestia-surface:dense_biological_surface",
      "hestia-surface:shallow_water_boundary"
    ]);
    expect(new Set(HESTIA_SURFACE_MATERIAL_PROFILES.map((profile) => profile.baseColor))).toHaveLength(5);
    expect(hestiaSurfaceMaterialProfileIdForKey("wet_soil")).toBe("hestia-surface:wet_soil");
    expect(() => hestiaSurfaceMaterialProfileIdForKey("random_cell_color")).toThrow(RangeError);
  });

  it("fails closed when brick facts do not exactly cover the terrain snapshot", () => {
    const input = presentationInput();
    expect(() => createHestiaSurfacePresentationSnapshot({
      ...input,
      bricks: input.bricks.slice(1)
    })).toThrow("cover every visible terrain brick");
    expect(() => createHestiaSurfacePresentationSnapshot({
      ...input,
      bricks: [...input.bricks, input.bricks[0]!]
    })).toThrow("Duplicate brickId");
  });

  it("contains no random or concept-image runtime dependency", () => {
    const sourceDirectory = join(process.cwd(), "src", "surface-play", "environment");
    const source = readdirSync(sourceDirectory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) => readFileSync(join(sourceDirectory, fileName), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\.png|UI-Screenshots|concept.image|screenshot/i);
  });
});
