import {expect,it,vi} from "vitest";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {hvpBodyProjectionBinding} from "../../src/hestia-prototype/physics/physicsProtocol";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsRequest} from "../../src/hestia-prototype/physics/physicsWorker";
import {buildHvpBodyMeshInput,executeHvpBodyMeshJob,HVP_BODY_MESH_JOB,HVP_BODY_MESH_MAX_OUTPUT} from "../../src/workers/hvpBodyMeshJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {fnv1aBytes} from "../../src/workers/protocol";

// Reuse the original owner/clock fixture geometry. This unit harness controls timer advancement;
// all plan/mesh yields and both structured-clone transfers are real. It is not browser timing proof.
const floor={sizeX:64,sizeY:8,sizeZ:64,cellMeters:.125,originMeters:{x:-4,y:-.125,z:-4},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]};
const aim=(target:Readonly<{x:number;y:number;z:number}>,position:Readonly<{x:number;y:number;z:number}>)=>{
  const delta={x:target.x-position.x,y:target.y-position.y-.75,z:target.z-position.z},length=Math.hypot(delta.x,delta.y,delta.z);
  return {x:delta.x/length,y:delta.y/length,z:delta.z/length};
};
const host={assertCurrent:()=>{},yieldTask:()=>new Promise<void>(resolve=>setTimeout(resolve,0))};
it.each([false,true])("native mesh RPC transfers exclusively and keeps a malformed first packet terminal (%s)",async malformed=>{
  const owner=globalThis as typeof globalThis&{onmessage?:(event:MessageEvent<HvpPhysicsMessage>)=>Promise<void>;
    postMessage?:(reply:HvpPhysicsReply,transfers?:Transferable[])=>void};
  const descriptors={onmessage:Object.getOwnPropertyDescriptor(owner,"onmessage"),postMessage:Object.getOwnPropertyDescriptor(owner,"postMessage")};
  const savedInterval=globalThis.setInterval,savedClear=globalThis.clearInterval;
  const replies=new Map<number,HvpPhysicsReply>();let id=0,initialized=false,firstError:unknown;
  const send=async(message:HvpPhysicsRequest,transfers:Transferable[]=[]):Promise<HvpPhysicsReply>=>{
    const packet={...message,id:++id,protocol:"hvp-physics-owner-v3" as const,incarnation:"mesh-worker-test"};
    await owner.onmessage!({data:structuredClone(packet,{transfer:transfers})} as MessageEvent<HvpPhysicsMessage>);
    const reply=replies.get(packet.id);if(!reply){throw new Error("Missing native RPC reply");}
    if(reply.error){throw new Error(reply.error);}return reply;
  };
  try{
    vi.resetModules();
    globalThis.setInterval=(()=>1 as unknown as ReturnType<typeof setInterval>) as typeof setInterval;
    globalThis.clearInterval=(()=>{}) as typeof clearInterval;
    owner.postMessage=(reply,transfers=[])=>{
      const buffers=reply.bodyMeshAdmission?.output.buffers;
      if(buffers){expect(transfers).toEqual(buffers);}
      replies.set(reply.id,structuredClone(reply,{transfer:transfers}));
      if(buffers){expect(buffers.every(buffer=>buffer.byteLength===0)).toBe(true);}
    };
    await import("../../src/hestia-prototype/physics/physicsWorker");
    await send({kind:"Initialize",sectors:[...collisionSectors(floor)],spawn:{x:-2,y:3,z:-2},gravity:9.81,player,
      inertiaSpawn:{x:2,y:2,z:2},branchSpawn:{x:0,y:0,z:0},sessionId:"mesh-worker-test"});initialized=true;
    await send({kind:"Play"});const start=(await send({kind:"Read"})).snapshot!;
    const release=await send({kind:"PrepareBranch",request:{id:"release",generation:0,sourceDigest:start.structural!.sourceDigest,
      direction:aim({x:.75,y:1.25,z:0},start.player!.position)}});expect(release.rejected).toBeUndefined();
    await send({kind:"CommitBranch",transactionId:"release"});await send({kind:"FinalizeBranch",transactionId:"release"});
    const before=(await send({kind:"Read"})).snapshot!,parent=before.structural!.parts.find(part=>!part.anchored)!;
    const direction=aim(parent.position,before.player!.position),hit=(await send({kind:"Read",cutAim:direction})).snapshot!.moving.preview!;
    const begun=await send({kind:"BeginBodyCut",request:{id:"recut",ownerId:hit.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction}});
    const binding=hvpBodyProjectionBinding(begun.bodyPreparation!,begun.id);
    const projected=await send({kind:"PrepareBodyChildProjection",binding}),projection=projected.bodyChildProjection!.projection;
    const packed=buildHvpBodyMeshInput(projection),request={jobId:workerJobId("owner-mesh-rpc"),jobKind:workerJobKind(HVP_BODY_MESH_JOB),
      targetKey:workerTargetKey(packed.payload.ownerId),planningEpoch:planningEpoch(0),workerEpoch:workerEpoch(0),
      inputRevision:contentRevision(packed.payload.revision),sourceInputDigest:packed.sourceInputDigest,algorithmVersion:algorithmVersion(1),
      priority:"Urgent" as const,deadline:jobDeadline(1),estimatedInputBytes:packed.input.byteLength,
      estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
    const output=(await executeHvpBodyMeshJob(request,packed.input,host)).bundle,retryPacket=structuredClone(output);
    const first=await send({kind:"AdmitBodyChildMesh",binding,request,output:malformed?{...output,byteLength:byteCount(output.byteLength-1)}:output},[...output.buffers]);
    expect(output.buffers.every(buffer=>buffer.byteLength===0)).toBe(true);
    expect(first.snapshot).toBeUndefined();expect(first.restoreState).toBeUndefined();
    if(malformed){
      expect(first.rejected).toBe("Declared bundle byte length does not match buffers.");
      const retry=await send({kind:"AdmitBodyChildMesh",binding,request,output:retryPacket},[...retryPacket.buffers]);
      expect(retry.rejected).toBe(first.rejected);expect(retry.bodyMeshAdmission).toBeUndefined();
      const stage=await send({kind:"StageBodyCut",transactionId:"recut",products:projection});
      expect(stage.rejected).toBe(first.rejected);expect(stage.snapshot).toMatchObject({status:"Running",bodyCount:before.bodyCount,moving:{state:"Preparing"}});
      await send({kind:"RollbackBodyCut",transactionId:"recut"});
    }else{
      expect(first.rejected).toBeUndefined();expect(first.bodyMeshAdmission?.beginRequestId).toBe(binding.beginRequestId);
      const returned=first.bodyMeshAdmission!.output;
      expect(returned.buffers.map(buffer=>buffer.byteLength)).toEqual(retryPacket.buffers.map(buffer=>buffer.byteLength));
      expect(returned.byteLength).toBe(retryPacket.byteLength);expect(fnv1aBytes(returned.buffers)).toBe(fnv1aBytes(retryPacket.buffers));
      const stage=await send({kind:"StageBodyCut",transactionId:"recut",products:projection});
      expect(stage.rejected).toBeUndefined();expect(stage.snapshot!.moving.state).toBe("PreparedHeld");
      await send({kind:"CommitBodyCut",transactionId:"recut"});
      const applied=await send({kind:"FinalizeBodyCut",transactionId:"recut"});expect(applied.snapshot!.moving.last?.status).toBe("Applied");
    }
  }catch(error){firstError=error;throw error;}
  finally{
    let cleanupError:unknown;
    try{if(initialized){const disposed=await send({kind:"Dispose"});expect(disposed.snapshot).toMatchObject({status:"Disposed",bodyCount:0,colliderCount:0});expect(disposed.clock!.timers).toBe(0);}}
    catch(error){cleanupError=error;}
    finally{
      globalThis.setInterval=savedInterval;globalThis.clearInterval=savedClear;
      for(const key of ["onmessage","postMessage"] as const){const descriptor=descriptors[key];if(descriptor){Object.defineProperty(owner,key,descriptor);}else{Reflect.deleteProperty(owner,key);}}
      vi.resetModules();
    }
    if(firstError===undefined&&cleanupError!==undefined){throw cleanupError;}
  }
},120_000);
