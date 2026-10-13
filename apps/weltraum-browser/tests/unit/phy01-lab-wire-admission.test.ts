import {expect,it,vi} from "vitest";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";
import {decodeHvpLabGame,decodeHvpColdLabGame,encodeHvpLabGame,HVP_SAVE_TRANSPORT_BYTES} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {createPersistenceSignature} from "../../src/persistence";
import {decodeHvpLabWorkerGameWire,createHvpChunkLabPhysicsSession,createHvpFreshChunkLabPhysicsSession,issueHvpLabWorldReplacementCapture,
  bindHvpLabWorldReplacementCaptureSectors,createHvpLabReplacementCandidate} from "../../src/hestia-prototype/physics/session";
import {ownHvpLabCompleteStaticCollision} from "../../src/hestia-prototype/physics/labCollisionCapture";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {HVP_SOLVER_PROFILE} from "../../src/hestia-prototype/physics/profile";
import {bindHvpLabChunkGameInput,bindHvpFreshLabChunkInput,bindHvpChunkPhysicsInput,createHvpTerrainCompiler,discardHvpOwnedTerrainProducts,
  type HvpChunkPhysicsInput} from "../../src/hestia-prototype/terrain/terrainProducts";
import {WorkerPool,type WorkerJobTerminal} from "../../src/workers/workerPool";
import {executeHvpChunkJob,HVP_CHUNK_JOB,executeHvpEastChunkCollisionJob,HVP_EAST_CHUNK_COLLISION_JOB} from "../../src/workers/hvpChunkJob";
import {workerEpoch} from "../../src/workers/ids";
import {transferListFor} from "../../src/workers/protocol";
import type {HvpChunkStaticLayout} from "../../src/hestia-prototype/physics/staticTerrainLayout";
import type {HvpCollisionSector,HvpCollisionSource} from "../../src/hestia-prototype/physics/terrainColliders";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {readHvpFreshLabSourceHeader} from "../../src/hestia-prototype/physics/physicsProtocol";
import {createHvpFreshLabPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {createHvpTerrainRoot,restoreHvpPrivateTerrainRoot,prepareHvpPrivateTerrainCut} from "../../src/hestia-prototype/terrain/cutPlan";

// Actual codecs/copy/tuple checks, synthetic Source and fake Native/pool. No WASM, browser or heap measurement.
const native=vi.hoisted(()=>({init:vi.fn(),world:vi.fn(),locomotion:vi.fn(),restoreBody:vi.fn()}));
vi.mock("../../src/hestia-prototype/physics/rapierPort",()=>{
  class World {
    private nextHandle=1;
    private bodyItems=new Map<number,any>();
    private colliderItems=new Map<number,any>();
    bodies={len:()=>this.bodyItems.size,forEach:(callback:(body:any)=>void)=>this.bodyItems.forEach(callback)};
    colliders={len:()=>this.colliderItems.size,forEach:(callback:(collider:any)=>void)=>this.colliderItems.forEach(callback)};
    constructor(){native.world();}
    createRigidBody(desc:any){
      const attached:any[]=[],handle=this.nextHandle++,position=desc.translation??{x:0,y:4,z:0},rotation=desc.rotation??{x:0,y:0,z:0,w:1};
      const body={handle,attached,numColliders:()=>attached.length,isEnabled:()=>true,isDynamic:()=>desc.dynamic!==false,isFixed:()=>desc.dynamic===false,
        isSleeping:()=>desc.sleeping===true,isCcdEnabled:()=>desc.ccd!==false,enableCcd:()=>undefined,translation:()=>position,rotation:()=>rotation,
        linvel:()=>desc.linvel??{x:0,y:0,z:0},angvel:()=>desc.angvel??{x:0,y:0,z:0},collider:(index:number)=>attached[index],setEnabled:()=>undefined,
        sleep:()=>undefined,wakeUp:()=>undefined};
      this.bodyItems.set(handle,body);return body;
    }
    createCollider(desc:any,body?:any){
      const handle=this.nextHandle++,surface=desc.surface??{},collider={handle,parent:()=>body,isSensor:()=>false,isEnabled:()=>true,
        friction:()=>surface.friction??.5,restitution:()=>surface.restitution??0,frictionCombineRule:()=>surface.frictionCombine??0,
        restitutionCombineRule:()=>surface.restitutionCombine??0,setFriction:()=>undefined,setRestitution:()=>undefined,
        setFrictionCombineRule:()=>undefined,setRestitutionCombineRule:()=>undefined,setEnabled:()=>undefined};
      this.colliderItems.set(handle,collider);body?.attached.push(collider);return collider;
    }
    getRigidBody(handle:number){return this.bodyItems.get(handle)??null;}
    getCollider(handle:number){return this.colliderItems.get(handle)??null;}
    removeRigidBody(body:any){this.bodyItems.delete(body.handle);for(const collider of body.attached){this.colliderItems.delete(collider.handle);}}
    removeCollider(collider:any){this.colliderItems.delete(collider.handle);}
    propagateModifiedBodyPositionsToColliders(){}
    updateSceneQueries(){}
    step(){}
    free(){this.bodyItems.clear();this.colliderItems.clear();}
  }
  const descriptor=(extra:any={})=>{const value:any={translation:{x:0,y:4,z:0},dynamic:true,...extra};
    value.setTranslation=(x:number,y:number,z:number)=>{value.translation={x,y,z};return value;};
    value.setCcdEnabled=(enabled:boolean)=>{value.ccd=enabled;return value;};return value;};
  const colliderDescriptor=(extra:any={})=>{const value:any={...extra};
    value.setDensity=()=>value;value.setFriction=()=>value;value.setRestitution=()=>value;value.setEnabled=()=>value;return value;};
  return {R:{World,RigidBodyDesc:{dynamic:()=>descriptor(),fixed:()=>descriptor({dynamic:false})},
    ColliderDesc:{cuboid:()=>colliderDescriptor(),trimesh:()=>colliderDescriptor()},ShapeType:{Cuboid:0},PHY01_SOLVER_VERSION:"rapier-0.21.0-phy01.migration2:legacy-impulse-v1"},
    initializeHvpRapier:()=>native.init(),isHvpSolidCollider:()=>true};
});
vi.mock("../../src/hestia-prototype/player/locomotion",()=>({createHvpLocomotion:(_world:any,spawn:any,_gravity:number,_covered:unknown,saved:any)=>{
  native.locomotion(saved);return {read:()=>({status:"Walking",position:spawn}),checkpoint:()=>saved,setEnabled:()=>undefined,step:()=>undefined,dispose:()=>undefined};
}}));
vi.mock("../../src/hestia-prototype/physics/restoreBody",()=>({restoreHvpBody:(world:any,saved:any)=>{
  native.restoreBody(saved);const body=world.createRigidBody({translation:saved.motion.translationMeters,rotation:saved.motion.rotation,dynamic:saved.checkpoint.dynamic,
    sleeping:saved.checkpoint.sleeping,ccd:saved.checkpoint.ccd,linvel:saved.motion.linvelMetersPerSecond,angvel:saved.motion.angvelRadPerSecond});
  for(const surface of saved.checkpoint.surfaces){world.createCollider({surface},body);}return body;
}}));
const layout:HvpChunkStaticLayout=Object.freeze({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
const empty=():HvpCollisionSector=>({vertices:new Float32Array(0),indices:new Uint32Array(0)});

it("rejects aggregate Wire plus decoder Prepare before admitting the padded valid Game",async()=>{
  const grid=vi.spyOn(await import("../../src/hestia-prototype/persistence/gridCheckpoint"),"decodeHvpGrid");
  const terrain=vi.spyOn(await import("../../src/hestia-prototype/terrain/cutPlan"),"createHvpPrivateTerrainRoot");
  const {lab}=createSyntheticAuthoredCodecFixtures(),text=JSON.stringify(lab);
  grid.mockClear();terrain.mockClear();
  const wire=new TextEncoder().encode(text+" ".repeat(HVP_SAVE_TRANSPORT_BYTES-text.length));
  native.init.mockClear();native.world.mockClear();
  try{
    expect(()=>decodeHvpLabWorkerGameWire(undefined,wire.buffer,"coupled-wire",()=>true)).toThrow(/Prepare96MiB/);
    expect(grid).not.toHaveBeenCalled();expect(terrain).not.toHaveBeenCalled();
    expect(native.init).not.toHaveBeenCalled();expect(native.world).not.toHaveBeenCalled();
  }finally{grid.mockRestore();terrain.mockRestore();}
});

it("rejects a Cold callback that changes and resigns the already checked LAB profile before grid allocation",async()=>{
  const {lab}=createSyntheticAuthoredCodecFixtures(),input=structuredClone(lab);
  const grid=vi.spyOn(await import("../../src/hestia-prototype/persistence/gridCheckpoint"),"decodeHvpGrid");
  const terrain=vi.spyOn(await import("../../src/hestia-prototype/terrain/cutPlan"),"createHvpPrivateTerrainRoot");
  let admissions=0;
  try{
    expect(()=>decodeHvpColdLabGame(input,()=>{
      admissions+=1;
      const {signature:_signature,...data}=input;
      const changed={...data,profiles:{...data.profiles,solver:{...data.profiles.solver,dynamicGyroscopicForces:true}}};
      Object.assign(input,changed,{signature:createPersistenceSignature(changed)});
    })).toThrow(/save signature mismatch/);
    expect(admissions).toBe(1);expect(grid).not.toHaveBeenCalled();expect(terrain).not.toHaveBeenCalled();
  }finally{grid.mockRestore();terrain.mockRestore();}
});

it("admits the canonical signed LAB Game through wire, capture, and candidate phase ledgers",async()=>{
  const {lab}=createSyntheticAuthoredCodecFixtures(),sectors=Array.from({length:256},empty);
  const {version:_version,profiles:_profiles,signature:_signature,...data}=lab;
  const canonical=encodeHvpLabGame({...data,world:{...data.world,collisionDigest:hvpCollisionDigest(sectors)}});
  const game=decodeHvpLabGame(canonical),world=game.checkpoint.world;
  expect(canonical.profiles.solver).toEqual(HVP_SOLVER_PROFILE);
  expect(canonical.profiles.solver.dynamicGyroscopicForces).toBe(false);
  let before:Awaited<ReturnType<typeof createHvpChunkLabPhysicsSession>>|undefined;
  let admission:ReturnType<typeof decodeHvpLabWorkerGameWire>|undefined;
  native.init.mockReset();native.world.mockClear();native.locomotion.mockClear();native.restoreBody.mockClear();
  const sentinel="LAB_CANDIDATE_NATIVE_INIT_SENTINEL";
  native.init.mockImplementation(async()=>{if(native.init.mock.calls.length===2){throw new Error(sentinel);}});
  try{
    before=await createHvpChunkLabPhysicsSession(layout,sectors,world.dropSpawn,world.gravity,undefined,undefined,undefined,world.sessionId,game);
    before.pause();
    const wire=new TextEncoder().encode(JSON.stringify(canonical));
    admission=decodeHvpLabWorkerGameWire(before,wire.buffer,"canonical-phases",()=>true);
    expect(admission.game.checkpoint.world.solver).toBe(HVP_SOLVER_PROFILE.id);
    const capture=issueHvpLabWorldReplacementCapture(before,admission.game,[],()=>true,{sectors,layout});
    const complete=capture.complete;
    if(!complete){throw new Error("Missing module-owned complete capture");}
    bindHvpLabWorldReplacementCaptureSectors(capture.witness,complete.sectors,layout);
    await expect(createHvpLabReplacementCandidate(capture.witness,admission.game,complete.sectors,false)).rejects.toThrow(sentinel);
    expect(native.init).toHaveBeenCalledTimes(2);
    expect(native.world).toHaveBeenCalledTimes(1);
    expect(native.restoreBody).toHaveBeenCalledTimes(1);expect(native.locomotion).toHaveBeenCalledTimes(1);
  }finally{
    admission?.release();admission?.release();before?.dispose();native.init.mockReset();
  }
});

it("counts a complete transfer's whole backing before copying its small view",()=>{
  const sectors=Array.from({length:256},empty),buffer=new ArrayBuffer(16*1024*1024);
  sectors[0]={vertices:new Float32Array(buffer,0,9),indices:new Uint32Array([0,1,2])};
  const ledger=createStructuralOwnerLedger(241*1024*1024);
  try{expect(()=>ownHvpLabCompleteStaticCollision({sectors,layout},ledger.reserve)).toThrow(/CPU256MiB/);}
  finally{ledger.release();}
  expect(buffer.byteLength).toBe(16*1024*1024);expect(ledger.resources.reservedBytes).toBe(0);
});

it("cancels early wire release at the fake Init await before any World is constructed",async()=>{
  const {lab}=createSyntheticAuthoredCodecFixtures(),sectors=Array.from({length:256},empty);
  const {version:_v,profiles:_p,signature:_s,...data}=lab;
  const game=encodeHvpLabGame({...data,world:{...data.world,collisionDigest:hvpCollisionDigest(sectors)}});
  let entered!:()=>void,finish!:()=>void;
  const entering=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{finish=r;});
  native.world.mockClear();native.init.mockImplementation(()=>{entered();return gate;});
  const admission=decodeHvpLabWorkerGameWire(undefined,new TextEncoder().encode(JSON.stringify(game)).buffer,"early-release",()=>true);
  const starting=createHvpChunkLabPhysicsSession(layout,sectors,game.world.dropSpawn,game.world.gravity,undefined,undefined,undefined,game.world.sessionId,admission.game);
  const rejected=expect(starting).rejects.toThrow(/Stale LAB Worker game-wire owner/);
  try{await entering;admission.release();finish();await rejected;expect(native.world).not.toHaveBeenCalled();}
  finally{finish();admission.release();native.init.mockReset();}
});

it("cancels Fresh admission across fake Native Init before World construction",async()=>{
  let current=true,entered!:()=>void,finish!:()=>void;
  const entering=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{finish=r;});
  native.world.mockClear();native.init.mockImplementation(()=>{entered();return gate;});
  const starting=createHvpFreshChunkLabPhysicsSession(layout,()=>current,Array.from({length:256},empty),{x:0,y:4,z:0},9.81,
    undefined,undefined,undefined,"fresh-cancellation");
  const rejected=expect(starting).rejects.toThrow(/Stale fresh LAB Worker owner/);
  try{await entering;current=false;finish();await rejected;expect(native.world).not.toHaveBeenCalled();}
  finally{current=false;finish();native.init.mockReset();}
});

it("joins a real owned Chunk tuple to the signed Game header despite identical World ID and geometry",async()=>{
  const {lab}=createSyntheticAuthoredCodecFixtures(),game=decodeHvpLabGame(lab),root=game.root,source=root.read(),sources=[source];
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,_grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);
    if(request.jobKind!==HVP_CHUNK_JOB){throw new Error("Unexpected synthetic job");}
    const output=executeHvpChunkJob(request,structuredClone(bundle,{transfer:transferListFor(bundle)}));
    return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined;
  try{
    await compiler.prepare(()=>true,root);products=await compiler.initialChunks(source,undefined,16*1024*1024,game.checkpoint.world.sessionId);
    const tuple=bindHvpChunkPhysicsInput(root,products,sources),current=bindHvpLabChunkGameInput(tuple,sources,game);expect(()=>current()).not.toThrow();
    const fresh=bindHvpFreshLabChunkInput(tuple,sources);
    expect(fresh.header).toMatchObject({version:"hvp-fresh-lab-source-v1",worldId:game.checkpoint.world.sessionId,
      sourceSessionId:source.sessionId,epoch:source.epoch,revision:0,baseDigest:source.baseDigest,sourceDigest:source.sourceDigest,
      sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originX:-16,originY:-8,originZ:-16,neighbor:false});
    expect(()=>fresh.assertCurrent()).not.toThrow();
    expect(()=>readHvpFreshLabSourceHeader({...fresh.header,revision:37})).toThrow(/fresh LAB source header/);
    expect(()=>readHvpFreshLabSourceHeader({...fresh.header,neighbor:true})).toThrow(/fresh LAB source header/);
    expect(()=>bindHvpFreshLabChunkInput(Object.freeze({}) as unknown as HvpChunkPhysicsInput,sources)).toThrow(/Foreign|tuple/i);
    const smallExtra:HvpCollisionSource={sizeX:16,sizeY:16,sizeZ:16,cellMeters:.125,originMeters:{x:40,y:0,z:40},readSlot:()=>0};
    const smallSources=[source,smallExtra],smallTuple=bindHvpChunkPhysicsInput(root,products,smallSources);
    expect(()=>bindHvpFreshLabChunkInput(smallTuple,smallSources)).not.toThrow();
    const secondaryCanonical:HvpCollisionSource={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
      originMeters:{x:400,y:72,z:800},readSlot:()=>0};
    const canonicalSources=[source,secondaryCanonical],canonicalTuple=bindHvpChunkPhysicsInput(root,products,canonicalSources);
    expect(()=>bindHvpFreshLabChunkInput(canonicalTuple,canonicalSources)).toThrow(/secondary|neighbor|canonical/i);
    const {version:_v,profiles:_p,signature:_s,...data}=lab;
    const other=decodeHvpLabGame(encodeHvpLabGame({...data,terrain:{...data.terrain,epoch:data.terrain.epoch+1}}));
    expect(other.checkpoint.world.sessionId).toBe(game.checkpoint.world.sessionId);
    expect(other.checkpoint.world.collisionDigest).toBe(game.checkpoint.world.collisionDigest);
    expect(()=>bindHvpLabChunkGameInput(tuple,sources,other)).toThrow(/LAB Game\/Chunk Source binding mismatch/);
    discardHvpOwnedTerrainProducts(products);expect(()=>current()).toThrow(/expired|Stale/i);expect(()=>fresh.assertCurrent()).toThrow(/expired|Stale/i);
  }finally{if(products){discardHvpOwnedTerrainProducts(products);}await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();}
},120_000);

it.each(["edited37","neighbor"])("rejects a real unsuitable Fresh tuple before Client pool/Worker creation (%s)",async kind=>{
  const root=restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
    originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",readSlot:(x,y,z)=>x<37&&y===10&&z===10?1:0},"fresh-primary",5).checkpoint());
  if(kind==="edited37"){
    for(let x=0;x<37;x++){
      const source=root.read();root.commit(prepareHvpPrivateTerrainCut(root,{sessionId:source.sessionId,epoch:source.epoch,revision:source.revision,sourceDigest:source.sourceDigest,
        commandId:`fresh-edit-${x}`,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,10,10],max:[x+1,11,11]}}));
    }
    expect(root.read().revision).toBe(37);
  }
  const east=kind==="neighbor"?restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
    originMeters:{x:16,y:-8,z:-16},sourceDigest:"87654321",readSlot:()=>0},"fresh-east",5).checkpoint()).read():undefined;
  const source=root.read(),sources=east?[source,east]:[source],start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,_grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);
    const input=structuredClone(bundle,{transfer:transferListFor(bundle)});
    const output=request.jobKind===HVP_CHUNK_JOB?executeHvpChunkJob(request,input)
      :request.jobKind===HVP_EAST_CHUNK_COLLISION_JOB?executeHvpEastChunkCollisionJob(request,input)
      :(()=>{throw new Error("Unexpected Fresh fixture job kind");})();
    return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler(),controller=new AbortController();
  const worker=vi.fn();vi.stubGlobal("Worker",class {constructor(){worker();throw new Error("UNEXPECTED_WORKER");}});
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined;
  try{
    await compiler.prepare(()=>true,root);products=await compiler.initialChunks(source,east,32*1024*1024,"distinct-fresh-world");
    const tuple=bindHvpChunkPhysicsInput(root,products,sources);start.mockClear();
    await expect(createHvpFreshLabPhysicsClient(sources,{x:0,y:4,z:0},controller.signal,tuple)).rejects.toThrow(/Fresh LAB/);
    expect(start).not.toHaveBeenCalled();expect(worker).not.toHaveBeenCalled();
  }finally{controller.abort();if(products){discardHvpOwnedTerrainProducts(products);}await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();vi.unstubAllGlobals();}
},120_000);

it("rejects Fresh header accessors and additional Save fields without reading them",()=>{
  const header={version:"hvp-fresh-lab-source-v1",worldId:"fresh-world",sourceSessionId:"primary-source",epoch:1,revision:0,
    baseDigest:"12345678",sourceDigest:"87654321",sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originX:-16,originY:-8,originZ:-16,neighbor:false};
  expect(readHvpFreshLabSourceHeader(header).sourceSessionId).toBe("primary-source");
  expect(()=>readHvpFreshLabSourceHeader({...header,checkpoint:{}})).toThrow();
  const getter=vi.fn(()=>0),accessor={...header};Object.defineProperty(accessor,"revision",{enumerable:true,get:getter});
  expect(()=>readHvpFreshLabSourceHeader(accessor)).toThrow();expect(getter).not.toHaveBeenCalled();
  expect(()=>readHvpFreshLabSourceHeader({...header,epoch:-0})).toThrow();
});
