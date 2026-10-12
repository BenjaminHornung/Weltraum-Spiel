import {beforeAll,describe,expect,it} from "vitest";
import {projectFactoryProductionGoals,type FactoryProductionGoalInput} from "../../../src/factory/session/freshLineageProjection";
import {createFp02Fixture} from "../../../src/factory/catalog/fp02Catalog";
import {createFactoryMaterialView,prepareFactoryMaterialStep,commitFactoryMaterialStep,type MaterialIntent,type MaterialView} from "../../../src/factory/material/reservations";
import {createFactoryMaterialAuthority} from "../../../src/factory/session/dryFactorySlice";
import {replaceMaterialContents,readMaterialMassMg} from "../../../src/factory/material/resourcesAdapter";
import {createResourceContainerDefinition,createResourceContainerSnapshot,createResourceContainerState} from "../../../src/resources/containers";
import {canonicalJson,canonicalSignature} from "../../../src/resources/serialization";
import {deepFreezeMetadata} from "../../../src/presentation";
import {createFactoryProductionState,readFactoryProductionRequest,stepFactoryProduction,commitFactoryProductionStep,type ProductionState,type ProductionCommand} from "../../../src/factory/production/productionStep";
import type {ProductionHostFacts,ProductionStart} from "../../../src/factory/production/recipeAdmission";
import {stepFactoryPower,type FactoryPowerBinding,type FactoryPowerState} from "../../../src/factory/power/factoryPower";
import {createFactoryInstallationProfile,transformFactoryBounds} from "../../../src/factory/construction/installationProfile";
import {createFactoryConstruction} from "../../../src/factory/construction/buildStep";
import type {FactoryInstallation} from "../../../src/factory/construction/placement";
import type {FactoryFacilityOwner,FactoryFacilityRequest} from "../../../src/hestia-prototype/physics/factoryFacilitySession";
import {projectFactoryOnboarding} from "../../../src/factory/ui/onboarding";

const fixture=createFp02Fixture("cargo"),catalog=fixture.catalog;
const powerBinding:FactoryPowerBinding={sessionId:"lineage_test",epoch:1,netRevision:1,catalogDigest:catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
const bin=(id:string,maxMassKg=4000)=>createResourceContainerSnapshot(createResourceContainerDefinition({containerId:id,kind:"OutpostStorage",maxMassKg,maxVolumeM3:30,maxStackCount:200}),createResourceContainerState({containerId:id,ownerId:"fp02_wreck_owner",contents:[]},catalog.resources),catalog.resources);
const contents=(material:MaterialView,id:string)=>material.containers.find(c=>c.state.containerId===id)!.state.contents;
const install=(id:string,sourceId:string,centerMm:readonly [number,number,number]):FactoryInstallation=>{
 const profile=createFactoryInstallationProfile(sourceId);return deepFreezeMetadata({instanceId:id,definitionSourceId:sourceId,profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,massMg:profile.massMg,materialContainerId:`installed_${id}`,centerMm,quarterTurns:0,boundsMm:transformFactoryBounds(profile.boundsMm,centerMm,0),serviceBoundsMm:transformFactoryBounds(profile.serviceBoundsMm,centerMm,0)});
};
// Real adopted Material/Production/Construction owner transitions below; only
// power supply, terrain, Native callbacks/observers and reach are synthetic.
// No actual World, time jump, UI, transport or normal 16kg-flow PASS is claimed.
const makeFlow=async function*(starter=false){
 const cargo=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:"fp02_wreck_cargo",kind:"ShipCargo",maxMassKg:4000,maxVolumeM3:30,maxStackCount:200}),fixture.resourceState,catalog.resources);
 const initialMaterial=createFactoryMaterialView(catalog,[cargo]);
 const authority=createFactoryMaterialAuthority(createFactoryMaterialView(catalog,[cargo,...["cutter","former","bench"].flatMap(id=>["installed","input","wip","output","offcut"].map(role=>{
  const device=catalog.devices.find(d=>d.sourceId===(id==="cutter"?"B06":id==="former"?"B07":"B05"))!,limit=device.buffers.find(b=>b.role===role)?.massMg;
  return bin(`${role}_${id}`,role==="installed"?4000:limit!==undefined?limit/1000000:role==="input"?6:role==="offcut"?6:8);
 })),bin("depot")]));
 const installations:FactoryInstallation[]=[install("cutter","B06",[-10000,0,0]),install("former","B07",[10000,0,0]),install("bench","B05",[0,0,-10000])];
 const machines=new Map<string,ProductionState>(),powers=new Map<string,FactoryPowerState>();
 for(const id of ["cutter","former","bench"]){machines.set(id,createFactoryProductionState(id,powerBinding));powers.set(id,{version:"fp06-factory-power-v1",binding:powerBinding,tickEndUs:"0",revision:0,battery:null,consumers:[]});}
 const move=(intent:MaterialIntent)=>{const old=authority.read(),plan=prepareFactoryMaterialStep(old,intent);if(plan.status!=="Prepared")throw Error(plan.reason);const result=commitFactoryMaterialStep(old,plan);if(result.status==="Rejected")throw Error(result.reason);if(!authority.adopt(old,result.view))throw Error("unit material adoption failed");};
 const transfer=(txn:string,sourceContainerId:string,sourceStackId:string,targetContainerId:string,targetStackId:string,itemId:string,quantityUnits:number)=>move({kind:"transfer",transactionId:txn,ownerId:"fp02_wreck_owner",actorId:"unit_player",moves:[{sourceContainerId,sourceStackId,targetContainerId,targetStackId,itemId,quantityUnits}]});
 const source=(containerId:string,itemId:string)=>contents(authority.read(),containerId).find(s=>s.resourceId===catalog.items.find(i=>i.sourceId===itemId)!.resourceId)!.stackId;
 for(const entry of installations){const device=catalog.devices.find(d=>d.sourceId===entry.definitionSourceId)!;move({kind:"transfer",transactionId:`pay_${entry.instanceId}`,ownerId:"fp02_wreck_owner",actorId:"unit_player",moves:device.bom.map((t,i)=>({sourceContainerId:"fp02_wreck_cargo",sourceStackId:source("fp02_wreck_cargo",t.itemId),targetContainerId:entry.materialContainerId,targetStackId:`${entry.instanceId}_bom_${i}`,itemId:t.itemId,quantityUnits:t.quantityUnits}))});}
 const step=(id:string,command?:ProductionCommand)=>{
  const state=machines.get(id)!,material=authority.read(),entry=installations.find(i=>i.instanceId===id)!,device=catalog.devices.find(d=>d.sourceId===entry.definitionSourceId)!;
  const tickStartUs=state.tickEndUs,tickEndUs=String(BigInt(tickStartUs)+100000n),tool=entry.definitionSourceId==="B06"?"fp02.tool.cutter_head":entry.definitionSourceId==="B07"?"fp02.tool.forming_die":"fp02.device.field_workbench";
  const facts:ProductionHostFacts={version:"fp06-production-host-facts-v1",binding:powerBinding,confirmed:true,tickEndUs,installation:{instanceId:id,definitionRef:{sourceId:device.sourceId,version:device.version,digest:device.digest},installationRevision:1,confirmed:true,supported:true,serviceClear:true,installedContainerId:`installed_${id}`,inputContainerId:`input_${id}`,outputContainerId:`output_${id}`,offcutContainerId:`offcut_${id}`,wipContainerId:`wip_${id}`,powerConsumerId:`${id}_work`,powerPortId:`${id}_power`,tool:{partId:source(`installed_${id}`,tool),sourceItemId:tool,revision:1,condition:"OK"}},interaction:{actorId:"unit_player",actorRevision:1,confirmed:true,serviceReachable:true,accessibleContainers:material.containers.map(c=>({containerId:c.state.containerId,revision:c.state.revision}))}};
  const base={confirmed:true,binding:powerBinding,tickStartUs,tickEndUs,material,facts,...(command?{command}:{})},request=readFactoryProductionRequest(state,base);
  const supplyData={version:"fp06-power-supply-v1" as const,binding:powerBinding,tickStartUs,tickEndUs,offers:[{instanceId:"fp02_cargo_c01_unit_1",portId:"source",availableMilliWatt:"6000000",nameplateMilliWatt:"6000000",quality:"confirmed" as const}],ports:[{portId:"source",assetId:"fp02_cargo_c01_unit_1",direction:"out" as const,active:true,maxMilliWatt:"6000000"},{portId:`${id}_power`,assetId:id,direction:"in" as const,active:true,maxMilliWatt:"6000000"}],links:[{linkId:`unit_cable_${id}`,fromPortId:"source",toPortId:`${id}_power`,active:true,maxMilliWatt:"6000000"}],battery:null,authorityBytes:canonicalJson({kind:"explicit_synthetic_unit_power"})};
  const power=stepFactoryPower(powers.get(id)!,{binding:powerBinding,tickStartUs,tickEndUs,confirmed:true,supply:{...supplyData,canonicalJson:canonicalJson(supplyData),digest:canonicalSignature(supplyData)},requests:[request]});if(!power.ok)throw Error(power.reason);
  const input={...base,power},proposal=stepFactoryProduction(state,input);if(proposal.status!=="Prepared")throw Error(proposal.reason);
  const result=commitFactoryProductionStep(state,input,proposal);if(result.status!=="Committed")throw Error(result.status==="Rejected"?result.reason:"UnexpectedOwnerReplay");
 // Clock/work-only steps retain this exact adopted MaterialView. Publish only
 // the real Material transitions, as in the existing production owner fixture.
 if(result.material!==material&&!authority.adopt(material,result.material))throw Error("unit production material adoption failed");machines.set(id,result.state);powers.set(id,power.nextState);
 };
 const start=(id:string,jobId:string,recipeId:string,batchOrdinal=(machines.get(id)!.job?.start.batchOrdinal??-1)+1)=>{const recipe=catalog.recipes.find(r=>r.sourceId===recipeId)!;const command:ProductionStart={kind:"start",commandId:`start_${jobId}`,jobId,batchOrdinal,ownerId:"goal_job_owner",actorId:"unit_player",recipeRef:{sourceId:recipe.sourceId,version:recipe.version,digest:recipe.digest},processKind:recipeId==="REC-05-BRACE"?"manual":"electric",sourceLots:recipe.inputs.map(t=>({itemId:t.itemId,containerId:`input_${id}`,stackId:source(`input_${id}`,t.itemId)}))};step(id,command);};
 const finishElectric=(id:string)=>{let ticks=0;while(machines.get(id)!.job?.phase!=="COMPLETED"){if(++ticks>400)throw Error("actual unit process failed to complete");step(id);}};
 const nativeOwner=(entry:FactoryInstallation,revision:number,transactionId:string,materialBinding="synthetic_paid_machine_install"):FactoryFacilityOwner=>({ownerId:entry.instanceId,instanceId:entry.instanceId,transactionId,definitionRef:createFactoryInstallationProfile(entry.definitionSourceId).definitionRef,profileDigest:entry.profileDigest,sourceDigest:entry.sourceDigest,massMg:entry.massMg,materialBinding,centerMm:entry.centerMm,quarterTurns:entry.quarterTurns,bodyHandle:revision,colliderHandles:[revision],installationRevision:revision});
 const productionRows=(facilityRevision:number)=>installations.filter(i=>["B05","B06","B07"].includes(i.definitionSourceId)).map((i,n)=>({instanceId:i.instanceId,profileDigest:i.profileDigest,sourceDigest:i.sourceDigest,installationRevision:n+1,terrainRevision:0,facilityRevision,confirmed:true,supported:true,serviceClear:true,sweepClear:true,accessible:true}));
 const snapshot=():FactoryProductionGoalInput=>deepFreezeMetadata({initialMaterial,material:authority.read(),machines:[...machines.values()],installations:[...installations],native:{revision:3,state:"Idle",transactionId:null,owners:installations.map((i,n)=>nativeOwner(i,n+1,`pay_${i.instanceId}`)),production:productionRows(3),prepared:null},binding:{catalogDigest:catalog.catalogDigest,terrainRevision:0,facilityRevision:3,confirmed:true}});
 const stages:Record<string,FactoryProductionGoalInput>={initial:snapshot()};
 if(!starter){
  for(const [job,ordinal] of [["cut_a",7],["cut_b",8]] as const){transfer(`feed_${job}`,"fp02_wreck_cargo",source("fp02_wreck_cargo","fp02.bulk.steel_known"),"input_cutter",`raw_${job}`,"fp02.bulk.steel_known",8000000);start("cutter",job,"REC-01-CUT",ordinal);finishElectric("cutter");}
  stages.cut=snapshot();
  yield stages;
  for(const [job,cut,recipe] of [["profile_job","cut_a","REC-02-PROFILE"],["sheet_job","cut_b","REC-03-SHEET"]] as const){transfer(`feed_${job}`,"output_cutter",`${cut}_output_0`,"input_former",`semi_${job}`,"fp02.bulk.steel_semi",7500000);start("former",job,recipe);finishElectric("former");}
  stages.form=snapshot();
  yield stages;
  // Actual split edges preserve full historical parent metadata without
  // multiplying its quantities. Feed one child per exact recipe input.
  move({kind:"split",transactionId:"split_profiles",ownerId:"fp02_wreck_owner",actorId:"unit_player",sourceContainerId:"output_former",sourceStackId:"profile_job_output_0",children:[{targetContainerId:"depot",stackId:"profiles_for_brace",quantityUnits:4000000},{targetContainerId:"depot",stackId:"profiles_remaining",quantityUnits:3000000}]});
  transfer("feed_brace_profiles","depot","profiles_for_brace","input_bench","bench_profiles","fp02.bulk.steel_profile",4000000);
  transfer("feed_brace_sheet","output_former","sheet_job_output_0","input_bench","bench_sheet","fp02.bulk.steel_sheet",2000000);
 }else{
  transfer("starter_profiles","fp02_wreck_cargo",source("fp02_wreck_cargo","fp02.bulk.steel_profile"),"input_bench","bench_profiles","fp02.bulk.steel_profile",4000000);
  transfer("starter_sheet","fp02_wreck_cargo",source("fp02_wreck_cargo","fp02.bulk.steel_sheet"),"input_bench","bench_sheet","fp02.bulk.steel_sheet",2000000);
 }
 start("bench","brace_job","REC-05-BRACE");stages.laid=snapshot();step("bench",{kind:"manual-work",commandId:"montage_brace",jobId:"brace_job",actorId:"unit_player"});stages.assembled=snapshot();step("bench",{kind:"manual-finish",commandId:"finish_brace",jobId:"brace_job",actorId:"unit_player"});stages.brace=snapshot();
 transfer("move_produced_brace","output_bench","brace_job_output_0","fp02_wreck_cargo","brace_job_output_0","fp02.comp.small_brace",1);
 const placement={binding:{sessionId:"lineage_test",epoch:1,terrainRevision:0,sourceDigest:"synthetic_flat_ground",baseDigest:"synthetic_flat_ground",facilityRevision:3},material:authority.read(),installations:[],actor:{actorId:"unit_player",ownerId:"fp02_wreck_owner",positionMm:[0,0,12000],canBuild:true},cargoAccess:{ownerId:"fp02_wreck_owner",containerId:"fp02_wreck_cargo",opened:true,sourceDigest:"synthetic_flat_ground",profileDigest:"synthetic_unit_cargo",positionMm:[0,0,12000],accessBoundsMm:{min:[-1000,0,11000] as const,max:[1000,1500,13000] as const},bodyHandle:0},terrain:{cellMm:125,originMm:[-40000,-125,-40000],size:[640,64,640],readSlot:(_x:number,y:number,_z:number)=>y===0?1:0}};
 let captured:FactoryFacilityRequest|undefined;const construction=createFactoryConstruction({materialAuthority:authority,readPlacementView:()=>placement,pause:async()=>{},prepareNative:async r=>{captured=r;},commitNative:async()=>{},publishNative:()=>{},rollbackNative:async()=>{},finalizeNative:async()=>{},stageProjection:async()=>{},publishProjection:()=>{},rollbackProjection:()=>{},finalizeProjection:()=>{}},authority.read());
 const plan=construction.preview({transactionId:"paid_brace_build",instanceId:"built_brace",definitionSourceId:"fp02.comp.small_brace",centerMm:[0,0,10000],quarterTurns:1});if(plan.status!=="Prepared")throw Error(plan.reason);
 stages.preview=snapshot();const built=await construction.commit(plan);if(built.status!=="Committed")throw Error(built.reason);expect(construction.read().state).toBe("Ready");
 const current=construction.read(),brace=current.installations[0]!,request=captured!;installations.push(brace);
 stages.ready=deepFreezeMetadata({...snapshot(),material:current.material,native:{revision:4,state:"Idle",transactionId:null,owners:[...stages.brace.native.owners,nativeOwner(brace,4,request.transactionId,request.materialBinding)],production:productionRows(4),prepared:null},binding:{catalogDigest:catalog.catalogDigest,terrainRevision:0,facilityRevision:4,confirmed:true}});
 expect(readMaterialMassMg(stages.ready.material)).toBe(readMaterialMassMg(initialMaterial));
 yield stages;
 return stages;
};
let stages:Record<string,FactoryProductionGoalInput>,starter:Record<string,FactoryProductionGoalInput>;
// One retained owner flow; each natural phase stays under the existing hook
// deadline. Neither work intervals nor the runner's timeout are changed.
const flow=makeFlow(),starterFlow=makeFlow(true);
beforeAll(async()=>{stages=(await flow.next()).value!;});
beforeAll(async()=>{await flow.next();});
beforeAll(async()=>{await flow.next();});
beforeAll(async()=>{starter=(await starterFlow.next()).value!;});
const goal=(stage:string)=>projectFactoryProductionGoals(stages[stage]!);
describe("PLAY04 actual receipt-linked fresh 16kg lineage projection",()=>{
 it("two adopted CUTs already expose16/15/1 and leave the HUD CUT task before any Brace",()=>{
  const facts=goal("cut");expect(facts).toMatchObject({inputSteelMg:16000000,cutBatches:2,cutOutputMg:15000000,cutOffcutMg:1000000,profileOutputMg:0,sheetOutputMg:0,braceOutputMg:0,paidBraceInstallation:false});expect(facts!.lineageId).toBeTruthy();
  expect(projectFactoryOnboarding({confirmed:true,cargoOpened:true,installedSourceIds:["B06","B07","B05"],powerConnected:true,twoBeltLinesConnected:true,production:facts}).taskId).toBe("form");
 });
 it("cumulative PROFILE and SHEET survive current job overwrite and actual transfer/split",()=>{
  expect(stages.form.machines.find(m=>m.machineInstanceId==="former")!.commandReceipts.filter(r=>r.kind==="electric-finish")).toHaveLength(2);
  expect(goal("assembled")).toMatchObject({cutBatches:2,profileOutputMg:7000000,sheetOutputMg:7000000,formerOffcutMg:1000000,braceOutputMg:0});
 });
 it("manual work cannot count a Brace until actual Material and Production finish",()=>{
  expect(goal("laid")).toMatchObject({braceOutputMg:0,braceOffcutMg:0});expect(goal("assembled")).toMatchObject({braceOutputMg:0,paidBraceInstallation:false});expect(goal("brace")).toMatchObject({braceOutputMg:5800000,braceOffcutMg:200000,installedBraceMg:0,paidBraceInstallation:false});
 });
 it("only paid ConstructionReady/current Native owner closes the5.8/3/5/2.2kg line",()=>{
  const facts=goal("ready");expect(facts).toMatchObject({inputSteelMg:16000000,cutBatches:2,cutOutputMg:15000000,cutOffcutMg:1000000,profileOutputMg:7000000,sheetOutputMg:7000000,formerOffcutMg:1000000,braceOutputMg:5800000,braceOffcutMg:200000,installedBraceMg:5800000,paidBraceInstallation:true});
  const lots=stages.ready.material.containers.flatMap(c=>c.state.contents),quantity=(id:string)=>lots.filter(s=>s.resourceId===id&&s.extensions["factory.production"]).reduce((n,s)=>n+s.quantity,0);
  expect(quantity("fp02_bulk_steel_profile")).toBe(3000000);expect(quantity("fp02_bulk_steel_sheet")).toBe(5000000);expect(quantity("fp02_bulk_steel_offcut")).toBe(2200000);expect(5800000+3000000+5000000+2200000).toBe(16000000);
 });
 it("material NoOp replay does not count any output or parent twice",()=>{
  const input=stages.ready,receipt=input.material.receipts.at(-1)!,intent=JSON.parse(receipt.requestCanonicalJson) as MaterialIntent,plan=prepareFactoryMaterialStep(input.material,intent);if(plan.status!=="Prepared")throw Error(plan.reason);const replay=commitFactoryMaterialStep(input.material,plan);expect(replay.status).toBe("NoOp");expect(goal("ready")).toMatchObject({cutBatches:2,inputSteelMg:16000000});expect(projectFactoryProductionGoals({...input,material:replay.view})).toEqual(goal("ready"));
 });
 it("starter4/2kg can create and pay a real Brace but never establishes fresh16kg provenance",()=>{expect(projectFactoryProductionGoals(starter.ready)).toBeNull();});
 it("initial inventory alone is not a completed CUT lineage",()=>{expect(goal("initial")).toBeNull();});
 it.each(["cut_a","sheet_job","brace_job"])("missing actual %s finish cannot confirm a complete lineage from metadata",job=>{
  expect(projectFactoryProductionGoals({...stages.ready,machines:stages.ready.machines.map(m=>({...m,commandReceipts:m.commandReceipts.filter(r=>!(r.jobId===job&&(r.kind==="electric-finish"||r.kind==="manual-finish")))}))})).toBeNull();
 });
 it("a forged fresh marker/current metadata cannot replace the receipt genealogy",()=>{
  const input=stages.ready,material={...input.material,containers:input.material.containers.map(c=>c.state.containerId==="depot"?replaceMaterialContents(c,c.state.contents.map(s=>({...s,extensions:{...s.extensions,"factory.production":{recipeRef:{sourceId:"REC-02-PROFILE",version:1,digest:"forged"},sourceLots:[]}}})),catalog):c)};
  expect(projectFactoryProductionGoals({...input,material})).toBeNull();
 });
 it("a missing revision/transfer edge cannot silently reuse an old parent ID",()=>{expect(projectFactoryProductionGoals({...stages.ready,material:{...stages.ready.material,receipts:stages.ready.material.receipts.filter(r=>r.transactionId!=="feed_sheet_job")}})).toBeNull();});
 it("metadata from an unrelated initial origin cannot be joined to the current receipts",()=>{
  const input=stages.ready,initialMaterial={...input.initialMaterial,containers:input.initialMaterial.containers.map(c=>replaceMaterialContents(c,c.state.contents.map(s=>s.resourceId==="fp02_bulk_steel_known"?{...s,extensions:{...s.extensions,"factory.source":{...(s.extensions["factory.source"] as object),sourceEventId:"unrelated_source_event"}}}:s),catalog))};
  expect(projectFactoryProductionGoals({...input,initialMaterial})).toBeNull();
 });
 it.each(["catalogDigest","terrainRevision","facilityRevision"] as const)("stale %s is unconfirmed",key=>{expect(projectFactoryProductionGoals({...stages.ready,binding:{...stages.ready.binding,[key]:key==="catalogDigest"?"foreign":999}})).toBeNull();});
 it("an unconfirmed or Native-held owner publication cannot complete the HUD",()=>{expect(projectFactoryProductionGoals({...stages.ready,binding:{...stages.ready.binding,confirmed:false}})).toBeNull();expect(projectFactoryProductionGoals({...stages.ready,native:{...stages.ready.native,state:"PublishedHeld"}})).toBeNull();});
 it("preview and produced/depot Brace remain unpaid installation",()=>{expect(goal("preview")).toMatchObject({braceOutputMg:5800000,installedBraceMg:0,paidBraceInstallation:false});});
 it("Native absence or moved/unknown paid owner does not turn a logical installation into completion",()=>{
  for(const owners of [stages.ready.native.owners.filter(o=>o.instanceId!=="built_brace"),stages.ready.native.owners.map(o=>o.instanceId==="built_brace"?{...o,centerMm:[250,0,10000] as const}:o)])expect(projectFactoryProductionGoals({...stages.ready,native:{...stages.ready.native,owners}})).toMatchObject({cutBatches:2,braceOutputMg:5800000,installedBraceMg:0,paidBraceInstallation:false});
 });
 it("conflicting repeated finish witness is ambiguous rather than another batch",()=>{
  const input=stages.ready,machines=input.machines.map(m=>m.machineInstanceId==="cutter"?{...m,commandReceipts:[...m.commandReceipts,{...m.commandReceipts.find(r=>r.kind==="electric-finish")!,materialTransactionId:"foreign_finish"}]}:m);
  expect(projectFactoryProductionGoals({...input,machines})).toBeNull();
 });
 it("a Material finish does not prove the frozen electric work requirement",()=>{
  const input=stages.ready,machines=input.machines.map(m=>({...m,commandReceipts:m.commandReceipts.map(r=>r.jobId==="cut_a"&&r.kind==="electric-finish"?{...r,commandCanonicalJson:canonicalJson({...JSON.parse(r.commandCanonicalJson),workMilliJoule:"0"})}:r)}));
  expect(projectFactoryProductionGoals({...input,machines})).toBeNull();
 });
 it("manual finish needs the same adopted actor's ordered active montage receipt",()=>{
  const input=stages.ready,machines=input.machines.map(m=>({...m,commandReceipts:m.commandReceipts.filter(r=>r.kind!=="manual-work")}));
  expect(projectFactoryProductionGoals({...input,machines})).toBeNull();
 });
 it("repeated machine identity cannot double or ambiguously join a job",()=>{expect(projectFactoryProductionGoals({...stages.ready,machines:[...stages.ready.machines,stages.ready.machines[0]!]})).toBeNull();});
});
