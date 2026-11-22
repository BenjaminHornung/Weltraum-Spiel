import { expect,it } from "vitest";
import { buildBlock } from "../../../src/voxel/structural/componentIndex/block";
import { copyHvpOwnedTerrainLeaf,createHvpTerrainRoot,restoreHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { cutAt } from "./compactFixtures";

it("derives the same labelled topology, material runs, mass and collision from owner bytes and a scalar reader",()=>{
  const size=32;
  const source={sizeX:size,sizeY:size,sizeZ:size,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"445588aa",
    readSlot:(x:number,y:number,z:number)=>((x^y^z)%5===0||x===0||y===4)?(x+y+z)%4+1:0};
  const root=restoreHvpTerrainRoot(createHvpTerrainRoot(source,"page-parity",1).checkpoint());
  const snapshot=root.read(),bytes=copyHvpOwnedTerrainLeaf(snapshot,0,0,0)!;
  expect(bytes).toHaveLength(4096);
  bytes.fill(0);
  let reads=0;
  const foreign={...snapshot,copyLeaf:()=>{throw new Error("foreign page");},
    readSlot:(x:number,y:number,z:number)=>{reads++;return snapshot.readSlot(x,y,z);}};
  const fast=buildBlock(snapshot,0,[0,0,0]),reference=buildBlock(foreign,0,[0,0,0]);
  expect(reads).toBe(4096);
  expect(fast.labels).toEqual(reference.labels);
  expect(fast.components).toEqual(reference.components);
  expect(fast.parts).toEqual(reference.parts);
  expect(fast.retainedBytes).toBe(reference.retainedBytes);
  const cut=cutAt(root,[5,4,5]);
  expect(copyHvpOwnedTerrainLeaf(cut.after,0,0,0)).toBeUndefined();
  const publicEdited=buildBlock(cut.after,0,[0,0,0]),scalarEdited=buildBlock({...cut.after},0,[0,0,0]);
  expect(publicEdited.parts).toEqual(scalarEdited.parts);
});

it("preserves unknown interior cells and padded exterior labels on a partial page",()=>{
  const source={sizeX:20,sizeY:16,sizeZ:16,cellMeters:.125,originMeters:{x:0,y:0,z:0},sourceDigest:"ab445588",
    readSlot:(x:number,y:number,z:number)=>x===18&&y===3&&z===4?undefined:y===3&&z===4?4:0};
  const snapshot=createHvpTerrainRoot(source,"partial-page",1).read();
  const block=buildBlock(snapshot,1,[16,0,0]);
  expect(block.labels[2+3*16+4*256]).toBe(-1);
  expect(block.labels[4+3*16+4*256]).toBe(-1);
  expect(block.components.map(c=>c.touchesUnknown)).toEqual([true,true]);
});
