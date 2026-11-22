import {selectHvpCutCells} from "../terrain/cutPlan";
import type {HvpCell} from "../terrain/picking";
import {exactShapes, type Box, type Span} from "../../voxel/structural/componentIndex/exactShapes";
import {measureCompactMaterialSpans} from "../../voxel/structural/componentIndex/partFacts";
import {hvpMovingBrush} from "./bodyCutPlan";
import {compactBoxesShareFace, isIssuedHvpCompactNativeOwner, type HvpCompactNativeOwner} from "./compactNativeOwner";

const rowKey = (y:number,z:number) => z*512+y;
function connectedBoxGroups(boxes:readonly Box[]) {
  const groups = new Int32Array(boxes.length).fill(-1);
  const result:Box[][] = [];
  for (let seed=0; seed<boxes.length; seed++) {
    if (groups[seed] !== -1) continue;
    const group:Box[] = [boxes[seed]!], id = result.length;
    groups[seed]=id;
    for (let front=0; front<group.length; front++) {
      for (let i=0; i<boxes.length; i++) {
        if (groups[i] === -1 && compactBoxesShareFace(group[front]!,boxes[i]!)) {
          groups[i]=id;
          group.push(boxes[i]!);
        }
      }
    }
    result.push(group);
  }
  return {groups,result};
}

/** Exact source and shape preparation. The caller decides which verified shapes fit the live native admission profile. */
export function prepareCompactMovingPlan(owner:HvpCompactNativeOwner, hit:HvpCell, edge:number, brush:"Box"|"Sphere") {
  if (!isIssuedHvpCompactNativeOwner(owner) || !owner.readMaterial(...hit)) throw Error("Missing live compact material hit");
  const {shape} = hvpMovingBrush(hit,edge,brush);
  const selected = selectHvpCutCells(shape);
  // Every occupied y/z row of an axis-aligned box or sphere is one x interval.
  const rows = new Map<number,{x:number;end:number}>();
  for (const [x,y,z] of selected) {
    // Only source coordinates can affect an admitted compact body.
    if(x<0 || x>=256 || y<1 || y>=128 || z<0 || z>=256) continue;
    const key=rowKey(y,z), old=rows.get(key);
    if(old){old.x=Math.min(old.x,x);old.end=Math.max(old.end,x+1);}
    else rows.set(key,{x,end:x+1});
  }
  const source=owner.materialRuns(), kept:Span[]=[], removed:Span[]=[];
  for(const s of source) {
    const cut=rows.get(rowKey(s.y,s.z));
    if(!cut || cut.end<=s.x || cut.x>=s.end){kept.push(s);continue;}
    const x=Math.max(s.x,cut.x),end=Math.min(s.end,cut.end);
    if(s.x<x)kept.push(Object.freeze({...s,end:x}));
    removed.push(Object.freeze({...s,x,end}));
    if(end<s.end)kept.push(Object.freeze({...s,x:end}));
  }
  const removedFacts=measureCompactMaterialSpans(removed);
  const removedSource=Object.freeze({runs:Object.freeze(removed),...removedFacts});
  const parent=owner.identity;
  if(!kept.length)return Object.freeze({kind:"Planned" as const,parent,removed:removedSource,children:Object.freeze([])});
  const coverage=measureCompactMaterialSpans(kept);
  if(coverage.count+removedFacts.count!==owner.cellCount)throw Error("Compact cut changed material count");
  const boxes=exactShapes(kept,coverage.count,coverage.bounds);
  if(!boxes)return Object.freeze({kind:"NeedsArchive" as const,parent});
  const {groups,result}=connectedBoxGroups(boxes);
  const parts=result.map(()=>[] as Span[]);
  for(const s of kept){
    // A material run is face connected. All boxes spanning its cells belong to the component found at its first cell.
    const i=boxes.findIndex(({min,max})=>min[0]<=s.x&&s.x<max[0]&&min[1]<=s.y&&s.y<max[1]&&min[2]<=s.z&&s.z<max[2]);
    if(i<0)throw Error("Compact run outside exact coverage");
    parts[groups[i]!]!.push(s);
  }
  const children=parts.map((runs,i)=>Object.freeze({
    ...(parts.length===1?coverage:measureCompactMaterialSpans(runs)),
    runs:Object.freeze(runs),boxes:Object.freeze(result[i]!)
  }));
  return Object.freeze({kind:"Planned" as const,parent,removed:removedSource,children:Object.freeze(children)});
}
