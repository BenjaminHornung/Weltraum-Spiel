import { hvpChunkCoordinates } from "../../../hestia-prototype/terrain/terrainChunkInput";
import type { HvpPreparedCut, HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import type { HvpCollisionSector } from "../../../hestia-prototype/physics/terrainColliders";
import { hvpQuadIndexPattern, type HvpAoFace } from "../../blockAmbientOcclusion";
import type { StructuralOwnedReserve } from "../validation";

const faces = [
  {axis:0,row:1,col:2,rowFirst:false}, {axis:0,row:1,col:2,rowFirst:true},
  {axis:1,row:0,col:2,rowFirst:true}, {axis:1,row:0,col:2,rowFirst:false},
  {axis:2,row:0,col:1,rowFirst:false}, {axis:2,row:0,col:1,rowFirst:true}
] as const;
const patterns = faces.map((_,i)=>hvpQuadIndexPattern(i as HvpAoFace,[3,3,3,3]));
const planesPerFace=33, planeCount=6*planesPerFace, maxFaces=50_000;
const inChunk=(x:number,y:number,z:number)=>x>=0&&y>=0&&z>=0&&x<32&&y<32&&z<32;
const bitRange=(col:number,width:number)=>(0xffffffff>>>(32-width))<<col;
const lowestBit=(bits:number)=>31-Math.clz32(bits&-bits);
const planeBytes = 32*4+80;
const directoryBytes = (planeCount+1)*4 + planeCount*8 + 384;
type FacePlane = Uint32Array | undefined;

/** Private to a compiler's ChunkCache. Its source, physical halo and world binding are
 * promoted together with the private mesh. Arrays and masks are immutable after publication. */
export interface HvpChunkCollisionIndex {
  readonly id:number;
  readonly mesh:HvpCollisionSector;
  readonly origin:readonly number[];
  readonly slots?:Uint32Array;
  readonly planes:readonly FacePlane[];
  readonly offsets:Uint32Array;
  readonly unitFaces:number;
  readonly bytes:number;
}

/** Pack the core of the exact admitted worker input, before the sender transfers its buffer.
 * Exterior faces (including unknown coverage) come from the accepted native mesh below. */
export function* hvpChunkOccupancySteps(slots:Uint8Array,reserve:StructuralOwnedReserve):Generator<string,Uint32Array,unknown> {
  if(slots.length!==34**3) throw new Error("Incomplete chunk occupancy");
  reserve(4096+80);
  const bits=new Uint32Array(1024);
  for(let z=0;z<32;z++) {
    for(let y=0;y<32;y++) {
      let row=0;
      const start=(z+1)*34*34+(y+1)*34+1;
      for(let x=0;x<32;x++) if(slots[start+x]!==0) row|=1<<x;
      bits[z*32+y]=row;
    }
    yield "collisionOccupancy";
  }
  return bits;
}

export function* buildHvpChunkCollisionIndexSteps(source:HvpTerrainSnapshot,id:number,previous:HvpCollisionSector,
  slots:Uint32Array|undefined,reserve:StructuralOwnedReserve):Generator<string,HvpChunkCollisionIndex,unknown> {
  const [cx,cy,cz]=hvpChunkCoordinates(id);
  const origin=[source.originMeters.x+cx*4,source.originMeters.y+cy*4,source.originMeters.z+cz*4];
  const old=previous.vertices, count=old.length/12;
  if(!Number.isInteger(count)||previous.indices.length!==count*6||count>maxFaces||slots&&slots.length!==1024)
    throw new Error("Invalid prior collision quads");
  reserve(directoryBytes);
  const offsets=new Uint32Array(planeCount+1), planes:FacePlane[]=new Array(planeCount);
  let last=-1, unitFaces=0,bytes=directoryBytes+(slots?slots.byteLength+80:0);
  for(let i=0;i<count;i++) {
    const v=i*12;
    const axis=old[v]===old[v+6]?0:old[v+1]===old[v+7]?1:2;
    const row=axis===0?1:0,col=axis===2?1:2;
    const face=2*axis+Number((old[v+3+row]!==old[v+row])!==faces[2*axis].rowFirst);
    const slice=(old[v+axis]-origin[axis])*8,r=(old[v+row]-origin[row])*8,c=(old[v+col]-origin[col])*8;
    const nr=(old[v+6+row]-old[v+row])*8,nc=(old[v+6+col]-old[v+col])*8;
    if(!Number.isInteger(slice)||slice<0||slice>32||!Number.isInteger(r)||!Number.isInteger(c)||
      !Number.isInteger(nr)||!Number.isInteger(nc)||r<0||c<0||nr<=0||nc<=0||r+nr>32||c+nc>32)
      throw new Error("Invalid prior canonical collision plane");
    const key=face*planesPerFace+slice;
    if(key<last) throw new Error("Invalid prior collision plane order");
    last=key;
    let rows=planes[key];
    if(!rows){reserve(planeBytes); rows=planes[key]=new Uint32Array(32); bytes+=planeBytes;}
    const mask=bitRange(c,nc);
    for(let j=r;j<r+nr;j++) rows[j]|=mask;
    offsets[key+1]++;
    unitFaces+=nr*nc;
    if((i&127)===127) yield "collisionPreviousPlanes";
  }
  for(let key=0;key<planeCount;key++) offsets[key+1]+=offsets[key];
  return {id,mesh:previous,origin,planes,offsets,unitFaces,slots,bytes};
}

function packedRectangles(rows:Uint32Array,scratch:Uint32Array,reserve:StructuralOwnedReserve) {
  const rectangles:number[]=[];
  scratch.set(rows);
  for(let r=0;r<32;r++) {
    while(scratch[r]!==0) {
      const c=lowestBit(scratch[r]),followingZero=~(scratch[r]>>>c);
      const nc=followingZero===0?32:lowestBit(followingZero),mask=bitRange(c,nc)>>>0;
      let end=r+1;
      while(end<32&&((scratch[end]&mask)>>>0)===mask) end++;
      for(let j=r;j<end;j++) scratch[j]&=~mask;
      reserve(32);
      rectangles.push(r|(c<<5)|((end-r-1)<<10)|((nc-1)<<15));
    }
  }
  return rectangles;
}

export function* patchIndexedHvpChunkCollisionSteps(plan:HvpPreparedCut,id:number,baseSource:HvpTerrainSnapshot,
  previous:HvpCollisionSector,index:HvpChunkCollisionIndex,reserve:StructuralOwnedReserve):
  Generator<string,{mesh:HvpCollisionSector;index:HvpChunkCollisionIndex},unknown> {
  const source=plan.after;
  if(plan.before!==baseSource||source.sessionId!==baseSource.sessionId||source.epoch!==baseSource.epoch||
    source.baseDigest!==baseSource.baseDigest||source.revision!==baseSource.revision+Number(plan.changed.length>0)||
    source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256||source.cellMeters!==.125||
    source.originMeters.x!==baseSource.originMeters.x||source.originMeters.y!==baseSource.originMeters.y||
    source.originMeters.z!==baseSource.originMeters.z||plan.changed.length>512+32768||index.id!==id||index.mesh!==previous||
    previous.vertices.length!==index.offsets[planeCount]*12||previous.indices.length!==index.offsets[planeCount]*6)
    throw new Error("Stale or invalid collision delta");
  const [cx,cy,cz]=hvpChunkCoordinates(id),gx=cx*32,gy=cy*32,gz=cz*32;
  const origin=index.origin;
  if(origin[0]!==source.originMeters.x+gx*.125||origin[1]!==source.originMeters.y+gy*.125||origin[2]!==source.originMeters.z+gz*.125)
    throw new Error("Foreign collision chunk origin");
  reserve(directoryBytes+2048);
  let slots=index.slots, unitFaces=index.unitFaces, bytes=index.bytes;
  if(slots) {
    for(let i=0;i<plan.changed.length;i++) {
      const {cell:[a,b,c],after,before}=plan.changed[i], x=a-gx,y=b-gy,z=c-gz;
      if(after!==0||!Number.isInteger(before)||before<1||before>4) throw new Error("Invalid terrain removal");
      if(inChunk(x,y,z)) {
        if(slots===index.slots) {reserve(slots.byteLength+80);slots=slots.slice();}
        const line=z*32+y,mask=1<<x;
        if(!(slots[line]&mask)) throw new Error("Collision occupancy disagrees with source removal");
        slots[line]&=~mask;
      }
      if((i&255)===255) yield "collisionClearOccupancy";
    }
  }
  const edits=new Map<number,Uint32Array>(), planes=index.planes.slice();
  function mark(face:number,x:number,y:number,z:number,add:boolean) {
    const axis=faces[face].axis,slice=(axis===0?x:axis===1?y:z)+(face&1);
    const row=axis===0?y:x,col=axis===2?y:z,key=face*planesPerFace+slice;
    const sourceRows=planes[key], mask=1<<col;
    if(Boolean((sourceRows?.[row]??0)&mask)===add) return;
    let rows=edits.get(key);
    if(!rows){
      reserve(planeBytes);
      rows=sourceRows?sourceRows.slice():new Uint32Array(32);
      if(!sourceRows) bytes+=planeBytes;
      edits.set(key,rows);planes[key]=rows;
    }
    if(add){rows[row]|=mask;unitFaces++;}else{rows[row]&=~mask;unitFaces--;}
  }
  for(let i=0;i<plan.changed.length;i++) {
    const change=plan.changed[i],[a,b,c]=change.cell,x=a-gx,y=b-gy,z=c-gz;
    if(!slots&&(change.after!==0||!Number.isInteger(change.before)||change.before<1||change.before>4)) throw new Error("Invalid terrain removal");
    if(x>=-1&&x<=32&&y>=-1&&y<=32&&z>=-1&&z<=32) {
      const inside=inChunk(x,y,z);
      for(let face=0;face<6;face++) {
        if(inside) mark(face,x,y,z,false);
        const axis=faces[face].axis,dir=face%2?1:-1;
        const nx=x+(axis===0?dir:0),ny=y+(axis===1?dir:0),nz=z+(axis===2?dir:0);
        if(!inChunk(nx,ny,nz)) continue;
        if(slots) {
          if(slots[nz*32+ny]&(1<<nx)) mark(face^1,nx,ny,nz,true);
        }else{
          const slot=source.readSlot(gx+nx,gy+ny,gz+nz);
          if(slot===undefined) throw new Error("Unknown required chunk coverage");
          if(!Number.isInteger(slot)||slot<0||slot>4) throw new Error("Invalid collision material");
          if(slot!==0) mark(face^1,nx,ny,nz,true);
        }
      }
    }
    if((i&63)===63) yield "collisionDeltaCells";
  }
  if(unitFaces<0||unitFaces>maxFaces) throw new Error("Collision BudgetExceeded");
  const rectangles=new Map<number,number[]>(),scratch=new Uint32Array(32);
  for(const [key,rows] of edits){
    const packed=packedRectangles(rows,scratch,reserve);
    if(packed.length===0){planes[key]=undefined;bytes-=planeBytes;}
    rectangles.set(key,packed);
    yield "collisionGreedyPlane";
  }
  const prior=index.offsets, offsets=new Uint32Array(planeCount+1);
  for(let key=0;key<planeCount;key++) offsets[key+1]=offsets[key]+(rectangles.get(key)?.length??(prior[key+1]-prior[key]));
  const count=offsets[planeCount];
  if(count>maxFaces) throw new Error("Collision BudgetExceeded");
  reserve(8192+count*72,true);
  const vertices=new Float32Array(count*12),indices=new Uint32Array(count*6);
  for(let key=0;key<planeCount;key++){
    const face=Math.floor(key/planesPerFace), edit=rectangles.get(key),start=offsets[key],end=offsets[key+1];
    if(start===end) continue;
    if(!edit){
      for(let out=start;out<end;out+=128){
        const from=prior[key]+out-start, batch=Math.min(128,end-out);
        vertices.set(previous.vertices.subarray(from*12,(from+batch)*12),out*12);
        if(out+batch<end) yield "collisionCopyPlane";
      }
    }else{
      const {axis,row,col,rowFirst}=faces[face],plane=origin[axis]+(key%planesPerFace)*.125;
      let output=start;
      for(const rect of edit){
        const r=rect&31,c=(rect>>>5)&31,rowStart=origin[row]+r*.125,colStart=origin[col]+c*.125;
        const rowEnd=rowStart+(((rect>>>10)&31)+1)*.125,colEnd=colStart+((rect>>>15)+1)*.125;
        const v=output++*12;
        vertices[v+axis]=vertices[v+3+axis]=vertices[v+6+axis]=vertices[v+9+axis]=plane;
        vertices[v+row]=rowStart;vertices[v+col]=colStart;vertices[v+6+row]=rowEnd;vertices[v+6+col]=colEnd;
        vertices[v+3+row]=rowFirst?rowEnd:rowStart;vertices[v+3+col]=rowFirst?colStart:colEnd;
        vertices[v+9+row]=rowFirst?rowStart:rowEnd;vertices[v+9+col]=rowFirst?colEnd:colStart;
        if((output&127)===0)yield "collisionPackPlane";
      }
    }
    const pattern=patterns[face];
    for(let i=start;i<end;i++){
      for(let corner=0;corner<6;corner++)indices[6*i+corner]=4*i+pattern[corner];
      if((i&255)===255) yield "collisionPackTriangles";
    }
  }
  const mesh={vertices,indices};
  return {mesh,index:{id,mesh,origin,planes,offsets,unitFaces,slots,bytes}};
}

/** One-off, uncached path for clients that supply only an already-published mesh. */
export function* patchHvpChunkCollisionSteps(plan:HvpPreparedCut,id:number,baseSource:HvpTerrainSnapshot,
  previous:HvpCollisionSector,reserve:StructuralOwnedReserve):Generator<string,HvpCollisionSector,unknown>{
  const index=yield* buildHvpChunkCollisionIndexSteps(baseSource,id,previous,undefined,reserve);
  return (yield* patchIndexedHvpChunkCollisionSteps(plan,id,baseSource,previous,index,reserve)).mesh;
}

/** Structural work limits, independent of wall clock or observed fixture identity.
 * Outside this envelope the exact same generator yields to the bounded task pump. */
export function canPatchHvpCollisionInOneTask(plan:HvpPreparedCut,dirty:readonly number[],
  indices:ReadonlyMap<number,HvpChunkCollisionIndex>):boolean {
  if(plan.changed.length>512 || dirty.length>4 || dirty.length*plan.changed.length>2048) return false;
  let quads=0;
  for(const id of dirty){
    const index=indices.get(id);
    if(!index?.slots) return false;
    quads+=index.offsets[planeCount];
  }
  if(quads>1024)return false;
  let x0=256,y0=128,z0=256,x1=-1,y1=-1,z1=-1;
  for(const {cell:[x,y,z]} of plan.changed){
    x0=Math.min(x0,x);y0=Math.min(y0,y);z0=Math.min(z0,z);
    x1=Math.max(x1,x);y1=Math.max(y1,y);z1=Math.max(z1,z);
  }
  return x1-x0+y1-y0+z1-z0<=64;
}
