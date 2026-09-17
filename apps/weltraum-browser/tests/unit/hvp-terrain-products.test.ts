import { describe, expect, it } from "vitest";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { meshInitialHvpTerrain, hvpDirtySectors, copyHvpTerrainSlots } from "../../src/hestia-prototype/terrain/terrainProducts";
import { executeHvpTerrainJob, hvpTerrainInputDigest, HVP_TERRAIN_JOB, HVP_TERRAIN_MAX_OUTPUT, decodeHvpTerrainOutput } from "../../src/workers/hvpTerrainJob";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../src/workers/ids";
import type { TransferableBufferBundle } from "../../src/workers/protocol";

describe("HVP local terrain derivation", () => {
  it("copies immutable COW leaves in canonical order without millions of per-cell map lookups", async () => {
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"flat",readSlot:()=>1},"copy-test",0);
    const cut=root.prepare({sessionId:"copy-test",epoch:0,revision:0,sourceDigest:"flat",commandId:"copy-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[31,63,15],max:[33,65,17]}});
    let leaves=0;
    const source={...cut.after,readSlot:()=>{throw new Error("Per-cell source lookup");},copyLeaf:(x:number,y:number,z:number)=>{leaves+=1;return cut.after.copyLeaf(x,y,z);}};
    const expected=new Uint8Array(8_388_608).fill(1);
    for(const change of cut.changed){const [x,y,z]=change.cell;expected[x+y*256+z*32768]=0;}
    const copied=await copyHvpTerrainSlots(source);
    expect(leaves).toBe(2048);expect(copied.every((value,i)=>value===expected[i])).toBe(true);
    copied.fill(0);expect(root.read().readSlot(0,1,0)).toBe(1);
    await expect(copyHvpTerrainSlots(source,()=>true)).rejects.toThrow(/Cancelled/);
  });
  it("covers sixteen 8m sectors exactly and invalidates only local content/halo products", () => {
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"flat",readSlot:(_x:number,y:number)=>y<80?1:0},"sector-test",0);
    const meshes=meshInitialHvpTerrain(root.read());
    expect(meshes.size).toBe(16);
    let area=0;
    for(const mesh of meshes.values()) {
      for(let i=0;i<mesh.indices.length;i+=3) {
        const a=mesh.indices[i]!*3,b=mesh.indices[i+1]!*3,c=mesh.indices[i+2]!*3;
        if(mesh.normals[a+1]!==1) { continue; }
        expect(mesh.positions[a+1]).toBe(2);
        area+=Math.abs((mesh.positions[b]!-mesh.positions[a]!)*(mesh.positions[c+2]!-mesh.positions[a+2]!)
          -(mesh.positions[c]!-mesh.positions[a]!)*(mesh.positions[b+2]!-mesh.positions[a+2]!))/2;
      }
    }
    expect(area).toBe(32*32);
    const plan=root.prepare({sessionId:"sector-test",epoch:0,revision:0,sourceDigest:"flat",commandId:"edge",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[63,79,63],max:[64,80,64]}});
    expect(hvpDirtySectors(plan,64)).toEqual([0,1,4,5]);
    expect(hvpDirtySectors(plan,32)).toEqual([9,10,17,18]);
    expect(plan.contentLeaves).toEqual(["3:4:3"]);
  },120_000);
  it("binds source, session, epoch, generation and sector before accepting actual typed worker output", () => {
    const slots=new Uint8Array(66*130*66);
    for(let z=1;z<=4;z+=1) { for(let y=1;y<=4;y+=1) { for(let x=1;x<=4;x+=1) { slots[x+y*66+z*66*130]=1; } } }
    const payload={sessionId:"test",epoch:2,generation:3,sourceDigest:"known",sector:0};
    const bundle:TransferableBufferBundle={buffers:[slots.buffer],byteLength:byteCount(slots.byteLength),revision:contentRevision(3),ownership:"SenderToWorker",
      views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
    const request={jobId:workerJobId("terrain"),targetKey:workerTargetKey("sector-0"),jobKind:workerJobKind(HVP_TERRAIN_JOB),
      workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(3),sourceInputDigest:hvpTerrainInputDigest(payload,bundle.buffers),
      algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(0),estimatedInputBytes:byteCount(slots.byteLength),
      estimatedOutputBytes:byteCount(HVP_TERRAIN_MAX_OUTPUT),payload};
    const result=executeHvpTerrainJob(request,bundle);
    const mesh=decodeHvpTerrainOutput(result.bundle,payload);
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.colors?.length).toBe(mesh.positions.length);
    for(const changed of [{sessionId:"foreign"},{epoch:3},{generation:4},{sector:1},{sourceDigest:"other"}]) {
      expect(()=>executeHvpTerrainJob({...request,payload:{...payload,...changed}},bundle)).toThrow(/binding/);
    }
    new Uint32Array(result.bundle.buffers[3]!)[0]=0xffffffff;
    expect(()=>decodeHvpTerrainOutput(result.bundle,payload)).toThrow();
  });
});
