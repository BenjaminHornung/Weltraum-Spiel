import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {installHvpRigidBody,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut} from "../../src/hestia-prototype/physics/bodyCut";

beforeAll(initializeHvpRapier);
const material=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null}];
const make=(world:R.World,cells=[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:2,y:0,z:0,materialId:1}])=>{
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("moving-source",cells,material));
  const body=installHvpRigidBody(world,recipe,{translationMeters:{x:1,y:2,z:3},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
  return {ownerId:"moving-parent",body,recipe};
};
it("cuts a sleeping fallen body with the same cell-centred spherical footprint as terrain",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const cells=Array.from({length:343},(_,i)=>({x:i%7,y:Math.floor(i/7)%7,z:Math.floor(i/49),materialId:1}));
    const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("sphere-body",cells,material));
    const body=installHvpRigidBody(world,recipe);body.sleep();
    const target={ownerId:"sphere-body",body,recipe};
    const hit=captureHvpBodyHit(world,new Map([[target.ownerId,target]]),{x:.4375,y:.4375,z:-1},{x:0,y:0,z:1},0)!;
    expect(hit.cell).toEqual([3,3,0]);expect(body.isSleeping()).toBe(true);
    const plan=prepareHvpBodyCut(hit,target,"sphere-cut",4,"Sphere");
    const removed=cells.filter(c=>(c.x-3)**2+(c.y-3)**2+c.z**2<=4);
    expect(plan.local.plan.removedCells).toBe(removed.length);
    const survivors=plan.local.plan.parts.flatMap(p=>p.cells.map(c=>`${c.x}:${c.y}:${c.z}`)).sort();
    expect(survivors).toEqual(cells.filter(c=>!removed.includes(c)).map(c=>`${c.x}:${c.y}:${c.z}`).sort());
    const staged=stageHvpBodyCut(world,target,plan);staged.commit();staged.finalize();
    expect(world.getRigidBody(body.handle)).toBeNull();
    expect(staged.result.parts.reduce((n,p)=>n+p.body.mass(),0)+staged.removedMomentum.massKg).toBeCloseTo(343,5);
  }finally{world.free();}
},120_000);
it("binds a rotated native first hit to a local cell, and rejects occlusion or out-of-range rays",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},7);
    expect(hit?.cell).toEqual([1,0,0]);expect(hit?.issuedTick).toBe(7);expect(hit?.ownerId).toBe(target.ownerId);
    expect(captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:-2},{x:0,y:0,z:1},8)).toBeNull();
    world.createCollider(R.ColliderDesc.cuboid(.5,.5,.05).setTranslation(1,2.1875,2.5));
    expect(captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},9)).toBeNull();
  }finally{world.free();}
});
it("uses current parent pose and motion after local work, not its issued-hit pose",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},0)!;
    const plan=prepareHvpBodyCut(hit,target,"recut-1",1);
    target.body.setLinvel({x:1,y:2,z:3},true);target.body.setAngvel({x:0,y:0,z:2},true);
    for(let i=0;i<12;i+=1){world.step();}
    const pose={...target.body.translation()},rotation={...target.body.rotation()},v={...target.body.linvel()},w={...target.body.angvel()};
    const stage=stageHvpBodyCut(world,target,plan);
    expect(stage.parentPose.position).toEqual(pose);expect(stage.parentPose.rotation).toEqual(rotation);
    expect(stage.parentPose.velocity).toEqual(v);expect(stage.parentPose.angularVelocity).toEqual(w);
    expect(stage.result.parts).toHaveLength(2);
    for(const part of stage.result.parts){expect(part.body.isEnabled()).toBe(false);expect(part.body.translation().z).toBeGreaterThan(3.5);}
    stage.commit();stage.finalize();expect(world.getRigidBody(target.body.handle)).toBeNull();expect(world.bodies.len()).toBe(2);
    expect(stage.removedMomentum.massKg).toBe(1);
  }finally{world.free();}
});
it("removes the last cell completely and rejects a removed parent or copied plan",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world,[{x:0,y:0,z:0,materialId:1}]),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.0625,z:2},{x:0,y:0,z:1},0)!;
    const plan=prepareHvpBodyCut(hit,target,"last",1);
    expect(()=>stageHvpBodyCut(world,target,{...plan})).toThrow(/Stale|issued|validated/);
    const stage=stageHvpBodyCut(world,target,plan);expect(stage.result.parts).toHaveLength(0);stage.commit();stage.finalize();
    expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
    expect(()=>stageHvpBodyCut(world,target,plan)).toThrow(/Stale|removed/);
  }finally{world.free();}
});

it("recuts a real child through the same native-hit and current-source path",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world,Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1}))),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.3125,z:2},{x:0,y:0,z:1},0)!;
    const plan=prepareHvpBodyCut(hit,target,"first",1),first=stageHvpBodyCut(world,target,plan);first.commit();first.finalize();
    const part=first.result.parts.find(p=>p.cells.some(c=>c.x===0))!;
    const child={ownerId:part.ownerId,body:part.body,recipe:plan.local.plan.parts.find(p=>p.ownerId===part.ownerId)!.recipe};
    const p=child.body.collider(0).translation();
    const again=captureHvpBodyHit(world,new Map([[child.ownerId,child]]),{x:p.x,y:p.y,z:p.z-1},{x:0,y:0,z:1},1)!;
    const next=prepareHvpBodyCut(again,child,"second",1),second=stageHvpBodyCut(world,child,next);
    expect(next.local.plan.removedCells).toBe(1);expect(second.result.parts.reduce((n,c)=>n+c.cells.length,0)).toBe(1);
    second.commit();second.finalize();expect(world.getRigidBody(child.body.handle)).toBeNull();expect(world.bodies.len()).toBe(2);
  }finally{world.free();}
});

it("accounts for removed linear and angular momentum using an independent per-cube oracle",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const cells=[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}];
    const target=make(world,cells),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},0)!;
    expect(hit.cell).toEqual([1,0,0]);const plan=prepareHvpBodyCut(hit,target,"momentum",1);
    target.body.setLinvel({x:1,y:2,z:3},true);target.body.setAngvel({x:.7,y:-.4,z:2},true);
    const v=[1,2,3],w=[.7,-.4,2],parent=[5/48,5/48,1/16];
    const cross=(a:number[],b:number[])=>[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!];
    const sum=(a:number[],b:number[])=>a.map((n,i)=>n+b[i]!);
    const oracle=(subset:typeof cells)=>{
      let linear=[0,0,0],angular=[0,0,0];
      for(const c of subset){
        const r=[-((c.y+.5)*.125-parent[1]!), (c.x+.5)*.125-parent[0]!, (c.z+.5)*.125-parent[2]!]; // independent +90deg Z
        const p=sum(v,cross(w,r));linear=sum(linear,p);angular=sum(angular,sum(cross(r,p),w.map(n=>n/384)));
      }
      return {linear,angular};
    };
    const stage=stageHvpBodyCut(world,target,plan),removed=oracle([cells[1]!]),before=oracle(cells);
    for(const [i,axis] of (['x','y','z'] as const).entries()){
      expect(stage.removedMomentum.linear[axis]).toBeCloseTo(removed.linear[i]!,6);
      expect(stage.removedMomentum.angular[axis]).toBeCloseTo(removed.angular[i]!,6);
    }
    const parentPosition=stage.parentPose.position;let linear=removed.linear,angular=removed.angular;
    for(const part of stage.result.parts){
      const com=[0,1,2].map(a=>part.cells.reduce((n,c)=>n+([c.x,c.y,c.z][a]!+.5)*.125,0)/part.cells.length);
      const nativeV=part.body.linvel(),nativeW=part.body.angvel(),ww=[nativeW.x,nativeW.y,nativeW.z];
      const pp=[nativeV.x,nativeV.y,nativeV.z].map(n=>n*part.body.mass());linear=sum(linear,pp);
      const position=part.body.translation(),r=[position.x-parentPosition.x,position.y-parentPosition.y,position.z-parentPosition.z];
      let spin=[0,0,0];for(const c of part.cells){
        const local=[-((c.y+.5)*.125-com[1]!), (c.x+.5)*.125-com[0]!, (c.z+.5)*.125-com[2]!];
        spin=sum(spin,sum(cross(local,cross(ww,local)),ww.map(n=>n/384)));
      }
      angular=sum(angular,sum(cross(r,pp),spin));
    }
    linear.forEach((n,i)=>expect(n).toBeCloseTo(before.linear[i]!,5));
    angular.forEach((n,i)=>expect(n).toBeCloseTo(before.angular[i]!,5));stage.rollback();
  }finally{world.free();}
});
