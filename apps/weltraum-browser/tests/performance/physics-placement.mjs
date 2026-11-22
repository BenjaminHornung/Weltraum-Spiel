// node tests/performance/physics-placement.mjs NEW_RESULT.json
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rolldown } from "rolldown";

const output=process.argv[2];
if(!output)throw new Error("Pass a new result filename");
const entry=fileURLToPath(new URL("./placement/scene.ts",import.meta.url));
const bundle=await rolldown({input:entry,platform:"browser",logLevel:"silent"});
let code;
try {
  const {output:assets}=await bundle.generate({format:"esm",codeSplitting:false});
  code=assets.find(x=>x.type==="chunk" && x.isEntry).code;
} finally {await bundle.close();}
console.error("Compiled shared placement fixture");
const sha=data=>createHash("sha256").update(data).digest("hex");
const embedded=[...code.matchAll(/(["'`])(AGFzbQ[A-Za-z0-9+/=]+)\1/g)];
assert.equal(embedded.length,1,"exactly one embedded native payload");
const wasmSha=sha(Buffer.from(embedded[0][2],"base64"));
assert.equal(wasmSha,"f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb");
const server=createServer((req,res)=>{
  res.setHeader("Cross-Origin-Opener-Policy","same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy","require-corp");
  if(req.url==="/scene.mjs"){res.setHeader("Content-Type","text/javascript");res.end(code);}
  else {res.setHeader("Content-Type","text/html");res.end("<!doctype html><title>Hestia placement fixture</title>");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
const rows=[];
const percentiles=entries=>{
  const values=[...entries].sort((a,b)=>a-b);
  const q=f=>values[Math.ceil(f*values.length)-1];
  return {n:values.length,p50:q(.5),p95:q(.95),p99:q(.99),max:values.at(-1)};
};
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,args:["--disable-gpu","--num-raster-threads=1"]});
  for(const placement of ["worker","main","main","worker"]) {
    console.error("Running",placement,rows.length+1);
    const page=await browser.newPage();
    try{
      await page.goto("http://127.0.0.1:"+server.address().port);
      const sample=await page.evaluate(async placement=>{
        const endpoint="/scene.mjs";
        const w=placement==="worker"?new Worker(endpoint,{type:"module"}):null;
        const execute=w?undefined:(await import(endpoint)).createScene();
        let id=0;
        const samples=[];
        async function command(kind,warm=false){
          const start=performance.now();
          let r;
          if(w)r=await new Promise((resolve,reject)=>{
            const req=++id;
            w.onerror=e=>reject(Error(e.message));
            w.onmessage=({data})=>data.id!==req||data.error?reject(Error(data.error??"wrong id")):resolve(data);
            w.postMessage({id:req,kind});
          });
          else {
            const begin=performance.now(),result=await execute(kind);
            r={begin,end:performance.now(),origin:performance.timeOrigin,result};
          }
          const received=performance.now(),offset=r.origin-performance.timeOrigin;
          samples.push({kind,warm,rtt:received-start,inbound:r.begin+offset-start,work:r.end-r.begin,outbound:received-r.end-offset,native:r.result?.duration});
          return r.result;
        }
        try{
          for(let n=0;n<264;n++)await command("ping",n>=8);
          const before=await command("open"),after=await command("cut");
          let step;
          for(let n=0;n<544;n++)step=await command("step",n>=32);
          await command("close");
          return {samples,before,after,finalY:step.y,crossOriginIsolated};
        }finally{w?.terminate();}
      },placement);
      assert.deepEqual(sample.before,{supportRay:true,supportCapsule:true,armRay:true,armCapsule:true,armMoves:false});
      assert.deepEqual(sample.after.checks,{supportRay:false,supportCapsule:false,armRay:true,armCapsule:true,armMoves:true});
      assert.equal(sample.after.cells,384);assert.equal(sample.after.massKg,1722.65625);
      assert.ok(Math.abs(sample.after.nativeMassKg-1722.65625)<.001);
      assert.ok(Number.isFinite(sample.finalY));rows.push({placement,...sample});
    }finally{await page.close();}
  }
  const summary=Object.fromEntries(["worker","main"].map(placement=>{
    const samples=rows.filter(r=>r.placement===placement).flatMap(r=>r.samples);
    const steps=samples.filter(s=>s.kind==="step" && s.warm);
    return [placement,{emptyRttMs:percentiles(samples.filter(s=>s.kind==="ping"&&s.warm).map(s=>s.rtt)),
      nativeStepMs:percentiles(steps.map(s=>s.native)),stepRoundTripMs:percentiles(steps.map(s=>s.rtt)),
      cut:samples.filter(s=>s.kind==="cut")}];
  }));
  const report={browser:browser.version(),node:process.version,bundleSha256:sha(code),wasmSha256:wasmSha,
    environment:"isolated browser fixture, no HVP render workload",warmup:{pings:8,steps:32},sampleOrder:rows.map(r=>r.placement),summary,rows};
  await writeFile(output,JSON.stringify(report)+"\n",{flag:"wx"});
  console.log(JSON.stringify(summary,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
