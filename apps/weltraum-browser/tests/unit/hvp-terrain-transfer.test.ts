import {expect,it} from "vitest";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {analyzeHvpTerrainSupport} from "../../src/hestia-prototype/terrain/supportPlan";
import {prepareHvpTerrainTransfer} from "../../src/hestia-prototype/terrain/terrainTransfer";

const fixture=()=>{
  const cells=new Set(["15:0:1","15:1:1","15:2:1","16:2:1","17:2:1","18:2:1"]);
  const root=createHvpTerrainRoot({sizeX:32,sizeY:4,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},
    sourceDigest:"12345678",readSlot:(x,y,z)=>cells.has(`${x}:${y}:${z}`)?1:0},"transfer",0);
  const before=root.read(),cut=root.prepare({sessionId:"transfer",epoch:0,revision:0,sourceDigest:before.sourceDigest,commandId:"cut",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[16,2,1],max:[17,3,2]}});
  return {root,before,cut,support:analyzeHvpTerrainSupport(cut)};
};
it("atomically clears transferred cells in one generation and distinguishes removed from moved mass",()=>{
  const {root,before,support}=fixture(),t=prepareHvpTerrainTransfer(root,support);
  expect(root.read()).toBe(before);expect(t.directRemovedCells).toBe(1);expect(t.transferredCells).toBe(2);
  expect(t.materialRemovedKg).toBe(2400*.125**3);expect(t.transferredMassKg).toBe(2*2400*.125**3);
  expect(t.plan.after.revision).toBe(1);expect(t.plan.after.leafRevision(1,0,0)).toBe(1);
  expect(t.plan.after.leafRevision(0,0,0)).toBe(0); // dependency only, not source content
  for(const x of [16,17,18]){expect(t.plan.after.readSlot(x,2,1)).toBe(0);expect(before.readSlot(x,2,1)).toBe(1);}
  expect(t.plan.after.readSlot(15,2,1)).toBe(1);
  root.commit(t.plan);expect(root.read()).toBe(t.plan.after);
  root.rollback(t.plan);expect(root.read()).toBe(before);
});
it("rejects stale/forged support and duplicate or protected transfer cells before any root change",()=>{
  const {root,before,cut,support}=fixture();
  expect(()=>prepareHvpTerrainTransfer(root,{...support})).toThrow(/Stale|incomplete/);
  const cell={x:17,y:2,z:1,materialId:1};
  expect(()=>root.prepareTransfer(cut,[cell,cell])).toThrow(/Invalid/);
  expect(()=>root.prepareTransfer(cut,[{x:15,y:0,z:1,materialId:1}])).toThrow(/Invalid/);
  expect(root.read()).toBe(before);root.commit(cut);
  expect(()=>prepareHvpTerrainTransfer(root,support)).toThrow(/Stale/);
});
