import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {createHvpBranchSession} from "../../src/hestia-prototype/physics/branchSession";
import {meshHvpBranchProducts} from "../../src/hestia-prototype/presentation/structuralPart";
import {Vector3,Quaternion} from "three";

beforeAll(initializeHvpRapier);
it("reuses the real split for a light salvage load without changing wood density or impulse limits",()=>{
  const world=new R.World({x:0,y:-11.794460201817357,z:0});
  try{
    world.createCollider(R.ColliderDesc.cuboid(5,.1,5).setTranslation(0,-.1,0).setFriction(.8));
    const owner=createHvpBranchSession(world,{x:0,y:0,z:0},undefined,undefined,undefined,"salvage");
    const eye={x:.1875,y:.9375,z:-2},direction={x:0,y:0,z:1};owner.preview(eye,direction);
    const before=owner.read();expect(before.preview?.cell).toEqual([1,7,0]);expect(before.cutEdge).toBe(1);
    owner.prepare({id:"salvage-cut",generation:0,sourceDigest:before.sourceDigest,direction},eye);owner.commit("salvage-cut");owner.finalize("salvage-cut");
    expect(owner.read().last).toMatchObject({removedCells:1,removedMassKg:1.171875});
    const load=owner.read().parts.find(p=>!p.anchored)!;expect(load.cellCount).toBe(8);expect(load.massKg).toBe(9.375);
    expect(owner.read().attachment.ownerId).toBeNull();expect(meshHvpBranchProducts(owner.read(true)).every(p=>!p.decoration)).toBe(true);
    for(let i=0;i<120;i+=1){world.step();}
    let body:R.RigidBody|undefined;world.bodies.forEach(b=>{if(b.isDynamic()){body=b;}});
    const oldZ=body!.translation().z;body!.applyImpulse({x:0,y:0,z:15},true);
    for(let i=0;i<120;i+=1){world.step();}
    expect(body!.translation().z-oldZ).toBeGreaterThan(.05);
  }finally{world.free();}
});
it("cuts actual canonical timber, remaps foliage support and lets only the detached part fall",()=>{
  const world=new R.World({x:0,y:-9.81,z:0});
  try {
    world.createCollider(R.ColliderDesc.cuboid(10,.1,10).setTranslation(0,-.1,0));
    const owner=createHvpBranchSession(world,{x:0,y:0,z:0});
    const eye={x:.75,y:1.25,z:-2},direction={x:0,y:0,z:1};
    owner.preview(eye,direction);
    const before=owner.read();expect(before.preview?.cell).toEqual([6,10,0]);expect(before.generation).toBe(0);
    const beforeDecor=meshHvpBranchProducts(owner.read(true)).find(p=>p.decoration)!;
    owner.prepare({id:"cut-1",generation:0,sourceDigest:before.sourceDigest,direction},eye);
    expect(owner.read().state).toBe("PreparedHeld");expect(world.bodies.len()).toBe(3);
    expect(owner.read(true).parts.map(p=>p.cells?.length).sort((a,b)=>a!-b!)).toEqual([128,192]);
    const afterDecor=meshHvpBranchProducts(owner.read(true)).find(p=>p.decoration)!;
    owner.commit("cut-1");const committed=owner.read();
    expect(committed.generation).toBe(1);expect(world.bodies.len()).toBe(3);
    const falling=committed.parts.find(p=>!p.anchored)!;
    expect(committed.attachment.ownerId).toBe(falling.ownerId);
    const vertex=(positions:Float32Array,p:typeof falling,i:number)=>new Vector3(positions[i],positions[i+1],positions[i+2])
      .applyQuaternion(new Quaternion(p.orientation.x,p.orientation.y,p.orientation.z,p.orientation.w)).add(new Vector3(p.position.x,p.position.y,p.position.z)).toArray();
    expect(afterDecor.ownerId).toBe(falling.ownerId);
    for(let i=0;i<beforeDecor.mesh.positions.length;i+=3){
      expect(vertex(afterDecor.mesh.positions,falling,i)).toEqual(vertex(beforeDecor.mesh.positions,before.parts[0]!,i));
    }
    expect(committed.last).toMatchObject({removedCells:64,removedMassKg:75});
    owner.finalize("cut-1");expect(world.bodies.len()).toBe(2);
    for(let i=0;i<60;i+=1){world.step();}
    const settled=owner.read();
    expect(settled.parts.find(p=>!p.anchored)!.position.y).toBeLessThan(falling.position.y-.5);
    expect(settled.parts.find(p=>p.anchored)!.position).toEqual(committed.parts.find(p=>p.anchored)!.position);
    expect(()=>owner.prepare({id:"cut-1",generation:0,sourceDigest:before.sourceDigest,direction},eye)).toThrow(/already applied/);
    expect(world.bodies.len()).toBe(2);
  }finally{world.free();}
});
it("rejects occluded contact and restores parent/source/attachment after a held commit rollback",()=>{
  const world=new R.World({x:0,y:0,z:0});
  try {
    const owner=createHvpBranchSession(world,{x:0,y:0,z:0});
    const eye={x:.75,y:1.25,z:-2},direction={x:0,y:0,z:1};
    const before=owner.read();
    const wall=world.createCollider(R.ColliderDesc.cuboid(2,2,.1).setTranslation(0,1,-1));
    owner.preview(eye,direction);expect(owner.read().preview).toBeNull();
    world.removeCollider(wall,true);
    owner.prepare({id:"cut-2",generation:0,sourceDigest:before.sourceDigest,direction},eye);
    owner.commit("cut-2");owner.rollback("cut-2");
    expect(owner.read()).toMatchObject({generation:0,state:"Idle",sourceDigest:before.sourceDigest,attachment:before.attachment});
    expect(owner.read().parts).toEqual(before.parts);expect(world.bodies.len()).toBe(1);
  }finally{world.free();}
});
