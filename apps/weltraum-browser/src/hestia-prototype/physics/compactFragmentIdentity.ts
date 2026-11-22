import {fnv1a64Bytes} from "../../core/fnv1a64";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../hvp/hvpCoastSource";
import {checkedCompactSpans,compactTerrainOwnerDigest} from "../../voxel/structural/componentIndex/fragment";
import type {Span} from "../../voxel/structural/componentIndex/exactShapes";
import type {HvpStructuralCell} from "../terrain/structuralIngest";
import {readHvpBodyCells} from "./bodyCutPlan";
import type {HvpRigidRecipe} from "./rigidRecipe";
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

const archiveDigests=new WeakMap<HvpRigidRecipe,string>();
/** Stable material membership for original Hestia terrain transfers after restoring a Structural v1 archive.
 * Other owners and archive profiles retain their original Structural content identity. */
export function hvpFragmentArchiveDigest(recipe:HvpRigidRecipe):string {
  const cached=archiveDigests.get(recipe);
  if(cached)return cached;
  const source=recipe.source;
  let digest=source.contentHash;
  const match=/^hvp:terrain-fragment:r[1-9][0-9]*:([0-9a-f]{8})$/.exec(source.objectId);
  if(match && recipe.mass.occupiedVoxelCount<=1024 && source.bricks.length<=4 && !source.anchors.length && !source.joints.length
    && source.objectRevision===0 && source.editRevision===0 && source.frame.bodyId==="body.hestia" && source.frame.surfaceFrameId==="frame.hvp"
    && source.frame.generatorVersion==="hvp-rigid-ingest-v1" && Object.values(source.frame.objectOriginQuantum).every(v=>v===0)
    && source.materials.length===HVP_COAST_MATERIAL_REGISTRY.length && source.materials.every((m,i)=>{
      const local=HVP_COAST_MATERIAL_REGISTRY[i]!;
      return m.materialId===local.slot&&m.densityKgPerCubicMeter===local.densityKgPerM3&&m.structuralClass===local.role&&m.destructible&&m.tags===null;
    })){
    const cells=readHvpBodyCells(source),spans=orderedCellSpans(cells);
    if(spans.length<=128 && spans.every(s=>s.x>=0&&s.end<=256&&s.y>0&&s.y<128&&s.z>=0&&s.z<256)
      && compactTerrainOwnerDigest(spans)===match[1])digest=compactRuntimeMembershipDigest(spans,cells.length);
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
