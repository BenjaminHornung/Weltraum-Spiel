import {createHash} from "node:crypto";
import type {Cell,Fixture} from "./fixtures.js";
import {hvpPrincipalAxes} from "./product/principalAxes.js";
import {mergeGreedyQuantumBoxes} from "./product/greedy.js";
import {meshHvpOccupancy} from "./product/collisionMesher.js";
export type Vec={x:number;y:number;z:number};
export type StructuralInertiaTensor={xx:number;yy:number;zz:number;xy:number;xz:number;yz:number};
export type Kind="triangles"|"multi-cuboid"|"voxels";
export const vec=(v:Cell):Vec=>({x:v[0],y:v[1],z:v[2]});
export const key=(v:Cell)=>v.join(":");
export function deepFreeze<T>(v:T):T {
  if(v!==null&&typeof v==="object"&&!Object.isFrozen(v)){
    for(const x of Object.values(v))deepFreeze(x);
    Object.freeze(v);
  }
  return v;
}
export function canonical(f:Fixture):Fixture {
  if(typeof f.id!=="string"||!/^[-a-zA-Z0-9_:]{1,128}$/.test(f.id))throw new Error("Invalid source owner");
  if(![.125,.25].includes(f.cellSize)||!Number.isFinite(f.density)||f.density<=0)throw new Error("Invalid voxel size/density");
  if(f.bounds.length!==3||!f.bounds.every(n=>Number.isSafeInteger(n)&&n>0&&n<=64))throw new Error("Invalid bounds");
  if(f.origin.length!==3||!f.origin.every(n=>Number.isFinite(n)&&Number.isSafeInteger(n/f.cellSize)))throw new Error("Invalid origin/grid alignment");
  if(Object.keys(f.rotation).sort().join(",")!=="w,x,y,z"||!Object.values(f.rotation).every(Number.isFinite)
    ||Math.abs(Math.hypot(f.rotation.x,f.rotation.y,f.rotation.z,f.rotation.w)-1)>1e-8)throw new Error("Invalid rotation");
  if(f.cells.length===0||f.cells.length>32768)throw new Error("Invalid occupied count");
  const occupied=new Set<string>();
  for(const c of f.cells){
    if(c.length!==3||!c.every((n,i)=>Number.isSafeInteger(n)&&n>=0&&n<f.bounds[i]))throw new Error("Cell outside known bounds");
    if(occupied.has(key(c)))throw new Error("Duplicate cell");occupied.add(key(c));
  }
  return deepFreeze(structuredClone({...f,cells:[...f.cells].sort((a,b)=>a[2]-b[2]||a[1]-b[1]||a[0]-b[0])}));
}
export const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function massProperties(f:Fixture){
  const m=f.density*f.cellSize**3,total=m*f.cells.length;
  const centers=f.cells.map(c=>c.map(n=>(n+.5)*f.cellSize));
  const center=centers.reduce((s,c)=>s.map((n,i)=>n+c[i]/centers.length),[0,0,0]);
  const tensor:StructuralInertiaTensor={xx:0,yy:0,zz:0,xy:0,xz:0,yz:0};
  for(const c of centers){
    const [x,y,z]=c.map((n,i)=>n-center[i]),own=m*f.cellSize**2/6;
    tensor.xx+=own+m*(y*y+z*z);tensor.yy+=own+m*(x*x+z*z);tensor.zz+=own+m*(x*x+y*y);
    tensor.xy-=m*x*y;tensor.xz-=m*x*z;tensor.yz-=m*y*z;
  }
  return deepFreeze({mass:total,center:vec(center as unknown as Cell),tensor,axes:hvpPrincipalAxes(tensor)});
}
export function exposedTriangles(f:Fixture){
  const occupied=new Set(f.cells.map(key));
  const mesh=meshHvpOccupancy({sizeX:f.bounds[0],sizeY:f.bounds[1],sizeZ:f.bounds[2],cellMeters:f.cellSize,
    originMeters:{x:0,y:0,z:0},slotAt:(x,y,z)=>occupied.has(key([x,y,z]))?1:0},
    {maxVisitedCells:262144,maxQuads:50000,maxVertices:200000,maxIndices:300000},
    digest(f),"hvp-collision-greedy-v1");
  return {vertices:mesh.positions,indices:new Uint32Array(mesh.indices)};
}
export function recipe(input:Fixture,kind:Kind,revision=0){
  if(!["triangles","multi-cuboid","voxels"].includes(kind)||!Number.isSafeInteger(revision)||revision<0)throw new Error("Invalid recipe kind/revision");
  const f=canonical(input),mass=massProperties(f),binding=deepFreeze({
    domain:"PHY-02-PRIMITIVE",world:"primitive-v1",session:"isolated",epoch:0,sourceOwner:f.id,
    sourceRevision:revision,sourceDigest:digest(f),coverage:"FULL_KNOWN_BOUNDS",bounds:f.bounds,origin:f.origin,
    cellSize:f.cellSize,materialProfile:"hvp-dry-limestone-prototype-tuning-unapproved",
    algorithm:kind==="triangles"?"hvp-collision-greedy-v1":kind==="multi-cuboid"?"17b1-greedy-v1":"rapier-0.21-voxels-v1",
    neighborGeneration:0,missingNeighborCoverage:"UNKNOWN",surfaceMapping:"uniform-fixture-surface-v1"});
  const boxes=kind==="multi-cuboid"?mergeGreedyQuantumBoxes(f.cells.map(c=>vec(c)),"fixture"):undefined;
  const triangles=kind==="triangles"?exposedTriangles(f):undefined;
  const voxels=kind==="voxels"?new Int32Array(f.cells.flat()):undefined;
  return {kind,fixture:f,binding,mass,boxes,triangles,voxels};
}
export type CollisionRecipeDraft=ReturnType<typeof recipe>;
export function rotate(q:Fixture["rotation"],v:Vec):Vec{
  const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
  return {x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};
}
export function worldPoint(f:Fixture,p:Vec):Vec{
  const r=rotate(f.rotation,p);return {x:r.x+f.origin[0],y:r.y+f.origin[1],z:r.z+f.origin[2]};
}
export function rayOracle(f:Fixture,o:Vec,d:Vec):number|null{
  let hit=Infinity;
  for(const c of f.cells){
    let near=0,far=Infinity;
    for(const [i,k] of (["x","y","z"] as const).entries()){
      const lo=c[i]*f.cellSize,hi=lo+f.cellSize;
      if(d[k]===0){if(o[k]<lo||o[k]>hi){far=-1;break;}}
      else{const a=(lo-o[k])/d[k],b=(hi-o[k])/d[k];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
    }
    if(far>=near)hit=Math.min(hit,near);
  }
  return Number.isFinite(hit)?hit:null;
}
