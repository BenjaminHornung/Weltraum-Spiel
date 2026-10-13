import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {loadFixtures,spike,sha} from './inputs.mjs';
import {bindSource,setCell} from './inputs/rt01/fixtures.mjs';
const {volumes,fixtureSha256}=await loadFixtures(),events=[];
const ray={id:'replay-axis',origin:[-2,-.3125,-.3125],direction:[1,0,0],maxDistance:8,maxSteps:999};
for(const [kind,ids] of [['Control',['grid-0.125']],['CutOpening',['after-cut']],['FragmentTransfer',['after-transfer-terrain','fragment']],['BodyRotation',['after-transfer-terrain','fragment-rotated']],['OriginShift',['origin-shift']]]){
 const snapshots=ids.map(id=>structuredClone(volumes.get(id)));events.push({kind,provenance:'FROZEN_ANALYTICAL_SNAPSHOT_REPLAY_NOT_GAMEPLAY',snapshots,rays:[{...ray,id:kind,origin:kind==='OriginShift'?ray.origin.map((n,a)=>n+snapshots[0].translation[a]):ray.origin}],reset:kind==='OriginShift'});
}
const base=structuredClone(volumes.get('grid-0.125'));base.binding.session='rt03-supplemental100';base.binding.epoch='synthetic100-edits';base.provenance='ANALYTICAL';
for(let i=1;i<=100;i++){const next=structuredClone(base);next.id='synthetic-edit-'+i;next.binding.sourceRevision=i;next.binding.sourceGeneration=i;setCell(next,[5,1,1],i%2?2:0);events.push({kind:'100Edit',edit:i,provenance:'ANALYTICAL_SUPPLEMENTAL_NOT_PRODUCT_EXPORT',snapshots:[next],rays:[{...ray,id:'edit-'+i}],reset:i===1});}
for(let i=1;i<=20;i++){const next=structuredClone(volumes.get('grid-0.125'));next.binding.session='rt03-synthetic-save';next.binding.epoch='synthetic-reset-'+i;next.id='restore-'+i;bindSource(next);events.push({kind:'SaveReset',region:i,provenance:'SYNTHETIC_RESTORE_NO_HVP_SAVE_CODEC',snapshots:[next],rays:[{...ray,id:'restore-'+i}],reset:true});}
const bytes=Buffer.from(JSON.stringify({schema:'hestia.rt0306.synthetic-replay.v1',parentFixtureSha256:fixtureSha256,originalPopulation:{ANALYTICAL:8,RD_SYNTHETIC:1,PRODUCT_EXPORT:0},genuineProductExports:0,events})+'\n');
await mkdir(path.join(spike,'fixtures'),{recursive:true});await writeFile(path.join(spike,'fixtures/replay.json'),bytes,{flag:'wx'});
await writeFile(path.join(spike,'fixtures/replay-manifest.json'),JSON.stringify({schema:'hestia.rt0306.replay-binding.v1',path:'replay.json',bytes:bytes.length,sha256:sha(bytes),events:events.length,syntheticEdits:100,syntheticRestores:20,parentFixtureSha256:fixtureSha256,actualHvpCutOrSave:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',events:events.length,bytes:bytes.length,sha256:sha(bytes),productExports:0}));
