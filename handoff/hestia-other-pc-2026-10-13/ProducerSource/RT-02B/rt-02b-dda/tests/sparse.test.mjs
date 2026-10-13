import assert from 'node:assert/strict';
import test from 'node:test';
import {createSparseVolume,ProjectionSet,validateUpload} from '../src/sparse.mts';
import {loadInputs,compare} from '../inputs.mjs';
import {traceBruteForce} from '../imported/rt01/src/bruteForce.mts';
import {traceDda} from '../imported/rt01/src/dda.mts';
import {analyticalVolume,bindSource,setCell} from '../imported/rt01/fixtures.mjs';
test('sparse implementation exports real kernel',()=>assert.equal(typeof createSparseVolume,'function'));
const {rays,volumes}=await loadInputs();
const sparse=new Map(await Promise.all([...volumes].map(async([id,v])=>[id,await createSparseVolume(v,v.binding)])));
test('1,000 unique unchanged expected rays match brute force and both sparse paths',()=>{
 for(const item of rays){const v=volumes.get(item.volumeId),s=sparse.get(item.volumeId);
  compare(traceBruteForce(v,item.ray),item.expected,item.ray.id+' brute');
  compare(traceDda(v,item.ray),item.expected,item.ray.id+' old');
  for(const mode of ['flat','two-level'])compare(s.traceFrozen(item.ray,item.sourceBinding,mode).result,item.expected,item.ray.id+' '+mode);
 }
});
const ray=(o,d=[1,0,0],maxSteps=9999,maxDistance=100)=>({id:'boundary',origin:o,direction:d,maxDistance,maxSteps});
test('faces/corners/zero axes/start inside/negative origin/budgets against independent AABBs',async()=>{
 const v=analyticalVolume(0.125,[64,4,4],'boundary');v.origin=[-8,-0.5,-0.5];bindSource(v);setCell(v,[40,1,1],2);
 const s=await createSparseVolume(v,v.binding),q=Math.SQRT1_2;
 const rs=[ray([-8,-.3125,-.3125]),ray([-3,-.3125,-.3125]),ray([-2.875,-.3125,-.3125],[-1,0,0]),ray([-9,-.3125,-.3125]),
  ray([-8,-.5,-.5],[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)]),ray([-8,-.4375,-.4375],[q,q,0]),
  ray([-8,0,-.3125]),...[0,1,8,31,40,41,64].map(n=>ray([-8,-.3125,-.3125],[1,0,0],n)),ray([-8,-.3125,-.3125],[1,0,0],9999,5)];
 for(const r of rs)for(const mode of ['flat','two-level'])compare(s.traceFrozen(r,v.binding,mode).result,traceBruteForce(v,r),'edge '+mode);
 const exclusive=ray([-8,-.3125,-.3125],[1,0,0],9999,5);
 assert.equal(s.traceFrozen(exclusive,v.binding).result.kind,'Miss','Historical endpoint assertion retained');
 assert.equal(s.query(exclusive,v.binding).result.kind,'BudgetExceeded','Bounded query cannot prove a complete miss');
 const beyond=ray([-9,-.3125,-.3125],[1,0,0],9999,.1);
 assert.equal(s.query(beyond,v.binding).result.kind,'BudgetExceeded');
});
test('hierarchical empty-space skip reduces real table lookup count at identical output',async()=>{
 const v=analyticalVolume(.125,[64,4,4],'skip');setCell(v,[63,1,1],1);
 const s=await createSparseVolume(v,v.binding),r=ray([v.origin[0],v.origin[1]+.1875,v.origin[2]+.1875]);
 const a=s.traceFrozen(r,v.binding,'flat'),b=s.traceFrozen(r,v.binding,'two-level');
 compare(a.result,traceBruteForce(v,r));compare(b.result,a.result);
 assert.ok(b.counters.pageLookups+b.counters.rootLookups<a.counters.pageLookups,'Keep hierarchy only with proven work reduction');
});
test('missing/unknown pages and partial exterior never become confirmed light openings',async()=>{
 const v=analyticalVolume(.125,[64,4,4],'missing');v.coverage='partial';v.exteriorCoverage='Unknown';
 for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=32;x<40;x++)v.cells[x+64*(y+4*z)]=-1;bindSource(v);
 const s=await createSparseVolume(v,v.binding),r=ray([-2,-.3125,-.3125]);
 for(const mode of ['flat','two-level']){compare(s.traceFrozen(r,v.binding,mode).result,traceBruteForce(v,r));assert.equal(s.query(r,v.binding,mode).result.kind,'Unknown');}
 assert.equal(s.query(ray([-3,-.3125,-.3125]),v.binding).result.kind,'Unknown');
 const u=s.upload('two-level');assert.ok(u.pages.includes(1));assert.ok(u.roots[1]!==0,'Unknown subtree not empty');
});
test('current binding rejects every changed identity field and forged/detached payloads',async()=>{
 const v=volumes.get('grid-0.125'),s=sparse.get(v.id);
 for(const [key,value] of Object.entries(v.binding)){const b={...v.binding,[key]:typeof value==='number'?value+1:value+'-stale'};assert.throws(()=>s.query(rays.find(r=>r.volumeId===v.id).ray,b),/Stale/);}
 const forged=structuredClone(v);forged.cells[0]=1;await assert.rejects(createSparseVolume(forged,forged.binding),/digest/);
 const u=s.upload('flat');structuredClone(u.materials.buffer,{transfer:[u.materials.buffer]});assert.throws(()=>validateUpload(u));
 const mutable=s.upload('two-level');mutable.pages.fill(0);assert.equal(s.slot([5,1,1]),2,'Upload copies cannot mutate source');
 await assert.rejects(createSparseVolume(v,v.binding,AbortSignal.abort()),/Cancelled/);
});
test('cut/reset/late adoption, transfer and pure-motion payload lifetime',async()=>{
 const before=await createSparseVolume(volumes.get('grid-0.125'),volumes.get('grid-0.125').binding);
 const after=await createSparseVolume(volumes.get('after-cut'),volumes.get('after-cut').binding),set=new ProjectionSet();
 set.replace([before],[before.binding],0);assert.throws(()=>set.replace([after],[before.binding],0),/Stale/);
 set.replace([after],[after.binding],0);assert.throws(()=>before.upload('flat'),/Disposed/);
 set.reset();assert.throws(()=>set.replace([after],[volumes.get('after-cut').binding],0),/Stale/);
 const terrain=await createSparseVolume(volumes.get('after-transfer-terrain'),volumes.get('after-transfer-terrain').binding);
 const fragment=await createSparseVolume(volumes.get('fragment'),volumes.get('fragment').binding);
 set.replace([terrain,fragment],[terrain.binding,fragment.binding],1);
 const duplicate=await createSparseVolume(volumes.get('after-cut'),volumes.get('after-cut').binding);
 assert.throws(()=>set.replace([duplicate,fragment],[duplicate.binding,fragment.binding],1),/Duplicate/);
 const old=fragment.upload('two-level'),moved=structuredClone(volumes.get('fragment'));
 moved.translation=[10,2,-3];moved.binding.transformGeneration++;await fragment.move(moved,moved.binding);
 assert.deepEqual([...fragment.upload('two-level').materials],[...old.materials],'Movement uploads no new voxel bytes');
 assert.throws(()=>fragment.query(ray([0,0,0]),old.binding),/Stale/);
 set.reset();assert.throws(()=>fragment.slot([0,0,0]),/Disposed/);
});
