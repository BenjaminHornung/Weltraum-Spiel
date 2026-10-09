import {beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {installHvpRigidBody,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpBodyResidency} from "../../src/hestia-prototype/physics/bodyResidency";
import * as residency from "../../src/hestia-prototype/physics/bodyResidency";
import body384 from "../fixtures/hvp-contact-r90-body384.json";
import {decodeHvpColdBody,encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import * as checkpoints from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {restoreHvpBody} from "../../src/hestia-prototype/physics/restoreBody";
import {createStructuralOwnerLedger,isOwnedStructuralGraph} from "../../src/voxel/structural/model";
import * as model from "../../src/voxel/structural/model";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../src/voxel/adaptive";
import type {HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
beforeAll(initializeHvpRapier);
it("captures canonical live motion with the exact issued owned recipe and rejects an unowned recipe",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128),decoded=decodeHvpColdBody(body384,ledger.reserve);
  const world=new R.World({x:0,y:-9.81,z:0}),body=restoreHvpBody(world,decoded);
  const capture=(checkpoints as typeof checkpoints&{captureHvpOwnedBody:(...args:Parameters<typeof encodeHvpBody>)=>typeof decoded}).captureHvpOwnedBody;
  try{
    expect(typeof capture).toBe("function");
    body.setLinvel({x:-0,y:1.25,z:-2.5},false);body.setAngvel({x:0,y:.5,z:-0},false);
    const saved=encodeHvpBody(body384.ownerId,"terrain",decoded.recipe,body),captured=capture(body384.ownerId,"terrain",decoded.recipe,body);
    expect(captured.recipe).toBe(decoded.recipe);expect(captured.checkpoint).toEqual(saved);
    expect(captured.motion).toEqual(checkpoints.decodeHvpBody(saved).motion);
    checkpoints.assertHvpDecodedBody(captured);
    expect(()=>checkpoints.assertHvpDecodedBody({...captured})).toThrow(/Unvalidated/);
    const publicRecipe=checkpoints.decodeHvpBody(saved).recipe;
    expect(()=>capture(body384.ownerId,"terrain",publicRecipe,body)).toThrow(/owned Source/);
    expect(()=>capture(body384.ownerId,"terrain",{...decoded.recipe},body)).toThrow(/Unvalidated/);
    expect(world.bodies.len()).toBe(1);
  }finally{world.free();ledger.release();}
},120_000);
it("wakes the actual cold parked Body384 with its exact prepared recipe and owned Source instead of decoding again",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128),checkpoint={...body384,sleeping:true};
  const decoded=decodeHvpColdBody(checkpoint,ledger.reserve),world=new R.World({x:0,y:-9.81,z:0});
  const targets=new Map<string,HvpCuttableBody>(),bodies=new Map<string,R.RigidBody>();
  const factory=(residency as typeof residency&{createHvpWorkerBodyResidency:typeof createHvpBodyResidency}).createHvpWorkerBodyResidency;
  try{
    expect(typeof factory).toBe("function");
    const dormant=factory(world,targets,bodies,()=>true,[decoded]);
    expect(world.bodies.len()).toBe(0);
    expect(dormant.restore(checkpoint.ownerId)).toBe(true);
    const target=targets.get(checkpoint.ownerId)!;
    expect(target.recipe).toBe(decoded.recipe);
    expect(target.recipe.source).toBe(decoded.recipe.source);
    expect(isOwnedStructuralGraph(target.recipe.source)).toBe(true);
    expect(encodeHvpBody(checkpoint.ownerId,"terrain",target.recipe,target.body)).toEqual(checkpoint);
    expect(dormant.checkpoint()).toEqual([]);
  }finally{world.free();ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
},120_000);
const setup=()=>{
  const world=new R.World({x:0,y:-9.81,z:0});
  world.createCollider(R.ColliderDesc.cuboid(2,.1,2).setTranslation(0,-.1,0));
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("resident-rock",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}],
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null}]));
  const body=installHvpRigidBody(world,recipe,{translationMeters:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1}});
  const targets=new Map<string,HvpCuttableBody>([["rock",{ownerId:"rock",body,recipe,family:"terrain"}]]),bodies=new Map([["rock",body]]);
  return {world,body,recipe,targets,bodies};
};
it("keeps one exact owned recipe across real live park wake park wake and complete native Saves",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128),decoded=decodeHvpColdBody({...body384,sleeping:true},ledger.reserve);
  const world=new R.World({x:0,y:-9.81,z:0}),body=restoreHvpBody(world,decoded);
  const targets=new Map<string,HvpCuttableBody>([[body384.ownerId,{ownerId:body384.ownerId,body,recipe:decoded.recipe,family:"terrain"}]]);
  const bodies=new Map([[body384.ownerId,body]]),dormant=residency.createHvpWorkerBodyResidency(world,targets,bodies,()=>true);
  try{
    const player={x:body.translation().x+30,y:0,z:body.translation().z};
    for(let cycle=0;cycle<4;cycle+=1){
      const current=targets.get(body384.ownerId)!,saved=encodeHvpBody(body384.ownerId,"terrain",current.recipe,current.body);
      expect(dormant.park(body384.ownerId,player)).toBe(true);expect(world.bodies.len()).toBe(0);
      expect(dormant.checkpoint()).toEqual([saved]);expect(dormant.restore(body384.ownerId)).toBe(true);
      const awake=targets.get(body384.ownerId)!;expect(awake.recipe).toBe(decoded.recipe);
      expect(encodeHvpBody(body384.ownerId,"terrain",awake.recipe,awake.body)).toEqual(saved);
    }
  }finally{world.free();ledger.release();}
},120_000);
it("prepares a legacy live recipe once at park and reuses the private owned result on every wake",()=>{
  const h=setup(),dormant=residency.createHvpWorkerBodyResidency(h.world,h.targets,h.bodies,()=>true);
  try{
    h.body.sleep();const before=encodeHvpBody("rock","terrain",h.recipe,h.body);
    expect(dormant.park("rock",{x:30,y:0,z:0})).toBe(true);expect(dormant.restore("rock")).toBe(true);
    const first=h.targets.get("rock")!;expect(isOwnedStructuralGraph(first.recipe.source)).toBe(true);
    expect(encodeHvpBody("rock","terrain",first.recipe,first.body)).toEqual(before);
    expect(dormant.park("rock",{x:30,y:0,z:0})).toBe(true);expect(dormant.restore("rock")).toBe(true);
    expect(h.targets.get("rock")!.recipe).toBe(first.recipe);
    expect(dormant.park("rock",{x:30,y:0,z:0})).toBe(true);dormant.dispose();
    expect(dormant.retainedRecipes()).toEqual([]);expect(dormant.checkpoint()).toEqual([]);
    expect(()=>dormant.restore("rock")).toThrow(/disposed/);
  }finally{h.world.free();}
},120_000);
it("rejects private park preparation above the original cap before any native removal and releases its ledger",()=>{
  const h=setup(),dormant=residency.createHvpWorkerBodyResidency(h.world,h.targets,h.bodies,()=>true);
  const factory=model.createStructuralOwnerLedger;let ledger:ReturnType<typeof factory>|undefined;
  const constrained=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((resident,_limit,hashUnits)=>{
    ledger=factory(resident,1,hashUnits);return ledger;
  });
  const remove=vi.spyOn(h.world,"removeRigidBody");
  try{
    h.body.sleep();expect(()=>dormant.park("rock",{x:30,y:0,z:0})).toThrow(/Prepare96MiB|CPU256MiB/);
    expect(remove).not.toHaveBeenCalled();expect(h.targets.get("rock")!.body).toBe(h.body);
    expect(dormant.checkpoint()).toEqual([]);expect(dormant.held).toBe(false);
    expect(ledger!.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
  }finally{constrained.mockRestore();h.world.free();}
});
it("holds the private preparation ledger until parked custody and the native removal outcome are settled",()=>{
  const h=setup(),dormant=residency.createHvpWorkerBodyResidency(h.world,h.targets,h.bodies,()=>true),factory=model.createStructuralOwnerLedger;
  let ledger:ReturnType<typeof factory>|undefined;
  const observed=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((...args)=>{ledger=factory(...args);return ledger;});
  const remove=h.world.removeRigidBody.bind(h.world);
  vi.spyOn(h.world,"removeRigidBody").mockImplementationOnce(body=>{
    expect(ledger!.resources.reservedBytes).toBeGreaterThan(0);expect(dormant.checkpoint()).toHaveLength(1);
    remove(body);throw new Error("after-effect fault");
  });
  try{
    h.body.sleep();expect(()=>dormant.park("rock",{x:30,y:0,z:0})).toThrow(/RecoveryHold/);
    expect(dormant.retainedRecipes()).toHaveLength(1);expect(dormant.recipeBytes(dormant.retainedRecipes()[0]!)).toBeGreaterThan(0);
    expect(ledger!.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
    expect(h.targets.size).toBe(0);expect(h.world.bodies.len()).toBe(0);expect(()=>dormant.restore("rock")).toThrow(/RecoveryHold/);
  }finally{observed.mockRestore();dormant.dispose();h.world.free();}
});
it("admits a real connected64-brick live owner under the unchanged preparation cap",()=>{
  const source=ingestHvpStructuralCells("resident64",Array.from({length:1024},(_,x)=>({x,y:0,z:0,materialId:1})),
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null}]);
  const recipe=prepareHvpRigidBody(source),world=new R.World({x:0,y:-9.81,z:0});
  const body=installHvpRigidBody(world,recipe,{translationMeters:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1}});
  const targets=new Map<string,HvpCuttableBody>([["rock64",{ownerId:"rock64",body,recipe,family:"terrain"}]]),bodies=new Map([["rock64",body]]);
  const dormant=residency.createHvpWorkerBodyResidency(world,targets,bodies,()=>true);
  try{
    expect(recipe.source.bricks).toHaveLength(64);body.sleep();
    const before=encodeHvpBody("rock64","terrain",recipe,body);
    expect(dormant.park("rock64",{x:200,y:0,z:0})).toBe(true);expect(dormant.restore("rock64")).toBe(true);
    const current=targets.get("rock64")!;expect(isOwnedStructuralGraph(current.recipe.source)).toBe(true);
    expect(encodeHvpBody("rock64","terrain",current.recipe,current.body)).toEqual(before);
  }finally{dormant.dispose();world.free();}
},120_000);
it("quotes complete sparse Source metadata before capture without constructing its Save projection",()=>{
  const tags=Array.from({length:256},(_,index)=>`tag:${String(index).padStart(3,"0")}:${"x".repeat(120)}`);
  const source=ingestHvpStructuralCells("metadata-quote",[{x:0,y:0,z:0,materialId:1}],
    Array.from({length:16},(_,index)=>({materialId:index+1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags})));
  const recipe=prepareHvpRigidBody(source),quote=(checkpoints as typeof checkpoints&{
    reserveHvpBodyCapture:(recipe:Parameters<typeof encodeHvpBody>[2],reserve:(bytes:number)=>void)=>void}).reserveHvpBodyCapture;
  expect(typeof quote).toBe("function");let bytes=0;quote(recipe,value=>{bytes+=value;});
  expect(recipe.source.bricks).toHaveLength(1);
  expect(bytes).toBeGreaterThan(4*ADAPTIVE_BRICK_ESTIMATED_BYTES);
  const invalid={...recipe},reserve=vi.fn();expect(()=>quote(invalid,reserve)).toThrow(/Unvalidated/);expect(reserve).not.toHaveBeenCalled();
  const unissued=prepareHvpRigidBody({...recipe.source});
  expect(model.isIssuedStructuralObject(unissued.source)).toBe(false);
  expect(()=>quote(unissued,reserve)).toThrow(/issued Source/);expect(reserve).not.toHaveBeenCalled();
},120_000);
it("pins active/near bodies and conserves actual material, pose and sleep over twenty native cycles",()=>{
  const h=setup();let safe=true;const resident=createHvpBodyResidency(h.world,h.targets,h.bodies,()=>safe);
  try{
    expect(resident.park("rock",{x:30,y:1,z:0})).toBe(false);
    for(let i=0;i<240;i+=1){h.world.step();}expect(h.body.isSleeping()).toBe(true);
    expect(resident.park("rock",{x:10,y:1,z:0})).toBe(false);
    const before={position:{...h.body.translation()},orientation:{...h.body.rotation()},mass:h.body.mass(),digest:h.recipe.source.contentHash};
    safe=false;expect(()=>resident.park("rock",{x:30,y:1,z:0})).toThrow(/held tick/);safe=true;
    for(let i=0;i<20;i+=1){
      expect(resident.park("rock",{x:30,y:1,z:0})).toBe(true);expect(h.world.bodies.len()).toBe(0);expect(h.targets.size).toBe(0);
      expect(resident.checkpoint()).toHaveLength(1);expect(resident.near({x:30,y:1,z:0})).toEqual([]);expect(resident.near({x:0,y:1,z:0})).toEqual(["rock"]);
      expect(resident.restore("rock")).toBe(true);const current=h.targets.get("rock")!;
      expect({...current.body.translation()}).toEqual(before.position);expect({...current.body.rotation()}).toEqual(before.orientation);
      expect(current.body.mass()).toBe(before.mass);expect(current.recipe.source.contentHash).toBe(before.digest);expect(current.body.isSleeping()).toBe(true);
      expect(h.world.bodies.len()).toBe(1);expect(h.world.colliders.len()).toBe(2);expect(resident.read()).toEqual([]);
    }
  }finally{h.world.free();}
},120_000);
it("retains a checkpoint and holds after an uncertain native removal instead of losing matter",()=>{
  const h=setup();const resident=createHvpBodyResidency(h.world,h.targets,h.bodies,()=>true);
  try{
    h.body.sleep();const remove=h.world.removeRigidBody.bind(h.world);
    vi.spyOn(h.world,"removeRigidBody").mockImplementationOnce(body=>{remove(body);throw new Error("after-effect fault");});
    expect(()=>resident.park("rock",{x:30,y:1,z:0})).toThrow(/RecoveryHold/);
    expect(resident.checkpoint()).toHaveLength(1);expect(h.targets.size).toBe(0);expect(h.world.bodies.len()).toBe(0);
    expect(resident.held).toBe(true);expect(()=>resident.restore("rock")).toThrow(/RecoveryHold/);
  }finally{h.world.free();}
});
