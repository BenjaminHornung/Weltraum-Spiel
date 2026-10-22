import { beforeAll,expect,it } from "vitest";
import { createFactoryFacilitySession } from "../../../src/hestia-prototype/physics/factoryFacilitySession";
import { R,initializeHvpRapier } from "../../../src/hestia-prototype/physics/rapierPort";
import { createFactoryCargoSite,assertFactoryCargoSite } from "../../../src/factory/fixtures/cargoSite";
import { materializeFactoryStartSite,materializeFactoryStartSiteV2,materializeFactoryStartSiteV3,materializeFactoryStartSiteV4,materializeFactoryStartSiteV5 } from "../../../src/factory/fixtures/startSite";
import { materializeFactoryStartSiteV6 } from "../../../src/factory/fixtures/startSiteV6";
import { createHvpFactorySourceSnapshotV6 } from "../../../src/hvp/hvpCoastSource";
it("W07 initial Cargo binds one actual source-owner outside the machine zone, not a player-relative point",()=>{
 const source=materializeFactoryStartSite();
 expect(createFactoryCargoSite(source)).toBeDefined();
});

beforeAll(initializeHvpRapier);
it("W07 native Cargo exact repeated Open is idempotent, remote actors never claim access",()=>{
 const site=createFactoryCargoSite(materializeFactoryStartSite()),world=new R.World({x:0,y:-9.81,z:0});
 try{world.createCollider(R.ColliderDesc.cuboid(2,.125,2).setTranslation(-5.5,1.125,13));world.updateSceneQueries();
 let actor={x:-5.5,y:2.42,z:11.875};const facilities=createFactoryFacilitySession(world,()=>true,()=>0,()=>0,site,()=>actor);
 const before=facilities.read();expect(before.cargo).toMatchObject({opened:false,accessible:true,ownerId:"fp02_wreck_owner"});expect(world.bodies.len()).toBe(1);expect(world.colliders.len()).toBe(2);
 const intent={ownerId:site.ownerId,profileDigest:site.profileDigest,expectedTerrainRevision:0,expectedRevision:0};facilities.openCargo(intent);expect(facilities.read().cargo?.opened).toBe(true);
 expect(()=>facilities.openCargo(intent)).not.toThrow();expect(facilities.read().revision).toBe(1);
 actor={x:-5.5,y:2.42,z:5};expect(facilities.read().cargo?.accessible).toBe(false);expect(()=>facilities.openCargo({...intent,expectedRevision:1})).toThrow(/OutOfReach/);expect(facilities.read().revision).toBe(1);
 }finally{world.free();}
});
it("W07 initial Cargo refuses missing actual native support before allocating a source body",()=>{
 const site=createFactoryCargoSite(materializeFactoryStartSite()),world=new R.World({x:0,y:-9.81,z:0});try{expect(()=>createFactoryFacilitySession(world,()=>true,()=>0,()=>0,site)).toThrow(/SupportOrClearance/);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);}finally{world.free();}
});
it("W07 source Cargo keeps closed canonical geometry, and rejects modified pose or source slots",()=>{
 const source=materializeFactoryStartSite(),site=createFactoryCargoSite(source);expect(site.boundsMm.min[2]).toBeGreaterThan(12500);expect(Object.isFrozen(site.centerMm)).toBe(true);
 expect(()=>assertFactoryCargoSite({...site,centerMm:[0,2000,13125]})).toThrow(/geometry/);
 expect(()=>createFactoryCargoSite({...source,readSlot:()=>0})).toThrow(/support/);
});
it("PLAY01 V2 Cargo binds the new real source while preserving the exact V1 geometry and ownership",()=>{
 const v1=createFactoryCargoSite(materializeFactoryStartSite()),source=materializeFactoryStartSiteV2(),v2=createFactoryCargoSite(source);
 expect(v2.sourceDigest).toBe(source.sourceDigest);expect(v2.profileDigest).not.toBe(v1.profileDigest);
 for(const key of ["version","ownerId","containerId","centerMm","sizeMm","boundsMm","accessPointMm","accessBoundsMm","spawnMm","geometryPolicy","sourceRefs"] as const)expect(v2[key]).toEqual(v1[key]);
 expect(()=>assertFactoryCargoSite(v2)).not.toThrow();
 expect(()=>createFactoryCargoSite({...source,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);
 expect(()=>createFactoryCargoSite({...source,originMeters:{x:-16,y:0,z:-16}})).toThrow(/frame/);
});
it("PLAY01 V3 Cargo binds exact new source pages with unchanged original owner/body/support/access geometry", () => {
 const source=materializeFactoryStartSiteV3(),v3=createFactoryCargoSite(source),v1=createFactoryCargoSite(materializeFactoryStartSite());
 expect(v3.sourceDigest).toBe(source.sourceDigest);expect(v3.profileDigest).not.toBe(v1.profileDigest);
 for(const key of ["version","ownerId","containerId","centerMm","sizeMm","boundsMm","accessPointMm","accessBoundsMm","spawnMm","geometryPolicy","sourceRefs"] as const)expect(v3[key]).toEqual(v1[key]);
 expect(()=>assertFactoryCargoSite(v3)).not.toThrow();
  expect(()=>createFactoryCargoSite({...source,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);
 expect(()=>createFactoryCargoSite({...source,originMeters:{x:0,y:-8,z:-16}})).toThrow(/frame/);
});

it("PLAY01 V4 Cargo binds exact new source pages with unchanged original owner/body/support/access geometry", () => {
 const source=materializeFactoryStartSiteV4(),v4=createFactoryCargoSite(source),v1=createFactoryCargoSite(materializeFactoryStartSite());
 expect(v4.sourceDigest).toBe(source.sourceDigest);expect(v4.profileDigest).not.toBe(v1.profileDigest);
 for(const key of ["version","ownerId","containerId","centerMm","sizeMm","boundsMm","accessPointMm","accessBoundsMm","spawnMm","geometryPolicy","sourceRefs"] as const)expect(v4[key]).toEqual(v1[key]);
 expect(()=>assertFactoryCargoSite(v4)).not.toThrow();
 expect(()=>createFactoryCargoSite({...source,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);
 expect(()=>createFactoryCargoSite({...source,originMeters:{x:0,y:-8,z:-16}})).toThrow(/frame/);
});
it("B1 V6 Cargo keeps the exact V5 Cargo S0 and rejects V5 pages renamed with a V6 header",()=>{
 const v5Source=materializeFactoryStartSiteV5(),v6Source=materializeFactoryStartSiteV6();
 const v5=createFactoryCargoSite(v5Source),v6=createFactoryCargoSite(v6Source);
 expect(v5Source.sourceDigest).toBe("0e2a0bcb");
 expect(v6.sourceDigest).toBe(v6Source.sourceDigest);
 expect(v6.profileDigest).not.toBe(v5.profileDigest);
 for(const key of ["version","ownerId","containerId","centerMm","sizeMm","boundsMm","accessPointMm","accessBoundsMm","spawnMm","geometryPolicy","sourceRefs"] as const)
  expect(v6[key]).toEqual(v5[key]);
 expect(()=>createFactoryCargoSite({...v5Source,version:"hvp-factory-startsite-v6"})).toThrow(/source/i);

 const ix=Math.floor((-6187.5+16000)/125),iy=Math.floor((1249+8000)/125),iz=Math.floor((12687.5+16000)/125);
 expect(v6Source.readSlot(ix,iy,iz)).toBeGreaterThan(0);
 const blockedPages=v6Source.copySlots();blockedPages[ix+256*(iy+128*iz)]=0;
 const validBlockedV6=createHvpFactorySourceSnapshotV6(blockedPages);
 expect(validBlockedV6.readSlot(ix,iy,iz)).toBe(0);
 expect(()=>createFactoryCargoSite({...validBlockedV6,readSlot:v6Source.readSlot})).toThrow(/support/i);

 let versionReads=0;
 const changingVersionSource={...validBlockedV6,readSlot:v6Source.readSlot,
  get version(){versionReads+=1;return versionReads===1?"hvp-factory-startsite-v6":"hvp-factory-startsite-v5";}};
 expect(()=>createFactoryCargoSite(changingVersionSource)).toThrow(/support/i);
 expect(versionReads).toBe(1);

 let digestReads=0;
 const changingDigestSource={...v6Source,get sourceDigest(){digestReads+=1;return digestReads===1?v6Source.sourceDigest:"deadbeef";}};
 const getterCargo=createFactoryCargoSite(changingDigestSource);
 expect(getterCargo.sourceDigest).toBe(v6Source.sourceDigest);
 expect(getterCargo.profileDigest).toBe(v6.profileDigest);
 expect(digestReads).toBe(1);
});
