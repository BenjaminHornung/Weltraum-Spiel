import { assertHvpSourceComplete,restoreHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { describe, expect, it } from "vitest";
import { materializeFactoryStartSite } from "../../../src/factory/fixtures/startSite";
import * as factory from "../../../src/factory/fixtures/startSite";
import { materializeHvpCoastSource, prepareHvpCoastSource } from "../../../src/hvp/hvpCoastSource";

describe("W07 approved Factory initial source", () => {
  it("binds its own actual header and the unchanged 125mm bounded authority", () => {
    const site = materializeFactoryStartSite();
    expect(site).toMatchObject({ version: "hvp-factory-startsite-v1", seedName: "hestia-factory-layout-a-001", cellMeters: .125, sizeX: 256, sizeY: 128, sizeZ: 256 });
    expect(prepareHvpCoastSource(site).sourceDigest).toBe(site.sourceDigest);
    expect(site.sourceDigest).not.toBe("b8fde6b0");
  });
  it("changes exactly4480 approved columns, without levelling the whole boundingbox or crediting inventory", () => {
    const parent = materializeHvpCoastSource(), site = materializeFactoryStartSite();
    const before = parent.copySlots(), after = site.copySlots();
    let removed = 0, added = 0, replaced = 0;
    for (let i = 0; i < before.length; ++i) if (before[i] !== after[i]) {
      if (before[i] && !after[i]) removed++; else if (!before[i] && after[i]) added++; else replaced++;
    }
    expect({ removed, added, replaced }).toEqual({ removed: 23116, added: 3934, replaced: 709 });
    expect(site.initializationReceipt).toMatchObject({ maskCount: 15, columnCount: 4480, areaMm2: 70_000_000, materialCreditMg: 0 });
    expect(site.readSlot(78, 75, 168)).toBe(1);
    expect(site.readSlot(78, 76, 168)).toBe(0);
    expect(site.readSlot(255, 127, 255)).toBe(parent.readSlot(255, 127, 255));
    expect(parent.sourceDigest).toBe("b8fde6b0");
  });
});


it("W07 Source frame admission rejects changed World origins without opening legacy restore",()=>{
  const source=materializeFactoryStartSite();
  expect(()=>assertHvpSourceComplete({...source,originMeters:{x:0,y:-8,z:-16}})).toThrow(/origin|frame/);
  expect(()=>restoreHvpCoastSource(source.copySlots(),source.sourceDigest)).toThrow(/digest/);
});

// The original collectable RED used the V1 constructor fallback; final tests call the actual V2 constructor.
const candidateSite=()=>factory.materializeFactoryStartSiteV2();
it("PLAY01 candidate binds a separate V2 header while Coast and approved V1 stay identical",()=>{
 const candidate=candidateSite(),approved=materializeFactoryStartSite(),coast=materializeHvpCoastSource();
 expect(candidate.version).toBe("hvp-factory-startsite-v2");
 expect(candidate.sourceDigest).toBe("ec8ba9b1");
 expect(candidate.initializationReceipt).toMatchObject({maskCount:18,columnCount:4860,areaMm2:75937500,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"});
 expect(prepareHvpCoastSource(candidate).sourceDigest).toBe(candidate.sourceDigest);
 expect(approved.sourceDigest).toBe("e62aea8a");expect(coast.sourceDigest).toBe("b8fde6b0");
 expect(()=>restoreHvpCoastSource(candidate.copySlots(),candidate.sourceDigest)).toThrow(/digest/);
});
it("PLAY01 candidate changes only the exact380 shoulder columns and2890 slot bytes without a material credit",()=>{
 const before=materializeFactoryStartSite().copySlots(),candidate=candidateSite(),after=candidate.copySlots();
 const expectedColumns=new Set<number>();for(const [x0,x1,z0,z1] of [[56,58,180,222],[56,58,104,164],[66,68,124,212]])for(let z=z0!;z<z1!;z++)for(let x=x0!;x<x1!;x++)expectedColumns.add(x+256*z);
 let changed=0,added=0,removed=0,replaced=0;const changedColumns=new Set<number>();
 for(let i=0;i<before.length;i++)if(before[i]!==after[i]){changed++;const x=i%256,z=Math.floor(i/(256*128)),y=Math.floor(i/256)%128;changedColumns.add(x+256*z);expect(expectedColumns.has(x+256*z)).toBe(true);expect(after[i]).toBe(y<=75?1:0);if(!before[i]&&after[i])added++;else if(before[i]&&!after[i])removed++;else replaced++;}
 expect({changed,added,removed,replaced}).toEqual({changed:2890,added:264,removed:2626,replaced:0});
 //380 columns are addressed; some already have exactly this geology and need no byte changes.
 expect(expectedColumns.size).toBe(380);expect(changedColumns.size).toBe(297);
 for(const column of expectedColumns){const x=column%256,z=Math.floor(column/256);for(let y=0;y<128;y++)expect(candidate.readSlot(x,y,z)).toBe(y<=75?1:0);}
 expect(candidate.initializationReceipt.materialCreditMg).toBe(0);
});
