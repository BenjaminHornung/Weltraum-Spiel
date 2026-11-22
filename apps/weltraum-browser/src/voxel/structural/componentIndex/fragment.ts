import type { HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import type { HvpCell } from "../../../hestia-prototype/terrain/picking";
import type { HvpStructuralCell } from "../../../hestia-prototype/terrain/structuralIngest";
import type { HvpSupportReport } from "../../../hestia-prototype/terrain/supportPlan";
import { box, cell, exactShapes, orderedSpans, type Box, type CompactTerrainPart, type Span, runLength, materialOf } from "./exactShapes";
import { combineMass, type CompactMass, type PartFacts } from "./partFacts";

export interface CompactTerrainFragment {
  readonly sessionId:string;
  readonly epoch:number;
  readonly sourceDigest:string;
  readonly revision:number;
  readonly originMeters:HvpTerrainSnapshot["originMeters"];
  readonly ownerId:string;
  readonly digest:string;
  readonly cellCount:number;
  readonly parts: readonly CompactTerrainPart[];
  readonly min:HvpCell;
  readonly max:HvpCell;
  readonly affectedLeaves:readonly string[];
  readonly mass:CompactMass;
  readonly massKg:number;
  readonly colliderBoxes:readonly Box[];
}

export const handoffCounters=()=>({
  partReferences:0, voxelPayloadBytesCopied:0, descriptorReferencesReused:0, descriptorsBuilt:0,
  partDescriptorsPrepared:0, materialRunsReferenced:0, anchoredWitnesses:0,
  blockBuildMs:0, fragmentMassMs:0, fragmentShapeMs:0, fragmentMembershipMs:0,
});
type HandoffCounters=ReturnType<typeof handoffCounters>;

// The existing owner/digest is FNV32 of the ordered JSON cells. Stream from spans without allocating cell objects.
function contentDigest(spans:readonly Span[]): string | undefined {
  let hash=0x811c9dc5;
  function append(value:string) { for(let i=0;i<value.length;i++) hash=Math.imul(hash^value.charCodeAt(i),0x01000193); }
  let runs=0,previous:Span|undefined;
  append("[");
  for(const span of spans) {
    if(!previous || span.y!==previous.y || span.z!==previous.z || span.x!==previous.end || span.material!==previous.material) {
      if(++runs>4096) return undefined;
    }
    for(let x=span.x;x<span.end;x++) {
      if(previous || x!==span.x) append(",");
      append(`{"x":${x},"y":${span.y},"z":${span.z},"materialId":${span.material}}`);
    }
    previous=span;
  }
  append("]");
  return (hash>>>0).toString(16).padStart(8,"0");
}

const shapeKey=(b:Box)=>b.min.join(",")+"/"+b.max.join(",");

export function buildFragment(source:HvpTerrainSnapshot,facts:readonly PartFacts[],stats:HandoffCounters):CompactTerrainFragment|undefined {
  let start=performance.now();
  const parts=Object.freeze(facts.map(f=>f.part));
  const affectedLeaves=Object.freeze([...new Set(parts.map(p=>p.origin.map(v=>v>>4).join(":")))].sort());
  if(affectedLeaves.length>128) return undefined; // Existing 16 MiB structural brick admission.
  const spans=orderedSpans(parts),digest=contentDigest(spans);
  if(digest===undefined) return undefined;
  stats.materialRunsReferenced+=spans.length;
  stats.partReferences+=parts.length;
  let count=0,xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=0,ymax=0,zmax=0;
  for(const f of facts) {
    count+=f.count;
    const {min,max}=f.bounds;
    xmin=Math.min(xmin,min[0]);ymin=Math.min(ymin,min[1]);zmin=Math.min(zmin,min[2]);
    xmax=Math.max(xmax,max[0]);ymax=Math.max(ymax,max[1]);zmax=Math.max(zmax,max[2]);
  }
  const bounds=box(cell(xmin,ymin,zmin),cell(xmax,ymax,zmax));
  stats.fragmentMembershipMs+=performance.now()-start;
  start=performance.now();
  const mass=combineMass(facts);
  stats.fragmentMassMs+=performance.now()-start;
  start=performance.now();
  let colliderBoxes=facts.length===1?facts[0].shapes:exactShapes(spans,count,bounds);
  if(!colliderBoxes) return undefined;
  if(facts.length===1) {
    stats.descriptorReferencesReused+=colliderBoxes.length;
  } else {
    // Global canonical assembly may join across block seams. Include interim shape allocations in the counter.
    stats.descriptorsBuilt+=colliderBoxes.length;
    const local=new Map<string,Box>();
    for(const f of facts) for(const s of f.shapes??[]) local.set(shapeKey(s),s);
    colliderBoxes=Object.freeze(colliderBoxes.map(s=>{
      const reused=local.get(shapeKey(s));
      if(reused){stats.descriptorReferencesReused++;return reused;}
      return s;
    }));
  }
  stats.fragmentShapeMs+=performance.now()-start;
  return Object.freeze({sessionId:source.sessionId,epoch:source.epoch,sourceDigest:source.sourceDigest,revision:source.revision,
    originMeters:source.originMeters,ownerId:`hvp:terrain-fragment:r${source.revision}:${digest}`,digest,
    parts,cellCount:count,min:bounds.min,max:bounds.max,affectedLeaves,massKg:mass.totalMassKg,mass,colliderBoxes});
}

export function materializeCompactCells(fragment:Pick<CompactTerrainFragment,"parts">):readonly HvpStructuralCell[] {
  // The receiver may have no resident index. Validate work bounds before expanding a wire clone.
  const {parts}=fragment;
  if(!Array.isArray(parts) || parts.length<1 || parts.length>32768) throw new Error("Invalid compact fragment part count");
  let count=0;
  const identities=new Set<string>();
  for(const part of parts) {
    if(!part || !Array.isArray(part.origin) || part.origin.length!==3 ||
      !part.origin.every((v:number)=>Number.isSafeInteger(v)&&v>=0&&v<256&&v%16===0) ||
      !Number.isSafeInteger(part.leafRevision) || part.leafRevision<0 || !Number.isSafeInteger(part.label) ||
      part.label<1 || part.label>2048 || !Array.isArray(part.runs) || !part.runs.length || part.runs.length>4096) {
      throw new Error("Invalid compact fragment part");
    }
    const id=part.origin.join(":")+":"+part.label;
    if(identities.has(id)) throw new Error("Duplicate compact component");
    identities.add(id);
    let next=0;
    for(const run of part.runs) {
      const offset=run&4095,length=runLength(run);
      if(!Number.isSafeInteger(run) || run<65536 || run>0x4ffff || materialOf(run)>4 ||
        (offset&15)+length>16 || offset<next || (count+=length)>32768) throw new Error("Invalid compact material run");
      next=offset+length;
    }
  }
  const cells:HvpStructuralCell[]=[];
  let previous:Span|undefined;
  for(const span of orderedSpans(parts)) {
    const {x,end,y,z,material}=span;
    if(previous && previous.z===z && previous.y===y && previous.end>x) throw new Error("Overlapping compact components");
    for(let at=x;at<end;at++) cells.push(Object.freeze({x:at,y,z,materialId:material}));
    previous=span;
  }
  return Object.freeze(cells);
}

/** Historical source/save/mesh consumers explicitly request a cell array at their boundary. */
export function compactSupportReport(result:{status:HvpSupportReport["status"];fragments:readonly CompactTerrainFragment[];
  workingBytes:number;counters:{sourceCellsScanned:number;anchoredWitnesses:number}}):HvpSupportReport {
  const fragments=result.fragments.map(f=>Object.freeze({id:`hvp-terrain-fragment-${f.digest}`,digest:f.digest,
    cells:materializeCompactCells(f),min:f.min,max:f.max,massKg:f.massKg,colliders:f.colliderBoxes.length,
    colliderBoxes:f.colliderBoxes,affectedLeaves:f.affectedLeaves}));
  return Object.freeze({status:result.status,reason:result.status==="Ready"||result.status==="NoChange"?"":result.status,
    probes:result.counters.sourceCellsScanned,anchoredWitnesses:result.counters.anchoredWitnesses,fragments:Object.freeze(fragments),
    workingBytes:result.workingBytes+result.fragments.reduce((sum,f)=>sum+256*f.cellCount,0)});
}
