import {writeFileSync} from "node:fs";
import {beforeAll, expect, it} from "vitest";
import {createTerrainComponentIndex, materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import type {Box, Span} from "../../src/voxel/structural/componentIndex/exactShapes";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {prepareHvpLocalBodyCut,readHvpBodyCells} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {issueHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {prepareCompactMovingPlan} from "../../src/hestia-prototype/physics/compactMovingPlan";
import {prepareHvpTerrainFragment} from "../../src/hestia-prototype/physics/terrainFragment";
import {initializeHvpRapier,R} from "../../src/hestia-prototype/physics/rapierPort";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {HVP_SOURCE_MIN_METERS,materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import type {HvpCell} from "../../src/hestia-prototype/terrain/picking";
import {cutAt,diagonalFixture,rootFor,uFixture} from "./componentIndex/compactFixtures";

beforeAll(initializeHvpRapier);
function rockRoot(){
  return createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"moving-runs",1);
}
function fixture(root:ReturnType<typeof rockRoot>, cutMin:HvpCell, cutMax?:HvpCell) {
  const cut=cutAt(root,cutMin,cutMax),index=createTerrainComponentIndex(cut.before);
  const f=index.prepareCompact(cut).fragments[0]!;
  const budget=createStructuralOwnerLedger(0,96*1024*1024,128);
  const request={ownerId:f.ownerId,cells:[],origin:HVP_SOURCE_MIN_METERS,massKg:f.massKg,colliderBoxes:f.colliderBoxes,
    compactSource:{generation:f.revision,parts:f.parts,cellCount:f.cellCount}};
  try {
    const owner=issueHvpCompactNativeOwner(request,{sessionId:cut.before.sessionId,epoch:cut.before.epoch,
      generation:f.revision,terrainDigest:cut.after.sourceDigest},budget.reserve);
    const oracle=prepareHvpTerrainFragment({...request,compactSource:undefined,cells:materializeCompactCells(f)},f.revision);
    return {owner,oracle};
  } finally {budget.release();index.dispose();}
}
function cells(runs:readonly Span[]) {
  return runs.flatMap(s=>Array.from({length:s.end-s.x},(_,i)=>({x:s.x+i,y:s.y,z:s.z,materialId:s.material})));
}
const key=(p:{x:number;y:number;z:number;materialId:number})=>[p.x,p.y,p.z,p.materialId].join(",");
function verifyNative(boxes:readonly Box[],spans:readonly Span[]) {
  const world=new R.World({x:0,y:0,z:0});
  try {
    for(const {min,max} of boxes){
      const sizes=[0,1,2].map(i=>(max[i]!-min[i]!)*.0625);
      const center=[0,1,2].map(i=>(max[i]!+min[i]!)*.0625);
      world.createCollider(R.ColliderDesc.cuboid(sizes[0]!,sizes[1]!,sizes[2]!).setTranslation(center[0]!,center[1]!,center[2]!));
    }
    world.updateSceneQueries();
    const occupied=new Set(cells(spans).map(c=>[c.x,c.y,c.z].join(",")));
    const min=[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]!))),max=[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i]!)));
    for(let z=min[2]!;z<max[2]!;z++) for(let y=min[1]!;y<max[1]!;y++) for(let x=min[0]!;x<max[0]!;x++){
      let hits=0;
      world.intersectionsWithPoint({x:(x+.5)*.125,y:(y+.5)*.125,z:(z+.5)*.125},()=>{hits++;return true;});
      expect(hits).toBe(occupied.has([x,y,z].join(","))?1:0);
    }
  }finally{world.free();}
}
const cases=[
  {name:"fallen rock arm",root:rockRoot,cutMin:[176,78,76],cutMax:[180,82,80],hit:[189,85,76],edge:4,brush:"Box"},
  {name:"spherical rock recut",root:rockRoot,cutMin:[176,78,76],cutMax:[180,82,80],hit:[189,85,76],edge:4,brush:"Sphere"},
  {name:"two disconnected U-arm owners",root:()=>rootFor(uFixture()),cutMin:[12,2,4],hit:[17,3,4],edge:1,brush:"Box"},
  {name:"mixed-density hollow U",root:()=>rootFor(uFixture()),cutMin:[12,2,4],hit:[12,19,4],edge:1,brush:"Box"},
  {name:"mixed-material diagonal",root:()=>rootFor(diagonalFixture(2)),cutMin:[14,2,4],hit:[31,4,4],edge:1,brush:"Box"},
] as const;
it.each(cases)("matches exact cells, masses, all inertia entries and native occupied volume for $name",test=>{
  const f=fixture(test.root(),test.cutMin,"cutMax" in test?test.cutMax:undefined);
  try {
    const verify=prepareCompactMovingPlan(f.owner,test.hit,test.edge,test.brush);
    expect(verify.kind).toBe("Planned");if(verify.kind!=="Planned")throw Error("Unexpected profile");
    const oracle=prepareHvpLocalBodyCut(f.oracle.source,test.hit,"moving-cut-1",test.edge,test.brush);
    expect(verify.removed.count).toBe(oracle.plan.removedCells);
    expect(verify.removed.mass.totalMassKg).toBeCloseTo(oracle.removedMass.totalMassKg,7);
    expect(verify.children).toHaveLength(oracle.plan.parts.length);
    for(const name of ["x","y","z"] as const)expect(verify.removed.mass.centerOfMassMeters[name]).toBeCloseTo(oracle.removedMass.centerOfMassMeters![name],8);
    for(const name of ["xx","yy","zz","xy","xz","yz"] as const)expect(verify.removed.mass.inertiaTensorKgMetersSquared[name]).toBeCloseTo(oracle.removedMass.inertiaTensorKgMetersSquared[name],7);
    for(const child of verify.children) {
      const membership=cells(child.runs).map(key).sort(),first=membership[0];
      const part=oracle.plan.parts.find(p=>readHvpBodyCells(p.recipe.source).some(c=>key(c)===first))!;
      expect(readHvpBodyCells(part.recipe.source).map(key).sort()).toEqual(membership);
      expect(child.mass.totalMassKg).toBeCloseTo(part.recipe.mass.totalMassKg,7);
      for(const name of ["x","y","z"] as const)expect(child.mass.centerOfMassMeters[name]).toBeCloseTo(part.recipe.mass.centerOfMassMeters![name],8);
      for(const name of ["xx","yy","zz","xy","xz","yz"] as const)expect(child.mass.inertiaTensorKgMetersSquared[name]).toBeCloseTo(part.recipe.mass.inertiaTensorKgMetersSquared[name],7);
      verifyNative(child.boxes,child.runs);
    }
    expect(f.owner.archiveReady()).toBe(false);
    if(test.name==="fallen rock arm"){
      expect(verify.removed.count).toBe(32);
      expect(verify.children[0]!.count).toBe(352);
      expect(verify.removed.mass.totalMassKg).toBe(135.9375);
      if(process.env.HVP_MOVING_PLAN_BENCH==="1"){
        const samples=[];
        for(let i=0;i<33;i++){
          for(const side of i%2?["compact","structural"]:["structural","compact"]){
            const start=performance.now(),cpu=process.cpuUsage();
            if(side==="compact")prepareCompactMovingPlan(f.owner,test.hit,test.edge,test.brush);
            else prepareHvpLocalBodyCut(f.oracle.source,test.hit,"moving-cut-1",test.edge,test.brush);
            const elapsed=performance.now()-start,used=process.cpuUsage(cpu);
            samples.push({i,side,elapsed,cpuMs:(used.user+used.system)/1000});
          }
        }
        if(process.env.HVP_MOVING_PLAN_BENCH_OUT)writeFileSync(process.env.HVP_MOVING_PLAN_BENCH_OUT,JSON.stringify(samples));
        else console.info("compact-moving-pairs "+JSON.stringify(samples));
      }
    }
  }finally{f.owner.dispose();}
},120000);
