// One explicitly authorized pure-data event; no traversal, GPU, renderer or oracle.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../../..');
const spike=resolve(here,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const out=(name,b)=>writeFileSync(join(here,'results',name),b);
const json=(name,v)=>out(name,JSON.stringify(v,null,2)+'\n');
const must=(v,message)=>{if(!v)throw new Error(message);};
const deadline=setTimeout(()=>{process.stderr.write('PURE_PACKER_DEADLINE_28_SECONDS\n');process.exit(124);},28000);
deadline.unref();
const projections=[];
let result;
try {
  const input=JSON.parse(readFileSync(join(here,'input-bindings.json'),'utf8'));
  for(const ref of input.inputs){
    const bytes=readFileSync(ref.path);
    must(bytes.length===ref.byteLength&&sha(bytes)===ref.sha256,'Bound input drift: '+ref.relativePath);
  }
  // Process-local guards; no environment/config read or machine-global writes.
  for(const key of ['window','__THREE_DEVTOOLS__','navigator','Worker','WebAssembly']){
    Object.defineProperty(globalThis,key,{value:undefined,writable:false,configurable:false});
  }
  for(const key of ['document','fetch','XMLHttpRequest','WebSocket']){
    Object.defineProperty(globalThis,key,{get(){throw new Error('Forbidden browser/network access: '+key);},configurable:false});
  }
  const {packRays}=await import('../../dist/src/gpu.mjs');
  const {createSparseVolume}=await import('../../dist/src/sparse.mjs');
  const {assertCurrent}=await import('../../dist/imported/rt01/src/validate.mjs');
  const original=JSON.parse(readFileSync(join(spike,'imported/fixtures/rays/golden-1000.json'),'utf8'));
  const coverage=JSON.parse(readFileSync(join(spike,'revisions/general-ray-support-gap-r02/coverage.json'),'utf8'));
  must(original.length===1000&&coverage.rows.length===1000,'Exactly1000 required');
  must(new Set(original.map(r=>r.ray.id)).size===1000,'Original IDs must remain unique');
  const byVolume=new Map();
  original.forEach((r,i)=>{
    must(r.ray.id===coverage.rows[i][0]&&r.volumeId===coverage.rows[i][1],'Hypothesis row identity/order mismatch');
    const group=byVolume.get(r.volumeId)||{indices:[],volume:null,sparse:null};
    group.indices.push(i);byVolume.set(r.volumeId,group);
  });
  const strict0=Buffer.alloc(48000),strict1=Buffer.alloc(48000),hypothesis=Buffer.from(coverage.rows.map(r=>r[14]).join(''),'hex');
  const rowResults=[];
  for(const [id,group] of byVolume){
    group.volume=JSON.parse(readFileSync(join(spike,'imported/fixtures/voxels',id+'.json'),'utf8'));
    group.sparse=await createSparseVolume(group.volume,group.volume.binding);
    projections.push(group.sparse);
    group.indices.forEach(i=>assertCurrent(group.sparse.binding,original[i].sourceBinding));
    const rays=group.indices.map(i=>original[i].ray);
    const a=Buffer.from(packRays(group.sparse,rays,false)),b=Buffer.from(packRays(group.sparse,rays,true));
    must(a.length===rays.length*48&&b.length===a.length,'Actual pack stride');
    group.indices.forEach((index,j)=>{
      a.copy(strict0,index*48,j*48,(j+1)*48);b.copy(strict1,index*48,j*48,(j+1)*48);
    });
  }
  let matchingRows=0,strictWireRows=0;const mismatches=[];
  original.forEach((r,i)=>{
    const a=strict0.subarray(i*48,(i+1)*48),b=strict1.subarray(i*48,(i+1)*48),expected=hypothesis.subarray(i*48,(i+1)*48);
    const matching=a.equals(expected);
    const layout=a.readUInt32LE(32)===r.ray.maxSteps&&a.readUInt32LE(36)===0&&b.readUInt32LE(36)===1
      &&a.readFloatLE(12)===r.ray.maxDistance
      &&[28,40,44].every(p=>a.readUInt32LE(p)===0&&b.readUInt32LE(p)===0)
      &&a.every((n,p)=>p===36?b[p]===1:n===b[p]);
    matchingRows+=Number(matching);strictWireRows+=Number(layout);
    if(!matching)mismatches.push({rayId:r.ray.id,volumeId:r.volumeId,differingByteOffsets:[...a.keys()].filter(p=>a[p]!==expected[p])});
    rowResults.push({rayId:r.ray.id,volumeId:r.volumeId,hypothesisMatches:matching,strict0to1WireMatches:layout});
  });
  const base=byVolume.get('grid-0.125'),s=base.sparse,v=base.volume;
  must(JSON.stringify(v.rotation)==='[1,0,0,0,1,0,0,0,1]'&&v.translation.every(n=>n===0),'Closed supplemental frame');
  const ray=(id,q,d=[1,0,0],steps=256)=>({id:'r03-supplemental-'+id,origin:q.map((n,a)=>v.origin[a]+n*v.cellMeters),direction:d,maxDistance:8,maxSteps:steps});
  const controls=[
    ['FACE_MINUS',ray('face-minus',[1-2**-26,.5,.5]),0,1],
    ['FACE_PLUS_NEGATIVE',ray('face-plus',[1+2**-26,.5,.5],[-1,0,0]),0,1],
    ['NEAR_TIE',ray('near-tie',[.5,.5+2**-27,.5],[1/Math.sqrt(2),1/Math.sqrt(2),0]),1,.5],
    ['SUBNORMAL_AXIS',ray('subnormal',[.5,.5,.5],[2**-153,1,0]),4,0],
    ...[0,256,257].map(n=>['STEPS_'+n,ray('steps-'+n,[.5,.5,.5],[1,0,0],n),8,n])
  ];
  const supplemental=[],rawControls=[];
  for(const [id,r,field,expected] of controls){
    const bytes=Buffer.from(packRays(s,[r],false)),view=new DataView(bytes.buffer,bytes.byteOffset,48);
    const actual=field===8?view.getUint32(32,true):view.getFloat32(field*4,true);
    must(actual===expected,'Actual packing counterexample changed: '+id);
    const local=s.localRay(r),gridOrigin=local.origin.map((n,a)=>(n-v.origin[a])/v.cellMeters),gridDirection=local.direction.map(n=>n/v.cellMeters);
    supplemental.push({id,ray:r,volumeId:v.id,sourceBinding:s.binding,gridOriginF64:gridOrigin,gridDirectionF64:gridDirection,packedFloatValues:[0,1,2,3,4,5,6].map(a=>view.getFloat32(a*4,true)),maxSteps:view.getUint32(32,true),expectedScalar:expected,actualScalar:actual,hex:bytes.toString('hex'),classification:'PACKING_ONLY_NO_HIT_OR_TRAVERSAL'});
    rawControls.push(bytes);
  }
  const invalid=[
    ['DUPLICATE_ID',()=>packRays(s,[controls[0][1],controls[0][1]],false),'Duplicate ray identity'],
    ['WHOLE_ZERO_DIRECTION',()=>packRays(s,[ray('zero',[.5,.5,.5],[0,0,0])],false),'Invalid bounded normalized ray'],
    ['MAXSTEPS_U32_OVERFLOW',()=>packRays(s,[ray('overflow',[.5,.5,.5],[1,0,0],2**32)],false),'GPU maxSteps must fit u32'],
    ['RELATIVE_ENVELOPE',()=>packRays(s,[ray('far',[65537,.5,.5])],false),'GPU relative-frame precision envelope exceeded']
  ];
  const rejections=[];
  for(const [id,run,message] of invalid){
    let error;try{run();}catch(e){error=e;}
    must(error?.message===message,'Expected actual packer rejection: '+id);
    rejections.push({id,errorName:error.name,errorMessage:error.message,status:'EXPECTED_REJECTION'});
  }
  out('actual-strict0.bin',strict0);out('actual-strict1.bin',strict1);out('actual-supplemental.bin',Buffer.concat(rawControls));
  json('row-results.json',rowResults);json('supplemental-results.json',{controls:supplemental,rejections});
  result={schema:'hestia.rt02b.actual-packer-results.v3',executionLocation:'LOCAL_WINDOWS_ISOLATED_PURE_DATA',
    status:matchingRows===1000&&strictWireRows===1000?'PASS':'FAIL',scope:'ACTUAL_EXISTING_PACKRAYS_ONLY_NOT_GPU_SUPPORT',
    node:{version:process.version,execPath:process.execPath,argv:process.argv,cwd:process.cwd()},
    originalRays:1000,uniqueIds:1000,volumeFactoryInstances:byVolume.size,matchingHypothesisRows:matchingRows,strictWireRows,
    streams:{strict0:{bytes:strict0.length,sha256:sha(strict0)},strict1:{bytes:strict1.length,sha256:sha(strict1)},
      hypothesis:{bytes:hypothesis.length,sha256:sha(hypothesis),declaredSha256:'08b0981e981952b0c09a52ee00a39b803be2f1bb3a14cb3c7f63796b14b3553a'},
      supplemental:{bytes:Buffer.concat(rawControls).length,sha256:sha(Buffer.concat(rawControls))}},
    mismatches,supplementalPackingCases:controls.length,expectedRejections:rejections.length,
    retainedSourcePopulations:{conditional:408,directSource:103,shortlist:474,unproved:526,gpuQualified:0},
    traversalOracleGpuCompilerRendererNativeWasm:'NOT_RUN',actualAdapter:null,gpuMilliseconds:null,productIntegration:'NO',domainAdoption:'OPEN'};
  must(result.streams.hypothesis.sha256===result.streams.hypothesis.declaredSha256,'Bound hypothesis stream mismatch');
  json('RESULTS.json',result);process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=result.status==='PASS'?0:1;
}catch(error){
  result={status:'FAIL',boundary:'PURE_DATA_ONLY',errorName:error.name,errorMessage:error.message,traversalGpuNativeWasm:'NOT_RUN'};
  json('FAILURE.json',result);process.stderr.write(JSON.stringify(result)+'\n');process.exitCode=1;
}finally{projections.forEach(s=>s.dispose());clearTimeout(deadline);}
