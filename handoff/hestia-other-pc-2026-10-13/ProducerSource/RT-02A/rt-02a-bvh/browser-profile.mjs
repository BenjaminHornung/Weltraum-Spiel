import {BvhRayBackend} from './dist/src/backend.js';
import {ComputeBvhBackend} from './dist/src/compute.js';
import {loadPort,digest,FIXTURE_PIN} from './dist/imports/gfx/src/port.js';
import {traceDda} from './dist/imports/rt/src/dda.mjs';
import {traceBruteForce} from './dist/imports/rt/src/bruteForce.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const discrete=value=>Object.keys(value).filter(key=>key!=='distance'&&key!=='normal').sort().map(key=>[key,value[key]]);
const equal=(a,b,tolerance=1e-9)=>Math.abs(a.distance-b.distance)<=tolerance&&a.normal.every((n,i)=>Math.abs(n-b.normal[i])<=tolerance)&&JSON.stringify(discrete(a))===JSON.stringify(discrete(b));
async function inputs(){
  const bytes=new Uint8Array(await(await fetch('./fixtures/manifest.json')).arrayBuffer());check(await digest(bytes)===FIXTURE_PIN,'Manifest drift');const manifest=JSON.parse(new TextDecoder().decode(bytes));const files=new Map();
  for(const ref of manifest.files){const response=await fetch(`./fixtures/${ref.path}`);check(response.ok,'Missing fixture');const data=new Uint8Array(await response.arrayBuffer());check(data.length===ref.byteLength&&await digest(data)===ref.sha256,'Payload drift');files.set(ref.path,data);}
  const json=name=>JSON.parse(new TextDecoder().decode(files.get(name)));const golden=json('rays/golden-1000.json');return {manifest,json,rows:golden.rays??golden};
}
export async function runCpuProfile(){
  const {manifest,json,rows}=await inputs();check(rows.length===1000&&new Set(rows.map(r=>r.ray.id)).size===1000,'Population drift');const port=await loadPort();let comparisons=0;
  for(const id of new Set(rows.map(r=>r.volumeId))){const v=json(`voxels/${id}.json`),b=new BvhRayBackend();await b.prepare(v,v.binding);
    for(const row of rows.filter(r=>r.volumeId===id)){const r=b.query(row.ray,v.binding);check(equal(r,row.expected),`Expected ${row.ray.id}`);check(equal(r,traceBruteForce(v,row.ray)),`Oracle ${row.ray.id}`);check(equal(r,traceDda(v,row.ray)),`DDA ${row.ray.id}`);check(equal(b.query(row.ray,v.binding,'AnyHit'),r),`Any ${row.ray.id}`);comparisons+=4;}b.dispose();check(b.resources().retainedCpuBytes===0,'CPU retained');}
  return {status:'PASS',profile:'BROWSER_CPU_FUNCTIONAL_NO_DEVICE',executionLocation:'LOCAL_WINDOWS_ISOLATED',rows:1000,comparisons,fixtureMembers:manifest.files.length,meshPayloads:port.buffers.size,materialView:port.fixture.materials,camera:port.camera,
    browser:navigator.userAgent,devicePixelRatio,viewport:[innerWidth,innerHeight],environmentLoad:'CONCURRENT_OTHER_MAIN_SESSIONS; NOT_MEASURED',actualAdapter:null,gpu:'NOT_RUN',gpuTimer:null,reference:'NOT_RUN',productIntegration:'NO'};
}
/** Runner supplies an existing authorized WebGPURenderer host and verified adapter record. */
export async function runGpuProfile(host){
  check(host.actualAdapter,'ActualAdapter is required; powerPreference alone is not identity');const {json,rows}=await inputs();let pass=0;const failures=[],resources=[];
  for(const id of new Set(rows.map(r=>r.volumeId))){const v=json(`voxels/${id}.json`),group=rows.filter(r=>r.volumeId===id),b=new ComputeBvhBackend(host);await b.prepare(v,v.binding);
    try{for(const mode of ['ClosestHit','AnyHit']){const actual=await b.query(group.map(r=>r.ray),v.binding,mode);actual.forEach((result,i)=>{if(equal(result,group[i].expected,1e-5))pass++;else failures.push({mode,rayId:group[i].ray.id,actual:result,expected:group[i].expected});});}resources.push({id,costs:b.costs});}finally{b.dispose();}}
  return {status:failures.length?'FAIL':'PASS',scope:'GPU_FUNCTIONAL_NOT_HARDWARE_REFERENCE',rows:1000,modes:2,pass,failures,resources,actualAdapter:host.actualAdapter,precisionPolicy:'FP32 distance/normal tolerance 1e-5; discrete tuple equality exact',reference:'NOT_RUN',productIntegration:'NO'};
}
