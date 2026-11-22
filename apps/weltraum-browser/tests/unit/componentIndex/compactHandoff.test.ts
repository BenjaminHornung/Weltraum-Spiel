import { expect,it } from "vitest";
import { HVP_COAST_MATERIAL_REGISTRY,materializeHvpCoastSource,prepareHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { createHvpTerrainRoot,restoreHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { analyzeHvpTerrainSupport } from "../../../src/hestia-prototype/terrain/supportPlan";
import { deriveStructuralObjectMassProperties } from "../../../src/voxel/structural";
import { ingestHvpStructuralCells } from "../../../src/hestia-prototype/terrain/structuralIngest";
import { createTerrainComponentIndex,compactSupportReport,materializeCompactCells } from "../../../src/voxel/structural/componentIndex";
import { cutAt,diagonalFixture,rootFor,uFixture,voxel } from "./compactFixtures";
import type { HvpCell } from "../../../src/hestia-prototype/terrain/picking";

const materials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));

function compare(cut:ReturnType<typeof cutAt>,index=createTerrainComponentIndex(cut.before)) {
  const oracle=analyzeHvpTerrainSupport(cut),result=index.prepareCompact(cut);
  expect(result.status).toBe(oracle.status);
  expect(compactSupportReport(result).fragments).toEqual(oracle.fragments);
  for(const [i,fragment] of result.fragments.entries()){
    const expected=deriveStructuralObjectMassProperties(ingestHvpStructuralCells(oracle.fragments[i].id,oracle.fragments[i].cells,materials),{maxVisitedCells:32768});
    expect(fragment.mass.totalMassKg).toBe(expected.totalMassKg);
    for(const k of ["x","y","z"] as const) expect(fragment.mass.centerOfMassMeters[k]).toBeCloseTo(expected.centerOfMassMeters![k],10);
    for(const k of ["xx","yy","zz","xy","xz","yz"] as const) {
      expect(fragment.mass.inertiaTensorKgMetersSquared[k]).toBeCloseTo(expected.inertiaTensorKgMetersSquared[k],8);
    }
    expect(fragment.ownerId).toBe(`hvp:terrain-fragment:r${cut.after.revision}:${oracle.fragments[i].digest}`);
    expect(materializeCompactCells(structuredClone(fragment))).toEqual(oracle.fragments[i].cells);
  }
  return result;
}

it("preserves the authentic 64-cell cut, exact mass, collider partition, and existing stable owner",()=>{
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"arm-p1",1);
  const cut=cutAt(root,[176,78,76],[180,82,80]);
  expect(cut.changed).toHaveLength(64);
  const result=compare(cut),f=result.fragments[0];
  expect(f.cellCount).toBe(384);expect(f.massKg).toBe(1722.65625);expect(f.colliderBoxes).toHaveLength(1);
  expect(f.parts.length).toBeLessThan(f.cellCount);
},60000);

it("shares unchanged component references over ten diagonal blocks with alternating mineral densities",()=>{
  const size:HvpCell=[192,32,16];
  const root=rootFor(diagonalFixture(10),size),cut=cutAt(root,[14,2,4]),index=createTerrainComponentIndex(cut.before);
  const blocks:HvpCell[]=[];
  for(let y=0;y<2;y++) for(let x=0;x<12;x++) blocks.push([x,y,0]);
  const build=index.warm(blocks);
  const a=compare(cut,index),b=index.prepareCompact(cut);
  expect(a.fragments).toHaveLength(1);
  expect(a.counters).toMatchObject({blocksBuilt:1,dirtyBlocksBuilt:1,voxelPayloadBytesCopied:0});
  const f=a.fragments[0];
  expect(f.parts.length).toBeGreaterThanOrEqual(10);
  expect(f.colliderBoxes.length).toBeGreaterThan(1);
  const unchanged=f.parts.filter(p=>p.leafRevision===0);
  for(const p of unchanged) expect(b.fragments[0].parts).toContain(p);
  expect(b.fragments[0].parts.find(p=>p.leafRevision>0)).not.toBe(f.parts.find(p=>p.leafRevision>0));
  expect(a.counters.partReferences).toBe(f.parts.length);
  expect(index.residentBytes()).toBeGreaterThan(build.blockTypedArrayBytesAllocated/3);
  expect(compare(cutAt(rootFor(diagonalFixture(10,true),size),[14,2,4])).fragments).toHaveLength(0);
  const cold=cutAt(restoreHvpTerrainRoot(root.checkpoint()),[14,2,4]);
  expect(compare(cold).fragments).toEqual(a.fragments);
  console.info("P1_DIAGONAL",JSON.stringify({initial:build,warm:a.counters,repeat:b.counters,resident:index.residentBytes(),
    cells:f.cellCount,parts:f.parts.length,shapes:f.colliderBoxes.length}));
},120000);

it("returns disjoint U and loose-shard owners in one mixed block and preserves its anchored pillar",()=>{
  const root=rootFor([...uFixture(),voxel(13,2,4,4),voxel(13,2,3,3)]);
  // Separate the shard from the beam by cutting the 2x1 support and selecting its z-side seed.
  const cut=cutAt(root,[12,2,4],[14,3,5]),result=compare(cut);
  expect(result.fragments).toHaveLength(2);
  const u=result.fragments.find(f=>f.cellCount>1)!;
  expect(u.colliderBoxes.length).toBeGreaterThan(1);
  const admitted=materializeCompactCells(u);
  expect(admitted.some(c=>c.x===18&&c.y===8&&c.z===4)).toBe(false);
  expect(admitted.some(c=>c.x===12&&c.y===1&&c.z===4)).toBe(false);
  expect(result.fragments.flatMap(f=>f.parts).filter(p=>p.origin.join()==="0,0,0")).toHaveLength(2);
  const index=createTerrainComponentIndex(root.read()),full=root.prepareTransfer(cut,result.fragments.flatMap(materializeCompactCells));
  root.commit(full);index.commit(full,root.read());
  const restored=restoreHvpTerrainRoot(root.checkpoint());
  for(const world of [root,restored]) {
    expect(world.read().readSlot(12,1,4)).toBe(1);expect(world.read().readSlot(18,3,4)).toBe(0);
    expect(world.read().sourceDigest).toBe(full.after.sourceDigest);
  }
  expect(index.prepareCompact(cutAt(root,[12,1,4])).fragments).toEqual(createTerrainComponentIndex(restored.read()).prepareCompact(cutAt(restored,[12,1,4])).fragments);
},60000);

it("invalidates the old coverage, blocks unresolved support, and reads newly loaded support or air",()=>{
  const cells=diagonalFixture(2),gap:HvpCell=[38,5,4],size:HvpCell=[64,16,16];
  const pendingRoot=rootFor(cells,size,gap),pending=cutAt(pendingRoot,[14,2,4]),old=createTerrainComponentIndex(pendingRoot.read());
  expect(old.prepareCompact(pending)).toMatchObject({status:"UnknownBoundary",fragments:[]});
  expect(old.prepareCompact(pending)).toMatchObject({status:"UnknownBoundary",fragments:[]});
  for(const anchor of [true,false]) {
    const loaded=rootFor(diagonalFixture(2,anchor),size),cut=cutAt(loaded,[14,2,4]);
    expect(()=>old.prepareCompact(cut)).toThrow(/Stale/);
    expect(compare(cut).fragments).toHaveLength(anchor?0:1);
  }
});

it("rejects crossing, duplicate, overlong and overlapping membership received without a resident index",()=>{
  const part={origin:[0,0,0] as HvpCell,label:1,leafRevision:1,runs:[0x10021]};
  expect(materializeCompactCells({parts:[part]})).toEqual([voxel(1,2,0)]);
  for(const parts of [[{...part,runs:[0x1100f]}],[part,part],[{...part,runs:[0x50000]}],[part,{...part,label:2}],
    [{...part,runs:[0x11020,0x10021]}],[{...part,runs:Array(4097).fill(0x10000)}]]) {
    expect(()=>materializeCompactCells({parts})).toThrow(/compact/);
  }
});

it("reuses an entire unchanged mixed-material component and its exact descriptors by identity",()=>{
  const cells=[voxel(15,0,3),voxel(15,1,3),voxel(15,2,3),voxel(16,2,3),voxel(17,2,3,3),voxel(17,3,3,4)];
  const root=rootFor(cells),cut=cutAt(root,[15,2,3]),index=createTerrainComponentIndex(cut.before);
  index.warm([[0,0,0],[1,0,0]]);
  const a=index.prepareCompact(cut),b=index.prepareCompact(cut);
  expect(a.fragments[0].parts[0]).toBe(b.fragments[0].parts[0]);
  expect(a.fragments[0].colliderBoxes).toBe(b.fragments[0].colliderBoxes);
  expect(a.fragments[0].mass).toBe(b.fragments[0].mass);
  expect(a.counters).toMatchObject({descriptorsBuilt:0,descriptorReferencesReused:2,voxelPayloadBytesCopied:0});
});

it("rejects more than 64 exact shapes without publishing a partial membership or filling holes",()=>{
  const cells=[voxel(2,0,3),voxel(2,1,3)];
  for(let x=2;x<136;x++){
    cells.push(voxel(x,2,3));
    if(x%2===0) cells.push(voxel(x,3,3,4));
  }
  const cut=cutAt(rootFor(cells,[144,16,16]),[2,1,3]);
  const state=createTerrainComponentIndex(cut.before).prepareCompact(cut);
  expect(state).toMatchObject({status:"FragmentOverBudget",fragments:[]});
  expect(analyzeHvpTerrainSupport(cut)).toMatchObject({status:"FragmentOverBudget",fragments:[]});
},60000);
