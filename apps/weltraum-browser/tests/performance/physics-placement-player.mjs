// Run ABBA against one immutable HVP production build.
import { execFile } from "node:child_process";
import { mkdir,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {cutGameplayTiming,cutSeriesChecks} from "./cut-work.mjs";

const [url,output,pairArgument="2"]=process.argv.slice(2);
const pairs=Number(pairArgument);
if(!url||!output||!Number.isSafeInteger(pairs)||pairs<1||pairs>1000)throw new Error("Usage: node tests/performance/physics-placement-player.mjs URL NEW_OUTPUT_DIR [PAIRS]");
await mkdir(output);
const run=promisify(execFile);
const probe=fileURLToPath(new URL("./cut-publication.mjs",import.meta.url));
const attempts=[];
const timings = {worker:{frames:[],steps:[]},main:{frames:[],steps:[]}};
const stats=sample=>{
  if(!sample.length)return {n:0};
  const s=sample.map(row=>row.duration).sort((a,b)=>a-b);
  const q=f=>s[Math.ceil(f*s.length)-1];
  return {n:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};
};
const order=Array.from({length:pairs},(_,i)=>i%2===0?["worker","main"]:["main","worker"]).flat();
for(const placement of order) {
  const prefix=join(output,String(attempts.length+1)+"-"+placement);
  let outcome;
  try{
    const {stdout,stderr}=await run(process.execPath,[probe,url],{env:{...process.env,...(process.env.HVP_CUT_CHROME_TRACE?{HVP_CUT_CHROME_TRACE:prefix+".chrome.json.gz"}:{}),HVP_PHYSICS_PLACEMENT:placement,HVP_CUT_EVENTS:prefix+".events.ndjson"},
      timeout:150_000,killSignal:"SIGKILL",maxBuffer:16*1024*1024});
    const x=JSON.parse(stdout);
    await writeFile(prefix+".json",stdout);
    await writeFile(prefix+".log",stderr);
    const published=x.metrics["hvp.cutDomInputToPhysicsPublishedMs"];
    const beforeAck=x.frames.filter(f=>f.start+f.duration>=x.eventTimeStamp && f.start<x.eventTimeStamp+published.duration);
    timings[placement].frames.push(...beforeAck);
    timings[placement].steps.push(...x.solver);
    const ackAt = published.startTime + published.duration;
    const submitAt = x.eventTimeStamp + x.domToSubmitMs;
    const frameBoundaries = x.frames.filter(f => f.start + f.duration > ackAt && f.start + f.duration <= submitAt);
    outcome={placement,exit:0,owner:x.ownerPlacement,physicsMs:published.duration,submitMs:x.domToSubmitMs,
      browser:x.browser, result:x.result, renderer:x.renderer, compactActivation:x.compactActivation, gameplay:cutGameplayTiming(x), ackToSubmitMs:submitAt - ackAt,
      frameBoundariesAfterAckBeforeSubmit:frameBoundaries.length, criticalPath:x.criticalPath,trace:x.browserTrace,activeCutFrameIntervalsMs:stats(beforeAck),observedSolverStepsMs:stats(x.solver)};
  }catch(error){
    await writeFile(prefix+".log",String(error.stderr??"")+"\n"+String(error.message));
    outcome={placement,exit:error.code??error.signal??1,error:String(error.message).slice(0,1000)};
  }
  attempts.push(outcome);
  await writeFile(join(output,"summary.json"),JSON.stringify({url,physicalPresentationMeasured:false,referenceDeviceVerified:false,attempts},null,2)+"\n");
  console.log(JSON.stringify(outcome));
}
const requestedGpu=process.env.HVP_REFERENCE_GPU?.toLowerCase();
const hardwareMatches=requestedGpu?attempts.every(row=>typeof row.renderer==="string" &&
  row.renderer.toLowerCase().includes(requestedGpu) && !/swiftshader|llvmpipe|software/i.test(row.renderer)):null;
const summary={url,pairs,physicalPresentationMeasured:false,referenceDeviceVerified:false,requestedGpuMatches:hardwareMatches,attempts,
  byPlacement:Object.fromEntries(["worker","main"].map(mode=>{
    const sample=attempts.filter(r=>r.placement===mode);
    const frames=stats(timings[mode].frames);
    const steps=stats(timings[mode].steps);
    const checks=cutSeriesChecks(sample,frames,steps);
    return [mode,{checks,cutFrameIntervalsMs:frames,solverStepsMs:steps,attempted:sample.length,completed:sample.filter(r=>r.exit===0).length,
      inputToPublicationMs:stats(sample.filter(r=>r.exit===0).map(r=>({duration:r.physicsMs}))),
      inputToGameplayReadyMs:stats(sample.flatMap(row=>row.gameplay?[{duration:row.gameplay.inputToGameplayReadyMs}]:[])),
      meetingGameplay10ms:sample.filter(row=>row.gameplay && row.gameplay.inputToGameplayReadyMs<=10).length,
      meeting10ms:sample.filter(r=>r.exit===0&&r.physicsMs<=10).length,
      meetingThreeStages:sample.filter(r=>r.criticalPath?.withinStageBudget).length,
      meetingSolverP95:sample.filter(r=>r.observedSolverStepsMs?.p95<=4).length,
      meetingFrameIntervalP95AndP99:sample.filter(r=>r.activeCutFrameIntervalsMs?.p95<=20 && r.activeCutFrameIntervalsMs?.p99<=33.34).length}];
  }))};
await writeFile(join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
if (hardwareMatches===false || Object.values(summary.byPlacement).some(mode=>!mode.checks.passed)) process.exitCode=1;
