import {test, expect, type Browser, type Page} from "@playwright/test";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile, realpath, stat} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {Quaternion, Vector3} from "three";
import {readHvpPrivateUploadCpu,assessHvpPrivateUploadCpu} from "./hvpPrivateUploadCpu";
import type {HvpPhysicsClock, HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import {HVP_PLAYER_PROFILE} from "../../src/hestia-prototype/physics/profile";
import {HVP_PLAYER_SHAFT,HVP_ROCK_ARM} from "../../src/hvp/hvpCoastSource";
import type {HvpGameCheckpoint} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import type {createHvpPlasmaTool} from "../../src/hestia-prototype/terrain/plasmaTool";
import {createHvpCutRtEvidenceDirectory, describeHvpCutRtFailure, projectHvpCutRtOperationFailure, inventoryHvpCutRtFiles, isHvpCutHealthFresh,
  persistHvpCutRtReport, planHvpCutRtSeries, projectHvpCutRtGpuInfo, readHvpBodyHoldForCommand, readHvpCutMarkers, summarizeHvpCuts, writeHvpCutRtArtifact,verifyHvpCutProductBinding,
  summarizeHvpCutRtSessions, type HvpCutRawEntry, type HvpCutSample, type HvpCutRtAttemptRecord, type HvpCutRtVariant,
  type HvpCutRtFailureStage} from "./hvpCutRtReport";

type Variant = HvpCutRtVariant;
type ToolState = ReturnType<ReturnType<typeof createHvpPlasmaTool>["read"]>;
type Snapshot = {
  origin: number; now: number; root: number; digest: string; physics: HvpPhysicsSnapshot; clock: HvpPhysicsClock | null;
  tool: ToolState; camera: {orientation: number[]} | null; save: {state: string; revision: number};
  health: {enabled: boolean; errors: number; dropped: number; cutObservation: {status: string; drops: number};
    timingSinkFailures: number|null; publishedOrigin: number; publishedAt: number};
  resources: {totalCpuBytes: number; ledger: {triangles: number; drawCalls: number; retainedMeshBytes: number};
    caps: {maxCpuBytes: number; maxMeshBytes: number; maxTriangles: number; maxDrawCalls: number}};
  visible: string; focused: boolean; locked: boolean; testBridge: boolean; inputError: string | null; pauseDialogOpen: boolean;
};
type Raw = {entries: HvpCutRawEntry[]; dropped: number};
type CleanupEvidence={state:"IN_PROGRESS"|"PROVEN"|"UNPROVEN";samples:unknown[];raw:Raw;truncatedSamples:number;failure?:ReturnType<typeof describeHvpCutRtFailure>};
type CutResult = {sample: HvpCutSample | null; before: Snapshot | null; after: Snapshot | null;
  raw: Raw; problems: string[]; phase: string; commandId: string | null;
  privateUploadCpu?:ReturnType<typeof readHvpPrivateUploadCpu>;
  failure?:ReturnType<typeof projectHvpCutRtOperationFailure>;
  feedbackNotStarted?:true;
  feedback?:{origin:number;events:{at:number;frame:number|null;text:string;visible:boolean}[];dropped:number}};
const baseUrl = process.env.WELTRAUM_HVP_BASE_URL??"http://127.0.0.1:5173";
const app = fileURLToPath(new URL("../..", import.meta.url));
const pwsh = "C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe";
const git = "C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
const powercfg = "C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hestia-parallel-coordination-20261002/P06-reference-active-plan-powercfg-readonly-20261004-r01/tools/powercfg.exe";
const underSourceCode = (file: string) => {
  const relative = path.relative("C:/IFI_SourceCode", file);
  return path.isAbsolute(file) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const shell = (command: string) => execFileSync(pwsh, ["-NoProfile", "-NonInteractive", "-Command", command],
  {cwd: app, encoding: "utf8", timeout: 20_000, windowsHide: true}).trim();
const power = () => execFileSync(powercfg, ["/getactivescheme"],
  {cwd: app, encoding: "utf8", timeout: 20_000, windowsHide: true}).trim();
const powerSource = () => shell("Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object PowerOnline,Charging,Discharging | ConvertTo-Json -Compress");
const read = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
  origin: performance.timeOrigin, now: performance.now(), root: Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
  digest: document.body.dataset.hestiaPrototypeSourceDigest!, physics: JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
  clock: JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock ?? "null"), tool: JSON.parse(document.body.dataset.hestiaPrototypeTool!),
  camera: JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "null"), save: JSON.parse(document.body.dataset.hestiaPrototypeSave ?? "null"),
  health: JSON.parse(document.body.dataset.hestiaPrototypeMeasurements ?? "null"), resources: JSON.parse(document.body.dataset.hestiaPrototypeResources!),
  visible: document.visibilityState, focused: document.hasFocus(), locked: document.pointerLockElement?.id === "debug-scene", testBridge: "TestBridge" in window,
  inputError: document.body.dataset.hestiaPrototypeInputError ?? null,
  pauseDialogOpen: document.querySelector("#hvp-player-pause")?.hasAttribute("open") ?? false
}));
const drain = (page: Page): Promise<Raw> => page.evaluate(() => {
  const collect = (window as unknown as {hvpCutRtDrain?: () => Raw}).hvpCutRtDrain;
  if (!collect) { throw new Error("Cut observation collector missing"); }
  return collect();
});
const installCollector = (page: Page) => page.addInitScript(() => {
  const entries: HvpCutRawEntry[] = [];
  let dropped = 0;
  const collect = (values: PerformanceEntry[]) => {
    for (const entry of values) {
      if (!entry.name.startsWith("hvp.cut") && !entry.name.startsWith("hvp.startup") && !entry.name.endsWith("ReadyV2Ms")
        && entry.name !== "hvp.frameIntervalMs" && entry.name !== "hvp.mainFrameCpuMs"
        && entry.name !== "hvp.solverStepCpuMs" && entry.name !== "hvp.physicsTimerGapMs"
        && entry.name !== "hvp.runtimePresentationPublishCpuMs" && entry.name !== "hvp.runtimePrivateUploadCommitCpuMs"
        && entry.name !== "hvp.runtimeProjectionSnapshotCpuMs" && entry.name !== "hvp.runtimeVisibilityPlanBuildCpuMs"
        && entry.name !== "hvp.runtimeVisibilityPlanDispatchCpuMs"
        && entry.name !== "hvp.runtimeProjectionSignatureCpuMs" && entry.name !== "hvp.runtimeProjectionCameraMapCpuMs"
        && entry.name !== "hvp.runtimeProjectionSceneApplyCpuMs"
        && entry.name !== "hvp.runtimeSceneAdmissionFailure"
        && entry.name !== "hvp.runtimeCutObservationBudgetDisabled"
        && entry.name !== "hvp.runtimeNeighborPrimaryCopyMs" && entry.name !== "hvp.runtimeNeighborEastCopyMs"
        && entry.name !== "hvp.runtimeNeighborInputDigestMs" && entry.name !== "hvp.runtimeNeighborWorkerWaitMs"
        && entry.name !== "hvp.runtimeNeighborDecodeMs"
        && entry.name !== "hvp.runtimePlainMaterialAcquireCpuMs" && entry.name !== "hvp.runtimePrepareThreeMeshCpuMs"
        && entry.name !== "hvp.runtimeRepresentationAddCpuMs" && entry.name !== "hvp.runtimeRegistryCommitCpuMs"
        && entry.name !== "hvp.resources") { continue; }
      if (entries.length >= 8192) { dropped += 1; continue; }
      entries.push({name: entry.name, start: entry.startTime, duration: entry.duration, detail: (entry as PerformanceMeasure).detail});
    }
  };
  const observer = new PerformanceObserver(list => collect(list.getEntries()));
  observer.observe({type: "measure"});
  Object.defineProperty(window, "hvpCutRtDrain", {value: () => {
    collect(observer.takeRecords());
    const result = {entries: entries.splice(0), dropped}; dropped = 0; return result;
  }});
});
const ready = async (page: Page, url: string) => {
  await page.goto(new URL(url,baseUrl).href); await page.bringToFront();
  await expect.poll(async()=>{
    const failure=page.locator("#hvp-error-detail");
    if(await failure.count()){throw new Error((await failure.textContent())??"HVP initialization failure");}
    const state=page.locator("#hvp-state");return await state.count()?await state.textContent():"Loading";
  },{timeout:30_000}).toContain("State: Ready");
};
const enterInspection = async (page: Page) => {
  const control = page.getByRole("button", {name: "Zur Inspektionsansicht", exact: true});
  if ((await read(page)).locked) { await page.keyboard.press("Escape");await expect(control).toBeVisible({timeout:10_000}); }
  if (await control.isVisible()) { await control.click({timeout:10_000}); }
  await expect.poll(async()=>(await read(page)).pauseDialogOpen,{timeout:10_000}).toBe(false);
};
const inspect = async (page: Page) => {
  await enterInspection(page);
  await expect.poll(async () => (await read(page)).physics.status, {timeout: 10_000}).toBe("Paused");
};
const endSession=async(page:Page,cleanup?:CleanupEvidence)=>{
  const deadline=Date.now()+30_000;
  const remaining=()=>{const value=deadline-Date.now();if(value<=0){throw new Error("Cleanup budget expired");}return value;};
  const capture=async(stage:string)=>{
    const state=await page.evaluate(stage=>{
      const value=(key:string)=>JSON.parse(document.body.dataset[key]??"null"),neighbor=value("hestiaPrototypeNeighbor"),dormancy=value("hestiaPrototypeDormancy"),
        physics=value("hestiaPrototypePhysics"),save=value("hestiaPrototypeSave");
      return {stage,origin:performance.timeOrigin,at:performance.now(),busy:!!(neighbor?.busy||dormancy?.busy),
        mounted:physics!==null&&(document.querySelector("#hvp-state")?.textContent?.includes("State: Ready")??false),
        neighbor:neighbor&&{state:neighbor.state,busy:neighbor.busy,recoveryHold:neighbor.recoveryHold,error:!!neighbor.error},
        dormancy:dormancy&&{state:dormancy.state,busy:dormancy.busy,recoveryHold:dormancy.recoveryHold,error:!!dormancy.error},
        physics:physics&&{status:physics.status,bodyCount:physics.bodyCount,colliderCount:physics.colliderCount,
          neighborTransaction:physics.neighborTransaction,bodyResidencyTransaction:physics.bodyResidencyTransaction},
        save:save&&{state:save.state,endBusyRejected:save.state==="Rejected"&&save.message==="Laufenden Vorgang vor dem Beenden abwarten"},
        health:value("hestiaPrototypeMeasurements"),disposal:value("hestiaPrototypeDisposal"),ownedRender:value("hestiaPrototypeOwnedRender"),
        ended:document.querySelector("#hvp-ended")?.textContent?.includes("Hestia-Sitzung beendet")??false};
    },stage);
    const batch=await drain(page);
    if(cleanup){
      const room=Math.max(0,8192-cleanup.raw.entries.length);cleanup.raw.entries.push(...batch.entries.slice(0,room));
      cleanup.raw.dropped+=batch.dropped+Math.max(0,batch.entries.length-room);
      if(cleanup.samples.length<64){cleanup.samples.push(state);}else{cleanup.samples[63]=state;cleanup.truncatedSamples+=1;}
    }
    return state;
  };
  const waitIdle=async()=>{await expect.poll(async()=>!(await capture("waiting-idle")).busy,
    {timeout:remaining(),intervals:[100,200,500]}).toBe(true);};
  if(cleanup){
    await capture("initial");
    await expect.poll(async()=>(await capture("waiting-mount")).mounted,{timeout:remaining(),intervals:[100,200,500]}).toBe(true);
  }
  await enterInspection(page);
  if(cleanup){await waitIdle();}
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click({timeout:cleanup?remaining():10_000});
  if(cleanup){
    const state=await capture("post-click");
    if(!state.ended&&state.save?.endBusyRejected&&state.busy){await waitIdle();
      await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click({timeout:remaining()});await capture("post-retry");}
    await expect.poll(async()=>(await capture("waiting-ended")).ended,{timeout:remaining(),intervals:[100,200,500]}).toBe(true);
  }else{await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet",{timeout:30_000});}
  const receipt=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeDisposal!));
  expect(receipt.state).toBe("Disposed");expect(receipt.errors).toEqual([]);
  expect(Object.values(receipt.disposed).every(value=>value===0)).toBe(true);
  if("coldRecipeRetainedBytes"in receipt){expect(receipt.coldRecipeRetainedBytes).toBe(0);}
  if(cleanup){
    await capture("final");expect(cleanup.raw.dropped).toBe(0);expect(receipt.cacheBytes).toBe(0);
    expect(receipt.native).toMatchObject({status:"Disposed",bodies:0,colliders:0});
    expect(receipt.measurementHealth).toMatchObject({errors:0,dropped:0,cutObservation:{drops:0}});
    cleanup.state="PROVEN";
  }return receipt;
};
const submittedDrawFailure=async(page:Page,candidate:boolean)=>{
  const variant:Variant={id:"rock-arm",scenario:"rock-arm",mode:2,motion:"static"},token="HVP_CONTROLLED_DRAW_AFTER_APPLIED";
  const pageErrors:string[]=[],onError=(error:Error)=>pageErrors.push(error.message);page.on("pageerror",onError);
  const record:{classification:string;phase:string;before:Snapshot|null;inspection:{at:number;origin:number;locked:boolean;physicsStatus:HvpPhysicsSnapshot["status"];endVisible:boolean}|null;trigger:unknown;raw:Raw;disposal:unknown;errors:string[];problems:string[]}={
    classification:"MANUALLY_PAUSED_CONTROLLED_ACTUAL_WEBGL_DRAW_EXCEPTION_NOT_SUCCESSFUL_CUT",before:null,inspection:null,trigger:null,
    phase:"prepare",raw:{entries:[],dropped:0},disposal:null,errors:pageErrors,problems:[]};
  try{
    await prepareCut(page,variant);await drain(page);record.before=await read(page);
    const previous=record.before.tool.last,previousId=previous?("id"in previous?previous.id:previous.commandId):null;
    expect(await page.evaluate(({token,previousId})=>{
      const canvas=document.querySelector<HTMLCanvasElement>("#debug-scene"),gl=canvas?.getContext("webgl2")??canvas?.getContext("webgl");
      if(!gl){throw new Error("Actual WebGL context missing");}
      const original=gl.drawElements,descriptor=Object.getOwnPropertyDescriptor(gl,"drawElements");let fired=false;
      const restore=()=>{
        if(descriptor){Object.defineProperty(gl,"drawElements",descriptor);}else{Reflect.deleteProperty(gl,"drawElements");}
        Reflect.deleteProperty(gl,"hvpCutDrawFaultRestore");
      };
      const draw=function(this:WebGLRenderingContext|WebGL2RenderingContext,...args:Parameters<typeof original>){
        const last=JSON.parse(document.body.dataset.hestiaPrototypeTool??"{}").last,id=last?.id??last?.commandId;
        if(!fired&&last?.status==="Applied"&&typeof id==="string"&&id!==previousId){
          fired=true;restore();
          document.body.dataset.hestiaDrawFaultProbe=JSON.stringify({token,commandId:id,at:performance.now(),origin:performance.timeOrigin,count:1});
          throw new Error(token);
        }
        return original.apply(this,args);
      };
      Object.defineProperty(gl,"hvpCutDrawFaultRestore",{value:restore,configurable:true});
      Object.defineProperty(gl,"drawElements",{value:draw,writable:true,configurable:true});return gl.drawElements===draw;
    },{token,previousId})).toBe(true);
    record.phase="GL-trigger";await page.mouse.down();await page.mouse.up();
    record.phase="GL-inspection";await inspect(page);
    const end=page.getByRole("button",{name:"Sitzung beenden",exact:true});await expect(end).toBeVisible({timeout:10_000});
    record.inspection=await end.evaluate(button=>{
      const bounds=button.getBoundingClientRect(),style=getComputedStyle(button);
      return {at:performance.now(),origin:performance.timeOrigin,locked:document.pointerLockElement?.id==="debug-scene",
        physicsStatus:JSON.parse(document.body.dataset.hestiaPrototypePhysics!).status as HvpPhysicsSnapshot["status"],
        endVisible:bounds.width>0&&bounds.height>0&&style.display!=="none"&&style.visibility!=="hidden"};
    });
    expect(record.inspection).toMatchObject({origin:record.before.origin,locked:false,physicsStatus:"Paused",endVisible:true});
    await expect.poll(async()=>{
      const batch=await drain(page);record.raw.entries.push(...batch.entries);record.raw.dropped+=batch.dropped;
      return page.evaluate(()=>document.body.dataset.hestiaDrawFaultProbe??null);
    },{timeout:30_000}).not.toBeNull();
    record.trigger=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaDrawFaultProbe!));
    expect(record.trigger).toMatchObject({token,count:1,origin:record.before.origin});
    expect(record.inspection.at).toBeLessThan((record.trigger as {at:number}).at);
    if(candidate){
      await expect(page.locator("#hvp-failure")).toBeVisible({timeout:30_000});
      record.disposal=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeDisposal!));
      expect(record.disposal).toMatchObject({state:"Disposed",errors:[],frameError:`Error: ${token}`});expect(pageErrors).toEqual([]);
    }else{
      await expect.poll(()=>pageErrors.filter(value=>value===token).length).toBe(1);
      expect(pageErrors).toEqual([token]);record.phase="GL-end";record.disposal=await endSession(page);
    }
    const receipt=record.disposal as {disposed:Record<string,unknown>;coldRecipeRetainedBytes?:unknown};expect(Object.values(receipt.disposed).every(value=>value===0)).toBe(true);
    if("coldRecipeRetainedBytes"in receipt){expect(receipt.coldRecipeRetainedBytes).toBe(0);}
    const batch=await drain(page);record.raw.entries.push(...batch.entries);record.raw.dropped+=batch.dropped;expect(record.raw.dropped).toBe(0);
    const trigger=record.trigger as {commandId:string},markers=readHvpCutMarkers(record.raw.entries,trigger.commandId,false);
    expect(markers.inputMs).not.toBeNull();expect(markers.appliedMs).not.toBeNull();expect(markers.firstCommittedRenderSubmitMs).toBeNull();
    return record;
  }catch(error){
    record.problems.push(describeHvpCutRtFailure("attempt",error));
    try{const batch=await drain(page);record.raw.entries.push(...batch.entries);record.raw.dropped+=batch.dropped;}
    catch(capture){record.problems.push(describeHvpCutRtFailure("artifact",capture));}
    return record;
  }finally{
    try{if(!page.isClosed()){await page.evaluate(()=>{
      const canvas=document.querySelector<HTMLCanvasElement>("#debug-scene"),gl=canvas?.getContext("webgl2")??canvas?.getContext("webgl");
      (gl as (WebGLRenderingContext&{hvpCutDrawFaultRestore?:()=>void})|null)?.hvpCutDrawFaultRestore?.();
    });}}catch(error){record.problems.push(describeHvpCutRtFailure("page-cleanup",error));}
    page.off("pageerror",onError);
  }
};
const normalNativeContacts=async(page:Page,wake=false,residentEastRestore?:{url:string;save:(page:Page)=>Promise<string>})=>{
  const raw:Raw={entries:[],dropped:0},samples:unknown[]=[],picks:Array<{label:string;player:unknown;hit:unknown}>=[],problems:string[]=[];
  const record={classification:wake?"NORMAL_UI_PARK_WAKE_SUPPLEMENT_NOT_CUT_POPULATION":"NORMAL_UI_NATIVE_CONTACT_SUPPLEMENT_NOT_CUT_POPULATION",samples,picks,raw,problems,
    phase:"initial",dropCrossesY4:false,disposal:null as unknown,failure:null as null|{phase:string;message:string},
    residentEastColdLoad:null as null|{classification:string;phase:string;before:Snapshot;after:Snapshot|null;ready:Raw;raw:Raw;
      saved:string;resaved:string|null;samples:Snapshot[];hit:unknown;recut:CutResult|null;disposal:unknown}};
  const sample=async()=>{
    const state=await read(page);if(samples.length===128){throw new Error("Contact observation overflow");}
    expect(state).toMatchObject({testBridge:false,visible:"visible",focused:true});expect(state.health.errors).toBe(0);expect(state.health.dropped).toBe(0);
    expect(state.physics.bodyResidencyTransaction).not.toBe("RecoveryHold");
    const neighborResidency=await page.evaluate(()=>{
      const value=JSON.parse(document.body.dataset.hestiaPrototypeNeighbor??"null");if(!value){return null;}
      const error=typeof value.error==="string"?value.error:"";
      const known=[
        ["NeighbourLineage","Owned neighbour chunk lineage required"],["EastCoverage","Invalid east chunk coverage"],
        ["NeighbourLifetime","Neighbour chunk lifetime pending"],["ChunkCacheCoverage","Incomplete chunk cache coverage"],
        ["ChunkCollisionCoverage","Incomplete chunk collision cache coverage"],["EastCollisionCoverage","Incomplete chunk neighbour coverage"],
        ["EastProductsCoverage","Incomplete neighbour collision products"],["StaleNeighbourChunks","Cancelled stale neighbour chunks"],
        ["DerivativeBudget","Terrain derivative phase budget exhausted"],["ChunkPrepareEnvelope","Chunk Prepare envelope exhausted"],
        ["NeighborCacheLease","Invalid neighbour cache lease"],["WorldPending","World Pending"]
      ];
      return {state:value.state,epoch:value.epoch,wanted:value.wanted,collisionReady:value.collisionReady,busy:value.busy,recoveryHold:value.recoveryHold,loadOperation:value.loadOperation??"Unavailable",
        sourceBytes:value.sourceBytes,cacheBytes:value.cacheBytes,errorPresent:error.length>0,
        errorClass:known.find(([,prefix])=>error===prefix||error.startsWith(`Error: ${prefix}`))?.[0]??(error.includes("BudgetExceeded")?"BudgetExceeded":error.length>0?"Other":"None")};
    });
    samples.push({phase:record.phase,at:state.now,root:state.root,digest:state.digest,tick:state.physics.ticks,status:state.physics.status,player:state.physics.player,
      clock:state.clock,
      bodies:state.physics.bodies,parked:state.physics.parked,bodyResidencyTransaction:state.physics.bodyResidencyTransaction,
      bodyCount:state.physics.bodyCount,colliderCount:state.physics.colliderCount,neighbor:state.physics.neighbor,
      neighborResidency,resources:state.resources,saveState:state.save?.state,
      input:await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeInput??"null")),
      neighborAdmission:await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeNeighborAdmission??"null")),
      residency:await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeBodyResidency??"null")),
      impulse:state.physics.impulseTarget,lastImpulse:state.physics.lastImpulse,inertia:state.physics.inertia});
    const batch=await drain(page);raw.entries.push(...batch.entries);raw.dropped+=batch.dropped;expect(raw.dropped).toBe(0);return state;
  };
  let cursor={x:640,y:360};
  const normalPlay=async()=>{const box=await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).boundingBox();
    if(!box){throw new Error("Normal play control missing");}cursor={x:box.x+box.width/2,y:box.y+box.height/2};await play(page);};
  const aim=async(desired:Vector3)=>{
    for(let i=0;i<8;i++){const state=await read(page);if(!state.camera){throw new Error("Normal camera observation missing");}
      const forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(state.camera.orientation));if(forward.dot(desired)>.999){return;}
      const yaw=Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z);
      cursor.x-=Math.atan2(Math.sin(yaw),Math.cos(yaw))/.002;cursor.y+=(Math.asin(forward.y)-Math.asin(desired.y))/.002;
      await page.mouse.move(cursor.x,cursor.y);await expect.poll(async()=>(await read(page)).physics.ticks).toBeGreaterThan(state.physics.ticks);
    }throw new Error("Normal mouse aim did not converge");
  };
  const pick=async(label:string)=>{
    await aim(new Vector3(0,-.95,.2).normalize());await expect.poll(async()=>(await read(page)).physics.impulseTarget?.kind).toBe("Fixed");
    const state=await sample(),hit=state.physics.impulseTarget!;expect(hit.point).not.toBeNull();expect(hit.distanceMeters).toBeLessThanOrEqual(4);
    picks.push({label,player:state.physics.player,hit});await aim(new Vector3(0,0,1));
  };
  const walk=async(key:string,axis:"x"|"z",target:number,greater:boolean,pulseMs=0)=>{
    record.phase=`walk:${key}:${axis}:${target}`;
    const before=(await read(page)).physics.player!.position[axis];
    if(wake&&(greater?before>target:before<target)){
      await expect.poll(async()=>(await read(page)).physics.player?.grounded).toBe(true);await sample();return;
    }
    expect(greater?before<target:before>target).toBe(true);
    if(!pulseMs){await page.keyboard.down(key);}
    try{await expect.poll(async()=>{if(pulseMs){const current=(await read(page)).physics.player!.position[axis];
        if(!(greater?current>target:current<target)){await page.keyboard.press(key,{delay:pulseMs});}}
      const state=await sample();if(state.physics.status!=="Running"){
        const residency=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeBodyResidency??"null"));
        if(!wake||state.physics.status!=="Paused"||!["PreparedHeld","CommittedHeld"].includes(state.physics.bodyResidencyTransaction)
          ||!residency?.busy||residency.recoveryHold||residency.error){throw new Error("Native contact walk stopped");}
      }
      const value=state.physics.player!.position[axis];return greater?value>target:value<target;},{timeout:15_000,intervals:pulseMs?[50]:wake?[100,200,300]:[50,100,150]}).toBe(true);}
    finally{await page.keyboard.up(key);}
    await expect.poll(async()=>(await read(page)).physics.player?.grounded).toBe(true);await sample();
  };
  try{
    if(wake){
      await inspect(page);const before=await sample(),fragment=before.physics.terrainFragments[0]!;
      const body=before.physics.bodies.find(value=>value.ownerId===fragment.ownerId)!;expect(body.sleeping).toBe(true);
      const player=before.physics.player!.position;expect(player.x).toBeCloseTo(7,1);expect(player.z).toBeCloseTo(-6.25,1);
      record.phase="wake-play";await normalPlay();await aim(new Vector3(0,0,-1));await walk("KeyW","z",-6.5,false);
      record.phase="wake-jump-south";
      await page.keyboard.down("KeyW");
      try{await page.keyboard.press("Space");await expect.poll(async()=>(await sample()).physics.player!.position.z,{timeout:15_000}).toBeLessThan(-7.5);}
      finally{await page.keyboard.up("KeyW");}
      await walk("KeyW","z",-9,false);await aim(new Vector3(1,0,0));await walk("KeyW","x",15.25,true);
      record.phase="wake-neighbor-ready";
      await expect.poll(async()=>{const state=await sample(),neighbor=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeNeighbor??"null"));
        if(neighbor?.error||neighbor?.recoveryHold){throw new Error("Native neighbor graphics failed");}
        return state.physics.neighbor?.resident&&state.physics.neighborTransaction==="Idle"&&neighbor?.collisionReady&&!neighbor?.busy;},{timeout:15_000,intervals:[100,200,500]}).toBe(true);
      const parkBaseline=await sample();expect(parkBaseline.physics.bodies.some(value=>value.ownerId===body.ownerId)).toBe(true);
      await aim(new Vector3(0,0,1));await walk("KeyW","z",14,true);record.phase="wake-park";
      await expect.poll(async()=>(await sample()).physics.parked.some(value=>value.ownerId===body.ownerId)).toBe(true);
      const parked=await sample();expect(parked.root).toBe(before.root);expect(parked.digest).toBe(before.digest);
      expect(parked.physics.bodies.some(value=>value.ownerId===body.ownerId)).toBe(false);
      expect(before.physics.terrainFragments).toHaveLength(1);expect(parked.physics.bodyCount).toBe(parkBaseline.physics.bodyCount-1);
      expect(parked.physics.neighbor).toEqual(parkBaseline.physics.neighbor);
      expect(parked.physics.colliderCount).toBe(parkBaseline.physics.colliderCount-fragment.colliders);
      const checkpointPosition=parked.physics.parked.find(value=>value.ownerId===body.ownerId)!.position;
      expect(Math.hypot(parked.physics.player!.position.x-checkpointPosition.x,parked.physics.player!.position.z-checkpointPosition.z)).toBeGreaterThan(18);
      await expect.poll(()=>page.evaluate(owner=>{
        const state=JSON.parse(document.body.dataset.hestiaPrototypeBodyResidency??"null");
        if(state?.error||state?.recoveryHold){throw new Error("Native park graphics failed");}return !state?.busy&&state?.parkedRenderOwners.includes(owner);
      },body.ownerId)).toBe(true);
      await aim(new Vector3(0,0,-1));await walk("KeyW","z",-9,false);record.phase="wake-restore";
      await expect.poll(async()=>(await sample()).physics.parked.some(value=>value.ownerId===body.ownerId)).toBe(false);
      await expect.poll(()=>page.evaluate(owner=>{
        const state=JSON.parse(document.body.dataset.hestiaPrototypeBodyResidency??"null");
        if(state?.error||state?.recoveryHold){throw new Error("Native wake graphics failed");}return !state?.busy&&!state?.parkedRenderOwners.includes(owner)&&state?.changes>=2;
      },body.ownerId)).toBe(true);
      const awake=await sample();expect(awake.root).toBe(before.root);expect(awake.digest).toBe(before.digest);
      expect(awake.physics.terrainFragments.find(value=>value.ownerId===body.ownerId)).toEqual(fragment);
      expect(awake.physics.bodies.find(value=>value.ownerId===body.ownerId)?.position).toEqual(checkpointPosition);
      expect(awake.physics.neighbor).toEqual(parkBaseline.physics.neighbor);
      expect(awake.physics.bodyCount).toBe(parkBaseline.physics.bodyCount);expect(awake.physics.colliderCount).toBe(parkBaseline.physics.colliderCount);
      expect(Math.hypot(awake.physics.player!.position.x-checkpointPosition.x,awake.physics.player!.position.z-checkpointPosition.z)).toBeLessThan(12);
      if(residentEastRestore){
        record.phase="wake-save-resident-east";
        const saved=await residentEastRestore.save(page),savedState=await read(page);
        expect(savedState.physics.neighbor?.resident).toBe(true);expect(savedState.physics.neighborTransaction).toBe("Idle");
        const savedGame=JSON.parse(saved).player.data.hestia as HvpGameCheckpoint;
        expect(savedGame.neighbor).toBeTruthy();expect(savedGame.world.neighbor?.resident).toBe(true);
        const cold=record.residentEastColdLoad={classification:"CANDIDATE_RESIDENT_EAST_SAVE_COLD_LOAD_NATIVE_SUPPLEMENT_NOT_MAIN_CUT_POPULATION",
          phase:"old-end",before:savedState,after:null,ready:{entries:[],dropped:0},raw:{entries:[],dropped:0},saved,resaved:null,
          samples:[],hit:null,recut:null,disposal:null} as NonNullable<typeof record.residentEastColdLoad>;
        record.disposal=await endSession(page);cold.phase="cold-document";
        await ready(page,residentEastRestore.url);
        await expect.poll(async()=>{const batch=await drain(page);cold.ready.entries.push(...batch.entries);cold.ready.dropped+=batch.dropped;
          return cold.ready.entries.some(entry=>entry.name==="hvp.coldSceneReadyV2Ms");},{timeout:30_000}).toBe(true);
        expect(cold.ready.dropped).toBe(0);cold.after=await read(page);expect(cold.after.origin).not.toBe(savedState.origin);
        expect(sourceFacts(cold.after)).toEqual(sourceFacts(savedState));expect(cold.after.physics.neighbor?.resident).toBe(true);
        expect(cold.after.physics.neighborTransaction).toBe("Idle");
        expect(cold.after.physics.bodyCount).toBe(savedState.physics.bodyCount);expect(cold.after.physics.colliderCount).toBe(savedState.physics.colliderCount);
        const population=cold.ready.entries.filter(entry=>entry.name==="hvp.startupChunkPopulation");expect(population).toHaveLength(1);
        expect(population[0]!.detail?.data).toMatchObject({primaryJobs:256,eastJobs:256});
        cold.phase="cold-resave";cold.resaved=await residentEastRestore.save(page);
        const resavedGame=JSON.parse(cold.resaved).player.data.hestia as HvpGameCheckpoint;
        expect(resavedGame).toEqual(savedGame);
        const coldSample=async()=>{const state=await read(page);if(cold.samples.length===64){throw new Error("Cold East contact observation overflow");}
          expect(state.origin).toBe(cold.after!.origin);expect(state).toMatchObject({testBridge:false,visible:"visible",focused:true});
          expect(state.health.errors).toBe(0);expect(state.health.dropped).toBe(0);
          if(cold.phase==="cold-east-contact"){expect(state.physics.neighbor?.resident).toBe(true);}
          expect(state.physics.bodyResidencyTransaction).not.toBe("RecoveryHold");expect(state.physics.neighborTransaction).not.toBe("RecoveryHold");
          cold.samples.push(state);const batch=await drain(page);cold.raw.entries.push(...batch.entries);cold.raw.dropped+=batch.dropped;
          expect(cold.raw.dropped).toBe(0);return state;};
        cold.phase="cold-east-contact";await normalPlay();await aim(new Vector3(1,0,0));await page.keyboard.down("KeyW");
        try{await expect.poll(async()=>(await coldSample()).physics.player!.position.x,{timeout:15_000,intervals:[200,400,500]}).toBeGreaterThan(17);}
        finally{await page.keyboard.up("KeyW");}
        await expect.poll(async()=>(await coldSample()).physics.player?.grounded,{timeout:15_000,intervals:[200,400,500]}).toBe(true);
        await aim(new Vector3(0,-.95,.2).normalize());
        await expect.poll(async()=>(await read(page)).physics.impulseTarget?.kind).toBe("Fixed");
        const contact=await coldSample();cold.hit=contact.physics.impulseTarget;
        expect(contact.physics.status).toBe("Running");expect(contact.physics.player?.grounded).toBe(true);expect(contact.physics.impulseTarget?.kind).toBe("Fixed");
        expect(contact.physics.impulseTarget!.point!.x).toBeGreaterThan(16);expect(contact.physics.impulseTarget!.distanceMeters).toBeLessThanOrEqual(4);
        cold.phase="cold-return-primary";
        for(const [direction,axis,target,greater] of [[new Vector3(-1,0,0),"x",7,false],[new Vector3(0,0,1),"z",-7.2,true]] as const){
          await aim(direction);let pulsed=false;await page.keyboard.down("KeyW");
          try{await expect.poll(async()=>{if(pulsed){const current=(await read(page)).physics.player!.position[axis];
              if(!(greater?current>target:current<target)){await page.keyboard.press("KeyW",{delay:50});}}
            else{await page.waitForTimeout(150);}
            const value=(await coldSample()).physics.player!.position[axis];
            if(!pulsed&&Math.abs(value-target)<3){await page.keyboard.up("KeyW");pulsed=true;}
            return greater?value>target:value<target;},
            {timeout:15_000,intervals:[50]}).toBe(true);}finally{await page.keyboard.up("KeyW");}
          await expect.poll(async()=>(await coldSample()).physics.player?.grounded,{timeout:15_000,intervals:[200,400,500]}).toBe(true);
        }
        const returned=await coldSample(),restoredBody=returned.physics.bodies.find(value=>value.ownerId===fragment.ownerId)!;
        expect(returned.physics.player!.position.x).toBeGreaterThan(HVP_ROCK_ARM.pillarMaxX);
        expect(Math.hypot(restoredBody.position.x-returned.physics.player!.position.x,restoredBody.position.y-returned.physics.player!.position.y-.75,
          restoredBody.position.z-returned.physics.player!.position.z)).toBeLessThan(4);
        cold.phase="cold-recut-inspection";await inspect(page);
        cold.phase="cold-recut";cold.recut=await cut(page,{id:"body-box-moving",scenario:"body-box",mode:2,motion:"moving"},"cold",true);
        expect(cold.recut.problems).toEqual([]);expect(cold.recut.after!.physics.terrainFragments[0]!.cellCount).toBe(352);
        cold.phase="cold-end";cold.disposal=await endSession(page);cold.phase="complete";return record;
      }
      record.disposal=await endSession(page);return record;
    }
    record.phase="drop";await page.getByRole("button",{name:"Fallkörper neu starten",exact:true}).click();
    await page.getByRole("button",{name:"Physik pausieren",exact:true}).click();await expect.poll(async()=>(await read(page)).physics.status).toBe("Paused");
    const before=await sample(),owner=before.physics.bodies[0]!.ownerId,ys=[before.physics.bodies[0]!.position.y];
    await page.getByRole("button",{name:"Physik fortsetzen",exact:true}).click();
    await expect.poll(async()=>{const state=await sample(),body=state.physics.bodies.find(value=>value.ownerId===owner)!;ys.push(body.position.y);return body.sleeping;},
      {timeout:20_000,intervals:[100,200,300]}).toBe(true);
    expect(Math.min(...ys)).toBeLessThan(ys[0]!-.1);expect(Math.min(...ys)).toBeGreaterThan(-1);record.dropCrossesY4=Math.min(...ys)<4&&Math.max(...ys)>4;
    record.phase="contact-inspection";await page.getByRole("button",{name:"Physik pausieren",exact:true}).click();
    await inspect(page);record.phase="contact-play";await normalPlay();await expect.poll(async()=>(await read(page)).physics.player?.grounded).toBe(true);
    const spawn=(await sample()).physics.player!.position;expect(spawn.x).toBeCloseTo(-9,1);expect(spawn.z).toBeCloseTo(-11,1);
    await pick("spawn");await walk("KeyW","z",-9.8,true);await pick("before-x-minus8");await walk("KeyA","x",-7.6,true);await pick("after-x-minus8");
    await walk("KeyD","x",-12.6,false);await pick("before-z-minus8");await walk("KeyW","z",-7.6,true);await pick("after-z-minus8");
    await walk("KeyS","z",-9.8,false,20);
    expect((await read(page)).physics.player!.position.z).toBeGreaterThan(HVP_PLAYER_SHAFT.maxZ+HVP_PLAYER_PROFILE.radius+HVP_PLAYER_PROFILE.offset);
    await walk("KeyA","x",-9.4,true);await walk("KeyS","z",-10.8,false);
    record.phase="rotated-contact";await inspect(page);await page.getByRole("button",{name:"L-Körper anvisieren (F)",exact:true}).click();await normalPlay();
    await expect.poll(async()=>(await read(page)).physics.impulseTarget?.kind).toBe("Dynamic");const rotated=await sample();
    const body=rotated.physics.bodies.find(value=>value.ownerId==="hvp:physics:inertia")!;expect(Math.abs(body.orientation.y)).toBeGreaterThan(.1);
    expect(Math.hypot(body.position.x-rotated.physics.player!.position.x,body.position.z-rotated.physics.player!.position.z)).toBeLessThan(4);
    await page.keyboard.press("KeyF");await expect.poll(async()=>(await read(page)).physics.lastImpulse?.status).toBe("Applied");
    const pushed=await sample();expect(pushed.physics.lastImpulse?.target).toBe(body.ownerId);
    await expect.poll(async()=>{const state=await sample(),current=state.physics.bodies.find(value=>value.ownerId===body.ownerId)!;
      return Math.hypot(current.position.x-body.position.x,current.position.y-body.position.y,current.position.z-body.position.z);}).toBeGreaterThan(.001);
    await expect.poll(async()=>(await read(page)).physics.bodies.find(value=>value.ownerId===body.ownerId)?.sleeping,{timeout:20_000}).toBe(true);await sample();
    record.phase="contacts-end";record.disposal=await endSession(page);return record;
  }catch(error){record.failure={phase:record.residentEastColdLoad?.phase??record.phase,message:(error instanceof Error?error.message:String(error)).slice(0,4096)};
    problems.push(describeHvpCutRtFailure("attempt",error));try{
    const target=record.residentEastColdLoad&&record.residentEastColdLoad.phase!=="old-end"?record.residentEastColdLoad.raw:raw;
    const batch=await drain(page);target.entries.push(...batch.entries);target.dropped+=batch.dropped;
  }catch{}
    return record;}
};
const play = async (page: Page) => {
  await page.getByRole("button", {name: "Spielen · WASD / Maus / Space", exact: true}).click();
  try { await expect.poll(async () => (await read(page)).locked, {timeout: 10_000}).toBe(true); }
  catch (error) {
    const state = await read(page);
    throw new Error(`Normal play did not lock: ${JSON.stringify({inputError: state.inputError, pauseDialogOpen: state.pauseDialogOpen,
      save: state.save, player: state.physics.player?.status, physics: state.physics.status})}`, {cause: error});
  }
  await expect.poll(async () => (await read(page)).physics.player?.status, {timeout: 10_000}).toBe("Walking");
};
const aimBody = async (page: Page, ownerId: string) => {
  await expect.poll(async () => (await read(page)).camera, {timeout: 10_000}).toBeTruthy();
  const cursor = {x: 640, y: 360};
  for (let i = 0; i < 12; i += 1) {
    const state = await read(page), body = state.physics.bodies.find(value => value.ownerId === ownerId);
    if (!body || !state.physics.player || !state.camera) { throw new Error("Body aim source/pose unavailable"); }
    const eye = new Vector3(state.physics.player.position.x, state.physics.player.position.y + .75, state.physics.player.position.z);
    const desired = new Vector3(body.position.x, body.position.y, body.position.z).sub(eye).normalize();
    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().fromArray(state.camera.orientation));
    if (desired.dot(forward) > .999 && state.physics.moving.preview?.ownerId === ownerId) { break; }
    const yaw = Math.atan2(-desired.x, -desired.z) - Math.atan2(-forward.x, -forward.z);
    cursor.x -= Math.atan2(Math.sin(yaw), Math.cos(yaw)) / .002;
    cursor.y -= (Math.asin(desired.y) - Math.asin(forward.y)) / .002;
    await page.mouse.move(cursor.x, cursor.y);
    await expect.poll(async () => (await read(page)).physics.ticks).toBeGreaterThan(state.physics.ticks);
  }
  await expect.poll(async () => (await read(page)).physics.moving.preview?.ownerId, {timeout: 10_000}).toBe(ownerId);
};
const sourceFacts = (state: Snapshot) => ({root: state.root, digest: state.digest,
  fragments: state.physics.terrainFragments.map(value => ({ownerId: value.ownerId, sourceDigest: value.sourceDigest,
    cellCount: value.cellCount, massKg: value.massKg}))});
const makeCheckpoint = async (page: Page, variant: Variant) => {
  await ready(page, `/?hestiaPrototype=1${variant.scenario === "quarry" ? "" : "&hvpScenario=rock-arm"}`);
  await page.getByRole("button", {name: variant.scenario === "quarry" ? "Ansicht: Schnittstelle" : "Stütze anvisieren (2 + Klick)", exact: true}).click();
  await play(page);
  await expect.poll(async () => (await read(page)).physics.player?.grounded).toBe(true);
  await page.keyboard.press(`Digit${variant.mode}`);
  if (variant.scenario.startsWith("body-")) {
    await page.keyboard.press("Digit2");
    await expect.poll(async () => (await read(page)).tool.message).toContain("Stützzellen");
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(async () => (await read(page)).tool.last?.status, {timeout: 30_000}).toBe("Applied");
    await expect.poll(async () => {
      const state = await read(page), owner = state.physics.terrainFragments[0]?.ownerId;
      return state.physics.bodies.find(body => body.ownerId === owner)?.sleeping;
    }, {timeout: 20_000}).toBe(true);
  }
  await inspect(page);
  const saved = await read(page);
  await page.getByRole("button", {name: "Spielstand speichern", exact: true}).click();
  await expect.poll(async () => (await read(page)).save?.state, {timeout: 30_000}).toBe("Saved");
  return sourceFacts(saved);
};
const prepareCut = async (page: Page, variant: Variant,onStep?:(step:string)=>void) => {
  const bodyCut = variant.scenario.startsWith("body-");
  onStep?.("prepare-aim");
  await page.getByRole("button", {name: variant.scenario === "quarry" ? "Ansicht: Schnittstelle" : "Stütze anvisieren (2 + Klick)", exact: true}).click();
  onStep?.("prepare-play");await play(page);
  onStep?.("prepare-tool");await page.keyboard.press(`Digit${variant.mode}`);
  onStep?.("prepare-grounded");
  await expect.poll(async () => (await read(page)).physics.player?.grounded).toBe(true);
  if (bodyCut) {
    const owner = (await read(page)).physics.terrainFragments[0]?.ownerId;
    if (!owner) { throw new Error("Saved body fixture is missing"); }
    onStep?.("prepare-body-aim");await aimBody(page, owner);
    onStep?.("prepare-body-motion");
    if (variant.motion === "moving") {
      await page.keyboard.press("KeyF");
      await expect.poll(async () => (await read(page)).physics.bodies.find(body => body.ownerId === owner)?.sleeping).toBe(false);
    } else {
      await expect.poll(async () => (await read(page)).physics.bodies.find(body => body.ownerId === owner)?.sleeping).toBe(true);
    }
  } else {
    onStep?.("prepare-preview");
    await expect.poll(async () => (await read(page)).tool.message).toContain(variant.scenario === "quarry" ? "sicherer Steinbruch" : "Stützzellen");
  }
};
const verifyCut = (variant: Variant, before: Snapshot, after: Snapshot, binding: Readonly<Record<string, unknown>> | null) => {
  expect(after.testBridge).toBe(false);
  expect(after.physics.status).toBe("Running");
  expect(after.resources.totalCpuBytes).toBeLessThanOrEqual(after.resources.caps.maxCpuBytes);
  expect(after.resources.ledger.triangles).toBeLessThanOrEqual(after.resources.caps.maxTriangles);
  expect(after.resources.ledger.drawCalls).toBeLessThanOrEqual(after.resources.caps.maxDrawCalls);
  expect(after.resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(after.resources.caps.maxMeshBytes);
  expect(binding).toMatchObject({savedRevision: after.root, savedDigest: after.digest, nativeGeneration: after.root,
    rootIdentityMatches: true, activeKeysMatch: true, visibleKeysMatch: true, nativeGenerationMatches: true, recoveryHold: false});
  if (variant.scenario.startsWith("body-")) {
    const receipt = after.physics.moving.last;
    if (!receipt) { throw new Error("Native moving receipt missing"); }
    expect(after.root).toBe(before.root); expect(after.digest).toBe(before.digest);
    expect(after.physics.moving.state).toBe("Idle"); expect(receipt.status).toBe("Applied");
    expect(after.physics.moving.sequence).toBe(before.physics.moving.sequence + 1);
    expect(after.physics.bodies.some(body => body.ownerId === receipt.parentId)).toBe(false);
    const parent = before.physics.terrainFragments.find(body => body.ownerId === receipt.parentId);
    if (!parent) { throw new Error("Actual measured parent source missing"); }
    const children = receipt.children.map(id => {
      const child = after.physics.terrainFragments.find(body => body.ownerId === id);
      if (!child) { throw new Error("Actual native child missing"); }
      return child;
    });
    expect(children.reduce((sum, child) => sum + child.cellCount, receipt.removedCells)).toBe(parent.cellCount);
    expect(Math.abs(children.reduce((sum, child) => sum + child.massKg, receipt.removedMassKg) - parent.massKg)).toBeLessThanOrEqual(1e-8);
    expect(binding).toMatchObject({bodySequence: after.physics.moving.sequence, parentId: receipt.parentId, outcomeIdentityMatches: true});
    expect(binding?.children).toEqual(children.map(child => expect.objectContaining({ownerId: child.ownerId,
      sourceDigest: child.sourceDigest, renderKey: expect.any(String)})));
    const renderKeys = (binding?.children as {ownerId: string; renderKey: string}[]).map(child => {
      expect(child.renderKey).toMatch(/^hvp:/);
      expect(child.renderKey).not.toBe(child.ownerId);
      return child.renderKey;
    });
    expect(new Set(renderKeys).size).toBe(renderKeys.length);
    expect(binding?.activeBodyKeys).toEqual(expect.arrayContaining(renderKeys));
  } else {
    expect(after.root).toBe(before.root + 1); expect(after.physics.terrainGeneration).toBe(after.root);
    expect(after.physics.terrainTransaction).toBe("Idle");
    expect(after.tool.last?.removedCells).toBeGreaterThan(0); expect(after.tool.last?.removedCells).toBeLessThanOrEqual(512);
    if (variant.scenario === "rock-arm") { expect(after.tool.last?.transferredCells).toBeGreaterThan(0); }
  }
};
const cut = async (page: Page, variant: Variant, temperature: HvpCutSample["temperature"],requirePrivateCpu=false): Promise<CutResult> => {
  const result: CutResult = {sample: null, before: null, after: null, raw: {entries: [], dropped: 0}, problems: [], phase: "precondition", commandId: null};
  const body = variant.scenario.startsWith("body-"), prefix = body ? "hvp.cutBody" : "hvp.cut";
  let feedbackStarted=false;
  try {
    await prepareCut(page, variant,step=>{result.phase=step;});const beforeInput=await drain(page);
    result.phase="precondition";
    const priorFrame=beforeInput.entries.filter(entry=>entry.name==="hvp.mainFrameCpuMs").at(-1);
    if(priorFrame){result.raw.entries.push(priorFrame);}result.raw.dropped+=beforeInput.dropped;
    result.before = await read(page);
    expect(result.before).toMatchObject({visible: "visible", focused: true, locked: true, testBridge: false});
    expect(result.before.health).toMatchObject({enabled: true, errors: 0, dropped: 0, timingSinkFailures:0,
      publishedOrigin:result.before.origin,cutObservation: {status: "armed", drops: 0}});
    if (body) {
      const parent = result.before.physics.bodies.find(value => value.ownerId === result.before!.physics.moving.preview?.ownerId);
      if (!parent) { throw new Error("No actual parent at the measured input"); }
      expect(parent.sleeping).toBe(variant.motion === "sleeping");
    }
    if(process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL){
      await page.evaluate(()=>{
        const node=document.querySelector<HTMLElement>("#hvp-cut-feedback");if(!node){throw new Error("Visible Cut feedback node missing");}
        const events:{at:number;frame:number|null;text:string;visible:boolean}[]=[],frames=new Set<number>();let dropped=0;
        const observer=new MutationObserver(()=>{
          if(events.length===32){dropped++;return;}
          const event={at:performance.now(),frame:null as number|null,text:node.textContent??"",visible:node.getClientRects().length>0};events.push(event);
          const id=requestAnimationFrame(()=>{frames.delete(id);event.frame=performance.now();});frames.add(id);
        });observer.observe(node,{childList:true,characterData:true,subtree:true});
        Object.defineProperty(window,"hvpCutRtFeedbackStop",{configurable:true,value:()=>{
          observer.disconnect();for(const id of frames){cancelAnimationFrame(id);}delete (window as unknown as {hvpCutRtFeedbackStop?:unknown}).hvpCutRtFeedbackStop;
          return {origin:performance.timeOrigin,events,dropped};
        }});
      });feedbackStarted=true;
    }
    result.phase = "input"; await page.mouse.down(); await page.mouse.up();
    result.phase = "await-terminal";
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const batch = await drain(page); result.raw.entries.push(...batch.entries); result.raw.dropped += batch.dropped;
      const input = result.raw.entries.find(entry => entry.name === `${prefix}InputMs`);
      if (typeof input?.detail?.data?.commandId === "string") { result.commandId = input.detail.data.commandId; }
      if (result.commandId) {
        const markers = readHvpCutMarkers(result.raw.entries, result.commandId, body);
        if (markers.outcome && (markers.outcome !== "Applied" || markers.firstCommittedRenderSubmitMs !== null)) { break; }
      }
      await page.waitForTimeout(50);
    }
    result.after = await read(page);
    const last = await drain(page); result.raw.entries.push(...last.entries); result.raw.dropped += last.dropped;
    result.phase = "verify";
    if (!result.commandId) { throw new Error("No real command-bound input observed; no synthetic sample created"); }
    const markers = readHvpCutMarkers(result.raw.entries, result.commandId, body);
    result.problems.push(...markers.problems);
    const terminal=result.raw.entries.find(entry=>entry.detail?.data?.commandId===result.commandId
      &&["Applied","NoOp","Rejected","RecoveryHold"].some(status=>entry.name===`${prefix}InputTo${status}Ms`));
    const endpoint=markers.firstCommittedRenderSubmitMs??(terminal?terminal.start+terminal.duration:result.after.now);
    result.phase="await-health";
    await expect.poll(async()=>isHvpCutHealthFresh((await read(page)).health,result.before!.origin,endpoint),
      {timeout:5_000}).toBe(true);
    const fresh=await read(page);
    expect(fresh.origin).toBe(result.before.origin);
    expect(fresh.root).toBe(result.after.root);
    result.after={...result.after,health:fresh.health};
    const healthBatch=await drain(page);result.raw.entries.push(...healthBatch.entries);result.raw.dropped+=healthBatch.dropped;
    result.phase="verify";
    const inputs = result.raw.entries.filter(entry => entry.name === "hvp.cutInputMs" || entry.name === "hvp.cutBodyInputMs");
    if (inputs.length !== 1 || inputs[0]?.detail?.data?.commandId !== result.commandId) {
      result.problems.push("Expected exactly one actual command input in this measured attempt");
    }
    const observed = body ? result.after.tool.moving?.last : result.after.tool.last;
    const observedId = observed && ("id" in observed ? observed.id : observed.commandId);
    let outcome: HvpCutSample["outcome"] = markers.outcome ?? "Timeout";
    if (!markers.outcome && observedId === result.commandId) {
      const status = observed!.status;
      if (status !== "Applied" && status !== "NoOp" && status !== "Rejected" && status !== "RecoveryHold") {
        throw new Error("Unknown actual consumer outcome");
      }
      outcome = status;
    }
    if (markers.inputMs !== null) {
      result.sample = {commandId: result.commandId, scenario: variant.scenario, temperature, outcome,
        inputMs: markers.inputMs, appliedMs: markers.appliedMs, firstCommittedRenderSubmitMs: markers.firstCommittedRenderSubmitMs,
         holdMs: body ? readHvpBodyHoldForCommand(result.after.clock,result.commandId)
           : result.after.clock?.lastTerrainCommandId === result.commandId ? result.after.clock.lastTerrainHoldMs ?? null : null,
        sourceGenerationBefore: result.before.root, sourceGenerationAfter: outcome === "Timeout" ? null : result.after.root,
        reason: observedId === result.commandId ? observed!.reason : "No confirmed terminal before the deadline"};
    }
    if(markers.inputMs!==null&&markers.firstCommittedRenderSubmitMs!==null){
      result.privateUploadCpu=(requirePrivateCpu?assessHvpPrivateUploadCpu:readHvpPrivateUploadCpu)(result.raw,markers.inputMs,markers.firstCommittedRenderSubmitMs);
    }
    expect(result.after.origin).toBe(result.before.origin);
    expect(result.after).toMatchObject({visible: "visible", focused: true, testBridge: false});
    expect(result.after.health).toMatchObject({enabled: true, errors: 0, dropped: 0, cutObservation: {status: "armed", drops: 0}});
    expect(result.raw.dropped).toBe(0); expect(markers.problems).toEqual([]);
    expect(outcome).toBe("Applied"); expect(markers.appliedMs).not.toBeNull(); expect(markers.firstCommittedRenderSubmitMs).not.toBeNull();
    if(body&&result.sample?.holdMs===null){result.problems.push("Confirmed body World-Hold is not measured for this Applied command");}
    if (markers.inputMs !== null && markers.appliedMs !== null && markers.appliedMs - markers.inputMs > 30_000) {
      result.problems.push("Applied arrived beyond the declared terminal deadline; retained as late evidence, not a timely success");
    }
    expect(observedId).toBe(result.commandId); expect(observed?.status).toBe(outcome);
    verifyCut(variant, result.before, result.after, markers.renderBinding);
    result.phase = "complete";
  } catch (error) {
    result.failure=projectHvpCutRtOperationFailure(result.phase,error);
    result.problems.push(describeHvpCutRtFailure("cut", error));
    try {
      result.after = await read(page); const batch = await drain(page);
      result.raw.entries.push(...batch.entries); result.raw.dropped += batch.dropped;
    } catch { /* Keep the safe failing operation/category and every collected record. */ }
  }
  if(process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL&&feedbackStarted){
    try{result.feedback=await page.evaluate(()=>{
      const stop=(window as unknown as {hvpCutRtFeedbackStop?:()=>NonNullable<CutResult["feedback"]>}).hvpCutRtFeedbackStop;
      if(!stop){throw new Error("Cut feedback observation missing");}return stop();
    });}catch(error){result.problems.push(describeHvpCutRtFailure("artifact",error));}
  }else if(process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL){result.feedbackNotStarted=true;}
  return result;
};

const profile = async (page: Page) => page.evaluate(() => {
  const gl = document.querySelector<HTMLCanvasElement>("#debug-scene")?.getContext("webgl2");
  const extension = gl?.getExtension("WEBGL_debug_renderer_info");
  if (!gl || !extension) { throw new Error("Actual product GPU identity unavailable"); }
  return {gpu: String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)), width: innerWidth, height: innerHeight,
    dpr: devicePixelRatio, bufferWidth: gl.drawingBufferWidth, bufferHeight: gl.drawingBufferHeight,
    visible: document.visibilityState, focused: document.hasFocus()};
});
const processInfo = async (browser: Browser) => {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const info = await cdp.send("SystemInfo.getProcessInfo"), gpu = await cdp.send("SystemInfo.getInfo");
    const pid = info.processInfo.find(value => value.type === "browser")?.id;
    if (!Number.isSafeInteger(pid) || !pid || pid < 1) { throw new Error("Actual browser PID unavailable"); }
    const startedMs = Number(shell(`([DateTimeOffset](Get-Process -Id ${pid}).StartTime).ToUnixTimeMilliseconds()`));
    if (!Number.isFinite(startedMs) || startedMs <= 0) { throw new Error("Actual browser process start unavailable"); }
    return {pid, startedMs, gpu: projectHvpCutRtGpuInfo(gpu)};
  } finally { await cdp.detach(); }
};

const series = planHvpCutRtSeries(process.env.WELTRAUM_HVP_CUT_RT_CLASS);
test("D1 preReady real input is not queued",async({playwright})=>{
  const root=process.env.WELTRAUM_HVP_MEASURE_DIR,executable=process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
  if(!root||!executable||![root,executable,process.execPath].every(underSourceCode)){throw new Error("D1 requires installed explicit tools and evidence root");}
  const directory=await createHvpCutRtEvidenceDirectory(root,app,"d1-pre-ready");
  const browser=await playwright.chromium.launch({executablePath:executable,headless:false,args:["--force-device-scale-factor=1"]});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
  const record:{before?:unknown;after?:unknown;early?:Raw;ready?:Raw;cut?:CutResult;disposal?:unknown;failure?:string;cleanupError?:string}={};
  try{
    await installCollector(page);await page.goto(baseUrl+"/?hestiaPrototype=1&hvpMeasure=1&hvpScenario=rock-arm",{waitUntil:"domcontentloaded"});await page.bringToFront();
    const preparing=page.locator("#hvp-tool-preparing");await expect(preparing).toBeVisible();
    record.before=await page.evaluate(()=>({origin:performance.timeOrigin,now:performance.now(),state:document.body.dataset.hestiaPrototypeState}));
    await page.keyboard.press("Digit2");await page.mouse.move(640,360);await page.mouse.down();await page.mouse.up();
    await expect(preparing).toBeVisible();
    record.after=await page.evaluate(()=>({origin:performance.timeOrigin,now:performance.now(),state:document.body.dataset.hestiaPrototypeState}));
    expect(record.before).toMatchObject({state:"Loading"});expect(record.after).toMatchObject({state:"Loading"});
    record.early=await drain(page);expect(record.early.dropped).toBe(0);expect(record.early.entries.some(entry=>entry.name.startsWith("hvp.cut"))).toBe(false);
    await expect(page.locator("#hvp-state")).toContainText("State: Ready",{timeout:30_000});
    const raw:Raw={entries:[],dropped:0};await expect.poll(async()=>{const batch=await drain(page);raw.entries.push(...batch.entries);raw.dropped+=batch.dropped;
      return raw.entries.some(entry=>entry.name==="hvp.coldSceneReadyV2Ms");},{timeout:30_000}).toBe(true);record.ready=raw;
    expect(raw.dropped).toBe(0);expect(raw.entries.some(entry=>entry.name.startsWith("hvp.cut"))).toBe(false);
    const state=await read(page);expect(state.root).toBe(0);expect(state.tool.issued).toBe(0);expect(state.physics.terrainFragments).toEqual([]);
    record.cut=await cut(page,{id:"rock-arm",scenario:"rock-arm",mode:2,motion:"static"},"cold");
    expect(record.cut.problems).toEqual([]);expect(record.cut.commandId).toBe("cut-1");record.disposal=await endSession(page);
  }catch(error){const detail=page.locator("#hvp-error-detail");record.failure=await detail.count()?(await detail.textContent())??String(error):String(error);throw error;}
  finally{
    if(await page.locator("#hvp-ended").count()===0){try{record.disposal=await endSession(page);}catch(error){record.cleanupError=String(error);}}
    await browser.close();await writeHvpCutRtArtifact(directory,app,"result.json",record);
  }
});
const pairedGate=process.env.WELTRAUM_HVP_PAIRED_GATE??(process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL?"D2":"D1");
if(!["D1","D2","D3+D4"].includes(pairedGate)){throw new Error("Unknown paired preparation gate");}
const forcePerformanceGpu=process.env.WELTRAUM_HVP_FORCE_HIGH_PERFORMANCE_GPU;
if(forcePerformanceGpu!==undefined&&(forcePerformanceGpu!=="1"||pairedGate!=="D3+D4")){throw new Error("Performance GPU override requires the combined diagnostic gate");}
test(`${pairedGate} paired384 normal Source Ready Save ColdLoad and recut`,async({playwright},testInfo)=>{
  test.setTimeout(10*60_000);
  const root=process.env.WELTRAUM_HVP_MEASURE_DIR,executable=process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
  const buildRoot=process.env.WELTRAUM_HVP_BUILD_DIR??path.join(app,"dist");
  const baselineUrl=process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL,baselineBuild=process.env.WELTRAUM_HVP_PAIRED_BASELINE_BUILD;
  if(Boolean(baselineUrl)!==Boolean(baselineBuild)||baselineBuild&&!underSourceCode(baselineBuild)){throw new Error("Paired baseline requires bound local build and URL");}
  if(!root||!executable||![root,executable,buildRoot,process.execPath].every(underSourceCode)){
    throw new Error("D1 requires explicit installed tools, frozen build and evidence under C:/IFI_SourceCode");
  }
  if(pairedGate==="D3+D4"&&!baselineUrl){throw new Error("Combined D3+D4 requires the frozen D2 baseline");}
  const directory=await createHvpCutRtEvidenceDirectory(root,app,`${pairedGate.toLowerCase().replace("+","-")}-pair-${testInfo.repeatEachIndex}`);
  const source=await inventoryHvpCutRtFiles(path.join(app,"src"),app),build=await inventoryHvpCutRtFiles(buildRoot,app);
  const bindings={gate:pairedGate,classification:"BOUNDED_PAIRED384_PREPARATION_NOT_42_OR_1400",head:execFileSync(git,["rev-parse","HEAD"],{cwd:app,encoding:"utf8"}).trim(),source,build,
    gpuProfile:forcePerformanceGpu?"SUPPLEMENTAL_NVIDIA_DIAGNOSTIC_NOT_ARC_REFERENCE":"ARC_REFERENCE",
    browserArgs:["--force-device-scale-factor=1",...(forcePerformanceGpu?["--force-high-performance-gpu"]:[])],
    sourceSha256:sha(JSON.stringify(source)),buildSha256:sha(JSON.stringify(build)),nodeSha256:sha(await readFile(process.execPath)),
    browserSha256:sha(await readFile(executable)),lockSha256:sha(await readFile(path.join(app,"package-lock.json"))),power:power(),supply:powerSource()};
  const baselineInventory=baselineBuild?await inventoryHvpCutRtFiles(baselineBuild,app):undefined;
  if(baselineInventory){Object.assign(bindings,{baselineBuild,baselineUrl,baselineBuildSha256:sha(JSON.stringify(baselineInventory)),baselineInventory});}
  const candidateServed=process.env.WELTRAUM_HVP_PAIRED_CANDIDATE_SERVED_BINDING,baselineServed=process.env.WELTRAUM_HVP_PAIRED_BASELINE_SERVED_BINDING;
  const verifyProducts=async()=>{
    if(!candidateServed||!baselineServed||![candidateServed,baselineServed].every(underSourceCode)){throw new Error("Combined gate requires both explicit served-byte receipts");}
    const candidate=await verifyHvpCutProductBinding({app,buildRoot,servedReceiptPath:candidateServed,baseUrl,currentSource:true});
    const baseline=await verifyHvpCutProductBinding({app,buildRoot:baselineBuild!,servedReceiptPath:baselineServed,baseUrl:baselineUrl!,currentSource:false});
    expect(baseline).toMatchObject({sourceManifestHash:"2174e4573dfbd039b139ac3a7d1fbc4dfbd78db772f90a59d8efedce2a9bf677",
      buildManifestHash:"330285c263f0c96c56226d40d1bcf2712a39cce6e21ce87b795d9247d8e09b8b"});
    return {candidate,baseline};
  };
  if(pairedGate==="D3+D4"){
    try{Object.assign(bindings,{frozenProducts:await verifyProducts()});}
    catch(error){await writeHvpCutRtArtifact(directory,app,"product-preflight-failure.json",{gate:pairedGate,failure:describeHvpCutRtFailure("preflight",error),gameStarted:false});throw error;}
  }
  Object.assign(bindings,{fixture:await Promise.all(["tests/performance/hvp-cut-rt.spec.ts","tests/performance/hvpCutRtReport.ts","tests/performance/hvpPrivateUploadCpu.ts",baselineUrl?"playwright.d2.config.ts":"playwright.d1.config.ts"]
    .map(async file=>({path:file,sha256:sha(await readFile(path.join(app,file)))})))});
  await writeHvpCutRtArtifact(directory,app,"bindings.json",bindings);
  const records:Array<{mode:string;failure:string|null;ready:Raw|null;loadReady:Raw|null;coldLoadReady:Raw|null;results:CutResult[];saves:string[];renderFault?:Awaited<ReturnType<typeof submittedDrawFailure>>;
    nativeContacts?:Awaited<ReturnType<typeof normalNativeContacts>>;
    nativeWake?:Awaited<ReturnType<typeof normalNativeContacts>>;
    nativeWakeSeed?:CutResult;
    supplementalReady?:{wake:Raw;contacts:Raw|null;renderFault:Raw|null};
    cameraScreenshots?:Array<{preset:string;root:number;digest:string;file:string}>;
    controlledFaultPageErrors?:string[];
    cleanupDisposal?:unknown;
    cleanup?:CleanupEvidence;
    failureRaw?:{origin:number;raw:Raw};
    disposal:unknown[];profile:unknown;process:unknown;errors:string[];startupLoading?:unknown;budgetLines?:string[]}>=[];
  const collectReady=async(page:Page,metric:string):Promise<Raw>=>{
    const raw:Raw={entries:[],dropped:0};
    await expect.poll(async()=>{const batch=await drain(page);raw.entries.push(...batch.entries);raw.dropped+=batch.dropped;
      return raw.entries.some(entry=>entry.name===metric);},{timeout:30_000}).toBe(true);
    expect(raw.dropped).toBe(0);return raw;
  };
  const save=async(page:Page)=>{
    await inspect(page);await page.getByRole("button",{name:"Spielstand speichern",exact:true}).click();
    await expect.poll(async()=>(await read(page)).save.state,{timeout:30_000}).toBe("Saved");
    return page.evaluate(()=>new Promise<string>((resolve,reject)=>{
      const open=indexedDB.open("weltraum-hestia-prototype-v1");open.onerror=()=>reject(new Error("Cannot read real Save evidence"));
      open.onsuccess=()=>{const db=open.result,transaction=db.transaction("saveSlots","readonly"),request=transaction.objectStore("saveSlots").get("hvp-primary");
        transaction.oncomplete=()=>db.close();transaction.onabort=()=>{db.close();reject(new Error("Save evidence transaction aborted"));};
        request.onerror=()=>reject(new Error("Missing real Save payload"));
        request.onsuccess=()=>{if(!request.result?.payloadBytes){reject(new Error("Missing real Save payload"));return;}
          resolve(new TextDecoder("utf-8",{fatal:true}).decode(request.result.payloadBytes));};};
    }));
  };
  const modes=testInfo.repeatEachIndex%2===0?["control","candidate"]:["candidate","control"];
  for(const mode of modes){
    const record:typeof records[number]={mode,failure:null,ready:null,loadReady:null,coldLoadReady:null,results:[],saves:[],disposal:[],profile:null,process:null,errors:[],budgetLines:[]};records.push(record);
    const requirePrivateCpu=pairedGate==="D3+D4"&&mode==="candidate";
    let browser:Browser|undefined,page:Page|undefined;
    const sourceMode=baselineUrl?"candidate":mode,modeBase=mode==="control"&&baselineUrl?baselineUrl:baseUrl;
    const suffix=`&hvpCutSource=${sourceMode}`,url=`${modeBase}/?hestiaPrototype=1&hvpMeasure=1&hvpScenario=rock-arm${suffix}`;
    try{
      browser=await playwright.chromium.launch({executablePath:executable,headless:false,args:bindings.browserArgs});
      record.process=await processInfo(browser);
      const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();
      page.setDefaultTimeout(10_000);page.setDefaultNavigationTimeout(30_000);
      page.on("pageerror",error=>record.errors.push(error.message));page.on("console",message=>{
        const line=message.text();if(message.type()==="error"){record.errors.push(line);}
        if(line.startsWith("hvp-owned-body-plan-budget ")){
          if(record.budgetLines!.length===16||line.length>16_384){record.errors.push("Body budget evidence overflow");}
          else{record.budgetLines!.push(line);}
        }
      });
      await installCollector(page);await ready(page,url);
      record.ready=await collectReady(page,"hvp.coldSceneReadyV2Ms");
      record.startupLoading=await page.evaluate(()=>({
        navigation:performance.getEntriesByType("navigation").map(entry=>{const n=entry as PerformanceNavigationTiming;return {
          responseEnd:n.responseEnd,domInteractive:n.domInteractive,domContentLoadedEventEnd:n.domContentLoadedEventEnd,loadEventEnd:n.loadEventEnd};}),
        resources:performance.getEntriesByType("resource").flatMap(entry=>{const r=entry as PerformanceResourceTiming,url=new URL(r.name);
          return url.origin===location.origin&&/\.(js|css|wasm)$/.test(url.pathname)?[{path:url.pathname,start:r.startTime,duration:r.duration,
            responseEnd:r.responseEnd,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,initiator:r.initiatorType}]:[];})
      }));
      record.profile=await profile(page);expect(record.profile).toMatchObject({width:1280,height:720,dpr:1,bufferWidth:1280,bufferHeight:720,visible:"visible",focused:true});
      expect((record.profile as {gpu:string}).gpu).toMatch(forcePerformanceGpu?/NVIDIA.*RTX.*PRO\s*500.*Blackwell/i:/Arc.*Pro\s*140T/i);
      const devices=(record.process as Awaited<ReturnType<typeof processInfo>>).gpu.gpu.devices
        .filter(device=>device.deviceString.length>0&&(record.profile as {gpu:string}).gpu.includes(device.deviceString));
      expect(devices).toHaveLength(1);expect(devices[0]!.driverVersion).toBeTruthy();
      if(testInfo.repeatEachIndex===0){await page.screenshot({path:path.join(directory,`${mode}-ready.png`)});}
      expect(await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeCutReadiness!))).toMatchObject({policy:"hvp-ready-prewarm-v2",sourceMode:sourceMode==="control"?"control":"private-cow",state:"Ready"});
      const cold=await cut(page,{id:"rock-arm",scenario:"rock-arm",mode:2,motion:"static"},"cold",requirePrivateCpu);record.results.push(cold);
      expect(cold.problems).toEqual([]);expect(cold.after!.physics.terrainFragments[0]!.cellCount).toBe(384);
      for(const [phase,thread] of [["cutNativeInputCopyMs","main"],["cutNativeCollisionValidationMs","physics"],
        ["cutNativeCellValidationMs","physics"],["cutNativeFragmentSourceMs","physics"],["cutNativeFragmentAdmissionMs","physics"]]){
        const entries=cold.raw.entries.filter(entry=>entry.name===`hvp.${phase}`&&entry.detail?.data?.commandId===cold.commandId);
        expect(entries).toHaveLength(1);expect(entries[0]!.detail?.data?.thread).toBe(thread);
        expect(Number.isFinite(entries[0]!.start)&&entries[0]!.start>=0&&Number.isFinite(entries[0]!.duration)&&entries[0]!.duration>=0).toBe(true);
      }
      for(const phase of ["startupSourceMs","startupCutPoolPrepareMs","startupPhysicsMs"]){
        const entries=record.ready.entries.filter(entry=>entry.name===`hvp.${phase}`);expect(entries).toHaveLength(1);
        expect(entries[0]!.start+entries[0]!.duration).toBeLessThanOrEqual(cold.sample!.inputMs);
      }
      if(sourceMode==="candidate"){expect(cold.raw.entries.some(entry=>entry.name==="hvp.cutSupportLocalPlanMs")).toBe(true);
        expect(cold.raw.entries.some(entry=>entry.name==="hvp.cutSupportCopyMs")).toBe(false);}
      else{expect(cold.raw.entries.some(entry=>entry.name==="hvp.cutSupportCopyMs")).toBe(true);}
      await expect.poll(async()=>{const state=await read(page!);return state.physics.bodies.find(body=>body.ownerId===state.physics.terrainFragments[0]!.ownerId)?.sleeping;},{timeout:20_000}).toBe(true);
      const saved=sourceFacts(await read(page));record.saves.push(await save(page));
      await page.getByRole("button",{name:"Spielstand laden",exact:true}).click();
      await expect.poll(async()=>(await read(page!)).save.state,{timeout:30_000}).toBe("Loaded");
      record.loadReady=await collectReady(page,"hvp.loadSceneReadyV2Ms");
      expect(sourceFacts(await read(page))).toEqual(saved);
      const moving=await cut(page,{id:"body-box-moving",scenario:"body-box",mode:2,motion:"moving"},"warm",requirePrivateCpu);record.results.push(moving);
      expect(moving.problems).toEqual([]);expect(moving.after!.physics.terrainFragments[0]!.cellCount).toBe(352);
      const beforeColdLoad=sourceFacts(await read(page));record.saves.push(await save(page));record.disposal.push(await endSession(page));
      await ready(page,`${modeBase}/?hestiaPrototype=1&hvpMeasure=1&hvpLoad=primary${suffix}`);
      expect(sourceFacts(await read(page))).toEqual(beforeColdLoad);
      record.coldLoadReady=await collectReady(page,"hvp.coldSceneReadyV2Ms");
      const recut=await cut(page,{id:"body-box-moving",scenario:"body-box",mode:2,motion:"moving"},"cold",requirePrivateCpu);record.results.push(recut);
      expect(recut.problems).toEqual([]);expect(recut.commandId).toBe("moving-cut-2");record.disposal.push(await endSession(page));
      if(pairedGate==="D3+D4"){
        await ready(page,url);record.supplementalReady={wake:await collectReady(page,"hvp.coldSceneReadyV2Ms"),contacts:null,renderFault:null};
        if(testInfo.repeatEachIndex===0){
          await page.getByRole("button",{name:"C05-Felsarm",exact:true}).click();
          await expect.poll(()=>page!.evaluate(()=>document.body.dataset.hestiaPrototypeCamera)).toBe("C05-ROCKARM");
          const snapshot=await read(page),file=`${mode}-C05-rockarm.png`;await page.screenshot({path:path.join(directory,file)});
          record.cameraScreenshots=[{preset:"C05-ROCKARM",root:snapshot.root,digest:snapshot.digest,file}];
        }
        record.nativeWakeSeed=await cut(page,{id:"rock-arm",scenario:"rock-arm",mode:2,motion:"static"},"cold",requirePrivateCpu);
        expect(record.nativeWakeSeed.problems).toEqual([]);expect(record.nativeWakeSeed.after!.physics.terrainFragments[0]!.cellCount).toBe(384);
        await expect.poll(async()=>{const state=await read(page!);return state.physics.bodies.find(body=>body.ownerId===state.physics.terrainFragments[0]!.ownerId)?.sleeping;},{timeout:20_000}).toBe(true);
        record.nativeWake=await normalNativeContacts(page,true,mode==="candidate"?{
          url:`${modeBase}/?hestiaPrototype=1&hvpMeasure=1&hvpLoad=primary${suffix}`,save}:undefined);
        expect(record.nativeWake.problems).toEqual([]);
        await ready(page,`${modeBase}/?hestiaPrototype=1&hvpMeasure=1${suffix}`);record.supplementalReady.contacts=await collectReady(page,"hvp.coldSceneReadyV2Ms");
        if(testInfo.repeatEachIndex===0){
          await page.getByRole("button",{name:"Ansicht: Schnittstelle",exact:true}).click();
          await expect.poll(()=>page!.evaluate(()=>document.body.dataset.hestiaPrototypeCamera)).toBe("C07-QUARRY");
          const snapshot=await read(page),file=`${mode}-C07-quarry.png`;await page.screenshot({path:path.join(directory,file)});
          record.cameraScreenshots!.push({preset:"C07-QUARRY",root:snapshot.root,digest:snapshot.digest,file});
        }
        record.nativeContacts=await normalNativeContacts(page);
        expect(record.nativeContacts.problems).toEqual([]);
        await ready(page,url);record.supplementalReady.renderFault=await collectReady(page,"hvp.coldSceneReadyV2Ms");
        record.renderFault=await submittedDrawFailure(page,mode==="candidate");
        expect(record.renderFault.problems).toEqual([]);
        if(mode==="control"){
          record.controlledFaultPageErrors=record.errors.filter(error=>error==="HVP_CONTROLLED_DRAW_AFTER_APPLIED");
          expect(record.controlledFaultPageErrors).toEqual(["HVP_CONTROLLED_DRAW_AFTER_APPLIED"]);
          record.errors=record.errors.filter(error=>error!=="HVP_CONTROLLED_DRAW_AFTER_APPLIED");
        }
        if(testInfo.repeatEachIndex===0){await page.screenshot({path:path.join(directory,`${mode}-draw-failure.png`)});}
      }
      expect(record.errors).toEqual([]);
      expect(power()).toBe(bindings.power);expect(powerSource()).toBe(bindings.supply);
    }catch(error){
      record.failure=error instanceof Error?error.message:String(error);
      if(page&&!page.isClosed()){
        try{record.failureRaw={origin:await page.evaluate(()=>performance.timeOrigin),raw:await drain(page)};}
        catch(capture){record.errors.push(`Failure collector: ${String(capture)}`);}
        try{await writeHvpCutRtArtifact(directory,app,`${mode}-failure-state.json`,await page.evaluate(()=>({
          at:performance.now(),visible:document.visibilityState,focused:document.hasFocus(),
          state:document.querySelector("#hvp-state")?.textContent??null,error:document.querySelector("#hvp-error-detail")?.textContent??null,
          readiness:document.body.dataset.hestiaPrototypeCutReadiness??null,physics:document.body.dataset.hestiaPrototypePhysics??null,
          physicsClock:document.body.dataset.hestiaPrototypePhysicsClock??null,
          input:document.body.dataset.hestiaPrototypeInput??null,
          save:document.body.dataset.hestiaPrototypeSave??null,resources:document.body.dataset.hestiaPrototypeResources??null,
          loading:document.body.dataset.hestiaPrototypeLoading??null,
          disposal:document.body.dataset.hestiaPrototypeDisposal??null,
          ownedRender:document.body.dataset.hestiaPrototypeOwnedRender??null,
          navigation:performance.getEntriesByType("navigation").map(n=>({name:n.name,start:n.startTime,duration:n.duration}))
        })));}catch(capture){record.errors.push(`Failure state: ${String(capture)}`);}
      }
    }
    finally{
      if(page&&!page.isClosed()&&await page.locator("#hvp-ended").count()===0&&await page.locator("#hvp-failure").count()===0){
        record.cleanup={state:"IN_PROGRESS",samples:[],raw:{entries:[],dropped:0},truncatedSamples:0};
        try{record.cleanupDisposal=await endSession(page,record.cleanup);}
        catch(error){record.cleanup.state="UNPROVEN";record.cleanup.failure=describeHvpCutRtFailure("cut",error);
          record.errors.push(`Cleanup: ${JSON.stringify(record.cleanup.failure)}`);}
      }
      try{await browser?.close();}catch(error){record.errors.push(`Browser cleanup: ${String(error)}`);}
      await writeHvpCutRtArtifact(directory,app,`${mode}.json`,record);
    }
  }
  const completeSource=(text:string)=>{
    const game=JSON.parse(text).player.data.hestia;
    return {terrain:game.terrain,bodies:game.world.bodies.map((body:{ownerId:string;family:string;region:string})=>
      ({ownerId:body.ownerId,family:body.family,object:JSON.parse(body.region).object}))};
  };
  if(pairedGate==="D3+D4"){
    try{await writeHvpCutRtArtifact(directory,app,"product-final-binding.json",await verifyProducts());}
    catch(error){await writeHvpCutRtArtifact(directory,app,"product-final-binding-failure.json",{gate:pairedGate,failure:describeHvpCutRtFailure("final-inventory",error),attemptFailures:records.map(record=>record.failure!==null)});throw error;}
  }
  expect(records.map(record=>record.failure)).toEqual([null,null]);
  expect((records[0]!.profile as {gpu:string}).gpu).toBe((records[1]!.profile as {gpu:string}).gpu);
  const usedDevice=(record:typeof records[number])=>(record.process as Awaited<ReturnType<typeof processInfo>>).gpu.gpu.devices
    .find(device=>device.deviceString.length>0&&(record.profile as {gpu:string}).gpu.includes(device.deviceString))!;
  expect(usedDevice(records[0]!)).toEqual(usedDevice(records[1]!));
  expect(records.map(record=>record.saves.map(completeSource))[0]).toEqual(records.map(record=>record.saves.map(completeSource))[1]);
  expect(sha(JSON.stringify(await inventoryHvpCutRtFiles(path.join(app,"src"),app)))).toBe(bindings.sourceSha256);
  expect(sha(JSON.stringify(await inventoryHvpCutRtFiles(buildRoot,app)))).toBe(bindings.buildSha256);
  if(baselineInventory){expect(sha(JSON.stringify(await inventoryHvpCutRtFiles(baselineBuild!,app)))).toBe(sha(JSON.stringify(baselineInventory)));}
});
for (const {variant, temperature, session, attempts} of series.sessions) {
      test(`P07 ${variant.id} ${temperature} session ${session}`, async ({playwright}, testInfo) => {
        test.setTimeout(30 * 60_000);
        const root = process.env.WELTRAUM_HVP_MEASURE_DIR, executable = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
        const plan = {classification: series.classification, doNotUseForAcceptance: series.doNotUseForAcceptance,
          variant, temperature, session, schedule: series.schedule, attempts,
          fixturePolicy: "Authentic normal-UI checkpoint; new document/workers each attempt. Warm: one unmeasured cut then normal hot restore. Moving: actual contact impulse, not a falling-body substitute.",
          timeoutMs: 30_000, width: 1280, height: 720, dpr: 1, trace: false, screenshots: false, video: false,
          bindings: null as {sourceSha256: string; buildSha256: string; [key: string]: unknown} | null};
        const records = Array.from({length: attempts}, (_, index) => ({attempt: index + 1, status: "not-run" as HvpCutRtAttemptRecord["status"], result: null as CutResult | null,
          warmup: null as CutResult | null, problems: [] as string[]}));
        let browser: Browser | undefined, failure: string | undefined;
        const secondaryFailures: string[] = [];
        let stage: HvpCutRtFailureStage = "preflight";
        let directory: string | undefined;
        try {
          if (!underSourceCode(app) || !underSourceCode(process.execPath) || !root || !underSourceCode(root)) {
            throw new Error("Explicit C:/IFI_SourceCode execution and evidence directory required");
          }
          directory = await createHvpCutRtEvidenceDirectory(root, app, `${variant.id}-${temperature}-${session}`);
          stage = "artifact";
          await writeHvpCutRtArtifact(directory, app, "declared-plan.json", plan);
          stage = "preflight";
          if (!executable || !underSourceCode(executable) || !underSourceCode(await realpath(executable)) || !(await stat(executable)).isFile()) {
            throw new Error("Explicit installed C:/IFI_SourceCode browser required");
          }
          const configFile = testInfo.config.configFile;
          if (!configFile) { throw new Error("Actual measurement configuration path is required"); }
          const source = await inventoryHvpCutRtFiles(path.join(app, "src"), app), build = await inventoryHvpCutRtFiles(path.join(app, "dist"), app);
          const fixture = await Promise.all(["tests/performance/hvp-cut-rt.spec.ts", "tests/performance/hvpCutRtReport.ts", "tests/e2e/hvp-performance-evidence.ts", "playwright.performance.config.ts", configFile]
            .map(async file => ({path: path.relative(app, path.resolve(app, file)).replaceAll("\\", "/"), sha256: sha(await readFile(path.resolve(app, file)))})));
          const tools = await Promise.all([process.execPath, pwsh, git, powercfg].map(async file => ({path: file, sha256: sha(await readFile(file))})));
          const scheme = power(), supply = powerSource();
          plan.bindings = {
            head: execFileSync(git, ["rev-parse", "HEAD"], {cwd: app, encoding: "utf8", timeout: 20_000}).trim(),
            dirty: execFileSync(git, ["status", "--porcelain"], {cwd: app, encoding: "utf8", timeout: 20_000}).trim(),
            source, build, fixture, tools, sourceSha256: sha(JSON.stringify(source)), buildSha256: sha(JSON.stringify(build)),
            lockSha256: sha(await readFile(path.join(app, "package-lock.json"))),
            wasmSha256: sha(await readFile(path.join(app, "node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm"))),
            browserSha256: sha(await readFile(executable)), os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
            ramBytes: os.totalmem(), power: scheme, supply,
            adapters: JSON.parse(shell("Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate,CurrentHorizontalResolution | ConvertTo-Json -Compress"))};
          if (!scheme.includes("381b4222-f694-41f0-9685-ff5bb260df2e")) { throw new Error("Reference device is not in its designated Balanced scheme"); }
          stage = "artifact";
          await writeHvpCutRtArtifact(directory, app, "plan.json", plan);
          stage = "browser-launch";
          browser = await playwright.chromium.launch({executablePath: executable, headless: false, args: ["--force-device-scale-factor=1"]});
          stage = "attempt";
          const identity = await processInfo(browser), context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
          stage = "artifact";
          await writeHvpCutRtArtifact(directory, app, "process.json", {version: browser.version(), ...identity});
          stage = "attempt";
          const setup = await context.newPage(); const saved = await makeCheckpoint(setup, variant);
          const frozenProfile = await profile(setup);
          expect(frozenProfile).toMatchObject({width: 1280, height: 720, dpr: 1, bufferWidth: 1280, bufferHeight: 720, visible: "visible", focused: true});
          const devices = identity.gpu.gpu.devices.filter(device => device.deviceString.length > 0 && frozenProfile.gpu.includes(device.deviceString));
          if (devices.length !== 1 || !devices[0]!.driverVersion) { throw new Error(`Actual WebGL GPU/driver binding is ambiguous: ${frozenProfile.gpu}`); }
          stage = "artifact";
          await writeHvpCutRtArtifact(directory, app, "fixture.json", {saved, selected: frozenProfile, device: devices[0]}); await setup.close();
          for (const record of records) {
            stage = "attempt";
            let page: Page | undefined; const errors: string[] = [];
            record.status = "preparing";
            try {
              page = await context.newPage();
              page.on("pageerror", error => errors.push(describeHvpCutRtFailure("page-error", error)));
              page.on("console", message => { if (message.type() === "error") { errors.push(describeHvpCutRtFailure("console-error", undefined)); } });
              await installCollector(page); await ready(page, "/?hestiaPrototype=1&hvpLoad=primary&hvpMeasure=1");
              expect(sourceFacts(await read(page))).toEqual(saved); expect(await profile(page)).toEqual(frozenProfile);
              expect(power()).toBe(scheme); expect(powerSource()).toBe(supply);
              if (temperature === "warm") {
                record.warmup = await cut(page, variant, temperature);
                expect(record.warmup.problems).toEqual([]);
                await inspect(page); await page.getByRole("button", {name: "Spielstand laden", exact: true}).click();
                await expect.poll(async () => (await read(page!)).save.state, {timeout: 30_000}).toBe("Loaded");
                expect(sourceFacts(await read(page))).toEqual(saved);
              }
              record.result = await cut(page, variant, temperature);
              record.problems.push(...record.result.problems, ...errors);
              expect(await profile(page)).toEqual(frozenProfile); expect(power()).toBe(scheme); expect(powerSource()).toBe(supply);
              record.status = record.problems.length ? "failed" : "completed";
            } catch (error) { record.status = "failed"; record.problems.push(describeHvpCutRtFailure("attempt", error), ...errors); }
            finally {
              try { await page?.close(); } catch (error) { record.status = "failed"; record.problems.push(describeHvpCutRtFailure("page-cleanup", error)); }
            }
            stage = "artifact";
            await writeHvpCutRtArtifact(directory, app, `attempt-${record.attempt}.json`, record);
            console.log(`P07 ${variant.id}/${temperature}/${session}/${record.attempt}: ${record.status}`);
          }
        } catch (error) { failure = describeHvpCutRtFailure(stage, error); }
        finally {
          try { await browser?.close(); } catch (error) {
            const problem = describeHvpCutRtFailure("browser-cleanup", error);
            if (failure === undefined) { failure = problem; } else { secondaryFailures.push(problem); }
          }
        }
        const samples = records.flatMap(record => record.result?.sample ? [record.result.sample] : []);
        let sourceUnchanged: boolean | null = null, buildUnchanged: boolean | null = null;
        if (plan.bindings) {
          try {
            sourceUnchanged = sha(JSON.stringify(await inventoryHvpCutRtFiles(path.join(app, "src"), app))) === plan.bindings.sourceSha256;
            buildUnchanged = sha(JSON.stringify(await inventoryHvpCutRtFiles(path.join(app, "dist"), app))) === plan.bindings.buildSha256;
          } catch (error) {
            const problem = describeHvpCutRtFailure("final-inventory", error);
            if (failure === undefined) { failure = problem; } else { secondaryFailures.push(problem); }
          }
        }
        const report = {plan, planSha256: sha(JSON.stringify(plan)), failure: failure ?? null, secondaryFailures,
          artifactFailures: [] as string[], plannedAttempts: attempts, records,
          classification: series.classification, doNotUseForAcceptance: series.doNotUseForAcceptance,
          summary: summarizeHvpCuts(samples), sourceUnchanged, buildUnchanged,
          populationSummary: summarizeHvpCutRtSessions(series, [{variantId: variant.id, temperature, session, failure: failure ?? null, records}]),
          populationCoverage: "ONE_SESSION: other declared sessions remain missing, not successful",
          performanceAcceptance: "NOT_ASSESSED: aggregate the complete predeclared multi-session population, including every failed/precondition attempt"};
        await persistHvpCutRtReport(directory, app, report, body => testInfo.attach("cut-session-report", {body, contentType: "application/json"}));
        expect(report.artifactFailures).toEqual([]);
        expect(failure, JSON.stringify(report.summary)).toBeUndefined();
        expect(records.every(record => record.status === "completed"), JSON.stringify(records.map(record => ({attempt: record.attempt, status: record.status, problems: record.problems})))).toBe(true);
        expect(report.sourceUnchanged && report.buildUnchanged).toBe(true);
      });
}
