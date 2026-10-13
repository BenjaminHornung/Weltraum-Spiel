import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {packRays} from '../emitted/src/pack-rays.mjs';
import {createSparseVolume} from '../emitted/src/sparse.mjs';
import {sourcePrefixCertificate} from '../emitted/src/prefix-certificate.mjs';
import {traceBruteForce} from '../emitted/imported/rt01/src/bruteForce.mjs';
import {validateRay,validateVolume,assertCurrent} from '../emitted/imported/rt01/src/validate.mjs';
import {analyticalVolume,bindSource,setCell,sha256} from './fixtures.mjs';
import {compare} from './compare.mjs';

const root=new URL('../',import.meta.url),fixtures=new URL('context/imported/fixtures/',root);
const write=(name,value)=>writeFile(new URL('results/'+name,root),typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const manifestBytes=await readFile(new URL('manifest.json',fixtures));
assert.equal(sha256(manifestBytes),'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea');
const manifest=JSON.parse(manifestBytes),payloads=new Map();
assert.equal(manifest.files.length,49);
for(const ref of manifest.files){const b=await readFile(new URL(ref.path,fixtures));assert.equal(b.length,ref.byteLength);assert.equal(sha256(b),ref.sha256);payloads.set(ref.path,b);}
const rows=JSON.parse(payloads.get('rays/golden-1000.json'));
assert.equal(rows.length,1000);assert.equal(new Set(rows.map(i=>i.ray.id)).size,1000);
const volumes=new Map(),sparse=new Map();
for(const id of new Set(rows.map(r=>r.volumeId))){
 const v=JSON.parse(payloads.get('voxels/'+id+'.json'));validateVolume(v);const bound=bindSource(structuredClone(v));
 assert.equal(bound.binding.sourceDigest,v.binding.sourceDigest);assert.equal(bound.binding.materialDigest,v.binding.materialDigest);
 assert.deepEqual([...payloads.get('voxels/'+id+'.bin')],v.cells.map(n=>n===-1?255:n));
 volumes.set(id,v);sparse.set(id,await createSparseVolume(v,v.binding));
}
assert.equal(volumes.size,9);
const result={schema:'hestia.rt02b.r11.changed-source-cpu.v1',scope:'LOCAL_WINDOWS_ISOLATED_FUNCTIONAL_DATA',
 historical:{denominator:1000,nominal408:408,early103:103,conditional474:474,unproved526:526,gpuQualified:0,cpu3000:3000,browser3051:3051,native:'4/6',correctedHelper:'10/12',RAY02:'FAIL',RAY03:'FAIL'},
 groups:[],certificate:{denominator:1000,provedUnderModel:0,unproved:0,branches:{},gpuQualified:0,adoptedGate:false},
 replay:{meaning:'Actual existing f64 CPU kernel on decoded actualFloat32 inputs, not an f32 traversal/shader model',accepted:0,validatorUnsupported:0,comparisonPASS:0,comparisonFAIL:0,failures:[]},
 planeDiagnostics:{meaning:'Potential planes only; not actual traversal/visited event proof',concernUnfusedRows:0,concernSingleRoundRows:0,orderingTieControls:[],allContractionSubnormalGpuBehaviour:'UNPROVEN'},
 gpu:'NOT_RUN',shaderCompiler:'NOT_RUN',SAFE:false,READY:false,productIntegration:'NO',qualifiedTiming:null};
let failed=0;
async function group(name,fn){try{await fn();result.groups.push({name,status:'PASS'});}catch(e){failed++;result.groups.push({name,status:'FAIL',error:{name:e.name,message:e.message,stack:e.stack}});}}
const f=Math.fround;
const decode=(s,r,b,index=0)=>{
 const v=new DataView(b,index*48,48),frame=s.spatial,o=[0,4,8].map((a,k)=>frame.origin[k]+v.getFloat32(a,true)*frame.cellMeters),
  d=[16,20,24].map(a=>v.getFloat32(a,true)*frame.cellMeters);
 const world=p=>[0,1,2].map(a=>frame.rotation[a*3]*p[0]+frame.rotation[a*3+1]*p[1]+frame.rotation[a*3+2]*p[2]);
 return {...r,origin:world(o).map((q,a)=>q+frame.translation[a]),direction:world(d),
  maxDistance:v.getFloat32(12,true),maxSteps:v.getUint32(32,true)};
};
const streams=[new Uint8Array(48000),new Uint8Array(48000)],certificateRows=[];
await group('actual-packer48-all1000-and-new-general-prefix-certificate',async()=>{
 for(const [id,s] of sparse){
  const indexes=rows.map((r,i)=>r.volumeId===id?i:-1).filter(i=>i>=0);
  for(const strict of [0,1]){
   const b=new Uint8Array(packRays(s,indexes.map(i=>rows[i].ray),Boolean(strict)));
   indexes.forEach((i,j)=>streams[strict].set(b.subarray(j*48,j*48+48),i*48));
  }
 }
 const frozenHypothesis=JSON.parse(await readFile(new URL('context/revisions/general-ray-support-gap-r02/coverage.json',root)));
 assert.equal(frozenHypothesis.rows.length,1000);
 for(let i=0;i<rows.length;i++){
  const item=rows[i],s=sparse.get(item.volumeId);assertCurrent(s.binding,item.sourceBinding);
  const v0=new DataView(streams[0].buffer,i*48,48),v1=new DataView(streams[1].buffer,i*48,48);
  assert.equal(Buffer.from(streams[0].subarray(i*48,i*48+48)).toString('hex'),frozenHypothesis.rows[i][14]);
  assert.equal(v0.getUint32(36,true),0);assert.equal(v1.getUint32(36,true),1);
  for(const a of [28,40,44]){assert.equal(v0.getUint32(a,true),0);assert.equal(v1.getUint32(a,true),0);}
  assert.equal(v0.getUint32(32,true),item.ray.maxSteps);
  const c=sourcePrefixCertificate(s,item.ray,item.sourceBinding,streams[0].buffer,i);
  if(c.status==='PROVED_SOURCE_PREFIX_UNDER_RNE_MODEL'){
   compare(c.result,item.expected,item.ray.id+' certificate');
   compare(traceBruteForce(volumes.get(item.volumeId),item.ray),item.expected,item.ray.id+' independent original oracle');
   for(const mode of ['flat','two-level'])compare(s.traceFrozen(item.ray,item.sourceBinding,mode).result,item.expected,item.ray.id+' actual original '+mode);
   result.certificate.provedUnderModel++;result.certificate.branches[c.branch]=(result.certificate.branches[c.branch]||0)+1;
  }else result.certificate.unproved++;
  let decoded,replay;
  try{decoded=decode(s,item.ray,streams[0].buffer,i);validateRay(decoded);}
  catch(e){result.replay.validatorUnsupported++;replay={status:'CPU_REPLAY_VALIDATOR_UNSUPPORTED_NOT_GPU_DOMAIN_REJECTION',error:e.message};}
  if(decoded&&!replay){
   result.replay.accepted++;const actual=[];
   for(const mode of ['flat','two-level']){
    const value=s.traceFrozen(decoded,item.sourceBinding,mode).result;
    try{compare(value,item.expected,item.ray.id+' decoded '+mode);result.replay.comparisonPASS++;actual.push({mode,status:'PASS',result:value});}
    catch(e){result.replay.comparisonFAIL++;actual.push({mode,status:'FAIL_UNCHANGED_ORIGINAL_ORACLE',result:value,error:e.message});result.replay.failures.push({rayId:item.ray.id,mode,expected:item.expected,actual:value,error:e.message});}
   }
   replay={status:'ACTUAL_F64_KERNEL_REPLAY',ray:decoded,actual};
  }
  let badA=false,badB=false,firstConcerns=[];
  const o=[0,4,8].map(a=>v0.getFloat32(a,true)),d=[16,20,24].map(a=>v0.getFloat32(a,true));
  for(let a=0;a<3;a++)if(d[a]!==0)for(let k=0;k<=s.size[a];k++){
   const t=f(f(k-o[a])/d[a]);if(!(t>=0&&t<=item.ray.maxDistance))continue;
   const qA=f(o[a]+f(t*d[a])),qB=f(o[a]+t*d[a]),wanted=k-(d[a]<0?1:0);
   const owned=q=>Math.floor(q)-(d[a]<0&&Number.isInteger(q)?1:0);
   const ca=owned(qA)!==wanted,cb=owned(qB)!==wanted;badA||=ca;badB||=cb;
   if((ca||cb)&&firstConcerns.length<3)firstConcerns.push({axis:a,plane:k,t,qUnfused:qA,qSingleRound:qB,wanted,ownerUnfused:owned(qA),ownerSingleRound:owned(qB)});
  }
  result.planeDiagnostics.concernUnfusedRows+=Number(badA);result.planeDiagnostics.concernSingleRoundRows+=Number(badB);
  certificateRows.push({rayId:item.ray.id,volumeId:item.volumeId,expected:item.expected,certificate:c,replay,firstPotentialConcerns:firstConcerns});
 }
 assert.equal(result.certificate.provedUnderModel+result.certificate.unproved,1000);
 assert.ok(result.certificate.provedUnderModel>103,'Broader actual full-result prefix certificate, not an axial admission substitute');
 for(const [strict,b] of streams.entries())await write('packed-strict'+strict+'.bin',b);
 result.packing={rows:2000,streams:streams.map((b,strict)=>({strict,bytes:b.length,sha256:sha256(b)}))};
 await write('certificate-and-replay-1000.json',certificateRows);
});
const makeRay=(v,id,q,d=[1,0,0],maxSteps=256,maxDistance=8)=>({id,origin:q.map((p,a)=>v.origin[a]+p*v.cellMeters),direction:d,maxSteps,maxDistance});
await group('genuine-near-face-discrete-mismatch-negative-controls',async()=>{
 const v=analyticalVolume(.125,[4,1,1],'r11-face');setCell(v,[0,0,0],1);setCell(v,[1,0,0],2);
 const s=await createSparseVolume(v,v.binding),out=[];
 for(const [id,x,d,originalCell,packedCell] of [['FACE_MINUS',1-2**-26,[1,0,0],0,1],['FACE_PLUS_NEGATIVE',1+2**-26,[-1,0,0],1,0]]){
  const r=makeRay(v,id,[x,.5,.5],d),original=traceBruteForce(v,r),b=packRays(s,[r],false),decoded=decode(s,r,b);
  assert.equal(new DataView(b).getFloat32(0,true),1);assert.equal(original.kind,'Hit');assert.equal(original.cell[0],originalCell);
  const actual=s.traceFrozen(decoded,v.binding).result;assert.equal(actual.kind,'Hit');assert.equal(actual.cell[0],packedCell);
  assert.notEqual(actual.materialId,original.materialId);assert.deepEqual(actual.normal,original.normal);
  const c=sourcePrefixCertificate(s,r,v.binding,b);assert.equal(c.status,'UNPROVEN');
  out.push({id,original,packedReplay:actual,certificate:c,meaning:'Actual altered-input f64 CPU result, not GPU failure'});
 }
 await write('face-counterexamples.json',out);s.dispose();
});
await group('genuine-near-tie-exact-corner-normal-and-subnormal-controls',async()=>{
 const v=analyticalVolume(.125,[3,3,1],'r11-neartie');setCell(v,[0,1,0],2);setCell(v,[1,1,0],3);
 const s=await createSparseVolume(v,v.binding),r=makeRay(v,'NEAR_TIE',[.5,.5+2**-27,.5],[Math.SQRT1_2,Math.SQRT1_2,0]);
 const original=traceBruteForce(v,r),b=packRays(s,[r],false),view=new DataView(b);
 assert.deepEqual(original.cell,[0,1,0]);assert.equal(original.materialId,2);assert.deepEqual(original.normal,[0,-1,0]);
 compare(s.traceFrozen(r,v.binding).result,original);assert.equal(view.getFloat32(4,true),.5);
 const tx=f(f(1-view.getFloat32(0,true))/view.getFloat32(16,true)),ty=f(f(1-view.getFloat32(4,true))/view.getFloat32(20,true));
 assert.equal(tx,ty);const decoded=decode(s,r,b);assert.throws(()=>validateRay(decoded),/normalized/);
 result.planeDiagnostics.orderingTieControls.push({id:r.id,original,packedPlaneTimes:[tx,ty],cpuReplay:'UNSUPPORTED_BY_UNCHANGED_NORMALIZATION_VALIDATOR',gpu:'NOT_RUN'});
 const cube=analyticalVolume(.125,[3,3,3],'r11-corner');setCell(cube,[1,1,1],3);setCell(cube,[1,0,0],1);
 const cs=await createSparseVolume(cube,cube.binding),corner=makeRay(cube,'EXACT_CORNER',[.5,.5,.5],[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)]);
 const c=traceBruteForce(cube,corner);assert.deepEqual(c.cell,[1,1,1]);assert.deepEqual(c.normal,[-1,0,0]);
 for(const mode of ['flat','two-level'])compare(cs.traceFrozen(corner,cube.binding,mode).result,c);
 const tiny=makeRay(v,'SUBNORMAL_ROUNDS_ZERO',[.5,.5,.5],[2**-153,1,0]),tinyB=packRays(s,[tiny],false);
 assert.equal(new DataView(tinyB).getFloat32(16,true),0);assert.equal(sourcePrefixCertificate(s,tiny,v.binding,tinyB).status,'UNPROVEN');
 const minSub=makeRay(v,'ENCODED_SUBNORMAL',[.5,.5,.5],[2**-152,1,0]),minB=packRays(s,[minSub],false);
 assert.equal(new DataView(minB).getFloat32(16,true),2**-149);assert.equal(sourcePrefixCertificate(s,minSub,v.binding,minB).reason,'SUBNORMAL_FTZ_MODEL_UNPROVEN');
 await write('tie-corner-subnormal.json',{nearTie:result.planeDiagnostics.orderingTieControls,exactCorner:c,zeroBits:Buffer.from(tinyB).toString('hex'),subnormalBits:Buffer.from(minB).toString('hex')});
 s.dispose();cs.dispose();
});
await group('valid64-steps0-256-257-unknown-and-horizon-genuine-oracles',async()=>{
 const v=analyticalVolume(.125,[64,1,1],'r11-budget');setCell(v,[63,0,0],1);
 const s=await createSparseVolume(v,v.binding),out=[];
 for(const steps of [0,256,257]){
  const r=makeRay(v,'STEPS_'+steps,[.5,.5,.5],[1,0,0],steps),b=packRays(s,[r],true);
  assert.equal(new DataView(b).getUint32(32,true),steps);
  const oracle=traceBruteForce(v,r);assert.equal(oracle.kind,steps===0?'BudgetExceeded':'Hit');
  if(steps>0){assert.deepEqual(oracle.cell,[63,0,0]);assert.equal(oracle.distance,7.8125);}
  for(const mode of ['flat','two-level'])compare(s.traceFrozen(r,v.binding,mode).result,oracle);
  out.push({steps,oracle,certificate:sourcePrefixCertificate(s,r,v.binding,b)});
 }
 const bounded=makeRay(v,'HORIZON',[.5,.5,.5],[1,0,0],257,.1);
 assert.equal(s.traceFrozen(bounded,v.binding).result.kind,'Miss');assert.equal(s.query(bounded,v.binding).result.kind,'BudgetExceeded');
 const unknown=analyticalVolume(.125,[4,1,1],'r11-unknown');unknown.coverage='partial';unknown.cells[1]=-1;bindSource(unknown);
 const u=await createSparseVolume(unknown,unknown.binding),ur=makeRay(unknown,'UNKNOWN',[.5,.5,.5]);
 const uo=traceBruteForce(unknown,ur);assert.equal(uo.kind,'Unknown');assert.equal(uo.distance,.0625);
 for(const mode of ['flat','two-level'])compare(u.query(ur,unknown.binding,mode).result,uo);
 await write('budget-unknown-results.json',{rows:out,strictHorizon:'BudgetExceeded',historicalHorizon:'Miss',unknown:uo});
 s.dispose();u.dispose();
});
await group('source-common-completion-controlflow-and-unchanged-leaf-policy',async()=>{
 const old=await readFile(new URL('inputs/dda.original.wgsl',root),'utf8'),candidate=await readFile(new URL('context/src/dda.wgsl',root),'utf8');
 const leaf='if(iteration==255u){results[ri]=answer(3,c,n,t,0u,counts);return;}';
 assert.ok(old.includes(leaf));assert.ok(candidate.includes(leaf));assert.equal((candidate.match(/traversal_complete=true;break;/g)||[]).length,3);
 assert.ok(!old.includes('if(!traversal_complete)'));assert.ok(candidate.includes('if(!traversal_complete){results[ri]=answer(3,vec3<i32>(-1),vec3<f32>(0),t,0u,counts);return;}'));
 assert.ok(candidate.indexOf('if(!traversal_complete)')>candidate.indexOf(leaf));
 assert.ok(candidate.indexOf('if(!traversal_complete)')<candidate.lastIndexOf('if(unknown&&exit'));
 assert.equal(candidate.replace(' var traversal_complete=false;\n','').replaceAll('traversal_complete=true;break;','break;').replace(' if(!traversal_complete){results[ri]=answer(3,vec3<i32>(-1),vec3<f32>(0),t,0u,counts);return;}\n',''),old,'Only common-fence bookkeeping changes');
 const disposition=(complete,leaf,common)=>leaf?'BudgetExceeded_CURRENT_CELL_NORMAL':complete?'ORIGINAL_END_CLASSIFICATION':common?'BudgetExceeded_NULL_CELL_ZERO_NORMAL':'ORIGINAL_FALLTHROUGH';
 const symbolic={meaning:'Finite control-flow/arithmetical Source model only; no WGSL execution or invalid volume factory',
  originalEmptyContinue256:disposition(false,false,false),candidateEmptyContinue256:disposition(false,false,true),
  originalLeaf256:disposition(false,true,false),candidateLeaf256:disposition(false,true,true),
  completedBreaks:['coverage','skip-end','leaf-end'].map(branch=>({branch,old:disposition(true,false,false),candidate:disposition(true,false,true)})),
  raw2057:{dimensions:[2057,1,1],sourceDomain:'INVALID_OUTSIDE1..64_SYMBOLIC_ONLY',iterations:256,t:(256*8-.5)/8,result:'BudgetExceeded_NULL_CELL_ZERO_NORMAL'},
  raw257Leaf:{dimensions:[257,1,1],sourceDomain:'INVALID_SYMBOLIC_ONLY',cell:[256,0,0],normal:[-1,0,0],t:(256-.5)/8,result:'OLD_LEAF_POLICY_RETAINED_NO_RUNTIME_CLAIM'}};
 assert.equal(symbolic.candidateEmptyContinue256,'BudgetExceeded_NULL_CELL_ZERO_NORMAL');assert.equal(symbolic.raw2057.t,255.9375);
 assert.equal(symbolic.originalLeaf256,symbolic.candidateLeaf256);assert.equal(symbolic.raw257Leaf.t,31.9375);
 await write('completion-source-control.json',symbolic);
});
await group('unchanged-validation-lifetime-and-no-budget-clamp',async()=>{
 const v=volumes.get('grid-0.125'),s=sparse.get(v.id),r=rows.find(i=>i.volumeId===v.id).ray;
 assert.throws(()=>packRays(s,[r,r],false),/Duplicate/);assert.throws(()=>packRays(s,[{...r,direction:[0,0,0]}],false),/normalized/);
 assert.throws(()=>packRays(s,[{...r,maxSteps:2**32}],false),/u32/);
 const bad={...v.binding,epoch:'stale'};assert.throws(()=>sourcePrefixCertificate(s,r,bad,packRays(s,[r],false)),/Stale/);
 const wire=packRays(s,[r],false);new DataView(wire).setUint32(40,1,true);assert.throws(()=>sourcePrefixCertificate(s,r,v.binding,wire),/48-byte/);
 await assert.rejects(createSparseVolume(v,v.binding,AbortSignal.abort()),/Cancelled/);
 const owned=await createSparseVolume(v,v.binding);owned.dispose();assert.throws(()=>packRays(owned,[r],false),/Disposed/);
});
for(const s of sparse.values())s.dispose();
result.status=failed===0?'PASS':'FAIL';result.passedGroups=result.groups.filter(i=>i.status==='PASS').length;result.failedGroups=failed;
await write('actual-r11-results.json',result);
process.stdout.write(JSON.stringify({status:result.status,groups:result.groups,certificate:result.certificate,replay:{accepted:result.replay.accepted,validatorUnsupported:result.replay.validatorUnsupported,PASS:result.replay.comparisonPASS,FAIL:result.replay.comparisonFAIL},gpu:'NOT_RUN',SAFE:false,READY:false})+'\n');
process.exitCode=failed===0?0:1;
