/** Bounded, explicit CPU SOURCE adapter, NOT a GLSL compiler or native precision/driver proof.
 * Execute the actual production DDA control flow; never use this as expected/oracle code. */
import { Matrix3, Vector3 } from 'three';
import type { Vec3 } from '../../src/contracts/fixture';
import { requireValue } from '../../src/contracts/validation';
import { PRODUCTION_KERNEL, VISIBLE_FRAGMENT } from '../../src/experiments/voxel-rays/ray';
import type { RayVolume } from '../../src/experiments/voxel-rays/volume';

interface CpuHit {hit:boolean;unknown:boolean;traversalFault:boolean;t:number;cell:number[];slot:number;normal:number[];iterations:number;}
function body(kernel:string) {
  const start=kernel.indexOf('VoxelHit traceVoxels(');requireValue(start>=0,'Actual production trace definition required');
  const open=kernel.indexOf('{',start);let depth=1;let end=open+1;
  for (;end<kernel.length&&depth>0;end+=1) {if (kernel[end]==='{') {depth+=1;}else if (kernel[end]==='}') {depth-=1;}}
  requireValue(depth===0,'Unclosed production trace');return kernel.slice(open+1,end-1);
}
export function productionCpu(v:RayVolume,origin:Vec3,direction:Vec3,visible=false,kernel=PRODUCTION_KERNEL,fragment=VISIBLE_FRAGMENT):CpuHit {
  requireValue(v.dimensions.every((n)=>Number.isInteger(n)&&n>=1&&n<=64),'Same admitted axis limit');
  const continued=visible&&fragment.includes('traceVisibleVoxels(gridOrigin,gridDirection)');
  if (continued) {requireValue(/traceVisibleVoxels\(vec3 o,vec3 gridDirection\)\s*\{\s*return traceVoxels\(o,gridDirection,true\);\s*\}/.test(kernel),'Actual shared visible call path required');}
  let code=body(kernel);
  requireValue(code.includes('for (int iteration=0;iteration<193;iteration++)'),'Frozen total traversal bound');
  // Explicit translations of this owner's known vector expressions/value semantics, not general GLSL parsing.
  code=code.replace('VoxelHit h;','let h={};let iterations=0;')
    .replace('o+t*gridDirection','o.map((n,a)=>n+t*gridDirection[a])')
    .replace('gridSize-ivec3(1)','gridSize.map((n)=>n-1)')
    .replaceAll('previous=cell;','previous=cell.slice();')
    .replaceAll('h.normal=-face','h.normal=face.map((n)=>-n)')
    .replaceAll('return h;','return {...h,iterations};')
    .replace('uvec4 sample=sourceCell(cell);','iterations+=1;uvec4 sample=sourceCell(cell);')
    .replace(/\b(?:float|int|bool|ivec3|vec3|uvec4|bvec3)\s+(\w+)/g,'let $1')
    .replace(/\b(\d+)u\b/g,'$1')
    .replace(/(gridSize|crossing|tied)\.([xyz])/g,(_m,name:string,axis:string)=>`${name}[${'xyz'.indexOf(axis)}]`)
    .replace(/(sample|sourceCell\(cell\))\.([rgb])/g,(_m,name:string,axis:string)=>`${name}[${'rgb'.indexOf(axis)}]`);
  const vector=(n:number|readonly number[])=>typeof n==='number'?[n,n,n]:[...n];
  const floor=(n:number|readonly number[])=>typeof n==='number'?Math.floor(n):n.map(Math.floor);const sign=(n:readonly number[])=>n.map(Math.sign);
  const compare=(a:readonly number[],b:readonly number[],fn:(a:number,b:number)=>boolean)=>a.map((n,i)=>fn(n,b[i]));
  const sourceCell=(cell:number[])=>{
    if (cell.some((n,a)=>n<0||n>=v.dimensions[a])) {return [0,0,0,0];}
    const at=(cell[0]+v.dimensions[0]*(cell[1]+v.dimensions[1]*cell[2]))*4;return Array.from(v.packed.slice(at,at+4));
  };
  const axisNormal=(axis:number,n:number)=>{const result=[0,0,0];result[axis]=n;return result;};
  const run=new Function('o','gridDirection','gridSize','sourceCell','slotDoubleSided','selectVisible','vec3','ivec3','floor','sign',
    'float','int','min','max','any','lessThan','greaterThanEqual','clamp','equal','axisNormal',code);
  const o=new Vector3(...origin).applyMatrix4(v.gridFromWorld).toArray();
  const d=new Vector3(...direction).applyMatrix3(new Matrix3().setFromMatrix4(v.gridFromWorld)).toArray();
  const sides=[0,...v.materials.map((m)=>m.doubleSided?1:0),...Array(7-v.materials.length).fill(0)];
  const h=run(o,d,[...v.dimensions],sourceCell,sides,continued,vector,vector,floor,sign,Number,Math.trunc,Math.min,Math.max,
    (a:boolean[])=>a.some(Boolean),(a:number[],b:number[])=>compare(a,b,(x,y)=>x<y),(a:number[],b:number[])=>compare(a,b,(x,y)=>x>=y),
    (a:number[],lo:number[],hi:number[])=>a.map((n,i)=>Math.max(lo[i],Math.min(n,hi[i]))),
    (a:number[],b:number[])=>compare(a,b,(x,y)=>x===y),axisNormal) as CpuHit;
  // Interpret only the actual v1 fragment's post-trace discard, so RED exercises the confirmed owner bug.
  if (visible&&!continued&&fragment.includes('if (back && slotDoubleSided[h.slot]==0) { discard; }')&&h.hit
    && new Vector3(...h.normal).applyNormalMatrix(new Matrix3().getNormalMatrix(v.worldFromGrid)).dot(new Vector3(...direction))>0
    && sides[h.slot]===0) {return {...h,hit:false};}
  return h;
}
