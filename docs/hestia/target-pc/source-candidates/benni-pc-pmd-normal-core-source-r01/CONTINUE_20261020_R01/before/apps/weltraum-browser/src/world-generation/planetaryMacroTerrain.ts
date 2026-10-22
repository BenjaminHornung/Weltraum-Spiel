import { canonicalCelestialJson } from "../celestial/canonical";
import type { CelestialBodyDefinition } from "../celestial/types";
import { createCelestialBodyDefinition } from "../celestial/validation";
import { createSimulationTick, type SimulationTick } from "../persistence/time";
import { createFrameStateAtTime } from "../spatial/frameGraph";
import { assertSameUniverseTime } from "../spatial/frameValidation";
import { createBodyFixedFrameId } from "../spatial/ids";
import { createSurfaceLocalFrameDefinition, createSurfaceLocalFrameState, type SurfaceLocalFrameState } from "../spatial/surfaceLocalFrame";
import { transformPosition } from "../spatial/transforms";
import type { FrameStateAtTime } from "../spatial/types";
import { createVoxelBrick, validateVoxelBrick, storedSampleToGlobalCoordinate, globalSamplePositionMeters } from "../voxel/brick";
import { allocateVoxelChannels, VOXEL_BRICK_SAMPLE_DIMENSIONS, VOXEL_BRICK_CELL_DIMENSIONS, VOXEL_BRICK_APRON_WIDTH, voxelSampleIndex } from "../voxel/channels";
import { voxelBodyId, surfaceFrameId, voxelRegionId, generatorVersion, sourceRevision, editRevision, type VoxelRegionId } from "../voxel/ids";
import { HESTIA_MATERIAL_REGISTRY_V1 } from "../voxel/materials";
import { VOXEL_BRICK_SCHEMA_VERSION, VOXEL_BRICK_LAYOUT_VERSION, VOXEL_BRICK_INDEX_ORDER, type VoxelCoordinate } from "../voxel/types";
import { validatePlanetaryMacro, samplePlanetaryMacro, planetaryMacroDigest, PLANETARY_MACRO_GENERATOR, PLANETARY_MACRO_KNOWLEDGE,
  type PlanetaryMacroSource, type PlanetaryMacroProfile } from "./planetaryMacro";

export interface PlanetaryBrickInput {
  readonly source: PlanetaryMacroSource; readonly expectedBody: CelestialBodyDefinition; readonly expectedProfile: PlanetaryMacroProfile;
  readonly bodyFixedFrame: FrameStateAtTime; readonly surfaceFrame: SurfaceLocalFrameState;
  readonly regionId: VoxelRegionId; readonly brickCoordinate: VoxelCoordinate; readonly voxelSizeMeters: 0.25 | 0.5;
  readonly sourceRevision: number; readonly editRevision: number; readonly causalTick: SimulationTick;
}
/** Adapter to the existing Hestia V1 voxel/material contract; this is not a general material authority. */
export async function createPlanetaryBrick(input: PlanetaryBrickInput) {
  const body = createCelestialBodyDefinition(input.expectedBody);
  const source = await validatePlanetaryMacro(input.source, body, input.expectedProfile);
  const bodyFixed = createFrameStateAtTime(input.bodyFixedFrame);
  assertSameUniverseTime(bodyFixed.time, input.surfaceFrame.time);
  const causalTick = createSimulationTick(input.causalTick);
  const definition = createSurfaceLocalFrameDefinition(input.surfaceFrame.definition);
  if (bodyFixed.time.tick !== causalTick || bodyFixed.frameId !== createBodyFixedFrameId(body.bodyId)
    || definition.parentFrameId !== bodyFixed.frameId || definition.anchor.bodyId !== body.bodyId
    || input.surfaceFrame.systemFrameId !== bodyFixed.systemFrameId) throw new TypeError("PMD_TERRAIN_FRAME_OR_TICK");
  const surface = createSurfaceLocalFrameState(definition, body, bodyFixed, bodyFixed.time);
  if (canonicalCelestialJson(surface) !== canonicalCelestialJson(input.surfaceFrame)) throw new TypeError("PMD_SURFACE_STATE");
  if (input.voxelSizeMeters !== 0.25 && input.voxelSizeMeters !== 0.5) throw new RangeError("PMD_V1_VOXEL_SIZE");
  const regionId = voxelRegionId(input.regionId), revision = sourceRevision(input.sourceRevision), edit = editRevision(input.editRevision);
  const coordinate = Object.freeze({ ...input.brickCoordinate });
  // Validate the coordinate before entering the sampling loop, using the existing global-coordinate boundary.
  storedSampleToGlobalCoordinate(coordinate, { x: 0, y: 0, z: 0 });
  const channels = allocateVoxelChannels(), dims = VOXEL_BRICK_SAMPLE_DIMENSIONS;
  // Explicit generated SolidRock ID0 also fills unused air samples; positive density determines air.
  channels.materialBuffer.fill(0);
  for (let z = 0; z < dims.z; z++) for (let y = 0; y < dims.y; y++) for (let x = 0; x < dims.x; x++) {
    const stored = { x, y, z }, global = storedSampleToGlobalCoordinate(coordinate, stored);
    const local = globalSamplePositionMeters(global, input.voxelSizeMeters);
    const p = transformPosition(local, surface, bodyFixed), h = samplePlanetaryMacro(source, p).elevationMeters;
    channels.densityBuffer[voxelSampleIndex(stored)] = Math.fround(Math.hypot(p.x, p.y, p.z) - source.radiusMeters - h);
  }
  const brick = createVoxelBrick({ schemaVersion: VOXEL_BRICK_SCHEMA_VERSION, layoutVersion: VOXEL_BRICK_LAYOUT_VERSION,
    indexOrder: VOXEL_BRICK_INDEX_ORDER, bodyId: voxelBodyId(body.bodyId), surfaceFrameId: surfaceFrameId(surface.frameId), regionId,
    brickCoordinate: coordinate, voxelSizeMeters: input.voxelSizeMeters, cellDimensions: VOXEL_BRICK_CELL_DIMENSIONS,
    sampleDimensions: dims, apronWidth: VOXEL_BRICK_APRON_WIDTH, generatorVersion: generatorVersion(PLANETARY_MACRO_GENERATOR),
    materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_V1.version, sourceRevision: revision, editRevision: edit, ...channels });
  if (!validateVoxelBrick(brick).valid) throw new TypeError("PMD_BRICK_INVALID");
  const pmd = Object.freeze({ id: source.id, version: source.version, digest: source.digest });
  const bindingData = Object.freeze({ pmd, bodyFixed, surface, regionId, brickCoordinate: coordinate, voxelSizeMeters: input.voxelSizeMeters,
    sourceRevision: revision, editRevision: edit, causalTick, brickContentHash: brick.contentHash,
    materialPolicy: source.profile.materialPolicy, knowledge: PLANETARY_MACRO_KNOWLEDGE });
  return Object.freeze({ brick, pmd, frame: definition, knowledge: PLANETARY_MACRO_KNOWLEDGE,
    binding: Object.freeze({ id: "pmd.terrain.candidate", version: 1, digest: await planetaryMacroDigest(bindingData) }), bindingData });
}
