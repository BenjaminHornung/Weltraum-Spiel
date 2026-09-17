import {beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {createHvpNeighborCollision} from "../../src/hestia-prototype/physics/neighborRegion";
import type {HvpNeighborCheckpoint} from "../../src/hestia-prototype/runtime/residency";
beforeAll(initializeHvpRapier);
const meshes=()=>Array.from({length:64},(_,i)=>{const x=16+i%8*4,z=-16+Math.floor(i/8)*4;
  return {vertices:new Float32Array([x,0,z,x,0,z+4,x+4,0,z+4,x+4,0,z]),indices:new Uint32Array([0,1,2,0,2,3])};});
const state=(epoch:number,resident:boolean):HvpNeighborCheckpoint=>({version:"hvp-neighbor-world-v1",baseSectorCount:64,epoch,resident,sourceDigest:"12345678"});
const hit=(w:R.World)=>{w.updateSceneQueries();return w.castRay(new R.Ray({x:18,y:1,z:-14},{x:0,y:-1,z:0}),2,true);};

it("exposes native collision only after commit, pins touching bodies, and restores the previous generation",()=>{
  const world=new R.World({x:0,y:0,z:0});let safe=true;
  try{
    const region=createHvpNeighborCollision(world,64,()=>safe);
    safe=false;expect(()=>region.prepare("load",state(1,true),meshes())).toThrow(/held World/);safe=true;
    expect(()=>region.prepare("missing",state(1,true),meshes().slice(1))).toThrow(/coverage/);
    region.prepare("load",state(1,true),meshes());expect(region.read().collisionReady).toBe(false);expect(hit(world)).toBeNull();
    region.commit("load");expect(hit(world)?.toi).toBeCloseTo(1,6);expect(region.busy).toBe(true);region.finalize("load");
    expect(world.colliders.len()).toBe(64);expect(region.read().collisionReady).toBe(true);
    expect(()=>region.prepare("stale",state(1,false),[])).toThrow(/Stale/);
    expect(()=>region.prepare("player",state(2,false),[],{x:16.1,y:1,z:0})).toThrow(/pinned/);
    const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(15.8,2,-14));
    world.createCollider(R.ColliderDesc.cuboid(.5,.5,.5),body);
    expect(region.pinned()).toBe(true);expect(()=>region.prepare("body",state(2,false),[])).toThrow(/pinned/);
    world.removeRigidBody(body);
    region.prepare("unload",state(2,false),[]);region.commit("unload");expect(hit(world)).toBeNull();region.rollback("unload");
    expect(region.checkpoint()).toEqual(state(1,true));expect(hit(world)?.toi).toBeCloseTo(1,6);
    region.prepare("unload-final",state(2,false),[]);region.commit("unload-final");region.finalize("unload-final");
    expect(world.colliders.len()).toBe(0);expect(region.read().collisionReady).toBe(false);
  }finally{world.free();}
});

it("cleans post-create failure and holds after uncertain native retirement",()=>{
  const world=new R.World({x:0,y:0,z:0});
  try{
    const floor=world.createCollider(R.ColliderDesc.cuboid(1,.1,1)),region=createHvpNeighborCollision(world,64,()=>true);
    const create=world.createCollider.bind(world);
    vi.spyOn(world,"createCollider").mockImplementationOnce((...args:Parameters<typeof create>)=>{create(...args);throw new Error("after-create");});
    expect(()=>region.prepare("failed",state(1,true),meshes())).toThrow(/after-create/);
    expect(world.colliders.len()).toBe(1);expect(world.getCollider(floor.handle)).toBe(floor);expect(region.busy).toBe(false);
    region.prepare("load",state(1,true),meshes());region.commit("load");region.finalize("load");
    region.prepare("unload",state(2,false),[]);region.commit("unload");
    const remove=world.removeCollider.bind(world);
    vi.spyOn(world,"removeCollider").mockImplementationOnce((...args:Parameters<typeof remove>)=>{remove(...args);throw new Error("after-remove");});
    expect(()=>region.finalize("unload")).toThrow(/RecoveryHold/);expect(region.held).toBe(true);
    expect(()=>region.prepare("unsafe",state(3,true),meshes())).toThrow(/held World/);
  }finally{world.free();}
});
