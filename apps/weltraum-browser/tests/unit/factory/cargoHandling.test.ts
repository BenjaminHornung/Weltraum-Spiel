import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { readCargoHandlingProfile } from "../../../src/factory/construction/cargoHandlingProfile";
import { createFactoryHandling, prepareCargoHandling, type CargoHandlingIntent } from "../../../src/factory/session/cargoHandling";
import { commitFactoryMaterialStep, prepareFactoryMaterialStep, createFactoryMaterialView } from "../../../src/factory/material/reservations";
import { readMaterialMassMg } from "../../../src/factory/material/resourcesAdapter";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";

const fixture = createFp02Fixture("cargo");
it.each([["CABLE4750",4750,4750/4*1000],["CABLE8000",8000,2000000]] as const)("binds the concretely needed %s Source-layout connection to one indivisible cable job",(id,quantity,mass)=>{
 const profile=readCargoHandlingProfile(fixture.catalog,id);
 expect(profile).toMatchObject({terms:[{itemId:"fp02.comp.field_cable",quantityUnits:quantity}],massMg:mass,sizeMm:[500,1000,500]});
 expect(readCargoHandlingProfile(fixture.catalog,"CABLE4760")).toBeUndefined();
 expect(readCargoHandlingProfile(fixture.catalog,"CABLE40")?.terms[0]?.quantityUnits).toBe(40000);
});
const setup = () => createFactoryMaterialView(fixture.catalog, [
  createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, fixture.catalog.resources),
  createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: "factory_carrier", kind: "OutpostStorage", maxMassKg: 341, maxVolumeM3: 1.5, maxStackCount: 20 }),
    createResourceContainerState({ containerId: "factory_carrier", ownerId: fixture.resourceState.ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources)
]);
const chassis = fixture.resourceState.contents.find(s => s.resourceId === "fp02_chassis_former")!;
const intent: CargoHandlingIntent = { commandId: "pickup_former_1", ownerId: fixture.resourceState.ownerId!, actorId: fixture.resourceState.ownerId!, expectedMaterialRevision: 0,
  profileId: "C27-PACK", carrierContainerId: "factory_carrier", sourceLots: [{ containerId: fixture.resourceState.containerId, stackId: chassis.stackId, quantityUnits: 1 }] };

describe("W09 closed paid cargo custody", () => {
  it("binds the complete indivisible 300kg C27 pack to a declared technical S0 envelope", () => {
    expect(readCargoHandlingProfile(fixture.catalog, "C27-PACK")).toMatchObject({ version: "fp06-handling-s0-v1", massMg: 300_000_000,
      capacityMm3: 1_400_000_000, sizeMm: [1000, 1000, 1500], terms: [{ itemId: "fp02.chassis.former", quantityUnits: 1 }] });
  });
  it("binds every actual 341kg Former BOM term without inventing a carrier item", () => {
    const profile = readCargoHandlingProfile(fixture.catalog, "B07-BOM");
    expect(profile?.massMg).toBe(341_000_000);
    expect(profile?.terms).toEqual(fixture.catalog.devices.find(d => d.sourceId === "B07")!.bom);
    expect(profile?.capacityMm3).toBe(1_496_916_667);
  });
  it("moves the single real C27 into custody once, preserves mass/instance lineage, and rejects a stale second pickup", () => {
    const before = setup(), beforeMass = readMaterialMassMg(before);
    const plan = prepareCargoHandling(before, intent);
    expect(plan.status).toBe("Prepared"); if (plan.status !== "Prepared") return;
    const result = commitFactoryMaterialStep(before, plan.materialPlan);
    expect(result.status).toBe("Committed");
    expect(readMaterialMassMg(result.view)).toBe(beforeMass);
    expect(result.view.containers.find(c => c.state.containerId === intent.carrierContainerId)!.state.contents).toEqual([chassis]);
    expect(result.view.containers.find(c => c.state.containerId === fixture.resourceState.containerId)!.state.contents.some(s => s.stackId === chassis.stackId)).toBe(false);
    expect(commitFactoryMaterialStep(result.view, plan.materialPlan).status).toBe("NoOp");
    expect(prepareCargoHandling(result.view, { ...intent, commandId: "pickup_former_2" })).toMatchObject({ status: "Rejected", reason: "StaleMaterialRevision" });
  });
  it("does not admit optional mining cargo into the first factory transport contract", () => {
    expect(readCargoHandlingProfile(fixture.catalog, "C28-PACK")).toBeUndefined();
  });
});

it("binds immutable complete source-lot request bytes before Native preparation", () => {
  const plan = prepareCargoHandling(setup(), intent); expect(plan.status).toBe("Prepared"); if (plan.status !== "Prepared") return;
  expect(Object.isFrozen(plan.intent.sourceLots)).toBe(true);
  expect(Object.isFrozen(plan.intent.sourceLots[0])).toBe(true);
});

import { createFactoryMaterialAuthority } from "../../../src/factory/session/dryFactorySlice";
import { factoryMaterialBytes } from "../../../src/factory/construction/placement";
import type { FactoryUiCommand } from "../../../src/factory/session/hostPort";
import {prepareFactoryPlacement} from "../../../src/factory/construction/placement";
import {validateFactoryAmount} from "../../../src/factory/material/quantity";
it("W09 paid Raw bin has clear body and current service in the actual unchanged Source layout",async()=>{
 const {materializeFactoryStartSite}=await import("../../../src/factory/fixtures/startSite"),{createFactoryCargoSite}=await import("../../../src/factory/fixtures/cargoSite");
 const source=materializeFactoryStartSite(),cargo=createFactoryCargoSite(source),material=setup(),profile=readCargoHandlingProfile(fixture.catalog,"BIN-PACK")!;
 const term=profile.terms[0]!,stack=fixture.resourceState.contents.find(s=>s.resourceId===fixture.catalog.items.find(i=>i.sourceId===term.itemId)!.resourceId)!;
 const pickup=prepareCargoHandling(material,{...intent,commandId:"raw_source_pickup",profileId:"BIN-PACK",sourceLots:[{containerId:fixture.resourceState.containerId,stackId:stack.stackId,quantityUnits:1}]});
 expect(pickup.status).toBe("Prepared");if(pickup.status!=="Prepared")return;
 const paid=commitFactoryMaterialStep(material,pickup.materialPlan).view;
 // Real immutable approved Source slots; declared Native depot/reach reply fixture, no Rapier or walk claim.
 const view={binding:{sessionId:"native",epoch:0,terrainRevision:0,sourceDigest:source.sourceDigest,baseDigest:source.sourceDigest,facilityRevision:2},material:paid,installations:[],actor:{actorId:"hvp_player",ownerId:cargo.ownerId,positionMm:[-8250,2420,11500],canBuild:true},
  terrain:{cellMm:125,originMm:[-16000,-8000,-16000],size:[256,128,256],readSlot:(x:number,y:number,z:number)=>source.readSlot(x,y,z)},
  cargoAccess:{...cargo,positionMm:cargo.centerMm,bodyHandle:1,opened:true,accessible:false},buildDepot:{containerId:"factory_carrier",profileId:"BIN-PACK",profileDigest:profile.digest,accessible:true,bodyHandle:2}};
 const built=prepareFactoryPlacement(view,{transactionId:"raw_source_install",instanceId:"raw_source_bin",definitionSourceId:"B09",centerMm:[-6250,1500,11500],quarterTurns:1});
 expect(built).toMatchObject({status:"Prepared"});if(built.status!=="Prepared")return;
 // The earlier west-side expectation was a hypothesis, not a failing terrain/Native admission.
 // Current authoring-side service is actually clear here; preserve it unless a real access conflict is proved.
 expect(built.installation.serviceBoundsMm).toEqual({min:[-5250,1500,10500],max:[-4250,3000,12500]});
 expect(built.materialCandidate.containers.find(c=>c.state.containerId==="factory_carrier")?.state.contents).toEqual([]);
 expect(readMaterialMassMg(built.materialCandidate)).toBe(readMaterialMassMg(paid));
 expect(source.initializationReceipt).toMatchObject({maskCount:15,columnCount:4480,areaMm2:70000000,materialCreditMg:0});
});
const hostHandlingFixture=()=>{
 const material=setup(),authority=createFactoryMaterialAuthority(material);let prepareCount=0,published=false,rejectPrepare=false;
 let native:any={revision:1,state:"Idle",owners:[],prepared:null,transactionId:null,cargo:{opened:true,accessible:true,ownerId:"fp02_wreck_owner",containerId:fixture.resourceState.containerId}};
 native.sources=[{containerId:"factory_carrier",instanceId:"actual_local",accessible:true}];
 const port:any={read:()=>native,prepare:async(request:any,_operation:string)=>{prepareCount++;if(rejectPrepare)throw Error("CarrierSupport");native={...native,state:"PreparedHeld",transactionId:request.transactionId,carrier:{ownerId:request.ownerId,transactionId:request.transactionId,profileId:request.profileId,profileDigest:request.profileDigest,containerId:request.custodyContainerId,phase:"PreparedHeld",massMg:readCargoHandlingProfile(fixture.catalog,request.profileId)!.massMg}};return native;},
 commit:async()=>{native={...native,state:"PublishedHeld",revision:native.revision+1};},publish:()=>{published=true;},rollback:async()=>{native={...native,state:"Idle",carrier:undefined};},finalize:async()=>{native={...native,state:"Idle",transactionId:null,carrier:{...native.carrier,phase:"Carrying"}};}};
 const controller=createFactoryHandling({materialAuthority:authority,native:port,current:()=>true,pause:async()=>{}});
 const command:FactoryUiCommand={version:"fp06-ui-command-v1",commandId:"host_pickup_c27",sessionId:crypto.randomUUID(),epoch:0,expected:{catalogDigest:fixture.catalog.catalogDigest,terrainSourceDigest:"unit-source",powerSourceProfileDigest:"fp01-fixed-net-observation-v1",terrainRevision:0,facilityRevision:1,materialRevision:0,netRevision:0,handlingRevision:0},kind:"pickup",profileId:"C27-PACK",sourceLots:[{containerId:fixture.resourceState.containerId,containerRevision:0,stackId:chassis.stackId,quantityUnits:1}]};
 return {authority,controller,command,get native(){return native;},get prepareCount(){return prepareCount;},get published(){return published;},reject:()=>{rejectPrepare=true;}};
};
it("pays the complete remote Former from its reachable local BOM depot instead of unreachable original Cargo",()=>{
  const material=setup(),profile=readCargoHandlingProfile(fixture.catalog,"B07-BOM")!;
  const lots=profile.terms.map(term=>({containerId:fixture.resourceState.containerId,stackId:fixture.resourceState.contents.find(stack=>stack.resourceId===fixture.catalog.items.find(item=>item.sourceId===term.itemId)!.resourceId)!.stackId,quantityUnits:term.quantityUnits}));
  const pickup=prepareCargoHandling(material,{...intent,commandId:"local_former_bom",profileId:"B07-BOM",sourceLots:lots});expect(pickup.status).toBe("Prepared");if(pickup.status!=="Prepared")return;
  const paid=commitFactoryMaterialStep(material,pickup.materialPlan).view,beforeMass=readMaterialMassMg(paid);
  const view={binding:{sessionId:"native",epoch:0,terrainRevision:0,sourceDigest:"terrain",baseDigest:"base",facilityRevision:2},material:paid,installations:[],actor:{actorId:"hvp_player",ownerId:"fp02_wreck_owner",positionMm:[-4250,2420,-2500],canBuild:true},terrain:{cellMm:125,originMm:[-20000,0,-20000],size:[320,64,320],readSlot:(_x:number,y:number)=>y<12?1:0},
    cargoAccess:{ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo",opened:true,sourceDigest:"base",profileDigest:"cargo",positionMm:[-5500,2000,13125],accessBoundsMm:{min:[-6250,1250,11125] as const,max:[-4750,2750,12625] as const},bodyHandle:1,accessible:false},
    buildDepot:{containerId:"factory_carrier",profileId:"B07-BOM",profileDigest:profile.digest,accessible:true,bodyHandle:2}};
  const built=prepareFactoryPlacement(view,{transactionId:"build_local_former",instanceId:"local_former",definitionSourceId:"B07",centerMm:[-6250,1500,-2500],quarterTurns:1});
  expect(built.status).toBe("Prepared");if(built.status!=="Prepared")return;
  expect(built.materialCandidate.containers.find(c=>c.state.containerId==="factory_carrier")!.state.contents).toEqual([]);expect(readMaterialMassMg(built.materialCandidate)).toBe(beforeMass);expect(built.materialCandidate.containers.find(c=>c.state.containerId==="installed_local_former")!.state.contents.reduce((n,s)=>n+validateFactoryAmount(fixture.catalog.items.find(i=>i.resourceId===s.resourceId)!.sourceId,s.quantity,fixture.catalog).massMg,0)).toBe(341000000);
});
it("Host adopts the indivisible real C27 custody and native owner jointly, preserving all source mass",async()=>{
 const h=hostHandlingFixture(),before=h.authority.read(),mass=readMaterialMassMg(before);
 expect(await h.controller.submit(h.command)).toMatchObject({status:"Committed"});
 const next=h.authority.read();expect(next.containers.find(c=>c.state.containerId===fixture.resourceState.containerId)!.state.contents.some(s=>s.stackId===chassis.stackId)).toBe(false);
 expect(next.containers.find(c=>c.state.containerId===h.native.carrier.containerId)!.state.contents).toEqual([chassis]);expect(readMaterialMassMg(next)).toBe(mass);expect(h.prepareCount).toBe(1);expect(h.published).toBe(true);
});
it("failed actual Native support keeps the complete real Resources authority unchanged",async()=>{
 const h=hostHandlingFixture(),bytes=factoryMaterialBytes(h.authority.read());h.reject();
 expect(await h.controller.submit(h.command)).toMatchObject({status:"Rejected",reason:"CarrierSupport"});expect(factoryMaterialBytes(h.authority.read())).toBe(bytes);expect(h.published).toBe(false);
});

it("rejects a partial 4kg transfer from an actual8kg carrier before either Resources or Native mass diverge",async()=>{
 const h=hostHandlingFixture(),raw=fixture.resourceState.contents.find(s=>s.resourceId==="fp02_bulk_steel_known")!;
 const pickup={...h.command,profileId:"RAW8",sourceLots:[{containerId:fixture.resourceState.containerId,containerRevision:0,stackId:raw.stackId,quantityUnits:8000000}]};expect(await h.controller.submit(pickup)).toMatchObject({status:"Committed"});
 const material=h.authority.read(),custody=material.containers.find(c=>c.state.containerId===h.native.carrier.containerId)!;
 const transfer:FactoryUiCommand={...h.command,commandId:"partial_four_kg",expected:{...h.command.expected,materialRevision:material.revision,facilityRevision:h.native.revision},kind:"transfer",source:{containerId:custody.state.containerId,containerRevision:custody.state.revision,stackId:custody.state.contents[0]!.stackId,quantityUnits:4000000},target:{id:"factory_carrier",revision:0}};
 expect(await h.controller.submit(transfer)).toMatchObject({status:"Rejected",reason:"PartialCarrierTransferUnsupported"});expect(h.authority.read()).toBe(material);expect(h.native.carrier.massMg).toBe(8000000);
});


it("W09 three actual supported battery routes pay exactly19.75m from finite C07 with whole custody and no duplicate mass",()=>{
 const initial=setup(),owner=fixture.resourceState.ownerId!,cable=fixture.catalog.items.find(i=>i.sourceId==="fp02.comp.field_cable")!;
 const targets=["cable_cut","cable_belt","cable_former"].map(id=>createResourceContainerSnapshot(createResourceContainerDefinition({containerId:id,kind:"OutpostStorage",maxMassKg:10,maxVolumeM3:.1,maxStackCount:1}),createResourceContainerState({containerId:id,ownerId:owner,contents:[]},fixture.catalog.resources),fixture.catalog.resources));
 let material={...initial,containers:[...initial.containers,...targets]};const mass=readMaterialMassMg(material);
 for(const [id,length,target] of [["CABLE7000",7000,"cable_cut"],["CABLE5250",5250,"cable_belt"],["CABLE7500",7500,"cable_former"]] as const){
  const source=material.containers.find(c=>c.state.containerId===fixture.resourceState.containerId)!,stack=source.state.contents.find(s=>s.resourceId===cable.resourceId)!;
  const request={...intent,commandId:`pay_${id.toLowerCase()}`,profileId:id,expectedMaterialRevision:material.revision,sourceLots:[{containerId:source.state.containerId,stackId:stack.stackId,quantityUnits:length}]};
  expect(prepareCargoHandling(material,{...request,sourceLots:[{...request.sourceLots[0]!,quantityUnits:length-1}]})).toMatchObject({status:"Rejected",reason:"HandlingProfileTermsMismatch"});
  const plan=prepareCargoHandling(material,request);expect(plan.status).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);expect(plan.profile.massMg).toBe(length*250);expect(plan.profile.sourceRefs).toContain("fp06-technical-s0-closed-native-socket-cable-jobs-v2");
  const paid=commitFactoryMaterialStep(material,plan.materialPlan);expect(paid.status).toBe("Committed");expect(commitFactoryMaterialStep(paid.view,plan.materialPlan).status).toBe("NoOp");material={...paid.view,containers:[...paid.view.containers]};
  const custody=material.containers.find(c=>c.state.containerId==="factory_carrier")!,held=custody.state.contents[0]!;expect(held.quantity).toBe(length);
  const install=prepareFactoryMaterialStep(material,{kind:"transfer",transactionId:`install_${id.toLowerCase()}`,ownerId:owner,actorId:owner,moves:[{sourceContainerId:custody.state.containerId,sourceStackId:held.stackId,targetContainerId:target,targetStackId:held.stackId,itemId:cable.sourceId,quantityUnits:length}]});
  expect(install.status).toBe("Prepared");if(install.status!=="Prepared")throw Error(install.reason);const result=commitFactoryMaterialStep(material,install);expect(result.status).toBe("Committed");material={...result.view,containers:[...result.view.containers]};
  expect(material.containers.find(c=>c.state.containerId==="factory_carrier")!.state.contents).toEqual([]);expect(readMaterialMassMg(material)).toBe(mass);
 }
 expect(material.containers.find(c=>c.state.containerId===fixture.resourceState.containerId)!.state.contents.find(s=>s.resourceId===cable.resourceId)?.quantity).toBe(20250);
 expect(material.containers.filter(c=>targets.some(t=>t.state.containerId===c.state.containerId)).reduce((n,c)=>n+c.state.contents.reduce((q,s)=>q+s.quantity,0),0)).toBe(19750);
 expect(readCargoHandlingProfile(fixture.catalog,"CABLE7501")).toBeUndefined();
});

// Exact pre-change historical bytes were captured before the V5 closed-job implementation.
it("PLAY04 V5 cable additions preserve all seven historical profile canonical bytes",()=>{
 const pins={"CABLE4750":"b3605328f7a34553b246e2afc85d4bea06b3f9dc5e8904d30f45ea9fa8cd280a","CABLE6500":"95b86f449ad908ee4b7d9c1e9d84dc32fd1880bc42f23be4a9e39fd2529d0f91","CABLE8000":"65642057a43dfd24ac3a5fe92d7891ac00892614d0424f5d171c31e53bf667ae","CABLE7000":"ee7e56c504a922642abc8148d88985b17ef2b61b674b52a95c942e90a1382065","CABLE5250":"981826bd9825822b1a73ae16db48667d6c91ba633b6c03ce3b8c5ce0cfd65413","CABLE7500":"8b6d9b77b8e566087aa2089015b5c754c38bef038d0b3358ba7554c4596403df","CABLE40":"912e97d5da96dac025b5760a6513c91df77b7f87892b821273182807750980b4"};
 for(const [id,sha] of Object.entries(pins)){
  const profile=readCargoHandlingProfile(fixture.catalog,id)!;
  expect(createHash("sha256").update(profile.canonicalJson).digest("hex"),id).toBe(sha);
 }
});
it.each([["CABLE5000",5000],["CABLE5750",5750],["CABLE7750",7750]] as const)("PLAY04 V5 closed %s pays its declared cable quantity in the original light envelope",(id,length)=>{
 const profile=readCargoHandlingProfile(fixture.catalog,id);
 expect(profile).toMatchObject({terms:[{itemId:"fp02.comp.field_cable",quantityUnits:length}],massMg:length*250,capacityMm3:length*3000,sizeMm:[500,1000,500]});
 expect(profile?.sourceRefs).toContain("fp06-technical-s0-closed-native-socket-cable-jobs-v3");
 expect(profile&&Object.isFrozen(profile)).toBe(true);
 expect(readCargoHandlingProfile(fixture.catalog,`CABLE${length+1}`)).toBeUndefined();
});

// Custody/payment proof only; actual Native socket reach and LOS are separate normal-game gates.
it("PLAY04 V5 five declared finite cable jobs pay exactly34m from finite C07 with whole custody and no duplicate mass",()=>{
 const initial=setup(),owner=fixture.resourceState.ownerId!,cable=fixture.catalog.items.find(i=>i.sourceId==="fp02.comp.field_cable")!;
 const targets=["cable_cut","cable_belt","cable_former","cable_distro","cable_raw_belt"].map(id=>createResourceContainerSnapshot(createResourceContainerDefinition({containerId:id,kind:"OutpostStorage",maxMassKg:10,maxVolumeM3:.1,maxStackCount:1}),createResourceContainerState({containerId:id,ownerId:owner,contents:[]},fixture.catalog.resources),fixture.catalog.resources));
 let material={...initial,containers:[...initial.containers,...targets]};const mass=readMaterialMassMg(material);
 for(const [id,length,target] of [["CABLE7500",7500,"cable_cut"],["CABLE8000",8000,"cable_belt"],["CABLE5750",5750,"cable_former"],["CABLE5000",5000,"cable_distro"],["CABLE7750",7750,"cable_raw_belt"]] as const){
  const source=material.containers.find(c=>c.state.containerId===fixture.resourceState.containerId)!,stack=source.state.contents.find(s=>s.resourceId===cable.resourceId)!;
  const request={...intent,commandId:`pay_${id.toLowerCase()}`,profileId:id,expectedMaterialRevision:material.revision,sourceLots:[{containerId:source.state.containerId,stackId:stack.stackId,quantityUnits:length}]};
  expect(prepareCargoHandling(material,{...request,sourceLots:[{...request.sourceLots[0]!,quantityUnits:length-1}]})).toMatchObject({status:"Rejected",reason:"HandlingProfileTermsMismatch"});
  const plan=prepareCargoHandling(material,request);expect(plan.status).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);expect(plan.profile.massMg).toBe(length*250);
  const paid=commitFactoryMaterialStep(material,plan.materialPlan);expect(paid.status).toBe("Committed");expect(commitFactoryMaterialStep(paid.view,plan.materialPlan).status).toBe("NoOp");material={...paid.view,containers:[...paid.view.containers]};
  const custody=material.containers.find(c=>c.state.containerId==="factory_carrier")!,held=custody.state.contents[0]!;expect(held.quantity).toBe(length);
  const install=prepareFactoryMaterialStep(material,{kind:"transfer",transactionId:`install_${id.toLowerCase()}`,ownerId:owner,actorId:owner,moves:[{sourceContainerId:custody.state.containerId,sourceStackId:held.stackId,targetContainerId:target,targetStackId:held.stackId,itemId:cable.sourceId,quantityUnits:length}]});
  expect(install.status).toBe("Prepared");if(install.status!=="Prepared")throw Error(install.reason);const result=commitFactoryMaterialStep(material,install);expect(result.status).toBe("Committed");material={...result.view,containers:[...result.view.containers]};
  expect(material.containers.find(c=>c.state.containerId==="factory_carrier")!.state.contents).toEqual([]);expect(readMaterialMassMg(material)).toBe(mass);
 }
 expect(material.containers.find(c=>c.state.containerId===fixture.resourceState.containerId)!.state.contents.find(s=>s.resourceId===cable.resourceId)?.quantity).toBe(6000);
 expect(material.containers.filter(c=>targets.some(t=>t.state.containerId===c.state.containerId)).reduce((n,c)=>n+c.state.contents.reduce((q,s)=>q+s.quantity,0),0)).toBe(34000);
 expect(readCargoHandlingProfile(fixture.catalog,"CABLE7501")).toBeUndefined();
});
