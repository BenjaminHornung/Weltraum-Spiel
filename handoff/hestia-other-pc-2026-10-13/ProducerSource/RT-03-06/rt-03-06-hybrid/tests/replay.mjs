import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as T from 'three';
import {DynamicProjection} from '../dist/src/dynamic.mjs';
import {OcclusionHistory,spatialFilter} from '../dist/src/history.mjs';
import {captureGBuffer,contactRays,resolveContact,upsampleContact,composeLinear} from '../dist/src/hybrid.mjs';
import {createDepthCameraPort} from '../dist/inputs/gfx03/src/port.js';
import {traceBruteForce} from '../dist/inputs/rt01/src/bruteForce.mjs';
import {spike,evidence,sha,parity,verifyInputs} from '../inputs.mjs';
await verifyInputs();const bytes=await readFile(path.join(spike,'fixtures/replay.json')),manifest=JSON.parse(await readFile(path.join(spike,'fixtures/replay-manifest.json')));assert.equal(bytes.length,manifest.bytes);assert.equal(sha(bytes),manifest.sha256);
const stream=JSON.parse(bytes),projection=new DynamicProjection(),history=new OcclusionHistory(),rows=[];let comparisons=0,frameIndex=0;
try{for(const event of stream.events){
 if(event.reset){projection.reset();history.reset();}
 const start=performance.now();projection.setPrimary(event.snapshots);projection.markPrimaryRender();projection.adopt(await projection.prepare());
 for(const ray of event.rays){const expected=event.snapshots.map(v=>traceBruteForce(v,ray)).filter(r=>r.kind!=='Miss').sort((a,b)=>a.distance-b.distance)[0]??traceBruteForce(event.snapshots[0],ray);
  for(const mode of ['bvh','flat','two-level']){parity(projection.query(ray,mode).result,expected,event.kind+mode);comparisons++;}}
 const binding=event.snapshots[0].binding,frame={width:4,height:4,frameIndex:frameIndex++,deviceEpoch:projection.deviceEpoch,cameraEpoch:event.reset?frameIndex:0,windEpoch:0,sourceBindings:projection.bindings,shadowRevision:{light:[1,0,0],casters:projection.bindings.map(b=>({id:b.owner,values:[b.sourceDigest,b.transformGeneration]}))}};
 const pixels=Array.from({length:16},()=>({owner:binding.owner,materialId:'1',position:[...event.rays[0].origin],normal:[1,0,0],depth:1,velocity:[0,0],direct:[.6,.6,.6],indirect:[.4,.4,.4],emissive:[0,0,0],blockAoApplied:true,role:'opaque',screenAo:0}));
 const depth=new T.DepthTexture(4,4),camera=new T.PerspectiveCamera(),port=createDepthCameraPort(camera,depth,projection.deviceEpoch,binding),g=captureGBuffer({frame,pixels,presentation:port,backend:'WebGPU'},port,frame);
 const batch=contactRays(g,[1,0,0],8,999),hits=batch.rays.map(r=>projection.query(r,'bvh').result),contact=resolveContact(batch,hits,projection.bindings);
 const temporal=history.apply(batch.frame,contact),filtered=spatialFilter(batch.frame,temporal.pixels),full=upsampleContact(g,batch,filtered),linear=g.pixels.map((p,i)=>composeLinear(p,full[i],'contact'));
 if(contact.every(p=>p.status==='CURRENT'))projection.markLightingCurrent();
 rows.push({kind:event.kind,edit:event.edit??null,region:event.region??null,provenance:event.provenance,sourceBindings:projection.bindings,timelines:projection.telemetry,resource:projection.resources(),history:history.resources(),historyReused:temporal.reused,contactKinds:contact.map(p=>p.status),linearFirst:linear[0],cpuWallMillisecondsDiagnostic:performance.now()-start});
 depth.dispose();
}assert.equal(comparisons,375);assert.equal(rows.filter(r=>r.kind==='100Edit').length,100);assert.ok(rows.every(r=>r.resource.retainedGenerations===1&&r.resource.backlog===0));}
finally{projection.dispose();history.dispose();}
const result={status:'PASS',executionLocation:'LOCAL_WINDOWS_ISOLATED',population:'FROZEN_ANALYTICAL_PLUS_SEPARATE_SUPPLEMENTAL_SYNTHETIC_REPLAY',events:rows.length,oracleComparisons:comparisons,rows,finalResources:projection.resources(),finalHistory:history.resources(),rasterEvidence:'CPU_GBUFFER_CONTRACT_DOUBLE_NO_GPU_RENDER',actualHvpCutSave:'NOT_RUN_NO_GENUINE_EXPORT',gpu:'NOT_RUN',actualAdapter:null,gpuMilliseconds:null,reference:'NOT_RUN',productIntegration:'NO'};
await writeFile(path.join(evidence,'replay-runtime.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,events:result.events,oracleComparisons:comparisons,finalResources:result.finalResources,hardware:'NOT_RUN'}));
