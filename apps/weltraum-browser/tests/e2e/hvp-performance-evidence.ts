import {createHash} from "node:crypto";
import {canonicalizePersistenceValue,serializeCanonicalPersistenceValue} from "../../src/persistence";

export type HvpPerfScenario=`PERF-0${1|2|3|4|5|6|7|8}`;
export interface HvpMeasurementPlan {
  version:"hvp-measurement-v1";profileId:string;renderProfile:"HVP-PLAY-720-v1";scenario:HvpPerfScenario;
  classification:"measurement"|"diagnostic";repetitions:number;warmupMs:number;measurementMs:number;
  width:number;height:number;dpr:number;trace:boolean;screenshots:boolean;syntheticHardwareProfile:boolean;
  fixtureKind:"normal-product-route"|"authored-synthetic";fixtureSha256:string;
  commit:string;dirty:boolean;sourceSha256:string;buildSha256:string;lockSha256:string;wasmSha256:string;
  browser:{version:string;binarySha256:string;headed:boolean};
  hardware:{os:string;cpu:string;ramBytes:number;gpu:string;driver:string;power:string;refreshHz:number};
}
type Metric="frameIntervalMs"|"solverStepCpuMs"|"mainCpuMs"|"commitUploadMs"|"coldReadyMs"|"saveMs"|"restoreMs";
type Phase="cold"|"warmup"|"measurement"|"diagnostic"|"trace";
export interface HvpRawSample {atMs:number;phase:Phase;metric:Metric;value:number;sampleId?:string;disposition?:"unsupported"}
export interface HvpMeasuredOperation {
  id:string;phase:Phase;outcome:"Applied"|"NoOp"|"Rejected"|"Deferred";changedCells:number;
  inputMs:number;feedbackMs:number;consistentFrameMs?:number;
}
export interface HvpMeasuredRun {
  id:string;processId:number;processStartedMs:number;planSha256:string;result:"completed"|"game-failure"|"infrastructure-failure";
  measurementStartMs:number;measurementEndMs:number;trace:boolean;screenshots:boolean;
  samples:HvpRawSample[];operations:HvpMeasuredOperation[];failures:string[];
  gauges?:{atMs:number;triangles:number;draws:number;cpuBytes:number;meshBytes:number;activeDynamic:number;residentDynamic:number;colliders:number;heavyJobs:number;queue:number}[];
  lifecycle?:{cycle:number;disposed:Record<string,number>;retained:Record<string,number>}[];
  cycles?:{id:string;saveMs:number;restoreMs:number;movingBodies:number;consistent:boolean}[];
  crossings?:{id:string;outbound:boolean;inbound:boolean;collisionReady:boolean;holeFree:boolean}[];
  route?:{id:string;atMs:number;position:{x:number;y:number;z:number};rootRevision:number}[];
  walking?:{startMs:number;endMs:number;distanceMeters:number}[];
  overload?:{attempts:number;durationMs:number;largeCutRejected:boolean;unknownCoverageRejected:boolean;lostConfirmedCommands:number};
}
const sha=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
const finite=(n:number)=>Number.isFinite(n)&&n>=0;
export const assertHvpArtifact=(bytes:Uint8Array,expected:string):void=>{
  if(!/^[0-9a-f]{64}$/.test(expected)||sha(bytes)!==expected){throw new Error("DigestMismatch: HVP evidence artifact");}
};
export const freezeHvpMeasurement=(p:HvpMeasurementPlan)=>{
  if(!p||p.version!=="hvp-measurement-v1"||!/^HVP-DEVICE-\d+$/.test(p.profileId)||!/^PERF-0[1-8]$/.test(p.scenario)
    ||p.renderProfile!=="HVP-PLAY-720-v1"||p.width!==1280||p.height!==720||p.dpr!==1
    ||!["measurement","diagnostic"].includes(p.classification)||!['normal-product-route','authored-synthetic'].includes(p.fixtureKind)
    ||![p.dirty,p.trace,p.screenshots,p.syntheticHardwareProfile,p.browser?.headed].every(v=>typeof v==="boolean")
    ||!p.hardware||![p.hardware.os,p.hardware.cpu,p.hardware.gpu,p.hardware.driver,p.hardware.power,p.browser.version].every(v=>typeof v==="string"&&v.length>0&&v.length<=1024)
    ||!Number.isSafeInteger(p.hardware.ramBytes)||p.hardware.ramBytes<=0||!Number.isFinite(p.hardware.refreshHz)||p.hardware.refreshHz<=0){throw new Error("Incomplete observed HVP profile");}
  if(!/^[0-9a-f]{40}$/.test(p.commit)||![p.sourceSha256,p.buildSha256,p.lockSha256,p.wasmSha256,p.browser.binarySha256,p.fixtureSha256].every(v=>/^[0-9a-f]{64}$/.test(v))){throw new Error("Missing HVP source/build binding");}
  const expected=p.classification==="measurement"?[5,30_000,120_000]:[3,10_000,30_000];
  if(p.repetitions!==expected[0]||p.warmupMs!==expected[1]||p.measurementMs!==expected[2]){throw new Error("Invalid frozen repetition/phase plan");}
  const plan=canonicalizePersistenceValue(p) as unknown as HvpMeasurementPlan;
  return Object.freeze({plan,sha256:sha(serializeCanonicalPersistenceValue(plan))});
};
export const nearestRank=(values:readonly number[],q:number):number=>{
  if(values.length===0||values.some(v=>!finite(v))||!Number.isFinite(q)||q<=0||q>1){throw new Error("Invalid raw quantile population");}
  const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(q*sorted.length)-1]!;
};
const summary=(values:readonly number[])=>values.length===0?null:{count:values.length,p95:nearestRank(values,.95),p99:nearestRank(values,.99),max:values.reduce((a,b)=>Math.max(a,b),0)};

/** Scenario-only proposed-target assessment. Never infers ART or BR04 eligibility. */
export const assessHvpRuns=(p:HvpMeasurementPlan,expectedFrozenSha256:string,runs:readonly HvpMeasuredRun[])=>{
  const frozen=freezeHvpMeasurement(p);
  if(frozen.sha256!==expectedFrozenSha256){throw new Error("Changed frozen measurement plan/provenance");}
  if(runs.length>p.repetitions||new Set(runs.map(r=>r.id)).size!==runs.length||new Set(runs.map(r=>`${r.processId}@${r.processStartedMs}`)).size!==runs.length
    ||runs.some(r=>!Number.isSafeInteger(r.processId)||r.processId<=0||!finite(r.processStartedMs))){throw new Error("Runs must bind distinct fresh browser processes");}
  const reports=runs.map(r=>{
    if(r.planSha256!==frozen.sha256||!finite(r.measurementStartMs)||!finite(r.measurementEndMs)||r.measurementEndMs<r.measurementStartMs
      ||(r.result==="completed"&&(r.measurementStartMs<p.warmupMs||r.measurementEndMs-r.measurementStartMs<p.measurementMs))||r.samples.length>1_000_000||r.operations.length>1024
      ||!['completed','game-failure','infrastructure-failure'].includes(r.result)){throw new Error("Invalid run/phase binding");}
    const reasons:string[]=[],missing:string[]=[],metrics:Partial<Record<Metric,ReturnType<typeof summary>>>={};
    if(r.measurementEndMs-r.measurementStartMs<p.measurementMs){missing.push("incomplete measurement window");}
    if(r.trace||r.screenshots||r.samples.some(s=>s.phase==="trace")){reasons.push("trace-or-screenshot");}
    if(r.result!=="completed"){reasons.push(r.result);}
    if(r.failures.length>0){reasons.push(...r.failures);}
    if(r.samples.some(s=>!finite(s.atMs)||!finite(s.value)||!['cold','warmup','measurement','diagnostic','trace'].includes(s.phase)
      ||(s.phase==="measurement"&&(s.atMs<r.measurementStartMs||s.atMs>r.measurementEndMs)))){throw new Error("Invalid raw timing sample/phase");}
    const values=(metric:Metric,phase:Phase="measurement")=>r.samples.filter(s=>s.metric===metric&&s.phase===phase&&s.disposition===undefined
      &&(phase==="cold"?s.atMs<=r.measurementStartMs:s.atMs>=r.measurementStartMs&&s.atMs<=r.measurementEndMs)).map(s=>s.value);
    const check=(metric:Metric,p95:number,p99?:number,max?:number,phase:Phase="measurement")=>{
      const data=values(metric,phase),s=summary(data);metrics[metric]=s;
      if(!s){missing.push(metric);return;}
      if(s.p95>p95||(p99!==undefined&&s.p99>p99)||(max!==undefined&&s.max>max)){reasons.push(`${metric}: target exceeded`);}
    };
    if(p.scenario==="PERF-01"){check("coldReadyMs",5000,undefined,5000,"cold");}
    else{
      check("frameIntervalMs",20,33.4,100);check("solverStepCpuMs",4);check("mainCpuMs",4);
      for(const metric of ["frameIntervalMs","solverStepCpuMs","mainCpuMs"] as const){
        const data=r.samples.filter(s=>s.metric===metric&&s.phase==="measurement"&&s.disposition===undefined);
        const ids=new Set<string>();
        for(const [i,s] of data.entries()){
          if(s.sampleId!==undefined&&(!/^[A-Za-z0-9:_-]{1,128}$/.test(s.sampleId)||ids.has(s.sampleId))){throw new Error("Duplicate raw sample identity");}
          if(i>0&&(s.atMs<data[i-1]!.atMs||(s.atMs===data[i-1]!.atMs&&(s.sampleId===undefined||data[i-1]!.sampleId===undefined)))){
            throw new Error("Unordered/ambiguous raw timestamps");
          }
          if(s.sampleId!==undefined){ids.add(s.sampleId);}
        }
        if(data.length<2||data[0]!.atMs-r.measurementStartMs>1000||r.measurementEndMs-data.at(-1)!.atMs>1000){missing.push(`${metric}: raw phase coverage`);}
      }
    }
    const gauges=r.gauges??[];
    if(gauges.length<2||gauges[0]!.atMs-r.measurementStartMs>1000||r.measurementEndMs-gauges.at(-1)!.atMs>1000){missing.push("resource gauges");}
    for(const g of gauges){
      if(Object.values(g).some(n=>!finite(n))){throw new Error("Invalid resource gauge");}
      if(g.triangles>500_000||g.draws>300||g.cpuBytes>268_435_456||g.meshBytes>134_217_728
        ||g.activeDynamic>32||g.residentDynamic>64||g.colliders>4096||g.heavyJobs>2||g.queue>32){reasons.push("resource cap exceeded");}
    }
    const outcomes={Applied:0,NoOp:0,Rejected:0,Deferred:0},latencies:number[]=[],feedback:number[]=[],changedCells:number[]=[];
    const ids=new Set<string>();
    for(const o of r.operations){
      if(!Object.hasOwn(outcomes,o.outcome)||ids.has(o.id)||!Number.isSafeInteger(o.changedCells)||o.changedCells<0||o.changedCells>512
        ||(o.outcome==="Applied"?o.changedCells===0:o.changedCells!==0)){throw new Error("Invalid outcome/changed cells population");}
      ids.add(o.id);
      if(!finite(o.inputMs)||!finite(o.feedbackMs)||o.feedbackMs<o.inputMs){throw new Error("Invalid feedback timeline");}
      if(o.phase!=="measurement"||o.inputMs<r.measurementStartMs||o.inputMs>r.measurementEndMs){continue;}
      outcomes[o.outcome]+=1;feedback.push(o.feedbackMs-o.inputMs);
      if(o.outcome==="Applied"){
        if(o.consistentFrameMs===undefined||!finite(o.consistentFrameMs)||o.consistentFrameMs<o.feedbackMs){throw new Error("Missing consistent committed-generation frame");}
        latencies.push(o.consistentFrameMs-o.inputMs);changedCells.push(o.changedCells);
      }
    }
    if(p.scenario==="PERF-03"){
      check("commitUploadMs",2);
      if(outcomes.Applied!==60){missing.push("60 actual successful cuts");}
      if(latencies.length&& (nearestRank(latencies,.95)>250||nearestRank(latencies,.99)>500)){reasons.push("cut end-to-end target exceeded");}
      if(feedback.length&&nearestRank(feedback,.95)>100){reasons.push("tool feedback target exceeded");}
    }
    if(p.scenario==="PERF-02"){
      const route=r.route??[],required=[["C01-EYE",-8,-11],["C02-SHORE",-2,-6],["C03-ROOTS",3,4],["SALVAGE-CLEARING",-9,-9]] as const;
      if(route.length<required.length||route.some((point,i)=>{
        const [id,x,z]=required[i%required.length]!;return !point||point.id!==id||point.rootRevision!==0||!finite(point.atMs)||point.atMs<r.measurementStartMs||point.atMs>r.measurementEndMs
          ||(i>0&&point.atMs<=route[i-1]!.atMs)||!point.position||![point.position.x,point.position.y,point.position.z].every(Number.isFinite)
          ||Math.hypot(point.position.x-x,point.position.z-z)>.6;
      })){missing.push("complete actual walking route");}
      const walking=r.walking??[];let duration=0,distance=0;
      for(const [i,s] of walking.entries()){
        if(!finite(s.startMs)||!finite(s.endMs)||!finite(s.distanceMeters)||s.endMs<s.startMs||s.startMs<r.measurementStartMs
          ||s.endMs>r.measurementEndMs||(i>0&&s.startMs<walking[i-1]!.endMs)){throw new Error("Invalid walking intervals");}
        duration+=s.endMs-s.startMs;distance+=s.distanceMeters;
      }
      if(duration<p.measurementMs-1000||distance<=0){missing.push("continuous measured walking, not idle camera observation");}
    }
    if(p.scenario==="PERF-04"&&gauges.some(g=>g.activeDynamic!==32)){missing.push("32 actually active dynamic bodies");}
    if(p.scenario==="PERF-05"){
      const cycles=r.lifecycle??[],fields=["geometries","materials","textures","workers","listeners","timers","pendingJobs","bodies","colliders","ownedBytes"];
      if(cycles.length!==20||new Set(cycles.map(c=>c.cycle)).size!==20){missing.push("20 actual lifecycle cycles");}
      for(const c of cycles){if(fields.some(k=>c.disposed[k]!==0)){reasons.push("owned resources not disposed");}}
      const warm=cycles.slice(5);if(warm.length&&warm.some(c=>serializeCanonicalPersistenceValue(c.retained)!==serializeCanonicalPersistenceValue(warm[0]!.retained))){reasons.push("no retained-resource plateau");}
    }
    if(p.scenario==="PERF-06"){
      const cycles=r.cycles??[];
      if(cycles.length!==10||new Set(cycles.map(c=>c.id)).size!==10||cycles.some(c=>c.movingBodies!==8||!c.consistent)){missing.push("10 complete restores with 8 moving bodies");}
      if(cycles.length){if(cycles.some(c=>!finite(c.saveMs)||!finite(c.restoreMs))){throw new Error("Invalid storage timing");}
        if(nearestRank(cycles.map(c=>c.saveMs),.95)>3000||nearestRank(cycles.map(c=>c.restoreMs),.95)>3000){reasons.push("save/load target exceeded");}}
    }
    if(p.scenario==="PERF-07"){
      const crossings=r.crossings??[];
      if(crossings.length!==20||new Set(crossings.map(c=>c.id)).size!==20||crossings.some(c=>!c.outbound||!c.inbound||!c.collisionReady||!c.holeFree)){missing.push("20 confirmed hole-free round trips");}
    }
    if(p.scenario==="PERF-08"){
      const o=r.overload;
      if(!o||o.attempts!==64||!finite(o.durationMs)||o.durationMs>1000||!o.largeCutRejected||!o.unknownCoverageRejected){missing.push("bounded overload/negative workload");}
      if(o&&o.lostConfirmedCommands!==0){reasons.push("lost confirmed commands");}
    }
    const diagnosticMetrics=p.classification==="diagnostic"?Object.fromEntries((["frameIntervalMs","solverStepCpuMs","mainCpuMs","commitUploadMs"] as const)
      .map(metric=>[metric,summary(values(metric,"diagnostic"))])):undefined;
    return {id:r.id,processId:r.processId,reasons:[...new Set(reasons)],missing:[...new Set(missing)],metrics,diagnosticMetrics,outcomes,
      workload:{route:r.route??[],walking:r.walking??[],crossings:r.crossings??[]},
      cutLatency:summary(latencies),feedback:summary(feedback),changedCellRange:changedCells.length?[Math.min(...changedCells),Math.max(...changedCells)]:null};
  });
  const status=p.classification!=="measurement"||p.syntheticHardwareProfile||p.trace||p.screenshots||reports.some(r=>r.reasons.includes("trace-or-screenshot"))?"INELIGIBLE"
    :reports.some(r=>r.reasons.length)?"REQUIRES_FIX":runs.length!==p.repetitions||reports.some(r=>r.missing.length)?"INCOMPLETE":"TARGETS_PASSED";
  return {status,scope:"declared scenario and fixture only",art:"NOT_ASSESSED",br04:"NOT_APPLICABLE",planSha256:frozen.sha256,runs:reports} as const;
};
