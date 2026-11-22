import type { HvpCell } from "../../../hestia-prototype/terrain/picking";
import type { HvpTransferredColliderBox } from "../../../hestia-prototype/physics/rigidRecipe";

export type Box = HvpTransferredColliderBox;
export const cell = (x:number, y:number, z:number): HvpCell => Object.freeze([x,y,z]);
export const box = (min:HvpCell,max:HvpCell):Box => Object.freeze({min,max});
export const runLength = (run:number) => ((run >>> 12) & 15) + 1;
export const materialOf = (run:number) => run >>> 16;

export interface CompactTerrainPart {
  readonly origin: HvpCell;
  readonly leafRevision: number;
  readonly label: number;
  /** Sorted positive-x spans. Offset occupies bits 0..11, length minus one 12..15, material 16..18. */
  readonly runs: readonly number[];
}

export interface Span {
  readonly x:number;
  readonly end:number;
  readonly y:number;
  readonly z:number;
  readonly material:number;
}
export function orderedSpans(parts: readonly CompactTerrainPart[]): Span[] {
  const spans:Span[]=[];
  for(const {origin:[ox,oy,oz],runs} of parts) {
    for(const run of runs) {
      const x=ox+(run&15);
      spans.push({x,end:x+runLength(run),y:oy+((run>>4)&15),z:oz+((run>>8)&15),material:materialOf(run)});
    }
  }
  return spans.sort((a,b)=>a.z-b.z || a.y-b.y || a.x-b.x);
}

/** Equivalent to the source oracle's lexicographic (x,y,z) seed and x/y/z growth.
 * HVP's four terrain materials share the same rigid-contact profile. */
export function exactShapes(spans: readonly Span[], count:number, bounds:Box): readonly Box[] | undefined {
  const {min,max}=bounds;
  if ((max[0]-min[0])*(max[1]-min[1])*(max[2]-min[2])===count) return Object.freeze([bounds]);
  type Interval = {start:number;end:number};
  const rows=new Map<number,Interval[]>();
  const rowKey=(y:number,z:number)=>y+z*512;
  for(const span of spans) {
    const key=rowKey(span.y,span.z);
    let row=rows.get(key);
    if(!row) { row=[];rows.set(key,row); }
    const previous=row.at(-1);
    if(previous?.end===span.x) previous.end=span.end;
    else row.push({start:span.x,end:span.end});
  }
  const contains=(x:number,end:number,y:number,z:number)=>
    rows.get(rowKey(y,z))?.some(i=>i.start<=x && end<=i.end)===true;
  const shapes:Box[]=[];
  while(rows.size) {
    if(shapes.length===64) return undefined;
    let x=Infinity,y=Infinity,z=Infinity,end=0;
    for(const [key,[first]] of rows) {
      const ry=key%512,rz=Math.floor(key/512);
      if(first.start<x || first.start===x && (ry<y || ry===y && rz<z)) {
        x=first.start;y=ry;z=rz;end=first.end;
      }
    }
    let yEnd=y+1,zEnd=z+1;
    while(contains(x,end,yEnd,z)) yEnd++;
    for(;;) {
      let ry=y;
      while(ry<yEnd && contains(x,end,ry,zEnd)) ry++;
      if(ry<yEnd) break;
      zEnd++;
    }
    for(let rz=z;rz<zEnd;rz++) for(let ry=y;ry<yEnd;ry++) {
      const key=rowKey(ry,rz),row=rows.get(key)!;
      const index=row.findIndex(i=>i.start<=x && end<=i.end);
      const old=row[index];
      const remainder:Interval[]=[];
      if(old.start<x) remainder.push({start:old.start,end:x});
      if(old.end>end) remainder.push({start:end,end:old.end});
      row.splice(index,1,...remainder);
      if(!row.length) rows.delete(key);
    }
    shapes.push(box(cell(x,y,z),cell(end,yEnd,zEnd)));
  }
  return Object.freeze(shapes.sort((a,b)=>a.min[2]-b.min[2] || a.min[1]-b.min[1] || a.min[0]-b.min[0]));
}
