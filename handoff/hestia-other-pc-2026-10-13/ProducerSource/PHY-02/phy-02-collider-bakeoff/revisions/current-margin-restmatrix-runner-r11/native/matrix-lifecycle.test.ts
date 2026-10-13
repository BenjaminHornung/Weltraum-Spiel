import {beforeAll,expect} from "vitest";
import {Candidate,installFixture,publish,stageEdit} from "../src/fork";
import {fixture,splitFixture,type Cell} from "@phy02-current/fixtures";
import {couple,propagate,worldRay} from "@phy02-current/native";
import {worldPoint,vec} from "@phy02-current/geometry";
import {active,functional,observe,withWorld} from "./harness";
import {ingestHvpStructuralCells} from "@phy02-product/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "@phy02-product/hestia-prototype/physics/rigidBody";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut} from "@phy02-product/hestia-prototype/physics/bodyCut";
beforeAll(()=>Candidate.init());
functional("mature issued-hit cut and actual child recut in the explicit matching profile",()=>withWorld(w=>{
  if(active.kind!=="multi-cuboid"){
    observe({matureBodyCut:"UNSUPPORTED_CHANGED_REPRESENTATION_CONTRACT",primitiveRecut:"SEPARATE_CASE"});return;
  }
  const r=prepareHvpRigidBody(ingestHvpStructuralCells("moving-source",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null}]));
  const body=installHvpRigidBody(w,r,{translationMeters:{x:1,y:2,z:3},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
  const target={ownerId:"moving-parent",body,recipe:r};
  const hit=captureHvpBodyHit(w,new Map([[target.ownerId,target]]),{x:.9375,y:2.3125,z:2},{x:0,y:0,z:1},0)!;
  const plan=prepareHvpBodyCut(hit,target,"first",1);
  body.setLinvel({x:1,y:2,z:3},true);body.setAngvel({x:0,y:0,z:2},true);
  for(let i=0;i<12;i++)w.step();const pose={...body.translation()};
  const first=stageHvpBodyCut(w,target,plan);expect(first.parentPose.position).toEqual(pose);first.commit();first.finalize();
  const part=first.result.parts.find(p=>p.cells.some(c=>c.x===0))!;
  const child={ownerId:part.ownerId,body:part.body,recipe:plan.local.plan.parts.find(p=>p.ownerId===part.ownerId)!.recipe};
  const p=child.body.collider(0).translation(),again=captureHvpBodyHit(w,new Map([[child.ownerId,child]]),{x:p.x,y:p.y,z:p.z-1},{x:0,y:0,z:1},1)!;
  const next=prepareHvpBodyCut(again,child,"second",1),second=stageHvpBodyCut(w,child,next);
  expect(next.local.plan.removedCells).toBe(1);expect(second.result.parts.reduce((n,c)=>n+c.cells.length,0)).toBe(1);
  second.commit();second.finalize();expect(w.getRigidBody(child.body.handle)).toBeNull();expect(w.bodies.len()).toBe(2);
  expect(w.bodies.getAll().every(b=>b.gyroscopicForcesEnabled()===(active.profile==="gyroscopic-v1"))).toBe(true);
  observe({matureBodyCut:"PASS_TINY_FUNCTIONAL_SOURCE_COMMAND",firstRemovedCells:plan.local.plan.removedCells,
    recutRemovedCells:next.local.plan.removedCells,bodies:w.bodies.len(),colliders:w.colliders.len(),fullMovingHvp:"NOT_RUN_MISSING_REAL_INPUT_AND_SLOT"});
}));
functional("dynamic staged recut preserves active state and detached disposal leaves no ghosts",()=>withWorld(w=>{
  const f=fixture("perforated-wall",.125),removed=f.cells[0],next={...f,cells:f.cells.filter(c=>c!==removed)};
  let i=installFixture(active,w,f,true);
  const b=i.body;b.setLinvel({x:1,y:2,z:3},true);b.setAngvel({x:.1,y:.2,z:.3},true);b.sleep();publish(w);
  const state=()=>({p:{...b.translation()},v:{...b.linvel()},a:{...b.angvel()},sleep:b.isSleeping(),mass:b.mass()});
  const before=state(),count=w.colliders.len(),staged=stageEdit(i,next,active.kind==="voxels");
  expect(staged.candidate.body.isEnabled()).toBe(false);staged.rollback();publish(w);
  expect(state()).toEqual(before);expect(w.colliders.len()).toBe(count);expect(()=>staged.commit()).toThrow();
  const again=stageEdit(i,next,active.kind==="voxels");i=again.commit();publish(w);
  const sleepAfterCommit=i.body.isSleeping();
  expect(i.body.linvel()).toEqual(before.v);expect(i.body.angvel()).toEqual(before.a);expect(w.bodies.len()).toBe(1);
  const child=installFixture(active,w,{...f,id:"detached",cells:[removed],origin:[1,0,0]},true);publish(w);
  expect(w.bodies.len()).toBe(2);w.removeRigidBody(child.body as unknown as Candidate.RigidBody);publish(w);
  i=stageEdit(i,f,false).commit();publish(w);
  expect(worldRay(i,{x:.0625,y:.0625,z:-.125},{x:0,y:0,z:1})).not.toBeNull();
  expect(w.bodies.len()).toBe(1);expect(w.colliders.len()).toBe(i.colliders.length);
  observe({sourceRevision:i.recipe.binding.sourceRevision,detachedDisposal:"PASS",activeBodies:w.bodies.len(),
    caveat:"Derived primitive recut; real HVP command stream is a separate gate",sleepBefore:before.sleep,sleepAfterCommit});
  expect(sleepAfterCommit,"same-world primitive swap preserves sleeping state").toBe(before.sleep);
}));
functional("native XYZ neighbors stage propagation and rebuild unknown survivors without active mutation",()=>withWorld(w=>{
  if(active.kind!=="voxels"){observe({nativeNeighborApi:"NOT_APPLICABLE",coverage:"UNKNOWN"});return;}
  let pairs=0;
  for(const s of [.125,.25])for(const axis of ["x","y","z"] as const){
    const [fa,fb]=splitFixture(fixture("box",s),axis),a=installFixture(active,w,fa),b=installFixture(active,w,fb);
    couple(a,b);publish(w);const changed=fa.cells[fa.cells.length-1],next={...fa,cells:fa.cells.filter(c=>c!==changed)};
    const staged=stageEdit(a,next,true),neighbor=installFixture(active,w,fb);neighbor.body.setEnabled(false);
    couple(staged.candidate,neighbor);propagate(staged.candidate,neighbor,changed);
    const center=worldPoint(fa,vec(changed.map(n=>(n+.5)*s) as unknown as Cell));
    expect(a.colliders[0].containsPoint(center)).toBe(true);expect(staged.candidate.colliders[0].containsPoint(center)).toBe(false);
    staged.rollback();w.removeRigidBody(neighbor.body as unknown as Candidate.RigidBody);expect(w.colliders.len()).toBe(2);
    const fresh=installFixture(active,w,fa);fresh.body.setEnabled(false);
    w.removeRigidBody(a.body as unknown as Candidate.RigidBody);w.removeRigidBody(b.body as unknown as Candidate.RigidBody);
    fresh.body.setEnabled(true);publish(w);expect(w.colliders.len()).toBe(1);expect(fresh.recipe.binding.missingNeighborCoverage).toBe("UNKNOWN");
    expect(fresh.colliders[0].containsPoint(center)).toBe(true);w.removeRigidBody(fresh.body as unknown as Candidate.RigidBody);pairs++;
  }
  observe({geometryPairs:pairs,changedContactInvalidation:"SEPARATE_SEAM_CASE",bodies:w.bodies.len(),colliders:w.colliders.len()});
}));
functional("unchanged small rotated falls and CCD contact oracles",()=>withWorld(w=>{
  const ground=installFixture(active,w,fixture("box",.125));
  for(const rotated of [false,true]){
    const body=w.createRigidBody(Candidate.RigidBodyDesc.dynamic().setTranslation(.25,1,.25)
      .setRotation(rotated?{x:0,y:0,z:Math.sin(.2),w:Math.cos(.2)}:{x:0,y:0,z:0,w:1}).setCcdEnabled(true));
    const collider=w.createCollider(Candidate.ColliderDesc.cuboid(.025,.025,.025).setFriction(.7).setRestitution(0),body);
    let steps=0;for(let n=0;n<90;n++){w.step();steps++;observe({rotated,steps,position:body.translation()});}
    expect(body.translation().y).toBeGreaterThan(.50);expect(body.translation().y).toBeLessThan(.57);
    let contact=false;for(const c of ground.colliders)w.contactPair(c as unknown as Candidate.Collider,collider,()=>{contact=true;});
    expect(contact).toBe(true);w.removeRigidBody(body);
  }
  const bullet=w.createRigidBody(Candidate.RigidBodyDesc.dynamic().setTranslation(.25,1,.25).setLinvel(0,-100,0).setCcdEnabled(true));
  w.createCollider(Candidate.ColliderDesc.ball(.02).setRestitution(0),bullet);
  for(let n=0;n<4;n++)w.step();expect(bullet.translation().y).toBeGreaterThan(.49);
  observe({ccdPosition:bullet.translation(),bodies:w.bodies.len(),colliders:w.colliders.len()});
},9.81));

