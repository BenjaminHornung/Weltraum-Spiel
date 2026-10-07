import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {restoreHvpBody} from "../../src/hestia-prototype/physics/restoreBody";
import {encodeHvpBody,decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {deriveProbeFragmentSteps} from "../../src/hestia-prototype/experiments/cutKernelProbe";
import {encodeStructuralObject} from "../../src/voxel/structural/persistence";
import {admitOwnedStructuralGraphSteps,createStructuralOwnerLedger,isIssuedStructuralObject,
  ownedStructuralSubsetSteps,reconstructStructuralObjectInternal} from "../../src/voxel/structural/model";

beforeAll(initializeHvpRapier);
const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};

it("retains complete P Save identity through a fresh native World and the same subsequent P recut",()=>{
  const base=ingestHvpStructuralCells("phase1.saved-P",[0,1,2,3].map(x=>({x,y:0,z:0,materialId:1})),materials);
  const source=reconstructStructuralObjectInternal({objectId:base.objectId,frame:base.frame,source:base.source,
    materials:base.materials,bricks:base.bricks.map(b=>({...b,cells:b.cells.map(c=>({...c,
      state:{...c.state,partId:"part-P",semanticKey:"semantic-P",damageKey:"damage-P"}}))})),
    anchors:base.anchors,joints:base.joints,objectRevision:base.objectRevision,editRevision:base.editRevision,
    commandEvidence:base.commandEvidence});
  const bytes=encodeStructuralObject(source),recipe=prepareHvpRigidBody(source),world=new R.World({x:0,y:0,z:0});
  let saved:string;
  try{const body=installHvpRigidBody(world,recipe,undefined,
    {velocityMetersPerSecond:{x:1,y:.5,z:-.25},angularVelocityRadPerSecond:{x:.3,y:.4,z:.5}});
    saved=JSON.stringify(encodeHvpBody("saved:phase1","terrain",recipe,body));
  }finally{world.free();}
  const fresh=new R.World({x:0,y:0,z:0}),ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  try{
    const decoded=decodeHvpBody(JSON.parse(saved!)),body=restoreHvpBody(fresh,decoded);
    expect(encodeStructuralObject(decoded.recipe.source)).toBe(bytes);
    expect(decoded.recipe.source.contentHash).toBe(source.contentHash);
    expect(decoded.recipe.source.evidenceHash).toBe(source.evidenceHash);
    const normalized=drain(admitOwnedStructuralGraphSteps(decoded.recipe.source,ledger.reserve));
    expect(encodeStructuralObject(normalized)).toBe(bytes);
    expect(normalized.bricks[0]!.cells[0]!.state).toMatchObject({partId:"part-P",semanticKey:"semantic-P",damageKey:"damage-P"});
    expect(encodeHvpBody("saved:phase1","terrain",decoded.recipe,body).region).toBe(JSON.parse(saved!).region);
    const control=prepareHvpLocalBodyCut(source,[0,0,0],"phase1-recut",1);
    const actual=prepareHvpLocalBodyCut(normalized,[0,0,0],"phase1-recut",1);
    expect(actual).toEqual(control);expect(actual.plan.removedCells).toBe(1);expect(actual.plan.parts).toHaveLength(1);
    expect(actual.plan.parts[0]!.recipe.source.bricks.reduce((n,b)=>n+b.cells.length,0)).toBe(3);
    expect(isIssuedStructuralObject(Object.freeze({...normalized}))).toBe(false);
    expect(()=>drain(admitOwnedStructuralGraphSteps(Object.freeze({...normalized}),ledger.reserve))).toThrow(/issued/i);
  }finally{ledger.release();fresh.free();}
});

it("keeps E direct/owned subset equality visibly distinct from fresh P AddBox child ancestry",()=>{
  const cells=[{x:128,y:80,z:80,materialId:1},{x:129,y:80,z:80,materialId:1}];
  const ancestor=ingestHvpStructuralCells("phase1-ancestor",cells,materials),selected=[cells[0]!];
  const p=ingestHvpStructuralCells("phase1-child",selected,materials),ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  try{
    const direct=drain(deriveProbeFragmentSteps(ancestor,"phase1-child",selected,ledger.reserve));
    const owned=drain(ownedStructuralSubsetSteps(ancestor,"phase1-child",selected,ledger.reserve));
    expect(encodeStructuralObject(owned)).toBe(encodeStructuralObject(direct));
    expect(owned.contentHash).not.toBe(p.contentHash);expect(owned.source).not.toEqual(p.source);
    expect(encodeStructuralObject(owned)).not.toBe(encodeStructuralObject(p));
    expect(owned.bricks.flatMap(b=>b.cells.map(c=>c.state))).toEqual(p.bricks.flatMap(b=>b.cells.map(c=>c.state)));
  }finally{ledger.release();}
});
