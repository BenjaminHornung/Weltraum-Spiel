// SOURCE_ONLY / NO_GRANTS: never register or execute this source in this task.
import {beforeAll,expect} from "vitest";
import {Candidate,installFixture,publish} from "../../phy01-migration2-r01/src/fork";
import {stageEdit} from "./stageEdit";
import {fixture} from "../../phy01-migration2-r01/previous/src/fixtures";
import {worldRay} from "../../phy01-migration2-r01/previous/src/native";
import {active,functional,observe,withWorld} from "./harness";
beforeAll(()=>Candidate.init());

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

