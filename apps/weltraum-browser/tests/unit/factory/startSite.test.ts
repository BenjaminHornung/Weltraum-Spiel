import { assertHvpSourceComplete,restoreHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { describe, expect, it } from "vitest";
import { materializeFactoryStartSite } from "../../../src/factory/fixtures/startSite";
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
