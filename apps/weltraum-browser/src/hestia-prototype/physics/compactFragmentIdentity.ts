import {fnv1a64Bytes} from "../../core/fnv1a64";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../hvp/hvpCoastSource";
import {checkedCompactSpans,compactTerrainOwnerDigest} from "../../voxel/structural/componentIndex/fragment";
import type {Span} from "../../voxel/structural/componentIndex/exactShapes";
import type {HvpStructuralCell} from "../terrain/structuralIngest";
import {readHvpBodyCells} from "./bodyCutPlan";
import {assertHvpRigidRecipe,type HvpRigidRecipe} from "./rigidRecipe";
import type {HvpCompactTerrainSource} from "./compactTerrainWire";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";

/** The compact runtime format hashes exactly four little coordinates/material bytes per voxel,
 * in global z/y/x order. Runs can split at any block boundary without changing this binding.
 * The caller supplies checked terrain extents and exact occupied count. */
export function compactRuntimeMembershipDigest(sorted: readonly Span[], count: number): string {
  if (!Number.isSafeInteger(count) || count<1 || count>1024) throw new Error("Invalid compact digest count");
  const bytes=new Uint8Array(count*4);
  let at=0,previous:Span|undefined;
  for(const span of sorted) {
    const {x,end,y,z,material}=span;
    if(![x,end,y,z,material].every(Number.isSafeInteger) || x<0||x>=end||end>256||y<1||y>=128||z<0||z>=256
      || material<1||material>4 || (previous && (z<previous.z || z===previous.z && (y<previous.y || y===previous.y && x<previous.end)))) {
      throw new Error("Invalid compact digest span");
    }
    for(let px=x;px<end;px++) {
      if(at>=bytes.length) throw new Error("Compact digest overflow");
      bytes[at++]=px;bytes[at++]=y;bytes[at++]=z;bytes[at++]=material;
    }
    previous=span;
  }
  if(at!==bytes.length) throw new Error("Incomplete compact digest");
  return `hvp-material-cells-v1:${fnv1a64Bytes(bytes)}`;
}

/** Archive/export budgets already qualified by the compact Worker fixtures. */
export function supportsCompactArchive(source:HvpCompactTerrainSource):boolean {
  if(!Number.isSafeInteger(source.cellCount)||source.cellCount<1||source.cellCount>1024
    ||!Array.isArray(source.parts)||source.parts.length>128)return false;
  let runs=0;
  const leaves=new Set<string>();
  for(const part of source.parts){
    if(!part || !Array.isArray(part.origin)||!Array.isArray(part.runs))return false;
    runs+=part.runs.length;
    leaves.add(part.origin.join(":"));
    if(runs>128||leaves.size>4)return false;
  }
  return true;
}

function orderedCellSpans(cells:readonly HvpStructuralCell[]):Span[] {
  const sorted=[...cells].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x);
  const result:{x:number;y:number;z:number;end:number;material:number}[]=[];
  for(const cell of sorted){
    const previous=result.at(-1);
    if(previous&&cell.x%16!==0&&previous.end===cell.x&&previous.y===cell.y&&previous.z===cell.z&&previous.material===cell.materialId){
      previous.end++; continue;
    }
    result.push({x:cell.x,end:cell.x+1,y:cell.y,z:cell.z,material:cell.materialId});
  }
  return result;
}

export type HvpCompactCellSpan = Span;

export interface HvpCompactChildProof {
  readonly version: "hvp-compact-child-proof-v1";
  readonly parentOwnerId: string;
  readonly parentDigest: string;
  readonly removed: readonly Span[];
  readonly childDigest: string;
}

const terrainRoot = /^hvp:terrain-fragment:r([1-9][0-9]{0,15}):([0-9a-f]{8})$/;
const spanOrder = (a:Span,b:Span) => a.z-b.z || a.y-b.y || a.x-b.x;
const archiveDigests = new WeakMap<HvpRigidRecipe,string>();
const archiveProofs = new WeakMap<HvpRigidRecipe,HvpCompactChildProof>();

/** Normalize split runs at 16-cell boundaries and reject out-of-order, overlapping or oversized input. */
function compactRuns(input:readonly Span[], maxInput=128) {
  if (!Array.isArray(input) || !input.length || input.length>maxInput) return;
  const spans:Span[] = [];
  const leaves = new Set<number>();
  let count=0;
  for (const value of input) {
    if (!value) return;
    const {x,end,y,z,material} = value;
    if (![x,end,y,z,material].every(Number.isSafeInteger) || x<0 || x>=end || end>256
      || y<1 || y>=128 || z<0 || z>=256 || material<1 || material>4) return;
    count+=end-x;
    if (count>1024) return;
    for (let start=x;start<end;) {
      const stop=Math.min(end,16*(1+(start>>4)));
      const last=spans.at(-1);
      if (last && (z<last.z || z===last.z && (y<last.y || y===last.y && start<last.end))) return;
      if (last && start%16!==0 && last.y===y && last.z===z && last.end===start && last.material===material) {
        spans[spans.length-1]={...last,end:stop};
      } else {
        spans.push({x:start,end:stop,y,z,material});
        if (spans.length>128) return;
      }
      leaves.add((start>>4)+16*((y>>4)+8*(z>>4)));
      if (leaves.size>4) return;
      start=stop;
    }
  }
  return {spans,count};
}

export function compactRemovedMembershipDigest(sorted:readonly Span[],count:number):string {
  const cellsDigest=compactRuntimeMembershipDigest(sorted,count);
  return cellsDigest.replace("hvp-material-cells-v1:","hvp-material-removed-v1:");
}

type CompactRuns = NonNullable<ReturnType<typeof compactRuns>>;
function childIdentity(parentOwnerId:string,parentDigest:string,retained:CompactRuns,removed:CompactRuns) {
  const ownerId=parentOwnerId+":r1:p0";
  const retainedDigest=compactRuntimeMembershipDigest(retained.spans,retained.count);
  const removedDigest=compactRemovedMembershipDigest(removed.spans,removed.count);
  const payload=JSON.stringify([ownerId,parentDigest,retainedDigest,removedDigest]);
  const sourceDigest="hvp-material-child-v1:"+fnv1a64Bytes(new TextEncoder().encode(payload));
  const proof:HvpCompactChildProof=Object.freeze({version:"hvp-compact-child-proof-v1",parentOwnerId,parentDigest,
    childDigest:sourceDigest,removed:Object.freeze(removed.spans.map(s=>Object.freeze(s)))});
  return Object.freeze({ownerId,sourceDigest,removedDigest,proof});
}

/** First cut of a terrain root, exactly one surviving part. A missing sibling, shifted cell or material
 * mismatch fails the exact run comparison. The existing structural path handles other topologies. */
export function createHvpCompactChildIdentity(parent:{ownerId:string;revision:number;sourceDigest:string;spans:readonly Span[]},
  removed:readonly Span[],retained:readonly Span[],partIndex=0) {
  const match=terrainRoot.exec(parent.ownerId);
  if (parent.revision!==0 || partIndex!==0 || !match || !Number.isSafeInteger(Number(match[1]))) return;
  const old=compactRuns(parent.spans), cut=compactRuns(removed), child=compactRuns(retained);
  if (!old || !cut || !child || old.count!==child.count+cut.count) return;
  const joined=compactRuns([...child.spans,...cut.spans].sort(spanOrder),256);
  if (!joined || old.spans.length!==joined.spans.length || !old.spans.every((s,i)=>{
    const other=joined.spans[i]!;
    return !spanOrder(s,other) && s.end===other.end && s.material===other.material;
  })) return;
  if (compactTerrainOwnerDigest(old.spans)!==match[2]
    || compactRuntimeMembershipDigest(old.spans,old.count)!==parent.sourceDigest) return;
  return childIdentity(parent.ownerId,parent.sourceDigest,child,cut);
}

function compactArchiveProfile(recipe:HvpRigidRecipe):boolean {
  const source=recipe.source;
  return recipe.mass.occupiedVoxelCount<=1024 && source.bricks.length<=4 && !source.anchors.length && !source.joints.length
    && !source.commandEvidence.length && source.objectRevision===0 && source.editRevision===0
    && source.frame.bodyId==="body.hestia" && source.frame.surfaceFrameId==="frame.hvp"
    && source.frame.regionId==="region."+source.objectId && source.frame.generatorVersion==="hvp-rigid-ingest-v1"
    && Object.values(source.frame.objectOriginQuantum).every(v=>v===0)
    && source.bricks.every(b=>b.cells.every(({state})=>state.partId===null && state.semanticKey===null && state.damageKey===null))
    && source.materials.length===HVP_COAST_MATERIAL_REGISTRY.length && source.materials.every((m,i)=>{
      const local=HVP_COAST_MATERIAL_REGISTRY[i]!;
      return m.materialId===local.slot && m.densityKgPerCubicMeter===local.densityKgPerM3
        && m.structuralClass===local.role && m.destructible && m.tags===null;
    });
}

/** Cheap shape/budget check before a world checkpoint is cloned or its Structural region decoded. */
export function isHvpCompactChildProof(value:unknown):value is HvpCompactChildProof {
  const data=value as HvpCompactChildProof|null;
  return !!data && Object.keys(data).sort().join(",")==="childDigest,parentDigest,parentOwnerId,removed,version"
    && data.version==="hvp-compact-child-proof-v1" && typeof data.parentOwnerId==="string"
    && terrainRoot.test(data.parentOwnerId) && typeof data.parentDigest==="string" && /^hvp-material-cells-v1:[a-f0-9]{16}$/.test(data.parentDigest)
    && typeof data.childDigest==="string" && /^hvp-material-child-v1:[a-f0-9]{16}$/.test(data.childDigest)
    && Array.isArray(data.removed) && data.removed.length>0 && data.removed.length<=128
    && data.removed.every(s=>s && Object.keys(s).sort().join(",")==="end,material,x,y,z"
      && [s.x,s.end,s.y,s.z,s.material].every(Number.isSafeInteger));
}

export const hvpCompactChildArchiveProof=(recipe:HvpRigidRecipe)=>archiveProofs.get(recipe);

/** Validate the saved child and the complement against BOTH original terrain membership hashes. The
 * owner name alone is insufficient. Classic v1 archives do not claim this optional derivation. */
export function bindHvpCompactChildArchive(recipe:HvpRigidRecipe,proof:unknown):string {
  assertHvpRigidRecipe(recipe);
  if (!isHvpCompactChildProof(proof) || recipe.source.objectId!==proof.parentOwnerId+":r1:p0" || !compactArchiveProfile(recipe)) {
    throw new Error("Invalid compact child archive profile or lineage");
  }
  const child=compactRuns(orderedCellSpans(readHvpBodyCells(recipe.source))),removed=compactRuns(proof.removed);
  if (!child || !removed) throw new Error("Invalid compact child archive membership");
  const parent=compactRuns([...child.spans,...removed.spans].sort(spanOrder),256);
  const match=terrainRoot.exec(proof.parentOwnerId)!;
  if (!parent || !Number.isSafeInteger(Number(match[1])) || compactTerrainOwnerDigest(parent.spans)!==match[2]
    || compactRuntimeMembershipDigest(parent.spans,parent.count)!==proof.parentDigest) throw new Error("Invalid compact child archive parent membership");
  const verified=childIdentity(proof.parentOwnerId,proof.parentDigest,child,removed);
  if (verified.sourceDigest!==proof.childDigest) throw new Error("Invalid compact child archive digest");
  archiveProofs.set(recipe,verified.proof);
  archiveDigests.set(recipe,verified.sourceDigest);
  return verified.sourceDigest;
}
/** Stable material membership for original Hestia terrain transfers after restoring a Structural v1 archive.
 * Other owners and archive profiles retain their original Structural content identity. */
export function hvpFragmentArchiveDigest(recipe:HvpRigidRecipe):string {
  const cached=archiveDigests.get(recipe);
  if(cached)return cached;
  const source=recipe.source;
  let digest=source.contentHash;
  const match=terrainRoot.exec(source.objectId);
  if(match && Number.isSafeInteger(Number(match[1])) && compactArchiveProfile(recipe)){
    const cells=readHvpBodyCells(source),spans=orderedCellSpans(cells);
    if(spans.length<=128 && spans.every(s=>s.x>=0&&s.end<=256&&s.y>0&&s.y<128&&s.z>=0&&s.z<256)
      && compactTerrainOwnerDigest(spans)===match[2])digest=compactRuntimeMembershipDigest(spans,cells.length);
  }
  archiveDigests.set(recipe,digest);
  return digest;
}

/** Verify a runtime receipt against the exact membership which the input owner sent across this terrain transaction. */
export function matchesHvpFragmentSourceDigest(value:unknown,request:HvpTerrainFragmentRequest):value is string {
  if(typeof value!=="string")return false;
  if(/^fnv1a64-v1:[a-f0-9]{16}$/.test(value))return !request.compactSource||!supportsCompactArchive(request.compactSource);
  if(!/^hvp-material-cells-v1:[a-f0-9]{16}$/.test(value))return false;
  const source=request.compactSource;
  if(source&&!supportsCompactArchive(source))return false;
  const count=source?.cellCount??request.cells.length;
  if(!Number.isSafeInteger(count)||count<1||count>1024)return false;
  const spans=source?checkedCompactSpans(source):orderedCellSpans(request.cells);
  return compactRuntimeMembershipDigest(spans,count)===value;
}
