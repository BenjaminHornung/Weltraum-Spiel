import {expect,it} from '../../../../../apps/weltraum-browser/node_modules/vitest/dist/index.js';
import {ingestHvpStructuralCells} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/structuralIngest';
import {deriveProbeFragmentSteps} from '../../../../../apps/weltraum-browser/src/hestia-prototype/experiments/cutKernelProbe';
import {createStructuralOwnerLedger,isIssuedStructuralObject,ownedStructuralSubsetSteps,reconstructStructuralObjectInternal,admitOwnedStructuralGraphSteps} from '../../../../../apps/weltraum-browser/src/voxel/structural/model';
import {encodeStructuralObject,decodeStructuralObject} from '../../../../../apps/weltraum-browser/src/voxel/structural/persistence';

const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{for(;;){const s=steps.next();if(s.done){return s.value;}}};
it('issues only genuine immutable subsets with exact old canonical Save bytes and no cancelled partial output',()=>{
  const cells=Array.from({length:96},(_,i)=>({x:128+i%8,y:80+Math.floor(i/8)%4,z:80+Math.floor(i/32),materialId:1}));
  const base=ingestHvpStructuralCells('owned-ancestor',cells,[{materialId:1,densityKgPerCubicMeter:2400,structuralClass:'stone',destructible:true,tags:null}]);
  const publicAncestor=reconstructStructuralObjectInternal({objectId:base.objectId,frame:base.frame,source:base.source,materials:base.materials,
    bricks:base.bricks.map(b=>({...b,cells:b.cells.map(c=>({...c,state:{...c.state,partId:'p1',semanticKey:'s1',damageKey:'d1'}}))})),
    anchors:[],joints:[],objectRevision:0,editRevision:0,commandEvidence:[]});
  const chosen=cells.filter(c=>c.x<132),ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  try{
    const ancestor=drain(admitOwnedStructuralGraphSteps(publicAncestor,ledger.reserve));
    expect(ancestor).not.toBe(publicAncestor);expect(ancestor.materials).not.toBe(publicAncestor.materials);
    expect(encodeStructuralObject(ancestor)).toBe(encodeStructuralObject(publicAncestor));
    const expected=drain(deriveProbeFragmentSteps(ancestor,'owned-child',chosen,ledger.reserve));
    const mutable=chosen.map(c=>({...c})),steps=ownedStructuralSubsetSteps(ancestor,'owned-child',mutable,ledger.reserve);
    expect(steps.next().done).toBe(false);mutable[0]!.x=999;
    const actual=drain(steps);
    expect(isIssuedStructuralObject(actual)).toBe(true);
    expect(encodeStructuralObject(actual)).toBe(encodeStructuralObject(expected));
    expect(decodeStructuralObject(encodeStructuralObject(actual))).toEqual(actual);
    expect(actual.source).toBe(ancestor.source);expect(actual.materials).toBe(ancestor.materials);
    expect(actual.bricks[0]!.cells[0]).toBe(ancestor.bricks[0]!.cells[0]);
    expect(()=>{(actual.bricks[0]!.cells[0]!.state as any).materialId=2;}).toThrow();
    expect(()=>drain(ownedStructuralSubsetSteps(Object.freeze({...ancestor}),'bad',chosen,ledger.reserve))).toThrow(/issued/i);
    expect(()=>drain(ownedStructuralSubsetSteps(ancestor,'bad',[{...chosen[0]!,materialId:2}],ledger.reserve))).toThrow(/material/i);
    expect(()=>drain(ownedStructuralSubsetSteps(ancestor,'bad',[{...chosen[0]!,x:999}],ledger.reserve))).toThrow(/occupancy/i);
    expect(()=>drain(ownedStructuralSubsetSteps(ancestor,'bad',[chosen[0]!,chosen[0]!],ledger.reserve))).toThrow(/duplicate/i);
    const cancelled=ownedStructuralSubsetSteps(ancestor,'cancelled',chosen,ledger.reserve);
    expect(cancelled.next().done).toBe(false);cancelled.return(undefined as never);
    expect(cancelled.next()).toEqual({done:true,value:undefined});
  }finally{ledger.release();}
});

it('bounds selectors by own numeric length and never invokes a foreign selector iterator',()=>{
  const cells=[{x:128,y:80,z:80,materialId:1},{x:129,y:80,z:80,materialId:1},{x:130,y:80,z:80,materialId:1}];
  const source=ingestHvpStructuralCells('iterator-source',cells,[{materialId:1,densityKgPerCubicMeter:2400,structuralClass:'stone',destructible:true,tags:null}]);
  const selectors=[cells[0]!];let calls=0;
  Object.defineProperty(selectors,Symbol.iterator,{value:function*(){calls++;yield* cells;}});
  const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  try{const result=drain(ownedStructuralSubsetSteps(source,'iterator-child',selectors,ledger.reserve));
    expect(calls).toBe(0);expect(result.bricks.reduce((n,b)=>n+b.cells.length,0)).toBe(1);
  }finally{ledger.release();}
});
