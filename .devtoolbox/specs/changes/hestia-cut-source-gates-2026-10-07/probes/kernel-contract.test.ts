import {beforeAll, expect, it} from "../../../../../apps/weltraum-browser/node_modules/vitest/dist/index.js";
import {createHvpTerrainRoot} from "../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/cutPlan";
import {ingestHvpStructuralCells} from "../../../../../apps/weltraum-browser/src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody} from "../../../../../apps/weltraum-browser/src/hestia-prototype/physics/rigidRecipe";
import {initializeHvpRapier, R} from "../../../../../apps/weltraum-browser/src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody} from "../../../../../apps/weltraum-browser/src/hestia-prototype/physics/rigidBody";
import {encodeHvpBody, decodeHvpBody} from "../../../../../apps/weltraum-browser/src/hestia-prototype/persistence/bodyCheckpoint";
import {readHvpBodyCells} from "../../../../../apps/weltraum-browser/src/hestia-prototype/physics/bodyCutPlan";
import {isIssuedStructuralObject, createStructuralOwnerLedger} from "../../../../../apps/weltraum-browser/src/voxel/structural/model";
import {createProbeTerrainMirrorSteps, deriveProbeFragmentSteps} from "./kernel";

const drain = <T>(steps:Generator<unknown,T,unknown>):T => {for(;;){const s=steps.next(); if(s.done){return s.value;}}};
const makeRoot = () => createHvpTerrainRoot({sizeX:32,sizeY:32,sizeZ:32,cellMeters:.125,
  originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",readSlot:(x:number,y:number,z:number)=>x>=0&&y>=0&&z>=0&&x<32&&y<32&&z<32?1:undefined},"probe-terrain",0);

it("retains one derivative snapshot, exact leaf digests and atomic generation-bound deltas",()=>{
  const root=makeRoot(), mirror=drain(createProbeTerrainMirrorSteps(root.read()));
  expect(mirror.read().sourceDigest).toBe(root.read().sourceDigest);
  expect(mirror.bytes.initialCopied).toBe(32**3);
  const old=mirror.read();
  const cut=root.prepare({...root.read(),commandId:"cut-1",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[1,1,1],max:[3,3,3]}});
  const draft=drain(mirror.prepareSteps(cut.after));
  expect(draft.reader.readSlot(1,1,1)).toBe(0);
  expect(mirror.read().readSlot(1,1,1)).toBe(1);
  expect(draft.reader.sourceDigest).toBe(cut.after.sourceDigest);
  expect(draft.wireBytes).toBe(4096);
  root.commit(cut); mirror.commit(draft,root.read());
  expect(mirror.read().sourceDigest).toBe(root.read().sourceDigest);
  expect(mirror.read().readSlot(1,1,1)).toBe(0);
  expect(()=>old.readSlot(1,1,1)).toThrow(/stale/i);
  expect(mirror.bytes.deltaCopied).toBe(4096);
  expect(()=>mirror.commit(draft,root.read())).toThrow(/stale|pending/i);
  const next=root.prepare({...root.read(),commandId:"cut-2",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[20,1,1],max:[22,3,3]}});
  const cancelled=drain(mirror.prepareSteps(next.after)); mirror.cancel(cancelled);
  expect(()=>cancelled.reader.readSlot(20,1,1)).toThrow(/stale/i);
  expect(mirror.read().readSlot(20,1,1)).toBe(1);
  expect(()=>mirror.commit(cancelled,next.after)).toThrow(/stale|pending/i);
  const late=drain(mirror.prepareSteps(next.after)); mirror.dispose();
  expect(()=>mirror.commit(late,next.after)).toThrow(/disposed/i);
  expect(()=>mirror.read()).toThrow(/disposed/i);
  expect(mirror.bytes.persistentSlots).toBe(0);
});

it("rejects foreign and skipped source generations without publishing derivative bytes",()=>{
  const root=makeRoot(), mirror=drain(createProbeTerrainMirrorSteps(root.read()));
  expect(()=>drain(mirror.prepareSteps({...root.read(),epoch:1}))).toThrow(/source|foreign|unvalidated/i);
  const first=root.prepare({...root.read(),commandId:"cut-1",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}}); root.commit(first);
  const second=root.prepare({...root.read(),commandId:"cut-2",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[20,1,1],max:[21,2,2]}});
  expect(()=>drain(mirror.prepareSteps(second.after))).toThrow(/generation|revision/i);
  expect(mirror.read().revision).toBe(0); mirror.dispose();
});

beforeAll(initializeHvpRapier);
it("directly derives genuine issued fragment bytes from an issued ancestor and cold-loads the same source",()=>{
  const cells=Array.from({length:8*4*3},(_,i)=>({x:128+i%8,y:80+Math.floor(i/8)%4,z:80+Math.floor(i/32),materialId:1}));
  const materials=[{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"stone",destructible:true,tags:null}];
  const ancestor=ingestHvpStructuralCells("probe-ancestor",cells,materials), selected=cells.filter(c=>c.x<132);
  const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
  const direct=drain(deriveProbeFragmentSteps(ancestor,"probe-child",selected,ledger.reserve));
  expect(isIssuedStructuralObject(direct)).toBe(true);
  expect(direct.source).toEqual(ancestor.source);
  expect(readHvpBodyCells(direct)).toEqual(selected);
  const legacy=prepareHvpRigidBody(ingestHvpStructuralCells("probe-child",selected,materials)), recipe=prepareHvpRigidBody(direct);
  expect(recipe.mass.totalMassKg).toBe(legacy.mass.totalMassKg);
  expect(recipe.mass.centerOfMassMeters).toEqual(legacy.mass.centerOfMassMeters);
  expect(recipe.mass.inertiaTensorKgMetersSquared).toEqual(legacy.mass.inertiaTensorKgMetersSquared);
  expect(recipe.colliders).toEqual(legacy.colliders);
  // The ancestor binding is deliberately retained. This is a new private identity,
  // not a claim of legacy AddBox-source hash equality or a persistence migration.
  expect(direct.contentHash).not.toBe(legacy.source.contentHash);
  const world=new R.World({x:0,y:-9.81,z:0});
  try{
    const body=installHvpRigidBody(world,recipe); world.step();
    const decoded=decodeHvpBody(encodeHvpBody("probe-child","terrain",recipe,body));
    expect(decoded.recipe.source.contentHash).toBe(direct.contentHash);
    expect(readHvpBodyCells(decoded.recipe.source)).toEqual(selected);
  }finally{world.free(); ledger.release();}
  const invalid=createStructuralOwnerLedger(0,96*1024*1024,128);
  try{
    expect(()=>drain(deriveProbeFragmentSteps(ancestor,"bad-child",[{...selected[0]!,materialId:2}],invalid.reserve))).toThrow(/material|occupancy|subset/i);
    expect(()=>drain(deriveProbeFragmentSteps({...ancestor},"bad-child",selected,invalid.reserve))).toThrow(/issued/i);
  }finally{invalid.release();}
});
