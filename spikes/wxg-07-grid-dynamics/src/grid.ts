import {FACES,direction,unit,dot,cross,frame,cellArea} from '../inputs/wxg/dist/src/geometry.js';
import type {Vec3,Face,TangentFrame} from '../inputs/wxg/dist/src/geometry.js';
export interface Cell {readonly face:Face;readonly x:number;readonly y:number;readonly area:number;readonly center:Vec3;readonly basis:TangentFrame;readonly vertices:readonly Vec3[];readonly edges:readonly number[];readonly signs:readonly number[]}
export interface Edge {readonly a:number;readonly b:number;readonly start:Vec3;readonly end:Vec3;readonly length:number;readonly flux:number;readonly seam:boolean;readonly corner:boolean}
export interface Grid {readonly n:number;readonly radius:number;readonly wind:number;readonly axis:Vec3;readonly cells:readonly Cell[];readonly edges:readonly Edge[];readonly minimumLength:number;readonly maximumOutflowRate:number;readonly waveSpeed:number}
export const finitePositive=(value:number,name:string,zero=false):number=>{if(!Number.isFinite(value)||(zero?value<0:value<=0))throw Error('INVALID_'+name);return value;};
const length=(v:Vec3)=>Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
const primitive=(u:number,v:number)=>Math.atan2(u*v,Math.sqrt(1+u*u+v*v));
function areaAt(n:number,x:number,y:number,r:number):number {
  if(n===32||n===64)return cellArea('px',n===32?5:6,x,y,r);
  // shortcut: arbitrary resolution reuses WXG's gnomonic area primitive, not its power-of-two address API.
  const u0=-1+2*x/n,u1=-1+2*(x+1)/n,v0=-1+2*y/n,v1=-1+2*(y+1)/n;
  return (primitive(u1,v1)-primitive(u0,v1)-primitive(u1,v0)+primitive(u0,v0))*r*r;
}
export function buildGrid(n:number,radius:number,wind:number,axisRaw:Vec3):Grid {
  if(![32,48,64].includes(n))throw Error('UNSUPPORTED_RESOLUTION');
  finitePositive(radius,'RADIUS');if(radius<1||radius>1e9)throw Error('RADIUS_RANGE');
  finitePositive(wind,'WIND',true);if(wind>1000)throw Error('WIND_RANGE');
  const axis=unit(axisRaw),vertices=new Map<string,Vec3>();
  const vertex=(face:Face,x:number,y:number):[string,Vec3]=>{
    const v=direction(face,-1+2*x/n,-1+2*y/n),s=n/Math.max(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z));
    const raw={x:Math.round(v.x*s),y:Math.round(v.y*s),z:Math.round(v.z*s)},key=[raw.x,raw.y,raw.z].join(',');
    if(!vertices.has(key))vertices.set(key,unit(raw));return [key,vertices.get(key)!];
  };
  const mutable:{face:Face;x:number;y:number;area:number;center:Vec3;basis:TangentFrame;vertices:Vec3[];edges:number[];signs:number[]}[]=[];
  const edges:{a:number;b:number;start:Vec3;end:Vec3;length:number;flux:number;seam:boolean;corner:boolean;startKey:string;endKey:string}[]=[];
  const byKey=new Map<string,number>();
  for(const face of FACES)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const id=mutable.length,vs=[vertex(face,x,y),vertex(face,x+1,y),vertex(face,x+1,y+1),vertex(face,x,y+1)];
    const u=-1+(2*x+1)/n,v=-1+(2*y+1)/n;
    const cell={face,x,y,area:areaAt(n,x,y,radius),center:direction(face,u,v),basis:frame(face,u,v),vertices:vs.map(a=>a[1]),edges:[] as number[],signs:[] as number[]};
    for(let side=0;side<4;side++){
      const [ka,a]=vs[side],[kb,b]=vs[(side+1)%4],key=[ka,kb].sort().join('|');
      let ei=byKey.get(key),sign=1;
      if(ei===undefined){
        ei=edges.length;byKey.set(key,ei);
        const corner=[ka,kb].some(k=>k.split(',').every(t=>Math.abs(Number(t))===n));
        edges.push({a:id,b:-1,start:a,end:b,startKey:ka,endKey:kb,length:radius*Math.atan2(length(cross(a,b)),dot(a,b)),flux:radius*wind*(dot(axis,b)-dot(axis,a)),seam:false,corner});
      }else{
        const e=edges[ei];if(e.b!==-1||e.startKey!==kb||e.endKey!==ka)throw Error('NON_MANIFOLD_EDGE');
        e.b=id;e.seam=mutable[e.a].face!==face;sign=-1;
      }
      cell.edges.push(ei);cell.signs.push(sign);
    }
    mutable.push(cell);
  }
  if(edges.some(e=>e.b<0)||edges.length!==12*n*n)throw Error('UNKNOWN_COVERAGE');
  let minimumLength=Infinity,maximumOutflowRate=0;
  for(const c of mutable){
    let perimeter=0,out=0;for(let j=0;j<4;j++){const e=edges[c.edges[j]];perimeter+=e.length;out+=Math.max(0,c.signs[j]*e.flux);}
    minimumLength=Math.min(minimumLength,2*c.area/perimeter);maximumOutflowRate=Math.max(maximumOutflowRate,out/c.area);
  }
  for(const v of vertices.values())Object.freeze(v);
  for(const c of mutable){Object.freeze(c.center);Object.values(c.basis).forEach(Object.freeze);Object.freeze(c.basis);Object.freeze(c.vertices);Object.freeze(c.edges);Object.freeze(c.signs);Object.freeze(c);}
  edges.forEach(Object.freeze);Object.freeze(axis);
  return Object.freeze({n,radius,wind,axis,cells:Object.freeze(mutable),edges:Object.freeze(edges),minimumLength,maximumOutflowRate,waveSpeed:0});
}
