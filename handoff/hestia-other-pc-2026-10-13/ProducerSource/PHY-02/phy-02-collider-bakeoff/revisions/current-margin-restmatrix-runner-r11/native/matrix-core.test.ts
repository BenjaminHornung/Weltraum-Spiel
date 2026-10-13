import {beforeAll,expect} from "vitest";
import {Candidate,installFixture,publish,publishInstalled,stageEdit,recipe} from "../src/fork";
import {fixture,type Fixture} from "@phy02-current/fixtures";
import {rotate,worldPoint,rayOracle,vec,digest} from "@phy02-current/geometry";
import {directRay,worldRay,couple,propagate} from "@phy02-current/native";
import {active,functional,withWorld,withCleanup,observe} from "./harness";
import {prepareHvpRigidBody,installHvpRigidBody} from "@phy02-product/hestia-prototype/physics/rigidBody";
import {ingestHvpStructuralCells} from "@phy02-product/hestia-prototype/terrain/structuralIngest";
import {encodeHvpBody,decodeHvpBody} from "@phy02-product/hestia-prototype/persistence/bodyCheckpoint";
import {restoreHvpBody} from "@phy02-product/hestia-prototype/physics/restoreBody";
import {floorFixture} from "../src/fixtures";
beforeAll(()=>Candidate.init());
const zero={x:0,y:0,z:0},identity={x:0,y:0,z:0,w:1};
functional("explicit actual fork and constructor profile",()=>{
  withWorld(w=>{
    const b=w.createRigidBody(Candidate.RigidBodyDesc.dynamic());
    expect(Candidate.version()).toBe("0.21.0");expect(Candidate.PHY01_SOLVER_PROFILE.vanillaNpmBytes).toBe(false);
    expect(b.gyroscopicForcesEnabled()).toBe(active.profile==="gyroscopic-v1");
    observe({sourceProfile:Candidate.PHY01_SOLVER_PROFILE.sourceProfile,gyro:b.gyroscopicForcesEnabled(),bodies:w.bodies.len()});
  });
});
functional("geometric ray parity on both cell-size profiles uses identical canonical occupancy",()=>{
  withWorld(w=>{
    for(const size of [.125,.25]){
      for(const id of ["box","perforated-wall","cave-overhang","fine-stair","one-voxel-bridge","rotated-body"]){
        const f=fixture(id,size),i=installFixture(active,w,f);
        publish(w);let rays=0;
        for(let y=0;y<f.bounds[1];y++)for(let z=0;z<f.bounds[2];z++){
          const o={x:-size,y:(y+.5)*size,z:(z+.5)*size},d={x:1,y:0,z:0},expected=rayOracle(f,o,d);
          const hit=directRay(i,worldPoint(f,o),rotate(f.rotation,d));
          if(expected===null)expect(hit).toBeNull();else expect(hit).toBeCloseTo(expected,5);
          rays++;
        }
        observe({lastFixture:f.id,sourceDigest:i.recipe.binding.sourceDigest,rays,cellSize:size});
        w.removeRigidBody(i.body as unknown as Candidate.RigidBody);
      }
    }
  });
});
functional("query publication and staged rebuild/incremental rollback commit are step-free",()=>{
  withWorld(w=>{
    const f=fixture("perforated-wall",.125),removed=f.cells[0],next={...f,cells:f.cells.filter(c=>c.join(":")!==removed.join(":"))};
    let i=installFixture(active,w,f);const o={x:.0625,y:.0625,z:-.125},d={x:0,y:0,z:1};
    const moving=w.createRigidBody(Candidate.RigidBodyDesc.dynamic().setTranslation(20,2,0).setLinvel(1,0,0));
    w.createCollider(Candidate.ColliderDesc.ball(.2),moving);moving.sleep();
    let steps=0;const step=w.step.bind(w);w.step=(...args)=>{steps++;step(...args);};
    publish(w);expect(worldRay(i,o,d)).not.toBeNull();
    const beforeSnapshot=w.takeSnapshot(),before={p:{...moving.translation()},v:{...moving.linvel()},sleeping:moving.isSleeping()};
    publish(w);expect(w.takeSnapshot()).toEqual(beforeSnapshot);
    const original=w.colliders.len(),candidate=stageEdit(i,next,active.kind==="voxels");
    publish(w);expect(worldRay(i,o,d)).not.toBeNull();candidate.rollback();publish(w);expect(w.colliders.len()).toBe(original);
    const again=stageEdit(i,next,active.kind==="voxels");i=again.commit();publish(w);expect(worldRay(i,o,d)).toBeNull();
    expect(i.recipe.binding.sourceRevision).toBe(1);expect(i.recipe.binding.missingNeighborCoverage).toBe("UNKNOWN");
    expect({p:{...moving.translation()},v:{...moving.linvel()},sleeping:moving.isSleeping()}).toEqual(before);
    expect(steps).toBe(0);expect(w.bodies.len()).toBe(2);
    observe({physicsSteps:steps,changedCells:1,activeBodies:w.bodies.len(),colliders:w.colliders.len(),snapshotUnchangedByPublication:true});
  });
});
functional("caller predicates run before native borrow and throwing predicates preserve cleanup",()=>{
  withWorld(w=>{
    const i=installFixture(active,w,fixture("box",.125));publish(w);
    const ray=new Candidate.Ray({x:-1,y:.0625,z:.0625},{x:1,y:0,z:0});
    expect(()=>w.castRay(ray,10,true,undefined,undefined,undefined,undefined,()=>{throw new Error("preborrow");})).toThrow("preborrow");
    expect(w.castRay(ray,10,true,undefined,undefined,undefined,undefined,c=>!c.isSensor())).not.toBeNull();
    observe({predicatePolicy:Candidate.PHY01_SOLVER_PROFILE.predicatePolicy,colliders:i.colliders.length});
  });
});
functional("full canonical tensor responds to three independent angular impulses with zero shape density",()=>{
  withWorld(w=>{
    const f={...fixture("box",.125),id:"L-tensor",bounds:[2,2,1] as const,cells:[[0,0,0],[1,0,0],[0,1,0]] as const,
      rotation:{x:0,y:Math.sin(.31),z:0,w:Math.cos(.31)}};
    const i=installFixture(active,w,f,true),r=i.recipe,t=r.mass.tensor;
    // The shared historical port names vanilla types; this body was instantiated by the supplied fork.
    const b=i.body as unknown as Candidate.RigidBody;
    b.recomputeMassPropertiesFromColliders();
    expect(b.mass()).toBeCloseTo(3*2400*.125**3,5);expect(i.colliders.every(c=>c.density()===0)).toBe(true);
    const inv={...f.rotation,x:-f.rotation.x,y:-f.rotation.y,z:-f.rotation.z};
    for(const impulse of [{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}]){
      b.setAngvel(zero,true);b.applyTorqueImpulse(rotate(f.rotation,impulse),true);const v=rotate(inv,b.angvel());
      expect(t.xx*v.x+t.xy*v.y+t.xz*v.z).toBeCloseTo(impulse.x,4);
      expect(t.xy*v.x+t.yy*v.y+t.yz*v.z).toBeCloseTo(impulse.y,4);
      expect(t.xz*v.x+t.yz*v.y+t.zz*v.z).toBeCloseTo(impulse.z,4);
    }
    expect(b.gyroscopicForcesEnabled()).toBe(active.profile==="gyroscopic-v1");
    observe({mass:b.mass(),tensor:t,gyro:b.gyroscopicForcesEnabled(),cells:f.cells.length,colliders:i.colliders.length});
  });
});
functional("native snapshot restore preserves explicit profile and preborrow query adapter",()=>{
  withWorld(w=>{
    const i=installFixture(active,w,fixture("box",.125),true);publish(w);
    const restored=active.World.restoreSnapshot(w.takeSnapshot());
    return withCleanup(()=>{
      expect(restored.getRigidBody(i.body.handle).gyroscopicForcesEnabled()).toBe(active.profile==="gyroscopic-v1");
      expect(restored.createRigidBody(Candidate.RigidBodyDesc.dynamic()).gyroscopicForcesEnabled()).toBe(active.profile==="gyroscopic-v1");
      publish(restored);
      expect(()=>restored.castRay(new Candidate.Ray({x:-1,y:.0625,z:.0625},{x:1,y:0,z:0}),10,true,
        undefined,undefined,undefined,undefined,()=>{throw new Error("restored-preborrow");})).toThrow("restored-preborrow");
      observe({snapshotRestore:"PASS",publicSaveCutover:"NOT_RUN_A0_PHY03_GATE"});
    },()=>restored.free(),"restored-world");
  });
});
functional("mature body codec restores current multi-cuboid and rejects incompatible shape membership",()=>{
  withWorld(w=>{
    const source=ingestHvpStructuralCells("body-codec-L",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}],
      [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
    const r=prepareHvpRigidBody(source);
    if(active.kind!=="multi-cuboid"){
      const fixtureL={...fixture("box",.125),id:"body-codec-L",density:512,bounds:[2,2,1] as const,cells:[[0,0,0],[1,0,0],[0,1,0]] as const};
      const shape=installFixture(active,w,fixtureL,true);
      expect(shape.colliders.length).not.toBe(r.colliders.length);const count=w.bodies.len();
      expect(()=>encodeHvpBody("saved:body","terrain",r,shape.body as unknown as Parameters<typeof encodeHvpBody>[3])).toThrow();
      expect(w.bodies.len()).toBe(count);
      observe({bodyCodec:"UNSUPPORTED_EXISTING_INDEXED_SURFACES_FOR_CHANGED_REPRESENTATION",rejection:"PASS",oldMembership:r.colliders.length,newMembership:shape.colliders.length});
      return;
    }
    const body=installHvpRigidBody(w,r),saved=encodeHvpBody("saved:body","terrain",r,body);
    const decoded=decodeHvpBody(JSON.parse(JSON.stringify(saved))),before={mass:body.mass(),p:{...body.translation()},surfaces:saved.surfaces};
    const count=w.bodies.len();expect(()=>decodeHvpBody({...saved,surfaces:[]})).toThrow();expect(w.bodies.len()).toBe(count);
    const second=restoreHvpBody(w,decoded);expect(second.mass()).toBe(before.mass);expect({...second.translation()}).toEqual(before.p);
    expect(second.gyroscopicForcesEnabled()).toBe(active.profile==="gyroscopic-v1");
    observe({bodyCodec:"PASS_IN_EXPLICIT_MATCHING_PROFILE_CONTEXT",profileNotInBodyEnvelope:true,publicWorldSave:"NOT_RUN_A0_PHY03_GATE",mass:second.mass(),surfaces:before.surfaces});
  });
});
functional("natural sleep, explicit wake and query publication preserve ordinary native lifecycle",()=>{
  withWorld(w=>{
    const ground=installFixture(active,w,floorFixture());
    const body=w.createRigidBody(Candidate.RigidBodyDesc.dynamic().setTranslation(0,.6,0).setCcdEnabled(true));
    const ball=w.createCollider(Candidate.ColliderDesc.cuboid(.0625,.0625,.0625).setFriction(.7).setRestitution(0),body);
    let slept:number|null=null,contacts=0;
    for(let n=1;n<=360;n++){w.step();for(const c of ground.colliders)w.contactPair(c as unknown as Candidate.Collider,ball,()=>contacts++);if(body.isSleeping()){slept=n;break;}}
    observe({sleepTick:slept,sleepPolicy:"NATIVE_DEFAULTS_NO_DISABLE",contactCallbacks:contacts,colliders:w.colliders.len(),bodies:w.bodies.len()});
    expect(slept).not.toBeNull();expect(contacts).toBeGreaterThan(0);
    const p={...body.translation()};publish(w);expect(body.isSleeping()).toBe(true);expect({...body.translation()}).toEqual(p);
    body.wakeUp();expect(body.isSleeping()).toBe(false);publish(w);expect(body.isSleeping()).toBe(false);
  },9.81);
});

