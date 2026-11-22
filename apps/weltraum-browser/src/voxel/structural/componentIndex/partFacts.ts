import { HVP_COAST_MATERIAL_REGISTRY } from "../../../hvp/hvpCoastSource";
import type { Vec3 } from "../../../core/vector";
import type { StructuralInertiaTensor } from "../types";
import type { HvpCell } from "../../../hestia-prototype/terrain/picking";
import { box, cell, exactShapes, orderedSpans, type Box, type Span, type CompactTerrainPart } from "./exactShapes";

export interface CompactMass {
  readonly totalMassKg:number;
  readonly firstMomentKgMeters: Readonly<Vec3>;
  readonly centerOfMassMeters: Readonly<Vec3>;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
}

const vec=(x:number,y:number,z:number)=>Object.freeze({x,y,z});
const q=0.125;
const massPerCell:number[]=[];
for(const m of HVP_COAST_MATERIAL_REGISTRY) massPerCell[m.slot]=m.densityKgPerM3*q**3;

export interface PartFacts {
  readonly part: CompactTerrainPart;
  readonly bounds: Box;
  readonly mass: CompactMass;
  readonly shapes?: readonly Box[];
  readonly count:number;
}

export function combineMass(parts:readonly PartFacts[]):CompactMass {
  if(parts.length===1) return parts[0].mass;
  let m=0,fx=0,fy=0,fz=0;
  for(const {mass} of parts) {
    m+=mass.totalMassKg;fx+=mass.firstMomentKgMeters.x;fy+=mass.firstMomentKgMeters.y;fz+=mass.firstMomentKgMeters.z;
  }
  const center=vec(fx/m,fy/m,fz/m);
  let xx=0,yy=0,zz=0,xy=0,xz=0,yz=0;
  for(const {mass} of parts) {
    const p=mass.centerOfMassMeters, dx=p.x-center.x, dy=p.y-center.y,dz=p.z-center.z;
    const i=mass.inertiaTensorKgMetersSquared,v=mass.totalMassKg;
    xx+=i.xx+v*(dy*dy+dz*dz); yy+=i.yy+v*(dx*dx+dz*dz); zz+=i.zz+v*(dx*dx+dy*dy);
    xy+=i.xy-v*dx*dy; xz+=i.xz-v*dx*dz; yz+=i.yz-v*dy*dz;
  }
  return Object.freeze({totalMassKg:m,firstMomentKgMeters:vec(fx,fy,fz),centerOfMassMeters:center,
    inertiaTensorKgMetersSquared:Object.freeze({xx,yy,zz,xy,xz,yz})});
}

export function preparePart(origin:HvpCell,leafRevision:number,label:number,runs:number[]):PartFacts {
  const part:CompactTerrainPart=Object.freeze({origin,leafRevision,label,runs:Object.freeze(runs)});
  const spans=orderedSpans([part]);
  const facts=measureCompactMaterialSpans(spans);
  return {part,...facts,shapes:exactShapes(spans,facts.count,facts.bounds)};
}

/** Exact first and centered second moments of an occupied coast-material run list. */
export function measureCompactMaterialSpans(spans:readonly Span[]) {
  if(!spans.length)throw new Error("Empty compact mass input");
  let xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=0,ymax=0,zmax=0;
  let count=0,total=0,fx=0,fy=0,fz=0;
  for(const {x,end,y,z,material} of spans) {
    const n=end-x,m=massPerCell[material]*n;
    xmin=Math.min(xmin,x);ymin=Math.min(ymin,y);zmin=Math.min(zmin,z);
    xmax=Math.max(xmax,end);ymax=Math.max(ymax,y+1);zmax=Math.max(zmax,z+1);
    count+=n;total+=m;fx+=m*(x+n/2)*q;fy+=m*(y+.5)*q;fz+=m*(z+.5)*q;
  }
  const center=vec(fx/total,fy/total,fz/total);
  let xx=0,yy=0,zz=0,xy=0,xz=0,yz=0;
  for(const {x,end,y,z,material} of spans) {
    const n=end-x,m=massPerCell[material]*n;
    const dx=(x+n/2)*q-center.x,dy=(y+.5)*q-center.y,dz=(z+.5)*q-center.z;
    // A uniform run is one solid rectangular prism, inclusive of each voxel's self-inertia.
    const axial=q*q/6, transverse=q*q*(n*n+1)/12;
    xx+=m*(axial+dy*dy+dz*dz);yy+=m*(transverse+dx*dx+dz*dz);zz+=m*(transverse+dx*dx+dy*dy);
    xy-=m*dx*dy;xz-=m*dx*dz;yz-=m*dy*dz;
  }
  const bounds=box(cell(xmin,ymin,zmin),cell(xmax,ymax,zmax));
  return {bounds,count,mass:Object.freeze({
    totalMassKg:total,firstMomentKgMeters:vec(fx,fy,fz),centerOfMassMeters:center,
    inertiaTensorKgMetersSquared:Object.freeze({xx,yy,zz,xy,xz,yz})})};
}
