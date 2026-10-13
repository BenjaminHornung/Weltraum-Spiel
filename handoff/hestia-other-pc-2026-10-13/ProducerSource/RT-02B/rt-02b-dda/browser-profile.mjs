import {createSparseVolume} from './src/sparse.mjs';
import {GpuDdaBackend,admission,GPU_DISTANCE_TOLERANCE,requiredLimits} from './src/gpu.mjs';
import {createDepthCameraPort,validatePresentation} from './src/port.mjs';
import {digest,FIXTURE_PIN} from './imported/gfx03/src/port.js';
import {traceBruteForce} from './imported/rt01/src/bruteForce.mjs';
import * as T from 'three';
const checks=[];
const check=(name,ok)=>{checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw new Error(name);};
const fetchBytes=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Missing input '+url);return new Uint8Array(await r.arrayBuffer());};
async function inputs(){
 const mb=await fetchBytes('./fixtures/manifest.json');check('frozen manifest digest',await digest(mb)===FIXTURE_PIN);
 const manifest=JSON.parse(new TextDecoder().decode(mb)),load=async name=>{const ref=manifest.files.find(f=>f.path===name);check('listed '+name,!!ref);const b=await fetchBytes('./fixtures/'+name);check('bytes '+name,b.length===ref.byteLength&&await digest(b)===ref.sha256);return b;};
 const rays=JSON.parse(new TextDecoder().decode(await load('rays/golden-1000.json')));check('1000 unique ray IDs',rays.length===1000&&new Set(rays.map(r=>r.ray.id)).size===1000);
 const volumes=new Map(),sources=new Map();
 for(const id of new Set(rays.map(r=>r.volumeId))){const v=JSON.parse(new TextDecoder().decode(await load('voxels/'+id+'.json')));
  const bytes=await load('voxels/'+id+'.bin');check('uint8 x-fastest '+id,bytes.length===v.cells.length&&bytes.every((n,i)=>n===(v.cells[i]===-1?255:v.cells[i])));
  sources.set(id,v);volumes.set(id,await createSparseVolume(v,v.binding));}
 return {rays,volumes,sources};
}
function equal(a,b,tolerance=1e-9){
 const {normal:an,distance:ad,...ar}=a,{normal:bn,distance:bd,...br}=b;
 const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
 return JSON.stringify(sorted(ar))===JSON.stringify(sorted(br))&&Math.abs(ad-bd)<=tolerance&&an.every((n,i)=>Math.abs(n-bn[i])<=1e-9);
}
const hardware=()=>({actualAdapter:null,gpuMilliseconds:null,driver:null,hostLoad:'UNCONTROLLED_PARALLEL_SESSIONS',referenceAcceptance:false,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,userAgent:navigator.userAgent,executionLocation:'LOCAL_WINDOWS_ISOLATED'});
export async function runCpu(){
 checks.length=0;const input=await inputs();let population=0;
 for(const item of input.rays){const s=input.volumes.get(item.volumeId),source=input.sources.get(item.volumeId);
  check(item.ray.id+' independent brute',equal(traceBruteForce(source,item.ray),item.expected));
  for(const mode of ['flat','two-level']){check(item.ray.id+' '+mode,equal(s.traceFrozen(item.ray,item.sourceBinding,mode).result,item.expected));population++;}}
 const v=input.sources.get('grid-0.125'),camera=new T.PerspectiveCamera(60,1,.1,100),depth=new T.DepthTexture(16,16),p=createDepthCameraPort(camera,depth,3,v.binding);
 check('borrowed source/depth/copy port',validatePresentation(p,v.binding,3)===p);
 let rejected=false;try{validatePresentation(p,v.binding,4);}catch{rejected=true;}check('borrowed epoch rejection',rejected);
 depth.dispose();input.volumes.forEach(s=>s.dispose());
 return {status:'PASS',mode:'BROWSER_CPU_FUNCTIONAL',uniqueRays:1000,sparseComparisons:population,checks:[...checks],hardware:hardware(),gpu:'NOT_RUN'};
}
export async function runGpu(grant){
 if(!grant||grant.slot!=='A0_RUNNER'||grant.authorized!==true||!grant.windowId)throw new Error('Real explicit runner slot/window required; this profile grants no authority');
 checks.length=0;if(!navigator.gpu)return {status:'UNSUPPORTED',reason:'WEBGPU_UNAVAILABLE',hardware:hardware()};
 const input=await inputs(),adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter){input.volumes.forEach(s=>s.dispose());return {status:'UNSUPPORTED',reason:'ADAPTER_UNAVAILABLE',hardware:hardware()};}
 const limits={};for(const s of input.volumes.values()){const gate=admission(adapter,s,1000,'two-level');if(gate.status!=='PASS'){input.volumes.forEach(s=>s.dispose());return {status:'UNSUPPORTED',reason:gate.reason,hardware:hardware()};}
  for(const [k,n] of Object.entries(requiredLimits(s,1000,'two-level')))limits[k]=Math.max(limits[k]??0,n);}
 let device=null,backend=null;const groups=[],info=adapter.info;
 try{
  device=await adapter.requestDevice({requiredLimits:limits});const source=new TextDecoder().decode(await fetchBytes('./src/dda.wgsl'));
  backend=await GpuDdaBackend.create(device,source);
  for(const [id,s] of input.volumes){const rows=input.rays.filter(r=>r.volumeId===id);
   for(const mode of ['flat','two-level']){const outputs=await backend.traceFrozen(s,rows.map(r=>r.ray),()=>input.sources.get(id).binding,mode);
    outputs.forEach((r,i)=>check(rows[i].ray.id+' GPU '+mode,equal(r.result,rows[i].expected,GPU_DISTANCE_TOLERANCE)));
    groups.push({id,mode,count:outputs.length,counters:outputs.reduce((a,r)=>{for(const k in r.counters)a[k]+=r.counters[k];return a;},{pageLookups:0,rootLookups:0,cellTests:0,emptySkips:0}),residency:s.residency(mode,4),gpuMilliseconds:null});}
  }
  const s=input.volumes.get('grid-0.125'),ray={id:'distance-budget',origin:[-2,-.3125,-.3125],direction:[1,0,0],maxDistance:.01,maxSteps:1000};
  const bounded=await backend.query(s,[ray],()=>s.binding,'two-level');check('GPU distance budget explicit',bounded[0].result.kind==='BudgetExceeded');
  const boundary=structuredClone(input.sources.get('grid-0.125'));
  Object.assign(boundary,{id:'RT02B-supplemental-boundary-v1',provenance:'ANALYTICAL',size:[4,1,1],origin:[0,0,0],translation:[0,0,0],cells:[1,2,0,0],
   cellIds:Array.from({length:4},(_,i)=>'RT02B-supplemental-boundary-v1/cell/'+i),coverage:'complete',exteriorCoverage:'KnownEmpty'});
  boundary.binding={...boundary.binding,sourceRevision:1,sourceGeneration:1,owner:'rt02b-supplemental-boundary'};
  const bind=async v=>{v.binding.sourceDigest=await digest(new TextEncoder().encode(JSON.stringify({size:v.size,cellMeters:v.cellMeters,origin:v.origin,cells:v.cells,cellIds:v.cellIds,authorityLeafEdge:v.authorityLeafEdge,rayPageEdge:v.rayPageEdge,coverage:v.coverage,exteriorCoverage:v.exteriorCoverage})));};
  await bind(boundary);const bs=await createSparseVolume(boundary,boundary.binding);
  try{
   const edges=[];for(const q of [.9999995,1.0000005,1])for(const sign of [1,-1])edges.push({id:'boundary-'+q+'-'+sign,origin:[q*.125,.0625,.0625],direction:[sign,0,0],maxDistance:8,maxSteps:1000});
   edges.push({id:'corner',origin:[0,0,0],direction:[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)],maxDistance:8,maxSteps:1000});
   edges.push({id:'step-budget-zero',origin:[0,.0625,.0625],direction:[1,0,0],maxDistance:8,maxSteps:0});
   for(const mode of ['flat','two-level']){const output=await backend.traceFrozen(bs,edges,()=>boundary.binding,mode);output.forEach((r,i)=>check('GPU supplemental '+edges[i].id+' '+mode,equal(r.result,traceBruteForce(boundary,edges[i]),GPU_DISTANCE_TOLERANCE)));}
  }finally{bs.dispose();}
  const unknown=structuredClone(boundary);unknown.id='RT02B-supplemental-unknown-v1';unknown.cells=[0,-1,0,0];unknown.coverage='partial';unknown.binding.sourceGeneration++;unknown.binding.sourceRevision++;await bind(unknown);
  const us=await createSparseVolume(unknown,unknown.binding);
  try{const r={id:'missing-page',origin:[0,.0625,.0625],direction:[1,0,0],maxDistance:8,maxSteps:1000};
   for(const mode of ['flat','two-level']){const output=await backend.traceFrozen(us,[r],()=>unknown.binding,mode);check('GPU supplemental Unknown '+mode,equal(output[0].result,traceBruteForce(unknown,r),GPU_DISTANCE_TOLERANCE));}}
  finally{us.dispose();}
  const result={status:'PASS',mode:'GPU_FUNCTIONAL_DIAGNOSTIC',grant:{slot:grant.slot,windowId:grant.windowId},uniqueRays:1000,checks:[...checks],groups,
   shader:{sha256:await digest(new TextEncoder().encode(source)),compilation:'PASS'},
   hardware:{...hardware(),actualAdapter:{vendor:info.vendor||null,architecture:info.architecture||null,device:info.device||null,description:info.description||null},requestedLimits:limits,deviceLimits:Object.fromEntries(Object.keys(limits).map(k=>[k,device.limits[k]])),gpuMilliseconds:null}};
  return result;
 }catch(e){return {status:'FAIL',reason:String(e),checks:[...checks],groups,hardware:{...hardware(),actualAdapter:{vendor:info.vendor||null,architecture:info.architecture||null,device:info.device||null,description:info.description||null}},productIntegration:'NO'};}
 finally{backend?.dispose();input.volumes.forEach(s=>s.dispose());device?.destroy();}
}
window.RT02B={runCpu,runGpu};
try{const result=await runCpu();window.RT02B_RESULT=result;document.querySelector('#status').textContent=JSON.stringify({...result,checks:result.checks.length},null,2);}
catch(e){window.RT02B_RESULT={status:'FAIL',error:String(e),checks:[...checks]};document.querySelector('#status').textContent=String(e);}
