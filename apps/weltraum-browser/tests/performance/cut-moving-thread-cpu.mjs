// Optional Linux diagnostic. Brief user-timing marks identify only this Chromium session's threads.
// CPU ticks cover all work on each thread, including the normal solver steps that continue during a cut.
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";

async function identifyThreads(page) {
  const cdp = await page.context().browser().newBrowserCDPSession(), ids = new Map();
  cdp.on("Tracing.dataCollected", ({value}) => {
    for (const e of value) {
      if (e.name.startsWith("hvpMovingProbe/") && e.cat?.includes("user_timing")) {
        ids.set(e.name.slice("hvpMovingProbe/".length), {pid:e.pid,tid:e.tid});
      }
    }
  });
  let timer;
  try {
    await cdp.send("Tracing.start", {categories:"-*,blink.user_timing",transferMode:"ReportEvents"});
    const origin = await page.evaluate(() => {performance.mark("hvpMovingProbe/main");return performance.timeOrigin;});
    await Promise.all(page.workers().map((worker,i) => worker.evaluate(role => {performance.mark("hvpMovingProbe/"+role);},
      new URL(worker.url()).pathname.split("/").at(-1)+"#"+i)));
    const done = new Promise((resolve,reject) => {
      cdp.once("Tracing.tracingComplete",resolve);
      timer = setTimeout(() => reject(Error("Missing thread identity trace")),10000);
    });
    const [result] = await Promise.all([done,cdp.send("Tracing.end")]);
    if (result.dataLossOccurred || !ids.has("main")) throw Error("Chromium thread identity missing");
    return {origin, ids};
  } finally {clearTimeout(timer);await cdp.detach().catch(() => {});}
}
const absoluteNow = () => performance.timeOrigin+performance.now();
export async function startMovingThreadCpu(page) {
  if (process.platform !== "linux") return async () => ({sampled:false,message:"Linux thread accounting unavailable"});
  let origin, ids, tickMs;
  try {
    ({origin, ids} = await identifyThreads(page));
    tickMs = 1000 / Number(execFileSync("getconf",["CLK_TCK"],{encoding:"utf8"}).trim());
    if (!Number.isFinite(tickMs) || tickMs<=0) throw Error("Kernel clock tick unavailable");
  } catch (e) {return async () => ({sampled:false,message:String(e)});}
  const byRole = new Map([...ids].map(([role, ref]) => [role,{...ref, samples:[]}]));
  let reading;
  async function poll() {
    if (reading) return reading;
    reading = Promise.all([...byRole.values()].map(async row => {
      if (row.error) return;
      try {
        const start = absoluteNow();
        const raw = await readFile(`/proc/${row.pid}/task/${row.tid}/stat`,"utf8");
        const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
        const ticks = Number(fields[11]) + Number(fields[12]); // utime + stime
        if (!Number.isSafeInteger(ticks)) throw Error("Invalid thread CPU counter");
        row.samples.push({start,end:absoluteNow(),ticks});
      } catch (e) {row.error=String(e);}
    })).finally(() => {reading=undefined;});
    return reading;
  }
  await poll();
  const loop = setInterval(() => {void poll();},15);
  return async phases => {
    clearInterval(loop);await poll();
    const spans = phases.filter(p => /Body(OwnerPlan|MeshWorker|.*Admission|.*Admit|.*Release|RenderStage|InputToApplied|InputToRejected|TotalApplied|TotalRejected)Ms$/.test(p.name));
    const submitted = phases.find(p=>p.name==="hvp.cutBodySubmittedMs"), plan=phases.find(p=>p.name==="hvp.cutBodyOwnerPlanMs");
    if (submitted && plan && plan.start>=submitted.start) spans.unshift({name:"beginAndTransport",start:submitted.start,duration:plan.start-submitted.start});
    const result = {};
    for(const [role,row] of byRole) {
      result[role] = {pid:row.pid,tid:row.tid,samples:row.samples.length,error:row.error,phases:spans.map(p=>{
        const start = origin+p.start, end=start+p.duration;
        const inner = row.samples.filter(s=>s.start>=start&&s.end<=end);
        const before=row.samples.findLast(s=>s.end<=start), after=row.samples.find(s=>s.start>=end);
        // utime and stime each have an independent kernel-tick quantization error.
        const lower = inner.length>1 ? Math.max(0,(inner.at(-1).ticks-inner[0].ticks-2)*tickMs) : 0;
        const upper = before&&after ? (after.ticks-before.ticks+2)*tickMs : null;
        return {name:p.name,elapsedMs:p.duration,cpuLowerMs:lower,cpuUpperMs:upper};
      })};
    }
    return {sampled:[...byRole.values()].some(r=>r.samples.length>=2),kernelTickMs:tickMs,byRole:result};
  };
}
