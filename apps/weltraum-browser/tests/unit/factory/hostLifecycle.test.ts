import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, openSync, ftruncateSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, vi, describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createResourceCatalog } from "../../../src/resources/catalog";
import {canonicalSignature} from "../../../src/resources/serialization";
import {readDryFactoryBeltPort} from "../../../src/factory/session/dryFactorySlice";
import { readFactoryMaterialProjection } from "../../../src/factory/presentation/factoryMaterialProjection";
import * as cargoHandlingProfiles from "../../../src/factory/construction/cargoHandlingProfile";
import { mountFactorySession, mountCompactFactorySession, type FactorySessionHandle } from "../../../src/factory/session/factorySession";
import type { FactoryHostPort, FactoryHostView, FactoryUiCommand } from "../../../src/factory/session/hostPort";

const catalog = createFp02Fixture("cargo").catalog;
const hostFixture = (initialTick = 37) => {
  let current = true;
  let view: FactoryHostView = Object.freeze({ sessionId: "native-host", epoch: 1, nativeTick: initialTick,
    physicsStatus: "Running", confirmed: true, terrain: Object.freeze({ epoch: 1, revision: 0,
      sourceDigest: "source", baseDigest: "base", cellMeters: 0.125,
      originMeters: Object.freeze({ x: -12, y: 0, z: -12 }), sizeX: 192, sizeY: 64, sizeZ: 192 }) });
  const listeners = new Set<(view: FactoryHostView) => void>();
  const callbacks: ((view: FactoryHostView) => void)[] = [];
  const publish = (tick: number, overrides: Partial<FactoryHostView> = {}) => {
    view = Object.freeze({ ...view, nativeTick: tick, ...overrides });
    for (const listener of listeners) listener(view);
    return view;
  };
  const host: FactoryHostPort = Object.freeze({ current: () => current, read: () => view,
    readTerrainSlot: () => undefined, subscribeConfirmed: (listener: (view: FactoryHostView) => void) => {
      listeners.add(listener); callbacks.push(listener); return () => { listeners.delete(listener); };
    }, pause: async () => publish(view.nativeTick + 1, { physicsStatus: "Paused" }),
    resume: async () => publish(view.nativeTick, { physicsStatus: "Running" }) });
  return { host, publish, callbacks, listeners, retire: () => { current = false; } };
};

it("PLAY06 compact session charges the live Belt material cache slot to checkpoint K",async()=>{
 const f=hostFixture(0),session=await mountCompactFactorySession(f.host,catalog);
 try{
  const memory=session.readFactoryCheckpointMemory(),b=memory.cacheBreakdown;if(!b)throw Error("Factory checkpoint cache breakdown missing");
  expect(b.beltMaterialFragmentBytes).toBe(1024);
  expect(b.cachedDomainCanonicalDescendantsBytes+b.dryFactoryStateBytes+b.currentExactMaterialBindingsBytes+b.currentProductionMaterialBytes
    +b.beltMaterialFragmentBytes+b.catalogTreeBytes+b.goalProjectionMemoBytes+b.initialMaterial.checkpointDtoBytes
    +b.initialMaterial.exactMaterialBindingsBytes+b.initialMaterial.productionMaterialBytes).toBe(memory.cacheBytes);
 }finally{await session.dispose();}
});

it("PLAY02 presentation is an immutable read and never treats a menu recipe as a paid job", async () => {
  const {session,command}=await paidMachineHostFixture("B07");
  try {
    const before=session.ui.read(),machine=before.machines[0]!,sheet=machine.recipes.find(r=>r.ref.sourceId==="REC-03-SHEET")!.ref;
    await session.ui.submit(command("presentation_menu_only",{kind:"select-recipe",machine:{id:machine.id,revision:machine.revision},recipe:sheet}));
    const read=(session as any).readPresentation?.();
    expect(read,"renderer needs the committed-domain read even with panels closed").toBeDefined();
    if(!read)return;
    expect(read.machines[0]).toMatchObject({instanceId:machine.id,jobId:null,recipeRef:null,confirmedWorkMs:0});
    expect(Object.isFrozen(read)).toBe(true);expect(Object.isFrozen(read.machines)).toBe(true);
    expect(session.ui.read().inventory).toEqual(before.inventory);expect(session.read().steps).toBe(0);
  } finally {await session.dispose();}
});

it("PLAY02 presentation exposes only the actually adopted paid job and loses confirmation on Host hold",async()=>{
  const {f,host,session,command,installBattery}=await paidMachineHostFixture("B06");
  try {
    const initialDomain=session.readPresentation(),initialFacilities=host.handling!.read();
    expect(readFactoryMaterialProjection({domain:initialDomain,host:f.host.read(),facilities:initialFacilities}).lots,
      "installed construction stock is not a machine process lot").toEqual([]);
    await installBattery();let powerUi=session.ui.read();const powerCargo=powerUi.inventory.find(i=>i.role==="cargo")!,cable=powerCargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
    expect(await session.ui.submit(command("presentation_paid_cable",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:powerCargo.id,containerRevision:powerCargo.revision,stackId:cable.stackId,quantityUnits:2750}}))).toMatchObject({status:"Committed"});
    let ui=session.ui.read();const cargo=ui.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
    await session.ui.submit(command("presentation_input",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}));
    const materialDomain=session.readPresentation(),materialFacilities=host.handling!.read();
    const projected=readFactoryMaterialProjection({domain:materialDomain,host:f.host.read(),facilities:materialFacilities});
    expect(projected.links).toHaveLength(1);
    expect(projected.links[0]).toMatchObject({linkId:"link_presentation_paid_cable",containerId:"installed_cable_presentation_paid_cable",
      lengthMm:2750,quantityUnits:2750,itemId:"fp02.comp.field_cable",assetId:"play_cable_link_v1",endAssetId:"play_cable_end_v1"});
    expect(projected.lots).toHaveLength(1);
    expect(projected.lots[0]).toMatchObject({instanceId:"test_machine",definitionSourceId:"B06",role:"input",
      containerId:"input_test_machine",itemId:"fp02.bulk.steel_known",quantityUnits:8000000,stackCount:1,assetId:"play_steel_v1"});

    const staleFacilities={...materialFacilities,owners:materialFacilities.owners.map(owner=>owner.instanceId==="battery"
      ?{...owner,profileDigest:"stale_native_profile"}:owner)};
    const staleProjection=readFactoryMaterialProjection({domain:materialDomain,host:f.host.read(),facilities:staleFacilities});
    expect(staleProjection.links,"a cable visual requires its current Native endpoint proof").toEqual([]);
    expect(staleProjection.lots).toEqual(projected.lots);

    const wrongCableDomain={...materialDomain,material:{...materialDomain.material,containers:materialDomain.material.containers.map(snapshot=>
      snapshot.state.containerId==="installed_cable_presentation_paid_cable"
        ?{...snapshot,state:{...snapshot.state,contents:snapshot.state.contents.map(stack=>({...stack,quantity:stack.quantity-1}))}}:snapshot)}};
    expect(readFactoryMaterialProjection({domain:wrongCableDomain,host:f.host.read(),facilities:materialFacilities}).links,
      "the signed graph link cannot replace its exact paid cable ledger quantity").toEqual([]);

    ui=session.ui.read();const input=ui.inventory.find(i=>i.id==="input_test_machine")!,machine=ui.machines[0]!;
    const pending=session.ui.submit(command("presentation_paid_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));
    await Promise.resolve();await Promise.resolve();f.publish(6);await pending;
    const read=(session as any).readPresentation?.();expect(read).toBeDefined();if(!read)return;
    expect(read).toMatchObject({sessionId:f.host.read().sessionId,epoch:1,nativeTick:6,confirmed:true});
    expect(read.machines[0]).toMatchObject({jobId:"job_presentation_paid_start",recipeRef:{sourceId:"REC-01-CUT"},confirmedWorkMs:100,status:"RUNNING"});
    f.publish(6,{physicsStatus:"SimulationHold",confirmed:false});
    expect((session as any).readPresentation().confirmed).toBe(false);
    expect((session as any).readPresentation().machines[0].confirmedWorkMs).toBe(100);
  } finally {await session.dispose();}
});

it("PLAY03 session focus forwards only real transitions and never releases a retired Host", async () => {
  const f = hostFixture(0), focus: ("cargo" | "machine" | "power" | "technology" | null)[] = [];
  const host: FactoryHostPort = { ...f.host, setPanelFocus: panel => { focus.push(panel); } };
  const session = await mountFactorySession(host, catalog);
  try {
    session.ui.setPanelFocus(null);
    session.ui.setPanelFocus("cargo"); session.ui.setPanelFocus("cargo");
    session.ui.setPanelFocus(null); session.ui.setPanelFocus(null);
    expect(focus).toEqual(["cargo", null]);
    // A stale presentation callback cannot clear a replacement native lifetime.
    f.retire(); session.ui.setPanelFocus("power"); session.ui.setPanelFocus(null);
    expect(focus).toEqual(["cargo", null]);
  } finally { await session.dispose(); }
});

const paidMachineHostFixture=async(definitionId:"B05"|"B06"|"B07",terrain?:FactoryHostView["terrain"])=>{
 const f=hostFixture(0);if(terrain)f.publish(0,{terrain});let pending:any,supported=true,serviceClear=true,powerConfirmed=true,actorPositionMm=[0,2420,2500],carrierRequest:any,carrierOperation:string|undefined,pauseHook:(()=>void)|undefined,releaseFault:"commit"|"publish"|"finalize"|"commit-rollback"|undefined;const noop=async()=>{};
 const {createFactoryInstallationProfile,transformFactoryPoint}=await import("../../../src/factory/construction/installationProfile");
 const cargo={ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo",opened:true,...(terrain?{site:{boundsMm:{min:[-6250,1250,12625],max:[-4750,2750,13625]}}}:{}),sourceDigest:f.host.read().terrain.baseDigest,profileDigest:"transport-unit-cargo",positionMm:[0,1500,2500],accessBoundsMm:{min:[-500,1500,2000] as const,max:[500,2500,3000] as const},bodyHandle:100,accessible:true};
 let native:any={revision:1,state:"Idle",transactionId:null,owners:[],prepared:null,sources:[],production:[],cargo};
 let solidFault:"frame"|"stale"|"owner"|"part"|undefined;
 const observedParts=()=>native.owners.filter((o:any)=>["B06","B07","B09"].includes(o.definitionRef.sourceId)).map((o:any)=>{
  const p=createFactoryInstallationProfile(o.definitionRef.sourceId),bad=solidFault==="part"&&o.definitionRef.sourceId==="B09";
  const row={instanceId:o.instanceId,definitionRef:o.definitionRef,sourceDigest:o.sourceDigest,profileDigest:o.profileDigest,installationRevision:o.installationRevision,terrainRevision:0,facilityRevision:native.revision,published:true,confirmed:!bad,complete:!bad,parts:p.source.parts.map(part=>({partId:part.partId,status:bad?"Unknown":"Present",colliderHandles:o.colliderHandles}))};return {...row,observationDigest:canonicalSignature(row)};
 });
 const observedSolidPorts=()=>native.owners.filter((o:any)=>["B06","B07","B09"].includes(o.definitionRef.sourceId)).flatMap((o:any)=>catalog.devices.find(d=>d.sourceId===o.definitionRef.sourceId)!.ports.filter(p=>p.role==="SolidBatchIn"||p.role==="SolidBatchOut").map(p=>{
  const bound=readDryFactoryBeltPort(catalog,{...o,definitionSourceId:o.definitionRef.sourceId},p.sourceId,o.installationRevision),storage=o.definitionRef.sourceId==="B09";
  return {portId:bound.nativePortId,sourcePortId:p.sourceId,instanceId:o.instanceId,definitionRef:storage&&solidFault==="owner"?{...o.definitionRef,digest:"forged"}:o.definitionRef,sourceDigest:o.sourceDigest,profileDigest:o.profileDigest,installationRevision:o.installationRevision,terrainRevision:storage&&solidFault==="stale"?1:0,facilityRevision:native.revision,positionMm:storage&&solidFault==="frame"?[bound.centerMm[0]+250,bound.centerMm[1],bound.centerMm[2]]:bound.centerMm,outwardNormal:bound.outwardNormal,role:p.role,confirmed:supported,supported,serviceClear:true,sweepClear:true,accessible:true};
 }));
 // Native observation replies are an explicit transport fixture. Real Native query tests cover their provenance.
 const host:FactoryHostPort={...f.host,pause:async()=>{await f.host.pause();pauseHook?.();return f.host.read();},construction:{openCargo:noop,readFacts:()=>({binding:{sessionId:f.host.read().sessionId,epoch:1,terrainRevision:0,sourceDigest:f.host.read().terrain.sourceDigest,baseDigest:f.host.read().terrain.baseDigest,facilityRevision:native.revision},cargoAccess:cargo,...(native.carrier?.phase==="Deposited"?{buildDepot:{containerId:native.carrier.containerId,profileId:native.carrier.profileId,profileDigest:native.carrier.profileDigest,accessible:true,bodyHandle:native.carrier.bodyHandle}}:{}),actor:{actorId:"hvp_player",ownerId:cargo.ownerId,positionMm:actorPositionMm,canBuild:true},terrain:{cellMm:125,originMm:[-12000,0,-12000],size:[192,64,192],readSlot:(_x,y)=>y<12?1:0}}),prepareNative:async(request)=>{pending=request;native={...native,state:"PreparedHeld"};},commitNative:noop,publishNative:()=>{const p=createFactoryInstallationProfile(pending.definitionRef.sourceId);native={...native,revision:native.revision+1,owners:[...native.owners,{...pending,sourceDigest:p.sourceDigest,installationRevision:native.revision+1,bodyHandle:101+native.revision,colliderHandles:[102+native.revision]}],sources:[...native.sources,...(["B05","B06","B07"].includes(pending.definitionRef.sourceId)?["input","output","offcut"].map(role=>({containerId:`${role}_${pending.instanceId}`,instanceId:pending.instanceId,accessible:true})):[])]};},rollbackNative:noop,finalizeNative:async()=>{native={...native,state:"Idle",...(pending.consumedCustody?{carrier:undefined}:{})};},stageProjection:noop,publishProjection:()=>{},rollbackProjection:()=>{},finalizeProjection:()=>{},projectGhost:()=>{},dispose:()=>{}},handling:{read:()=>({...native,partObservations:observedParts(),solidPorts:observedSolidPorts(),powerPorts:native.owners.flatMap((owner:any)=>{const p=createFactoryInstallationProfile(owner.definitionRef.sourceId);return p.source.ports.filter(port=>port.role.startsWith("Power")).map(port=>({portId:`power_${owner.instanceId}`,sourcePortId:port.sourceId,instanceId:owner.instanceId,installationRevision:owner.installationRevision,profileDigest:owner.profileDigest,sourceDigest:owner.sourceDigest,terrainRevision:f.host.read().terrain.revision,facilityRevision:native.revision,confirmed:powerConfirmed,accessible:true,role:port.role,positionMm:transformFactoryPoint(port.centerM.map(n=>n*1000),owner.centerMm,owner.quarterTurns),outwardNormal:transformFactoryPoint(port.normal,[0,0,0],owner.quarterTurns)}));}),production:native.owners.filter((o:any)=>["B05","B06","B07"].includes(o.definitionRef.sourceId)).map((owner:any)=>({instanceId:owner.instanceId,profileDigest:owner.profileDigest,sourceDigest:owner.sourceDigest,installationRevision:owner.installationRevision,terrainRevision:0,facilityRevision:native.revision,confirmed:true,supported,serviceClear,sweepClear:true,accessible:true}))}),prepare:async(request,operation)=>{carrierRequest=request;carrierOperation=operation;if(operation==="pickup"){const {readCargoHandlingProfile}=await import("../../../src/factory/construction/cargoHandlingProfile"),profile=readCargoHandlingProfile(catalog,request.profileId)!;native={...native,carrier:{ownerId:request.ownerId,transactionId:request.transactionId,profileId:profile.profileId,profileDigest:profile.digest,phase:"PreparedHeld",massMg:profile.massMg,nativeMassKg:profile.massMg/1000000,containerId:request.custodyContainerId,positionMm:[actorPositionMm[0],1500,actorPositionMm[2]!-1000],bodyHandle:300,colliderHandles:[301,302,303,304,305],accessible:true}};}return native;},commit:async()=>{if(carrierOperation==="release"&&(releaseFault==="commit"||releaseFault==="commit-rollback"))throw Error("UnitReleaseCommitRejected");},publish:()=>{if(carrierOperation==="release"&&releaseFault==="publish")throw Error("UnitReleasePublicationUnknown");native={...native,revision:native.revision+1};},rollback:async()=>{if(carrierOperation==="release"&&releaseFault==="commit-rollback")throw Error("UnitReleaseRollbackUnknown");},finalize:async()=>{if(carrierOperation==="release"&&releaseFault==="finalize")throw Error("UnitReleaseFinalizeUnknown");if(carrierOperation==="release")native={...native,carrier:undefined};else native={...native,carrier:{...native.carrier,transactionId:carrierRequest.transactionId,phase:carrierOperation==="deposit"?"Deposited":"Carrying",materialBinding:carrierRequest.materialBinding}};}}};
 const publishNative=host.construction!.publishNative.bind(host.construction);
 host.construction!.publishNative=(id:string)=>{publishNative(id);native={...native,owners:native.owners.map((owner:any)=>({
   ...owner,massMg:createFactoryInstallationProfile(owner.definitionRef.sourceId).massMg}))};};
 const session=await mountFactorySession(host,catalog);const plan=session.construction!.preview({transactionId:"paid_command_machine",instanceId:"test_machine",definitionSourceId:definitionId,centerMm:[0,1500,0],quarterTurns:0});expect(plan.status,plan.status==="Rejected"?plan.reason:undefined).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);expect(await session.construction!.commit(plan)).toMatchObject({status:"Committed"});
 const command=(commandId:string,payload:object):FactoryUiCommand=>({version:"fp06-ui-command-v1",commandId,sessionId:session.ui.read().sessionId,epoch:session.ui.read().epoch,expected:session.ui.read().binding,...payload} as FactoryUiCommand);
 return {f,host,session,command,readHost:()=>host.read(),bindConfirmationToQuiescence:()=>{const read=host.read.bind(host);host.read=()=>session.isQuiescent()?read():{...read(),confirmed:false};},setNativeRevision:()=>{native={...native,revision:native.revision+1};},setNativeGate:(state:string,transactionId:string|null,prepared:unknown|null)=>{native={...native,state,transactionId,prepared};},setNativeOwnerMaterialBinding:(id:string,value:unknown)=>{native={...native,owners:native.owners.map((owner:any)=>owner.instanceId===id?{...owner,materialBinding:value}:owner)};},setNativeOwnerDefinitionRef:(id:string,value:unknown)=>{native={...native,owners:native.owners.map((owner:any)=>owner.instanceId===id?{...owner,definitionRef:value}:owner)};},setPauseHook:(fn:(()=>void)|undefined)=>{pauseHook=fn;},setSolidFault:(fault:typeof solidFault)=>{solidFault=fault;},installStorage:async()=>{
 actorPositionMm=[-3500,2420,0];const p=session.construction!.preview({transactionId:"paid_storage_port",instanceId:"raw_storage",definitionSourceId:"B09",centerMm:[-6500,1500,0],quarterTurns:0});expect(p.status).toBe("Prepared");if(p.status!=="Prepared")throw Error(p.reason);expect(await session.construction!.commit(p)).toMatchObject({status:"Committed"});
 native={...native,sources:[...native.sources,{containerId:"storage_raw_storage",instanceId:"raw_storage",accessible:true}]};
 },setReleaseFault:(fault:typeof releaseFault)=>{releaseFault=fault;},setActorFixture:(position:readonly number[])=>{actorPositionMm=[...position];},setSupported:(value:boolean)=>{supported=value;},setServiceClear:(value:boolean)=>{serviceClear=value;},setPowerConfirmed:(value:boolean)=>{powerConfirmed=value;},installBattery:async(centerMm:readonly [number,number,number]=[-3000,1500,0])=>{
 const plan=session.construction!.preview({transactionId:"install_command_battery",instanceId:"battery",definitionSourceId:"fp02.device.battery_4kwh",centerMm,quarterTurns:0});expect(plan.status,plan.status==="Rejected"?plan.reason:undefined).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);expect(await session.construction!.commit(plan)).toMatchObject({status:"Committed"});
 }};
};

it("W09 paid Former recipe selection switches after a completed or idle job without changing finite material",async()=>{
  const {f,session,command}=await paidMachineHostFixture("B07");try{
  const before=session.ui.read(),machine=before.machines[0]!,sheet=machine.recipes.find(r=>r.ref.sourceId==="REC-03-SHEET")!.ref,profile=machine.recipes.find(r=>r.ref.sourceId==="REC-02-PROFILE")!.ref;
  expect(await session.ui.submit(command("select_sheet",{kind:"select-recipe",machine:{id:machine.id,revision:machine.revision},recipe:sheet}))).toMatchObject({status:"Committed"});
  expect(session.ui.read().machines[0]?.selectedRecipe).toEqual(sheet);
  const neutralInput={active:false,activationPending:false,pointerLocked:false,pausePending:false,focusedPanel:null,surface:null,error:null} as const;
  f.publish(session.read().nativeTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
  const selectionCapture=session.beginFactoryCheckpoint();expect(selectionCapture.factory.recipeSelections).toEqual([{instanceId:machine.id,recipe:sheet,revision:1}]);
  expect(selectionCapture.factory.commandReceipts.map(receipt=>receipt.commandId)).toContain("select_sheet");selectionCapture.assertCurrent();selectionCapture.release();
  f.publish(session.read().nativeTick,{physicsStatus:"Running",confirmed:true});
  expect(await session.ui.submit(command("select_profile",{kind:"select-recipe",machine:{id:machine.id,revision:session.ui.read().machines[0]!.revision},recipe:profile}))).toMatchObject({status:"Committed"});
  expect(session.ui.read().machines[0]?.selectedRecipe).toEqual(profile);expect(session.ui.read().inventory).toEqual(before.inventory);
 }finally{await session.dispose();}
});

it("PLAY04 current paid B09 offers its real 4m raw-to-Cutter connection without a storage production job",async()=>{
 const {f,host,session,command,installStorage}=await paidMachineHostFixture("B06");try{await installStorage();
  const view=session.ui.read(),line=view.connections?.belts.find(p=>p.sourcePortId==="port_raw_storage_fp02_b09_mat_out"&&p.targetPortId==="port_test_machine_fp02_b06_in_steel");
  expect(line,"a current Native storage port is independent of ProductionState").toBeDefined();
  expect(view.machines.some(m=>m.id==="raw_storage")).toBe(false);expect(view.inventory.reduce((sum,c)=>sum+c.massMg,0)).toBe(2984400000);
  const cargo=view.inventory.find(c=>c.role==="cargo")!,steel=cargo.contents.find(stack=>stack.itemId==="fp02.bulk.steel_known")!,storage=view.inventory.find(c=>c.id==="storage_raw_storage")!;
  expect(await session.ui.submit(command("stock_raw_storage",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:storage.id,revision:storage.revision}}))).toMatchObject({status:"Committed"});
  const publishSurface=(surface:"cargo"|"power")=>f.publish(session.read().nativeTick,{input:{active:false,activationPending:false,pointerLocked:false,
    pausePending:false,focusedPanel:surface,error:null,surface}});
  publishSurface("cargo");
  let hostView=f.host.read(),domain=session.readPresentation(hostView),projection=readFactoryMaterialProjection({domain,host:hostView,facilities:host.handling!.read()});
  expect(projection.lots.filter(lot=>lot.role==="storage")).toEqual([expect.objectContaining({instanceId:"raw_storage",definitionSourceId:"B09",
    role:"storage",containerId:"storage_raw_storage",itemId:"fp02.bulk.steel_known",quantityUnits:8000000,stackCount:1,assetId:"play_steel_v1"})]);
  publishSurface("power");hostView=f.host.read();domain=session.readPresentation(hostView);
  projection=readFactoryMaterialProjection({domain,host:hostView,facilities:host.handling!.read()});
  expect(projection.lots.filter(lot=>lot.role==="storage"),"B09 stock belongs in the explicit cargo inspection only").toEqual([]);
 }finally{await session.dispose();}
});
it.each([
 {name:"POWER only",power:true,inbound:false,outbound:false},
 {name:"inbound belt only",power:false,inbound:true,outbound:false},
 {name:"outbound belt only",power:false,inbound:false,outbound:true}
])("PLAY04 machine ports follow the committed graph: $name",async({name,power,inbound,outbound})=>{
 const {session,command,setActorFixture,installStorage,installBattery}=await paidMachineHostFixture("B06");try{
  const carryAndDeposit=async(profileId:string,id:string,position:readonly number[])=>{
   setActorFixture([0,2420,2500]);let view=session.ui.read();const cargo=view.inventory.find(c=>c.role==="cargo")!,profile=cargo.pickupProfiles.find(p=>p.profileId===profileId)!;
   expect(await session.ui.submit(command(`${id}_pickup`,{kind:"pickup",profileId,sourceLots:profile.sourceLots}))).toMatchObject({status:"Committed"});
   setActorFixture(position);view=session.ui.read();const handling=view.interaction.handling!;
   expect(await session.ui.submit(command(`${id}_deposit`,{kind:"deposit",handling:{id:handling.id,revision:handling.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});
  };
  const connectBelt=async(id:string,sourcePortId:string,targetPortId:string,position:readonly number[])=>{
   await carryAndDeposit("BELT4",`${id}_payload`,position);const view=session.ui.read(),depot=view.inventory.find(c=>c.role==="depot"&&c.contents.length===5)!;
   const sourceLots=depot.contents.map(s=>({containerId:depot.id,containerRevision:depot.revision,stackId:s.stackId,quantityUnits:s.quantityUnits}));
   expect(await session.ui.submit(command(`${id}_connect`,{kind:"connect-belt",sourcePortId,targetPortId,sourceLots}))).toMatchObject({status:"Committed"});
  };
  if(inbound)await installStorage();
  if(outbound){
   await carryAndDeposit("B07-BOM","port_projection_former_payload",[7500,2420,2500]);
   const former=session.construction!.preview({transactionId:"port_projection_former",instanceId:"line_former",definitionSourceId:"B07",centerMm:[7500,1500,0],quarterTurns:0});
   expect(former.status).toBe("Prepared");if(former.status!=="Prepared")throw Error(former.reason);expect(await session.construction!.commit(former)).toMatchObject({status:"Committed"});
  }
  if(power){
   await installBattery();
   const view=session.ui.read(),link=view.connections?.power.find(p=>p.sourcePortId==="power_battery"&&p.targetPortId==="power_test_machine")!,cargo=view.inventory.find(c=>c.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
   expect(cable.quantityUnits).toBeGreaterThanOrEqual(link.lengthMm);
   expect(await session.ui.submit(command("port_projection_power",{kind:"connect-power",sourcePortId:link.sourcePortId,targetPortId:link.targetPortId,cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:link.lengthMm}}))).toMatchObject({status:"Committed"});
  }
  if(inbound)await connectBelt("port_projection_inbound","port_raw_storage_fp02_b09_mat_out","port_test_machine_fp02_b06_in_steel",[-3250,2420,2500]);
  if(outbound)await connectBelt("port_projection_outbound","port_test_machine_fp02_b06_out_semi","port_line_former_fp02_b07_in_semi",[3500,2420,2500]);
  const machine=session.ui.read().machines.find(m=>m.id==="test_machine")!;
  expect(Object.fromEntries(machine.ports.map(p=>[p.role,p.connected])),name).toEqual({SolidBatchIn:inbound,SolidBatchOut:outbound,PowerConsumer:power,WasteCassette:false});
 }finally{await session.dispose();}
});

it.each(["frame","stale","owner","part"] as const)("PLAY04 storage-to-Cutter command rejects current %s proof before finite material changes",async(fault)=>{
 const {session,command,installStorage,setSolidFault}=await paidMachineHostFixture("B06");try{await installStorage();setSolidFault(fault);
  const before=session.ui.read();expect(before.connections?.belts.some(p=>p.sourcePortId==="port_raw_storage_fp02_b09_mat_out")).toBe(false);
  expect(await session.ui.submit(command(`reject_storage_${fault}`,{kind:"connect-belt",sourcePortId:"port_raw_storage_fp02_b09_mat_out",targetPortId:"port_test_machine_fp02_b06_in_steel",sourceLots:[]}))).toMatchObject({status:"Rejected",receipt:{reason:"NativeBeltEndpointUnavailable"}});
  expect(session.ui.read().inventory).toEqual(before.inventory);
 }finally{await session.dispose();}
});

it("W09 UI start is adopted only by the next confirmed joint interval and actual Native machine support",async()=>{
 const {f,session,command,setSupported,bindConfirmationToQuiescence}=await paidMachineHostFixture("B06");try{
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("local_steel_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:v.inventory.find(i=>i.id==="input_test_machine")!.revision}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const input=v.inventory.find(i=>i.id==="input_test_machine")!,lot=input.contents[0]!,machine=v.machines[0]!,payload={kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:lot.stackId,quantityUnits:8000000}]};
  setSupported(false);expect(await session.ui.submit(command("unsupported_native_start",payload))).toMatchObject({status:"Rejected",receipt:{reason:"NativeMachineUnavailable"}});setSupported(true);
  bindConfirmationToQuiescence();
  let settled=false;const start=session.ui.submit(command("confirmed_joint_start",payload)).then(result=>{settled=true;return result;});await Promise.resolve();await Promise.resolve();expect(settled).toBe(false);
  f.publish(6);expect(await start).toMatchObject({status:"Committed"});expect(session.read().steps).toBe(1);expect(session.ui.read().machines[0]?.status).toBe("WAIT_POWER");
  expect(session.ui.read().inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);expect(session.ui.read().machines[0]?.confirmedWorkMs).toBe(0);
 }finally{await session.dispose();}
});

it("W09 start reply stays pending until actual shared Factory CAS instead of acknowledging UI submission",async()=>{
 const {f,session,command}=await paidMachineHostFixture("B06");try{
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("queued_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:v.inventory.find(i=>i.id==="input_test_machine")!.revision}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const input=v.inventory.find(i=>i.id==="input_test_machine")!,machine=v.machines[0]!;let resolved=false;
  const pending=session.ui.submit(command("queued_actual_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]})).then(value=>{resolved=true;return value;});
  await Promise.resolve();await Promise.resolve();expect(resolved).toBe(false);expect(session.read().steps).toBe(0);f.publish(6);expect(await pending).toMatchObject({status:"Committed"});
 }finally{f.publish(6);await session.dispose();}
});
it("W09 queued process remains quiescent for ordinary Inspection Resume and still needs six confirmed ticks",async()=>{
 const {f,session,command}=await paidMachineHostFixture("B06");try{
  const v=session.ui.read(),machine=v.machines[0]!,input=v.inventory.find(i=>i.id==="input_test_machine")!;
  f.publish(f.host.read().nativeTick,{physicsStatus:"Paused",input:{active:false,activationPending:false,pointerLocked:false,pausePending:false,focusedPanel:null,surface:null,error:null}});let done=false;
  const pending=session.ui.submit(command("inspection_resume_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:"absent_steel",quantityUnits:8000000}]})).then(result=>{done=true;return result;});
  // A missing lot is rejected before queueing. Then use the actual local inventory path.
  expect(await pending).toMatchObject({status:"Rejected"});expect(done).toBe(true);
  const cargo=session.ui.read().inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("inspection_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:input.id,revision:input.revision}}))).toMatchObject({status:"Committed"});
  const now=session.ui.read(),local=now.inventory.find(i=>i.id===input.id)!;done=false;
  const start=session.ui.submit(command("inspection_real_start",{kind:"start",machine:{id:machine.id,revision:now.machines[0]!.revision},sourceLots:[{containerId:local.id,containerRevision:local.revision,stackId:local.contents[0]!.stackId,quantityUnits:8000000}]})).then(result=>{done=true;return result;});
  await Promise.resolve();await Promise.resolve();expect(done).toBe(false);expect(session.isQuiescent()).toBe(true);
  expect(session.canBeginFactoryCheckpoint()).toBe(false);
  expect(()=>session.beginFactoryCheckpoint()).toThrow(/checkpoint capture unavailable/i);
  await f.host.resume();expect(f.host.read().physicsStatus).toBe("Running");expect(session.read().steps).toBe(0);expect(done).toBe(false);
  f.publish(5);expect(done).toBe(false);f.publish(6);expect(await start).toMatchObject({status:"Committed"});
 }finally{await session.dispose();}
});

it("W09 identical pending start retry shares the final receipt without poisoning history",async()=>{
 const {f,session,command}=await paidMachineHostFixture("B06");try{
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  await session.ui.submit(command("retry_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}));
  v=session.ui.read();const input=v.inventory.find(i=>i.id==="input_test_machine")!,m=v.machines[0]!,request=command("retry_pending_start",{kind:"start",machine:{id:m.id,revision:m.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]});
  const first=session.ui.submit(request);let retrySettled=false;const retry=session.ui.submit(request).then(r=>{retrySettled=true;return r;});await Promise.resolve();await Promise.resolve();expect(retrySettled).toBe(false);
  f.publish(6);expect(await first).toMatchObject({status:"Committed"});expect(await retry).toMatchObject({status:"Committed"});expect(session.ui.readReceipt(request.commandId)?.status).toBe("Committed");
 }finally{f.publish(6);await session.dispose();}
});

it("W09 closing an unadopted pending process settles it without material or clock work",async()=>{
 const {session,command}=await paidMachineHostFixture("B06");
 let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
 await session.ui.submit(command("close_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}));
 v=session.ui.read();const input=v.inventory.find(i=>i.id==="input_test_machine")!,m=v.machines[0]!;let result:any;
 session.ui.submit(command("close_pending_start",{kind:"start",machine:{id:m.id,revision:m.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]})).then(r=>{result=r;});
 await Promise.resolve();await session.dispose();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 expect(result).toMatchObject({status:"Rejected",receipt:{reason:"SessionDisposedBeforeAdoption"}});expect(session.read()).toMatchObject({state:"Disposed",steps:0});expect(session.ui.read().inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
});

it("W09 real paid Host installation publishes finite machine buffers and advances one joint domain interval from six confirmed ticks",async()=>{
 // Same explicitly declared Native transport fixture as the command cases;
 // actual paid Resources/installation publication remains exercised by it.
 const {f,session}=await paidMachineHostFixture("B06");try{
  const ui=session.ui.read();expect(ui.machines).toHaveLength(1);expect(ui.machines[0]?.definitionId).toBe("B06");expect(ui.inventory.find(c=>c.id==="input_test_machine")?.capacityMassMg).toBe(16000000);expect(ui.inventory.find(c=>c.id==="installed_test_machine")?.massMg).toBe(208000000);
  f.publish(6);expect(session.read().steps).toBe(1);expect(session.ui.read().power.status).toBe("UNCONNECTED");expect(session.ui.read().machines[0]?.status).toBe("IDLE");
 }finally{await session.dispose();}
});

describe("FP06 W06 confirmed host lifecycle", () => {
  it.each(["catalog","material"])("W07 failed initial %s binding permits a valid retry on the SAME Host without a leaked mount",async(kind)=>{
    const f=hostFixture(),initial=f.host.read();let nativeCommands=0,nativeDisposals=0;
    const command=async()=>{nativeCommands++;};
    const host:FactoryHostPort={...f.host,construction:{openCargo:command,
      readFacts:()=>({binding:{sessionId:initial.sessionId,epoch:initial.epoch,terrainRevision:0,sourceDigest:"source",baseDigest:"base",facilityRevision:0},actor:{actorId:"test_actor",ownerId:"fp02_wreck_owner",positionMm:[0,0,0],canBuild:true},terrain:{cellMm:125,originMm:[0,0,0],size:[16,16,16],readSlot:()=>0}}),
      prepareNative:command,commitNative:command,publishNative:()=>{nativeCommands++;},rollbackNative:command,finalizeNative:command,stageProjection:command,publishProjection:()=>{nativeCommands++;},rollbackProjection:()=>{nativeCommands++;},finalizeProjection:()=>{nativeCommands++;},projectGhost:()=>{nativeCommands++;},dispose:()=>{nativeDisposals++;}}};
    const invalid=kind==="catalog"?{...catalog,canonicalJson:catalog.canonicalJson+" "}:{...catalog,resources:createResourceCatalog({...catalog.resources,resources:[]})};
    await expect(mountFactorySession(host,invalid)).rejects.toThrow();
    expect(f.listeners.size).toBe(0);expect(nativeCommands).toBe(0);expect(nativeDisposals).toBe(0);
    const retry=mountFactorySession(host,catalog);await expect(retry).resolves.toMatchObject({read:expect.any(Function)});
    const session=await retry;try{expect(session.read()).toMatchObject({state:"Ready",nativeTick:37});expect(f.listeners.size).toBe(1);expect(nativeCommands).toBe(0);}
    finally{await session.dispose();}expect(f.listeners.size).toBe(0);expect(nativeDisposals).toBe(1);
  });
  it("W07 releases the mount even when subscription and both cleanup hooks fail",async()=>{
    const f=hostFixture(),initial=f.host.read();let failSubscribe=true,failCleanup=true;
    const noAction=async()=>undefined;
    const host:FactoryHostPort={...f.host,setPanelFocus:()=>{if(failCleanup)throw Error("FocusCleanupFailed");},subscribeConfirmed:listener=>{
      if(failSubscribe)throw Error("SubscriptionFailed");return f.host.subscribeConfirmed(listener);
    },construction:{openCargo:noAction,readFacts:()=>({binding:{sessionId:initial.sessionId,epoch:initial.epoch,terrainRevision:0,
      sourceDigest:initial.terrain.sourceDigest,baseDigest:initial.terrain.baseDigest,facilityRevision:0},
      actor:{actorId:"test_actor",ownerId:"fp02_wreck_owner",positionMm:[0,0,0],canBuild:true},
      terrain:{cellMm:125,originMm:[-12000,0,-12000],size:[192,64,192],readSlot:()=>0}}),
      prepareNative:noAction,commitNative:noAction,publishNative:()=>undefined,rollbackNative:noAction,finalizeNative:noAction,
      stageProjection:noAction,publishProjection:()=>undefined,rollbackProjection:()=>undefined,finalizeProjection:()=>undefined,projectGhost:()=>undefined,
      dispose:()=>{if(failCleanup)throw Error("ConstructionCleanupFailed");}}};
    await expect(mountFactorySession(host,catalog)).rejects.toThrow(/SubscriptionFailed.*cleanup failed.*ConstructionCleanupFailed.*FocusCleanupFailed/);
    expect(f.listeners.size).toBe(0);
    failSubscribe=false;failCleanup=false;
    const retry=await mountFactorySession(host,catalog);
    expect(f.listeners.size).toBe(1);
    await retry.dispose();
    expect(f.listeners.size).toBe(0);
  });
  it("T028 binds baseline and remainder to six NEW native ticks, never duplicate render observations", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try {
      expect(session.read()).toMatchObject({ nativeTick: 37, steps: 0, remainderTicks: 0, elapsedMs: 0 });
      for (let frame = 0; frame < 100; frame++) f.publish(37);
      expect(session.read().steps).toBe(0);
      f.publish(42); expect(session.read()).toMatchObject({ steps: 0, remainderTicks: 5 });
      f.publish(43); expect(session.read()).toMatchObject({ steps: 1, remainderTicks: 0, elapsedMs: 100 });
      f.publish(56); expect(session.read()).toMatchObject({ steps: 3, remainderTicks: 1, elapsedMs: 300 });
      expect(Object.isFrozen(session.read())).toBe(true);
    } finally { await session.dispose(); }
  });
  it("Factory capture holds a remainder of two and lets only four later Native ticks complete one step", async () => {
    const {f,session,readHost,bindConfirmationToQuiescence}=await paidMachineHostFixture("B06");
    const neutralInput={active:false,activationPending:false,pointerLocked:false,pausePending:false,focusedPanel:null,surface:null,error:null} as const;
    try {
      const pausedTick=session.read().nativeTick+1;
      f.publish(pausedTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
      expect(session.read()).toMatchObject({nativeTick:pausedTick,remainderTicks:2,steps:0});
      bindConfirmationToQuiescence();
      expect(session.canBeginFactoryCheckpoint()).toBe(true);
      const capture=session.beginFactoryCheckpoint();
      expect(capture.host).toMatchObject({nativeTick:pausedTick,remainderTicks:2,steps:0});
      expect(session.isQuiescent()).toBe(false);
      expect(readHost().confirmed).toBe(false);
      capture.assertCurrent();
      expect(session.read()).toMatchObject({nativeTick:pausedTick,remainderTicks:2,steps:0});
      capture.release();capture.release();
      expect(session.isQuiescent()).toBe(true);
      f.publish(pausedTick+4,{physicsStatus:"Running",confirmed:true,input:neutralInput});
      expect(session.read()).toMatchObject({nativeTick:pausedTick+4,remainderTicks:0,steps:1,elapsedMs:100});
    } finally { await session.dispose(); }
  });
  it("Factory capture release refreshes repeated identical rejected-save headers at the same tick",async()=>{
    const {f,host,session}=await paidMachineHostFixture("B06"),neutralInput={active:false,activationPending:false,pointerLocked:false,
      pausePending:false,focusedPanel:null,surface:null,error:null} as const;
    const pausedTick=session.read().nativeTick;
    const rejectedPersistence={state:"Rejected" as const,message:"Save rejected",revision:1,saveAvailable:true,continueAvailable:true};
    f.publish(pausedTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput,persistence:rejectedPersistence});
    const actualRead=host.read.bind(host);let saveBusy=false;
    host.read=()=>{const current=actualRead();return saveBusy?{...current,confirmed:false}:current;};
    const confirmedPublications=[session.ui.read().host.confirmed],unsubscribe=session.ui.subscribe(snapshot=>confirmedPublications.push(snapshot.host.confirmed));
    const before=session.read(),material=session.readPresentation().material;
    try{
      for(let retry=0;retry<2;retry++){
        expect(session.canBeginFactoryCheckpoint()).toBe(true);
        const capture=session.beginFactoryCheckpoint();
        saveBusy=true;
        f.publish(pausedTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput,persistence:rejectedPersistence});
        expect(session.ui.read().host.confirmed).toBe(false);
        capture.release();
        expect(confirmedPublications.at(-1)).toBe(false);
        saveBusy=false;
        f.publish(pausedTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput,persistence:rejectedPersistence});
        expect(confirmedPublications.at(-1)).toBe(true);
      }
      expect(confirmedPublications).toEqual([true,false,true,false,true]);
      expect(session.read()).toEqual(before);
      expect(session.readPresentation().material).toBe(material);
    }finally{saveBusy=false;unsubscribe();await session.dispose();}
  });
  it.each(["header tick","terrain revision","Native revision"] as const)("Factory capture witness rejects a changed %s without granting paused work",async(change)=>{
    const {f,session,setNativeRevision}=await paidMachineHostFixture("B06"),neutralInput={active:false,activationPending:false,pointerLocked:false,
      pausePending:false,focusedPanel:null,surface:null,error:null} as const;
    try{
      f.publish(session.read().nativeTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
      const capture=session.beginFactoryCheckpoint(),saved=session.read();
      if(change==="header tick")f.publish(saved.nativeTick+1,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
      else if(change==="terrain revision")f.publish(saved.nativeTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput,
        terrain:{...f.host.read().terrain,revision:f.host.read().terrain.revision+1}});
      else setNativeRevision();
      expect(()=>capture.assertCurrent()).toThrow(/capture witness changed/);
      expect(session.read()).toEqual(saved);
      capture.release();capture.release();
      expect(session.read()).toEqual(saved);
    }finally{await session.dispose();}
  });
  it("disposing a session invalidates and releases its held capture witness",async()=>{
    const {f,host,session}=await paidMachineHostFixture("B06"),neutralInput={active:false,activationPending:false,pointerLocked:false,
      pausePending:false,focusedPanel:null,surface:null,error:null} as const;
    f.publish(session.read().nativeTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
    const capture=session.beginFactoryCheckpoint(),before=session.read();
    await session.dispose();
    expect(f.listeners.size).toBe(0);
    expect(()=>capture.assertCurrent()).toThrow(/capture witness changed/);
    capture.release();capture.release();
    expect(session.read()).toMatchObject({state:"Disposed",nativeTick:before.nativeTick,steps:before.steps,remainderTicks:before.remainderTicks});
    const retry=await mountFactorySession(host,catalog);
    expect(retry.read().state).toBe("Ready");
    await retry.dispose();
  });
  it("T026 refuses a second factory mount on the same live native host", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try { await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/already mounted/i); }
    finally { await session.dispose(); }
    const next = await mountFactorySession(f.host, catalog); await next.dispose();
  });
  it("T027 rejects queued old-epoch callbacks after dispose and never touches a replacement", async () => {
    const f = hostFixture(); const old = await mountFactorySession(f.host, catalog);
    const late = f.callbacks[0]; expect(late).toBeTypeOf("function");
    await old.dispose(); const before = old.read();
    const next = await mountFactorySession(f.host, catalog);
    late!(Object.freeze({ ...f.host.read(), nativeTick: 1000 }));
    expect(old.read()).toEqual(before); expect(next.read().steps).toBe(0);
    expect(f.listeners.size).toBe(1); await next.dispose(); expect(f.listeners.size).toBe(0);
  });
  it("closes on stale epoch or backwards tick without granting progress", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try {
      f.publish(36); expect(session.read()).toMatchObject({ state: "RecoveryHold", steps: 0 });
      f.publish(1000); expect(session.read().steps).toBe(0);
    } finally { await session.dispose(); }
    const g = hostFixture(); const other = await mountFactorySession(g.host, catalog);
    try { g.publish(1000, { epoch: 2 }); expect(other.read()).toMatchObject({ state: "RecoveryHold", steps: 0 }); }
    finally { await other.dispose(); }
  });
  it("flushes actual final confirmed ticks at pause ACK and grants no work while paused", async () => {
    const f = hostFixture(0); const session = await mountFactorySession(f.host, catalog);
    try {
      f.publish(5); await f.host.pause(); expect(session.read()).toMatchObject({ nativeTick: 6, steps: 1 });
      for (let frame = 0; frame < 100; frame++) f.publish(6, { physicsStatus: "Paused" });
      expect(session.read().steps).toBe(1);
    } finally { await session.dispose(); }
  });
  it("refuses a native RecoveryHold or disposed snapshot even if a caller marks it confirmed", async () => {
    const f = hostFixture(); f.publish(37, { physicsStatus: "RecoveryHold" });
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/confirmed|hold/i);
    f.publish(37, { physicsStatus: "Running" }); const session = await mountFactorySession(f.host, catalog);
    try { f.publish(1000, { physicsStatus: "Disposed" }); expect(session.read()).toMatchObject({ state: "RecoveryHold", steps: 0 }); }
    finally { await session.dispose(); }
  });
  it("does not bind a disposed or unconfirmed host, and ignores retirement", async () => {
    const f = hostFixture(); f.publish(37, { confirmed: false });
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/confirmed/i);
    f.publish(37, { confirmed: true }); const session = await mountFactorySession(f.host, catalog);
    try { f.retire(); f.publish(1000); expect(session.read().steps).toBe(0); }
    finally { await session.dispose(); }
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/current|disposed/i);
  });
  it("R1 keeps transient native holds quiescent without granting ticks and recovers only from confirmed reads", async () => {
    const f = hostFixture(0), session = await mountFactorySession(f.host, catalog);
    try {
      for (const physicsStatus of ["CoverageHold", "SimulationHold"] as const) {
        f.publish(6, { physicsStatus, confirmed: false });
        expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 0, steps: 0 });
        expect(session.isQuiescent()).toBe(true);
      }
      f.publish(6, { physicsStatus: "Running", confirmed: false });
      expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 0, steps: 0 });
      f.publish(6, { physicsStatus: "Running", confirmed: true });
      expect(session.read()).toMatchObject({ state: "Ready", nativeTick: 6, steps: 1 });
      f.publish(12, { physicsStatus: "RecoveryHold", confirmed: false });
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 6, steps: 1 });
      expect(session.isQuiescent()).toBe(false);
      f.publish(18, { physicsStatus: "Running", confirmed: true });
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 6, steps: 1 });
    } finally { await session.dispose(); }
  });
});

it("W09 common Host adopts real finite C27 once and resolves a lost UI reply before fresh binding or Native allocation",async()=>{
 const f=hostFixture(0);let prepares=0,focusChanges=0;let native:any={revision:1,state:"Idle",owners:[],prepared:null,transactionId:null,sources:[],cargo:{opened:true,accessible:true,ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo"}};
 const noop=async()=>{};
 // Native transport projection fixture. Resource quantities are the actual accepted catalog/initial Cargo.
 const host:FactoryHostPort={...f.host,setPanelFocus:()=>{focusChanges++;},construction:{openCargo:noop,readFacts:()=>({binding:{sessionId:f.host.read().sessionId,epoch:1,terrainRevision:0,sourceDigest:"source",baseDigest:"base",facilityRevision:native.revision},actor:{actorId:"hvp_player",ownerId:"fp02_wreck_owner",positionMm:[0,0,0],canBuild:true},terrain:{cellMm:125,originMm:[0,0,0],size:[16,16,16],readSlot:()=>0}}),prepareNative:noop,commitNative:noop,publishNative:()=>{},rollbackNative:noop,finalizeNative:noop,stageProjection:noop,publishProjection:()=>{},rollbackProjection:()=>{},finalizeProjection:()=>{},projectGhost:()=>{},dispose:()=>{}},handling:{read:()=>native,prepare:async(request)=>{prepares++;native={...native,state:"PreparedHeld",carrier:{ownerId:request.ownerId,profileId:request.profileId,profileDigest:request.profileDigest,containerId:request.custodyContainerId,phase:"PreparedHeld",massMg:300000000}};return native;},commit:async()=>{native={...native,state:"PublishedHeld",revision:native.revision+1};},publish:()=>{},rollback:noop,finalize:async()=>{native={...native,state:"Idle",carrier:{...native.carrier,phase:"Carrying"}};}}};
 const session=await mountFactorySession(host,catalog);try{
  const before=session.ui.read(),cargo=before.inventory.find(i=>i.role==="cargo")!,lot=cargo.contents.find(s=>s.itemId==="fp02.chassis.former")!;
  expect(cargo.contents).toHaveLength(79);
  const command:FactoryUiCommand={version:"fp06-ui-command-v1",commandId:"lost_reply_pickup",sessionId:before.sessionId,epoch:before.epoch,expected:before.binding,kind:"pickup",profileId:"C27-PACK",sourceLots:[{containerId:cargo.id,containerRevision:cargo.revision,stackId:lot.stackId,quantityUnits:1}]};
  const result=await session.ui.submit(command);expect(result.status).toBe("Committed");expect(prepares).toBe(1);
  const total=(v:typeof before)=>v.inventory.reduce((n,c)=>n+c.massMg,0),after=session.ui.read();expect(total(after)).toBe(total(before));expect(after.inventory.find(c=>c.role==="carrier")!.contents).toMatchObject([{stackId:lot.stackId,quantityUnits:1}]);
  expect(session.construction!.read().material.containers.find(c=>c.state.containerId===cargo.id)!.state.contents.some(s=>s.stackId===lot.stackId)).toBe(false);
  expect(await session.ui.submit(command)).toMatchObject({status:"NoOp",receipt:result.receipt});expect(prepares).toBe(1);
  expect(await session.ui.submit({...command,expected:after.binding})).toMatchObject({status:"Rejected",receipt:{reason:"IdempotencyConflict"}});expect(prepares).toBe(1);
  session.ui.setPanelFocus("cargo");expect(session.ui.read().focusedPanel).toBe("cargo");session.ui.setPanelFocus(null);expect(focusChanges).toBe(2);
 }finally{await session.dispose();}
});

describe("W06 bounded recursive Factory evidence", () => {
  const verify = (directory: string) => spawnSync(process.execPath,
    [fileURLToPath(new URL("../../../../../tools/factory/verify-evidence.mjs", import.meta.url)), directory], { encoding: "utf8" });
  const manifest = (artifacts: unknown) => JSON.stringify({ schema: "hestia.fp06.evidence/v1", artifacts });
  const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  it.each(["outside", "missing", "digest", "placeholder"])("R1 rejects %s manifest evidence references", kind => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-refs-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      const invalid = { outside: manifest([{ path: "../../outside.png", sha256: "0".repeat(64) }]),
        missing: manifest([{ path: "missing.txt", sha256: hash("observed") }]),
        digest: manifest([{ path: "actual.txt", sha256: "0".repeat(64) }]), placeholder: '{"test":"real"}' };
      writeFileSync(path.join(directory, "manifest.json"), invalid[kind as keyof typeof invalid]);
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("accepts real nested JSON and rejects corrupt descendants and symlinks", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-"));
    try {
      const nested = path.join(directory, "w06", "actual-run"); mkdirSync(nested, { recursive: true });
      writeFileSync(path.join(nested, "observed.json"), '{"ticks":6}');
      writeFileSync(path.join(nested, "manifest.json"), manifest([{ path: "observed.json", sha256: hash('{"ticks":6}') }]));
      expect(verify(directory).status).toBe(0);
      writeFileSync(path.join(nested, "bad.json"), '{');
      expect(verify(directory).status).toBe(1);
      rmSync(path.join(nested, "bad.json"));
      symlinkSync(path.join(nested, "manifest.json"), path.join(directory, "linked.json"));
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it.each(["artifacts", "evidenceFiles"])("binds actual %s bytes while preserving historical product receipts", field => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-digests-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      const value = { schema: "hestia.fp06.w01-evidence/v1",
        [field]: [{ path: "actual.txt", sha256: hash("observed"), bytes: 8 }],
        productFiles: [{ path: "apps/weltraum-browser/historical.ts", sha256: hash("old source") }],
        commands: [{ artifact: "actual.txt" }], verification: [{ log: "actual.txt" }], review: { artifact: "actual.txt" } };
      writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(value));
      expect(verify(directory).status).toBe(0);
      writeFileSync(path.join(directory, "actual.txt"), "mutated!"); expect(verify(directory).status).toBe(1);
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      value.review.artifact = "unlisted.txt"; writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(value));
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("bounds directories as well as files in recursive admission", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-entries-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      writeFileSync(path.join(directory, "manifest.json"), manifest([{ path: "actual.txt", sha256: hash("observed") }]));
      expect(verify(directory).status).toBe(0);
      for (let i = 0; i < 4097; i++) mkdirSync(path.join(directory, `empty-${i}`));
      const result = verify(directory); expect(result.status).toBe(1); expect(result.stderr).toContain("entry budget exceeded");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("rejects oversized evidence before reading or uploading it", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-budget-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      writeFileSync(path.join(directory, "manifest.json"), manifest([{ path: "actual.txt", sha256: hash("observed") }]));
      expect(verify(directory).status).toBe(0);
      const file = openSync(path.join(directory, "oversized.bin"), "w");
      ftruncateSync(file, 32 * 1024 * 1024 + 1); closeSync(file);
      const result = verify(directory); expect(result.status).toBe(1); expect(result.stderr).toContain("byte/file budget exceeded");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

it("W09 a paid Native cable connection consumes only its exact reachable C07 length and powers actual CUT work",async()=>{
 const {f,session,command,installBattery}=await paidMachineHostFixture("B06");try{
  await installBattery();let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  const connect=command("connect_real_cable",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:2750}});
  expect(await session.ui.submit(connect)).toMatchObject({status:"Committed"});expect(await session.ui.submit(connect)).toMatchObject({status:"NoOp"});
  v=session.ui.read();expect(v.binding.netRevision).toBe(1);expect(v.inventory.find(i=>i.id===cargo.id)?.contents.find(s=>s.itemId===cable.itemId)?.quantityUnits).toBe(37250);expect(v.inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
  const nowCargo=v.inventory.find(i=>i.role==="cargo")!,steel=nowCargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("powered_intake",{kind:"transfer",source:{containerId:nowCargo.id,containerRevision:nowCargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const m=v.machines[0]!,input=v.inventory.find(i=>i.id===m.inputContainerId)!,start=session.ui.submit(command("powered_start",{kind:"start",machine:{id:m.id,revision:m.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));f.publish(6);expect(await start).toMatchObject({status:"Committed",receipt:{reason:null}});
  v=session.ui.read();expect(v.machines[0]).toMatchObject({status:"RUNNING",confirmedWorkMs:100,allocatedWatts:1200});expect(v.inventory.find(i=>i.id===m.wipContainerId)?.massMg).toBe(8000000);expect(v.power.batteryEnergyJ).toBeLessThan(12960000);expect(v.inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
 }finally{f.publish(6);await session.dispose();}
});

it("W09 temporary actual service blockage takes a first-observed-clear baseline before fresh-step continuation",async()=>{
 const {f,session,command,installBattery,setServiceClear}=await paidMachineHostFixture("B06");try{
  await installBattery();let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  await session.ui.submit(command("service_cable",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:2750}}));
  v=session.ui.read();const c=v.inventory.find(i=>i.role==="cargo")!,steel=c.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  await session.ui.submit(command("service_intake",{kind:"transfer",source:{containerId:c.id,containerRevision:c.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}));
  v=session.ui.read();const machine=v.machines[0]!,input=v.inventory.find(i=>i.id===machine.inputContainerId)!,start=session.ui.submit(command("service_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));f.publish(6);expect(await start).toMatchObject({status:"Committed"});
  const before=session.ui.read();expect(before.machines[0]?.confirmedWorkMs).toBe(100);setServiceClear(false);f.publish(12);
  const blocked=session.ui.read();expect(blocked.state).toBe("Waiting");expect(blocked.inventory).toEqual(before.inventory);expect(blocked.power.batteryEnergyJ).toBe(before.power.batteryEnergyJ);expect(blocked.machines[0]?.confirmedWorkMs).toBe(100);expect(session.isQuiescent()).toBe(true);expect(blocked.interaction.openCargo.enabled).toBe(true);
  // Clearance might have changed only at native tick 17. Its first observed
  // clear receipt at 18 proves no earlier tick eligible for Factory work.
  setServiceClear(true);f.publish(18);expect(session.ui.read()).toMatchObject({state:"Ready",factorySteps:1});expect(session.ui.read().machines[0]?.confirmedWorkMs).toBe(100);expect(session.ui.read().power.batteryEnergyJ).toBe(before.power.batteryEnergyJ);
  f.publish(24);expect(session.ui.read()).toMatchObject({state:"Ready",factorySteps:2});expect(session.ui.read().machines[0]?.confirmedWorkMs).toBe(200);
 }finally{await session.dispose();}
});

it("W09 an unconfirmed Native electrical owner cannot allocate work from stale paid inventory",async()=>{
 const {f,session,command,installBattery,setPowerConfirmed}=await paidMachineHostFixture("B06");try{
  await installBattery();let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  expect(await session.ui.submit(command("confirmed_source_link",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:2750}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const c=v.inventory.find(i=>i.role==="cargo")!,steel=c.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  await session.ui.submit(command("confirmed_source_input",{kind:"transfer",source:{containerId:c.id,containerRevision:c.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}));
  v=session.ui.read();const machine=v.machines[0]!,input=v.inventory.find(i=>i.id===machine.inputContainerId)!,start=session.ui.submit(command("confirmed_source_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));f.publish(6);expect(await start).toMatchObject({status:"Committed"});
  const before=session.ui.read();expect(before.machines[0]?.confirmedWorkMs).toBe(100);setPowerConfirmed(false);f.publish(12);
  const after=session.ui.read();expect(after.state).toBe("RecoveryHold");expect(after.machines[0]?.confirmedWorkMs).toBe(100);expect(after.power.batteryEnergyJ).toBe(before.power.batteryEnergyJ);expect(after.inventory).toEqual(before.inventory.map(i=>({...i,pickupProfiles:i.pickupProfiles.map(p=>({...p,capability:{enabled:false,reason:"Quelle nicht erreichbar oder Transport belegt"}}))})));
 }finally{await session.dispose();}
});

it("W09 normal connect-belt consumes an entire paid local BELT4 depot and jointly publishes one zero-credit line",async()=>{
 const {f,host,session,command,setActorFixture,bindConfirmationToQuiescence}=await paidMachineHostFixture("B06");try{
  // These positions/Native replies are declared transport fixtures, never D07 route evidence.
  const pickup=async(profileId:string,id:string)=>{const inventory=session.ui.read().inventory.find(i=>i.role==="cargo")!,choice=inventory.pickupProfiles.find(p=>p.profileId===profileId)!;expect(await session.ui.submit(command(id,{kind:"pickup",profileId,sourceLots:choice.sourceLots}))).toMatchObject({status:"Committed"});};
  const deposit=async(id:string)=>{const handling=session.ui.read().interaction.handling!;expect(await session.ui.submit(command(id,{kind:"deposit",handling:{id:handling.id,revision:handling.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});};
  await pickup("B07-BOM","belt_former_payload");setActorFixture([7500,2420,2500]);await deposit("belt_former_depot");
  const former=session.construction!.preview({transactionId:"paid_line_former",instanceId:"line_former",definitionSourceId:"B07",centerMm:[7500,1500,0],quarterTurns:0});expect(former.status).toBe("Prepared");if(former.status!=="Prepared")throw Error(former.reason);expect(await session.construction!.commit(former)).toMatchObject({status:"Committed"});
  setActorFixture([0,2420,2500]);await pickup("BELT4","belt_line_payload");setActorFixture([3500,2420,2500]);await deposit("belt_line_depot");
  const view=session.ui.read(),depot=view.inventory.find(i=>i.role==="depot"&&i.contents.length===5)!,inputLots=depot.contents.map(s=>({containerId:depot.id,containerRevision:depot.revision,stackId:s.stackId,quantityUnits:s.quantityUnits}));
  const connect=command("actual_line_connection",{kind:"connect-belt",sourcePortId:"port_test_machine_fp02_b06_out_semi",targetPortId:"port_line_former_fp02_b07_in_semi",sourceLots:inputLots});
  bindConfirmationToQuiescence();
  expect(await session.ui.submit(connect)).toMatchObject({status:"Committed"});expect(await session.ui.submit(connect)).toMatchObject({status:"NoOp"});
  const after=session.ui.read();expect(session.construction!.read().installations.find(i=>i.definitionSourceId==="fp06.line.belt_4m")).toMatchObject({massMg:26000000,centerMm:[3500,1500,0],quarterTurns:0});
  expect(after.interaction.handling).toBeNull();expect(after.inventory.find(i=>i.id===depot.id)?.contents).toEqual([]);expect(after.inventory.find(i=>i.role==="belt")).toMatchObject({capacityMassMg:10000000,contents:[]});expect(after.inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
  const storedLine=session.readFactoryCheckpointMemory().factory.domain.belts[0]!,read=session.readPresentation(),presented=read.belts[0]!;
  expect(read.belts).toHaveLength(1);expect(presented.lineId).toBe(storedLine.lineId);expect(presented.driveInstanceId).toBe(storedLine.installation.driveInstanceId);
  expect(presented.lengthMm).toBe(storedLine.installation.lengthMm);expect(presented.bandContainerId).toBe(storedLine.installation.bandContainerId);
  expect(presented.source).toMatchObject({...storedLine.installation.source,confirmed:true});expect(presented.target).toMatchObject({...storedLine.installation.target,confirmed:true});
  expect(presented.source).not.toBe(storedLine.installation.source);expect(presented.source.centerMm).not.toBe(storedLine.installation.source.centerMm);
  expect(presented.packet).toBeNull();expect(Object.isFrozen(read.belts)).toBe(true);expect(Object.isFrozen(presented.source.centerMm)).toBe(true);
  const semi=catalog.items.find(item=>item.sourceId==="fp02.bulk.steel_semi")!;
  const phantomRead={...read,belts:read.belts.map(line=>line.lineId===presented.lineId?{...line,packet:{packetId:"phantom_packet",stackId:"phantom_packet",
    itemId:semi.sourceId,itemVersion:semi.version,itemDigest:semi.digest,positionMm:75}}:line)};
  expect(readFactoryMaterialProjection({domain:phantomRead,host:f.host.read(),facilities:host.handling!.read()}).packets).toEqual([]);
 }finally{await session.dispose();}
});

it("PLAY04 material projection follows an actually paid B09 belt packet through its band container",async()=>{
 const {f,host,session,command,setActorFixture,bindConfirmationToQuiescence,installStorage,installBattery}=await paidMachineHostFixture("B06");try{
  await installStorage();let view=session.ui.read(),cargo=view.inventory.find(c=>c.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  const storage=view.inventory.find(c=>c.id==="storage_raw_storage")!;
  expect(await session.ui.submit(command("packet_storage_stock",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,
    stackId:steel.stackId,quantityUnits:100_000},target:{id:storage.id,revision:storage.revision}}))).toMatchObject({status:"Committed"});

  const pickup=async(profileId:string,id:string)=>{const source=session.ui.read().inventory.find(c=>c.role==="cargo")!,choice=source.pickupProfiles.find(p=>p.profileId===profileId)!;
    expect(await session.ui.submit(command(id,{kind:"pickup",profileId,sourceLots:choice.sourceLots}))).toMatchObject({status:"Committed"});};
  const deposit=async(id:string)=>{const handling=session.ui.read().interaction.handling!;
    expect(await session.ui.submit(command(id,{kind:"deposit",handling:{id:handling.id,revision:handling.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});};
  setActorFixture([0,2420,2500]);await pickup("BELT4","packet_belt_payload");setActorFixture([-3250,2420,2500]);await deposit("packet_belt_depot");
  view=session.ui.read();const beltChoice=view.connections?.belts.find(candidate=>candidate.sourcePortId==="port_raw_storage_fp02_b09_mat_out"
    &&candidate.targetPortId==="port_test_machine_fp02_b06_in_steel");expect(beltChoice?.capability.enabled).toBe(true);
  const beltCommandId="actual_packet_belt";
  const beltConnection=await session.ui.submit(command(beltCommandId,{kind:"connect-belt",sourcePortId:beltChoice!.sourcePortId,
    targetPortId:beltChoice!.targetPortId,sourceLots:beltChoice!.sourceLots}));
  expect(beltConnection,`B09-to-Cutter belt connection failed: ${beltConnection.status}/${beltConnection.receipt.reason}`).toMatchObject({status:"Committed"});
  const lineId=`line_${beltCommandId}`;setActorFixture([4000,2420,2500]);await installBattery([7500,1500,0]);
  view=session.ui.read();const powerChoice=view.connections?.power.find(candidate=>candidate.sourcePortId==="power_battery"
    &&candidate.targetPortId===`power_${lineId}`);
  const powerDiagnostic=JSON.stringify({state:view.state,host:{confirmed:view.host.confirmed,phase:view.host.physicsStatus,surface:view.host.input?.surface},
    quiescent:session.isQuiescent(),choice:powerChoice?{sourcePortId:powerChoice.sourcePortId,targetPortId:powerChoice.targetPortId,
      capability:powerChoice.capability,lengthMm:powerChoice.lengthMm,hasCable:powerChoice.cableLot!==null}:null});
  expect(powerChoice?.capability.enabled,powerDiagnostic).toBe(true);expect(powerChoice?.cableLot).not.toBeNull();
  expect(await session.ui.submit(command("actual_packet_belt_power",{kind:"connect-power",sourcePortId:powerChoice!.sourcePortId,
    targetPortId:powerChoice!.targetPortId,cableLot:powerChoice!.cableLot!}))).toMatchObject({status:"Committed"});
  bindConfirmationToQuiescence();
  const tick=f.host.read().nativeTick;f.publish(tick+6,{physicsStatus:"Running",confirmed:true});
  let hostView=f.host.read(),domain=session.readPresentation(hostView),projection=readFactoryMaterialProjection({domain,host:hostView,facilities:host.handling!.read()});
  expect(projection.packets,"an injected packet is projected from the actual paid band ledger").toHaveLength(1);
  const first=projection.packets[0]!,line=domain.belts.find(entry=>entry.lineId===lineId)!,band=domain.material.containers.find(c=>c.state.containerId===line.bandContainerId)!;
  expect(first).toMatchObject({lineId,bandContainerId:line.bandContainerId,itemId:"fp02.bulk.steel_known",quantityUnits:100_000,positionMm:0,worldPositionMm:[-5500,2500,0]});
  expect(band.state.contents).toHaveLength(1);expect(band.state.contents[0]).toMatchObject({stackId:first.stackId,quantity:100_000});

  f.publish(hostView.nativeTick+6,{physicsStatus:"Running",confirmed:true});hostView=f.host.read();domain=session.readPresentation(hostView);
  projection=readFactoryMaterialProjection({domain,host:hostView,facilities:host.handling!.read()});
  expect(projection.packets).toHaveLength(1);expect(projection.packets[0]).toMatchObject({lineId,stackId:first.stackId,positionMm:75,worldPositionMm:[-5425,2500,0]});
  expect(domain.material.containers.find(c=>c.state.containerId===line.bandContainerId)?.state.contents[0]?.stackId).toBe(first.stackId);
 }finally{await session.dispose();}
});

it("W09 paid local C05 manual phases use zero electric work and create one actually paid usable brace",async()=>{
 const {f,session,command,setActorFixture,bindConfirmationToQuiescence,setNativeOwnerMaterialBinding,setNativeGate}=await paidMachineHostFixture("B05");
 const goalSpy=vi.spyOn(productionGoals,"projectFactoryProductionGoals").mockReturnValue(null);try{
  // Initial source stock is explicit here: the full normal flow separately must
  // prove fresh Former products. This case isolates manual/C05/custody admission.
  for(const [itemId,quantityUnits] of [["fp02.bulk.steel_profile",4000000],["fp02.bulk.steel_sheet",2000000]] as const){const v=session.ui.read(),cargo=v.inventory.find(i=>i.role==="cargo")!,stack=cargo.contents.find(s=>s.itemId===itemId)!,input=v.inventory.find(i=>i.id==="input_test_machine")!;expect(await session.ui.submit(command(`manual_intake_${quantityUnits}`,{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:stack.stackId,quantityUnits},target:{id:input.id,revision:input.revision}}))).toMatchObject({status:"Committed",receipt:{reason:null}});}
  let v=session.ui.read(),machine=v.machines[0]!,input=v.inventory.find(i=>i.id===machine.inputContainerId)!;expect(machine.recipes[0]).toMatchObject({durationMs:null,powerWatts:0});
  bindConfirmationToQuiescence();
  const start=session.ui.submit(command("manual_c05_start",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:input.contents.map(s=>({containerId:input.id,containerRevision:input.revision,stackId:s.stackId,quantityUnits:s.quantityUnits}))}));f.publish(6);expect(await start).toMatchObject({status:"Committed"});
  const startMaterial=session.readPresentation().material,startMachine=session.readFactoryCheckpointMemory().factory.domain.machines[0]!;
  session.readOnboarding();session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(1);
  v=session.ui.read();expect(v.machines[0]).toMatchObject({status:"LAID_OUT",confirmedWorkMs:0,allocatedWatts:0});expect(v.power.batteryEnergyJ).toBeNull();expect(v.power.consumers).toEqual([]);expect(v.inventory.find(i=>i.id===machine.wipContainerId)?.massMg).toBe(6000000);
  const neutralInput={active:false,activationPending:false,pointerLocked:false,pausePending:false,focusedPanel:null,surface:null,error:null} as const;
  f.publish(6,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
  const laidOut=session.beginFactoryCheckpoint();expect(laidOut.factory.domain.machines[0]).toMatchObject({status:"LAID_OUT",job:{phase:"LAID_OUT"}});laidOut.assertCurrent();laidOut.release();
  f.publish(6,{physicsStatus:"Running",confirmed:true});
  const montage=session.ui.submit(command("manual_c05_active_work",{kind:"manual-work",machine:{id:machine.id,revision:v.machines[0]!.revision},jobId:v.machines[0]!.jobId!}));f.publish(12);expect(await montage).toMatchObject({status:"Committed"});expect(session.ui.read().machines[0]?.status).toBe("ASSEMBLED");
  const workMachine=session.readFactoryCheckpointMemory().factory.domain.machines[0]!;
  expect(session.readPresentation().material).toBe(startMaterial);expect(workMachine.commandReceipts).not.toBe(startMachine.commandReceipts);
  expect(workMachine.commandReceipts.at(-1)?.kind).toBe("manual-work");
  expect(workMachine.commandReceipts.slice(0,startMachine.commandReceipts.length).every((receipt,index)=>receipt===startMachine.commandReceipts[index])).toBe(true);
  session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(2);session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(2);
  const retainedGoalBytesBeforeFinish=session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes;expect(retainedGoalBytesBeforeFinish).toBeGreaterThan(0);
  f.publish(12,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
  const assembled=session.beginFactoryCheckpoint();expect(assembled.factory.domain.machines[0]).toMatchObject({status:"ASSEMBLED",job:{phase:"ASSEMBLED"}});assembled.assertCurrent();assembled.release();
  f.publish(12,{physicsStatus:"Running",confirmed:true});
  v=session.ui.read();const finish=session.ui.submit(command("manual_c05_finish",{kind:"manual-finish",machine:{id:machine.id,revision:v.machines[0]!.revision},jobId:v.machines[0]!.jobId!}));f.publish(18);expect(await finish).toMatchObject({status:"Committed"});
  v=session.ui.read();expect(v.inventory.find(i=>i.id===machine.outputContainerId)?.contents).toMatchObject([{itemId:"fp02.comp.small_brace",quantityUnits:1,massMg:5800000,freshProduction:true}]);expect(v.inventory.find(i=>i.id===machine.offcutContainerId)?.massMg).toBe(200000);expect(v.power.allocatedWatts).toBe(0);
  const output=v.inventory.find(i=>i.id===machine.outputContainerId)!,choice=output.pickupProfiles.find(p=>p.profileId==="BRACE")!;expect(await session.ui.submit(command("actual_manual_brace_pickup",{kind:"pickup",profileId:"BRACE",sourceLots:choice.sourceLots}))).toMatchObject({status:"Committed"});setActorFixture([3000,2420,2500]);
  const c=session.ui.read().interaction.handling!;expect(await session.ui.submit(command("actual_manual_brace_depot",{kind:"deposit",handling:{id:c.id,revision:c.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});
  const plan=session.construction!.preview({transactionId:"paid_manual_brace_install",instanceId:"actual_manual_brace",definitionSourceId:"fp02.comp.small_brace",centerMm:[3000,1500,0],quarterTurns:0});expect(plan.status).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);expect(await session.construction!.commit(plan)).toMatchObject({status:"Committed"});
  expect(session.construction!.read().installations.find(i=>i.instanceId==="actual_manual_brace")).toMatchObject({massMg:5800000,definitionSourceId:"fp02.comp.small_brace"});expect(session.ui.read().interaction.handling).toBeNull();expect(session.ui.read().inventory.reduce((n,i)=>n+i.massMg,0)).toBe(2984400000);
  const retainedBeforeOnboarding=session.readFactoryCheckpointMemory(),oldGoalBytes=retainedBeforeOnboarding.cacheBreakdown?.goalProjectionMemoBytes;
  expect(retainedGoalBytesBeforeFinish).toBeGreaterThan(0);expect(oldGoalBytes).toBe(0);
  const cacheSum=(memory:ReturnType<typeof session.readFactoryCheckpointMemory>)=>{
   const b=memory.cacheBreakdown;if(!b)throw Error("Factory checkpoint cache breakdown missing");
   return b.cachedDomainCanonicalDescendantsBytes+b.dryFactoryStateBytes+b.currentExactMaterialBindingsBytes+b.currentProductionMaterialBytes+b.catalogTreeBytes+b.goalProjectionMemoBytes
    +b.initialMaterial.checkpointDtoBytes+b.initialMaterial.exactMaterialBindingsBytes+b.initialMaterial.productionMaterialBytes;
  };
  expect(cacheSum(retainedBeforeOnboarding)).toBe(retainedBeforeOnboarding.cacheBytes);
  session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(3);session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(3);
  const receiptsBeforeTick=session.readFactoryCheckpointMemory().factory.domain.machines[0]!.commandReceipts,receiptElements=[...receiptsBeforeTick];
  f.publish(session.read().nativeTick+6);
  const receiptsAfterTick=session.readFactoryCheckpointMemory().factory.domain.machines[0]!.commandReceipts;
  expect(receiptsAfterTick).not.toBe(receiptsBeforeTick);expect(receiptsAfterTick).toHaveLength(receiptElements.length);
  expect(receiptsAfterTick.every((receipt,index)=>receipt===receiptElements[index])).toBe(true);
  session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(3);

  setNativeOwnerMaterialBinding("actual_manual_brace","different paid binding");session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(4);
  session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(4);
  setNativeOwnerMaterialBinding("actual_manual_brace","x".repeat(524289));session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(5);
  expect(session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes).toBe(0);
  session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(6);
  setNativeOwnerMaterialBinding("actual_manual_brace",{malformed:true});
  expect(()=>session.readOnboarding()).not.toThrow();expect(goalSpy).toHaveBeenCalledTimes(7);
  expect(()=>session.readOnboarding()).not.toThrow();expect(goalSpy).toHaveBeenCalledTimes(8);
  setNativeGate("PreparedHeld",null,null);expect(session.readOnboarding()).toMatchObject({confirmed:false,production:null});expect(goalSpy).toHaveBeenCalledTimes(8);
  setNativeGate("Idle","transaction_still_pending",null);expect(session.readOnboarding().production).toBeNull();expect(goalSpy).toHaveBeenCalledTimes(9);
  setNativeGate("Idle",null,{pending:true});expect(session.readOnboarding().production).toBeNull();expect(goalSpy).toHaveBeenCalledTimes(10);
  setNativeGate("Idle",null,null);session.readOnboarding();expect(goalSpy).toHaveBeenCalledTimes(11);
 }finally{goalSpy.mockRestore();await session.dispose();}
});

it("Factory Save capture clears the Goal memo before admission and blocks reentry from retaining it",async()=>{
 const {f,session}=await paidMachineHostFixture("B06"),goalSpy=vi.spyOn(productionGoals,"projectFactoryProductionGoals");
 const neutralInput={active:false,activationPending:false,pointerLocked:false,pausePending:false,focusedPanel:null,surface:null,error:null} as const;
 try{
  const warm=session.readOnboarding(f.host.read());session.readOnboarding(f.host.read());
  expect(goalSpy).toHaveBeenCalledTimes(1);
  expect(session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes).toBeGreaterThan(0);
  f.publish(session.read().nativeTick,{physicsStatus:"Paused",confirmed:true,input:neutralInput});
  expect(session.canBeginFactoryCheckpoint()).toBe(true);
  const capture=session.beginFactoryCheckpoint((_raw,admittedBytes)=>{
   const beforeRead=session.readFactoryCheckpointMemory();
   expect(beforeRead.cacheBreakdown?.goalProjectionMemoBytes).toBe(0);
   expect(admittedBytes).toBe(beforeRead.cacheBytes);
   const during=session.readOnboarding(f.host.read());
   expect(during).toEqual(warm);
   expect(goalSpy).toHaveBeenCalledTimes(2);
   expect(session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes).toBe(0);
  });
  capture.assertCurrent();capture.release();
  expect(session.readOnboarding(f.host.read())).toEqual(warm);
  expect(session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes).toBeGreaterThan(0);

  let failedAdmissionGoalBytes=-1;
  expect(()=>session.beginFactoryCheckpoint((_raw)=>{
   failedAdmissionGoalBytes=session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes??-1;
   throw Error("capture admission fixture failure");
  })).toThrow("capture admission fixture failure");
  expect(failedAdmissionGoalBytes).toBe(0);
  expect(session.isQuiescent()).toBe(true);
  expect(session.canBeginFactoryCheckpoint()).toBe(true);
  expect(session.readFactoryCheckpointMemory().cacheBreakdown?.goalProjectionMemoBytes).toBe(0);
 }finally{goalSpy.mockRestore();await session.dispose();}
});

it("W09 publishes a whole two-lot MONTAGE delivery to the actual reachable paid bench input",async()=>{
 const {session,command}=await paidMachineHostFixture("B05");try{
  // Initial stock and Native replies are declared fixtures: this isolates the
  // two-lot UI/Host custody bridge, not the fresh Former/D07 gameplay gate.
  const cargo=session.ui.read().inventory.find(i=>i.role==="cargo")!,choice=cargo.pickupProfiles.find(p=>p.profileId==="MONTAGE")!;expect(choice.sourceLots).toHaveLength(2);
  expect(await session.ui.submit(command("whole_montage_pickup",{kind:"pickup",profileId:"MONTAGE",sourceLots:choice.sourceLots}))).toMatchObject({status:"Committed"});
  let v=session.ui.read();const handling=v.interaction.handling!,depot=v.inventory.find(i=>i.role==="carrier")!;
  expect(depot.contents).toHaveLength(2);expect(depot.massMg).toBe(6000000);
  const deliveries=(v.interaction as typeof v.interaction&{localDeposits?:readonly {target:{id:string;revision:number};capability:{enabled:boolean}}[]}).localDeposits;
  const destination=deliveries?.find(d=>d.target.id==="input_test_machine");expect(destination).toMatchObject({target:{id:"input_test_machine",revision:0},capability:{enabled:true}});if(!destination)throw Error("WholeLocalDepositNotPublished");
  const delivery=command("whole_montage_local_input",{kind:"deposit",handling:{id:handling.id,revision:handling.revision},target:{kind:"container",container:destination.target}});
  expect(await session.ui.submit(delivery)).toMatchObject({status:"Committed"});expect(await session.ui.submit(delivery)).toMatchObject({status:"NoOp"});
  v=session.ui.read();expect(v.interaction.handling).toBeNull();expect(v.inventory.find(i=>i.id===depot.id)?.contents).toEqual([]);expect(v.inventory.find(i=>i.id==="input_test_machine")).toMatchObject({massMg:6000000,contents:[{quantityUnits:4000000},{quantityUnits:2000000}]});expect(v.inventory.reduce((n,i)=>n+i.massMg,0)).toBe(2984400000);
 }finally{await session.dispose();}
});

it("W09 exact CABLE6500 consumes one whole reachable deposited custody with its paid graph connection",async()=>{
 const {session,command,setActorFixture,installBattery}=await paidMachineHostFixture("B06");try{
  // Declared Native transport observations isolate the joint Host adoption.
  setActorFixture([-3750,2420,2500]);await installBattery([-6750,1500,0]);
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  const pickup=command("exact_cable_pickup",{kind:"pickup",profileId:"CABLE6500",sourceLots:[{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:6500}]});
  expect(await session.ui.submit(pickup)).toMatchObject({status:"Committed",receipt:{reason:null}});v=session.ui.read();expect(v.inventory.find(i=>i.id===cargo.id)?.contents.find(s=>s.itemId===cable.itemId)?.quantityUnits).toBe(33500);
  const carrying=v.interaction.handling!;expect(carrying).toMatchObject({profileId:"CABLE6500",massMg:1625000});
  expect(await session.ui.submit(command("exact_cable_deposit",{kind:"deposit",handling:{id:carrying.id,revision:carrying.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const depot=v.inventory.find(i=>i.role==="depot"&&i.contents.some(s=>s.itemId===cable.itemId))!,lot=depot.contents[0]!;
  const connect=command("exact_cable_connection",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:depot.id,containerRevision:depot.revision,stackId:lot.stackId,quantityUnits:6500}});
  expect(await session.ui.submit(connect)).toMatchObject({status:"Committed",receipt:{reason:null}});expect(await session.ui.submit(connect)).toMatchObject({status:"NoOp"});
  const after=session.ui.read();expect(after.binding.netRevision).toBe(1);expect(after.interaction.handling).toBeNull();expect(after.inventory.find(i=>i.id===depot.id)?.contents).toEqual([]);expect(after.inventory.find(i=>i.id==="installed_cable_exact_cable_connection")).toMatchObject({massMg:1625000});expect(after.inventory.reduce((n,i)=>n+i.massMg,0)).toBe(2984400000);
  const storedLink=session.readFactoryCheckpointMemory().factory.links[0]!,read=session.readPresentation(),presented=read.powerLinks[0]!;
  expect(read.powerLinks).toHaveLength(1);expect(presented).toEqual({linkId:storedLink.linkId,fromPortId:storedLink.fromPortId,toPortId:storedLink.toPortId,
   sourceProfileDigest:storedLink.sourceProfileDigest,targetProfileDigest:storedLink.targetProfileDigest,containerId:storedLink.containerId,
   lengthMm:storedLink.lengthMm,routeMm:storedLink.routeMm,active:storedLink.active});
  expect(presented.routeMm).toHaveLength(4);expect(Object.isFrozen(read.powerLinks)).toBe(true);expect(Object.isFrozen(presented)).toBe(true);
  expect(presented.routeMm).not.toBe(storedLink.routeMm);expect(presented.routeMm[0]).not.toBe(storedLink.routeMm[0]);
  expect(session.readPresentation().powerLinks[0]).not.toBe(presented);
 }finally{await session.dispose();}
});

it("W09 publishes only Native-bound paid power choices for normal player connection controls",async()=>{
 const {session,installBattery}=await paidMachineHostFixture("B06");try{
  await installBattery();const view=session.ui.read();
  expect((view as any).connections?.power).toEqual(expect.arrayContaining([expect.objectContaining({sourcePortId:"power_battery",targetPortId:"power_test_machine",lengthMm:2750,cableLot:expect.objectContaining({quantityUnits:2750}),capability:{enabled:true,reason:null}})]));
  expect((view as any).connections?.power.every((choice:any)=>choice.sourcePortId!==choice.targetPortId)).toBe(true);
 }finally{await session.dispose();}
});


it("W09 complete known technology directory exposes later source targets and honest missing capabilities without authority",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog);try{
  const before=session.ui.read(),tech=before.technologies,ids=tech.map(t=>t.id);
  const expected=[...Array.from({length:15},(_,i)=>`B${String(i+1).padStart(2,"0")}`),...Array.from({length:16},(_,i)=>`ST-${String(i+1).padStart(2,"0")}`),
   "fp04.surface-miner.small.v1","fp04.survey-beacon.local.v1","fp04.excavator.compact.v1","fp04.earth-grader.v1","fp04.excavator.large.v1","fp04.biomass-harvester.v1","fp04.crusher-interface.transfer.v1",
   "fp04.cargo-rover.small.v1","fp04.cargo-hauler.bulk.v1","fp04.depot.bulk.v1","fp04.charging-bay.vehicle.v1","fp04.dispatch-terminal.v1","fp04.conveyor.bulk.upgrade.v1",
   "fp04.builder-crawler.v1","fp04.builder-drone.light.v1","fp04.gantry-loader.mobile.v1","fp04.construction-depot.v1","fp04.repair-bot.v1",
   "fp05.water.survey-stake.v1","fp05.water.intake-skid.v1","fp05.water.pump-skid.small.v1","fp05.pipe.water.standard.v1","fp05.valve.isolation.v1","fp05.tank.water.10m3.v1","fp05.filter.water.basic.v1","fp05.junction.flow-meter.v1","fp05.water.recycle.compact.v1","fp05.thermal.coolant-skid.v1","fp05.pipe.support.bridge.v1",
   "fp05.ore.wet-concentrator.v1","fp05.tailings.thickener.v1","fp05.tailings.dewater.v1","fp05.scrap.industrial-sorter.v1","fp05.foundry.recycled-metal.electric.v1","fp05.foundry.casting-cell.v1","fp05.industrial.mill-precision.v1","fp05.industrial.parts-assembly.v1","fp05.heat.exchanger.moderate.v1","fp05.industry.power-substation.v1","fp05.power.thermalplant.optional.v1","fp05.gas.compressor.storage-skid.v1","fp05.industry.waste-yard.v1","fp05.water.storage.mobile-tanker.v1","fp05.industry.repair-gantry.v1",
   "fp05.city.perimeter-gateway.v1","fp05.city.substation-alpha.v1","fp05.city.pumpworks.v1","fp05.city.industrial-yard.v1","fp05.city.robot-dock-cluster.v1","fp05.city.archive-core.v1","fp05.city.transport-exchange.v1","fp05.city.public-comms.v1","fp05.city.service-and-medbay.v1","fp05.city.civic-concourse.v1","fp05.city.spaceport-apron.v1","fp05.city.grid-battery-recovery.v1",...catalog.recipes.map(r=>r.sourceId),...Array.from({length:5},(_,i)=>`fp03.build.B${i}`),...Array.from({length:5},(_,i)=>`fp04.energy.E${i}`),"FP04-WIND-FAB-6KW-V0",...Array.from({length:7},(_,i)=>`fp05.energy.P${i}`)];
  expect(ids).toEqual(expect.arrayContaining(expected));expect(new Set(ids).size).toBe(ids.length);
  for(const id of expected.filter(id=>id.startsWith("fp04.")||id.startsWith("fp05."))){const t=tech.find(t=>t.id===id)!;expect(t.status).toBe("PLANNED");expect(t.requirements.some(r=>r.includes("Implementierung fehlt"))).toBe(true);expect(t.requirements.some(r=>r.startsWith("Quelle: FP"))).toBe(true);}
  expect(tech.find(t=>t.id==="fp05.power.thermalplant.optional.v1")?.requirements.join(" ")).toMatch(/Brennstoff.*Oxidator/);
  expect(tech.find(t=>t.id==="fp05.city.spaceport-apron.v1")?.requirements.join(" ")).toMatch(/hergestelltes Schiff/);
  expect(tech.find(t=>t.id==="B08")).toMatchObject({status:"PLANNED"});expect(tech.find(t=>t.id==="B08")?.requirements.join(" ")).toMatch(/Packvolumen.*offen/);
  expect(tech.find(t=>t.id==="ST-03")?.requirements.join(" ")).toContain("12 kg Profile + 8 kg Blech");
  expect(tech.find(t=>t.id==="B06")?.requirements.join(" ")).toMatch(/Betrieb.*separat/);
  expect(session.ui.read().inventory).toEqual(before.inventory);expect(session.ui.read().binding).toEqual(before.binding);expect(session.read().steps).toBe(0);expect(f.host.read().nativeTick).toBe(0);
 }finally{await session.dispose();}
});


it("W09 technology recipe requirements retain exact physical units",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog);try{
  const before=session.ui.read();expect(before.technologies.find(t=>t.id==="REC-01-CUT")?.requirements.join(" ")).toContain("8 kg");
 }finally{await session.dispose();}
});
it("W09 supported technology uses actual Host availability without changing planned targets",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog);try{
  const before=session.ui.read();
  f.publish(0,{confirmed:false});const held=session.ui.read();
  expect(held.technologies.find(t=>t.id==="B06")).toMatchObject({status:"MISSING_REQUIREMENTS"});
  expect(held.technologies.find(t=>t.id==="B06")?.requirements.join(" ")).toContain("Bestätigter Nativezustand fehlt");
  expect(held.technologies.find(t=>t.id==="fp05.city.archive-core.v1")).toMatchObject({status:"PLANNED"});
  expect(held.inventory).toEqual(before.inventory);expect(session.read().steps).toBe(0);
 }finally{await session.dispose();}
});


it.each(["commit","publish","finalize","commit-rollback"] as const)("W09 exact Cable joint outcome preserves custody or holds unknown %s without refunds and replay",async(fault)=>{
 const {session,command,setActorFixture,installBattery,setReleaseFault}=await paidMachineHostFixture("B06");try{
  // Explicit Native reply/fault fixture exercises actual Host CAS/history/publication policy, not a Rapier rollback proof.
  setActorFixture([-3750,2420,2500]);await installBattery([-6750,1500,0]);
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  expect(await session.ui.submit(command("fault_cable_pickup",{kind:"pickup",profileId:"CABLE6500",sourceLots:[{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:6500}]}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const carrying=v.interaction.handling!;expect(await session.ui.submit(command("fault_cable_deposit",{kind:"deposit",handling:{id:carrying.id,revision:carrying.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});
  const before=session.ui.read(),depot=before.inventory.find(i=>i.role==="depot"&&i.contents.some(s=>s.itemId===cable.itemId))!,lot=depot.contents[0]!;
  const connection=command("fault_cable_connection",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:depot.id,containerRevision:depot.revision,stackId:lot.stackId,quantityUnits:6500}});setReleaseFault(fault);
  const result=await session.ui.submit(connection),after=session.ui.read();expect(after.inventory.reduce((n,i)=>n+i.massMg,0)).toBe(2984400000);
  expect(await session.ui.submit(connection)).toMatchObject({status:result.status,receipt:result.receipt});
  expect(after.inventory.find(i=>i.id===cargo.id)?.contents.find(s=>s.itemId===cable.itemId)?.quantityUnits).toBe(33500);
  if(fault==="commit"){expect(result.status).toBe("Rejected");expect(after.state).toBe("Ready");expect(after.binding.netRevision).toBe(before.binding.netRevision);expect(after.inventory).toEqual(before.inventory);expect(after.interaction.handling).toEqual(before.interaction.handling);}
  else{expect(result.status).toBe("RecoveryHold");expect(after.state).toBe("RecoveryHold");expect(session.isQuiescent()).toBe(false);expect(after.interaction.deposit.enabled).toBe(false);}
  if(fault==="publish"||fault==="finalize"){expect(after.binding.netRevision).toBe(1);expect(after.inventory.find(i=>i.id===depot.id)?.contents).toEqual([]);expect(after.inventory.find(i=>i.id==="installed_cable_fault_cable_connection")).toMatchObject({massMg:1625000});}
  if(fault==="commit-rollback"){expect(after.binding.netRevision).toBe(0);expect(after.inventory.find(i=>i.id===depot.id)?.contents[0]?.quantityUnits).toBe(6500);}
  if(fault!=="commit"){
    // A new, otherwise valid command must be rejected by Host authority even when its Native fixture is confirmed.
    expect(after.host.confirmed).toBe(true);
    const source=after.inventory.find(i=>i.id===cargo.id)!,steel=source.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!,target=after.inventory.find(i=>i.id==="input_test_machine")!;
    const fresh=command("fresh_transfer_after_unknown_cable",{kind:"transfer",source:{containerId:source.id,containerRevision:source.revision,stackId:steel.stackId,quantityUnits:1000000},target:{id:target.id,revision:target.revision}});
    expect(await session.ui.submit(fresh)).toMatchObject({status:"RecoveryHold",receipt:{reason:"FactorySessionRecoveryHold"}});
    const held=session.ui.read();expect(held.inventory).toEqual(after.inventory);expect(held.binding).toEqual(after.binding);expect(held.host).toEqual(after.host);expect(held.interaction.handling).toEqual(after.interaction.handling);
    expect(await session.ui.submit(connection)).toMatchObject({status:result.status,receipt:result.receipt});
  }
 }finally{await session.dispose();}
});


it.each(["whole40","unconfirmed"] as const)("W09 Native-bound Cable connection rejects %s before any finite custody or graph mutation",async(mode)=>{
 const {session,command,setActorFixture,installBattery,setPowerConfirmed}=await paidMachineHostFixture("B06");try{
  setActorFixture([-3750,2420,2500]);await installBattery([-6750,1500,0]);
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!,quantity=mode==="whole40"?40000:6500;
  expect(await session.ui.submit(command("negative_cable_pickup",{kind:"pickup",profileId:mode==="whole40"?"CABLE40":"CABLE6500",sourceLots:[{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:quantity}]}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const carrying=v.interaction.handling!;expect(await session.ui.submit(command("negative_cable_deposit",{kind:"deposit",handling:{id:carrying.id,revision:carrying.revision},target:{kind:"ground"}}))).toMatchObject({status:"Committed"});
  const before=session.ui.read(),depot=before.inventory.find(i=>i.role==="depot"&&i.contents.some(s=>s.itemId===cable.itemId))!,lot=depot.contents[0]!;if(mode==="unconfirmed")setPowerConfirmed(false);
  const result=await session.ui.submit(command("negative_cable_connection",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:depot.id,containerRevision:depot.revision,stackId:lot.stackId,quantityUnits:6500}}));
  expect(result).toMatchObject({status:"Rejected",receipt:{reason:mode==="whole40"?"CableCustodyUnavailable":"NativePowerConnectionUnavailable"}});
  const after=session.ui.read();expect(after.inventory).toEqual(before.inventory);expect(after.interaction.handling).toEqual(before.interaction.handling);expect(after.binding.netRevision).toBe(0);expect(after.binding.materialRevision).toBe(before.binding.materialRevision);expect(after.inventory.reduce((n,i)=>n+i.massMg,0)).toBe(2984400000);
 }finally{await session.dispose();}
});

describe("PLAY04 actual Host power control lifetime",()=>{
 let fixture:Awaited<ReturnType<typeof paidMachineHostFixture>>;
 let before:ReturnType<FactorySessionHandle["ui"]["read"]>;
 let darkDevice:{id:string;revision:number;enabled:boolean};
 beforeAll(async()=>{
  fixture=await paidMachineHostFixture("B06");const {f,session,command,installBattery}=fixture;
  await installBattery();let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  expect(await session.ui.submit(command("control_cable",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:2750}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const c=v.inventory.find(i=>i.role==="cargo")!,steel=c.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("control_intake",{kind:"transfer",source:{containerId:c.id,containerRevision:c.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const m=v.machines[0]!,input=v.inventory.find(i=>i.id===m.inputContainerId)!;
  const pending=session.ui.submit(command("control_start",{kind:"start",machine:{id:m.id,revision:m.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));f.publish(6);expect(await pending).toMatchObject({status:"Committed"});

 });
 afterAll(async()=>{await fixture?.session.dispose();});
 it("preserves paid active CUT WIP/work and finite battery energy through blackout",async()=>{
  const {f,session,command,setPowerConfirmed,bindConfirmationToQuiescence}=fixture;
  before=session.ui.read();const devices=(before.power as typeof before.power&{devices?:readonly {id:string;revision:number;enabled:boolean}[]}).devices;
  const battery=devices?.find(d=>d.id==="battery");expect(battery,"actual installed battery requires a source-bound control").toBeDefined();if(!battery)throw Error("BatteryControlMissing");
  bindConfirmationToQuiescence();
  const off=command("control_power_off",{kind:"set-enabled",machine:{id:battery.id,revision:battery.revision},enabled:false});
  expect(await session.ui.submit(off)).toMatchObject({status:"Committed"});expect(await session.ui.submit(off)).toMatchObject({status:"NoOp"});
  f.publish(12);const dark=session.ui.read();expect(dark.machines[0]?.confirmedWorkMs).toBe(before.machines[0]?.confirmedWorkMs);expect(dark.power.batteryEnergyJ).toBe(before.power.batteryEnergyJ);expect(dark.inventory).toEqual(before.inventory);
  darkDevice=(dark.power as typeof dark.power&{devices:readonly {id:string;revision:number;enabled:boolean}[]}).devices.find(d=>d.id==="battery")!;
  expect(darkDevice.enabled).toBe(false);setPowerConfirmed(false);
  expect(await session.ui.submit(command("control_stale_native",{kind:"set-enabled",machine:{id:darkDevice.id,revision:darkDevice.revision},enabled:true}))).toMatchObject({status:"Rejected"});setPowerConfirmed(true);

 });
 it("restores power only after the unchanged D03 two-second restart period",async()=>{
  const {f,session,command}=fixture;
  expect(await session.ui.submit(command("control_power_on",{kind:"set-enabled",machine:{id:darkDevice.id,revision:darkDevice.revision},enabled:true}))).toMatchObject({status:"Committed"});
  for(let tick=18;tick<=132;tick+=6)f.publish(tick);
  expect(session.ui.read().machines[0]?.confirmedWorkMs).toBe(before.machines[0]?.confirmedWorkMs);
  f.publish(138);expect(session.ui.read().machines[0]?.confirmedWorkMs).toBe(before.machines[0]!.confirmedWorkMs+100);
  expect(session.ui.read().power.batteryEnergyJ).toBeLessThan(before.power.batteryEnergyJ!);

 });
});

import * as productionGoals from "../../../src/factory/session/freshLineageProjection";
it("PLAY04 empty private domain keeps confirmed cargo onboarding without repeatedly walking production history",async()=>{
 // Declared Host transport fixture; actual finite FP02 Cargo is initialized by Session.
 const f=hostFixture(0),noop=async()=>{};
 const native:any={revision:0,state:"Idle",owners:[],prepared:null,transactionId:null,sources:[],cargo:{opened:false,accessible:true,ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo"}};
 const host:FactoryHostPort={...f.host,construction:{openCargo:noop,readFacts:()=>({binding:{sessionId:f.host.read().sessionId,epoch:1,terrainRevision:0,sourceDigest:"source",baseDigest:"base",facilityRevision:0},actor:{actorId:"hvp_player",ownerId:"fp02_wreck_owner",positionMm:[0,0,0],canBuild:true},terrain:{cellMm:125,originMm:[0,0,0],size:[16,16,16],readSlot:()=>0}}),prepareNative:noop,commitNative:noop,publishNative:()=>{},rollbackNative:noop,finalizeNative:noop,stageProjection:noop,publishProjection:()=>{},rollbackProjection:()=>{},finalizeProjection:()=>{},projectGhost:()=>{},dispose:()=>{}},handling:{read:()=>native,prepare:async()=>native,commit:noop,publish:()=>{},rollback:noop,finalize:noop}};
 const spy=vi.spyOn(productionGoals,"projectFactoryProductionGoals").mockReturnValue(null),session=await mountFactorySession(host,catalog);
 try{
  const before=session.readPresentation();expect(before.machines).toEqual([]);
  for(let i=0;i<50;i++)expect(session.readOnboarding()).toMatchObject({confirmed:true,cargoOpened:false,installedSourceIds:[],production:null});
  expect(spy).not.toHaveBeenCalled();
  expect(session.readPresentation().material).toBe(before.material);expect(session.ui.read().inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
 }finally{spy.mockRestore();await session.dispose();}
});
it("PLAY04 onboarding reads retained initial material and adopted histories and closes on a foreign Host lifetime",async()=>{
 const seen:Parameters<typeof productionGoals.projectFactoryProductionGoals>[0][]=[];
 const facts={lineageId:"test_lineage",inputSteelMg:16000000,cutBatches:2,cutOutputMg:15000000,cutOffcutMg:1000000,
  profileOutputMg:7000000,sheetOutputMg:7000000,formerOffcutMg:1000000,braceOutputMg:5800000,braceOffcutMg:200000,installedBraceMg:5800000,paidBraceInstallation:true} as const;
 const spy=vi.spyOn(productionGoals,"projectFactoryProductionGoals").mockImplementation(input=>{seen.push(input);return seen.length===1?facts:null;});
 const {f,session,command,setNativeRevision}=await paidMachineHostFixture("B06");
 try{
  const read=(session as typeof session&{readOnboarding?:(view?:FactoryHostView)=>unknown}).readOnboarding;
  expect(read,"confirmed Goal projection requires the retained actual baseline").toBeTypeOf("function");if(!read)throw Error("GoalReadMissing");
  expect((read() as {production:unknown}).production).toBe(facts);const first=seen.at(-1)!;expect(first.binding.confirmed).toBe(true);expect(first.initialMaterial.revision).toBe(0);expect(first.initialMaterial.receipts).toEqual([]);expect(first.initialMaterial.containers.map(c=>c.state.containerId)).toEqual(["fp02_wreck_cargo"]);
  expect((read() as {production:unknown}).production).toBe(facts);expect(seen).toHaveLength(1);
  const construction=session.construction!,readConstruction=construction.read.bind(construction);let copiedSnapshot=readConstruction();
  construction.read=()=>copiedSnapshot;copiedSnapshot=Object.freeze({...copiedSnapshot,installations:Object.freeze([...copiedSnapshot.installations])});
  read();expect(seen).toHaveLength(2);read();expect(seen).toHaveLength(2);
  construction.read=readConstruction;read();expect(seen).toHaveLength(3);read();expect(seen).toHaveLength(3);
  expect(first.material).toBe(session.readPresentation().material);expect(first.material.receipts.length).toBeGreaterThan(0);expect(first.machines.map(m=>m.machineInstanceId)).toEqual(["test_machine"]);
  const v=session.ui.read(),cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("goal_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}))).toMatchObject({status:"Committed"});
  read();const next=seen.at(-1)!;expect(seen).toHaveLength(4);expect(next.initialMaterial).toBe(first.initialMaterial);expect(next.material).not.toBe(first.material);expect(next.material.receipts.length).toBeGreaterThan(first.material.receipts.length);
  setNativeRevision();read();expect(seen).toHaveLength(5);
  const memory=session.readFactoryCheckpointMemory(),memoryAfterRepeat=session.readFactoryCheckpointMemory(),breakdown=memory.cacheBreakdown;
  if(!breakdown)throw Error("Factory checkpoint cache breakdown missing");
  expect(breakdown.initialMaterial).toMatchObject({included:true});expect(breakdown.initialMaterial.checkpointDtoBytes).toBeGreaterThan(0);
  expect(breakdown.cachedDomainCanonicalDescendantsBytes+breakdown.dryFactoryStateBytes+breakdown.currentExactMaterialBindingsBytes
    +breakdown.currentProductionMaterialBytes+breakdown.catalogTreeBytes+breakdown.goalProjectionMemoBytes+breakdown.initialMaterial.checkpointDtoBytes
    +breakdown.initialMaterial.exactMaterialBindingsBytes+breakdown.initialMaterial.productionMaterialBytes).toBe(memory.cacheBytes);
  expect(memoryAfterRepeat.cacheBytes).toBe(memory.cacheBytes);expect(memoryAfterRepeat.cacheBreakdown).toEqual(breakdown);
  const held=read({...f.host.read(),sessionId:"foreign_host"}) as {confirmed:boolean;production:unknown};expect(held.confirmed).toBe(false);expect(held.production).toBeNull();
  read();expect(seen).toHaveLength(6);expect(session.ui.read().inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
 }finally{spy.mockRestore();await session.dispose();}
});
it("READ_UI_PROFILE_HOIST_R01 preserves complete per-container profiles with one catalog lookup per UI read",async()=>{
 const {f,session}=await paidMachineHostFixture("B06");
 const profileIds=["C26-PACK","C27-PACK","B06-BOM","B07-BOM","BATTERY-PACK","DISTRIBUTOR-PACK","BENCH-PACK","BIN-PACK","BELT4","CABLE40",
   ...Object.keys(cargoHandlingProfiles.FACTORY_CLOSED_CABLE_JOBS),"RAW8","MONTAGE","BRACE"];
 const profileReader=cargoHandlingProfiles.readCargoHandlingProfile,expected=(view:ReturnType<typeof session.ui.read>)=>view.inventory.map(container=>({
   id:container.id,pickupProfiles:profileIds.flatMap(profileId=>{
     const profile=profileReader(catalog,profileId);if(!profile)return [];
     const sourceLots:Array<{containerId:string;containerRevision:number;stackId:string;quantityUnits:number}>=[];
     for(const term of profile.terms){
       let left=term.quantityUnits;
       for(const stack of container.contents){if(stack.itemId!==term.itemId||!left)continue;const quantityUnits=Math.min(left,stack.quantityUnits);
         sourceLots.push({containerId:container.id,containerRevision:container.revision,stackId:stack.stackId,quantityUnits});left-=quantityUnits;}
       if(left)return [];
     }
     const enabled=view.state==="Ready"&&view.host.confirmed&&container.accessible;
     return [{profileId:profile.profileId,name:profile.profileId,sourceLots,capability:{enabled,reason:enabled?null:"Quelle nicht erreichbar oder Transport belegt"}}];
   })
 }));
 expect(profileIds).toHaveLength(24);
 const spy=vi.spyOn(cargoHandlingProfiles,"readCargoHandlingProfile");
 try{
   const first=session.ui.read();expect(first.inventory.length).toBeGreaterThan(1);
   expect(spy).toHaveBeenCalledTimes(24);
   expect(first.inventory.map(container=>({id:container.id,pickupProfiles:container.pickupProfiles}))).toEqual(expected(first));
   spy.mockClear();const repeated=session.ui.read();
   expect(spy).toHaveBeenCalledTimes(24);
   expect(repeated.inventory.map(container=>({id:container.id,pickupProfiles:container.pickupProfiles}))).toEqual(expected(repeated));
   spy.mockClear();f.publish(repeated.host.nativeTick,{confirmed:false});const unconfirmed=session.ui.read();
   expect(spy).toHaveBeenCalledTimes(24);
   expect(unconfirmed.host.confirmed).toBe(false);
   expect(unconfirmed.inventory.flatMap(container=>container.pickupProfiles).every(profile=>!profile.capability.enabled)).toBe(true);
   expect(unconfirmed.inventory.map(container=>({id:container.id,pickupProfiles:container.pickupProfiles}))).toEqual(expected(unconfirmed));
 }finally{spy.mockRestore();await session.dispose();}
});
it("PLAY04 local map uses the current confirmed actor and exact V5 mask union instead of its rectangle",async()=>{
 // Declared initial Host transport for projection math only; no Native Source/World replacement.
 const terrain={epoch:1,revision:0,profileVersion:"hvp-factory-startsite-v5",sourceDigest:"0e2a0bcb",baseDigest:"0e2a0bcb",cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sizeX:256,sizeY:128,sizeZ:256} as const;
 const {f,session,setActorFixture}=await paidMachineHostFixture("B06",terrain);try{
  setActorFixture([-6250,2420,11500]);
  const read=(session as typeof session&{readLocalMap?:()=>import("../../../src/factory/ui/localMap").FactoryMapSnapshot|null}).readLocalMap;
  expect(read).toBeTypeOf("function");if(!read)throw Error("MapReadMissing");const map=read();expect(map).toBeDefined();expect(map?.player).toEqual({position:{x:-6.25,z:11.5},heading:null});expect(map?.knownAreas).toHaveLength(23);
  const {canMarkFactoryMapPoint}=await import("../../../src/factory/ui/localMap");expect(canMarkFactoryMapPoint(map!,{east:3,north:5.25})).toBe(true);expect(canMarkFactoryMapPoint(map!,{east:12,north:5.25})).toBe(true);expect(canMarkFactoryMapPoint(map!,{east:4,north:9})).toBe(false);
  f.publish(0,{confirmed:false,physicsStatus:"SimulationHold"});expect(read()).toBeNull();
 }finally{await session.dispose();}
});
it("PLAY04 local map keeps the V6 hull corridor and actor inside the reviewed extended bounds",async()=>{
 const terrain={epoch:1,revision:0,profileVersion:"hvp-factory-startsite-v6",sourceDigest:"360b00fa",baseDigest:"360b00fa",cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sizeX:256,sizeY:128,sizeZ:256} as const;
 const {session,setActorFixture}=await paidMachineHostFixture("B06",terrain);try{
  setActorFixture([6500,2420,7500]);const map=session.readLocalMap();expect(map).toBeDefined();
  expect(map!.bounds.maxNorth).toBe(27);expect(map!.knownAreas).toHaveLength(25);
  const {canMarkFactoryMapPoint}=await import("../../../src/factory/ui/localMap");
  expect(map!.player).toEqual({position:{x:6.5,z:7.5},heading:null});
  expect(canMarkFactoryMapPoint(map!,{east:5,north:18.75})).toBe(true);
  expect(canMarkFactoryMapPoint(map!,{east:10,north:20})).toBe(false);
 }finally{await session.dispose();}
});

it("PLAY04 reviewed control rejects expected binding drift during actual pause before any enabled-state adoption",async()=>{
 const {f,session,command,installBattery,setPauseHook}=await paidMachineHostFixture("B06");try{
  await installBattery();const v=session.ui.read(),battery=v.power.devices!.find(d=>d.id==="battery")!;
  const request=command("reviewed_pause_drift",{kind:"set-enabled",machine:{id:battery.id,revision:battery.revision},enabled:false});
  // Declared fresh transport row, no real Terrain/World mutation; current socket proof follows the newer Host revision.
  setPauseHook(()=>f.publish(0,{terrain:{...f.host.read().terrain,revision:1}}));
  expect(await session.ui.submit(request)).toMatchObject({status:"Rejected",receipt:{reason:"StaleDeviceControlBinding"}});
  expect(session.ui.read().power.devices!.find(d=>d.id==="battery")?.enabled).toBe(true);
 }finally{setPauseHook(undefined);await session.dispose();}
});
it("PLAY04 set-enabled rejects an independently unconfirmed pause without adopting power state",async()=>{
 const {f,session,command,installBattery,bindConfirmationToQuiescence,setPauseHook}=await paidMachineHostFixture("B06");try{
  await installBattery();const before=session.ui.read(),beforeMaterial=session.readPresentation().material,battery=before.power.devices!.find(d=>d.id==="battery")!;
  bindConfirmationToQuiescence();
  setPauseHook(()=>{const paused=f.host.read();f.publish(paused.nativeTick,{physicsStatus:"Paused",confirmed:false});});
  const result=await session.ui.submit(command("unconfirmed_pause_control",{kind:"set-enabled",machine:{id:battery.id,revision:battery.revision},enabled:false}));
  expect(result).toMatchObject({status:"Rejected",receipt:{reason:"NativeDeviceControlUnavailable"}});
  expect(session.ui.read().power.devices!.find(d=>d.id==="battery")?.enabled).toBe(true);
  expect(session.readPresentation().material).toBe(beforeMaterial);
 }finally{setPauseHook(undefined);await session.dispose();}
});
it("PLAY04 set-enabled keeps competing UI commands busy until pause resolves",async()=>{
 const {host,session,command,installBattery}=await paidMachineHostFixture("B06");let release!:()=>void;
 const pauseGate=new Promise<void>(resolve=>{release=resolve;});
 try{
  await installBattery();const before=session.ui.read(),battery=before.power.devices!.find(d=>d.id==="battery")!;
  const pause=host.pause.bind(host);host.pause=async()=>{await pauseGate;return pause();};
  const pending=session.ui.submit(command("deferred_pause_control",{kind:"set-enabled",machine:{id:battery.id,revision:battery.revision},enabled:false}));
  await Promise.resolve();expect(session.isQuiescent()).toBe(false);
  expect(await session.ui.submit(command("competing_during_pause",{kind:"open-cargo"})))
    .toMatchObject({status:"Rejected",receipt:{reason:"StaleOrBusyCommand"}});
  release();expect(await pending).toMatchObject({status:"Committed"});
 }finally{release();await session.dispose();}
});
it("PLAY04 set-enabled restores command busy state when the fresh Host read throws",async()=>{
 const {host,session,command,installBattery,bindConfirmationToQuiescence}=await paidMachineHostFixture("B06");
 let failFreshRead=false;const quiescenceAtReads:boolean[]=[];
 try{
  await installBattery();const before=session.ui.read(),battery=before.power.devices!.find(d=>d.id==="battery")!;
  bindConfirmationToQuiescence();const boundRead=host.read.bind(host);
  host.read=()=>{const quiescent=session.isQuiescent();quiescenceAtReads.push(quiescent);if(failFreshRead){failFreshRead=false;throw Error("FreshFactoryHostReadFailed");}return boundRead();};
  const pause=host.pause.bind(host);host.pause=async()=>{const paused=await pause();failFreshRead=true;return paused;};
  expect(await session.ui.submit(command("throwing_pause_control",{kind:"set-enabled",machine:{id:battery.id,revision:battery.revision},enabled:false})))
    .toMatchObject({status:"Rejected",receipt:{reason:"FreshFactoryHostReadFailed"}});
  expect(quiescenceAtReads.slice(-2)).toEqual([true,false]);
  expect(session.ui.read().power.devices!.find(d=>d.id==="battery")?.enabled).toBe(true);
 }finally{await session.dispose();}
});
it("PLAY04 reviewed map includes current Cargo body in its initial viewport without granting unknown ground",async()=>{
 const terrain={epoch:1,revision:0,profileVersion:"hvp-factory-startsite-v5",sourceDigest:"0e2a0bcb",baseDigest:"0e2a0bcb",cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sizeX:256,sizeY:128,sizeZ:256} as const;
 const {session}=await paidMachineHostFixture("B06",terrain);try{
  const map=session.readLocalMap()!,wreck=map.objects.find(o=>o.kind==="wreck")!;expect(wreck).toBeDefined();
  const {toFactoryMapPoint,canMarkFactoryMapPoint}=await import("../../../src/factory/ui/localMap");
  for(const p of wreck.outline)expect(toFactoryMapPoint(p).east).toBeGreaterThanOrEqual(map.bounds.minEast);
  expect(canMarkFactoryMapPoint(map,{east:-.5,north:6.75})).toBe(false);expect(map.knownAreas).toHaveLength(23);
 }finally{await session.dispose();}
});


type SimulationRecoveryHandle=FactorySessionHandle&{canRecoverSimulationHold:()=>boolean;recoverSimulationHold:(resetNative:()=>Promise<void>)=>Promise<void>};
it("PLAY04 recovery publishes the released Host fence at the same tick without granting work",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog),recover=session as SimulationRecoveryHandle;
 let published:ReturnType<typeof session.ui.read>|undefined;const unsubscribe=session.ui.subscribe(snapshot=>{published=snapshot;});
 try{
  f.publish(5);const material=session.readPresentation().material;f.publish(60,{physicsStatus:"SimulationHold",confirmed:false});
  await recover.recoverSimulationHold(async()=>{f.publish(60,{physicsStatus:"Paused",confirmed:false});});
  expect(published!.host.confirmed).toBe(false);
  f.publish(60,{physicsStatus:"Paused",confirmed:true});
  expect(published!.host).toMatchObject({physicsStatus:"Paused",nativeTick:60,confirmed:true});
  const revision=published!.publicationRevision;f.publish(60,{physicsStatus:"Paused",confirmed:true});expect(published!.publicationRevision).toBe(revision);
  expect(session.read()).toMatchObject({nativeTick:60,steps:0,remainderTicks:5,elapsedMs:0});expect(session.readPresentation().material).toBe(material);
 }finally{unsubscribe();await session.dispose();}
});
it("PLAY04 recovery retains a terminal fence when the actual Host read fails after RPC rejection",async()=>{
 const f=hostFixture(0);let unreadable=false;
 const host={...f.host,read:()=>{if(unreadable)throw Error("native transport lost");return f.host.read();}};
 const session=await mountFactorySession(host,catalog),recover=session as SimulationRecoveryHandle;
 try{
  f.publish(5);const material=session.readPresentation().material;f.publish(60,{physicsStatus:"SimulationHold",confirmed:false});
  await expect(recover.recoverSimulationHold(async()=>{unreadable=true;throw Error("RPC failed");})).rejects.toThrow(/RecoveryHold/);
  expect(session.read()).toMatchObject({state:"RecoveryHold",nativeTick:5,steps:0,remainderTicks:5});
  unreadable=false;expect(session.readPresentation().material).toBe(material);
 }finally{unreadable=false;await session.dispose();}
});
it("PLAY04 recovery publishes no confirmed projection while its native acknowledgement is pending",async()=>{
 const f=hostFixture(0);let actual:FactoryHostView|undefined,finish!:()=>void;
 const host={...f.host,read:()=>actual??f.host.read()},session=await mountFactorySession(host,catalog),recover=session as SimulationRecoveryHandle;
 const ack=new Promise<void>(resolve=>{finish=resolve;});let pending:Promise<void>|undefined;
 try{
  actual={...f.host.read(),physicsStatus:"SimulationHold",confirmed:false};
  pending=recover.recoverSimulationHold(()=>{actual={...actual!,physicsStatus:"Paused",confirmed:true};return ack;});
  expect(session.read().state).toBe("Ready");expect(session.readPresentation().confirmed).toBe(false);
  finish();await pending;expect(session.readPresentation().confirmed).toBe(true);
 }finally{finish();await pending?.catch(()=>{});await session.dispose();}
});
it("PLAY04 recovery ACK grants no held-interval work and preserves the existing confirmed remainder",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog),recover=session as SimulationRecoveryHandle;
 try{
  f.publish(5);expect(session.read()).toMatchObject({nativeTick:5,steps:0,remainderTicks:5});
  const material=session.readPresentation().material;f.publish(60,{physicsStatus:"SimulationHold",confirmed:false});
  await expect(Promise.resolve().then(()=>recover.recoverSimulationHold(async()=>{f.publish(60,{physicsStatus:"Paused",confirmed:false});}))).resolves.toBeUndefined();
  expect(session.read()).toMatchObject({nativeTick:60,steps:0,remainderTicks:5,elapsedMs:0});expect(session.readPresentation().material).toBe(material);
  f.publish(60,{physicsStatus:"Paused",confirmed:true});expect(session.read().steps).toBe(0);
  f.publish(61,{physicsStatus:"Running",confirmed:true});expect(session.read()).toMatchObject({nativeTick:61,steps:1,remainderTicks:0,elapsedMs:100});
 }finally{await session.dispose();}
});
it("PLAY04 recovery owns a distinct deferred fence against callbacks, disposal and reentrant actions",async()=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog),recover=session as SimulationRecoveryHandle;
 let finish!:()=>void;const ack=new Promise<void>(r=>{finish=r;});let pending:Promise<void>|undefined;
 try{
  f.publish(5);f.publish(60,{physicsStatus:"SimulationHold",confirmed:false});
  pending=Promise.resolve().then(()=>recover.recoverSimulationHold(()=>ack));await Promise.resolve();
  expect(session.isQuiescent()).toBe(false);expect(session.canEndSession?.()).toBe(false);
  await expect(session.dispose()).rejects.toThrow(/pending/);expect(recover.canRecoverSimulationHold()).toBe(false);
  await expect(recover.recoverSimulationHold(async()=>{})).rejects.toThrow("Factory SimulationHold recovery unavailable");
  const v=session.ui.read();const result=await session.ui.submit({version:"fp06-ui-command-v1",commandId:"during_clock_recovery",sessionId:v.sessionId,epoch:v.epoch,expected:v.binding,kind:"open-cargo"});
  expect(result).toMatchObject({status:"Rejected",receipt:{reason:"StaleOrBusyCommand"}});
  f.publish(60,{physicsStatus:"Paused",confirmed:true});expect(session.read()).toMatchObject({nativeTick:5,steps:0,remainderTicks:5});
  finish();await pending;expect(session.read()).toMatchObject({nativeTick:60,steps:0,remainderTicks:5});
 }finally{finish();await pending?.catch(()=>{});await session.dispose();}
});
it.each(["wrong tick","terrain changed","superseded"])("PLAY04 recovery closes a %s ACK without granting work or material",async drift=>{
 const f=hostFixture(0),session=await mountFactorySession(f.host,catalog),recover=session as SimulationRecoveryHandle;
 try{
  f.publish(5);const material=session.readPresentation().material;f.publish(60,{physicsStatus:"SimulationHold",confirmed:false});
  const reset=async()=>{if(drift==="superseded")f.retire();else f.publish(drift==="wrong tick"?61:60,{physicsStatus:"Paused",confirmed:false,...(drift==="terrain changed"?{terrain:{...f.host.read().terrain,revision:1}}:{})});};
  await expect(Promise.resolve().then(()=>recover.recoverSimulationHold(reset))).rejects.toThrow(/RecoveryHold|binding/);
  expect(session.read()).toMatchObject({state:"RecoveryHold",nativeTick:5,steps:0,remainderTicks:5});expect(session.readPresentation().material).toBe(material);
 }finally{await session.dispose();}
});


it("PLAY04 recovery preserves an adopted eight-kilogram WIP job and exact paid battery energy",async()=>{
 const {f,session,command,installBattery}=await paidMachineHostFixture("B06"),recover=session as SimulationRecoveryHandle;
 try{
  await installBattery();let v=session.ui.read();let cargo=v.inventory.find(i=>i.role==="cargo")!,cable=cargo.contents.find(s=>s.itemId==="fp02.comp.field_cable")!;
  expect(await session.ui.submit(command("recovery_cable",{kind:"connect-power",sourcePortId:"power_battery",targetPortId:"power_test_machine",cableLot:{containerId:cargo.id,containerRevision:cargo.revision,stackId:cable.stackId,quantityUnits:2750}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();cargo=v.inventory.find(i=>i.role==="cargo")!;const steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("recovery_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const machine=v.machines[0]!,input=v.inventory.find(i=>i.id===machine.inputContainerId)!;
  const start=session.ui.submit(command("recovery_adopted_job",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]}));f.publish(6);expect(await start).toMatchObject({status:"Committed"});
  const before=session.ui.read(),material=session.readPresentation().material,receipt=session.ui.readReceipt("recovery_adopted_job"),clock=session.read();expect(before.machines[0]).toMatchObject({confirmedWorkMs:100,status:"RUNNING"});
  const tick=f.host.read().nativeTick+120;f.publish(tick,{physicsStatus:"SimulationHold",confirmed:false});
  await recover.recoverSimulationHold(async()=>{f.publish(tick,{physicsStatus:"Paused",confirmed:false});});f.publish(tick,{physicsStatus:"Paused",confirmed:true});
  const paused=session.ui.read();expect(session.read()).toMatchObject({steps:clock.steps,remainderTicks:clock.remainderTicks,elapsedMs:clock.elapsedMs,nativeTick:tick});expect(session.readPresentation().material).toBe(material);
  expect(paused.machines[0]).toMatchObject({jobId:before.machines[0]!.jobId,confirmedWorkMs:100,status:"RUNNING"});expect(paused.power.batteryEnergyJ).toBe(before.power.batteryEnergyJ);expect(session.ui.readReceipt("recovery_adopted_job")).toBe(receipt);
  expect(paused.inventory.find(i=>i.id===machine.wipContainerId)?.massMg).toBe(8000000);expect(paused.inventory.reduce((n,c)=>n+c.massMg,0)).toBe(2984400000);
  f.publish(tick+6,{physicsStatus:"Running",confirmed:true});const after=session.ui.read();expect(after.machines[0]?.confirmedWorkMs).toBe(200);expect(before.power.batteryEnergyJ!-after.power.batteryEnergyJ!).toBeCloseTo(120/.95,6);
 }finally{await session.dispose();}
});
it("PLAY04 recovery settles only an unadopted queued job once with a replayable known rejection",async()=>{
 const {f,session,command}=await paidMachineHostFixture("B06"),recover=session as SimulationRecoveryHandle;let queued:Promise<unknown>|undefined;
 try{
  let v=session.ui.read();const cargo=v.inventory.find(i=>i.role==="cargo")!,steel=cargo.contents.find(s=>s.itemId==="fp02.bulk.steel_known")!;
  expect(await session.ui.submit(command("recovery_queue_intake",{kind:"transfer",source:{containerId:cargo.id,containerRevision:cargo.revision,stackId:steel.stackId,quantityUnits:8000000},target:{id:"input_test_machine",revision:0}}))).toMatchObject({status:"Committed"});
  v=session.ui.read();const machine=v.machines[0]!,input=v.inventory.find(i=>i.id===machine.inputContainerId)!,request=command("recovery_unadopted_job",{kind:"start",machine:{id:machine.id,revision:machine.revision},sourceLots:[{containerId:input.id,containerRevision:input.revision,stackId:input.contents[0]!.stackId,quantityUnits:8000000}]});
  queued=session.ui.submit(request);await Promise.resolve();await Promise.resolve();expect(session.ui.readReceipt(request.commandId)).toBeUndefined();
  const material=session.readPresentation().material,clock=session.read(),tick=f.host.read().nativeTick+120;f.publish(tick,{physicsStatus:"SimulationHold",confirmed:false});
  await recover.recoverSimulationHold(async()=>{f.publish(tick,{physicsStatus:"Paused",confirmed:false});});
  const receipt=session.ui.readReceipt(request.commandId);expect(receipt).toMatchObject({status:"Rejected",reason:"InterruptedBeforeAdoption"});
  expect(await queued).toMatchObject({status:"Rejected",receipt});expect(session.readPresentation().material).toBe(material);expect(session.read()).toMatchObject({steps:clock.steps,remainderTicks:clock.remainderTicks});
  expect(await session.ui.submit(request)).toMatchObject({status:"Rejected",receipt});expect(session.ui.readReceipt(request.commandId)).toBe(receipt);
 }finally{await session.dispose();await queued;}
});
