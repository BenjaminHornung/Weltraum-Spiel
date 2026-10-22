import { assertHvpSourceComplete,restoreHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { describe, expect, it } from "vitest";
import { materializeFactoryStartSite } from "../../../src/factory/fixtures/startSite";
import { materializeFactoryStartSiteV6, readFactorySourceColumnWorldV6 } from "../../../src/factory/fixtures/startSiteV6";
import * as factory from "../../../src/factory/fixtures/startSite";
import { createHash } from "node:crypto";
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

// Original collectable business RED used the previous candidate; final oracle calls actual V3.
const v3Site = () => factory.materializeFactoryStartSiteV3();
it("PLAY01 V3 has its own closed header and exact Owner-approved pages while preserving V1/V2/Coast", () => {
  const site = v3Site();
  expect(site.version).toBe("hvp-factory-startsite-v3");
  expect(createHash("sha256").update(site.copySlots()).digest("hex"))
    .toBe("267230ca09cf7d8a9fa0d6f6bc2e3fac6cc0cd7adaaf2af57c3c24d60a6187d7");
  expect(site.initializationReceipt).toMatchObject({ maskCount: 18, columnCount: 5240, areaMm2: 81875000,
    materialCreditMg: 0, ownerTerrainAcceptance: "OWNER_REVIEW_PENDING" });
  expect(prepareHvpCoastSource(site).sourceDigest).toBe(site.sourceDigest);
  expect(materializeFactoryStartSite().sourceDigest).toBe("e62aea8a");
  expect(factory.materializeFactoryStartSiteV2().sourceDigest).toBe("ec8ba9b1");
  expect(materializeHvpCoastSource().sourceDigest).toBe("b8fde6b0");
  expect(() => assertHvpSourceComplete({ ...site, version: "hvp-factory-startsite-v6" })).toThrow(/source/i);
  expect(() => restoreHvpCoastSource(site.copySlots(), site.sourceDigest)).toThrow(/digest/);
});
it("PLAY01 V3 changes only the additional380 columns and2492 actual slots without material credit", () => {
  const before = factory.materializeFactoryStartSiteV2().copySlots(), site = v3Site(), after = site.copySlots();
  const columns = new Set<number>();
  for (const [x0, x1, z0, z1] of [[54, 56, 180, 222], [54, 56, 104, 164], [68, 70, 124, 212]])
    for (let x = x0!; x < x1!; x++) for (let z = z0!; z < z1!; z++) columns.add(x + 256 * z);
  let changed = 0, added = 0, removed = 0; const changedColumns = new Set<number>();
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) {
    const x = i % 256, z = Math.floor(i / 32768), y = Math.floor(i / 256) % 128;
    expect(columns.has(x + 256 * z)).toBe(true); expect(after[i]).toBe(+(y <= 75));
    changed++; changedColumns.add(x + 256 * z); if (!before[i]) added++; else removed++;
  }
  expect({ changed, added, removed, changedColumns: changedColumns.size, columns: columns.size })
    .toEqual({ changed: 2492, added: 268, removed: 2224, changedColumns: 289, columns: 380 });
  expect(site.initializationReceipt.materialCreditMg).toBe(0);
});

// Collectable RED uses the actual previous generation until the authorized V4 constructor exists.
const v4Site = () => factory.materializeFactoryStartSiteV4();
it("PLAY01 V4 binds its own header to the exact Owner-approved connector pages without legacy migration", () => {
  const site = v4Site();
  expect(site.version).toBe("hvp-factory-startsite-v4");
  expect(site.sourceDigest).toBe("913c0c46");
  expect(createHash("sha256").update(site.copySlots()).digest("hex")).toBe("ea7ccf99cb3ec14f284793664df4535544a76aa7e26a83ff107f98504a1c977d");
  expect(site.sourceDigest).not.toBe("5190c339"); // Offline proposal used the old V3 header.
  expect(site.initializationReceipt).toMatchObject({maskCount:21,columnCount:5688,areaMm2:88875000,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"});
  expect(prepareHvpCoastSource(site).sourceDigest).toBe(site.sourceDigest);
  expect(factory.materializeFactoryStartSiteV3().sourceDigest).toBe("16dbaa28");
  expect(factory.materializeFactoryStartSiteV2().sourceDigest).toBe("ec8ba9b1");
  expect(materializeFactoryStartSite().sourceDigest).toBe("e62aea8a");expect(materializeHvpCoastSource().sourceDigest).toBe("b8fde6b0");
  expect(()=>assertHvpSourceComplete({...site,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);
  expect(()=>restoreHvpCoastSource(site.copySlots(),site.sourceDigest)).toThrow(/digest/);
});
it("PLAY01 V4 changes only the exact448 connector columns and1164 slots with zero material credit", () => {
  const before=factory.materializeFactoryStartSiteV3().copySlots(),site=v4Site(),after=site.copySlots(),columns=new Set<number>();
  for(const [x0,x1,z0,z1] of [[70,74,140,156],[82,98,140,156],[90,98,124,140]])for(let x=x0!;x<x1!;x++)for(let z=z0!;z<z1!;z++)columns.add(x+256*z);
  let changed=0,added=0,removed=0,remapped=0;
  for(let i=0;i<before.length;i++)if(before[i]!==after[i]){
    const x=i%256,z=Math.floor(i/32768),y=Math.floor(i/256)%128;
    expect(columns.has(x+256*z)).toBe(true);expect(after[i]).toBe(+(y<=75));changed++;
    if(!before[i])added++;else if(!after[i])removed++;else remapped++;
  }
  expect({columns:columns.size,changed,added,removed,remapped}).toEqual({columns:448,changed:1164,added:1058,removed:0,remapped:106});
  for(const column of columns)for(let y=0;y<128;y++)expect(site.readSlot(column%256,y,Math.floor(column/256))).toBe(+(y<=75));
  expect(site.initializationReceipt.materialCreditMg).toBe(0);
});

// The preserved initial RED used V4; final verification calls the actual V5 constructor.
const v5Site=()=>factory.materializeFactoryStartSiteV5();
it("PLAY01 V5 binds a separately named generation to the exact approved3m2 raw-band pages",()=>{
 const site=v5Site();expect(site.version).toBe("hvp-factory-startsite-v5");expect(site.sourceDigest).toBe("0e2a0bcb");
 expect(createHash("sha256").update(site.copySlots()).digest("hex")).toBe("106a3c5ba17e7bb8861d853e1889d71ebf42a686f3d0605d0cb8efabb20c7911");
 expect(site.initializationReceipt).toMatchObject({maskCount:23,columnCount:5880,areaMm2:91875000,materialCreditMg:0,ownerTerrainAcceptance:"OWNER_REVIEW_PENDING"});
 expect(()=>assertHvpSourceComplete(site)).not.toThrow();
 expect(factory.materializeFactoryStartSiteV4().sourceDigest).toBe("913c0c46");
 expect(factory.materializeFactoryStartSiteV3().sourceDigest).toBe("16dbaa28");
 expect(factory.materializeFactoryStartSiteV2().sourceDigest).toBe("ec8ba9b1");
 expect(factory.materializeFactoryStartSite().sourceDigest).toBe("e62aea8a");
 expect(materializeHvpCoastSource().sourceDigest).toBe("b8fde6b0");
  expect(()=>assertHvpSourceComplete({...site,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);
});
it("PLAY01 V5 changes only192 approvedcolumns and1246 slots with214add1032remove and0credit",()=>{
 const before=factory.materializeFactoryStartSiteV4().copySlots(),site=v5Site(),after=site.copySlots(),columns=new Set<number>();
 for(const [z0,z1] of [[180,212],[124,140]])for(let z=z0!;z<z1!;z++)for(let x=70;x<74;x++)columns.add(x+256*z);
 let changed=0,added=0,removed=0,remapped=0,dryRemoved=0,soilRemoved=0;const changedColumns=new Set<number>();
 for(let i=0;i<before.length;i++)if(before[i]!==after[i]){
  const x=i%256,z=Math.floor(i/32768),y=Math.floor(i/256)%128;
  expect(columns.has(x+256*z)).toBe(true);expect(after[i]).toBe(+(y<=75));changed++;changedColumns.add(x+256*z);
  if(!before[i])added++;else if(!after[i]){removed++;if(before[i]===1)dryRemoved++;if(before[i]===3)soilRemoved++;}else remapped++;
 }
 expect({columns:columns.size,changedColumns:changedColumns.size,changed,added,removed,remapped,dryRemoved,soilRemoved})
  .toEqual({columns:192,changedColumns:185,changed:1246,added:214,removed:1032,remapped:0,dryRemoved:1018,soilRemoved:14});
 for(const c of columns)for(let y=0;y<128;y++)expect(site.readSlot(c%256,y,Math.floor(c/256))).toBe(+(y<=75));
 expect(site.initializationReceipt.materialCreditMg).toBe(0);
});

it("V6 layers only the two approved masks over byte-identical V5 pages and rejects a renamed V5 source",()=>{
 const parent=factory.materializeFactoryStartSiteV5(),site=materializeFactoryStartSiteV6();
 const before=parent.copySlots(),after=site.copySlots();
 expect(parent.sourceDigest).toBe("0e2a0bcb");expect(factory.materializeFactoryStartSiteV5().sourceDigest).toBe("0e2a0bcb");
 expect(site.version).toBe("hvp-factory-startsite-v6");
 expect(site.sourceDigest).not.toBe(parent.sourceDigest);
 expect(site.initializationReceipt).toMatchObject({baseVersion:"hvp-factory-startsite-v5",addedMaskCount:2,
   addedColumnCount:11240,changedColumnCount:11145,changedSlotCount:124974,addedAreaMm2:175625000,materialCreditMg:0});
 expect(()=>assertHvpSourceComplete(site)).not.toThrow();
 expect(()=>assertHvpSourceComplete({...parent,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);

 const inV6Mask=(x:number,z:number)=>(x>=-2&&x<14.5&&z>=3.5&&z<13.75)
   ||(x>=-5.25&&x<-1.75&&z>=10.5&&z<12.5);
 let changedSlots=0;const changedColumns=new Set<number>();
 for(let index=0;index<before.length;index++)if(before[index]!==after[index]){
   const x=index%256,y=Math.floor(index/256)%128,z=Math.floor(index/(256*128));
   expect(inV6Mask(-16+(x+.5)*.125,-16+(z+.5)*.125)).toBe(true);
   expect(after[index]).toBe(y<=75?1:0);
   changedSlots++;changedColumns.add(x+256*z);
 }
 expect({changedColumns:changedColumns.size,changedSlots}).toEqual({changedColumns:11145,changedSlots:124974});

 const v5Read=factory.readFactorySourceColumnWorldV5;
 expect(readFactorySourceColumnWorldV6(-2,3.5)).toEqual({topMeters:1.5,slot:1});
 expect(readFactorySourceColumnWorldV6(14.5,3.5)).toEqual(v5Read(14.5,3.5));
 expect(readFactorySourceColumnWorldV6(-5.25,10.5)).toEqual({topMeters:1.5,slot:1});
 expect(readFactorySourceColumnWorldV6(-5.25,12.5)).toEqual(v5Read(-5.25,12.5));
 expect(prepareHvpCoastSource(site).sourceDigest).toBe(site.sourceDigest);
});
