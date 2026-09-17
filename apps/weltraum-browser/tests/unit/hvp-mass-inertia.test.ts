import { beforeAll, describe, expect, it, vi } from "vitest";
import { R, initializeHvpRapier } from "../../src/hestia-prototype/physics/rapierPort";
import { hvpPrincipalAxes } from "../../src/hestia-prototype/physics/principalAxes";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpRigidBody, installHvpRigidBody } from "../../src/hestia-prototype/physics/rigidBody";
import { StructuralPhysicsCommitError } from "../../src/voxel/structural";
import { createHvpPhysicsSession } from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

beforeAll(initializeHvpRapier);
const materials = [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null }];
const cells = [{ x: 0, y: 0, z: 0, materialId: 1 }, { x: 1, y: 0, z: 0, materialId: 1 }, { x: 0, y: 1, z: 0, materialId: 1 }];
const tensor = { xx: 7/384, yy: 7/384, zz: 11/384, xy: 1/192, xz: 0, yz: 0 };
const rotate = (q: {x:number;y:number;z:number;w:number}, v: {x:number;y:number;z:number}) => {
  const t = {x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};
  return {x:v.x+q.w*t.x+q.y*t.z-q.z*t.y,y:v.y+q.w*t.y+q.z*t.x-q.x*t.z,z:v.z+q.w*t.z+q.x*t.y-q.y*t.x};
};

describe("HVP full canonical inertia", () => {
  it("shows the nearest fixed obstruction rather than promising a push through it",async()=>{
    const wall={sizeX:1,sizeY:32,sizeZ:16,cellMeters:.125,originMeters:{x:1,y:0,z:-1},readSlot:()=>1};
    const session=await createHvpPhysicsSession([...collisionSectors(wall)],{x:-2,y:2,z:0},9.81,
      {spawn:{x:0,y:.91,z:0},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]},{x:2.25,y:2.5,z:0});
    try{
      session.play();const s=session.read(),point=s.inertia!.aimPoint;
      const d={x:point.x,y:point.y-s.player!.position.y-.75,z:point.z},n=Math.hypot(d.x,d.y,d.z);
      const direction={x:d.x/n,y:d.y/n,z:d.z/n};
      session.aimBranch(direction);expect(session.read().impulseTarget).toMatchObject({kind:"Fixed",target:null,massKg:null});
      expect(session.read().impulseTarget.point!.x).toBeCloseTo(1,5);
      session.impulse(direction);expect(session.read().lastImpulse?.reason).toBe("Contact is not dynamic");
      expect(session.read().bodies).toEqual(s.bodies);
      session.aimBranch({x:0,y:1,z:0});expect(session.read().impulseTarget.kind).toBe("NoContact");
      session.impulse({x:0,y:1,z:0});expect(session.read().lastImpulse?.reason).toBe("No contact within 4 m");
      expect(session.read().inertia!.impulses).toBe(0);
    }finally{session.dispose();}
  });
  it("reconstructs a coupled tensor and deterministic repeated principal values", () => {
    for (const input of [tensor, {xx:1,yy:1,zz:1,xy:0,xz:0,yz:0}, {xx:2,yy:2,zz:3,xy:0,xz:0,yz:0},
      {xx:4,yy:3,zz:2,xy:.4,xz:-.2,yz:.3}, {xx:2,yy:2+1e-10,zz:3,xy:1e-11,xz:0,yz:0}]) {
      const result = hvpPrincipalAxes(input);
      const columns = [{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}].map(v=>rotate(result.frame,v));
      const values = [result.principalInertia.x,result.principalInertia.y,result.principalInertia.z];
      const axes = ["x","y","z"] as const;
      const matrix = [[input.xx,input.xy,input.xz],[input.xy,input.yy,input.yz],[input.xz,input.yz,input.zz]];
      for(let i=0;i<3;i+=1) { for(let j=0;j<3;j+=1) {
        expect(columns.reduce((sum,c,k)=>sum+c[axes[i]!]!*values[k]!*c[axes[j]!]!,0)).toBeCloseTo(matrix[i]![j]!,10);
      } }
      expect(hvpPrincipalAxes(input)).toEqual(result);
    }
    for(const bad of [{...tensor,xx:NaN},{...tensor,xy:1},{xx:0,yy:0,zz:0,xy:0,xz:0,yz:0}]) {
      expect(()=>hvpPrincipalAxes(bad)).toThrow();
    }
  });

  it.each([
    {x:0,y:0,z:0,w:1}, {x:0,y:Math.sin(Math.PI/8),z:0,w:Math.cos(Math.PI/8)},
    {x:.2,y:-.3,z:.1,w:Math.sqrt(.86)}
  ])("installs the real L-body tensor and answers world-space impulses at %j", rotation => {
    const source = ingestHvpStructuralCells("l-body", cells, materials);
    const recipe = prepareHvpRigidBody(source);
    expect(recipe.mass.totalMassKg).toBe(3);
    expect(recipe.mass.centerOfMassMeters).toEqual({x:5/48,y:5/48,z:1/16});
    expect(recipe.mass.inertiaTensorKgMetersSquared.xy).toBeCloseTo(1/192,12);
    expect(recipe.colliders.length).toBe(2);
    const world = new R.World({x:0,y:0,z:0});
    try {
      const body = installHvpRigidBody(world, recipe, {translationMeters:{x:2,y:3,z:4},rotation});
      expect(body.mass()).toBeCloseTo(3,6);
      expect(Math.hypot(body.localCom().x,body.localCom().y,body.localCom().z)).toBeLessThan(1e-6);
      world.timestep=1e-6;world.step();
      // Hand-derived L tensor times local (1,0,0), then rotate to world. No
      // product eigensolver or installed principal values form this oracle.
      body.applyTorqueImpulse(rotate(rotation,{x:7/384,y:1/192,z:0}),true);
      const expected=rotate(rotation,{x:1,y:0,z:0});
      expect(body.angvel().x).toBeCloseTo(expected.x,4);
      expect(body.angvel().y).toBeCloseTo(expected.y,4);
      expect(body.angvel().z).toBeCloseTo(expected.z,4);
      world.updateSceneQueries();
      if(rotation.w===1) {
        // Empty upper-right L cell must not become a filled bounding box.
        expect(world.castRay(new R.Ray({x:2+.1875,y:3+.1875,z:3},{x:0,y:0,z:1}),2,true)).toBeNull();
      }
    } finally { world.free(); }
  });

  it("keeps real source proofs, negative coordinates and input order stable", () => {
    const forward=ingestHvpStructuralCells("ordered",cells,materials);
    const backward=ingestHvpStructuralCells("ordered",[...cells].reverse(),materials);
    expect(forward.contentHash).toBe(backward.contentHash);
    expect(forward.source).toEqual(backward.source);
    const negative=ingestHvpStructuralCells("negative",[{x:-1,y:-1,z:-1,materialId:1}],materials);
    const mass=prepareHvpRigidBody(negative).mass;
    expect(mass.centerOfMassMeters).toEqual({x:-.0625,y:-.0625,z:-.0625});
    expect(mass.inertiaTensorKgMetersSquared.xx).toBeCloseTo(1/384,12);
    expect(()=>ingestHvpStructuralCells("oversized",new Array(32_769),materials)).toThrow(/Budget/);
    expect(()=>ingestHvpStructuralCells("duplicate",[cells[0]!,cells[0]!],materials)).toThrow(/duplicate/i);
  });

  it("falsifies a diagonal-only L installation with a real solver impulse", () => {
    const world=new R.World({x:0,y:0,z:0});
    try {
      const body=world.createRigidBody(R.RigidBodyDesc.dynamic());
      world.createCollider(R.ColliderDesc.cuboid(.1,.1,.1).setMassProperties(3,{x:0,y:0,z:0},
        {x:7/384,y:7/384,z:11/384},{x:0,y:0,z:0,w:1}),body);
      world.step();body.applyTorqueImpulse({x:7/384,y:1/192,z:0},true);
      expect(Math.abs(body.angvel().y)).toBeGreaterThan(.2);
    } finally { world.free(); }
  });

  it("installs the heterogeneous F7 mass exactly once across merged collision boxes", () => {
    const source=ingestHvpStructuralCells("f7",[14,15,16,17,18].map(x=>({x,y:5,z:0,materialId:x<16?1:2})),[
      {...materials[0]!,densityKgPerCubicMeter:7800}, {...materials[0]!,materialId:2,densityKgPerCubicMeter:2700}
    ]);
    const recipe=prepareHvpRigidBody(source);
    expect(recipe.mass.totalMassKg).toBeCloseTo(46.2890625,12);
    expect(recipe.mass.centerOfMassMeters!.x).toBeCloseTo(2505/1264,12);
    expect(recipe.mass.inertiaTensorKgMetersSquared.xx).toBeCloseTo(.12054443359375,12);
    const world=new R.World({x:0,y:0,z:0});
    try {
      const body=installHvpRigidBody(world,recipe);world.step();
      expect(body.mass()).toBeCloseTo(46.2890625,5);
      expect(body.numColliders()).toBe(recipe.colliders.length);
      const center=body.translation();
      body.applyImpulseAtPoint({x:0,y:0,z:.12054443359375/.25},{x:center.x,y:center.y+.25,z:center.z},true);
      expect(body.angvel().x).toBeCloseTo(1,4);
      expect(body.linvel().z).toBeCloseTo((.12054443359375/.25)/46.2890625,5);
    } finally { world.free(); }
  });

  it("rejects excessive exact collision and AddBox work rather than using a hull", () => {
    const comb=Array.from({length:130},(_,x)=>({x,y:0,z:0,materialId:1}));
    comb.push(...Array.from({length:65},(_,i)=>({x:i*2,y:1,z:0,materialId:1})));
    expect(()=>prepareHvpRigidBody(ingestHvpStructuralCells("comb",comb,materials))).toThrow(/Budget|64/);
    const runs=Array.from({length:4097},(_,i)=>({x:(i%16)*2,y:Math.floor(i/16)%32,z:Math.floor(i/512),materialId:1}));
    expect(()=>ingestHvpStructuralCells("runs",runs,materials)).toThrow(/4096/);
  });

  it.each([false,true])("reports actual World rollback after collider failure (cleanup fails: %s)", cleanupFails => {
    const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("rollback",cells,materials));
    const world=new R.World({x:0,y:0,z:0});
    const create=world.createCollider.bind(world);
    vi.spyOn(world,"createCollider").mockImplementationOnce(create).mockImplementationOnce(()=>{throw new Error("injected allocation");});
    if(cleanupFails) { vi.spyOn(world,"removeRigidBody").mockImplementationOnce(()=>{throw new Error("injected cleanup");}); }
    try {
      let caught:unknown;
      try { installHvpRigidBody(world,recipe); } catch(error) { caught=error; }
      expect(caught).toBeInstanceOf(StructuralPhysicsCommitError);
      expect((caught as StructuralPhysicsCommitError).worldRestored).toBe(!cleanupFails);
      expect(world.bodies.len()).toBe(cleanupFails?1:0);
      expect(world.colliders.len()).toBe(cleanupFails?1:0);
    } finally { vi.restoreAllMocks();world.free(); }
  });

  it("applies a capped impulse only at a real nearby contact, with cooldown and paused rejection", async () => {
    const session=await createHvpPhysicsSession([], {x:0,y:2,z:0},9.81,
      {spawn:{x:0,y:0.91,z:0},coverage:[{minX:-4,maxX:4,minZ:-4,maxZ:4}]},{x:2.25,y:2.5,z:0});
    try {
      session.play();const state=session.read();const point=state.inertia!.aimPoint;
      const delta={x:point.x-state.player!.position.x,y:point.y-state.player!.position.y-.75,z:point.z-state.player!.position.z};const norm=Math.hypot(delta.x,delta.y,delta.z);
      const direction={x:delta.x/norm,y:delta.y/norm,z:delta.z/norm};
      session.aimBranch(direction);
      expect(session.read().impulseTarget).toMatchObject({kind:"Dynamic",target:"hvp:physics:inertia",massKg:35.15625});
      expect(session.read().lastImpulse).toBeNull(); // Preview is not an impulse.
      session.impulse(direction);const after=session.read();
      expect(after.lastImpulse?.status,JSON.stringify(after.lastImpulse)).toBe("Applied");expect(after.lastImpulse?.target).toBe("hvp:physics:inertia");
      expect(Math.hypot(...Object.values(after.lastImpulse!.impulse!))).toBeCloseTo(15,8);
      expect(Math.hypot(...Object.values(after.inertia!.angularVelocity))).toBeGreaterThan(.001);
      expect(after.inertia!.impulses).toBe(1);
      session.impulse(direction);expect(session.read().lastImpulse?.reason).toContain("Cooldown");
      session.pause();session.impulse(direction);expect(session.read().lastImpulse?.status).toBe("Rejected");
      expect(session.read().impulseTarget.kind).toBe("NotPlaying");
      expect(session.read().inertia!.impulses).toBe(1);
    } finally { session.dispose(); }
  });
});
