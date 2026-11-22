import {writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";

// Events are clipped and unioned per thread. Nested paint/GC work must not add to its parent twice.
function unionMs(events, start, end) {
  const intervals = events.map(e => [Math.max(e.ts,start),Math.min(e.ts+e.dur,end)])
    .filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let last = start, sum = 0;
  for (const [a,b] of intervals) {
    sum += Math.max(0,b-Math.max(a,last));
    last = Math.max(last,b);
  }
  return sum/1000;
}

export function summarizeCutBrowserTrace(events, state) {
  const mark = events.find(e=>e.name==="hvpProbeClockSync" && e.cat?.includes("user_timing"));
  if (!mark || !Number.isFinite(state.clockSync)) return {sampled:false,reason:"Missing document clock binding"};
  const map = t=>mark.ts+1000*(t-state.clockSync);
  const ack=state.metrics["hvp.cutDomInputToPhysicsPublishedMs"];
  const submit=state.metrics["hvp.cutFirstCommittedRenderSubmitMs"];
  const xs=events.filter(e=>e.pid===mark.pid && e.tid===mark.tid && e.ph==="X" && Number.isFinite(e.dur));
  const tasks=xs.filter(e=>e.name==="RunTask" || e.name==="ThreadControllerImpl::RunTask" || e.name==="ThreadPool_RunTask");
  if (!tasks.length) return {sampled:false,reason:"No complete tasks on bound renderer main thread"};
  const span=(from,to)=>{
    const start=map(from),end=map(to);
    const local=xs.filter(e=>e.ts<end && e.ts+e.dur>start);
    const busy=unionMs(tasks,start,end);
    const inRange=tasks.filter(e=>e.ts<end && e.ts+e.dur>start);
    const clippedUs = e => Math.min(end, e.ts+e.dur) - Math.max(start, e.ts);
    const longest = inRange.reduce((best, event) => !best || clippedUs(event) > clippedUs(best) ? event : best, null);
    const longestTask = longest && {
      source:longest.args?.src_file, operation:longest.args?.src_func,
      overlapMs:clippedUs(longest)/1000, wholeTaskElapsedMs:longest.dur/1000,
      wholeTaskThreadCpuMs:Number.isFinite(longest.tdur) ? longest.tdur/1000 : null
    };
    return {longestTask, elapsedMs:to-from,mainTaskElapsedMs:busy,uncoveredMs:Math.max(0,to-from-busy),
      mainTaskCount:inRange.length, longestOverlappingTaskMs:Math.max(0,...inRange.map(e=>(Math.min(end,e.ts+e.dur)-Math.max(start,e.ts))/1000)),
      mainGcElapsedMs:unionMs(local.filter(e=>/MinorGC|MajorGC|V8\.GC|CppGC|BlinkGC/i.test(e.name)),start,end),
      mainPaintAndCompositingMs:unionMs(local.filter(e=>/^(Paint|PrePaint|CompositeLayers|Layerize|RasterTask|UpdateLayerTree|PaintImage)$/.test(e.name)),start,end),
      mainAnimationCallbackMs:unionMs(local.filter(e=>e.name==="FireAnimationFrame"),start,end)};
  };
  const work=state.phases.filter(p=>p.name==="hvp.cutStaticCollisionWorkMs" && p.detail?.data?.commandId===state.result.commandId)
    .sort((a,b)=>a.startTime-b.startTime);
  const gaps=work.slice(1).map((p,i)=>[work[i].startTime+work[i].duration,p.startTime])
    .filter(([a,b])=>b>a).map(([a,b])=>span(a,b));
  return {sampled:true,traceRendererPid:mark.pid,traceMainTid:mark.tid,inputToAck:span(state.eventTimeStamp,ack.startTime+ack.duration),
    ackToRenderSubmit:submit ? span(ack.startTime+ack.duration,submit.startTime+submit.duration) : null,
    staticCollisionGaps:gaps};
}

export async function startCutBrowserTrace(page, file) {
  const client=await page.context().browser().newBrowserCDPSession();
  const events = [];
  const collect = batch => {
    for (const event of batch.value) events.push(event);
  };
  client.on("Tracing.dataCollected", collect);
  await client.send("Tracing.start", {
    categories: "toplevel,devtools.timeline,blink.user_timing,v8",
    transferMode: "ReportEvents"
  });
  const clockSync = await page.evaluate(() => performance.mark("hvpProbeClockSync").startTime);
  return async state => {
    let timeout;
    let onComplete;
    const complete = new Promise((resolve, reject) => {
      onComplete = resolve;
      client.once("Tracing.tracingComplete", onComplete);
      timeout = setTimeout(() => reject(new Error("Chromium did not finish tracing")), 30_000);
    });
    let failure;
    try {
      const [result] = await Promise.all([complete, client.send("Tracing.end")]);
      if (result.dataLossOccurred) failure = "Chromium reported lost trace data";
    } catch (error) {
      failure = error.message;
    } finally {
      clearTimeout(timeout);
      client.off("Tracing.tracingComplete", onComplete);
      client.off("Tracing.dataCollected", collect);
      await client.detach().catch(() => {});
    }
    if (events.length) {
      const trace = JSON.stringify({traceEvents: events});
      await writeFile(file, gzipSync(trace), {flag: "wx"});
    }
    if (failure) return {sampled: false, reason: failure, receivedEvents: events.length};
    return summarizeCutBrowserTrace(events, {...state, clockSync});
  };
}
