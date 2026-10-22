import {
  createHvpFactorySourceSnapshotV6,
  type HvpCoastSourceSnapshot,
  type HvpSourceColumn
} from "../../hvp/hvpCoastSource";
import { materializeFactoryStartSiteV5, readFactorySourceColumnWorldV5 } from "./startSite";

type XzMask = readonly [minX: number, maxX: number, minZ: number, maxZ: number];

/** Closed V6-only world X/Z rectangles; half-open bounds prevent edge drift. */
export const FACTORY_START_SITE_V6_ADDITIONS: readonly XzMask[] = Object.freeze([
  Object.freeze([-2, 14.5, 3.5, 13.75] as const),
  Object.freeze([-5.25, -1.75, 10.5, 12.5] as const)
]);

const inFactoryStartSiteV6Addition = (x: number, z: number): boolean =>
  FACTORY_START_SITE_V6_ADDITIONS.some(([minX, maxX, minZ, maxZ]) =>
    x >= minX && x < maxX && z >= minZ && z < maxZ);

export const readFactorySourceColumnWorldV6 = (x: number, z: number): HvpSourceColumn =>
  inFactoryStartSiteV6Addition(x, z)
    ? Object.freeze({ topMeters: 1.5, slot: 1 })
    : readFactorySourceColumnWorldV5(x, z);

export interface FactoryStartSiteV6 extends HvpCoastSourceSnapshot {
  readonly initializationReceipt: Readonly<{
    baseVersion: "hvp-factory-startsite-v5";
    addedMaskCount: 2;
    addedColumnCount: 11240;
    changedColumnCount: 11145;
    changedSlotCount: 124974;
    addedAreaMm2: 175625000;
    materialCreditMg: 0;
    ownerTerrainAcceptance: "OWNER_REVIEW_PENDING";
  }>;
}

/** Adds only the reviewed V6 site masks on top of exact V5 pages; no resource owner or credit is created. */
export const materializeFactoryStartSiteV6 = (): FactoryStartSiteV6 => {
  const previous = materializeFactoryStartSiteV5();
  if (previous.sourceDigest !== "0e2a0bcb") throw new Error("Factory V6 candidate parent source changed");

  const slots = previous.copySlots();
  let addedColumns = 0;
  let changedColumns = 0;
  let changedSlots = 0;
  for (let iz = 0; iz < 256; iz += 1) {
    const worldZ = -16 + (iz + 0.5) * 0.125;
    for (let ix = 0; ix < 256; ix += 1) {
      const worldX = -16 + (ix + 0.5) * 0.125;
      if (!inFactoryStartSiteV6Addition(worldX, worldZ)) continue;

      addedColumns += 1;
      let columnChanged = false;
      for (let iy = 0; iy < 128; iy += 1) {
        const index = ix + 256 * (iy + 128 * iz);
        const next = iy <= 75 ? 1 : 0;
        if (slots[index] !== next) {
          changedSlots += 1;
          columnChanged = true;
          slots[index] = next;
        }
      }
      if (columnChanged) changedColumns += 1;
    }
  }
  if (addedColumns !== 11240 || changedColumns !== 11145 || changedSlots !== 124974) {
    throw new Error("Factory V6 additive masks changed");
  }

  return Object.freeze({
    ...createHvpFactorySourceSnapshotV6(slots),
    initializationReceipt: Object.freeze({
      baseVersion: "hvp-factory-startsite-v5",
      addedMaskCount: 2,
      addedColumnCount: 11240,
      changedColumnCount: 11145,
      changedSlotCount: 124974,
      addedAreaMm2: 175625000,
      materialCreditMg: 0,
      ownerTerrainAcceptance: "OWNER_REVIEW_PENDING"
    })
  });
};
