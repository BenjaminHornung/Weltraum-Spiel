import {expect,it} from "vitest";
import {createHvpLiveSupport} from "../../src/hestia-prototype/terrain/liveSupport";
import {releaseHvpOwnedSupportPlan} from "../../src/hestia-prototype/terrain/supportPlan";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {rootFor,cutAt,voxel} from "./componentIndex/compactFixtures";

it("an empty column falls back to face connectivity across a second support",()=>{
  const cells=Array.from({length:9},(_,x)=>voxel(15+x,8,4));
  for(const x of [15,23])for(let y=0;y<8;y++)cells.push(voxel(x,y,4));
  const root=rootFor(cells),cut=cutAt(root,[15,3,4]);
  const baseline=createTerrainComponentIndex(cut.before).prepareCompact(cut);
  const candidate=createTerrainComponentIndex(cut.before).prepareCompact(cut,{tryFloorColumn:true});
  expect(candidate.status).toBe(baseline.status);
  expect(candidate.fragments.map(materializeCompactCells)).toEqual(baseline.fragments.map(materializeCompactCells));
  expect(candidate.fragments).toHaveLength(0);
});

it("tracks only the published root across transfer, load and disposal",()=>{
  const cells=Array.from({length:19},(_,x)=>voxel(10+x,8,5));
  for(let y=0;y<8;y++)cells.push(voxel(10,y,5));
  const root=rootFor(cells), live=createHvpLiveSupport(root.read()),cut=cutAt(root,[10,5,5]);
  const first=live.analyze(cut,0);
  expect(first.plan.fragments[0]?.cells).toHaveLength(21);
  expect(first.plan.fragments[0]?.compactSource?.cellCount).toBe(21);
  releaseHvpOwnedSupportPlan(first.plan);
  const transfer=root.prepareTransfer(cut,first.plan.fragments[0]!.cells);
  root.commit(transfer);
  live.committed(transfer,root.read());
  const second=live.analyze(cutAt(root,[10,4,5]),0);
  expect(second.plan.fragments).toHaveLength(0);
  releaseHvpOwnedSupportPlan(second.plan);
  const other=rootFor(cells);
  const reload=live.analyze(cutAt(other,[10,5,5]),0);
  expect(reload.plan.fragments[0]?.digest).toBe(first.plan.fragments[0]?.digest);
  releaseHvpOwnedSupportPlan(reload.plan);
  live.dispose();
});
