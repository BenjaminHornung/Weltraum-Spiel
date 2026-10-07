import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {encodeHvpBody,decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {restoreHvpBody} from "../../src/hestia-prototype/physics/restoreBody";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {admitHvpTransferredRigidBody,hvpRigidColliderBoxes,prepareHvpRigidBody,
  type HvpTransferredColliderBox} from "../../src/hestia-prototype/physics/rigidRecipe";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../src/hvp/hvpCoastSource";
import {createStructuralCellAddress} from "../../src/voxel/structural";
import {reconstructStructuralObjectInternal} from "../../src/voxel/structural/model";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import * as recipes from "../../src/hestia-prototype/physics/rigidRecipe";
import {prepareHvpTerrainFragment,prepareHvpTerrainFragmentOwnedSteps} from "../../src/hestia-prototype/physics/terrainFragment";
import * as fragments from "../../src/hestia-prototype/physics/terrainFragment";
import {encodeStructuralObject} from "../../src/voxel/structural";

beforeAll(initializeHvpRapier);

it("admits a bound experimental Source once while the ordinary fragment path keeps its original contract",()=>{
  const input={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:9.375,
    cells:[{x:128,y:76,z:128,materialId:1},{x:129,y:76,z:128,materialId:1}],
    colliderBoxes:[{min:[128,76,128],max:[130,77,129]}] as const};
  const expected=prepareHvpTerrainFragment(input,1);
  expect(prepareHvpTerrainFragment({...input,sourceRegion:"untrusted"} as typeof input,1)).toEqual(expected);
  const direct=(fragments as unknown as {prepareHvpProbeTerrainFragmentOwnedSteps?:
    (r:typeof input&{sourceRegion:string},g:number,reserve:ReturnType<typeof createStructuralOwnerLedger>["reserve"])=>Generator<string,typeof expected,unknown>}).prepareHvpProbeTerrainFragmentOwnedSteps;
  expect(direct).toBeTypeOf("function");
  const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  const drain=(request:typeof input&{sourceRegion:string})=>{const steps=direct!(request,1,ledger.reserve);
    for(;;){const s=steps.next();if(s.done){return s.value;}}};
  try{
    const region=encodeStructuralObject(expected.source),actual=drain({...input,sourceRegion:region});
    expect(actual).toEqual(expected);
    expect(()=>drain({...input,sourceRegion:"{}"})).toThrow();
    expect(()=>drain({...input,sourceRegion:region,cells:[{...input.cells[0]!,materialId:2},input.cells[1]!]})).toThrow(/source|material|occupancy/i);
  }finally{ledger.release();}
});

const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));
const cells=(list:readonly (readonly [number,number,number])[])=>list.map(([x,y,z])=>({x,y,z,materialId:1}));
// L-shape: greedy yields two boxes, so gap/overlap attacks are expressible.
const elbow=cells([[0,0,0],[1,0,0],[0,1,0]]);
const source=()=>ingestHvpStructuralCells("test-admit",elbow,materials);
const claim=()=>{
  const derived=prepareHvpRigidBody(source());
  return {derived,claimed:{massKg:derived.mass.totalMassKg,colliderBoxes:hvpRigidColliderBoxes(derived)}};
};
const reconstruct=(value:ReturnType<typeof source>,frame:unknown=value.frame,anchors:readonly unknown[]=value.anchors,joints:readonly unknown[]=value.joints)=>
  reconstructStructuralObjectInternal({objectId:value.objectId,frame,source:value.source,materials:value.materials,bricks:value.bricks,
    anchors,joints,objectRevision:value.objectRevision,editRevision:value.editRevision,commandEvidence:value.commandEvidence});
const bodySnapshot=(body:R.RigidBody)=>({position:{...body.translation()},rotation:{...body.rotation()},v:{...body.linvel()},w:{...body.angvel()},
  mass:body.mass(),count:body.numColliders(),friction:body.collider(0).friction()});

it("keeps full transferred recipe admission and exact rejection messages on the bounded owned path",()=>{
  const {claimed}=claim(),actualSource=source();
  const owned=(recipes as unknown as {admitHvpTransferredRigidBodyOwnedSteps:(s:typeof actualSource,c:typeof claimed,spans:undefined,reserve:ReturnType<typeof createStructuralOwnerLedger>["reserve"])=>Generator<string,ReturnType<typeof admitHvpTransferredRigidBody>,unknown>}).admitHvpTransferredRigidBodyOwnedSteps;
  for(const candidate of [claimed,{...claimed,massKg:claimed.massKg*2},{...claimed,colliderBoxes:[...claimed.colliderBoxes].reverse()},
    {...claimed,colliderBoxes:[claimed.colliderBoxes[0]!,claimed.colliderBoxes[0]!]}]){
    const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);let expected:ReturnType<typeof admitHvpTransferredRigidBody>|undefined,first:unknown;
    try{expected=admitHvpTransferredRigidBody(actualSource,candidate);}catch(error){first=error;}
    const steps=owned(actualSource,candidate,undefined,ledger.reserve);let units=0;
    try{for(;;){const step=steps.next();if(step.done){expect(first).toBeUndefined();expect(step.value).toEqual(expected);expect(step.value.source).toBe(actualSource);break;}units+=1;}}
    catch(error){expect(first).toBeInstanceOf(Error);expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe((first as Error).message);}
    finally{steps.return(undefined as never);ledger.release();}if(expected!==undefined){expect(units).toBeGreaterThan(0);}
  }
});
it("closes bounded transferred admission before cancellation can publish a recipe",()=>{
  const {claimed}=claim(),s=source(),ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  const owned=(recipes as unknown as {admitHvpTransferredRigidBodyOwnedSteps:(sourceValue:typeof s,c:typeof claimed,spans:undefined,reserve:typeof ledger.reserve)=>Generator<string,unknown,unknown>}).admitHvpTransferredRigidBodyOwnedSteps;
  const steps=owned(s,claimed,undefined,ledger.reserve);expect(steps.next().done).toBe(false);
  expect(steps.return(undefined)).toEqual({done:true,value:undefined});expect(steps.next()).toEqual({done:true,value:undefined});
  ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
});
it("uses exactly the independent Native terrain source and full admission on the owned fragment path",()=>{
  const input={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:9.375,
    cells:[{x:128,y:76,z:128,materialId:1},{x:129,y:76,z:128,materialId:1}],
    colliderBoxes:[{min:[128,76,128],max:[130,77,129]}] as const};
  const expected=prepareHvpTerrainFragment(input,1),ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  const steps=prepareHvpTerrainFragmentOwnedSteps(input,1,ledger.reserve);let units=0;
  try{for(;;){const step=steps.next();if(step.done){expect(step.value).toEqual(expected);expect(step.value.source.contentHash).toBe(expected.source.contentHash);break;}units+=1;}}
  finally{steps.return(undefined as never);ledger.release();}expect(units).toBeGreaterThan(0);
});

it("admits a transferred recipe with byte-identical mechanics to the recomputed one",()=>{
  const {derived,claimed}=claim();
  const admitted=admitHvpTransferredRigidBody(source(),claimed);
  expect(admitted.mass).toEqual(derived.mass);
  expect(admitted.axes).toEqual(derived.axes);
  expect(admitted.colliders).toEqual(derived.colliders);
  expect(admitted.source.contentHash).toBe(derived.source.contentHash);
  const spans={};
  admitHvpTransferredRigidBody(source(),claimed,spans);
  expect(Object.values(spans).every(v=>typeof v==="number"&&(v as number)>=0)).toBe(true);
});

it("rejects tampered mass, overlapping or gapped coverage and foreign cells",()=>{
  const {claimed}=claim();
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,massKg:claimed.massKg*2})).toThrow(/mass mismatch/);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,massKg:Number.NaN})).toThrow(/claim/);
  const [first,second]=claimed.colliderBoxes;
  expect(claimed.colliderBoxes).toHaveLength(2);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:[first!,first!]})).toThrow(/coverage/);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:[first!]})).toThrow(/coverage/);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,
    colliderBoxes:[first!,{min:[9,9,9],max:[10,10,10]}]})).toThrow(/coverage/);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,
    colliderBoxes:[{min:[first!.min[0],first!.min[1],first!.min[2]],max:[first!.max[0]+1,first!.max[1],first!.max[2]]},second!]})).toThrow(/coverage/);
});

it("rejects malformed boxes, empty claims and split components",()=>{
  const {claimed}=claim();
  const bad=(box:HvpTransferredColliderBox)=>()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:[box]});
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:[]})).toThrow(/claim/);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:new Array(65).fill(claimed.colliderBoxes[0])})).toThrow(/claim/);
  expect(bad({min:[0,0,0],max:[0.5,1,1]})).toThrow(/box/);
  expect(bad({min:[1,0,0],max:[1,1,1]})).toThrow(/box/);
  expect(bad({min:[0,0,0],max:[1000000,1,1]})).toThrow(/coverage/);
  const split=ingestHvpStructuralCells("test-split",cells([[0,0,0],[5,5,5]]),materials);
  expect(()=>admitHvpTransferredRigidBody(split,{massKg:2*2400*.125**3,
    colliderBoxes:[{min:[0,0,0],max:[1,1,1]},{min:[5,5,5],max:[6,6,6]}]})).toThrow(/connected component/);
});

it("requires the canonical greedy partition for adjacent cells",()=>{
  const adjacent=ingestHvpStructuralCells("test-adjacent",cells([[128,90,144],[129,90,144]]),materials);
  const unitBoxes={massKg:9.375,colliderBoxes:[
    {min:[128,90,144],max:[129,91,145]},
    {min:[129,90,144],max:[130,91,145]}
  ]} as const;
  expect(()=>admitHvpTransferredRigidBody(adjacent,unitBoxes)).toThrow(/partition/);
  const admitted=admitHvpTransferredRigidBody(adjacent,{massKg:9.375,colliderBoxes:[
    {min:[128,90,144],max:[130,91,145]}
  ]});
  expect(admitted.mass.totalMassKg).toBe(9.375);
  expect(admitted.colliders).toEqual([{
    minMeters:{x:16,y:11.25,z:18},maxMeters:{x:16.25,y:11.375,z:18.125}
  }]);
});

it("rejects canonical transferred boxes in a different order",()=>{
  const {derived,claimed}=claim();
  expect(claimed.colliderBoxes).toHaveLength(2);
  expect(()=>admitHvpTransferredRigidBody(source(),{...claimed,colliderBoxes:[...claimed.colliderBoxes].reverse()})).toThrow(/partition/);
  expect(admitHvpTransferredRigidBody(source(),claimed).colliders).toEqual(derived.colliders);
});

it("rejects anchored, joint-bearing and nonzero-origin sources",()=>{
  const {claimed}=claim();
  const anchored=ingestHvpStructuralCells("test-anchor",elbow,materials,[{x:0,y:0,z:0}]);
  expect(()=>admitHvpTransferredRigidBody(anchored,claimed)).toThrow(/anchor/i);
  expect(()=>prepareHvpRigidBody(anchored)).toThrow();

  const base=source(),brick=base.bricks[0]!;
  const jointed=reconstruct(base,base.frame,base.anchors,[{
    jointId:"test.joint",jointClass:"fixed",
    endpointA:{cell:createStructuralCellAddress(brick.key,{x:0,y:0,z:0}),role:"a"},
    endpointB:{cell:createStructuralCellAddress(brick.key,{x:1,y:0,z:0}),role:"b"}
  }]);
  expect(()=>admitHvpTransferredRigidBody(jointed,claimed)).toThrow(/joint/i);

  const shifted=reconstruct(base,{...base.frame,objectOriginQuantum:{x:1,y:0,z:0}});
  expect(()=>admitHvpTransferredRigidBody(shifted,claimed)).toThrow(/origin/i);
});

it("freezes the transferred collider array and preserves canonical content",()=>{
  const {derived,claimed}=claim();
  const admitted=admitHvpTransferredRigidBody(source(),claimed);
  expect(Object.isFrozen(admitted.colliders)).toBe(true);
  expect(Reflect.set(admitted.colliders,0,admitted.colliders[0])).toBe(false);
  expect(Reflect.deleteProperty(admitted.colliders,0)).toBe(false);
  expect(admitted.colliders).toEqual(derived.colliders);
});

it("preserves canonical mechanics through a native save round trip",()=>{
  const {claimed}=claim(),admitted=admitHvpTransferredRigidBody(source(),claimed);
  const pose={translationMeters:{x:1,y:3,z:-2},rotation:{x:.2,y:-.3,z:.1,w:Math.sqrt(.86)}};
  const motion={velocityMetersPerSecond:{x:2,y:.25,z:-1},angularVelocityRadPerSecond:{x:.7,y:-.4,z:2}};
  const world=new R.World({x:0,y:0,z:0});let encoded:string,expected:ReturnType<typeof bodySnapshot>;
  try{
    const body=installHvpRigidBody(world,admitted,pose,motion);
    body.collider(0).setFriction(.8);world.step();expected=bodySnapshot(body);
    encoded=JSON.stringify(encodeHvpBody("saved:transferred","terrain",admitted,body));
  }finally{world.free();}

  const restoredWorld=new R.World({x:0,y:0,z:0});
  try{
    const decoded=decodeHvpBody(JSON.parse(encoded!)),body=restoreHvpBody(restoredWorld,decoded);
    expect(decoded.recipe.source.contentHash).toBe(admitted.source.contentHash);
    expect(decoded.recipe.mass).toEqual(admitted.mass);
    expect(decoded.recipe.axes).toEqual(admitted.axes);
    expect(decoded.recipe.colliders).toEqual(admitted.colliders);
    expect(decoded.checkpoint.surfaces).toHaveLength(admitted.colliders.length);
    expect(decoded.checkpoint.surfaces[0]!.friction).toBe(expected!.friction);
    expect(bodySnapshot(body)).toEqual(expected!);
  }finally{restoredWorld.free();}
});
