import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {loadInputs,verifyImports,spike,compare} from '../inputs.mjs';
import {createSparseVolume} from '../src/sparse.mts';
import {packRays,admission,requiredLimits} from '../src/gpu.mts';
const {volumes,rays}=await loadInputs();
test('GPU LE ray layout, relative frame, bounded counts and real requested limits',async()=>{
 const v=volumes.get('origin-shift'),s=await createSparseVolume(v,v.binding),r=rays.find(r=>r.volumeId===v.id).ray;
 const b=packRays(s,[r],true),d=new DataView(b),local=s.localRay(r);
 assert.equal(b.byteLength,48);assert.ok(Math.abs(d.getFloat32(0,true)-(local.origin[0]-v.origin[0])/v.cellMeters)<1e-5);
 assert.equal(d.getUint32(32,true),r.maxSteps);assert.equal(d.getUint32(36,true),1);
 assert.throws(()=>packRays(s,[{...r,maxSteps:2**32}],true),/u32/);
 assert.throws(()=>packRays(s,[r,r],true),/Duplicate ray identity/);
 assert.throws(()=>packRays(s,[{...r,origin:[1e20,0,0]}],true),/precision/);
 const limits=requiredLimits(s,1000,'two-level');assert.equal(limits.maxStorageBuffersPerShaderStage,6);
 assert.equal(admission(null,s,1000,'two-level').status,'UNSUPPORTED');
 // Supplemental capability contract tests; this is no real adapter execution.
 const fake={features:new Set(),limits:{...limits}};assert.equal(admission(fake,s,1000,'two-level').status,'PASS');
 fake.limits.maxStorageBufferBindingSize=4;assert.equal(admission(fake,s,1000,'two-level').status,'UNSUPPORTED');
 assert.throws(()=>requiredLimits(s,4097,'flat'),/Finite/);s.dispose();
});
test('oracle comparator independently rejects forged kind, cell identity, material source and distance',async()=>{
 const hit=rays.find(r=>r.expected.kind==='Hit'),s=await createSparseVolume(volumes.get(hit.volumeId),hit.sourceBinding);
 const actual=s.traceFrozen(hit.ray,hit.sourceBinding).result;
 for(const patch of [{kind:'Miss'},{cellId:'forged'},{materialSource:'forged'},{distance:actual.distance+.01}])assert.throws(()=>compare(actual,{...hit.expected,...patch}));
 s.dispose();
});
test('untrusted import manifest mutation fails closed in retained own-scope copy',async()=>{
 const copy=path.join(spike,'negative-copies','manifest-'+crypto.randomUUID());await mkdir(copy,{recursive:true});
 const m=JSON.parse(await readFile(path.join(spike,'import-manifest.json')));m.files[0].sha256='0'.repeat(64);
 await writeFile(path.join(copy,'import-manifest.json'),JSON.stringify(m));await assert.rejects(verifyImports(copy),/Trusted local import manifest/);
});
