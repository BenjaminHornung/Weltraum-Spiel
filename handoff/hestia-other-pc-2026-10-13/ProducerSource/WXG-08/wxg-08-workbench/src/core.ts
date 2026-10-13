import fixtures from '../inputs/wxg/fixtures/authoring-inputs.json' with {type:'json'};
import {createAnalyticReadView,trajectoryQuery,type AnalyticInput} from '../inputs/wxg/dist/src/weather.js';
import {canonicalCelestialJson,contentDigest,immutable,keys,createSimulationTick} from '../inputs/wxg/dist/src/common.js';
import {validateConfig,type ClimateConfig} from '../inputs/wxg/dist/src/climate.js';
import {synopticObjects} from '../inputs/wxg/dist/src/synoptic.js';
import {unit,cross,toTangent,type Vec3} from '../inputs/wxg/dist/src/geometry.js';
import {validateFrame,type AtmosphereFrame} from '../inputs/atm/src/optics.js';
export {canonicalCelestialJson,contentDigest};
export function mapWind(normal:Vec3,wind:Vec3){const east=unit(cross(normal,{x:0,y:1,z:0}));return toTangent({normal,u:east,v:cross(east,normal)},wind);}
const inputs=fixtures as unknown as readonly AnalyticInput[];
export const planets=inputs.map(f=>f.bundle.name);
export interface ScenarioEvent {id:string;name:string;version:1;kind:'ConfigChanged';simulationTick:number;config:ClimateConfig}
export interface Draft {schema:'wxg08.scenario/v1';planet:string;base:AnalyticInput;events:readonly ScenarioEvent[]}
export async function createDraft(planet:string):Promise<Draft>{
 const base=inputs.find(f=>f.bundle.name===planet);if(!base)throw Error('PLANET');
 return immutable({schema:'wxg08.scenario/v1',planet,base,events:[]});
}
export async function validateDraft(raw:Draft):Promise<Draft>{
 const d=immutable(raw);keys(d,['schema','planet','base','events'],'draft');
 if(d.schema!=='wxg08.scenario/v1'||!planets.includes(d.planet)||!Array.isArray(d.events)||d.events.length>32)throw Error('DRAFT_SCHEMA');
 await createAnalyticReadView(d.base);
 if(canonicalCelestialJson(d.base)!==canonicalCelestialJson((await createDraft(d.planet)).base))throw Error('BASE_IMMUTABLE');
 const ids=new Set<string>();let tick=-1;
 for(const e of d.events){
  keys(e,['id','name','version','kind','simulationTick','config'],'event');
  if(typeof e.id!=='string'||!/^[a-zA-Z0-9_.-]{1,80}$/.test(e.id)||ids.has(e.id))throw Error('DUPLICATE_OR_INVALID_EVENT_ID');
  if(typeof e.name!=='string'||!e.name.trim()||e.name.length>120||e.version!==1||e.kind!=='ConfigChanged')throw Error('EVENT_VERSION_NAME');
  ids.add(e.id);createSimulationTick(e.simulationTick);if(e.simulationTick<tick)throw Error('EVENT_ORDER');tick=e.simulationTick;
  validateConfig(e.config);keys(e.config.substellarDirection,['x','y','z'],'event.direction');keys(e.config.provenance,['kind','note'],'event.provenance');
  if(typeof e.config.provenance.note!=='string'||!e.config.provenance.note.trim())throw Error('PROVENANCE_NOTE');
  await createAnalyticReadView({...d.base,config:e.config});
 }
 return d;
}
export async function scenarioView(draft:Draft,tick:number){
 const d=await validateDraft(draft);createSimulationTick(tick);
 const events=d.events.filter(e=>e.simulationTick<=tick);
 const bundle=immutable({...d.base.bundle,events,binding:{...d.base.bundle.binding,eventCursor:String(events.length),eventDigest:await contentDigest(events)}});
 return createAnalyticReadView({...d.base,bundle,config:events.at(-1)?.config??d.base.config});
}
export async function previewDraft(d:Draft,tick:number){
 const view=await scenarioView(d,tick),cells=[];
 for(let row=0;row<6;row++)for(let col=0;col<12;col++){
  const lat=Math.PI*((row+0.5)/6-0.5),lon=Math.PI*((col+0.5)/6-1);
  const normal={x:Math.cos(lat)*Math.cos(lon),y:Math.sin(lat),z:Math.cos(lat)*Math.sin(lon)};
  const query=trajectoryQuery(view.input.bundle,normal,tick),result=await view.read(query);
  let atmosphere:AtmosphereFrame|null=null;
  if(result.status==='Known'||result.status==='NoAtmosphere'){
   const sample=result.status==='Known'?result.sample:null;
   atmosphere=validateFrame({status:result.status,simulationTick:tick,weatherSnapshotId:result.WeatherSnapshotId,binding:{...result.binding},
    bodyId:query.bodyId,bodyRadiusMeters:view.input.bundle.physics.radiusMeters,bodyNormal:[normal.x,normal.y,normal.z],originMeters:[0,0,0],
    sourceRevision:0,atlasEpoch:0,weatherExtinctionPerM:sample?.extinctionPerM??0,windMps:sample?[sample.windBodyFixedMps.x,sample.windBodyFixedMps.y,sample.windBodyFixedMps.z]:[0,0,0],
    stormIds:[...(sample?.stormIds??[])],authoredCloudCoverage:0,rain01:0,opticsDigest:view.input.bundle.optics.digest});
  }
  cells.push({row,col,normal,result,atmosphere});
 }
 return immutable({tick,planet:d.planet,draftDigest:await contentDigest(d),cells,storms: synopticObjects(view.profile.digest,tick,view.input.bundle.physics.hazards.includes('Storms')),
  moisture:'UNSUPPORTED_NO_SATURATION',condensates:'EMPTY_FROM_CORE_NOT_SATURATION_PROOF',gpuTimer:null,actualAdapter:'NOT_REQUESTED_CPU_DOM'});
}
export interface Stored {schema:'wxg08.store/v1';revision:number;digest:string;draft:Draft}
export async function parseStored(raw:string,planet:string):Promise<Stored>{
 const v=JSON.parse(raw) as Stored;keys(v,['schema','revision','digest','draft'],'store');
 if(v.schema!=='wxg08.store/v1'||!Number.isSafeInteger(v.revision)||v.revision<1||v.draft.planet!==planet)throw Error('STORE');
 await validateDraft(v.draft);if(await contentDigest(v.draft)!==v.digest)throw Error('STORE_DIGEST');return immutable(v);
}
export async function commitDraft(d:Draft,expected:number,storage:Pick<Storage,'getItem'|'setItem'>,locks:Pick<LockManager,'request'>,current=()=>true):Promise<Stored>{
 await validateDraft(d);if(!Number.isSafeInteger(expected)||expected<0)throw Error('REVISION');
 if(!locks?.request)throw Error('CAS_UNSUPPORTED');
 const key='wxg08.lab.v1.'+d.planet;
 return locks.request(key,async()=>{
  const raw=storage.getItem(key),old=raw===null?null:await parseStored(raw,d.planet);
  if((old?.revision??0)!==expected)throw Error('STALE_DRAFT');
  if(expected===Number.MAX_SAFE_INTEGER)throw Error('REVISION_OVERFLOW');
  const stored:Stored={schema:'wxg08.store/v1',revision:expected+1,digest:await contentDigest(d),draft:d};
  if(!current())throw Error('CANCELLED');
  storage.setItem(key,canonicalCelestialJson(stored));return immutable(stored);
 });
}
export class Generation {private value=0;begin(){return ++this.value;}cancel(){this.value++;}current(token:number){return token===this.value;}}
