import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadFixture} from '../src/fixture.mjs';
import {encodeCheckpoint,decodeCheckpoint,digest,CatchUp} from '../src/checkpoint.mjs';
import {totalMass,stepLimit} from '../dist/transport.js';
import {root,save,verifyInputs,binding} from './bindings.mjs';
verifyInputs();const output=process.argv[2]??'.runtime/matrix';
if(!/^(\.runtime\/|\.\.\/\.\.\/\.devtoolbox\/specs\/changes\/wxg-07-2026-10-09\/tests\/)[a-zA-Z0-9/_-]+$/.test(output))throw Error('OUTPUT_SCOPE');
mkdirSync(resolve(root,output),{recursive:true});
const rows=[];
for(const n of [32,48,64]){
  const {model,grid,profile,initial,binding:identity}=loadFixture(n),mass0=totalMass(grid,initial.values),checkpointTick=3600*120;
  const checkpoint=encodeCheckpoint(model,model.replay(initial,checkpointTick),identity);
  for(const gapSeconds of [3600,86400,7*86400]){
    const target=checkpointTick+gapSeconds*120,start=performance.now(),full=model.replay(initial,target),fullMs=performance.now()-start;
    const restore=decodeCheckpoint(model,checkpoint,identity),tailStart=performance.now(),tail=model.replay(restore,target,127,true),tailMs=performance.now()-tailStart;
    const fullBytes=encodeCheckpoint(model,full,identity),tailBytes=encodeCheckpoint(model,tail,identity);assert.ok(fullBytes.equals(tailBytes),'EXACT_REPLAY');
    const mass=totalMass(grid,full.values),balanceRelativeError=mass.map((x,k)=>Math.abs(x-(mass0[k]+full.added[k]-full.removed[k]))/Math.max(1,mass0[k]));assert.ok(balanceRelativeError.every(e=>e<5e-10),'SOURCE_SINK_BALANCE');
    const job=new CatchUp(model,checkpoint,identity,target);assert.equal(job.read().status,'Pending');
    let ready;do{ready=job.pump(17);}while(ready.status==='Pending');assert.ok(ready.checkpoint.equals(fullBytes),'PUMP_REPLAY');
    const row={n,cells:grid.cells.length,gapSeconds,checkpointTick,targetTick:target,steps:full.steps,tailSteps:(target-checkpointTick)/model.dtTicks,dtSeconds:model.dtTicks/120,cflLimitSeconds:stepLimit(grid,profile.policy),minimumHydraulicLengthMeters:grid.minimumLength,maximumWindMps:grid.wind,waveSpeedMps:grid.waveSpeed,coefficient:profile.coefficients,profileDigest:identity,fullDigest:digest(fullBytes),tailDigest:digest(tailBytes),checkpointDigest:digest(checkpoint),canonicalBytes:fullBytes.length,byteEquality:'PASS',pendingThenReady:'PASS',chunkInvariance:'PASS',sourceSinkBalance:'PASS',balanceRelativeError,diagnosticFullReplayMs:fullMs,diagnosticCheckpointTailMs:tailMs,sourceAddedKg:full.added,sinkRemovedKg:full.removed,finalMassKg:mass};
    rows.push(row);console.log(JSON.stringify(row));
    if(gapSeconds===7*86400)writeFileSync(resolve(root,output,`grid-${n}-7d.checkpoint.bin`),fullBytes);
  }
}
save(output+'/matrix.json',{schema:'wxg07.finite-matrix/v1',status:'PASS',executionLocation:'LOCAL_WINDOWS_ISOLATED',purpose:'FUNCTION_DIAGNOSIS_ONLY',hardwareQualification:'NOT_RUN',productIntegration:'NO',actualAdapter:{status:'NOT_APPLICABLE',reason:'CPU_ONLY_NO_BROWSER_OR_GPU_CONTEXT'},gpuTimer:{status:'NOT_APPLICABLE',value:null},environmentLoad:{status:'CONCURRENT_SESSIONS_NO_FREE_WINDOW',windowsSystemCpuLoad:null,systemLoadSensor:'UNSUPPORTED_NODE_OS_LOADAVG_ON_WINDOWS',processMemory:process.memoryUsage(),node:process.versions.node},rows});
