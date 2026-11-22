// Run ABBA against one immutable HVP production build.
import { execFile } from "node:child_process";
import { mkdir,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const [url,output]=process.argv.slice(2);
if(!url||!output)throw new Error("Usage: node tests/performance/physics-placement-player.mjs URL NEW_OUTPUT_DIR");
await mkdir(output);
const run=promisify(execFile);
const probe=fileURLToPath(new URL("./cut-publication.mjs",import.meta.url));
const attempts=[];
const stats=sample=>{
  if(!sample.length)return {n:0};
  const s=sample.map(row=>row.duration).sort((a,b)=>a-b);
  const q=f=>s[Math.ceil(f*s.length)-1];
  return {n:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};
};
for(const placement of ["worker","main","main","worker"]) {
  const prefix=join(output,String(attempts.length+1)+"-"+placement);
  let outcome;
  try{
    const {stdout,stderr}=await run(process.execPath,[probe,url],{env:{...process.env,HVP_PHYSICS_PLACEMENT:placement,HVP_CUT_EVENTS:prefix+".events.ndjson"},
      timeout:150_000,killSignal:"SIGKILL",maxBuffer:16*1024*1024});
    const x=JSON.parse(stdout);
    await writeFile(prefix+".json",stdout);
    await writeFile(prefix+".log",stderr);
    const published=x.metrics["hvp.cutDomInputToPhysicsPublishedMs"];
    const beforeAck=x.frames.filter(f=>f.start+f.duration>=x.eventTimeStamp && f.start<x.eventTimeStamp+published.duration);
    outcome={placement,exit:0,owner:x.ownerPlacement,physicsMs:published.duration,submitMs:x.domToSubmitMs,
      result:x.result,renderer:x.renderer,activeCutFrameIntervalsMs:stats(beforeAck),observedSolverStepsMs:stats(x.solver)};
  }catch(error){
    await writeFile(prefix+".log",String(error.stderr??"")+"\n"+String(error.message));
    outcome={placement,exit:error.code??error.signal??1,error:String(error.message).slice(0,1000)};
  }
  attempts.push(outcome);
  await writeFile(join(output,"summary.json"),JSON.stringify({url,physicalPresentationMeasured:false,referenceDeviceVerified:false,attempts},null,2)+"\n");
  console.log(JSON.stringify(outcome));
}
if(attempts.some(row=>row.exit!==0||row.physicsMs>10))process.exitCode=1;
