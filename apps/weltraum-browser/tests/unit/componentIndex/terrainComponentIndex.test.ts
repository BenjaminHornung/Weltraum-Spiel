import { expect, it } from "vitest";
import {createHvpTerrainRoot} from "../../../src/hestia-prototype/terrain/cutPlan";
import type {HvpCell} from "../../../src/hestia-prototype/terrain/picking";
import {analyzeHvpTerrainSupport,createHvpSupportTimingsCollector,analyzeHvpSupportSnapshot} from "../../../src/hestia-prototype/terrain/supportPlan";
import {materializeHvpCoastSource,prepareHvpCoastSource} from "../../../src/hvp/hvpCoastSource";
import {createTerrainComponentIndex} from "../../../src/voxel/structural/componentIndex";

const rootFor = (cells: readonly HvpCell[], unknown?: HvpCell, sizeX=64, sizeY=8, sizeZ=8) => {
  const occupied = new Set(cells.map(cell => cell.join(",")));
  return createHvpTerrainRoot({
    sizeX,sizeY,sizeZ,cellMeters:0.125,originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",
    readSlot:(x,y,z)=>unknown && x===unknown[0] && y===unknown[1] && z===unknown[2]
      ? undefined : occupied.has([x,y,z].join(",")) ? 1 : 0,
  },"topology",1);
};
type Root = ReturnType<typeof rootFor>;
function cutAt(root: Root,min:HvpCell,max:HvpCell=[min[0]+1,min[1]+1,min[2]+1]) {
  const before = root.read();
  return root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
    commandId:"index-test",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min,max}});
}
function compare(root: Root, cutCell:HvpCell) {
  const cut = cutAt(root,cutCell);
  const indexed = createTerrainComponentIndex(cut.before).prepare(cut), reference = analyzeHvpTerrainSupport(cut);
  expect(indexed.status).toBe(reference.status);
  expect(indexed.fragments).toEqual(reference.fragments.map(f=>f.cells));
  return indexed;
}
const arm: HvpCell[] = [[15,0,2],[15,1,2],[15,2,2],[16,2,2],[17,2,2],[18,2,2]];

it("agrees with the existing support oracle for last/second supports and multiple fragments",()=>{
  expect(compare(rootFor(arm),[16,2,2]).fragments).toHaveLength(1);
  expect(compare(rootFor([...arm,[18,1,2],[18,0,2]]),[16,2,2]).fragments).toHaveLength(0);
  expect(compare(rootFor([[16,2,2],[15,2,2],[16,3,2]]),[16,2,2]).fragments.map(f=>f.length)).toEqual([1,1]);
});

it("distinguishes unresolved coverage on a seam from a proved anchor",()=>{
  const cells:HvpCell[]=[...arm];
  for(let x=19;x<=31;x++) cells.push([x,2,2]);
  expect(compare(rootFor(cells,[32,2,2]),[16,2,2]).status).toBe("UnknownBoundary");
  expect(compare(rootFor([...cells,[30,1,2],[30,0,2]],[32,2,2]),[16,2,2]).status).toBe("Ready");
  expect(compare(rootFor(cells,[32,5,5]),[16,2,2]).status).toBe("Ready");
  expect(compare(rootFor(cells),[16,2,2]).fragments).toHaveLength(1);
});

it("bounds cold work and never returns provisional fragments on budget exhaustion",()=>{
  const cut=cutAt(rootFor(arm),[16,2,2]);
  const index=createTerrainComponentIndex(cut.before);
  expect(index.prepare(cut,{maxBlocksBuilt:1})).toMatchObject({status:"OverBudget",fragments:[]});
  expect(index.prepare(cut,{maxFragmentCells:1})).toMatchObject({status:"FragmentOverBudget",fragments:[]});
  expect(index.prepare(cut,{maxComponents:1})).toMatchObject({status:"OverBudget",fragments:[]});
});

it("visits a long thin bridge and only rebuilds the edited prewarmed block",()=>{
  const cells:HvpCell[]=[[15,0,2],[15,1,2]];
  for(let x=15;x<=130;x++) cells.push([x,2,2]);
  const cut=cutAt(rootFor(cells,undefined,144),[16,2,2]);
  const index=createTerrainComponentIndex(cut.before);
  index.warm(Array.from({length:9},(_,x):HvpCell=>[x,0,0]));
  const indexed=index.prepare(cut);
  const old=analyzeHvpTerrainSupport(cut);
  expect(indexed.status).toBe(old.status);
  expect(indexed.fragments).toEqual(old.fragments.map(f=>f.cells));
  expect(indexed.fragments[0]).toHaveLength(114);
  expect(indexed.counters).toMatchObject({blocksBuilt:1,dirtyBlocksBuilt:1,outputCells:114});
  expect(indexed.counters.componentsVisited).toBeGreaterThanOrEqual(8);
});

it("separates concurrent previews, checks published identity and invalidates old seams",()=>{
  const root=rootFor([...arm,[18,1,2],[18,0,2]]);
  const index=createTerrainComponentIndex(root.read());
  index.warm([[0,0,0],[1,0,0]]);
  const first=cutAt(root,[18,1,2]);
  const abandoned=cutAt(root,[16,2,2]);
  expect(index.prepare(first).fragments).toHaveLength(0);
  expect(index.prepare(abandoned).fragments).toHaveLength(0);
  expect(()=>index.commit(first,abandoned.after)).toThrow(/published/);
  root.commit(first);index.commit(first,root.read());
  expect(()=>index.prepare(abandoned)).toThrow(/Stale/);
  const next=cutAt(root,[16,2,2]);
  expect(index.prepare(next).fragments).toEqual(analyzeHvpTerrainSupport(next).fragments.map(f=>f.cells));
  expect(()=>index.prepare({...next,before:{...root.read()}})).toThrow(/Stale/);
});

it("differentially checks seeded cuts at the intersection of eight blocks and changing distant anchors",()=>{
  for (let seed=1;seed<=8;seed++) {
    let state=seed;
    const random=()=>{
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      return state;
    };
    const cells:HvpCell[]=[[15,16,16],[16,16,16],[17,16,16],[16,15,16],[16,16,15],[16,17,16],[16,16,17]];
    // At this corner the base arms meet across x, y and z seams. A diagonal by itself cannot carry a load.
    cells.push([15,15,15]);
    for(let n=0;n<24;n++){
      const xyz=[random()%5+14,random()%5+14,random()%5+14] as const;
      cells.push(xyz);
    }
    for(let y=0;y<16;y++) cells.push([15,y,16]);
    if(seed%2===0) for(let y=0;y<16;y++) cells.push([17,y,16]);
    const root=rootFor(cells,undefined,32,32,32);
    const index=createTerrainComponentIndex(root.read());
    const blocks:HvpCell[]=[];
    for(let z=0;z<2;z++) for(let y=0;y<2;y++) for(let x=0;x<2;x++) blocks.push([x,y,z]);
    index.warm(blocks);
    const check=(cell:HvpCell)=>{
      const cut=cutAt(root,cell);
      const oracle=analyzeHvpTerrainSupport(cut);
      const candidate=index.prepare(cut);
      expect(candidate.status).toBe(oracle.status);
      expect(candidate.fragments).toEqual(oracle.fragments.map(f=>f.cells));
      return cut;
    };
    check([16,16,16]);
    const support=check([15,4,16]);
    root.commit(support);
    index.commit(support,root.read());
    check([16,16,16]);
  }
},60_000);

it("compares cold and warm topology with the complete material-bearing rock-arm oracle",()=>{
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"real-arm",1);
  const cut=cutAt(root,[176,78,76],[180,82,80]);
  const changed=cut.changed.map(change=>change.cell);
  const rows=[];
  for(let trial=0;trial<3;trial++){
    const index=createTerrainComponentIndex(cut.before);
    const evaluateOracle=()=>{
      const clock=createHvpSupportTimingsCollector();
      const start=performance.now();
      const result=analyzeHvpSupportSnapshot(cut.after,changed,{},clock);
      const elapsedMs=performance.now()-start;
      const spans=clock.done(result.fragments.length,result.fragments.reduce((sum,f)=>sum+f.cells.length,0));
      return {result,elapsedMs,seedsAndSupportMs:spans.seedsMs+spans.supportMs};
    };
    const evaluateIndex=()=>{
      const start=performance.now(),result=index.prepare(cut);
      return {result,elapsedMs:performance.now()-start};
    };
    let old,cold;
    if(trial%2===0){old=evaluateOracle();cold=evaluateIndex();}else{cold=evaluateIndex();old=evaluateOracle();}
    const warm=evaluateIndex();
    expect(old.result.status).toBe("Ready");
    for(const sample of [cold,warm]){
      expect(sample.result.status,JSON.stringify(sample.result.counters)).toBe("Ready");
      expect(sample.result.fragments).toEqual(old.result.fragments.map(f=>f.cells));
      expect(sample.result.fragments.map(f=>f.length)).toEqual([384]);
    }
    expect(warm.result.counters.blocksBuilt).toBe(warm.result.counters.dirtyBlocksBuilt);
    rows.push({trial,oracleProbes:old.result.probes,oracleTotalMs:old.elapsedMs,oracleSeedsAndSupportMs:old.seedsAndSupportMs,
      topologyColdMs:cold.elapsedMs,topologyWarmMs:warm.elapsedMs,cold:cold.result.counters,warm:warm.result.counters});
  }
  console.info("rock-arm candidate and oracle",JSON.stringify(rows));
},60_000);
