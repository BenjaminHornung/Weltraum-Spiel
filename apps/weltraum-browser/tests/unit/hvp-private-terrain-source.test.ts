import {expect,it,vi} from "vitest";
import * as terrain from "../../src/hestia-prototype/terrain/cutPlan";
import {decodeHvpGrid} from "../../src/hestia-prototype/persistence/gridCheckpoint";
import {createHvpTerrainCompiler} from "../../src/hestia-prototype/terrain/terrainProducts";
import {analyzeHvpTerrainSupport,releaseHvpOwnedSupportPlan} from "../../src/hestia-prototype/terrain/supportPlan";
import {WorkerPool} from "../../src/workers/workerPool";
import {materializeHvpCoastSource,prepareHvpOwnedCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";

const base=()=>({...decodeHvpGrid({version:"hvp-grid-v1",size:[32,16,16],origin:{x:0,y:0,z:0},cellMeters:.125,runs:[1,8192]}),sourceDigest:"12345678"});
// Restore is the genuine Grid producer; a spread base deliberately has no private witness.
const initial=()=>terrain.restoreHvpTerrainRoot(terrain.createHvpTerrainRoot(base(),"private-source",0).checkpoint());
const request=(s:terrain.HvpTerrainSnapshot,id:string,x=17):terrain.HvpCutRequest=>({sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,
  sourceDigest:s.sourceDigest,commandId:id,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,3,4],max:[x+1,4,5]}});

it("preserves the public padded-leaf fallback for valid partial-edge Grids",()=>{
  const checkpoint=terrain.createHvpTerrainRoot({sizeX:17,sizeY:16,sizeZ:16,cellMeters:.125,originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",readSlot:()=>1},"partial-grid",0).checkpoint();
  const control=terrain.restoreHvpTerrainRoot(checkpoint),candidate=terrain.restoreHvpPrivateTerrainRoot(checkpoint);
  const a=control.prepare(request(control.read(),"edge",16)),b=terrain.prepareHvpPrivateTerrainCut(candidate,request(candidate.read(),"edge",16));
  expect(JSON.stringify(b)).toBe(JSON.stringify(a));expect(terrain.readHvpPrivateCutSource(b)).toBeUndefined();
  control.commit(a);candidate.commit(b);expect(candidate.checkpoint()).toEqual(control.checkpoint());
});

it("keeps complete P plans and saved Source bytes equal through private cut, transfer, commit and rollback",()=>{
  const control=initial(),candidate=terrain.restoreHvpPrivateTerrainRoot(control.checkpoint());
  const original=candidate.read();expect(terrain.isHvpPrivateTerrainSource(candidate,original)).toBe(true);
  for(const owner of [control,{...candidate},new Proxy(candidate,{})]){expect(terrain.isHvpPrivateTerrainSource(owner,original)).toBe(false);}
  expect(terrain.isHvpPrivateTerrainSource(candidate,{...original})).toBe(false);
  const a=control.prepare(request(control.read(),"cut")),b=terrain.prepareHvpPrivateTerrainCut(candidate,request(candidate.read(),"cut"));
  expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  const cells=[{x:18,y:3,z:4,materialId:1}],at=control.prepareTransfer(a,cells),bt=terrain.prepareHvpPrivateTerrainTransfer(candidate,b,cells);
  expect(JSON.stringify(bt)).toBe(JSON.stringify(at));
  expect(terrain.readHvpPrivateCutSource(bt)?.source).toBe(bt.after);
  control.commit(at);candidate.commit(bt);expect(candidate.checkpoint()).toEqual(control.checkpoint());
  expect(terrain.isHvpPrivateTerrainSource(candidate,original)).toBe(false);expect(terrain.isHvpPrivateTerrainSource(candidate,bt.after)).toBe(true);
  control.rollback(at);candidate.rollback(bt);expect(candidate.checkpoint()).toEqual(control.checkpoint());
  expect(()=>terrain.readHvpPrivateCutSource(bt)!.assertCurrent()).toThrow("Stale private terrain cut");
});

it("uses intrinsic Grid allocation, fill, hash and overlay-mask storage without exposing retained TypedArray receivers",()=>{
  const checkpoint=initial().checkpoint(),NativeBytes=Uint8Array,fill=Uint8Array.prototype.fill;
  const typed=Object.getPrototypeOf(Uint8Array.prototype),nativeBuffer=Object.getOwnPropertyDescriptor(typed,"buffer")!.get!;
  const ownBuffer=Object.getOwnPropertyDescriptor(Uint8Array.prototype,"buffer"),ownBytes=Object.getOwnPropertyDescriptor(Uint8Array.prototype,"byteLength");
  const escaped:Uint8Array[]=[],buffers:ArrayBuffer[]=[];
  try{
    Object.defineProperty(NativeBytes.prototype,"buffer",{configurable:true,get(){escaped.push(this as Uint8Array);return nativeBuffer.call(this);}});
    Object.defineProperty(NativeBytes.prototype,"byteLength",{configurable:true,get(){escaped.push(this as Uint8Array);return 8192;}});
    NativeBytes.prototype.fill=function(...args:Parameters<Uint8Array["fill"]>){escaped.push(this);return Reflect.apply(fill,this,args);};
    globalThis.Uint8Array=new Proxy(NativeBytes,{construct(target,args){const bytes=Reflect.construct(target,args) as Uint8Array;
      if(args[0] instanceof ArrayBuffer){buffers.push(args[0]);}else{escaped.push(bytes);}return bytes;}});
    const root=terrain.restoreHvpPrivateTerrainRoot(checkpoint),cut=terrain.prepareHvpPrivateTerrainCut(root,request(root.read(),"intrinsic"));
    const transfer=terrain.prepareHvpPrivateTerrainTransfer(root,cut,[{x:18,y:3,z:4,materialId:1}]);root.commit(transfer);
    escaped.forEach(bytes=>Reflect.apply(fill,bytes,[4]));buffers.forEach(buffer=>Reflect.apply(fill,new NativeBytes(buffer),[4]));
    expect(root.read().readSlot(17,3,4)).toBe(0);expect(root.read().readSlot(18,3,4)).toBe(0);expect(root.read().readSlot(19,3,4)).toBe(1);
    expect(escaped).toHaveLength(0);expect(buffers).toHaveLength(0);
  }finally{
    globalThis.Uint8Array=NativeBytes;NativeBytes.prototype.fill=fill;
    if(ownBuffer){Object.defineProperty(NativeBytes.prototype,"buffer",ownBuffer);}else{Reflect.deleteProperty(NativeBytes.prototype,"buffer");}
    if(ownBytes){Object.defineProperty(NativeBytes.prototype,"byteLength",ownBytes);}else{Reflect.deleteProperty(NativeBytes.prototype,"byteLength");}
  }
});

it("runs the existing P support kernel directly on the exact private candidate, then rejects replacement during a yield",async()=>{
  const seed=terrain.createHvpTerrainRoot({sizeX:32,sizeY:16,sizeZ:16,cellMeters:.125,originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",
    readSlot:(x,y,z)=>y===0||(y===3&&z===4&&x>=17&&x<21)?1:0},"local-support",0).checkpoint();
  const root=terrain.createHvpTerrainOwner(terrain.restoreHvpPrivateTerrainRoot(seed));
  const compiler=createHvpTerrainCompiler(),start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueSupport").mockImplementation(()=>{throw new Error("Unexpected full Source transfer");});
  const phases:string[]=[];
  try{
    await compiler.prepare(()=>true,root);
    const original=root.read();expect(terrain.isHvpPrivateTerrainSource(root,original)).toBe(true);
    const cut=terrain.prepareHvpPrivateTerrainCut(root,request(root.read(),"direct"));
    const expected=analyzeHvpTerrainSupport(cut);
    const actual=await compiler.analyze(cut,8192,event=>phases.push(event.phase));
    const {cut:expectedCut,...expectedReport}=expected,{cut:actualCut,timings,...actualReport}=actual;
    expect(actualReport).toEqual(expectedReport);expect(actualCut).toBe(expectedCut);expect(actual.fragments[0]!.cells).toHaveLength(3);
    expect(phases).toContain("cutSupportLocalPlanMs");expect(phases).not.toContain("cutSupportCopyMs");expect(enqueue).not.toHaveBeenCalled();
    releaseHvpOwnedSupportPlan(actual);
    const pending=compiler.analyze(cut,8192);
    root.replace(cut.before,terrain.restoreHvpPrivateTerrainRoot(seed));
    expect(terrain.isHvpPrivateTerrainSource(root,original)).toBe(false);expect(terrain.isHvpPrivateTerrainSource(root,root.read())).toBe(true);
    await expect(pending).rejects.toThrow("Stale private terrain cut");
  }finally{await compiler.dispose();enqueue.mockRestore();start.mockRestore();}
});

it("keeps owned Coast storage exclusive when public constructor getters retain and mutate copy receivers",()=>{
  const source=prepareHvpOwnedCoastSource(materializeHvpCoastSource());
  const expected=source.readSlot(0,1,0),descriptor=Object.getOwnPropertyDescriptor(Uint8Array.prototype,"constructor");
  const receivers:Uint8Array[]=[];
  try{
    Object.defineProperty(Uint8Array.prototype,"constructor",{configurable:true,get(){receivers.push(this as Uint8Array);return Uint8Array;}});
    source.copyBytes();receivers.forEach(bytes=>bytes.fill(4));
    expect(receivers.length).toBeGreaterThan(0);expect(source.readSlot(0,1,0)).toBe(expected);
    const root=terrain.createHvpPrivateTerrainRoot(source,"coast-exclusive",0);
    const cut=terrain.prepareHvpPrivateTerrainCut(root,request(root.read(),"coast",17));
    expect(terrain.readHvpPrivateCutSource(cut)?.source).toBe(cut.after);
  }finally{if(descriptor){Object.defineProperty(Uint8Array.prototype,"constructor",descriptor);}else{Reflect.deleteProperty(Uint8Array.prototype,"constructor");}}
});

it("validates exact owned Coast bytes without public copy hooks, preserving public and foreign failures",()=>{
  const snapshot=materializeHvpCoastSource(),control=prepareHvpCoastSource(snapshot);
  const descriptor=Object.getOwnPropertyDescriptor(Uint8Array.prototype,"constructor");
  let candidate:ReturnType<typeof prepareHvpOwnedCoastSource>|undefined;
  try{
    Object.defineProperty(Uint8Array.prototype,"constructor",{configurable:true,get(){throw new Error("public Coast copy hook");}});
    candidate=prepareHvpOwnedCoastSource(snapshot);
    for(const source of [snapshot,{...snapshot},new Proxy(snapshot,{})]){
      expect(()=>prepareHvpCoastSource(source)).toThrow("public Coast copy hook");
    }
    for(const source of [{...snapshot},new Proxy(snapshot,{})]){
      expect(()=>prepareHvpOwnedCoastSource(source)).toThrow("public Coast copy hook");
    }
  }finally{if(descriptor){Object.defineProperty(Uint8Array.prototype,"constructor",descriptor);}else{Reflect.deleteProperty(Uint8Array.prototype,"constructor");}}
  expect(candidate!.sourceDigest).toBe(control.sourceDigest);expect(candidate!.combinedLeafDigest).toBe(control.combinedLeafDigest);
  expect(Buffer.from(candidate!.copyBytes()).equals(Buffer.from(control.copyBytes()))).toBe(true);
  expect(candidate!.readLeaf(15,7,15)).toEqual(control.readLeaf(15,7,15));
  expect(()=>prepareHvpOwnedCoastSource(candidate! as never)).toThrow(/readers/);
});

it("rejects complete Source digest mismatch after a raw public Coast constructor receiver escapes",()=>{
  const snapshot=materializeHvpCoastSource(),descriptor=Object.getOwnPropertyDescriptor(Uint8Array.prototype,"constructor");
  let escaped:Uint8Array|undefined;
  try{
    Object.defineProperty(Uint8Array.prototype,"constructor",{configurable:true,get(){escaped=this as Uint8Array;return Uint8Array;}});
    snapshot.copySlots();
  }finally{if(descriptor){Object.defineProperty(Uint8Array.prototype,"constructor",descriptor);}else{Reflect.deleteProperty(Uint8Array.prototype,"constructor");}}
  expect(escaped).toBeDefined();escaped![0]=4;
  expect(()=>prepareHvpOwnedCoastSource(snapshot)).toThrow("HVP coast source incomplete: source digest");
  expect(()=>prepareHvpCoastSource(snapshot)).toThrow("HVP coast source incomplete: source digest");
});

it.each(["oversized","clamped"])("rejects %s raw Coast pages produced by a replaced public constructor",kind=>{
  const NativeBytes=Uint8Array;let snapshot:ReturnType<typeof materializeHvpCoastSource>;
  try{
    globalThis.Uint8Array=new Proxy(NativeBytes,{construct(target,args){
      if(args[0]===8_388_608){return kind==="oversized"?new NativeBytes(8_388_609):new Uint8ClampedArray(8_388_608);}
      return Reflect.construct(target,args);
    }});
    snapshot=materializeHvpCoastSource();
  }finally{globalThis.Uint8Array=NativeBytes;}
  expect(()=>prepareHvpCoastSource(snapshot!)).toThrow("HVP coast source incomplete: slot pages");
  expect(()=>prepareHvpOwnedCoastSource(snapshot!)).toThrow("HVP coast source incomplete: slot pages");
});

it("never exposes retained private leaves to Species and withholds witnesses from public, clone and Proxy plans",()=>{
  const candidate=terrain.restoreHvpPrivateTerrainRoot(initial().checkpoint());
  const first=terrain.prepareHvpPrivateTerrainCut(candidate,request(candidate.read(),"first"));candidate.commit(first);
  const species=Object.getOwnPropertyDescriptor(Uint8Array,Symbol.species),copies:Uint8Array[]=[];
  try{
    Object.defineProperty(Uint8Array,Symbol.species,{configurable:true,get:()=>class {constructor(length:number){const bytes=new Uint8Array(length);copies.push(bytes);return bytes;}}});
    candidate.read().copyLeaf(1,0,0);copies.forEach(bytes=>bytes.fill(4));
    expect(candidate.read().readSlot(18,3,4)).toBe(1);
    const privateCut=terrain.prepareHvpPrivateTerrainCut(candidate,request(candidate.read(),"private",18));
    const witness=terrain.readHvpPrivateCutSource(privateCut)!;
    expect(witness.source).toBe(privateCut.after);expect(Object.isFrozen(witness)).toBe(true);
    expect(Reflect.set(witness,"source",privateCut.before)).toBe(false);
    expect(Reflect.set(witness,"assertCurrent",()=>{})).toBe(false);witness.assertCurrent();
    expect(terrain.readHvpPrivateCutSource({...privateCut})).toBeUndefined();
    expect(terrain.readHvpPrivateCutSource(new Proxy(privateCut,{}))).toBeUndefined();
    const publicCut=candidate.prepare(request(candidate.read(),"public",19));
    expect(terrain.readHvpPrivateCutSource(publicCut)).toBeUndefined();candidate.commit(publicCut);
    expect(()=>terrain.readHvpPrivateCutSource(privateCut)!.assertCurrent()).toThrow("Stale private terrain cut");
    expect(terrain.readHvpPrivateCutSource(terrain.prepareHvpPrivateTerrainCut(candidate,request(candidate.read(),"fallback",20)))).toBeUndefined();
  }finally{if(species){Object.defineProperty(Uint8Array,Symbol.species,species);}else{Reflect.deleteProperty(Uint8Array,Symbol.species);}}
});
