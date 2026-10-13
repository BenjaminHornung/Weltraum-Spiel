import test from 'node:test';
import assert from 'node:assert/strict';
import {DynamicProjection} from '../dist/src/dynamic.mjs';
import {analyticalVolume,bindSource,setCell} from '../inputs/rt01/fixtures.mjs';
import {traceBruteForce} from '../dist/inputs/rt01/src/bruteForce.mjs';
import {loadFixtures,parity} from '../inputs.mjs';
const ray={id:'opening',origin:[-2,-.3125,-.3125],direction:[1,0,0],maxDistance:8,maxSteps:999};
test('frozen1000 preserve BVH and sparse flat/two-level tuples with PrimitiveHit metadata',async()=>{
 const {rays,volumes}=await loadFixtures(),p=new DynamicProjection();let checks=0;
 try{for(const [id,v] of volumes){p.setPrimary([v]);p.adopt(await p.prepare());
  for(const r of rays.filter(r=>r.volumeId===id))for(const mode of ['bvh','flat','two-level']){
   const hit=p.query(r.ray,mode);parity(hit.result,r.expected,r.ray.id+mode);
   if(hit.result.kind==='Hit'){assert.equal(hit.primitive.surface.owner,r.expected.owner);assert.equal(hit.primitive.surface.materialSource,r.expected.materialSource);assert.equal(hit.primitive.sourceBinding.sourceDigest,v.binding.sourceDigest);}
   checks++;
  }}assert.equal(checks,3000);
 }finally{p.dispose();}assert.equal(p.resources().retainedGenerations,0);
});
test('cut opens light; late generation discarded, no stale query, disposal and telemetry separated',async()=>{
 const p=new DynamicProjection(),v=analyticalVolume();setCell(v,[5,1,1],1);
 p.setPrimary([v]);const first=await p.prepare();p.markPrimaryRender();p.adopt(first);assert.equal(p.query(ray,'bvh').result.kind,'Hit');
 const late=await p.prepare(),next=structuredClone(v);next.binding.sourceGeneration++;next.binding.sourceRevision++;setCell(next,[5,1,1],0);
 p.setPrimary([next]);assert.throws(()=>p.query(ray,'bvh'),/current/);assert.throws(()=>p.adopt(late),/Stale/);assert.equal(late.resources().retainedGenerations,0);
 p.markPrimaryRender();p.adopt(await p.prepare());for(const mode of ['bvh','flat','two-level'])assert.equal(p.query(ray,mode).result.kind,'Miss');
 const t=p.telemetry;assert.ok(t.t_source_commit<=t.t_primary_render&&t.t_primary_render<=t.t_ray_adopt);assert.equal(t.t_lighting_current,null);assert.equal(t.gpuMilliseconds,null);
 p.markLightingCurrent();assert.ok(p.telemetry.t_lighting_current>=t.t_ray_adopt);p.dispose();assert.throws(()=>p.setPrimary([v]),/Disposed/);
});
test('transfer/motion/origin/save-reset retain one owner and reject old lifetime',async()=>{
 const {volumes}=await loadFixtures(),p=new DynamicProjection();
 p.setPrimary([volumes.get('after-transfer-terrain'),volumes.get('fragment')]);p.adopt(await p.prepare());
 assert.throws(()=>p.setPrimary([volumes.get('after-cut'),volumes.get('fragment')]),/duplicate/);
 p.setPrimary([volumes.get('after-transfer-terrain'),volumes.get('fragment-rotated')]);p.adopt(await p.prepare());
 const shifted=volumes.get('origin-shift');p.setPrimary([shifted]);p.adopt(await p.prepare());const sr={...ray,origin:ray.origin.map((n,a)=>n+shifted.translation[a])};
 for(const mode of ['bvh','flat','two-level'])parity(p.query(sr,mode).result,traceBruteForce(shifted,sr));
 const late=await p.prepare();p.reset(1);assert.throws(()=>p.adopt(late),/Stale/);assert.equal(late.resources().retainedGenerations,0);assert.equal(p.telemetry.t_ray_adopt,null);
 const restored=structuredClone(volumes.get('grid-0.125'));restored.binding.epoch='synthetic-save-reset-2';p.setPrimary([restored]);p.adopt(await p.prepare());parity(p.query(ray,'bvh').result,traceBruteForce(restored,ray));p.dispose();
});
test('100 edits bounded retained resource population and sparse dirty adoption',async()=>{
 const p=new DynamicProjection(),v=analyticalVolume(.125,[18,4,4],'rt03-edits');
 p.setPrimary([v]);p.adopt(await p.prepare());const retained=[];
 for(let i=1;i<=100;i++){const next=structuredClone(v);next.binding.sourceGeneration=i;next.binding.sourceRevision=i;setCell(next,[5,1,1],i%2);
  p.setPrimary([next]);const candidate=await p.prepare();assert.equal(candidate.dirtyPages.length,1);p.adopt(candidate);
  for(const mode of ['bvh','flat','two-level'])parity(p.query(ray,mode).result,traceBruteForce(next,ray));
  retained.push(p.resources());Object.assign(v,next);
 }assert.ok(retained.every(r=>r.retainedGenerations===1&&r.bvhGeometries===1&&r.sparseOwners===1));assert.ok(Math.max(...retained.map(r=>r.typedCpuBytes))<100000);p.dispose();
});
test('unknown/budget/empty/corrupt source and all current binding fields fail closed',async()=>{
 const {volumes}=await loadFixtures(),p=new DynamicProjection(),unknown=volumes.get('missing-neighbor');
 p.setPrimary([unknown]);p.adopt(await p.prepare());const u={...ray,origin:[.05,-.3125,-.3125]};
 assert.equal(p.query(u,'flat').result.kind,'Unknown');assert.equal(p.query({...ray,maxSteps:0},'bvh').result.kind,'BudgetExceeded');
 const corrupt=structuredClone(unknown);corrupt.cells[0]=1;p.setPrimary([corrupt]);await assert.rejects(p.prepare(),/digest/);assert.throws(()=>p.query(ray,'bvh'),/current/);
 p.setPrimary([],true);p.adopt(await p.prepare());assert.equal(p.query(ray,'bvh').result.kind,'Miss');assert.equal(p.query(ray,'bvh').primitive,null);
 assert.throws(()=>p.query({...ray,direction:[2,0,0]},'bvh'),/Invalid/);p.dispose();
 for(const [key,value] of Object.entries(volumes.get('grid-0.125').binding)){const q=new DynamicProjection(),v=volumes.get('grid-0.125');q.setPrimary([v]);const candidate=await q.prepare(),next=structuredClone(v);next.binding[key]=typeof value==='number'?value+1:key.endsWith('Digest')?(value[0]==='0'?'1':'0')+value.slice(1):value+'-new';q.setPrimary([next]);assert.throws(()=>q.adopt(candidate),/Stale/);q.dispose();}
});
