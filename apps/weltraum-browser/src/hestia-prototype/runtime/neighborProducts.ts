import {fnv1aHash} from "../../core/hash";
import {hvpFarColumnTopMeters,readHvpSourceColumnWorld} from "../../hvp/hvpCoastSource";
import {clipHvpProjection,meshHvpOccupancy,meshHvpWaterPatch,type HvpCompactMesh,type HvpMeshOccupancy} from "../../hvp/hvpCoastMesher";
import {projectHvpRegionOccupancy,type HvpRegionSource} from "./regionSource";

export const HVP_EAST_COLLAR=Object.freeze({minX:15,maxX:49,minZ:-17,maxZ:17});
const inEast=(x:number,z:number)=>x>=16&&x<48&&z>=-16&&z<16;
const inPrimary=(x:number,z:number)=>x>=-16&&x<16&&z>=-16&&z<16;
export interface HvpNeighborProxies {readonly join:HvpCompactMesh;readonly far:HvpCompactMesh;readonly water:HvpCompactMesh}

/** Only the replacement region and a 1 m collar are newly meshed. Unaffected
 * proxy faces are clipped, not regenerated from the entire 480 m ocean mask. */
export const buildHvpNeighborProducts=(primary:HvpRegionSource,east:HvpRegionSource,lod:.125|.5,proxies:HvpNeighborProxies)=>{
  if(primary.cellMeters!==.125||east.cellMeters!==.125||primary.sizeX!==256||primary.sizeY!==128||primary.sizeZ!==256
    ||east.sizeX!==256||east.sizeY!==128||east.sizeZ!==256||primary.originMeters.x!==-16||east.originMeters.x!==16
    ||primary.originMeters.y!==-8||east.originMeters.y!==-8||primary.originMeters.z!==-16||east.originMeters.z!==-16){throw new Error("Unsupported neighbouring source extents");}
  const digest=fnv1aHash(JSON.stringify(["hvp-east-products-v1",primary.sourceDigest,east.sourceDigest,lod]));
  const projection=projectHvpRegionOccupancy(east,lod);
  const slot=(x:number,y:number,z:number):number=>{
    if(y< -8||y>=8){return 0;}
    if(inPrimary(x,z)){
      const value=primary.readSlot(Math.floor((x+16)*8),Math.floor((y+8)*8),Math.floor((z+16)*8));
      if(value===undefined){throw new Error("Missing primary neighbour coverage");}return value;
    }
    if(inEast(x,z)){
      // Keep the primary seam fine even while the distant interior is coarse.
      if(lod===.125||x<20){const value=east.readSlot(Math.floor((x-16)*8),Math.floor((y+8)*8),Math.floor((z+16)*8));
        if(value===undefined){throw new Error("Missing east coverage");}return value;}
      return projection.slotAt(Math.floor((x-16)/lod),Math.floor((y+8)/lod),Math.floor((z+16)/lod));
    }
    const fine=Math.max(Math.abs(x),Math.abs(z))<20;
    const column=readHvpSourceColumnWorld(fine?x:Math.floor(x)+.5,fine?z:Math.floor(z)+.5);
    const top=fine?column.topMeters:hvpFarColumnTopMeters(x,z);
    if(y>=top){return 0;}
    const material=!fine&&(column.slot===3||column.slot===4)?1:column.slot;
    return y>=top-(top<0?.25:.125)?material:1;
  };
  const ghost=(origin:{x:number;y:number;z:number},cell:number)=>(x:number,y:number,z:number)=>
    slot(origin.x+(x+.5)*cell,origin.y+(y+.5)*cell,origin.z+(z+.5)*cell);
  const meshes:HvpCompactMesh[]=[];
  const add=(occupancy:HvpMeshOccupancy,ao:boolean)=>{meshes.push(meshHvpOccupancy(occupancy,undefined,digest,"hvp-east-surface-v1",{ao}));};
  if(lod===.125){add({...projection,ghostSlotAt:ghost(east.originMeters,.125)},true);}
  else{
    // A fine seam shell subdivides the coarse boundary against its actual
    // neighbours. Sampling one fine neighbour at a coarse face centre would
    // otherwise leave hidden/overlapping vertical spans at fractional heights.
    const fineAt=ghost(east.originMeters,.125);
    add({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:east.originMeters,
      slotAt:(x,y,z)=>x>=36&&x<252&&z>=4&&z<252?0:fineAt(x,y,z),
      silentSolidAt:(x,y,z)=>fineAt(x,y,z)!==0,ghostSlotAt:fineAt},true);
    const origin={x:20.5,y:-8,z:-15.5};
    add({sizeX:54,sizeY:32,sizeZ:62,cellMeters:.5,originMeters:origin,
      slotAt:(x,y,z)=>projection.slotAt(x+9,y,z+1),ghostSlotAt:ghost(origin,.5)},false);
  }
  const origin={x:15,y:-8,z:-17};
  const at=(x:number,y:number,z:number)=>slot(15+(x+.5)*.125,-8+(y+.5)*.125,-17+(z+.5)*.125);
  add({sizeX:272,sizeY:128,sizeZ:272,cellMeters:.125,originMeters:origin,
    slotAt:(x,y,z)=>{const wx=15+(x+.5)*.125,wz=-17+(z+.5)*.125;return inPrimary(wx,wz)||inEast(wx,wz)?0:at(x,y,z);},
    silentSolidAt:(x,y,z)=>at(x,y,z)!==0,ghostSlotAt:ghost(origin,.125)},true);
  const wet=new Uint8Array(272*272);
  for(let z=0;z<272;z+=1){for(let x=0;x<272;x+=1){
    let y=127;while(y>=0&&at(x,y,z)===0){y-=1;}
    if(y>=0&&-8+(y+1)*.125<0){wet[x+z*272]=1;}
  }}
  const waterPatch=meshHvpWaterPatch(wet,272,272,.125,{x:15,z:-17},digest);
  return Object.freeze({digest,lod,region:Object.freeze(meshes),waterPatch,
    join:clipHvpProjection(proxies.join,HVP_EAST_COLLAR,digest),far:clipHvpProjection(proxies.far,HVP_EAST_COLLAR,digest),
    water:clipHvpProjection(proxies.water,HVP_EAST_COLLAR,digest),
    sourceBytes:east.sizeX*east.sizeY*east.sizeZ,projectionBytes:lod===.5?64*32*64:0});
};
