// P01 source-only contract checks on base 2548ce04. NOT RUN; the b3/f2 oracle stays independently pinned.
import {expect,it} from "vitest";
import {stableAuthorityId} from "../../src/voxel/adaptive";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps} from "../../src/hestia-prototype/physics/rigidRecipe";
import {StructuralConnectivityError,deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,
  serializeStructuralCellAddress,type StructuralConnectivityBudgets,type StructuralObject} from "../../src/voxel/structural";
import {structuralComponentClassificationSteps,structuralIssuedComponentClassificationSteps} from "../../src/voxel/structural/classificationSteps";
import {createStructuralOccupiedEntriesCursor} from "../../src/voxel/structural/occupiedEntries";
import {isIssuedStructuralObject,reconstructStructuralObjectInternal} from "../../src/voxel/structural/model";
import {hashStructuralEvidence,hashStructuralObjectContent} from "../../src/voxel/structural/canonical";
import {deriveStructuralSingleComponentMasses} from "../../src/voxel/structural/massProperties";
import {historicalStructuralClassification} from "../reference/hvp-parallel-p01-classification-reference";

const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null},
  {materialId:2,densityKgPerCubicMeter:1500,structuralClass:"hull",destructible:true,tags:null}];
const budgets={maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144};
const source=(id:string,cells:readonly HvpStructuralCell[])=>ingestHvpStructuralCells(id,cells,materials);
const drain=<T>(steps:Generator<string,T,unknown>)=>{
  const labels:string[]=[];
  for(;;){
    const step=steps.next();
    if(step.done){
      return {value:step.value,labels};
    }
    labels.push(step.value);
  }
};
const error=(run:()=>unknown)=>{
  try{
    run();
  }catch(thrown){
    const e=thrown as {name:string;code?:string;path?:string;message:string};
    return {thrown,signature:{name:e.name,code:e.code,path:e.path,message:e.message}};
  }
  throw new Error("Expected rejection");
};
const parity=(object:StructuralObject,limits:StructuralConnectivityBudgets=budgets)=>{
  const expected=historicalStructuralClassification(object,limits);
  expect(deriveStructuralComponentClassification(object,limits)).toEqual(expected);
  const stepped=drain(structuralComponentClassificationSteps(object,limits));
  expect(stepped.value).toEqual(expected);
  expect(Object.isFrozen(stepped.value)).toBe(true);
  return stepped;
};

// Real issuer construction, never a cast/hash/shape shortcut. Fixtures use the unchanged b3 constructor.
const issuedFacts=(id:string,cellCount:number,jointCount:number,anchorCount=0,active=true)=>{
  const object=source(id,Array.from({length:cellCount},(_,x)=>({x,y:0,z:0,materialId:1})));
  const occupied=historicalStructuralClassification(object,budgets).components[0]!.occupiedCells[0]!;
  const cell=active?occupied:{...occupied,local:{...occupied.local,y:1}};
  return reconstructStructuralObjectInternal({objectId:object.objectId,frame:object.frame,source:object.source,
    materials:object.materials,bricks:object.bricks,objectRevision:object.objectRevision,editRevision:object.editRevision,
    commandEvidence:object.commandEvidence,
    anchors:Array.from({length:anchorCount},(_,i)=>({anchorId:`anchor.${String(i).padStart(3,"0")}`,cell})),
    joints:Array.from({length:jointCount},(_,i)=>({jointId:`joint.${String(i).padStart(3,"0")}`,jointClass:"weld",
      endpointA:{cell,role:"primary"},endpointB:{cell,role:"secondary"}}))});
};
const drainIssued=(object:StructuralObject,limits:StructuralConnectivityBudgets=budgets)=>{
  const steps=structuralIssuedComponentClassificationSteps(object,limits),labels:string[]=[];
  try{
    for(let advances=0;advances<10_000;advances+=1){
      const step=steps.next();
      if(step.done){
        return {value:step.value,labels};
      }
      labels.push(step.value);
    }
    throw new Error("P01 issued classification exceeded the 10000-advance contract guard");
  }finally{
    const close:Generator<unknown,unknown,unknown>=steps;
    close.return(undefined);
  }
};

it("P01-T01/T02: historical full fields, negative seams, inactive facts and input ordering",()=>{
  const cells=Array.from({length:178},(_,i)=>({x:i-17,y:-1,z:15,materialId:1}));
  cells.push({x:-18,y:0,z:15,materialId:2}); // diagonal, not a six-neighbor edge
  const object=source("p01-negative-order",cells);
  const base=historicalStructuralClassification(object,budgets);
  expect(base.components).toHaveLength(2);
  const line=base.components.find(c=>c.occupiedCells.length===178)!;
  const diagonal=base.components.find(c=>c.occupiedCells.length===1)!;
  expect(line.occupiedCells.some((cell,i)=>i>0&&line.occupiedCells[i-1]!.brickKey.originQuantum.x>cell.brickKey.originQuantum.x)).toBe(true);
  const occupied=line.occupiedCells[0]!,air={...occupied,local:{x:0,y:0,z:0}};
  const facts:StructuralObject={...object,anchors:[{anchorId:stableAuthorityId("active"),cell:occupied},{anchorId:stableAuthorityId("inactive"),cell:air}],
    joints:[{jointId:stableAuthorityId("joint"),jointClass:"weld",endpointA:{cell:occupied,role:"solid"},endpointB:{cell:diagonal.occupiedCells[0]!,role:"other"}}]};
  const result=parity(facts).value;
  expect(result.components).toHaveLength(2); // joints do not merge components
  expect(result.anchoredComponents).toHaveLength(1);
  expect(result.components.flatMap(c=>c.activeAnchors.map(a=>a.anchorId))).toEqual(["active"]);
  expect(result.components.flatMap(c=>c.activeJoints.map(j=>j.endpoint)).sort()).toEqual(["A","B"]);
  const reversed:StructuralObject={...facts,bricks:[...object.bricks].reverse().map(b=>({...b,cells:[...b.cells].reverse()}))};
  expect(parity(reversed).value).toEqual(result);
  expect(line.smallestOccupiedCellKey).toBe(serializeStructuralCellAddress(line.occupiedCells[0]!));
});

it("P01-T02: negative y/z brick edges connect, diagonal neighbors do not",()=>{
  const object=source("p01-yz-seams",[
    {x:0,y:-17,z:0,materialId:1},{x:0,y:-16,z:0,materialId:1},
    {x:10,y:0,z:-17,materialId:1},{x:10,y:0,z:-16,materialId:1},
    {x:1,y:-15,z:0,materialId:1}
  ]);
  expect(parity(object).value.components.map(c=>c.occupiedCells.length).sort((a,b)=>a-b)).toEqual([1,2,2]);
});

it("P01-T03: empty and singleton remain historical, including empty-source authority failure",()=>{
  const object=source("p01-small",[{x:0,y:0,z:0,materialId:1}]);
  expect(parity(object).value.components).toHaveLength(1);
  expect(parity({...object,bricks:[]}).value.components).toHaveLength(0);
  const malformed={...object,bricks:[],source:{...object.source,extra:undefined}} as unknown as StructuralObject;
  expect(error(()=>deriveStructuralComponentClassification(malformed,budgets)).signature)
    .toEqual(error(()=>historicalStructuralClassification(malformed,budgets)).signature);
});

it("P01-T03: legal 32768-cell signed dense source and N-1 rejection",()=>{
  const cells:HvpStructuralCell[]=[];
  for(let z=-16;z<16;z+=1){
    for(let y=-16;y<16;y+=1){
      for(let x=-16;x<16;x+=1){
        cells.push({x,y,z,materialId:1});
      }
    }
  }
  const object=source("p01-dense32768",cells);
  expect(cells).toHaveLength(32_768);
  expect(object.bricks).toHaveLength(8);
  expect(parity(object).value.components[0]!.occupiedCells).toHaveLength(32_768);
  const limits={...budgets,maxVisitedCells:32_767};
  expect(error(()=>deriveStructuralComponentClassification(object,limits)).signature)
    .toEqual(error(()=>historicalStructuralClassification(object,limits)).signature);
},120_000);

it("P01-T03: exact 32 components; 33 rejects, never truncates",()=>{
  for(const n of [32,33]){
    const object=source(`p01-components${n}`,Array.from({length:n},(_,i)=>({x:3*i-48,y:0,z:0,materialId:1})));
    if(n===32){
      expect(parity(object).value.components).toHaveLength(32);
    }else{
      const expected=error(()=>historicalStructuralClassification(object,budgets)).signature;
      expect(expected).toMatchObject({name:"StructuralConnectivityError",code:"BudgetExceeded",path:"connectivityBudgets/maxComponents"});
      expect(error(()=>deriveStructuralComponentClassification(object,budgets)).signature).toEqual(expected);
      expect(error(()=>drain(structuralComponentClassificationSteps(object,budgets))).signature).toEqual(expected);
    }
  }
});

it("P01-T04: indexed facts count inactive anchors and both joint endpoints before component limit",()=>{
  const object=source("p01-fact-budget",[{x:0,y:0,z:0,materialId:1},{x:3,y:0,z:0,materialId:1}]);
  const cell=historicalStructuralClassification(object,budgets).components[0]!.occupiedCells[0]!;
  const air={...cell,local:{x:0,y:1,z:0}};
  const input:StructuralObject={...object,anchors:[{anchorId:stableAuthorityId("inactive"),cell:air}],joints:[{jointId:stableAuthorityId("inactive"),jointClass:"weld",
    endpointA:{cell:air,role:"a"},endpointB:{cell:air,role:"b"}}]};
  parity(input,{...budgets,maxIndexedFacts:3});
  const limits={...budgets,maxComponents:1,maxIndexedFacts:2};
  const expected=error(()=>historicalStructuralClassification(input,limits)).signature;
  expect(expected).toMatchObject({path:"connectivityBudgets/maxIndexedFacts"});
  expect(error(()=>deriveStructuralComponentClassification(input,limits)).signature).toEqual(expected);
});

it("P01-T04/T05: budget error precedence and lazy generator creation",()=>{
  const object=source("p01-budget-reads",[{x:0,y:0,z:0,materialId:1}]);
  const reads:string[]=[],sentinel=new Error("later budget getter");
  const limits=Object.defineProperties({},{
    maxVisitedCells:{get:()=>{reads.push("visited");return 0;}},
    maxComponents:{get:()=>{reads.push("components");throw sentinel;}},
    maxIndexedFacts:{get:()=>{reads.push("facts");throw sentinel;}}
  }) as StructuralConnectivityBudgets;
  const steps=structuralComponentClassificationSteps(object,limits);
  expect(reads).toEqual([]);
  const first=error(()=>steps.next()).signature;
  expect(first).toMatchObject({name:"StructuralValidationError",path:"connectivityBudgets/maxVisitedCells"});
  expect(reads).toEqual(["visited"]);
  reads.length=0;
  expect(error(()=>historicalStructuralClassification(object,limits)).signature).toEqual(first);
  expect(reads).toEqual(["visited"]);
});

it("P01-T05: throwing getter versus traversal budget, with sticky cursor failure identity",()=>{
  const object=source("p01-getter",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}]);
  const sentinel=new Error("p01 localIndex getter");
  const make=()=>({...object,bricks:object.bricks.map(b=>({...b,cells:b.cells.map((c,i)=>Object.defineProperties({},{
    localIndex:{enumerable:true,get:()=>{if(i===1){throw sentinel;}return c.localIndex;}},
    state:{enumerable:true,value:c.state}
  }))}))}) as unknown as StructuralObject;
  for(const limit of [1,2]){
    const limits={...budgets,maxVisitedCells:limit};
    const expected=error(()=>historicalStructuralClassification(make(),limits));
    const actual=error(()=>deriveStructuralComponentClassification(make(),limits));
    expect(actual.signature).toEqual(expected.signature);
    if(limit===2){
      expect(actual.thrown).toBe(sentinel);
    }
    for(const units of [1,7,64,257]){
      const cursor=createStructuralOccupiedEntriesCursor(make(),limit);
      const caught=error(()=>{while(!cursor.advance(units).done){/* bounded fixture drain */}});
      expect(caught.signature).toEqual(expected.signature);
      expect(error(()=>cursor.advance(1)).thrown).toBe(caught.thrown);
      cursor.dispose();cursor.dispose();
      expect(error(()=>cursor.advance(0)).thrown).toBe(caught.thrown);
    }
  }
});

it("P01-T05: public Proxy read trace and sparse-array failure match the historical oracle",()=>{
  const object=source("p01-proxy",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}]);
  const observe=(run:typeof historicalStructuralClassification)=>{
    const reads:string[]=[];
    const borrowed=new Proxy(object,{get(target,key,receiver){reads.push(String(key));return Reflect.get(target,key,receiver);}});
    return {value:run(borrowed,budgets),reads};
  };
  expect(observe(deriveStructuralComponentClassification)).toEqual(observe(historicalStructuralClassification));
  const first=object.bricks[0]!,sparse=new Array<(typeof first.cells)[number]>(2);
  sparse[1]=first.cells[1]!;
  const malformed={...object,bricks:[{...first,cells:sparse}]} as StructuralObject;
  expect(error(()=>deriveStructuralComponentClassification(malformed,budgets)).signature)
    .toEqual(error(()=>historicalStructuralClassification(malformed,budgets)).signature);
});

it("P01-T05: Array species observations are historical; restore the global descriptor",()=>{
  const object=source("p01-species",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}]);
  const original=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  const observe=(run:typeof historicalStructuralClassification)=>{
    let reads=0;
    try{
      Object.defineProperty(Array,Symbol.species,{configurable:true,get(){reads+=1;return Array;}});
      const value=run(object,budgets);
      return {value,reads};
    }finally{
      Object.defineProperty(Array,Symbol.species,original);
    }
  };
  const expected=observe(historicalStructuralClassification);
  expect(expected.reads).toBeGreaterThan(0);
  expect(observe(deriveStructuralComponentClassification)).toEqual(expected);
  expect(Object.getOwnPropertyDescriptor(Array,Symbol.species)).toEqual(original);
});

it("P01-T06: return/throw at every observed b3 yield closes a borrowed iterator once",()=>{
  const object=source("p01-cancel",Array.from({length:200},(_,x)=>({x,y:0,z:0,materialId:1})));
  const expected=historicalStructuralClassification(object,budgets);
  const count=drain(structuralComponentClassificationSteps(object,budgets)).labels.length;
  expect(count).toBeGreaterThan(0);
  const sentinel=new Error("p01 yield throw");
  for(const mode of ["return","throw"]){
    for(let at=0;at<count;at+=1){
      let closed=0;
      const bricks={[Symbol.iterator]:()=>{
        const inner=object.bricks[Symbol.iterator]();
        return {next:()=>inner.next(),return:()=>{closed+=1;return {done:true as const,value:undefined};}};
      }};
      const steps=structuralComponentClassificationSteps({...object,bricks} as unknown as StructuralObject,budgets);
      for(let i=0;i<=at;i+=1){
        expect(steps.next().done).toBe(false);
      }
      if(mode==="return"){
        const close:Generator<unknown,unknown,unknown>=steps;
        expect(close.return(undefined).done).toBe(true);
      }else{
        expect(error(()=>steps.throw(sentinel)).thrown).toBe(sentinel);
      }
      expect(closed).toBe(1);
      expect(steps.next()).toEqual({done:true,value:undefined});
      expect(historicalStructuralClassification(object,budgets)).toEqual(expected);
    }
  }
});

it("P01-T07: historical elbow hash, independent physical scalars and supplementary recipe-route agreement",()=>{
  const cells=[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}];
  // Existing immutable expectation from v3StructuralRecipeParity.test.ts:35-42.
  const historical=ingestHvpStructuralCells("v3-parity-elbow",cells,
    [{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"stone",destructible:true,tags:null}]);
  expect(parity(historical).value.components[0]!.componentContentHash).toBe("fnv1a64-v1:44ac71f7c36afe68");
  const object=source("p01-mixed-mass",Array.from({length:5},(_,i)=>({x:i-2,y:-1,z:15,materialId:i<2?1:2})));
  parity(object);
  const mass=deriveStructuralObjectMassProperties(object,{maxVisitedCells:32_768});
  // Five 0.125m cubes at x=-2..2, y=-1, z=15; densities 512,512,1500,1500,1500.
  // Expected physics comes from that fixed data, not either current classification/recipe helper.
  const side=.125,weights=[1,1,1500/512,1500/512,1500/512];
  const totalMassKg=weights.reduce((sum,m)=>sum+m,0);
  const centerX=weights.reduce((sum,m,i)=>sum+m*((i-1.5)*side),0)/totalMassKg;
  let xx=0,yy=0;
  for(let i=0;i<weights.length;i+=1){
    const cube=weights[i]!*side*side/6,dx=(i-1.5)*side-centerX;
    xx+=cube;
    yy+=cube+weights[i]!*(dx*dx);
  }
  const expectedPhysics={totalMassKg,occupiedVoxelCount:5,centerOfMassMeters:{x:centerX,y:-.0625,z:1.9375},
    boundsMeters:{min:{x:-.25,y:-.125,z:1.875},max:{x:.375,y:0,z:2}},
    inertiaTensorKgMetersSquared:{xx,yy,zz:yy,xy:0,xz:0,yz:0}};
  const generic=prepareHvpRigidBody(Object.freeze({...object}));
  const owned=drain(prepareHvpRigidBodyOwnedHashSteps(object)).value;
  expect(mass).toMatchObject(expectedPhysics);
  expect(generic.mass).toMatchObject(expectedPhysics);
  expect(owned.mass).toMatchObject(expectedPhysics);
  // Route agreement supplements the independent checks; it is not a historical full-recipe oracle.
  expect(owned.mass).toEqual(mass);
  expect(generic.mass).toEqual(mass);
  expect(owned.axes).toEqual(generic.axes);
  expect(owned.colliders).toEqual(generic.colliders);
});

it("P01-R03: exact generic constructor/Species receiver and throw-prefix order stays historical",()=>{
  const object=source("p01-r03-receivers",[{x:-17,y:0,z:0,materialId:1},{x:-16,y:0,z:0,materialId:1},
    {x:2,y:0,z:0,materialId:2}]);
  const cell=historicalStructuralClassification(object,budgets).components.find(c=>c.occupiedCells.length===2)!.occupiedCells[0]!;
  const input:StructuralObject={...object,anchors:[{anchorId:stableAuthorityId("anchored"),cell}]};
  const constructor=Object.getOwnPropertyDescriptor(Array.prototype,"constructor")!;
  const species=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  const sentinel=new Error("P01 historical constructor/Species throw");
  const observe=(run:typeof historicalStructuralClassification,throwAt=0)=>{
    const reads:unknown[]=[];
    let value:ReturnType<typeof run>|undefined,thrown:unknown;
    const record=(entry:unknown)=>{
      reads.push(entry);
      if(reads.length===throwAt){
        throw sentinel;
      }
    };
    try{
      Object.defineProperty(Array.prototype,"constructor",{configurable:true,get(this:unknown){
        const first=Object.getOwnPropertyDescriptor(this,"0");
        const item=first&&"value" in first?first.value:undefined;
        record({event:"constructor",frozen:Object.isFrozen(this),length:Object.getOwnPropertyDescriptor(this,"length")?.value,
          firstKeys:item!==null&&typeof item==="object"?Object.keys(item).join(","):typeof item,
          firstFrozen:item!==null&&typeof item==="object"?Object.isFrozen(item):null});
        return Array;
      }});
      Object.defineProperty(Array,Symbol.species,{configurable:true,get(){record({event:"species"});return Array;}});
      value=run(input,budgets);
    }catch(failure){
      thrown=failure;
    }finally{
      Object.defineProperty(Array,Symbol.species,species);
      Object.defineProperty(Array.prototype,"constructor",constructor);
    }
    return {value,thrown,reads};
  };
  const expected=observe(historicalStructuralClassification);
  expect(expected.thrown).toBeUndefined();
  expect(expected.reads.length).toBeGreaterThan(0);
  const actual=observe(deriveStructuralComponentClassification);
  expect(actual).toEqual(expected);
  expect(JSON.stringify(actual.value)).toBe(JSON.stringify(expected.value));
  for(let at=1;at<=expected.reads.length;at+=1){
    const historical=observe(historicalStructuralClassification,at);
    expect(historical.thrown).toBe(sentinel);
    const failed=observe(deriveStructuralComponentClassification,at);
    expect(failed.thrown).toBe(sentinel);
    expect(failed).toEqual(historical);
  }
  expect(Object.getOwnPropertyDescriptor(Array.prototype,"constructor")).toEqual(constructor);
  expect(Object.getOwnPropertyDescriptor(Array,Symbol.species)).toEqual(species);
});

it("P01-R03: legitimate custom Species allocations and freeze outcomes are not bypassed",()=>{
  const object=source("p01-r03-custom-species",[{x:0,y:0,z:0,materialId:1},{x:3,y:0,z:0,materialId:2}]);
  const descriptor=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  let created:unknown[][]=[];
  class SpeciesArray<T> extends Array<T> {
    constructor(length:number){super(length);created.push(this);}
  }
  const observe=(run:typeof historicalStructuralClassification)=>{
    created=[];
    try{
      Object.defineProperty(Array,Symbol.species,{configurable:true,get(){return SpeciesArray;}});
      const value=run(object,budgets);
      return {value,created};
    }finally{
      Object.defineProperty(Array,Symbol.species,descriptor);
    }
  };
  const expected=observe(historicalStructuralClassification),actual=observe(deriveStructuralComponentClassification);
  expect(expected.created.length).toBeGreaterThan(0);
  expect(actual.value).toEqual(expected.value);
  expect(JSON.stringify(actual.value)).toBe(JSON.stringify(expected.value));
  expect(actual.created).toEqual(expected.created);
  expect(actual.created.map(Object.isFrozen)).toEqual(expected.created.map(Object.isFrozen));
  expect(Object.getOwnPropertyDescriptor(Array,Symbol.species)).toEqual(descriptor);
});

it("P01-R02: genuine anchor/endpoint work yields and preserves independent b3 fields and budget errors",()=>{
  const noFacts=issuedFacts("p01-r02-empty-facts",1,0);
  expect(isIssuedStructuralObject(noFacts)).toBe(true);
  expect(drainIssued(noFacts).labels.filter(label=>label==="classification")).toHaveLength(0);
  for(const [cells,joints,anchors,active] of [[1,32,0,true],[1,65,0,true],[1,0,65,true],[257,65,0,true],[1,65,0,false]] as const){
    const object=issuedFacts(`p01-r02-${cells}-${joints}-${anchors}-${active}`,cells,joints,anchors,active);
    expect(isIssuedStructuralObject(object)).toBe(true);
    const expected=historicalStructuralClassification(object,budgets),actual=drainIssued(object);
    expect(actual.value).toEqual(expected);
    expect(JSON.stringify(actual.value)).toBe(JSON.stringify(expected));
    expect(actual.labels).toContain("classification");
    expect(actual.labels.every(label=>label==="classification"||label==="classificationCells")).toBe(true);
    expect(actual.value.components[0]!.activeJoints).toHaveLength(active?joints*2:0);
    expect(actual.value.components[0]!.activeAnchors).toHaveLength(active?anchors:0);
    const limits={...budgets,maxIndexedFacts:anchors+joints*2-1};
    const failure=error(()=>drainIssued(object,limits));
    expect(failure.thrown).toBeInstanceOf(StructuralConnectivityError);
    expect(failure.signature).toEqual(error(()=>historicalStructuralClassification(object,limits)).signature);
  }
});

it("P01-R02: cancellation/throw during fact finalization cannot resume or modify a genuine source; clones stay untrusted",()=>{
  const object=issuedFacts("p01-r02-cancel",1,65),expected=historicalStructuralClassification(object,budgets);
  const labels=drainIssued(object).labels;
  expect(labels).toContain("classification");
  const checkpoints=new Set([labels.indexOf("classification"),Math.floor(labels.length/2),labels.length-1]);
  const sentinel=new Error("P01 issued fact yield throw");
  for(const at of checkpoints){
    for(const mode of ["return","throw"]){
      const steps=structuralIssuedComponentClassificationSteps(object,budgets);
      for(let advance=0;advance<=at;advance+=1){
        expect(steps.next().done).toBe(false);
      }
      if(mode==="return"){
        const close:Generator<unknown,unknown,unknown>=steps;
        expect(close.return(undefined).done).toBe(true);
      }else{
        expect(error(()=>steps.throw(sentinel)).thrown).toBe(sentinel);
      }
      expect(steps.next()).toEqual({done:true,value:undefined});
      expect(drainIssued(object).value).toEqual(expected);
    }
  }
  for(const untrusted of [Object.freeze({...object}),new Proxy(object,{})]){
    expect(isIssuedStructuralObject(untrusted)).toBe(false);
    expect(error(()=>drainIssued(untrusted)).signature)
      .toMatchObject({name:"StructuralValidationError",code:"InvalidContract",path:"connectivity/source"});
  }
});

it("P01-R02 observer: legit Species-created issued fact-array proxies keep iterator/length throws and fact-budget precedence",()=>{
  const base=source("p01-issued-fact-proxy",[{x:0,y:0,z:0,materialId:1}]);
  const occupied=historicalStructuralClassification(base,budgets).components[0]!.occupiedCells[0]!;
  const air={...occupied,local:{...occupied.local,y:1}};
  const descriptor=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  const iteratorError=new Error("P01 original fact iterator sentinel"),lengthError=new Error("P01 original fact length sentinel");
  for(const kind of ["anchors","joints"] as const){
    const created=new WeakSet<object>();
    let factArray:object|undefined,armed=false,blockIterator=false,blockLength=false,lengthReads=0,lengthThrowAt=1;
    let trace:string[]=[];
    const Species=function(length:number){
      const proxy=new Proxy(new Array<unknown>(length),{get(target,key,receiver){
        if(armed&&receiver===factArray){
          trace.push(String(key));
          if(key===Symbol.iterator&&blockIterator){
            throw iteratorError;
          }
          if(key==="length"){
            lengthReads+=1;
            if(blockLength&&lengthReads===lengthThrowAt){
              throw lengthError;
            }
          }
        }
        return Reflect.get(target,key,receiver);
      }});
      created.add(proxy);
      return proxy;
    };
    let object:StructuralObject;
    try{
      Object.defineProperty(Array,Symbol.species,{configurable:true,get(){return Species;}});
      object=reconstructStructuralObjectInternal({objectId:base.objectId,frame:base.frame,source:base.source,
        materials:base.materials,bricks:base.bricks,objectRevision:base.objectRevision,editRevision:base.editRevision,
        commandEvidence:base.commandEvidence,
        anchors:kind==="anchors"?[{anchorId:"inactive.0",cell:air},{anchorId:"inactive.1",cell:air}]:[],
        joints:kind==="joints"?[{jointId:"inactive",jointClass:"weld",endpointA:{cell:air,role:"a"},endpointB:{cell:air,role:"b"}}]:[]});
    }finally{
      Object.defineProperty(Array,Symbol.species,descriptor);
    }
    // Complete real construction, canonical hashes and frozen descriptor checks BEFORE any trap is armed.
    factArray=object[kind];
    expect(isIssuedStructuralObject(object)).toBe(true);
    expect(created.has(factArray)).toBe(true);
    expect(Object.isFrozen(object)).toBe(true);
    expect(Object.isFrozen(factArray)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(factArray,"length"))
      .toMatchObject({value:kind==="anchors"?2:1,writable:false,configurable:false});
    expect(hashStructuralObjectContent(object)).toBe(object.contentHash);
    expect(hashStructuralEvidence(object.commandEvidence)).toBe(object.evidenceHash);
    const observe=<T>(run:()=>T,iterator=false,length=false,throwAt=1)=>{
      trace=[];lengthReads=0;lengthThrowAt=throwAt;blockIterator=iterator;blockLength=length;armed=true;
      let value:T|undefined,thrown:unknown;
      try{
        value=run();
      }catch(failure){
        thrown=failure;
      }finally{
        armed=false;
      }
      return {value,thrown,trace};
    };
    for(const [iterator,length] of [[true,true],[false,true],[false,false]]){
      const expected=observe(()=>historicalStructuralClassification(object,budgets),iterator,length);
      const actual=observe(()=>drainIssued(object).value,iterator,length);
      expect(expected.thrown).toBe(iterator?iteratorError:length?lengthError:undefined);
      expect(actual.thrown).toBe(expected.thrown);
      expect(actual.trace).toEqual(expected.trace);
      expect(actual.value).toEqual(expected.value);
      const massExpected=observe(()=>{
        deriveStructuralObjectMassProperties(object,{maxVisitedCells:32_768});trace.push("mass");
        const value=historicalStructuralClassification(object,budgets);trace.push("classification");return value;
      },iterator,length);
      const massActual=observe(()=>deriveStructuralSingleComponentMasses(object,
        {maxVisitedCells:32_768,maxConnectivityCells:32_768,maxComponents:32,maxConnectivityFacts:262_144},
        ()=>{trace.push("mass");},()=>{trace.push("classification");}).classification,iterator,length);
      expect(massActual.thrown).toBe(massExpected.thrown);
      expect(massActual.trace).toEqual(massExpected.trace);
      expect(massActual.value).toEqual(massExpected.value);
    }
    const limits={...budgets,maxIndexedFacts:1};
    // Budget failure during the second fact must precede the iterator's next length read.
    const nextLength=kind==="anchors"?3:2;
    const expected=observe(()=>error(()=>historicalStructuralClassification(object,limits)).signature,false,true,nextLength);
    const actual=observe(()=>error(()=>drainIssued(object,limits)).signature,false,true,nextLength);
    expect(actual.thrown).toBeUndefined();
    expect(actual.value).toEqual(expected.value);
    expect(actual.value).toMatchObject({name:"StructuralConnectivityError",code:"BudgetExceeded",path:"connectivityBudgets/maxIndexedFacts"});
    expect(actual.trace).toEqual(expected.trace);
  }
  expect(Object.getOwnPropertyDescriptor(Array,Symbol.species)).toEqual(descriptor);
});
