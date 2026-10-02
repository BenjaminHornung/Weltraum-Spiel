import {beforeAll,beforeEach,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpBodyCutSession,createHvpOwnedHashBodyCutSession,type HvpBodyPlanHost,type HvpBodyPlanTrace,type HvpMovingCutPreparation} from "../../src/hestia-prototype/physics/bodyCutSession";
import {prepareHvpBodyCutSteps} from "../../src/hestia-prototype/physics/bodyCut";
import {prepareHvpLocalBodyCut,readHvpBodyCells} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {executeHvpBodyCutJob,decodeHvpBodyCutOutput,hvpBodyCutInputDigest,HVP_BODY_CUT_JOB,HVP_BODY_CUT_MAX_OUTPUT} from "../../src/workers/hvpBodyCutJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey,type TransferableBufferBundle} from "../../src/workers";
import type {HvpPhysicsClock,HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";

// The client test has no collision sources; the pool is not the subject here.
vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {
  async start():Promise<void>{}
  async shutdown():Promise<void>{}
}}));
// Counts owner-local native plan derivations; the implementation itself is unchanged.
vi.mock("../../src/hestia-prototype/physics/bodyCut",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
  return {...actual,prepareHvpBodyCutSteps:vi.fn(actual.prepareHvpBodyCutSteps)};
});
const planCalls=()=>vi.mocked(prepareHvpBodyCutSteps).mock.calls.length;
/**
 * Observes the private owned-payload hash cursor (pure; no shared state, so the cached factory result
 * is safe across resetModules): cursors created/disposed, advances, and whether the last advance left
 * the hash suspended at one of its yields.
 */
const hashProbe=vi.hoisted(()=>({cursors:0,disposed:0,advances:0,suspended:false}));
vi.mock("../../src/voxel/adaptive/ownedCanonicalHashSteps",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/voxel/adaptive/ownedCanonicalHashSteps")>();
  return {...actual,createOwnedCanonicalHashCursor:(payload:unknown,sink?:(bytes:Uint8Array)=>void)=>{
    const cursor=actual.createOwnedCanonicalHashCursor(payload,sink);
    hashProbe.cursors+=1;
    return {
      advance(units:number){
        hashProbe.advances+=1;
        const result=cursor.advance(units);
        hashProbe.suspended=result===undefined;
        return result;
      },
      dispose(){
        hashProbe.suspended=false;
        hashProbe.disposed+=1;
        cursor.dispose();
      }
    };
  }};
});
const resetHashProbe=()=>{
  Object.assign(hashProbe,{cursors:0,disposed:0,advances:0,suspended:false});
};

beforeAll(initializeHvpRapier);
beforeEach(()=>{vi.mocked(prepareHvpBodyCutSteps).mockClear();resetHashProbe();});

const wood=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
/** The independent compile-worker product path, exactly as the runtime consumes it. */
const products=(preparation:HvpMovingCutPreparation)=>{
  const p=preparation.payload,raw=new Int32Array(preparation.cells.flatMap(c=>[c.x,c.y,c.z,c.materialId])),buffers=[raw.buffer];
  const input:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(p.revision),buffers,byteLength:byteCount(raw.byteLength),
    views:[{name:"cells",kind:"Int32Array",bufferIndex:0,byteOffset:0,elementCount:raw.length}]};
  const job={jobId:workerJobId("body-plan-owner"),jobKind:workerJobKind(HVP_BODY_CUT_JOB),targetKey:workerTargetKey(p.ownerId),planningEpoch:planningEpoch(0),
    workerEpoch:workerEpoch(0),inputRevision:contentRevision(p.revision),sourceInputDigest:hvpBodyCutInputDigest(p,buffers),algorithmVersion:algorithmVersion(1),
    priority:"Urgent" as const,deadline:jobDeadline(1),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_CUT_MAX_OUTPUT),payload:p};
  return decodeHvpBodyCutOutput(executeHvpBodyCutJob(job,input).bundle,p);
};
/** Five cells along x; the eye ray hits cell x=2 (independent of any plan output). */
const fixture=(cells=Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),materials=wood)=>{
  const world=new R.World({x:0,y:0,z:0}),source=ingestHvpStructuralCells("plan-owner-source",cells,materials);
  const recipe=prepareHvpRigidBody(source),body=installHvpRigidBody(world,recipe);
  const target={ownerId:"plan-owner-parent",body,recipe},targets=new Map([[target.ownerId,target]]),bodies=new Map([[target.ownerId,body]]);
  const session=createHvpBodyCutSession(world,targets,bodies,"plan-owner");
  const request={id:"plan-cut",ownerId:target.ownerId,sourceDigest:source.contentHash,edge:1,direction:{x:0,y:0,z:1}};
  return {world,body,target,targets,bodies,session,request,eye:{x:.3125,y:.0625,z:-1}};
};
const taskHost=(onYield:()=>void=()=>undefined):HvpBodyPlanHost&{yields:number}=>{
  const host={
    yields:0,
    yieldTask:()=>new Promise<void>(resolve=>{
      host.yields+=1;
      onYield();
      setTimeout(resolve,0);
    }),
    assertCurrent:()=>undefined
  };
  return host;
};
const childXs=(f:ReturnType<typeof fixture>)=>f.session.read().last!.children
  .map(id=>readHvpBodyCells(f.targets.get(id)!.recipe.source).map(c=>c.x).sort((a,b)=>a-b));
/**
 * Child order is the unchanged canonical component order of the classification
 * (pre-change `classification.components.map`), here the {3,4} component first.
 * The independent compile-worker product must agree in the same order.
 */
const expectCanonicalChildren=(f:ReturnType<typeof fixture>,built:ReturnType<typeof products>)=>{
  expect(childXs(f)).toEqual([[3,4],[0,1]]);
  expect(childXs(f)).toEqual(built.parts.map(part=>part.cells.map(c=>c.x).sort((a,b)=>a-b)));
};

it("derives exactly one native plan per command across task-yielding preparation, a failed stage and its retry",async()=>{
  const f=fixture();
  const create=vi.spyOn(f.world,"createCollider");
  try{
    const prep=f.session.begin(f.request,f.eye,0),built=products(prep);
    expect(planCalls()).toBe(0);
    const host=taskHost();
    await f.session.preparePlan(f.request.id,host);
    expect(planCalls()).toBe(1);
    // Several whole phases, each separated by a real macrotask yield.
    expect(host.yields).toBeGreaterThanOrEqual(3);
    expect(f.session.holdsWorld).toBe(false);
    expect(f.session.read().state).toBe("Preparing");
    create.mockImplementationOnce(()=>{throw new Error("injected child collider failure");});
    expect(()=>f.session.stage(f.request.id,built,1)).toThrow(/injected child collider failure/);
    expect(f.session.read().state).toBe("Preparing");
    expect(f.world.bodies.len()).toBe(1);
    await f.session.preparePlan(f.request.id,taskHost());
    f.session.stage(f.request.id,built,2);
    expect(planCalls()).toBe(1);
    expect(f.session.read().state).toBe("PreparedHeld");
    f.session.commit(f.request.id);f.session.finalize(f.request.id);
    expect(f.session.read().last!.status).toBe("Applied");
    expectCanonicalChildren(f,built);
    expect(planCalls()).toBe(1);
  }finally{create.mockRestore();f.world.free();}
},120_000);

it("keeps the parent simulated between plan phases and stages the original hit at the current native pose",async()=>{
  const f=fixture();
  try{
    const prep=f.session.begin(f.request,f.eye,0),built=products(prep);
    const issuedPose={...f.body.translation()};
    f.body.setLinvel({x:1,y:.2,z:.1},true);f.body.setAngvel({x:.2,y:.3,z:.4},true);
    const castRay=vi.spyOn(f.world,"castRay");
    // Each yield stands for the owner's fixed-step timer running between phases.
    await f.session.preparePlan(f.request.id,taskHost(()=>{f.world.step();}));
    const now={...f.body.translation()},rotation={...f.body.rotation()},velocity={...f.body.linvel()},spin={...f.body.angvel()};
    expect(now.x).toBeGreaterThan(issuedPose.x);
    f.session.stage(f.request.id,built,9);
    expect(castRay).not.toHaveBeenCalled();
    const last=f.session.read().last!;
    expect(last.parentPose).toEqual({position:now,rotation,velocity,angularVelocity:spin});
    expect(last.issuedTick).toBe(0);expect(last.commitTick).toBe(9);
    expect(last.removedCells).toBe(1);
    f.session.commit(f.request.id);f.session.finalize(f.request.id);
    expectCanonicalChildren(f,built);
  }finally{f.world.free();}
},120_000);

it("drops a cancelled or disposed preparation: no revived plan, no stage and unchanged native membership",async()=>{
  const f=fixture();
  try{
    f.session.begin(f.request,f.eye,0);
    const cancelled=f.session.preparePlan(f.request.id,taskHost());
    f.session.rollback(f.request.id);
    await expect(cancelled).rejects.toThrow(/Moving preparation cancelled/);
    expect(f.session.read()).toMatchObject({state:"Idle",pendingId:null});
    expect(f.world.bodies.len()).toBe(1);expect(f.targets.get(f.target.ownerId)).toBe(f.target);
    await expect(f.session.preparePlan(f.request.id,taskHost())).rejects.toThrow(/Stale body preparation/);
    const retry={...f.request,id:"plan-cut-disposed"},prep=f.session.begin(retry,f.eye,1);
    let disposed=false;
    const host={...taskHost(()=>{disposed=true;}),assertCurrent:()=>{if(disposed){throw new Error("owner disposed probe");}}};
    await expect(f.session.preparePlan(retry.id,host)).rejects.toThrow(/owner disposed probe/);
    expect(f.world.bodies.len()).toBe(1);expect(f.session.holdsWorld).toBe(false);
    // The disposal outcome is sticky: even valid products cannot resume the abandoned steps.
    expect(()=>f.session.stage(retry.id,products(prep),2)).toThrow(/owner disposed probe/);
    expect(f.world.bodies.len()).toBe(1);
    f.session.rollback(retry.id);
    expect(planCalls()).toBe(2);
  }finally{f.world.free();}
},120_000);

it("keeps a rejected task-yield adapter fatal for the command instead of resuming the steps in Stage",async()=>{
  const f=fixture();
  try{
    const prep=f.session.begin(f.request,f.eye,0),built=products(prep),colliders=f.world.colliders.len();
    const adapterError=new Error("yield adapter rejected");
    const host:HvpBodyPlanHost={yieldTask:()=>Promise.reject(adapterError),assertCurrent:()=>undefined};
    let prepared:unknown,staged:unknown,again:unknown;
    try{await f.session.preparePlan(f.request.id,host);}catch(error){prepared=error;}
    try{f.session.stage(f.request.id,built,1);}catch(error){staged=error;}
    try{await f.session.preparePlan(f.request.id,taskHost());}catch(error){again=error;}
    expect(prepared).toBe(adapterError);
    expect(staged).toBe(adapterError);
    expect(again).toBe(adapterError);
    expect(f.world.bodies.len()).toBe(1);expect(f.world.colliders.len()).toBe(colliders);
    expect(f.session.read()).toMatchObject({state:"Preparing",pendingId:f.request.id});
    expect(f.session.holdsWorld).toBe(false);
    f.session.rollback(f.request.id);
    expect(f.session.read().state).toBe("Idle");
    expect(planCalls()).toBe(1);
  }finally{f.world.free();}
},120_000);

it("rejects a removed or replaced parent after a finished plan without touching the World",async()=>{
  const f=fixture();
  try{
    const prep=f.session.begin(f.request,f.eye,0),built=products(prep);
    await f.session.preparePlan(f.request.id,taskHost());
    f.world.removeRigidBody(f.body);
    expect(()=>f.session.stage(f.request.id,built,1)).toThrow(/Stale, removed or unvalidated body cut/);
    expect(f.world.bodies.len()).toBe(0);
    const replacement={...f.target,body:installHvpRigidBody(f.world,f.target.recipe)};
    f.targets.set(replacement.ownerId,replacement);
    expect(()=>f.session.stage(f.request.id,built,2)).toThrow(/Stale body preparation/);
    await expect(f.session.preparePlan(f.request.id,taskHost())).rejects.toThrow(/Stale body preparation/);
    expect(f.world.bodies.len()).toBe(1);
    expect(planCalls()).toBe(1);
  }finally{f.world.free();}
},120_000);

it("keeps the original plan error identity and never stages a protected Sphere cut",async()=>{
  const f=fixture(undefined,[{...wood[0]!,destructible:false}]);
  try{
    const {session,traces}=tracedSession(f);
    session.begin({...f.request,brush:"Sphere"},f.eye,0);
    let prepared:unknown,staged:unknown;
    try{await session.preparePlan(f.request.id,taskHost());}catch(error){prepared=error;}
    try{session.stage(f.request.id,{removedCells:1,removedMassKg:1,parts:[]},1);}catch(error){staged=error;}
    expect(String(prepared)).toMatch(/Protected body material/);
    expect(staged).toBe(prepared);
    expect(f.world.bodies.len()).toBe(1);expect(session.read().state).toBe("Preparing");
    expect(planCalls()).toBe(1);
    // The throwing first step is traced once as failedStep; no phase label is invented for it.
    expect(traces).toMatchObject([{outcome:"Failed",totalSteps:1}]);
    expect(traces[0]!.steps.map(step=>step.label)).toEqual(["failedStep"]);
  }finally{f.world.free();}
},120_000);

it("stages a Sphere that removes every cell with zero children and no invented body",async()=>{
  const f=fixture([{x:0,y:0,z:0,materialId:1}]);
  try{
    const {session,traces}=tracedSession(f);
    const request={...f.request,brush:"Sphere" as const},prep=session.begin(request,{x:.0625,y:.0625,z:-1},0),built=products(prep);
    expect(built.parts).toHaveLength(0);
    await session.preparePlan(request.id,taskHost());
    // Empty remainder: no cell batch and no child recipe label; the part boundary names the parent mass.
    expect(traces).toMatchObject([{outcome:"Planned",totalSteps:4}]);
    expect(traces[0]!.steps.map(step=>step.label)).toEqual(["destruction","classification","parentMass","removedMass"]);
    session.stage(request.id,built,1);
    expect(session.read().last).toMatchObject({children:[],removedCells:1,removedMassKg:.125**3*512});
    session.commit(request.id);session.finalize(request.id);
    expect(f.world.bodies.len()).toBe(0);expect(f.world.colliders.len()).toBe(0);expect(f.targets.size).toBe(0);
    expect(planCalls()).toBe(1);
  }finally{f.world.free();}
},120_000);

const floor={sizeX:64,sizeY:8,sizeZ:64,cellMeters:.125,originMeters:{x:-4,y:-.125,z:-4},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]};
const aimAt=(point:{x:number;y:number;z:number},position:{x:number;y:number;z:number})=>{
  const dx=point.x-position.x,dy=point.y-(position.y+.75),dz=point.z-position.z,length=Math.hypot(dx,dy,dz);
  return {x:dx/length,y:dy/length,z:dz/length};
};
const admissionFor=(prep:HvpMovingCutPreparation)=>{
  const p=prep.payload,local=prepareHvpLocalBodyCut(ingestHvpStructuralCells(p.sourceId,prep.cells,p.materials),p.cell,p.commandId,p.edge);
  return {removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg,parts:local.plan.parts.map(part=>({
    ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,massKg:part.recipe.mass.totalMassKg,center:part.recipe.mass.centerOfMassMeters!}))};
};

it.each(["Running","Paused"] as const)("runs session source preparation outside the World hold and preserves %s after release",async mode=>{
  const source=await createHvpPhysicsSession([...collisionSectors(floor)],{x:-2,y:3,z:-2},9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},
    "plan-owner-world",undefined,"branch",true);
  try{
    source.play();source.advance(1/60);
    source.prepareBranch({id:"release",generation:0,sourceDigest:source.read().structural!.sourceDigest,
      direction:aimAt({x:.75,y:1.25,z:0},source.read().player!.position)});
    source.commitBranch("release");source.finalizeBranch("release");
    const parent=source.read().structural!.parts.find(p=>!p.anchored)!,direction=aimAt(parent.position,source.read().player!.position);
    source.aimBranch(direction);
    const hit=source.read().moving.preview!;
    const prep=source.beginBodyCut({id:"recut",ownerId:parent.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction});
    const admission=admissionFor(prep),ticks=source.read().ticks;
    const preparing=source.prepareBodyCutPlan("recut");
    // Between phases the owner still simulates, unless the player pauses.
    source.advance(1/60);
    expect(source.read()).toMatchObject({status:"Running",ticks:ticks+1,moving:{state:"Preparing"}});
    if(mode==="Paused"){
      source.pause();
      expect(()=>source.checkpoint()).toThrow(/confirmed paused generation/);
    }
    await preparing;
    expect(planCalls()).toBe(1);
    expect(source.read().status).toBe(mode);
    source.stageBodyCut("recut",admission);
    expect(source.bodyPrepareSpans()).toMatchObject({transactionId:"recut",holdMs:null,manualPause:mode==="Paused"});
    source.commitBodyCut("recut");source.finalizeBodyCut("recut");
    expect(source.read()).toMatchObject({status:mode,moving:{state:"Idle",last:{status:"Applied"}}});
    if(mode==="Running"){expect(source.bodyPrepareSpans()?.holdMs).not.toBeNull();}
    else{expect(source.bodyPrepareSpans()?.holdMs).toBeNull();}
    expect(planCalls()).toBe(1);
  }finally{source.dispose();}
},120_000);

const INGEST_SUBSPANS=["ingestSortRunsMs","ingestJournalMs","ingestMaterializeMs","ingestProofsMs","ingestStructuralMs","ingestTotalMs"];
/**
 * Splits the child part of a plan's step list into per-child groups and checks their shape:
 * zero or more `childClassificationCells` batches, then exactly `childRecipe{i}` in order.
 */
const childGroups=<S extends {label:string}>(steps:readonly S[]):S[][]=>{
  const groups:S[][]=[];
  let current:S[]=[];
  for(const step of steps){
    current.push(step);
    if(step.label!=="childClassificationCells"){
      expect(step.label).toBe(`childRecipe${groups.length}`);
      groups.push(current);
      current=[];
    }
  }
  expect(current).toEqual([]);
  return groups;
};
it.each(["on","off","disabledMidYield"] as const)("logs slow contiguous plan steps and their existing sub-hooks only while measuring (%s)",async mode=>{
  const measure=mode!=="off";
  const source=await createHvpPhysicsSession([...collisionSectors(floor)],{x:-2,y:3,z:-2},9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},
    "plan-trace-world",undefined,"branch",measure);
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  try{
    source.play();source.advance(1/60);
    source.prepareBranch({id:"release",generation:0,sourceDigest:source.read().structural!.sourceDigest,
      direction:aimAt({x:.75,y:1.25,z:0},source.read().player!.position)});
    source.commitBranch("release");source.finalizeBranch("release");
    const parent=source.read().structural!.parts.find(p=>!p.anchored)!,direction=aimAt(parent.position,source.read().player!.position);
    source.aimBranch(direction);
    const hit=source.read().moving.preview!;
    source.beginBodyCut({id:"recut",ownerId:parent.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction});
    // Every clock read advances 10 ms, so every traced contiguous step reaches the 8 ms threshold.
    let clock=0;
    const now=vi.spyOn(performance,"now").mockImplementation(()=>(clock+=10));
    try{
      const preparing=source.prepareBodyCutPlan("recut");
      if(mode==="disabledMidYield"){
        // The first step already ran traced; the opt-out arrives at the first task yield.
        source.disableBodyPlanTrace();
        now.mockClear();
      }
      await preparing;
      if(mode==="disabledMidYield"){
        // No step timing, ingest span or recipe span reads the clock after the opt-out.
        expect(now).not.toHaveBeenCalled();
      }
    }finally{now.mockRestore();}
    const lines=debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
    if(mode!=="on"){
      expect(lines).toEqual([]);
    }else{
      expect(lines).toHaveLength(1);
      const trace=JSON.parse(lines[0]!.slice("hvp-body-plan-steps ".length)) as {commandId:string;outcome:string;origin:number;steps:number;
        truncatedSteps:number;max:{label:string;durationMs:number};phases:{label:string;count:number;totalMs:number;maxMs:number}[];
        slow:{ordinal:number;label:string;durationMs:number;sub?:{phase:string;durationMs:number}[]}[]};
      expect(trace).toMatchObject({commandId:"recut",outcome:"Planned",origin:performance.timeOrigin,truncatedSteps:0});
      expect(trace.max.durationMs).toBeGreaterThanOrEqual(10);
      expect(trace.slow).toHaveLength(trace.steps);
      expect(trace.slow.map(step=>step.ordinal)).toEqual(Array.from({length:trace.steps},(_,i)=>i));
      // Labels are issued by the plan's own yields: destruction, bounded cell batches, the rest of the
      // classification, parent mass, one step per child recipe, removed mass.
      const labels=trace.slow.map(step=>step.label);
      const cells=labels.filter(label=>label==="classificationCells").length;
      expect(cells).toBeGreaterThanOrEqual(1);
      expect(labels.slice(0,cells+3)).toEqual(["destruction",...Array.from({length:cells},()=>"classificationCells"),"classification","parentMass"]);
      expect(labels.at(-1)).toBe("removedMass");
      const groups=childGroups(trace.slow.slice(cells+3,-1));
      expect(groups.length).toBeGreaterThanOrEqual(1);
      expect(trace.phases.find(phase=>phase.label==="classificationCells")).toMatchObject({count:cells});
      expect(trace.phases.reduce((n,phase)=>n+phase.count,0)).toBe(trace.steps);
      // Existing hooks only: no subspans for the hook-less parent phases.
      for(const step of trace.slow.slice(0,cells+3)){expect(step.sub).toBeUndefined();}
      // Per child: its steps (own cell batches, then childRecipe{i}) carry exactly the existing hooks in order.
      for(const group of groups){
        expect(group.flatMap(step=>step.sub??[]).map(sub=>sub.phase)).toEqual(["partCellsMs",...INGEST_SUBSPANS,
          "recipeMassMs","recipeClassifyMs","recipeTransitionMs","recipeAxesMs"]);
      }
      expect(trace.slow.at(-1)!.sub!.map(sub=>sub.phase)).toEqual(["removedFilterMs",...INGEST_SUBSPANS,"removedMassDeriveMs"]);
      for(const step of trace.slow){for(const sub of step.sub??[]){expect(sub.durationMs).toBeGreaterThanOrEqual(0);}}
    }
    // Observation does not change the owner outcome.
    expect(source.read().moving).toMatchObject({state:"Preparing",pendingId:"recut"});
    source.rollbackBodyCut("recut");
    expect(source.read().moving.state).toBe("Idle");
  }finally{debug.mockRestore();source.dispose();}
},120_000);

type WorkerHost={onmessage?:(event:MessageEvent<HvpPhysicsMessage>)=>void|Promise<void>;postMessage?:(reply:HvpPhysicsReply)=>void};
type WorkerRequest=HvpPhysicsMessage extends infer M?M extends HvpPhysicsMessage?Omit<M,"id">:never:never;
type WorkerHarness={
  send(message:WorkerRequest):Promise<HvpPhysicsReply>;
  dispatch(message:WorkerRequest):{id:number;done:Promise<void>};
  reply(id:number):HvpPhysicsReply|undefined;
  tick(ms:number):void;
  gate(enabled:boolean):void;
  /** Releases one gated source-only task yield and lets its continuation run. */
  release():Promise<boolean>;
  readonly gatedYields:number;
  /** Native plan derivations inside the freshly loaded worker module graph (Worker owner-hash route). */
  planCount():number;
  /** Advances the fixed clock by `ms` on every read (0 = fixed), so contiguous steps get a known duration. */
  autoClock(ms:number):void;
};

/** What the cleanup saw right before the Worker globals were restored (harness self-test only). */
interface WorkerCleanupReport {readonly drained:boolean;readonly cleanupError:unknown;readonly reply:(id:number)=>HvpPhysicsReply|undefined}
interface WorkerHarnessOptions {
  /** One-shot: the cleanup's Dispose reply is reported as failed AFTER the real handler ran. */
  readonly failDisposeReply?:boolean;
  readonly observeCleanup?:(report:WorkerCleanupReport)=>void;
}
/** The real worker module with a fixed clock and test-gated task yields, as in the mature body-clock fixture. */
const withWorker=async(measure:boolean,body:(worker:WorkerHarness)=>Promise<void>,options:WorkerHarnessOptions={})=>{
  vi.resetModules();
  // The hoisted factory result is cached across resetModules; a fresh counting factory keeps bodyCut
  // and rigidRecipe (with its issued-recipe WeakSet) in ONE module graph with the new worker.
  vi.doMock("../../src/hestia-prototype/physics/bodyCut",async importOriginal=>{
    const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
    return {...actual,prepareHvpBodyCutSteps:vi.fn(actual.prepareHvpBodyCutSteps),
      prepareHvpBodyCutOwnedHashSteps:vi.fn(actual.prepareHvpBodyCutOwnedHashSteps)};
  });
  let generic:{mock:{calls:unknown[]}}|undefined;
  let now=0,autoStep=0,id=0,loaded=false,gated=false,gatedYields=0;
  let original:{readonly error:unknown}|undefined;
  let failDisposeReply=options.failDisposeReply===true;
  let planned:{mock:{calls:unknown[]}}|undefined;
  const intervals:(()=>void)[]=[],replies:HvpPhysicsReply[]=[],queued:(()=>void)[]=[];
  // Every dispatched handler; cleanup awaits them all (bounded) before the Worker globals are restored.
  const dispatched:Promise<void>[]=[];
  const saved={setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,
    onmessage:Object.getOwnPropertyDescriptor(globalThis,"onmessage"),postMessage:Object.getOwnPropertyDescriptor(globalThis,"postMessage")};
  const host=globalThis as typeof globalThis&WorkerHost;
  const settle=()=>new Promise<void>(resolve=>{saved.setTimeout(resolve,0);});
  const nowSpy=vi.spyOn(performance,"now").mockImplementation(()=>{
    now+=autoStep;
    return now;
  });
  const dispatch=(message:WorkerRequest)=>{
    const next={...message,id:++id} as HvpPhysicsMessage;
    const done=Promise.resolve(host.onmessage!({data:next} as MessageEvent<HvpPhysicsMessage>));
    dispatched.push(done);
    return {id:next.id,done};
  };
  const harness:WorkerHarness={
    async send(message){
      const sent=dispatch(message);
      await sent.done;
      const reply=replies.find(value=>value.id===sent.id);
      if(reply===undefined){throw new Error(`No physics reply for ${sent.id}`);}
      if(message.kind==="Dispose"&&failDisposeReply){
        failDisposeReply=false;
        throw new Error("injected Dispose reply failure");
      }
      expect(reply.error).toBeUndefined();
      return reply;
    },
    dispatch,
    reply:value=>replies.find(reply=>reply.id===value),
    tick(ms){now+=ms;intervals[0]!();},
    gate(enabled){gated=enabled;},
    async release(){
      const next=queued.shift();
      if(next===undefined){return false;}
      next();
      await settle();
      return true;
    },
    get gatedYields(){return gatedYields;},
    planCount:()=>planned!.mock.calls.length,
    autoClock(ms){autoStep=ms;}
  };
  try{
    globalThis.setInterval=((handler:TimerHandler)=>{intervals.push(handler as ()=>void);return 1 as unknown as ReturnType<typeof setInterval>;}) as unknown as typeof setInterval;
    globalThis.clearInterval=(()=>undefined) as typeof clearInterval;
    globalThis.setTimeout=((handler:TimerHandler,ms?:number)=>{
      if(!gated){return saved.setTimeout(handler as ()=>void,ms);}
      gatedYields+=1;queued.push(handler as ()=>void);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout;
    host.postMessage=reply=>{replies.push(reply);};
    await import("../../src/hestia-prototype/physics/physicsWorker");
    const counted=await import("../../src/hestia-prototype/physics/bodyCut");
    planned=vi.mocked(counted.prepareHvpBodyCutOwnedHashSteps);
    generic=vi.mocked(counted.prepareHvpBodyCutSteps);
    loaded=true;
    await harness.send({kind:"Initialize",sectors:[...collisionSectors(floor)],spawn:{x:-2,y:3,z:-2},gravity:9.81,player,
      inertiaSpawn:{x:2,y:2,z:2},branchSpawn:{x:0,y:0,z:0},sessionId:"worker-plan-owner",measure});
    await harness.send({kind:"Play"});
    harness.tick(1000/60);
    await body(harness);
    // The first-party Worker (also its Restore candidates) never takes the generic body hash route.
    expect(generic!.mock.calls).toHaveLength(0);
  }catch(error){
    original={error};
    throw error;
  }finally{
    // Each cleanup step is isolated: a failed release or Dispose never skips awaiting the dispatched handlers.
    let cleanup:{readonly error:unknown}|undefined;
    const attempt=async(run:()=>Promise<void>):Promise<void>=>{
      try{await run();}catch(error){cleanup??={error};}
    };
    gated=false;autoStep=0;
    while(queued.length>0){
      const next=queued.shift()!;
      await attempt(async()=>{next();await settle();});
    }
    if(loaded){await attempt(async()=>{await harness.send({kind:"Dispose"});});}
    // A plan left pending by a failed assertion ends at its next resume (disposed owner) and replies
    // before postMessage/onmessage are restored; bounded so cleanup can never hang the suite.
    let deadline:ReturnType<typeof setTimeout>|undefined;
    const drained=await Promise.race([Promise.allSettled(dispatched).then(()=>true),
      new Promise<boolean>(resolve=>{deadline=saved.setTimeout(()=>{resolve(false);},10_000);})]);
    saved.clearTimeout(deadline);
    if(!drained){cleanup??={error:new Error("withWorker cleanup: dispatched Worker handlers still unresolved after 10 s")};}
    try{
      options.observeCleanup?.(Object.freeze({drained,cleanupError:cleanup?.error,reply:harness.reply}));
    }finally{
      nowSpy.mockRestore();
      globalThis.setInterval=saved.setInterval;globalThis.clearInterval=saved.clearInterval;globalThis.setTimeout=saved.setTimeout;
      if(saved.onmessage===undefined){Reflect.deleteProperty(globalThis,"onmessage");}else{Object.defineProperty(globalThis,"onmessage",saved.onmessage);}
      if(saved.postMessage===undefined){Reflect.deleteProperty(globalThis,"postMessage");}else{Object.defineProperty(globalThis,"postMessage",saved.postMessage);}
    }
    // A secondary cleanup failure never replaces the original test failure.
    if(cleanup!==undefined&&original===undefined){
      throw cleanup.error;
    }
  }
};
/** Branch release, aim and BeginBodyCut through the real worker, then the independent admission. */
const beginWorkerBodyCut=async(worker:WorkerHarness)=>{
  const start=await worker.send({kind:"Read"});
  const released=await worker.send({kind:"PrepareBranch",request:{id:"release",generation:0,sourceDigest:start.snapshot!.structural!.sourceDigest,
    direction:aimAt({x:.75,y:1.25,z:0},start.snapshot!.player!.position)}});
  expect(released.rejected).toBeUndefined();
  await worker.send({kind:"CommitBranch",transactionId:"release"});
  await worker.send({kind:"FinalizeBranch",transactionId:"release"});
  return beginWorkerRecut(worker,"recut");
};
/** Aims at the released timber parent again and begins a new body command with its own id. */
const beginWorkerRecut=async(worker:WorkerHarness,id:string)=>{
  const before=await worker.send({kind:"Read"});
  const parent=before.snapshot!.structural!.parts.find(part=>!part.anchored)!,direction=aimAt(parent.position,before.snapshot!.player!.position);
  const hit=(await worker.send({kind:"Read",cutAim:direction})).snapshot!.moving.preview!;
  expect(hit.ownerId).toBe(parent.ownerId);
  const begun=await worker.send({kind:"BeginBodyCut",request:{id,ownerId:hit.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction}});
  expect(begun.rejected).toBeUndefined();
  return admissionFor(begun.bodyPreparation!);
};
/** Starts the source-only plan and proves it is suspended at its first gated task yield. */
const suspendWorkerPlan=async(worker:WorkerHarness,id="recut")=>{
  worker.gate(true);
  const plan=worker.dispatch({kind:"PrepareBodyPlan",transactionId:id});
  await new Promise<void>(resolve=>{queueMicrotask(resolve);});
  expect(worker.gatedYields).toBe(1);
  expect(worker.reply(plan.id)).toBeUndefined();
  return plan;
};
const drainWorkerPlan=async(worker:WorkerHarness,plan:{id:number;done:Promise<void>})=>{
  for(let released=0;worker.reply(plan.id)===undefined;released+=1){
    // Runaway guard only: the owner hash adds one bounded yield per cursor batch.
    expect(released).toBeLessThan(4096);
    expect(await worker.release()).toBe(true);
  }
  await plan.done;
  worker.gate(false);
  return worker.reply(plan.id)!;
};

it("serves Read, input and the fixed-step timer while the worker's source-only plan is suspended",async()=>{
  await withWorker(false,async worker=>{
    const admission=await beginWorkerBodyCut(worker);
    const plan=await suspendWorkerPlan(worker);
    const walking=await worker.send({kind:"Read",input:{x:0,z:1,sprint:false,jump:false}});
    expect(walking.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing",pendingId:"recut"}});
    worker.tick(1000/60);
    const released=await worker.send({kind:"Read",input:{x:0,z:0,sprint:false,jump:false}});
    expect(released.snapshot!.ticks).toBe(walking.snapshot!.ticks+1);
    expect(released.snapshot!.moving.state).toBe("Preparing");
    expect(worker.reply(plan.id)).toBeUndefined();
    const prepared=await drainWorkerPlan(worker,plan);
    expect(prepared.rejected).toBeUndefined();
    expect(prepared.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing"}});
    // Several whole phases, each behind its own real task yield.
    expect(worker.gatedYields).toBeGreaterThanOrEqual(3);
    const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut",products:admission});
    expect(staged.rejected).toBeUndefined();
    expect(staged.snapshot!.moving.state).toBe("PreparedHeld");
    await worker.send({kind:"CommitBodyCut",transactionId:"recut"});
    const finalized=await worker.send({kind:"FinalizeBodyCut",transactionId:"recut"});
    expect(finalized.snapshot).toMatchObject({status:"Running",moving:{state:"Idle",last:{status:"Applied"}}});
    expect(worker.planCount()).toBe(1);
  });
},120_000);

it("rejects Stage during a safety SimulationHold without Applied, manual-pause label, auto-resume or native mutation",async()=>{
  await withWorker(true,async worker=>{
    const admission=await beginWorkerBodyCut(worker);
    const plan=await suspendWorkerPlan(worker);
    // One long source-only phase: 200 ms exceed four fixed steps and leave backlog.
    worker.tick(200);
    const prepared=await drainWorkerPlan(worker,plan);
    expect(prepared.rejected).toBeUndefined();
    expect(prepared.snapshot).toMatchObject({status:"SimulationHold",moving:{state:"Preparing"}});
    expect(prepared.clock?.simulationHold?.gapMs).toBeCloseTo(200,6);
    const before=prepared.snapshot!;
    const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut",products:admission});
    expect(staged.rejected).toMatch(/SimulationHold: body stage requires a running or player-paused World/);
    expect(staged.snapshot).toMatchObject({status:"SimulationHold",ticks:before.ticks,bodyCount:before.bodyCount,
      colliderCount:before.colliderCount,moving:{state:"Preparing",pendingId:"recut"}});
    expect(staged.snapshot!.moving.last?.status).not.toBe("Applied");
    expect(staged.clock?.lastBodyManualPause).toBeUndefined();
    expect(staged.clock?.lastBodyHoldMs).toBeUndefined();
    expect(staged.clock?.simulationHold?.gapMs).toBeCloseTo(200,6);
    const rolledBack=await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
    expect(rolledBack.rejected).toBeUndefined();
    expect(rolledBack.snapshot).toMatchObject({status:"SimulationHold",bodyCount:before.bodyCount,moving:{state:"Idle",pendingId:null}});
    worker.tick(1000/60);
    expect((await worker.send({kind:"Read"})).snapshot).toMatchObject({status:"SimulationHold",ticks:before.ticks});
    // Only the existing explicit continuation leaves the safety hold.
    expect((await worker.send({kind:"Resume"})).snapshot!.status).toBe("Running");
  });
},120_000);

it("stops the temporary plan trace on a dynamic measure:false Read, including an in-flight plan, without changing the native cut",async()=>{
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  const planLines=()=>debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
  try{
    await withWorker(true,async worker=>{
      // Control: measurement on, every contiguous step reads 2x10 ms -> one slow-plan line.
      const control=await beginWorkerBodyCut(worker);
      worker.autoClock(10);
      const first=worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut"});
      await first.done;
      worker.autoClock(0);
      expect(worker.reply(first.id)?.rejected).toBeUndefined();
      expect(planLines()).toHaveLength(1);
      expect(planLines()[0]).toContain("\"commandId\":\"recut\"");
      // The Worker owner-hash route: one payload step per child, then its own hash batches. Aggregates
      // count every step (also beyond the 64-step record prefix); listed steps carry only plan labels.
      const logged=JSON.parse(planLines()[0]!.slice("hvp-body-plan-steps ".length)) as {steps:number;truncatedSteps:number;
        phases:{label:string;count:number}[];slow:{label:string}[]};
      const counts=Object.fromEntries(logged.phases.map(phase=>[phase.label,phase.count]));
      expect(control.parts.length).toBeGreaterThanOrEqual(1);
      expect(counts.childTransitionPayload).toBe(control.parts.length);
      expect(counts.childHash).toBeGreaterThanOrEqual(control.parts.length);
      expect(counts.childCells).toBeGreaterThanOrEqual(control.parts.length);
      expect(logged.phases.reduce((n,phase)=>n+phase.count,0)).toBe(logged.steps);
      expect(logged.slow.length).toBe(logged.steps-logged.truncatedSteps);
      for(const step of logged.slow){
        expect(step.label).toMatch(/^(destruction|classificationCells|classification|parentMass|childCells|childClassificationCells|childTransitionPayload|childHash|childRecipe\d+|removedMass)$/);
      }
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
      // In flight: the opt-out arrives while the plan is suspended after its first traced step.
      await beginWorkerRecut(worker,"recut-b");
      worker.autoClock(10);
      const second=await suspendWorkerPlan(worker,"recut-b");
      worker.autoClock(0);
      const optOut=await worker.send({kind:"Read",measure:false});
      expect(optOut.timings).toBeUndefined();
      expect(optOut.snapshot!.moving).toMatchObject({state:"Preparing",pendingId:"recut-b"});
      worker.autoClock(10);
      const prepared=await drainWorkerPlan(worker,second);
      worker.autoClock(0);
      expect(prepared.rejected).toBeUndefined();
      expect(planLines()).toHaveLength(1);
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut-b"});
      // Later plans allocate no trace either; the native cut result is unchanged.
      const admission=await beginWorkerRecut(worker,"recut-c");
      worker.autoClock(10);
      const third=worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut-c"});
      await third.done;
      worker.autoClock(0);
      expect(worker.reply(third.id)?.rejected).toBeUndefined();
      expect(planLines()).toHaveLength(1);
      const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut-c",products:admission});
      expect(staged.rejected).toBeUndefined();
      expect(staged.snapshot!.moving.state).toBe("PreparedHeld");
      expect(staged.timings).toBeUndefined();
      expect(staged.clock).not.toHaveProperty("lastBodyHoldMs");
      await worker.send({kind:"CommitBodyCut",transactionId:"recut-c"});
      const finalized=await worker.send({kind:"FinalizeBodyCut",transactionId:"recut-c"});
      expect(finalized.snapshot).toMatchObject({status:"Running",moving:{state:"Idle",last:{status:"Applied"}}});
      expect(finalized.clock).not.toHaveProperty("lastBodyHoldMs");
      expect(planLines()).toHaveLength(1);
      expect(worker.planCount()).toBe(3);
    });
  }finally{debug.mockRestore();}
},120_000);

it("keeps the plan trace off on the old World returned by RollbackRestore after an opt-out during a committed restore",async()=>{
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  const planLines=()=>debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
  try{
    await withWorker(true,async worker=>{
      // Control on the old World: its observer is live while measuring.
      await beginWorkerBodyCut(worker);
      worker.autoClock(10);
      const control=worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut"});
      await control.done;
      worker.autoClock(0);
      expect(worker.reply(control.id)?.rejected).toBeUndefined();
      expect(planLines()).toHaveLength(1);
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
      // Committed restore: the candidate is the active session, the old World waits inside the replacement.
      await worker.send({kind:"Pause"});
      const saved=await worker.send({kind:"Checkpoint"});
      expect(saved.checkpoint).toBeDefined();
      const prepared=await worker.send({kind:"PrepareRestore",transactionId:"optout-restore",checkpoint:saved.checkpoint!,replacements:[]});
      expect(prepared.restoreState).toBe("Prepared");
      expect((await worker.send({kind:"CommitRestore",transactionId:"optout-restore"})).restoreState).toBe("Committed");
      const optOut=await worker.send({kind:"Read",measure:false});
      expect(optOut.restoreState).toBe("Committed");
      expect(optOut.timings).toBeUndefined();
      const rolledBack=await worker.send({kind:"RollbackRestore",transactionId:"optout-restore"});
      expect(rolledBack.rejected).toBeUndefined();
      expect(rolledBack.restoreState).toBe("RolledBack");
      expect(rolledBack.snapshot!.status).toBe("Paused");
      // The returned old World runs a real slow plan without allocating or logging a trace.
      expect((await worker.send({kind:"Play"})).snapshot!.status).toBe("Running");
      await beginWorkerRecut(worker,"recut-after");
      worker.autoClock(10);
      const after=worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut-after"});
      await after.done;
      worker.autoClock(0);
      expect(worker.reply(after.id)?.rejected).toBeUndefined();
      expect(worker.reply(after.id)?.snapshot!.moving).toMatchObject({state:"Preparing",pendingId:"recut-after"});
      expect(planLines()).toHaveLength(1);
      expect(worker.planCount()).toBe(2);
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut-after"});
    });
  }finally{debug.mockRestore();}
},120_000);

/** Releases gated yields until the owner child hash is suspended at one of its own yields. */
const suspendWorkerHash=async(worker:WorkerHarness,plan:{id:number})=>{
  for(let released=0;!hashProbe.suspended;released+=1){
    expect(released).toBeLessThan(4096);
    expect(worker.reply(plan.id)).toBeUndefined();
    expect(await worker.release()).toBe(true);
  }
  expect(worker.reply(plan.id)).toBeUndefined();
  return {cursors:hashProbe.cursors,advances:hashProbe.advances};
};

it("serves Read, input and the timer at a yield inside the Worker child hash, then cancels it without native mutation",async()=>{
  await withWorker(false,async worker=>{
    const admission=await beginWorkerBodyCut(worker);
    const plan=await suspendWorkerPlan(worker);
    const atYield=await suspendWorkerHash(worker,plan);
    expect(atYield.advances).toBeGreaterThanOrEqual(1);
    const walking=await worker.send({kind:"Read",input:{x:0,z:1,sprint:false,jump:false}});
    expect(walking.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing",pendingId:"recut"}});
    worker.tick(1000/60);
    const ticked=await worker.send({kind:"Read",input:{x:0,z:0,sprint:false,jump:false}});
    expect(ticked.snapshot!.ticks).toBe(walking.snapshot!.ticks+1);
    // No hash work runs while the plan is suspended.
    expect(hashProbe.advances).toBe(atYield.advances);
    const before=ticked.snapshot!;
    const rolledBack=await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
    expect(rolledBack.rejected).toBeUndefined();
    // The cancelled plan closes its cursor at the next resume without another advance or a result.
    expect(await worker.release()).toBe(true);
    await plan.done;
    worker.gate(false);
    expect(worker.reply(plan.id)?.rejected).toMatch(/Moving preparation cancelled/);
    expect(hashProbe).toMatchObject({suspended:false,advances:atYield.advances,disposed:atYield.cursors});
    const late=await worker.send({kind:"StageBodyCut",transactionId:"recut",products:admission});
    expect(late.rejected).toMatch(/Stale body preparation/);
    expect(late.snapshot).toMatchObject({bodyCount:before.bodyCount,colliderCount:before.colliderCount,
      moving:{state:"Idle",pendingId:null}});
    expect(late.snapshot!.moving.last?.status).not.toBe("Applied");
    expect(hashProbe.advances).toBe(atYield.advances);
    expect(worker.planCount()).toBe(1);
  });
},120_000);

it("keeps the Worker owner-hash route on a finalized Restore candidate and applies its new body cut",async()=>{
  await withWorker(false,async worker=>{
    await worker.send({kind:"Pause"});
    const saved=await worker.send({kind:"Checkpoint"});
    expect((await worker.send({kind:"PrepareRestore",transactionId:"owned-restore",checkpoint:saved.checkpoint!,replacements:[]})).restoreState).toBe("Prepared");
    expect((await worker.send({kind:"CommitRestore",transactionId:"owned-restore"})).restoreState).toBe("Committed");
    expect((await worker.send({kind:"FinalizeRestore",transactionId:"owned-restore"})).restoreState).toBe("Finalized");
    expect((await worker.send({kind:"Play"})).snapshot!.status).toBe("Running");
    worker.tick(1000/60);
    const admission=await beginWorkerBodyCut(worker);
    const plan=await suspendWorkerPlan(worker);
    const prepared=await drainWorkerPlan(worker,plan);
    expect(prepared.rejected).toBeUndefined();
    expect(hashProbe.cursors).toBeGreaterThanOrEqual(1);
    expect(hashProbe.disposed).toBe(hashProbe.cursors);
    const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut",products:admission});
    expect(staged.rejected).toBeUndefined();
    await worker.send({kind:"CommitBodyCut",transactionId:"recut"});
    const finalized=await worker.send({kind:"FinalizeBodyCut",transactionId:"recut"});
    expect(finalized.snapshot).toMatchObject({status:"Running",moving:{state:"Idle",last:{status:"Applied"}}});
    expect(worker.planCount()).toBe(1);
  });
},120_000);

/** One Applied command on a fresh native fixture through the generic or the owner-hash factory. */
const parityRun=async(owned:boolean,cells?:{x:number;y:number;z:number;materialId:number}[],brush?:"Sphere",eye?:{x:number;y:number;z:number})=>{
  const f=fixture(cells);
  try{
    const session=owned?createHvpOwnedHashBodyCutSession(f.world,f.targets,f.bodies,"plan-owner"):f.session;
    const cursors=hashProbe.cursors;
    const request={...f.request,...(brush===undefined?{}:{brush})};
    const prep=session.begin(request,eye??f.eye,0),built=products(prep);
    await session.preparePlan(request.id,taskHost());
    session.stage(request.id,built,1);session.commit(request.id);session.finalize(request.id);
    const last=session.read().last!;
    return {cursors:hashProbe.cursors-cursors,last,built,bodies:f.world.bodies.len(),colliders:f.world.colliders.len(),
      targets:[...f.targets.keys()],children:last.children.map(id=>{
        const recipe=f.targets.get(id)!.recipe;
        return {id,sourceDigest:recipe.source.contentHash,mass:recipe.mass,axes:recipe.axes,colliders:recipe.colliders};
      })};
  }finally{f.world.free();}
};

it("issues identical children, masses, colliders and receipts on the generic and the owner-hash body session",async()=>{
  const generic=await parityRun(false),owned=await parityRun(true);
  expect(generic.cursors).toBe(0);
  expect(owned.cursors).toBe(owned.children.length);
  expect(owned.last).toEqual(generic.last);
  expect(owned.children).toEqual(generic.children);
  expect(planCalls()).toBe(1);
},120_000);

it("runs a partial Sphere through the owner-hash factory's re-ingest route to one Applied child with generic parity",async()=>{
  // Cells x=2..4; the fixture ray hits x=2, the edge-1 Sphere removes only it and one child {3,4} remains.
  const row=[2,3,4].map(x=>({x,y:0,z:0,materialId:1}));
  const generic=await parityRun(false,row,"Sphere"),owned=await parityRun(true,row,"Sphere");
  expect(owned.last).toMatchObject({status:"Applied",removedCells:1,removedMassKg:.125**3*512});
  expect(owned.children).toHaveLength(1);
  expect(owned.built.parts).toHaveLength(1);
  expect(owned.children[0]!.sourceDigest).toBe(owned.built.parts[0]!.sourceDigest);
  expect(owned.children[0]!.mass.totalMassKg).toBeCloseTo(2*.125**3*512,12);
  expect(generic.cursors).toBe(0);
  expect(owned.cursors).toBe(1);
  expect(owned.last).toEqual(generic.last);
  expect(owned.children).toEqual(generic.children);
  expect({bodies:owned.bodies,colliders:owned.colliders,targets:owned.targets})
    .toEqual({bodies:generic.bodies,colliders:generic.colliders,targets:generic.targets});
  expect(owned.targets).toEqual(owned.last.children);
  expect(planCalls()).toBe(1);
},120_000);

it("runs an all-removing Sphere through the owner-hash factory without a child, hash cursor or native body",async()=>{
  const owned=await parityRun(true,[{x:0,y:0,z:0,materialId:1}],"Sphere",{x:.0625,y:.0625,z:-1});
  expect(owned.built.parts).toHaveLength(0);
  expect(owned.last).toMatchObject({status:"Applied",children:[],removedCells:1,removedMassKg:.125**3*512,parentId:"plan-owner-parent"});
  expect(owned.cursors).toBe(0);
  expect({bodies:owned.bodies,colliders:owned.colliders,targets:owned.targets}).toEqual({bodies:0,colliders:0,targets:[]});
  expect(planCalls()).toBe(0);
},120_000);

it("traces the owner-hash labels and recipe subspans exactly on a measured owner session and reads no clock without one",async()=>{
  const traced=fixture(),traces:HvpBodyPlanTrace[]=[];
  try{
    const session=createHvpOwnedHashBodyCutSession(traced.world,traced.targets,traced.bodies,"plan-owner-owned-traced",undefined,()=>0,
      trace=>{traces.push(trace);});
    session.begin(traced.request,traced.eye,0);
    await session.preparePlan(traced.request.id,taskHost());
    expect(traces).toHaveLength(1);
    const trace=traces[0]!,labels=trace.steps.map(step=>step.label);
    // Small fixture: nothing truncated, every step listed.
    expect(trace.steps).toHaveLength(trace.totalSteps);
    expect(hashProbe.cursors).toBe(2);
    expect(hashProbe.advances).toBeGreaterThan(hashProbe.cursors);
    const cellSteps=trace.steps.filter(step=>step.label==="childCells");
    expect(cellSteps).toHaveLength(2);
    // The batch step carries only its own projection subspan; the following ingest is a later step.
    for(const step of cellSteps){expect(step.sub?.map(sub=>sub.phase)).toEqual(["childCellsBatchMs"]);}
    expect(trace.steps.some(step=>step.sub?.some(sub=>sub.phase==="partCellsMs"))).toBe(false);
    expect(labels.filter(label=>label==="childTransitionPayload")).toHaveLength(2);
    // Each cursor yields after every advance but its last one.
    expect(labels.filter(label=>label==="childHash")).toHaveLength(hashProbe.advances-hashProbe.cursors);
    for(const index of [0,1]){
      const recipe=labels.indexOf(`childRecipe${index}`);
      const payload=labels.indexOf("childTransitionPayload",index===0?0:labels.indexOf("childRecipe0"));
      expect(payload).toBeGreaterThan(-1);
      expect(payload).toBeLessThan(recipe);
      // The child's hash batches lie between its payload step and its recipe step.
      expect(labels.slice(payload+1,recipe).every(label=>label==="childHash")).toBe(true);
      expect(trace.steps[recipe]!.sub?.map(sub=>sub.phase)).toContain("recipeTransitionMs");
    }
    expect(Object.fromEntries(trace.phases.map(phase=>[phase.label,phase.count])).childHash).toBe(hashProbe.advances-hashProbe.cursors);
    session.rollback(traced.request.id);
  }finally{traced.world.free();}
  // Measurement off: the same owner-hash plan reads no clock at all.
  const quiet=fixture();
  try{
    const session=createHvpOwnedHashBodyCutSession(quiet.world,quiet.targets,quiet.bodies,"plan-owner-owned-quiet");
    session.begin(quiet.request,quiet.eye,0);
    const cursors=hashProbe.cursors;
    const clock=vi.spyOn(performance,"now");
    try{
      await session.preparePlan(quiet.request.id,taskHost());
      expect(clock).not.toHaveBeenCalled();
    }finally{clock.mockRestore();}
    expect(hashProbe.cursors-cursors).toBe(2);
    session.rollback(quiet.request.id);
  }finally{quiet.world.free();}
},120_000);

it("closes the owner child hash on a cancel or dispose at its own yield without a revived plan or native mutation",async()=>{
  const f=fixture();
  try{
    const session=createHvpOwnedHashBodyCutSession(f.world,f.targets,f.bodies,"plan-owner-owned");
    session.begin(f.request,f.eye,0);
    let cancelledAt=-1;
    const cancelled=session.preparePlan(f.request.id,taskHost(()=>{
      if(hashProbe.suspended&&cancelledAt<0){cancelledAt=hashProbe.advances;session.rollback(f.request.id);}
    }));
    await expect(cancelled).rejects.toThrow(/Moving preparation cancelled/);
    expect(cancelledAt).toBeGreaterThanOrEqual(1);
    expect(hashProbe).toMatchObject({suspended:false,advances:cancelledAt,disposed:hashProbe.cursors});
    expect(session.read()).toMatchObject({state:"Idle",pendingId:null});
    expect(f.world.bodies.len()).toBe(1);expect(f.targets.get(f.target.ownerId)).toBe(f.target);
    const retry={...f.request,id:"plan-cut-owned-disposed"},prep=session.begin(retry,f.eye,1);
    let disposedAt=-1;
    const host={...taskHost(()=>{if(hashProbe.suspended&&disposedAt<0){disposedAt=hashProbe.advances;}}),
      assertCurrent:()=>{if(disposedAt>=0){throw new Error("owner disposed mid-hash");}}};
    await expect(session.preparePlan(retry.id,host)).rejects.toThrow(/owner disposed mid-hash/);
    expect(hashProbe).toMatchObject({suspended:false,advances:disposedAt,disposed:hashProbe.cursors});
    // Sticky: valid products cannot resume the abandoned hash.
    expect(()=>session.stage(retry.id,products(prep),2)).toThrow(/owner disposed mid-hash/);
    expect(hashProbe.advances).toBe(disposedAt);
    expect(f.world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
    session.rollback(retry.id);
    expect(planCalls()).toBe(0);
  }finally{f.world.free();}
},120_000);

it("settles a pending Worker plan before restoring the ports even when the Dispose reply fails, keeping the original error",async()=>{
  const original=new Error("original body failure");
  const reports:WorkerCleanupReport[]=[];
  let planId:number|undefined,pendingAtFailure=false,repliedBeforeRestore=false;
  const restoredPost=Object.getOwnPropertyDescriptor(globalThis,"postMessage");
  await expect(withWorker(false,async worker=>{
    await beginWorkerBodyCut(worker);
    const plan=await suspendWorkerPlan(worker);
    planId=plan.id;
    pendingAtFailure=worker.reply(plan.id)===undefined;
    throw original;
  },{failDisposeReply:true,observeCleanup:report=>{
    reports.push(report);
    // Still the harness port: the pending plan's reply must already be recorded here.
    repliedBeforeRestore=planId!==undefined&&report.reply(planId)!==undefined;
  }})).rejects.toBe(original);
  expect(pendingAtFailure).toBe(true);
  expect(reports).toHaveLength(1);
  expect(reports[0]!.drained).toBe(true);
  expect(String(reports[0]!.cleanupError)).toMatch(/injected Dispose reply failure/);
  expect(repliedBeforeRestore).toBe(true);
  expect(Object.getOwnPropertyDescriptor(globalThis,"postMessage")).toEqual(restoredPost);
  // Without an original failure the cleanup error itself surfaces.
  await expect(withWorker(false,async()=>undefined,{failDisposeReply:true})).rejects.toThrow(/injected Dispose reply failure/);
},120_000);

const row200=Array.from({length:200},(_,x)=>({x,y:0,z:0,materialId:1}));
const tracedSession=(f:ReturnType<typeof fixture>)=>{
  const traces:HvpBodyPlanTrace[]=[];
  const session=createHvpBodyCutSession(f.world,f.targets,f.bodies,"plan-owner-traced",undefined,()=>0,trace=>{traces.push(trace);});
  return {session,traces};
};
const tracedOwnedSession=(f:ReturnType<typeof fixture>)=>{
  const traces:HvpBodyPlanTrace[]=[];
  const session=createHvpOwnedHashBodyCutSession(f.world,f.targets,f.bodies,"plan-owner-owned-traced",undefined,()=>0,trace=>{traces.push(trace);});
  return {session,traces};
};
// row200 cut at x=2: the first six plan yields are pinned below (destruction, 3 cell batches,
// classification, parentMass); on the owner route the 7th ends the first child's first cell batch.
const ROW200_FIRST_CHILD_CELLS_YIELD=7;

it("projects row200 child cells in bounded owner batches with generic parity of sources, IDs, masses, colliders and receipt",async()=>{
  const generic=await parityRun(false,row200),owned=await parityRun(true,row200);
  expect(owned.last).toMatchObject({status:"Applied",removedCells:1});
  expect(owned.children).toHaveLength(2);
  expect(owned.cursors).toBe(2);
  expect(owned.last).toEqual(generic.last);
  expect(owned.children).toEqual(generic.children);
  expect(owned.children.map(child=>child.sourceDigest)).toEqual(owned.built.parts.map(part=>part.sourceDigest));
  expect({bodies:owned.bodies,colliders:owned.colliders,targets:owned.targets})
    .toEqual({bodies:generic.bodies,colliders:generic.colliders,targets:generic.targets});
  // Counted over every step (the listed prefix is capped): ceil(2/16)+ceil(197/16) batches.
  const f=fixture(row200);
  try{
    const {session,traces}=tracedOwnedSession(f);
    session.begin(f.request,f.eye,0);
    await session.preparePlan(f.request.id,taskHost());
    const trace=traces[0]!,labels=trace.steps.map(step=>step.label);
    expect(labels.slice(0,ROW200_FIRST_CHILD_CELLS_YIELD)).toEqual(["destruction","classificationCells","classificationCells",
      "classificationCells","classification","parentMass","childCells"]);
    expect(Object.fromEntries(trace.phases.map(phase=>[phase.label,phase.count])).childCells).toBe(1+13);
    expect(trace.phases.reduce((n,phase)=>n+phase.count,0)).toBe(trace.totalSteps);
    session.rollback(f.request.id);
  }finally{f.world.free();}
},120_000);

it("fails closed on a cancel or dispose between owner child-cell batches without a new Stage, hash or native mutation",async()=>{
  const f=fixture(row200);
  try{
    const {session,traces}=tracedOwnedSession(f);
    session.begin(f.request,f.eye,0);
    let cancelYields=0;
    const cancelled=session.preparePlan(f.request.id,taskHost(()=>{
      cancelYields+=1;
      if(cancelYields===ROW200_FIRST_CHILD_CELLS_YIELD){session.rollback(f.request.id);}
    }));
    await expect(cancelled).rejects.toThrow(/Moving preparation cancelled/);
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({outcome:"Abandoned",totalSteps:ROW200_FIRST_CHILD_CELLS_YIELD});
    expect(traces[0]!.steps.at(-1)!.label).toBe("childCells");
    expect(hashProbe.cursors).toBe(0);
    expect(session.read()).toMatchObject({state:"Idle",pendingId:null});
    expect(f.world.bodies.len()).toBe(1);expect(f.targets.get(f.target.ownerId)).toBe(f.target);
    const retry={...f.request,id:"plan-cut-owned-cells-disposed"},prep=session.begin(retry,f.eye,1);
    let yields=0,disposed=false;
    const disposing={...taskHost(()=>{yields+=1;if(yields===ROW200_FIRST_CHILD_CELLS_YIELD){disposed=true;}}),
      assertCurrent:()=>{if(disposed){throw new Error("owner disposed between child-cell batches");}}};
    await expect(session.preparePlan(retry.id,disposing)).rejects.toThrow(/owner disposed between child-cell batches/);
    expect(traces[1]).toMatchObject({outcome:"Abandoned",totalSteps:ROW200_FIRST_CHILD_CELLS_YIELD});
    expect(traces[1]!.steps.at(-1)!.label).toBe("childCells");
    // Sticky: valid products cannot resume the abandoned cell projection.
    expect(()=>session.stage(retry.id,products(prep),2)).toThrow(/owner disposed between child-cell batches/);
    expect(hashProbe.cursors).toBe(0);
    expect(f.world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
    session.rollback(retry.id);
    expect(planCalls()).toBe(0);
  }finally{f.world.free();}
},120_000);

it("stops every optional owner clock read after an opt-out at a child-cell batch yield",async()=>{
  const f=fixture(row200);
  let clockCalls:(()=>number)|undefined,restoreClock:(()=>void)|undefined;
  try{
    const {session,traces}=tracedOwnedSession(f);
    session.begin(f.request,f.eye,0);
    let yields=0;
    await session.preparePlan(f.request.id,taskHost(()=>{
      yields+=1;
      if(yields===ROW200_FIRST_CHILD_CELLS_YIELD){
        session.disablePlanObservation();
        const spy=vi.spyOn(performance,"now");
        clockCalls=()=>spy.mock.calls.length;restoreClock=()=>{spy.mockRestore();};
      }
    }));
    expect(yields).toBeGreaterThan(ROW200_FIRST_CHILD_CELLS_YIELD);
    expect(clockCalls).toBeDefined();
    expect(clockCalls!()).toBe(0);
    expect(traces).toHaveLength(0);
    expect(hashProbe.cursors).toBe(2);
    expect(session.read()).toMatchObject({state:"Preparing",pendingId:f.request.id});
    session.rollback(f.request.id);
  }finally{restoreClock?.();f.world.free();}
},120_000);

it("serves Read, input and the timer at a real Worker child-cell batch yield, then cancels without a new Stage",async()=>{
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  const planLines=()=>debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
  const parse=(line:string)=>JSON.parse(line.slice("hvp-body-plan-steps ".length)) as {outcome:string;slow:{label:string}[]};
  try{
    await withWorker(true,async worker=>{
      // Control run (every step slow under the fixed clock): the ordinal of the first child-cell batch.
      await beginWorkerBodyCut(worker);
      worker.autoClock(10);
      const control=worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut"});
      await control.done;
      worker.autoClock(0);
      expect(worker.reply(control.id)?.rejected).toBeUndefined();
      const ordinal=parse(planLines()[0]!).slow.findIndex(step=>step.label==="childCells");
      expect(ordinal).toBeGreaterThan(0);
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
      // Same parent, no simulated time in between: the same step sequence up to that batch.
      const admission=await beginWorkerRecut(worker,"recut-cells");
      const cursors=hashProbe.cursors;
      worker.autoClock(10);
      const plan=await suspendWorkerPlan(worker,"recut-cells");
      for(let released=0;released<ordinal;released+=1){expect(await worker.release()).toBe(true);}
      worker.autoClock(0);
      expect(worker.reply(plan.id)).toBeUndefined();
      // Explicit safety accounting of the synthetic clock debt: both calibrated runs advanced the fake
      // clock without a timer callback, so the next callback catches up at most four steps and holds.
      worker.tick(0);
      const held=await worker.send({kind:"Read"});
      expect(held.snapshot).toMatchObject({status:"SimulationHold",moving:{state:"Preparing",pendingId:"recut-cells"}});
      // The existing explicit continuation discards that backlog and rebases the timer.
      const resumed=await worker.send({kind:"Resume"});
      expect(resumed.rejected).toBeUndefined();
      expect(resumed.snapshot).toMatchObject({status:"Running",backlogSeconds:0,moving:{state:"Preparing",pendingId:"recut-cells"}});
      expect(worker.reply(plan.id)).toBeUndefined();
      const walking=await worker.send({kind:"Read",input:{x:0,z:1,sprint:false,jump:false}});
      expect(walking.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing",pendingId:"recut-cells"}});
      worker.tick(1000/60);
      const ticked=await worker.send({kind:"Read",input:{x:0,z:0,sprint:false,jump:false}});
      // Exactly one fixed step from a zero backlog, still Running.
      expect(ticked.snapshot).toMatchObject({status:"Running",ticks:walking.snapshot!.ticks+1});
      const before=ticked.snapshot!;
      expect((await worker.send({kind:"RollbackBodyCut",transactionId:"recut-cells"})).rejected).toBeUndefined();
      // The abandoned trace already holds the slow calibrated steps; no further fake time is needed.
      expect(await worker.release()).toBe(true);
      await plan.done;
      worker.gate(false);
      expect(worker.reply(plan.id)?.rejected).toMatch(/Moving preparation cancelled/);
      // The abandoned plan stopped right after that child-cell batch; no hash cursor was reached.
      const abandoned=parse(planLines().at(-1)!);
      expect(abandoned.outcome).toBe("Abandoned");
      expect(abandoned.slow.at(-1)!.label).toBe("childCells");
      expect(hashProbe.cursors).toBe(cursors);
      const late=await worker.send({kind:"StageBodyCut",transactionId:"recut-cells",products:admission});
      expect(late.rejected).toMatch(/Stale body preparation/);
      expect(late.snapshot).toMatchObject({bodyCount:before.bodyCount,colliderCount:before.colliderCount,moving:{state:"Idle",pendingId:null}});
      expect(worker.planCount()).toBe(2);
    });
  }finally{debug.mockRestore();}
},120_000);

it("yields inside the post-destruction classification in bounded cell batches and stages the same products",async()=>{
  const f=fixture(row200);
  try{
    const {session,traces}=tracedSession(f);
    const prep=session.begin(f.request,f.eye,0),built=products(prep),host=taskHost();
    await session.preparePlan(f.request.id,host);
    expect(traces).toHaveLength(1);
    const labels=traces[0]!.steps.map(step=>step.label);
    // 199 remaining cells in 13 bricks: 213 cursor units, i.e. three full 64-unit batches before the rest.
    expect(labels.slice(0,6)).toEqual(["destruction","classificationCells","classificationCells","classificationCells","classification","parentMass"]);
    expect(labels.at(-1)).toBe("removedMass");
    expect(host.yields).toBe(labels.length-1);
    // Children {0,1} (1 brick, 4 units: no batch yield) and {3..199} (13 bricks, 211 units: three batches)
    // each classify their OWN new source; order is the canonical component order.
    const groups=childGroups(traces[0]!.steps.slice(6,-1));
    expect(groups.map(group=>group.length).sort((a,b)=>a-b)).toEqual([1,4]);
    expect(labels.filter(label=>label==="childClassificationCells")).toHaveLength(3);
    // The independent synchronous compile-worker plan agrees with the yielding owner plan.
    session.stage(f.request.id,built,1);
    session.commit(f.request.id);session.finalize(f.request.id);
    expect(session.read().last!.status).toBe("Applied");
    expect(planCalls()).toBe(1);
  }finally{f.world.free();}
},120_000);

it.each(["first","midClassification","midChildClassification","last"] as const)("cancels a yielding plan at its %s yield without revival or native change",async at=>{
  const dry=fixture(row200);
  let dryLabels:string[]=[];
  try{
    const traced=tracedSession(dry);
    traced.session.begin(dry.request,dry.eye,0);
    await traced.session.preparePlan(dry.request.id,taskHost());
    dryLabels=traced.traces[0]!.steps.map(step=>step.label);
  }finally{dry.world.free();}
  const total=dryLabels.length-1,firstChildBatch=dryLabels.indexOf("childClassificationCells")+1;
  expect(total).toBeGreaterThan(3);
  expect(firstChildBatch).toBeGreaterThan(6);
  const cancelAt=at==="first"?1:at==="midClassification"?2:at==="midChildClassification"?firstChildBatch:total;
  const f=fixture(row200);
  try{
    const {session,traces}=tracedSession(f);
    session.begin(f.request,f.eye,0);
    const host=taskHost(()=>{if(host.yields===cancelAt){session.rollback(f.request.id);}});
    await expect(session.preparePlan(f.request.id,host)).rejects.toThrow(/Moving preparation cancelled/);
    expect(host.yields).toBe(cancelAt);
    expect(session.read()).toMatchObject({state:"Idle",pendingId:null});
    expect(f.world.bodies.len()).toBe(1);expect(f.targets.get(f.target.ownerId)).toBe(f.target);
    expect(traces).toMatchObject([{outcome:"Abandoned"}]);
    const labels=traces[0]!.steps.map(step=>step.label);
    expect(labels).toHaveLength(cancelAt);
    if(at==="midClassification"){expect(labels).toEqual(["destruction","classificationCells"]);}
    // Stopped while the new child's own cell cursor was suspended; no child recipe was issued.
    if(at==="midChildClassification"){
      expect(labels.at(-1)).toBe("childClassificationCells");
      expect(labels.filter(label=>/^childRecipe\d+$/.test(label)).length).toBeLessThanOrEqual(1);
    }
    // The dropped command cannot be prepared or staged again; a new command starts cleanly.
    await expect(session.preparePlan(f.request.id,taskHost())).rejects.toThrow(/Stale body preparation/);
    expect(()=>session.stage(f.request.id,{removedCells:1,removedMassKg:1,parts:[]},2)).toThrow(/Stale body preparation/);
    const retry={...f.request,id:"plan-cut-after-cancel"},built=products(session.begin(retry,f.eye,3));
    await session.preparePlan(retry.id,taskHost());
    session.stage(retry.id,built,4);session.rollback(retry.id);
    expect(f.world.bodies.len()).toBe(1);
  }finally{f.world.free();}
},120_000);

it("reads no diagnostic clock after an opt-out at a child's own classification yield and keeps the same outcome",async()=>{
  // Deterministic yield index of the first child cell batch for this exact plan.
  const dry=fixture(row200);
  let firstChildBatch=0;
  try{
    const traced=tracedSession(dry);
    traced.session.begin(dry.request,dry.eye,0);
    await traced.session.preparePlan(dry.request.id,taskHost());
    firstChildBatch=traced.traces[0]!.steps.map(step=>step.label).indexOf("childClassificationCells")+1;
  }finally{dry.world.free();}
  expect(firstChildBatch).toBeGreaterThan(6);
  // The dry run derived exactly one plan; the tested command must add exactly one more.
  const plannedBefore=planCalls();
  expect(plannedBefore).toBe(1);
  const f=fixture(row200);
  const now=vi.spyOn(performance,"now");
  try{
    const {session,traces}=tracedSession(f);
    const prep=session.begin(f.request,f.eye,0),built=products(prep);
    const host=taskHost(()=>{
      if(host.yields===firstChildBatch){
        // Suspended inside the child's classification with recipe spans already allocated.
        expect(now).toHaveBeenCalled();
        session.disablePlanObservation();
        now.mockClear();
      }
    });
    await session.preparePlan(f.request.id,host);
    expect(host.yields).toBeGreaterThan(firstChildBatch);
    // No step timing, ingest span or recipe mass/classify/transition/axes span read the clock afterwards.
    expect(now).not.toHaveBeenCalled();
    expect(traces).toEqual([]);
    // Observation off did not skip the classification or the issued recipe: the same products stage.
    session.stage(f.request.id,built,1);
    session.commit(f.request.id);session.finalize(f.request.id);
    expect(session.read().last!.status).toBe("Applied");
    expect(planCalls()).toBe(plannedBefore+1);
  }finally{now.mockRestore();f.world.free();}
},120_000);

/**
 * Test double for the plan steps only (the trace owner and logger stay real): 1 destruction, 100 cell
 * batches, classification, parent mass, final removed mass = 104 steps. Only the batch ending at
 * ordinal 81 advances the fixed clock (50 ms), i.e. the worst step lies beyond the 64-step record cap.
 */
const syntheticLongPlan=(clock:{now:number})=>function*(){
  yield "destruction";
  for(let batch=0;batch<100;batch+=1){
    if(batch===80){
      clock.now+=50;
    }
    yield "classificationCells";
  }
  yield "classification";
  yield "parentMass";
  return Object.freeze({synthetic:true});
} as unknown as typeof prepareHvpBodyCutSteps;

it("aggregates every step and keeps the true worst step beyond the 64-step record cap",async()=>{
  const f=fixture();
  const clock={now:0},now=vi.spyOn(performance,"now").mockImplementation(()=>clock.now);
  try{
    const {session,traces}=tracedSession(f);
    session.begin(f.request,f.eye,0);
    vi.mocked(prepareHvpBodyCutSteps).mockImplementationOnce(syntheticLongPlan(clock));
    await session.preparePlan(f.request.id,taskHost());
    const trace=traces[0]!;
    expect(trace).toMatchObject({outcome:"Planned",totalSteps:104});
    expect(trace.steps).toHaveLength(64);
    expect(trace.steps.map(step=>step.ordinal)).toEqual(Array.from({length:64},(_,i)=>i));
    expect(trace.max).toMatchObject({ordinal:81,label:"classificationCells",duration:50});
    expect(Object.fromEntries(trace.phases.map(phase=>[phase.label,phase.count])))
      .toEqual({destruction:1,classificationCells:100,classification:1,parentMass:1,removedMass:1});
    expect(trace.phases.reduce((n,phase)=>n+phase.count,0)).toBe(trace.totalSteps);
    expect(trace.phases.find(phase=>phase.label==="classificationCells")).toMatchObject({totalMs:50,maxMs:50});
    session.rollback(f.request.id);
  }finally{now.mockRestore();f.world.free();}
},120_000);

it("logs truncatedSteps and the post-cap worst step through the real session logger",async()=>{
  const source=await createHvpPhysicsSession([...collisionSectors(floor)],{x:-2,y:3,z:-2},9.81,player,{x:2,y:2,z:2},{x:0,y:0,z:0},
    "plan-trace-cap",undefined,"branch",true);
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  try{
    source.play();source.advance(1/60);
    source.prepareBranch({id:"release",generation:0,sourceDigest:source.read().structural!.sourceDigest,
      direction:aimAt({x:.75,y:1.25,z:0},source.read().player!.position)});
    source.commitBranch("release");source.finalizeBranch("release");
    const parent=source.read().structural!.parts.find(p=>!p.anchored)!,direction=aimAt(parent.position,source.read().player!.position);
    source.aimBranch(direction);
    source.beginBodyCut({id:"recut",ownerId:parent.ownerId,sourceDigest:source.read().moving.preview!.sourceDigest,edge:1,direction});
    const clock={now:0},now=vi.spyOn(performance,"now").mockImplementation(()=>clock.now);
    vi.mocked(prepareHvpBodyCutSteps).mockImplementationOnce(syntheticLongPlan(clock));
    try{await source.prepareBodyCutPlan("recut");}finally{now.mockRestore();}
    const lines=debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
    expect(lines).toHaveLength(1);
    const logged=JSON.parse(lines[0]!.slice("hvp-body-plan-steps ".length)) as Record<string,unknown>;
    expect(logged).toMatchObject({commandId:"recut",outcome:"Planned",steps:104,truncatedSteps:40,
      max:{ordinal:81,label:"classificationCells",durationMs:50},
      phases:[{label:"classificationCells",count:100,totalMs:50,maxMs:50}],slow:[]});
    source.rollbackBodyCut("recut");
  }finally{debug.mockRestore();source.dispose();}
},120_000);

it("serves Read, input and the fixed-step timer at a yield in the middle of the classification",async()=>{
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  try{
    await withWorker(true,async worker=>{
      const admission=await beginWorkerBodyCut(worker);
      const plan=await suspendWorkerPlan(worker);
      // Resume past the destruction yield: the plan now stops at its second yield.
      expect(await worker.release()).toBe(true);
      expect(worker.gatedYields).toBe(2);
      expect(worker.reply(plan.id)).toBeUndefined();
      const walking=await worker.send({kind:"Read",input:{x:0,z:1,sprint:false,jump:false}});
      expect(walking.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing",pendingId:"recut"}});
      worker.tick(1000/60);
      const released=await worker.send({kind:"Read",input:{x:0,z:0,sprint:false,jump:false}});
      expect(released.snapshot).toMatchObject({status:"Running",ticks:walking.snapshot!.ticks+1,moving:{state:"Preparing"}});
      // Only the remaining steps read 2x10 ms and therefore appear in the slow list.
      worker.autoClock(10);
      const prepared=await drainWorkerPlan(worker,plan);
      worker.autoClock(0);
      expect(prepared.rejected).toBeUndefined();
      const line=debug.mock.calls.map(call=>String(call[0])).find(value=>value.startsWith("hvp-body-plan-steps "))!;
      const slow=(JSON.parse(line.slice("hvp-body-plan-steps ".length)) as {slow:{ordinal:number;label:string}[]}).slow;
      // Step 1 (ended by the yield where Read and the tick ran) was a classificationCells batch exactly when
      // step 2 still belongs to the classification: labels are destruction, cells..., classification, ...
      expect(slow[0]!.ordinal).toBe(2);
      expect(["classificationCells","classification"]).toContain(slow[0]!.label);
      const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut",products:admission});
      expect(staged.rejected).toBeUndefined();
      await worker.send({kind:"CommitBodyCut",transactionId:"recut"});
      const finalized=await worker.send({kind:"FinalizeBodyCut",transactionId:"recut"});
      expect(finalized.snapshot).toMatchObject({status:"Running",moving:{state:"Idle",last:{status:"Applied"}}});
      expect(worker.planCount()).toBe(1);
    });
  }finally{debug.mockRestore();}
},120_000);

it("serves Read, input and the fixed-step timer at a yield inside a NEW child's own classification",async()=>{
  const debug=vi.spyOn(console,"debug").mockImplementation(()=>undefined);
  const planLines=()=>debug.mock.calls.map(call=>String(call[0])).filter(line=>line.startsWith("hvp-body-plan-steps "));
  const parse=(line:string)=>JSON.parse(line.slice("hvp-body-plan-steps ".length)) as {slow:{ordinal:number;label:string}[]};
  try{
    await withWorker(true,async worker=>{
      // Control run (every step slow): the deterministic label order of this exact plan.
      await beginWorkerBodyCut(worker);
      worker.autoClock(10);
      await worker.dispatch({kind:"PrepareBodyPlan",transactionId:"recut"}).done;
      worker.autoClock(0);
      const control=parse(planLines()[0]!).slow.map(step=>step.label);
      const childBatch=control.indexOf("childClassificationCells");
      expect(childBatch).toBeGreaterThan(control.indexOf("parentMass"));
      await worker.send({kind:"RollbackBodyCut",transactionId:"recut"});
      // The regular Pause/Play restarts the simulation clock after the synthetic clock advance.
      await worker.send({kind:"Pause"});
      await worker.send({kind:"Play"});
      const admission=await beginWorkerRecut(worker,"recut-b");
      const plan=await suspendWorkerPlan(worker,"recut-b");
      for(let released=0;released<childBatch;released+=1){
        expect(await worker.release()).toBe(true);
      }
      // Suspended right after step `childBatch`, a batch of the child's own occupied-cell cursor.
      expect(worker.gatedYields).toBe(childBatch+1);
      expect(worker.reply(plan.id)).toBeUndefined();
      const walking=await worker.send({kind:"Read",input:{x:0,z:1,sprint:false,jump:false}});
      expect(walking.snapshot).toMatchObject({status:"Running",moving:{state:"Preparing",pendingId:"recut-b"}});
      worker.tick(1000/60);
      const released=await worker.send({kind:"Read",input:{x:0,z:0,sprint:false,jump:false}});
      expect(released.snapshot).toMatchObject({status:"Running",ticks:walking.snapshot!.ticks+1,moving:{state:"Preparing"}});
      worker.autoClock(10);
      const prepared=await drainWorkerPlan(worker,plan);
      worker.autoClock(0);
      expect(prepared.rejected).toBeUndefined();
      const resumed=parse(planLines()[1]!).slow;
      expect(resumed[0]!.ordinal).toBe(childBatch+1);
      expect(resumed.map(step=>step.label)).toEqual(control.slice(childBatch+1));
      const staged=await worker.send({kind:"StageBodyCut",transactionId:"recut-b",products:admission});
      expect(staged.rejected).toBeUndefined();
      await worker.send({kind:"CommitBodyCut",transactionId:"recut-b"});
      const finalized=await worker.send({kind:"FinalizeBodyCut",transactionId:"recut-b"});
      expect(finalized.snapshot).toMatchObject({status:"Running",moving:{state:"Idle",last:{status:"Applied"}}});
      expect(worker.planCount()).toBe(2);
    });
  }finally{debug.mockRestore();}
},120_000);

type StubMoving=HvpPhysicsSnapshot["moving"]["state"];
/**
 * A faithful single-owner stub of the worker's body/branch reply protocol: the same
 * publish/held reply kinds, the same stale-id rejections and a per-reply tick marker.
 */
class FaithfulPhysicsStub {
  static current:FaithfulPhysicsStub|undefined;
  onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
  onerror:((event:ErrorEvent)=>void)|null=null;
  onmessageerror:((event:MessageEvent)=>void)|null=null;
  readonly messages:HvpPhysicsMessage[]=[];
  readonly held:HvpPhysicsMessage[]=[];
  holdNextRead=false;
  holdPlans=false;
  ticks=0;
  moving:StubMoving="Idle";
  pendingId:string|null=null;
  constructor(){FaithfulPhysicsStub.current=this;}
  postMessage(message:HvpPhysicsMessage):void {
    this.messages.push(message);
    if((message.kind==="PrepareBodyPlan"&&this.holdPlans)||(message.kind==="Read"&&this.holdNextRead)){
      if(message.kind==="Read"){this.holdNextRead=false;}
      this.held.push(message);
      return;
    }
    queueMicrotask(()=>this.deliver(message));
  }
  release():void {this.deliver(this.held.shift()!);}
  terminate():void {}
  private snapshot(disposed:boolean):HvpPhysicsSnapshot {
    return {status:disposed?"Disposed":"Running",ticks:this.ticks,bodyCount:disposed?0:1,colliderCount:0,collisionBytes:0,
      moving:{sequence:0,pendingId:this.pendingId,state:this.moving,preview:null,last:null}} as HvpPhysicsSnapshot;
  }
  /** Mirrors the session's body state checks; returns a rejection reason or undefined. */
  private apply(message:HvpPhysicsMessage):string|undefined {
    const bodyId=(id:string,state:StubMoving)=>this.pendingId===id&&this.moving===state;
    switch(message.kind){
      case "Read":this.ticks+=1;return undefined;
      case "PrepareBranch":return "Stale or pending branch generation";
      case "BeginBodyCut":
        if(this.moving!=="Idle"){return "Moving cut unavailable";}
        this.moving="Preparing";this.pendingId=message.request.id;return undefined;
      case "PrepareBodyPlan":return bodyId(message.transactionId,"Preparing")?undefined:"Stale body preparation";
      case "StageBodyCut":
        if(!bodyId(message.transactionId,"Preparing")){return "Stale body preparation";}
        this.moving="PreparedHeld";return undefined;
      case "CommitBodyCut":
        if(!bodyId(message.transactionId,"PreparedHeld")){return "Stale body commit";}
        this.moving="CommittedHeld";return undefined;
      case "FinalizeBodyCut":
        if(!bodyId(message.transactionId,"CommittedHeld")){return "Stale body finalization";}
        this.moving="Idle";this.pendingId=null;return undefined;
      case "RollbackBodyCut":
        if(this.pendingId!==message.transactionId){return "Stale body rollback";}
        this.moving="Idle";this.pendingId=null;return undefined;
      default:return undefined;
    }
  }
  deliver(message:HvpPhysicsMessage):void {
    const rejected=this.apply(message),disposed=message.kind==="Dispose";
    const bodyPreparation:HvpMovingCutPreparation|undefined=message.kind==="BeginBodyCut"&&rejected===undefined?{
      payload:{sessionId:"stub",epoch:0,commandId:message.request.id,ownerId:message.request.ownerId,sourceId:"stub-source",
        sourceDigest:message.request.sourceDigest,revision:0,cellCount:1,massKg:1,cell:[0,0,0],edge:message.request.edge,materials:[]},
      cells:[],issuedTick:this.ticks}:undefined;
    const clock:HvpPhysicsClock={timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]};
    const reply:HvpPhysicsReply={id:message.id,snapshot:this.snapshot(disposed),clock,
      ...(rejected===undefined?{}:{rejected}),...(bodyPreparation===undefined?{}:{bodyPreparation})};
    this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>);
  }
}
const withStubClient=async(body:(client:Awaited<ReturnType<typeof createHvpPhysicsClient>>,stub:FaithfulPhysicsStub)=>Promise<void>)=>{
  const controller=new AbortController();
  vi.stubGlobal("Worker",FaithfulPhysicsStub);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal);
    await body(client,FaithfulPhysicsStub.current!);
  }finally{
    await client?.dispose().catch(()=>undefined);
    controller.abort();
    vi.unstubAllGlobals();
  }
};
const settleClient=()=>new Promise<void>(resolve=>{setTimeout(resolve,0);});
const bodyRequest=(id:string)=>({id,ownerId:"parent",sourceDigest:"digest",edge:1,direction:{x:0,y:0,z:1}});
const emptyAdmission={removedCells:1,removedMassKg:1,parts:[]};

it("keeps client Read/Input flowing during source-only body preparation and never adopts a stale Read over Stage",async()=>{
  await withStubClient(async(client,stub)=>{
    client.setPlayerInput({x:0,z:1,sprint:false,jump:false});client.update();await settleClient();
    await client.beginBodyCut(bodyRequest("cut"));
    stub.holdPlans=true;
    const staging=client.stageBodyCut("cut",emptyAdmission);
    void staging.catch(()=>undefined);
    await settleClient();
    const planIndex=stub.messages.findIndex(message=>message.kind==="PrepareBodyPlan");
    expect(planIndex).toBeGreaterThan(0);
    expect(stub.messages.some(message=>message.kind==="StageBodyCut")).toBe(false);
    // W released while the native plan is still source-only.
    client.setPlayerInput({x:0,z:0,sprint:false,jump:false});client.update();await settleClient();
    const neutral=stub.messages.slice(planIndex).find(message=>message.kind==="Read");
    expect(neutral).toMatchObject({kind:"Read",input:{x:0,z:0}});
    expect(client.read()).toMatchObject({ticks:stub.ticks,moving:{state:"Preparing"}});
    // A Read already in flight when the stage begins must not publish over it.
    stub.holdNextRead=true;client.update();await settleClient();
    expect(stub.held[1]?.kind).toBe("Read");
    stub.release();await settleClient();
    expect(stub.messages.some(message=>message.kind==="StageBodyCut")).toBe(true);
    await staging;
    const beforeLate=client.read();
    stub.release();await settleClient();
    expect(client.read()).toBe(beforeLate);
    const posted=stub.messages.length;
    client.update();await settleClient();
    expect(stub.messages.length).toBe(posted);
    await client.commitBodyCut("cut");client.publishBodyCut();
    expect(client.read().moving.state).toBe("CommittedHeld");
    await client.finalizeBodyCut("cut");
    expect(client.read().moving.state).toBe("Idle");
  });
},120_000);

it("never lets an older rejected branch snapshot prove body rollback or move publication backwards",async()=>{
  await withStubClient(async(client,stub)=>{
    // A rejected branch prepare leaves its non-published Idle reply in the client's held slot.
    await expect(client.prepareBranch({id:"old-branch",generation:0,sourceDigest:"digest",direction:{x:0,y:0,z:1}}))
      .rejects.toThrow(/Stale or pending branch generation/);
    client.update();await settleClient();
    await client.beginBodyCut(bodyRequest("cut-a"));
    const afterBegin=client.read();
    expect(afterBegin.moving).toMatchObject({state:"Preparing",pendingId:"cut-a"});
    await expect(client.stageBodyCut("wrong-id",emptyAdmission)).rejects.toThrow(/Stale body preparation/);
    expect(stub.messages.some(message=>message.kind==="StageBodyCut")).toBe(false);
    await client.rollbackBodyCut("cut-a");
    // The worker really rolled A back; the old branch snapshot was not resurrected.
    expect(stub.messages.filter(message=>message.kind==="RollbackBodyCut")).toMatchObject([{transactionId:"cut-a"}]);
    expect(stub.moving).toBe("Idle");
    expect(client.read().moving).toMatchObject({state:"Idle",pendingId:null});
    expect(client.read().ticks).toBeGreaterThanOrEqual(afterBegin.ticks);
    // Publication order still moves forward.
    const ticks=stub.ticks;
    client.update();await settleClient();
    expect(client.read().ticks).toBe(ticks+1);
    // Only a genuine new pending command can be staged afterwards.
    await expect(client.stageBodyCut("cut-a",emptyAdmission)).rejects.toThrow(/No pending local body work/);
    await client.beginBodyCut(bodyRequest("cut-b"));
    await client.stageBodyCut("cut-b",emptyAdmission);
    expect(stub.moving).toBe("PreparedHeld");
    await client.rollbackBodyCut("cut-b");
    expect(stub.moving).toBe("Idle");
  });
},120_000);
