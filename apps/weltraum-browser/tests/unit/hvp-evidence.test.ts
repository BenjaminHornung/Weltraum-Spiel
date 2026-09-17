import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {assertHvpArtifact,freezeHvpMeasurement,assessHvpRuns,nearestRank,type HvpMeasurementPlan,type HvpMeasuredRun} from "../e2e/hvp-performance-evidence";

// Synthetic unit fixtures exercise the validator; these are NEVER hardware evidence.
const sha="a".repeat(64);
const plan=():HvpMeasurementPlan=>({version:"hvp-measurement-v1",profileId:"HVP-DEVICE-01",renderProfile:"HVP-PLAY-720-v1",
  scenario:"PERF-02",classification:"measurement",repetitions:5,warmupMs:30_000,measurementMs:120_000,
  width:1280,height:720,dpr:1,trace:false,screenshots:false,syntheticHardwareProfile:false,fixtureKind:"normal-product-route",
  fixtureSha256:sha,commit:"1".repeat(40),dirty:true,sourceSha256:sha,buildSha256:sha,lockSha256:sha,wasmSha256:sha,
  browser:{version:"unit-fixture",binarySha256:sha,headed:true},
  hardware:{os:"unit-fixture",cpu:"unit-fixture",ramBytes:32*1024**3,gpu:"unit-fixture",driver:"unit-fixture",power:"AC / Balanced",refreshHz:60}});
const runs=(digest:string):HvpMeasuredRun[]=>Array.from({length:5},(_,i)=>({id:`run-${i}`,processId:100+i,processStartedMs:i*200_000,planSha256:digest,result:"completed",
  measurementStartMs:30_000,measurementEndMs:150_000,trace:false,screenshots:false,
  samples:Array.from({length:7200},(_,n)=>(["frameIntervalMs","solverStepCpuMs","mainCpuMs","commitUploadMs"] as const).map(metric=>
    ({atMs:30_000+(n+1)*120_000/7200,phase:"measurement" as const,metric,value:metric==="frameIntervalMs"?120_000/7200:1}))).flat(),
  gauges:[30_000,150_000].map(atMs=>({atMs,triangles:374632,draws:169,cpuBytes:247067736,meshBytes:28116392,activeDynamic:2,residentDynamic:2,colliders:88,heavyJobs:0,queue:0})),
   route:[{id:"C01-EYE",x:-8,z:-11},{id:"C02-SHORE",x:-2,z:-6},{id:"C03-ROOTS",x:3,z:4},{id:"SALVAGE-CLEARING",x:-9,z:-9}]
     .map((p,n)=>({id:p.id,position:{x:p.x,y:1,z:p.z},atMs:35_000+n*20_000,rootRevision:0})),
   walking:[{startMs:30_000,endMs:150_000,distanceMeters:360}],
   operations:[],failures:[]}));

it("freezes observed bindings and rejects missing hardware or silent profile changes",()=>{
  expect(()=>freezeHvpMeasurement({...plan(),hardware:{...plan().hardware,gpu:""}})).toThrow(/profile/);
  expect(()=>freezeHvpMeasurement({...plan(),wasmSha256:"unknown"})).toThrow(/binding/);
  expect(()=>freezeHvpMeasurement({...plan(),dpr:1.25})).toThrow(/profile/);
  const frozen=freezeHvpMeasurement(plan());
  expect(Object.isFrozen(frozen.plan.hardware)).toBe(true);
  expect(()=>assessHvpRuns({...plan(),fixtureKind:"authored-synthetic"},frozen.sha256,runs(frozen.sha256))).toThrow(/frozen/);
});
it("uses raw nearest-rank quantiles and keeps every fresh process including a slow or failed run",()=>{
  expect(nearestRank([1,2,3,4,100],.95)).toBe(100);
  const p=plan(),f=freezeHvpMeasurement(p),r=runs(f.sha256);
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("TARGETS_PASSED");
  r[4]!.samples=r[4]!.samples.map(s=>({...s,value:40}));
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("REQUIRES_FIX");
  expect(assessHvpRuns(p,f.sha256,r.slice(0,4)).status).toBe("INCOMPLETE");
  r[4]!.result="game-failure";r[4]!.failures=["SimulationHold"];
  expect(assessHvpRuns(p,f.sha256,r).runs[4]!.reasons).toContain("game-failure");
  r[4]!.processId=r[0]!.processId;
  r[4]!.processStartedMs=r[0]!.processStartedMs;
  expect(()=>assessHvpRuns(p,f.sha256,r)).toThrow(/process/);
});
it("never pools warmup/trace/unsupported samples or promotes synthetic hardware",()=>{
  const p=plan(),f=freezeHvpMeasurement(p),r=runs(f.sha256);
  r[0]!.samples=r[0]!.samples.map(s=>({...s,phase:"warmup"}));
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("INCOMPLETE");
  r[0]!.samples=[{atMs:40_000,phase:"trace",metric:"frameIntervalMs",value:0,disposition:"unsupported"}];
  expect(assessHvpRuns(p,f.sha256,r).runs[0]!.reasons).toContain("trace-or-screenshot");
  const synthetic={...p,syntheticHardwareProfile:true},s=freezeHvpMeasurement(synthetic);
  expect(assessHvpRuns(synthetic,s.sha256,runs(s.sha256)).status).toBe("INELIGIBLE");
});
it("separates actual cuts from no-op/reject/deferred attempts and rejects false success counts",()=>{
  const p={...plan(),scenario:"PERF-03" as const},f=freezeHvpMeasurement(p),r=runs(f.sha256);
  for(const run of r){run.operations=Array.from({length:60},(_,i)=>({id:`cut-${i}`,phase:"measurement",outcome:"Applied",changedCells:1,
    inputMs:31_000+i*1000,feedbackMs:31_010+i*1000,consistentFrameMs:31_100+i*1000}));}
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("TARGETS_PASSED");
  r[0]!.operations[0]={...r[0]!.operations[0]!,outcome:"NoOp",changedCells:0};
  const report=assessHvpRuns(p,f.sha256,r);
  expect(report.status).toBe("INCOMPLETE");expect(report.runs[0]!.outcomes).toMatchObject({Applied:59,NoOp:1});
  r[0]!.operations[0]={...r[0]!.operations[0]!,outcome:"Applied"};
  expect(()=>assessHvpRuns(p,f.sha256,r)).toThrow(/changed cells/);
});
it("rejects byte tampering instead of treating file existence as evidence",()=>{
  const bytes=Buffer.from("actual raw file"),hash=createHash("sha256").update(bytes).digest("hex");
  expect(()=>assertHvpArtifact(bytes,hash)).not.toThrow();bytes[0]^=1;
  expect(()=>assertHvpArtifact(bytes,hash)).toThrow(/DigestMismatch/);
});
it("keeps real samples sharing a reduced-precision clock timestamp only with distinct identities",()=>{
  const p=plan(),f=freezeHvpMeasurement(p),r=runs(f.sha256);
  const sample={atMs:30_001,phase:"measurement" as const,metric:"solverStepCpuMs" as const,value:.1};
  r[0]!.samples.unshift({...sample,sampleId:"step:1"},{...sample,sampleId:"step:2"});
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("TARGETS_PASSED");
  r[0]!.samples[1]!.sampleId="step:1";
  expect(()=>assessHvpRuns(p,f.sha256,r)).toThrow(/Duplicate raw sample identity/);
});
it("retains an early failed run without inventing a full measurement window",()=>{
  const p=plan(),f=freezeHvpMeasurement(p),r=runs(f.sha256);
  r[0]={...r[0]!,result:"game-failure",measurementStartMs:5_000,measurementEndMs:5_000,samples:[],gauges:[],route:[],walking:[],failures:["startup failed"]};
  const report=assessHvpRuns(p,f.sha256,r);
  expect(report.status).toBe("REQUIRES_FIX");expect(report.runs).toHaveLength(5);
  expect(report.runs[0]!.missing).toContain("incomplete measurement window");
});
it("does not treat a stationary camera, partial route or edited world as PERF-02 walking proof",()=>{
  const p=plan(),f=freezeHvpMeasurement(p),r=runs(f.sha256);
  r[0]!.route=[];
  expect(assessHvpRuns(p,f.sha256,r).runs[0]!.missing).toContain("complete actual walking route");
  r[0]!.route=runs(f.sha256)[0]!.route!;r[0]!.route[2]!.position.x=30;
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("INCOMPLETE");
  r[0]!.route=runs(f.sha256)[0]!.route!;r[0]!.route[2]!.rootRevision=1;
  expect(assessHvpRuns(p,f.sha256,r).status).toBe("INCOMPLETE");
  r[0]!.route=runs(f.sha256)[0]!.route!;r[0]!.walking=[{startMs:30_000,endMs:60_000,distanceMeters:90}];
  expect(assessHvpRuns(p,f.sha256,r).runs[0]!.missing).toContain("continuous measured walking, not idle camera observation");
});
