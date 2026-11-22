import { expect, it } from "vitest";
import { fnv1aHash } from "../../src/core/hash";
import { copyHvpCompactTerrainSource, readCompactTerrainCells, type HvpCompactTerrainSource } from "../../src/hestia-prototype/physics/compactTerrainWire";

const source:HvpCompactTerrainSource={generation:1,cellCount:2,parts:[{origin:[16,16,0],label:1,leafRevision:2,runs:[(3<<16)|(1<<12)]}]};
const cells=[{x:16,y:16,z:0,materialId:3},{x:17,y:16,z:0,materialId:3}];
const owner="hvp:terrain-fragment:r1:"+fnv1aHash(JSON.stringify(cells));

it("copies declared section membership and binds its material, generation and owner",()=>{
  const wire=copyHvpCompactTerrainSource(source);
  expect(wire.parts[0]!.runs).not.toBe(source.parts[0]!.runs);
  expect(readCompactTerrainCells(structuredClone(wire),owner,1)).toEqual(cells);
  expect(()=>readCompactTerrainCells(wire,owner,2)).toThrow();
  expect(()=>readCompactTerrainCells(wire,owner+"0",1)).toThrow();
  expect(()=>readCompactTerrainCells({...wire,cellCount:3},owner,1)).toThrow();
});

it("rejects overlapping membership, invalid world bounds and an x-span crossing a block face",()=>{
  const p=source.parts[0]!;
  for(const parts of [[p,{...p,label:2}],[{...p,origin:[0,128,0] as const}],[{...p,runs:[(1<<16)|(1<<12)|15]}]]){
    expect(()=>readCompactTerrainCells({...source,parts},owner,1)).toThrow();
  }
});
