import {beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";
import {decodeHvpGame,decodeHvpLabGame,encodeHvpLabGame,type HvpDecodedGame,type HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {hvpCollisionDigest,type HvpLabWorldCheckpoint,type HvpWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {HvpLabWorldReplacementPreparationError,prepareHvpLabWorldLayoutReplacement,prepareHvpLabWorldReplacement,prepareHvpWorldReplacement,
  type HvpLabCompleteStaticCollision}
  from "../../src/hestia-prototype/physics/worldReplacement";
import {collisionSectors,type HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import type {HvpChunkStaticLayout} from "../../src/hestia-prototype/physics/staticTerrainLayout";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {ownHvpLabCompleteCollisionSectors,ownHvpLabReplacementMeshes,
  type HvpLabPhysicsSession,type HvpLabWorldReplacementCapture,type HvpLabWorldReplacementCaptureWitness,type HvpPhysicsSession,
  type createHvpLabPhysicsSession,type createHvpPhysicsSession}
  from "../../src/hestia-prototype/physics/session";

const sessionFactories=vi.hoisted(()=>({
  public:vi.fn(),worker:vi.fn(),chunkWorker:vi.fn(),lab:vi.fn(),issue:vi.fn(),bind:vi.fn(),release:vi.fn(),candidate:vi.fn()
}));
vi.mock("../../src/hestia-prototype/physics/rapierPort",()=>({
  R:{World:class {constructor(){throw new Error("UNEXPECTED_NATIVE_WORLD");}}},
  initializeHvpRapier:()=>{throw new Error("UNEXPECTED_NATIVE_INIT");},isHvpSolidCollider:()=>true
}));
vi.mock("../../src/hestia-prototype/physics/session",async(importOriginal)=>({
  ...await importOriginal<typeof import("../../src/hestia-prototype/physics/session")>(),
  createHvpPhysicsSession:sessionFactories.public,
  createHvpWorkerPhysicsSession:sessionFactories.worker,
  createHvpChunkWorkerPhysicsSession:sessionFactories.chunkWorker,
  createHvpLabPhysicsSession:sessionFactories.lab,
  issueHvpLabWorldReplacementCapture:sessionFactories.issue,
  bindHvpLabWorldReplacementCaptureSectors:sessionFactories.bind,
  releaseHvpLabWorldReplacementCapture:sessionFactories.release,
  createHvpLabReplacementCandidate:sessionFactories.candidate
}));
// Keep the replacement import graph away from chunk worker modules in this unit test.
vi.mock("../../src/workers/hvpChunkJob",()=>({validateHvpChunkBuffers:vi.fn()}));

type WorldCheckpoint=HvpLabWorldCheckpoint|HvpWorldCheckpoint;
type DisposeBehavior="free"|"throw"|"leak";
type AssertFalse<T extends false>=T;
export type LabCompleteLayoutIsRequired=AssertFalse<null extends HvpLabCompleteStaticCollision["layout"]?true:false>;
const labLayout:HvpChunkStaticLayout=Object.freeze({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
const emptySector=():HvpCollisionSector=>({vertices:new Float32Array(0),indices:new Uint32Array(0)});
const floor={sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},
  readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const baseCatalogue=():HvpCollisionSector[]=>[
  ...Array.from({length:256},emptySector),...collisionSectors(floor)
];
const fullCatalogue=(resident:boolean):HvpCollisionSector[]=>[
  ...baseCatalogue(),...(resident?Array.from({length:256},emptySector):[])
];
type FakeOwner={
  readonly session:HvpLabPhysicsSession;
  readonly read:ReturnType<typeof vi.fn<()=>Record<string,unknown>>>;
  readonly pause:ReturnType<typeof vi.fn>;
  readonly dispose:ReturnType<typeof vi.fn>;
  readonly checkpoint:ReturnType<typeof vi.fn>;
  readonly copyCollision:ReturnType<typeof vi.fn>;
  readonly staticTerrainLayout:ReturnType<typeof vi.fn>;
  setCheckpoint(value:WorldCheckpoint):void;
  setFacts(value:Record<string,unknown>):void;
  setStaticLayout(value:unknown):void;
  setDisposeBehavior(value:DisposeBehavior):void;
};

const makeOwner=(initialCheckpoint:WorldCheckpoint):FakeOwner=>{
  let saved=initialCheckpoint;
  let facts:Record<string,unknown>={status:"Paused",ticks:0,sessionId:saved.sessionId,gravity:saved.gravity,
    solver:saved.solver,bodyCount:1,stepCpuMs:0};
  let bodyCount=1,disposed=false,staticLayout:unknown=null,disposeBehavior:DisposeBehavior="free";
  const collision:HvpCollisionSector[]=[];
  const owner={
    read:vi.fn(()=>({...facts,status:disposed?"Disposed":"Paused",bodyCount})),
    pause:vi.fn(()=>{facts={...facts,status:"Paused"};}),
    dispose:vi.fn(()=>{
      if(disposeBehavior==="throw"){throw new Error("injected owner dispose failure");}
      if(disposeBehavior==="leak"){return;}
      disposed=true;bodyCount=0;
    }),
    checkpoint:vi.fn(()=>saved),
    copyCollision:vi.fn(()=>collision),
    staticTerrainLayout:vi.fn(()=>staticLayout)
  };
  return {
    ...owner,
    session:owner as unknown as HvpLabPhysicsSession,
    setCheckpoint(value){saved=value;},
    setFacts(value){facts={...facts,...value};},
    setStaticLayout(value){staticLayout=value;},
    setDisposeBehavior(value){disposeBehavior=value;}
  };
};

type LabFactoryArguments=Parameters<typeof createHvpLabPhysicsSession>;
type PublicFactoryArguments=Parameters<typeof createHvpPhysicsSession>;
let labFixture:ReturnType<typeof createSyntheticAuthoredCodecFixtures>["lab"];
let issuedLab:HvpDecodedLabGame;
let issuedPublic:HvpDecodedGame;
let labCandidates:FakeOwner[]=[];
let publicCandidates:FakeOwner[]=[];
let labFactoryArguments:LabFactoryArguments[]=[];
let publicFactoryArguments:PublicFactoryArguments[]=[];
let candidateLayouts:(HvpChunkStaticLayout|null)[]=[];
let labFactoryFailure:unknown;
let duringLabFactory:((args:LabFactoryArguments)=>void|Promise<void>)|undefined;
const issuedMockCaptures=new Map<HvpLabWorldReplacementCaptureWitness,{game:HvpDecodedLabGame;sectors?:readonly HvpCollisionSector[];
  completeSectors?:readonly HvpCollisionSector[];layout?:HvpChunkStaticLayout}>();

const encodeCompleteGame=(sectors:readonly HvpCollisionSector[],neighborRoot?:ReturnType<typeof createHvpTerrainRoot>):HvpDecodedLabGame=>{
  const {version:_version,profiles:_profiles,signature:_signature,...data}=labFixture;
  const world={...labFixture.world,collisionDigest:hvpCollisionDigest(sectors),
    coverage:neighborRoot?[...labFixture.world.coverage,{minX:16,maxX:48,minZ:-16,maxZ:16}]:labFixture.world.coverage,
    neighbor:neighborRoot?{
    version:"hvp-neighbor-world-v1" as const,epoch:1,resident:true,sourceDigest:neighborRoot.read().sourceDigest,baseSectorCount:257
  }:null};
  const checkpoint=encodeHvpLabGame({...data,world,...(neighborRoot?{neighbor:{version:"hvp-neighbor-scene-v1" as const,
    terrain:neighborRoot.checkpoint(),lod:.125 as const}}:{})});
  return decodeHvpLabGame(checkpoint);
};

beforeAll(()=>{
  const fixtures=createSyntheticAuthoredCodecFixtures();
  labFixture=fixtures.lab;
  issuedLab=decodeHvpLabGame(fixtures.lab);
  issuedPublic=decodeHvpGame(fixtures.legacy);
});

beforeEach(()=>{
  sessionFactories.public.mockReset();sessionFactories.worker.mockReset();sessionFactories.chunkWorker.mockReset();sessionFactories.lab.mockReset();
  sessionFactories.issue.mockReset();sessionFactories.bind.mockReset();sessionFactories.release.mockReset();sessionFactories.candidate.mockReset();
  issuedMockCaptures.clear();
  labCandidates=[];publicCandidates=[];labFactoryArguments=[];publicFactoryArguments=[];candidateLayouts=[];
  labFactoryFailure=undefined;duringLabFactory=undefined;
  // Only this transaction control plane is mocked. Pure buffer intake uses the actual Source helper.
  sessionFactories.issue.mockImplementation((before:HvpLabPhysicsSession,game:HvpDecodedLabGame,input:unknown,current:()=>boolean,
    complete?:Readonly<{sectors:readonly HvpCollisionSector[];layout:HvpChunkStaticLayout|null}>):HvpLabWorldReplacementCapture=>{
    if(!current()){throw new Error("Stale World replacement");}
    const checkpoint=before.checkpoint();
    if(complete){
      const ownerLayout=before.staticTerrainLayout();
      if(!ownerLayout||complete.layout===null||ownerLayout.primaryTerrainCount!==complete.layout.primaryTerrainCount
        ||ownerLayout.neighborTerrainCount!==complete.layout.neighborTerrainCount||checkpoint.solver!==game.checkpoint.world.solver
        ||checkpoint.sessionId!==game.checkpoint.world.sessionId||checkpoint.gravity!==game.checkpoint.world.gravity){
        throw new Error("LAB World replacement solver/session/gravity mismatch");
      }
    }
    const replacements=ownHvpLabReplacementMeshes(input,()=>{});
    const completeSectors=complete?ownHvpLabCompleteCollisionSectors(complete.sectors,()=>{}):undefined;
    const baseCollision=before.copyCollision().map(mesh=>({
      vertices:new Float32Array(mesh.vertices),indices:new Uint32Array(mesh.indices)}));
    const witness=Object.freeze({}) as HvpLabWorldReplacementCaptureWitness;
    const entry={game,...(completeSectors?{completeSectors,layout:complete!.layout??undefined}:{})};
    issuedMockCaptures.set(witness,entry);
    return {witness,checkpoint,baseCollision,replacements,...(completeSectors?{complete:{sectors:completeSectors,layout:complete!.layout!}}:{})};
  });
  sessionFactories.bind.mockImplementation((witness:HvpLabWorldReplacementCaptureWitness,sectors:readonly HvpCollisionSector[],layout?:HvpChunkStaticLayout|null)=>{
    const entry=issuedMockCaptures.get(witness);if(!entry){throw new Error("Missing fake capture");}
    if(entry.completeSectors&&(sectors!==entry.completeSectors||layout===null||layout===undefined
      ||layout.primaryTerrainCount!==entry.layout?.primaryTerrainCount||layout.neighborTerrainCount!==entry.layout?.neighborTerrainCount)){
      throw new Error("Unbound fake complete capture");
    }
    if(!entry.completeSectors&&layout!==undefined){throw new Error("Unexpected fake static layout");}
    entry.sectors=sectors;entry.layout=layout??undefined;
  });
  sessionFactories.release.mockImplementation((witness:HvpLabWorldReplacementCaptureWitness)=>{issuedMockCaptures.delete(witness);});
  sessionFactories.candidate.mockImplementation(async(witness:HvpLabWorldReplacementCaptureWitness,game:HvpDecodedLabGame,
    sectors:readonly HvpCollisionSector[],measure:boolean)=>{
    const entry=issuedMockCaptures.get(witness);if(entry?.game!==game||entry.sectors!==sectors){throw new Error("Unbound fake capture");}
    if(entry.completeSectors&&(sectors!==entry.completeSectors||entry.layout===undefined
      ||hvpCollisionDigest(sectors)!==game.checkpoint.world.collisionDigest)){
      throw new Error("Saved collision does not match candidate sources");
    }
    candidateLayouts.push(entry.layout??null);
    issuedMockCaptures.delete(witness);
    const c=game.checkpoint.world;
    return sessionFactories.lab(sectors,c.dropSpawn,c.gravity,undefined,undefined,undefined,c.sessionId,game,c.branch?.kind??"branch",measure);
  });
  sessionFactories.lab.mockImplementation(async(...args:LabFactoryArguments)=>{
    labFactoryArguments.push(args);await duringLabFactory?.(args);
    if(labFactoryFailure!==undefined){throw labFactoryFailure;}
    const candidate=labCandidates.shift();if(!candidate){throw new Error("No mocked LAB candidate queued");}
    return candidate.session;
  });
  sessionFactories.public.mockImplementation(async(...args:PublicFactoryArguments)=>{
    publicFactoryArguments.push(args);
    const candidate=publicCandidates.shift();if(!candidate){throw new Error("No mocked public candidate queued");}
    return candidate.session as unknown as HvpPhysicsSession;
  });
});

describe("PHY-01 LAB World replacement with mocked session factories",()=>{
  it("keeps A through rollback, retires A only at Finalize, and sends the fixed LAB context to B",async()=>{
    const saved=issuedLab.checkpoint.world,a=makeOwner(saved),first=makeOwner(saved),second=makeOwner(saved),third=makeOwner(saved);
    labCandidates=[first,second,third];

    const prepared=await prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true);
    expect(prepared.state).toBe("Prepared");expect(a.dispose).not.toHaveBeenCalled();
    expect(labFactoryArguments[0]).toEqual([[],saved.dropSpawn,saved.gravity,undefined,undefined,undefined,saved.sessionId,
      issuedLab,saved.branch?.kind??"branch",false]);
    expect(prepared.rollback()).toBe(a.session);expect(prepared.state).toBe("RolledBack");
    expect(first.dispose).toHaveBeenCalledTimes(1);expect(a.dispose).not.toHaveBeenCalled();

    const committed=await prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true);
    expect(committed.commit()).toBe(second.session);expect(committed.state).toBe("Committed");
    expect(committed.rollback()).toBe(a.session);expect(second.dispose).toHaveBeenCalledTimes(1);

    const finalized=await prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true);
    finalized.commit();finalized.finalize();
    expect(finalized.state).toBe("Finalized");expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(third.dispose).not.toHaveBeenCalled();
  });

  it("preserves the public factory route and its ten-argument session call without constructing Native sessions",async()=>{
    const saved=issuedPublic.checkpoint.world,a=makeOwner(saved),candidate=makeOwner(saved);
    publicCandidates=[candidate];
    const transaction=await prepareHvpWorldReplacement(a.session as unknown as HvpPhysicsSession,saved,[]);
    expect(publicFactoryArguments).toHaveLength(1);
    expect(publicFactoryArguments[0]).toEqual([[],saved.dropSpawn,saved.gravity,undefined,undefined,undefined,saved.sessionId,
      saved,"branch",false]);
    expect(sessionFactories.lab).not.toHaveBeenCalled();
    expect(transaction.rollback()).toBe(a.session as unknown as HvpPhysicsSession);
  });

  it.each([false,true])("captures a complete dense 256/256 catalogue with resident neighbor %s",async resident=>{
    const sectors=fullCatalogue(resident),east=resident?createHvpTerrainRoot(await createHvpEastRegion(),"synthetic-codec-east",0):undefined;
    const game=encodeCompleteGame(sectors,east),a=makeOwner(game.checkpoint.world),candidate=makeOwner(game.checkpoint.world);
    a.setStaticLayout(labLayout);labCandidates=[candidate];
    const complete:HvpLabCompleteStaticCollision={sectors,layout:labLayout};
    const transaction=await prepareHvpLabWorldLayoutReplacement(a.session,game,complete,()=>true);
    const passed=labFactoryArguments[0]![0]!;
    expect(sectors).toHaveLength(resident?513:257);
    expect(passed).toHaveLength(sectors.length);expect(passed).not.toBe(sectors);
    expect(passed[256]!.vertices.buffer).not.toBe(sectors[256]!.vertices.buffer);
    expect(candidateLayouts[0]).toEqual(labLayout);
    expect(sessionFactories.candidate).toHaveBeenCalledTimes(1);expect(sessionFactories.release).toHaveBeenCalledTimes(1);
    expect(issuedMockCaptures.size).toBe(0);
    if(resident){expect(transaction.rollback()).toBe(a.session);expect(a.dispose).not.toHaveBeenCalled();}
    else{expect(transaction.commit()).toBe(candidate.session);expect(a.dispose).not.toHaveBeenCalled();transaction.finalize();expect(a.dispose).toHaveBeenCalledTimes(1);}
  });

  it("rejects incomplete, reordered and unissued complete catalogues before LAB session construction",async()=>{
    const sectors=fullCatalogue(false),game=encodeCompleteGame(sectors),a=makeOwner(game.checkpoint.world);
    a.setStaticLayout(labLayout);
    const sparse=[...sectors];delete sparse[17];
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors:sparse,layout:labLayout},()=>true)).rejects.toThrow();
    expect(sessionFactories.candidate).not.toHaveBeenCalled();expect(a.copyCollision).not.toHaveBeenCalled();

    const reordered=[...sectors];[reordered[0],reordered[256]]=[reordered[256]!,reordered[0]!];
    const candidate=makeOwner(game.checkpoint.world);labCandidates=[candidate];
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors:reordered,layout:labLayout},()=>true))
      .rejects.toThrow(/Saved collision does not match candidate sources/);
    expect(sessionFactories.lab).not.toHaveBeenCalled();expect(sessionFactories.release).toHaveBeenCalledTimes(1);
    expect(issuedMockCaptures.size).toBe(0);labCandidates=[];

    await expect(prepareHvpLabWorldLayoutReplacement(a.session,labFixture as unknown as HvpDecodedLabGame,
      {sectors,layout:labLayout},()=>true)).rejects.toThrow(/Unvalidated/);
    expect(sessionFactories.issue).toHaveBeenCalledTimes(2);expect(sessionFactories.candidate).toHaveBeenCalledTimes(1);
  });

  it("rejects A layout and owner-profile mismatches before complete input capture",async()=>{
    const sectors=fullCatalogue(false),game=encodeCompleteGame(sectors),a=makeOwner(game.checkpoint.world);
    const invalidLayout={...labLayout,primaryTerrainCount:128} as unknown as HvpChunkStaticLayout;
    a.setStaticLayout(labLayout);
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors,layout:invalidLayout},()=>true))
      .rejects.toThrow(/Invalid private static terrain layout/);
    expect(sessionFactories.issue).not.toHaveBeenCalled();

    a.setStaticLayout({version:"hvp-static-chunks-v1",primaryTerrainCount:128,neighborTerrainCount:256});
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors,layout:labLayout},()=>true))
      .rejects.toThrow(/Invalid private static terrain layout/);
    expect(sessionFactories.issue).not.toHaveBeenCalled();

    a.setStaticLayout(labLayout);a.setCheckpoint({...game.checkpoint.world,solver:"rapier-0.12.0"});
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors,layout:labLayout},()=>true))
      .rejects.toThrow(/solver\/session\/gravity mismatch/);
    expect(sessionFactories.issue).toHaveBeenCalledTimes(1);expect(a.copyCollision).not.toHaveBeenCalled();
    expect(sessionFactories.candidate).not.toHaveBeenCalled();
  });

  it("keeps complete target bytes stable when caller buffers change during B construction",async()=>{
    const sectors=fullCatalogue(false);
    sectors[0]={vertices:new Float32Array([-16,-8,-16,-15,-8,-16,-16,-7,-16]),indices:new Uint32Array([0,1,2])};
    const game=encodeCompleteGame(sectors),a=makeOwner(game.checkpoint.world),candidate=makeOwner(game.checkpoint.world);
    a.setStaticLayout(labLayout);labCandidates=[candidate];
    const input=sectors[0]!;
    duringLabFactory=args=>{
      input.vertices[0]=99;input.indices[0]=2;
      expect(args[0][0]!.vertices[0]).toBe(-16);expect(args[0][0]!.indices[0]).toBe(0);
      expect(args[0][0]!.vertices.buffer).not.toBe(input.vertices.buffer);
    };
    const transaction=await prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors,layout:labLayout},()=>true);
    expect(sessionFactories.release).toHaveBeenCalledTimes(1);expect(issuedMockCaptures.size).toBe(0);
    transaction.rollback();
  });

  it("releases a complete capture and disposes B when cancellation arrives during construction",async()=>{
    const sectors=fullCatalogue(false),game=encodeCompleteGame(sectors),a=makeOwner(game.checkpoint.world),candidate=makeOwner(game.checkpoint.world);
    a.setStaticLayout(labLayout);labCandidates=[candidate];let current=true;
    duringLabFactory=()=>{current=false;};
    await expect(prepareHvpLabWorldLayoutReplacement(a.session,game,{sectors,layout:labLayout},()=>current))
      .rejects.toThrow("Live World changed during restore preparation");
    expect(candidate.dispose).toHaveBeenCalledTimes(1);expect(candidate.read().bodyCount).toBe(0);
    expect(sessionFactories.release).toHaveBeenCalledTimes(1);expect(issuedMockCaptures.size).toBe(0);
    expect(a.dispose).not.toHaveBeenCalled();
  });

  it("retains A if candidate creation fails",async()=>{
    const a=makeOwner(issuedLab.checkpoint.world);
    labFactoryFailure=new Error("injected candidate creation failure");
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true)).rejects.toThrow(/candidate creation failure/);
    expect(a.dispose).not.toHaveBeenCalled();expect(a.read().bodyCount).toBe(1);
  });

  it.each(["solver","sessionId","gravity"] as const)("rejects an A %s mismatch before candidate creation",async(field)=>{
    const saved={...issuedLab.checkpoint.world};
    if(field==="solver"){Reflect.set(saved,"solver","rapier-0.12.0");}
    if(field==="sessionId"){Reflect.set(saved,"sessionId","different-session");}
    if(field==="gravity"){Reflect.set(saved,"gravity",0);}
    const a=makeOwner(saved);
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true)).rejects.toThrow(/solver\/session\/gravity mismatch/);
    expect(sessionFactories.lab).not.toHaveBeenCalled();
  });

  it("rejects raw and public decoded games before the LAB factory",async()=>{
    const a=makeOwner(issuedLab.checkpoint.world);
    await expect(prepareHvpLabWorldReplacement(a.session,labFixture as unknown as HvpDecodedLabGame,[],()=>true))
      .rejects.toThrow(/Unvalidated/);
    await expect(prepareHvpLabWorldReplacement(a.session,issuedPublic as unknown as HvpDecodedLabGame,[],()=>true))
      .rejects.toThrow(/Unvalidated/);
    expect(sessionFactories.lab).not.toHaveBeenCalled();
  });

  it.each([undefined,42])("rejects a missing or invalid required current callback before checkpoint work",async(value)=>{
    const a=makeOwner(issuedLab.checkpoint.world);
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],value as unknown as ()=>boolean))
      .rejects.toThrow(/requires a current callback/);
    expect(a.checkpoint).not.toHaveBeenCalled();expect(a.copyCollision).not.toHaveBeenCalled();
    expect(sessionFactories.lab).not.toHaveBeenCalled();
  });

  it("rejects unsupported chunks, duplicate or invalid indexes, and missing sectors before candidate creation",async()=>{
    const a=makeOwner(issuedLab.checkpoint.world),mesh={vertices:new Float32Array(9),indices:new Uint32Array([0,1,2])};
    a.setStaticLayout({unsupported:"chunk"});
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true)).rejects.toThrow(/Unsupported direct LAB chunk/);
    expect(sessionFactories.lab).not.toHaveBeenCalled();

    a.setStaticLayout(null);
    a.copyCollision.mockReturnValue([mesh]); // Index zero is valid, so the duplicate guard must reject it.
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[{index:0,mesh},{index:0,mesh}],()=>true))
      .rejects.toThrow(/Invalid LAB replacement index/);
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[{index:-1,mesh}],()=>true))
      .rejects.toThrow(/Invalid LAB replacement index/);

    const previous={...issuedLab.checkpoint.world,neighbor:{version:"hvp-neighbor-world-v1" as const,epoch:1,resident:false,
      sourceDigest:"1234abcd",baseSectorCount:64}};
    a.setCheckpoint(previous);
    a.copyCollision.mockReturnValue([]);
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>true)).rejects.toThrow(/Missing restored terrain sector/);
    expect(sessionFactories.lab).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "A changed"] as const)("cleans B and retains A when %s during asynchronous preparation",async(scenario)=>{
    const a=makeOwner(issuedLab.checkpoint.world),candidate=makeOwner(issuedLab.checkpoint.world);
    labCandidates=[candidate];let current=true;
    duringLabFactory=async()=>{
      if(scenario==="cancelled"){current=false;}else{a.setFacts({ticks:1});}
    };
    await expect(prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>current)).rejects.toThrow(/Stale World replacement|Live World changed/);
    expect(candidate.dispose).toHaveBeenCalledTimes(1);expect(candidate.read().bodyCount).toBe(0);
    expect(a.dispose).not.toHaveBeenCalled();
  });

  it("rejects a commit cancelled after preparation but still permits rollback",async()=>{
    const a=makeOwner(issuedLab.checkpoint.world),candidate=makeOwner(issuedLab.checkpoint.world);
    labCandidates=[candidate];let current=true;
    const transaction=await prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>current);
    current=false;
    expect(()=>transaction.commit()).toThrow(/Stale World replacement/);
    expect(transaction.state).toBe("Prepared");
    expect(transaction.rollback()).toBe(a.session);expect(candidate.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps actual owned replacement bytes stable when caller buffers change during asynchronous B creation",async()=>{
    const a=makeOwner(issuedLab.checkpoint.world),candidate=makeOwner(issuedLab.checkpoint.world);
    const mesh={vertices:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2])};
    a.copyCollision.mockReturnValue([mesh]);labCandidates=[candidate];
    duringLabFactory=args=>{
      mesh.vertices[0]=99;mesh.indices[0]=2;
      expect(args[0][0]!.vertices[0]).toBe(0);expect(args[0][0]!.indices[0]).toBe(0);
      expect(args[0][0]!.vertices.buffer).not.toBe(mesh.vertices.buffer);
    };
    const transaction=await prepareHvpLabWorldReplacement(a.session,issuedLab,[{index:0,mesh}],()=>true);
    expect(issuedMockCaptures.size).toBe(0);expect(sessionFactories.release).toHaveBeenCalledTimes(1);
    transaction.rollback();
  });

  it.each(["throw","leak"] as const)("retains both owner handles when preparation cleanup will %s",async(behavior)=>{
    const a=makeOwner(issuedLab.checkpoint.world),candidate=makeOwner(issuedLab.checkpoint.world);
    candidate.setDisposeBehavior(behavior);labCandidates=[candidate];let current=true;
    duringLabFactory=()=>{current=false;};
    const error=await prepareHvpLabWorldReplacement(a.session,issuedLab,[],()=>current).catch(value=>value);
    expect(error).toBeInstanceOf(HvpLabWorldReplacementPreparationError);
    if(!(error instanceof HvpLabWorldReplacementPreparationError)){throw new Error("Expected a reachable LAB RecoveryHold handle");}
    expect(error.transaction.state).toBe("RecoveryHold");expect(error.transaction.candidate).toBe(candidate.session);
    expect(candidate.pause).toHaveBeenCalledTimes(1);expect(a.pause).toHaveBeenCalledTimes(1);
    if(behavior==="throw"){expect(()=>error.transaction.dispose()).toThrow(/owner dispose failure/);}
    else{candidate.setDisposeBehavior("free");error.transaction.dispose();expect(candidate.read().bodyCount).toBe(0);}
    expect(candidate.dispose).toHaveBeenCalledTimes(2);expect(a.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps rollback and finalize uncertainty in RecoveryHold",async()=>{
    const rollbackA=makeOwner(issuedLab.checkpoint.world),rollbackB=makeOwner(issuedLab.checkpoint.world);
    rollbackB.setDisposeBehavior("leak");labCandidates=[rollbackB];
    const rollback=await prepareHvpLabWorldReplacement(rollbackA.session,issuedLab,[],()=>true);
    expect(()=>rollback.rollback()).toThrow(/RecoveryHold/);expect(rollback.state).toBe("RecoveryHold");
    expect(rollbackA.pause).toHaveBeenCalledTimes(1);expect(rollbackB.pause).toHaveBeenCalledTimes(1);
    expect(()=>rollback.rollback()).toThrow(/World replacement RecoveryHold/);
    rollbackB.setDisposeBehavior("free");rollback.dispose();

    const finalizeA=makeOwner(issuedLab.checkpoint.world),finalizeB=makeOwner(issuedLab.checkpoint.world);
    finalizeA.setDisposeBehavior("throw");labCandidates=[finalizeB];
    const finalize=await prepareHvpLabWorldReplacement(finalizeA.session,issuedLab,[],()=>true);
    finalize.commit();expect(()=>finalize.finalize()).toThrow(/RecoveryHold/);
    expect(finalize.state).toBe("RecoveryHold");expect(finalizeA.pause).toHaveBeenCalledTimes(1);
    expect(finalizeB.pause).toHaveBeenCalledTimes(1);expect(()=>finalize.rollback()).toThrow(/World replacement RecoveryHold/);
    finalizeA.setDisposeBehavior("free");finalize.dispose();
  });
});
