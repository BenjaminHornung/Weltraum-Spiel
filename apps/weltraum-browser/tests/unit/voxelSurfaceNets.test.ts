import { describe, expect, it } from "vitest";
import {
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  HESTIA_MATERIAL_REGISTRY_V1,
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_INDEX_ORDER,
  VOXEL_BRICK_LAYOUT_VERSION,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  VOXEL_BRICK_SCHEMA_VERSION,
  VOXEL_MESH_ALGORITHM_VERSION,
  VOXEL_MESH_SCHEMA_VERSION,
  VoxelContractError,
  allocateVoxelChannels,
  calculateVoxelBrickContentHash,
  calculateVoxelMeshRepresentationKey,
  calculateVoxelMeshContentHash,
  calculateVoxelSpatialJobTargetKey,
  createSurfaceNetsVoxelMeshProduct,
  createVoxelBrick,
  editRevision,
  generatorVersion,
  serializeCanonicalVoxelMeshProduct,
  sourceRevision,
  storedSampleToGlobalCoordinate,
  surfaceFrameId,
  validateVoxelMeshProduct,
  voxelBodyId,
  voxelMeshRepresentationKey,
  voxelRegionId,
  voxelSampleIndex,
  type VoxelBrick,
  type VoxelCoordinate,
  type VoxelMaterialRegistry,
  type VoxelMeshValidationContext,
  type VoxelMeshProductContent,
  type VoxelMeshProduct
} from "../../src/voxel";

type DensityFixture = (global: VoxelCoordinate) => number;
type MaterialFixture = (global: VoxelCoordinate) => number;

const createFixtureBrick = (
  brickCoordinate: VoxelCoordinate,
  density: DensityFixture,
  material: MaterialFixture = () => 0,
  revision = 11
): VoxelBrick => {
  const channels = allocateVoxelChannels();
  for (let z = 0; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z; z += 1) {
    for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
      for (let x = 0; x < VOXEL_BRICK_SAMPLE_DIMENSIONS.x; x += 1) {
        const stored = { x, y, z };
        const global = storedSampleToGlobalCoordinate(brickCoordinate, stored);
        const index = voxelSampleIndex(stored);
        channels.densityBuffer[index] = Math.fround(density(global));
        channels.materialBuffer[index] = material(global);
      }
    }
  }
  return createVoxelBrick({
    schemaVersion: VOXEL_BRICK_SCHEMA_VERSION,
    layoutVersion: VOXEL_BRICK_LAYOUT_VERSION,
    indexOrder: VOXEL_BRICK_INDEX_ORDER,
    bodyId: voxelBodyId("planet.hestia"),
    surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
    regionId: voxelRegionId("region:hestia.preview"),
    brickCoordinate,
    voxelSizeMeters: 0.5,
    cellDimensions: VOXEL_BRICK_CELL_DIMENSIONS,
    sampleDimensions: VOXEL_BRICK_SAMPLE_DIMENSIONS,
    apronWidth: VOXEL_BRICK_APRON_WIDTH,
    generatorVersion: generatorVersion("hestia.generator.v1"),
    materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
    sourceRevision: sourceRevision(revision),
    editRevision: editRevision(0),
    ...channels
  });
};

const planeDensity = (global: VoxelCoordinate): number => global.y - 10.25;
const planeMaterial = (global: VoxelCoordinate): number => ((global.x % 4) + 4) % 4;

const vertexBitKey = (positions: Float32Array, valueOffset: number): string => {
  const view = new DataView(positions.buffer, positions.byteOffset, positions.byteLength);
  return [0, 1, 2]
    .map((axis) => view.getUint32((valueOffset + axis) * Float32Array.BYTES_PER_ELEMENT, true).toString(16).padStart(8, "0"))
    .join(":");
};

const float32BitHex = (value: number): string => {
  const values = new Float32Array([value]);
  return new DataView(values.buffer).getUint32(0, true).toString(16).padStart(8, "0");
};

const uniqueVertexKeys = (mesh: VoxelMeshProduct, predicate: (offset: number) => boolean = () => true): Set<string> => {
  const keys = new Set<string>();
  for (let offset = 0; offset < mesh.positions.length; offset += 3) {
    if (predicate(offset)) keys.add(vertexBitKey(mesh.positions, offset));
  }
  return keys;
};

const quadKeys = (mesh: VoxelMeshProduct): readonly string[] => {
  const keys: string[] = [];
  for (let offset = 0; offset < mesh.positions.length; offset += 18) {
    const vertices = new Set<string>();
    for (let vertexOffset = offset; vertexOffset < offset + 18; vertexOffset += 3) {
      vertices.add(vertexBitKey(mesh.positions, vertexOffset));
    }
    keys.push([...vertices].sort().join("|"));
  }
  return keys;
};

const sphereDensity = (center: readonly [number, number, number], radius: number): DensityFixture =>
  (global) => Math.hypot(global.x - center[0], global.y - center[1], global.z - center[2]) - radius;

const naiveExposedCubeTriangleCount = (brick: VoxelBrick): number => {
  const directions = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;
  let faces = 0;
  for (let z = 0; z < VOXEL_BRICK_CELL_DIMENSIONS.z; z += 1) {
    for (let y = 0; y < VOXEL_BRICK_CELL_DIMENSIONS.y; y += 1) {
      for (let x = 0; x < VOXEL_BRICK_CELL_DIMENSIONS.x; x += 1) {
        const stored = { x: x + VOXEL_BRICK_APRON_WIDTH, y: y + VOXEL_BRICK_APRON_WIDTH, z: z + VOXEL_BRICK_APRON_WIDTH };
        if (brick.densityBuffer[voxelSampleIndex(stored)] > 0) continue;
        for (const [dx, dy, dz] of directions) {
          const neighbor = { x: stored.x + dx, y: stored.y + dy, z: stored.z + dz };
          if (brick.densityBuffer[voxelSampleIndex(neighbor)] > 0) faces += 1;
        }
      }
    }
  }
  return faces * 2;
};

const withRecalculatedMeshHash = (content: VoxelMeshProductContent): VoxelMeshProduct => ({
  ...content,
  contentHash: calculateVoxelMeshContentHash(content)
});

const validationContextFor = (
  mesh: VoxelMeshProduct,
  expectedEmptyOrigin: Readonly<VoxelCoordinate> = mesh.bounds.min
): VoxelMeshValidationContext => ({
  expectedEmptyOrigin,
  expectedRepresentationKey: mesh.representationKey,
  expectedSourceRevision: mesh.sourceRevision,
  expectedArtifactRevision: mesh.artifactRevision,
  expectedAlgorithmVersion: mesh.algorithmVersion,
  expectedFrameId: mesh.frameId,
  expectedMaterialRegistryVersion: mesh.materialRegistryVersion
});

const captureVoxelContractError = (action: () => void): VoxelContractError => {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(VoxelContractError);
  return caught as VoxelContractError;
};

describe("Surface Nets V1", () => {
  it("separates request-known spatial targets from content-addressed mesh representations", () => {
    const coordinate = { x: -2, y: 1, z: 3 };
    const firstBrick = createFixtureBrick(coordinate, planeDensity);
    const equalBrick = createFixtureBrick(coordinate, planeDensity);
    const changedContentBrick = createFixtureBrick(coordinate, (global) => planeDensity(global) + 0.125);
    const changedResolutionBrick = createVoxelBrick({ ...firstBrick, voxelSizeMeters: 0.25 });

    const spatialTarget = calculateVoxelSpatialJobTargetKey(firstBrick);
    expect(spatialTarget).toBe(calculateVoxelSpatialJobTargetKey(equalBrick));
    expect(spatialTarget).toBe(calculateVoxelSpatialJobTargetKey(changedContentBrick));
    expect(spatialTarget).toBe(calculateVoxelSpatialJobTargetKey(changedResolutionBrick));
    expect(spatialTarget).toMatch(/^voxel_spatial:[0-9a-f]{16}$/);

    const firstRepresentation = calculateVoxelMeshRepresentationKey(firstBrick, VOXEL_MESH_ALGORITHM_VERSION);
    expect(firstRepresentation).toBe(calculateVoxelMeshRepresentationKey(equalBrick, VOXEL_MESH_ALGORITHM_VERSION));
    expect(calculateVoxelMeshRepresentationKey(changedContentBrick, VOXEL_MESH_ALGORITHM_VERSION))
      .not.toBe(firstRepresentation);
    expect(calculateVoxelMeshRepresentationKey(changedResolutionBrick, VOXEL_MESH_ALGORITHM_VERSION))
      .not.toBe(firstRepresentation);
    expect(calculateVoxelMeshRepresentationKey(firstBrick, "surface_nets_v2"))
      .not.toBe(firstRepresentation);
    expect(firstRepresentation).not.toBe(spatialTarget);
  });

  it("returns canonical empty products for empty and fully solid bricks", () => {
    for (const density of [() => 1, () => -1]) {
      const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: -2, y: 1, z: 3 }, density));
      expect(mesh.schemaVersion).toBe(VOXEL_MESH_SCHEMA_VERSION);
      expect(mesh.algorithmVersion).toBe(VOXEL_MESH_ALGORITHM_VERSION);
      expect(mesh.positions).toEqual(new Float32Array(0));
      expect(mesh.normals).toEqual(new Float32Array(0));
      expect(mesh.indices).toEqual(new Uint16Array(0));
      expect(mesh.materialRanges).toEqual([]);
      expect(mesh.bounds).toEqual({ min: { x: -32, y: 32, z: 48 }, max: { x: -32, y: 32, z: 48 } });
      expect(validateVoxelMeshProduct(mesh).valid).toBe(false);
      expect(validateVoxelMeshProduct(
        mesh,
        HESTIA_MATERIAL_REGISTRY_V1,
        validationContextFor(mesh, { x: -32, y: 32, z: 48 })
      )).toEqual({ valid: true });
    }
  });

  it("rejects coherently rehashed empty bounds that do not equal the expected negative brick origin", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: -2, y: 1, z: 3 }, () => 1));
    const content: VoxelMeshProductContent = mesh;
    const wrongOrigin = { x: -31.5, y: 32, z: 48 };
    const mutated = withRecalculatedMeshHash({
      ...content,
      bounds: { min: wrongOrigin, max: wrongOrigin }
    });
    const validation = validateVoxelMeshProduct(
      mutated,
      HESTIA_MATERIAL_REGISTRY_V1,
      validationContextFor(mesh, { x: -32, y: 32, z: 48 })
    );
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.issues).toContainEqual(expect.objectContaining({ code: "InvalidBounds", path: "bounds" }));
      expect(validation.issues.map((issue) => issue.code)).not.toContain("ContentHashMismatch");
    }
  });

  it("emits deterministic faceted plane geometry with sequential indices and tight bounds", () => {
    const brick = createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity, planeMaterial);
    const first = createSurfaceNetsVoxelMeshProduct(brick);
    const second = createSurfaceNetsVoxelMeshProduct(brick);

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.positions).toEqual(second.positions);
    expect(first.indices.length).toBe(6_144);
    expect(first.positions.length / 3).toBe(6_144);
    expect(first.indices).toBeInstanceOf(Uint16Array);
    expect(Array.from(first.indices.slice(0, 12))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(first.bounds).toEqual({ min: { x: -0.25, y: 5.125, z: -0.25 }, max: { x: 15.75, y: 5.125, z: 15.75 } });
    expect(Array.from(first.normals.slice(0, 9))).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    expect(first.contentHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it("uses the fixed rings and winding for signed X, Y, and Z planes", () => {
    const fixtures = [
      {
        axis: 0,
        positiveRing: [[2.625, -0.25, -0.25], [2.625, 0.25, -0.25], [2.625, 0.25, 0.25], [2.625, -0.25, 0.25]]
      },
      {
        axis: 1,
        positiveRing: [[-0.25, 2.625, -0.25], [-0.25, 2.625, 0.25], [0.25, 2.625, 0.25], [0.25, 2.625, -0.25]]
      },
      {
        axis: 2,
        positiveRing: [[-0.25, -0.25, 2.625], [0.25, -0.25, 2.625], [0.25, 0.25, 2.625], [-0.25, 0.25, 2.625]]
      }
    ] as const;

    for (const fixture of fixtures) {
      for (const direction of [1, -1] as const) {
        const density: DensityFixture = (global) => direction * ([global.x, global.y, global.z][fixture.axis] - 5.25);
        const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, density));
        const ringOrder = direction === 1 ? [0, 1, 2, 0, 2, 3] : [0, 3, 2, 0, 2, 1];
        const expectedPositions = ringOrder.flatMap((ringIndex) => fixture.positiveRing[ringIndex]);
        const expectedNormal = [0, 0, 0];
        expectedNormal[fixture.axis] = direction;
        expect(Array.from(mesh.positions.slice(0, 18))).toEqual(expectedPositions);
        expect(Array.from(mesh.normals.slice(0, 18))).toEqual(
          Array.from({ length: 6 }, () => expectedNormal).flat()
        );
      }
    }
  });

  it("chooses the solid edge endpoint material and emits material ID 4", () => {
    const positive = createSurfaceNetsVoxelMeshProduct(createFixtureBrick(
      { x: 0, y: 0, z: 0 },
      (global) => global.x - 5.25,
      (global) => global.x <= 5 ? 4 : 1
    ));
    const negative = createSurfaceNetsVoxelMeshProduct(createFixtureBrick(
      { x: 0, y: 0, z: 0 },
      (global) => 5.25 - global.x,
      (global) => global.x <= 5 ? 2 : 3
    ));

    expect(positive.materialRanges.map((range) => [range.materialId, range.materialKey])).toEqual([
      [4, "shallow_water_boundary"]
    ]);
    expect(negative.materialRanges.map((range) => [range.materialId, range.materialKey])).toEqual([
      [3, "dense_biological_surface"]
    ]);
    expect(Array.from(positive.positions).some((value) => Object.is(value, Math.fround(2.625)))).toBe(true);
  });

  it("pins canonical bytes, representation identity, and a stable golden mesh hash", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity, planeMaterial));
    const bytes = serializeCanonicalVoxelMeshProduct(mesh);
    const prefix = "weltraum-voxel-mesh-product-v1\n";
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerLength = view.getUint32(prefix.length, true);
    const header = new TextDecoder().decode(bytes.subarray(prefix.length + 4, prefix.length + 4 + headerLength));
    expect(new TextDecoder().decode(bytes.subarray(0, prefix.length))).toBe(prefix);
    expect(mesh.representationKey).toBe("voxel_mesh:943d51e51c8314d1");
    expect(header).toBe(JSON.stringify({
      schemaVersion: 1,
      representationKey: mesh.representationKey,
      sourceRevision: 11,
      artifactRevision: 0,
      algorithmVersion: "surface_nets_v1",
      frameId: "frame:surface.hestia",
      materialRegistryVersion: "hestia.materials.v1",
      positions: { format: "Float32LE", elementCount: 18_432 },
      normals: { format: "Float32LE", elementCount: 18_432 },
      indices: { format: "Uint16LE", elementCount: 6_144 },
      materialRanges: [
        [0, "dark_rock", 0, 1_536],
        [1, "wet_soil", 1_536, 1_536],
        [2, "moss", 3_072, 1_536],
        [3, "dense_biological_surface", 4_608, 1_536]
      ],
      bounds: { format: "Float32LE", elementCount: 6 }
    }));
    expect(mesh.contentHash).toBe("fnv1a64:0be119dcd2a838e1");
  });

  it("buckets all triangles into ascending, gapless material ranges", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity, planeMaterial));
    expect(mesh.materialRanges.map((range) => range.materialId)).toEqual([0, 1, 2, 3]);
    expect(mesh.materialRanges.map((range) => range.startIndex)).toEqual([0, 1_536, 3_072, 4_608]);
    expect(mesh.materialRanges.reduce((count, range) => count + range.indexCount, 0)).toBe(mesh.indices.length);
    expect(mesh.materialRanges.at(-1)!.startIndex + mesh.materialRanges.at(-1)!.indexCount).toBe(mesh.indices.length);
  });

  it("switches to Uint32 only when duplicated geometry exceeds the Uint16 vertex limit", () => {
    const layeredDensity: DensityFixture = (global) =>
      global.y < 12 && global.y % 2 === 0 ? -1 : 1;
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, layeredDensity));
    expect(mesh.positions.length / 3).toBe(67_584);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.indices.at(-1)).toBe(67_583);
    expect(validateVoxelMeshProduct(mesh)).toEqual({ valid: true });
  });

  it("produces exact Float32 X, Y, and Z seams without duplicate owned quads", () => {
    const fixtures = [
      {
        axis: 0,
        density: planeDensity,
        negativeCoordinate: { x: -1, y: 0, z: 0 },
        positiveCoordinate: { x: 0, y: 0, z: 0 }
      },
      {
        axis: 1,
        density: (global: VoxelCoordinate) => global.x - 5.25,
        negativeCoordinate: { x: 0, y: -1, z: 0 },
        positiveCoordinate: { x: 0, y: 0, z: 0 }
      },
      {
        axis: 2,
        density: (global: VoxelCoordinate) => global.x - 5.25,
        negativeCoordinate: { x: 0, y: 0, z: -1 },
        positiveCoordinate: { x: 0, y: 0, z: 0 }
      }
    ] as const;

    for (const fixture of fixtures) {
      const negative = createSurfaceNetsVoxelMeshProduct(createFixtureBrick(fixture.negativeCoordinate, fixture.density));
      const positive = createSurfaceNetsVoxelMeshProduct(createFixtureBrick(fixture.positiveCoordinate, fixture.density));
      const seamCoordinate = Math.fround(-0.25);
      const negativeSeam = uniqueVertexKeys(
        negative,
        (offset) => Object.is(negative.positions[offset + fixture.axis], seamCoordinate)
      );
      const positiveSeam = uniqueVertexKeys(
        positive,
        (offset) => Object.is(positive.positions[offset + fixture.axis], seamCoordinate)
      );
      expect(negativeSeam.size).toBeGreaterThan(0);
      expect(positiveSeam).toEqual(negativeSeam);

      const negativeQuadKeys = quadKeys(negative);
      const positiveQuadKeys = quadKeys(positive);
      expect(negativeQuadKeys.length).toBeGreaterThan(0);
      expect(positiveQuadKeys.length).toBeGreaterThan(0);
      expect(new Set(negativeQuadKeys).size).toBe(negativeQuadKeys.length);
      expect(new Set(positiveQuadKeys).size).toBe(positiveQuadKeys.length);
      const positiveQuadKeySet = new Set(positiveQuadKeys);
      const sharedQuadKeys = new Set(negativeQuadKeys.filter((key) => positiveQuadKeySet.has(key)));
      expect(sharedQuadKeys).toEqual(new Set());
    }
  });

  it("rounds a non-binary 2.6 intersection once to fixed Float32 bits across an adjacent seam", () => {
    const density: DensityFixture = (global) => global.x - 5.2;
    const lower = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: -1, z: 0 }, density));
    const upper = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, density));
    const seamCoordinate = Math.fround(-0.25);
    const expectedIntersection = Math.fround(2.6);
    const seamKeys = (mesh: VoxelMeshProduct): Set<string> => {
      const keys = new Set<string>();
      for (let offset = 0; offset < mesh.positions.length; offset += 3) {
        if (!Object.is(mesh.positions[offset + 1], seamCoordinate)) continue;
        expect(Object.is(mesh.positions[offset], expectedIntersection)).toBe(true);
        expect(float32BitHex(mesh.positions[offset])).toBe("40266666");
        keys.add(vertexBitKey(mesh.positions, offset));
      }
      return keys;
    };

    expect(float32BitHex(expectedIntersection)).toBe("40266666");
    const lowerSeam = seamKeys(lower);
    const upperSeam = seamKeys(upper);
    expect(lowerSeam.size).toBeGreaterThan(0);
    expect(upperSeam).toEqual(lowerSeam);
  });

  it("keeps lower-sample ownership unique across two negative-coordinate bricks", () => {
    const left = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: -2, y: 0, z: -1 }, planeDensity));
    const right = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: -1, y: 0, z: -1 }, planeDensity));
    const combined = [...quadKeys(left), ...quadKeys(right)];
    expect(left.indices.length / 6).toBe(1_024);
    expect(right.indices.length / 6).toBe(1_024);
    expect(new Set(combined).size).toBe(combined.length);
  });

  it("creates finite curved geometry and beats the documented naive exposed-cube fixture", () => {
    // The fixture crosses the negative X ownership border. The naive baseline counts every exposed
    // core-sample cube face from the same brick plus apron samples used by Surface Nets.
    const density = sphereDensity([2.4, 16.3, 12.1], 8.2);
    const brick = createFixtureBrick({ x: 0, y: 0, z: 0 }, density);
    const mesh = createSurfaceNetsVoxelMeshProduct(brick);
    const triangleCount = mesh.indices.length / 3;
    const naiveTriangleCount = naiveExposedCubeTriangleCount(brick);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(Array.from(mesh.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(mesh.normals).every(Number.isFinite)).toBe(true);
    expect(triangleCount).toBeLessThan(naiveTriangleCount);
  });

  it("rejects invalid and hash-mutated bricks before meshing", () => {
    const brick = createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity);
    brick.densityBuffer[0] = -999;
    expect(() => createSurfaceNetsVoxelMeshProduct(brick)).toThrow(VoxelContractError);
    expect(() => createSurfaceNetsVoxelMeshProduct({ ...brick, contentHash: "fnv1a64:0000000000000000" } as VoxelBrick)).toThrow(
      VoxelContractError
    );

  });

  it("rejects a non-finite apron sample even when the brick hash is coherently recomputed", () => {
    const brick = createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity);
    brick.densityBuffer[voxelSampleIndex({ x: 0, y: 0, z: 0 })] = Number.NaN;
    const rehashed = { ...brick, contentHash: calculateVoxelBrickContentHash(brick) } as VoxelBrick;
    const error = captureVoxelContractError(() => createSurfaceNetsVoxelMeshProduct(rehashed));
    expect(error.issues).toContainEqual(expect.objectContaining({
      code: "NonFiniteDensity",
      path: "densityBuffer[0]"
    }));
  });

  it("returns structured registry failures and never leaks a native TypeError", () => {
    const brick = createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity);
    const mesh = createSurfaceNetsVoxelMeshProduct(brick);
    const malformedRegistry = {
      version: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
      definitions: null
    } as unknown as VoxelMaterialRegistry;

    const validation = validateVoxelMeshProduct(mesh, malformedRegistry);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.issues).toEqual([
        expect.objectContaining({ code: "InvalidMaterialRegistry", path: "materialRegistry.definitions" })
      ]);
    }
    const error = captureVoxelContractError(() => createSurfaceNetsVoxelMeshProduct(brick, malformedRegistry));
    expect(error.issues).toEqual([
      expect.objectContaining({ code: "InvalidMaterialRegistry", path: "materialRegistry.definitions" })
    ]);
  });

  it("binds coherently rehashed metadata to the source-derived validation context", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity));
    const fixtures: readonly {
      readonly path: string;
      readonly code: string;
      readonly content: VoxelMeshProductContent;
    }[] = [
      {
        path: "representationKey",
        code: "InvalidMeshRepresentationKey",
        content: { ...mesh, representationKey: voxelMeshRepresentationKey("voxel_mesh:0000000000000000") }
      },
      {
        path: "sourceRevision",
        code: "InvalidRevision",
        content: { ...mesh, sourceRevision: sourceRevision(mesh.sourceRevision + 1) }
      },
      {
        path: "frameId",
        code: "InvalidStableId",
        content: { ...mesh, frameId: surfaceFrameId("frame:surface.other") }
      }
    ];

    for (const fixture of fixtures) {
      const mutated = withRecalculatedMeshHash(fixture.content);
      expect(validateVoxelMeshProduct(mutated)).toEqual({ valid: true });
      const validation = validateVoxelMeshProduct(
        mutated,
        HESTIA_MATERIAL_REGISTRY_V1,
        validationContextFor(mesh)
      );
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.issues).toContainEqual(expect.objectContaining({
          code: fixture.code,
          path: fixture.path
        }));
        expect(validation.issues.map((issue) => issue.code)).not.toContain("ContentHashMismatch");
      }
    }
  });

  it("rejects coherently rehashed negative-zero and out-of-byte material ranges before registry lookup", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity));
    for (const invalidMaterialId of [-0, 256]) {
      const invalidContent = {
        ...mesh,
        materialRanges: mesh.materialRanges.map((range, index) => index === 0
          ? { ...range, materialId: invalidMaterialId }
          : range)
      } as unknown as VoxelMeshProductContent;
      const mutated = withRecalculatedMeshHash(invalidContent);
      const validation = validateVoxelMeshProduct(mutated);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.issues).toContainEqual(expect.objectContaining({
          code: "InvalidMaterialId",
          path: "materialRanges[0].materialId"
        }));
        expect(validation.issues.map((issue) => issue.code)).not.toContain("ContentHashMismatch");
      }
    }
  });

  it("rejects degenerate zero-area output instead of inventing a normal", () => {
    const isolatedZero: DensityFixture = (global) => global.x === 5 && global.y === 5 && global.z === 5 ? 0 : 1;
    expect(() => createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, isolatedZero))).toThrow(
      VoxelContractError
    );
  });

  it("rejects a stale mesh hash after a coherent translation of positions and bounds", () => {
    const mesh = createSurfaceNetsVoxelMeshProduct(createFixtureBrick({ x: 0, y: 0, z: 0 }, planeDensity));
    const translatedPositions = new Float32Array(mesh.positions);
    for (let offset = 0; offset < translatedPositions.length; offset += 3) {
      translatedPositions[offset] = Math.fround(translatedPositions[offset] + 0.5);
    }
    const translated = {
      ...mesh,
      positions: translatedPositions,
      bounds: {
        min: { ...mesh.bounds.min, x: Math.fround(mesh.bounds.min.x + 0.5) },
        max: { ...mesh.bounds.max, x: Math.fround(mesh.bounds.max.x + 0.5) }
      }
    } as VoxelMeshProduct;
    expect(validateVoxelMeshProduct(translated)).toEqual({
      valid: false,
      issues: [{ code: "ContentHashMismatch", path: "contentHash", message: "does not match canonical mesh content" }]
    });
  });
});
