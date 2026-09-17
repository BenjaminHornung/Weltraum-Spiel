import {test,expect,type Browser,type Page} from "@playwright/test";
import {createHash,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile,mkdir,writeFile,readdir,stat} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {freezeHvpMeasurement,assessHvpRuns,type HvpMeasurementPlan,type HvpMeasuredRun,type HvpRawSample} from "../e2e/hvp-performance-evidence";
import {measurementUrl,prepareHvpWorkload,runHvpWorkload,type HvpWorkloadProgress} from "./hvp-workloads";

const sha=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
const shell=(command:string)=>execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",command],{encoding:"utf8",timeout:20_000,windowsHide:true}).trim();
const inventory=async(root:string):Promise<{path:string;sha256:string}[]>=>{
  const result:{path:string;sha256:string}[]=[];
  const walk=async(dir:string):Promise<void>=>{for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isSymbolicLink()){throw new Error("Measurement inputs must not contain symlinks");}
    if(entry.isDirectory()){await walk(file);}else if(entry.isFile()){result.push({path:path.relative(root,file).replaceAll("\\","/"),sha256:sha(await readFile(file))});}
  }};
  await walk(root);return result.sort((a,b)=>a.path.localeCompare(b.path,"en"));
};
const observeGpu=(page:Page)=>page.evaluate(()=>{
  const gl=document.querySelector<HTMLCanvasElement>("#debug-scene")?.getContext("webgl2");if(!gl){throw new Error("Actual product WebGL2 context unavailable");}
  const ext=gl.getExtension("WEBGL_debug_renderer_info");if(!ext){throw new Error("Selected GPU identity unavailable");}
  const gpu=String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  return {gpu,visible:document.visibilityState,focused:document.hasFocus(),dpr:devicePixelRatio,
    cssWidth:innerWidth,cssHeight:innerHeight,bufferWidth:gl.drawingBufferWidth,bufferHeight:gl.drawingBufferHeight};
});
const browserProcess=async(browser:Browser)=>{
  const cdp=await browser.newBrowserCDPSession();
  try{const info=await cdp.send("SystemInfo.getProcessInfo");const pid=info.processInfo.find(p=>p.type==="browser")?.id;
    if(!Number.isSafeInteger(pid)||!pid||pid<1){throw new Error("Actual browser process identity unavailable");}
    const start=Number(shell(`([DateTimeOffset](Get-Process -Id ${pid}).StartTime).ToUnixTimeMilliseconds()`));
    if(!Number.isFinite(start)||start<=0){throw new Error("Actual process start time unavailable");}
    return {processId:pid,processStartedMs:start};
  }finally{await cdp.detach();}
};
type RawEntry={name:string;start:number;duration:number;detail:{sampleId?:string;data?:unknown}|null;documentTimeOrigin?:number;originalStartMs?:number};

test("HVP14 records a frozen workload population, never promotes a diagnostic run",async({playwright})=>{
  test.setTimeout(3_600_000);
  const scenario=process.env.WELTRAUM_HVP_MEASURE_SCENARIO??"PERF-01";
  if(scenario!=="PERF-01"&&scenario!=="PERF-02"&&scenario!=="PERF-05"&&scenario!=="PERF-07"){throw new Error("Requested measurement workload is not implemented; no substitute run");}
  const directory=process.env.WELTRAUM_HVP_MEASURE_DIR;
  if(!directory){throw new Error("WELTRAUM_HVP_MEASURE_DIR must name a fresh measurement directory");}
  const classification=process.env.WELTRAUM_HVP_MEASURE_CLASS??"diagnostic";
  if(classification!=="measurement"&&classification!=="diagnostic"){throw new Error("Invalid measurement class");}
  const executablePath=process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
  if(!executablePath||!(await stat(executablePath)).isFile()){throw new Error("An explicit installed browser is required");}
  // A populated target is never reused, cleaned or silently mixed with older runs.
  await mkdir(directory,{recursive:true});if((await readdir(directory)).length!==0){throw new Error("Measurement directory is not fresh");}
  const source=await inventory("src"),build=await inventory("dist");
  const fixture=await Promise.all(["tests/performance/hvp-performance.spec.ts","tests/performance/hvp-workloads.ts","playwright.performance.config.ts","tests/e2e/hvp-performance-evidence.ts"]
    .map(async p=>({path:p,sha256:sha(await readFile(p))})));
  const adapters=JSON.parse(shell("Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate,CurrentHorizontalResolution | ConvertTo-Json -Compress")) as {Name:string;DriverVersion:string;CurrentRefreshRate:number;CurrentHorizontalResolution:number}[];
  const power=()=>shell("powercfg /getactivescheme")+" / "+shell("Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object PowerOnline,Charging,Discharging | ConvertTo-Json -Compress");
  const powerState=power();
  const launchArgs=["--force-device-scale-factor=1"];
  const launch=()=>playwright.chromium.launch({executablePath,headless:false,args:launchArgs});
  const probe=await launch();let gpu:string,browserVersion:string;
  try{const page=await probe.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await page.bringToFront();
    await page.goto(measurementUrl(scenario));
    await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
    await page.getByRole("button",{name:"C04-WIDE",exact:true}).click();
    const observed=await observeGpu(page);
    await writeFile(path.join(directory,"probe.json"),JSON.stringify({observed,browserVersion:probe.version(),url:page.url()},null,2));
    if(observed.visible!=="visible"||!observed.focused||observed.dpr!==1||observed.cssWidth!==1280||observed.cssHeight!==720
      ||observed.bufferWidth!==1280||observed.bufferHeight!==720){throw new Error(`Product probe is not foreground 1280x720/DPR1: ${JSON.stringify(observed)}`);}
    gpu=observed.gpu;browserVersion=probe.version();
  }finally{await probe.close();}
  const adapter=adapters.find(a=>gpu.includes(a.Name));if(!adapter){throw new Error(`No actual driver binding for selected renderer: ${gpu}`);}
  const rates=[...new Set(adapters.filter(a=>a.CurrentHorizontalResolution>0&&a.CurrentRefreshRate>1).map(a=>a.CurrentRefreshRate))];
  if(rates.length!==1){throw new Error("Display refresh rate is ambiguous or unavailable");}
  const p:HvpMeasurementPlan={version:"hvp-measurement-v1",profileId:"HVP-DEVICE-01",renderProfile:"HVP-PLAY-720-v1",scenario,
    classification,repetitions:classification==="measurement"?5:3,warmupMs:classification==="measurement"?30_000:10_000,measurementMs:classification==="measurement"?120_000:30_000,
    width:1280,height:720,dpr:1,trace:false,screenshots:false,syntheticHardwareProfile:false,fixtureKind:"normal-product-route",
    fixtureSha256:sha(JSON.stringify(fixture)),commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim()!=="",
    sourceSha256:sha(JSON.stringify(source)),buildSha256:sha(JSON.stringify(build)),lockSha256:sha(await readFile("package-lock.json")),
    wasmSha256:sha(await readFile("node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm")),browser:{version:browserVersion,binarySha256:sha(await readFile(executablePath)),headed:true},
    hardware:{os:`${os.type()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]!.model,ramBytes:os.totalmem(),gpu,driver:adapter.DriverVersion,power:powerState,refreshHz:rates[0]!}};
  const frozen=freezeHvpMeasurement(p),runId=randomUUID();
  await writeFile(path.join(directory,"plan.json"),JSON.stringify({runId,...frozen,source,build,fixture,launchArgs,
    scopes:{coldReadyMs:"bootstrap entry through first completed Ready renderer submission; local worker/WASM loading included, not GPU fence time",navigationReadyMs:"entire document startup through first Ready renderer submission including local asset loading",
      mainCpuMs:"UNSUPPORTED: main-frame callback only excludes asynchronous handlers; values retained as diagnostic",solverStepCpuMs:"each actual World.step, excluding character controller"}},null,2));
  const runs:HvpMeasuredRun[]=[];
  const startupPhases:unknown[]=[];
  for(let index=0;index<p.repetitions;index+=1){
    const browser=await launch();let processIdentity:Awaited<ReturnType<typeof browserProcess>>;
    try{processIdentity=await browserProcess(browser);}catch(error){await browser.close();
      await writeFile(path.join(directory,`process-${index+1}-failure.json`),JSON.stringify({error:String(error),planSha256:frozen.sha256}));throw error;}
    let page:Page|undefined,start=0,end=0,entries:RawEntry[]=[],failure:string|undefined,health:unknown;
    let workload:HvpWorkloadProgress={};
    let origin:number|undefined,documentOrigin:number|undefined,cursor=0,documentIndex=0;
    const healthByDocument=new Map<number,unknown>();
    const now=async()=>{const time=await page!.evaluate(()=>({origin:performance.timeOrigin,now:performance.now()}));origin??=time.origin;return time.now+(time.origin-origin);};
    const collect=async()=>{
      const observed=await page!.evaluate(()=>{
        const disposal=JSON.parse(document.body.dataset.hestiaPrototypeDisposal??"null");
        return {origin:performance.timeOrigin,visible:document.visibilityState,focused:document.hasFocus(),disposal,
          status:JSON.parse(document.body.dataset.hestiaPrototypePhysics??"{}").status,
          health:JSON.parse(document.body.dataset.hestiaPrototypeMeasurements??"null")??disposal?.measurementHealth,
          raw:(window as unknown as {hvpRawMeasurements?:()=>{entries:RawEntry[];dropped:number}}).hvpRawMeasurements?.()};
      });
      if(!observed.raw){throw new Error("Raw measurement observer missing in document");}
      origin??=observed.origin;
      if(documentOrigin!==observed.origin){
        documentOrigin=observed.origin;cursor=0;documentIndex+=1;
        if(!observed.disposal){const actual=await observeGpu(page!);if(actual.gpu!==p.hardware.gpu||actual.dpr!==1
          ||actual.cssWidth!==1280||actual.cssHeight!==720||actual.bufferWidth!==1280||actual.bufferHeight!==720){throw new Error("Document changed frozen render profile");}}
      }
      for(const e of observed.raw.entries.slice(cursor)){
        if(entries.length>=1_000_000){throw new Error("Raw run observation budget exhausted");}
        entries.push({...e,documentTimeOrigin:observed.origin,originalStartMs:e.start,start:e.start+(observed.origin-origin),
          detail:e.detail?{...e.detail,sampleId:e.detail.sampleId===undefined?undefined:`d${documentIndex}:${e.detail.sampleId}`}:null});
      }
      cursor=observed.raw.entries.length;healthByDocument.set(documentIndex,observed.health);health=[...healthByDocument.values()];
      if(observed.raw.dropped||observed.health?.errors||observed.health?.dropped){throw new Error("Timing samples lost or unsupported");}
      if(observed.visible!=="visible"||!observed.focused){throw new Error("Measurement lost foreground");}
      if(observed.status!=="Running"&&!(scenario==="PERF-05"&&observed.disposal?.state==="Disposed")){
        throw new Error(`Game failure: ${observed.status}; ${JSON.stringify(observed.disposal)}`);
      }
    };
    try{
      page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await page.bringToFront();
      if(browser.version()!==p.browser.version||power()!==powerState){throw new Error("Frozen browser/power profile changed");}
      await page.addInitScript(()=>{
        const entries:unknown[]=[];let dropped=0;
        const observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){
          if(!e.name.startsWith("hvp.")){continue;}if(entries.length===100_000){dropped+=1;continue;}
          entries.push({name:e.name,start:e.startTime,duration:e.duration,detail:(e as PerformanceMeasure).detail});
        }});observer.observe({type:"measure"});
        Object.defineProperty(window,"hvpRawMeasurements",{value:()=>({entries:[...entries],dropped}),writable:false});
      });
      const runtimeErrors:string[]=[];page.on("pageerror",e=>runtimeErrors.push(e.message));
      page.on("console",e=>{if(e.type()==="error"){runtimeErrors.push(e.text());}});
        await page.goto(measurementUrl(scenario));
       origin=await page.evaluate(()=>performance.timeOrigin);
      await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
      await page.getByRole("button",{name:"C04-WIDE",exact:true}).click();
      const actual=await observeGpu(page);
      if(actual.gpu!==p.hardware.gpu||actual.visible!=="visible"||!actual.focused||actual.dpr!==1||actual.cssWidth!==1280||actual.cssHeight!==720
        ||actual.bufferWidth!==1280||actual.bufferHeight!==720){throw new Error(`Frozen GPU/foreground profile mismatch: ${JSON.stringify(actual)}`);}
      await prepareHvpWorkload(page,scenario);
      await page.waitForTimeout(p.warmupMs);start=await now();
      workload=await runHvpWorkload(page,scenario,p.measurementMs,workload,collect);
      const elapsed=await now()-start;
      if(elapsed<p.measurementMs){await page.waitForTimeout(p.measurementMs-elapsed);}
      end=await now();await collect();
      if(runtimeErrors.length){throw new Error(`Game failure: ${runtimeErrors.join("; ")}`);}
    }catch(error){failure=String(error);if(page){end=await now().catch(()=>end);if(start===0){start=end;}
      try{await collect();}catch{/* Keep original failure and every previously collected document. */}}}
    finally{await browser.close();}
    const samples:HvpRawSample[]=[],gauges:NonNullable<HvpMeasuredRun["gauges"]>=[];
    for(const e of entries){
      const metric=e.name.slice(4),phase=e.start<start?"warmup":e.start<=end?(classification==="measurement"?"measurement":"diagnostic"):undefined;
      if(!phase){continue;}
      if(metric==="resources"&&e.start>=start){gauges.push({atMs:e.start,...e.detail!.data as Omit<(typeof gauges)[number],"atMs">});continue;}
      if(["coldReadyMs","frameIntervalMs","solverStepCpuMs","mainFrameCpuMs"].includes(metric)){
        samples.push({atMs:e.start,phase:metric==="coldReadyMs"?"cold":phase,metric:metric==="mainFrameCpuMs"?"mainCpuMs":metric as HvpRawSample["metric"],
          value:e.duration,sampleId:e.detail?.sampleId,...(metric==="mainFrameCpuMs"?{disposition:"unsupported" as const}:{})});
      }
    }
    const run:HvpMeasuredRun={id:`${runId}-${index+1}`,...processIdentity,planSha256:frozen.sha256,result:failure?"game-failure":"completed",
      measurementStartMs:start,measurementEndMs:end,trace:false,screenshots:false,samples,operations:[],gauges,...workload,failures:failure?[failure]:[]};
    runs.push(run);await writeFile(path.join(directory,`run-${index+1}.json`),JSON.stringify({run,health,raw:entries}));
    startupPhases.push({id:run.id,...processIdentity,result:run.result,phases:entries.filter(e=>e.name.startsWith("hvp.startup")||["hvp.bootstrapReadyMs","hvp.coldReadyMs","hvp.navigationReadyMs"].includes(e.name))
      .map(e=>({name:e.name,startMs:e.start,durationMs:e.duration}))});
    console.log(`HVP ${classification} process ${index+1}/${p.repetitions}: ${failure??"collected"}`);
  }
  const report=assessHvpRuns(p,frozen.sha256,runs);
  await writeFile(path.join(directory,"startup-phases.json"),JSON.stringify({planSha256:frozen.sha256,runs:startupPhases},null,2));
  await writeFile(path.join(directory,"startup-phase-summary.json"),JSON.stringify({planSha256:frozen.sha256,runs:startupPhases.map(value=>{
    const run=value as {id:string;phases:{name:string;durationMs:number}[]};const totals:Record<string,{count:number;totalMs:number;maxMs:number}>={};
    for(const e of run.phases){const t=totals[e.name]??={count:0,totalMs:0,maxMs:0};t.count+=1;t.totalMs+=e.durationMs;t.maxMs=Math.max(t.maxMs,e.durationMs);}
    return {id:run.id,totals};})},null,2));
  await writeFile(path.join(directory,"report.json"),JSON.stringify(report,null,2));
  expect(runs.every(r=>r.result==="completed"),JSON.stringify(report)).toBe(true);
  if(classification==="measurement"){expect(report.status).toBe("TARGETS_PASSED");}
});
