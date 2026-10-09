import {nearestRank} from "../e2e/hvp-performance-evidence";
import type {HvpCutRawEntry} from "./hvpCutRtReport";

const totals=new Set(["hvp.runtimePrivateUploadCommitCpuMs","hvp.runtimePlainMaterialAcquireCpuMs","hvp.runtimePresentationPublishCpuMs"]);

/** Only nonoverlapping synchronous totals count; nested breakdowns and staging/RPC walls remain diagnostic. */
export const readHvpPrivateUploadCpu=(raw:{entries:readonly HvpCutRawEntry[];dropped:number},from:number,to:number)=>{
  if(!Number.isFinite(from)||from<0||!Number.isFinite(to)||to<=from||raw.dropped!==0){throw new Error("Incomplete private upload CPU population");}
  const frames=raw.entries.filter(e=>e.name==="hvp.mainFrameCpuMs").sort((a,b)=>a.start-b.start);
  for(let i=0;i<frames.length;i++){const f=frames[i]!;if(!Number.isFinite(f.start)||f.start<0||!Number.isFinite(f.duration)||f.duration<0||i>0&&frames[i-1]!.start===f.start){throw new Error("Invalid actual RAF population");}}
  const candidates=raw.entries.filter(e=>totals.has(e.name));
  if(candidates.some(e=>!Number.isFinite(e.start)||e.start<0||!Number.isFinite(e.duration)||e.duration<0)){throw new Error("Invalid private upload CPU totals");}
  const spans=candidates.filter(e=>e.start<to&&e.start+e.duration>from).sort((a,b)=>a.start-b.start);
  if(!spans.some(e=>e.name==="hvp.runtimePrivateUploadCommitCpuMs")){return {state:"Missing" as const,frames:[],p95Ms:null,maxMs:null};}
  const sums=new Map<number,number>();
  for(let i=0;i<frames.length;i++){const f=frames[i]!,end=frames[i+1]?.start??f.start+f.duration;if(f.start<to&&end>from){sums.set(f.start,0);}}
  let previousEnd=-Infinity;
  for(const span of spans){
    if(!Number.isFinite(span.start)||span.start<0||!Number.isFinite(span.duration)||span.duration<0||span.start<previousEnd-1e-6){throw new Error("Overlapping or invalid private upload CPU totals");}
    previousEnd=span.start+span.duration;
    const bucket=span.detail?.data?.frameBucketStart,index=frames.findIndex(f=>f.start===bucket),frame=frames[index];
    if(frame===undefined||typeof bucket!=="number"||!sums.has(bucket)||span.start<bucket){throw new Error("Missing actual RAF bucket for private upload CPU");}
    const next=frames[index+1]?.start;
    if(next===undefined?(span.detail?.data?.insideAnimationFrame!==true||previousEnd>frame.start+frame.duration+1e-6):previousEnd>next+1e-6){throw new Error("Private upload CPU crosses an unproven RAF boundary");}
    sums.set(bucket,sums.get(bucket)!+span.duration);
  }
  const rows=[...sums].map(([frameStart,cpuMs])=>({frameStart,cpuMs})),values=rows.map(r=>r.cpuMs);
  return {state:"Complete" as const,frames:rows,p95Ms:nearestRank(values,.95),maxMs:Math.max(...values)};
};

/** Candidate qualification requires complete spans; a measured budget miss stays reportable. */
export const assessHvpPrivateUploadCpu=(raw:{entries:readonly HvpCutRawEntry[];dropped:number},from:number,to:number)=>{
  const measured=readHvpPrivateUploadCpu(raw,from,to);
  if(measured.state!=="Complete"){throw new Error("Missing required private upload CPU evidence");}
  return {...measured,limitMs:2,budget:measured.p95Ms<=2?"WithinBudget" as const:"OverBudget" as const};
};
