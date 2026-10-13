import type { NavigationMapEntitySnapshot } from "../navigation/map/contracts";
import {
  createWorldChunkBounds,
  createWorldChunkMetadata,
  createWorldChunkRegistry,
  worldChunkIdFromCoordinate,
  type WorldChunkCoordinate,
  type WorldChunkId,
  type WorldChunkRegistrySnapshot
} from "./chunkRegistry";
import type { WorldCoordinate } from "./frames";
import type { WorldEntityState } from "./floatingOrigin";
import { provingGroundAsteroidField } from "./provingGroundWorld";
import {
  planWorldStreaming,
  type WorldStreamingPolicy,
  type WorldStreamingSnapshot
} from "./worldStreaming";

export const NAVIGATION_MAP_WORLD_CHUNK_SIZE_METERS = 256;

export const NAVIGATION_MAP_WORLD_STREAMING_POLICY: WorldStreamingPolicy = Object.freeze({
  simulationBubbleId: "browser-navigation-map",
  fullUpdateRadius: 256,
  snapshotRadius: 3_200,
  nearLodRadius: 512,
  mediumLodRadius: 1_600,
  farLodRadius: 3_200,
  simulationHysteresisMeters: 32,
  renderHysteresisMeters: 32,
  budgets: Object.freeze({
    maxFullChunks: 8,
    maxSnapshotChunks: 64,
    maxVisibleChunks: 64,
    maxEstimatedEntityCount: 256
  })
});

export interface NavigationMapWorldAdapterSnapshot {
  readonly registry: WorldChunkRegistrySnapshot;
  readonly streaming: WorldStreamingSnapshot;
  readonly entities: readonly NavigationMapEntitySnapshot[];
}

export interface NavigationMapWorldAdapter {
  readonly registry: WorldChunkRegistrySnapshot;
  readonly policy: WorldStreamingPolicy;
  snapshot(
    observerAbsolutePosition: WorldCoordinate,
    previous?: NavigationMapWorldAdapterSnapshot
  ): NavigationMapWorldAdapterSnapshot;
}

const codeUnitCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const chunkAxisFor = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new Error("Navigation map world entity positions must be finite");
  }
  const coordinate = Math.floor((value + NAVIGATION_MAP_WORLD_CHUNK_SIZE_METERS / 2) / NAVIGATION_MAP_WORLD_CHUNK_SIZE_METERS);
  if (!Number.isSafeInteger(coordinate)) {
    throw new Error("Navigation map world entity position exceeds the supported chunk grid");
  }
  return Object.is(coordinate, -0) ? 0 : coordinate;
};

export const navigationMapChunkCoordinateFor = (position: WorldCoordinate): WorldChunkCoordinate => {
  if (position.kind !== "WorldCoordinate" || position.frame.type !== "AbsoluteSystem") {
    throw new Error("Navigation map world entities require absolute WorldCoordinate positions");
  }
  return Object.freeze({
    x: chunkAxisFor(position.value.x),
    y: chunkAxisFor(position.value.y),
    z: chunkAxisFor(position.value.z)
  });
};

const buildRegistry = (
  entities: readonly WorldEntityState[]
): { readonly snapshot: WorldChunkRegistrySnapshot; readonly entityById: ReadonlyMap<string, WorldEntityState> } => {
  const registry = createWorldChunkRegistry({ chunkSizeMeters: NAVIGATION_MAP_WORLD_CHUNK_SIZE_METERS });
  const entityById = new Map<string, WorldEntityState>();
  const entityIdsByChunk = new Map<WorldChunkId, string[]>();
  const coordinateByChunk = new Map<WorldChunkId, WorldChunkCoordinate>();

  for (const entity of entities) {
    if (!entity.id.trim() || entityById.has(entity.id)) {
      throw new Error(`Navigation map world entity ids must be non-empty and unique: ${entity.id}`);
    }
    const coordinate = navigationMapChunkCoordinateFor(entity.absolutePosition);
    const chunkId = worldChunkIdFromCoordinate(coordinate);
    entityById.set(entity.id, entity);
    coordinateByChunk.set(chunkId, coordinate);
    const chunkEntityIds = entityIdsByChunk.get(chunkId) ?? [];
    chunkEntityIds.push(entity.id);
    entityIdsByChunk.set(chunkId, chunkEntityIds);
  }

  [...entityIdsByChunk.keys()].sort(codeUnitCompare).forEach((chunkId) => {
    const coordinate = coordinateByChunk.get(chunkId);
    if (!coordinate) {
      throw new Error(`Missing coordinate for navigation map chunk ${chunkId}`);
    }
    registry.register(createWorldChunkMetadata({
      id: chunkId,
      coordinate,
      bounds: createWorldChunkBounds(coordinate, NAVIGATION_MAP_WORLD_CHUNK_SIZE_METERS),
      entityIds: entityIdsByChunk.get(chunkId) ?? [],
      renderBatchKeys: [],
      revision: 0,
      category: "navigation-map-world"
    }));
  });

  return { snapshot: registry.snapshot(), entityById };
};

export const createNavigationMapWorldAdapter = (
  entities: readonly WorldEntityState[] = provingGroundAsteroidField
): NavigationMapWorldAdapter => {
  const { snapshot: registry, entityById } = buildRegistry(entities);
  const adapter: NavigationMapWorldAdapter = {
    registry,
    policy: NAVIGATION_MAP_WORLD_STREAMING_POLICY,
    snapshot(observerAbsolutePosition, previous) {
      const streaming = planWorldStreaming({
        registry,
        observerAbsolutePosition,
        policy: NAVIGATION_MAP_WORLD_STREAMING_POLICY,
        ...(previous ? { previousSnapshot: previous.streaming } : {})
      });
      const residenceByChunk = new Map<WorldChunkId, NavigationMapEntitySnapshot["residence"]>();
      const renderLodByChunk = new Map(streaming.assignments.map((assignment) => [assignment.chunkId, assignment.finalRenderLod]));
      for (const assignment of streaming.assignments) {
        if (assignment.finalSimulationMode !== "Dormant") {
          residenceByChunk.set(assignment.chunkId, assignment.finalSimulationMode);
        }
      }
      const residentEntities = registry.chunks.flatMap((chunk): NavigationMapEntitySnapshot[] => {
        const residence = residenceByChunk.get(chunk.id);
        if (!residence) {
          return [];
        }
        return chunk.entityIds.map((entityId) => {
          const entity = entityById.get(entityId);
          if (!entity) {
            throw new Error(`Navigation map chunk ${chunk.id} references missing entity ${entityId}`);
          }
          return {
            id: entity.id,
            absolutePosition: entity.absolutePosition,
            chunkId: chunk.id,
            residence,
            renderLod: renderLodByChunk.get(chunk.id) ?? "Culled",
            presentationKey: entity.renderBatchKey === "low-poly-asteroid" ? "asteroid" : "world-entity"
          };
        });
      }).sort((left, right) => codeUnitCompare(left.id, right.id));
      return deepFreeze({ registry, streaming, entities: residentEntities });
    }
  };
  return Object.freeze(adapter);
};

export const createProvingGroundNavigationMapWorldAdapter = (): NavigationMapWorldAdapter =>
  createNavigationMapWorldAdapter(provingGroundAsteroidField);
