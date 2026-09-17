import {beforeAll,expect,it,vi} from "vitest";
import {createHvpNeighborController} from "../../src/hestia-prototype/runtime/neighborController";
import {createHvpEastRegion,restoreHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {encodeHvpProjectionPacket} from "../../src/hestia-prototype/runtime/projectionPacket";
import {decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../src/workers/hvpNeighborJob";
import {byteCount,contentRevision} from "../../src/workers/ids";
import {fnv1aBytes} from "../../src/workers/protocol";
import type {HvpNeighborCheckpoint} from "../../src/hestia-prototype/runtime/residency";
import type {HvpCompactMesh} from "../../src/hvp/hvpCoastMesher";
import {MemoryContentCache} from "../../src/streaming/memoryContentCache";
import {createContentKey,canonicalizeContentKey} from "../../src/streaming/contentKey";
import {computeContentHash} from "../../src/streaming/canonical";

const empty:HvpCompactMesh={faceCount:0,unitFaceCount:0,outerFaceCount:0,cavityFaceCount:0,positions:new Float32Array(),normals:new Float32Array(),
  colors:null,indices:new Uint16Array(),materialRanges:[],boundsMeters:{min:{x:0,y:0,z:0},max:{x:0,y:0,z:0}},sourceDigest:"12345678",algorithmVersion:"fixture",tempEstimateBytes:0};
let east:ReturnType<typeof createHvpTerrainRoot>;
beforeAll(async()=>{east=createHvpTerrainRoot(await createHvpEastRegion(),"east-test",0);},120_000);
const harness=(fault="",gate?:()=>Promise<void>,cache?:MemoryContentCache,source=east)=>{
  const primary=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",readSlot:()=>0},"primary",0);
  let live:HvpNeighborCheckpoint|null=null,next:HvpNeighborCheckpoint|null=null,old:HvpNeighborCheckpoint|null=null,shown=false,oldShown=false;
  const physics={read:()=>({neighbor:live}) as never,
    prepareNeighbor:vi.fn(async(_id:string,c:HvpNeighborCheckpoint)=>{old=live;next=c;}),commitNeighbor:async()=>{live=next;},publishNeighbor:()=>{},
    rollbackNeighbor:async()=>{expect(shown).toBe(oldShown);live=old;},finalizeNeighbor:async()=>{},command:async()=>{}};
  const load=vi.fn(async()=>source);
  const compiler={neighborSeams:vi.fn(async(source:ReturnType<typeof primary.read>,b?:ReturnType<typeof east.read>)=>({
    primary:{source,render:new Map(),collision:new Map()},east:b?Array.from({length:64},()=>({vertices:new Float32Array(),indices:new Uint32Array()})):[]})),
    neighborProjection:vi.fn(async(a:ReturnType<typeof primary.read>,b:ReturnType<typeof east.read>,lod:.125|.5,epoch:number,key:string)=>{
      await gate?.();if(fault==="worker"){throw new Error("Injected worker failure");}
      const buffer=encodeHvpProjectionPacket(Array.from({length:lod===.125?6:7},()=>empty));
      const payload:HvpNeighborPayload={epoch,primaryRevision:a.revision,eastRevision:b.revision,primaryDigest:a.sourceDigest,eastDigest:b.sourceDigest,lod,key};
      const output={ownership:"WorkerToConsumer" as const,buffers:[buffer],revision:contentRevision(b.revision),byteLength:byteCount(buffer.byteLength),contentHash:fnv1aBytes([buffer]),
        views:[{name:"projections",kind:"Uint8Array" as const,bufferIndex:0,byteOffset:0,elementCount:buffer.byteLength}]};
      return {buffer,payload,products:decodeHvpNeighborOutput(output,payload)};
    })};
  const admit=vi.fn();
  const controller=createHvpNeighborController({primary:()=>primary.read(),physics,compiler,proxies:{join:empty,far:empty,water:empty},baseSectorCount:64,cache,
    current:()=>true,blocked:()=>false,load,admit,stage:value=>{
      oldShown=shown;return {publish(){shown=value.products!==null;if(fault==="publish"){throw new Error("Injected upload publication");}},
        rollback(){shown=oldShown;},finish(){if(fault==="retire"){throw new Error("Injected retirement");}}};
    }});
  return {controller,physics,compiler,load,primary,admit,live:()=>live,shown:()=>shown};
};
const settled=async(c:ReturnType<typeof harness>["controller"])=>{await vi.waitFor(()=>expect(c.read().busy).toBe(false),{timeout:10_000,interval:5});};

it("uses actual cache leases, keeps collision through LOD, checkpoints before eviction and reuses content on return",async()=>{
  const checkpoint=vi.fn((signal?:AbortSignal)=>east.checkpointAsync(signal));
  const h=harness("",undefined,undefined,{...east,checkpointAsync:checkpoint});try{
    h.controller.update(10,false);await settled(h.controller);
    expect(h.controller.read()).toMatchObject({state:"Ready",collisionReady:true,cacheMisses:1});expect(h.shown()).toBe(true);
    h.controller.update(12,false);await settled(h.controller);
    expect(h.physics.prepareNeighbor).toHaveBeenCalledTimes(1);expect(h.compiler.neighborSeams).toHaveBeenCalledTimes(1);
    expect(h.controller.read()).toMatchObject({lod:.125,cacheMisses:2});
    h.controller.update(0,false);await settled(h.controller);expect(h.live()?.resident).toBe(false);expect(h.shown()).toBe(false);
    const saved=h.controller.checkpoint();expect(saved?.sourceDigest).toBe(east.read().sourceDigest);expect(h.controller.read().sourceBytes).toBe(0);
    h.controller.update(12,false);await settled(h.controller);
    expect(h.load).toHaveBeenCalledTimes(1);expect(h.compiler.neighborProjection).toHaveBeenCalledTimes(2);
    expect(h.controller.read()).toMatchObject({state:"Ready",cacheHits:1,cacheEntries:2});
    h.controller.update(0,false);await settled(h.controller);
    expect(checkpoint).toHaveBeenCalledTimes(1); // Restored identical source already owns its complete checkpoint.
    h.controller.update(12,false);await settled(h.controller);
    for(let i=0;i<200;i+=1){h.controller.update(9+i%2,false);}await settled(h.controller);
    expect(h.controller.read().cacheEntries).toBeLessThanOrEqual(2);
  }finally{await h.controller.dispose();expect(h.controller.read().cacheBytes).toBe(0);}
},120_000);
it("keeps an edited checkpoint projection after eviction and restores it without inventing collision readiness",async()=>{
  const source=restoreHvpEastRegion(east.checkpoint());let y=127;while(source.read().readSlot(128,y,128)===0){y-=1;}
  source.commit(source.prepare({sessionId:source.read().sessionId,epoch:source.read().epoch,revision:0,sourceDigest:source.read().sourceDigest,
    commandId:"edit-1",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[128,y,128],max:[129,y+1,129]}}));
  const h=harness("",undefined,undefined,source);let restored:ReturnType<typeof createHvpNeighborController>|undefined;
  try{
    h.controller.update(12,false);await settled(h.controller);h.controller.update(0,false);await settled(h.controller);
    expect(h.live()?.resident).toBe(false);expect(h.shown()).toBe(true);
    expect(h.controller.read()).toMatchObject({state:"Evicted",collisionReady:false,sourceBytes:0});
    const native=h.live(),saved=h.controller.checkpoint()!;let shown=false;
    const forbidden=()=>{throw new Error("A checkpoint projection cannot activate collision");};
    restored=createHvpNeighborController({primary:()=>h.primary.read(),compiler:h.compiler,proxies:{join:empty,far:empty,water:empty},baseSectorCount:64,
      physics:{read:()=>({neighbor:native}) as never,prepareNeighbor:forbidden,commitNeighbor:forbidden,publishNeighbor:forbidden,
        rollbackNeighbor:forbidden,finalizeNeighbor:forbidden,command:forbidden},current:()=>true,blocked:()=>true,admit:()=>{},
      load:async()=>{throw new Error("No seed regeneration after edited eviction");},
      stage:value=>({publish(){shown=value.products!==null;},rollback(){shown=false;},finish(){}})});
    await restored.initialize(restoreHvpEastRegion(saved),.125);
    expect(shown).toBe(true);expect(restored.read()).toMatchObject({state:"Evicted",collisionReady:false,sourceBytes:0});
    expect(restored.checkpoint()!.sourceDigest).toBe(source.read().sourceDigest);
    expect(h.compiler.neighborProjection.mock.calls.at(-1)![1].readSlot(128,y,128)).toBe(0);
  }finally{await restored?.dispose();await h.controller.dispose();}
},120_000);
it("discards cancellation before cache, render and native adoption",async()=>{
  let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});const h=harness("",()=>wait);
  try{h.controller.update(12,false);await vi.waitFor(()=>expect(h.compiler.neighborProjection).toHaveBeenCalled());
    h.controller.update(0,false);release();await settled(h.controller);
    expect(h.controller.read().cacheEntries).toBe(0);expect(h.physics.prepareNeighbor).not.toHaveBeenCalled();expect(h.shown()).toBe(false);
  }finally{release();await h.controller.dispose();}
});
it("does not spin on failed preparation and restores old visibility on publication failure",async()=>{
  for(const fault of ["worker","publish"]){const h=harness(fault);try{
    h.controller.update(12,false);await settled(h.controller);for(let i=0;i<200;i+=1){h.controller.update(12,false);}
    expect(h.compiler.neighborProjection).toHaveBeenCalledTimes(1);expect(h.controller.read().error).toContain("Injected");
    expect(h.controller.read().collisionReady).toBe(false);expect(h.live()).toBeNull();expect(h.shown()).toBe(false);
  }finally{await h.controller.dispose();}}
});
it("hands off a real cache lease without clearing the staged replacement's content",async()=>{
  const cache=new MemoryContentCache(32*1024*1024),h=harness("",undefined,cache);
  let next:ReturnType<typeof createHvpNeighborController>|undefined;
  try{
    h.controller.update(12,false);await settled(h.controller);
    const bytes=cache.totalBytes,prepared=h.live();expect(prepared?.resident).toBe(true);
    const mutation=()=>{throw new Error("Candidate may not mutate the live World");};
    next=createHvpNeighborController({primary:()=>h.primary.read(),cache,compiler:h.compiler,proxies:{join:empty,far:empty,water:empty},baseSectorCount:64,
      physics:{read:()=>({neighbor:prepared}) as never,prepareNeighbor:mutation,commitNeighbor:mutation,publishNeighbor:mutation,
        rollbackNeighbor:mutation,finalizeNeighbor:mutation,command:mutation},current:()=>true,blocked:()=>true,admit:()=>{},
      stage:()=>({publish(){},rollback(){},finish(){}})});
    await next.initialize(east,.125);
    expect(next.read()).toMatchObject({collisionReady:true,cacheHits:1});expect(cache.totalBytes).toBe(bytes);
    expect(cache.snapshot().entries[0]!.leaseCount).toBe(2);
    h.controller.retire();expect(cache.snapshot().entries[0]!.leaseCount).toBe(1);expect(next.read().cacheBytes).toBe(bytes);
    await next.dispose();expect(cache.snapshot().leasedEntries).toBe(0);expect(cache.totalBytes).toBe(bytes);
  }finally{await next?.dispose();await h.controller.dispose();cache.clear();}
},120_000);
it("prunes only unleased obsolete context and separates completed-packet copying from new worker preparation",async()=>{
  const cache=new MemoryContentCache(32*1024*1024);
  const stale=createContentKey({namespace:"hvp-region",contentId:"east:obsolete",inputRevision:0,algorithmVersion:1,outputRevision:0});
  const protectedKey=createContentKey({...stale,contentId:"east:visible"});
  const buffer=encodeHvpProjectionPacket(Array.from({length:6},()=>empty));
  for(const key of [stale,protectedKey]){cache.put({key,buffer,byteLength:buffer.byteLength,contentHash:computeContentHash(buffer),layout:"hvp-projection-meshes-v1"});}
  const lease=cache.get(protectedKey)!,h=harness("",undefined,cache);
  try{
    h.controller.update(12,false);await settled(h.controller);
    expect(h.controller.read().error).toBe("");
    const keys=cache.snapshot().entries.map(e=>canonicalizeContentKey(e.key));
    expect(keys).not.toContain(canonicalizeContentKey(stale));expect(keys).toContain(canonicalizeContentKey(protectedKey));expect(lease.isValid).toBe(true);
    const admissions=h.admit.mock.calls.map(([value])=>value);
    const copy=admissions.findIndex(a=>a.preparing===false&&a.cache>=buffer.byteLength*2);
    expect(copy).toBeGreaterThan(0);expect(admissions[copy+1].preparing).toBe(true);
  }finally{await h.controller.dispose();lease.release();cache.clear();}
},120_000);
