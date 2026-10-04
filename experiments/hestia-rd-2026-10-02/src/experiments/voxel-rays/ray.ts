import { Matrix3, Vector3, type PerspectiveCamera } from 'three';
import type { Vec3 } from '../../contracts/fixture';
import { requireValue } from '../../contracts/validation';
import type { RayVolume } from './volume';

export interface RayResult { readonly status:'hit'|'miss'; readonly unknownTraversed:boolean; readonly outsideUnknown:true;
  readonly t?:number; readonly point?:Vec3; readonly normal?:Vec3; readonly slot?:number; readonly materialId?:string;
  readonly cell?:Vec3; readonly originalCell?:Vec3; readonly sourceIds?:readonly string[]; }
interface Interval { lo:number; hi:number; enter:Vec3; exit:Vec3; cell:Vec3; slot:number; }
/** Independent analytical interval oracle: no DDA stepping arithmetic. */
export function traceOracle(v:RayVolume,origin:Vec3,direction:Vec3):RayResult {
  requireValue(origin.every(Number.isFinite) && direction.every(Number.isFinite) && Math.abs(Math.hypot(...direction)-1)<=1e-9,'Ray direction must be finite unit length');
  const o=new Vector3(...origin).applyMatrix4(v.gridFromWorld);
  const d=new Vector3(...direction).applyMatrix3(new Matrix3().setFromMatrix4(v.gridFromWorld));
  const occupied:Interval[]=[]; const unknown:Interval[]=[]; const [sx,sy,sz]=v.dimensions;
  // ponytail: O(admitted cells) CPU oracle only (<=64^3); rendering uses GLSL DDA, not this loop.
  for (let z=0;z<sz;z+=1) { for (let y=0;y<sy;y+=1) { for (let x=0;x<sx;x+=1) {
    const index=x+sx*(y+sy*z); if (v.slots[index]===0 && v.coverage[index]===1) { continue; }
    const cell:Vec3=[x,y,z]; let lo=-Infinity; let hi=Infinity; let enter:[number,number,number]=[0,0,0]; let exit:[number,number,number]=[0,0,0]; let valid=true;
    for (let axis=0;axis<3;axis+=1) {
      const at=o.getComponent(axis); const speed=d.getComponent(axis); const min=cell[axis];
      if (speed===0) { if (at<min || at>=min+1) { valid=false; break; } continue; }
      const a=(min-at)/speed; const b=(min+1-at)/speed; const near=Math.min(a,b); const far=Math.max(a,b);
      if (near>lo) { lo=near; enter=[0,0,0]; enter[axis]=speed>0?-1:1; }
      if (far<hi) { hi=far; exit=[0,0,0]; exit[axis]=speed>0?1:-1; }
    }
    if (!valid || hi<=Math.max(lo,0)) { continue; }
    const interval={lo,hi,enter,exit,cell,slot:v.slots[index]};
    if (v.coverage[index]===0) { unknown.push(interval); } else if (interval.slot!==0) { occupied.push(interval); }
  } } }
  occupied.sort((a,b)=>a.lo-b.lo || a.cell[0]-b.cell[0] || a.cell[1]-b.cell[1] || a.cell[2]-b.cell[2]);
  let selected:Interval|undefined; let t=Infinity; let normal:Vec3=[0,0,0];
  if (occupied.length>0) {
    const first=occupied[0];
    const boxEntry=Math.max(...v.dimensions.map((size,a)=>d.getComponent(a)===0?-Infinity
      :Math.min(-o.getComponent(a)/d.getComponent(a),(size-o.getComponent(a))/d.getComponent(a))));
    if (first.lo>0 || (first.lo===0 && boxEntry>=0)) { selected=first; t=first.lo; normal=first.enter; }
    else {
      selected=first; t=first.hi; normal=first.exit;
      for (const next of occupied.slice(1)) {
        if (next.lo>t+1e-12) { break; }
        if (next.hi>t) { selected=next; t=next.hi; normal=next.exit; }
      }
    }
  }
  const unknownTraversed=unknown.some((i)=>i.hi>0 && Math.max(i.lo,0)<=t);
  if (!selected) { return {status:'miss',unknownTraversed,outsideUnknown:true}; }
  const worldNormal=new Vector3(...normal).applyNormalMatrix(new Matrix3().getNormalMatrix(v.worldFromGrid));
  const originalCell=selected.cell.map((n,a)=>n+v.offset[a]) as unknown as Vec3;
  const exact=v.source.sourceIds.filter((id)=>{ const m=v.source.sourceIdMeaning[id];
    return m?.region===v.source.regionId && m.cell.every((n,a)=>n===originalCell[a]); });
  return {status:'hit',t,point:origin.map((n,a)=>n+t*direction[a]) as unknown as Vec3,normal:worldNormal.toArray() as unknown as Vec3,
    slot:selected.slot,materialId:v.materialIds[selected.slot-1],cell:selected.cell,originalCell,
    sourceIds:exact.length>0?exact:v.source.sourceIds,unknownTraversed,outsideUnknown:true};
}
export function hitDepth(point:Vec3,camera:PerspectiveCamera) { return new Vector3(...point).project(camera).z*0.5+0.5; }

// Shared verbatim by the visible material and the future test-only numeric pass.
// t is world metres: NEVER normalize(gridDirection).
export const PRODUCTION_KERNEL = /* glsl */`
uniform highp usampler3D voxelData;
uniform ivec3 gridSize;
uniform int slotDoubleSided[8];
float projectionDepth(vec3 worldHit,mat4 projectionView) { vec4 clip=projectionView*vec4(worldHit,1.0); return clip.z/clip.w*0.5+0.5; }
struct VoxelHit { bool hit; bool unknown; bool traversalFault; float t; ivec3 cell; int slot; vec3 normal; };
uvec4 sourceCell(ivec3 c) {
  if (any(lessThan(c,ivec3(0))) || any(greaterThanEqual(c,gridSize))) { return uvec4(0); }
  return texelFetch(voxelData,c,0);
}
vec3 axisNormal(int a,float signValue) { vec3 n=vec3(0); n[a]=signValue; return n; }
VoxelHit traceVoxels(vec3 o,vec3 gridDirection,bool selectVisible) {
  VoxelHit h; h.hit=false; h.unknown=false; h.traversalFault=false; h.t=0.0; h.cell=ivec3(-1); h.slot=0; h.normal=vec3(0);
  float entry=-1e30; float leave=1e30; int entryAxis=0;
  for (int a=0;a<3;a++) {
    if (gridDirection[a]==0.0) {
      if (o[a]<0.0 || o[a]>=float(gridSize[a])) { return h; }
    } else {
      float t0=(0.0-o[a])/gridDirection[a]; float t1=(float(gridSize[a])-o[a])/gridDirection[a];
      float nearT=min(t0,t1); float farT=max(t0,t1);
      if (nearT>entry) { entry=nearT; entryAxis=a; }
      leave=min(leave,farT);
    }
  }
  float t=max(0.0,entry); if (leave<=t) { return h; }
  vec3 p=o+t*gridDirection; ivec3 cell=ivec3(floor(p)); ivec3 stepDir=ivec3(sign(gridDirection));
  for (int a=0;a<3;a++) {
    if (gridDirection[a]<0.0 && p[a]==floor(p[a])) { cell[a]-=1; }
  }
  // Only a mathematically proved BOX ENTRY permits a roundoff clamp.
  if (entry>=0.0) { cell=clamp(cell,ivec3(0),gridSize-ivec3(1)); }
  if (any(lessThan(cell,ivec3(0))) || any(greaterThanEqual(cell,gridSize))) { return h; }
  vec3 crossing=vec3(1e30);
  for (int a=0;a<3;a++) {
    if (gridDirection[a]!=0.0) { crossing[a]=(float(cell[a]+(stepDir[a]>0?1:0))-o[a])/gridDirection[a]; }
  }
  bool insideRun=entry<0.0 && sourceCell(cell).r!=0u; ivec3 previous=cell; int previousSlot=int(sourceCell(cell).b);
  vec3 face=axisNormal(entryAxis,-float(stepDir[entryAxis]));
  // First valid cell tested BEFORE any step. A ray crosses at most sum(dimensions) planes.
  int admittedSteps=gridSize.x+gridSize.y+gridSize.z+1;
  for (int iteration=0;iteration<193;iteration++) {
    if (iteration>=admittedSteps) { h.traversalFault=true; return h; }
    uvec4 sample=sourceCell(cell); h.unknown=h.unknown || sample.g==0u;
    bool solid=sample.r!=0u;
    if (!insideRun && solid) { h.hit=true; h.t=t; h.cell=cell; h.slot=int(sample.b); h.normal=face; return h; }
    if (insideRun && !solid) {
      if (!selectVisible || slotDoubleSided[previousSlot]!=0) { h.hit=true; h.t=t; h.cell=previous; h.slot=previousSlot; h.normal=-face; return h; }
      // Rejected back exit: keep this empty interval, Unknown, world t and ONE traversal budget.
      insideRun=false;
    }
    if (solid) { previous=cell; previousSlot=int(sample.b); }
    float nextT=min(crossing.x,min(crossing.y,crossing.z));
    if (nextT<=t) { h.traversalFault=true; return h; }
    bvec3 tied=equal(crossing,vec3(nextT)); int a=tied.x?0:(tied.y?1:2); face=axisNormal(a,-float(stepDir[a]));
    if (nextT>=leave) {
      if (insideRun && (!selectVisible || slotDoubleSided[previousSlot]!=0)) { h.hit=true; h.t=leave; h.cell=previous; h.slot=previousSlot; h.normal=-face; }
      return h;
    }
    // ALL tied axes advance; no zero-length intermediate cells are ever sampled.
    for (int j=0;j<3;j++) {
      if (tied[j]) { cell[j]+=stepDir[j]; crossing[j]=(float(cell[j]+(stepDir[j]>0?1:0))-o[j])/gridDirection[j]; }
    }
    t=nextT;
  }
  h.traversalFault=true; return h;
}
// Geometric first-exit semantics are unchanged; only visible projection filters exits during traversal.
VoxelHit traceVoxels(vec3 o,vec3 gridDirection) { return traceVoxels(o,gridDirection,false); }
VoxelHit traceVisibleVoxels(vec3 o,vec3 gridDirection) { return traceVoxels(o,gridDirection,true); }
`;

export const VISIBLE_VERTEX = `void main() { gl_Position=vec4(position.xy,0.0,1.0); }`;
export const VISIBLE_FRAGMENT = /* glsl */`
layout(location=0) out vec4 rayColor;
#define gl_FragColor rayColor
#include <common>
#include <bsdfs>
#include <lights_pars_begin>
uniform mat4 rayInverseProjection;
uniform mat4 projectionMatrix;
uniform mat4 rayCameraWorld;
uniform mat4 gridFromWorld;
uniform mat3 worldNormalMatrix;
uniform vec2 drawingBuffer;
uniform vec3 slotColor[8];
uniform vec3 slotEmission[8];
#ifdef USE_FOG
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
#endif
${PRODUCTION_KERNEL}
void main() {
  vec2 ndc=gl_FragCoord.xy/drawingBuffer*2.0-1.0;
  vec4 nearPoint=rayCameraWorld*rayInverseProjection*vec4(ndc,-1.0,1.0);
  vec4 farPoint=rayCameraWorld*rayInverseProjection*vec4(ndc,1.0,1.0);
  vec3 worldOrigin=nearPoint.xyz/nearPoint.w;
  vec3 worldDirection=normalize(farPoint.xyz/farPoint.w-worldOrigin);
  vec3 gridOrigin=(gridFromWorld*vec4(worldOrigin,1.0)).xyz;
  vec3 gridDirection=(gridFromWorld*vec4(worldDirection,0.0)).xyz;
  VoxelHit h=traceVisibleVoxels(gridOrigin,gridDirection);
  if (h.traversalFault) { gl_FragColor=vec4(1.0,0.0,1.0,1.0); gl_FragDepth=0.0; return; }
  if (!h.hit) { discard; }
  vec3 worldHit=worldOrigin+h.t*worldDirection;
  vec3 worldNormal=normalize(worldNormalMatrix*h.normal);
  bool back=dot(worldNormal,worldDirection)>0.0;
  if (back) { worldNormal=-worldNormal; }
  vec4 viewHit=viewMatrix*vec4(worldHit,1.0);
  vec4 clip=projectionMatrix*viewHit;
  float hitDepth=projectionDepth(worldHit,projectionMatrix*viewMatrix);
  if (clip.w<=0.0 || hitDepth<0.0 || hitDepth>1.0) { discard; }
  gl_FragDepth=hitDepth;
  vec3 normal=normalize(mat3(viewMatrix)*worldNormal);
  vec3 irradiance=getAmbientLightIrradiance(ambientLightColor);
  #if NUM_HEMI_LIGHTS > 0
  for (int i=0;i<NUM_HEMI_LIGHTS;i++) { irradiance+=getHemisphereLightIrradiance(hemisphereLights[i],normal); }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for (int i=0;i<NUM_DIR_LIGHTS;i++) { irradiance+=max(dot(normal,directionalLights[i].direction),0.0)*directionalLights[i].color; }
  #endif
  gl_FragColor=vec4(slotColor[h.slot]*irradiance*RECIPROCAL_PI+slotEmission[h.slot],1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
  float fogFactor=smoothstep(fogNear,fogFar,-viewHit.z);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
  #endif
}
`;
