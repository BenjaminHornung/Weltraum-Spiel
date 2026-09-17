import {expect,it,vi} from "vitest";
import {encodeHvpGrid,decodeHvpGrid} from "../../src/hestia-prototype/persistence/gridCheckpoint";
import {createHvpTerrainRoot,createHvpTerrainOwner,restoreHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {hvpRestoreSectors} from "../../src/hestia-prototype/terrain/terrainProducts";
import {createHvpTick} from "../../src/hestia-prototype/physics/tick";

const base=()=>({sizeX:32,sizeY:4,sizeZ:16,cellMeters:.125,originMeters:{x:-2,y:0,z:-1},sourceDigest:"12345678",
  readSlot:(_x:number,y:number,_z:number)=>y<3?1:0});
const cut=(root:ReturnType<typeof createHvpTerrainRoot>,id:string,x:number)=>{
  const s=root.read();const plan=root.prepare({sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,sourceDigest:s.sourceDigest,
    commandId:id,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,2,3],max:[x+1,3,4]}});root.commit(plan);
};
it("checkpoints a captured immutable Root in bounded UI slices and cancels without publishing partial data",async()=>{
  const source={...base(),sizeZ:256},read=source.readSlot;let reads=0;
  source.readSlot=(x,y,z)=>{reads+=1;return read(x,y,z);};
  const root=createHvpTerrainRoot(source,"async-save",0);cut(root,"first",15);
  const expected=root.checkpoint();reads=0;
  const pending=root.checkpointAsync();
  expect(reads).toBeLessThanOrEqual(16_384);
  cut(root,"next",16); // A newer generation must not leak into the in-flight checkpoint.
  expect(await pending).toEqual(expected);expect(root.read().revision).toBe(2);
  const abort=new AbortController();const cancelled=root.checkpointAsync(abort.signal);abort.abort();
  await expect(cancelled).rejects.toThrow();expect(root.checkpoint().revision).toBe(2);
});
it("swaps a confirmed Root without stranding its command port, rejects stale work and rolls back",()=>{
  const first=createHvpTerrainRoot(base(),"first",1),owner=createHvpTerrainOwner(first);
  const before=owner.read(),stale=owner.prepare({sessionId:"first",epoch:1,revision:0,sourceDigest:before.sourceDigest,commandId:"old",
    toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[1,2,3],max:[2,3,4]}});
  const candidate=createHvpTerrainRoot(base(),"loaded",3);cut(candidate,"saved",15);
  expect(owner.replace(before,candidate)).toBe(first);expect(owner.read()).toBe(candidate.read());
  expect(()=>owner.commit(stale)).toThrow(/Stale/);expect(()=>owner.replace(before,first)).toThrow(/Stale/);
  expect(()=>owner.replace(owner.read(),{...first})).toThrow(/unvalidated/);
  owner.replace(owner.read(),first);owner.commit(stale);expect(first.read().revision).toBe(1);
});
it("rebuilds restored dirty leaf halos, not the whole compatible terrain or a foreign base",()=>{
  const make=()=>createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
    sourceDigest:"12345678",readSlot:(_x:number,y:number,_z:number)=>y<4?1:0},"restore",1);
  const a=make(),b=make();cut(b,"cut-1",63);
  expect(hvpRestoreSectors(a.read(),b.read(),64)).toEqual([0,1]);
  expect(hvpRestoreSectors(a.read(),b.read(),32)).toEqual([1,2]);
  expect(hvpRestoreSectors(b.read(),b.read(),64)).toEqual([]);
  expect(()=>hvpRestoreSectors(a.read(),{...b.read(),baseDigest:"87654321"},64)).toThrow(/Compatible/);
});
it("restores a confirmed paused tick without inventing elapsed time or accepting a recovery hold",()=>{
  const tick=createHvpTick(()=>{});tick.advance(2);tick.resume();tick.advance(.02);tick.pause();
  const saved=JSON.parse(JSON.stringify(tick.read()));let steps=0;
  const restored=createHvpTick(()=>{steps+=1;},saved);expect(restored.read()).toEqual(saved);
  restored.advance(4);expect(steps).toBe(0);restored.resume();restored.advance(1/60);
  expect(restored.read().ticks).toBe(saved.ticks+1);expect(steps).toBe(1);
  expect(()=>createHvpTick(()=>{}, {...saved,status:"SimulationHold"})).toThrow();
  expect(()=>createHvpTick(()=>{}, {...saved,ticks:NaN})).toThrow();
});
it("restores exact current cells, source identity and leaf revisions from a JSON artifact only",()=>{
  const original=base(),root=createHvpTerrainRoot(original,"save-session",4);cut(root,"cut-1",15);cut(root,"cut-2",16);
  const expected=[];for(let z=0;z<16;z+=1){for(let y=0;y<4;y+=1){for(let x=0;x<32;x+=1){expected.push(root.read().readSlot(x,y,z));}}}
  const receipt=JSON.parse(JSON.stringify(root.checkpoint()));
  original.readSlot=()=>{throw new Error("Live source must not be read during restore");};
  const restored=restoreHvpTerrainRoot(receipt),actual=[];
  for(let z=0;z<16;z+=1){for(let y=0;y<4;y+=1){for(let x=0;x<32;x+=1){actual.push(restored.read().readSlot(x,y,z));}}}
  expect(actual).toEqual(expected);expect(restored.read()).toMatchObject({revision:2,sessionId:"save-session",epoch:4,sourceDigest:receipt.sourceDigest});
  expect([restored.read().leafRevision(0,0,0),restored.read().leafRevision(1,0,0)]).toEqual([1,1]);
  cut(restored,"cut-3",14);expect(restored.read().revision).toBe(3);
  expect(restored.read().leafRevision(0,0,0)).toBe(2);
});
it("rejects invalid run counts, materials and dimensions before allocating a voxel buffer",()=>{
  const saved=encodeHvpGrid(base());const original=Uint8Array;let allocations=0;
  vi.stubGlobal("Uint8Array",class extends original {constructor(...args:ConstructorParameters<typeof Uint8Array>){allocations+=1;super(...args);}});
  try{
    expect(()=>decodeHvpGrid({...saved,size:[1e9,1e9,1e9]})).toThrow();
    expect(()=>decodeHvpGrid({...saved,runs:[1,0]})).toThrow();
    expect(()=>decodeHvpGrid({...saved,runs:[7,2048]})).toThrow();
    expect(()=>decodeHvpGrid({...saved,runs:[1,2047]})).toThrow();
    expect(allocations).toBe(0);
  }finally{vi.unstubAllGlobals();}
  const decoded=decodeHvpGrid(saved);const copy=decoded.copySlots();copy.fill(0);expect(decoded.readSlot(0,0,0)).toBe(1);
});
it("rejects a tampered Root digest, unknown checkpoint version and invalid leaf revision",()=>{
  const root=createHvpTerrainRoot(base(),"save-session",4);cut(root,"cut-1",15);
  const saved=root.checkpoint();
  expect(()=>restoreHvpTerrainRoot({...saved,sourceDigest:"00000000"})).toThrow(/digest/);
  expect(()=>restoreHvpTerrainRoot({...saved,version:"unknown"})).toThrow(/version/);
  expect(()=>restoreHvpTerrainRoot({...saved,leaves:saved.leaves.map(l=>({...l,revision:3}))})).toThrow(/revision/);
});
