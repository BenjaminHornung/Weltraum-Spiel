import {expect,it} from "vitest";
import {meshHvpBodyCells} from "../../src/hestia-prototype/presentation/terrainFragment";
import {meshHvpOwnedBodyCellsSteps,verifyHvpOwnedBodyMeshSteps} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";

const drain=<T>(steps:Generator<string,T,unknown>)=>{
  const labels:string[]=[];
  for(;;){const step=steps.next();if(step.done){return {value:step.value,labels};}labels.push(step.value);}
};
const fixture=()=>{
  const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null},
    {materialId:2,densityKgPerCubicMeter:1024,structuralClass:"stone",destructible:true,tags:null}];
  const cells=Array.from({length:9},(_,i)=>({x:i%3-1,y:Math.floor(i/3),z:-1,materialId:1+i%2}));
  const source=ingestHvpStructuralCells("owned-mesh",cells,materials);
  return prepareHvpLocalBodyCut(source,[0,1,-1],"owned-mesh-cut",1,"Box").plan.parts[0]!;
};

it("reuses the mesh kernel without changing mixed-material local Float32 bytes or metadata",()=>{
  const part=fixture(),center=part.recipe.mass.centerOfMassMeters!,digest=part.recipe.source.contentHash;
  const reference=meshHvpBodyCells(part.cells,center,digest);
  const result=drain(meshHvpOwnedBodyCellsSteps(part.cells,center,digest));
  expect(result.value).toEqual(reference);
  for(const field of ["positions","normals","colors","indices"] as const){
    const a=result.value[field]!,b=reference[field]!;
    expect(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).toEqual(new Uint8Array(b.buffer,b.byteOffset,b.byteLength));
  }
  expect(result.labels).toContain("meshBounds");
  expect(result.labels).toContain("meshOccupancy");
  expect(result.labels).toContain("meshLocalPositions");
  expect(drain(verifyHvpOwnedBodyMeshSteps(part,reference)).value).toBeUndefined();
});

it("rejects changed geometry against the issued local source, not changed foreign cells or matching digest",()=>{
  const part=fixture(),mesh=meshHvpBodyCells(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash);
  const positions=mesh.positions.slice();positions[3]=positions[0]!;positions[4]=positions[1]!;positions[5]=positions[2]!;
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,{...mesh,positions}))).toThrow("Foreign local body mesh geometry");
  const indices=mesh.indices.slice();[indices[0],indices[1]]=[indices[1]!,indices[0]!];
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,{...mesh,indices}))).toThrow("Foreign local body mesh geometry");
  const colors=mesh.colors!.slice();colors[0]=Math.fround(colors[0]===1?.5:1);
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,{...mesh,colors}))).toThrow("Foreign local body mesh geometry");
  const materialRanges=mesh.materialRanges.map((range,i)=>i===0?{...range,startIndex:-0}:range);
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,{...mesh,materialRanges}))).toThrow("Foreign local body mesh geometry");
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,{...mesh,cavityFaceCount:-0}))).toThrow("Foreign local body mesh geometry");
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps({...part,recipe:{...part.recipe}},mesh))).toThrow("Unvalidated HVP rigid recipe");
});

it("bounds projection batches and never publishes a partial mesh after cancellation",()=>{
  const cells=Object.freeze(Array.from({length:257},(_,x)=>Object.freeze({x,y:0,z:0,materialId:1})));
  const result=drain(meshHvpOwnedBodyCellsSteps(cells,{x:16,y:.0625,z:.0625},"test-source"));
  expect(result.labels.filter(label=>label==="meshBounds")).toHaveLength(3);
  expect(result.labels.filter(label=>label==="meshOccupancy")).toHaveLength(3);
  const steps=meshHvpOwnedBodyCellsSteps(cells,{x:16,y:.0625,z:.0625},"test-source");
  expect(steps.next()).toEqual({done:false,value:"meshBounds"});
  expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});
  expect(steps.next()).toEqual({done:true,value:undefined});
  expect(()=>drain(meshHvpOwnedBodyCellsSteps(cells.slice(),{x:0,y:0,z:0},"test-source"))).toThrow(/immutable/);
});

it("closes owned cursors at local-position and geometry-comparison yields",()=>{
  const part=fixture(),center=part.recipe.mass.centerOfMassMeters!,digest=part.recipe.source.contentHash;
  const reference=meshHvpBodyCells(part.cells,center,digest);
  const cases=[
    {steps:meshHvpOwnedBodyCellsSteps(part.cells,center,digest),label:"meshLocalPositions"},
    {steps:verifyHvpOwnedBodyMeshSteps(part,reference),label:"meshCompare"}
  ];
  for(const {steps,label} of cases){
    let reached=false;
    for(let count=0;count<1000;count+=1){
      const step=steps.next();
      expect(step.done).toBe(false);
      if(step.value===label){reached=true;break;}
    }
    expect(reached).toBe(true);
    expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});
    expect(steps.next()).toEqual({done:true,value:undefined});
  }
});

it("charges the borrowed parent before allocating any owned occupancy mesh",()=>{
  const part=fixture(),first=new Error("mesh parent credit rejected");let calls=0;
  const steps=meshHvpOwnedBodyCellsSteps(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash,()=>{calls+=1;throw first;});
  expect(()=>drain(steps)).toThrow(first);expect(calls).toBe(1);
});

it("charges actual face/quad containers without changing mixed-material bytes",()=>{
  const part=fixture(),ledger=createStructuralOwnerLedger(32*1024*1024),reference=meshHvpBodyCells(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash);
  try{
    const actual=drain(meshHvpOwnedBodyCellsSteps(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash,ledger.reserve)).value;
    expect(actual).toEqual(reference);expect(ledger.resources.reservedBytes).toBeGreaterThan(actual.positions.byteLength+actual.normals.byteLength+actual.indices.byteLength+actual.colors!.byteLength);
  }finally{ledger.release();}
});

it("keeps expected-geometry verification inside the same borrowed parent budget",()=>{
  const part=fixture(),reference=meshHvpBodyCells(part.cells,part.recipe.mass.centerOfMassMeters!,part.recipe.source.contentHash),first=new Error("expected mesh credit rejected");
  expect(()=>drain(verifyHvpOwnedBodyMeshSteps(part,reference,()=>{throw first;}))).toThrow(first);
});
