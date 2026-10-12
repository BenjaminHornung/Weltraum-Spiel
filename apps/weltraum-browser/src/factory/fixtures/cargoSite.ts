import type { HvpCoastSourceSnapshot } from "../../hvp/hvpCoastSource";
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
  if((source.version!=="hvp-factory-startsite-v1"&&source.version!=="hvp-factory-startsite-v2")||source.originMeters.x!==-16||source.originMeters.y!==-8||source.originMeters.z!==-16||source.cellMeters!==.125)throw new Error("CargoSite source frame mismatch");
  const read=(x:number,y:number,z:number)=>{const ix=Math.floor((x+16000)/125),iy=Math.floor((y+8000)/125),iz=Math.floor((z+16000)/125);if(ix<0||ix>=256||iy<0||iy>=128||iz<0||iz>=256)throw new Error("CargoSite unknown coverage");return source.readSlot(ix,iy,iz);};
  const profile=data(source.sourceDigest);
  for(let z=12687.5;z<13625;z+=125)for(let x=-6187.5;x<-4750;x+=125){if(read(x,1249,z)===0)throw new Error("CargoSite support missing");for(let y=1312.5;y<2750;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite body clearance blocked");}
  for(let z=11687.5;z<12625;z+=125)for(let x=-6187.5;x<-4750;x+=125)for(let y=1562.5;y<3500;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite access blocked");
  for(let z=11565;z<=12185;z+=125)for(let x=-5810;x<=-5190;x+=125)for(let y=1521;y<=3320;y+=125)if(read(x,y,z)!==0)throw new Error("CargoSite player hull blocked");
  return freeze({...profile,canonicalJson:canonicalJson(profile),profileDigest:canonicalSignature(profile)});
};
