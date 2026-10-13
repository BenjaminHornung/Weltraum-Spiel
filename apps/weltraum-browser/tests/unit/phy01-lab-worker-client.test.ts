import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createHvpLabPhysicsClient,createHvpFreshLabPhysicsClient,createHvpPhysicsClient,type HvpLabPhysicsClient,type HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";
import {decodeHvpGame,decodeHvpLabGame,encodeHvpLabGame,type HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {hvpCollisionDigest,type HvpLabWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {prepareHvpLabStaticCollision} from "../../src/hestia-prototype/physics/client";
import {replaceHvpLabScene} from "../../src/hestia-prototype/persistence/sceneReplacement";
import type {HvpLabCompleteStaticCollision} from "../../src/hestia-prototype/physics/worldReplacement";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {readHvpBodyCells} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import {meshHvpBranchProducts,type HvpBranchSnapshot} from "../../src/hestia-prototype/presentation/structuralPart";
import {HVP_LAB_PHYSICS_MODE,HVP_PHYSICS_PROTOCOL,readHvpFreshLabSourceHeader} from "../../src/hestia-prototype/physics/physicsProtocol";
import {HVP_BRANCH_CELLS,HVP_BRANCH_KEY,HVP_BRANCH_SUPPORT,resolveHvpGravity} from "../../src/hestia-prototype/physics/profile";
import type {HvpLabPhysicsMessage,HvpLabPhysicsRequest,HvpLabPhysicsReply,HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {HvpChunkPhysicsInput} from "../../src/hestia-prototype/terrain/terrainProducts";
import type {HvpLabPhysicsSession} from "../../src/hestia-prototype/physics/session";

// SYNTHETIC_AUTHORED_CODEC_ONLY: chunk preparation and Worker transport are test doubles; no Native runtime is exercised.
const chunkHarness=vi.hoisted(()=>({
  neighbor:false,
  createSectors:(neighbor:boolean)=>Array.from({length:neighbor?512:256},()=>({vertices:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2])})),
  input:Object.freeze({}),worldId:"synthetic-codec"
}));
const workerHarness=vi.hoisted(()=>({factory:vi.fn(),factoryCalls:[] as unknown[][],fakeWire:false,prepare:vi.fn(),poolStart:vi.fn(),tupleCurrent:vi.fn(),
  poolConstruct:vi.fn(),bindLabTuple:vi.fn(),bindFreshTuple:vi.fn()}));

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {constructor(){workerHarness.poolConstruct();}async start():Promise<void>{workerHarness.poolStart();}async shutdown():Promise<void>{}}}));
vi.mock("../../src/workers/hvpBoundedPump",()=>({createHvpBodyMeshTaskPump:()=>({host:{assertCurrent(){}},dispose(){},
  async run<T>(iterator:Generator<string,T,unknown>):Promise<T>{for(;;){const step=iterator.next();if(step.done){return step.value;}}}})}));
vi.mock("../../src/hestia-prototype/terrain/terrainProducts",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/terrain/terrainProducts")>();
  return {...actual,
    bindHvpLabChunkGameInput:(...args:unknown[])=>workerHarness.bindLabTuple(...args), // Transport double; actual admission is covered in the wire test.
    bindHvpFreshLabChunkInput:(...args:unknown[])=>workerHarness.bindFreshTuple(...args),
    hvpChunkPhysicsInputCredits:()=>({beginLane:()=>({bytes:96*1024*1024}),endLane:()=>{}}),
    prepareHvpChunkPhysicsInputSteps:function*(_input:unknown,_sources:unknown,reserve:(bytes:number)=>void){
      reserve(512*320);yield "synthetic-owned-chunk-copy";
      const sectors=chunkHarness.createSectors(chunkHarness.neighbor);
      return {primary:sectors.slice(0,256),east:sectors.slice(256),worldId:chunkHarness.worldId,assertCurrent:()=>{}};
    }
  };
});
vi.mock("../../src/hestia-prototype/physics/rapierPort",()=>({R:{World:class {}},initializeHvpRapier:async()=>{},isHvpSolidCollider:()=>true}));
vi.mock("../../src/hestia-prototype/physics/session",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/session")>();
  return {...actual,createHvpChunkLabPhysicsSession:workerHarness.factory,
    createHvpFreshChunkLabPhysicsSession:(layout:unknown,_current:()=>boolean,...args:unknown[])=>workerHarness.factory(layout,...args),
    decodeHvpLabWorkerGameWire:(...args:Parameters<typeof actual.decodeHvpLabWorkerGameWire>)=>workerHarness.fakeWire
      ?Object.freeze({game:labGame,release:()=>{}}):actual.decodeHvpLabWorkerGameWire(...args)};
});
vi.mock("../../src/hestia-prototype/physics/worldReplacement",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/worldReplacement")>();
  return {...actual,prepareHvpLabWorldLayoutReplacement:workerHarness.prepare};
});

const assertClientTypes=(publicClient:HvpPhysicsClient,labClient:HvpLabPhysicsClient,labCheckpoint:HvpLabWorldCheckpoint):void=>{
  void publicClient.checkpoint();
  void labClient.checkpointLab();
  // @ts-expect-error Public .12 clients do not expose LAB checkpoint operations.
  void publicClient.checkpointLab();
  // @ts-expect-error LAB clients do not expose public checkpoint operations.
  void labClient.checkpoint();
  // @ts-expect-error LAB checkpoints cannot enter the public restore contract.
  void publicClient.prepareRestore("public-target",labCheckpoint,[]);
};
void assertClientTypes;

const fixtures=createSyntheticAuthoredCodecFixtures();
const labGame=decodeHvpLabGame(fixtures.lab);
const freshHeader=readHvpFreshLabSourceHeader({version:"hvp-fresh-lab-source-v1",worldId:chunkHarness.worldId,sourceSessionId:"fresh-source",
  epoch:3,revision:0,baseDigest:"12345678",sourceDigest:"87654321",sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
  originX:-16,originY:-8,originZ:-16,neighbor:false});
const assertFreshTypes=(request:Extract<HvpLabPhysicsRequest,{kind:"InitializeFreshLab"}>):void=>{
  // @ts-expect-error Fresh initialization cannot accept Game/Checkpoint wire.
  void request.checkpointBytes;
  // @ts-expect-error Solver policy is fixed by the owner, never a wire field.
  void request.solver;
};
void assertFreshTypes;
const clientSnapshot=(disposed=false):HvpPhysicsSnapshot=>({status:disposed?"Disposed":"Paused",bodyCount:disposed?0:1,colliderCount:0,
  collisionBytes:512*48} as HvpPhysicsSnapshot);
const branchMaterials=[{materialId:1,densityKgPerCubicMeter:600,structuralClass:"wood",destructible:true,tags:null}];
const canonicalBranchSource=ingestHvpStructuralCells("hvp-branch",HVP_BRANCH_CELLS,branchMaterials,[{x:0,y:0,z:0}]);
const canonicalBranchRecipe=prepareHvpRigidBody(ingestHvpStructuralCells("hvp-branch-mechanical",HVP_BRANCH_CELLS,branchMaterials));
const canonicalBranchCells=readHvpBodyCells(canonicalBranchRecipe.source);
const canonicalBranchSnapshot=(includeCells:boolean):HvpBranchSnapshot=>({kind:"branch",origin:{x:0,y:0,z:0},cutEdge:4,generation:0,
  sourceDigest:canonicalBranchSource.contentHash,state:"Idle",last:null,preview:null,aimPoint:{x:.75,y:1.25,z:.25},
  attachment:{id:"hvp:branch:foliage",ownerId:HVP_BRANCH_KEY,supportCell:HVP_BRANCH_SUPPORT},parts:[{ownerId:HVP_BRANCH_KEY,
    sourceDigest:canonicalBranchRecipe.source.contentHash,anchored:true,cellCount:canonicalBranchCells.length,
    cells:includeCells?canonicalBranchCells:undefined,center:canonicalBranchRecipe.mass.centerOfMassMeters!,position:{x:0,y:0,z:0},
    orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},massKg:canonicalBranchRecipe.mass.totalMassKg,sleeping:false}]});
const fakeLabSession=(onDispose:()=>void,readSnapshot?:(includeBranchCells:boolean)=>HvpPhysicsSnapshot):HvpLabPhysicsSession=>{
  let disposed=false;
  return {read:(includeBranchCells=false)=>readSnapshot?.(includeBranchCells)??clientSnapshot(disposed),advance:()=>[],input(){},camera(){},aimBranch(){},pause(){},
    dispose(){if(!disposed){disposed=true;onDispose();}},disableBodyPlanTrace(){},
    terrainPrepareSpans:()=>undefined,bodyPrepareSpans:()=>undefined,readTickClock:()=>({status:"Paused",ticks:0,backlogSeconds:0})} as unknown as HvpLabPhysicsSession;
};
const fakeLabSceneClient=(calls:string[])=>{
  const client={read:()=>clientSnapshot(),command:vi.fn(async(_kind:string)=>{calls.push("pause");}),
    prepareLabRestore:vi.fn(async(_id:string,_game:HvpDecodedLabGame,_complete:HvpLabCompleteStaticCollision)=>{calls.push("prepare");return clientSnapshot();}),
    commitLabRestore:vi.fn(async()=>{calls.push("commit");}),publishLabRestore:vi.fn(()=>{calls.push("physics.publish");}),
    finalizeLabRestore:vi.fn(async()=>{calls.push("finalize");}),rollbackLabRestore:vi.fn(async()=>{calls.push("rollback");})};
  return client as unknown as HvpLabPhysicsClient;
};

it("prepares LAB collision from the issued Game and exact private tuple before pool startup",async()=>{
  const sectors=chunkHarness.createSectors(false),{version:_version,profiles:_profiles,signature:_signature,...data}=fixtures.lab;
  const game=decodeHvpLabGame(encodeHvpLabGame({...data,world:{...data.world,collisionDigest:hvpCollisionDigest(sectors)}}));
  const controller=new AbortController();
  try{
    const prepared=await prepareHvpLabStaticCollision([],controller.signal,game,chunkHarness.input as unknown as HvpChunkPhysicsInput);
    expect(workerHarness.poolConstruct).toHaveBeenCalledTimes(1);expect(workerHarness.poolStart).toHaveBeenCalledTimes(1);
    expect(prepared.worldId).toBe(game.checkpoint.world.sessionId);
    expect(prepared.staticLayout).toEqual({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
    expect(prepared.completeCollision.sectors).toHaveLength(256);expect(prepared.completeCollision.layout).toEqual(prepared.staticLayout);
    prepared.assertCurrent();expect(workerHarness.tupleCurrent).toHaveBeenCalled();
  }finally{controller.abort();}
});

it("rejects a foreign LAB tuple before allocating the collision pool",async()=>{
  const controller=new AbortController();workerHarness.bindLabTuple.mockImplementation(()=>{throw new Error("Foreign LAB chunk tuple");});
  try{
    await expect(prepareHvpLabStaticCollision([],controller.signal,labGame,chunkHarness.input as unknown as HvpChunkPhysicsInput))
      .rejects.toThrow(/Foreign LAB chunk tuple/);
    expect(workerHarness.poolConstruct).not.toHaveBeenCalled();expect(workerHarness.poolStart).not.toHaveBeenCalled();
  }finally{controller.abort();}
});

it("rejects a foreign Game before LAB scene preparation and shares the ordered publication transaction",async()=>{
  const calls:string[]=[],physics=fakeLabSceneClient(calls),completeCollision:HvpLabCompleteStaticCollision={
    sectors:chunkHarness.createSectors(false),layout:{version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256}};
  const foreign=decodeHvpGame(fixtures.legacy);
  await expect(replaceHvpLabScene(foreign as unknown as HvpDecodedLabGame,"foreign-lab",physics,completeCollision,
    async()=>({publish(){},rollback(){},finish(){}}),()=>true)).rejects.toThrow(/Unvalidated/);
  expect(physics.prepareLabRestore).not.toHaveBeenCalled();
  await replaceHvpLabScene(labGame,"scene-lab",physics,completeCollision,async()=>{
    calls.push("stage");return {publish(){calls.push("render.publish");},rollback(){calls.push("render.rollback");},finish(){calls.push("render.finish");}};
  },()=>true);
  expect(physics.prepareLabRestore).toHaveBeenCalledWith("scene-lab",labGame,completeCollision);
  expect(calls).toEqual(["prepare","stage","commit","physics.publish","render.publish","finalize","render.finish"]);
});

it("keeps LAB scene RecoveryHold when staging or finalization cleanup is uncertain",async()=>{
  const completeCollision:HvpLabCompleteStaticCollision={sectors:chunkHarness.createSectors(false),
    layout:{version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256}};
  const stagingCalls:string[]=[],stagingPhysics=fakeLabSceneClient(stagingCalls);
  stagingPhysics.rollbackLabRestore=vi.fn(async()=>{throw new Error("rollback uncertain");});
  await expect(replaceHvpLabScene(labGame,"stage-hold",stagingPhysics,completeCollision,async()=>{throw new Error("stage failed");},()=>true))
    .rejects.toThrow(/RecoveryHold/);
  expect(stagingPhysics.rollbackLabRestore).toHaveBeenCalledTimes(1);expect(stagingPhysics.command).toHaveBeenCalledWith("Pause");

  const finalizeCalls:string[]=[],finalizePhysics=fakeLabSceneClient(finalizeCalls),renderRollback=vi.fn();
  finalizePhysics.finalizeLabRestore=vi.fn(async()=>{throw new Error("finalize uncertain");});
  finalizePhysics.rollbackLabRestore=vi.fn(async()=>{throw new Error("rollback after finalize uncertain");});
  await expect(replaceHvpLabScene(labGame,"finalize-hold",finalizePhysics,completeCollision,async()=>({
    publish(){},rollback:renderRollback,finish(){throw new Error("unexpected finish");}
  }),()=>true)).rejects.toThrow(/RecoveryHold/);
  expect(renderRollback).toHaveBeenCalledTimes(1);expect(finalizePhysics.rollbackLabRestore).toHaveBeenCalledTimes(1);
  expect(finalizePhysics.command).toHaveBeenCalledWith("Pause");
});

beforeEach(()=>{workerHarness.factory.mockReset();workerHarness.factoryCalls.length=0;workerHarness.fakeWire=false;workerHarness.prepare.mockReset();
  workerHarness.poolConstruct.mockReset();workerHarness.poolStart.mockReset();workerHarness.tupleCurrent.mockReset();workerHarness.bindLabTuple.mockReset().mockImplementation(()=>workerHarness.tupleCurrent);
  workerHarness.bindFreshTuple.mockReset().mockImplementation(()=>({header:freshHeader,assertCurrent:workerHarness.tupleCurrent}));chunkHarness.neighbor=false;});
afterEach(()=>{vi.unstubAllGlobals();});

// Controller-only cases fake admission and transaction construction; shared ledger tests stay separate.
const withLabWorker=async(run:(handle:(event:MessageEvent<unknown>)=>Promise<void>,replies:HvpLabPhysicsReply[],
  send:(kind:string,extra?:Record<string,unknown>)=>Promise<void>)=>Promise<void>):Promise<void>=>{
  const onmessage=Object.getOwnPropertyDescriptor(globalThis,"onmessage"),postMessage=Object.getOwnPropertyDescriptor(globalThis,"postMessage");
  const replies:HvpLabPhysicsReply[]=[];let nextId=0;
  Object.defineProperty(globalThis,"onmessage",{configurable:true,writable:true,value:null});
  Object.defineProperty(globalThis,"postMessage",{configurable:true,writable:true,value:(reply:HvpLabPhysicsReply)=>replies.push(reply)});
  let send:((kind:string,extra?:Record<string,unknown>)=>Promise<void>)|undefined;
  try{
    vi.resetModules();workerHarness.fakeWire=true;
    await import("../../src/hestia-prototype/physics/physicsWorker");
    const handle=(globalThis as unknown as {onmessage:(event:MessageEvent<unknown>)=>Promise<void>}).onmessage;
    send=(kind,extra={})=>handle({data:{kind,id:nextId++,protocol:HVP_PHYSICS_PROTOCOL,incarnation:"lab-controller-lifetime",
      labMode:HVP_LAB_PHYSICS_MODE,...extra}} as MessageEvent<unknown>);
    await run(handle,replies,send);
  }finally{
    await send?.("Dispose");
    workerHarness.fakeWire=false;
    const target=globalThis as unknown as Record<string,unknown>;
    if(onmessage){Object.defineProperty(globalThis,"onmessage",onmessage);}else{delete target.onmessage;}
    if(postMessage){Object.defineProperty(globalThis,"postMessage",postMessage);}else{delete target.postMessage;}
  }
};
const labInitialize=()=>({sectors:[],staticLayout:{version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256},
  checkpointBytes:new ArrayBuffer(1),measure:false});
const freshInitialize=()=>({sourceHeader:freshHeader,sectors:[],staticLayout:{version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256},
  spawn:{x:0,y:4,z:0},gravity:resolveHvpGravity(),measure:false});

it("binds a private Fresh Worker before await, passes no Game, and disposes the late owner",async()=>{
  const dispose=vi.fn(),owner=fakeLabSession(dispose);let finish!:()=>void,entered!:()=>void;
  const entering=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{finish=r;});
  workerHarness.factory.mockImplementation(async(...args:unknown[])=>{workerHarness.factoryCalls.push(args);entered();await gate;return owner;});
  await withLabWorker(async(_handle,replies,send)=>{
    const starting=send("InitializeFreshLab",freshInitialize());
    try{await Promise.race([entering,starting.then(()=>{throw new Error(`Fresh factory not entered: ${replies.at(-1)?.error??replies.at(-1)?.rejected}`);})]);
      expect(workerHarness.factoryCalls[0]?.[7]).toBe(freshHeader.worldId);
      expect(workerHarness.factoryCalls[0]?.[8]).toBeUndefined();
      await send("InitializeFreshLab",freshInitialize());expect(replies.at(-1)?.rejected).toBe("Physics already initialized/disposed");
      await send("InitializeLab",labInitialize());expect(replies.at(-1)?.rejected).toBe("Physics already initialized/disposed");
      await send("Dispose",{labMode:undefined});expect(replies.at(-1)?.rejected).toBe("Invalid physics owner mode binding");
      expect(dispose).not.toHaveBeenCalled();
      await send("Dispose");finish();await starting;
      expect(dispose).toHaveBeenCalledTimes(1);expect(replies.at(-1)?.clock?.timers).toBe(0);
    }finally{finish();await starting;}
  });
});

it("requests canonical branch cells for Fresh initialization and keeps periodic reads light",async()=>{
  const readCells:boolean[]=[];
  workerHarness.factory.mockResolvedValue(fakeLabSession(()=>undefined,includeCells=>{
    readCells.push(includeCells);return {...clientSnapshot(),structural:canonicalBranchSnapshot(includeCells)};
  }));
  expect(()=>meshHvpBranchProducts(canonicalBranchSnapshot(false))).toThrow("Missing canonical branch cells");
  expect(meshHvpBranchProducts(canonicalBranchSnapshot(true))).toHaveLength(2);
  await withLabWorker(async(_handle,replies,send)=>{
    await send("InitializeFreshLab",freshInitialize());
    const initialized=replies.at(-1)?.snapshot;
    expect(initialized?.structural?.parts[0]?.cells).toEqual(canonicalBranchCells);
    expect(meshHvpBranchProducts(initialized!.structural!)).toHaveLength(2);
    await send("Read");
    expect(readCells).toEqual([true,false]);
  });
});

it.each(["revision","neighbor","checkpoint"])("rejects invalid Fresh wire before its factory (%s)",async kind=>{
  workerHarness.factory.mockResolvedValue(fakeLabSession(()=>undefined));
  await withLabWorker(async(_handle,replies,send)=>{
    const input=kind==="checkpoint"?{...freshInitialize(),checkpointBytes:new ArrayBuffer(1)}
      :{...freshInitialize(),sourceHeader:{...freshHeader,...(kind==="revision"?{revision:37}:{neighbor:true})}};
    await send("InitializeFreshLab",input);
    expect(workerHarness.factory).not.toHaveBeenCalled();expect(replies.at(-1)?.error).toMatch(/fresh LAB/);
    expect(replies.at(-1)?.clock?.timers).toBe(0);
  });
});

it("transfers an owned Fresh source header without fabricating a Game or using Public initialization",async()=>{
  const messages:HvpLabPhysicsMessage[]=[];
  class FreshWorker {
    onmessage:((event:MessageEvent<HvpLabPhysicsReply>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;
    onmessageerror:((event:MessageEvent)=>void)|null=null;sequence=0;
    postMessage(message:HvpLabPhysicsMessage,buffers:Transferable[]=[]):void{
      messages.push(structuredClone(message,{transfer:buffers}));const disposed=message.kind==="Dispose";
      const reply:HvpLabPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,
        snapshot:clientSnapshot(disposed),labModeProof:HVP_LAB_PHYSICS_MODE,
        clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]}};
      queueMicrotask(()=>this.onmessage?.({data:reply} as MessageEvent<HvpLabPhysicsReply>));
    }
    terminate(){}
  }
  vi.stubGlobal("Worker",FreshWorker);const controller=new AbortController();let client:HvpLabPhysicsClient|undefined;
  try{
    client=await createHvpFreshLabPhysicsClient([],{x:0,y:4,z:0},controller.signal,chunkHarness.input as unknown as HvpChunkPhysicsInput);
    const initialize=messages[0];expect(initialize?.kind).toBe("InitializeFreshLab");
    if(initialize?.kind!=="InitializeFreshLab"){throw new Error("Missing Fresh initialization");}
    expect(initialize.sourceHeader).toEqual(freshHeader);expect(initialize.sectors).toHaveLength(256);
    expect("checkpoint" in initialize||"checkpointBytes" in initialize||"game" in initialize).toBe(false);
    expect(initialize.labMode).toBe(HVP_LAB_PHYSICS_MODE);await client.dispose();
  }finally{controller.abort();if(client){await client.dispose().catch(()=>undefined);}}
});

it("disposes a late Init owner without starting its clock",async()=>{
  const dispose=vi.fn(),owner=fakeLabSession(dispose);let finish!:()=>void,entered!:()=>void;
  const entering=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{finish=r;});
  workerHarness.factory.mockImplementation(async()=>{entered();await gate;return owner;});
  await withLabWorker(async(_handle,replies,send)=>{
    const starting=send("InitializeLab",labInitialize());
    try{await entering;await send("Dispose");finish();await starting;
      expect(dispose).toHaveBeenCalledTimes(1);expect(replies.at(-1)?.clock?.timers).toBe(0);
      expect(owner.read().status).toBe("Disposed");
    }finally{finish();await starting;}
  });
});

it("cleans a candidate returned after Dispose during LAB restore preparation",async()=>{
  const aDispose=vi.fn(),bDispose=vi.fn(),before=fakeLabSession(aDispose),candidate=fakeLabSession(bDispose);
  let finish!:()=>void,entered!:()=>void;const entering=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{finish=r;});
  const transaction={candidate,state:"Prepared",dispose:vi.fn(()=>{candidate.dispose();before.dispose();})};
  workerHarness.factory.mockResolvedValue(before);
  workerHarness.prepare.mockImplementation(async(_owner,_game,_complete,current:()=>boolean)=>{
    entered();await gate;expect(current()).toBe(false);return transaction;
  });
  await withLabWorker(async(_handle,replies,send)=>{
    await send("InitializeLab",labInitialize());
    const preparing=send("PrepareLabRestore",{transactionId:"cancel-lab",checkpointBytes:new ArrayBuffer(1),completeCollision:{}});
    try{await entering;await send("Dispose");finish();await preparing;
      expect(replies.at(-1)?.rejected).toBe("LAB restore disposed");expect(transaction.dispose).toHaveBeenCalledTimes(1);
      expect(aDispose).toHaveBeenCalledTimes(1);expect(bDispose).toHaveBeenCalledTimes(1);
      expect(replies.at(-1)?.clock?.timers).toBe(0);
    }finally{finish();await preparing;}
  });
});

it("retains a preparation RecoveryHold transaction for subsequent terminal A and B cleanup",async()=>{
  const aDispose=vi.fn(),bDispose=vi.fn(),before=fakeLabSession(aDispose),candidate=fakeLabSession(bDispose);
  const transaction={candidate,state:"RecoveryHold" as const,commit:()=>candidate,rollback:()=>before,finalize:()=>{},
    dispose:vi.fn(()=>{candidate.dispose();before.dispose();})};
  workerHarness.factory.mockResolvedValue(before);
  await withLabWorker(async(_handle,replies,send)=>{
    const {HvpLabWorldReplacementPreparationError}=await import("../../src/hestia-prototype/physics/worldReplacement");
    workerHarness.prepare.mockRejectedValue(new HvpLabWorldReplacementPreparationError(transaction,new Error("fake uncertain cleanup")));
    await send("InitializeLab",labInitialize());
    await send("PrepareLabRestore",{transactionId:"hold-lab",checkpointBytes:new ArrayBuffer(1),completeCollision:{}});
    expect(replies.at(-1)).toMatchObject({restoreState:"RecoveryHold"});expect(aDispose).not.toHaveBeenCalled();expect(bDispose).not.toHaveBeenCalled();
    await send("Read");expect(replies.at(-1)?.restoreState).toBe("RecoveryHold");
    await send("Dispose");expect(transaction.dispose).toHaveBeenCalledTimes(1);
    expect(aDispose).toHaveBeenCalledTimes(1);expect(bDispose).toHaveBeenCalledTimes(1);expect(replies.at(-1)?.clock?.timers).toBe(0);
  });
});

it.each([false,true])("transfers the exact LAB checkpoint wire and requires the fixed owner proof (neighbor=%s)",async neighbor=>{
  chunkHarness.neighbor=neighbor;
  const neighborRoot=neighbor?createHvpTerrainRoot(await createHvpEastRegion(),"synthetic-codec-east",0):undefined;
  const {version:_version,profiles:_profiles,signature:_signature,...data}=fixtures.lab;
  const checkpoint=encodeHvpLabGame({...data,world:{...data.world,collisionDigest:hvpCollisionDigest(chunkHarness.createSectors(neighbor)),
    coverage:neighborRoot?[...data.world.coverage,{minX:16,maxX:48,minZ:-16,maxZ:16}]:data.world.coverage,
    neighbor:neighborRoot?{version:"hvp-neighbor-world-v1",epoch:1,resident:true,sourceDigest:neighborRoot.read().sourceDigest,baseSectorCount:256}:null},
    ...(neighborRoot?{neighbor:{version:"hvp-neighbor-scene-v1",terrain:neighborRoot.checkpoint(),lod:.125}}:{})});
  const initialGame=decodeHvpLabGame(checkpoint);
  let worker:LabClientWorker|undefined;
  class LabClientWorker {
    onmessage:((event:MessageEvent<HvpPhysicsReply|HvpLabPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
    readonly messages:(HvpPhysicsMessage|HvpLabPhysicsMessage)[]=[];sequence=0;terminated=false;
    constructor(){worker=this;}
    postMessage(message:HvpPhysicsMessage|HvpLabPhysicsMessage,transfers:Transferable[]=[]):void{
      const received=structuredClone(message,{transfer:transfers}) as HvpPhysicsMessage|HvpLabPhysicsMessage;this.messages.push(received);
      const disposed=message.kind==="Dispose",checkpoint=message.kind==="CheckpointLab"?{} as HvpLabWorldCheckpoint:undefined;
      const reply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,snapshot:clientSnapshot(disposed),
        clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]},
        ...(checkpoint===undefined?{}:{checkpointLab:checkpoint}),labModeProof:HVP_LAB_PHYSICS_MODE} as HvpLabPhysicsReply;
      queueMicrotask(()=>this.onmessage?.({data:{...reply,incarnation:"old-foreign-incarnation",labModeProof:undefined}} as unknown as MessageEvent<HvpLabPhysicsReply>));
      queueMicrotask(()=>this.onmessage?.({data:reply} as MessageEvent<HvpLabPhysicsReply>));
    }
    terminate():void{this.terminated=true;}
  }
  vi.stubGlobal("Worker",LabClientWorker);
  const controller=new AbortController();let client:HvpLabPhysicsClient|undefined;
  try{
    client=await createHvpLabPhysicsClient([],controller.signal,chunkHarness.input as unknown as HvpChunkPhysicsInput,initialGame);
    const initialize=worker!.messages[0];
    expect(initialize?.kind).toBe("InitializeLab");expect("labMode" in initialize&&initialize.labMode).toBe(HVP_LAB_PHYSICS_MODE);
    if(initialize?.kind!=="InitializeLab"){throw new Error("Missing private LAB initialization");}
    expect(initialize.sectors).toHaveLength(neighbor?512:256);expect(initialize.staticLayout).toEqual({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
    expect(initialize.checkpointBytes).toBeInstanceOf(ArrayBuffer);
    expect(JSON.parse(new TextDecoder().decode(initialize.checkpointBytes))).toEqual(checkpoint);
    expect(worker!.messages).toHaveLength(1);
    await client.checkpointLab();expect(worker!.messages[1]?.kind).toBe("CheckpointLab");
    await client.dispose();expect(worker!.terminated).toBe(true);
  }finally{controller.abort();if(client){await client.dispose().catch(()=>undefined);}}

  class MissingProofWorker {
    onmessage:((event:MessageEvent<HvpPhysicsReply|HvpLabPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
    postMessage(message:HvpPhysicsMessage|HvpLabPhysicsMessage):void{
      const reply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:1,snapshot:clientSnapshot()} as HvpPhysicsReply;
      queueMicrotask(()=>this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>));
    }
    terminate():void{}
  }
  vi.stubGlobal("Worker",MissingProofWorker);
  const rejectedController=new AbortController();
  try{
    await expect(createHvpLabPhysicsClient([],rejectedController.signal,chunkHarness.input as unknown as HvpChunkPhysicsInput,initialGame))
      .rejects.toThrow(/Invalid physics owner mode reply/);
  }finally{rejectedController.abort();}
});

it("locks the worker to LAB before its first awaited factory and rejects mixed or repeated initialization",async()=>{
  const previousOnmessage=Object.getOwnPropertyDescriptor(globalThis,"onmessage"),previousPostMessage=Object.getOwnPropertyDescriptor(globalThis,"postMessage");
  const replies:(HvpPhysicsReply|HvpLabPhysicsReply)[]=[],incarnation="lab-worker-test-1";
  Object.defineProperty(globalThis,"onmessage",{configurable:true,writable:true,value:null});
  Object.defineProperty(globalThis,"postMessage",{configurable:true,writable:true,value:(reply:HvpPhysicsReply|HvpLabPhysicsReply)=>replies.push(reply)});
  const labSession=fakeLabSession(()=>undefined);let releaseFactory!:()=>void;
  const factoryGate=new Promise<void>(resolve=>{releaseFactory=resolve;});
  workerHarness.factory.mockImplementation(async(...args:unknown[])=>{workerHarness.factoryCalls.push(args);await factoryGate;return labSession;});
  let handle:((event:MessageEvent<unknown>)=>Promise<void>)|undefined,starting:Promise<void>|undefined,disposeSent=false;
  try{
    vi.resetModules();
    await import("../../src/hestia-prototype/physics/physicsWorker");
    const workerPort=globalThis as unknown as {onmessage?:(event:MessageEvent<unknown>)=>Promise<void>};
    handle=workerPort.onmessage;if(handle===undefined){throw new Error("Worker handler was not installed");}
    const bytes=new TextEncoder().encode(JSON.stringify(fixtures.lab));
    const initializeLab={kind:"InitializeLab",id:0,protocol:HVP_PHYSICS_PROTOCOL,incarnation,labMode:HVP_LAB_PHYSICS_MODE,
      sectors:[],staticLayout:{version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256},checkpointBytes:bytes.buffer,measure:false};
    starting=handle({data:initializeLab} as MessageEvent<unknown>);
    await Promise.resolve();await Promise.resolve();
    expect(workerHarness.factory).toHaveBeenCalledTimes(1);
    const publicInitialize={kind:"Initialize",id:1,protocol:HVP_PHYSICS_PROTOCOL,incarnation,sectors:[],spawn:{x:0,y:0,z:0},gravity:0,sessionId:"ignored"};
    await handle({data:publicInitialize} as MessageEvent<unknown>);
    expect(replies.at(-1)).toMatchObject({id:1,rejected:"Invalid physics owner mode binding",labModeProof:HVP_LAB_PHYSICS_MODE});
    expect(workerHarness.factory).toHaveBeenCalledTimes(1);
    releaseFactory();await starting;
    expect(workerHarness.factoryCalls).toHaveLength(1);
    const admitted=workerHarness.factoryCalls[0]?.[8] as {checkpoint?:{world?:{sessionId?:string}}}|undefined;
    expect(admitted?.checkpoint?.world?.sessionId).toBe("synthetic-codec");
    expect((initializeLab as {checkpointBytes?:unknown}).checkpointBytes).toBeUndefined();
    const repeated={...initializeLab,id:2,checkpointBytes:bytes.buffer};
    await handle({data:repeated} as MessageEvent<unknown>);
    expect(replies.at(-1)).toMatchObject({id:2,rejected:"Physics already initialized/disposed",labModeProof:HVP_LAB_PHYSICS_MODE});
    expect(workerHarness.factory).toHaveBeenCalledTimes(1);
    await handle({data:{kind:"Dispose",id:3,protocol:HVP_PHYSICS_PROTOCOL,incarnation,labMode:HVP_LAB_PHYSICS_MODE} as unknown} as MessageEvent<unknown>);
    expect(replies.at(-1)).toMatchObject({id:3,labModeProof:HVP_LAB_PHYSICS_MODE});
    disposeSent=true;
  }finally{
    releaseFactory();if(starting){await starting.catch(()=>undefined);}
    if(handle&&!disposeSent){await handle({data:{kind:"Dispose",id:4,protocol:HVP_PHYSICS_PROTOCOL,incarnation,labMode:HVP_LAB_PHYSICS_MODE}} as MessageEvent<unknown>).catch(()=>undefined);}
    const target=globalThis as unknown as Record<string,unknown>;
    if(previousOnmessage===undefined){delete target.onmessage;}else{Object.defineProperty(globalThis,"onmessage",previousOnmessage);}
    if(previousPostMessage===undefined){delete target.postMessage;}else{Object.defineProperty(globalThis,"postMessage",previousPostMessage);}
  }
});

it("keeps the public factory on the legacy request form without a LAB owner label",async()=>{
  const messages:HvpPhysicsMessage[]=[];
  class PublicClientWorker {
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
    sequence=0;terminated=false;
    postMessage(message:HvpPhysicsMessage,transfers:Transferable[]=[]):void{
      const received=structuredClone(message,{transfer:transfers});messages.push(received);
      const disposed=message.kind==="Dispose";
      const reply:HvpPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,snapshot:clientSnapshot(disposed),
        clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]}};
      queueMicrotask(()=>this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>));
    }
    terminate():void{this.terminated=true;}
  }
  vi.stubGlobal("Worker",PublicClientWorker);const controller=new AbortController();let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal);
    expect(messages[0]?.kind).toBe("Initialize");expect("labMode" in messages[0]!).toBe(false);
    await client.dispose();
  }finally{controller.abort();if(client){await client.dispose().catch(()=>undefined);}}
});

it("rejects a private saved collision mismatch before constructing a Worker or falling back to legacy geometry",async()=>{
  const constructor=vi.fn();
  vi.stubGlobal("Worker",class {constructor(){constructor();throw new Error("UNEXPECTED_WORKER");}});
  const controller=new AbortController();
  try{
    await expect(createHvpLabPhysicsClient([],controller.signal,chunkHarness.input as unknown as HvpChunkPhysicsInput,labGame))
      .rejects.toThrow("LAB saved collision requires complete Chunk representation");
    expect(constructor).not.toHaveBeenCalled();
  }finally{controller.abort();}
});
