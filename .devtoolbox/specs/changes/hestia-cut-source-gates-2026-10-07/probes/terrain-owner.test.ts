import {expect,it} from '../../../../../apps/weltraum-browser/node_modules/vitest/dist/index.js';
import {ingestHvpStructuralCells} from '../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/structuralIngest';
import {createHvpProbeTerrainSourceOwner,hvpTerrainSubsetCloneBytes,copyHvpTerrainSubset} from '../../../../../apps/weltraum-browser/src/hestia-prototype/physics/terrainFragment';
import {deriveProbeFragmentSteps} from '../../../../../apps/weltraum-browser/src/hestia-prototype/experiments/cutKernelProbe';
import {createStructuralOwnerLedger} from '../../../../../apps/weltraum-browser/src/voxel/structural/model';
import {HVP_COAST_MATERIAL_REGISTRY,HVP_SOURCE_MIN_METERS} from '../../../../../apps/weltraum-browser/src/hvp/hvpCoastSource';
import {prepareHvpRigidBody,hvpRigidColliderBoxes} from '../../../../../apps/weltraum-browser/src/hestia-prototype/physics/rigidRecipe';
import {encodeStructuralObject} from '../../../../../apps/weltraum-browser/src/voxel/structural/persistence';
const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{for(;;){const s=steps.next();if(s.done){return s.value;}}};
it('admits a cold ancestor once, reuses it for the next Terrain cut, and rejects tamper/cancel/disposed without a body',()=>{
  const cells=Array.from({length:96},(_,i)=>({x:128+i%8,y:80+Math.floor(i/8)%4,z:80+Math.floor(i/32),materialId:1}));
  const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,structuralClass:m.role,destructible:true,tags:null}));
  const ancestor=ingestHvpStructuralCells('hvp-cut-probe-rockarm-seed',cells,materials);
  const {objectId,frame,source,bricks,anchors,joints,objectRevision,editRevision,commandEvidence}=ancestor;
  const input={objectId,frame,source,materials:ancestor.materials,bricks,anchors,joints,objectRevision,editRevision,commandEvidence};
  const ledger=createStructuralOwnerLedger(0,96*1024*1024,128),owner=createHvpProbeTerrainSourceOwner();
  try{
    const request=(generation:number,selected:typeof cells,initial=false)=>{
      const ownerId=`hvp:terrain-fragment:r${generation}:12345678`,expected=drain(deriveProbeFragmentSteps(ancestor,ownerId,selected,ledger.reserve));
      const recipe=prepareHvpRigidBody(expected);
      return {expected,request:{ownerId,cells:selected,origin:HVP_SOURCE_MIN_METERS,massKg:recipe.mass.totalMassKg,colliderBoxes:hvpRigidColliderBoxes(recipe),
        sourceSubset:{ancestorDigest:ancestor.contentHash,expectedDigest:expected.contentHash,...(initial?{ancestorInput:structuredClone(input)}:{})}}};
    };
    const first=request(1,cells.filter(c=>c.x<132),true),a=drain(owner.prepareSteps(first.request,1,ledger.reserve));
    expect(encodeStructuralObject(a.source)).toBe(encodeStructuralObject(first.expected));expect(owner.residentBytes()).toBeGreaterThan(0);
    const second=request(2,cells.filter(c=>c.x>=132)),b=drain(owner.prepareSteps(second.request,2,ledger.reserve));
    expect(encodeStructuralObject(b.source)).toBe(encodeStructuralObject(second.expected));expect(b.source.materials).toBe(a.source.materials);
    expect(()=>drain(owner.prepareSteps({...second.request,sourceSubset:{...second.request.sourceSubset,expectedDigest:'fnv1a64-v1:0000000000000000'}},2,ledger.reserve))).toThrow(/digest/i);
    expect(()=>drain(owner.prepareSteps({...second.request,sourceSubset:{...second.request.sourceSubset,ancestorDigest:'fnv1a64-v1:0000000000000000'}},2,ledger.reserve))).toThrow(/ancestor|digest/i);
    const cancelled=createHvpProbeTerrainSourceOwner(),pending=cancelled.prepareSteps(first.request,1,ledger.reserve);
    expect(pending.next().done).toBe(false);pending.return(undefined as never);expect(cancelled.residentBytes()).toBe(0);cancelled.dispose();
    owner.dispose();expect(owner.residentBytes()).toBe(0);expect(()=>drain(owner.prepareSteps(second.request,2,ledger.reserve))).toThrow(/disposed/i);
  }finally{owner.dispose();ledger.release();}
});

it('transports fresh plain data instead of hidden mutable Native slots',()=>{
  const hidden=new Map([['large',new Uint8Array(2*1024*1024)]]);Object.setPrototypeOf(hidden,Object.prototype);Object.freeze(hidden);
  const input:any={objectId:'hvp-cut-probe-rockarm-seed',frame:hidden,source:{proofDigests:[]},materials:[],bricks:[],anchors:[],joints:[],objectRevision:0,editRevision:0,commandEvidence:[]};
  const packet={ancestorDigest:'fnv1a64-v1:0000000000000000',expectedDigest:'fnv1a64-v1:0000000000000000',ancestorInput:input};
  const transported=structuredClone(copyHvpTerrainSubset(packet));
  expect(transported.ancestorInput!.frame).toEqual({});expect(()=>Map.prototype.has.call(transported.ancestorInput!.frame,'large')).toThrow();
  Map.prototype.set.call(hidden,'later',new Uint8Array(2*1024*1024));
  expect(structuredClone(copyHvpTerrainSubset(packet)).ancestorInput!.frame).toEqual({});
  const buffer=new ArrayBuffer(2*1024*1024);Object.setPrototypeOf(buffer,Object.prototype);Object.freeze(buffer);
  const bufferPacket={...packet,ancestorInput:{...input,frame:buffer}};
  expect(structuredClone(copyHvpTerrainSubset(bufferPacket)).ancestorInput!.frame).toEqual({});
});

it('quotes all cold clone metadata and rejects oversized extra/getter metadata before transport',()=>{
  const header={ancestorDigest:'fnv1a64-v1:0000000000000000',expectedDigest:'fnv1a64-v1:0000000000000000'};
  const input:any={objectId:'hvp-cut-probe-rockarm-seed',frame:{},source:{proofDigests:[]},materials:[],bricks:[],anchors:[],joints:[],objectRevision:0,editRevision:0,commandEvidence:[]};
  const small=hvpTerrainSubsetCloneBytes({...header,ancestorInput:input});
  expect(hvpTerrainSubsetCloneBytes({...header,ancestorInput:{...input,source:{proofDigests:['a'.repeat(512)]}}})).toBeGreaterThan(small);
  expect(()=>hvpTerrainSubsetCloneBytes({...header,ancestorInput:{...input,source:{proofDigests:['a'.repeat(2*1024*1024)]}}})).toThrow(/clone|budget|metadata/i);
  expect(()=>hvpTerrainSubsetCloneBytes({...header,ancestorInput:{...input,extra:'foreign'} as any})).toThrow(/fields|clone/i);
  const getter={...input};Object.defineProperty(getter,'source',{enumerable:true,get(){throw new Error('must not run');}});
  expect(()=>hvpTerrainSubsetCloneBytes({...header,ancestorInput:getter})).toThrow(/clone.*data|data.*clone/i);
});
