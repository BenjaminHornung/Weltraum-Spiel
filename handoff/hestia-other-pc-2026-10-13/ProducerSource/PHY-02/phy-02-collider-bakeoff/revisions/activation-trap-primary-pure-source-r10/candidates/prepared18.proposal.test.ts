// SOURCE PREPARATION ONLY: NOT_RUN. Requires a separate execution disposition.
import {beforeAll,expect,it} from "vitest";
import {prepareCase,receiverBatch,type CaseObservation} from "./observer";
export const cleanupObservations:CaseObservation[]=[];
import {Candidate,context,worldFor,installFixture,publish} from "../../phy01-migration2-r01/src/fork";
import {fixture} from "../../phy01-migration2-r01/previous/src/fixtures";
import {stageEdit} from "./stageEdit";
beforeAll(()=>Candidate.init());
for(const profile of ["legacy-impulse-v1","gyroscopic-v1"] as const){
  for(const kind of ["triangles","multi-cuboid","voxels"] as const){
    for(const parentState of ["sleeping","awake","wakes-after-stage"] as const){
      it(`${profile}/${kind}: transfer latest activation (${parentState}) without ghosts or profile rewrite`,ctx=>{
        if(receiverBatch.poisoned){ctx.skip("Earlier trap or cleanup failure poisoned this receiver module instance");return;}
        const owned=prepareCase(receiverBatch,`${profile}/${kind}/${parentState}`);
        cleanupObservations.push(owned.observation);
        const c=context(profile,kind);
        owned.run(()=>worldFor(c),w=>{
          const f=fixture("perforated-wall",.125),next={...f,cells:f.cells.slice(1)};
          const parent=installFixture(c,w,f,true);
          if(parentState!=="awake")parent.body.sleep();
          else {parent.body.setLinvel({x:1,y:2,z:3},true);parent.body.setAngvel({x:.1,y:.2,z:.3},true);}
          const count=w.colliders.len(),rollback=stageEdit(parent,next,kind==="voxels");
          const initialSleep=parent.body.isSleeping();rollback.rollback();publish(w);
          expect(parent.body.isSleeping()).toBe(initialSleep);expect(w.colliders.len()).toBe(count);
          const staged=stageEdit(parent,next,kind==="voxels");
          expect(staged.candidate.body.isEnabled()).toBe(false);
          if(parentState==="wakes-after-stage")parent.body.wakeUp();
          const latest={sleep:parent.body.isSleeping(),p:{...parent.body.translation()},q:{...parent.body.rotation()},v:{...parent.body.linvel()},a:{...parent.body.angvel()}};
          const committed=staged.commit();publish(w);
          expect(committed.body.isSleeping()).toBe(latest.sleep);
          expect({...committed.body.translation()}).toEqual(latest.p);expect({...committed.body.rotation()}).toEqual(latest.q);
          expect({...committed.body.linvel()}).toEqual(latest.v);expect({...committed.body.angvel()}).toEqual(latest.a);
          expect(w.bodies.len()).toBe(1);expect(w.colliders.len()).toBe(committed.colliders.length);
          expect((committed.body as unknown as Candidate.RigidBody).gyroscopicForcesEnabled()).toBe(profile==="gyroscopic-v1");
          expect(committed.colliders.every(x=>x.density()===0)).toBe(true);
          committed.body.recomputeMassPropertiesFromColliders();expect(committed.body.mass()).toBeCloseTo(committed.recipe.mass.mass,5);
        },w=>w.free());
      });
    }
  }
}

