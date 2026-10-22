import { canonicalCelestialJson, canonicalizeCelestialValue } from '../snapshot/product/celestial/canonical';
import { createCelestialCatalog, requireCelestialBody } from '../snapshot/product/celestial/catalog';
import { STARTER_CELESTIAL_CATALOG } from '../snapshot/product/celestial/starterSystem';
import { orbitalPeriodSeconds } from '../snapshot/product/celestial/kepler';
import { createSimulationTick } from '../snapshot/product/persistence/time';
import { createBodyFixedFrameId } from '../snapshot/product/spatial/ids';
import { normalizeIdentity } from '../vendor/plt/src/numerics.mjs';
import type { ExactRef, Digest, FixtureBundle, PlanetWeatherQuery, PlanetWeatherReadView, WeatherResult,
  WeatherSample, Provenance, AtmospherePhysicsProfile, WeatherReadState } from './types';
import { IMPLEMENTATION_DIGEST } from './model-pin';

export class ContractError extends Error {
  constructor(public readonly code:string, public readonly path:string) {super(`${code}:${path}`);this.name='ContractError';}
}
function fail(code:string,path:string):never {throw new ContractError(code,path);}
const clone=<T>(v:T):T=>canonicalizeCelestialValue(v) as T;
const keys=(v:unknown,names:string[],path:string):void=>{
  if(v===null || typeof v!=='object' || Array.isArray(v))fail('OBJECT_REQUIRED',path);
  const actual=Object.keys(v as object).sort();
  if(actual.join('|')!==[...names].sort().join('|'))fail('SCHEMA_KEYS',path);
};
const finite=(v:unknown,min:number,max:number,path:string):number=>{
  if(typeof v!=='number' || !Number.isFinite(v) || v<min || v>max)fail('NUMBER_RANGE',path);
  return v as number;
};
const identity=(v:unknown,path:string):string=>{
  if(typeof v!=='string')return fail('IDENTITY',path);
  try{if(normalizeIdentity(v)!==v)fail('NONCANONICAL_IDENTITY',path);}catch{fail('IDENTITY',path);}
  return v;
};
const digest=(v:unknown,path:string):Digest=>{
  if(typeof v!=='string'||!/^sha256:[a-f0-9]{64}$/.test(v))fail('DIGEST',path);return v as Digest;
};
export const exactRef=(v:ExactRef):ExactRef=>({id:v.id,version:v.version,digest:v.digest});
export function validateExactRef(v:ExactRef,path='/ref'):void {
  keys(v,['id','version','digest'],path);identity(v.id,path+'/id');digest(v.digest,path+'/digest');
  if(!Number.isSafeInteger(v.version)||v.version<1)fail('VERSION',path);
}
const same=(a:unknown,b:unknown,path:string):void=>{if(canonicalCelestialJson(a)!==canonicalCelestialJson(b))fail('REFERENCE_MISMATCH',path);};
export async function contentDigest(v:unknown):Promise<Digest> {
  const bytes=new TextEncoder().encode(canonicalCelestialJson(v));
  const output=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  return 'sha256:'+Array.from(output,x=>x.toString(16).padStart(2,'0')).join('') as Digest;
}
export async function sealProfile<T extends {readonly id:string;readonly version:number}>(v:T):Promise<T & {readonly digest:Digest}> {
  const snapshot=clone(v);return clone({...snapshot,digest:await contentDigest(snapshot)});
}
async function self(v:ExactRef,path:string):Promise<void> {
  validateExactRef(exactRef(v),path);const {digest:actual,...payload}=v;
  if(await contentDigest(payload)!==actual)fail('PROFILE_DIGEST',path);
}
function provenance(v:Provenance,path:string):void {
  keys(v,['kind','note'],path);
  if(!['Catalog','TestAssumption','Unavailable'].includes(v.kind))fail('PROVENANCE',path);
  identity(v.note,path+'/note');
}
function range(v:readonly number[],positive:boolean,path:string):void {
  if(!Array.isArray(v)||v.length!==2)fail('RANGE',path);
  finite(v[0],positive?Number.MIN_VALUE:0,Number.MAX_VALUE,path);
  finite(v[1],v[0],Number.MAX_VALUE,path);
}
function vector(v:WeatherSample['windBodyFixedMps'],nonnegative:boolean,path:string):void {
  keys(v,['x','y','z'],path);for(const k of ['x','y','z'] as const)finite(v[k],nonnegative?0:-Number.MAX_VALUE,Number.MAX_VALUE,path+'/'+k);
}
function uniqueIds(values:readonly string[],path:string):void {
  if(!Array.isArray(values))fail('ARRAY',path);values.forEach(v=>identity(v,path));
  if(new Set(values).size!==values.length)fail('DUPLICATE_ID',path);
  if([...values].sort().join('|')!==values.join('|'))fail('CANONICAL_ORDER',path);
}
export async function validateBundle(input:FixtureBundle):Promise<FixtureBundle> {
  const f=clone(input);keys(f,['name','catalog','physics','optics','profile','binding','query','records','geography','climate','events'],'/bundle');
  identity(f.name,'/name');
  const catalog=createCelestialCatalog({schemaVersion:f.catalog.schemaVersion,catalogId:f.catalog.catalogId,bodies:f.catalog.bodies});
  same(f.catalog,catalog,'/catalog');
  same(catalog,STARTER_CELESTIAL_CATALOG,'/catalog/frozen-source');
  const p=f.physics;keys(p,['id','version','digest','schema','body','star','ephemeris','frameId','units','radiusMeters','rotation','hasAtmosphere','classificationProvenance','referencePressurePa','pressureCoordinate','hazards','temperatureRangeK','pressureRangePa','gasMixture','thermodynamics','condensibleSpecies','aerosolSpecies','scaleHeightMeters','outerRadiusMeters','bondAlbedo','internalHeatFluxWPerM2','assumptionProvenance'],'/physics');
  if(p.schema!=='cel.atmosphere-physics/v1')fail('SCHEMA','/physics');await self(p,'/physics');
  const body=requireCelestialBody(catalog,p.body.id);const star=requireCelestialBody(catalog,p.star.id);
  same(p.body,{id:body.bodyId,version:body.schemaVersion,digest:await contentDigest(body)},'/physics/body');
  same(p.star,{id:star.bodyId,version:star.schemaVersion,digest:await contentDigest(star)},'/physics/star');
  if(star.bodyType!=='Star')fail('STAR_REFERENCE','/physics/star');
  let ancestor=body;while(ancestor.parentBodyId!==null)ancestor=requireCelestialBody(catalog,ancestor.parentBodyId);
  if(ancestor.bodyId!==star.bodyId)fail('STAR_REFERENCE','/physics/star');
  same(p.ephemeris,{id:'ephemeris.'+body.bodyId,version:1,digest:await contentDigest({bodyId:body.bodyId,orbit:body.orbit,epochTick:0})},'/physics/ephemeris');
  same(p.units,{temperature:'K',pressure:'Pa',length:'m'},'/physics/units');
  same(p.radiusMeters,body.radiusMeters,'/physics/radiusMeters');
  same(p.frameId,createBodyFixedFrameId(body.bodyId),'/physics/frameId');
  provenance(p.classificationProvenance,'/physics/classificationProvenance');provenance(p.assumptionProvenance,'/physics/assumptionProvenance');
  if(p.assumptionProvenance.kind!=='TestAssumption')fail('UNPROVEN_CONSTANTS','/physics/assumptionProvenance');
  keys(p.rotation,['mode','value','provenance'],'/physics/rotation');provenance(p.rotation.provenance,'/physics/rotation/provenance');
  if(!['Free','Synchronous'].includes(p.rotation.mode))fail('ROTATION_MODE','/physics/rotation');
  keys(p.rotation.value,['schemaVersion','rotationPeriodSeconds','axialTiltDegrees','retrograde','primeMeridianAtEpochDegrees'],'/physics/rotation/value');
  finite(p.rotation.value.rotationPeriodSeconds,Number.MIN_VALUE,Number.MAX_VALUE,'/physics/rotation/period');
  finite(p.rotation.value.axialTiltDegrees,0,180,'/physics/rotation/tilt');finite(p.rotation.value.primeMeridianAtEpochDegrees,0,360,'/physics/rotation/meridian');
  if(p.rotation.value.schemaVersion!==1||typeof p.rotation.value.retrograde!=='boolean')fail('ROTATION','/physics/rotation');
  if(body.rotation!==null){same(p.rotation.value,body.rotation,'/physics/rotation');if(p.rotation.provenance.kind!=='Catalog')fail('PROVENANCE','/physics/rotation');}
  else if(p.rotation.provenance.kind!=='TestAssumption')fail('PROVENANCE','/physics/rotation');
  if(p.rotation.mode==='Synchronous'){
    if(body.orbit===null||body.parentBodyId!==star.bodyId||p.rotation.value.retrograde||p.rotation.value.axialTiltDegrees!==0)fail('SYNCHRONOUS_ROTATION','/physics/rotation');
    const period=orbitalPeriodSeconds(body.orbit.semiMajorAxisMeters,star.gravity.gravitationalParameterMu);
    if(Math.abs(p.rotation.value.rotationPeriodSeconds-period)>period*1e-12)fail('SYNCHRONOUS_PERIOD','/physics/rotation');
  }
  if(typeof p.hasAtmosphere!=='boolean')fail('ATMOSPHERE','/physics/hasAtmosphere');
  uniqueIds(p.hazards,'/physics/hazards');
  if(p.hazards.some(h=>!['HighPressure','LowPressure','Toxic','Corrosive','HighOxygen','Radiation','Storms','ThermalExtreme'].includes(h)))fail('HAZARD','/physics/hazards');
  if(body.atmosphere!==null){same(p.hasAtmosphere,body.atmosphere.hasAtmosphere,'/physics/hasAtmosphere');same(p.hazards,body.atmosphere.hazards,'/physics/hazards');
    if(body.atmosphere.surfacePressurePa!==undefined)same(p.referencePressurePa,body.atmosphere.surfacePressurePa,'/physics/pressure');
    if(p.classificationProvenance.kind!=='Catalog')fail('PROVENANCE','/physics/classification');
  }else if(p.classificationProvenance.kind!=='TestAssumption')fail('UNKNOWN_ATMOSPHERE','/physics/classification');
  range(p.temperatureRangeK,true,'/physics/temperatureRange');range(p.pressureRangePa,false,'/physics/pressureRange');
  finite(p.referencePressurePa,p.pressureRangePa[0],p.pressureRangePa[1],'/physics/referencePressurePa');
  if(p.hasAtmosphere&&p.referencePressurePa<=0)fail('REFERENCE_PRESSURE','/physics/referencePressurePa');
  const gasGiant=body.surfaceAccess.mode==='NoSolidSurface';
  if(p.pressureCoordinate!==(gasGiant?'PressurePa':'AltitudeMeters'))fail('VERTICAL_COORDINATE','/physics/pressureCoordinate');
  if(p.gasMixture!==null){if(!Array.isArray(p.gasMixture)||(!p.gasMixture.length&&p.hasAtmosphere))fail('GAS_MIXTURE','/physics/gasMixture');
    uniqueIds(p.gasMixture.map(g=>g.speciesId),'/physics/gasMixture');let sum=0;
    p.gasMixture.forEach(g=>{keys(g,['speciesId','moleFraction'],'/physics/gasMixture');sum+=finite(g.moleFraction,0,1,'/physics/moleFraction');});
    if(p.hasAtmosphere&&Math.abs(sum-1)>1e-12)fail('MOLAR_SUM','/physics/gasMixture');
  }
  if(p.thermodynamics!==null){keys(p.thermodynamics,['molarMassKgPerMol','specificHeatJPerKgK','provenance'],'/physics/thermodynamics');provenance(p.thermodynamics.provenance,'/physics/thermodynamics');
    finite(p.thermodynamics.molarMassKgPerMol,Number.MIN_VALUE,Number.MAX_VALUE,'/physics/molarMass');finite(p.thermodynamics.specificHeatJPerKgK,Number.MIN_VALUE,Number.MAX_VALUE,'/physics/specificHeat');}
  if(!Array.isArray(p.condensibleSpecies))fail('ARRAY','/physics/condensibleSpecies');
  uniqueIds(p.condensibleSpecies.map(x=>x.speciesId),'/physics/condensibleSpecies');
  p.condensibleSpecies.forEach(x=>{keys(x,['speciesId','saturation'],'/physics/condensibleSpecies');
    // shortcut: this finite package defines no saturation implementation; admit one only with a new bound species model and independent vectors.
    if(x.saturation!==null)fail('UNBOUND_SATURATION','/physics/condensibleSpecies');});
  uniqueIds(p.aerosolSpecies,'/physics/aerosolSpecies');
  if(p.scaleHeightMeters!==null)finite(p.scaleHeightMeters,Number.MIN_VALUE,Number.MAX_VALUE,'/physics/scaleHeight');
  if(p.outerRadiusMeters!==null)finite(p.outerRadiusMeters,p.radiusMeters,Number.MAX_VALUE,'/physics/outerRadius');
  if(p.hasAtmosphere&&p.outerRadiusMeters!==null&&p.outerRadiusMeters<=p.radiusMeters)fail('OUTER_RADIUS','/physics/outerRadius');
  finite(p.bondAlbedo,0,1,'/physics/albedo');finite(p.internalHeatFluxWPerM2,0,Number.MAX_VALUE,'/physics/internalHeat');
  if(!p.hasAtmosphere&&(p.referencePressurePa!==0||p.gasMixture===null||p.gasMixture.length||p.condensibleSpecies.length||p.aerosolSpecies.length||p.hazards.length||p.scaleHeightMeters!==null||p.outerRadiusMeters!==p.radiusMeters))fail('AIRLESS_CONFLICT','/physics');
  const o=f.optics;keys(o,['id','version','digest','schema','physics','coefficientUnit','rayleighPerM','miePerM','mieAnisotropy','provenance'],'/optics');
  if(o.schema!=='cel.atmosphere-optics/v1'||o.coefficientUnit!=='1/m')fail('UNITS','/optics');await self(o,'/optics');same(o.physics,exactRef(p),'/optics/physics');
  vector(o.rayleighPerM,true,'/optics/rayleigh');finite(o.miePerM,0,Number.MAX_VALUE,'/optics/mie');finite(o.mieAnisotropy,-1+Number.EPSILON,1-Number.EPSILON,'/optics/anisotropy');provenance(o.provenance,'/optics/provenance');
  if(!p.hasAtmosphere&&(o.miePerM!==0||Object.values(o.rayleighPerM).some(x=>x!==0)))fail('AIRLESS_OPTICS','/optics');
  const w=f.profile;keys(w,['id','version','digest','schema','bodyId','frameId','physics','optics','numerics','model','macroGeography','climateNormals','ticksPerWeatherStep','strategy'],'/profile');
  if(w.schema!=='cel.planet-weather/v1'||w.strategy!=='analytic-synoptic-v1')fail('SCHEMA','/profile');await self(w,'/profile');
  same(w.physics,exactRef(p),'/profile/physics');same(w.optics,exactRef(o),'/profile/optics');same(w.bodyId,body.bodyId,'/profile/bodyId');same(w.frameId,p.frameId,'/profile/frameId');
  same(w.numerics,{id:'deterministicMathV1',version:1,digest:'sha256:64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714'},'/profile/numerics');validateExactRef(w.model,'/profile/model');
  if(w.model.id!=='authored-diagnostic-read-v1'||w.model.version!==1)fail('UNSUPPORTED_MODEL','/profile/model');
  if(w.model.digest!==IMPLEMENTATION_DIGEST)fail('MODEL_IMPLEMENTATION_DRIFT','/profile/model');
  if(!Number.isSafeInteger(w.ticksPerWeatherStep)||w.ticksPerWeatherStep<1)fail('WEATHER_INTERVAL','/profile');
  same(w.climateNormals,{id:'fixture.climate.'+f.name,version:1,digest:await contentDigest(f.climate)},'/profile/climateNormals');
  if(f.geography===null){if(!gasGiant||w.macroGeography!==null)fail('GEOGRAPHY_REQUIRED','/profile/macroGeography');}
  else same(w.macroGeography,{id:'fixture.macro-projection.'+f.name,version:1,digest:await contentDigest(f.geography)},'/profile/macroGeography');
  const b=f.binding;keys(b,['worldId','sessionId','sourceOwner','sourceEpoch','sourceRevision','sourceDigest','atmosphereEpoch','authorityRevision','eventCursor','eventDigest','checkpointDigest','profile','model','climateNormals','macroGeography','simulationTick'],'/binding');
  for(const k of ['worldId','sessionId','sourceOwner','sourceEpoch','sourceRevision','atmosphereEpoch','authorityRevision','eventCursor'] as const)identity(b[k],'/binding/'+k);
  same(b.profile,exactRef(w),'/binding/profile');same(b.model,w.model,'/binding/model');same(b.climateNormals,w.climateNormals,'/binding/climate');same(b.macroGeography,w.macroGeography,'/binding/geography');
  if(!Array.isArray(f.events))fail('ARRAY','/events');same(b.eventDigest,await contentDigest(f.events),'/binding/eventDigest');
  if(b.checkpointDigest!==null)digest(b.checkpointDigest,'/binding/checkpointDigest');createSimulationTick(b.simulationTick);
  validateQuery(f.query,p,w.bodyId);
  if(!Array.isArray(f.records))fail('ARRAY','/records');const recordKeys=new Set<string>();
  same(b.sourceDigest,await contentDigest(f.records),'/binding/sourceDigest');
  for(const r of f.records){validateQuery(r.query,p,w.bodyId);const k=canonicalCelestialJson(r.query);if(recordKeys.has(k))fail('DUPLICATE_RECORD','/records');recordKeys.add(k);
    if(r.status==='Known'){keys(r,['status','query','sample','supportRadiusMeters','provenance'],'/record');validateSample(r.sample,p);finite(r.supportRadiusMeters,Number.MIN_VALUE,Number.MAX_VALUE,'/record/support');provenance(r.provenance,'/record/provenance');
      if(r.query.vertical.kind==='PressurePa')same(r.sample.pressurePa,r.query.vertical.pressurePa,'/record/pressure-level');
      if(r.provenance.kind!=='TestAssumption')fail('UNPROVEN_SAMPLE','/record/provenance');
    }else if(r.status==='Pending'){keys(r,['status','query','dependency'],'/record');identity(r.dependency,'/record/dependency');}
    else if(r.status==='UnknownCoverage'){keys(r,['status','query','reasonCode'],'/record');identity(r.reasonCode,'/record/reasonCode');}
    else fail('RECORD_STATUS','/record');
  }
  return f;
}
export function validateQuery(q:PlanetWeatherQuery,p:AtmospherePhysicsProfile,bodyId:string):void {
  keys(q,['bodyId','frameId','frameKind','bodyFixedPositionMeters','simulationTick','vertical','requiredAccuracy'],'/query');
  same(q.bodyId,bodyId,'/query/body');same(q.frameId,p.frameId,'/query/frame');if(q.frameKind!=='BodyFixed')fail('FRAME_KIND','/query');createSimulationTick(q.simulationTick);
  vector(q.bodyFixedPositionMeters,false,'/query/position');if(!['macro','regional','interacting'].includes(q.requiredAccuracy))fail('ACCURACY','/query');
  if(p.pressureCoordinate==='PressurePa'){keys(q.vertical,['kind','pressurePa'],'/query/vertical');if(q.vertical.kind!=='PressurePa')fail('VERTICAL','/query');finite(q.vertical.pressurePa,Math.max(Number.MIN_VALUE,p.pressureRangePa[0]),p.pressureRangePa[1],'/query/pressure');}
  else {keys(q.vertical,['kind','altitudeMeters'],'/query/vertical');if(q.vertical.kind!=='AltitudeMeters')fail('VERTICAL','/query');
    const altitude=finite(q.vertical.altitudeMeters,0,p.outerRadiusMeters===null?Number.MAX_VALUE:p.outerRadiusMeters-p.radiusMeters,'/query/altitude');
    const radius=Math.hypot(q.bodyFixedPositionMeters.x,q.bodyFixedPositionMeters.y,q.bodyFixedPositionMeters.z);
    if(!Number.isFinite(radius)||radius<=0||Math.abs(radius-p.radiusMeters-altitude)>1e-5)fail('ALTITUDE_POSITION_MISMATCH','/query/position');}
}
function validateSample(s:WeatherSample,p:AtmospherePhysicsProfile):void {
  keys(s,['temperatureK','pressurePa','windBodyFixedMps','extinctionPerM','condensates','aerosols','precipitation','stormIds'],'/sample');
  finite(s.temperatureK,p.temperatureRangeK[0],p.temperatureRangeK[1],'/sample/temperature');finite(s.pressurePa,p.pressureRangePa[0],p.pressureRangePa[1],'/sample/pressure');vector(s.windBodyFixedMps,false,'/sample/wind');finite(s.extinctionPerM,0,Number.MAX_VALUE,'/sample/extinction');
  for(const k of ['condensates','aerosols'] as const){if(!Array.isArray(s[k]))fail('ARRAY','/sample/'+k);uniqueIds(s[k].map(x=>x.speciesId),'/sample/'+k);
    s[k].forEach(x=>{keys(x,['speciesId','massMixingRatio'],'/sample/'+k);finite(x.massMixingRatio,0,1,'/sample/'+k);
      if(k==='aerosols'?!p.aerosolSpecies.includes(x.speciesId):!p.condensibleSpecies.some(c=>c.speciesId===x.speciesId&&c.saturation!==null))fail('UNKNOWN_SPECIES','/sample/'+k);});}
  if(!Array.isArray(s.precipitation))fail('ARRAY','/sample/precipitation');uniqueIds(s.precipitation.map(x=>x.speciesId),'/sample/precipitation');
  s.precipitation.forEach(x=>{keys(x,['speciesId','phase','massFluxKgPerM2S'],'/sample/precipitation');if(!['liquid','solid'].includes(x.phase))fail('PHASE','/sample/precipitation');finite(x.massFluxKgPerM2S,0,Number.MAX_VALUE,'/sample/precipitation');
    if(!p.condensibleSpecies.some(c=>c.speciesId===x.speciesId&&c.saturation!==null))fail('UNSUPPORTED_PRECIPITATION','/sample/precipitation');});
  uniqueIds(s.stormIds,'/sample/stormIds');if(!p.hasAtmosphere&&(s.precipitation.length||s.condensates.length||s.aerosols.length||s.stormIds.length||s.pressurePa!==0||s.extinctionPerM!==0||Object.values(s.windBodyFixedMps).some(v=>v!==0)))fail('AIRLESS_WEATHER','/sample');
}
export async function createWeatherReadView(input:FixtureBundle):Promise<PlanetWeatherReadView> {
  const f=await validateBundle(input);const p=f.physics;
  const byQuery=new Map(f.records.map(r=>[canonicalCelestialJson(r.query),r]));
  return Object.freeze({profile:f.profile,binding:f.binding,read:async(raw:PlanetWeatherQuery):Promise<WeatherResult>=>{
    const q=clone(raw);validateQuery(q,p,f.profile.bodyId);
    let state:WeatherReadState;
    if(!p.hasAtmosphere)state={status:'NoAtmosphere',precipitation:[]};
    else if(p.gasMixture===null)state={status:'Unsupported',reasonCode:'MISSING_GAS_MIXTURE'};
    else if(p.thermodynamics===null||p.scaleHeightMeters===null||p.outerRadiusMeters===null)state={status:'Unsupported',reasonCode:'MISSING_SUBSTANCE_DATA'};
    else if(p.condensibleSpecies.some(x=>x.saturation===null))state={status:'Unsupported',reasonCode:'SATURATION_UNDEFINED'};
    else if(q.simulationTick!==f.binding.simulationTick)state={status:'Pending',dependency:'EXPLICIT_TICK_MATERIALIZATION'};
    else if(q.requiredAccuracy!=='macro')state={status:'Unsupported',reasonCode:'ACCURACY_UNAVAILABLE'};
    else {const record=byQuery.get(canonicalCelestialJson(q));
      if(record?.status==='Known')state={status:'Known',sample:record.sample,supportRadiusMeters:record.supportRadiusMeters,accuracy:'macro',provenance:record.provenance};
      else if(record?.status==='Pending')state={status:'Pending',dependency:record.dependency};
      else state={status:'UnknownCoverage',reasonCode:record?.reasonCode??'NO_BOUND_RECORD'};
    }
    const payload={query:q,binding:f.binding,weatherStep:Number(BigInt(q.simulationTick)/BigInt(f.profile.ticksPerWeatherStep)),...state};
    return clone({...payload,WeatherSnapshotId:await contentDigest(payload)}) as WeatherResult;
  }});
}
export async function assertCurrentResult(result:WeatherResult,query:PlanetWeatherQuery,view:PlanetWeatherReadView):Promise<WeatherResult> {
  const copy=clone(result);const expected=await view.read(query);
  if(copy.WeatherSnapshotId!==expected.WeatherSnapshotId||canonicalCelestialJson(copy)!==canonicalCelestialJson(expected))fail('STALE_RESULT','/result');
  return copy;
}
