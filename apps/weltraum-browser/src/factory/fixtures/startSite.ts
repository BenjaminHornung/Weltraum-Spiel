import { createHvpFactorySourceSnapshot, createHvpFactorySourceSnapshotV2, materializeHvpCoastSource, readHvpSourceColumnWorld, type HvpCoastSourceSnapshot, type HvpSourceColumn } from "../../hvp/hvpCoastSource";

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
