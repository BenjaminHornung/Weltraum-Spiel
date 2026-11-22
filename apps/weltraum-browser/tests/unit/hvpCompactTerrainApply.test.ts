import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {bindHvpPhysicsOwner,type HvpPhysicsOwnerPort,type HvpWorkerMessage,type HvpWorkerReply} from "../../src/hestia-prototype/physics/physicsWorkerHost";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";
import type {HvpCutSpan} from "../../src/hestia-prototype/runtime/cutTrace";
vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};

it.each(["ack","before-install","lost-before-witness","lost-after-base","lost-ack","lost-live","stale-root","forged-reply","delayed-ack","duplicates","busy-read"] as const)("applies compact publication with a real R05 owner: %s",async fault=>{
  const commands:{kind:string;incarnation:string}[]=[],replies:string[]=[],spans:HvpCutSpan[]=[];
  const root=rootFor(uFixture()),cut=cutAt(root,[12,2,4]),competing=cutAt(root,[24,6,4]);
  let nativeTick:()=>void=()=>{},simTime=100,closedRollbackPorts=0,duplicate:((corrupt:boolean)=>Promise<HvpWorkerReply>)|undefined;
  const clocktime=vi.spyOn(performance,"now").mockImplementation(()=>simTime);
  const clock=vi.spyOn(globalThis,"setInterval").mockImplementation(callback=>{nativeTick=callback as ()=>void;return 1 as unknown as ReturnType<typeof setInterval>;});
  const realTimeout=globalThis.setTimeout.bind(globalThis);
  let softDeadline:(()=>void)|undefined,wantDeadline=false;
  const deadlines=vi.spyOn(globalThis,"setTimeout").mockImplementation(((handler:(...args:unknown[])=>void,delay?:number,...args:unknown[])=>{
    const t=realTimeout(handler,delay,...args);
    if(wantDeadline&&delay===20000){wantDeadline=false;softDeadline=()=>{clearTimeout(t);handler(...args);};}
    return t;
  }) as typeof setTimeout);
  let release!:()=>void,sawAck!:()=>void;const heldAck=new Promise<void>(r=>{sawAck=r;});
  let busyId:number|undefined,releaseBusy:(()=>void)|undefined;
  let duplicateResponse:((value:HvpWorkerReply)=>void)|undefined;
  let faulted=false,late:undefined|(()=>void),baseTick:number|undefined;
  const close:Promise<void>[]=[];
  let original:Omit<Extract<HvpWorkerMessage,{kind:"ApplyCompactTerrain"}>,"rollbackPort">|undefined;
  class Transport{
    onmessage:((e:MessageEvent<HvpWorkerReply>)=>void)|null=null;
    onerror:((e:ErrorEvent)=>void)|null=null;onmessageerror=null;
    private owner:HvpPhysicsOwnerPort={postMessage:value=>{
      const reply=structuredClone(value),handler=this.onmessage;
      if(reply.id===busyId&&fault==="busy-read"&&!releaseBusy){
        releaseBusy=()=>handler?.({data:reply} as MessageEvent<HvpWorkerReply>);return;
      }
      if(reply.id>=20_000){duplicateResponse?.(reply);return;}
      if(reply.terrainPlan && reply.snapshot){
        if(fault==="stale-root")root.commit(competing);
        if((fault==="delayed-ack"||fault==="lost-live")&&!faulted){
          faulted=true;baseTick=reply.snapshot.ticks;sawAck();release=()=>handler?.({data:reply} as MessageEvent<HvpWorkerReply>);return;
        }
        replies.push("ApplyCompactTerrain");
        if(fault==="lost-ack"&&!faulted){faulted=true;baseTick=reply.terrainMotion!.tick.ticks;
          expect(reply.terrainMotion!.running).toBe(true);
          late=()=>handler?.({data:reply} as MessageEvent<HvpWorkerReply>);
          this.onerror?.({message:"cut worker lost after native commit"} as ErrorEvent);return;
        }
        if(fault==="forged-reply")Object.assign(reply.terrainPlan.sourceViews[0]!,{sourceDigest:"hvp-material-cells-v1:aaaaaaaaaaaaaaaa"});
        if(baseTick!==undefined)expect(reply.terrainMotion!.tick.ticks).toBe(baseTick);
      }
      this.onmessage?.({data:reply} as MessageEvent<HvpWorkerReply>);
      if(reply.terrainPlan)this.onmessage?.({data:reply} as MessageEvent<HvpWorkerReply>);
    }};
    private terminateOwner=bindHvpPhysicsOwner(this.owner);
    postMessage(value:HvpWorkerMessage,transfers:Transferable[]=[]){
      const msg=structuredClone(value,{transfer:transfers});commands.push({kind:msg.kind,incarnation:msg.incarnation});
      if(msg.kind==="Read"&&fault==="busy-read"&&busyId===undefined)busyId=msg.id;
      if(msg.kind==="ApplyCompactTerrain"&&(fault==="duplicates"||fault==="lost-ack")){
        const {rollbackPort:ignored,...saved}=msg;original=saved;
      }
      if(original&&(msg.kind==="ApplyCompactTerrain"||msg.kind==="RecoverTerrain")){
        const saved=original;
        duplicate=async corrupt=>{
          const mailbox=new MessageChannel(),copy=structuredClone(saved);
          if(corrupt)copy.replacements[0]!.mesh.vertices[0]!+=1;
          try{
            const result=new Promise<HvpWorkerReply>(r=>{duplicateResponse=r;});
            await this.owner.onmessage!({data:{...copy,incarnation:msg.incarnation,id:corrupt?20002:20001,rollbackPort:mailbox.port2}} as MessageEvent<HvpWorkerMessage>);
            return await result;
          }finally{mailbox.port1.close();}
        };
      }
      if(msg.kind==="ApplyCompactTerrain"){
        if(fault==="lost-after-base"&&!faulted){
          const write=msg.rollbackPort.postMessage.bind(msg.rollbackPort);
          msg.rollbackPort.postMessage=(data:unknown)=>{
            write(data);
            if((data as {kind:string}).kind==="Base"){
              faulted=true;msg.rollbackPort.close();this.onerror?.({message:"crash after sealing base"} as ErrorEvent);throw new Error("Lost before L");
            }
          };
        }
        const closePort=msg.rollbackPort.close.bind(msg.rollbackPort);
        let closed=false;msg.rollbackPort.close=()=>{if(!closed){closedRollbackPorts++;closed=true;}closePort();};
        if(fault==="lost-before-witness"){
          msg.rollbackPort.close();
          this.onerror?.({message:"lost owner before any base motion was sealed"} as ErrorEvent);return;
        }
      }
      if(msg.kind==="Initialize")Object.assign(msg,{sectors:[...collisionSectors(floor)],
        player:{spawn:{x:.1,y:2,z:.1},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]}});
      if(fault==="before-install"&&msg.kind==="ApplyCompactTerrain")Object.assign(msg.fragments[0]!,{massKg:-1});
      queueMicrotask(()=>void this.owner.onmessage!({data:msg} as MessageEvent<HvpWorkerMessage>));
    }
    terminate(){close.push(this.terminateOwner());}
  }
  vi.stubGlobal("Worker",Transport);
  const index=createTerrainComponentIndex(cut.before);
  const client=await createHvpPhysicsClient([],{x:2,y:3,z:2},new AbortController().signal);
  try{
    const f=index.prepareCompact(cut).fragments[0]!,compact={generation:1,cellCount:f.cellCount,parts:f.parts};
    const fRequest={ownerId:f.ownerId,cells:materializeCompactCells(compact),compactSource:compact,massKg:f.massKg,colliderBoxes:f.colliderBoxes,origin:HVP_SOURCE_MIN_METERS};
    const binding={sessionId:cut.after.sessionId,epoch:cut.after.epoch,baseRevision:0,commandId:"one",baseDigest:cut.before.sourceDigest,targetDigest:cut.after.sourceDigest};
    const edits=[{index:0,mesh:[...collisionSectors(floor)][0]!}];
    const credit={copyBytes:16*1024*1024,nativeBytes:48*1024*1024,trace:(s:HvpCutSpan)=>spans.push(s)};
    if(fault==="ack"){
      for(const mutate of [(c:typeof fRequest.cells[number])=>({...c,x:c.x+8}),(c:typeof fRequest.cells[number])=>({...c,materialId:c.materialId===1?2:1})]){
        const cells=[...fRequest.cells];cells[0]=mutate(cells[0]!);
        await expect(client.applyCompactTerrain!(binding,edits,[{...fRequest,cells}],credit,()=>{})).rejects.toThrow(/membership/);
      }
      const large=[{index:0,mesh:{vertices:new Float32Array(90_000),indices:new Uint32Array()}}];
      expect(await client.applyCompactTerrain!(binding,large,[fRequest],credit,()=>{throw new Error("Unexpected publication");})).toBe(false);
      expect(commands.map(c=>c.kind)).toEqual(["Initialize"]);
    }
    if(fault==="lost-ack"||fault==="lost-live"||fault==="delayed-ack"||fault==="lost-after-base"){
      await client.command("Pause");await client.command("Play");
      expect(client.read().status).toBe("Running");commands.length=0;
    }
    if(fault==="busy-read"){client.update();await new Promise(r=>setTimeout(r,0));}
    wantDeadline=fault==="lost-live";
    let published=0;
    const run=client.applyCompactTerrain!(binding,edits,[fRequest],credit,views=>{
      expect(client.read().terrainGeneration).toBe(0);
      expect(views[0]).toMatchObject({ownerId:f.ownerId,colliders:f.colliderBoxes.length,cellCount:f.cellCount});
      root.commit(cut);
      published++;
    });
    if(fault==="delayed-ack"||fault==="lost-live"){
      await heldAck;
      for(let i=0;i<8;i++){simTime+=17;nativeTick();}
      expect(root.read()).toBe(cut.before);expect(client.read().terrainGeneration).toBe(0);
      await expect(client.checkpoint()).rejects.toThrow(/idle/);if(fault==="lost-live")softDeadline!();else release();
    }
    if(!["before-install","lost-before-witness","stale-root"].includes(fault)){
      expect(await run).toBe(true);late?.();
      expect(published).toBe(1);expect(root.read()).toBe(cut.after);expect(client.read().terrainGeneration).toBe(1);
      expect(client.read().terrainFragments.map(f=>f.ownerId)).toEqual([f.ownerId]);
      expect(client.lifecycle!().terrainRecovery).toMatchObject({entries:1,fragments:1,held:0});
      if(fault==="busy-read"){
        expect(commands.map(c=>c.kind)).toEqual(["Initialize","Read","ApplyCompactTerrain"]);
        client.update();client.update();releaseBusy!();
        await new Promise(r=>setTimeout(r,0));
        expect(spans.filter(s=>s.phase==="cutActivationDispatch")).toHaveLength(1);
        expect(spans.filter(s=>s.phase==="cutActivationReply")).toHaveLength(1);
      }
      const kinds=commands.filter(c=>c.kind!=="Initialize").map(c=>c.kind);
      expect(kinds.at(-1)).toBe("Read");
      expect(kinds.slice(0,-1)).toEqual(fault==="lost-ack"?["ApplyCompactTerrain","RecoverTerrain"]:fault==="lost-after-base"?["ApplyCompactTerrain","RecoverTerrain","ApplyCompactTerrain"]:
        (fault==="forged-reply"||fault==="lost-live")?["ApplyCompactTerrain","InspectCompactPublication"]:fault==="busy-read"?["Read","ApplyCompactTerrain"]:["ApplyCompactTerrain"]);
      if(fault==="duplicates"||fault==="lost-ack"){
        const again=await duplicate!(false);expect(again.rejected).toBeUndefined();
        expect(again.snapshot?.terrainFragments).toHaveLength(1);expect(again.terrainMotion?.revision).toBe(1);
        expect((await duplicate!(true)).rejected).toMatch(/conflict/);
      }
      if(fault==="delayed-ack"||fault==="lost-ack"||fault==="lost-live"){
        expect(client.read().ticks).toBe(baseTick);
        await new Promise(r=>setTimeout(r,0));
        const start=client.read().player!.position;
        client.setPlayerInput({x:1,z:0,sprint:false,jump:false});client.update();
        await new Promise(r=>setTimeout(r,0));
        for(let i=0;i<3;i++){simTime+=17;nativeTick();}
        client.update();await new Promise(r=>setTimeout(r,0));
        expect(client.read().ticks).toBeGreaterThan(baseTick!);
        expect(client.read().player!.position.x).toBeGreaterThan(start.x);
        expect(client.clock?.compactActivation?.firstStepTick).toBeGreaterThan(baseTick!);
        if(fault==="lost-ack"){
          const replay=await duplicate!(false);
          expect(replay.snapshot?.ticks).toBe(baseTick);
          expect(replay.compactObservedTick).toBe(client.read().ticks);
        }
        if(fault==="delayed-ack"){
          const a=client.clock!.compactActivation!;
          expect(a).toMatchObject({skippedTimerCallbacks:8,holdMs:136,releaseCommandKind:"Read"});
          expect(a.releasedEpochMs-a.publishedEpochMs).toBe(136);
          expect(a.firstStepEpochMs!).toBeGreaterThan(a.releasedEpochMs);
        }
      }
    }else if(fault==="lost-before-witness"){
      await expect(run).rejects.toThrow(/RecoveryHold/);
      expect(published).toBe(0);expect(()=>client.read()).toThrow(/RecoveryHold/);
      expect(commands.map(c=>c.kind)).toEqual(["Initialize","ApplyCompactTerrain"]);
    }else if(fault==="stale-root"){
      await expect(run).rejects.toThrow(/RecoveryHold/);
      expect(published).toBe(0);expect(root.read()).toBe(competing.after);
      expect(()=>client.read()).toThrow(/sealed compact publication/);
      const saved=client.compactForwardRecovery!()!;
      expect(saved.motion.revision).toBe(1);expect(saved.journal.at(-1)?.binding.targetDigest).toBe(cut.after.sourceDigest);
      const restored=await import("../../src/hestia-prototype/physics/session").then(m=>m.restoreHvpTerrainWorker(saved,"public",false));
      try{expect(restored.read().terrainFragments.map(f=>f.ownerId)).toEqual([f.ownerId]);}finally{restored.dispose();}
    }else{
      await expect(run).rejects.toThrow();
      expect(published).toBe(0);expect(client.read().terrainGeneration).toBe(0);
      expect(client.read().terrainFragments).toHaveLength(0);expect(commands.some(c=>c.kind==="RecoverTerrain")).toBe(false);
    }
    await Promise.resolve();
    expect(closedRollbackPorts).toBe(commands.filter(c=>c.kind==="ApplyCompactTerrain").length);
    expect(client.lifecycle!().pendingJobs).toBe(0);
  }finally{
    try{if(fault==="lost-before-witness"||fault==="stale-root")await expect(client.dispose()).rejects.toThrow(/RecoveryHold/);else await client.dispose();}
    finally{await Promise.all(close);index.dispose();vi.unstubAllGlobals();clock.mockRestore();clocktime.mockRestore();deadlines.mockRestore();}
  }
},60000);

it("closes the transferred rollback port on an invalid protocol envelope before admission",async()=>{
  const replies:HvpWorkerReply[]=[],host:HvpPhysicsOwnerPort={postMessage:value=>replies.push(value)};
  const close=bindHvpPhysicsOwner(host),channel=new MessageChannel();
  const received=structuredClone(channel.port2,{transfer:[channel.port2]});
  const closed=vi.spyOn(received,"close");
  try{
    await host.onmessage!({data:{protocol:"wrong",id:1,incarnation:"invalid",kind:"ApplyCompactTerrain",rollbackPort:received}} as unknown as MessageEvent<HvpWorkerMessage>);
    expect(replies[0]?.rejected).toBeTruthy();
    expect(closed).toHaveBeenCalledOnce();
  }finally{channel.port1.close();await close();}
});
