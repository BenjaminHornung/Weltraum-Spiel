import {createFixtureBundle} from '../vendor/cel/dist/src/fixtures.js';
import {IMPLEMENTATION_DIGEST as CEL_MODEL} from '../vendor/cel/dist/src/model-pin.js';
import {sealProfile,exactRef,contentDigest,validateBundle,immutable,assumption} from './common';
import type {FixtureBundle,ExactRef} from './common';
import type {MacroSource} from './macro';
import type {ClimateConfig} from './climate';
export async function bundles():Promise<readonly FixtureBundle[]> {return createFixtureBundle(CEL_MODEL);}
export async function hestiaAuthoring():Promise<FixtureBundle> {
  const original=(await bundles())[0];const {digest:pd,...p}=original.physics;const {digest:od,...o}=original.optics;const {digest:wd,...w}=original.profile;
  const physics=await sealProfile({...p,id:'fixture.physics.HestiaAuthoring',gasMixture:[{speciesId:'N2',moleFraction:1}],
    thermodynamics:{molarMassKgPerMol:0.028,specificHeatJPerKgK:1000,provenance:assumption},scaleHeightMeters:1000,outerRadiusMeters:p.radiusMeters+10000});
  const optics=await sealProfile({...o,id:'fixture.optics.HestiaAuthoring',physics:exactRef(physics)});
  const profile=await sealProfile({...w,id:'fixture.weather.HestiaAuthoring',physics:exactRef(physics),optics:exactRef(optics),
    climateNormals:{id:'fixture.climate.HestiaAuthoring',version:1,digest:await contentDigest(original.climate)},macroGeography:{id:'fixture.macro-projection.HestiaAuthoring',version:1,digest:await contentDigest(original.geography)}});
  return validateBundle({...original,name:'HestiaAuthoring',physics,optics,profile,binding:{...original.binding,profile:exactRef(profile),climateNormals:profile.climateNormals,macroGeography:profile.macroGeography,model:profile.model}});
}
export async function macroFixture(f:FixtureBundle,terrainGenerator:ExactRef):Promise<MacroSource|null> {
  if(f.physics.pressureCoordinate==='PressurePa')return null;
  return sealProfile({id:'wxg.macro.'+f.name,version:1,schema:'wxg.synthetic-macro/v1' as const,bodyId:f.profile.bodyId,sourceOwner:'wxg.synthetic-macro-author',sourceRevision:'1',terrainGenerator,provenance:assumption,
    continentAxis:{x:1,y:0.2,z:0.3},maximumElevationMeters:1000,roughness:0.4,reservoirSpeciesId:null,reservoirKgPerM2:0,missingFaces:[]});
}
