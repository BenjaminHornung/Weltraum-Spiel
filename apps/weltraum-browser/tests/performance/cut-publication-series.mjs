// Run independent, normal player sessions and preserve failures in the denominator.
import {execFile} from "node:child_process";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {cpus} from "node:os";
import {resolve, join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

const [url,repetitions,outputDir]=process.argv.slice(2);
const count=Number(repetitions);
if(!url || !outputDir || !Number.isSafeInteger(count) || count<1){
  throw new Error("Usage: node tests/performance/cut-publication-series.mjs URL COUNT NEW_OUTPUT_DIRECTORY");
}
const run=promisify(execFile);
const output=resolve(outputDir);
await mkdir(output);
const runner=fileURLToPath(new URL("./cut-publication.mjs",import.meta.url));
const attempts=[];
for(let index=1;index<=count;index++){
  const prefix=join(output,"cut-"+String(index).padStart(3,"0"));
  const env={...process.env,HVP_CUT_EVENTS:prefix+".events.ndjson"};
  let result,exit=0,failure;
  try{
    const {stdout,stderr}=await run(process.execPath,[runner,url],{env,timeout:180_000,killSignal:"SIGKILL",maxBuffer:16*1024*1024});
    result=JSON.parse(stdout);
    await writeFile(prefix+".json",stdout);
    if(stderr) await writeFile(prefix+".log",stderr);
  }catch(error){
    exit=error.code??error.signal??1;
    failure=String(error.message).slice(0,1000);
    await writeFile(prefix+".log",String(error.stderr||error.message));
  }
  let events=[];
  try{
    const raw=await readFile(prefix+".events.ndjson","utf8");
    events=raw.trim().split("\n").filter(Boolean).map(JSON.parse);
  }catch(error){if(error.code!=="ENOENT")throw error;}
  const phase="hvp.cutDomInputToPhysicsPublishedMs";
  const measured=result?.metrics[phase]??events.find(e=>e.kind===phase);
  attempts.push({index,exit,failure,nativeMs:measured?.duration??null,submitMs:result?.domToSubmitMs??null,
    criticalPath:result?.criticalPath??null,renderer:result?.renderer??null,crash:events.some(e=>e.kind==="crash"),complete:Boolean(result),within10ms:Boolean(result&&measured?.duration<=10)});
}
const values=attempts.filter(a=>a.nativeMs!==null).map(a=>a.nativeMs).sort((a,b)=>a-b);
const quantile=q=>values.length?values[Math.ceil(q*values.length)-1]:null;
const report={url,count,node:process.version,cpu:cpus()[0]?.model,referenceDeviceVerified:false,physicalPresentationMeasured:false,
  complete:attempts.filter(a=>a.complete).length,qualifiedWithin10ms:attempts.filter(a=>a.within10ms).length,
  missingNativeConfirmation:count-values.length,nativeOver10ms:values.filter(v=>v>10).length,
  qualifiedWithinThreeStages:attempts.filter(a=>a.criticalPath?.withinStageBudget).length,
  observedNativeMs:{count:values.length,p50:quantile(.5),p95:quantile(.95),p99:quantile(.99),max:values.at(-1)??null},attempts};
await writeFile(join(output,"summary.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(report.qualifiedWithin10ms!==count || report.qualifiedWithinThreeStages!==count)process.exitCode=1;
