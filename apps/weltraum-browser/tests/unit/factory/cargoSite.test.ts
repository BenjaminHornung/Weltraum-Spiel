import { beforeAll,expect,it } from "vitest";
import { createFactoryFacilitySession } from "../../../src/hestia-prototype/physics/factoryFacilitySession";
import { R,initializeHvpRapier } from "../../../src/hestia-prototype/physics/rapierPort";
import { createFactoryCargoSite,assertFactoryCargoSite } from "../../../src/factory/fixtures/cargoSite";
import { materializeFactoryStartSite,materializeFactoryStartSiteV2 } from "../../../src/factory/fixtures/startSite";
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
 expect(()=>createFactoryCargoSite({...source,version:"hvp-factory-startsite-v3"})).toThrow(/frame/);
 expect(()=>createFactoryCargoSite({...source,originMeters:{x:-16,y:0,z:-16}})).toThrow(/frame/);
});
