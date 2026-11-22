import { beforeAll,expect,it } from "vitest";
import { serialize } from "node:v8";
import { MessageChannel } from "node:worker_threads";
import { HVP_SOURCE_MIN_METERS } from "../../../src/hvp/hvpCoastSource";
import { R,initializeHvpRapier } from "../../../src/hestia-prototype/physics/rapierPort";
import { HVP_PLAYER_PROFILE } from "../../../src/hestia-prototype/physics/profile";
import { installHvpRigidBody } from "../../../src/hestia-prototype/physics/rigidBody";
import { prepareHvpTerrainFragment } from "../../../src/hestia-prototype/physics/terrainFragment";
import { captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut } from "../../../src/hestia-prototype/physics/bodyCut";
import { prepareHvpRigidBody } from "../../../src/hestia-prototype/physics/rigidRecipe";
import { encodeStructuralObject,decodeStructuralObject,mapStructuralAuthorPointToWorld,rotateStructuralWorldVector } from "../../../src/voxel/structural";
import { createTerrainComponentIndex,materializeCompactCells,type CompactTerrainFragment } from "../../../src/voxel/structural/componentIndex";
import { analyzeHvpTerrainSupport } from "../../../src/hestia-prototype/terrain/supportPlan";
import { rootFor,uFixture,cutAt } from "./compactFixtures";

beforeAll(initializeHvpRapier);
const identity={x:0,y:0,z:0,w:1};
const rotation={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2};
const pose={rotation,translationMeters:{x:0,y:-3*.125,z:0}};

async function deliver(fragment:CompactTerrainFragment) {
  const {port1,port2}=new MessageChannel();
  try {
    const receipt=new Promise<CompactTerrainFragment>(resolve=>port2.once("message",resolve));
    port1.postMessage(fragment);
    return await receipt;
  } finally { port1.close();port2.close(); }
}

it("installs a rotated U from a cold transport, queries its opening before stepping and recuts it in ground contact",async()=>{
  const root=rootFor(uFixture()),cut=cutAt(root,[12,2,4]);
  const index=createTerrainComponentIndex(cut.before),candidate=index.prepareCompact(cut);
  expect(candidate.status).toBe("Ready");
  const f=candidate.fragments[0],reference=analyzeHvpTerrainSupport(cut).fragments[0];
  const wireStart=performance.now(),wire=await deliver(f),receive=performance.now();
  const cold=materializeCompactCells(wire);
  expect(cold).toEqual(reference.cells);expect(wire.parts[0]).not.toBe(f.parts[0]);
  const sourceBytes=serialize(f.parts).byteLength, legacyBytes=serialize(reference.cells).byteLength;
  index.dispose();expect(index.residentBytes()).toBe(0);expect(()=>index.prepareCompact(cut)).toThrow(/Disposed/);
  const request={ownerId:wire.ownerId,origin:HVP_SOURCE_MIN_METERS,massKg:wire.massKg,colliderBoxes:wire.colliderBoxes,cells:cold};
  const recipe=prepareHvpTerrainFragment(request,wire.revision);
  const oracle=prepareHvpTerrainFragment({...request,cells:reference.cells,colliderBoxes:reference.colliderBoxes,massKg:reference.massKg},wire.revision);
  expect(recipe.source.contentHash).toBe(oracle.source.contentHash);
  const restored=prepareHvpRigidBody(decodeStructuralObject(encodeStructuralObject(recipe.source)));
  const outcomes=[];
  for(const [lane,input] of [["compact",recipe],["cell-oracle",oracle],["cold-source",restored]] as const) {
    const world=new R.World({x:0,y:-9.81,z:0});
    try {
      const floor=world.createCollider(R.ColliderDesc.cuboid(6,.1,6).setTranslation(0,-.1,0));
      const before=performance.now(),body=installHvpRigidBody(world,input,pose),installed=performance.now();
      world.updateSceneQueries();const refreshed=performance.now();
      const direction={x:1,y:0,z:0},centerZ=-18.5*.125;
      expect(world.castRay(new R.Ray({x:-1,y:1.25,z:centerZ},direction),4,true)).toBeNull();
      const wall=world.castRay(new R.Ray({x:-1,y:1.25,z:-12.5*.125},direction),4,true);
      expect(wall?.collider.parent()?.handle).toBe(body.handle);
      const capsule=new R.Capsule(HVP_PLAYER_PROFILE.height/2-HVP_PLAYER_PROFILE.radius,HVP_PLAYER_PROFILE.radius);
      expect(world.intersectionWithShape({x:4.5*.125,y:1.25,z:centerZ},identity,capsule)).toBeNull();
      expect(world.intersectionWithShape({x:4.5*.125,y:1.25,z:-12.5*.125},identity,capsule)?.parent()?.handle).toBe(body.handle);
      const queried=performance.now();
      for(let tick=0;tick<8;tick++) world.step();
      let contacts=0;
      world.contactPairsWith(floor,c=>{
        if(c.parent()?.handle===body.handle) world.contactPair(floor,c,m=>{contacts+=m.numSolverContacts();});
      });
      expect(contacts).toBeGreaterThan(0);
      const parent={...body.translation()},orientation={...body.rotation()},center=input.mass.centerOfMassMeters!;
      const eye=mapStructuralAuthorPointToWorld(orientation,parent,center,{x:18.5*.125,y:3.5*.125,z:-.25});
      const ray=rotateStructuralWorldVector(orientation,{x:0,y:0,z:1});
      const target={ownerId:wire.ownerId,body,recipe:input};
      const hit=captureHvpBodyHit(world,new Map([[target.ownerId,target]]),eye,ray,8)!;
      expect(hit.cell).toEqual([18,3,4]);
      const plan=prepareHvpBodyCut(hit,target,"rotated-u-recut",1);
      const v={x:.25,y:.35,z:-.8},w={x:.3,y:-.4,z:1.5};
      body.setLinvel(v,true);body.setAngvel(w,true);
      const old=Array.from({length:body.numColliders()},(_,i)=>body.collider(i).handle);
      const stage=stageHvpBodyCut(world,target,plan);
      stage.commit();stage.finalize();world.updateSceneQueries();
      expect(stage.result.parts).toHaveLength(2);
      const childData=stage.result.parts.map(child=>{
        const p=child.body.translation(),dx=p.x-parent.x,dy=p.y-parent.y,dz=p.z-parent.z;
        const vel=child.body.linvel(),omega=child.body.angvel();
        expect(vel.x).toBeCloseTo(v.x+w.y*dz-w.z*dy,5);expect(vel.y).toBeCloseTo(v.y+w.z*dx-w.x*dz,5);
        expect(vel.z).toBeCloseTo(v.z+w.x*dy-w.y*dx,5);
        expect(omega.x).toBeCloseTo(w.x,5);expect(omega.y).toBeCloseTo(w.y,5);expect(omega.z).toBeCloseTo(w.z,5);
        return {cells:child.cells,velocity:{...vel},angular:{...omega},mass:child.body.mass()};
      });
      for(const handle of old) expect(world.getCollider(handle)).toBeNull();
      expect(world.castRay(new R.Ray(eye,ray),4,true)).toBeNull();
      outcomes.push(childData);
      console.info("P1_NATIVE",JSON.stringify({lane,wireMode:"self-contained/no-prior-residency",v8PartsBytes:sourceBytes,
        v8CellArrayBytes:legacyBytes,cloneDeliveryMs:receive-wireStart,nativeBuildMs:installed-before,queryRefreshMs:refreshed-installed,
        heldQueryProbeMs:queried-refreshed,nativeCreates:input.colliders.length,removedHandles:old.length,contacts,preStep:true}));
    } finally {world.free();}
  }
  expect(outcomes[0]).toEqual(outcomes[1]);expect(outcomes[0]).toEqual(outcomes[2]);
},120000);
