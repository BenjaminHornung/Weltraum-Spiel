import {expect,it,vi} from "vitest";
import checkpoint from "../fixtures/hvp-contact-r90-body384.json";
import {decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import * as model from "../../src/voxel/structural/model";
import * as classification from "../../src/voxel/structural/classificationSteps";
import {structuralOwnedObjectMassSteps} from "../../src/voxel/structural/massProperties";
import * as structuralPublic from "../../src/voxel/structural";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";

const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}finally{steps.return(undefined as never);}
};
const connectivity={maxVisitedCells:32768,maxIndexedFacts:262144,maxComponents:32};
it("reuses exact fully classified saved Body384 rows for private mass without rebuilding addresses",()=>{
  const ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const source=drain(model.admitOwnedStructuralGraphSteps(decodeHvpBody(checkpoint).recipe.source,ledger.reserve));
  const candidate=drain(model.ownedStructuralDerivationCandidateSteps(source,source.bricks,source.objectRevision+1,source.editRevision,ledger.reserve));
  let address:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const expected=drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells:384},ledger.reserve));
    drain(classification.structuralOwnedComponentClassificationSteps(candidate,connectivity,ledger.reserve));
    address=vi.spyOn(model,"structuralAddressForBrickCell");
    const actual=drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells:384},ledger.reserve));
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(actual.occupiedVoxelCount).toBe(384);expect(address).not.toHaveBeenCalled();
  }finally{address?.mockRestore();model.releaseOwnedStructuralDerivationCandidate(candidate);ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});

const mixedSource=()=>{
  const cells=[];
  for(let z=0;z<2;z++){for(let y=4;y<8;y++){for(let x=-2;x<6;x++){cells.push({x,y,z,materialId:x<1?1:256});}}}
  const base=ingestHvpStructuralCells("classified-mass-mixed",cells,[
    {materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null},
    {materialId:256,densityKgPerCubicMeter:768.1,structuralClass:"stone",destructible:true,tags:null}]);
  const first=base.bricks[0],last=base.bricks.at(-1)!;
  const a=model.structuralAddressForBrickCell(first,first.cells[0].localIndex),b=model.structuralAddressForBrickCell(last,last.cells.at(-1)!.localIndex);
  return model.reconstructStructuralObjectInternal({objectId:base.objectId,frame:base.frame,source:base.source,materials:base.materials,bricks:base.bricks,
    anchors:[{anchorId:"mass.anchor",cell:a}],joints:[{jointId:"mass.joint",jointClass:"weld",endpointA:{cell:a,role:"primary"},endpointB:{cell:b,role:"secondary"}}],
    objectRevision:0,editRevision:0,commandEvidence:[]});
};
const outcome=(run:()=>unknown)=>{try{return {ok:true,value:run()};}catch(error){
  const value=error as Error&{code?:unknown;path?:unknown};return {ok:false,name:value.name,code:value.code,path:value.path,message:value.message};}
};
it.each(["saved384","mixedAnchored"] as const)("keeps canonical mass, lower/equal/upper budget errors and exact candidate/credit identity (%s)",kind=>{
  const ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128),other=model.createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const source=drain(model.admitOwnedStructuralGraphSteps(kind==="saved384"?decodeHvpBody(checkpoint).recipe.source:mixedSource(),ledger.reserve));
  const count=source.bricks.reduce((n,brick)=>n+brick.cells.length,0);
  const candidate=drain(model.ownedStructuralDerivationCandidateSteps(source,source.bricks,source.objectRevision+1,source.editRevision,ledger.reserve));
  try{
    expect(structuralPublic).not.toHaveProperty("readOwnedClassifiedMassEntries");
    expect(classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)).toBeUndefined();
    expect(model.hasOwnedStructuralDerivationAncestor(candidate)).toBe(true);
    const budgets=[0,1.1,count-1,count,count+1];
    const expected=budgets.map(maxVisitedCells=>outcome(()=>drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells},ledger.reserve))));
    const complete=drain(classification.structuralOwnedComponentClassificationSteps(candidate,connectivity,ledger.reserve));
    if(kind==="mixedAnchored"){expect(complete.anchoredComponents.length).toBeGreaterThan(0);expect(complete.components.some(component=>component.activeJoints.length>0)).toBe(true);}
    const rows=classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)!;
    expect(Object.isFrozen(rows)).toBe(true);expect(rows).toHaveLength(count);
    expect(rows.map(row=>row.state)).toEqual(source.bricks.flatMap(brick=>brick.cells.map(cell=>cell.state)));
    expect(classification.readOwnedClassifiedMassEntries({...candidate},ledger.reserve)).toBeUndefined();
    expect(classification.readOwnedClassifiedMassEntries(source,ledger.reserve)).toBeUndefined();
    expect(classification.readOwnedClassifiedMassEntries(candidate,other.reserve)).toBeUndefined();
    for(const [index,maxVisitedCells] of budgets.entries()){
      expect(outcome(()=>drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells},ledger.reserve)))).toEqual(expected[index]);}
    expect(expected[2]).toMatchObject({ok:false,name:"StructuralMassError",code:"BudgetExceeded",path:"massBudgets/maxVisitedCells"});
    expect(expected[3]).toMatchObject({ok:true});
    model.releaseOwnedStructuralDerivationCandidate(candidate);
    expect(classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)).toBeUndefined();
    expect(()=>drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells:count},ledger.reserve))).toThrow("Owned mass requires");
  }finally{model.releaseOwnedStructuralDerivationCandidate(candidate);ledger.release();other.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});

it("consumes the same complete row proof at publication and reserves its record before exposing it",()=>{
  const ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128),source=drain(model.admitOwnedStructuralGraphSteps(mixedSource(),ledger.reserve));
  const candidate=drain(model.ownedStructuralDerivationCandidateSteps(source,source.bricks,0,0,ledger.reserve));
  try{
    const before=ledger.resources.reservedBytes;
    const prepared=drain(classification.structuralOwnedComponentClassificationSteps(candidate,connectivity,ledger.reserve));
    expect(ledger.resources.reservedBytes).toBeGreaterThan(before+256);
    expect(classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)).toBeDefined();
    const published=drain(model.ownedStructuralReconstructionSteps(source,{objectId:candidate.objectId,frame:candidate.frame,source:candidate.source,
      materials:candidate.materials,bricks:candidate.bricks,anchors:candidate.anchors,joints:candidate.joints,
      objectRevision:candidate.objectRevision,editRevision:candidate.editRevision,commandEvidence:[]},ledger.reserve,candidate,witness=>{
        expect(classification.bindOwnedPublishedClassification(witness)).toBe(prepared);
        expect(classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)).toBeUndefined();
      }));
    expect(model.isIssuedStructuralObject(published)).toBe(true);
    expect(classification.readOwnedClassifiedMassEntries(published,ledger.reserve)).toBeUndefined();
  }finally{model.releaseOwnedStructuralDerivationCandidate(candidate);ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});

it("rejects the final proof record before publication when its real reserve fails",()=>{
  const full=model.createStructuralOwnerLedger(32*1024*1024,undefined,128),source=drain(model.admitOwnedStructuralGraphSteps(mixedSource(),full.reserve));
  const beforeCandidate=full.resources.reservedBytes;
  const first=drain(model.ownedStructuralDerivationCandidateSteps(source,source.bricks,1,0,full.reserve));
  let required=0;
  try{drain(classification.structuralOwnedComponentClassificationSteps(first,connectivity,full.reserve));required=full.resources.reservedBytes-beforeCandidate;}
  finally{model.releaseOwnedStructuralDerivationCandidate(first);full.release();}
  const tight=model.createStructuralOwnerLedger(32*1024*1024,required-1,128);
  const candidate=drain(model.ownedStructuralDerivationCandidateSteps(source,source.bricks,1,0,tight.reserve));
  try{
    expect(outcome(()=>drain(classification.structuralOwnedComponentClassificationSteps(candidate,connectivity,tight.reserve))))
      .toMatchObject({ok:false,code:"InvalidBudget",path:"cursor/prepareBytes"});
    expect(classification.readOwnedClassifiedMassEntries(candidate,tight.reserve)).toBeUndefined();
  }finally{model.releaseOwnedStructuralDerivationCandidate(candidate);tight.release();}
  expect(tight.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});

it("keeps public Species proxy iterator observations on the original private mass fallback",()=>{
  const base=ingestHvpStructuralCells("mass-species",[{x:0,y:4,z:0,materialId:1},{x:1,y:4,z:0,materialId:1}],
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
  const descriptor=Object.getOwnPropertyDescriptor(Array,Symbol.species)!,proxies=new WeakSet<object>();
  let watched:readonly unknown[]|undefined,enabled=false,source:typeof base;
  function Species(length:number){const proxy=new Proxy(new Array(length),{get(target,property,receiver){
    if(enabled&&receiver===watched&&property===Symbol.iterator){return function*(){yield target[0];};}
    return Reflect.get(target,property,receiver);
  }});proxies.add(proxy);return proxy;}
  try{
    Object.defineProperty(Array,Symbol.species,{configurable:true,value:Species});
    source=model.reconstructStructuralObjectInternal({objectId:base.objectId,frame:base.frame,source:base.source,materials:base.materials,
      bricks:base.bricks,anchors:base.anchors,joints:base.joints,objectRevision:0,editRevision:0,commandEvidence:[]});
    watched=source.bricks[0].cells;expect(proxies.has(watched)).toBe(true);expect(Object.isFrozen(watched)).toBe(true);
  }finally{Object.defineProperty(Array,Symbol.species,descriptor);}
  const ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const candidate=drain(model.ownedStructuralDerivationCandidateSteps(source!,source!.bricks,1,0,ledger.reserve));
  try{
    expect(model.isOwnedStructuralGraph(source!)).toBe(false);expect(model.hasOwnedStructuralDerivationAncestor(candidate)).toBe(false);
    enabled=true;
    const expected=drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells:2},ledger.reserve));
    expect(expected.occupiedVoxelCount).toBe(2);
    const completed=drain(classification.structuralOwnedComponentClassificationSteps(candidate,connectivity,ledger.reserve));
    expect(completed.components.reduce((n,component)=>n+component.occupiedCells.length,0)).toBe(1);
    const actual=drain(structuralOwnedObjectMassSteps(candidate,{maxVisitedCells:2},ledger.reserve));
    expect(actual.occupiedVoxelCount).toBe(2);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(classification.readOwnedClassifiedMassEntries(candidate,ledger.reserve)).toBeUndefined();
  }finally{enabled=false;model.releaseOwnedStructuralDerivationCandidate(candidate);ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});
