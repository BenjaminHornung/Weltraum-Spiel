import {contentDigest,exactRef,immutable,number,keys,same,validateBundle,assumption,createWeatherReadView} from './common';
import type {ExactRef,FixtureBundle} from './common';
import {sampleMacro,validateMacro} from './macro';
import type {MacroSource} from './macro';
import {dot,unit} from './geometry';
import type {Vec3} from './geometry';
import {IMPLEMENTATION_DIGEST} from './model-pin';
export interface ClimateConfig {
  readonly schema:'wxg.synthetic-climate-config/v1';readonly referenceTemperatureK:number;readonly solarFluxWPerM2:number;
  readonly longwaveAtReferenceWPerM2:number;readonly feedbackWPerM2K:number;readonly diffusionWPerM2K:number;readonly p2ForcingWPerM2:number;
  readonly lapseKPerM:number;readonly seasonalAmplitudeK:number;readonly seasonPeriodTicks:number;readonly tidalContrastK:number;readonly substellarDirection:Vec3;
  readonly circulationHeightMeters:number;readonly circulationDeltaK:number;readonly zonalWindMps:number;readonly provenance:typeof assumption;
}
export type ClimateNormals =
  | {readonly status:'NoAtmosphere'|'Unsupported';readonly reasonCode:string;readonly binding:ExactRef}
  | {readonly status:'Known';readonly binding:ExactRef;readonly bodyId:string;readonly physics:ExactRef;readonly macroGeography:ExactRef|null;
     readonly config:ClimateConfig;readonly meanTemperatureK:number;readonly p2AmplitudeK:number;readonly hadleyWidthRadians:number|null;
     readonly physicsRangeK:readonly [number,number];readonly pressureCoordinate:'AltitudeMeters'|'PressurePa';readonly seasonalBins:readonly number[];
     readonly diagnostics:{readonly equation:'two-mode-linear-diffusive-ebm/v1';readonly reference:'no-transport D=0';readonly surfaceExchange:'authoring lapse only';readonly heldHou:'separate small-angle scaling diagnostic';readonly heldSuarez:'NOT_RUN_EXTERNAL_BENCHMARK';readonly moisture:'NO_SATURATION_NO_PRECIPITATION'}};
export function validateConfig(raw:ClimateConfig):ClimateConfig {
  const c=immutable(raw);keys(c,['schema','referenceTemperatureK','solarFluxWPerM2','longwaveAtReferenceWPerM2','feedbackWPerM2K','diffusionWPerM2K','p2ForcingWPerM2','lapseKPerM','seasonalAmplitudeK','seasonPeriodTicks','tidalContrastK','substellarDirection','circulationHeightMeters','circulationDeltaK','zonalWindMps','provenance'],'climate.config');
  if(c.schema!=='wxg.synthetic-climate-config/v1'||c.provenance.kind!=='TestAssumption')throw Error('CLIMATE_CONFIG');
  number(c.referenceTemperatureK,50,600,'referenceK');number(c.solarFluxWPerM2,0,5000,'solar');number(c.longwaveAtReferenceWPerM2,0,2000,'longwave');number(c.feedbackWPerM2K,0.1,10,'feedback');number(c.diffusionWPerM2K,0,10,'diffusion');
  number(c.p2ForcingWPerM2,-200,200,'p2');number(c.lapseKPerM,0,0.01,'lapse');number(c.seasonalAmplitudeK,0,50,'seasonal');number(c.tidalContrastK,0,50,'tidal');
  if(!Number.isSafeInteger(c.seasonPeriodTicks)||c.seasonPeriodTicks<120)throw Error('SEASON_TICKS');
  unit(c.substellarDirection);number(c.circulationHeightMeters,1,100000,'circulationHeight');number(c.circulationDeltaK,0,100,'circulationDelta');number(c.zonalWindMps,0,100,'zonalWind');return c;
}
export function ebmCoefficients(c:ClimateConfig,albedo:number,internalFlux:number) {
  const config=validateConfig(c);number(albedo,0,1,'albedo');number(internalFlux,0,1000,'internalFlux');
  return {meanTemperatureK:config.referenceTemperatureK+(config.solarFluxWPerM2*(1-albedo)/4+internalFlux-config.longwaveAtReferenceWPerM2)/config.feedbackWPerM2K,
    p2AmplitudeK:config.p2ForcingWPerM2/(config.feedbackWPerM2K+6*config.diffusionWPerM2K)};
}
export function heldHouWidth(c:ClimateConfig,radiusMeters:number,rotationSeconds:number,gravityMps2:number):number|null {
  validateConfig(c);number(radiusMeters,1,1e9,'radius');number(rotationSeconds,1,1e12,'rotation');number(gravityMps2,0.001,1000,'gravity');
  const omega=2*Math.PI/rotationSeconds;
  const width=Math.sqrt(5*gravityMps2*c.circulationHeightMeters*c.circulationDeltaK/(3*omega*omega*radiusMeters*radiusMeters*c.referenceTemperatureK));
  // shortcut: the Held-Hou small-angle comparison is valid only through 0.5 rad, broader/locked cases require a separate circulation model.
  return width<=0.5?width:null;
}
export async function typedClimateBuilder(raw:FixtureBundle,macroRaw:MacroSource|null,configRaw:ClimateConfig):Promise<ClimateNormals> {
  const bundle=await validateBundle(raw),config=validateConfig(configRaw);
  const macro=macroRaw===null?null:await validateMacro(macroRaw,bundle.profile.bodyId);
  if(macro===null&&bundle.physics.pressureCoordinate!=='PressurePa')throw Error('MACRO_REQUIRED');
  const inputs={physics:exactRef(bundle.physics),macroGeography:macro===null?null:exactRef(macro),config,compiler:{id:'two-mode-linear-diffusive-ebm/v1',digest:IMPLEMENTATION_DIGEST}};
  const binding={id:'wxg.climate.'+bundle.name,version:1,digest:await contentDigest(inputs)};
  const supported=await (await createWeatherReadView(bundle)).read(bundle.query);
  if(supported.status==='NoAtmosphere')return immutable({status:'NoAtmosphere',reasonCode:'AIRLESS',binding});
  if(supported.status==='Unsupported')return immutable({status:'Unsupported',reasonCode:supported.reasonCode,binding});
  const coefficients=ebmCoefficients(config,bundle.physics.bondAlbedo,bundle.physics.internalHeatFluxWPerM2);
  const lo=coefficients.meanTemperatureK-Math.abs(coefficients.p2AmplitudeK)-config.seasonalAmplitudeK-config.tidalContrastK-(macro?.maximumElevationMeters??0)*config.lapseKPerM;
  const hi=coefficients.meanTemperatureK+Math.abs(coefficients.p2AmplitudeK)+config.seasonalAmplitudeK+config.tidalContrastK;
  number(lo,bundle.physics.temperatureRangeK[0],bundle.physics.temperatureRangeK[1],'climate.minimum');number(hi,bundle.physics.temperatureRangeK[0],bundle.physics.temperatureRangeK[1],'climate.maximum');
  const body=bundle.catalog.indexes.bodyById[bundle.profile.bodyId];
  const gravityMps2=body.gravity.gravitationalParameterMu/(bundle.physics.radiusMeters*bundle.physics.radiusMeters);
  const hadleyWidthRadians=bundle.physics.rotation.mode==='Synchronous'?null:heldHouWidth(config,bundle.physics.radiusMeters,bundle.physics.rotation.value.rotationPeriodSeconds,gravityMps2);
  const result={status:'Known' as const,bodyId:bundle.profile.bodyId,physics:exactRef(bundle.physics),macroGeography:inputs.macroGeography,config,...coefficients,hadleyWidthRadians,
    physicsRangeK:bundle.physics.temperatureRangeK,pressureCoordinate:bundle.physics.pressureCoordinate,seasonalBins:Array.from({length:12},(_,i)=>config.seasonalAmplitudeK*(1-Math.abs(i-6)/3)),
    diagnostics:{equation:'two-mode-linear-diffusive-ebm/v1' as const,reference:'no-transport D=0' as const,surfaceExchange:'authoring lapse only' as const,heldHou:'separate small-angle scaling diagnostic' as const,heldSuarez:'NOT_RUN_EXTERNAL_BENCHMARK' as const,moisture:'NO_SATURATION_NO_PRECIPITATION' as const}};
  return immutable({...result,binding:{...binding,digest:await contentDigest({inputs,result})}});
}
export function sampleClimate(c:ClimateNormals,f:FixtureBundle,macro:MacroSource|null,nRaw:Vec3) {
  if(c.status!=='Known')throw Error('CLIMATE_UNAVAILABLE');same(c.physics,exactRef(f.physics),'climate.physics');same(c.macroGeography,macro===null?null:exactRef(macro),'climate.macro');
  const n=unit(nRaw),geo=macro===null?null:sampleMacro(macro,n);const p2=(3*n.y*n.y-1)/2;
  const tidal=f.physics.rotation.mode==='Synchronous'?c.config.tidalContrastK*dot(n,unit(c.config.substellarDirection)):0;
  const temperatureK=c.meanTemperatureK+c.p2AmplitudeK*p2-(geo?.elevationMeters??0)*c.config.lapseKPerM+tidal;
  number(temperatureK,c.physicsRangeK[0],c.physicsRangeK[1],'climate.sample');
  return immutable({temperatureK,biomeHint:geo===null?'NoGround':temperatureK<273.15?'ColdSurface':geo.landFraction<0.5?'OpenReservoir':'DryLand',
    hydrologyHint:geo?.reservoir===null||geo===null?'NoBoundReservoir':'ReservoirPresentFluxUnsupported',geo});
}
