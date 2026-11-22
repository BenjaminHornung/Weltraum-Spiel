import {expect,it} from "vitest";
import {writeFileSync} from "node:fs";
import {createHvpTerrainRoot,type HvpTerrainSnapshot} from "../../../src/hestia-prototype/terrain/cutPlan";
import {collisionInputs,meshCollisionInput} from "../../../src/hestia-prototype/physics/terrainColliders";
import {hvpChunkCoordinates,hvpDirtyChunks} from "../../../src/hestia-prototype/terrain/terrainChunkInput";
import {HVP_SOURCE_MIN_METERS,materializeHvpCoastSource,prepareHvpCoastSource} from "../../../src/hvp/hvpCoastSource";
import {createTerrainComponentIndex,materializeCompactCells} from "../../../src/voxel/structural/componentIndex";
import {buildHvpChunkCollisionIndexSteps,canPatchHvpCollisionInOneTask,hvpChunkOccupancySteps,patchIndexedHvpChunkCollisionSteps} from "../../../src/voxel/structural/componentIndex/terrainCollision";
import {cutAt} from "./compactFixtures";

const reserve=()=>{};
function drain<T>(steps:Generator<string,T,unknown>){
  for(;;){const step=steps.next();if(step.done)return step.value;}
}
function workerInput(s:HvpTerrainSnapshot,id:number,east=0) {
  const [ox,oy,oz]=hvpChunkCoordinates(id).map(v=>v*32);
  return collisionInputs({sizeX:32,sizeY:32,sizeZ:32,cellMeters:.125,
    originMeters:{x:s.originMeters.x+ox*.125,y:s.originMeters.y+oy*.125,z:s.originMeters.z+oz*.125},
    readSlot:(x,y,z)=>s.readSlot(ox+x,oy+y,oz+z),readHaloSlot:(x,y,z)=>
      ox+x===256?east:s.readSlot(ox+x,oy+y,oz+z)}).next().value!;
}
function published(s:HvpTerrainSnapshot,id:number,east=0) {
  const input=workerInput(s,id,east),mesh=meshCollisionInput(input);
  return drain(buildHvpChunkCollisionIndexSteps(s,id,mesh,drain(hvpChunkOccupancySteps(input.slots,reserve)),reserve));
}
function compare(a:ReturnType<typeof meshCollisionInput>,b:ReturnType<typeof meshCollisionInput>){
  const bytes=(v:Float32Array|Uint32Array)=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
  expect(bytes(a.vertices).equals(bytes(b.vertices))).toBe(true);
  expect(bytes(a.indices).equals(bytes(b.indices))).toBe(true);
}

it("reuses immutable published planes through two actual revision changes across a seam",()=>{
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:HVP_SOURCE_MIN_METERS,
    sourceDigest:"384ac0ff",readSlot:(x,y,z)=>x>=25&&x<=37&&y>22&&y<=36&&z>=27&&z<=39&&((x+y+z)%9||y===30)?(x+z)%4+1:0},"collision-recut",3);
  const first=cutAt(root,[30,29,30],[34,34,34]);
  const initial=new Map(hvpDirtyChunks(first).map(id=>[id,published(first.before,id)]));
  const next=new Map(initial);
  for(const id of hvpDirtyChunks(first)){
    const prev=initial.get(id)!,beforeMasks=prev.planes.map(p=>p?.slice()),beforeSlots=prev.slots!.slice();
    const result=drain(patchIndexedHvpChunkCollisionSteps(first,id,first.before,prev.mesh,prev,reserve));
    compare(result.mesh,meshCollisionInput(workerInput(first.after,id)));next.set(id,result.index);
    expect(prev.slots).toEqual(beforeSlots);expect(prev.planes).toEqual(beforeMasks);
    expect(result.index.planes.some((plane,i)=>plane!==undefined&&plane===prev.planes[i])).toBe(true);
    expect(()=>drain(patchIndexedHvpChunkCollisionSteps(first,id,first.before,{...prev.mesh},prev,reserve))).toThrow(/Stale/);
  }
  root.commit(first);
  const second=cutAt(root,[32,31,32],[36,35,36]);
  for(const id of hvpDirtyChunks(second)){
    const prev=next.get(id)!;
    const result=drain(patchIndexedHvpChunkCollisionSteps(second,id,second.before,prev.mesh,prev,reserve));
    compare(result.mesh,meshCollisionInput(workerInput(second.after,id)));
  }
});

it("binds plane masks to the physical halo at the world edge and handles an emptied chunk",()=>{
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:HVP_SOURCE_MIN_METERS,
    sourceDigest:"5432a3ff",readSlot:(x,y,z)=>x===255&&y===24&&z>=19&&z<=22?2:0},"edge",1);
  const plan=cutAt(root,[255,24,19],[256,25,22]),id=hvpDirtyChunks(plan)[0]!;
  for(const east of [0,2]){
    const prev=published(plan.before,id,east),next=drain(patchIndexedHvpChunkCollisionSteps(plan,id,plan.before,prev.mesh,prev,reserve));
    compare(next.mesh,meshCollisionInput(workerInput(plan.after,id,east)));
  }
  root.commit(plan);
  const end=cutAt(root,[255,24,22]),prev=published(end.before,id);
  const final=drain(patchIndexedHvpChunkCollisionSteps(end,id,end.before,prev.mesh,prev,reserve));
  expect(final.mesh.indices.length).toBe(0);expect(final.index.unitFaces).toBe(0);
});

it("uses a bounded synchronous 64/384 cut with no source rereads and reproduces every worker triangle",()=>{
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"collision-cut",1);
  const arm=cutAt(root,[176,78,76],[180,82,80]);
  const compact=createTerrainComponentIndex(arm.before).prepareCompact(arm);
  const plan=root.prepareTransfer(arm,compact.fragments.flatMap(materializeCompactCells));
  const dirty=hvpDirtyChunks(plan),indices=new Map(dirty.map(id=>[id,published(plan.before,id)]));
  expect(canPatchHvpCollisionInOneTask(plan,dirty,indices)).toBe(true);
  expect(canPatchHvpCollisionInOneTask({...plan,changed:[...plan.changed,...plan.changed]},dirty,indices)).toBe(false);
  const guarded={...plan,after:{...plan.after,readSlot:()=>{throw new Error("Cached collision queried the source again");}}};
  const reference=dirty.map(id=>meshCollisionInput(workerInput(plan.after,id)));
  const elapsed:number[]=[];
  for(let trial=0;trial<36;trial++){
    const start=performance.now(),result=dirty.map(id=>{
      const index=indices.get(id)!;
      return drain(patchIndexedHvpChunkCollisionSteps(guarded,id,plan.before,index.mesh,index,reserve)).mesh;
    });
    elapsed.push(performance.now()-start);
    result.forEach((mesh,i)=>compare(mesh,reference[i]));
    expect(result.reduce((n,m)=>n+m.indices.length/3,0)).toBe(722);
  }
  if(process.env.HVP_COLLISION_INDEX_RECEIPT)writeFileSync(process.env.HVP_COLLISION_INDEX_RECEIPT,JSON.stringify({
    environment:"Node, shared Cloud CPU",scope:"indexed exact collision preparation for dirty chunks only, no IPC or DOM clock",
    elapsedMs:elapsed,warmup:4,dirty,changedCells:plan.changed.length,transferredCells:compact.fragments.reduce((n,f)=>n+f.cellCount,0),
    exactTriangles:722,perCutSourceReads:0,perCutTaskResumptions:0},null,2)+"\n");
});
