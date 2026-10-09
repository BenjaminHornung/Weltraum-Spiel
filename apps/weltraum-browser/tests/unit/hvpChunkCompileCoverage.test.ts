import {expect,it} from "vitest";
import {buildHvpChunkInput,hvpChunkCoordinates,hvpDirtyChunks,hvpRestoreChunks,hvpRestoreChunksSteps} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import type {HvpTerrainSnapshot} from "../../src/hestia-prototype/terrain/cutPlan";

const source=(readSlot:HvpTerrainSnapshot["readSlot"]):HvpTerrainSnapshot=>({
  sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
  sessionId:"chunk-test",epoch:2,revision:3,sourceDigest:"12345678",baseDigest:"87654321",overlayBytes:0,
  readSlot,copyLeaf:()=>new Uint8Array(4096),leafRevision:()=>0
});
const decode=(ids:readonly number[])=>ids.map(hvpChunkCoordinates);

it("copies every XYZ halo face, edge and corner once with negative world origins",()=>{
  const read=(x:number,y:number,z:number)=>((x+1)+(y+1)*2+(z+1)*3)%5;
  const s=source((x,y,z)=>x>=0&&x<256&&y>=0&&y<128&&z>=0&&z<256?read(x,y,z):undefined);
  const a=buildHvpChunkInput(s,0,read);
  expect(a.slots).toHaveLength(34**3);
  expect(a.payload).toMatchObject({chunk:0,coreOrigin:[0,0,0],sizeX:32,sizeY:32,sizeZ:32,
    originMeters:{x:-16,y:-8,z:-16},haloWidth:1});
  for(const z of [-1,0,31,32]){for(const y of [-1,0,31,32]){for(const x of [-1,0,31,32]){
    expect(a.slots[x+1+(y+1)*34+(z+1)*34*34]).toBe(read(x,y,z));
  }}}
  expect(buildHvpChunkInput(s,41,read).payload.originMeters).toEqual({x:-12,y:-4,z:-12});
});

it("invalidates the full XYZ AO read closure, clamps coverage and keeps canonical x-y-z order",()=>{
  const dirty=(cell:readonly [number,number,number])=>hvpDirtyChunks({changed:[{cell,before:1,after:0}]});
  expect(decode(dirty([31,31,31]))).toEqual([[0,0,0],[1,0,0],[0,1,0],[1,1,0],
    [0,0,1],[1,0,1],[0,1,1],[1,1,1]]);
  expect(decode(dirty([31,10,10]))).toEqual([[0,0,0],[1,0,0]]);
  expect(decode(dirty([10,31,10]))).toEqual([[0,0,0],[0,1,0]]);
  expect(decode(dirty([10,10,31]))).toEqual([[0,0,0],[0,0,1]]);
  expect(dirty([0,0,0])).toEqual([0]);expect(dirty([255,127,255])).toEqual([255]);
  expect(()=>hvpChunkCoordinates(256)).toThrow(/chunk/i);
});

it("rejects missing or invalid required core and halo samples instead of inventing air",()=>{
  expect(()=>buildHvpChunkInput(source(()=>undefined),0,()=>0)).toThrow(/coverage/i);
  expect(()=>buildHvpChunkInput(source(()=>0),0,()=>undefined)).toThrow(/coverage/i);
  expect(()=>buildHvpChunkInput(source(()=>5),0,()=>0)).toThrow(/material/i);
  expect(()=>buildHvpChunkInput(source(()=>0),0,()=>-1)).toThrow(/material/i);
});

it("restores only changed leaf read closures and rejects a foreign base",()=>{
  const before=source(()=>0),leaf=new Uint8Array(4096);leaf[0]=1;
  const after={...before,sourceDigest:"abcdef12",leafRevision:(x:number,y:number,z:number)=>x===1&&y===1&&z===1?1:0,
    copyLeaf:(x:number,y:number,z:number)=>x===1&&y===1&&z===1?leaf:new Uint8Array(4096)};
  expect(decode(hvpRestoreChunks(before,after))).toEqual([[0,0,0],[1,0,0],[0,1,0],[1,1,0],
    [0,0,1],[1,0,1],[0,1,1],[1,1,1]]);
  const steps=hvpRestoreChunksSteps(before,after);let yielded=0,result!:number[];
  for(;;){const step=steps.next();if(step.done){result=step.value;break;}yielded+=1;}
  expect(yielded).toBe(128);expect(result).toEqual(hvpRestoreChunks(before,after));
  expect(hvpRestoreChunks(before,before)).toEqual([]);
  expect(()=>hvpRestoreChunks(before,{...after,baseDigest:"foreign"})).toThrow(/restore/i);
});
