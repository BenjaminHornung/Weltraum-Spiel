import { STARTER_CELESTIAL_CATALOG as catalog } from '../snapshot/product/celestial/starterSystem';
import { createBodyFixedFrameId } from '../snapshot/product/spatial/ids';
import { createSimulationTick } from '../snapshot/product/persistence/time';
import { orbitalPeriodSeconds } from '../snapshot/product/celestial/kepler';
import { contentDigest, exactRef, sealProfile, validateBundle, validateExactRef } from './contracts';
import type { Digest, FixtureBundle, AtmospherePhysicsProfile, AtmosphereOpticsProfile, PlanetWeatherProfile, PlanetWeatherQuery, Provenance, ReadRecord } from './types';

const assumption:Provenance={kind:'TestAssumption',note:'Synthetic schema/read fixture only; not natural constants or product climate.'};
export async function createFixtureBundle(implementationDigest:Digest):Promise<readonly FixtureBundle[]> {
  validateExactRef({id:'authored-diagnostic-read-v1',version:1,digest:implementationDigest});
  const fixtures:FixtureBundle[]=[];
  const names=['Hestia','Airless','Dust','Methane','GasGiant','TidallyLocked'];
  const sourceIds=['planet.hestia','planet.korus','planet.tharos','planet.nereion','planet.aureon','planet.pyra'];
  for(let i=0;i<names.length;i++) {
    const name=names[i];const body=catalog.indexes.bodyById[sourceIds[i]];const star=catalog.indexes.bodyById[catalog.rootBodyId];
    const airless=name==='Airless';const gasGiant=body.surfaceAccess.mode==='NoSolidSurface';const missing=name==='Hestia';
    const radius=body.radiusMeters;
    const physics:AtmospherePhysicsProfile=await sealProfile({
      schema:'cel.atmosphere-physics/v1' as const,id:'fixture.physics.'+name,version:1,
      body:{id:body.bodyId,version:1,digest:await contentDigest(body)},star:{id:star.bodyId,version:1,digest:await contentDigest(star)},
      ephemeris:{id:'ephemeris.'+body.bodyId,version:1,digest:await contentDigest({bodyId:body.bodyId,orbit:body.orbit,epochTick:0})},
      frameId:createBodyFixedFrameId(body.bodyId),units:{temperature:'K' as const,pressure:'Pa' as const,length:'m' as const},radiusMeters:radius,
      rotation:{mode:name==='TidallyLocked'?'Synchronous' as const:'Free' as const,value:body.rotation??{schemaVersion:1 as const,rotationPeriodSeconds:name==='TidallyLocked'?orbitalPeriodSeconds(body.orbit!.semiMajorAxisMeters,star.gravity.gravitationalParameterMu):86400,axialTiltDegrees:0,retrograde:false,primeMeridianAtEpochDegrees:0},
        provenance:body.rotation?{kind:'Catalog' as const,note:'Exact unchanged starterSystem rotation.'}:assumption},
      hasAtmosphere:!airless,classificationProvenance:body.atmosphere?{kind:'Catalog' as const,note:'Exact unchanged starterSystem atmosphere classification.'}:assumption,
      referencePressurePa:body.atmosphere?.surfacePressurePa??(airless?0:100000),pressureCoordinate:gasGiant?'PressurePa' as const:'AltitudeMeters' as const,
      hazards:body.atmosphere?.hazards??[],temperatureRangeK:[50,600] as const,pressureRangePa:[0,1000000] as const,
      gasMixture:missing?null:airless?[]:name==='Methane'?[{speciesId:'CH4',moleFraction:0.1},{speciesId:'N2',moleFraction:0.9}]:[{speciesId:'N2',moleFraction:1}],
      thermodynamics:missing||airless?null:{molarMassKgPerMol:0.028,specificHeatJPerKgK:1000,provenance:assumption},
      condensibleSpecies:name==='Methane'?[{speciesId:'CH4',saturation:null}]:[],
      aerosolSpecies:name==='Dust'?['dust.test']:[],
      scaleHeightMeters:missing||airless?null:1000,outerRadiusMeters:missing?null:airless?radius:radius+10000,
      bondAlbedo:0.3,internalHeatFluxWPerM2:0,assumptionProvenance:assumption
    });
    const optics:AtmosphereOpticsProfile=await sealProfile({schema:'cel.atmosphere-optics/v1' as const,id:'fixture.optics.'+name,version:1,physics:exactRef(physics),coefficientUnit:'1/m' as const,
      rayleighPerM:{x:airless?0:0.00001,y:airless?0:0.00002,z:airless?0:0.00003},miePerM:airless?0:0.00001,mieAnisotropy:0.5,provenance:assumption});
    const geography=gasGiant?null:{schema:'fixture.macro-data-projection/v1',bodyId:body.bodyId,provenance:assumption,coverage:'single-authored-query',sourceOwner:'PlanetaryMacroData-candidate'};
    const climate={schema:'fixture.climate-binding/v1',bodyId:body.bodyId,provenance:assumption};
    const profile:PlanetWeatherProfile=await sealProfile({schema:'cel.planet-weather/v1' as const,id:'fixture.weather.'+name,version:1,bodyId:body.bodyId,frameId:physics.frameId,
      physics:exactRef(physics),optics:exactRef(optics),numerics:{id:'deterministicMathV1',version:1,digest:'sha256:64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714' as Digest},
      model:{id:'authored-diagnostic-read-v1',version:1,digest:implementationDigest},macroGeography:geography===null?null:{id:'fixture.macro-projection.'+name,version:1,digest:await contentDigest(geography)},
      climateNormals:{id:'fixture.climate.'+name,version:1,digest:await contentDigest(climate)},ticksPerWeatherStep:72000,strategy:'analytic-synoptic-v1' as const});
    const query:PlanetWeatherQuery={bodyId:body.bodyId,frameId:physics.frameId,frameKind:'BodyFixed',bodyFixedPositionMeters:{x:radius,y:0,z:0},simulationTick:createSimulationTick(120),
      vertical:gasGiant?{kind:'PressurePa',pressurePa:100000}:{kind:'AltitudeMeters',altitudeMeters:0},requiredAccuracy:'macro'};
    const events:readonly unknown[]=[];
    const records:readonly ReadRecord[]=[{status:'Known',query,supportRadiusMeters:200000,provenance:assumption,sample:{temperatureK:280,pressurePa:airless?0:physics.referencePressurePa,windBodyFixedMps:{x:0,y:airless?0:3,z:0},extinctionPerM:airless?0:0.00001,
      condensates:[],aerosols:name==='Dust'?[{speciesId:'dust.test',massMixingRatio:0.001}]:[],precipitation:[],stormIds:[]}}];
    const f:FixtureBundle={name,catalog,physics,optics,profile,query,geography,climate,events,
      binding:{worldId:'fixture.world',sessionId:'fixture.session',sourceOwner:'fixture.author',sourceEpoch:'source.1',sourceRevision:'1',sourceDigest:await contentDigest(records),atmosphereEpoch:'atmosphere.1',authorityRevision:'1',eventCursor:'0',eventDigest:await contentDigest(events),checkpointDigest:null,
        profile:exactRef(profile),model:profile.model,climateNormals:profile.climateNormals,macroGeography:profile.macroGeography,simulationTick:query.simulationTick},
      records};
    fixtures.push(await validateBundle(f));
  }
  return Object.freeze(fixtures);
}
