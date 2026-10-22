import { assertHvpSourceComplete, isHvpFactorySourceVersion, type HvpCoastSourceSnapshot } from "../../hvp/hvpCoastSource";
import { canonicalJson,canonicalSignature } from "../../resources/serialization";
import type { FactoryBoundsMm,FactoryVector } from "../construction/installationProfile";

export interface FactoryCargoSite {
  readonly version:"fp06-initial-cargo-s0-v1";
  readonly ownerId:"fp02_wreck_owner"; readonly containerId:"fp02_wreck_cargo";
  readonly sourceDigest:string; readonly sourceRefs:readonly string[];
  readonly centerMm:FactoryVector; readonly sizeMm:FactoryVector; readonly boundsMm:FactoryBoundsMm;
  readonly accessPointMm:FactoryVector; readonly accessBoundsMm:FactoryBoundsMm; readonly spawnMm:FactoryVector;
  readonly geometryPolicy:string; readonly profileDigest:string; readonly canonicalJson:string;
}
const data=(sourceDigest:string)=>({version:"fp06-initial-cargo-s0-v1" as const,ownerId:"fp02_wreck_owner" as const,containerId:"fp02_wreck_cargo" as const,sourceDigest,
  sourceRefs:["FP01:5.5:source-access","FP01:E00:permanently-grounded-cargo","FP02:6.4:finite-reachable-depot","FP02:9.1:cargo-outside-machine-zone"],
  centerMm:[-5500,2000,13125] as const,sizeMm:[1500,1500,1000] as const,
  boundsMm:{min:[-6250,1250,12625] as const,max:[-4750,2750,13625] as const},
  accessPointMm:[-5500,2250,12625] as const,accessBoundsMm:{min:[-6250,1500,11625] as const,max:[-4750,3500,12625] as const},spawnMm:[-5500,2420,11875] as const,
  geometryPolicy:"Immutable technical S0 access-segment witness for the original finite Cargo; dimensions are not packed-volume geometry, hull has no salvage/material/platform/flight admission."});
const freeze=<T>(value:T):T=>{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** Closed initial scenario, never a UI-supplied spawn or a Cargo material factory. */
export const assertFactoryCargoSite=(site:FactoryCargoSite):void=>{
  if(!site||!/^[0-9a-f]{8}$/.test(site.sourceDigest))throw new Error("CargoSite source binding mismatch");
  const expected=data(site.sourceDigest),bytes=canonicalJson(expected);
  if(site.canonicalJson!==bytes||site.profileDigest!==canonicalSignature(expected))throw new Error("CargoSite profile binding mismatch");
  const {profileDigest:_digest,canonicalJson:_bytes,...actual}=site;
  if(canonicalJson(actual)!==bytes)throw new Error("CargoSite closed geometry mismatch");
};
export const copyFactoryCargoSite=(site:FactoryCargoSite):FactoryCargoSite=>{assertFactoryCargoSite(site);const profile=data(site.sourceDigest);return freeze({...profile,canonicalJson:canonicalJson(profile),profileDigest:canonicalSignature(profile)});};
/** Checks actual current source slots, including untouched natural support and the real player hull. */
export const createFactoryCargoSite=(source:HvpCoastSourceSnapshot):FactoryCargoSite=>{
  const version=source.version;
  if(!isHvpFactorySourceVersion(version))throw new Error("CargoSite source frame mismatch");
  const originMeters=source.originMeters,originX=originMeters.x,originY=originMeters.y,originZ=originMeters.z,cellMeters=source.cellMeters;
  if(originX!==-16||originY!==-8||originZ!==-16||cellMeters!==.125)throw new Error("CargoSite source frame mismatch");
  let v6Pages:Uint8Array|null=null,v6SourceDigest:string|null=null;
  if(version==="hvp-factory-startsite-v6"){
    const {seedName,registryDigest,sourceDigest,sizeX,sizeY,sizeZ}=source;
    const sourceReadSlot=source.readSlot,copySourceSlots=source.copySlots;
    if(typeof sourceReadSlot!=="function"||typeof copySourceSlots!=="function")throw new Error("CargoSite V6 source readers missing");
    const pages=copySourceSlots.call(source);
    const pageReadSlot=(ix:number,iy:number,iz:number):number=>pages[ix+256*(iy+128*iz)]!;
    const boundPages:HvpCoastSourceSnapshot=Object.freeze({version,seedName,registryDigest,sourceDigest,sizeX,sizeY,sizeZ,cellMeters,
      originMeters:Object.freeze({x:originX,y:originY,z:originZ}),readSlot:pageReadSlot,
      // The synchronous validator receives this same privately-owned page array; Cargo samples use it below too.
      copySlots:()=>pages});
    assertHvpSourceComplete(boundPages);
    v6Pages=pages;
    v6SourceDigest=sourceDigest;
  }
  const read=(x:number,y:number,z:number)=>{const ix=Math.floor((x+16000)/125),iy=Math.floor((y+8000)/125),iz=Math.floor((z+16000)/125);if(ix<0||ix>=256||iy<0||iy>=128||iz<0||iz>=256)throw new Error("CargoSite unknown coverage");if(v6Pages!==null)return v6Pages[ix+256*(iy+128*iz)]!;return source.readSlot(ix,iy,iz);};
  const profile=data(v6SourceDigest??source.sourceDigest);
  for(let z=12687.5;z<13625;z+=125)for(let x=-6187.5;x<-4750;x+=125){if(read(x,1249,z)===0)throw new Error("CargoSite support missing");for(let y=1312.5;y<2750;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite body clearance blocked");}
  for(let z=11687.5;z<12625;z+=125)for(let x=-6187.5;x<-4750;x+=125)for(let y=1562.5;y<3500;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite access blocked");
  for(let z=11565;z<=12185;z+=125)for(let x=-5810;x<=-5190;x+=125)for(let y=1521;y<=3320;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite player hull blocked");
  return freeze({...profile,canonicalJson:canonicalJson(profile),profileDigest:canonicalSignature(profile)});
};
