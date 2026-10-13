import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFile,writeFile} from 'node:fs/promises';
import {validateRay,validateVolume} from '../emitted-checked/imported/rt01/src/validate.mjs';
import {traceBruteForce} from '../emitted-checked/imported/rt01/src/bruteForce.mjs';
import {createSparseVolume} from '../emitted-checked/src/sparse.mjs';
import {packRays} from '../emitted-checked/src/pack-rays.mjs';
import {sha256} from '../emitted-checked/fixtures.mjs';
import {makeCases,originalPair} from '../emitted-checked/cases.mjs';
import {compare} from '../context/compare.mjs';

const root=new URL('../',import.meta.url);
const write=(name,data)=>writeFile(new URL('results/'+name,root),data,{flag:'wx'});
const writeJson=(name,data)=>write(name,JSON.stringify(data,null,2)+'\n');
const manifest=JSON.parse(await readFile(new URL('inputs/original-fixture-manifest.json',root),'utf8'));
const original=await readFile(new URL('inputs/original-golden-1000.json',root));
const ref=manifest.files.find(f=>f.path==='rays/golden-1000.json');
assert.equal(original.length,ref.byteLength);assert.equal(sha256(original),ref.sha256);
const historical=JSON.parse(original.toString());
assert.equal(historical.length,1000);assert.equal(new Set(historical.map(r=>r.ray.id)).size,1000);

const cases=makeCases();
let packCalls=0,packedRows=0,cpuComparisons=0,originalRayCount=0;
const witnesses=[];
for(const c of cases){
 validateVolume(c.v);
 const rays=originalPair(c);
 rays.forEach(validateRay);originalRayCount+=rays.length;
 assert.notDeepEqual(rays[0].origin,rays[1].origin);
 const s=await createSparseVolume(c.v,c.v.binding),oracle=rays.map(r=>traceBruteForce(c.v,r)),modes=[];
 try{
  oracle.forEach((out,i)=>{assert.equal(out.kind,c.kinds[i]);assert.deepEqual(out.cell,c.cells[i]);
   assert.equal(out.materialId,c.materials[i]);assert.deepEqual(out.normal,c.normals[i]);});
  assert.notDeepEqual(oracle[0],oracle[1],'Required original outcomes must differ');
  for(const mode of ['flat','two-level']){
   const u1=s.upload(mode),u2=s.upload(mode),upload=[];
   assert.deepEqual(u1.binding,u2.binding);assert.equal(u1.mode,u2.mode);
   for(const key of ['pages','roots','materials','metadata']){
    const a=Buffer.from(u1[key].buffer,u1[key].byteOffset,u1[key].byteLength),b=Buffer.from(u2[key].buffer,u2[key].byteOffset,u2[key].byteLength);
    assert.deepEqual(a,b);const file=c.id+'-'+mode+'-'+key+'.bin';await write(file,a);
    upload.push({key,file,bytes:a.length,sha256:sha256(a),sameForBothOriginalRays:true});
   }
   const controls=rays.map((r,i)=>{
    const frozen=s.traceFrozen(r,c.v.binding,mode).result,strict=s.query(r,c.v.binding,mode).result;
    for(const actual of [frozen,strict]){compare(actual,oracle[i],c.id+' '+mode+' '+i);assert.deepEqual(actual.normal,oracle[i].normal);cpuComparisons++;}
    return {rayId:r.id,traceFrozen:frozen,query:strict};
   });
   modes.push({mode,upload,controls});
  }
  const packets=[];
  for(const strict of [false,true]){
   const pair=rays.map(r=>packRays(s,[r],strict));packCalls+=2;packedRows+=2;
   const a=Buffer.from(pair[0]),b=Buffer.from(pair[1]);assert.equal(a.length,48);assert.deepEqual(a,b,'Actual full48-byte collision');
   const batch=Buffer.from(packRays(s,rays,strict));packCalls++;packedRows+=2;
   assert.equal(batch.length,96);assert.deepEqual(batch.subarray(0,48),a);assert.deepEqual(batch.subarray(48),b);
   const view=new DataView(pair[0]);assert.equal(view.getUint32(32,true),c.steps);assert.equal(view.getUint32(36,true),Number(strict));
   for(const offset of [28,40,44])assert.equal(view.getUint32(offset,true),0);
   const fileA=c.id+'-strict'+Number(strict)+'-A.bin',fileB=c.id+'-strict'+Number(strict)+'-B.bin';
   await write(fileA,a);await write(fileB,b);
   packets.push({strict:Number(strict),fileA,fileB,bytes:48,sha256A:sha256(a),sha256B:sha256(b),hexA:a.toString('hex'),hexB:b.toString('hex'),sameFullPacket:true,
    receiverFields:{origin:[0,4,8].map(o=>view.getFloat32(o,true)),distance:view.getFloat32(12,true),direction:[16,20,24].map(o=>view.getFloat32(o,true)),maxSteps:view.getUint32(32,true),strict:view.getUint32(36,true),padding:[28,40,44].map(o=>view.getUint32(o,true))}});
  }
  witnesses.push({id:c.id,volume:c.v,rays,oracle,modes,packets,scope:'GENUINE_SOURCE_CPU_STRUCTURAL_WITNESS_NOT_GPU_EXECUTION',
   requiredDifferences:['kind','cell','materialId','materialSource','normal','cellId'].filter(k=>JSON.stringify(oracle[0][k])!==JSON.stringify(oracle[1][k]))});
 }finally{s.dispose();}
}
const result={schema:'hestia.rt02b.r12.actual-packing-semantic-witness.v1',status:'PASS_STRUCTURAL_COUNTEREXAMPLE',
 disposition:'SOURCE_NO_ADOPTION_EXACT_SEMANTICS',pairedCases:cases.length,originalRayCount,packCalls,packedRows,cpuComparisons,
 historical:{denominator:1000,uniqueIds:1000,oracleListSha256:sha256(original),r11Conditional129:129,r11Unproved871:871,r11Replay72PASS8FAIL960UNSUPPORTED:'UNCHANGED',old408:408,old103:103,old474:474,old526:526,GPU:0},
 witnesses,ordinarySourceFixApplied:false,representationLoss:'Same actual full48-byte packet and same source upload cannot encode different required original cell/material/normal/classification',
 gpu:'NOT_RUN',shaderCompiler:'NOT_RUN',driverArithmetic:'UNPROVEN_NOT_NEEDED_FOR_COLLISION_PROOF',SAFE:false,READY:false,productIntegration:'NO'};
await writeJson('paired-witness.json',result);
process.stdout.write(JSON.stringify({status:result.status,disposition:result.disposition,pairedCases:cases.length,originalRayCount,packCalls,packedRows,cpuComparisons,unchangedDenominator:1000,GPU:'NOT_RUN',SAFE:false,READY:false})+'\n');
