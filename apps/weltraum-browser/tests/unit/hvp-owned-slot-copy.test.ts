import {expect,it,vi} from "vitest";
import * as terrain from "../../src/hestia-prototype/terrain/cutPlan";
import {copyHvpTerrainSlots} from "../../src/hestia-prototype/terrain/terrainProducts";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {materializeHvpCoastSource,prepareHvpOwnedCoastSource,prepareHvpCoastSource,restoreHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {createHvpOwnedSlotBlockCopy} from "../../src/hestia-prototype/terrain/ownedSlotCopy";

const base={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",readSlot:(x:number)=>x<16?1:2};
const owned=(source:terrain.HvpTerrainSnapshot,x:number,y:number,z:number)=>(terrain as unknown as {
  copyHvpOwnedTerrainLeaf:(s:terrain.HvpTerrainSnapshot,x:number,y:number,z:number)=>Uint8Array|undefined}).copyHvpOwnedTerrainLeaf(source,x,y,z);
it("copies exact validated cold-grid and COW bytes defensively without changing public leaf bytes or digests",()=>{
  const first=terrain.createHvpTerrainRoot(base,"owned-copy",0),root=terrain.restoreHvpTerrainRoot(first.checkpoint()),before=root.read();
  const copy=owned(before,1,0,0)!;expect(copy).toEqual(before.copyLeaf(1,0,0));expect(copy.every(v=>v===2)).toBe(true);
  copy.fill(4);expect(owned(before,1,0,0)).toEqual(before.copyLeaf(1,0,0));
  const cut=root.prepare({sessionId:before.sessionId,epoch:0,revision:0,sourceDigest:before.sourceDigest,commandId:"cut",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[17,3,4],max:[19,5,6]}});
  const actual=cut.after.copyLeaf(1,0,0);expect(owned(cut.after,1,0,0)).toBeUndefined();expect(actual.filter(v=>v===0)).toHaveLength(8);
  const expectedBase=before.copyLeaf(1,0,0),species=Object.getOwnPropertyDescriptor(Uint8Array,Symbol.species);
  try{Object.defineProperty(Uint8Array,Symbol.species,{configurable:true,get:()=>{throw new Error("no private buffer species");}});
    expect([...owned(before,1,0,0)!]).toEqual([...expectedBase]);expect(owned(cut.after,1,0,0)).toBeUndefined();
    expect(()=>cut.after.copyLeaf(1,0,0)).toThrow("no private buffer species");
  }finally{if(species){Object.defineProperty(Uint8Array,Symbol.species,species);}else{Reflect.deleteProperty(Uint8Array,Symbol.species);}}
  expect(before.sourceDigest).toBe("12345678");expect(cut.after.sourceDigest).not.toBe(before.sourceDigest);
  expect(owned({...before},0,0,0)).toBeUndefined();expect(owned(new Proxy(before,{}),0,0,0)).toBeUndefined();
  expect(owned(before,16,0,0)).toBeUndefined();expect(before.copyLeaf(16,0,0).every(v=>v===0)).toBe(true);
});
it("withholds the changed-leaf capability after species-sensitive recut and transfer production",()=>{
  const first=terrain.createHvpTerrainRoot(base,"cow-species",0),root=terrain.restoreHvpTerrainRoot(first.checkpoint());
  const command=(id:string,x:number)=>{const s=root.read();return {sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,sourceDigest:s.sourceDigest,commandId:id,
    toolPolicy:"hvp-plasma-v1" as const,shape:{kind:"Box" as const,min:[x,3,4] as const,max:[x+1,4,5] as const}};};
  const cut=root.prepare(command("first",17));root.commit(cut);
  const species=Object.getOwnPropertyDescriptor(Uint8Array,Symbol.species),copies:Uint8Array[]=[];
  try{Object.defineProperty(Uint8Array,Symbol.species,{configurable:true,get:()=>class {constructor(length:number){const copy=new Uint8Array(length);copies.push(copy);return copy;}}});
    const recut=root.prepare(command("second",18));expect(copies.length).toBeGreaterThan(0);expect(owned(recut.after,1,0,0)).toBeUndefined();
    expect(owned(recut.after,0,0,0)).toBeDefined();
    const transferred=root.prepareTransfer(recut,[{x:19,y:3,z:4,materialId:2}]);expect(owned(transferred.after,1,0,0)).toBeUndefined();
  }finally{if(species){Object.defineProperty(Uint8Array,Symbol.species,species);}else{Reflect.deleteProperty(Uint8Array,Symbol.species);}}
});
it("keeps generic reader errors and copy observations, and cancels an actual owned copy after yielding",async()=>{
  const first=terrain.createHvpTerrainRoot(base,"owned-copy-cancel",0),source=terrain.restoreHvpTerrainRoot(first.checkpoint()).read();
  let reads=0;const generic={...source,copyLeaf:(x:number,y:number,z:number)=>{reads+=1;if(reads===3){throw new Error("late unknown coverage");}return source.copyLeaf(x,y,z);}};
  const pump=createHvpBodyMeshTaskPump(()=>{});
  try{await expect(copyHvpTerrainSlots(generic,()=>false,pump.host)).rejects.toThrow("late unknown coverage");expect(reads).toBe(3);}
  finally{pump.dispose();}
  let yielded=false;
  const host={assertCurrent:()=>{},continuePlan:()=>false,yieldTask:async()=>{yielded=true;throw new Error("cancel owned copy");}};
  await expect(copyHvpTerrainSlots(source,()=>false,host)).rejects.toThrow("cancel owned copy");expect(yielded).toBe(true);
});
it("copies the complete owned base in4096-byte blocks and overlays only current COW leaves in numeric order",async()=>{
  const root=terrain.restoreHvpTerrainRoot(terrain.createHvpTerrainRoot(base,"bulk-copy",0).checkpoint());
  for(const [i,x] of [33,17].entries()){
    const s=root.read(),cut=root.prepare({sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,sourceDigest:s.sourceDigest,commandId:`cut${i}`,toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[x,3,4],max:[x+1,4,5]}});root.commit(cut);
  }
  const source=root.read(),output=new Uint8Array(8_388_608),steps=terrain.copyHvpOwnedTerrainSlotsSteps(source,output)!;
  expect(steps).toBeDefined();let blocks=0,overlays=0;const rows=vi.spyOn(Uint8Array.prototype,"set");
  try{for(;;){const next=steps.next();if(next.done){break;}if(next.value==="terrainBaseBlock"){blocks+=1;}
    else{expect(next.value).toBe("terrainOverlayLeaf");overlays+=1;}}
    expect(rows).toHaveBeenCalledTimes(512);expect(rows.mock.calls[0]![1]).toBe(16);expect(rows.mock.calls[256]![1]).toBe(32);
  }finally{steps.return(undefined as never);rows.mockRestore();}
  expect(blocks).toBe(2048);expect(overlays).toBe(2);expect(output[17+3*256+4*32768]).toBe(0);expect(output[33+3*256+4*32768]).toBe(0);
  const pump=createHvpBodyMeshTaskPump(()=>{});
  try{expect(Buffer.from(await copyHvpTerrainSlots(source,()=>false,pump.host)).equals(Buffer.from(output))).toBe(true);}finally{pump.dispose();}
  expect(Buffer.from(await copyHvpTerrainSlots(source)).equals(Buffer.from(output))).toBe(true);
  expect(terrain.copyHvpOwnedTerrainSlotsSteps({...source},output)).toBeUndefined();
  expect(terrain.copyHvpOwnedTerrainSlotsSteps(new Proxy(source,{}),output)).toBeUndefined();
  const nested=terrain.createHvpTerrainRoot(source,"nested-base",0).read();
  expect(terrain.copyHvpOwnedTerrainSlotsSteps(nested,output)).toBeUndefined();
  output.fill(4);expect(source.readSlot(17,3,4)).toBe(0);expect(source.readSlot(18,3,4)).toBe(2);
});
it("registers fresh and prepared coast blocks only for exact owned producer identities",()=>{
  const fresh=materializeHvpCoastSource(),prepared=prepareHvpOwnedCoastSource(fresh),expected=Buffer.from(fresh.copySlots());
  for(const source of [fresh,prepared]){
    const snapshot=terrain.createHvpTerrainRoot(source,"coast-blocks",0).read(),target=new Uint8Array(8_388_608),steps=terrain.copyHvpOwnedTerrainSlotsSteps(snapshot,target)!;
    try{for(;;){if(steps.next().done){break;}}}finally{steps.return(undefined as never);}
    expect(Buffer.from(target).equals(expected)).toBe(true);
  }
  const unowned=terrain.createHvpTerrainRoot(prepareHvpCoastSource(fresh),"public-coast",0).read();
  expect(terrain.copyHvpOwnedTerrainSlotsSteps(unowned,new Uint8Array(8_388_608))).toBeUndefined();
  for(const source of [restoreHvpCoastSource(fresh.copySlots(),fresh.sourceDigest),{...fresh},new Proxy(fresh,{})]){
    const snapshot=terrain.createHvpTerrainRoot(source,"foreign-coast",0).read();
    expect(terrain.copyHvpOwnedTerrainSlotsSteps(snapshot,new Uint8Array(8_388_608))).toBeUndefined();
  }
});
it("rejects invalid block bounds before mutating the destination and retains original COW Species errors after base blocks",()=>{
  const bytes=Uint8Array.from({length:8192},(_,i)=>i%251),target=new Uint8Array(8192),copy=createHvpOwnedSlotBlockCopy(bytes);
  for(const [offset,length] of [[-1,1],[0,4097],[8192,1],[.5,1],[0,0]]){
    expect(()=>copy(target,offset!,length!)).toThrow("Invalid owned terrain copy block");expect(target.every(v=>v===0)).toBe(true);
  }
  copy(target,4096,4096);expect(Buffer.from(target.subarray(4096)).equals(Buffer.from(bytes.subarray(4096)))).toBe(true);
  expect(()=>copy(new Uint8Array(1),0,1)).toThrow("Invalid owned terrain copy block");
  const detached=new Uint8Array(8192),detachedCopy=createHvpOwnedSlotBlockCopy(detached),untouched=new Uint8Array(8192);
  structuredClone(detached.buffer,{transfer:[detached.buffer]});
  expect(()=>detachedCopy(untouched,-1,1)).toThrow("Invalid owned terrain copy block");expect(untouched.every(v=>v===0)).toBe(true);
  const root=terrain.restoreHvpTerrainRoot(terrain.createHvpTerrainRoot(base,"bulk-species",0).checkpoint()),s=root.read();
  const cut=root.prepare({sessionId:s.sessionId,epoch:0,revision:0,sourceDigest:s.sourceDigest,commandId:"cut",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[17,3,4],max:[18,4,5]}}),steps=terrain.copyHvpOwnedTerrainSlotsSteps(cut.after,new Uint8Array(8_388_608))!;
  const original=Object.getOwnPropertyDescriptor(Uint8Array,Symbol.species),sentinel=new Error("same COW Species error");
  try{Object.defineProperty(Uint8Array,Symbol.species,{configurable:true,get:()=>{throw sentinel;}});
    for(let i=0;i<2048;i+=1){expect(steps.next().value).toBe("terrainBaseBlock");}
    expect(()=>steps.next()).toThrow(sentinel);
  }finally{steps.return(undefined as never);if(original){Object.defineProperty(Uint8Array,Symbol.species,original);}else{Reflect.deleteProperty(Uint8Array,Symbol.species);}}
});
