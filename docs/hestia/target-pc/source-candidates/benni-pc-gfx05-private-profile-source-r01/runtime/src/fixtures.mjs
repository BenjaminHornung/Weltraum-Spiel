import {HVP_COAST_REGISTRY_DIGEST} from "../dist/oracle.mjs";
export const index=(x,y,z)=>x+1+(y+1)*34+(z+1)*34*34;
export function bindFixture(p){
  const [x,y,z]=p.coreOrigin,sourceOrigin={x:p.origin[0]-x*.125,y:p.origin[1]-y*.125,z:p.origin[2]-z*.125};
  const previous=p.manifest,neighbor=p.physicalHalo==="closed-exterior"?null:{
    sessionId:"gfx05-confirmed-neighbor",epoch:0,generation:1,sourceDigest:"fixture-neighbor",baseDigest:"fixture-base",
    originMeters:{...sourceOrigin,x:sourceOrigin.x+(p.physicalHalo==="east"?32:-32)}};
  return {...p,manifest:{worldId:"gfx05-fixture-world",renderVersion:"hvp-terrain-chunk-v1",collisionVersion:"hvp-collision-chunk-v1",
    sessionId:"gfx05-fixture-session",epoch:0,baseDigest:"fixture-base",materialDigest:HVP_COAST_REGISTRY_DIGEST,
    haloBinding:"gfx05-known-fixture-halo",...previous,generation:p.generation,sourceDigest:p.sourceDigest,chunk:x/32+(y/32)*8+(z/32)*32,
    coreOrigin:[...p.coreOrigin],sizeX:32,sizeY:32,sizeZ:32,haloWidth:1,originMeters:{x:p.origin[0],y:p.origin[1],z:p.origin[2]},
    sourceOrigin,physicalHalo:p.physicalHalo,haloNeighbor:p.physicalHalo===previous?.physicalHalo?previous.haloNeighbor:neighbor}};
}
export const fixture=(name,cellMeters=.125,origin=[-4,-8,-16])=>{
  const slots=new Uint8Array(34**3);
  const core=(x,y,z)=>x>=0&&x<32&&y>=0&&y<32&&z>=0&&z<32;
  for(let z=-1;z<=32;z++)for(let y=-1;y<=32;y++)for(let x=-1;x<=32;x++){
    let slot=0;
    if(name==="full")slot=Number(core(x,y,z));
    if(name==="full-halo")slot=1;
    if(name==="checker")slot=Number(core(x,y,z)&&(x+y+z)%2===0);
    if(name==="bounded-checker")slot=Number(x>=6&&x<26&&y>=6&&y<26&&z>=6&&z<26&&(x+y+z)%2===0);
    if(name==="cave")slot=Number(core(x,y,z)&&!(x>=8&&x<24&&y>=8&&y<24&&z>=8&&z<24));
    if(name==="thin")slot=Number(core(x,y,z)&&y===15);
    if(name==="materials")slot=core(x,y,z)&&y<8?1+(Math.floor(x/8)%4):0;
    if(name==="seam")slot=y>=8&&y<24&&z>=8&&z<24&&x>=24?1:0;
    if(name==="ao")slot=(x===15&&y===15&&z===15)||(x===14&&y===16&&z===15)||(x===14&&y===15&&z===16)?1:0;
    slots[index(x,y,z)]=slot;
  }
  return bindFixture({name,slots,cellMeters,origin,sourceDigest:`fixture:${name}:${cellMeters}`,generation:1,purpose:"render",coverage:"KNOWN",physicalHalo:"closed-exterior",coreOrigin:[0,0,0]});
};
export const budgets={maxVisitedCells:32**3,maxQuads:50000,maxVertices:200000,maxIndices:300000};
export function occupancy(input,slots=input.slots,cellMeters=input.cellMeters){
  const slotAt=(x,y,z)=>slots[index(x,y,z)];
  return {sizeX:32,sizeY:32,sizeZ:32,cellMeters,originMeters:{x:input.origin[0],y:input.origin[1],z:input.origin[2]},slotAt,ghostSlotAt:slotAt};
}
// Exact physical mask from frozen r33 workers/hvpChunkJob.ts, not render ghosts.
export function collisionSlots(input){
  const binary=new Uint8Array(34**3),[ox,oy,oz]=input.coreOrigin;
  for(let i=0;i<binary.length;i++){
    const x=ox+i%34-1,y=oy+Math.floor(i/34)%34-1,z=oz+Math.floor(i/(34*34))-1;
    const inside=x>=0&&x<256&&y>=0&&y<128&&z>=0&&z<256;
    const neighbor=y>=0&&y<128&&z>=0&&z<256&&(input.physicalHalo==="east"?x>=256&&x<512:input.physicalHalo==="west"?x<0&&x>=-256:false);
    binary[i]=Number(input.slots[i]!==0&&(inside||neighbor));
  }
  return binary;
}
