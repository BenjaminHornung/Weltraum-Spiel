import {compactCellSpans,compactRemovedMembershipDigest,compactRuntimeMembershipDigest,createHvpCompactChildIdentity} from "../physics/compactFragmentIdentity";
import type {HvpMovingCutPreparation} from "../physics/bodyCutSession";
import {compactTerrainOwnerDigest} from "../../voxel/structural/componentIndex/fragment";

/** A cloned native projection may stage a mesh only for the material cells of this exact cut. */
export function readCompactMovingProjection(source:HvpMovingCutPreparation){
  const {compact,payload}=source,projection=compact?.projection;
  if(!compact||!projection||compact.version!=="hvp-compact-moving-cut-v1"||projection.ownerId!==payload.ownerId
    ||projection.commandId!==payload.commandId||projection.sessionId!==payload.sessionId||projection.epoch!==payload.epoch
    ||projection.issuedTick!==source.issuedTick||projection.sourceId!==payload.sourceId||projection.revision!==0||payload.revision!==0
    ||projection.sourceDigest!==payload.sourceDigest||!Array.isArray(source.cells)||source.cells.length>1024
    ||payload.cellCount!==source.cells.length||!Array.isArray(projection.parts)||projection.parts.length>1
    ||!Number.isSafeInteger(projection.removedCells)||projection.removedCells<1||projection.removedCells>512
    ||!Number.isFinite(projection.removedMassKg)||projection.removedMassKg<=0)throw Error("Invalid compact moving projection");
  const rootRuns=compactCellSpans(source.cells);
  const part=projection.parts[0];
  if(!part){
    const parent=/^hvp:terrain-fragment:r([1-9][0-9]{0,15}):([0-9a-f]{8})$/.exec(payload.ownerId);
    if(!parent||!Number.isSafeInteger(Number(parent[1]))||projection.removedCells!==source.cells.length
      ||compactTerrainOwnerDigest(rootRuns)!==parent[2]||compactRuntimeMembershipDigest(rootRuns,source.cells.length)!==payload.sourceDigest
      ||compactRemovedMembershipDigest(rootRuns,source.cells.length)!==compact.removedDigest)throw Error("Incomplete compact moving erasure");
    return projection;
  }
  if(!Array.isArray(part.cells)||part.cells.length+projection.removedCells!==source.cells.length)throw Error("Invalid compact moving child count");
  const kept=compactCellSpans(part.cells);
  const keys=new Set<number>();
  const key=(x:number,y:number,z:number)=>x+256*(y+128*z);
  for(const span of kept)for(let x=span.x;x<span.end;x++)keys.add(key(x,span.y,span.z));
  const removed=compactCellSpans(source.cells.filter(c=>!keys.has(key(c.x,c.y,c.z))));
  const child=createHvpCompactChildIdentity({ownerId:payload.ownerId,sourceDigest:payload.sourceDigest,revision:payload.revision,spans:rootRuns},removed,kept);
  if(!child||child.ownerId!==part.ownerId||child.sourceDigest!==part.sourceDigest||child.removedDigest!==compact.removedDigest)throw Error("Foreign compact moving projection material");
  return projection;
}
