import {requirePlainRecord,requireExactKeys} from "../../voxel/adaptive/validation";
import {requireStructuralHash,structuralMaterialId} from "../../voxel/structural/validation";
import type {HvpBodyChildProjection,HvpMovingCutPreparation} from "./bodyCutSession";
import {validateTransferableBundle,type TransferableBufferBundle} from "../../workers/protocol";
import {HVP_BODY_MESH_MAX_OUTPUT} from "../../workers/hvpBodyMeshJob";

/** Ephemeral transport binding; never a Source, Save or native ownership proof. */
export const HVP_PHYSICS_PROTOCOL = "hvp-physics-owner-v3";
export interface HvpPhysicsBinding {
  readonly protocol: typeof HVP_PHYSICS_PROTOCOL;
  readonly incarnation: string;
}

const projectionFields=["sessionId","epoch","commandId","ownerId","sourceId","sourceDigest","revision","issuedTick"] as const;
/** The live Begin frame, not a capability to supply a plan or native recipe. */
export type HvpBodyProjectionRequest=Pick<HvpBodyChildProjection,typeof projectionFields[number]>&{readonly beginRequestId:number};
export interface HvpBodyProjectionReply {readonly beginRequestId:number;readonly projection:HvpBodyChildProjection}
export interface HvpBodyMeshAdmissionReply {readonly beginRequestId:number;readonly output:TransferableBufferBundle}
/** Data returned from the owner; the retained ticket, never this packet, authorizes Stage. */
export const readHvpBodyMeshAdmissionReply=(value:unknown,expected:HvpBodyProjectionRequest):TransferableBufferBundle=>{
  const reply=requirePlainRecord(value,"body/mesh/reply");
  requireExactKeys(reply,["beginRequestId","output"],"body/mesh/reply");
  const output=requirePlainRecord(reply.output,"body/mesh/output");
  requireExactKeys(output,["ownership","revision","byteLength","buffers","views","contentHash"],"body/mesh/output");
  if(reply.beginRequestId!==expected.beginRequestId||output.ownership!=="WorkerToConsumer"||output.revision!==expected.revision
    ||typeof output.byteLength!=="number"||output.byteLength>HVP_BODY_MESH_MAX_OUTPUT
    ||!Array.isArray(output.buffers)||output.buffers.length!==7||!Array.isArray(output.views)||output.views.length>32){
    throw new Error("Invalid body mesh reply binding/budget");
  }
  return validateTransferableBundle(output as unknown as TransferableBufferBundle);
};
export const hvpBodyProjectionBinding=(preparation:HvpMovingCutPreparation,beginRequestId:number):HvpBodyProjectionRequest=>{
  const p=preparation.payload;
  return Object.freeze({beginRequestId,sessionId:p.sessionId,epoch:p.epoch,commandId:p.commandId,ownerId:p.ownerId,
    sourceId:p.sourceId,sourceDigest:p.sourceDigest,revision:p.revision,issuedTick:preparation.issuedTick});
};
export const requireHvpBodyProjectionBinding=(value:unknown,expected:HvpBodyProjectionRequest):void=>{
  const record=requirePlainRecord(value,"body/projection/request");
  requireExactKeys(record,[...projectionFields,"beginRequestId"],"body/projection/request");
  if(record.beginRequestId!==expected.beginRequestId||projectionFields.some(key=>!Object.is(record[key],expected[key]))){
    throw new Error("Stale body projection binding");
  }
};

/** Validate/freeze cloned data once. No geometry, Source issuance or native admission is established. */
export const readHvpBodyProjectionReply=(value:unknown,expected:HvpBodyProjectionRequest):HvpBodyChildProjection=>{
  const reply=requirePlainRecord(value,"body/projection/reply");
  requireExactKeys(reply,["beginRequestId","projection"],"body/projection/reply");
  const projection=requirePlainRecord(reply.projection,"body/projection");
  requireExactKeys(projection,[...projectionFields,"removedCells","removedMassKg","parts"],"body/projection");
  if(reply.beginRequestId!==expected.beginRequestId||projectionFields.some(key=>!Object.is(projection[key],expected[key]))
    ||!Array.isArray(projection.parts)||projection.parts.length>32
    ||typeof projection.removedCells!=="number"||!Number.isSafeInteger(projection.removedCells)||projection.removedCells<1||projection.removedCells>512
    ||typeof projection.removedMassKg!=="number"||!Number.isFinite(projection.removedMassKg)||projection.removedMassKg<=0){
    throw new Error("Invalid body projection reply binding/count");
  }
  let cells=projection.removedCells;
  for(const [index,input] of projection.parts.entries()){
    const part=requirePlainRecord(input,"body/projection/part"),center=requirePlainRecord(part.center,"body/projection/center");
    requireExactKeys(part,["ownerId","sourceDigest","center","massKg","sourceBytes","cells"],"body/projection/part");
    requireExactKeys(center,["x","y","z"],"body/projection/center");
    if(part.ownerId!==`${expected.sourceId}:r${expected.revision+1}:p${index}`
      ||typeof part.massKg!=="number"||!Number.isFinite(part.massKg)||part.massKg<=0
      ||typeof part.sourceBytes!=="number"||!Number.isSafeInteger(part.sourceBytes)||part.sourceBytes<0
      ||![center.x,center.y,center.z].every(n=>typeof n==="number"&&Number.isFinite(n))
      ||!Array.isArray(part.cells)||part.cells.length<1||part.cells.length>32_768-cells){
      throw new Error("Invalid body projection part layout/count");
    }
    requireStructuralHash(part.sourceDigest,"body/projection/partDigest");
    cells+=part.cells.length;
    for(const inputCell of part.cells){
      const cell=requirePlainRecord(inputCell,"body/projection/cell");
      requireExactKeys(cell,["x","y","z","materialId"],"body/projection/cell");
      if(![cell.x,cell.y,cell.z].every(n=>typeof n==="number"&&Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000)){
        throw new Error("Invalid body projection cell layout");
      }
      structuralMaterialId(cell.materialId,"body/projection/cell/materialId",false);
      Object.freeze(cell);
    }
    Object.freeze(center);Object.freeze(part.cells);Object.freeze(part);
  }
  Object.freeze(projection.parts);
  return Object.freeze(projection) as unknown as HvpBodyChildProjection;
};
