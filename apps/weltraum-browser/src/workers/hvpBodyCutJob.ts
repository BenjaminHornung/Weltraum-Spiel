import {fnv1aHash} from "../core/hash";
import {createStructuralMaterialTable,requireStructuralHash,type StructuralMaterialDefinition} from "../voxel/structural";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../voxel/adaptive";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut} from "../hestia-prototype/physics/bodyCutPlan";
import {meshHvpBodyCells} from "../hestia-prototype/presentation/terrainFragment";
import type {HvpCompactMesh} from "../hvp/hvpCoastMesher";
import {byteCount,contentRevision} from "./ids";
import {fnv1aBytes,validateTransferableBundle,type TransferableBufferBundle,type WorkerJobRequest,type WorkerJobResult} from "./protocol";

export const HVP_BODY_CUT_JOB="BuildHvpLocalBodyCut";
export const HVP_BODY_CUT_MAX_OUTPUT=8*1024*1024;
export interface HvpBodyCutPayload {
  readonly sessionId:string;readonly epoch:number;readonly commandId:string;readonly ownerId:string;
  readonly sourceId:string;readonly sourceDigest:string;readonly revision:number;readonly cellCount:number;readonly massKg:number;
  readonly brush?:"Box"|"Sphere";
  readonly cell:readonly[number,number,number];readonly edge:number;readonly materials:readonly StructuralMaterialDefinition[];
}
export const validateHvpBodyCutPayload=(value:unknown):HvpBodyCutPayload=>{
  const p=value as HvpBodyCutPayload|null;
  if(!p||typeof p!=="object"||![p.sessionId,p.commandId,p.ownerId,p.sourceId].every(v=>typeof v==="string"&&/^[A-Za-z0-9:._-]{1,128}$/.test(v))
    ||!Number.isSafeInteger(p.epoch)||p.epoch<0||!Number.isSafeInteger(p.cellCount)||p.cellCount<1||p.cellCount>32_768
    ||!Number.isFinite(p.massKg)||p.massKg<=0||!Array.isArray(p.cell)||p.cell.length!==3||!p.cell.every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000)
    ||(p.brush!==undefined&&p.brush!=="Box"&&p.brush!=="Sphere")
    ||!Number.isSafeInteger(p.edge)||p.edge<1||p.edge>8||!Array.isArray(p.materials)||p.materials.length<1||p.materials.length>16){throw new Error("Invalid body-cut binding");}
  contentRevision(p.revision);requireStructuralHash(p.sourceDigest,"body/sourceDigest");createStructuralMaterialTable(p.materials);return p;
};
const identity=(p:HvpBodyCutPayload)=>[p.sessionId,p.epoch,p.commandId,p.ownerId,p.sourceId,p.sourceDigest,p.revision,p.cellCount,p.massKg,p.cell,p.edge,p.brush??"Box",
  p.materials.map(m=>[m.materialId,m.densityKgPerCubicMeter,m.structuralClass,m.destructible,m.tags])];
export const hvpBodyCutInputDigest=(p:HvpBodyCutPayload,buffers:readonly ArrayBuffer[])=>fnv1aHash(JSON.stringify([...identity(p),fnv1aBytes(buffers)]));
export const validateHvpBodyCutRequest=(request:WorkerJobRequest,input:TransferableBufferBundle)=>{
  const p=validateHvpBodyCutPayload(request.payload),v=input.views[0],size=p.cellCount*16;
  if(request.jobKind!==HVP_BODY_CUT_JOB||request.algorithmVersion!==1||request.inputRevision!==p.revision
    ||request.estimatedOutputBytes!==HVP_BODY_CUT_MAX_OUTPUT||input.revision!==p.revision||input.buffers.length!==1||input.views.length!==1
    ||input.byteLength!==size||input.buffers[0]!.byteLength!==size||v?.name!=="cells"||v.kind!=="Int32Array"
    ||v.byteOffset!==0||v.bufferIndex!==0||v.elementCount!==p.cellCount*4||request.sourceInputDigest!==hvpBodyCutInputDigest(p,input.buffers)){
    throw new Error("Body-cut input binding mismatch");
  }
  return p;
};
export interface HvpLocalBodyProduct {
  readonly ownerId:string;readonly sourceDigest:string;readonly center:Readonly<{x:number;y:number;z:number}>;
  readonly massKg:number;readonly sourceBytes:number;readonly cells:readonly HvpStructuralCell[];readonly mesh:HvpCompactMesh;
}
type MeshWire=Omit<HvpCompactMesh,"positions"|"normals"|"colors"|"indices">&{positions:number[];normals:number[];colors:number[];indices:number[]};
type PartWire=Omit<HvpLocalBodyProduct,"mesh">&{mesh:MeshWire};
export interface HvpBodyCutProducts {readonly parts:readonly HvpLocalBodyProduct[];readonly removedCells:number;readonly removedMassKg:number}

export const decodeHvpBodyCutOutput=(output:TransferableBufferBundle,p:HvpBodyCutPayload):HvpBodyCutProducts=>{
  const b=validateTransferableBundle(output),v=b.views[0];
  if(b.ownership!=="WorkerToConsumer"||b.revision!==p.revision+1||b.buffers.length!==1||b.views.length!==1||b.byteLength>HVP_BODY_CUT_MAX_OUTPUT
    ||v?.name!=="products"||v.kind!=="Uint8Array"||v.byteOffset!==0||v.bufferIndex!==0||v.elementCount!==b.buffers[0]!.byteLength){throw new Error("Invalid body-cut output layout");}
  const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b.buffers[0]!)) as {binding:unknown;parts:PartWire[];removedCells:number;removedMassKg:number};
  if(JSON.stringify(value.binding)!==JSON.stringify(identity(p))||!Array.isArray(value.parts)||value.parts.length>32
    ||!Number.isSafeInteger(value.removedCells)||value.removedCells<1||value.removedCells>512
    ||!Number.isFinite(value.removedMassKg)||value.removedMassKg<=0){throw new Error("Invalid body-cut output binding");}
  const density=new Map(p.materials.map(m=>[Number(m.materialId),m.densityKgPerCubicMeter])),seen=new Set<string>();
  let totalCells=0;
  const parts=value.parts.map((part:PartWire,index)=>{
    if(part.ownerId!==`${p.sourceId}:r${p.revision+1}:p${index}`||!Array.isArray(part.cells)||part.cells.length<1||part.cells.length>32_768){throw new Error("Invalid body part identity/count");}
    requireStructuralHash(part.sourceDigest,"body/partDigest");
    let mass=0;const weighted=[0,0,0],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],bricks=new Set<string>();
    const cutMin=p.cell.map(n=>Math.floor(n/p.edge)*p.edge);
    const cells=part.cells.map((c:HvpStructuralCell)=>{
      if(!c||![c.x,c.y,c.z].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000)||!density.has(c.materialId)
        ||++totalCells>p.cellCount){throw new Error("Invalid body part cells");}
      const key=`${c.x}:${c.y}:${c.z}`;
      const removed=p.brush==="Sphere"?[c.x,c.y,c.z].reduce((sum,n,a)=>sum+(2*(n-p.cell[a]!))**2,0)<=p.edge**2
        :[c.x,c.y,c.z].every((n,a)=>n>=cutMin[a]!&&n<cutMin[a]!+p.edge);
      if(seen.has(key)||removed){throw new Error("Duplicate or removed body cell");}
      seen.add(key);const m=density.get(c.materialId)!*.125**3;mass+=m;
      for(const [a,n] of [c.x,c.y,c.z].entries()){weighted[a]!+=m*(n+.5)*.125;min[a]=Math.min(min[a]!,n*.125);max[a]=Math.max(max[a]!, (n+1)*.125);}
      bricks.add(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`);
      return Object.freeze({x:c.x,y:c.y,z:c.z,materialId:c.materialId});
    });
    const center={x:weighted[0]!/mass,y:weighted[1]!/mass,z:weighted[2]!/mass};
    if(!part.center||Math.abs(part.massKg-mass)>1e-8||!Number.isFinite(part.massKg)
      ||!(["x","y","z"] as const).every(a=>Number.isFinite(part.center[a])&&Math.abs(part.center[a]-center[a])<=1e-9)
      ||part.sourceBytes!==bricks.size*ADAPTIVE_BRICK_ESTIMATED_BYTES){throw new Error("Body part mass/source mismatch");}
    const mesh=part.mesh;
    if(!mesh||mesh.sourceDigest!==part.sourceDigest||mesh.algorithmVersion!=="hvp-terrain-fragment-v1"
      ||!Array.isArray(mesh.positions)||mesh.positions.length===0||mesh.positions.length>768_000||mesh.positions.length%12!==0
      ||!Array.isArray(mesh.normals)||mesh.normals.length!==mesh.positions.length||mesh.normals.some(n=>n!==0&&n!==1&&n!==-1)
      ||!Array.isArray(mesh.colors)||mesh.colors.length!==mesh.positions.length||mesh.colors.some(n=>!Number.isFinite(n)||n<0||n>1)
      ||!Array.isArray(mesh.indices)||mesh.indices.length!==mesh.positions.length/2||mesh.indices.length>384_000
      ||mesh.indices.some(n=>!Number.isSafeInteger(n)||n<0||n>=mesh.positions.length/3)
      ||mesh.faceCount!==mesh.indices.length/6||!Number.isSafeInteger(mesh.unitFaceCount)||mesh.unitFaceCount<mesh.faceCount
      ||![mesh.outerFaceCount,mesh.cavityFaceCount].every(n=>Number.isSafeInteger(n)&&n>=0)||mesh.outerFaceCount+mesh.cavityFaceCount!==mesh.faceCount
      ||!Number.isSafeInteger(mesh.tempEstimateBytes)||mesh.tempEstimateBytes<0||mesh.tempEstimateBytes>64*1024*1024){throw new Error("Invalid body mesh arrays");}
    const lo=min.map((n,a)=>Math.fround(n-[part.center.x,part.center.y,part.center.z][a]!)),hi=max.map((n,a)=>Math.fround(n-[part.center.x,part.center.y,part.center.z][a]!));
    if(mesh.positions.some((n,i)=>!Number.isFinite(n)||n<lo[i%3]!||n>hi[i%3]!)){throw new Error("Body mesh exceeds source bounds");}
    let end=0;if(!Array.isArray(mesh.materialRanges)||mesh.materialRanges.length>mesh.faceCount){throw new Error("Invalid body ranges");}
    for(const r of mesh.materialRanges){if(!density.has(r.slot)||r.startIndex!==end||!Number.isSafeInteger(r.indexCount)||r.indexCount<=0||r.indexCount%6!==0){throw new Error("Invalid body material range");}end+=r.indexCount;}
    if(end!==mesh.indices.length){throw new Error("Incomplete body material coverage");}
    const decoded:HvpCompactMesh={...mesh,positions:new Float32Array(mesh.positions),normals:new Float32Array(mesh.normals),colors:new Float32Array(mesh.colors),
      indices:mesh.positions.length/3>65_535?new Uint32Array(mesh.indices):new Uint16Array(mesh.indices),
      boundsMeters:{min:{x:lo[0]!,y:lo[1]!,z:lo[2]!},max:{x:hi[0]!,y:hi[1]!,z:hi[2]!}}};
    return Object.freeze({ownerId:part.ownerId,sourceDigest:part.sourceDigest,center:Object.freeze({...part.center}),massKg:mass,sourceBytes:part.sourceBytes,
      cells:Object.freeze(cells),mesh:Object.freeze(decoded)});
  });
  if(totalCells+value.removedCells!==p.cellCount||Math.abs(parts.reduce((n,c)=>n+c.massKg,0)+value.removedMassKg-p.massKg)>1e-8*Math.max(1,p.massKg)){
    throw new Error("Body cell/mass partition mismatch");
  }
  return Object.freeze({parts:Object.freeze(parts),removedCells:value.removedCells,removedMassKg:value.removedMassKg});
};
export const executeHvpBodyCutJob=(request:WorkerJobRequest,bundle:TransferableBufferBundle)=>{
  const input=validateTransferableBundle(bundle),p=validateHvpBodyCutRequest(request,input),raw=new Int32Array(input.buffers[0]!),cells:HvpStructuralCell[]=[];
  for(let i=0;i<raw.length;i+=4){cells.push({x:raw[i]!,y:raw[i+1]!,z:raw[i+2]!,materialId:raw[i+3]!});}
  const source=ingestHvpStructuralCells(p.sourceId,cells,p.materials);
  if(source.contentHash!==p.sourceDigest||source.objectRevision!==p.revision){throw new Error("Body source reconstruction mismatch");}
  const local=prepareHvpLocalBodyCut(source,p.cell,p.commandId,p.edge,p.brush);
  const parts:PartWire[]=local.plan.parts.map(part=>{
    const center=part.recipe.mass.centerOfMassMeters!,mesh=meshHvpBodyCells(part.cells,center,part.recipe.source.contentHash);
    return {ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,center,massKg:part.recipe.mass.totalMassKg,
      sourceBytes:part.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES,cells:part.cells,
      mesh:{...mesh,positions:Array.from(mesh.positions),normals:Array.from(mesh.normals),colors:Array.from(mesh.colors!),indices:Array.from(mesh.indices)}};
  });
  const bytes=new TextEncoder().encode(JSON.stringify({binding:identity(p),parts,removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg}));
  if(bytes.byteLength>HVP_BODY_CUT_MAX_OUTPUT){throw new Error("Body-cut products BudgetExceeded");}
  const buffers=[bytes.buffer as ArrayBuffer],output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.revision+1),
    byteLength:byteCount(bytes.byteLength),contentHash:fnv1aBytes(buffers),views:[{name:"products",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:bytes.length}]};
  decodeHvpBodyCutOutput(output,p);
  const result:WorkerJobResult={jobId:request.jobId,targetKey:request.targetKey,workerEpoch:request.workerEpoch,planningEpoch:request.planningEpoch,
    inputRevision:request.inputRevision,sourceInputDigest:request.sourceInputDigest,outputRevision:output.revision,algorithmVersion:request.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash};
  return {result,bundle:output};
};
