import {expect,it,vi} from "vitest";
import * as hashKernel from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps} from "../../src/hestia-prototype/terrain/structuralIngest";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import * as adaptive from "../../src/voxel/adaptive";
import * as materialization from "../../src/voxel/adaptive/materialization";
import {createOwnedAdaptiveChannelFactory,isValidatedFrozenDenseArray} from "../../src/voxel/adaptive/validation";

const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{try{for(;;){const step=steps.next();if(step.done){return step.value;}}}finally{steps.return(undefined as never);}};
const materials=[{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"stone",destructible:true,tags:null}];
it("D2 complete owned ingest validates each actual immutable brick once after materialization and preserves the full public Source",()=>{
  const cells=[{x:-1,y:0,z:0,materialId:1},{x:0,y:0,z:0,materialId:1}];
  const expected=ingestHvpStructuralCells("d2-brick-reuse",cells,materials);
  const cursor=vi.spyOn(hashKernel,"createOwnedCanonicalHashCursor"),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const source=drain(prepareHvpStructuralIngestOwnedSteps("d2-brick-reuse",cells,materials,[],ledger.reserve));
    expect(JSON.stringify(source)).toBe(JSON.stringify(expected));
    const content=cursor.mock.calls.map(([payload])=>payload as {schemaVersion?:string;authorityInputDigest?:string})
      .filter(p=>p.schemaVersion==="adaptive-microvoxel-content-hash-input-v1");
    expect(new Set(content.map(p=>p.authorityInputDigest)).size).toBe(2);
    // One construction hash and one complete proof-bound validation per brick.
    expect(content.length).toBe(4);
  }finally{cursor.mockRestore();ledger.release();}
});

const input=()=>({key:adaptive.createAdaptiveBrickKey({bodyId:"body.d2",surfaceFrameId:"frame.d2",regionId:"region.d2",
  generatorVersion:"d2-v1",level:4,originQuantum:{x:-16,y:0,z:0}}),
  baseField:adaptive.createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:adaptive.stableAuthorityId("base.d2"),
    version:adaptive.stableAuthorityId("d2-v1"),sourceRevision:adaptive.authorityRevision(1),sample:{density:-1,occupancy:1,materialId:adaptive.stableAuthorityId("material.d2")}}),
  editJournal:adaptive.createAdaptiveEditJournal([])});
it("D2 brick receipts require the original producer, fixed hash options, exact reserve and active scope after full validation",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),other=createStructuralOwnerLedger(32*1024*1024);
  const scope=materialization.createOwnedAdaptiveBrickScope(ledger.reserve),foreign=materialization.createOwnedAdaptiveBrickScope(ledger.reserve);
  try{
    const raw=drain(materialization.adaptiveMaterializeBrickSteps(input(),scope.options));
    const read=(value=raw,reserve=ledger.reserve)=>materialization.readOwnedValidatedAdaptiveBrick(value,reserve);
    expect(read()).toBeUndefined();
    expect(Object.isFrozen(scope.options)).toBe(true);
    // Even identical function/field values do not establish the private options identity.
    drain(materialization.adaptiveValidateMaterializedBrickSteps(raw,{...scope.options}));
    drain(materialization.adaptiveValidateMaterializedBrickSteps(raw,foreign.options));
    expect(read()).toBeUndefined();
    const validated=drain(materialization.adaptiveValidateMaterializedBrickSteps(raw,scope.options));
    expect(validated).not.toBe(raw);expect(read()).toBe(validated);
    expect(JSON.stringify(validated)).toBe(JSON.stringify(adaptive.validateMaterializedAdaptiveBrick(raw)));
    expect(read({...raw})).toBeUndefined();expect(read(new Proxy(raw,{}))).toBeUndefined();
    expect(read(raw,other.reserve)).toBeUndefined();
    const publicRaw=adaptive.materializeAdaptiveBrick(input());
    drain(materialization.adaptiveValidateMaterializedBrickSteps(publicRaw,scope.options));
    expect(read(publicRaw)).toBeUndefined();
    const damaged={...raw,occupancy:raw.occupancy.map((v,i)=>i===0?2:v)};
    expect(()=>drain(materialization.adaptiveValidateMaterializedBrickSteps(damaged,scope.options))).toThrow();
    expect(read(damaged)).toBeUndefined();
    scope.dispose();scope.dispose();expect(read()).toBeUndefined();
    expect(JSON.stringify(validated)).toBe(JSON.stringify(adaptive.validateMaterializedAdaptiveBrick(raw)));
    expect(adaptive).not.toHaveProperty("createOwnedAdaptiveBrickScope");expect(adaptive).not.toHaveProperty("readOwnedValidatedAdaptiveBrick");
  }finally{scope.dispose();foreign.dispose();ledger.release();other.release();}
});

it("D2 complete HVP ingest closes its private brick scope once on success, failure and cancellation",()=>{
  const create=materialization.createOwnedAdaptiveBrickScope;
  const lifetimes:Array<ReturnType<typeof create>&{dispose:ReturnType<typeof vi.fn>}>=[];
  const factory=vi.spyOn(materialization,"createOwnedAdaptiveBrickScope").mockImplementation(reserve=>{
    const scope=create(reserve),observed={options:scope.options,dispose:vi.fn(()=>scope.dispose())};lifetimes.push(observed);return observed;
  });
  try{
    for(const mode of ["success","failure","cancel"]){
      const ledger=createStructuralOwnerLedger(32*1024*1024);let phase="";
      const steps=prepareHvpStructuralIngestOwnedSteps("d2-scope-exit",[{x:0,y:0,z:0,materialId:1}],materials,
        mode==="failure"?[{x:7,y:0,z:0}]:[],ledger.reserve,value=>{phase=value;});
      try{
        if(mode==="success"){drain(steps);}
        else if(mode==="failure"){expect(()=>drain(steps)).toThrow("Anchor requires an occupied canonical cell");}
        else{while(phase!=="ownerIngestProofs"){expect(steps.next().done).toBe(false);}steps.return(undefined as never);}
        expect(lifetimes.at(-1)!.dispose).toHaveBeenCalledTimes(1);
      }finally{steps.return(undefined as never);ledger.release();}
    }
  }finally{factory.mockRestore();}
});

it("D2 owned constant channels remain private when the ambient Array constructor observes allocations",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),scope=materialization.createOwnedAdaptiveBrickScope(ledger.reserve);
  const native=globalThis.Array,captured:unknown[]=[];
  const observing=function(...args:unknown[]){const result=Reflect.construct(native,args) as unknown[];
    if(result.length===4096){captured.push(result);}return result;} as unknown as ArrayConstructor;
  Object.setPrototypeOf(observing,native);Object.defineProperty(observing,"prototype",{value:native.prototype});
  let brick:ReturnType<typeof adaptive.materializeAdaptiveBrick>;
  try{globalThis.Array=observing;brick=drain(materialization.adaptiveMaterializeBrickSteps(input(),scope.options));}
  finally{globalThis.Array=native;scope.dispose();ledger.release();}
  expect(captured).toHaveLength(0);
  expect(JSON.stringify(brick!)).toBe(JSON.stringify(adaptive.materializeAdaptiveBrick(input())));
});

it("D2 factory-owned dense channels freeze without repeating 16384 index shape inspections",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,96*1024*1024,128),scope=materialization.createOwnedAdaptiveBrickScope(ledger.reserve);
  const descriptors=vi.spyOn(Object,"getOwnPropertyDescriptor");let count=0,brick:ReturnType<typeof adaptive.materializeAdaptiveBrick>;
  try{
    brick=drain(materialization.adaptiveMaterializeBrickSteps(input(),scope.options));
    count=descriptors.mock.calls.filter(([object,key])=>Array.isArray(object)&&object.length===4096&&typeof key==="string"&&/^\d+$/.test(key)).length;
  }finally{descriptors.mockRestore();scope.dispose();ledger.release();}
  expect(count).toBe(0);
  expect(JSON.stringify(brick!)).toBe(JSON.stringify(adaptive.materializeAdaptiveBrick(input())));
});

it("D2 native shape freeze accepts only its exact live factory arrays and never proves channel values",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,96*1024*1024,128);
  const factory=createOwnedAdaptiveChannelFactory(ledger.reserve),other=createOwnedAdaptiveChannelFactory(ledger.reserve);
  try{
    const array=drain(factory.fill(0));expect(Object.isSealed(array)).toBe(true);expect(Object.isFrozen(array)).toBe(false);
    expect(Object.getOwnPropertyDescriptor(array,"length")!.writable).toBe(false);
    expect(()=>{array.length=8192;}).toThrow();expect(()=>Object.setPrototypeOf(array,null)).toThrow();
    expect(()=>Object.defineProperty(array,"0",{get:()=>9})).toThrow();
    expect(()=>Object.defineProperty(array,"extra",{value:1})).toThrow();
    array[0]=7;
    expect(()=>drain(factory.freeze([...array]))).toThrow("Foreign");
    expect(()=>drain(factory.freeze(undefined as never))).toThrow("Foreign");
    expect(()=>drain(factory.freeze(new Proxy(array,{})))).toThrow("Foreign");
    expect(()=>drain(other.freeze(array))).toThrow("Foreign");
    expect(drain(factory.freeze(array))).toBe(array);expect(array[0]).toBe(7);
    expect(Object.isFrozen(array)).toBe(true);expect(isValidatedFrozenDenseArray(array)).toBe(true);
    expect(()=>drain(factory.freeze(array))).toThrow("Foreign");
    const invalid=drain(factory.fill(NaN));drain(factory.freeze(invalid));
    const brick={...adaptive.materializeAdaptiveBrick(input()),density:invalid};
    const scope=materialization.createOwnedAdaptiveBrickScope(ledger.reserve);
    try{expect(()=>drain(materialization.adaptiveValidateMaterializedBrickSteps(brick,scope.options))).toThrow();}
    finally{scope.dispose();}
    const abandoned=drain(factory.fill(1));factory.dispose();factory.dispose();
    expect(()=>drain(factory.freeze(abandoned))).toThrow("expired");expect(()=>drain(factory.fill(0))).toThrow("expired");
    expect(adaptive).not.toHaveProperty("createOwnedAdaptiveChannelFactory");
  }finally{factory.dispose();other.dispose();ledger.release();}
});

it("D2 channel factory rechecks its four-array bound after interleaved fill suspension",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),factory=createOwnedAdaptiveChannelFactory(ledger.reserve);
  const fills=Array.from({length:5},()=>factory.fill(0));
  try{
    for(const fill of fills){expect(fill.next().done).toBe(false);}
    for(let i=0;i<4;i++){expect(fills[i]!.next().done).toBe(false);}
    expect(()=>fills[4]!.next()).toThrow("full");
  }finally{for(const fill of fills){fill.return(undefined as never);}factory.dispose();ledger.release();}
});

it("D2 channel custody never exposes mutable arrays to ambient Set registration hooks",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),scope=materialization.createOwnedAdaptiveBrickScope(ledger.reserve);
  const original=Set.prototype.add;let captured=0;
  const add=vi.spyOn(Set.prototype,"add").mockImplementation(function(this:Set<unknown>,value:unknown){
    if(Array.isArray(value)&&value.length===4096&&!Object.isFrozen(value)){captured+=1;}
    return original.call(this,value);
  });
  try{drain(materialization.adaptiveMaterializeBrickSteps(input(),scope.options));}
  finally{add.mockRestore();scope.dispose();ledger.release();}
  expect(captured).toBe(0);
});
