import {afterEach,beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpOwnedHashBodyCutSession,type HvpBodyPlanHost,type HvpBodyChildProjection} from "../../src/hestia-prototype/physics/bodyCutSession";
import {prepareHvpBodyCutOwnedHashSteps} from "../../src/hestia-prototype/physics/bodyCut";
import {buildHvpBodyMeshInput,executeHvpBodyMeshJob,decodeHvpBodyMeshOutput,
  HVP_BODY_MESH_JOB,HVP_BODY_MESH_ALGORITHM,HVP_BODY_MESH_MAX_OUTPUT} from "../../src/workers/hvpBodyMeshJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import type {WorkerJobRequest} from "../../src/workers/protocol";
import * as meshModule from "../../src/workers/hvpBodyMeshJob";
import {meshHvpOwnedBodyCellsSteps} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import * as ledgerModule from "../../src/voxel/structural/model";

vi.mock("../../src/hestia-prototype/physics/bodyCut",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
  return {...actual,prepareHvpBodyCutOwnedHashSteps:vi.fn(actual.prepareHvpBodyCutOwnedHashSteps)};
});
beforeAll(initializeHvpRapier);
afterEach(()=>vi.restoreAllMocks());
const host:HvpBodyPlanHost={yieldTask:()=>new Promise<void>(resolve=>setTimeout(resolve,0)),assertCurrent:()=>{}};

type OwnerSession=ReturnType<typeof createHvpOwnedHashBodyCutSession>;
// Existing five-cell/x2-hit real native fixture; no second plan or synthetic native proof.
const withOwner=async(run:(session:OwnerSession,id:string,projection:HvpBodyChildProjection,world:R.World)=>Promise<void>,edge=1,residentBytes?:number,
  beforeProjection?:(session:OwnerSession,id:string)=>Promise<void>)=>{
  vi.mocked(prepareHvpBodyCutOwnedHashSteps).mockClear();
  const world=new R.World({x:0,y:0,z:0});
  let session:ReturnType<typeof createHvpOwnedHashBodyCutSession>|undefined;
  try{
    const source=ingestHvpStructuralCells("mesh-owner-source",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
      [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
    const recipe=prepareHvpRigidBody(source),body=installHvpRigidBody(world,recipe);
    const target={ownerId:"mesh-owner-parent",body,recipe};
    session=createHvpOwnedHashBodyCutSession(world,new Map([[target.ownerId,target]]),new Map([[target.ownerId,body]]),"mesh-owner");
    const request={id:"mesh-owner-cut",ownerId:target.ownerId,sourceDigest:source.contentHash,edge,direction:{x:0,y:0,z:1}};
    session.begin(request,{x:.3125,y:.0625,z:-1},7);
    await beforeProjection?.(session,request.id);
    const projection=await session.prepareChildProjection(request.id,residentBytes===undefined?host:{...host,continuePlan:()=>true},residentBytes);
    expect(vi.mocked(prepareHvpBodyCutOwnedHashSteps)).toHaveBeenCalledTimes(1);
    await run(session,request.id,projection,world);
    expect(vi.mocked(prepareHvpBodyCutOwnedHashSteps)).toHaveBeenCalledTimes(1);
  }finally{try{if(session?.busy){session.rollback("mesh-owner-cut");}}finally{world.free();}}
};
const productsFor=async(projection:HvpBodyChildProjection)=>{
  const packed=buildHvpBodyMeshInput(projection);
  const request:WorkerJobRequest={jobId:workerJobId("mesh-owner-job"),jobKind:workerJobKind(HVP_BODY_MESH_JOB),targetKey:workerTargetKey(projection.ownerId),
    planningEpoch:planningEpoch(0),workerEpoch:workerEpoch(0),inputRevision:contentRevision(projection.revision),sourceInputDigest:packed.sourceInputDigest,
    algorithmVersion:algorithmVersion(HVP_BODY_MESH_ALGORITHM),priority:"Urgent",deadline:jobDeadline(1),
    estimatedInputBytes:packed.input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
  const output=await executeHvpBodyMeshJob(request,packed.input,host);
  return decodeHvpBodyMeshOutput(request,projection,output.bundle);
};

it("rejects projected owner-route Stage until the retained plan has admitted complete geometry",()=>withOwner(async(session,id,projection,world)=>{
  const colliders=world.colliders.len();
  expect(()=>session.stage(id,projection,8)).toThrow("Body mesh owner admission required");
  expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(colliders);expect(session.holdsWorld).toBe(false);
}));

it("admits mesh-only output against the single retained native plan before Stage, commit and finalize",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),colliders=world.colliders.len();
  await session.admitChildMesh(id,products,host);
  expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(colliders);expect(session.holdsWorld).toBe(false);
  session.stage(id,products,8);expect(session.holdsWorld).toBe(true);
  session.commit(id);session.finalize(id);
  expect(session.read().last?.status).toBe("Applied");expect(world.bodies.len()).toBe(2);expect(session.holdsWorld).toBe(false);
}));

it("rejects altered color geometry with stable first failure and no native Stage or retry revival",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),part=products.parts[0]!,colors=part.mesh.colors!.slice();
  colors[0]=colors[0]===0?1:0;
  const bad={...products,parts:[{...part,mesh:{...part.mesh,colors}},...products.parts.slice(1)]};
  let first:unknown;try{await session.admitChildMesh(id,bad,host);}catch(error){first=error;}
  expect(first).toBeInstanceOf(Error);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  let staged:unknown;try{session.stage(id,products,8);}catch(error){staged=error;}
  expect(staged).toBe(first);expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("keeps a thrown real admission yield terminal without mutating the native World",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),sentinel=new Error("admission yield failure");let yielded=0;
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{yielded+=1;throw sentinel;}})).rejects.toBe(sentinel);
  expect(yielded).toBe(1);await expect(session.admitChildMesh(id,products,host)).rejects.toBe(sentinel);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("keeps a packet decoder failure terminal before geometry work and rejects a later good packet",()=>withOwner(async(session,id,projection,world)=>{
  const first=new Error("first packet decoding failure"),decode=vi.fn(()=>{throw first;});
  await expect(session.admitChildMesh(id,decode,host)).rejects.toBe(first);
  const products=await productsFor(projection);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  expect(decode).toHaveBeenCalledTimes(1);expect(()=>session.stage(id,products,8)).toThrow(first);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("cannot revive an admission after Rollback at a real verifier yield",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection);let yielded=0;
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{yielded+=1;session.rollback(id);await host.yieldTask();}})).rejects.toThrow("Stale body preparation");
  expect(yielded).toBe(1);expect(session.read().state).toBe("Idle");
  expect(()=>session.stage(id,products,8)).toThrow("Stale body preparation");
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("preserves the first yielded failure when verifier cleanup also throws",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection),first=new Error("first admission failure"),cleanup=new Error("later verifier cleanup failure");
  const original=meshModule.verifyHvpBodyMeshPartsSteps;
  vi.spyOn(meshModule,"verifyHvpBodyMeshPartsSteps").mockImplementation(function*(plan,value){
    try{return yield* original(plan,value);}finally{throw cleanup;}
  });
  await expect(session.admitChildMesh(id,products,{...host,yieldTask:async()=>{throw first;}})).rejects.toBe(first);
  await expect(session.admitChildMesh(id,products,host)).rejects.toBe(first);
  expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
}));

it("admits an empty child set after complete legal removal without a first-part assumption",()=>withOwner(async(session,id,projection,world)=>{
  expect(projection.parts).toHaveLength(0);const products=await productsFor(projection);
  await session.admitChildMesh(id,products,host);expect(world.bodies.len()).toBe(1);expect(session.holdsWorld).toBe(false);
  session.stage(id,products,8);session.commit(id);session.finalize(id);
  expect(world.bodies.len()).toBe(0);expect(session.read().last).toMatchObject({status:"Applied",children:[],removedCells:5});
},8));

it("retains one borrowed owner ledger through mesh admission and transfers results only at Finalize",()=>withOwner(async(session,id,projection)=>{
  const prepared=session.resources();expect(prepared?.residentBytes).toBe(32*1024*1024);
  expect(prepared?.reservedBytes).toBeGreaterThan(0);expect(prepared?.hashReservations).toBeGreaterThan(3);
  const products=await productsFor(projection);await session.admitChildMesh(id,products,host);
  expect(session.resources()?.reservedBytes).toBeGreaterThanOrEqual(prepared!.reservedBytes);
  session.stage(id,products,8);session.commit(id);expect(session.resources()?.reservedBytes).toBeGreaterThan(0);
  session.finalize(id);expect(session.resources()?.reservedBytes).toBe(0);
  expect(session.resources()?.transferredResultEstimateBytes).toBeGreaterThan(0);
},1,32*1024*1024));

it("rejects Dispose after native Stage until rollback or actual World release",()=>withOwner(async(session,id,projection,world)=>{
  const products=await productsFor(projection);await session.admitChildMesh(id,products,host);session.stage(id,products,8);
  const reserved=session.resources()!.reservedBytes,bodyCount=world.bodies.len();
  expect(()=>session.dispose()).toThrow("native World release");expect(session.resources()?.reservedBytes).toBe(reserved);
  expect(session.holdsWorld).toBe(true);expect(session.busy).toBe(true);expect(world.bodies.len()).toBe(bodyCount);
  expect(()=>session.checkpoint()).toThrow("confirmed ownership");session.rollback(id);expect(session.resources()?.reservedBytes).toBe(0);
},1,32*1024*1024));

it("keeps ledger-construction failure identical on retry before any plan issuance",async()=>{
  let first:unknown,outcome:unknown;
  try{await withOwner(async()=>{},1,NaN,async(session,id)=>{
    try{await session.prepareChildProjection(id,host,NaN);}catch(error){first=error;}
    expect(first).toBeInstanceOf(Error);await expect(session.prepareChildProjection(id,host,NaN)).rejects.toBe(first);
  });}catch(error){outcome=error;}
  expect(outcome).toBe(first);expect(vi.mocked(prepareHvpBodyCutOwnedHashSteps)).not.toHaveBeenCalled();
});

it("keeps a failed projection reserve terminal for projection, mesh and native Stage",async()=>{
  const original=vi.mocked(prepareHvpBodyCutOwnedHashSteps).getMockImplementation()!,create=ledgerModule.createStructuralOwnerLedger;
  const first=new Error("projection reserve failed");let planned=false,failedCalls=0,outcome:unknown;
  vi.mocked(prepareHvpBodyCutOwnedHashSteps).mockImplementation(function*(...args){const plan=yield* original(...args);planned=true;return plan;});
  vi.spyOn(ledgerModule,"createStructuralOwnerLedger").mockImplementation((...args)=>{
    const ledger=create(...args);return {...ledger,reserve:(...values)=>{if(planned){failedCalls+=1;throw first;}ledger.reserve(...values);},get resources(){return ledger.resources;}};
  });
  try{await withOwner(async()=>{},1,32*1024*1024,async(session,id)=>{
    await expect(session.prepareChildProjection(id,{...host,continuePlan:()=>true},32*1024*1024)).rejects.toBe(first);
    await expect(session.prepareChildProjection(id,host,32*1024*1024)).rejects.toBe(first);
    await expect(session.admitChildMesh(id,()=>{throw new Error("decoder must not run");},host)).rejects.toBe(first);
    expect(()=>session.stage(id,{parts:[],removedCells:1,removedMassKg:1},8)).toThrow(first);
    expect(session.holdsWorld).toBe(false);expect(failedCalls).toBe(1);
  });}catch(error){outcome=error;}finally{vi.mocked(prepareHvpBodyCutOwnedHashSteps).mockImplementation(original);}
  expect(outcome).toBe(first);
});

it("returns a latched post-projection owner failure before the missing-mesh guard",()=>withOwner(async(session,id,projection)=>{
  const first=new Error("post-projection owner failure");
  await expect(session.prepareChildProjection(id,{...host,assertCurrent:()=>{throw first;}})).rejects.toBe(first);
  expect(()=>session.stage(id,projection,8)).toThrow(first);expect(session.holdsWorld).toBe(false);
},1,32*1024*1024));

it.each([null,undefined])("preserves non-Error mesh failure identity at Stage (%s)",first=>withOwner(async(session,id,projection)=>{
  await expect(session.admitChildMesh(id,()=>{throw first;},host)).rejects.toBe(first);
  let caught=false,outcome:unknown;try{session.stage(id,projection,8);}catch(error){caught=true;outcome=error;}
  expect(caught).toBe(true);expect(outcome).toBe(first);expect(session.holdsWorld).toBe(false);
}));

it.each([new Error("first cross-seam mesh error"),null,undefined])("shares the first failure across later projection, decoder and Stage (%s)",first=>withOwner(async(session,id,projection)=>{
  await expect(session.admitChildMesh(id,()=>{throw first;},host)).rejects.toBe(first);
  const later=vi.fn(()=>{throw new Error("later projection error");});
  await expect(session.prepareChildProjection(id,{...host,assertCurrent:later})).rejects.toBe(first);
  expect(later).not.toHaveBeenCalled();const decode=vi.fn(()=>{throw new Error("later decoder error");});
  await expect(session.admitChildMesh(id,decode,host)).rejects.toBe(first);expect(decode).not.toHaveBeenCalled();
  let caught=false,outcome:unknown;try{session.stage(id,projection,8);}catch(error){caught=true;outcome=error;}
  expect(caught).toBe(true);expect(outcome).toBe(first);expect(session.holdsWorld).toBe(false);
}));

it("keeps a retired ledger until the suspended verifier actually closes",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const admission=session.admitChildMesh(id,products,{...host,yieldTask:()=>{entered();return new Promise<void>(resolve=>{resume=resolve;});}});
  const rejected=expect(admission).rejects.toThrow("Stale body preparation");await waiting;
  session.rollback(id);expect(session.read().state).toBe("Idle");expect(session.resources()?.reservedBytes).toBeGreaterThan(0);
  expect(session.busy).toBe(true);expect(()=>session.checkpoint()).toThrow("confirmed ownership");
  resume();await rejected;expect(session.resources()?.reservedBytes).toBe(0);
  expect(session.resources()?.transferredResultEstimateBytes).toBe(0);
},1,32*1024*1024));

it.each([undefined,32*1024*1024])("cannot switch the budget of an already derived plan (%s)",residentBytes=>withOwner(async(session,id)=>{
  const budget=residentBytes===undefined?32*1024*1024:64*1024*1024;
  await expect(session.prepareChildProjection(id,host,budget)).rejects.toThrow("Cannot change the started body owner budget");
},1,residentBytes));

it("closes owner scratch on Dispose and retains credits until its suspended admission returns",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const admission=session.admitChildMesh(id,products,{...host,yieldTask:()=>{entered();return new Promise<void>(resolve=>{resume=resolve;});}});
  const rejected=expect(admission).rejects.toThrow("Stale body preparation");await waiting;session.dispose();
  expect(session.resources()?.reservedBytes).toBeGreaterThan(0);resume();await rejected;
  expect(session.busy).toBe(false);expect(session.resources()?.reservedBytes).toBe(0);
},1,32*1024*1024));

it("awaits packet decoding under the same parent credit before starting geometry admission",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;});let received:unknown,settled=false;
  const decode=(reserve:unknown)=>{received=reserve;entered();return new Promise<typeof products>(resolve=>{resume=()=>resolve(products);});};
  const verify=vi.spyOn(meshModule,"verifyHvpBodyMeshPartsSteps");
  const admission=session.admitChildMesh(id,decode,host);
  const result=admission.then(()=>{settled=true;},error=>{settled=true;throw error;});void result.catch(()=>{});
  try{await waiting;await Promise.resolve();expect(settled).toBe(false);expect(typeof received).toBe("function");
    expect(verify).not.toHaveBeenCalled();expect(session.holdsWorld).toBe(false);resume();await result;
    expect(verify).toHaveBeenCalledTimes(1);session.stage(id,products,8);session.commit(id);session.finalize(id);
  }finally{resume();await result.catch(()=>{});}
},1,32*1024*1024));

it("keeps decoding credit through Rollback and refuses the late decoded packet",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{entered=resolve;}),verify=vi.spyOn(meshModule,"verifyHvpBodyMeshPartsSteps");
  const decode=()=>{entered();return new Promise<typeof products>(resolve=>{resume=()=>resolve(products);});};
  const admission=session.admitChildMesh(id,decode,host);void admission.catch(()=>{});
  try{await waiting;session.rollback(id);expect(session.resources()?.reservedBytes).toBeGreaterThan(0);
    expect(session.busy).toBe(true);resume();await expect(admission).rejects.toThrow("Stale body preparation");
    expect(verify).not.toHaveBeenCalled();expect(session.resources()?.reservedBytes).toBe(0);
    expect(session.resources()?.transferredResultEstimateBytes).toBe(0);
  }finally{resume();await admission.catch(()=>{});}
},1,32*1024*1024));

it("preserves an asynchronous decoder rejection as the first cross-seam failure",()=>withOwner(async(session,id,projection)=>{
  const first=new Error("asynchronous packet rejection"),rejected=Promise.reject(first);void rejected.catch(()=>{});
  await expect(session.admitChildMesh(id,()=>rejected,host)).rejects.toBe(first);
  await expect(session.prepareChildProjection(id,host)).rejects.toBe(first);expect(()=>session.stage(id,projection,8)).toThrow(first);
  expect(session.holdsWorld).toBe(false);
},1,32*1024*1024));

it("reuses one expected-mesh workspace across multiple native children without releasing parent credit",()=>withOwner(async(session,id,projection)=>{
  expect(projection.parts.length).toBeGreaterThan(1);const products=await productsFor(projection);
  const demands=projection.parts.map(part=>{
    let bytes=0;const steps=meshHvpOwnedBodyCellsSteps(part.cells,part.center,part.sourceDigest,value=>{bytes+=value;});
    try{while(!steps.next().done){/* Charge the complete independent child workspace. */}}finally{steps.return(undefined as never);}
    return bytes;
  });
  const before=session.resources()!.reservedBytes;await session.admitChildMesh(id,products,host);
  expect(session.resources()!.reservedBytes-before).toBe(Math.max(...demands));
  expect(Math.max(...demands)).toBeLessThan(demands.reduce((sum,value)=>sum+value,0));
  expect(session.resources()?.transferredResultEstimateBytes).toBe(0);expect(session.holdsWorld).toBe(false);
},1,32*1024*1024));

it("keeps the single parent credit after Finalize until the external mesh operation really closes",()=>withOwner(async(session,id,projection)=>{
  const before=session.resources()!.reservedBytes,release=session.reserveExternalMeshWork(id,65536);
  try{expect(session.resources()!.reservedBytes).toBe(before+65536);const products=await productsFor(projection);
    await session.admitChildMesh(id,products,host);session.stage(id,products,8);session.commit(id);session.finalize(id);
    expect(session.read().last?.status).toBe("Applied");expect(session.resources()?.reservedBytes).toBeGreaterThan(0);expect(session.busy).toBe(true);
    release();expect(session.resources()?.reservedBytes).toBe(0);expect(session.busy).toBe(false);
    release();expect(session.resources()?.reservedBytes).toBe(0);
  }finally{release();}
},1,32*1024*1024));
it.each(["Rollback","Dispose"] as const)("keeps external producer credit through %s until its explicit terminal closure",action=>withOwner(async(session,id)=>{
  const release=session.reserveExternalMeshWork(id,65536);
  try{if(action==="Rollback"){session.rollback(id);}else{session.dispose();}
    expect(session.resources()?.reservedBytes).toBeGreaterThan(0);expect(session.busy).toBe(true);
    expect(()=>session.checkpoint()).toThrow("confirmed ownership");release();expect(session.resources()?.reservedBytes).toBe(0);
    expect(session.resources()?.transferredResultEstimateBytes).toBe(0);expect(session.busy).toBe(false);
  }finally{release();}
},1,32*1024*1024));

it("reserves external mesh work once and does not release its live parent early",()=>withOwner(async(session,id)=>{
  const release=session.reserveExternalMeshWork(id,65536),before=session.resources()!.reservedBytes;
  try{expect(()=>session.reserveExternalMeshWork(id,65536)).toThrow("once-only");
    expect(session.resources()!.reservedBytes).toBe(before);release();release();
    expect(session.resources()!.reservedBytes).toBe(before);expect(session.busy).toBe(true);
    session.rollback(id);expect(session.resources()!.reservedBytes).toBe(0);
  }finally{release();}
},1,32*1024*1024));

it("refuses external ownership without the original borrowed ledger",()=>withOwner(async(session,id)=>{
  expect(()=>session.reserveExternalMeshWork(id,65536)).toThrow("retained borrowed owner plan");
  expect(session.resources()).toBeNull();
}));
it("refuses early external ownership without poisoning later borrowed preparation",()=>withOwner(async(session)=>{
  expect(session.resources()?.residentBytes).toBe(32*1024*1024);
},1,32*1024*1024,async(session,id)=>{
  expect(()=>session.reserveExternalMeshWork(id,65536)).toThrow("retained borrowed owner plan");
}));

it("keeps an exhausted external quote as the first owner failure without partial credit",()=>withOwner(async(session,id,projection)=>{
  const before=session.resources()!.reservedBytes;let first:unknown;
  try{session.reserveExternalMeshWork(id,96*1024*1024);}catch(error){first=error;}
  expect(first).toBeInstanceOf(Error);expect(session.resources()!.reservedBytes).toBe(before);
  expect(()=>session.reserveExternalMeshWork(id,65536)).toThrow(first as Error);
  await expect(session.prepareChildProjection(id,host)).rejects.toBe(first);
  expect(()=>session.stage(id,projection,8)).toThrow(first as Error);expect(session.holdsWorld).toBe(false);
},1,32*1024*1024));

it("prepares and reserves one source-derived external quote before exporting mesh work",()=>withOwner(async(session,id,projection)=>{
  const before=session.resources()!.reservedBytes;
  const work=await session.prepareExternalMeshWork(id,{...host,continuePlan:()=>true},32768);
  try{expect(work.budget.faceLimits).toEqual([10,10]);expect(work.budget.bytes).toBeGreaterThan(0);
    expect(session.resources()!.reservedBytes-before).toBeGreaterThanOrEqual(work.budget.bytes);
    const reserved=session.resources()!.reservedBytes,products=await productsFor(projection);
    await session.admitChildMesh(id,products,host);expect(session.resources()!.reservedBytes).toBe(reserved);
    session.stage(id,products,8);session.commit(id);session.finalize(id);
    expect(session.resources()!.reservedBytes).toBe(reserved);work.release();expect(session.resources()!.reservedBytes).toBe(0);
  }finally{work.release();}
},1,32*1024*1024));
it("keeps a quote-preflight cancellation terminal without acquiring external work",()=>withOwner(async(session,id,projection)=>{
  const first=new Error("quote task cancelled");
  await expect(session.prepareExternalMeshWork(id,{...host,yieldTask:async()=>{throw first;}},32768)).rejects.toBe(first);
  await expect(session.prepareChildProjection(id,host)).rejects.toBe(first);expect(()=>session.stage(id,projection,8)).toThrow(first);
  session.rollback(id);expect(session.resources()!.reservedBytes).toBe(0);expect(session.busy).toBe(false);
},1,32*1024*1024));

it("excludes mesh admission while its prepaid quote is suspended and admits after closure",()=>withOwner(async(session,id,projection)=>{
  const products=await productsFor(projection);let resume:()=>void=()=>{},entered:()=>void=()=>{},paused=false;
  const waiting=new Promise<void>(resolve=>{entered=resolve;});
  const quoting=session.prepareExternalMeshWork(id,{...host,continuePlan:()=>paused,yieldTask:()=>{
    entered();return new Promise<void>(resolve=>{resume=()=>{paused=true;resolve();};});
  }},32768);void quoting.catch(()=>{});
  let release:()=>void=()=>{};
  try{await waiting;const before=session.resources()!.reservedBytes;
    await expect(session.admitChildMesh(id,products,host)).rejects.toThrow("Body mesh quote pending");
    expect(session.resources()!.reservedBytes).toBe(before);resume();const work=await quoting;release=work.release;
    const quoted=session.resources()!.reservedBytes;await session.admitChildMesh(id,products,host);
    expect(session.resources()!.reservedBytes).toBe(quoted);
    await expect(session.prepareExternalMeshWork(id,host,32768)).rejects.toThrow("once-only");
  }finally{resume();const work=await quoting.catch(()=>undefined);work?.release();release();}
},1,32*1024*1024));
