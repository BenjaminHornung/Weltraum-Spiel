import { createHvpFactorySourceSnapshot, createHvpFactorySourceSnapshotV2, createHvpFactorySourceSnapshotV3, createHvpFactorySourceSnapshotV4, createHvpFactorySourceSnapshotV5, materializeHvpCoastSource, readHvpSourceColumnWorld, type HvpCoastSourceSnapshot, type HvpSourceColumn } from "../../hvp/hvpCoastSource";

/** Half-open East/North masks: the approved union, never its bounding rectangle. */
export const FACTORY_START_SITE_MASKS = Object.freeze([
  [0, 2, 5, 7], [6, 9, 5, 7], [13, 17, 4.5, 7.5], [17, 19, 5, 7], [6, 8, 1.5, 2.5],
  [2, 6, 5.5, 6.5], [9, 13, 5.5, 6.5], [9, 11, 9.5, 10.5], [6, 9, 7, 8],
  [13, 17, 7.5, 8.5], [6, 8, 2.5, 3.5], [0, 2, 4, 5], [17, 19, 4, 5], [9, 11, 8.5, 9.5], [0, 19, 3.5, 4.5]
].map(mask => Object.freeze(mask)));
export const inFactoryStartSite = (x: number, z: number): boolean => {
  const east = 12.5 - z, north = x + 12.25;
  return FACTORY_START_SITE_MASKS.some(([e0, e1, n0, n1]) => east >= e0! && east < e1! && north >= n0! && north < n1!);
};
export const readFactorySourceColumnWorld = (x: number, z: number): HvpSourceColumn =>
  inFactoryStartSite(x, z) ? Object.freeze({ topMeters: 1.5, slot: 1 }) : readHvpSourceColumnWorld(x, z);
export interface FactoryStartSite extends HvpCoastSourceSnapshot {
  readonly initializationReceipt: Readonly<{ maskCount: 15; columnCount: 4480; areaMm2: 70000000; materialCreditMg: 0 }>;
}
/** Initial geology, not mining/building: this function owns no Resources and grants no material. */
export const materializeFactoryStartSite = (): FactoryStartSite => {
  const parent = materializeHvpCoastSource();
  if (parent.sourceDigest !== "b8fde6b0") throw new Error("Factory site parent source changed");
  const slots = parent.copySlots(); let columns = 0;
  for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) {
    if (!inFactoryStartSite(-16 + (x + .5) * .125, -16 + (z + .5) * .125)) continue;
    columns++;
    for (let y = 0; y < 128; y++) slots[x + 256 * (y + 128 * z)] = y <= 75 ? 1 : 0;
  }
  if (columns !== 4480) throw new Error("Factory site mask changed");
  return Object.freeze({ ...createHvpFactorySourceSnapshot(slots), initializationReceipt: Object.freeze({ maskCount: 15, columnCount: 4480, areaMm2: 70000000, materialCreditMg: 0 }) });
};

/** Exact three isolated candidate shoulders. The approved V1 union remains unchanged. */
export const FACTORY_START_SITE_V2_ADDITIONS = Object.freeze([
  [.75, 6, 3.25, 3.5], [8, 15.5, 3.25, 3.5], [2, 13, 4.5, 4.75]
].map(mask => Object.freeze(mask)));
const inFactoryV2Addition=(x:number,z:number):boolean=>{
  const east=12.5-z,north=x+12.25;
  return FACTORY_START_SITE_V2_ADDITIONS.some(([e0,e1,n0,n1])=>east>=e0!&&east<e1!&&north>=n0!&&north<n1!);
};
export const readFactorySourceColumnWorldV2=(x:number,z:number):HvpSourceColumn=>
  inFactoryStartSite(x,z)||inFactoryV2Addition(x,z)?Object.freeze({topMeters:1.5,slot:1}):readHvpSourceColumnWorld(x,z);
export interface FactoryStartSiteV2 extends HvpCoastSourceSnapshot {
  readonly initializationReceipt:Readonly<{maskCount:18;columnCount:4860;areaMm2:75937500;materialCreditMg:0;ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"}>;
}
/** Different initial geology only: no Resources allocation, work or mining credit. */
export const materializeFactoryStartSiteV2=():FactoryStartSiteV2=>{
  const approved=materializeFactoryStartSite();
  if(approved.sourceDigest!=="e62aea8a")throw new Error("Factory V2 candidate parent source changed");
  const slots=approved.copySlots();let columns=0;
  for(let z=0;z<256;z++)for(let x=0;x<256;x++){
    if(!inFactoryV2Addition(-16+(x+.5)*.125,-16+(z+.5)*.125))continue;
    columns++;for(let y=0;y<128;y++)slots[x+256*(y+128*z)]=y<=75?1:0;
  }
  if(columns!==380)throw new Error("Factory V2 candidate shoulder masks changed");
  return Object.freeze({...createHvpFactorySourceSnapshotV2(slots),initializationReceipt:Object.freeze({maskCount:18,columnCount:4860,areaMm2:75937500,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"})});
};

/** Owner approved these three wider candidate bands; final terrain acceptance remains pending. */
export const FACTORY_START_SITE_V3_ADDITIONS = Object.freeze([
  [.75, 6, 3, 3.5], [8, 15.5, 3, 3.5], [2, 13, 4.5, 5]
].map(mask => Object.freeze(mask)));
const inFactoryV3Addition = (x: number, z: number): boolean => {
  const east = 12.5 - z, north = x + 12.25;
  return FACTORY_START_SITE_V3_ADDITIONS.some(([e0, e1, n0, n1]) => east >= e0! && east < e1! && north >= n0! && north < n1!);
};
export const readFactorySourceColumnWorldV3 = (x: number, z: number): HvpSourceColumn =>
  inFactoryStartSite(x, z) || inFactoryV3Addition(x, z) ? Object.freeze({ topMeters: 1.5, slot: 1 }) : readHvpSourceColumnWorld(x, z);
export interface FactoryStartSiteV3 extends HvpCoastSourceSnapshot {
  readonly initializationReceipt: Readonly<{ maskCount: 18; columnCount: 5240; areaMm2: 81875000;
    materialCreditMg: 0; ownerTerrainAcceptance: "OWNER_REVIEW_PENDING" }>;
}
/** Initial-source generation only, never replacement/migration of a live or saved World. */
export const materializeFactoryStartSiteV3 = (): FactoryStartSiteV3 => {
  const previous = materializeFactoryStartSiteV2();
  if (previous.sourceDigest !== "ec8ba9b1") throw new Error("Factory V3 candidate parent source changed");
  const slots = previous.copySlots(); let columns = 0;
  for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) {
    if (!inFactoryV3Addition(-16 + (x + .5) * .125, -16 + (z + .5) * .125)) continue;
    columns++;
    for (let y = 0; y < 128; y++) slots[x + 256 * (y + 128 * z)] = y <= 75 ? 1 : 0;
  }
  if (columns !== 760) throw new Error("Factory V3 candidate shoulder masks changed");
  return Object.freeze({ ...createHvpFactorySourceSnapshotV3(slots), initializationReceipt: Object.freeze({
    maskCount: 18, columnCount: 5240, areaMm2: 81875000, materialCreditMg: 0, ownerTerrainAcceptance: "OWNER_REVIEW_PENDING" }) });
};

/** Exact separately approved seven-square-metre initial connector union. */
export const FACTORY_START_SITE_V4_CONNECTORS = Object.freeze([
  [9, 11, 5, 5.5], [9, 11, 6.5, 8.5], [11, 13, 7.5, 8.5]
].map(mask => Object.freeze(mask)));
const inFactoryV4Connector = (x: number, z: number): boolean => {
  const east=12.5-z,north=x+12.25;
  return FACTORY_START_SITE_V4_CONNECTORS.some(([e0,e1,n0,n1])=>east>=e0!&&east<e1!&&north>=n0!&&north<n1!);
};
export const readFactorySourceColumnWorldV4 = (x: number, z: number): HvpSourceColumn =>
  inFactoryV4Connector(x,z)?Object.freeze({topMeters:1.5,slot:1}):readFactorySourceColumnWorldV3(x,z);
export interface FactoryStartSiteV4 extends HvpCoastSourceSnapshot {
  readonly initializationReceipt:Readonly<{maskCount:21;columnCount:5688;areaMm2:88875000;materialCreditMg:0;ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"}>;
}
/** New initial generation only; this owns no World mutation or Resources credit. */
export const materializeFactoryStartSiteV4 = (): FactoryStartSiteV4 => {
  const previous=materializeFactoryStartSiteV3();
  if(previous.sourceDigest!=="16dbaa28")throw new Error("Factory V4 candidate parent source changed");
  const slots=previous.copySlots();let columns=0;
  for(let z=0;z<256;z++)for(let x=0;x<256;x++){
    if(!inFactoryV4Connector(-16+(x+.5)*.125,-16+(z+.5)*.125))continue;
    columns++;for(let y=0;y<128;y++)slots[x+256*(y+128*z)]=y<=75?1:0;
  }
  if(columns!==448)throw new Error("Factory V4 candidate connector masks changed");
  return Object.freeze({...createHvpFactorySourceSnapshotV4(slots),initializationReceipt:Object.freeze({maskCount:21,columnCount:5688,areaMm2:88875000,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"})});
};

/** Exactly the separately Owner-approved three-square-metre raw-band strips. */
export const FACTORY_START_SITE_V5_RAW_BAND_FLOORS=Object.freeze([[2,6,5,5.5],[11,13,5,5.5]].map(mask=>Object.freeze(mask)));
const inFactoryV5RawBandFloor=(x:number,z:number):boolean=>{
 const east=12.5-z,north=x+12.25;
 return FACTORY_START_SITE_V5_RAW_BAND_FLOORS.some(([e0,e1,n0,n1])=>east>=e0!&&east<e1!&&north>=n0!&&north<n1!);
};
export const readFactorySourceColumnWorldV5=(x:number,z:number):HvpSourceColumn=>
 inFactoryV5RawBandFloor(x,z)?Object.freeze({topMeters:1.5,slot:1}):readFactorySourceColumnWorldV4(x,z);
export interface FactoryStartSiteV5 extends HvpCoastSourceSnapshot {
 readonly initializationReceipt:Readonly<{maskCount:23;columnCount:5880;areaMm2:91875000;materialCreditMg:0;ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"}>;
}
/** A new initial generation only: no live replacement, restore migration or Resources credit. */
export const materializeFactoryStartSiteV5=():FactoryStartSiteV5=>{
 const previous=materializeFactoryStartSiteV4();if(previous.sourceDigest!=="913c0c46")throw Error("Factory V5 candidate parent source changed");
 const slots=previous.copySlots();let columns=0;
 for(let z=0;z<256;z++)for(let x=0;x<256;x++){
  if(!inFactoryV5RawBandFloor(-16+(x+.5)*.125,-16+(z+.5)*.125))continue;
  columns++;for(let y=0;y<128;y++)slots[x+256*(y+128*z)]=y<=75?1:0;
 }
 if(columns!==192)throw Error("Factory V5 raw-band masks changed");
 return Object.freeze({...createHvpFactorySourceSnapshotV5(slots),initializationReceipt:Object.freeze({maskCount:23,columnCount:5880,areaMm2:91875000,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"})});
};
