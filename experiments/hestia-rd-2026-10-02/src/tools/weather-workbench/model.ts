import {createScenario,sampleScenario,type LabKeyframe} from '../../contracts/scenario';
import {getFixtureDigest} from '../../contracts/fixture';
import {PINNED_INVENTORY_SHA256,type loadReplay} from '../../runner/assets';
import {array,canonicalJson,digest,freezeJson,id,integer,keys,parseBoundedJson,requireValue,sha256} from '../../contracts/validation';
import {createWeatherPreset,WEATHER_PRESETS,sampleWeatherAt,type WeatherPreset} from '../../experiments/weather-field';
import {createWetnessPreset,WET_LIMITS} from '../../experiments/wet-surface';
import modelSource from './model.ts?raw';
import weatherSource from '../../experiments/weather-field/index.ts?raw';
import wetnessSource from '../../experiments/wet-surface/index.ts?raw';
type Replay=Awaited<ReturnType<typeof loadReplay>>;
export interface WeatherDocument{readonly schema:'hestia-rd-weather-workbench-v1';readonly productIntegrated:false;readonly generatorDigest:string;readonly source:{readonly inventoryDigest:string;readonly scenarioId:string;readonly scenarioDigest:string;readonly fixtures:readonly string[]};readonly initialWeatherPresetId:string;readonly fields:Readonly<Record<string,WeatherPreset>>;readonly keyframes:readonly LabKeyframe[];}
const validated=new WeakSet<WeatherDocument>();
async function codeDigest(){return sha256(new TextEncoder().encode(canonicalJson([modelSource,weatherSource,wetnessSource])));}
function source(replay:Replay){return{inventoryDigest:PINNED_INVENTORY_SHA256,scenarioId:replay.scenario.id,scenarioDigest:replay.scenarioDigest,fixtures:[...replay.fixtures.keys()].sort()};}
function validate(input:WeatherDocument,replay:Replay){keys(input,['schema','productIntegrated','generatorDigest','source','initialWeatherPresetId','fields','keyframes']);requireValue(input.schema==='hestia-rd-weather-workbench-v1'&&input.productIntegrated===false,'Unsupported weather workbench version/scope');digest(input.generatorDigest);requireValue(canonicalJson(input.source)===canonicalJson(source(replay)),'Unbound frozen source references');
 keys(input.fields,Object.keys(input.fields));const ids=Object.keys(input.fields);requireValue(ids.length>0&&ids.length<=8,'At most eight weather fields');const fields:Record<string,WeatherPreset>={};for(const name of ids){id(name);fields[name]=createWeatherPreset(input.fields[name]);requireValue(fields[name].id===name,'Weather field ID differs from key');}
 array(input.keyframes);requireValue(input.keyframes.length<=64&&replay.scenario.durationTicks<=3600,'Workbench timeline exceeds lab budget');
 requireValue(input.keyframes.filter(e=>e.type==='SetWeatherPreset'&&e.tick>0).length+1<=WET_LIMITS.historyEvents,'Wetness history exceeds its budget including the initial event');
 const result=freezeJson({...input,fields,source:source(replay),keyframes:JSON.parse(canonicalJson(input.keyframes))});
 const samples=Object.fromEntries(ids.map(name=>[name,sampleWeatherAt([0,0,0],0,fields[name])]));createScenario({...replay.scenario,initialWeatherPresetId:result.initialWeatherPresetId,weatherPresets:samples,keyframes:result.keyframes},replay.initialFixture);validated.add(result);return result;
}
export async function createWeatherDocument(replay:Replay,input?:Omit<WeatherDocument,'generatorDigest'|'schema'|'source'|'productIntegrated'>){
 const defaults={initialWeatherPresetId:'clear',fields:WEATHER_PRESETS,keyframes:[{tick:120,type:'SetWeatherPreset',presetId:'breeze'},{tick:240,type:'SetWeatherPreset',presetId:'rain'},{tick:900,type:'SetWeatherPreset',presetId:'breeze'}] as LabKeyframe[]};
 return validate({schema:'hestia-rd-weather-workbench-v1',productIntegrated:false,generatorDigest:await codeDigest(),source:source(replay),...(input??defaults)},replay);
}
export async function importWeatherDocument(bytes:Uint8Array,replay:Replay){const raw=parseBoundedJson(bytes) as WeatherDocument;requireValue(raw.generatorDigest===await codeDigest(),'Stale weather generator');return validate(raw,replay);}
export function weatherDocumentBytes(doc:WeatherDocument){requireValue(validated.has(doc),'Unvalidated weather document');const bytes=new TextEncoder().encode(canonicalJson(doc));parseBoundedJson(bytes);return bytes;}
export function compileWeatherDocument(doc:WeatherDocument,replay:Replay){requireValue(validated.has(doc)&&canonicalJson(doc.source)===canonicalJson(source(replay)),'Stale/unvalidated weather document');
 const samples=Object.fromEntries(Object.entries(doc.fields).map(([name,p])=>[name,sampleWeatherAt([0,0,0],0,p)]));
 const scenario=createScenario({...replay.scenario,initialWeatherPresetId:doc.initialWeatherPresetId,weatherPresets:samples,keyframes:doc.keyframes},replay.initialFixture);
 const rainHistory=[{tick:0,rain01:doc.fields[doc.initialWeatherPresetId].rain01}];for(const event of doc.keyframes)if(event.type==='SetWeatherPreset'){if(event.tick===0)rainHistory[0]={tick:0,rain01:doc.fields[event.presetId].rain01};else rainHistory.push({tick:event.tick,rain01:doc.fields[event.presetId].rain01});}
 const wetness=createWetnessPreset({schema:'hestia-rd-wetness-v1',id:'weather-workbench',model:'current-exposure-analytic',sourcePolicy:'reset-at-snapshot',wettingPerSecond:.35,dryingPerSecond:.08,rainHistory});
 return{doc,scenario,wetness};
}
export function sampleWeatherDocument(compiled:ReturnType<typeof compileWeatherDocument>,tick:number,paused:boolean){integer(tick);const sample=sampleScenario(compiled.scenario,tick,paused);let name=compiled.doc.initialWeatherPresetId;for(const event of compiled.doc.keyframes)if(event.tick<=tick&&event.type==='SetWeatherPreset')name=event.presetId;
 return freezeJson({...sample,frame:{...sample.frame,weather:sampleWeatherAt(sample.fixture.frame.originMeters,tick,compiled.doc.fields[name])},weatherPresetId:name,sourceEpoch:Math.max(compiled.scenario.snapshots.filter(s=>s.tick<=tick).at(-1)?.tick??0,sample.resetTick??0),fixtureDigest:getFixtureDigest(sample.fixture)});
}
