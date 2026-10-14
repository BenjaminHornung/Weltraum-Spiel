import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as materialSteps from "../../../src/factory/material/reservations";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createFactoryMaterialView, prepareFactoryMaterialStep, commitFactoryMaterialStep } from "../../../src/factory/material/reservations";
import { bindFactoryDomainSession, createFactoryMaterialAuthority, createFactoryCommandHistory } from "../../../src/factory/session/dryFactorySlice";
import type { FactoryUiCommand, FactoryUiReceipt } from "../../../src/factory/session/hostPort";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";
import { canonicalJson } from "../../../src/resources/serialization";
import { createFactoryConstruction } from "../../../src/factory/construction/buildStep";
import {factoryMaterialBytes} from "../../../src/factory/construction/placement";
import { prepareDryFactoryStep, commitDryFactoryStep,reconcileDryFactoryInstallations,readDryFactorySupply, type DryFactoryState } from "../../../src/factory/session/dryFactorySlice";
import {createFactoryInstallationProfile} from "../../../src/factory/construction/installationProfile";
import { canonicalSignature } from "../../../src/resources/serialization";
import { createFactoryProductionState } from "../../../src/factory/production/productionStep";
import { isSaveSafeResourceId } from "../../../src/resources/ids";
import {adoptDryFactoryBelt,readDryFactoryBeltPort} from "../../../src/factory/session/dryFactorySlice";
const fixture = createFp02Fixture("cargo");
const initial = () => createFactoryMaterialView(fixture.catalog, [
 createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, fixture.catalog.resources),
 createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: "test_local", kind: "OutpostStorage", maxMassKg: 300, maxVolumeM3: 2, maxStackCount: 20 }), createResourceContainerState({ containerId: "test_local", ownerId: fixture.resourceState.ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources)
]);
const candidate = () => {
 const base = initial(), stack = fixture.resourceState.contents.find(s => s.resourceId === "fp02_chassis_former")!;
 const plan = prepareFactoryMaterialStep(base, { kind: "transfer", transactionId: "host_pickup", ownerId: fixture.resourceState.ownerId!, actorId: fixture.resourceState.ownerId!, moves: [{ sourceContainerId: fixture.resourceState.containerId, sourceStackId: stack.stackId, targetContainerId: "test_local", targetStackId: stack.stackId, itemId: "fp02.chassis.former", quantityUnits: 1 }] });
 if (plan.status !== "Prepared") throw new Error(plan.reason); const result = commitFactoryMaterialStep(base, plan); if (result.status === "Rejected") throw new Error(result.reason);
 return { base, next: result.view };
};
const binding = { catalogDigest: fixture.catalog.catalogDigest, terrainSourceDigest: "synthetic-unit-source-v1", powerSourceProfileDigest: "source-bound-power-v1", terrainRevision: 0, facilityRevision: 0, materialRevision: 0, netRevision: 0, handlingRevision: 0 };
const emptyDryFixture=()=>{
 const b={sessionId:"guard_native_session",epoch:0,netRevision:0,catalogDigest:fixture.catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
 const state:DryFactoryState={binding:b,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding:b,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null};
 const inputFor=(current:DryFactoryState,material:ReturnType<typeof initial>)=>{
  const end=String(BigInt(current.tickEndUs)+100000n),body={version:"fp06-power-supply-v1" as const,binding:current.binding,tickStartUs:current.tickEndUs,tickEndUs:end,offers:[],ports:[],links:[],battery:null,authorityBytes:canonicalJson({fixture:"explicit-empty-guard-unit-net"})};
  return {confirmed:true,binding:current.binding,tickStartUs:current.tickEndUs,tickEndUs:end,material,supply:{...body,canonicalJson:canonicalJson(body),digest:canonicalSignature(body)},machines:[],belts:[]};
 };
 return {state,inputFor,material:initial()};
};
describe("W09 complete private proposal byte guards",()=>{
 const freezeData=<T>(value:T):T=>{if(value&&typeof value==="object"){Object.values(value).forEach(freezeData);Object.freeze(value);}return value;};
 const copyMaterial=(material:ReturnType<typeof initial>)=>({...material,containers:material.containers.map(c=>({...c,definition:JSON.parse(canonicalJson(c.definition)) as typeof c.definition,state:JSON.parse(canonicalJson(c.state)) as typeof c.state}))});
 const outputValues=(state:DryFactoryState,material:ReturnType<typeof initial>)=>({powerRevision:state.power.revision,materialRevision:material.revision,steel:material.containers[0]!.state.contents.find(s=>s.resourceId==="fp02_bulk_steel_known")!.quantity});
 it("validates cold immutable material but avoids redundant W02 work when adoption changes nothing",()=>{
  const material=initial(),authority=createFactoryMaterialAuthority(material),spy=vi.spyOn(materialSteps,"prepareFactoryMaterialStep");
  try{
   expect(authority.adopt(material,material)).toBe(true);expect(spy).toHaveBeenCalled();
   const bytes=factoryMaterialBytes(material);spy.mockClear();
   for(let i=0;i<5;i++)expect(authority.adopt(material,material)).toBe(true);
   expect(spy.mock.calls.length).toBe(0);expect(authority.read()).toBe(material);expect(factoryMaterialBytes(authority.read())).toBe(bytes);expect(material.revision).toBe(0);expect(material.receipts).toEqual([]);
  }finally{spy.mockRestore();}
 });
 it("binds nested frozen ArrayProxy facts with the original canonical iterator semantics",()=>{
  const f=emptyDryFixture(),proxy=new Proxy(Object.freeze([1]),{get(target,key,receiver){return key===Symbol.iterator?()=>[2][Symbol.iterator]():Reflect.get(target,key,receiver);}});
  const base=freezeData({...f.state,extra:{rows:proxy}}),proposal=prepareDryFactoryStep(base,f.inputFor(base,f.material));
  expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  const {lastStep:_last,...core}=base;expect(proposal.baseStateBytes).toBe(canonicalJson(core));
 });
 it("rejects changed frozen ArrayProxy domain membership between prepare and adoption",()=>{
  const f=emptyDryFixture();let changed=false;
  const proxy=new Proxy(Object.freeze([]),{get(target,key,receiver){return key===Symbol.iterator?()=> (changed?[{lineId:"foreign_pending_line"}]:[])[Symbol.iterator]():Reflect.get(target,key,receiver);}});
  const base=freezeData({...f.state,belts:proxy}),input=f.inputFor(base,f.material),proposal=prepareDryFactoryStep(base,input);
  expect(proposal.status).toBe("Prepared");changed=true;
  expect(commitDryFactoryStep(base,input,proposal)).toMatchObject({status:"Rejected"});
  expect(f.material.revision).toBe(0);expect(f.material.receipts).toEqual([]);
 });
 it("preserves exact cold and warm material projection bytes without admitting a later mutable clone",()=>{
  const f=emptyDryFixture(),base=freezeData(f.state),input=f.inputFor(base,f.material),expected=factoryMaterialBytes(f.material);
  const cold=prepareDryFactoryStep(base,input),warm=prepareDryFactoryStep(base,input);
  expect(cold.status).toBe("Prepared");expect(warm.status).toBe("Prepared");if(cold.status!=="Prepared"||warm.status!=="Prepared")return;
  expect(cold.materialBaseBytes).toBe(expected);expect(warm.materialBaseBytes).toBe(expected);expect(warm.inputBytes).toBe(cold.inputBytes);
  const clone=copyMaterial(f.material);expect(prepareDryFactoryStep(base,f.inputFor(base,clone)).status).toBe("Prepared");
  const changed={...clone,containers:clone.containers.map(c=>({...c,state:{...c.state,contents:c.state.contents.map(s=>s.resourceId!=="fp02_bulk_steel_known"?s:{...s,quantity:s.quantity+1})}}))};
  expect(prepareDryFactoryStep(base,f.inputFor(base,changed))).toMatchObject({status:"Rejected"});expect(prepareDryFactoryStep(base,input)).toMatchObject({status:"Prepared",materialBaseBytes:expected});
 });
 it.each([null,()=>{throw Error("Caller array map must not execute");}])("preserves canonical array contents with an own map property %s",map=>{
  const f=emptyDryFixture(),belts=[] as any;Object.defineProperty(belts,"map",{value:map,enumerable:true});Object.freeze(belts);
  const base=freezeData({...f.state,belts}),input=f.inputFor(base,f.material),proposal=prepareDryFactoryStep(base,input);
  expect(proposal.status,proposal.status==="Rejected"?proposal.reason:undefined).toBe("Prepared");
  if(proposal.status==="Prepared"){const {lastStep:_last,...core}=base;expect(proposal.baseStateBytes).toBe(canonicalJson(core));}
 });
 it("rejects actual Native source quantity tampering even when copied canonical receipts are unchanged",()=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,input);expect(proposal.status).toBe("Prepared");
  const source=f.material.containers[0]!,old=source.state.contents.find(s=>s.resourceId==="fp02_bulk_steel_known")!;expect(old).toBeDefined();
  const material={...f.material,containers:f.material.containers.map(c=>c!==source?c:{...c,state:{...c.state,contents:c.state.contents.map(s=>s!==old?s:{...s,quantity:s.quantity+1})}})};
  expect(commitDryFactoryStep(f.state,{...input,material},proposal)).toMatchObject({status:"Rejected"});
 });
 it("rejects caller-forged Native OUTPUT quantity despite copied canonical proposal receipts",()=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,input);expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  const source=proposal.material.containers[0]!,old=source.state.contents.find(s=>s.resourceId==="fp02_bulk_steel_known")!;expect(old).toBeDefined();
  const material={...proposal.material,containers:proposal.material.containers.map(c=>c!==source?c:{...c,state:{...c.state,contents:c.state.contents.map(s=>s!==old?s:{...s,quantity:s.quantity+1})}})};
  expect(commitDryFactoryStep(f.state,input,{...proposal,material})).toMatchObject({status:"Rejected"});
 });
 it.each(["state","material"])("isolates adopted external %s output from later caller mutation",field=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,input);expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  const copied={...proposal,state:JSON.parse(canonicalJson(proposal.state)) as typeof proposal.state,material:copyMaterial(proposal.material)},result=commitDryFactoryStep(f.state,input,copied);expect(result.status).toBe("Committed");if(result.status!=="Committed")return;
  const before=outputValues(result.state,result.material);
  if(field==="state")(copied.state.power as {revision:number}).revision=99;
  else (copied.material as {containers:typeof copied.material.containers}).containers=copied.material.containers.map(c=>({...c,state:{...c.state,contents:c.state.contents.map(s=>s.resourceId!=="fp02_bulk_steel_known"?s:{...s,quantity:s.quantity+1})}}));
  expect(outputValues(result.state,result.material)).toEqual(before);
 });
 it("isolates adopted external accessor output from mutable values retained by its caller",()=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,input);expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  const copies:typeof proposal.material[]=[];
  const external={...proposal,get material(){const copy=copyMaterial(proposal.material);copies.push(copy);return copy;}};
  const result=commitDryFactoryStep(f.state,input,external);expect(result.status).toBe("Committed");if(result.status!=="Committed")return;
  const before=outputValues(result.state,result.material);expect(copies.length).toBeGreaterThan(0);
  for(const copy of copies)(copy as {revision:number}).revision=99;
  expect(outputValues(result.state,result.material)).toEqual(before);
 });
 it.each(["joint receipt","power output"])("binds the complete external %s payload rather than its copied signature",field=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,input);expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  const changed=field==="joint receipt"?{...proposal,state:{...proposal.state,lastStep:{...proposal.state.lastStep!,factsBytes:"forged"}}}:{...proposal,power:{...proposal.power,nextState:{...proposal.power.nextState,revision:99}}};
  expect(commitDryFactoryStep(f.state,input,changed)).toMatchObject({status:"Rejected"});
 });
 it.each(["receipt chain","reservation claim"])("validates actual W02 %s even in an empty confirmed domain",kind=>{
  const f=emptyDryFixture(),material=kind==="receipt chain"?{...f.material,revision:1,receipts:[]}:{...f.material,reservations:[{reservationId:"broken_claim",ownerId:"hvp_player",wipContainerId:"missing_wip",outputs:[]}]};
  const input=f.inputFor(f.state,material as never);
  expect(prepareDryFactoryStep(f.state,input)).toMatchObject({status:"Rejected"});
  const proper=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,proper);expect(proposal.status).toBe("Prepared");
  expect(commitDryFactoryStep(f.state,input,proposal)).toMatchObject({status:"Rejected"});
 });
 it("rechecks mutable facts, frozen accessors and caller-forged immutable proposals",()=>{
  const f=emptyDryFixture(),input=f.inputFor(f.state,f.material),first=prepareDryFactoryStep(f.state,input);expect(first.status).toBe("Prepared");if(first.status!=="Prepared")return;
  const base=first.state,current=f.inputFor(base,first.material),proposal=prepareDryFactoryStep(base,current);expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
  current.confirmed=false;expect(commitDryFactoryStep(base,current,proposal)).toMatchObject({status:"Rejected"});current.confirmed=true;
  let confirmed=true;const accessor=Object.freeze({...current,get confirmed(){return confirmed;}}),fromAccessor=prepareDryFactoryStep(base,accessor);expect(fromAccessor.status).toBe("Prepared");confirmed=false;expect(commitDryFactoryStep(base,accessor,fromAccessor)).toMatchObject({status:"Rejected"});
  expect(commitDryFactoryStep(base,current,Object.freeze({...proposal,state:Object.freeze({...proposal.state,revision:99})}))).toMatchObject({status:"Rejected"});
  expect(commitDryFactoryStep(base,current,proposal)).toMatchObject({status:"Committed"});
 });
 it.each(["prototype","cycle","sparse","symbol","nonfinite"])("rejects invalid canonical %s input rather than memoizing it",kind=>{
  const f=emptyDryFixture();let extra:unknown;
  if(kind==="prototype")extra=Object.freeze(new Date(0));
  else if(kind==="cycle"){const value:any={};value.self=value;extra=Object.freeze(value);}
  else if(kind==="sparse")extra=Object.freeze(new Array(2));
  else if(kind==="symbol")extra=Object.freeze({value:Symbol("invalid")});
  else extra=Object.freeze({value:Infinity});
  expect(prepareDryFactoryStep(f.state,Object.freeze({...f.inputFor(f.state,f.material),extra}))).toMatchObject({status:"Rejected"});
 });
});
const paidBeltFixture=()=>{
 const b={sessionId:bindFactoryDomainSession(crypto.randomUUID()).domainSessionId,epoch:0,netRevision:0,catalogDigest:fixture.catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
 const base:DryFactoryState={binding:b,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding:b,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null};
 let material=initial();const owners:import("../../../src/factory/construction/placement").FactoryInstallation[]=[];
 for(const [id,definitionSourceId,z] of [["actual_cut","B06",5000],["actual_form","B07",-2500],["actual_line","fp06.line.belt_4m",1500],["actual_battery","fp02.device.battery_4kwh",-5000]] as const){
  const p=createFactoryInstallationProfile(definitionSourceId),cid=`installed_${id}`,empty=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:cid,kind:"OutpostStorage",maxMassKg:p.massMg/1000000,maxVolumeM3:4,maxStackCount:200}),createResourceContainerState({containerId:cid,ownerId:"fp02_wreck_owner",contents:[]},fixture.catalog.resources),fixture.catalog.resources);
  const augmented={...material,containers:[...material.containers,empty]},moves:import("../../../src/factory/material/reservations").MaterialMove[]=[];
  for(const term of p.bom){let remaining=term.quantityUnits;const item=fixture.catalog.items.find(i=>i.sourceId===term.itemId)!;for(const stack of material.containers[0]!.state.contents){if(stack.resourceId!==item.resourceId||!remaining)continue;const quantityUnits=Math.min(remaining,stack.quantity);moves.push({sourceContainerId:"fp02_wreck_cargo",sourceStackId:stack.stackId,targetContainerId:cid,targetStackId:`${id}_part_${moves.length}`,itemId:item.sourceId,quantityUnits});remaining-=quantityUnits;}expect(remaining).toBe(0);}
  const plan=prepareFactoryMaterialStep(augmented,{kind:"transfer",transactionId:`pay_${id}`,ownerId:"fp02_wreck_owner",moves});expect(plan.status,plan.status==="Rejected"?plan.reason:undefined).toBe("Prepared");if(plan.status!=="Prepared")throw Error(plan.reason);material=commitFactoryMaterialStep(augmented,plan).view;
  owners.push({instanceId:id,definitionSourceId,profileDigest:p.profileDigest,sourceDigest:p.sourceDigest,massMg:p.massMg,materialContainerId:cid,centerMm:[-6250,1500,z],quarterTurns:1,boundsMm:p.boundsMm,serviceBoundsMm:p.serviceBoundsMm});
 }
 const reconciled=reconcileDryFactoryInstallations(base,material,owners),source=readDryFactoryBeltPort(fixture.catalog,owners[0]!,"B06:OUT-SEMI",1),target=readDryFactoryBeltPort(fixture.catalog,owners[1]!,"B07:IN-SEMI",2);
 let adopted:ReturnType<typeof adoptDryFactoryBelt>|undefined;expect(()=>{adopted=adoptDryFactoryBelt(reconciled.state,reconciled.material,owners[2]!,source,target);}).not.toThrow();
 return {reconciled,owners,source,target,adopted:adopted!};
};
it("W09 binds one actually paid four-metre line to exact Native endpoints and zero initial bounded transport credit",()=>{
 const {reconciled,owners,source,target,adopted}=paidBeltFixture();
 const line=adopted.state.belts[0]!;expect(line).toMatchObject({creditMg:0,packetCursor:0,packet:null,tickEndUs:"0",installation:{lengthMm:4000,powerPortId:"power_actual_line"}});expect(line.installation.moduleInstanceIds).toHaveLength(4);expect(new Set(line.installation.moduleInstanceIds).size).toBe(4);
 expect(adopted!.material.containers.find(c=>c.state.containerId===line.installation.bandContainerId)?.definition).toMatchObject({maxMassKg:10,maxStackCount:1});
 expect(()=>adoptDryFactoryBelt(adopted!.state,adopted!.material,owners[2]!,source,target)).toThrow(/Duplicate/);
 expect(()=>adoptDryFactoryBelt(reconciled.state,initial(),owners[2]!,source,target)).toThrow(/Paid/);
 expect(adopted!.material.containers.reduce((n,c)=>n+c.currentMassKg,0)).toBeCloseTo(2984.4,6);
});
const command: FactoryUiCommand = { version: "fp06-ui-command-v1", commandId: "pickup_c27", sessionId: "same_unit_session", epoch: 0, expected: binding,
 kind: "pickup", profileId: "C27-PACK", sourceLots: [{ containerId: fixture.resourceState.containerId, containerRevision: 0, stackId: fixture.resourceState.contents.find(s => s.resourceId === "fp02_chassis_former")!.stackId, quantityUnits: 1 }] };
const receipt: FactoryUiReceipt = { commandId: command.commandId, requestCanonicalJson: canonicalJson(command), status: "Committed", reason: null, publicationRevision: 1, binding: { ...binding, materialRevision: 1 } };
it("adopts only the fully paid installed Cutter with finite native buffers and preserves one real serialized C03 SOC across graph changes",async()=>{
 const start=initial(),owner="fp02_wreck_owner",powerBinding={sessionId:bindFactoryDomainSession(crypto.randomUUID()).domainSessionId,epoch:0,netRevision:0,catalogDigest:fixture.catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
 const state:DryFactoryState={binding:powerBinding,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding:powerBinding,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null};
 let material=start;const installations:any[]=[];
 for(const [id,definitionSourceId] of [["cut","B06"],["battery","fp02.device.battery_4kwh"]]){
  const profile=createFactoryInstallationProfile(definitionSourceId!),cid=`installed_${id}`;
  const empty=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:cid,kind:"OutpostStorage",maxMassKg:profile.massMg/1000000,maxVolumeM3:4,maxStackCount:20}),createResourceContainerState({containerId:cid,ownerId:owner,contents:[]},fixture.catalog.resources),fixture.catalog.resources);
  const augmented={...material,containers:[...material.containers,empty]};
  const p=prepareFactoryMaterialStep(augmented,{kind:"transfer",transactionId:`pay_${id}`,ownerId:owner,actorId:"hvp_player",moves:profile.bom.map((t,i)=>({sourceContainerId:fixture.resourceState.containerId,sourceStackId:material.containers[0]!.state.contents.find(s=>s.resourceId===fixture.catalog.items.find(v=>v.sourceId===t.itemId)!.resourceId)!.stackId,targetContainerId:cid,targetStackId:`part_${id}_${i}`,itemId:t.itemId,quantityUnits:t.quantityUnits}))});expect(p.status).toBe("Prepared");if(p.status!=="Prepared")return;material=commitFactoryMaterialStep(augmented,p).view;
  installations.push({instanceId:id,definitionSourceId,profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,massMg:profile.massMg,materialContainerId:cid,centerMm:[0,1500,0],quarterTurns:1,boundsMm:profile.boundsMm,serviceBoundsMm:profile.serviceBoundsMm});
 }
 const result=reconcileDryFactoryInstallations(state,material,installations);
 expect(result.state.machines.map(m=>m.machineInstanceId)).toEqual(["cut"]);expect(result.material.containers.find(c=>c.state.containerId==="input_cut")?.definition.maxMassKg).toBe(16);expect(result.material.containers.find(c=>c.state.containerId==="output_cut")?.definition.maxMassKg).toBe(22.5);expect(result.material.containers.find(c=>c.state.containerId==="offcut_cut")?.definition.maxMassKg).toBe(6);
 expect(result.state.power.battery).toEqual({instanceId:"fp02_cargo_c03_unit_1",storedEnergy:{n:"12960000000",d:"1"}});
 const used={...result.state,power:{...result.state.power,battery:{...result.state.power.battery!,storedEnergy:{n:"12959000000",d:"1"}}}};
 const next=reconcileDryFactoryInstallations(used,result.material,installations,1);
 expect(next.state.power.battery?.storedEnergy).toEqual({n:"12959000000",d:"1"});expect(next.material).toBe(result.material);expect(next.state.machines[0]?.binding.netRevision).toBe(1);
 expect(()=>reconcileDryFactoryInstallations(state,start,installations)).toThrow(/PaidInstallation/);
 const cable=[{linkId:"paid_unit_cable",fromPortId:"power_battery",toPortId:"power_cut",active:true,maxMilliWatt:"40000000"}];
 const supply=readDryFactorySupply(result.state,result.material,installations,cable,"100000");
 expect(supply.battery?.instanceId).toBe("fp02_cargo_c03_unit_1");expect(supply.ports.find(p=>p.portId==="power_cut")?.assetId).toBe("cut");expect(supply.offers).toEqual([]);
 // D03's500W restart reserve must fit the same paid consumer route; it is not delivered work.
 const restart={...result.state.power,consumers:[{consumerId:"consumer_cut",requestKey:canonicalJson({consumerId:"consumer_cut",deviceInstanceId:"cut",jobId:"job_cut",portId:"power_cut",priority:"P2",requiredMilliWatt:"1200000",enabled:true}),waiting:true,stableSupplyUs:"2000000"}]};
 const {stepFactoryPower}=await import("../../../src/factory/power/factoryPower");
 const admitted=stepFactoryPower(restart,{confirmed:true,binding:result.state.binding,tickStartUs:"0",tickEndUs:"100000",supply,requests:[{consumerId:"consumer_cut",deviceInstanceId:"cut",jobId:"job_cut",portId:"power_cut",priority:"P2",requiredMilliWatt:"1200000",enabled:true}]});
 expect(admitted.ok).toBe(true);if(admitted.ok)expect(admitted.grants[0]).toMatchObject({status:"Powered",allocatedMilliWatt:"1200000",work:{n:"120000",d:"1"}});

});

/** Isolated composition fixture: finite synthetic semi stock, real paid C03
 * and a synthetic cable route. NOT production completion, Native placement or D07. */
const poweredBandFixture=():{owners:import("../../../src/factory/construction/placement").FactoryInstallation[];state:DryFactoryState;material:import("../../../src/factory/material/reservations").MaterialView}=>{
 const {adopted,owners}=paidBeltFixture(),line=adopted.state.belts[0]!,source=adopted.material.containers.find(c=>c.state.containerId===line.installation.source.containerId)!,semi=fixture.catalog.items.find(i=>i.sourceId==="fp02.bulk.steel_semi")!;
 const state=createResourceContainerState({containerId:source.state.containerId,ownerId:source.state.ownerId,contents:[{stackId:"synthetic_semi",resourceId:semi.resourceId,quantity:100000,ownerId:source.state.ownerId,extensions:{"factory.fixture":"isolated-finite-band-stock-v1"}}]},fixture.catalog.resources);
 return {owners,state:adopted.state,material:{...adopted.material,containers:adopted.material.containers.map(c=>c===source?createResourceContainerSnapshot(c.definition,state,fixture.catalog.resources):c)}};
};
const bandInput=(pair:ReturnType<typeof poweredBandFixture>,powered=true)=>{
 const line=pair.state.belts[0]!,end=String(BigInt(pair.state.tickEndUs)+100000n),supply=readDryFactorySupply(pair.state,pair.material,pair.owners,[{linkId:"synthetic_band_cable",fromPortId:"power_actual_battery",toPortId:line.installation.powerPortId,active:powered,maxMilliWatt:"600000"}],end);
 return {confirmed:true,binding:pair.state.binding,tickStartUs:pair.state.tickEndUs,tickEndUs:end,material:pair.material,supply,machines:pair.state.machines.map(machine=>{const owner=pair.owners.find(o=>o.instanceId===machine.machineInstanceId)!,definition=fixture.catalog.devices.find(d=>d.sourceId===owner.definitionSourceId)!,toolId=definition.sourceId==="B06"?"fp02.tool.cutter_head":"fp02.tool.forming_die",paid=pair.material.containers.find(c=>c.state.containerId===owner.materialContainerId)!,tool=paid.state.contents.find(s=>s.resourceId===fixture.catalog.items.find(i=>i.sourceId===toolId)!.resourceId)!;return {instanceId:owner.instanceId,facts:{version:"fp06-production-host-facts-v1" as const,binding:pair.state.binding,confirmed:true,tickEndUs:end,installation:{instanceId:owner.instanceId,definitionRef:{sourceId:definition.sourceId,version:definition.version,digest:definition.digest},installationRevision:1,confirmed:true,supported:true,serviceClear:true,installedContainerId:owner.materialContainerId,inputContainerId:`input_${owner.instanceId}`,outputContainerId:`output_${owner.instanceId}`,offcutContainerId:`offcut_${owner.instanceId}`,wipContainerId:`wip_${owner.instanceId}`,powerConsumerId:`consumer_${owner.instanceId}`,powerPortId:`power_${owner.instanceId}`,tool:{partId:tool.stackId,sourceItemId:toolId,revision:paid.state.revision,condition:"OK" as const}},interaction:null}};}),belts:[{lineId:line.lineId,actorId:"hvp_player",enabled:true,sourceLot:pair.material.containers.find(c=>c.state.containerId===line.installation.source.containerId)?.state.contents[0]?{stackId:"synthetic_semi",itemId:"fp02.bulk.steel_semi"}:null}]};
};
const advanceBand=(pair:ReturnType<typeof poweredBandFixture>,powered=true)=>{const input=bandInput(pair,powered),proposal=prepareDryFactoryStep(pair.state,input);expect(proposal.status,proposal.status==="Rejected"?proposal.reason:undefined).toBe("Prepared");const result=commitDryFactoryStep(pair.state,input,proposal);if(result.status!=="Committed")throw Error(result.status==="Rejected"?result.reason:"UnexpectedReplay");return {...pair,state:result.state,material:result.material};};
it("W09 paid-band joint adoption preserves real custody and credit across blackout and a later graph revision",()=>{
 let pair=poweredBandFixture();const mass=pair.material.containers.reduce((n,c)=>n+c.currentMassKg,0);pair=advanceBand(pair);expect(pair.state.belts[0]).toMatchObject({creditMg:0,packetCursor:1,packet:{positionMm:0}});const packet=pair.state.belts[0]!.packet;
 pair=advanceBand(pair,false);expect(pair.state.belts[0]).toMatchObject({creditMg:0,packet});expect(pair.material.containers.find(c=>c.state.containerId===pair.state.belts[0]!.installation.bandContainerId)?.state.contents[0]?.quantity).toBe(100000);
 const input=bandInput(pair),proposal=prepareDryFactoryStep(pair.state,input),rebased=reconcileDryFactoryInstallations(pair.state,pair.material,pair.owners,1);
 expect(rebased.state.belts[0]).toEqual({...pair.state.belts[0],binding:rebased.state.binding});expect(commitDryFactoryStep(rebased.state,{...input,binding:rebased.state.binding},proposal)).toMatchObject({status:"Rejected"});pair={...pair,...rebased};
 for(let i=0;i<20;i++)pair=advanceBand(pair);expect(pair.state.belts[0]!.packet?.positionMm).toBe(0);pair=advanceBand(pair);expect(pair.state.belts[0]!.packet?.positionMm).toBe(75);expect(pair.material.containers.reduce((n,c)=>n+c.currentMassKg,0)).toBeCloseTo(mass,6);
});
it("W09 paid-band output blockage retains the same lot at the end until actual receiver room exists",()=>{
 let pair=poweredBandFixture(),target=pair.material.containers.find(c=>c.state.containerId===pair.state.belts[0]!.installation.target.containerId)!;const mass=pair.material.containers.reduce((n,c)=>n+c.currentMassKg,0);
 const blocked=createResourceContainerSnapshot(createResourceContainerDefinition({...target.definition,maxMassKg:.01}),target.state,fixture.catalog.resources);pair={...pair,material:{...pair.material,containers:pair.material.containers.map(c=>c===target?blocked:c)}};
 for(let i=0;i<55;i++)pair=advanceBand(pair);const held=pair.state.belts[0]!;expect(held).toMatchObject({packetCursor:1,packet:{positionMm:4000},lastStep:{outcome:"WAIT_OUTPUT"}});expect(pair.material.containers.find(c=>c.state.containerId===held.installation.bandContainerId)?.state.contents[0]?.quantity).toBe(100000);
 const receiptCount=pair.material.receipts.length;pair=advanceBand(pair);expect(pair.material.receipts.length).toBe(receiptCount);expect(pair.state.belts[0]?.packet).toEqual(held.packet);
 const current=pair.material.containers.find(c=>c.state.containerId===target.state.containerId)!;pair={...pair,material:{...pair.material,containers:pair.material.containers.map(c=>c===current?createResourceContainerSnapshot(target.definition,current.state,fixture.catalog.resources):c)}};pair=advanceBand(pair);
 expect(pair.state.belts[0]).toMatchObject({packet:null,packetCursor:1,lastStep:{outcome:"Delivered"}});expect(pair.material.containers.find(c=>c.state.containerId===target.state.containerId)?.state.contents[0]?.quantity).toBe(100000);expect(pair.material.containers.reduce((n,c)=>n+c.currentMassKg,0)).toBeCloseTo(mass,6);
});
describe("W09 one Host material authority and complete command receipts", () => {
 it("admits an actual Native UUID without losing its full identity or colliding with other session strings", () => {
   const raw=crypto.randomUUID(),bound=bindFactoryDomainSession(raw);
   expect(bound.rawNativeSessionId).toBe(raw);
   expect(() => createFactoryProductionState("actual_machine",{sessionId:bound.domainSessionId,epoch:0,netRevision:0,catalogDigest:fixture.catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"})).not.toThrow();
   expect(isSaveSafeResourceId(bound.domainSessionId)).toBe(true);
   const originals=[raw,raw.replaceAll("-",""),"a-b","ab","a_b","😀","\ud800"];
   const bindings=originals.map(bindFactoryDomainSession);
   expect(new Set(bindings.map(v=>v.domainSessionId)).size).toBe(originals.length);
   for(const b of bindings){const [,length,payload]=b.domainSessionId.split("_");let n=0n;for(const digit of payload!)n=n*32n+BigInt(parseInt(digit,32));const hex=n.toString(16).padStart(parseInt(length!,36)*4,"0");let restored="";for(let i=0;i<hex.length;i+=4)restored+=String.fromCharCode(parseInt(hex.slice(i,i+4),16));expect(restored).toBe(b.rawNativeSessionId);expect(b.domainSessionId.length).toBeLessThanOrEqual(128);}
 });
 it("evaluates one complete confirmed100ms power interval and preserves every finite native resource with no machines", () => {
   const material=initial(), powerBinding={sessionId:bindFactoryDomainSession(crypto.randomUUID()).domainSessionId,epoch:0,netRevision:0,catalogDigest:fixture.catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
   const state:DryFactoryState={binding:powerBinding,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding:powerBinding,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null};
   const supplyData={version:"fp06-power-supply-v1" as const,binding:powerBinding,tickStartUs:"0",tickEndUs:"100000",offers:[],ports:[],links:[],battery:null,authorityBytes:canonicalJson({fixture:"explicit-empty-unit-net"})};
   const input={confirmed:true,binding:powerBinding,tickStartUs:"0",tickEndUs:"100000",material,supply:{...supplyData,canonicalJson:canonicalJson(supplyData),digest:canonicalSignature(supplyData)},machines:[],belts:[]};
   const proposal=prepareDryFactoryStep(state,input); expect(proposal.status).toBe("Prepared");
   if(proposal.status!=="Prepared")return;
   expect(proposal.state.tickEndUs).toBe("100000");expect(proposal.state.power.revision).toBe(1);expect(proposal.material).toBe(material);expect(proposal.power.grants).toEqual([]);
   expect(commitDryFactoryStep(proposal.state,{...input,material:proposal.material},proposal)).toMatchObject({status:"NoOp"});
   expect(commitDryFactoryStep(proposal.state,{...input,material:proposal.material,confirmed:false},proposal)).toMatchObject({status:"Rejected"});
   expect(prepareDryFactoryStep(state,{...input,confirmed:false})).toMatchObject({status:"Rejected"});
   expect(prepareDryFactoryStep(state,{...input,tickEndUs:"200000"})).toMatchObject({status:"Rejected"});
 });
 it("construction reads the same authority after a real handling Resources transfer instead of retaining initial cargo", () => {
   const { base, next }=candidate(),authority=createFactoryMaterialAuthority(base);
   const construction=createFactoryConstruction({materialAuthority:authority,readPlacementView:()=>({material:base,installations:[]})} as any,base);
   expect(construction.read().material).toBe(base); expect(authority.adopt(base,next)).toBe(true);
   expect(construction.read().material).toBe(next);
 });
 it("adopts an exact real Resources candidate once and lets every consumer read the same complete view", () => {
   const { base, next } = candidate(), authority = createFactoryMaterialAuthority(base);
   expect(authority.adopt(base, next)).toBe(true); expect(authority.read()).toBe(next);
   expect(authority.adopt(base, next)).toBe(false); expect(authority.read()).toBe(next);
 });
 it("answers the exact historical handling command from its receipt before any current revision or Native allocation", () => {
   const history = createFactoryCommandHistory(); history.accept(command, receipt);
   expect(history.replay(JSON.parse(canonicalJson(command)))).toEqual({ status: "NoOp", receipt });
   expect(history.readReceipt(command.commandId)).toEqual(receipt);
 });
 it.each(["revision", "lot"])("rejects changed %s bytes under an accepted handling ID even after the carrier slot is reused", change => {
   const history = createFactoryCommandHistory(); history.accept(command, receipt);
   const changed = JSON.parse(canonicalJson(command));
   if (change === "revision") changed.expected.materialRevision = 2; else changed.sourceLots[0].quantityUnits = 2;
   expect(history.replay(changed)).toMatchObject({ status: "Rejected", receipt: { reason: "IdempotencyConflict" } });
 });
});

it.each([0,1,2,3])("W09 Native quarter-turn %i binds the exact installed Solid port to the accepted Belt convention",async(q)=>{
 const api=await import("../../../src/factory/session/dryFactorySlice"),read=(api as any).readDryFactoryBeltPort;
 expect(typeof read).toBe("function");
 const profile=createFactoryInstallationProfile("B06"),device=fixture.catalog.devices.find(d=>d.sourceId==="B06")!,port=device.ports.find(p=>p.role==="SolidBatchOut")!;
 const owner={instanceId:"cut",definitionSourceId:"B06",profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,centerMm:[-6250,1500,5000],quarterTurns:q};
 const {transformFactoryPoint}=await import("../../../src/factory/construction/installationProfile"),p=port.centerMm!,n=port.outwardNormal!;
 const nativeCenter=transformFactoryPoint([p[0],p[2],p[1]],owner.centerMm,q),nativeNormal=transformFactoryPoint([n[0],n[2],n[1]],[0,0,0],q);
 const result=read(fixture.catalog,owner,port.sourceId,7);
 expect(result).toMatchObject({instanceId:"cut",installRevision:7,deviceId:"B06",deviceDigest:device.digest,portSourceId:port.sourceId,containerId:"output_cut",nativePortId:`port_cut_${port.runtimeId}`,placementCenterMm:owner.centerMm,quarterTurns:(4-q)%4,centerMm:nativeCenter,outwardNormal:nativeNormal});
});
it("W09 q1 Cutter OUT to Former IN is exactly four metres toward Native minus-Z",async()=>{
 const api=await import("../../../src/factory/session/dryFactorySlice"),read=(api as any).readDryFactoryBeltPort;expect(typeof read).toBe("function");
 const port=(sourceId:string,instanceId:string,centerMm:number[],role:string)=>{const profile=createFactoryInstallationProfile(sourceId),d=fixture.catalog.devices.find(d=>d.sourceId===sourceId)!;return read(fixture.catalog,{instanceId,definitionSourceId:sourceId,profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,centerMm,quarterTurns:1},d.ports.find(p=>p.role===role)!.sourceId,1);};
 const a=port("B06","cut",[-6250,1500,5000],"SolidBatchOut"),b=port("B07","form",[-6250,1500,-2500],"SolidBatchIn");
 expect(a.centerMm).toEqual([-6250,2500,3500]);expect(b.centerMm).toEqual([-6250,2500,-500]);expect(a.outwardNormal).toEqual([0,0,-1]);expect(b.outwardNormal).toEqual([0,0,1]);
 expect(b.centerMm.map((n:number,i:number)=>n-a.centerMm[i])).toEqual([0,0,-4000]);
 expect(()=>read(fixture.catalog,{instanceId:"cut",definitionSourceId:"B06",profileDigest:"wrong",sourceDigest:"wrong",centerMm:[-6250,1500,5000],quarterTurns:1},"B06:OUT-SEMI",1)).toThrow(/Binding/);
});

// The preserved RED used the unchanged domain; final tests call the actual domain control.
const controlCandidate=dryControls.setDryFactoryEnabled;
it("PLAY04 control disabling the paid battery cuts actual supply routes without changing finite SOC or custody",async()=>{
 const {owners,adopted}=paidBeltFixture(),battery=owners[3]!,state=controlCandidate(adopted.state,adopted.material,battery,false,"disable_battery");
 const links=[{linkId:"actual_control_test_link",fromPortId:"power_actual_battery",toPortId:"power_actual_cut",active:true,maxMilliWatt:"1700000"}];
 const supply=readDryFactorySupply(state,adopted.material,owners,links,"100000");
 expect(supply.ports.find(p=>p.portId==="power_actual_battery")?.active).toBe(false);
 expect(supply.battery).toEqual({instanceId:"fp02_cargo_c03_unit_1",portId:"power_actual_battery"});
 expect(state.power.battery).toEqual(adopted.state.power.battery);
 const {stepFactoryPower}=await import("../../../src/factory/power/factoryPower");
 const power=stepFactoryPower(state.power,{confirmed:true,binding:state.binding,tickStartUs:"0",tickEndUs:"100000",supply,requests:[{consumerId:"consumer_actual_cut",deviceInstanceId:"actual_cut",jobId:"actual_control_job",portId:"power_actual_cut",priority:"P2",requiredMilliWatt:"1200000",enabled:true}]});
 expect(power.ok).toBe(true);if(!power.ok)throw Error(power.reason);
 expect(power.grants[0]).toMatchObject({status:"NET_DISCONNECTED",allocatedMilliWatt:"0",work:{n:"0",d:"1"}});
 expect(power.nextState.battery).toEqual(adopted.state.power.battery);
});
it("PLAY04 control disables only the paid band and preserves packet, credit and paid machine owners",()=>{
 const {owners,adopted}=paidBeltFixture(),state=controlCandidate(adopted.state,adopted.material,owners[2]!,false,"disable_band");
 const supply=readDryFactorySupply(state,adopted.material,owners,[],"100000");
 expect(supply.ports.find(p=>p.portId==="power_actual_line")?.active).toBe(false);
 expect(supply.ports.find(p=>p.portId==="power_actual_cut")?.active).toBe(true);
 expect(state.belts[0]?.packet).toBe(adopted.state.belts[0]?.packet);expect(state.belts[0]?.creditMg).toBe(adopted.state.belts[0]?.creditMg);
 expect(state.machines.map(m=>m.machineInstanceId)).toEqual(adopted.state.machines.map(m=>m.machineInstanceId));
});
it("PLAY04 control replay preserves the same disabled state and rejects changed command payload",()=>{
 const {owners,adopted}=paidBeltFixture(),state=controlCandidate(adopted.state,adopted.material,owners[3]!,false,"control_replay");
 expect(state.binding.netRevision).toBe(adopted.state.binding.netRevision+1);
 expect(controlCandidate(state,adopted.material,owners[3]!,false,"control_replay")).toBe(state);
 expect(()=>controlCandidate(state,adopted.material,owners[3]!,true,"control_replay")).toThrow(/Idempotency/);
});
import * as dryControls from "../../../src/factory/session/dryFactorySlice";

it("owned-data baseline bytes: Dry cold, copied, joint material and replay", () => {
 const bytesOf=(value:unknown)=>canonicalJson(JSON.parse(JSON.stringify(value)));
 const f=emptyDryFixture(),request=f.inputFor(f.state,f.material),proposal=prepareDryFactoryStep(f.state,request);
 expect(proposal.status).toBe("Prepared");if(proposal.status!=="Prepared")return;
 const copy=JSON.parse(JSON.stringify(proposal)) as typeof proposal;
 const adopted=commitDryFactoryStep(f.state,request,proposal),restored=commitDryFactoryStep(f.state,request,copy);
 expect(adopted.status).toBe("Committed");expect(bytesOf(restored)).toBe(bytesOf(adopted));
 if(adopted.status!=="Committed")return;
 const replay=commitDryFactoryStep(adopted.state,{...request,material:adopted.material},proposal);
 expect(replay.status).toBe("NoOp");
 const bytes=bytesOf({proposal,adopted,replay});
 if(process.env.HESTIA_OWNED_REFERENCE)writeFileSync(`evidence/factory/play/2026-10-14/owned-data-candidate/${process.env.HESTIA_OWNED_REFERENCE}-dry.json`,bytes);
 const forged={...copy,state:{...copy.state,lastStep:{...copy.state.lastStep!,nextStateBytes:copy.state.lastStep!.nextStateBytes+" "}}};
 expect(commitDryFactoryStep(f.state,request,forged).status).toBe("Rejected");
});
