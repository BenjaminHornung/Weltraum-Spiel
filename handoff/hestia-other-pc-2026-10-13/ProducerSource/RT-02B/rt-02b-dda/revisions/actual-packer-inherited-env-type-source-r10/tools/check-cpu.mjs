import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {packRays} from '../emitted/src/pack-rays.mjs';
import {createSparseVolume,ProjectionSet,prepareDirty,validateUpload} from '../emitted/src/sparse.mjs';
import {packBytes,readByte,alignedBytes,quoteResidency} from '../emitted/src/bytes.mjs';
import {traceBruteForce} from '../emitted/imported/rt01/src/bruteForce.mjs';
import {traceDda} from '../emitted/imported/rt01/src/dda.mjs';
import {validateVolume,validateRay,assertCurrent} from '../emitted/imported/rt01/src/validate.mjs';
import {sha256,analyticalVolume,bindSource,setCell} from './fixtures.mjs';
import {compare} from './compare.mjs';

const root=new URL('../',import.meta.url),fixtureRoot=new URL('context/imported/fixtures/',root);
const result={schema:'hestia.rt02b.r10.actual-cpu.v1',scope:'LOCAL_WINDOWS_ISOLATED_CPU_FUNCTIONAL',
 groups:[],golden:{denominator:1000,comparisons:0,paths:['bruteForce','rt01Dda','flat','two-level']},
 packing:{denominator:1000,strictModes:[0,1],actualBufferRows:0,hypothesisMatches:0,hypothesisMismatches:[]},
 historical:{cpu:3000,browserCpu:3051,conditional:474,unproved:526,gpuQualified:0,originalNative:'4/6',correctedHelper:'10/12',ray02:'FAIL',ray03:'FAIL'},
 gpu:'NOT_RUN',nativePhysics:'NOT_RUN',referencePerformance:'NOT_RUN',productIntegration:'NO',SAFE:false,READY:false};
const output=(name,data)=>writeFile(new URL('results/'+name,root),data,{flag:'wx'});
const json=(name,data)=>output(name,JSON.stringify(data,null,2)+'\n');
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
async function membership(dir,prefix=''){
 const list=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  assert.ok(!e.isSymbolicLink(),'No linked fixture member');
  const p=prefix+e.name,url=new URL(e.name+(e.isDirectory()?'/':''),dir);
  if(e.isDirectory())list.push(...await membership(url,p+'/'));else list.push(p);
 }
 return list.sort();
}
const manifestBytes=await readFile(new URL('manifest.json',fixtureRoot));
assert.equal(sha256(manifestBytes),'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea');
const manifest=JSON.parse(manifestBytes);
assert.equal(manifest.files.length,49);
assert.equal(new Set(manifest.files.map(f=>f.path)).size,49);
assert.deepEqual(await membership(fixtureRoot),['manifest.json',...manifest.files.map(f=>f.path)].sort(),'Exact closed fixture membership');
const payloads=new Map();
for(const ref of manifest.files){
 assert.ok(!ref.path.split('/').includes('..'),'Bound fixture path');
 const url=new URL(ref.path,fixtureRoot),stat=await lstat(url);
 assert.ok(stat.isFile()&&!stat.isSymbolicLink());
 const b=await readFile(url);assert.equal(b.length,ref.byteLength);assert.equal(sha256(b),ref.sha256,ref.path);
 payloads.set(ref.path,b);
}
const rays=freeze(JSON.parse(payloads.get('rays/golden-1000.json')));
assert.equal(rays.length,1000);assert.equal(new Set(rays.map(r=>r.ray.id)).size,1000);
const volumes=new Map(),sparse=new Map();
for(const id of new Set(rays.map(r=>r.volumeId))){
 const v=JSON.parse(payloads.get('voxels/'+id+'.json'));validateVolume(v);
 const rebound=bindSource(structuredClone(v));
 assert.equal(rebound.binding.sourceDigest,v.binding.sourceDigest);assert.equal(rebound.binding.materialDigest,v.binding.materialDigest);
 assert.deepEqual([...payloads.get('voxels/'+id+'.bin')],v.cells.map(n=>n===-1?255:n),'Original x-fastest Unknown bytes');
 volumes.set(id,freeze(v));sparse.set(id,await createSparseVolume(v,v.binding));
}
assert.equal(volumes.size,9);
assert.equal([...volumes.values()].filter(v=>v.provenance==='ANALYTICAL').length,8);
assert.equal([...volumes.values()].filter(v=>v.provenance==='RD_SYNTHETIC').length,1);
assert.equal([...volumes.values()].filter(v=>v.provenance==='PRODUCT_EXPORT').length,0);
for(const item of rays){validateRay(item.ray);assertCurrent(volumes.get(item.volumeId).binding,item.sourceBinding);}
result.inputs={fixturePayloads:49,fixtureManifestSha256:sha256(manifestBytes),goldenSha256:sha256(payloads.get('rays/golden-1000.json')),
 provenance:{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0},
 volumeRows:[...volumes.values()].map(v=>({id:v.id,size:v.size,cellMeters:v.cellMeters,cellCount:v.cells.length,binding:v.binding})),
 maxima:{dimensions:[0,1,2].map(a=>Math.max(...[...volumes.values()].map(v=>v.size[a]))),
 cellCount:Math.max(...[...volumes.values()].map(v=>v.cells.length)),rayMaxSteps:Math.max(...rays.map(i=>i.ray.maxSteps)),
 maxDistance:Math.max(...rays.map(i=>i.ray.maxDistance)),logicalConvexCellBound:Math.max(...[...volumes.values()].map(v=>v.size.reduce((a,b)=>a+b,0)+3))}};
let failed=0;
async function group(name,fn){
 try{await fn();result.groups.push({name,status:'PASS'});}
 catch(e){failed++;result.groups.push({name,status:'FAIL',error:{name:e.name,message:e.message,stack:e.stack}});}
}
const oracleRows=[];
await group('original1000-four-actual-cpu-paths',()=>{
 for(const item of rays){
  const v=volumes.get(item.volumeId),s=sparse.get(item.volumeId),brute=traceBruteForce(v,item.ray),old=traceDda(v,item.ray),
   flat=s.traceFrozen(item.ray,item.sourceBinding,'flat'),hier=s.traceFrozen(item.ray,item.sourceBinding,'two-level');
  for(const [path,actual] of [['bruteForce',brute],['rt01Dda',old],['flat',flat.result],['two-level',hier.result]]){
   compare(actual,item.expected,item.ray.id+' '+path);result.golden.comparisons++;
  }
  oracleRows.push({rayId:item.ray.id,volumeId:item.volumeId,bruteForce:brute,rt01Dda:old,flat,twoLevel:hier});
 }
});
await json('actual-oracle-results.json',oracleRows);
await group('actual-packRays-original1000-strict0-and1',async()=>{
 const coverageBytes=await readFile(new URL('context/revisions/general-ray-support-gap-r02/coverage.json',root));
 assert.equal(sha256(coverageBytes),'a96888ae9bc4c52211e3549d9cc416e9311d44b006381845168fd8d9e636f5f7');
 const coverage=JSON.parse(coverageBytes);assert.equal(coverage.rows.length,1000);
 const streams=[new Uint8Array(48000),new Uint8Array(48000)];
 for(const [id,s] of sparse){
  const indexes=rays.map((r,i)=>r.volumeId===id?i:-1).filter(i=>i>=0);
  for(const strict of [0,1]){
   const packed=new Uint8Array(packRays(s,indexes.map(i=>rays[i].ray),Boolean(strict)));
   indexes.forEach((i,j)=>streams[strict].set(packed.subarray(j*48,j*48+48),i*48));
  }
 }
 for(let i=0;i<1000;i++){
  const item=rays[i],row=coverage.rows[i];assert.equal(row[0],item.ray.id);assert.equal(row[1],item.volumeId);
  const hex=Buffer.from(streams[0].subarray(i*48,i*48+48)).toString('hex');
  if(hex===row[14])result.packing.hypothesisMatches++;else result.packing.hypothesisMismatches.push({rayId:item.ray.id,expectedDerived:row[14],actual:hex});
  const a=new DataView(streams[0].buffer,i*48,48),b=new DataView(streams[1].buffer,i*48,48);
  assert.equal(a.getUint32(32,true),item.ray.maxSteps);assert.equal(b.getUint32(32,true),item.ray.maxSteps);
  assert.equal(a.getUint32(36,true),0);assert.equal(b.getUint32(36,true),1);
  assert.equal(a.getFloat32(12,true),Math.fround(item.ray.maxDistance));assert.equal(b.getFloat32(12,true),Math.fround(item.ray.maxDistance));
  for(const offset of [28,40,44]){assert.equal(a.getUint32(offset,true),0);assert.equal(b.getUint32(offset,true),0);}
  for(let j=0;j<48;j++)if(j<36||j>=40)assert.equal(streams[0][i*48+j],streams[1][i*48+j]);
  result.packing.actualBufferRows+=2;
 }
 result.packing.streams=streams.map((b,strict)=>({strict,file:'actual-packed-strict'+strict+'.bin',bytes:b.length,sha256:sha256(b)}));
 result.packing.derivedHypothesisSha256='08b0981e981952b0c09a52ee00a39b803be2f1bb3a14cb3c7f63796b14b3553a';
 result.packing.hypothesisStatus=result.packing.hypothesisMismatches.length===0&&sha256(streams[0])===result.packing.derivedHypothesisSha256?'MATCH':'MISMATCH';
 for(const [strict,b] of streams.entries())await output('actual-packed-strict'+strict+'.bin',b);
 assert.equal(result.packing.hypothesisMismatches.length,0,'Derived metadata hypothesis, not new golden');
 assert.equal(sha256(streams[0]),result.packing.derivedHypothesisSha256,'Derived stream hypothesis, not GPU qualification');
});
await group('seven-real-packing-counterexamples-four-real-rejections',async()=>{
 const v=volumes.get('grid-0.125'),s=sparse.get(v.id);
 const r=(id,q,d=[1,0,0],maxSteps=256)=>({id,origin:q.map((n,a)=>v.origin[a]+n*v.cellMeters),direction:d,maxDistance:8,maxSteps});
 const cases=[
  {ray:r('FACE_MINUS',[1-2**-26,.5,.5]),offset:0,expected:1,type:'f32'},
  {ray:r('FACE_PLUS_NEGATIVE',[1+2**-26,.5,.5],[-1,0,0]),offset:0,expected:1,type:'f32'},
  {ray:r('NEAR_TIE',[.5,.5+2**-27,.5],[Math.SQRT1_2,Math.SQRT1_2,0]),offset:4,expected:.5,type:'f32'},
  {ray:r('SUBNORMAL_AXIS',[.5,.5,.5],[2**-153,1,0]),offset:16,expected:0,type:'f32'},
  ...[0,256,257].map(n=>({ray:r('STEPS_'+n,[.5,.5,.5],[1,0,0],n),offset:32,expected:n,type:'u32'}))
 ];
 const rows=[];
 for(const c of cases){const b=packRays(s,[c.ray],false),view=new DataView(b),actual=c.type==='f32'?view.getFloat32(c.offset,true):view.getUint32(c.offset,true);
  assert.equal(actual,c.expected);rows.push({...c,actual,hex:Buffer.from(b).toString('hex')});}
 const good=r('DUPLICATE',[.5,.5,.5]);
 assert.throws(()=>packRays(s,[good,good],false),/Duplicate ray identity/);
 assert.throws(()=>packRays(s,[r('ZERO',[.5,.5,.5],[0,0,0])],false),/Invalid bounded normalized ray/);
 assert.throws(()=>packRays(s,[r('U32_OVERFLOW',[.5,.5,.5],[1,0,0],2**32)],false),/GPU maxSteps must fit u32/);
 assert.throws(()=>packRays(s,[r('ENVELOPE',[65537,.5,.5])],false),/GPU relative-frame precision envelope exceeded/);
 result.packing.counterexamples=7;result.packing.expectedRejections=4;
 await json('packing-counterexamples.json',{rows,rejections:['duplicateID','zeroDirection','u32Overflow','relativeEnvelope']});
});
const ray=(o,d=[1,0,0],maxSteps=9999,maxDistance=100)=>({id:'boundary',origin:o,direction:d,maxDistance,maxSteps});
await group('faces-ties-inside-zeroaxes-negative-origin-budget256-257',async()=>{
 const v=analyticalVolume(.125,[64,4,4],'boundary');v.origin=[-8,-.5,-.5];bindSource(v);setCell(v,[40,1,1],2);
 const s=await createSparseVolume(v,v.binding),q=Math.SQRT1_2;
 const rs=[ray([-8,-.3125,-.3125]),ray([-3,-.3125,-.3125]),ray([-2.875,-.3125,-.3125],[-1,0,0]),ray([-9,-.3125,-.3125]),
  ray([-8,-.5,-.5],[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)]),ray([-8,-.4375,-.4375],[q,q,0]),ray([-8,0,-.3125]),
  ...[0,1,8,31,40,41,64,256,257].map(n=>ray([-8,-.3125,-.3125],[1,0,0],n)),ray([-8,-.3125,-.3125],[1,0,0],9999,5)];
 const rows=[];
 for(const r of rs){const oracle=traceBruteForce(v,r);for(const mode of ['flat','two-level']){const actual=s.traceFrozen(r,v.binding,mode);compare(actual.result,oracle,'boundary '+mode);rows.push({ray:r,mode,oracle,...actual});}}
 assert.equal(s.traceFrozen(rs.at(-1),v.binding).result.kind,'Miss','Historical exclusive endpoint retained');
 assert.equal(s.query(rs.at(-1),v.binding).result.kind,'BudgetExceeded','Strict bounded query cannot assert opening');
 assert.equal(s.query(ray([-9,-.3125,-.3125],[1,0,0],9999,.1),v.binding).result.kind,'BudgetExceeded');
 result.boundaries={rays:rs.length,comparisons:rows.length,historicalMissRetained:true,strictBudgetExceededRetained:true};
 await json('boundary-results.json',rows);s.dispose();
});
await group('actual-hierarchical-lookup-reduction-unknown-pages',async()=>{
 const v=analyticalVolume(.125,[64,4,4],'skip');setCell(v,[63,1,1],1);
 const s=await createSparseVolume(v,v.binding),r=ray([v.origin[0],v.origin[1]+.1875,v.origin[2]+.1875]);
 const a=s.traceFrozen(r,v.binding,'flat'),b=s.traceFrozen(r,v.binding,'two-level');
 compare(a.result,traceBruteForce(v,r));compare(b.result,a.result);
 assert.ok(b.counters.pageLookups+b.counters.rootLookups<a.counters.pageLookups);
 result.hierarchy={flat:a.counters,twoLevel:b.counters,status:'FUNCTIONAL_WORK_COUNTER_ONLY'};
 const missing=analyticalVolume(.125,[64,4,4],'missing');missing.coverage='partial';missing.exteriorCoverage='Unknown';
 for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=32;x<40;x++)missing.cells[x+64*(y+4*z)]=-1;bindSource(missing);
 const m=await createSparseVolume(missing,missing.binding);
 for(const mode of ['flat','two-level']){compare(m.traceFrozen(ray([-2,-.3125,-.3125]),missing.binding,mode).result,traceBruteForce(missing,ray([-2,-.3125,-.3125])));assert.equal(m.query(ray([-2,-.3125,-.3125]),missing.binding,mode).result.kind,'Unknown');}
 assert.equal(m.query(ray([-3,-.3125,-.3125]),missing.binding).result.kind,'Unknown');
 const u=m.upload('two-level');assert.ok(u.pages.includes(1));assert.notEqual(u.roots[1],0);
 s.dispose();m.dispose();
});
await group('all13-stale-fields-forged-detached-cancelled',async()=>{
 const v=volumes.get('grid-0.125'),s=sparse.get(v.id);
 for(const [key,value] of Object.entries(v.binding)){const b={...v.binding,[key]:typeof value==='number'?value+1:value+'-stale'};assert.throws(()=>s.query(rays.find(r=>r.volumeId===v.id).ray,b),/Stale/);}
 result.staleFields=Object.keys(v.binding).length;assert.equal(result.staleFields,13);
 const forged=structuredClone(v);forged.cells[0]=1;await assert.rejects(createSparseVolume(forged,forged.binding),/digest/);
 const u=s.upload('flat');structuredClone(u.materials.buffer,{transfer:[u.materials.buffer]});assert.throws(()=>validateUpload(u));
 const mutable=s.upload('two-level');mutable.pages.fill(0);assert.equal(s.slot([5,1,1]),2);
 await assert.rejects(createSparseVolume(v,v.binding,AbortSignal.abort()),/Cancelled/);
 assert.throws(()=>packRays(s,[{...rays[0].ray,maxDistance:0}],false),/Invalid/);
});
await group('dirty-next-generation-closed-pages-atomic-adoption',async()=>{
 const v=volumes.get('grid-0.125'),next=volumes.get('after-cut'),current=await createSparseVolume(v,v.binding);
 const prepared=await prepareDirty(current,next,v.binding,next.binding,[0]);
 assert.deepEqual(prepared.dirtyPages,[0]);assert.equal(prepared.atlasRepack,true);
 assert.equal(current.slot([5,1,1]),2);assert.equal(prepared.candidate.slot([5,1,1]),0);
 assert.equal(prepared.peak.oldNewGenerationsBytes,prepared.peak.currentGenerationBytes+prepared.peak.nextGenerationBytes);
 result.dirty={dirtyPages:prepared.dirtyPages,peak:prepared.peak,uploadStrategy:prepared.uploadStrategy};
 for(const invalid of [[],[0,0],[-1],[1]])await assert.rejects(prepareDirty(current,next,v.binding,next.binding,invalid),/dirty|Dirty/);
 await assert.rejects(prepareDirty(current,v,v.binding,v.binding,[]),/newer/);
 const crossed=structuredClone(next);crossed.binding.epoch='other-epoch';await assert.rejects(prepareDirty(current,crossed,v.binding,crossed.binding,[0]),/boundary/);
 await assert.rejects(prepareDirty(current,next,v.binding,next.binding,[0],AbortSignal.abort()),/Cancelled/);
 const set=new ProjectionSet();set.replace([current],[v.binding],0);set.replace([prepared.candidate],[next.binding],0);
 assert.throws(()=>current.slot([5,1,1]),/Disposed/);set.reset();
});
await group('epoch-cut-transfer-motion-disposal',async()=>{
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
 assert.deepEqual([...fragment.upload('two-level').materials],[...old.materials]);
 assert.throws(()=>fragment.query(ray([0,0,0]),old.binding),/Stale/);
 set.reset();assert.throws(()=>fragment.slot([0,0,0]),/Disposed/);duplicate.dispose();
 assert.throws(()=>packRays(fragment,[rays.find(r=>r.volumeId==='fragment').ray],false),/Disposed/);
});
await group('little-endian-alignment-detachment-residency',()=>{
 const source=new Uint8Array([0x12,0x34,0x56,0xff,0x78]),words=packBytes(source);
 assert.deepEqual([...words],[0xff563412,0x78]);source.fill(0);
 assert.deepEqual([0,1,2,3,4,5,6,7].map(i=>readByte(words,i)),[0x12,0x34,0x56,0xff,0x78,0,0,0]);
 for(const i of [-1,.5,NaN,8])assert.throws(()=>readByte(words,i),/index/);
 const detached=new Uint8Array([1]);structuredClone(detached.buffer,{transfer:[detached.buffer]});assert.throws(()=>packBytes(detached));
 const detachedWords=packBytes(new Uint8Array([1]));structuredClone(detachedWords.buffer,{transfer:[detachedWords.buffer]});assert.throws(()=>readByte(detachedWords,0));
 assert.equal(alignedBytes(0x80000001,0x1000),0x80001000);assert.equal(alignedBytes(0,4),0);
 assert.throws(()=>alignedBytes(-1,4));assert.throws(()=>alignedBytes(1,3));assert.throws(()=>alignedBytes(Number.MAX_SAFE_INTEGER,4));
 const q=quoteResidency({payloadBytes:5,pageTableBytes:0,hierarchyBytes:8,metadataBytes:128,historyBytes:3},4);
 assert.deepEqual(q,{rawPayloadBytes:5,perGenerationBytes:148,oldNewGenerationsBytes:296,historyBytes:4,peakBytes:300});
 assert.ok(Object.isFrozen(q));assert.throws(()=>quoteResidency({payloadBytes:-1,pageTableBytes:0,hierarchyBytes:0,metadataBytes:128,historyBytes:0},4));
 result.residency=q;
});
for(const s of sparse.values())s.dispose();
result.status=failed===0?'PASS':'FAIL';result.passedGroups=result.groups.filter(g=>g.status==='PASS').length;result.failedGroups=failed;
await json('actual-cpu-results.json',result);
process.stdout.write(JSON.stringify({status:result.status,groups:result.groups,comparisons:result.golden.comparisons,
 packedRows:result.packing.actualBufferRows,hypothesisMatches:result.packing.hypothesisMatches,
 boundaryComparisons:result.boundaries?.comparisons,gpu:result.gpu,productIntegration:result.productIntegration})+'\n');
process.exitCode=failed===0?0:1;
