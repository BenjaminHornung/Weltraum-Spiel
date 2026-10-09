import {expect,it,vi} from "vitest";
import {createHvpTerrainRoot,createHvpPrivateTerrainRoot,createHvpTerrainOwner,restoreHvpPrivateTerrainRoot,prepareHvpPrivateTerrainCut} from "../../src/hestia-prototype/terrain/cutPlan";
import {materializeHvpCoastSource,prepareHvpOwnedCoastSource} from "../../src/hvp/hvpCoastSource";
import {createHvpEastRegion} from "../../src/hestia-prototype/runtime/regionSource";
import {prepareHvpTerrainTransfer} from "../../src/hestia-prototype/terrain/terrainTransfer";
import {releaseHvpOwnedSupportPlan,type HvpSupportPlan} from "../../src/hestia-prototype/terrain/supportPlan";
import {createHvpTerrainCompiler,releaseHvpOwnedTerrainProducts,copyHvpOwnedChunkCollisionSteps} from "../../src/hestia-prototype/terrain/terrainProducts";
import {WorkerPool,type WorkerJobTerminal} from "../../src/workers/workerPool";
import {executeHvpChunkJob,executeHvpChunkJobOwned,HVP_CHUNK_JOB} from "../../src/workers/hvpChunkJob";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {workerEpoch} from "../../src/workers/ids";
import {transferListFor} from "../../src/workers/protocol";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import {R,initializeHvpRapier,isHvpStaticCollider} from "../../src/hestia-prototype/physics/rapierPort";
import {collisionSectors,type HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpChunkWorkerPhysicsSession,createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";

it.each([false,true])("loads actual Coast East seams after the authored RockArm transfer with the production kernel (owned=%s)",async owned=>{
  const prepared=prepareHvpOwnedCoastSource(materializeHvpCoastSource());
  const root=createHvpTerrainOwner(createHvpPrivateTerrainRoot(prepared,"real-coast",0));
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);
    const input=structuredClone(bundle,{transfer:transferListFor(bundle)}),pump=owned?createHvpBodyMeshTaskPump(()=>{}):undefined;
    try{
      const output=pump?await executeHvpChunkJobOwned(request,input,pump,createHvpBodyMeshPhaseReserve(grant)):executeHvpChunkJob(request,input);
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
    }finally{pump?.dispose();}
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  let support:HvpSupportPlan|undefined,seams:Awaited<ReturnType<typeof compiler.neighborSeams>>|undefined;
  try{
    await compiler.prepare(()=>true,root);
    const initial=await compiler.initialChunks(root.read(),undefined,16*1024*1024,"real-coast-world");releaseHvpOwnedTerrainProducts(initial);
    const before=root.read(),cut=prepareHvpPrivateTerrainCut(root,{sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
      commandId:"actual-rockarm-cut",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[176,78,76],max:[180,82,80]}});
    expect(cut.changed).toHaveLength(64);support=await compiler.analyze(cut,16*1024*1024);
    expect(support.status).toBe("Ready");expect(support.fragments[0]!.cells).toHaveLength(384);
    const transfer=prepareHvpTerrainTransfer(root,support),products=await compiler.compile(transfer.plan,support,16*1024*1024);
    root.commit(transfer.plan);releaseHvpOwnedTerrainProducts(products);releaseHvpOwnedSupportPlan(support);support=undefined;
    expect(root.read().sourceDigest).toBe("26d5308d");
    const east=createHvpTerrainRoot(await createHvpEastRegion(),"real-coast:east",0);
    seams=await compiler.neighborSeams(root.read(),east.read(),undefined,false,false,16*1024*1024);
    expect(seams.primary.collision.size).toBe(32);expect(seams.east).toHaveLength(256);seams.finish!();seams=undefined;
  }finally{
    seams?.discard?.();if(support){releaseHvpOwnedSupportPlan(support);}await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();
  }
},120_000);

it.each(["base","budget","root","concurrent","no-cache"] as const)("keeps exact Source/cache custody and bounded admission (%s)",async scenario=>{
  const root=createHvpTerrainOwner(restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
    originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
    readSlot:(x,y,z)=>y===10&&z===10&&(x===31||x===32)?1:0},"chunk-cache",0).checkpoint()));
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined),kinds:string[]=[],ids:number[]=[],halos:string[]=[];
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,_grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);kinds.push(request.jobKind);ids.push((request.payload as {chunk:number}).chunk);halos.push((request.payload as {physicalHalo:string}).physicalHalo);
    const input=structuredClone(bundle,{transfer:transferListFor(bundle)}),output=executeHvpChunkJob(request,input);
    return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  try{
    await compiler.prepare(()=>true,root);const source=root.read(),initialCheckpoint=root.checkpoint();
    await expect(compiler.initialChunks({...source},undefined,16*1024*1024,"world-chunks")).rejects.toThrow(/owned|binding/i);
    const initial=await compiler.initialChunks(source,undefined,16*1024*1024,"world-chunks");
    expect(kinds).toHaveLength(256);expect(kinds.every(k=>k===HVP_CHUNK_JOB)).toBe(true);
    expect([...ids].sort((a,b)=>a-b)).toEqual(Array.from({length:256},(_,i)=>i));
    expect(initial.render.size).toBe(16);expect(initial.collision.size).toBe(256);
    expect([...initial.collision.values()].filter(m=>m.indices.length===0).length).toBe(254);
    const collision=[...initial.collision.values()];expect(hvpCollisionDigest(collision)).not.toBe(hvpCollisionDigest(collision.slice(1)));
    const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
    const privateDigest=hvpCollisionDigest(drain(copyHvpOwnedChunkCollisionSteps(initial,()=>{})));
    initial.collision.get(0)!.vertices.fill(777);
    expect(hvpCollisionDigest(drain(copyHvpOwnedChunkCollisionSteps(initial,()=>{})))).toBe(privateDigest);
    expect(compiler.diagnostics().chunkCacheBytes).toBe(0);
    releaseHvpOwnedTerrainProducts(initial);const cached=compiler.diagnostics().chunkCacheBytes;expect(cached).toBeGreaterThan(0);
    expect(()=>drain(copyHvpOwnedChunkCollisionSteps(initial,()=>{}))).toThrow(/owned|expired/i);
    initial.render.get(0)!.positions.fill(777);const before=root.read();
    const cut=prepareHvpPrivateTerrainCut(root,{sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
      commandId:"cache-cut",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[31,10,10],max:[32,11,11]}});
    if(scenario==="budget"){
      let overBudget:Awaited<ReturnType<typeof compiler.compile>>|undefined;
      try{await expect(compiler.compile(cut,undefined,160*1024*1024).then(p=>{overBudget=p;return p;})).rejects.toThrow(/CPU|budget|resident/i);}
      finally{if(overBudget){releaseHvpOwnedTerrainProducts(overBudget);}}
    }
    if(scenario==="root"){await expect(compiler.prepare(()=>true,{read:()=>source})).rejects.toThrow(/root|binding/i);}
    if(scenario==="concurrent"){
      const concurrent=await Promise.allSettled([compiler.compile(cut,undefined,16*1024*1024),compiler.compile(cut,undefined,16*1024*1024)]);
      try{expect(concurrent[0]!.status).toBe("fulfilled");expect(concurrent[1]!.status).toBe("rejected");}
      finally{for(const result of concurrent){if(result.status==="fulfilled"){releaseHvpOwnedTerrainProducts(result.value);}}}
    }
    ids.length=0;const pending=await compiler.compile(cut,undefined,16*1024*1024);
    expect(ids.sort((a,b)=>a-b)).toEqual([0,1]);expect(pending.render.size).toBe(1);expect(pending.collision.size).toBe(2);
    expect([...pending.render.values()].every(m=>m.positions.every(n=>n!==777))).toBe(true);
    releaseHvpOwnedTerrainProducts(pending);expect(compiler.diagnostics().chunkCacheBytes).toBe(cached);
    const committed=await compiler.compile(cut,undefined,16*1024*1024);root.commit(cut);releaseHvpOwnedTerrainProducts(committed);
    expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    if(scenario==="no-cache"){
      await compiler.rolloverAfterLoad(()=>true,false);expect(compiler.diagnostics().chunkCacheBytes).toBe(0);
      const old=root.read(),restored=restoreHvpPrivateTerrainRoot(initialCheckpoint);ids.length=0;
      const products=await compiler.restoreChunks(old,restored,undefined,16*1024*1024,"fresh-restored-world");
      expect(ids.sort((a,b)=>a-b)).toEqual(Array.from({length:256},(_,i)=>i));expect(products.render.size).toBe(16);expect(products.collision.size).toBe(256);
      expect(hvpCollisionDigest(drain(copyHvpOwnedChunkCollisionSteps(products,()=>{})))).toBe(privateDigest);
      root.replace(old,restored);releaseHvpOwnedTerrainProducts(products);expect(compiler.diagnostics().chunkCacheBytes).toBeGreaterThan(0);
    }
    if(scenario==="base"){
      const current=root.read(),restored=restoreHvpPrivateTerrainRoot(initialCheckpoint),retained=compiler.diagnostics().chunkCacheBytes;
      await expect(compiler.restoreChunks(current,{read:()=>restored.read()},undefined,16*1024*1024,"restored-world")).rejects.toThrow(/lineage|owned/i);
      const jobsBefore=ids.length,west={...restored.read(),originMeters:{...restored.read().originMeters,x:-48}};
      await expect(compiler.restoreChunks(current,restored,west,16*1024*1024,"restored-world")).rejects.toThrow(/east|coverage/i);expect(ids.length).toBe(jobsBefore);
      const aborted=await compiler.restoreChunks(current,restored,undefined,16*1024*1024,"restored-world");
      const expiring=copyHvpOwnedChunkCollisionSteps(aborted,()=>{});expiring.next();
      Object.assign(aborted,{source:current});releaseHvpOwnedTerrainProducts(aborted);
      expect(()=>expiring.next()).toThrow(/expired/i);expect(compiler.diagnostics().chunkCacheBytes).toBe(retained);
      ids.length=0;const restore=await compiler.restoreChunks(current,restored,undefined,16*1024*1024,"restored-world");
      expect(ids.sort((a,b)=>a-b)).toEqual([0,1]);expect(restore.render.size).toBe(1);
      expect(hvpCollisionDigest(drain(copyHvpOwnedChunkCollisionSteps(restore,()=>{})))).toBe(privateDigest);
      root.replace(current,restored);releaseHvpOwnedTerrainProducts(restore);
      const restoredSource=root.read(),recut=prepareHvpPrivateTerrainCut(root,{sessionId:restoredSource.sessionId,epoch:restoredSource.epoch,revision:restoredSource.revision,sourceDigest:restoredSource.sourceDigest,
        commandId:"restored-cut",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[32,10,10],max:[33,11,11]}});
      const next=await compiler.compile(recut,undefined,16*1024*1024);root.commit(recut);releaseHvpOwnedTerrainProducts(next);
      expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
      const east=restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:16,y:-8,z:-16},sourceDigest:"87654321",
        readSlot:(x,y,z)=>x===0&&y===10&&z===10?1:0},"chunk-cache-east",0).checkpoint()).read();
      const previous=compiler.diagnostics().chunkCacheBytes;
      const abortSeams=await compiler.neighborSeams(root.read(),east,undefined,false,false,16*1024*1024);
      expect(abortSeams.primary.collision.size).toBe(32);expect(abortSeams.east).toHaveLength(256);expect(abortSeams.primary.render.size).toBe(4);
      abortSeams.discard!();expect(compiler.diagnostics().chunkCacheBytes).toBe(previous);
      const seams=await compiler.neighborSeams(root.read(),east,undefined,false,false,16*1024*1024);seams.finish!();seams.discard!();
      expect(compiler.diagnostics().chunkCacheBytes).toBeGreaterThan(previous);
      const unload=await compiler.neighborSeams(root.read(),undefined,undefined,false,false,16*1024*1024);expect(unload.east).toEqual([]);unload.finish!();
      const geometryBytes=compiler.diagnostics().chunkCacheBytes;
      halos.length=0;const proxy=await compiler.neighborSeams(root.read(),east,undefined,true,true,16*1024*1024);
      expect(proxy.primary.collision.size).toBe(0);expect(proxy.east).toEqual([]);expect(halos.every(h=>h==="closed-exterior")).toBe(true);proxy.finish!();
      expect(compiler.diagnostics().chunkCacheBytes).toBeGreaterThanOrEqual(geometryBytes+8_388_608);
      const budgetSource=root.read(),emptyCut=prepareHvpPrivateTerrainCut(root,{sessionId:budgetSource.sessionId,epoch:budgetSource.epoch,revision:budgetSource.revision,sourceDigest:budgetSource.sourceDigest,
        commandId:"proxy-budget",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[0,1,0],max:[1,2,1]}});
      await expect(compiler.compile(emptyCut,undefined,160*1024*1024-geometryBytes-4*1024*1024)).rejects.toThrow(/CPU|budget|resident/i);
      expect(compiler.diagnostics().pendingChunkBytes).toBe(0);
    }
  }finally{await compiler.dispose();compiler.releaseDisposedSupportResources();accepted.mockRestore();enqueue.mockRestore();start.mockRestore();}
  expect(compiler.diagnostics().chunkCacheBytes).toBe(0);
},120_000);

it("keeps actual capsule, small-drop and rotated-body contacts across production XYZ chunk seams",async()=>{
  const root=createHvpTerrainOwner(restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,
    originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",readSlot:(x,y,z)=>
      (y===95&&x>=16&&x<48&&z>=16&&z<48)||(x===31&&(y===95||y===96)&&z>=8&&z<16)?1:0
  },"chunk-native-contact",0).checkpoint()));
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,_grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);
    const output=executeHvpChunkJob(request,structuredClone(bundle,{transfer:transferListFor(bundle)}));
    return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler();
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined;
  const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
  const contacts=(sectors:readonly HvpCollisionSector[])=>{
    const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
    try{
      const terrain=sectors.filter(mesh=>mesh.indices.length>0).map(mesh=>world.createCollider(R.ColliderDesc.trimesh(mesh.vertices,mesh.indices).setFriction(.8)));
      const rayHeights=()=>{world.updateSceneQueries();return [-.025,.025].flatMap(dx=>[-.025,.025].map(dz=>{
        const ray=new R.Ray({x:-12+dx,y:5,z:-12+dz},{x:0,y:-1,z:0}),hit=world.castRay(ray,2,true,undefined,undefined,undefined,undefined,isHvpStaticCollider);
        expect(hit).not.toBeNull();return 5-hit!.toi;
      }));};
      expect(rayHeights().every(y=>Math.abs(y-4)<.0001)).toBe(true);
      const small=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-12,5,-12).setCcdEnabled(true));
      const smallCollider=world.createCollider(R.ColliderDesc.cuboid(.0625,.0625,.0625).setRestitution(0),small);
      const rotated=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-12,5,-11.3)
        .setRotation({x:0,y:Math.sin(Math.PI/8),z:0,w:Math.cos(Math.PI/8)}).setCcdEnabled(true));
      const rotatedCollider=world.createCollider(R.ColliderDesc.cuboid(.18,.08,.1).setRestitution(0),rotated);
      let smallContact=false,rotatedContact=false,rotatedContactYaw:number|undefined;const smallYs:number[]=[];
      for(let i=0;i<360;i++){
        world.step();smallYs.push(small.translation().y);
        for(const fixed of terrain){world.contactPair(fixed,smallCollider,()=>{smallContact=true;});world.contactPair(fixed,rotatedCollider,()=>{rotatedContact=true;rotatedContactYaw??=rotated.rotation().y;});}
      }
      expect(smallContact).toBe(true);expect(rotatedContact).toBe(true);
      const rest=JSON.stringify({small:{position:small.translation(),velocity:small.linvel(),sleeping:small.isSleeping()},rotated:{position:rotated.translation(),velocity:rotated.linvel(),sleeping:rotated.isSleeping()}});
      expect(small.isSleeping(),rest).toBe(true);expect(rotated.isSleeping(),rest).toBe(true);
      expect(small.translation().y-.0625).toBeCloseTo(4,2);expect(rotated.translation().y-.08).toBeCloseTo(4,2);
      expect(Math.min(...smallYs)).toBeGreaterThan(4.04);expect(Math.abs(rotatedContactYaw!),rest).toBeGreaterThan(.1);
      expect(rayHeights().every(y=>Math.abs(y-4)<.0001)).toBe(true);
      return {smallY:small.translation().y,rotatedY:rotated.translation().y,tolerance:world.integrationParameters.allowedLinearError};
    }finally{world.free();}
  };
  const verticalSeam=(sectors:readonly HvpCollisionSector[])=>{
    const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
    try{
      const terrain=sectors.filter(mesh=>mesh.indices.length>0).map(mesh=>world.createCollider(R.ColliderDesc.trimesh(mesh.vertices,mesh.indices)));
      for(const y of [3.95,4,4.05]){
        const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-13,y,-14.5).setLinvel(2,0,0).setCcdEnabled(true));
        const collider=world.createCollider(R.ColliderDesc.ball(.025).setRestitution(0),body);let contact=false;
        for(let i=0;i<120;i++){world.step();for(const fixed of terrain){world.contactPair(fixed,collider,()=>{contact=true;});}}
        expect(contact).toBe(true);expect(body.translation().x).toBeLessThan(-12.14);expect(body.translation().x).toBeGreaterThan(-12.3);
        world.removeRigidBody(body);
      }
    }finally{world.free();}
  };
  try{
    await compiler.prepare(()=>true,root);products=await compiler.initialChunks(root.read(),undefined,16*1024*1024,"native-contact-world");
    expect([...products.collision].filter(([,mesh])=>mesh.indices.length>0).map(([id])=>id).sort((a,b)=>a-b)).toEqual([16,17,24,48,49]);
    const sectors=drain(copyHvpOwnedChunkCollisionSteps(products,()=>{})),legacy=[...collisionSectors(root.read())];
    await initializeHvpRapier();
    const chunkContacts=contacts(sectors),legacyContacts=contacts(legacy);
    const tolerance=Math.max(chunkContacts.tolerance,legacyContacts.tolerance)+1e-6;
    expect(Math.abs(chunkContacts.smallY-legacyContacts.smallY)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(chunkContacts.rotatedY-legacyContacts.rotatedY)).toBeLessThanOrEqual(tolerance);
    verticalSeam(sectors);verticalSeam(legacy);
    const player={spawn:{x:-12.5,y:4.92,z:-12.5},coverage:[{minX:-14,maxX:-10,minZ:-14,maxZ:-10}]};
    const chunk=await createHvpChunkWorkerPhysicsSession({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256},sectors,{x:-13,y:6,z:-13},9.81,player);
    let control:Awaited<ReturnType<typeof createHvpPhysicsSession>>|undefined;
    try{
      control=await createHvpPhysicsSession(legacy,{x:-13,y:6,z:-13},9.81,player);
      for(const session of [chunk,control]){
        session.play();for(let i=0;i<30;i++){session.advance(1/60);}expect(session.read().player!.grounded).toBe(true);
        session.input({x:1,z:1,sprint:false,jump:false});let crossed=false;
        for(let i=0;i<30;i++){session.advance(1/60);const p=session.read().player!;expect(p.position.y).toBeGreaterThan(4.85);
          if(p.position.x>-11.7&&p.position.z>-11.7){crossed=true;break;}}
        expect(crossed).toBe(true);expect(session.read().player!.grounded).toBe(true);
      }
    }finally{chunk.dispose();control?.dispose();}
    expect(chunk.read()).toMatchObject({bodyCount:0,colliderCount:0});expect(control!.read()).toMatchObject({bodyCount:0,colliderCount:0});
  }finally{if(products){releaseHvpOwnedTerrainProducts(products);}await compiler.dispose();compiler.releaseDisposedSupportResources();accepted.mockRestore();enqueue.mockRestore();start.mockRestore();}
  expect(compiler.diagnostics().chunkCacheBytes).toBe(0);
},120_000);
