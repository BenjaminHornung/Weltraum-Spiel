import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {meshHvpOccupancy,meshHvpOccupancySteps,type HvpCompactMesh,type HvpMeshBudgets,type HvpMeshOccupancy} from "../../src/hvp/hvpCoastMesher";

// Captured ONLY from the archived pre-cursor bundle, never from the current shared core.
// baseline SHA256: 8aa0e5a8b31d0b586bc03aa66a762ca9e518748a74524401f6403bcab67db5ec
// AO/mesher section SHA256: 0eb4243ec1c9bc76a9b12c63ed21c0bfe8fa0f292bd2ffe30671438b7b04fc6c
// Evidence generator: mesh-historical-oracle.mjs in the task's external evidence directory.
const hash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
const budgets:HvpMeshBudgets={maxVisitedCells:64,maxQuads:384,maxVertices:1536,maxIndices:2304};
const config={sizeX:2,sizeY:2,sizeZ:2,cellMeters:.125,origin:{x:-.1875,y:.03125,z:-.3125},
  cells:[[0,0,0,1],[1,0,0,2],[0,1,0,1]],ghost:[[-1,1,0]],silent:[[1,1,0]]};

const exercise=(bounded:boolean,limits:HvpMeshBudgets)=>{
  const reads:string[]=[];
  const origin=new Proxy(config.origin,{get(target,key,receiver){reads.push(`origin.${String(key)}`);return Reflect.get(target,key,receiver);}});
  const source:HvpMeshOccupancy={sizeX:config.sizeX,sizeY:config.sizeY,sizeZ:config.sizeZ,cellMeters:config.cellMeters,originMeters:origin,
    slotAt:(x,y,z)=>{const slot=config.cells.find(c=>c[0]===x&&c[1]===y&&c[2]===z)?.[3]??0;reads.push(`slot:${x},${y},${z}:${slot}`);return slot;},
    ghostSlotAt:(x,y,z)=>{const slot=config.ghost.some(c=>c[0]===x&&c[1]===y&&c[2]===z)?1:0;reads.push(`ghost:${x},${y},${z}:${slot}`);return slot;},
    silentSolidAt:(x,y,z)=>{const solid=config.silent.some(c=>c[0]===x&&c[1]===y&&c[2]===z);reads.push(`silent:${x},${y},${z}:${solid}`);return solid;}};
  const occupancy=new Proxy(source,{get(target,key,receiver){reads.push(`source.${String(key)}`);return Reflect.get(target,key,receiver);}});
  const budgetProxy=new Proxy(limits,{get(target,key,receiver){reads.push(`budget.${String(key)}`);return Reflect.get(target,key,receiver);}});
  const options=new Proxy({ao:true},{get(target,key,receiver){reads.push(`options.${String(key)}`);return Reflect.get(target,key,receiver);}});
  let mesh:HvpCompactMesh|undefined,error:{name:string;message:string}|undefined;
  try{
    if(bounded){
      const steps=meshHvpOccupancySteps(occupancy,budgetProxy,"historical-owner-fixture","historical-mesh-v1",options);
      for(;;){const step=steps.next();if(step.done){mesh=step.value;break;}}
    }else{
      mesh=meshHvpOccupancy(occupancy,budgetProxy,"historical-owner-fixture","historical-mesh-v1",options);
    }
  }catch(value){
    if(!(value instanceof Error)){throw value;}
    error={name:value.name,message:value.message};
  }
  const readOrder={count:reads.length,sha256:hash(JSON.stringify(reads))};
  if(error!==undefined){return {error,readOrder};}
  if(mesh===undefined){throw new Error("Mesh result missing");}
  const arrays:Record<string,{type:string;length:number;sha256:string}|null>={};
  for(const field of ["positions","normals","colors","indices"] as const){
    const values=mesh[field];
    arrays[field]=values===null?null:{type:values.constructor.name,length:values.length,
      sha256:hash(new Uint8Array(values.buffer,values.byteOffset,values.byteLength))};
  }
  return {arrays,faceCount:mesh.faceCount,unitFaceCount:mesh.unitFaceCount,outerFaceCount:mesh.outerFaceCount,
    cavityFaceCount:mesh.cavityFaceCount,boundsMeters:mesh.boundsMeters,materialRanges:mesh.materialRanges,
    sourceDigest:mesh.sourceDigest,algorithmVersion:mesh.algorithmVersion,tempEstimateBytes:mesh.tempEstimateBytes,
    frozen:[Object.isFrozen(mesh),Object.isFrozen(mesh.materialRanges),mesh.materialRanges.every(Object.isFrozen),
      Object.isFrozen(mesh.boundsMeters),Object.isFrozen(mesh.boundsMeters.min),Object.isFrozen(mesh.boundsMeters.max)],readOrder};
};

const historical={
  arrays:{
    positions:{type:"Float32Array",length:108,sha256:"2fed5ae0822460579f9d6f7e84e38e21e75bd63bc7e7bb6b9a6d6a9fc5146048"},
    normals:{type:"Float32Array",length:108,sha256:"e8b44d137c7aba0067e31e0ca4156ba388a10642762785a1a656e8a87d37b70f"},
    colors:{type:"Float32Array",length:108,sha256:"2f176a44e844b8de3f316f82a6523523a2c1cee117daa108a456ea1a87fc652c"},
    indices:{type:"Uint16Array",length:54,sha256:"157fad618c14dff564697c43b16906e698c008a8122a0981948a7cd8ef19e8b0"}
  },
  faceCount:9,unitFaceCount:11,outerFaceCount:9,cavityFaceCount:0,
  boundsMeters:{min:{x:-.1875,y:.03125,z:-.3125},max:{x:.0625,y:.28125,z:-.1875}},
  materialRanges:[{slot:1,startIndex:0,indexCount:6},{slot:2,startIndex:6,indexCount:6},
    {slot:1,startIndex:12,indexCount:6},{slot:2,startIndex:18,indexCount:6},
    {slot:1,startIndex:24,indexCount:12},{slot:2,startIndex:36,indexCount:6},
    {slot:1,startIndex:42,indexCount:6},{slot:2,startIndex:48,indexCount:6}],
  sourceDigest:"historical-owner-fixture",algorithmVersion:"historical-mesh-v1",tempEstimateBytes:3976,
  frozen:[true,true,true,true,true,true],
  readOrder:{count:748,sha256:"75950480c706b82e0b46b34465380146f41ca0f9aa0e1e6702f702b0d55158eb"}
};

it.each([false,true])("preserves independent historical mesh bytes, metadata and callback order (bounded=%s)",bounded=>{
  expect(exercise(bounded,budgets)).toEqual(historical);
});

it.each([false,true])("preserves historical budget errors and the reads before rejection (bounded=%s)",bounded=>{
  expect(exercise(bounded,{...budgets,maxVisitedCells:0})).toEqual({
    error:{name:"Error",message:"meshHvpOccupancy BudgetExceeded: 1 cells exceed 0"},
    readOrder:{count:9,sha256:"004d6f512c8d9af0f68a923e4a60cbbe1052980fb619bd3ca60f2e467d3ee7d5"}
  });
  expect(exercise(bounded,{...budgets,maxQuads:1})).toEqual({
    error:{name:"Error",message:"meshHvpOccupancy BudgetExceeded: 11 faces exceed 1"},
    readOrder:{count:683,sha256:"1b17ef4d720a9dd60a8698cb795c1d4b41a4e7e26cb91cac441e77382ff4cba5"}
  });
  expect(exercise(bounded,{...budgets,maxVertices:0})).toEqual({
    error:{name:"Error",message:"meshHvpOccupancy BudgetExceeded: 36 vertices / 54 indices over budget"},
    readOrder:{count:684,sha256:"b00dbdbb94104278fc2bef20714a71af8162ffc08e4863cf0f084cb8d670ab3a"}
  });
});

it("preserves the outer freeze lookup before the unreserved bounded range-array freeze",()=>{
  const descriptor=Object.getOwnPropertyDescriptor(Object,"freeze")!,freeze=Object.freeze;
  const rangeLookups:number[]=[];let lookups=0;
  Object.defineProperty(Object,"freeze",{configurable:true,get:()=>{
    lookups+=1;return <T>(value:T):Readonly<T>=>{
      if(Array.isArray(value)&&value.length>0&&typeof value[0]?.slot==="number"){rangeLookups.push(lookups);}
      lookups=0;return freeze(value);
    };
  }});
  try{
    const steps=meshHvpOccupancySteps({sizeX:1,sizeY:1,sizeZ:1,cellMeters:.125,originMeters:{x:0,y:0,z:0},slotAt:()=>1},
      budgets,"freeze-order","freeze-order",{ao:true});
    try{while(!steps.next().done){/* Complete the real unreserved bounded kernel. */}}finally{steps.return(undefined as never);}
  }finally{Object.defineProperty(Object,"freeze",descriptor);}
  expect(rangeLookups).toEqual([2]);
});
