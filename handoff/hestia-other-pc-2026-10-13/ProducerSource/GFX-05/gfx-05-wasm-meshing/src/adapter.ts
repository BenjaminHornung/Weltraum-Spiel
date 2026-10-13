import {meshHvpOccupancy, type HvpCompactMesh} from "../oracle/hvp/hvpCoastMesher";
import {meshCollisionInput} from "../oracle/hestia-prototype/physics/terrainColliders";
import {validateHvpChunkPayload,validateHvpChunkBuffers} from "./chunkPayloadPort";
import type {HvpChunkPayload} from "../oracle/hestia-prototype/terrain/terrainChunkInput";
import {hvpQuadIndexPattern,type HvpAoFace,type HvpAoQuad} from "../oracle/voxel/blockAmbientOcclusion";

export type Purpose="render"|"collision"|"render-and-collision";
export interface Input {
  slots:Uint8Array; cellMeters:number; origin:readonly number[]; sourceDigest:string; generation:number;
  purpose:Purpose; coverage:"KNOWN"; physicalHalo:"closed-exterior"|"east"|"west"; coreOrigin:readonly number[];
  manifest:HvpChunkPayload;
}
export interface Products {render:HvpCompactMesh|null;collision:{vertices:Float32Array;indices:Uint32Array}|null}
type Exports={memory:WebAssembly.Memory;input_ptr():number;run(cell:number,x:number,y:number,z:number,ao:number,limit:number):number;
  count(c:number):number;pointer(c:number):number;release():void};
export const byteLength=(p:Products)=>[p.render?.positions,p.render?.normals,p.render?.colors,p.render?.indices,p.collision?.vertices,p.collision?.indices]
  .reduce((n,a)=>n+(a?.byteLength??0),0)+(p.render?.materialRanges.length??0)*12;
export function validateInput(p:Input):void {
  if(!(p.slots instanceof Uint8Array)||p.slots.length!==34**3||(typeof SharedArrayBuffer!=="undefined"&&p.slots.buffer instanceof SharedArrayBuffer)||p.coverage!=="KNOWN"
    ||p.slots.some(v=>v>4)||![.125,.25,.5].includes(p.cellMeters)||!["render","collision","render-and-collision"].includes(p.purpose)
    ||!["closed-exterior","east","west"].includes(p.physicalHalo)||p.origin.length!==3||p.origin.some(v=>!Number.isFinite(v)||!Number.isSafeInteger(v*8))
    ||p.coreOrigin.length!==3||p.coreOrigin.some(v=>!Number.isSafeInteger(v)||v%32!==0)
    ||!Number.isSafeInteger(p.generation)||p.generation<0||!/^[-A-Za-z0-9:._]{1,128}$/.test(p.sourceDigest)){
    throw new Error("Invalid known chunk ABI");
  }
  validateHvpChunkBuffers([p.slots.buffer as ArrayBuffer]);
  const m=validateHvpChunkPayload(p.manifest);
  if(m.generation!==p.generation||m.sourceDigest!==p.sourceDigest||m.physicalHalo!==p.physicalHalo
    ||m.coreOrigin.some((v,i)=>v!==p.coreOrigin[i])||[m.originMeters.x,m.originMeters.y,m.originMeters.z].some((v,i)=>v!==p.origin[i]))
    throw new Error("Invalid chunk manifest/input identity");
}
export function physicalSlots(p:Input):Uint8Array {
  const out=new Uint8Array(34**3),[ox,oy,oz]=p.coreOrigin;
  for(let i=0;i<out.length;i++){
    const x=ox+i%34-1,y=oy+Math.floor(i/34)%34-1,z=oz+Math.floor(i/(34*34))-1;
    const inside=x>=0&&x<256&&y>=0&&y<128&&z>=0&&z<256;
    const neighbor=y>=0&&y<128&&z>=0&&z<256&&(p.physicalHalo==="east"?x>=256&&x<512:p.physicalHalo==="west"?x<0&&x>=-256:false);
    out[i]=Number(p.slots[i]!==0&&(inside||neighbor));
  }
  return out;
}
const budgets={maxVisitedCells:32768,maxQuads:50000,maxVertices:200000,maxIndices:300000};
const occupancy=(p:Input,slots=p.slots,cell=p.cellMeters)=>{
  const slotAt=(x:number,y:number,z:number)=>slots[x+1+(y+1)*34+(z+1)*34*34];
  return {sizeX:32,sizeY:32,sizeZ:32,cellMeters:cell,originMeters:{x:p.origin[0],y:p.origin[1],z:p.origin[2]},slotAt,ghostSlotAt:slotAt};
};
export const tsProducts=(p:Input):Products=>{
  validateInput(p);
  return {render:p.purpose==="collision"?null:meshHvpOccupancy(occupancy(p),budgets,p.sourceDigest,"hvp-terrain-chunk-v1",{ao:true}),
    collision:p.purpose==="render"?null:meshCollisionInput({...occupancy(p),slots:physicalSlots(p)})};
};
export async function sha256(bytes:Uint8Array):Promise<string>{
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,"0")).join("");
}
const metadata=(p:Input):string=>{
  const m=p.manifest,n=m.haloNeighbor;
  return JSON.stringify([p.sourceDigest,p.generation,p.purpose,p.cellMeters,p.origin,p.physicalHalo,p.coreOrigin,p.coverage,
    m.worldId,m.sessionId,m.epoch,m.baseDigest,m.materialDigest,m.renderVersion,m.collisionVersion,m.chunk,m.sizeX,m.sizeY,m.sizeZ,m.haloWidth,
    [m.sourceOrigin.x,m.sourceOrigin.y,m.sourceOrigin.z],m.haloBinding,n===null?null:[n.sessionId,n.epoch,n.generation,n.sourceDigest,n.baseDigest,[n.originMeters.x,n.originMeters.y,n.originMeters.z]]]);
};
export async function identity(p:Input):Promise<string>{
  const meta=new TextEncoder().encode(metadata(p));
  const bytes=new Uint8Array(meta.length+p.slots.length);bytes.set(meta);bytes.set(p.slots,meta.length);return sha256(bytes);
}
// Independent naive surface expansion: no TS greedy/AO helper or Rust output oracle.
export function validateCoverage(p:Input,mesh:HvpCompactMesh,slots=p.slots,cell=p.cellMeters,ao=true):void {
  const pos=mesh.positions,norm=mesh.normals,indices=mesh.indices,col=mesh.colors;
  if(!(pos instanceof Float32Array)||!(norm instanceof Float32Array)||(ao&&!(col instanceof Float32Array))
    ||!(pos.length/3>65535?indices instanceof Uint32Array:indices instanceof Uint16Array)
    ||!Number.isInteger(mesh.faceCount)||mesh.faceCount<0||mesh.faceCount>50000||pos.length!==mesh.faceCount*12||norm.length!==pos.length
    ||indices.length!==mesh.faceCount*6||pos.some(v=>!Number.isFinite(v))||norm.some(v=>![-1,0,1].includes(v))
    ||indices.some(i=>i>=pos.length/3)||(ao?col===null||col.length!==pos.length:col!==null)
    ||mesh.outerFaceCount!==mesh.faceCount||mesh.cavityFaceCount!==0
    ||mesh.tempEstimateBytes!==mesh.unitFaceCount*8+mesh.faceCount*96+(pos.length+norm.length+indices.length+(col?.length??0))*8){throw new Error("Invalid output channels");}
  const at=(v:number[])=>slots[v[0]+1+(v[1]+1)*34+(v[2]+1)*34*34];
  const normals=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
  const expected=new Set<string>();
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const v=[x,y,z],s=at(v);if(!s)continue;
    normals.forEach((n,f)=>{if(!at(v.map((a,i)=>a+n[i])))expected.add(`${f}:${x},${y},${z}:${s}`);});
  }
  const actual=new Set<string>();let range=0;
  if(mesh.materialRanges.length===0&&mesh.faceCount!==0)throw new Error("Missing materials");
  let cursor=0;
  for(const r of mesh.materialRanges){
    if(!Number.isInteger(r.slot)||r.slot<1||r.slot>4||r.startIndex!==cursor||r.indexCount<=0||r.indexCount%6!==0)throw new Error("Invalid material ranges");
    cursor+=r.indexCount;
  }
  if(cursor!==indices.length)throw new Error("Incomplete material ranges");
  const bounds=[0,0,0,0,0,0];
  for(let q=0;q<mesh.faceCount;q++){
    const levels=[3,3,3,3];
    const base=q*12,n=Array.from(norm.slice(base,base+3)),f=normals.findIndex(v=>v.every((a,i)=>a===n[i]));
    if(f<0)throw new Error("Invalid normal");
    const axis=n.findIndex(v=>v!==0),delta=n[axis],others=[0,1,2].filter(v=>v!==axis);
    const corners=Array.from({length:4},(_,c)=>[0,1,2].map(a=>(pos[base+c*3+a]-p.origin[a])/cell));
    if(corners.some(v=>v.some(a=>!Number.isInteger(a)||a<0||a>32))||corners.some(v=>v[axis]!==corners[0][axis]))throw new Error("Off-grid output");
    const [row,cl]=others,rmin=Math.min(...corners.map(v=>v[row])),rmax=Math.max(...corners.map(v=>v[row]));
    const cmin=Math.min(...corners.map(v=>v[cl])),cmax=Math.max(...corners.map(v=>v[cl]));
    if(rmax<=rmin||cmax<=cmin)throw new Error("Degenerate quad");
    const cornerKeys=corners.map(v=>`${v[row]},${v[cl]}`);
    if(new Set(cornerKeys).size!==4||corners.some(v=>![rmin,rmax].includes(v[row])||![cmin,cmax].includes(v[cl])))throw new Error("Invalid quad triangulation corners");
    while(mesh.materialRanges[range].startIndex+mesh.materialRanges[range].indexCount<=q*6)range++;
    const material=mesh.materialRanges[range].slot;
    for(let r=rmin;r<rmax;r++)for(let c=cmin;c<cmax;c++){
      const owner=[0,0,0];owner[axis]=corners[0][axis]-(delta>0?1:0);owner[row]=r;owner[cl]=c;
      const key=`${f}:${owner.join(",")}:${material}`;
      if(actual.has(key)||!expected.has(key))throw new Error("Duplicate or invented surface");actual.add(key);
      if(ao)for(let ci=0;ci<4;ci++){
        const air=owner.map((v,a)=>v+n[a]),s1=corners[ci][row]===rmin?-1:1,s2=corners[ci][cl]===cmin?-1:1;
        const a=[...air],b=[...air],d=[...air];a[row]+=s1;b[cl]+=s2;d[row]+=s1;d[cl]+=s2;
        const one=!!at(a),two=!!at(b),diagonal=!!at(d),level=one&&two?0:3-Number(one)-Number(two)-Number(diagonal);
        levels[ci]=level;
        const value=Math.fround(1-(.6*(3-level))/3);
        if([0,1,2].some(k=>col![base+ci*3+k]!==value))throw new Error("AO coverage mismatch");
      }
    }
    for(let t=0;t<2;t++){
      const vertices=Array.from(indices.slice(q*6+t*3,q*6+t*3+3),i=>Array.from(pos.slice(i*3,i*3+3)));
      if(indices.slice(q*6+t*3,q*6+t*3+3).some(i=>i<q*4||i>=q*4+4))throw new Error("Cross-quad triangle");
      const a=vertices[1].map((v,i)=>v-vertices[0][i]),b=vertices[2].map((v,i)=>v-vertices[0][i]);
      const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      if(cross.reduce((s,v,i)=>s+v*n[i],0)<=0)throw new Error("Inward triangle");
    }
    const first=Array.from(indices.slice(q*6,q*6+3)),second=Array.from(indices.slice(q*6+3,q*6+6));
    const shared=first.filter(i=>second.includes(i));
    if(new Set([...first,...second]).size!==4||shared.length!==2)throw new Error("Missing triangle coverage");
    const diagonal=shared.map(i=>corners[i-q*4]);
    if(diagonal[0][row]===diagonal[1][row]||diagonal[0][cl]===diagonal[1][cl])throw new Error("Invalid quad triangulation diagonal");
    const pattern=hvpQuadIndexPattern(f as HvpAoFace,levels as unknown as HvpAoQuad);
    if(pattern.some((v,i)=>indices[q*6+i]!==q*4+v))throw new Error("Noncanonical AO triangulation");
    for(let c=0;c<4;c++)for(let a=0;a<3;a++){const v=pos[base+c*3+a];if(q===0&&c===0){bounds[a]=v;bounds[a+3]=v;}else{bounds[a]=Math.min(bounds[a],v);bounds[a+3]=Math.max(bounds[a+3],v);}}
  }
  if(actual.size!==expected.size||mesh.unitFaceCount!==expected.size)throw new Error("Missing surface coverage");
  const mb=mesh.boundsMeters;
  if([mb.min.x,mb.min.y,mb.min.z,mb.max.x,mb.max.y,mb.max.z].some((v,i)=>v!==bounds[i]))throw new Error("Invalid bounds");
}
export function validateProducts(p:Input,out:Products):void {
  if((p.purpose!=="collision")!==(out.render!==null)||(p.purpose!=="render")!==(out.collision!==null))throw new Error("Wrong purpose product");
  if(out.render){if(out.render.sourceDigest!==p.sourceDigest||out.render.algorithmVersion!=="hvp-terrain-chunk-v1")throw new Error("Stale render identity");validateCoverage(p,out.render);}
  if(out.collision){
    const c=out.collision;
    if(!(c.vertices instanceof Float32Array)||!(c.indices instanceof Uint32Array))throw new Error("Invalid collision channel type");
    // Existing collision output omits normals/material metadata; recover only for this independent validator.
    const reference=meshHvpOccupancy(occupancy(p,physicalSlots(p),.125),budgets,p.sourceDigest,"collision");
    if(c.vertices.length!==reference.positions.length||c.indices.length!==reference.indices.length
      ||c.vertices.some((v,i)=>v!==reference.positions[i])||c.indices.some((v,i)=>v!==reference.indices[i]))throw new Error("Collision purpose mismatch");
  }
}
export interface Candidate {binding:string;generation:number;epoch:number;instanceId:string;purpose:Purpose;products:Products;costs:Record<string,number>;memory:Record<string,number>}
export interface AdmissionContext {instanceId:string;epoch:number}
export async function admitCandidate(candidate:Candidate,current:Input,context:()=>AdmissionContext|null):Promise<Products>{
  const start=performance.now();
  if(candidate.generation!==current.generation||candidate.purpose!==current.purpose)throw new Error("Stale output or wrong purpose");
  validateInput(current);
  const snapshot:Input=structuredClone(current),binding=await identity(snapshot),owner=context();
  if(!owner||candidate.epoch!==owner.epoch||candidate.instanceId!==owner.instanceId||candidate.binding!==binding
    ||candidate.generation!==current.generation||candidate.purpose!==current.purpose
    ||metadata(snapshot)!==metadata(current)
    ||snapshot.slots.some((v,i)=>v!==current.slots[i]))throw new Error("Stale output or wrong purpose");
  validateProducts(current,candidate.products);
  candidate.costs.adoption=performance.now()-start;candidate.costs.total+=candidate.costs.adoption;
  return candidate.products;
}
export class ScalarMesher {
  private exports:Exports|null;
  private busy=false;
  private epoch=0;
  private adoptedBytes=0;
  private adopted:Products|null=null;
  readonly initMs:number;
  private readonly instanceId=crypto.randomUUID();
  private constructor(e:Exports,ms:number){this.exports=e;this.initMs=ms;}
  static async create(bytes:Uint8Array,expectedSha:string):Promise<ScalarMesher>{
    const start=performance.now();
    if(await sha256(bytes)!==expectedSha)throw new Error("WASM digest mismatch");
    const {instance}=await WebAssembly.instantiate(bytes as Uint8Array<ArrayBuffer>);
    return new ScalarMesher(instance.exports as unknown as Exports,performance.now()-start);
  }
  invalidate():void {this.epoch++;}
  dispose():void {this.invalidate();this.exports?.release();this.exports=null;this.adopted=null;this.adoptedBytes=0;}
  memoryBytes():number{return this.exports?.memory.buffer.byteLength??0;}
  admissionContext():AdmissionContext|null{return this.exports?{instanceId:this.instanceId,epoch:this.epoch}:null;}
  async run(input:Input,signal?:AbortSignal,outputByteLimit=16*1024*1024):Promise<Candidate>{
    if(!this.exports)throw new Error("Disposed");if(this.busy)throw new Error("Invocation already active");
    this.busy=true;const epoch=this.epoch,start=performance.now(),e=this.exports;
    const costs:Record<string,number>={inputValidation:0,inputCopy:0,kernelCall:0,outputCopy:0,outputValidation:0,adoption:0,total:0};
    const check=()=>{if(signal?.aborted||epoch!==this.epoch||!this.exports)throw new Error("Cancelled or stale generation");};
    try{
      validateInput(input);check();
      if(!Number.isSafeInteger(outputByteLimit)||outputByteLimit<0||outputByteLimit>16*1024*1024)throw new Error("Invalid allocation limit");
      let t=performance.now();
      const p:Input=structuredClone(input);
      costs.inputCopy+=performance.now()-t;
      const binding=await identity(p);costs.inputValidation=performance.now()-start-costs.inputCopy;check();
      const outputs:Products={render:null,collision:null};
      const execute=(slots:Uint8Array,cell:number,ao:boolean)=>{
        t=performance.now();const inputPointer=e.input_ptr();new Uint8Array(e.memory.buffer,inputPointer,34**3).set(slots);costs.inputCopy+=performance.now()-t;
        t=performance.now();const status=e.run(cell,...p.origin as [number,number,number],Number(ao),outputByteLimit);costs.kernelCall+=performance.now()-t;
        if(status)throw new Error(status===1?"Invalid WASM ABI":status===2?"BudgetExceeded":"Allocation failed");
        t=performance.now();
        // Calls can grow the heap. Create fresh views here and return only owned copies.
        const f=(c:number)=>new Float32Array(e.memory.buffer,e.pointer(c),e.count(c)).slice();
        const positions=f(0),normals=f(1),colors=ao?f(3):null;
        const indices=e.count(8)===4?new Uint32Array(e.memory.buffer,e.pointer(2),e.count(2)).slice():new Uint16Array(e.memory.buffer,e.pointer(2),e.count(2)).slice();
        const ranges=new Uint32Array(e.memory.buffer,e.pointer(4),e.count(4)).slice(),bounds=new Float64Array(e.memory.buffer,e.pointer(5),6).slice();
        const materialRanges=Array.from({length:ranges.length/3},(_,i)=>Object.freeze({slot:ranges[i*3],startIndex:ranges[i*3+1],indexCount:ranges[i*3+2]}));
        const faceCount=e.count(6),unitFaceCount=e.count(7);
        const mesh:HvpCompactMesh={positions,normals,colors,indices,faceCount,unitFaceCount,outerFaceCount:faceCount,cavityFaceCount:0,materialRanges,
          boundsMeters:{min:{x:bounds[0],y:bounds[1],z:bounds[2]},max:{x:bounds[3],y:bounds[4],z:bounds[5]}},sourceDigest:p.sourceDigest,algorithmVersion:"hvp-terrain-chunk-v1",
          tempEstimateBytes:unitFaceCount*8+faceCount*96+(positions.length+normals.length+indices.length+(colors?.length??0))*8};
        e.release();costs.outputCopy+=performance.now()-t;return mesh;
      };
      if(p.purpose!=="collision")outputs.render=execute(p.slots,p.cellMeters,true);
      if(p.purpose!=="render"){
        t=performance.now();const binary=physicalSlots(p);costs.inputCopy+=performance.now()-t;
        const mesh=execute(binary,.125,false);t=performance.now();outputs.collision={vertices:mesh.positions,indices:new Uint32Array(mesh.indices)};costs.outputCopy+=performance.now()-t;
      }
      t=performance.now();validateProducts(p,outputs);costs.outputValidation=performance.now()-t;check();costs.total=performance.now()-start;
      return {binding,generation:p.generation,epoch,instanceId:this.instanceId,purpose:p.purpose,products:outputs,costs,memory:{wasmHeapBytes:e.memory.buffer.byteLength,inputBytes:p.slots.byteLength,
        previousGenerationBytes:this.adoptedBytes,candidateBytes:byteLength(outputs),overlapLogicalBytes:e.memory.buffer.byteLength+p.slots.byteLength+this.adoptedBytes+byteLength(outputs)}};
    }finally{e.release();this.busy=false;}
  }
  async adopt(candidate:Candidate,current:Input):Promise<Products>{
    const products=await admitCandidate(candidate,current,()=>this.admissionContext());
    this.adoptedBytes=byteLength(products);this.adopted=products;return products;
  }
}
export function selectKernel(simdAvailable:boolean,requested:"scalar"|"simd",allowScalarFallback=false):"scalar" {
  if(requested==="simd"&&!allowScalarFallback)throw new Error(`SIMD unsupported: no SIMD candidate built (capability=${simdAvailable})`);
  return "scalar";
}
