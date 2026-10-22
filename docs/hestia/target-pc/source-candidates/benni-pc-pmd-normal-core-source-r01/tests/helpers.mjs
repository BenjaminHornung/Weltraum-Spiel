import {readFileSync} from 'node:fs';
import {root,verifyConsumer,verifyBuild,bytes} from '../scripts/bindings.mjs';
import {resolve} from 'node:path';
// Executable consumer modules are dynamically imported only after the complete byte/membership check.
verifyConsumer();verifyBuild();
const {STARTER_BODY_IDS,STARTER_CELESTIAL_CATALOG}=await import('../dist/apps/weltraum-browser/src/celestial/starterSystem.js');
export const pmdBody=STARTER_CELESTIAL_CATALOG.indexes.bodyById[STARTER_BODY_IDS.hestia];
export const pmdOtherBody=STARTER_CELESTIAL_CATALOG.indexes.bodyById[STARTER_BODY_IDS.luma];
export const {candidateProfile}=await import('../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/world-generation/planetaryMacroProfile.js');
const api=await import('../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/fixtures.js');
export const bundles=api.bundles;
export const hestiaAuthoring=api.hestiaAuthoring;
export const config=JSON.parse(readFileSync(resolve(root,'fixtures/authoring-config.json')));
export const terrainGenerator={id:'frozen.hestia-generator-source',version:1,digest:'sha256:'+JSON.parse(readFileSync(resolve(root,'ConsumerBindings.json'))).productReads.find(f=>f.path.endsWith('/seed.ts')).sha256};
export async function input(index=2){const f=(await bundles())[index];return {bundle:f,macro:await api.macroFixture(f,terrainGenerator),config};}
export async function authoringInput(){const bundle=await hestiaAuthoring();return {bundle,macro:await api.macroFixture(bundle,terrainGenerator),config};}
export const canonical=(await import('../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/common.js')).canonicalCelestialJson;
export async function reseal(value){const {digest,...payload}=value;return (await import('../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/common.js')).sealProfile(payload);}
export async function exposure(view,edit={}){
  const {sealProfile,assumption,contentDigest}=await import('../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/common.js');
  return sealProfile({id:'fixture.exposure.A',version:1,schema:'wxg.local-exposure/v1',worldId:view.input.bundle.binding.worldId,sessionId:view.input.bundle.binding.sessionId,
    sourceOwner:'fixture.terrain-owner',sourceEpoch:'terrain.1',sourceRevision:'1',terrain:{id:'fixture.terrain',version:1,digest:await contentDigest({wall:'present'})},regionId:'region.A',frameId:view.input.bundle.query.frameId,
    neighborDigest:await contentDigest({neighbors:'known'}),coverage:'Complete',shelterFraction:0.2,roughness:0.3,provenance:assumption,...edit});
}

const {createFrameStateAtTime}=await import('../dist/apps/weltraum-browser/src/spatial/frameGraph.js');
const {createBodyFixedFrameId,createSystemInertialFrameId,createSurfaceLocalFrameId}=await import('../dist/apps/weltraum-browser/src/spatial/ids.js');
const {createSurfaceLocalFrameDefinition,createSurfaceLocalFrameState,computeSurfaceBasis}=await import('../dist/apps/weltraum-browser/src/spatial/surfaceLocalFrame.js');
const {createUniverseClock}=await import('../dist/apps/weltraum-browser/src/persistence/time.js');
const {samplePlanetaryMacro}=await import('../dist/apps/weltraum-browser/src/world-generation/planetaryMacro.js');
export function createCandidateFrames(source,body,latitudeRadians=0,longitudeRadians=0,suffix='pmd.candidate'){
 if(source.bodyId!==body.bodyId||source.radiusMeters!==body.radiusMeters)throw Error('pmd.frameBody');
 const time=createUniverseClock(120),zero={x:0,y:0,z:0};
 const bodyFixed=createFrameStateAtTime({frameId:createBodyFixedFrameId(body.bodyId),systemFrameId:createSystemInertialFrameId(),time,
 originPositionMeters:{x:1000,y:-20,z:30},orientation:{x:0,y:0,z:Math.sin(0.1),w:Math.cos(0.1)},originVelocityMetersPerSecond:zero,angularVelocityRadiansPerSecond:zero});
 const anchor={bodyId:body.bodyId,latitudeRadians,longitudeRadians,altitudeMeters:0};
 const height=samplePlanetaryMacro(source,computeSurfaceBasis(anchor).up).elevationMeters;
 const definition=createSurfaceLocalFrameDefinition({frameId:createSurfaceLocalFrameId(suffix),anchor:{...anchor,altitudeMeters:height-8}});
 return {bodyFixed,surface:createSurfaceLocalFrameState(definition,body,bodyFixed,time)};
}
export const candidateBrickInput=(source,body,frames)=>({source,expectedBody:body,expectedProfile:candidateProfile(source.profile.amplitudeMeters),bodyFixedFrame:frames.bodyFixed,
 surfaceFrame:frames.surface,regionId:'pmd.fixture.region',brickCoordinate:{x:0,y:0,z:0},voxelSizeMeters:0.25,sourceRevision:7,editRevision:0,causalTick:frames.bodyFixed.time.tick});
