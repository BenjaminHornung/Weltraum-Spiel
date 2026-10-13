import test from 'node:test';
import assert from 'node:assert/strict';
import { BvhRayBackend } from '../dist/src/backend.js';
import { traceBruteForce } from '../dist/imports/rt/src/bruteForce.mjs';
import { traceDda } from '../dist/imports/rt/src/dda.mjs';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { createDepthCameraPort } from '../dist/imports/gfx/src/port.js';
import { consumePresentation } from '../dist/src/presentation.js';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bind=v=>{v.binding.sourceDigest=sha({size:v.size,cellMeters:v.cellMeters,origin:v.origin,cells:v.cells,cellIds:v.cellIds,authorityLeafEdge:v.authorityLeafEdge,rayPageEdge:v.rayPageEdge,coverage:v.coverage,exteriorCoverage:v.exteriorCoverage});v.binding.materialDigest=sha(v.materials);return v;};
const golden=JSON.parse(await readFile(new URL('../fixtures/rays/golden-1000.json',import.meta.url))),rows=golden.rays??golden;
const volumes=new Map();for(const row of rows)if(!volumes.has(row.volumeId))volumes.set(row.volumeId,JSON.parse(await readFile(new URL(`../fixtures/voxels/${row.volumeId}.json`,import.meta.url))));
const compare=(a,b)=>{assert.ok(Math.abs(a.distance-b.distance)<=1e-9,`${a.distance} != ${b.distance}`);a.normal.forEach((n,i)=>assert.ok(Math.abs(n-b.normal[i])<=1e-9));assert.deepEqual({...a,distance:0,normal:[]},{...b,distance:0,normal:[]});};
let rayChecks=0;const telemetry=[];
test('1000 unique rays: BVH closest/any tuples against expected, independent brute force and DDA',async()=>{
  assert.equal(rows.length,1000);assert.equal(new Set(rows.map(r=>r.ray.id)).size,1000);
  for(const [id,v] of volumes){const backend=new BvhRayBackend();await backend.prepare(v,v.binding);
    for(const row of rows.filter(r=>r.volumeId===id)){const result=backend.query(row.ray,row.sourceBinding??v.binding);compare(result,row.expected);compare(result,traceBruteForce(v,row.ray));compare(result,traceDda(v,row.ray));compare(backend.query(row.ray,v.binding,'AnyHit'),result);rayChecks++;}
    telemetry.push({id,resources:backend.resources(),costs:backend.costs});assert.equal(backend.dispose(),true);assert.equal(backend.dispose(),false);assert.equal(backend.resources().retainedCpuBytes,0);}
  await writeFile(new URL('../../../.devtoolbox/specs/changes/rt-02a-2026-10-09/tests/oracle-results.json',import.meta.url),JSON.stringify({status:'PASS',rays:rayChecks,queryModes:2,provenance:{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0},telemetry,timingClass:'FUNCTIONAL_DIAGNOSTIC_CONCURRENT_LOAD_NOT_REFERENCE',hardware:'NOT_RUN'},null,2)+'\n');
});
test('all binding fields, device epoch, invalid rays and use-after-dispose reject',async()=>{
  const v=volumes.values().next().value,row=rows.find(r=>r.volumeId===v.id)??rows[0],b=new BvhRayBackend(2);await b.prepare(v,v.binding,2);
  for(const key of Object.keys(v.binding)){const wrong={...v.binding,[key]:typeof v.binding[key]==='number'?v.binding[key]+1:`wrong-${v.binding[key]}`};assert.throws(()=>b.query(row.ray,wrong,'ClosestHit',2),/Stale/);}
  assert.throws(()=>b.query(row.ray,v.binding,'ClosestHit',3),/device/);assert.throws(()=>b.query({...row.ray,direction:[0,0,0]},v.binding,'ClosestHit',2),/normalized/);
  b.dispose();assert.throws(()=>b.query(row.ray,v.binding,'ClosestHit',2),/disposed/);
});
test('payload tampering, duplicate membership and unversioned topology reject',async()=>{
  const v=structuredClone(volumes.values().next().value),b=new BvhRayBackend();await b.prepare(v,v.binding);
  const dirty=structuredClone(v);dirty.cells[0]=1;await assert.rejects(b.update(dirty,dirty.binding),/digest/);
  bind(dirty);await assert.rejects(b.update(dirty,dirty.binding),/generation/);
  dirty.binding.sourceGeneration++;dirty.cellIds[0]=dirty.cellIds[1];bind(dirty);await assert.rejects(b.update(dirty,dirty.binding),/membership/);b.dispose();
});
test('cut rebuild and movement preserve membership, transform-only retains geometry',async()=>{
  const ids=[...volumes.keys()];const before=volumes.get('before-cut')??volumes.get(ids[0]);const b=new BvhRayBackend();await b.prepare(before,before.binding);let generation=b.resources().geometryGeneration;
  const cut=structuredClone(before);const cell=cut.cells.findIndex(n=>n>0);assert.ok(cell>=0);cut.cells[cell]=0;cut.binding.sourceRevision++;cut.binding.sourceGeneration++;bind(cut);await b.update(cut,cut.binding);assert.ok(b.resources().geometryGeneration>generation);generation=b.resources().geometryGeneration;
  const moved=structuredClone(cut);moved.translation[0]+=3;moved.binding.transformGeneration++;await b.update(moved,moved.binding);assert.equal(b.resources().geometryGeneration,generation);
  const ray=rows.find(r=>r.volumeId===before.id).ray;const translated={...ray,origin:ray.origin.map((n,a)=>n+(a===0?3:0))};compare(b.query(translated,moved.binding),traceBruteForce(moved,translated));
  assert.throws(()=>b.query(ray,cut.binding),/Stale/);const silent=structuredClone(moved);silent.translation[1]++;await assert.rejects(b.update(silent,silent.binding),/Transform/);b.dispose();
});
test('abort before/while preparing retains previous generation, superseded preparation cleans candidate',async()=>{
  const v=volumes.values().next().value,b=new BvhRayBackend(),abort=new AbortController();abort.abort();await assert.rejects(b.prepare(v,v.binding,0,abort.signal));assert.equal(b.resources().retainedGeometries,0);await b.prepare(v,v.binding);
  const cut=structuredClone(v);cut.cells[0]=cut.cells[0]===0?1:0;cut.binding.sourceGeneration++;cut.binding.sourceRevision++;bind(cut);const active=new AbortController();const pending=b.update(cut,cut.binding,0,active.signal);active.abort();await assert.rejects(pending);assert.equal(b.snapshot().binding.sourceDigest,v.binding.sourceDigest);b.dispose();
  const race=new BvhRayBackend();const one=race.prepare(v,v.binding),two=race.prepare(v,v.binding);const settled=await Promise.allSettled([one,two]);assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);race.dispose();
});
test('missing neighbor remains Unknown; budget includes air and zero steps',async()=>{
  const candidates=rows.filter(r=>['Unknown','BudgetExceeded'].includes(r.expected.kind));assert.equal(candidates.length,138);
  for(const id of new Set(candidates.map(r=>r.volumeId))){const v=volumes.get(id),b=new BvhRayBackend();await b.prepare(v,v.binding);for(const row of candidates.filter(r=>r.volumeId===id))compare(b.query(row.ray,v.binding),row.expected);b.dispose();}
});
test('GFX borrow: epoch/identity/metadata and clip convention, copied camera arrays',()=>{
  const camera=new T.PerspectiveCamera(),depth=new T.DepthTexture(2,2),binding={owner:'fixture',source:{revision:1}};
  const port=createDepthCameraPort(camera,depth,1,binding);let calls=0;
  const gl=consumePresentation(port,port,'WebGL2',[],d=>{assert.equal(d,depth);calls++;});const gpu=consumePresentation(port,port,'WebGPU',[],()=>{});
  assert.deepEqual(gl.clipRange,[-1,1]);assert.deepEqual(gpu.clipRange,[0,1]);camera.projectionMatrix.elements[0]=50;assert.notEqual(gl.projection[0],50);binding.source.revision=8;assert.equal(gl.sourceBinding.source.revision,1);assert.equal('depth' in gl,false);
  assert.throws(()=>consumePresentation(port,{...port,epoch:2},'WebGPU',[],()=>{}),/Stale/);assert.throws(()=>consumePresentation(port,{...port,depth:new T.DepthTexture(2,2)},'WebGPU',[],()=>{}),/Stale/);assert.equal(calls,1);depth.dispose();
});
