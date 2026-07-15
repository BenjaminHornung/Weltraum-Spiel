import { describe, expect, it } from "vitest";
import {
  createDeterministicPlanetHeightSampler,
  createPlanetTileKey,
  generatePlanetShellMesh,
  MAX_PLANET_TILE_LEVEL,
  PLANET_FACES,
  PlanetShellMeshError,
  tilesPerPlanetFace,
  zeroPlanetHeightSampler
} from "../../src/planet";
import { createPlanetShellMeshArtifact } from "../../src/planet/planetPresentationAdapter";
import {
  artifactRevision,
  frameId,
  materialProfileId,
  sourceRevision,
  validateMeshArtifact
} from "../../src/presentation";

const tileKey = createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 4, x: 9, y: 6 });

const mesh = () => generatePlanetShellMesh({
  tileKey,
  radiusMeters: 6_400_000,
  gridSegments: 4,
  heightSampler: zeroPlanetHeightSampler
});

const component = (values: Float32Array, vertex: number, axis: number): number => values[vertex * 3 + axis];

interface CapturedHeightSample {
  readonly direction: readonly [number, number, number];
  readonly height: number;
}

const captureHarnessSamples = (
  sampledTileKey: ReturnType<typeof createPlanetTileKey>,
  gridSegments: number,
  amplitudeMeters = 20
): readonly CapturedHeightSample[] => {
  const samples: CapturedHeightSample[] = [];
  const harness = createDeterministicPlanetHeightSampler(amplitudeMeters);
  generatePlanetShellMesh({
    tileKey: sampledTileKey,
    radiusMeters: 6_400_000,
    gridSegments,
    heightSampler: (sample) => {
      const height = harness(sample);
      samples.push(Object.freeze({
        direction: Object.freeze([sample.direction.x, sample.direction.y, sample.direction.z] as const),
        height
      }));
      return height;
    }
  });
  return Object.freeze(samples);
};

describe("planet shell mesh generation", () => {
  it("emits a finite regular relative grid with stable layout, indices, and valid bounds", () => {
    const generated = mesh();

    expect(generated.positionsRelative).toBeInstanceOf(Float32Array);
    expect(generated.normals).toBeInstanceOf(Float32Array);
    expect(generated.uv).toBeInstanceOf(Float32Array);
    expect(generated.indices).toBeInstanceOf(Uint16Array);
    expect(generated.positionsRelative).toHaveLength(25 * 3);
    expect(generated.normals).toHaveLength(25 * 3);
    expect(generated.uv).toHaveLength(25 * 2);
    expect(generated.indices).toHaveLength(4 * 4 * 6);
    expect(Array.from(generated.indices.slice(0, 12))).toEqual([0, 1, 5, 1, 6, 5, 1, 2, 6, 2, 7, 6]);
    expect([...generated.positionsRelative, ...generated.normals, ...generated.uv].every(Number.isFinite)).toBe(true);

    for (let index = 0; index < generated.positionsRelative.length; index += 3) {
      const x = generated.positionsRelative[index];
      const y = generated.positionsRelative[index + 1];
      const z = generated.positionsRelative[index + 2];
      expect(x).toBeGreaterThanOrEqual(generated.boundsRelative.min.x);
      expect(x).toBeLessThanOrEqual(generated.boundsRelative.max.x);
      expect(y).toBeGreaterThanOrEqual(generated.boundsRelative.min.y);
      expect(y).toBeLessThanOrEqual(generated.boundsRelative.max.y);
      expect(z).toBeGreaterThanOrEqual(generated.boundsRelative.min.z);
      expect(z).toBeLessThanOrEqual(generated.boundsRelative.max.z);
      expect(Math.hypot(
        generated.normals[index],
        generated.normals[index + 1],
        generated.normals[index + 2]
      )).toBeCloseTo(1, 6);
    }

    expect(Math.hypot(
      generated.originBodyCentered.x,
      generated.originBodyCentered.y,
      generated.originBodyCentered.z
    )).toBeCloseTo(generated.radiusMeters, 6);
    expect(Math.max(...Array.from(generated.positionsRelative, Math.abs))).toBeLessThan(generated.radiusMeters);
    expect(generated.boundsBodyCentered.min.x).toBeLessThanOrEqual(generated.boundsBodyCentered.max.x);
    expect(generated.boundsBodyCentered.min.y).toBeLessThanOrEqual(generated.boundsBodyCentered.max.y);
    expect(generated.boundsBodyCentered.min.z).toBeLessThanOrEqual(generated.boundsBodyCentered.max.z);
  });

  it("returns only positive-area, consistently outward triangles for ordinary meshes on every cube face", () => {
    for (const face of PLANET_FACES) {
      const generated = generatePlanetShellMesh({
        tileKey: createPlanetTileKey({ bodyId: "hestia", face, level: 1, x: 0, y: 0 }),
        radiusMeters: 1000,
        gridSegments: 2,
        heightSampler: zeroPlanetHeightSampler
      });
      for (let offset = 0; offset < generated.indices.length; offset += 3) {
        const a = generated.indices[offset];
        const b = generated.indices[offset + 1];
        const c = generated.indices[offset + 2];
        const ax = component(generated.positionsRelative, a, 0) + generated.originBodyCentered.x;
        const ay = component(generated.positionsRelative, a, 1) + generated.originBodyCentered.y;
        const az = component(generated.positionsRelative, a, 2) + generated.originBodyCentered.z;
        const abx = component(generated.positionsRelative, b, 0) - component(generated.positionsRelative, a, 0);
        const aby = component(generated.positionsRelative, b, 1) - component(generated.positionsRelative, a, 1);
        const abz = component(generated.positionsRelative, b, 2) - component(generated.positionsRelative, a, 2);
        const acx = component(generated.positionsRelative, c, 0) - component(generated.positionsRelative, a, 0);
        const acy = component(generated.positionsRelative, c, 1) - component(generated.positionsRelative, a, 1);
        const acz = component(generated.positionsRelative, c, 2) - component(generated.positionsRelative, a, 2);
        const crossX = aby * acz - abz * acy;
        const crossY = abz * acx - abx * acz;
        const crossZ = abx * acy - aby * acx;
        expect(Math.hypot(crossX, crossY, crossZ)).toBeGreaterThan(0);
        expect(crossX * ax + crossY * ay + crossZ * az).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the built-in harness continuous at same-face, parent-child, and cross-face shared directions", () => {
    const segments = 4;
    const rowLength = segments + 1;
    const left = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 2, x: 1, y: 1 }),
      segments
    );
    const right = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 2, x: 2, y: 1 }),
      segments
    );
    for (let gridY = 0; gridY <= segments; gridY += 1) {
      const leftEdge = left[gridY * rowLength + segments];
      const rightEdge = right[gridY * rowLength];
      expect(leftEdge.direction).toEqual(rightEdge.direction);
      expect(leftEdge.height).toBe(rightEdge.height);
    }

    const parent = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+Y", level: 2, x: 1, y: 1 }),
      4
    );
    const child = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+Y", level: 3, x: 2, y: 2 }),
      2
    );
    for (let gridY = 0; gridY <= 2; gridY += 1) {
      for (let gridX = 0; gridX <= 2; gridX += 1) {
        const parentSample = parent[gridY * 5 + gridX];
        const childSample = child[gridY * 3 + gridX];
        expect(parentSample.direction).toEqual(childSample.direction);
        expect(parentSample.height).toBe(childSample.height);
      }
    }

    const positiveX = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+X", level: 2, x: 0, y: 1 }),
      segments
    );
    const positiveZ = captureHarnessSamples(
      createPlanetTileKey({ bodyId: "hestia", face: "+Z", level: 2, x: 3, y: 1 }),
      segments
    );
    for (let gridY = 0; gridY <= segments; gridY += 1) {
      const positiveXEdge = positiveX[gridY * rowLength];
      const positiveZEdge = positiveZ[gridY * rowLength + segments];
      expect(positiveXEdge.direction).toEqual(positiveZEdge.direction);
      expect(positiveXEdge.height).toBe(positiveZEdge.height);
    }
  });

  it("passes stable tile and sample coordinates to a deterministic sampler", () => {
    const samples: string[] = [];
    const first = generatePlanetShellMesh({
      tileKey,
      radiusMeters: 1000,
      gridSegments: 2,
      heightSampler: (sample) => {
        samples.push(`${sample.bodyId}|${sample.tileId}|${sample.gridX}|${sample.gridY}|${sample.sampleU}|${sample.sampleV}`);
        return sample.gridX + sample.gridY;
      }
    });
    const second = generatePlanetShellMesh({
      tileKey,
      radiusMeters: 1000,
      gridSegments: 2,
      heightSampler: (sample) => sample.gridX + sample.gridY
    });

    expect(samples).toHaveLength(9);
    expect(samples[0]).toBe(`hestia|${first.tileId}|0|0|0|0`);
    expect(samples[8]).toBe(`hestia|${first.tileId}|2|2|1|1`);
    expect(Array.from(first.positionsRelative)).toEqual(Array.from(second.positionsRelative));
    expect(Array.from(first.indices)).toEqual(Array.from(second.indices));
  });

  it("creates equal valid MeshArtifact hashes for equal generation input", () => {
    const sampler = createDeterministicPlanetHeightSampler(20);
    const generate = () => generatePlanetShellMesh({
      tileKey,
      radiusMeters: 6_400_000,
      gridSegments: 4,
      heightSampler: sampler
    });
    const artifact = (generated: ReturnType<typeof generate>) => createPlanetShellMeshArtifact({
      mesh: generated,
      sourceRevision: sourceRevision(7),
      artifactRevision: artifactRevision(3),
      frameId: frameId("planet:hestia"),
      materialProfileId: materialProfileId("planet_shell:neutral")
    });

    const first = artifact(generate());
    const second = artifact(generate());
    expect(validateMeshArtifact(first)).toEqual({ valid: true });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.representationKey).toBe(second.representationKey);
    expect(Array.from(first.positions)).toEqual(Array.from(second.positions));
  });

  it("rejects non-finite or inside-out height samples before producing GPU buffers", () => {
    expect(() => generatePlanetShellMesh({
      tileKey,
      radiusMeters: 1000,
      gridSegments: 1,
      heightSampler: () => Number.NaN
    })).toThrowError(PlanetShellMeshError);
    expect(() => generatePlanetShellMesh({
      tileKey,
      radiusMeters: 1000,
      gridSegments: 1,
      heightSampler: () => -1000
    })).toThrowError(PlanetShellMeshError);
  });

  it("fails closed with a typed precision error for collapsed maximum-level triangle geometry", () => {
    const tilesPerFace = tilesPerPlanetFace(MAX_PLANET_TILE_LEVEL);
    try {
      generatePlanetShellMesh({
        tileKey: createPlanetTileKey({
          bodyId: "hestia",
          face: "+X",
          level: MAX_PLANET_TILE_LEVEL,
          x: tilesPerFace - 1,
          y: tilesPerFace - 1
        }),
        radiusMeters: 6_400_000,
        gridSegments: 4,
        heightSampler: zeroPlanetHeightSampler
      });
      throw new Error("Expected maximum-level grid 4 mesh generation to fail closed.");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanetShellMeshError);
      expect((error as PlanetShellMeshError).code).toBe("UNSUPPORTED_MESH_PRECISION");
    }
  });
});
