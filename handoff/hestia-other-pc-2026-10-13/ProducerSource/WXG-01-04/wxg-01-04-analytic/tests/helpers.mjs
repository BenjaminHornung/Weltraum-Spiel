import {readFileSync} from 'node:fs';
import {root,verifyConsumer,verifyBuild,bytes} from '../scripts/bindings.mjs';
import {resolve} from 'node:path';
// Executable consumer modules are dynamically imported only after the complete byte/membership check.
verifyConsumer();verifyBuild();
const api=await import('../dist/src/fixtures.js');
export const bundles=api.bundles;
export const hestiaAuthoring=api.hestiaAuthoring;
export const config=JSON.parse(readFileSync(resolve(root,'fixtures/authoring-config.json')));
export const terrainGenerator={id:'frozen.hestia-generator-source',version:1,digest:'sha256:'+JSON.parse(readFileSync(resolve(root,'ConsumerBindings.json'))).productReads.find(f=>f.path.endsWith('/seed.ts')).sha256};
export async function input(index=2){const f=(await bundles())[index];return {bundle:f,macro:await api.macroFixture(f,terrainGenerator),config};}
export async function authoringInput(){const bundle=await hestiaAuthoring();return {bundle,macro:await api.macroFixture(bundle,terrainGenerator),config};}
export const canonical=(await import('../dist/src/common.js')).canonicalCelestialJson;
export async function reseal(value){const {digest,...payload}=value;return (await import('../dist/src/common.js')).sealProfile(payload);}
export async function exposure(view,edit={}){
  const {sealProfile,assumption,contentDigest}=await import('../dist/src/common.js');
  return sealProfile({id:'fixture.exposure.A',version:1,schema:'wxg.local-exposure/v1',worldId:view.input.bundle.binding.worldId,sessionId:view.input.bundle.binding.sessionId,
    sourceOwner:'fixture.terrain-owner',sourceEpoch:'terrain.1',sourceRevision:'1',terrain:{id:'fixture.terrain',version:1,digest:await contentDigest({wall:'present'})},regionId:'region.A',frameId:view.input.bundle.query.frameId,
    neighborDigest:await contentDigest({neighbors:'known'}),coverage:'Complete',shelterFraction:0.2,roughness:0.3,provenance:assumption,...edit});
}
