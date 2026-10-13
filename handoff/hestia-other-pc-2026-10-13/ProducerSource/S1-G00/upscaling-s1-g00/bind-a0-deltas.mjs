import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const spike=path.dirname(fileURLToPath(import.meta.url)),carrier=path.resolve(spike,'../..');
const a0=path.resolve(carrier,'../Hestia-CutV3-Resume-2026-10-05');
const base='.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07';
const runId=process.argv[2];assert.match(runId??'',/^[a-zA-Z0-9-]+$/);
const out=path.join(spike,'evidence',runId);assert(!existsSync(out),'Preserve prior delta observations');mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(p,bytes,sha256)=>{
  const full=path.resolve(a0,p);assert(full.startsWith(a0+path.sep));
  const b=readFileSync(full);assert.equal(b.length,bytes,p);assert.equal(hash(b),sha256,p);return b;
};
const entries=[['FAILURE_UI_RECEIPT_R01.json',3011,'e0e7828a3c6b0a9c69bcb8f789e9d086cd850e6f2feff8c1f980268d180ee061'],['REVIEW_REPAIRS_RECEIPT_R02.json',3527,'820b8baa55aa181f286955da37c615fce99f39fa8f135525ce5d0c8b5884268c']];
const receipts=entries.map(([name,bytes,sha256])=>({path:base+'/A0/'+name,bytes,sha256,value:JSON.parse(check(base+'/A0/'+name,bytes,sha256))}));
const snapshots=[],reports=[];
for(const receipt of receipts){
  const r=receipt.value;assert.equal(r.baseInputSha256,'6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521');assert.equal(r.head,'17b1db4201a28e7b607c30707bdc2b75e3484a10');assert.equal(r.commitPush,false);
  for(const f of r.artifacts){check(f.snapshot,f.bytes,f.sha256);snapshots.push({receipt:receipt.path,...f,verified:true});}
  for(const f of r.reports){const data=JSON.parse(check(f.path,f.bytes,f.sha256));
    assert.equal(data.numPassedTests,f.passed);assert.equal(data.numFailedTests,f.failed);assert.equal(data.numPendingTests,f.pending);
    reports.push({receipt:receipt.path,...f,verified:true,provenance:'PRODUCER_CPU_REPORT_NOT_RERUN'});
  }
}
assert.equal(snapshots.length,6);assert.equal(reports.length,5);assert.equal(receipts[1].value.artifacts.length,4);
const route=receipts[1].value.artifacts.find(f=>f.path.endsWith('/hvpRoute.ts'));
const live=check(route.path,route.bytes,route.sha256);
const expectedOriginal=receipts[0].value.baseSourceMismatches.find(f=>f.path.endsWith('/hvpRoute.ts'));
const frozenRoot=path.join(a0,base,'tests/D3/source-binding-r33-neighbor-memo-source');
const frozenRoute=readFileSync(path.join(frozenRoot,route.path));assert.equal(frozenRoute.length,expectedOriginal.bytes);assert.equal(hash(frozenRoute),expectedOriginal.sha256);
writeFileSync(path.join(out,'delta-bindings.json'),JSON.stringify({schema:'hestia.s1g00.a0-livechange-input.v1',observedAt:new Date().toISOString(),classification:'SOLVER_NEUTRAL_WIP_DELTA_CONFLICT_INPUT_ONLY',a0Root:a0,nativeId:'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3',agentId:'37dddeb2-1688-47cc-af00-b03edd394215',baseFrozenInput:'6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521',receipts,snapshots,reports,route:{frozen:expectedOriginal,live:{path:route.path,bytes:live.length,sha256:hash(live)},liveIsR33:false},oldHelperSha256:'933dbdc5a65a4b4ba3020b8c984d8ed7b2c7826de2d8868bd0896b2086625d72',newHelperSha256:'27caabe4b6824d6adabbc813b6ca73cf84259ccd393318257b5b9002c158d98c',source461Unchanged:'ORCHESTRATOR_OBSERVATION_FROM_USER; not a full live-WIP freeze',newRootTests:false,newRootBuild:false,newGlGpuHvpPilot:false,productWriteGate:false,ownerAcceptance:false,phy01IndependentFreeze:'PENDING'},null,2)+'\n');
console.log(JSON.stringify({status:'PASS_BOUND_DELTA_BYTES_ONLY',receipts:receipts.length,snapshotRows:snapshots.length,reportRows:reports.length,r02Files:4,liveRouteMatchesDelta:true,r33Relabeled:false}));
