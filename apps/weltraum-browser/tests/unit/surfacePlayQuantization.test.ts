import { describe, expect, it } from "vitest";
import { HESTIA_SURFACE_PLAY_V1_CONFIG } from "../../src/surface-play/surfacePlayConfig";
import { quantizeSurfaceHitCoordinateMeters } from "../../src/surface-play/surfacePlayQuantization";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SOURCE_REVISION_V1
} from "../../src/world-generation/hestia";

describe("surface-play terrain-hit quantization", () => {
  it("rounds positive and negative half ties to the even grid neighbor", () => {
    expect(quantizeSurfaceHitCoordinateMeters(0.0625)).toBe(0);
    expect(quantizeSurfaceHitCoordinateMeters(0.1875)).toBe(0.25);
    expect(quantizeSurfaceHitCoordinateMeters(0.3125)).toBe(0.25);
    expect(quantizeSurfaceHitCoordinateMeters(0.4375)).toBe(0.5);
    expect(quantizeSurfaceHitCoordinateMeters(-0.0625)).toBe(0);
    expect(quantizeSurfaceHitCoordinateMeters(-0.1875)).toBe(-0.25);
    expect(quantizeSurfaceHitCoordinateMeters(-0.3125)).toBe(-0.25);
    expect(quantizeSurfaceHitCoordinateMeters(-0.4375)).toBe(-0.5);
  });

  it("distinguishes values immediately below and above a half tie", () => {
    const epsilon = 1e-10;

    expect(quantizeSurfaceHitCoordinateMeters(0.0625 - epsilon)).toBe(0);
    expect(quantizeSurfaceHitCoordinateMeters(0.0625 + epsilon)).toBe(0.125);
    expect(quantizeSurfaceHitCoordinateMeters(-0.0625 - epsilon)).toBe(-0.125);
    expect(quantizeSurfaceHitCoordinateMeters(-0.0625 + epsilon)).toBe(0);
  });

  it("quantizes ordinary metre values and is idempotent on grid values", () => {
    expect(quantizeSurfaceHitCoordinateMeters(0.14)).toBe(0.125);
    expect(quantizeSurfaceHitCoordinateMeters(-0.14)).toBe(-0.125);
    expect(quantizeSurfaceHitCoordinateMeters(1.2)).toBe(1.25);

    for (const gridValue of [-1, -0.25, -0.125, 0, 0.125, 0.25, 1]) {
      expect(quantizeSurfaceHitCoordinateMeters(gridValue)).toBe(gridValue);
    }
  });

  it("rejects non-finite input and canonicalizes zero", () => {
    expect(() => quantizeSurfaceHitCoordinateMeters(Number.NaN)).toThrow(RangeError);
    expect(() => quantizeSurfaceHitCoordinateMeters(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => quantizeSurfaceHitCoordinateMeters(Number.NEGATIVE_INFINITY)).toThrow(RangeError);

    expect(Object.is(quantizeSurfaceHitCoordinateMeters(-0), -0)).toBe(false);
    expect(Object.is(quantizeSurfaceHitCoordinateMeters(-0.0625), -0)).toBe(false);
  });
});

describe("Hestia Surface Play V1 config", () => {
  it("publishes the approved immutable authority configuration", () => {
    expect(HESTIA_SURFACE_PLAY_V1_CONFIG).toEqual({
      schemaVersion: "surface-region-voxel-state-v1",
      bodyId: "planet.hestia",
      surfaceFrameId: "frame:surface_hestia_surface_play_v1",
      regionId: "region:hestia.surface-play.v1",
      generatorVersion: HESTIA_GENERATOR_VERSION_V1,
      seed: "hestia-surface-play-v1",
      voxelSizeMeters: 0.5,
      sourceRevision: HESTIA_SOURCE_REVISION_V1,
      brickBounds: {
        minInclusive: { x: 2, y: 0, z: -4 },
        maxExclusive: { x: 6, y: 1, z: 0 }
      },
      residentBrickCoordinates: [
        { x: 2, y: 0, z: -4 }, { x: 3, y: 0, z: -4 }, { x: 4, y: 0, z: -4 }, { x: 5, y: 0, z: -4 },
        { x: 2, y: 0, z: -3 }, { x: 3, y: 0, z: -3 }, { x: 4, y: 0, z: -3 }, { x: 5, y: 0, z: -3 },
        { x: 2, y: 0, z: -2 }, { x: 3, y: 0, z: -2 }, { x: 4, y: 0, z: -2 }, { x: 5, y: 0, z: -2 },
        { x: 2, y: 0, z: -1 }, { x: 3, y: 0, z: -1 }, { x: 4, y: 0, z: -1 }, { x: 5, y: 0, z: -1 }
      ],
      maxSubtractRadiusMeters: 2,
      maxChangedSamplesPerEdit: 20_000
    });
    expect(Object.isFrozen(HESTIA_SURFACE_PLAY_V1_CONFIG)).toBe(true);
    expect(Object.isFrozen(HESTIA_SURFACE_PLAY_V1_CONFIG.brickBounds)).toBe(true);
    expect(Object.isFrozen(HESTIA_SURFACE_PLAY_V1_CONFIG.brickBounds.minInclusive)).toBe(true);
    expect(Object.isFrozen(HESTIA_SURFACE_PLAY_V1_CONFIG.brickBounds.maxExclusive)).toBe(true);
    expect(Object.isFrozen(HESTIA_SURFACE_PLAY_V1_CONFIG.residentBrickCoordinates)).toBe(true);
    expect(HESTIA_SURFACE_PLAY_V1_CONFIG.residentBrickCoordinates.every(Object.isFrozen)).toBe(true);
  });
});
