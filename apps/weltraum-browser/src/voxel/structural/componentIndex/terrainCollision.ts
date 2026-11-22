import { hvpChunkCoordinates } from "../../../hestia-prototype/terrain/terrainChunkInput";
import type { HvpPreparedCut,HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import type { HvpCollisionSector } from "../../../hestia-prototype/physics/terrainColliders";
import { hvpQuadIndexPattern,type HvpAoFace } from "../../blockAmbientOcclusion";
import type { StructuralOwnedReserve } from "../validation";

const faces = [
  {axis:0,row:1,col:2,rowFirst:false}, {axis:0,row:1,col:2,rowFirst:true},
  {axis:1,row:0,col:2,rowFirst:true}, {axis:1,row:0,col:2,rowFirst:false},
  {axis:2,row:0,col:1,rowFirst:false}, {axis:2,row:0,col:1,rowFirst:true}
] as const;
const patterns=faces.map((_,i)=>hvpQuadIndexPattern(i as HvpAoFace,[3,3,3,3]));
const planesPerFace=33, planeCount=6*planesPerFace, maxFaces=50_000;
const inChunk=(x:number,y:number,z:number)=>x>=0&&y>=0&&z>=0&&x<32&&y<32&&z<32;
const bitRange=(col:number,width:number)=>(0xffffffff>>>(32-width))<<col;
const lowestBit=(bits:number)=>31-Math.clz32(bits&-bits);

interface PlaneEdit {
  readonly clear:Uint32Array;
  readonly add:Uint32Array;
  readonly rows:Uint32Array;
  readonly rectangles:number[];
}

/** The caller supplies its private, published chunk mesh for baseSource, with the same physical halo.
 * Streaming/halo replacement must build the regular full product. No geometry from another chunk,
 * render mesh, previous epoch or uncommitted stage can serve as the base of an incremental patch. */
export function* patchHvpChunkCollisionSteps(plan:HvpPreparedCut,id:number,baseSource:HvpTerrainSnapshot,
  previous:HvpCollisionSector,reserve:StructuralOwnedReserve):Generator<string,HvpCollisionSector,unknown> {
  const source=plan.after;
  if(plan.before!==baseSource || source.sessionId!==baseSource.sessionId || source.epoch!==baseSource.epoch ||
    source.baseDigest!==baseSource.baseDigest || source.revision!==baseSource.revision+Number(plan.changed.length>0) ||
    source.sizeX!==256 || source.sizeY!==128 || source.sizeZ!==256 || source.cellMeters!==.125 ||
    source.originMeters.x!==baseSource.originMeters.x || source.originMeters.y!==baseSource.originMeters.y ||
    source.originMeters.z!==baseSource.originMeters.z || plan.changed.length>512+32768) throw new Error("Stale or invalid collision delta");
  const [cx,cy,cz]=hvpChunkCoordinates(id),gx=cx*32,gy=cy*32,gz=cz*32;
  const origin=[source.originMeters.x+gx*.125,source.originMeters.y+gy*.125,source.originMeters.z+gz*.125];
  const {vertices:old,indices:oldIndices}=previous,oldCount=old.length/12;
  if(!Number.isInteger(oldCount) || oldIndices.length!==oldCount*6 || oldCount>maxFaces) throw new Error("Invalid prior collision quads");
  reserve(16_384);
  const edits=new Map<number,PlaneEdit>();
  function mark(face:number,x:number,y:number,z:number,add:boolean) {
    const {axis}=faces[face];
    const slice=(axis===0?x:axis===1?y:z)+(face&1);
    const row=axis===0?y:x,col=axis===2?y:z,key=face*planesPerFace+slice;
    let edit=edits.get(key);
    if(!edit) {
      reserve(1024);edit={clear:new Uint32Array(32),add:new Uint32Array(32),rows:new Uint32Array(32),rectangles:[]};edits.set(key,edit);
    }
    (add?edit.add:edit.clear)[row]|=1<<col;
  }

  // Every changed voxel was solid and becomes air. Only its own six faces and the opposite
  // faces owned by surviving face-neighbors can change. Corner and edge contact create no face.
  for(let i=0;i<plan.changed.length;i++){
    const change=plan.changed[i],[a,b,c]=change.cell,x=a-gx,y=b-gy,z=c-gz;
    if(change.after!==0 || !Number.isInteger(change.before) || change.before<1 || change.before>4) throw new Error("Invalid terrain removal");
    if(x>=-1 && x<=32 && y>=-1 && y<=32 && z>=-1 && z<=32) {
      const inside=inChunk(x,y,z);
      for(let face=0;face<6;face++){
        if(inside) mark(face,x,y,z,false);
        const axis=faces[face].axis,direction=face%2?1:-1;
        const dx=axis===0?direction:0,dy=axis===1?direction:0,dz=axis===2?direction:0;
        if(!inChunk(x+dx,y+dy,z+dz)) continue;
        const slot=source.readSlot(a+dx,b+dy,c+dz);
        if(slot===undefined) throw new Error("Unknown required chunk coverage");
        if(!Number.isInteger(slot)||slot<0||slot>4) throw new Error("Invalid collision material");
        if(slot!==0) mark(face^1,x+dx,y+dy,z+dz,true);
      }
    }
    if((i&63)===63) yield "collisionDeltaCells";
  }

  const first=new Int32Array(planeCount),counts=new Uint32Array(planeCount);
  let priorPlane=-1,unitFaces=0;
  for(let i=0;i<oldCount;i++){
    const v=i*12;
    // P0 is the canonical row/column minimum, P2 the opposite rectangle corner.
    const axis=old[v]===old[v+6]?0:old[v+1]===old[v+7]?1:2;
    const row=axis===0?1:0,col=axis===2?1:2;
    const rowFirst=old[v+3+row]!==old[v+row];
    const face=2*axis+Number(rowFirst!==faces[2*axis].rowFirst);
    const slice=(old[v+axis]-origin[axis])*8, r=(old[v+row]-origin[row])*8,c=(old[v+col]-origin[col])*8;
    const nr=(old[v+6+row]-old[v+row])*8,nc=(old[v+6+col]-old[v+col])*8;
    if(!Number.isInteger(slice)||slice<0||slice>32||!Number.isInteger(r)||!Number.isInteger(c)||
      !Number.isInteger(nr)||!Number.isInteger(nc)||r<0||c<0||nr<=0||nc<=0||r+nr>32||c+nc>32) {
      throw new Error("Invalid prior canonical collision plane");
    }
    const key=face*planesPerFace+slice,edit=edits.get(key);
    if(key<priorPlane) throw new Error("Invalid prior collision plane order");
    priorPlane=key;
    if(counts[key]===0) first[key]=i;
    counts[key]++;
    if(edit){
      const mask=bitRange(c,nc);
      for(let j=r;j<r+nr;j++) edit.rows[j]|=mask;
    } else unitFaces+=nr*nc;
    if((i&127)===127) yield "collisionPreviousPlanes";
  }

  // The greedy partition is independent for each face/slice. The first set bit selects
  // the same minimum column; consume its consecutive columns before extending across rows.
  let count=oldCount;
  for(const [key,edit] of edits){
    const {rows,add,clear,rectangles}=edit;
    for(let r=0;r<32;r++) rows[r]=(rows[r]&~clear[r])|add[r];
    for(let r=0;r<32;r++){
      while(rows[r]!==0){
        const c=lowestBit(rows[r]),shifted=rows[r]>>>c,followingZero=(~shifted)>>>0;
        const nc=followingZero===0?32:lowestBit(followingZero),mask=bitRange(c,nc)>>>0;
        let end=r+1;
        while(end<32 && ((rows[end]&mask)>>>0)===mask) end++;
        for(let j=r;j<end;j++)rows[j]&=~mask;
        unitFaces+=(end-r)*nc;
        reserve(32);
        rectangles.push(r|(c<<5)|((end-r-1)<<10)|((nc-1)<<15));
      }
    }
    count+=rectangles.length-counts[key];
    yield "collisionGreedyPlane";
  }
  if(unitFaces>maxFaces || count>maxFaces) throw new Error("Collision BudgetExceeded");
  reserve(8192+count*72,true);
  const vertices=new Float32Array(count*12),indices=new Uint32Array(count*6);
  let output=0;
  for(let key=0;key<planeCount;key++){
    const face=Math.floor(key/planesPerFace),edit=edits.get(key),start=output;
    if(!edit){
      // Indices reference the newly packed vertex stream, whose offsets can change after a cut.
      for(let from=first[key],left=counts[key];left>0;){
        const batch=Math.min(128,left);
        vertices.set(old.subarray(from*12,(from+batch)*12),output*12);
        from+=batch;output+=batch;left-=batch;
        if(left)yield "collisionCopyPlane";
      }
    }else{
      const {axis,row,col,rowFirst}=faces[face],plane=origin[axis]+(key%planesPerFace)*.125;
      for(const rect of edit.rectangles){
        const r=rect&31,c=(rect>>>5)&31,rowStart=origin[row]+r*.125,colStart=origin[col]+c*.125;
        const rowEnd=rowStart+(((rect>>>10)&31)+1)*.125,colEnd=colStart+((rect>>>15)+1)*.125;
        const v=output++*12;
        vertices[v+axis]=vertices[v+3+axis]=vertices[v+6+axis]=vertices[v+9+axis]=plane;
        vertices[v+row]=rowStart;vertices[v+col]=colStart;vertices[v+6+row]=rowEnd;vertices[v+6+col]=colEnd;
        vertices[v+3+row]=rowFirst?rowEnd:rowStart;vertices[v+3+col]=rowFirst?colStart:colEnd;
        vertices[v+9+row]=rowFirst?rowStart:rowEnd;vertices[v+9+col]=rowFirst?colEnd:colStart;
        if((output&127)===0) yield "collisionPackPlane";
      }
    }
    const pattern=patterns[face];
    for(let i=start;i<output;i++){
      for(let corner=0;corner<6;corner++) indices[6*i+corner]=4*i+pattern[corner];
      if((i&255)===255)yield "collisionPackTriangles";
    }
  }
  return {vertices,indices};
}
