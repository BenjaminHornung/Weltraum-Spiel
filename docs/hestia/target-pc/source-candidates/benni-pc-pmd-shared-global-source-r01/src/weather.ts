import {contentDigest,exactRef,immutable,number,keys,same,validateBundle,validateQuery,assumption,createSimulationTick} from './common';
import type {FixtureBundle,PlanetWeatherQuery,ExactRef,WeatherResult,WeatherEpochBinding} from './common';
import {typedClimateBuilder,sampleClimate,validateConfig} from './climate';
import type {ClimateConfig,ClimateNormals} from './climate';
import {validateMacro} from './macro';
import type {MacroSource} from './macro';
import {unit,cross,scale,add,cellAddress} from './geometry';
import {synopticObjects,sampleSynoptic,periodicForcing,EPOCH_TICKS} from './synoptic';
import {IMPLEMENTATION_DIGEST} from './model-pin';
export interface AnalyticInput {readonly bundle:FixtureBundle;readonly macro:MacroSource|null;readonly config:ClimateConfig}
export interface AnalyticReadView {
  readonly profile:ExactRef;readonly input:AnalyticInput;readonly climate:ClimateNormals;
  readonly read:(query:PlanetWeatherQuery)=>Promise<WeatherResult>;
}
export async function createAnalyticReadView(raw:AnalyticInput):Promise<AnalyticReadView> {
  const detached=immutable(raw);keys(detached,['bundle','macro','config'],'analytic.input');
  const bundle=await validateBundle(detached.bundle),config=validateConfig(detached.config);
  const macro=detached.macro===null?null:await validateMacro(detached.macro,bundle.catalog.indexes.bodyById[bundle.profile.bodyId]);
  const climate=await typedClimateBuilder(bundle,macro,config);
  const model={id:'wxg.analytic-synoptic/v1',version:1,digest:IMPLEMENTATION_DIGEST};
  const profile={id:'wxg.weather.'+bundle.name,version:1,digest:await contentDigest({baseProfile:bundle.profile,model,climate,macro,config,epochTicks:EPOCH_TICKS,ticksPerWeatherStep:bundle.profile.ticksPerWeatherStep,numerics:bundle.profile.numerics})};
  const input=immutable({bundle,macro,config});
  return Object.freeze({profile:immutable(profile),input,climate,read:async(rawQuery:PlanetWeatherQuery):Promise<WeatherResult>=>{
    const query=immutable(rawQuery);validateQuery(query,bundle.physics,bundle.profile.bodyId);
    const binding:WeatherEpochBinding=immutable({...bundle.binding,profile,model,climateNormals:climate.binding,macroGeography:macro===null?null:exactRef(macro),simulationTick:query.simulationTick});
    let state:Record<string,unknown>;
    if(climate.status==='NoAtmosphere')state={status:'NoAtmosphere',precipitation:[]};
    else if(climate.status==='Unsupported')state={status:'Unsupported',reasonCode:climate.reasonCode};
    else if(query.requiredAccuracy!=='macro')state={status:'Unsupported',reasonCode:'USE_REGIONAL_EXPOSURE_PORT'};
    else {
      const n=unit(query.bodyFixedPositionMeters);const missing=macro?.missingFaces??[];
      const dominant=Math.max(Math.abs(n.x),Math.abs(n.y),Math.abs(n.z));
      const faces=[n.x>=0?'px':'nx',n.y>=0?'py':'ny',n.z>=0?'pz':'nz'];
      const haloMissing=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)].some((v,i)=>v>=dominant*0.75&&missing.includes(faces[i] as typeof missing[number]));
      if(haloMissing)state={status:'UnknownCoverage',reasonCode:'MACRO_FACE_OR_HALO_MISSING'};
      else {
        const normals=sampleClimate(climate,bundle,macro,n);
        const objects=synopticObjects(profile.digest,query.simulationTick,bundle.physics.hazards.includes('Storms'));
        const anomaly=sampleSynoptic(objects,n);
        const height=query.vertical.kind==='AltitudeMeters'?query.vertical.altitudeMeters:0;
        const temperatureK=normals.temperatureK+config.seasonalAmplitudeK*n.z*periodicForcing(query.simulationTick,config.seasonPeriodTicks)+anomaly.temperatureDeltaK-height*config.lapseKPerM;
        number(temperatureK,bundle.physics.temperatureRangeK[0],bundle.physics.temperatureRangeK[1],'weather.temperatureK');
        const pressurePa=query.vertical.kind==='PressurePa'?query.vertical.pressurePa:bundle.physics.referencePressurePa*Math.exp(-height/bundle.physics.scaleHeightMeters!)*(1+anomaly.pressureFraction);
        number(pressurePa,Math.max(Number.MIN_VALUE,bundle.physics.pressureRangePa[0]),bundle.physics.pressureRangePa[1],'weather.pressurePa');
        const wind=add(scale(cross({x:0,y:0,z:1},n),config.zonalWindMps),anomaly.wind);
        const aerosols=bundle.physics.aerosolSpecies.map(speciesId=>({speciesId,massMixingRatio:0.001+anomaly.aerosolDelta}));
        state={status:'Known',sample:{temperatureK,pressurePa,windBodyFixedMps:wind,extinctionPerM:bundle.optics.miePerM+anomaly.aerosolDelta*0.01,condensates:[],aerosols,precipitation:[],stormIds:anomaly.activeIds.filter(id=>objects.some(o=>o.id===id&&o.kind==='Vortex'))},
          supportRadiusMeters:bundle.physics.radiusMeters*0.2,accuracy:'macro',provenance:assumption,
          ...(macro?.schema==='pmd.generated-global/v1'?{geographicKnowledge:macro.knowledge,pmdElevationMeters:normals.geo!.elevationMeters}:{})};
      }
    }
    const payload={query,binding,weatherStep:Number(BigInt(query.simulationTick)/BigInt(bundle.profile.ticksPerWeatherStep)),...state};
    return immutable({...payload,WeatherSnapshotId:await contentDigest(payload)}) as WeatherResult;
  }});
}
export async function assertCurrentAnalytic(result:WeatherResult,query:PlanetWeatherQuery,view:AnalyticReadView):Promise<WeatherResult> {
  const copy=immutable(result);const expected=await view.read(query);same(copy,expected,'STALE_ANALYTIC_RESULT');return copy;
}
export function trajectoryQuery(bundle:FixtureBundle,unitPosition:{x:number;y:number;z:number},tick:number,altitudeMeters=0):PlanetWeatherQuery {
  const n=unit(unitPosition);createSimulationTick(tick);number(altitudeMeters,0,10000,'trajectoryAltitude');
  const gas=bundle.physics.pressureCoordinate==='PressurePa';
  return immutable({...bundle.query,simulationTick:createSimulationTick(tick),bodyFixedPositionMeters:scale(n,bundle.physics.radiusMeters+(gas?0:altitudeMeters)),
    vertical:gas?{kind:'PressurePa',pressurePa:bundle.physics.referencePressurePa}:{kind:'AltitudeMeters',altitudeMeters}});
}
