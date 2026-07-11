import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import { ABSOLUTE_SYSTEM_FRAME, worldCoordinate } from "../../src/world/frames";
import {
  WorldChunkRegistryError,
  createWorldChunkBounds,
  createWorldChunkMetadata,
  createWorldChunkRegistry,
  worldChunkIdFromCoordinate,
  type WorldChunkCoordinate,
  type WorldChunkMetadata
} from "../../src/world/chunkRegistry";

const CHUNK_SIZE = 10;

const metadataFor = (
  coordinate: WorldChunkCoordinate,
  options: {
    readonly id?: string;
    readonly entityIds?: readonly string[];
    readonly renderBatchKeys?: readonly string[];
    readonly revision?: number;
  } = {}
): WorldChunkMetadata =>
  createWorldChunkMetadata({
    id: (options.id ?? worldChunkIdFromCoordinate(coordinate)) as WorldChunkMetadata["id"],
    coordinate,
    bounds: createWorldChunkBounds(coordinate, CHUNK_SIZE),
    entityIds: options.entityIds ?? [],
    renderBatchKeys: options.renderBatchKeys ?? [],
    revision: options.revision ?? 0
  });

const expectRegistryError = (action: () => unknown, code: WorldChunkRegistryError["code"]): void => {
  try {
    action();
    throw new Error(`Expected WorldChunkRegistryError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(WorldChunkRegistryError);
    expect((error as WorldChunkRegistryError).code).toBe(code);
  }
};

describe("world chunk identity and metadata", () => {
  it("creates canonical IDs for positive, negative, and negative-zero coordinates", () => {
    expect(worldChunkIdFromCoordinate({ x: 2, y: -3, z: -0 })).toBe("chunk:2:-3:0");
    expect(worldChunkIdFromCoordinate({ x: -12, y: 0, z: 8 })).toBe("chunk:-12:0:8");
    expectRegistryError(() => worldChunkIdFromCoordinate({ x: 0.5, y: 0, z: 0 }), "INVALID_COORDINATE");
    expectRegistryError(
      () => worldChunkIdFromCoordinate({ x: Number.MAX_SAFE_INTEGER + 1, y: 0, z: 0 }),
      "INVALID_COORDINATE"
    );
  });

  it("creates centered cubic absolute-world bounds", () => {
    const bounds = createWorldChunkBounds({ x: -2, y: -0, z: 3 }, 256);
    const fractionalBounds = createWorldChunkBounds({ x: 4, y: -2, z: 0 }, 0.25);

    expect(bounds.center.kind).toBe("WorldCoordinate");
    expect(bounds.center.frame.type).toBe("AbsoluteSystem");
    expect(bounds.center.value).toEqual(vec3(-512, 0, 768));
    expect(bounds.halfExtents).toEqual(vec3(128, 128, 128));
    expect(fractionalBounds.center.value).toEqual(vec3(1, -0.5, 0));
    expect(fractionalBounds.halfExtents).toEqual(vec3(0.125, 0.125, 0.125));
    expect(Object.is(bounds.center.value.y, -0)).toBe(false);
    expectRegistryError(() => createWorldChunkBounds({ x: 0, y: 0, z: 0 }, Number.NaN), "INVALID_CHUNK_SIZE");
  });

  it("rejects underflowing chunk sizes and overflowing derived centers with stable registry errors", () => {
    expectRegistryError(
      () => createWorldChunkBounds({ x: 0, y: 0, z: 0 }, Number.MIN_VALUE),
      "INVALID_CHUNK_SIZE"
    );
    expectRegistryError(
      () => createWorldChunkBounds({ x: 2, y: 0, z: 0 }, Number.MAX_VALUE),
      "INVALID_BOUNDS"
    );
    expectRegistryError(
      () => createWorldChunkBounds({ x: Number.MAX_SAFE_INTEGER, y: 0, z: 0 }, 10),
      "INVALID_BOUNDS"
    );
  });

  it("canonicalizes metadata collections and returns defensive deeply frozen data", () => {
    const entityIds = ["entity-z", "entity-a", "entity-z"];
    const renderBatchKeys = ["batch-b", "batch-a", "batch-b"];
    const input = {
      id: "chunk:0:0:0" as const,
      coordinate: { x: -0, y: 0, z: 0 },
      bounds: createWorldChunkBounds({ x: 0, y: 0, z: 0 }, CHUNK_SIZE),
      entityIds,
      renderBatchKeys,
      revision: 2,
      importance: 0.75,
      category: "asteroid"
    };

    const metadata = createWorldChunkMetadata(input);
    entityIds.push("entity-after");
    renderBatchKeys[0] = "changed";
    input.coordinate.x = 99;

    expect(metadata.coordinate).toEqual({ x: 0, y: 0, z: 0 });
    expect(metadata.entityIds).toEqual(["entity-a", "entity-z"]);
    expect(metadata.renderBatchKeys).toEqual(["batch-a", "batch-b"]);
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.coordinate)).toBe(true);
    expect(Object.isFrozen(metadata.bounds.center.value)).toBe(true);
    expect(Object.isFrozen(metadata.bounds.center.frame.originAbsolutePosition)).toBe(true);
    expect(Object.isFrozen(metadata.entityIds)).toBe(true);
  });

  it("rejects invalid metadata and non-finite or malformed bounds with stable codes", () => {
    const valid = metadataFor({ x: 0, y: 0, z: 0 });
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, revision: -1 }),
      "INVALID_METADATA"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, entityIds: ["ok", "  "] }),
      "INVALID_METADATA"
    );
    expectRegistryError(
      () =>
        createWorldChunkMetadata({
          ...valid,
          bounds: {
            ...valid.bounds,
            center: {
              ...valid.bounds.center,
              value: vec3(Number.POSITIVE_INFINITY, 0, 0)
            }
          }
        }),
      "INVALID_BOUNDS"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, bounds: { ...valid.bounds, halfExtents: vec3(5, 0, 5) } }),
      "INVALID_BOUNDS"
    );
  });

  it("returns stable registry errors for null, missing, and malformed runtime inputs", () => {
    const valid = metadataFor({ x: 0, y: 0, z: 0 });
    const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });

    expectRegistryError(
      () => worldChunkIdFromCoordinate(null as unknown as WorldChunkCoordinate),
      "INVALID_COORDINATE"
    );
    expectRegistryError(
      () => createWorldChunkBounds(undefined as unknown as WorldChunkCoordinate, CHUNK_SIZE),
      "INVALID_COORDINATE"
    );
    expectRegistryError(
      () => createWorldChunkMetadata(null as unknown as WorldChunkMetadata),
      "INVALID_METADATA"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, coordinate: undefined as unknown as WorldChunkCoordinate }),
      "INVALID_COORDINATE"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, bounds: null as unknown as WorldChunkMetadata["bounds"] }),
      "INVALID_BOUNDS"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, bounds: { ...valid.bounds, center: undefined as never } }),
      "INVALID_BOUNDS"
    );
    expectRegistryError(
      () =>
        createWorldChunkMetadata({
          ...valid,
          bounds: { ...valid.bounds, center: { ...valid.bounds.center, value: null as never } }
        }),
      "INVALID_BOUNDS"
    );
    expectRegistryError(
      () => createWorldChunkMetadata({ ...valid, bounds: { ...valid.bounds, halfExtents: undefined as never } }),
      "INVALID_BOUNDS"
    );
    expectRegistryError(() => registry.register(null as unknown as WorldChunkMetadata), "INVALID_METADATA");
    expectRegistryError(
      () => registry.queryRadius({ ...valid.bounds.center, value: null as never }, 1),
      "INVALID_BOUNDS"
    );
    expectRegistryError(() => registry.queryBounds(null as unknown as WorldChunkMetadata["bounds"]), "INVALID_BOUNDS");
  });
});

describe("world chunk registry", () => {
  it("keeps duplicate-ID, coordinate-conflict, and non-canonical-ID failures separately observable", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    registry.register(metadataFor({ x: 0, y: 0, z: 0 }));

    expectRegistryError(
      () => registry.register(metadataFor({ x: 1, y: 0, z: 0 }, { id: "chunk:0:0:0" })),
      "DUPLICATE_ID"
    );
    expectRegistryError(
      () => registry.register(metadataFor({ x: 0, y: 0, z: 0 }, { id: "chunk:8:0:0" })),
      "COORDINATE_CONFLICT"
    );
    expectRegistryError(
      () => registry.register(metadataFor({ x: 2, y: 0, z: 0 }, { id: "chunk:9:0:0" })),
      "NON_CANONICAL_ID"
    );
  });

  it("rejects invalid coordinates, grid-inconsistent bounds, and invalid registry sizes", () => {
    expectRegistryError(() => createWorldChunkRegistry({ chunkSizeMeters: 0 }), "INVALID_CHUNK_SIZE");
    const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    const valid = metadataFor({ x: 0, y: 0, z: 0 });

    expectRegistryError(
      () => registry.register({ ...valid, coordinate: { x: Number.NaN, y: 0, z: 0 } }),
      "INVALID_COORDINATE"
    );
    expectRegistryError(
      () => registry.register({ ...valid, id: "chunk:1:0:0", coordinate: { x: 1, y: 0, z: 0 }, bounds: valid.bounds }),
      "INVALID_BOUNDS"
    );
  });

  it("lists chunks in numeric coordinate order independent of registration order", () => {
    const coordinates: readonly WorldChunkCoordinate[] = [
      { x: 0, y: 2, z: 0 },
      { x: -2, y: 0, z: 0 },
      { x: 0, y: -1, z: 5 },
      { x: 0, y: -1, z: -2 }
    ];
    const first = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    const second = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });

    coordinates.forEach((coordinate) => first.register(metadataFor(coordinate)));
    [...coordinates].reverse().forEach((coordinate) => second.register(metadataFor(coordinate)));

    const expected = ["chunk:-2:0:0", "chunk:0:-1:-2", "chunk:0:-1:5", "chunk:0:2:0"];
    expect(first.listAll().map((chunk) => chunk.id)).toEqual(expected);
    expect(second.listAll().map((chunk) => chunk.id)).toEqual(expected);
    expect(first.snapshot().signature).toBe(second.snapshot().signature);
    expect(first.snapshot().signature).toBe(first.snapshot().signature);
  });

  it("uses inclusive sphere/AABB and AABB/AABB intersections at boundaries", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    registry.register(metadataFor({ x: 0, y: 0, z: 0 }));
    registry.register(metadataFor({ x: 2, y: 0, z: 0 }));
    registry.register(metadataFor({ x: 4, y: 0, z: 0 }));

    expect(registry.queryRadius(worldCoordinate(vec3(10, 0, 0)), 5).map((chunk) => chunk.id)).toEqual([
      "chunk:0:0:0",
      "chunk:2:0:0"
    ]);
    expect(
      registry
        .queryBounds({ center: worldCoordinate(vec3(10, 0, 0)), halfExtents: vec3(5, 5, 5) })
        .map((chunk) => chunk.id)
    ).toEqual(["chunk:0:0:0", "chunk:2:0:0"]);
    expect(registry.queryRadius(worldCoordinate(vec3(10, 20, 0)), 5)).toEqual([]);
  });

  it("does not report a radius intersection when large finite squared distances would overflow", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: 1e307 });
    const coordinate = { x: 15, y: 0, z: 0 } as const;
    registry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(coordinate),
        coordinate,
        bounds: createWorldChunkBounds(coordinate, 1e307),
        entityIds: [],
        renderBatchKeys: [],
        revision: 0
      })
    );

    expect(registry.queryRadius(worldCoordinate(vec3(0, 0, 0)), 1e308)).toEqual([]);
  });

  it("uses finite AABB endpoints before subtracting extreme radius-query positions", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: 1e308 });
    const coordinate = { x: 1, y: 0, z: 0 } as const;
    registry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(coordinate),
        coordinate,
        bounds: createWorldChunkBounds(coordinate, 1e308),
        entityIds: [],
        renderBatchKeys: [],
        revision: 0
      })
    );

    expect(registry.queryRadius(worldCoordinate(vec3(-1.2e308, 0, 0)), 1.75e308).map((chunk) => chunk.id)).toEqual([
      "chunk:1:0:0"
    ]);
  });

  it("uses finite endpoints for disjoint huge AABBs and rejects endpoint overflow", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: 1e307 });
    const coordinate = { x: -9, y: 0, z: 0 } as const;
    registry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(coordinate),
        coordinate,
        bounds: createWorldChunkBounds(coordinate, 1e307),
        entityIds: [],
        renderBatchKeys: [],
        revision: 0
      })
    );

    expect(
      registry.queryBounds({ center: worldCoordinate(vec3(9e307, 0, 0)), halfExtents: vec3(8e307, 1, 1) })
    ).toEqual([]);
    expectRegistryError(
      () => registry.queryBounds({ center: worldCoordinate(vec3(1.6e308, 0, 0)), halfExtents: vec3(1e308, 1, 1) }),
      "INVALID_BOUNDS"
    );
  });

  it("stores canonical absolute-system bounds instead of caller-supplied frame metadata", () => {
    const coordinate = { x: 1, y: -2, z: 3 } as const;
    const canonicalBounds = createWorldChunkBounds(coordinate, CHUNK_SIZE);
    const fakeFrameBounds = {
      center: worldCoordinate(canonicalBounds.center.value, {
        id: "caller-controlled-absolute-frame",
        type: "AbsoluteSystem",
        originAbsolutePosition: vec3(999, -555, 123),
        orientation: "identity",
        units: "meters",
        validTimeTick: 42
      }),
      halfExtents: canonicalBounds.halfExtents
    } as const;
    const fakeRegistry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    const canonicalRegistry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });

    const stored = fakeRegistry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(coordinate),
        coordinate,
        bounds: fakeFrameBounds,
        entityIds: ["entity-a"],
        renderBatchKeys: ["batch-a"],
        revision: 1
      })
    );
    canonicalRegistry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(coordinate),
        coordinate,
        bounds: canonicalBounds,
        entityIds: ["entity-a"],
        renderBatchKeys: ["batch-a"],
        revision: 1
      })
    );

    expect(stored.bounds.center.frame).toEqual(ABSOLUTE_SYSTEM_FRAME);
    expect(stored.bounds.center.frame.id).toBe("absolute-system");
    expect(stored.bounds.center.frame.originAbsolutePosition).toEqual(vec3(0, 0, 0));
    expect(stored.bounds.center.frame.validTimeTick).toBeUndefined();
    expect(fakeRegistry.snapshot()).toEqual(canonicalRegistry.snapshot());
  });

  it("keeps radius and bounds query results stable across registration order", () => {
    const coordinates: readonly WorldChunkCoordinate[] = [
      { x: 3, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -2, z: 0 }
    ];
    const forward = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    const reversed = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    coordinates.forEach((coordinate) => forward.register(metadataFor(coordinate)));
    [...coordinates].reverse().forEach((coordinate) => reversed.register(metadataFor(coordinate)));

    const radiusCenter = worldCoordinate(vec3(5, 0, 0));
    const queryBounds = { center: worldCoordinate(vec3(5, 0, 0)), halfExtents: vec3(30, 30, 30) } as const;
    const expected = ["chunk:-1:0:0", "chunk:0:-2:0", "chunk:0:1:0", "chunk:3:0:0"];

    expect(forward.queryRadius(radiusCenter, 35).map((chunk) => chunk.id)).toEqual(expected);
    expect(reversed.queryRadius(radiusCenter, 35).map((chunk) => chunk.id)).toEqual(expected);
    expect(forward.queryBounds(queryBounds).map((chunk) => chunk.id)).toEqual(expected);
    expect(reversed.queryBounds(queryBounds).map((chunk) => chunk.id)).toEqual(expected);
  });

  it("supports normalized lookups and unregister without exposing mutable registry state", () => {
    const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
    const source = metadataFor(
      { x: -0, y: -1, z: 2 },
      { entityIds: ["b", "a"], renderBatchKeys: ["render-z", "render-a"] }
    );
    const registered = registry.register(source);

    expect(registry.getById("chunk:0:-1:2")).toBe(registered);
    expect(registry.getByCoordinate({ x: -0, y: -1, z: 2 })).toBe(registered);
    expect(registry.getByCoordinate({ x: 99, y: 0, z: 0 })).toBeUndefined();

    const snapshot = registry.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.chunks)).toBe(true);
    expect(Object.isFrozen(snapshot.chunks[0].bounds.halfExtents)).toBe(true);
    expect(snapshot.chunks[0].entityIds).toEqual(["a", "b"]);

    expect(registry.unregister("chunk:0:-1:2")).toBe(true);
    expect(registry.unregister("chunk:0:-1:2")).toBe(false);
    expect(registry.getById("chunk:0:-1:2")).toBeUndefined();
    expect(registry.listAll()).toEqual([]);
  });
});
