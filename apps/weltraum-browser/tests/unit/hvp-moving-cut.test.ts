import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {HVP_PHYSICS_DT} from "../../src/hestia-prototype/physics/tick";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {installHvpRigidBody,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut} from "../../src/hestia-prototype/physics/bodyCut";
import {readHvpBodyCells} from "../../src/hestia-prototype/physics/bodyCutPlan";

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
it("stages only the originally issued hit after the camera points away",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world),targets=new Map([[target.ownerId,target]]);
    const hit=captureHvpBodyHit(world,targets,{x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},0)!;
    expect(hit.cell).toEqual([1,0,0]);
    const plan=prepareHvpBodyCut(hit,target,"camera-turn",1);
    expect(captureHvpBodyHit(world,targets,{x:5,y:5,z:5},{x:1,y:0,z:0},1)).toBeNull();
    const stage=stageHvpBodyCut(world,target,plan);
    expect(stage.removedMomentum.massKg).toBe(1);
    expect(stage.result.parts.flatMap(part=>part.cells.map(cell=>cell.x)).sort()).toEqual([0,2]);
    stage.rollback();
  }finally{world.free();}
});
it("rejects a new native body under the same owner and source after the original hit",()=>{
  const world=new R.World({x:0,y:0,z:0});try{
    const target=make(world),hit=captureHvpBodyHit(world,new Map([[target.ownerId,target]]),
      {x:.9375,y:2.1875,z:2},{x:0,y:0,z:1},0)!;
    const plan=prepareHvpBodyCut(hit,target,"replaced-parent",1);
    const invalid={...target};Reflect.set(invalid,"body",undefined);
    expect(()=>stageHvpBodyCut(world,invalid,{...plan})).toThrow(/Stale|removed/);
    world.removeRigidBody(target.body);
    const replacement={...target,body:installHvpRigidBody(world,target.recipe)};
    expect(world.bodies.len()).toBe(1);
    expect(()=>stageHvpBodyCut(world,replacement,plan)).toThrow(/Stale|removed/);
    Reflect.set(target,"body",replacement.body);
    expect(()=>prepareHvpBodyCut(hit,target,"replaced-before-prepare",1)).toThrow(/Stale|unvalidated/);
    expect(world.bodies.len()).toBe(1);
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
    target.body.setLinvel({x:1,y:2,z:-3},true);target.body.setAngvel({x:.5,y:-1,z:2},true);
    const stage=stageHvpBodyCut(world,target,plan);expect(stage.result.parts).toHaveLength(0);
    expect(stage.removedMomentum).toMatchObject({massKg:1,linear:{x:1,y:2,z:-3}});
    for(const [axis,rate] of Object.entries({x:.5,y:-1,z:2}) as ["x"|"y"|"z",number][]){
      expect(stage.removedMomentum.angular[axis]).toBeCloseTo(rate/384,8);
    }
    stage.commit();stage.finalize();
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

it.each([
  {state:"falling",brush:"Box"},
  {state:"falling",brush:"Sphere"},
  {state:"sleeping",brush:"Box"},
  {state:"sleeping",brush:"Sphere"}
] as const)("balances real $state body cuts with $brush source and native geometry",({state,brush})=>{
  const materials=[
    {materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null},
    {materialId:2,densityKgPerCubicMeter:1024,structuralClass:"stone",destructible:true,tags:null}
  ];
  const cells=Array.from({length:64},(_,i)=>({x:i%4,y:Math.floor(i/4)%4,z:Math.floor(i/16),materialId:i%4===0||i%4===3?2:1}));
  const cellMeters=.125,cellVolume=cellMeters**3,key=(c:{x:number;y:number;z:number})=>`${c.x}:${c.y}:${c.z}`;
  const materialKey=(c:{x:number;y:number;z:number;materialId:number})=>`${key(c)}:${c.materialId}`;
  const rotate=(q:{x:number;y:number;z:number;w:number},v:{x:number;y:number;z:number})=>{
    const t={x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};
    return {x:v.x+q.w*t.x+q.y*t.z-q.z*t.y,y:v.y+q.w*t.y+q.z*t.x-q.x*t.z,z:v.z+q.w*t.z+q.x*t.y-q.y*t.x};
  };
  const massFor=(subset:readonly {readonly materialId:number}[])=>subset.reduce((sum,cell)=>sum+materials.find(m=>m.materialId===cell.materialId)!.densityKgPerCubicMeter*cellVolume,0);
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells(`k32-${state}-${brush}`,cells,materials));
  const sourceMass=massFor(cells);
  expect(sourceMass).toBe(96);
  expect(recipe.mass.totalMassKg).toBeCloseTo(sourceMass,8);

  const world=new R.World({x:0,y:-9.81,z:0});
  try{
    world.timestep=HVP_PHYSICS_DT;
    const floor=world.createCollider(R.ColliderDesc.cuboid(2,.125,2).setTranslation(0,-.125,0));
    const body=installHvpRigidBody(world,recipe,{translationMeters:{x:-.25,y:2,z:-.25},rotation:{x:0,y:0,z:0,w:1}});
    const target={ownerId:`k32-${state}-${brush}`,body,recipe},targets=new Map([[target.ownerId,target]]);
    expect(body.numColliders()).toBe(recipe.colliders.length);

    if(state==="falling"){
      for(let i=0;i<8;i+=1){world.step();}
      expect(body.isSleeping()).toBe(false);
      expect(body.linvel().y).toBeLessThan(-.5);
      expect(body.translation().y-recipe.mass.centerOfMassMeters!.y).toBeGreaterThan(.5);
      let contactingFloor=false;
      world.contactPair(floor,body.collider(0),()=>{contactingFloor=true;});
      expect(contactingFloor).toBe(false);
    }else{
      let steps=0;
      while(!body.isSleeping()&&steps<1200){world.step();steps+=1;}
      expect(body.isSleeping()).toBe(true);
      let contactingFloor=false;
      world.contactPair(floor,body.collider(0),()=>{contactingFloor=true;});
      expect(contactingFloor).toBe(true);
      expect(body.translation().y-recipe.mass.centerOfMassMeters!.y).toBeCloseTo(0,2);
    }

    const originY=body.translation().y-recipe.mass.centerOfMassMeters!.y;
    const hit=captureHvpBodyHit(world,targets,{x:-.0625,y:originY+.1875,z:-1.25},{x:0,y:0,z:1},0);
    expect(hit?.cell).toEqual([1,1,0]);
    const plan=prepareHvpBodyCut(hit!,target,`k32-cut-${state}-${brush}`,2,brush);
    if(state==="falling"){
      for(let i=0;i<3;i+=1){world.step();}
      expect(body.isSleeping()).toBe(false);
    }else{
      world.step();
      expect(body.isSleeping()).toBe(true);
    }

    const nativeAtStage={position:{...body.translation()},rotation:{...body.rotation()},velocity:{...body.linvel()},angularVelocity:{...body.angvel()}};
    const stage=stageHvpBodyCut(world,target,plan);
    expect(stage.parentPose).toEqual(nativeAtStage);
    if(state==="falling"){
      expect(stage.parentPose.velocity.y).toBeLessThan(-.5);
      expect(Math.abs(stage.parentPose.position.y-hit!.pose.position.y)).toBeGreaterThan(.001);
    }else{
      expect(body.isSleeping()).toBe(true);
      expect(stage.parentPose.position).toEqual(hit!.pose.position);
    }

    const edge=2,hitCell=hit!.cell;
    const minX=Math.floor(hitCell[0]/edge)*edge,minY=Math.floor(hitCell[1]/edge)*edge,minZ=Math.floor(hitCell[2]/edge)*edge;
    const removed=cells.filter(cell=>brush==="Box"
      ?cell.x>=minX&&cell.x<minX+edge&&cell.y>=minY&&cell.y<minY+edge&&cell.z>=minZ&&cell.z<minZ+edge
      :(2*cell.x+1-(2*hitCell[0]+1))**2+(2*cell.y+1-(2*hitCell[1]+1))**2+(2*cell.z+1-(2*hitCell[2]+1))**2<=edge**2);
    const removedKeys=new Set(removed.map(key)),survivors=cells.filter(cell=>!removedKeys.has(key(cell)));
    const removedMass=massFor(removed),survivorMass=massFor(survivors);
    expect(removed).toHaveLength(brush==="Box"?8:6);
    expect(removedMass).toBe(brush==="Box"?12:7);
    expect(stage.result.removedMassKg).toBeCloseTo(removedMass,8);
    expect(stage.removedMomentum.massKg).toBeCloseTo(removedMass,8);
    const childCells=stage.result.parts.flatMap(part=>part.cells);
    expect(childCells.map(materialKey).sort()).toEqual(survivors.map(materialKey).sort());
    const childMass=stage.result.parts.reduce((sum,part)=>sum+part.body.mass(),0);
    expect(childMass).toBeCloseTo(survivorMass,6);
    expect(childMass+stage.removedMomentum.massKg).toBeCloseTo(sourceMass,6);

    const centerOffset=rotate(stage.parentPose.rotation,recipe.mass.centerOfMassMeters!);
    const sourceOrigin={x:stage.parentPose.position.x-centerOffset.x,y:stage.parentPose.position.y-centerOffset.y,z:stage.parentPose.position.z-centerOffset.z};
    const inverse={x:-stage.parentPose.rotation.x,y:-stage.parentPose.rotation.y,z:-stage.parentPose.rotation.z,w:stage.parentPose.rotation.w};
    const colliderCoverage=new Map<string,number>();
    const childColliderCount=stage.result.parts.reduce((sum,part)=>sum+part.body.numColliders(),0);
    for(const part of stage.result.parts){
      const issued=plan.local.plan.parts.find(p=>p.ownerId===part.ownerId);
      if(!issued){throw new Error("Missing issued child source");}
      expect(readHvpBodyCells(issued.recipe.source).map(materialKey).sort()).toEqual(part.cells.map(materialKey).sort());
      expect(part.body.mass()).toBeCloseTo(massFor(part.cells),6);
      expect(part.body.numColliders()).toBe(issued.recipe.colliders.length);
      for(let i=0;i<part.body.numColliders();i+=1){
        const collider=part.body.collider(i),half=collider.halfExtents(),center=collider.translation();
        expect(collider.parent()).toBe(part.body);
        expect(collider.shapeType()).toBe(R.ShapeType.Cuboid);
        const q=collider.rotation(),parent=stage.parentPose.rotation;
        expect(Math.abs(q.x*parent.x+q.y*parent.y+q.z*parent.z+q.w*parent.w)).toBeCloseTo(1,6);
        const localCenter=rotate(inverse,{x:center.x-sourceOrigin.x,y:center.y-sourceOrigin.y,z:center.z-sourceOrigin.z});
        const min=[(localCenter.x-half.x)/cellMeters,(localCenter.y-half.y)/cellMeters,(localCenter.z-half.z)/cellMeters];
        const max=[(localCenter.x+half.x)/cellMeters,(localCenter.y+half.y)/cellMeters,(localCenter.z+half.z)/cellMeters];
        const low=min.map(Math.round),high=max.map(Math.round);
        min.forEach((value,axis)=>expect(value).toBeCloseTo(low[axis]!,4));
        max.forEach((value,axis)=>expect(value).toBeCloseTo(high[axis]!,4));
        for(let z=low[2]!;z<high[2]!;z+=1){for(let y=low[1]!;y<high[1]!;y+=1){for(let x=low[0]!;x<high[0]!;x+=1){
          const cellKey=`${x}:${y}:${z}`;
          colliderCoverage.set(cellKey,(colliderCoverage.get(cellKey)??0)+1);
        }}}
      }
    }
    expect([...colliderCoverage.keys()].sort()).toEqual(survivors.map(key).sort());
    expect([...colliderCoverage.values()].every(count=>count===1)).toBe(true);
    expect(world.colliders.len()).toBe(1+body.numColliders()+childColliderCount);
    stage.commit();stage.finalize();
    expect(world.getRigidBody(body.handle)).toBeNull();
    expect(world.bodies.len()).toBe(stage.result.parts.length);
    expect(world.colliders.len()).toBe(1+childColliderCount);
  }finally{world.free();}
});
