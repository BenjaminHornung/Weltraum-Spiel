import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpBodyCutSession,type HvpMovingCutPreparation} from "../../src/hestia-prototype/physics/bodyCutSession";
import {createHvpBranchSession} from "../../src/hestia-prototype/physics/branchSession";
import type {HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
import {meshHvpBranchProducts,meshHvpBranchFoliage} from "../../src/hestia-prototype/presentation/structuralPart";
import {Vector3,Quaternion} from "three";
import {representationKey} from "../../src/presentation";
import {executeHvpBodyCutJob,decodeHvpBodyCutOutput,hvpBodyCutInputDigest,HVP_BODY_CUT_JOB,HVP_BODY_CUT_MAX_OUTPUT} from "../../src/workers/hvpBodyCutJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey,type TransferableBufferBundle} from "../../src/workers";
beforeAll(initializeHvpRapier);
const products=(preparation:HvpMovingCutPreparation)=>{
  const p=preparation.payload,raw=new Int32Array(preparation.cells.flatMap(c=>[c.x,c.y,c.z,c.materialId])),buffers=[raw.buffer];
  const input:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(p.revision),buffers,byteLength:byteCount(raw.byteLength),
    views:[{name:"cells",kind:"Int32Array",bufferIndex:0,byteOffset:0,elementCount:raw.length}]};
  const job={jobId:workerJobId("body-unit"),jobKind:workerJobKind(HVP_BODY_CUT_JOB),targetKey:workerTargetKey(p.ownerId),planningEpoch:planningEpoch(0),
    workerEpoch:workerEpoch(0),inputRevision:contentRevision(p.revision),sourceInputDigest:hvpBodyCutInputDigest(p,buffers),algorithmVersion:algorithmVersion(1),
    priority:"Urgent" as const,deadline:jobDeadline(1),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_CUT_MAX_OUTPUT),payload:p};
  return decodeHvpBodyCutOutput(executeHvpBodyCutJob(job,input).bundle,p);
};
const fixture=()=>{
  const world=new R.World({x:0,y:0,z:0}),source=ingestHvpStructuralCells("moving-source",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]),recipe=prepareHvpRigidBody(source),body=installHvpRigidBody(world,recipe);
  const target={ownerId:"moving-parent",body,recipe},targets=new Map([[target.ownerId,target]]),bodies=new Map([[target.ownerId,body]]);
  const session=createHvpBodyCutSession(world,targets,bodies,"session-test");
  const request={id:"moving-cut",ownerId:target.ownerId,sourceDigest:source.contentHash,edge:1,direction:{x:0,y:0,z:1}};
  return {world,body,targets,bodies,session,request,eye:{x:.3125,y:.0625,z:-1}};
};
it("keeps the real parent moving during local work and adopts worker products at the current pose",()=>{
  const f=fixture();try{
    const prep=f.session.begin(f.request,f.eye,0);
    expect(f.session.holdsWorld).toBe(false);expect(f.session.read().state).toBe("Preparing");
    f.body.setLinvel({x:1,y:.2,z:.1},true);f.body.setAngvel({x:.2,y:.3,z:.4},true);
    for(let i=0;i<12;i+=1){f.world.step();}
    const now={...f.body.translation()},built=products(prep);f.session.stage(f.request.id,built,12);
    expect(f.session.holdsWorld).toBe(true);expect(f.session.read().last!.parentPose.position).toEqual(now);
    expect(f.session.read().last!.issuedTick).toBe(0);expect(f.session.read().last!.commitTick).toBe(12);
    expect(now.x).toBeGreaterThan(.4);
    f.session.commit(f.request.id);expect(f.targets.has("moving-parent")).toBe(false);
    expect(f.world.bodies.len()).toBe(3); // Disabled parent is retained until GPU publication.
    f.session.finalize(f.request.id);expect(f.world.bodies.len()).toBe(2);expect(f.targets.size).toBe(2);expect(f.bodies.size).toBe(2);
    expect(f.session.read().last!.status).toBe("Applied");expect(f.session.holdsWorld).toBe(false);
    expect(()=>f.session.begin(f.request,f.eye,13)).toThrow(/Stale|missing/);
  }finally{f.world.free();}
});
it("rejects foreign local output before native mutation and rolls staged membership back exactly",()=>{
  const f=fixture();try{
    const prep=f.session.begin(f.request,f.eye,0),built=products(prep),position={...f.body.translation()};
    expect(()=>f.session.stage(f.request.id,{...built,removedMassKg:built.removedMassKg+1},1)).toThrow(/Foreign/);
    expect(f.world.bodies.len()).toBe(1);f.session.stage(f.request.id,built,1);f.session.commit(f.request.id);f.session.rollback(f.request.id);
    expect(f.world.bodies.len()).toBe(1);expect(f.targets.get("moving-parent")!.body).toBe(f.body);
    expect(f.body.translation()).toEqual(position);expect(f.session.read()).toMatchObject({state:"Idle",sequence:0});
  }finally{f.world.free();}
});
it.each([1,4])("recuts released timber and resolves its real foliage support without stale owners (edge %i)",edge=>{
  const world=new R.World({x:0,y:0,z:0}),targets=new Map<string,HvpCuttableBody>(),bodies=new Map<string,R.RigidBody>();
  try{
    const branch=createHvpBranchSession(world,{x:0,y:0,z:0},targets,bodies),initial=branch.read();
    branch.prepare({id:"release",generation:0,sourceDigest:initial.sourceDigest,direction:{x:0,y:0,z:1}},{x:.75,y:1.25,z:-1});
    branch.commit("release");branch.finalize("release");
    expect(targets.size).toBe(1);expect(bodies.size).toBe(1);
    const old=branch.read(),target=[...targets.values()][0]!,session=createHvpBodyCutSession(world,targets,bodies,"wood-recut");
    const oldLeaves=meshHvpBranchFoliage(target.ownerId,target.recipe.mass.centerOfMassMeters!,target.recipe.source.contentHash,"old-leaves").mesh;
    const worldPoint=(mesh:typeof oldLeaves,i:number,body:R.RigidBody)=>new Vector3().fromArray(mesh.positions,i)
      .applyQuaternion(new Quaternion(body.rotation().x,body.rotation().y,body.rotation().z,body.rotation().w)).add(body.translation());
    const oldPoints=Array.from({length:oldLeaves.positions.length/3},(_,i)=>worldPoint(oldLeaves,i*3,target.body));
    expect(old.attachment.ownerId).toBe(target.ownerId);
    const eye=edge===1?{x:1.0625,y:1.0625,z:-1}:{x:1.3125,y:1.3125,z:-1};
    const request={id:"recut",ownerId:target.ownerId,sourceDigest:target.recipe.source.contentHash,edge,direction:{x:0,y:0,z:1}};
    const prep=session.begin(request,eye,0),built=products(prep);
    for(const part of built.parts){expect(()=>representationKey(part.ownerId)).not.toThrow();}
    session.stage(request.id,built,1);session.commit(request.id);
    const published=branch.read(true);
    expect(published.parts.some(p=>p.ownerId===target.ownerId)).toBe(false);
    expect(published.parts.filter(p=>!p.anchored)).toHaveLength(built.parts.length);
    expect(published.parts.reduce((n,p)=>n+p.cells!.length,0)+built.removedCells).toBe(320);
    expect(published.attachment.ownerId).toBe(edge===1?built.parts[0]!.ownerId:null);
    const decorations=meshHvpBranchProducts(published).filter(p=>p.decoration);
    expect(decorations).toHaveLength(edge===1?1:0);
    if(edge===1){
      const leaf=decorations[0]!,owner=targets.get(leaf.ownerId)!;
      expect(owner.family).toBe("branch");expect(leaf.mesh.positions.length).toBe(oldLeaves.positions.length);
      for(let i=0;i<leaf.mesh.positions.length;i+=3){
        expect(worldPoint(leaf.mesh,i,owner.body).distanceTo(oldPoints[i/3]!)).toBeLessThan(1e-6);
        for(const [a,key] of (["x","y","z"] as const).entries()){
          expect(leaf.mesh.positions[i+a]).toBeGreaterThanOrEqual(leaf.mesh.boundsMeters.min[key]);
          expect(leaf.mesh.positions[i+a]).toBeLessThanOrEqual(leaf.mesh.boundsMeters.max[key]);
        }
      }
    }
    session.rollback(request.id);
    expect(branch.read().attachment).toEqual(old.attachment);expect(world.bodies.len()).toBe(2);
    const retry={...request,id:"recut-final"};const rebuilt=products(session.begin(retry,eye,2));
    for(const part of rebuilt.parts){expect(()=>representationKey(part.ownerId)).not.toThrow();}
    session.stage(retry.id,rebuilt,3);session.commit(retry.id);session.finalize(retry.id);
    expect(()=>branch.read()).not.toThrow();expect(world.getRigidBody(target.body.handle)).toBeNull();
    expect(branch.read().parts).toHaveLength(2);
  }finally{world.free();}
},120_000);
