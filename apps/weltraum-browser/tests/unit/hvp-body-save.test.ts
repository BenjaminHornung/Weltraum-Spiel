import {beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {encodeHvpBody,decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {restoreHvpBody} from "../../src/hestia-prototype/physics/restoreBody";

beforeAll(initializeHvpRapier);
const recipe=()=>prepareHvpRigidBody(ingestHvpStructuralCells("saved-L",[
  {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}
],[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]));
const snapshot=(body:R.RigidBody)=>({position:{...body.translation()},rotation:{...body.rotation()},v:{...body.linvel()},w:{...body.angvel()},
  mass:body.mass(),sleeping:body.isSleeping(),ccd:body.isCcdEnabled(),count:body.numColliders(),friction:body.collider(0).friction()});
it("restores a rotated moving full-inertia body into ten fresh Worlds from only serialized bytes",()=>{
  const world=new R.World({x:0,y:0,z:0}),r=recipe();let json:string,expected:ReturnType<typeof snapshot>;
  try{
    const body=installHvpRigidBody(world,r,{translationMeters:{x:1,y:3,z:-2},rotation:{x:.2,y:-.3,z:.1,w:Math.sqrt(.86)}},
      {velocityMetersPerSecond:{x:2,y:.25,z:-1},angularVelocityRadPerSecond:{x:.7,y:-.4,z:2}});
    body.collider(0).setFriction(.8);world.step();expected=snapshot(body);
    json=JSON.stringify(encodeHvpBody("saved:body","terrain",r,body));
  }finally{world.free();}
  for(let i=0;i<10;i+=1){const restored=new R.World({x:0,y:0,z:0});
    try{const value=decodeHvpBody(JSON.parse(json!)),body=restoreHvpBody(restored,value);
      expect(snapshot(body)).toEqual(expected!);expect(value.recipe.mass.centerOfMassMeters!.y).toBeCloseTo(5/48,12);
      restored.step();expect(body.translation()).not.toEqual(expected!.position);
    }finally{restored.free();}
  }
});
it("retains sleeping/static states and rejects altered or missing source-bound motion before a World write",()=>{
  const world=new R.World({x:0,y:0,z:0}),r=recipe();
  try{
    const sleeping=installHvpRigidBody(world,r);sleeping.sleep();
    const encoded=encodeHvpBody("saved:sleeping","branch",r,sleeping);
    const restored=restoreHvpBody(world,decodeHvpBody(JSON.parse(JSON.stringify(encoded))));expect(restored.isSleeping()).toBe(true);
    const fixed=installHvpRigidBody(world,r,undefined,undefined,false);
    expect(restoreHvpBody(world,decodeHvpBody(encodeHvpBody("saved:fixed","branch",r,fixed))).isFixed()).toBe(true);
    const count=world.bodies.len(),tampered=JSON.parse(encoded.region);tampered.motions=[];
    expect(()=>decodeHvpBody({...encoded,region:JSON.stringify(tampered)})).toThrow();
    expect(()=>decodeHvpBody({...encoded,region:encoded.region.replace('"x":0,','"x":999,')})).toThrow();
    expect(()=>decodeHvpBody({...encoded,surfaces:[]})).toThrow();expect(world.bodies.len()).toBe(count);
  }finally{world.free();}
});
it("does not remove existing bodies on restore failure and reports unproven native cleanup",()=>{
  const world=new R.World({x:0,y:0,z:0}),r=recipe();
  try{
    const before=installHvpRigidBody(world,r),saved=decodeHvpBody(encodeHvpBody("saved:body","terrain",r,before));
    vi.spyOn(R.Collider.prototype,"setFriction").mockImplementationOnce(()=>{throw new Error("surface failure");});
    try{restoreHvpBody(world,saved);throw new Error("expected restore failure");}catch(error){expect(error).toMatchObject({worldRestored:true});}
    expect(world.bodies.len()).toBe(1);expect(world.getRigidBody(before.handle)).toBe(before);
    vi.spyOn(R.Collider.prototype,"setFriction").mockImplementationOnce(()=>{throw new Error("surface failure");});
    vi.spyOn(world,"removeRigidBody").mockImplementationOnce(()=>{throw new Error("cleanup failure");});
    try{restoreHvpBody(world,saved);throw new Error("expected recovery failure");}catch(error){expect(error).toMatchObject({worldRestored:false});}
    expect(world.bodies.len()).toBe(2);expect(world.getRigidBody(before.handle)).toBe(before);
  }finally{vi.restoreAllMocks();world.free();}
});
it("restores the F7 mixed-material cross-leaf fixture with its actual 0.6875 m COM",()=>{
  const r=prepareHvpRigidBody(ingestHvpStructuralCells("saved-F7",[14,15,16,17,18].map(x=>({x,y:5,z:0,materialId:x<16?1:2})),[
    {materialId:1,densityKgPerCubicMeter:7800,structuralClass:"steel",destructible:true,tags:null},
    {materialId:2,densityKgPerCubicMeter:2700,structuralClass:"aluminium",destructible:true,tags:null}]));
  const world=new R.World({x:0,y:0,z:0});let saved:string,expected:ReturnType<typeof snapshot>;
  try{const body=installHvpRigidBody(world,r,undefined,{velocityMetersPerSecond:{x:1,y:.5,z:-.25},angularVelocityRadPerSecond:{x:.3,y:.4,z:.5}});
    expected=snapshot(body);saved=JSON.stringify(encodeHvpBody("saved:F7","terrain",r,body));
  }finally{world.free();}
  const restored=new R.World({x:0,y:0,z:0});
  try{const value=decodeHvpBody(JSON.parse(saved!)),body=restoreHvpBody(restored,value);
    expect(value.recipe.mass.totalMassKg).toBe(46.2890625);
    expect(value.recipe.mass.centerOfMassMeters!.x).toBeCloseTo(2505/1264,12);
    expect(value.recipe.mass.centerOfMassMeters!.y).toBe(11/16);expect(value.recipe.mass.centerOfMassMeters!.z).toBe(1/16);
    expect(body.translation().y).toBe(.6875);expect(snapshot(body)).toEqual(expected!);
  }finally{restored.free();}
});
