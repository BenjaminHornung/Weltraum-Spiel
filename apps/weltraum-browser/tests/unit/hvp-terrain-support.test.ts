import {expect,it} from "vitest";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {analyzeHvpSupportSnapshot,analyzeHvpTerrainSupport,assertHvpSupportCurrent,createHvpSupportTimingsCollector} from "../../src/hestia-prototype/terrain/supportPlan";
import {materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";

type Cell=readonly[number,number,number];
const fixture=(cells:readonly Cell[],cut:Cell,unknown?:Cell)=>{
  const occupied=new Set(cells.map(c=>c.join(",")));
  const root=createHvpTerrainRoot({sizeX:160,sizeY:6,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},sourceDigest:"12345678",
    readSlot:(x,y,z)=>unknown?.join(",")===`${x},${y},${z}`?undefined:occupied.has(`${x},${y},${z}`)?1:0},"support-test",1);
  const before=root.read();
  const plan=root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
    commandId:"cut",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:cut,max:[cut[0]+1,cut[1]+1,cut[2]+1]}});
  return {root,plan};
};
// Full-fixture reference flood fill, deliberately independent of optimized probes.
const reference=(cells:readonly Cell[],removed:Cell)=>{
  const remaining=new Map(cells.filter(c=>c.join(",")!==removed.join(",")).map(c=>[c.join(","),c]));
  const detached:string[][]=[];
  while(remaining.size>0){
    const seed=remaining.values().next().value!;const queue:Cell[]=[seed],members:string[]=[];let anchored=false;
    remaining.delete(seed.join(","));
    for(let i=0;i<queue.length;i+=1){const cell=queue[i]!;members.push(cell.join(","));anchored ||= cell[1]===0;
      for(let axis=0;axis<3;axis+=1){for(const sign of [-1,1]){const p=[...cell];p[axis]!+=sign;
        const next=remaining.get(p.join(","));if(next){remaining.delete(p.join(","));queue.push(next);}
      }}
    }
    if(!anchored){detached.push(members.sort());}
  }
  return detached.sort((a,b)=>a[0]!.localeCompare(b[0]!));
};
const arm:readonly Cell[]=[[15,0,1],[15,1,1],[15,2,1],[16,2,1],[17,2,1],[18,2,1]];
it("matches a full face-six reference across leaves with real mass and exact compound admission",()=>{
  const {root,plan}=fixture(arm,[16,2,1]);const result=analyzeHvpTerrainSupport(plan);
  expect(result.status,result.reason).toBe("Ready");
  expect(result.fragments.map(f=>f.cells.map(c=>`${c.x},${c.y},${c.z}`).sort()).sort((a,b)=>a[0]!.localeCompare(b[0]!)))
    .toEqual(reference(arm,[16,2,1]));
  expect(result.fragments[0]!.massKg).toBe(2*.125**3*2400);
  expect(result.fragments[0]!.colliders).toBe(1);
  expect(root.read()).toBe(plan.before);expect(root.read().readSlot(16,2,1)).toBe(1);
  expect(()=>assertHvpSupportCurrent(result,root.read())).not.toThrow();
  root.commit(plan);expect(()=>assertHvpSupportCurrent(result,root.read())).toThrow(/Stale/);
});
it("does not join corner contacts or treat a leaf edge as an anchor",()=>{
  const cells:readonly Cell[]=[[15,2,1],[16,2,1],[15,3,1]];
  const result=analyzeHvpTerrainSupport(fixture(cells,[15,2,1]).plan);
  expect(result.status,result.reason).toBe("Ready");expect(result.fragments.map(f=>f.cells.length)).toEqual([1,1]);
});
it("keeps support across a leaf and detects the last actual support disappearing",()=>{
  const cells:readonly Cell[]=[...arm,[17,3,1]];
  const supported=analyzeHvpTerrainSupport(fixture(cells,[17,3,1]).plan);
  expect(supported.status).toBe("Ready");expect(supported.fragments).toEqual([]);
  expect(analyzeHvpTerrainSupport(fixture(arm,[16,2,1]).plan).fragments).toHaveLength(1);
});
it("publishes no fragments on unknown coverage or a search/fragment budget limit",()=>{
  // Unknown is in an untouched neighbouring leaf, not the cut's COW leaf.
  const extended:Cell[]=[...arm];for(let x=19;x<32;x+=1){extended.push([x,2,1]);}
  expect(analyzeHvpTerrainSupport(fixture(extended,[16,2,1],[32,2,1]).plan)).toMatchObject({status:"UnknownBoundary",fragments:[]});
  const plan=fixture(arm,[16,2,1]).plan;
  expect(analyzeHvpTerrainSupport(plan,{maxProbes:2})).toMatchObject({status:"OverBudget",fragments:[]});
  expect(analyzeHvpTerrainSupport(plan,{maxFragmentCells:1})).toMatchObject({status:"FragmentOverBudget",fragments:[]});
});
it("rejects a complete component that would require more than 64 exact collider boxes",()=>{
  const cells:Cell[]=[[10,0,1],[10,1,1]];
  for(let x=0;x<=130;x+=1){cells.push([x+10,2,1]);if(x%2===1){cells.push([x+10,3,1]);}}
  expect(analyzeHvpTerrainSupport(fixture(cells,[10,1,1]).plan)).toMatchObject({status:"FragmentOverBudget",fragments:[]});
});

it("previews the actual authored rock arm without detaching or changing its canonical root",()=>{
  const prepared=prepareHvpCoastSource(materializeHvpCoastSource());
  const root=createHvpTerrainRoot(prepared,"rock-arm",0),before=root.read();
  // Independent world coordinates: .5m support below a 3m x .5m x .5m roof.
  const cut=root.prepare({sessionId:"rock-arm",epoch:0,revision:0,sourceDigest:before.sourceDigest,commandId:"preview",toolPolicy:"hvp-plasma-v1",
    shape:{kind:"Box",min:[176,78,76],max:[180,82,80]}});
  expect(cut.changed).toHaveLength(64);
  expect(prepared.readSlot(184,76,78)).toBe(0); // real air below the roof, not a filled heightfield
  expect(prepared.readSlot(184,82,78)).toBe(1);
  const plan=analyzeHvpTerrainSupport(cut);
  expect(plan.status,plan.reason).toBe("Ready");expect(plan.fragments).toHaveLength(1);
  expect(plan.fragments[0]).toMatchObject({min:[176,82,76],max:[200,86,80],colliders:1});
  let expectedMass=0;
  for(let z=76;z<80;z+=1){for(let y=82;y<86;y+=1){for(let x=176;x<200;x+=1){
    expectedMass+=[0,2400,2400,1500,1200][prepared.readSlot(x,y,z)]!*.125**3;
  }}}
  expect(plan.fragments[0]!.massKg).toBe(expectedMass); // includes the real soil/moss surface, not all-stone mass
  expect(expectedMass).toBeGreaterThan(1500);expect(expectedMass).toBeLessThan(1800);
  expect(plan.fragments[0]!.cells).toHaveLength(384);
  console.info("Authored rock-arm support",{sourceDigest:prepared.sourceDigest,probes:plan.probes,massKg:expectedMass});
  expect(root.read()).toBe(before);expect(root.read().readSlot(176,78,76)).toBe(1);
},120_000);

it("records deterministic support sub-spans without changing the admitted fragments",()=>{
  const {plan}=fixture(arm,[16,2,1]);
  const plain=analyzeHvpSupportSnapshot(plan.after,plan.changed.map(c=>c.cell));
  let t=0;const clock=createHvpSupportTimingsCollector(()=>t+=1.5);
  const timed=analyzeHvpSupportSnapshot(plan.after,plan.changed.map(c=>c.cell),{},clock);
  expect(timed).toEqual(plain);
  expect(timed.fragments).toHaveLength(1);
  const cells=timed.fragments[0]!.cells.length;
  const timings=clock.done(timed.fragments.length,timed.fragments.reduce((n,f)=>n+f.cells.length,0));
  expect(timings.fragmentCount).toBe(1);expect(timings.fragmentCells).toBe(cells);
  expect(timings).toMatchObject({seedsMs:1.5,supportMs:3,ingestMs:1.5,recipeMs:1.5,totalMs:7.5});
  const bd=timings.recipeBreakdown!;
  for(const key of ["massMs","classifyMs","transitionMs","axesMs"] as const){
    expect(typeof bd[key],`recipeBreakdown.${key}`).toBe("number");expect(bd[key],`recipeBreakdown.${key}`).toBeGreaterThanOrEqual(0);
  }
  expect(bd.massMs+bd.classifyMs+bd.transitionMs+bd.axesMs).toBeGreaterThan(0);
  let u=0;const pure=createHvpSupportTimingsCollector(()=>(u+=2));
  pure.recipe({massMs:1,classifyMs:2});pure.recipe({transitionMs:3,axesMs:4});
  expect(pure.done(2,9).recipeBreakdown).toEqual({massMs:1,classifyMs:2,transitionMs:3,axesMs:4});
  expect(createHvpSupportTimingsCollector().done(0,0)).not.toHaveProperty("recipeBreakdown");
});
