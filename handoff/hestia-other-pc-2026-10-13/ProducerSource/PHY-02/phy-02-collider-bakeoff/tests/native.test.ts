import test from "node:test";
import assert from "node:assert/strict";
import R012 from "rapier012";
import {fixture,fixtures,splitFixture,type Cell} from "../src/fixtures.js";
import {recipe,vec,rotate,worldPoint,rayOracle,type Kind,type Vec} from "../src/geometry.js";
import {engine,newWorld,install,directRay,worldRay,publishQueries,stageEdit,couple,propagate,type Engine} from "../src/native.js";
const engines=[await engine("A"),await engine("B"),await engine("C")];
const reps=(e:Engine):Kind[]=>e.mode==="C"?["voxels"]:["triangles","multi-cuboid"];
const near=(a:number,b:number,tol=2e-5)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),a+" != "+b);
const id={x:0,y:0,z:0,w:1};
for(const e of engines)for(const kind of reps(e)){
  test(e.mode+"/"+kind+" independent ray and sphere cast parity for all geometry/profile fixtures",()=>{
    for(const f of fixtures()){
      const w=newWorld(e);
      try{
        const i=install(e,w,recipe(f,kind));publishQueries(e,w);
        for(let axis=0;axis<3;axis++){
          const cross=[0,1,2].filter(a=>a!==axis);
          for(let a=0;a<f.bounds[cross[0]];a++)for(let b=0;b<f.bounds[cross[1]];b++){
            const o=[0,0,0];o[axis]=-f.cellSize;o[cross[0]]=(a+.5)*f.cellSize;o[cross[1]]=(b+.5)*f.cellSize;
            const d=[0,0,0];d[axis]=1;
            const expected=rayOracle(f,vec(o as unknown as Cell),vec(d as unknown as Cell));
            const origin=worldPoint(f,vec(o as unknown as Cell)),dir=rotate(f.rotation,vec(d as unknown as Cell));
            const actual=directRay(i,origin,dir);
            if(expected===null)assert.equal(actual,null,f.id+" miss");
            else{assert.notEqual(actual,null,f.id+" hit");near(actual!,expected);}
          }
        }
        const center=worldPoint(f,{x:f.cellSize*.5,y:f.cellSize*.5,z:-f.cellSize});
        const dir=rotate(f.rotation,{x:0,y:0,z:1});
        // Shape cast starts outside; the first occupied z cell at this x/y is an analytic slab hit.
        const expected=rayOracle(f,{x:f.cellSize*.5,y:f.cellSize*.5,z:-f.cellSize},{x:0,y:0,z:1});
        let time:number|null;
        if(e.mode==="A"){
          const legacy=w as unknown as import("rapier012").World;
          // Use the actual legacy Ball class, not a nominally modern Shape.
          const old=legacy.castShape(center,id,dir,new R012.Ball(f.cellSize*.1),10,true);
          time=old?.toi??null;
        }else time=w.castShape(center,id,dir,new e.R.Ball(f.cellSize*.1),0,10,true)?.time_of_impact??null;
        if(expected===null)assert.equal(time,null);
        else{assert.notEqual(time,null);near(time!,expected-f.cellSize*.1,2e-3);}
      }finally{w.free();}
    }
  });
  test(e.mode+"/"+kind+" native canonical tensor and three angular impulse axes include L off-diagonal inertia",()=>{
    for(const cellSize of [.125,.25]){
      const box=fixture("box",cellSize),L={...box,id:"L",bounds:[2,2,1] as const,cells:[[0,0,0],[1,0,0],[0,1,0]] as const};
      const hollow={...box,id:"hollow",cells:box.cells.filter(c=>c.some(n=>n===0||n===3))};
      for(const f of [box,L,hollow,{...L,id:"rotated-L",rotation:{x:0,y:Math.sin(.31),z:0,w:Math.cos(.31)}}]){
        const w=newWorld(e);
        try{
          const r=recipe(f,kind),i=install(e,w,r,true);w.step();const body=i.body,t=r.mass.tensor;
          near(body.mass(),r.mass.mass);assert(i.colliders.every(c=>c.density()===0));
          const cm=worldPoint(f,r.mass.center);near(body.worldCom().x,cm.x);near(body.worldCom().y,cm.y);near(body.worldCom().z,cm.z);
          // Independent response oracle checks I * deltaOmega = local angular impulse, no reader assumption.
          for(const impulse of [{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}]){
            body.setAngvel({x:0,y:0,z:0},true);body.applyTorqueImpulse(rotate(f.rotation,impulse),true);
            const inv={...f.rotation,x:-f.rotation.x,y:-f.rotation.y,z:-f.rotation.z},omega=rotate(inv,body.angvel());
            near(t.xx*omega.x+t.xy*omega.y+t.xz*omega.z,impulse.x,4e-4);
            near(t.xy*omega.x+t.yy*omega.y+t.yz*omega.z,impulse.y,4e-4);
            near(t.xz*omega.x+t.yz*omega.y+t.zz*omega.z,impulse.z,4e-4);
          }
        }finally{w.free();}
      }
    }
  });
  test(e.mode+"/"+kind+" staged hole, rollback, commit, recut and detached fragment have no ghost colliders",()=>{
    const f=fixture("perforated-wall",.125),removed:[number,number,number]=[0,0,0];
    const next={...f,cells:f.cells.filter(c=>c.join(":")!==removed.join(":"))},w=newWorld(e);
    try{
      let active=install(e,w,recipe(f,kind));publishQueries(e,w);
      const o={x:.0625,y:.0625,z:-.125},d={x:0,y:0,z:1};assert.notEqual(worldRay(active,o,d),null);
      const original=w.colliders.len(),rollback=stageEdit(active,next,kind==="voxels");
      publishQueries(e,w);assert.notEqual(worldRay(active,o,d),null);assert(!rollback.candidate.body.isEnabled());
      rollback.rollback();publishQueries(e,w);assert.equal(w.colliders.len(),original);assert.notEqual(worldRay(active,o,d),null);
      assert.throws(()=>rollback.commit());
      const staged=stageEdit(active,next,kind==="voxels");active=staged.commit();publishQueries(e,w);assert.equal(worldRay(active,o,d),null);
      assert.equal(active.recipe.binding.sourceRevision,1);assert.equal(active.recipe.binding.missingNeighborCoverage,"UNKNOWN");
      assert.equal(w.bodies.len(),1);assert.equal(w.colliders.len(),active.colliders.length);
      // Detached child uses the removed voxel once; recut removes the child without leaving a ghost.
      const child=install(e,w,recipe({...f,id:"detached",cells:[removed],origin:[1,0,0]},"multi-cuboid"),true);
      publishQueries(e,w);assert.equal(w.bodies.len(),2);w.removeRigidBody(child.body);publishQueries(e,w);assert.equal(w.bodies.len(),1);
      active=stageEdit(active,f,false).commit();publishQueries(e,w);assert.notEqual(worldRay(active,o,d),null);
      assert.equal(w.colliders.len(),active.colliders.length);
      assert.throws(()=>stageEdit(active,{...f,cellSize:.25}),/owner\/frame\/coverage/);
    }finally{w.free();}
  });
  test(e.mode+"/"+kind+" small and rotated fall bodies plus CCD stop at occupied floor",()=>{
    const f=fixture("box",.125),w=newWorld(e,9.81);
    try{
      const ground=install(e,w,recipe(f,kind));
      for(const rotated of [false,true]){
        const radius=.025,body=w.createRigidBody(e.R.RigidBodyDesc.dynamic().setTranslation(.25,1,.25)
          .setRotation(rotated?{x:0,y:0,z:Math.sin(.2),w:Math.cos(.2)}:id).setCcdEnabled(true));
        const collider=w.createCollider(e.R.ColliderDesc.cuboid(radius,radius,radius).setFriction(.7).setRestitution(0),body);
        for(let n=0;n<90;n++)w.step();
        assert(body.translation().y>.50, "small body tunnelled");assert(body.translation().y<.57,"not resting on floor");
        let contact=false;for(const c of ground.colliders)w.contactPair(c,collider,()=>{contact=true;});assert(contact,"native contact missing");
        w.removeRigidBody(body);
      }
      const bullet=w.createRigidBody(e.R.RigidBodyDesc.dynamic().setTranslation(.25,1,.25).setLinvel(0,-100,0).setCcdEnabled(true));
      w.createCollider(e.R.ColliderDesc.ball(.02).setRestitution(0),bullet);
      for(let n=0;n<4;n++)w.step();assert(bullet.translation().y>.49,"CCD tunnelled");
    }finally{w.free();}
  });
}
test("native XYZ neighbor coupling, incremental propagation and decoupling via fresh candidate rebuild",()=>{
  const e=engines[2];
  for(const s of [.125,.25])for(const axis of ["x","y","z"] as const){
    const f=fixture("box",s),[fa,fb]=splitFixture(f,axis),w=newWorld(e);
    try{
      const a=install(e,w,recipe(fa,"voxels")),b=install(e,w,recipe(fb,"voxels"));const shift=couple(a,b);
      assert(shift.some(n=>n!==0));publishQueries(e,w);
      const changed=fa.cells[fa.cells.length-1],next={...fa,cells:fa.cells.filter(c=>c!==changed)};
      const staging=stageEdit(a,next,true),neighbor=install(e,w,recipe(fb,"voxels"),false,false);
      couple(staging.candidate,neighbor);propagate(staging.candidate,neighbor,changed);
      // Active pair is unchanged throughout all candidate neighbor maintenance.
      const center=worldPoint(fa,vec(changed.map(n=>(n+.5)*s) as unknown as Cell));
      assert(a.colliders[0].containsPoint(center));assert(!staging.candidate.colliders[0].containsPoint(center));
      staging.rollback();w.removeRigidBody(neighbor.body);assert.equal(w.colliders.len(),2);
      // Removal has no uncombine API; rebuild a fresh survivor with unknown neighbor, never assume air.
      const fresh=install(e,w,recipe(fa,"voxels"),false,false);w.removeRigidBody(a.body);w.removeRigidBody(b.body);fresh.body.setEnabled(true);
      publishQueries(e,w);assert.equal(w.colliders.len(),1);assert(fresh.colliders[0].containsPoint(center));
      assert.throws(()=>couple(fresh,install(e,w,recipe({...fb,origin:[100,0,0]},"voxels"))),/seam/);
    }finally{w.free();}
  }
});
test("0.12 rejects native voxel adoption explicitly",()=>{
  const e=engines[0],w=newWorld(e);
  try{assert.throws(()=>install(e,w,recipe(fixture("box",.125),"voxels")),/UNSUPPORTED/);assert.equal(w.bodies.len(),0);}finally{w.free();}
});
test("native seam coupling rejects a moved body before native neighbor mutation",()=>{
  const e=engines[2],w=newWorld(e),[fa,fb]=splitFixture(fixture("box",.125),"x");
  try{
    const a=install(e,w,recipe(fa,"voxels")),b=install(e,w,recipe(fb,"voxels"));
    b.body.setTranslation({x:fb.origin[0]+.125,y:fb.origin[1],z:fb.origin[2]},false);
    assert.throws(()=>couple(a,b),/pose changed/);assert.equal(w.colliders.len(),2);
  }finally{w.free();}
});
test("native coupled XYZ seam contacts stay flat during sliding and changed-neighbor contacts invalidate",()=>{
  const e=engines[2];
  for(const s of [.125,.25])for(const axis of ["x","y","z"] as const){
    const a=["x","y","z"].indexOf(axis),n=(a+1)%3,f=fixture("box",s),[fa,fb]=splitFixture(f,axis);
    const g=[0,0,0];g[n]=-9.81;const w=new e.R.World(vec(g as unknown as Cell));
    let primary:unknown;
    try{
      let left=install(e,w,recipe(fa,"voxels")),right=install(e,w,recipe(fb,"voxels"));couple(left,right);
      for(const c of [...left.colliders,...right.colliders])c.setFriction(0);
      const radius=.1*s,p=[s*.5,s*.5,s*.5],velocity=[0,0,0];p[n]=4*s+radius+.001;velocity[a]=2*s;
      const body=w.createRigidBody(e.R.RigidBodyDesc.dynamic().setTranslation(...p as [number,number,number]).setLinvel(...velocity as [number,number,number]).setCcdEnabled(true));
      const ball=w.createCollider(e.R.ColliderDesc.ball(radius).setFriction(0).setRestitution(0),body);
      let contacts=0,min=Infinity,max=-Infinity;
      for(let k=0;k<90;k++){
        w.step();const pos=body.translation(),height=[pos.x,pos.y,pos.z][n];min=Math.min(min,height);max=Math.max(max,height);
        for(const c of [...left.colliders,...right.colliders])w.contactPair(c,ball,()=>{contacts++;});
      }
      const end=body.translation();assert([end.x,end.y,end.z][a]>3*s,"internal edge stopped sliding "+axis);
      assert(min>4*s,"seam penetration "+axis);assert(max<4*s+radius+.025,"seam launched body "+axis);assert(contacts>0);
      // Start contact at the voxel immediately to the left of the shared plane.
      const changed=[1,1,1];changed[a]=fa.bounds[a]-1;changed[n]=fa.bounds[n]-1;
      const at=changed.map(v=>(v+.5)*s);at[n]=4*s+radius;
      body.setTranslation(vec(at as unknown as Cell),true);body.setLinvel({x:0,y:0,z:0},true);
      for(let k=0;k<10;k++)w.step();
      const next={...fa,cells:fa.cells.filter(c=>c.join(":")!==changed.join(":"))};
      const staged=stageEdit(left,next,true),neighbor=install(e,w,recipe(fb,"voxels"),false,false);
      couple(staged.candidate,neighbor);propagate(staged.candidate,neighbor,changed as [number,number,number]);
      // Swap the pair in the same World; no active neighbor is modified during staging.
      w.removeRigidBody(right.body);neighbor.body.setEnabled(true);left=staged.commit();right=neighbor;
      for(let k=0;k<15;k++)w.step();
      const after=body.translation();assert([after.x,after.y,after.z][n]<4*s,"removed voxel contact persisted "+axis);
    }catch(error){primary=error;throw error;}
    finally{try{w.free();}catch(cleanup){console.error("seam cleanup failed",cleanup);if(primary===undefined)throw cleanup;}}
  }
});
