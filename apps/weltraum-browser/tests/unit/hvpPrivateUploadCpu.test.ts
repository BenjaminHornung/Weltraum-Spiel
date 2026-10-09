import {expect,it} from "vitest";
import {readHvpPrivateUploadCpu,assessHvpPrivateUploadCpu} from "../performance/hvpPrivateUploadCpu";
import type {HvpCutRawEntry} from "../performance/hvpCutRtReport";
const entry=(name:string,start:number,duration:number,bucket?:number,inside=false):HvpCutRawEntry=>({name:`hvp.${name}`,start,duration,detail:bucket===undefined?null:{data:{frameBucketStart:bucket,insideAnimationFrame:inside}}});
const frames=()=>[entry("mainFrameCpuMs",10,3),entry("mainFrameCpuMs",26,3),entry("mainFrameCpuMs",42,3)];
it("assigns resumed staging to actual RAF buckets without adding nested breakdowns or wall waits",()=>{
  const entries=[...frames(),entry("runtimePrivateUploadCommitCpuMs",20,1,10),entry("runtimePrepareThreeMeshCpuMs",20,.6,10),entry("runtimeRegistryCommitCpuMs",20.6,.2,10),
    entry("runtimePlainMaterialAcquireCpuMs",21,.4,10),entry("runtimePresentationPublishCpuMs",27,.5,26,true),entry("cutBodyRenderStageMs",12,27),entry("cutBodyGraphicsWorkQuantumMs",20,2)];
  expect(readHvpPrivateUploadCpu({entries,dropped:0},12,40)).toMatchObject({state:"Complete",frames:[{frameStart:10,cpuMs:1.4},{frameStart:26,cpuMs:.5}],p95Ms:1.4,maxMs:1.4});
});
it.each(["missing","crossing","overlap","dropped"] as const)("fails closed on %s evidence",kind=>{
  const span=entry("runtimePrivateUploadCommitCpuMs",20,1,kind==="missing"?11:10),entries=[...frames(),span];
  if(kind==="crossing"){entries[3]=entry("runtimePrivateUploadCommitCpuMs",25,2,10);}
  if(kind==="overlap"){entries.push(entry("runtimePresentationPublishCpuMs",20.5,1,10));}
  expect(()=>readHvpPrivateUploadCpu({entries,dropped:kind==="dropped"?1:0},12,40)).toThrow();
});
it("reports missing private totals instead of a passing zero for historical populations",()=>{
  expect(readHvpPrivateUploadCpu({entries:frames(),dropped:0},12,40)).toMatchObject({state:"Missing",p95Ms:null});
  expect(()=>assessHvpPrivateUploadCpu({entries:frames(),dropped:0},12,40)).toThrow("Missing required");
});
it.each([2,2.01])("reports a complete measured CPU budget boundary (%s ms)",duration=>{
  const raw={entries:[...frames(),entry("runtimePrivateUploadCommitCpuMs",20,duration,10)],dropped:0};
  expect(assessHvpPrivateUploadCpu(raw,12,40)).toMatchObject({state:"Complete",p95Ms:duration,limitMs:2,budget:duration===2?"WithinBudget":"OverBudget"});
});

it("accepts a final proven in-frame total and rejects an unobserved out-of-frame bucket end",()=>{
  const entries=[entry("mainFrameCpuMs",10,3),entry("runtimePrivateUploadCommitCpuMs",11,1,10,true)];
  expect(readHvpPrivateUploadCpu({entries,dropped:0},10,14)).toMatchObject({state:"Complete",frames:[{frameStart:10,cpuMs:1}],p95Ms:1});
  entries[1]=entry("runtimePrivateUploadCommitCpuMs",14,1,10,false);
  expect(()=>readHvpPrivateUploadCpu({entries,dropped:0},10,16)).toThrow(/unproven RAF/);
});
it("retains the actual frame crossing the input boundary and rejects duplicate frame evidence",()=>{
  const entries=[...frames(),entry("runtimePrivateUploadCommitCpuMs",12,1,10)];
  expect(readHvpPrivateUploadCpu({entries,dropped:0},12,20).frames).toEqual([{frameStart:10,cpuMs:1}]);
  entries.push(entry("mainFrameCpuMs",10,3));expect(()=>readHvpPrivateUploadCpu({entries,dropped:0},12,20)).toThrow(/RAF population/);
});
