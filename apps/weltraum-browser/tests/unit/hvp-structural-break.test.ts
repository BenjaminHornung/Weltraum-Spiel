import { beforeAll, describe, expect, it, vi } from "vitest";
import { initializeHvpRapier, R } from "../../src/hestia-prototype/physics/rapierPort";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { prepareHvpRigidBody, installHvpRigidBody } from "../../src/hestia-prototype/physics/rigidBody";
import { prepareHvpStructuralBreak, commitHvpStructuralBreak, stageHvpStructuralBreak } from "../../src/hestia-prototype/physics/structuralBreak";
import { StructuralPhysicsCommitError } from "../../src/voxel/structural";

beforeAll(initializeHvpRapier);
const cells=[{x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:2,z:0},{x:1,y:2,z:0},{x:2,y:2,z:0},{x:3,y:2,z:0}]
  .map(cell=>({...cell,materialId:1}));
const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
const source=()=>ingestHvpStructuralCells("support-arm",cells,materials,[{x:0,y:0,z:0}]);
const shape={min:{x:1,y:2,z:0},max:{x:2,y:3,z:1}};

describe("HVP structural cut and native split",()=>{
  it("uses the real six-cell command partition: three anchored, two falling, one removed",()=>{
    const live=source();const plan=prepareHvpStructuralBreak(live,shape,"cut-1");
    expect(plan.removedMassKg).toBeCloseTo(1,10);
    expect(plan.parts.filter(part=>part.anchored).map(part=>part.cells.length)).toEqual([3]);
    expect(plan.parts.filter(part=>!part.anchored).map(part=>part.cells.length)).toEqual([2]);
    const world=new R.World({x:0,y:-9.81,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent-geometry",cells,materials)),
        {translationMeters:{x:0,y:2,z:0},rotation:{x:0,y:0,z:0,w:1}},undefined,false);
      const result=commitHvpStructuralBreak(world,parent,live,plan);
      expect(result.parts.map(part=>part.body.numColliders())).toEqual([1,1]);
      expect(world.getRigidBody(parent.handle)).toBeNull();
      const falling=result.parts.find(part=>!part.anchored)!;
      expect(falling.body.mass()).toBeCloseTo(2,6);
      const start=falling.body.translation().y;
      for(let i=0;i<30;i+=1) { world.step(); }
      expect(falling.body.translation().y).toBeLessThan(start-.5);
      expect(result.parts.find(part=>part.anchored)!.body.translation().y).toBeCloseTo(2+.1875,5);
    } finally { world.free(); }
  });

  it("inherits current rotated parent COM and point velocities, not a post-cut reference",()=>{
    const live=ingestHvpStructuralCells("moving-arm",cells,materials);
    const plan=prepareHvpStructuralBreak(live,shape,"moving-cut");
    const world=new R.World({x:0,y:0,z:0});
    const q={x:0,y:0,z:Math.sin(Math.PI/8),w:Math.cos(Math.PI/8)};
    const rotate=(p:{x:number;y:number;z:number})=>({x:(p.x-p.y)/Math.sqrt(2),y:(p.x+p.y)/Math.sqrt(2),z:p.z});
    const V={x:1,y:.5,z:-.25},W={x:0,y:1.5,z:2};
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(live),{translationMeters:{x:1,y:2,z:3},rotation:q},
        {velocityMetersPerSecond:V,angularVelocityRadPerSecond:W});
      const result=commitHvpStructuralBreak(world,parent,live,plan);
      const pre={x:.1875,y:.25,z:.0625};
      for(const part of result.parts) {
        const c=part.cells.some(cell=>cell.x===0)?{x:.0625,y:.1875,z:.0625}:{x:.375,y:.3125,z:.0625};
        const r=rotate(c),arm=rotate({x:c.x-pre.x,y:c.y-pre.y,z:c.z-pre.z});
        expect(part.body.translation().x).toBeCloseTo(1+r.x,5);
        expect(part.body.translation().y).toBeCloseTo(2+r.y,5);
        expect(part.body.translation().z).toBeCloseTo(3+r.z,5);
        expect(part.body.linvel().x).toBeCloseTo(V.x+W.y*arm.z-W.z*arm.y,5);
        expect(part.body.linvel().y).toBeCloseTo(V.y+W.z*arm.x-W.x*arm.z,5);
        expect(part.body.linvel().z).toBeCloseTo(V.z+W.x*arm.y-W.y*arm.x,5);
        expect(part.body.angvel().y).toBeCloseTo(W.y,6);
        expect(part.body.rotation().z).toBeCloseTo(q.z,6);
      }
    } finally { world.free(); }
  });

  it("uses actual rotated native collision at the 45-degree negative and positive probes",()=>{
    const probe=(angle:number,offset:number)=>{
      const world=new R.World({x:0,y:0,z:0});
      try {
        const c=Math.cos(angle),s=Math.sin(angle);
        const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("cube",[{x:0,y:0,z:0,materialId:1}],materials));
        installHvpRigidBody(world,recipe,{translationMeters:{x:-(c-s)/16,y:-(c+s)/16,z:-1/16},
          rotation:{x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}});
        world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
        return world.intersectionWithShape({x:offset,y:offset,z:0},{x:0,y:0,z:0,w:1},new R.Ball(.001))!==null;
      } finally { world.free(); }
    };
    expect(probe(Math.PI/4,.06)).toBe(false);
    expect(probe(0,.06)).toBe(true);
    expect(probe(Math.PI/4,.03)).toBe(true);
  });

  it.each(["typed","plain"])("rolls back a %s failure after a real child collider was created",kind=>{
    const live=source(),plan=prepareHvpStructuralBreak(live,shape,`fail-${kind}`),world=new R.World({x:0,y:-9.81,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent",cells,materials)));
      const original=world.createCollider.bind(world);let added=0;
      const spy=vi.spyOn(world,"createCollider").mockImplementation((...args)=>{
        const collider=original(...args);added+=1;
        if(added===2) {
          if(kind==="typed") { throw new StructuralPhysicsCommitError("CommitFailed","fault","post-add","create",true); }
          throw new Error("plain post-add");
        }
        return collider;
      });
      let caught:unknown;try { commitHvpStructuralBreak(world,parent,live,plan); } catch(error) { caught=error; }
      expect(added).toBe(2);expect(caught).toBeInstanceOf(StructuralPhysicsCommitError);
      expect((caught as StructuralPhysicsCommitError).worldRestored).toBe(true);
      expect(world.getRigidBody(parent.handle)).toBe(parent);
      expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(parent.numColliders());
      spy.mockRestore();
    } finally { vi.restoreAllMocks();world.free(); }
  });

  it("reports unproven cleanup honestly instead of claiming restored counts",()=>{
    const live=source(),plan=prepareHvpStructuralBreak(live,shape,"cleanup"),world=new R.World({x:0,y:0,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent",cells,materials)));
      vi.spyOn(world,"createCollider").mockImplementation(()=>{throw new Error("add");});
      vi.spyOn(world,"removeRigidBody").mockImplementation(()=>{throw new Error("cleanup");});
      let caught:unknown;try {commitHvpStructuralBreak(world,parent,live,plan);}catch(error){caught=error;}
      expect(caught).toBeInstanceOf(StructuralPhysicsCommitError);
      expect((caught as StructuralPhysicsCommitError).worldRestored).toBe(false);
      expect(world.bodies.len()).toBeGreaterThan(1);
      expect(world.getRigidBody(parent.handle)).toBe(parent);
    } finally {vi.restoreAllMocks();world.free();}
  });

  it.each([false,true])("checks actual parent membership when Remove throws afterEffect=%s",after=>{
    const live=source(),plan=prepareHvpStructuralBreak(live,shape,`remove-${after}`),world=new R.World({x:0,y:0,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent",cells,materials)));
      const remove=world.removeRigidBody.bind(world);let caught:unknown;
      vi.spyOn(world,"removeRigidBody").mockImplementation(body=>{
        if(body===parent) {if(after){remove(body);}throw new Error("parent remove");}
        remove(body);
      });
      try {commitHvpStructuralBreak(world,parent,live,plan);}catch(error){caught=error;}
      expect((caught as StructuralPhysicsCommitError).worldRestored).toBe(!after);
      expect(world.getRigidBody(parent.handle)===parent).toBe(!after);
      // After-effect uncertainty retains the installed children for RecoveryHold.
      expect(world.bodies.len()).toBe(after?2:1);
    } finally {vi.restoreAllMocks();world.free();}
  });

  it("rejects reentrant and fabricated partition plans before a second mutation",()=>{
    const live=source(),plan=prepareHvpStructuralBreak(live,shape,"reentrant"),world=new R.World({x:0,y:0,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent",cells,materials)));
      expect(()=>commitHvpStructuralBreak(world,parent,live,{...plan,parts:[]})).toThrow(/foreign/);
      expect(world.bodies.len()).toBe(1);
      const create=world.createCollider.bind(world);let rejected=0;
      vi.spyOn(world,"createCollider").mockImplementation((...args)=>{
        expect(()=>commitHvpStructuralBreak(world,parent,live,plan)).toThrow(/reentrant/);rejected+=1;
        return create(...args);
      });
      const result=commitHvpStructuralBreak(world,parent,live,plan);
      expect(rejected).toBeGreaterThan(0);expect(result.parts).toHaveLength(2);expect(world.bodies.len()).toBe(2);
    } finally {vi.restoreAllMocks();world.free();}
  });

  it("keeps the native parent until publication and can restore a committed held stage",()=>{
    const live=source(),plan=prepareHvpStructuralBreak(live,shape,"held"),world=new R.World({x:0,y:0,z:0});
    try {
      const parent=installHvpRigidBody(world,prepareHvpRigidBody(ingestHvpStructuralCells("parent",cells,materials)));
      const stage=stageHvpStructuralBreak(world,parent,live,plan);
      expect(parent.isEnabled()).toBe(true);expect(stage.result.parts.every(p=>!p.body.isEnabled())).toBe(true);
      stage.commit();expect(parent.isEnabled()).toBe(false);expect(world.getRigidBody(parent.handle)).toBe(parent);
      expect(stage.result.parts.every(p=>p.body.isEnabled())).toBe(true);
      stage.rollback();expect(parent.isEnabled()).toBe(true);expect(world.bodies.len()).toBe(1);
    }finally {world.free();}
  });
});
