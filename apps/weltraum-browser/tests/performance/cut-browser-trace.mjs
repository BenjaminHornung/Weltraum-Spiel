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
    return {elapsedMs:to-from,mainTaskElapsedMs:busy,uncoveredMs:Math.max(0,to-from-busy),
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
    ackToRenderSubmit:span(ack.startTime+ack.duration,submit.startTime+submit.duration),
    staticCollisionGaps:gaps};
}

export async function startCutBrowserTrace(page, file) {
  const client=await page.context().newCDPSession(page);
  await client.send("Tracing.start",{categories:"toplevel,devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8",transferMode:"ReturnAsStream"});
  const clockSync=await page.evaluate(()=>performance.mark("hvpProbeClockSync").startTime);
  return async state=>{
    const complete=new Promise(resolve=>client.once("Tracing.tracingComplete",resolve));
    await client.send("Tracing.end");
    const {stream}=await complete;
    const buffers=[];
    try {
      for(;;){
        const chunk=await client.send("IO.read",{handle:stream});
        buffers.push(Buffer.from(chunk.data,chunk.base64Encoded?"base64":"utf8"));
        if(chunk.eof) break;
      }
    }finally{await client.send("IO.close",{handle:stream});await client.detach();}
    const raw=Buffer.concat(buffers);
    await writeFile(file,gzipSync(raw),{flag:"wx"});
    return summarizeCutBrowserTrace(JSON.parse(raw).traceEvents,{...state,clockSync});
  };
}
