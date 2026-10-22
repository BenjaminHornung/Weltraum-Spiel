import {contentDigest,exactRef,same} from '../common';
import {samplePlanetaryMacro,validatePlanetaryMacro} from './planetaryMacro';
import type {PlanetaryMacroSource} from './planetaryMacro';
import {PMD_GENERATOR_VERSION,PMD_KNOWLEDGE} from './planetaryMacroProfile';
import type {CelestialBodyDefinition} from '../engine/celestial/types';
import {createCelestialBodyDefinition} from '../engine/celestial/validation';
import {createFrameStateAtTime} from '../engine/spatial/frameGraph';
import {createBodyFixedFrameId,createSystemInertialFrameId,createSurfaceLocalFrameId} from '../engine/spatial/ids';
import {createSurfaceLocalFrameDefinition,createSurfaceLocalFrameState,computeSurfaceBasis} from '../engine/spatial/surfaceLocalFrame';
import {transformPosition} from '../engine/spatial/transforms';
import type {FrameStateAtTime,SpatialVector3} from '../engine/spatial/types';
import {createUniverseClock} from '../engine/persistence/time';
import {allocateVoxelChannels,VOXEL_BRICK_SAMPLE_DIMENSIONS,VOXEL_BRICK_CELL_DIMENSIONS,VOXEL_BRICK_APRON_WIDTH,voxelSampleIndex} from '../engine/voxel/channels';
import {createVoxelBrick,storedSampleToCoreCoordinate,validateVoxelBrick} from '../engine/voxel/brick';
import {VOXEL_BRICK_SCHEMA_VERSION,VOXEL_BRICK_LAYOUT_VERSION,VOXEL_BRICK_INDEX_ORDER} from '../engine/voxel/types';
import {voxelBodyId,surfaceFrameId,voxelRegionId,generatorVersion,sourceRevision,editRevision} from '../engine/voxel/ids';
import {HESTIA_MATERIAL_REGISTRY_V1} from '../engine/voxel/materials';

export function createPlanetaryFrames(s:PlanetaryMacroSource,rawBody:CelestialBodyDefinition,latitudeRadians=0,longitudeRadians=0,suffix='pmd.candidate') {
  const body=createCelestialBodyDefinition(rawBody);
  same({bodyId:s.bodyId,radiusMeters:s.radiusMeters},{bodyId:body.bodyId,radiusMeters:body.radiusMeters},'pmd.frameBody');
  const time=createUniverseClock(0),zero={x:0,y:0,z:0};
  const bodyFixed=createFrameStateAtTime({frameId:createBodyFixedFrameId(s.bodyId),systemFrameId:createSystemInertialFrameId(),time,
    originPositionMeters:zero,orientation:{x:0,y:0,z:0,w:1},originVelocityMetersPerSecond:zero,angularVelocityRadiansPerSecond:zero});
  const anchor={bodyId:s.bodyId,latitudeRadians,longitudeRadians,altitudeMeters:0};
  const height=samplePlanetaryMacro(s,computeSurfaceBasis(anchor).up).elevationMeters;
  const definition=createSurfaceLocalFrameDefinition({frameId:createSurfaceLocalFrameId(suffix),anchor:{...anchor,altitudeMeters:height-8}});
  return {bodyFixed,surface:createSurfaceLocalFrameState(definition,body,bodyFixed,time)};
}
export function samplePlanetarySurfacePoint(s:PlanetaryMacroSource,p:SpatialVector3,local:FrameStateAtTime,bodyFixed:FrameStateAtTime) {
  if(bodyFixed.frameId!==s.bodyFixed.frameId)throw Error('PMD_FRAME');
  return samplePlanetaryMacro(s,transformPosition(p,local,bodyFixed));
}
export async function createPlanetaryBrick(raw:PlanetaryMacroSource,body:CelestialBodyDefinition,frames=createPlanetaryFrames(raw,body)) {
  const s=await validatePlanetaryMacro(raw,body);
  if(frames.bodyFixed.frameId!==s.bodyFixed.frameId||frames.surface.definition.anchor.bodyId!==s.bodyId)throw Error('PMD_TERRAIN_FRAME');
  const channels=allocateVoxelChannels(),dims=VOXEL_BRICK_SAMPLE_DIMENSIONS;
  // ID0 is an explicit existing generated SolidRock policy, also for unused air samples; density determines air.
  channels.materialBuffer.fill(0);
  for(let z=0;z<dims.z;z++)for(let y=0;y<dims.y;y++)for(let x=0;x<dims.x;x++) {
    const stored={x,y,z},core=storedSampleToCoreCoordinate(stored);
    const p=transformPosition({x:core.x*0.25,y:core.y*0.25,z:core.z*0.25},frames.surface,frames.bodyFixed);
    const h=samplePlanetaryMacro(s,p).elevationMeters;
    channels.densityBuffer[voxelSampleIndex(stored)]=Math.fround(Math.hypot(p.x,p.y,p.z)-s.radiusMeters-h);
  }
  const brick=createVoxelBrick({schemaVersion:VOXEL_BRICK_SCHEMA_VERSION,layoutVersion:VOXEL_BRICK_LAYOUT_VERSION,indexOrder:VOXEL_BRICK_INDEX_ORDER,
    bodyId:voxelBodyId(s.bodyId),surfaceFrameId:surfaceFrameId(frames.surface.frameId),regionId:voxelRegionId('pmd.candidate.region'),brickCoordinate:{x:0,y:0,z:0},
    voxelSizeMeters:0.25,cellDimensions:VOXEL_BRICK_CELL_DIMENSIONS,sampleDimensions:dims,apronWidth:VOXEL_BRICK_APRON_WIDTH,
    generatorVersion:generatorVersion(PMD_GENERATOR_VERSION),materialRegistryVersion:HESTIA_MATERIAL_REGISTRY_V1.version,
    sourceRevision:sourceRevision(1),editRevision:editRevision(0),...channels});
  if(!validateVoxelBrick(brick).valid)throw Error('PMD_BRICK_INVALID');
  const pmd=exactRef(s),frame=frames.surface.definition;
  const binding={pmd,frame,brickContentHash:brick.contentHash,materialPolicy:s.profile.materialPolicy,knowledge:PMD_KNOWLEDGE};
  return Object.freeze({brick,pmd,frame,knowledge:PMD_KNOWLEDGE,binding:{id:'pmd.terrain.candidate',version:1,digest:await contentDigest(binding)}});
}
