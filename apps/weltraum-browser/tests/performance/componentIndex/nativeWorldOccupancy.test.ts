import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {cpus} from "node:os";
import {execFileSync} from "node:child_process";
import {expect,it,vi} from "vitest";
import {R} from "../../../src/hestia-prototype/physics/rapierPort";
import {createHvpWorkerPhysicsSession} from "../../../src/hestia-prototype/physics/session";
import {collisionSectors,type HvpCollisionSector} from "../../../src/hestia-prototype/physics/terrainColliders";
import type {HvpTerrainFragmentRequest} from "../../../src/hestia-prototype/physics/terrainFragment";
import {createHvpBodyMeshPhaseReserve} from "../../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {createHvpTerrainRoot,type HvpTerrainSnapshot} from "../../../src/hestia-prototype/terrain/cutPlan";
import {createTerrainComponentIndex,materializeCompactCells} from "../../../src/voxel/structural/componentIndex";
import {compactTerrainOwnerDigest} from "../../../src/voxel/structural/componentIndex/fragment";
import {HVP_SOURCE_MIN_METERS as origin,prepareHvpCoastSource,materializeHvpCoastSource} from "../../../src/hvp/hvpCoastSource";
import {cutAt} from "../../unit/componentIndex/compactFixtures";

const host={assertCurrent(){},continuePlan:()=>true,async yieldTask(){throw new Error("Unexpected native planning yield");}};
const reserve=()=>createHvpBodyMeshPhaseReserve(96*1024*1024);
const out=process.env.HESTIA_NATIVE_OCCUPANCY_OUT;

function rockSector(snapshot:HvpTerrainSnapshot) {
  // One native 32x32 column containing the real support and arm. Neighbouring halo cells come from the same revision.
  const read=(x:number,y:number,z:number)=>snapshot.readSlot(x+160,y,z+64);
  return [...collisionSectors({sizeX:32,sizeY:128,sizeZ:32,cellMeters:.125,
    originMeters:{x:origin.x+160*.125,y:origin.y,z:origin.z+64*.125},
    readSlot:read,readHaloSlot:read})][0]!;
}
function geometry() {
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"occupancy",1);
  const seed=cutAt(root,[2,2,2]);
  expect(seed.changed.length).toBe(1);
  root.commit(seed);
  const cut=cutAt(root,[176,78,76],[180,82,80]),index=createTerrainComponentIndex(cut.before);
  try {
    const parts=index.prepareCompact(cut).fragments;
    expect(cut.changed).toHaveLength(64);expect(parts).toHaveLength(1);
    const part=parts[0]!;
    expect(part.cellCount).toBe(384);expect(part.massKg).toBe(1722.65625);
    const after=root.prepareTransfer(cut,materializeCompactCells(part)).after;
    const request:HvpTerrainFragmentRequest={ownerId:part.ownerId,cells:[],origin,massKg:part.massKg,colliderBoxes:part.colliderBoxes,
      compactSource:{generation:part.revision,parts:part.parts,cellCount:part.cellCount}};
    const binding={commandId:"occupancy-rock-arm",sessionId:after.sessionId,epoch:after.epoch,baseRevision:cut.before.revision,
      baseDigest:cut.before.sourceDigest,targetDigest:after.sourceDigest};
    return {before:rockSector(cut.before),after:rockSector(after),request,binding};
  }finally{index.dispose();}
}
function ballast(i:number):HvpTerrainFragmentRequest {
  const x=2+(i%12)*2,y=28,z=2+Math.floor(i/12)*2,material=1;
  const digest=compactTerrainOwnerDigest([{x,end:x+1,y,z,material}]);
  return {ownerId:"hvp:terrain-fragment:r1:"+digest,cells:[],origin,massKg:2400*.125**3,
    colliderBoxes:[{min:[x,y,z],max:[x+1,y+1,z+1]}],compactSource:{generation:1,cellCount:1,
      parts:[{origin:[x&~15,y&~15,z&~15],leafRevision:0,label:1,runs:[(material<<16)|((z&15)<<8)|((y&15)<<4)|(x&15)]}]}};
}
function tile(i:number):HvpCollisionSector {
  // Disjoint, ray-hittable half-metre walkable floor tiles spread over a two-dimensional grid.
  const x=32+i%64,z=32+Math.floor(i/64);
  return {vertices:new Float32Array([x,0,z,x,0,z+.5,x+.5,0,z+.5,x+.5,0,z]),indices:new Uint32Array([0,1,2,0,2,3])};
}
type Profile={bodies:number;statics:number;blocked?:boolean};
const profiles:Profile[]=[{bodies:2,statics:8},{bodies:16,statics:8},{bodies:31,statics:8},
  {bodies:16,statics:256},{bodies:16,statics:1024},{bodies:16,statics:2048},{bodies:16,statics:4063},{bodies:31,statics:4063},
  {bodies:32,statics:8,blocked:true},{bodies:31,statics:4064,blocked:true}];
function timed<T>(read:()=>T) {const start=performance.now(),value=read();return {value,ms:performance.now()-start};}
type Metrics=Record<string,number>;
async function run(g:ReturnType<typeof geometry>,tiles:HvpCollisionSector[],p:Profile) {
  const sectors=[g.before,...tiles.slice(0,p.statics-1)];
  const s=await createHvpWorkerPhysicsSession(sectors,{x:-10,y:10,z:-10});
  const cast=(x:number,y:number,z:number)=>s.queryTerrainRay({x,y,z},{x:0,y:0,z:1},.55);
  const baseRay=()=>cast(origin.x+178*.125,origin.y+80*.125,origin.z+76*.125-.18);
  const box=g.request.colliderBoxes[0]!;
  const armRay=()=>cast(origin.x+(box.min[0]+box.max[0])*.0625,origin.y+(box.min[1]+box.max[1])*.0625,origin.z+box.min[2]*.125-.18);
  try {
    const filler=Array.from({length:p.bodies-1},(_,i)=>ballast(i));
    const seedEdits=[{index:0,mesh:g.before}];
    const setup=await s.prepareTerrainPlan("seed",0,seedEdits,filler,reserve(),host,
      {sessionId:g.binding.sessionId,epoch:g.binding.epoch,generation:1,terrainDigest:g.binding.baseDigest});
    s.prepareTerrain("seed",0,seedEdits,filler,setup);s.commitTerrain("seed");s.finalizeTerrain("seed");
    const old=s.read();expect(old.bodyCount).toBe(p.bodies);expect(old.colliderCount).toBe(p.bodies+p.statics);
    expect(baseRay()?.ownerId).toBe(null);expect(armRay()?.ownerId).toBe(null);
    for(const i of [0,p.statics-2]){
      const q=s.queryTerrainRay({x:32+i%64+.125,y:1,z:32+Math.floor(i/64)+.125},{x:0,y:-1,z:0},2);
      expect(q?.distance).toBeCloseTo(1);
    }
    const {binding,request}=g,edits=[{index:0,mesh:g.after}],requests=[request];
    const start=performance.now();
    const plan=await s.prepareTerrainPlan(binding.commandId,1,edits,requests,reserve(),host,
      {sessionId:binding.sessionId,epoch:binding.epoch,generation:2,terrainDigest:binding.targetDigest});
    const nativePlanMs=performance.now()-start;
    const sourceViews=timed(()=>s.terrainPlanSourceViews(plan));
    const base=timed(()=>s.captureBeforeNativeInstall(binding));
    const baseClone=timed(()=>structuredClone(base.value));
    const staged=timed(()=>{
      try{s.prepareTerrain(binding.commandId,1,edits,requests,plan);return "ok";}
      catch(e){return e instanceof Error?e.message:String(e);}
    });
    if(p.blocked){
      expect(staged.value).toContain("BudgetExceeded");
      const state=s.read();expect(state.terrainGeneration).toBe(1);expect(state.terrainTransaction).toBe("Idle");
      expect(state.colliderCount).toBe(old.colliderCount);expect(state.bodyCount).toBe(old.bodyCount);
      expect(baseRay()?.ownerId).toBe(null);
      return {outcome:staged.value,bodies:old.bodyCount,colliders:old.colliderCount,
        metrics:{nativePrepareWithRollbackMs:staged.ms} as Metrics};
    }
    expect(staged.value).toBe("ok");
    let publications=0,queryPublicationMs=0;
    const publish=R.World.prototype.updateSceneQueries;
    const spy=vi.spyOn(R.World.prototype,"updateSceneQueries").mockImplementation(function(this:R.World){
      const start=performance.now();try{return publish.call(this);}finally{queryPublicationMs+=performance.now()-start;publications++;}
    });
    let nativeCommitMs:number;
    try{nativeCommitMs=timed(()=>s.commitTerrain(binding.commandId)).ms;}finally{spy.mockRestore();}
    expect(publications).toBe(1);
    const forward=timed(()=>s.captureTerrainRecovery(binding));
    const finalizeMs=timed(()=>s.finalizeTerrain(binding.commandId)).ms;
    const read=timed(()=>s.read());
    const replyClone=timed(()=>structuredClone({snapshot:read.value,terrainMotion:forward.value,sourceViews:sourceViews.value}));
    const firstRay=timed(armRay);
    const gap=baseRay();
    expect(firstRay.value?.ownerId).toBe(request.ownerId);expect(gap).toBeNull();
    expect(read.value.ticks).toBe(old.ticks);expect(read.value.terrainGeneration).toBe(2);
    expect(read.value.terrainFragments.find(v=>v.ownerId===request.ownerId)?.massKg).toBe(1722.65625);
    expect(baseClone.value.bodies).toHaveLength(p.bodies);
    expect(replyClone.value.terrainMotion.bodies).toHaveLength(p.bodies+1);
    const metrics:Metrics={nativePlanMs,sourceViewsMs:sourceViews.ms,baseMotionMs:base.ms,baseCloneMs:baseClone.ms,
      nativePrepareMs:staged.ms,nativeCommitMs,queryPublicationMs,forwardMotionMs:forward.ms,finalizeMs,
      snapshotMs:read.ms,replyCloneMs:replyClone.ms,firstArmRayMs:firstRay.ms};
    metrics.measuredNativePathMs=Object.entries(metrics).filter(([key])=>key!=="queryPublicationMs"&&key!=="firstArmRayMs").reduce((n,[,ms])=>n+ms,0);
    return {outcome:"Applied",bodies:old.bodyCount,colliders:old.colliderCount,metrics};
  }finally{s.dispose();}
}

// Run from apps/weltraum-browser with HESTIA_NATIVE_OCCUPANCY_OUT=/absolute/output.json npm test -- --config tests/performance/componentIndex/vitest.config.mts tests/performance/componentIndex/nativeWorldOccupancy.test.ts
it.skipIf(!out)("qualifies one exact native rock-arm mutation across independently varied real HVP occupancy",async()=>{
  const g=geometry(),tiles=Array.from({length:4063},(_,i)=>tile(i));
  const profile=JSON.parse(readFileSync("vendor/rapier-phy01-positive-margin-r05/profile.json","utf8"));
  const digest=createHash("sha256").update(readFileSync("vendor/rapier-phy01-positive-margin-r05/dist/src/rapier_wasm3d_bg.wasm")).digest("hex");
  expect(digest).toBe(profile.wasmSha256);
  const sampleCount=Number(process.env.HESTIA_NATIVE_OCCUPANCY_SAMPLES??7);
  if(!Number.isSafeInteger(sampleCount)||sampleCount<1||sampleCount>31)throw new RangeError("Use 1 to 31 measured repetitions per profile");
  const rounds=[];
  for(let round=-1;round<sampleCount;round++){
    const cases=[];
    for(const p of (round%2===0?profiles:[...profiles].reverse()))cases.push({profile:p,...await run(g,tiles,p)});
    rounds.push({round,warmup:round<0,cases});
  }
  const summary=profiles.map(p=>{
    const samples=rounds.filter(r=>!r.warmup).flatMap(r=>r.cases.filter(c=>c.profile===p));
    const metric=Object.fromEntries(Object.keys(samples[0]!.metrics).map(k=>{
      const sorted=samples.map(s=>s.metrics[k]!).sort((a,b)=>a-b);
      return [k,{median:sorted[Math.ceil(sorted.length*.5)-1],sampleP95:sorted[Math.ceil(sorted.length*.95)-1],min:sorted[0],max:sorted.at(-1)}];
    }));
    return {...p,n:samples.length,outcome:samples[0]!.outcome,colliders:samples[0]!.colliders,ms:metric};
  });
  const evidence={commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),node:process.version,cpu:cpus()[0]?.model,
    measuredAt:new Date().toISOString(),wasmSha256:digest,
    scope:"Node R05 WASM native session, single 32x32 coast column. Busy standalone static tiles. Measured active spans, synchronous structuredClone proxies. No IPC, solver step, rendering or click-to-ack latency.",
    bytes:{replacement:g.after.vertices.byteLength+g.after.indices.byteLength,previous:g.before.vertices.byteLength+g.before.indices.byteLength,
      compactParts:g.request.compactSource!.parts.length,compactRuns:g.request.compactSource!.parts.reduce((n,p)=>n+p.runs.length,0),
      triangles:g.after.indices.length/3,backgroundTrianglesPerTile:2},summary,rounds};
  writeFileSync(out!,JSON.stringify(evidence,null,2));
},240000);
