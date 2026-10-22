import { prepareFactoryMaterialStep, type MaterialView } from "../material/reservations";
import { factoryMaterialBytes as uncachedFactoryMaterialBytes } from "../construction/placement";
import { readMaterialMassMg } from "../material/resourcesAdapter";
import { canonicalJson as uncachedCanonicalJson, canonicalSignature } from "../../resources/serialization";
import type { FactoryUiCommand, FactoryUiReceipt, FactoryUiResult } from "./hostPort";
import { stepFactoryPower,validateFactoryPowerCheckpointState,FACTORY_POWER_POLICY, type FactoryPowerBinding, type FactoryPowerState, type FactoryPowerSupply, type FactoryPowerSuccess, type FactoryPowerRequest,type FactoryPowerLink,type FactoryPowerPort } from "../power/factoryPower";
import { createFactoryProductionState, readFactoryProductionRequest, stepFactoryProduction, stepFactoryProductionForDryRuntime, isIssuedDryRuntimeProductionProposal, commitFactoryProductionStep, validateFactoryProductionCheckpointState, type ProductionState, type ProductionCommand, type ProductionStepInput } from "../production/productionStep";
import { productionMaterialCanonicalJson, type ProductionHostFacts } from "../production/recipeAdmission";
import { advanceFactoryBelt, advanceFactoryBeltWithMaterialAuthority, createFactoryBeltMaterialFragmentContext, isIssuedFactoryBeltNoMaterialProposal, commitFactoryBeltStep,assertFactoryBeltState, type BeltState, type BeltStepInput, type FactoryBeltMaterialFragmentContext } from "../conveyor/beltReference";
import {isSaveSafeResourceId} from "../../resources/ids";
import type {FactoryInstallation} from "../construction/placement";
import {readRuntimeFactoryInstallationProfile,transformFactoryPoint} from "../construction/installationProfile";
import {createResourceContainerDefinition,createResourceContainerSnapshot,createResourceContainerState} from "../../resources/containers";
import {prepareFactoryPowerSources,type FactoryInstalledPowerAsset} from "../power/sourceAdapter";
import type {BeltInstalledPort} from "../conveyor/beltPorts";
// Derived bytes only: quantities and decisions remain in the existing domain
// validators. Mutable data, accessors and exotic prototypes never enter caches.
const canonicalBytes = new WeakMap<object,string>();
const canonicalMemoUtf16ByteLimit=1_048_576;
const immutableShape = new WeakSet<object>();
const cloneableImmutableData = new WeakSet<object>();
const trustedFactoryDryOwners=new WeakSet<DryFactoryOwnerState>();
const runtimeFactoryMaterialAuthorities=new WeakMap<object,FactoryBeltMaterialFragmentContext>();
const isImmutableDataShape = (value:unknown,parents=new WeakSet<object>()):boolean => {
 if(!value||typeof value!=="object")return typeof value!=="function"&&typeof value!=="symbol"&&(typeof value!=="number"||Number.isFinite(value));
 if(immutableShape.has(value))return true;
 if(!Object.isFrozen(value)||parents.has(value))return false;
 const prototype=Object.getPrototypeOf(value);
 if(Array.isArray(value)?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);parents.add(value);
 const keys=Reflect.ownKeys(descriptors),array=Array.isArray(value);
 const okay=keys.every(key=>typeof key==="string"&&(key==="length"&&array||descriptors[key]!.enumerable))
  &&(!array||keys.length===value.length+1&&keys.every(key=>key==="length"||/^(0|[1-9][0-9]*)$/.test(key as string)&&Number(key)<value.length))
  &&Object.values(descriptors).every(d=>"value" in d&&isImmutableDataShape(d.value,parents));
 parents.delete(value);if(okay)immutableShape.add(value);return okay;
};
const isImmutableData=(value:unknown):boolean=>{
 if(!isImmutableDataShape(value))return false;
 if(!value||typeof value!=="object"||cloneableImmutableData.has(value))return true;
 if(typeof globalThis.structuredClone!=="function")return false;
 // Frozen descriptor inspection cannot exclude Proxies with changing inherited
 // iterators. The standard clone rejects them, including nested ones. Every
 // property below is enumerable own data, so this proof visits the whole tree.
 try{globalThis.structuredClone(value);}catch{return false;}
 const remember=(node:object):void=>{
  if(cloneableImmutableData.has(node))return;cloneableImmutableData.add(node);
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(node))){const child=descriptor.value;if(child&&typeof child==="object")remember(child);}
 };
 remember(value);return true;
};
const canonicalJson = (value:unknown):string => {
 if(!value||typeof value!=="object"||!isImmutableData(value))return uncachedCanonicalJson(value);
 const old=canonicalBytes.get(value);if(old!==undefined)return old;
 let bytes:string;
 if(Array.isArray(value)){
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))return uncachedCanonicalJson(value);
  const entries:string[]=[];for(let i=0;i<value.length;i++)entries.push(canonicalJson(value[i]));
  bytes=`[${entries.join(",")}]`;
 }else{
  const record=value as Record<string,unknown>;
  bytes=`{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
 }
 if(bytes.length*2<=canonicalMemoUtf16ByteLimit)canonicalBytes.set(value,bytes);
 return bytes;
};
const stateBytes = new WeakMap<object,string>();
const stateBytesAliasLastStepNextState=new WeakSet<object>();
const preparedTransitions = new WeakMap<Extract<DryFactoryProposal,{status:"Prepared"}>,Readonly<{base:DryFactoryState;material:MaterialView}>>();
const preparedOwnerTransitions = new WeakMap<Extract<DryFactoryOwnerProposal,{status:"Prepared"}>,Readonly<{base:DryFactoryOwnerState;inputMaterial:MaterialView;resultMaterial:MaterialView;facts:DryFactoryReplayV2["facts"]}>>();
const dataOnlyShape = (value:unknown,parents=new WeakSet<object>()):boolean => {
 if(!value||typeof value!=="object")return typeof value!=="function";
 if(isImmutableData(value))return true;
 const prototype=Object.getPrototypeOf(value);
 if(Array.isArray(value)?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 if(parents.has(value))return false;parents.add(value);
 const descriptors=Object.getOwnPropertyDescriptors(value);
 const keys=Reflect.ownKeys(descriptors),array=Array.isArray(value);
 const okay=keys.every(key=>typeof key==="string"&&(key==="length"&&array||descriptors[key]!.enumerable))
  &&Object.values(descriptors).every(d=>"value" in d&&dataOnlyShape(d.value,parents));
 parents.delete(value);return okay;
};
const dataOnly=(value:unknown):boolean=>{
 if(!dataOnlyShape(value))return false;
 if(!value||typeof value!=="object"||isImmutableData(value))return true;
 // Mutable caller facts receive a fresh proof at both prepare and adoption.
 // Descriptor checking happens first, so this never evaluates an accessor.
 if(typeof globalThis.structuredClone!=="function")return false;
 try{globalThis.structuredClone(value);return true;}catch{return false;}
};
const ownerDataShape=(value:unknown,parents=new WeakSet<object>()):boolean=>{
 if(value===null)return true;
 if(typeof value!=="object")return typeof value==="string"||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value));
 const prototype=Object.getPrototypeOf(value);
 if(Array.isArray(value)?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 if(parents.has(value))return false;parents.add(value);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors),array=Array.isArray(value);
 const okay=keys.every(key=>typeof key==="string"&&(key==="length"&&array||descriptors[key]!.enumerable))
  &&(!array||keys.length===value.length+1&&keys.every(key=>key==="length"||/^(0|[1-9][0-9]*)$/.test(key as string)&&Number(key)<value.length))
  &&Object.values(descriptors).every(descriptor=>"value" in descriptor&&ownerDataShape(descriptor.value,parents));
 parents.delete(value);return okay;
};
const admittedMaterials = new WeakSet<MaterialView>();
const validateDryMaterial = (material:MaterialView):void => {
 if(admittedMaterials.has(material))return;
 productionMaterialCanonicalJson(material);
 const ids=new Set(material.receipts.map(receipt=>receipt.transactionId));let ordinal=0;
 while(ids.has(`dry_validation_${ordinal}`))ordinal++;
 // Hypothetical validation only: this candidate/receipt is never adopted.
 const checked=prepareFactoryMaterialStep(material,{kind:"transfer",transactionId:`dry_validation_${ordinal}`,ownerId:"factory_authority",moves:[]});
 if(checked.status!=="Prepared")throw Error(checked.reason);
 if(isImmutableData(material))admittedMaterials.add(material);
};
const exactMaterialBindings=new WeakMap<MaterialView,string>();
const factoryMaterialBytes=(material:MaterialView):string=>{
 const old=exactMaterialBindings.get(material);if(old!==undefined)return old;
 validateDryMaterial(material);
 const bytes=uncachedFactoryMaterialBytes(material);
 if(isImmutableData(material))exactMaterialBindings.set(material,bytes);
 return bytes;
};
export const readDryFactoryMaterialCacheTextBytes=(material:MaterialView):number=>(exactMaterialBindings.get(material)?.length??0)*2;
/** Read-only decomposition of retained dry-domain/material cache text. */
export const readDryFactoryCheckpointCacheBreakdown=(state:DryFactoryRuntimeState,material:MaterialView)=>{
 let canonicalDescendants=0;const visited=new WeakSet<object>();
 const visit=(value:unknown):void=>{
  if(!value||typeof value!=="object"||visited.has(value))return;visited.add(value);
  const cached=canonicalBytes.get(value);if(cached!==undefined)canonicalDescendants+=cached.length*2;
  if(Array.isArray(value)){for(const child of value)visit(child);return;}
  for(const key in value)if(Object.hasOwn(value,key))visit((value as Record<string,unknown>)[key]);
 };
 visit(state);
 const stateBytesValue=stateBytes.get(state);
 const alias=stateBytesAliasLastStepNextState.has(state);
 return Object.freeze({cachedDomainCanonicalDescendantsBytes:canonicalDescendants,dryFactoryStateBytes:stateBytesValue!==undefined&&!alias?stateBytesValue.length*2:0,
  dryFactoryStateBytesMatchesLastStepNextState:alias,
  currentExactMaterialBindingsBytes:readDryFactoryMaterialCacheTextBytes(material)});
};
/** Reads retained Factory caches only; this never canonicalizes or populates a cache. */
export const readDryFactoryCheckpointCacheBytes=(state:DryFactoryRuntimeState,material:MaterialView):number=>{
 let bytes=0;const visited=new WeakSet<object>();
 const visit=(value:unknown):void=>{
  if(!value||typeof value!=="object"||visited.has(value))return;visited.add(value);
  const cached=canonicalBytes.get(value);if(cached!==undefined)bytes+=cached.length*2;
  if(Array.isArray(value)){for(const child of value)visit(child);return;}
  for(const key in value)if(Object.hasOwn(value,key))visit((value as Record<string,unknown>)[key]);
 };
 visit(state);
 const domain=stateBytes.get(state);
 if(domain!==undefined&&!stateBytesAliasLastStepNextState.has(state))bytes+=domain.length*2;
 return bytes+readDryFactoryMaterialCacheTextBytes(material);
};
/** Pure binding of the Host's already installed paid Native line, never World admission. */
const adoptDryFactoryBeltCore=<T extends DryFactoryRuntimeState>(state:T,material:MaterialView,owner:FactoryInstallation,source:BeltInstalledPort,target:BeltInstalledPort):{state:T;material:MaterialView}=>{
 const profile=readRuntimeFactoryInstallationProfile(owner.definitionSourceId),paid=material.containers.find(c=>c.state.containerId===owner.materialContainerId);
 if(owner.definitionSourceId!=="fp06.line.belt_4m"||!paid||owner.profileDigest!==profile.profileDigest||owner.sourceDigest!==profile.sourceDigest||owner.massMg!==profile.massMg)throw Error("PaidBeltInstallationMissing");
 if(state.belts.some(line=>line.lineId===owner.instanceId||line.installation.source.nativePortId===source.nativePortId||line.installation.target.nativePortId===target.nativePortId))throw Error("DuplicateBeltConnection");
 const instances=(sourceId:string)=>{const item=material.catalog.items.find(i=>i.sourceId===sourceId)!,stacks=paid.state.contents.filter(s=>s.resourceId===item.resourceId);return stacks.map(s=>{const origin=s.extensions["factory.source"] as {instanceId?:string}|undefined;if(s.quantity!==1||!origin?.instanceId)throw Error("PaidBeltPieceIdentityMissing");return origin.instanceId;});};
 const modules=instances("fp02.comp.belt_module"),drives=instances("fp02.comp.belt_drive");
 if(modules.length!==4||drives.length!==1||paid.state.contents.length!==5)throw Error("PaidBeltTermsMismatch");
 const expectedCenter=source.centerMm.map((value,index)=>(value+target.centerMm[index]!)/2-(index===1?1000:0));
 if(canonicalJson(expectedCenter)!==canonicalJson(owner.centerMm)||canonicalJson(transformFactoryPoint([1,0,0],[0,0,0],owner.quarterTurns))!==canonicalJson(source.outwardNormal))throw Error("NativeBeltOwnerPoseMismatch");
 const bandId=`belt_${owner.instanceId}`,bandIn=`band_in_${owner.instanceId}`,bandOut=`band_out_${owner.instanceId}`;
 if(material.containers.some(c=>c.state.containerId===bandId))throw Error("DuplicateBeltCustody");
 const band=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:bandId,kind:"OutpostStorage",maxMassKg:10,maxVolumeM3:.0225,maxStackCount:1,transferPorts:[{portId:bandIn,direction:"Inbound"},{portId:bandOut,direction:"Outbound"}]}),createResourceContainerState({containerId:bandId,ownerId:paid.state.ownerId,contents:[]},material.catalog.resources),material.catalog.resources);
 const candidate=freeze({...material,containers:[...material.containers,band]});
 const line:BeltState=freeze({version:"fp06-one-packet-belt-v1",lineId:owner.instanceId,revision:0,binding:state.binding,tickEndUs:state.tickEndUs,creditMg:0,packetCursor:0,packet:null,lastStep:null,installation:{version:"fp06-straight-installed-belt-v1",installationId:owner.instanceId,revision:1,catalogDigest:material.catalog.catalogDigest,sourceProfileDigest:state.binding.sourceProfileDigest,source,target,lengthMm:4000,moduleInstanceIds:modules,driveInstanceId:drives[0]!,powerPortId:`power_${owner.instanceId}`,consumerId:`consumer_${owner.instanceId}`,jobId:`belt_job_${owner.instanceId}`,bandContainerId:bandId,bandInPortId:bandIn,bandOutPortId:bandOut}});
 assertFactoryBeltState(line,candidate);
 const nextState=freeze({...state,belts:[...state.belts,line],lastStep:null}) as T;
 if(trustedFactoryDryOwners.has(state as DryFactoryOwnerState))trustedFactoryDryOwners.add(nextState as DryFactoryOwnerState);
 return {state:nextState,material:candidate};
};
/** Historical V1 helper keeps its original return type. */
export const adoptDryFactoryBelt=(state:DryFactoryState,material:MaterialView,owner:FactoryInstallation,source:BeltInstalledPort,target:BeltInstalledPort):{state:DryFactoryState;material:MaterialView}=>
 adoptDryFactoryBeltCore(state,material,owner,source,target);
/** Compact Owner counterpart used by the V2 session. */
export const adoptDryFactoryOwnerBelt=(state:DryFactoryOwnerState,material:MaterialView,owner:FactoryInstallation,source:BeltInstalledPort,target:BeltInstalledPort):{state:DryFactoryOwnerState;material:MaterialView}=>
 adoptDryFactoryBeltCore(state,material,owner,source,target);
/** Native uses clockwise x/z yaw; the frozen W08 contract uses counter-clockwise. */
export const FACTORY_NATIVE_BELT_FRAME_BINDING_VERSION="fp06-native-belt-yaw-binding-v1";
export function readDryFactoryBeltPort(catalog:MaterialView["catalog"],owner:Pick<FactoryInstallation,"instanceId"|"definitionSourceId"|"profileDigest"|"sourceDigest"|"centerMm"|"quarterTurns">,portSourceId:string,installRevision:number):import("../conveyor/beltPorts").BeltInstalledPort{
 const profile=readRuntimeFactoryInstallationProfile(owner.definitionSourceId),device=catalog.devices.find(d=>d.sourceId===owner.definitionSourceId),port=device?.ports.find(p=>p.sourceId===portSourceId);
 if(!device||!port||profile.profileDigest!==owner.profileDigest||profile.sourceDigest!==owner.sourceDigest||!Number.isSafeInteger(installRevision)||installRevision<1||!Number.isInteger(owner.quarterTurns)||owner.quarterTurns<0||owner.quarterTurns>3||!port.centerMm||!port.outwardNormal||!["SolidBatchIn","SolidBatchOut"].includes(port.role))throw Error("NativeBeltPortBindingMismatch");
 const point=port.centerMm,normal=port.outwardNormal,role=device.sourceId==="B09"?"storage":port.role==="SolidBatchIn"?"input":"output";
 return freeze({instanceId:owner.instanceId,installRevision,deviceId:device.sourceId,deviceDigest:device.digest,portSourceId:port.sourceId,containerId:`${role}_${owner.instanceId}`,nativePortId:`port_${owner.instanceId}_${port.runtimeId}`,placementCenterMm:owner.centerMm,quarterTurns:((4-owner.quarterTurns)%4) as 0|1|2|3,centerMm:transformFactoryPoint([point[0],point[2],point[1]],owner.centerMm,owner.quarterTurns),outwardNormal:transformFactoryPoint([normal[0],normal[2],normal[1]],[0,0,0],owner.quarterTurns)});
}
// Port ampacity includes the accepted restart reserve. The allocator still
// delivers ONLY the actual machine/belt demand; reserved headroom is never work.
export const FACTORY_DRY_PORT_CAPACITY_BINDING_VERSION="fp06-demand-plus-restart-ampacity-v1";
export function readDryFactorySupply(state:DryFactoryRuntimeState,material:MaterialView,installed:readonly FactoryInstallation[],links:readonly FactoryPowerLink[],end:string):FactoryPowerSupply{
 const assets:FactoryInstalledPowerAsset[]=[],ports:FactoryPowerPort[]=[];
 for(const owner of installed){
  const paid=material.containers.find(c=>c.state.containerId===owner.materialContainerId);if(!paid)throw Error("PaidPowerOwnerMissing");
  const sourceId=owner.definitionSourceId,cargoId=sourceId==="fp02.device.battery_4kwh"?"C03":sourceId==="fp02.device.wind_pack_6kw"?"C01":sourceId==="fp02.device.pv_pack_2kwp"?"C02":null;
  if(cargoId){
   const item=material.catalog.items.find(i=>i.sourceId===sourceId)!,origin=paid.state.contents[0]?.extensions["factory.source"] as {instanceId:string};
   assets.push({instanceId:origin.instanceId,cargoId,itemSourceId:sourceId,definitionVersion:item.version,definitionDigest:item.digest,containerId:paid.state.containerId,ownerId:paid.state.ownerId!,portId:`power_${owner.instanceId}`,installationRevision:1,confirmed:true});
   ports.push({portId:`power_${owner.instanceId}`,assetId:origin.instanceId,direction:cargoId==="C03"?"both":"out",active:readDryFactoryEnabled(state,owner.instanceId),maxMilliWatt:cargoId==="C03"?"8000000":cargoId==="C01"?"6000000":"2000000"});
  }else if(sourceId==="fp02.device.distribution_40kw")ports.push({portId:`power_${owner.instanceId}`,assetId:owner.instanceId,direction:"both",active:readDryFactoryEnabled(state,owner.instanceId),maxMilliWatt:"40000000"});
  else if(sourceId==="B06"||sourceId==="B07")ports.push({portId:`power_${owner.instanceId}`,assetId:owner.instanceId,direction:"in",active:readDryFactoryEnabled(state,owner.instanceId),maxMilliWatt:String(BigInt(sourceId==="B06"?1200000:2000000)+BigInt(FACTORY_POWER_POLICY.restartHeadroomMilliWatt))});
 }
 for(const line of state.belts)ports.push({portId:line.installation.powerPortId,assetId:line.installation.driveInstanceId,direction:"in",active:readDryFactoryEnabled(state,line.lineId),maxMilliWatt:String(100000n+BigInt(FACTORY_POWER_POLICY.restartHeadroomMilliWatt))});
 return prepareFactoryPowerSources(material.catalog,{binding:state.binding,tickStartUs:state.tickEndUs,tickEndUs:end,installed:assets,resourceContainers:material.containers.map(c=>c.state),ports,links,observation:null});
}
/** Controls belong to the adopted domain. Host separately proves current Native ownership and local reach. */
export const readDryFactoryEnabled=(state:DryFactoryRuntimeState,instanceId:string):boolean=>!state.enabledControls?.disabledInstanceIds.includes(instanceId);
const setDryFactoryEnabledCore=<T extends DryFactoryRuntimeState>(state:T,material:MaterialView,owner:FactoryInstallation,enabled:boolean,commandId:string):T=>{
 if(typeof enabled!=="boolean"||!isSaveSafeResourceId(commandId)||!isSaveSafeResourceId(owner.instanceId))throw Error("InvalidEnabledControl");
 const controls=state.enabledControls??{revision:0,disabledInstanceIds:[],commandReceipts:[]};
 const prior=controls.commandReceipts.find(r=>r.commandId===commandId);
 if(prior){if(prior.instanceId!==owner.instanceId||prior.enabled!==enabled)throw Error("IdempotencyConflict");return state;}
 if(!["B06","B07","fp06.line.belt_4m","fp02.device.battery_4kwh","fp02.device.distribution_40kw","fp02.device.wind_pack_6kw","fp02.device.pv_pack_2kwp"].includes(owner.definitionSourceId))throw Error("DeviceControlUnsupported");
 // Existing payment validation remains authoritative; no material candidate is adopted here.
 reconcileDryFactoryInstallationsCore(state,material,[owner]);
 if((owner.definitionSourceId==="B06"||owner.definitionSourceId==="B07")&&!state.machines.some(m=>m.machineInstanceId===owner.instanceId)
   ||owner.definitionSourceId==="fp06.line.belt_4m"&&!state.belts.some(b=>b.lineId===owner.instanceId)
   ||owner.definitionSourceId==="fp02.device.battery_4kwh"&&state.power.battery?.instanceId!=="fp02_cargo_c03_unit_1")throw Error("AdoptedControlOwnerMissing");
 const binding={...state.binding,netRevision:state.binding.netRevision+1},revision=state.revision+1,controlRevision=controls.revision+1;
 if(![binding.netRevision,revision,controlRevision].every(Number.isSafeInteger))throw Error("EnabledControlRevisionExhausted");
 const disabledInstanceIds=controls.disabledInstanceIds.filter(id=>id!==owner.instanceId);if(!enabled)disabledInstanceIds.push(owner.instanceId);
 const next=freeze({...state,binding,revision,enabledControls:{revision:controlRevision,disabledInstanceIds:disabledInstanceIds.sort(),commandReceipts:[...controls.commandReceipts,{commandId,instanceId:owner.instanceId,enabled}]},
  power:{...state.power,binding},machines:state.machines.map(machine=>({...machine,binding,lastStep:null})),belts:state.belts.map(line=>({...line,binding})),lastStep:null}) as T;
 if(trustedFactoryDryOwners.has(state as DryFactoryOwnerState))trustedFactoryDryOwners.add(next as DryFactoryOwnerState);
 return next;
};
/** Historical V1 helper keeps its original public type. */
export const setDryFactoryEnabled=(state:DryFactoryState,material:MaterialView,owner:FactoryInstallation,enabled:boolean,commandId:string):DryFactoryState=>
 setDryFactoryEnabledCore(state,material,owner,enabled,commandId);
/** Compact Owner counterpart used by the V2 session. */
export const setDryFactoryOwnerEnabled=(state:DryFactoryOwnerState,material:MaterialView,owner:FactoryInstallation,enabled:boolean,commandId:string):DryFactoryOwnerState=>
 setDryFactoryEnabledCore(state,material,owner,enabled,commandId);
/** Source-bound empty buffers and domain membership. Host first proves the same installed Native owners. */
const reconcileDryFactoryInstallationsCore=<T extends DryFactoryRuntimeState>(state:T,material:MaterialView,installations:readonly FactoryInstallation[],netRevision=state.binding.netRevision):{state:T;material:MaterialView}=>{
 if(!Number.isSafeInteger(netRevision)||netRevision<state.binding.netRevision)throw Error("InvalidDryGraphRevision");
 const binding={...state.binding,netRevision},containers=[...material.containers],machines=[...state.machines];let battery=state.power.battery;
 const empty=(id:string,massMg:number,volumeMm3:number,ports:readonly Readonly<{portId:string;direction:"Inbound"|"Outbound"|"Bidirectional"}>[]=[])=>{
  const definition=createResourceContainerDefinition({containerId:id,kind:"OutpostStorage",maxMassKg:massMg/1000000,maxVolumeM3:volumeMm3/1000000000,maxStackCount:200,transferPorts:ports});
  const existing=containers.find(c=>c.state.containerId===id);
  if(existing){if(canonicalJson(existing.definition)!==canonicalJson(definition))throw Error("ExistingFactoryBufferDefinitionMismatch");return;}
  const owner=material.containers.find(c=>c.state.containerId==="fp02_wreck_cargo")!.state.ownerId;
  containers.push(createResourceContainerSnapshot(definition,createResourceContainerState({containerId:id,ownerId:owner,contents:[]},material.catalog.resources),material.catalog.resources));
 };
 for(const installed of installations){
  const profile=readRuntimeFactoryInstallationProfile(installed.definitionSourceId),paid=material.containers.find(c=>c.state.containerId===installed.materialContainerId);
  if(!paid||profile.profileDigest!==installed.profileDigest||profile.sourceDigest!==installed.sourceDigest||profile.massMg!==installed.massMg)throw Error("PaidInstallationMissing");
  const terms=new Map<string,number>();for(const stack of paid.state.contents){const item=material.catalog.items.find(i=>i.resourceId===stack.resourceId);if(!item||stack.condition!==undefined&&stack.condition!==1)throw Error("PaidInstallationInvalid");terms.set(item.sourceId,(terms.get(item.sourceId)??0)+stack.quantity);}
  if(canonicalJson([...terms].sort())!==canonicalJson(profile.bom.map(t=>[t.itemId,t.quantityUnits]).sort()))throw Error("PaidInstallationTermsMismatch");
  if(installed.definitionSourceId==="fp02.device.battery_4kwh"){
   const origin=paid.state.contents[0]?.extensions["factory.source"] as {instanceId?:string}|undefined;
   if(origin?.instanceId!=="fp02_cargo_c03_unit_1")throw Error("PaidInstallationBatteryIdentity");
   if(battery&&battery.instanceId!==origin.instanceId)throw Error("PaidInstallationDuplicateBattery");
   battery??={instanceId:origin.instanceId,storedEnergy:{n:"12960000000",d:"1"}};
  }
  const device=material.catalog.devices.find(d=>d.sourceId===installed.definitionSourceId);if(!device)continue;
  const port=(role:string,direction:"Inbound"|"Outbound")=>device.ports.filter(p=>p.role===role).map(p=>({portId:`port_${installed.instanceId}_${p.runtimeId}`,direction}));
  if(device.sourceId==="B09"){empty(`storage_${installed.instanceId}`,200000000,1260000000,[...port("SolidBatchIn","Inbound"),...port("SolidBatchOut","Outbound")]);continue;}
  if(!["B05","B06","B07"].includes(device.sourceId))continue;
  for(const role of ["input","output","offcut"] as const){const sourceMass=device.buffers.find(b=>b.role===role)?.massMg??(role==="offcut"?600000:6000000);
   // Explicit conservative pack envelope for the closed steel process family; no zero/solid density.
   // Externally frozen ports keep their native direction. The separately named
   // internal process endpoint admits actual IN→WIP and WIP→OUT/cassette transfers.
   // B05 has no external machine ports. Its internal manual endpoint permits
   // local player intake/export only after Native service/reach admission.
   // This creates neither a catalog Solid port nor a conveyor connection.
   empty(`${role}_${installed.instanceId}`,sourceMass,Math.ceil(sourceMass*9/4),[...port(role==="input"?"SolidBatchIn":role==="output"?"SolidBatchOut":"WasteCassette",role==="input"?"Inbound":"Outbound"),{portId:`internal_${role}_${installed.instanceId}`,direction:device.sourceId==="B05"?"Bidirectional":role==="input"?"Outbound":"Inbound"}]);}
  empty(`wip_${installed.instanceId}`,device.sourceId==="B06"?8000000:device.sourceId==="B07"?7500000:6000000,device.sourceId==="B06"?18000000:device.sourceId==="B07"?16875000:13500000);
  if(!machines.some(m=>m.machineInstanceId===installed.instanceId))machines.push(createFactoryProductionState(installed.instanceId,binding,state.tickEndUs));
 }
 const changed=containers.length!==material.containers.length,membership=machines.length!==state.machines.length||battery!==state.power.battery||netRevision!==state.binding.netRevision;
 if(!changed&&!membership)return {state,material};
 const nextState=freeze({...state,binding,power:{...state.power,binding,battery},machines:machines.map(machine=>({...machine,binding,lastStep:null})),belts:state.belts.map(belt=>({...belt,binding})),lastStep:null}) as T;
 if(trustedFactoryDryOwners.has(state as DryFactoryOwnerState))trustedFactoryDryOwners.add(nextState as DryFactoryOwnerState);
 return {material:changed?freeze({...material,containers}):material,state:nextState};
};
/** Historical V1 helper keeps its original return type. */
export const reconcileDryFactoryInstallations=(state:DryFactoryState,material:MaterialView,installations:readonly FactoryInstallation[],netRevision=state.binding.netRevision):{state:DryFactoryState;material:MaterialView}=>
 reconcileDryFactoryInstallationsCore(state,material,installations,netRevision);
/** Compact Owner counterpart used by the V2 session and V2 tests. */
export const reconcileDryFactoryOwnerInstallations=(state:DryFactoryOwnerState,material:MaterialView,installations:readonly FactoryInstallation[],netRevision=state.binding.netRevision):{state:DryFactoryOwnerState;material:MaterialView}=>
 reconcileDryFactoryInstallationsCore(state,material,installations,netRevision);

export interface DryFactoryState {
  readonly binding: FactoryPowerBinding; readonly revision: number; readonly tickEndUs: string;
  readonly power: FactoryPowerState; readonly machines: readonly ProductionState[]; readonly belts: readonly BeltState[];
  readonly enabledControls?: Readonly<{revision:number;disabledInstanceIds:readonly string[];commandReceipts:readonly Readonly<{commandId:string;instanceId:string;enabled:boolean}>[]}>;
  readonly lastStep: Readonly<{ inputBytes: string; factsBytes: string; nextStateBytes: string; materialBytes: string }> | null;
}
export type DryFactoryCore=Omit<DryFactoryState,"lastStep">;
export interface DryFactoryReplayV2 {
 readonly version:"fp06-dry-replay-segments-v2";
 readonly facts:Omit<DryFactoryStepInput,"material">;
 readonly inputMaterialBytes:string;
 readonly materialBytes:string;
}
export type DryFactoryOwnerState=DryFactoryCore&Readonly<{lastStep:DryFactoryReplayV2|null}>;
export type DryFactoryRuntimeState=DryFactoryState|DryFactoryOwnerState;
export type DryFactoryOwnerProposal=Readonly<{status:"Prepared";state:DryFactoryOwnerState;material:MaterialView;power:FactoryPowerSuccess}>|Readonly<{status:"Rejected";reason:string}>;
export type DryFactoryV1ImportAdmission=(parts:Readonly<{core:DryFactoryCore;replay:Readonly<{inputBytes:string;factsBytes:string;nextStateBytes:string;materialBytes:string}>|null}>)=>void;
export type DryFactoryV1MaterializeAdmission=(parts:Readonly<{core:DryFactoryCore;replay:DryFactoryReplayV2|null}>)=>void;
const checkpointKeys=(value:unknown,expected:readonly string[]):boolean=>!!value&&typeof value==="object"&&!Array.isArray(value)
 &&Object.keys(value).sort().join(",")===[...expected].sort().join(",");
/** Revalidates all saved domain owners and proves installation reconciliation is an exact no-op. */
type DryFactoryValidatedV1Replay=Readonly<{facts:DryFactoryReplayV2["facts"];inputMaterialBytes:string}>;
const validateDryFactoryCheckpointStateInternal=(state:DryFactoryState,material:MaterialView,installations:readonly FactoryInstallation[],historicalMaterialBytes:string|null,
 nativeOwners:readonly Readonly<{instanceId:string;installationRevision:number}>[],beforeReplayParse?:DryFactoryV1ImportAdmission):DryFactoryValidatedV1Replay|null=>{
 const checkpointBytes=(value:unknown):string=>{
  if(typeof value!=="string"||value.length===0||value.length>16*1024*1024)throw Error("InvalidDryCheckpointBytes");
  const parsed=JSON.parse(value);if(uncachedCanonicalJson(parsed)!==value)throw Error("InvalidDryCheckpointBytes");return value;
 };
 if(!checkpointKeys(state,["binding","revision","tickEndUs","power","machines","belts","lastStep","enabledControls"])
  &&!checkpointKeys(state,["binding","revision","tickEndUs","power","machines","belts","lastStep"]))throw Error("InvalidDryCheckpointShape");
 if(!Number.isSafeInteger(state.revision)||state.revision<0||!/^(0|[1-9][0-9]{0,18})$/.test(state.tickEndUs)
  ||BigInt(state.tickEndUs)>9_223_372_036_854_775_807n||BigInt(state.tickEndUs)%100_000n!==0n
  ||!checkpointKeys(state.binding,["sessionId","epoch","netRevision","catalogDigest","sourceProfileDigest"])
  ||state.binding.catalogDigest!==material.catalog.catalogDigest||state.binding.sourceProfileDigest!==FACTORY_POWER_POLICY.sourceObservationVersion
  ||!checkpointKeys(state.power,["version","binding","tickEndUs","revision","battery","consumers"])
  ||!checkpointKeys(state.power.binding,["sessionId","epoch","netRevision","catalogDigest","sourceProfileDigest"])
  ||state.power.tickEndUs!==state.tickEndUs||uncachedCanonicalJson(state.power.binding)!==uncachedCanonicalJson(state.binding)
  ||!Array.isArray(state.machines)||!Array.isArray(state.belts)||state.machines.length+state.belts.length>16)throw Error("InvalidDryCheckpointBinding");
 for(const consumer of state.power.consumers)if(!checkpointKeys(consumer,["consumerId","requestKey","waiting","stableSupplyUs"]))throw Error("InvalidDryPowerConsumerShape");
 if(state.power.battery!==null&&!checkpointKeys(state.power.battery,["instanceId","storedEnergy"]))throw Error("InvalidDryPowerBatteryShape");
 if(state.power.battery!==null&&!checkpointKeys(state.power.battery.storedEnergy,["n","d"]))throw Error("InvalidDryPowerBatteryShape");
 validateDryMaterial(material);validateFactoryPowerCheckpointState(state.power);
 const nativeInstallationRevisions=new Map(nativeOwners.map(owner=>[owner.instanceId,owner.installationRevision] as const));
 if(nativeInstallationRevisions.size!==nativeOwners.length)throw Error("DryCheckpointNativeOwnerMembershipMismatch");
 const machineIds=new Set<string>(),expectedMachines=new Set(installations.filter(i=>["B05","B06","B07"].includes(i.definitionSourceId)).map(i=>i.instanceId));
 for(const machine of state.machines){
  if(!checkpointKeys(machine,["version","machineInstanceId","binding","revision","tickEndUs","status","job","commandReceipts","lastStep"])
   ||machineIds.has(machine.machineInstanceId)||!expectedMachines.has(machine.machineInstanceId)
   ||uncachedCanonicalJson(machine.binding)!==uncachedCanonicalJson(state.binding)||machine.tickEndUs!==state.tickEndUs)throw Error("DryCheckpointMachineMembershipMismatch");
  for(const receipt of machine.commandReceipts)if(!checkpointKeys(receipt,["commandId","jobId","commandCanonicalJson","tickEndUs","kind","materialTransactionId"]))throw Error("DryCheckpointProductionReceiptShape");
  if(machine.job){
   if(!checkpointKeys(machine.job,["start","recipeRef","recipeCanonicalJson","processCanonicalJson","installationCanonicalJson","reservationId","beginReceiptCanonicalJson","workMilliJoule","phase","manualWorkReceiptId","completionReceiptId"]))throw Error("DryCheckpointProductionJobShape");
   const startKeys=["kind","commandId","jobId","batchOrdinal","ownerId","actorId","recipeRef","processKind","sourceLots",...(Object.hasOwn(machine.job.start,"missionId")?["missionId"]:[])];
   if(!checkpointKeys(machine.job.start,startKeys)||!checkpointKeys(machine.job.recipeRef,["sourceId","version","digest"]))throw Error("DryCheckpointProductionStartShape");
  }
  machineIds.add(machine.machineInstanceId);
  const owner=installations.find(i=>i.instanceId===machine.machineInstanceId)!;
  const device=material.catalog.devices.find(d=>d.sourceId===owner.definitionSourceId);
  if(!device)throw Error("DryCheckpointMachineDefinitionMissing");
  const wip=`wip_${owner.instanceId}`;
  validateFactoryProductionCheckpointState(machine,material,{instanceId:owner.instanceId,outputContainerId:`output_${owner.instanceId}`,
   offcutContainerId:`offcut_${owner.instanceId}`,wipContainerId:wip});
 }
 if(machineIds.size!==expectedMachines.size)throw Error("DryCheckpointMachineStateMissing");
 const activeJobs=new Map<string,string>();
 for(const machine of state.machines){
  const job=machine.job;if(!job||job.phase==="COMPLETED")continue;
  const wipContainerId=`wip_${machine.machineInstanceId}`;
  if(activeJobs.has(job.reservationId))throw Error("DryCheckpointDuplicateProductionReservation");
  activeJobs.set(job.reservationId,wipContainerId);
 }
 const factoryWipIds=new Set([...expectedMachines].map(instanceId=>`wip_${instanceId}`));
 const productionReservations=material.reservations.filter(reservation=>reservation.recipeRef!==null||factoryWipIds.has(reservation.wipContainerId));
 for(const reservation of productionReservations)if(activeJobs.get(reservation.reservationId)!==reservation.wipContainerId)
  throw Error("DryCheckpointOrphanProductionReservation");
 if(activeJobs.size!==productionReservations.length)throw Error("DryCheckpointProductionReservationMissing");
 const activeWip=new Set(activeJobs.values());
 for(const container of material.containers)if(factoryWipIds.has(container.state.containerId)&&container.state.contents.length>0&&!activeWip.has(container.state.containerId))
  throw Error("DryCheckpointOrphanProductionWip");
 const beltIds=new Set<string>();
 for(const belt of state.belts){
  const beltOwner=installations.find(i=>i.instanceId===belt.lineId);
  if(!checkpointKeys(belt,["version","lineId","revision","binding","installation","tickEndUs","creditMg","packetCursor","packet","lastStep"])
   ||!checkpointKeys(belt.installation,["version","installationId","revision","catalogDigest","sourceProfileDigest","source","target","lengthMm","moduleInstanceIds","driveInstanceId","powerPortId","consumerId","jobId","bandContainerId","bandInPortId","bandOutPortId"])
   ||beltIds.has(belt.lineId)||!beltOwner||beltOwner.definitionSourceId!=="fp06.line.belt_4m"
   ||uncachedCanonicalJson(belt.binding)!==uncachedCanonicalJson(state.binding)||belt.tickEndUs!==state.tickEndUs)throw Error("DryCheckpointBeltMembershipMismatch");
  const nativePort=(port:BeltInstalledPort):void=>{
   const portOwner=installations.find(i=>i.instanceId===port.instanceId),nativeRevision=nativeInstallationRevisions.get(port.instanceId);
   if(!portOwner||nativeRevision===undefined||port.installRevision!==nativeRevision
    ||uncachedCanonicalJson(readDryFactoryBeltPort(material.catalog,portOwner,port.portSourceId,nativeRevision))!==uncachedCanonicalJson(port))throw Error("DryCheckpointBeltNativePortPoseMismatch");
  };
  nativePort(belt.installation.source);nativePort(belt.installation.target);
  const routeCenter=belt.installation.source.centerMm.map((value:number,index:number)=>(value+belt.installation.target.centerMm[index]!)/2-(index===1?1000:0));
  if(uncachedCanonicalJson(routeCenter)!==uncachedCanonicalJson(beltOwner.centerMm)
   ||uncachedCanonicalJson(transformFactoryPoint([1,0,0],[0,0,0],beltOwner.quarterTurns))!==uncachedCanonicalJson(belt.installation.source.outwardNormal))
   throw Error("DryCheckpointBeltNativeOwnerPoseMismatch");
  if(belt.packet&&!checkpointKeys(belt.packet,["packetId","stackId","itemId","itemVersion","itemDigest","parentStackId","injectionTransactionId","injectionReceiptCanonicalJson","sourceRevisionAfterInjection","targetRevisionAtInjection","positionMm"]))throw Error("DryCheckpointBeltPacketShape");
  if(belt.lastStep&&!checkpointKeys(belt.lastStep,["tickEndUs","requestDigest","outcome"]))throw Error("DryCheckpointBeltReceiptShape");
  beltIds.add(belt.lineId);assertFactoryBeltState(belt,material);
 }
 const expectedBelts=new Set(installations.filter(i=>i.definitionSourceId==="fp06.line.belt_4m").map(i=>i.instanceId));
 if(beltIds.size!==expectedBelts.size||[...expectedBelts].some(id=>!beltIds.has(id)))throw Error("DryCheckpointBeltStateMissing");
 if(state.enabledControls){
  const controls=state.enabledControls;
  if(!checkpointKeys(controls,["revision","disabledInstanceIds","commandReceipts"])||!Number.isSafeInteger(controls.revision)||controls.revision<0
    ||!Array.isArray(controls.disabledInstanceIds)||controls.disabledInstanceIds.length>16||new Set(controls.disabledInstanceIds).size!==controls.disabledInstanceIds.length
    ||!controls.disabledInstanceIds.every(isSaveSafeResourceId)||!Array.isArray(controls.commandReceipts)||controls.commandReceipts.length>4096)throw Error("InvalidDryControlCheckpoint");
  const commandIds=new Set<string>();for(const receipt of controls.commandReceipts){
   if(!checkpointKeys(receipt,["commandId","instanceId","enabled"])||!isSaveSafeResourceId(receipt.commandId)||!isSaveSafeResourceId(receipt.instanceId)
    ||typeof receipt.enabled!=="boolean"||commandIds.has(receipt.commandId))throw Error("InvalidDryControlCheckpoint");commandIds.add(receipt.commandId);
  }
 }
 let replay:DryFactoryValidatedV1Replay|null=null;
 if(state.lastStep){
  const saved=state.lastStep;if(!checkpointKeys(saved,["inputBytes","factsBytes","nextStateBytes","materialBytes"]))throw Error("InvalidDryReplayCheckpoint");
  const {lastStep:_rootReceipt,...core}=state;
  beforeReplayParse?.({core,replay:{inputBytes:saved.inputBytes,factsBytes:saved.factsBytes,nextStateBytes:saved.nextStateBytes,materialBytes:saved.materialBytes}});
  const input=JSON.parse(checkpointBytes(saved.inputBytes)) as {facts?:unknown;materialBytes?:unknown};
  const factsBytes=checkpointBytes(saved.factsBytes),nextStateBytes=checkpointBytes(saved.nextStateBytes),materialBytes=checkpointBytes(saved.materialBytes);
  if(!checkpointKeys(input,["facts","materialBytes"])||uncachedCanonicalJson(input.facts)!==factsBytes||typeof input.materialBytes!=="string"
    ||uncachedCanonicalJson(JSON.parse(checkpointBytes(input.materialBytes)))!==input.materialBytes||nextStateBytes!==uncachedCanonicalJson(core)
    ||typeof historicalMaterialBytes!=="string"||materialBytes!==historicalMaterialBytes)throw Error("DryReplayCheckpointMismatch");
  replay=Object.freeze({facts:input.facts as DryFactoryReplayV2["facts"],inputMaterialBytes:input.materialBytes});
 }else if(historicalMaterialBytes!==null)throw Error("DryReplayCheckpointMismatch");
 const reconciled=reconcileDryFactoryInstallations(state,material,installations,state.binding.netRevision);
 if(uncachedCanonicalJson(reconciled.state)!==uncachedCanonicalJson(state)
  ||uncachedFactoryMaterialBytes(reconciled.material)!==uncachedFactoryMaterialBytes(material))throw Error("DryCheckpointWouldRecreateState");
 return replay;
};
export const validateDryFactoryCheckpointState=(state:DryFactoryState,material:MaterialView,installations:readonly FactoryInstallation[],historicalMaterialBytes:string|null,
 nativeOwners:readonly Readonly<{instanceId:string;installationRevision:number}>[]):void=>{
 validateDryFactoryCheckpointStateInternal(state,material,installations,historicalMaterialBytes,nativeOwners);
};
/** Validates the compact owner directly; it never expands the V2 replay into V1 strings. */
export const validateDryFactoryOwnerCheckpointState=(state:DryFactoryOwnerState,material:MaterialView,installations:readonly FactoryInstallation[],historicalMaterialBytes:string|null,
 nativeOwners:readonly Readonly<{instanceId:string;installationRevision:number}>[]):void=>{
 if(!checkpointKeys(state,["binding","revision","tickEndUs","power","machines","belts","lastStep","enabledControls"])
  &&!checkpointKeys(state,["binding","revision","tickEndUs","power","machines","belts","lastStep"]))throw Error("InvalidDryCheckpointShape");
 const {lastStep,...core}=state,legacyView={...core,lastStep:null} as DryFactoryState;
 validateDryFactoryCheckpointStateInternal(legacyView,material,installations,null,nativeOwners);
 if(lastStep===null){if(historicalMaterialBytes!==null)throw Error("DryReplayCheckpointMismatch");if(isImmutableData(state))trustedFactoryDryOwners.add(state);return;}
 if(!checkpointKeys(lastStep,["version","facts","inputMaterialBytes","materialBytes"])||lastStep.version!=="fp06-dry-replay-segments-v2"
  ||!ownerDataShape(lastStep.facts)||!dataOnly(lastStep.facts))throw Error("InvalidDryReplayCheckpoint");
 const facts=lastStep.facts as unknown as Record<string,unknown>;
 if(!["confirmed","binding","tickStartUs","tickEndUs","supply","machines","belts"].every(key=>Object.hasOwn(facts,key))
  ||facts.confirmed!==true||uncachedCanonicalJson(facts.binding)!==uncachedCanonicalJson(state.binding)
  ||typeof facts.tickStartUs!=="string"||typeof facts.tickEndUs!=="string"
  ||!/^(0|[1-9][0-9]{0,18})$/.test(facts.tickStartUs)||!/^(0|[1-9][0-9]{0,18})$/.test(facts.tickEndUs)
  ||BigInt(facts.tickEndUs)-BigInt(facts.tickStartUs)!==100_000n||facts.tickEndUs!==state.tickEndUs
  ||!Array.isArray(facts.machines)||facts.machines.length!==state.machines.length||!Array.isArray(facts.belts)||facts.belts.length!==state.belts.length)throw Error("DryReplayCheckpointMismatch");
 const machineIds=new Set((facts.machines as Readonly<{instanceId:string}>[]).map(machine=>machine.instanceId));
 const beltIds=new Set((facts.belts as Readonly<{lineId:string}>[]).map(belt=>belt.lineId));
 if(machineIds.size!==state.machines.length||state.machines.some(machine=>!machineIds.has(machine.machineInstanceId))
  ||beltIds.size!==state.belts.length||state.belts.some(belt=>!beltIds.has(belt.lineId)))throw Error("DryReplayCheckpointMismatch");
 const canonicalText=(value:unknown):string=>{
  if(typeof value!=="string"||value.length===0||value.length>16*1024*1024)throw Error("InvalidDryCheckpointBytes");
  const parsed=JSON.parse(value);if(uncachedCanonicalJson(parsed)!==value)throw Error("InvalidDryCheckpointBytes");return value;
 };
 canonicalText(lastStep.inputMaterialBytes);const materialBytes=canonicalText(lastStep.materialBytes);
 if(typeof historicalMaterialBytes!=="string"||materialBytes!==historicalMaterialBytes)throw Error("DryReplayCheckpointMismatch");
 if(isImmutableData(state))trustedFactoryDryOwners.add(state);
};
/** Imports only a fully validated V1 owner. The optional admission runs before its one required replay parse. */
export const importDryFactoryStateV1=(state:DryFactoryState,material:MaterialView,installations:readonly FactoryInstallation[],historicalMaterialBytes:string|null,
 nativeOwners:readonly Readonly<{instanceId:string;installationRevision:number}>[],admit:DryFactoryV1ImportAdmission):DryFactoryOwnerState=>{
 if(typeof admit!=="function")throw Error("Factory Owner import admission required");
 const replay=validateDryFactoryCheckpointStateInternal(state,material,installations,historicalMaterialBytes,nativeOwners,admit);
 const {lastStep,...core}=state;
 if(!lastStep)admit({core,replay:null});
 const ownerReplay=replay&&lastStep?freeze({version:"fp06-dry-replay-segments-v2" as const,facts:replay.facts,inputMaterialBytes:replay.inputMaterialBytes,materialBytes:lastStep.materialBytes}):null;
 const owner=freeze({...core,lastStep:ownerReplay}) as DryFactoryOwnerState;if(isImmutableData(owner))trustedFactoryDryOwners.add(owner);return owner;
};
/** Rebuilds the exact historical V1 receipt strings only at a V1 boundary. */
export const materializeDryFactoryStateV1=(state:DryFactoryOwnerState,admit:DryFactoryV1MaterializeAdmission):DryFactoryState=>{
 const {lastStep,...core}=state;admit({core,replay:lastStep});
 const legacyReceipt=lastStep?{
  inputBytes:uncachedCanonicalJson({facts:lastStep.facts,materialBytes:lastStep.inputMaterialBytes}),
  factsBytes:uncachedCanonicalJson(lastStep.facts),nextStateBytes:uncachedCanonicalJson(core),materialBytes:lastStep.materialBytes
 }:null;
 return freeze({...core,lastStep:legacyReceipt});
};
export interface DryFactoryStepInput {
  readonly confirmed: boolean; readonly binding: FactoryPowerBinding; readonly tickStartUs: string; readonly tickEndUs: string;
  readonly material: MaterialView; readonly supply: FactoryPowerSupply;
  readonly machines: readonly Readonly<{ instanceId: string; facts: ProductionHostFacts; command?: ProductionCommand }>[];
  readonly belts: readonly Readonly<{ lineId: string; actorId: string; sourceLot: BeltStepInput["sourceLot"]; enabled: boolean }>[];
}
export type DryFactoryProposal = Readonly<{ status: "Prepared"; baseStateBytes: string; inputBytes: string; materialBaseBytes: string;
  state: DryFactoryState; material: MaterialView; power: FactoryPowerSuccess }> | Readonly<{ status: "Rejected"; reason: string }>;
const dryCore=(state:DryFactoryRuntimeState):DryFactoryCore=>{const {lastStep:_receipt,...core}=state;return core;};
const dryStateBytes = (state: DryFactoryState): string => {
 const cached=stateBytes.get(state);if(cached!==undefined)return cached;
 const {lastStep:_receipt,...core}=state,bytes=canonicalJson(Object.freeze(core));
 if(isImmutableData(state))stateBytes.set(state,bytes);return bytes;
};
const dryInputBytes = (input: DryFactoryStepInput): string => {const {material,...facts}=input;return canonicalJson({facts,materialBytes:factoryMaterialBytes(material)});};
const dryFactsBytes = (input: DryFactoryStepInput): string => {const {material:_material,...facts}=input;return canonicalJson(facts);};
type DryFactoryTransition=Readonly<{state:DryFactoryCore;material:MaterialView;power:FactoryPowerSuccess}>;
/** The one paid production/power/belt transition, shared by legacy and compact owners. */
const evaluateDryFactoryTransition=(state:DryFactoryRuntimeState,input:DryFactoryStepInput,beltCapability?:FactoryBeltMaterialFragmentContext):DryFactoryTransition=>{
 if(!input.confirmed||canonicalJson(input.binding)!==canonicalJson(state.binding)||input.tickStartUs!==state.tickEndUs
  ||!/^(0|[1-9][0-9]{0,18})$/.test(input.tickStartUs)||!/^(0|[1-9][0-9]{0,18})$/.test(input.tickEndUs)
  ||BigInt(input.tickEndUs)-BigInt(input.tickStartUs)!==100000n)throw Error("UnconfirmedOrStaleDryInterval");
 validateDryMaterial(input.material);
 if(input.machines.length!==state.machines.length||input.belts.length!==state.belts.length||state.machines.length+state.belts.length>16)throw Error("DryDomainMembershipMismatch");
 const machineFacts=new Map(input.machines.map(m=>[m.instanceId,m])),beltFacts=new Map(input.belts.map(b=>[b.lineId,b]));
 if(machineFacts.size!==input.machines.length||beltFacts.size!==input.belts.length)throw Error("DuplicateDryDomainMember");
 const requests:FactoryPowerRequest[]=[];
 for(const machine of state.machines){
  const facts=machineFacts.get(machine.machineInstanceId);if(!facts)throw Error("DryMachineFactsMissing");
  if(facts.facts.installation.definitionRef.sourceId!=="B05")requests.push(readFactoryProductionRequest(machine,{confirmed:true,binding:input.binding,
   tickStartUs:input.tickStartUs,tickEndUs:input.tickEndUs,material:input.material,facts:facts.facts,...(facts.command?{command:facts.command}:{})}));
 }
 for(const belt of state.belts){const facts=beltFacts.get(belt.lineId);if(!facts)throw Error("DryBeltFactsMissing");
  const installed=belt.installation;requests.push({consumerId:installed.consumerId,deviceInstanceId:installed.driveInstanceId,jobId:installed.jobId,
   portId:installed.powerPortId,priority:"P2",requiredMilliWatt:"100000",enabled:facts.enabled});}
 const power=stepFactoryPower(state.power,{confirmed:true,binding:input.binding,tickStartUs:input.tickStartUs,tickEndUs:input.tickEndUs,supply:input.supply,requests});
 if(!power.ok)throw Error(power.reason);
 let material=input.material;const machines:ProductionState[]=[],belts:BeltState[]=[];
 for(const machine of [...state.machines].sort((a,b)=>a.machineInstanceId.localeCompare(b.machineInstanceId))){
  const facts=machineFacts.get(machine.machineInstanceId)!;
  const currentFacts={...facts.facts,interaction:facts.facts.interaction?{...facts.facts.interaction,accessibleContainers:facts.facts.interaction.accessibleContainers.map(c=>{
   const current=material.containers.find(v=>v.state.containerId===c.containerId);if(!current)throw Error("DryLocalContainerMissing");return {containerId:c.containerId,revision:current.state.revision};})}:null};
  const stepInput:ProductionStepInput={confirmed:true,binding:input.binding,tickStartUs:input.tickStartUs,tickEndUs:input.tickEndUs,material,facts:currentFacts,power,...(facts.command?{command:facts.command}:{})};
  if(beltCapability){Object.defineProperty(stepInput,"material",{enumerable:false});freeze(stepInput);}
  const proposed=beltCapability?stepFactoryProductionForDryRuntime(machine,stepInput):stepFactoryProduction(machine,stepInput);if(proposed.status!=="Prepared")throw Error(proposed.reason);
  if(beltCapability&&admittedMaterials.has(material)&&proposed.material===material&&isIssuedDryRuntimeProductionProposal(machine,stepInput,proposed)){
   material=proposed.material;machines.push(proposed.nextState);
  }else if(isImmutableData(proposed)){material=proposed.material;machines.push(proposed.nextState);}
  else {const committed=commitFactoryProductionStep(machine,stepInput,proposed);if(committed.status==="Rejected")throw Error(committed.reason);material=committed.material;machines.push(committed.state);}
 }
 for(const line of [...state.belts].sort((a,b)=>a.lineId.localeCompare(b.lineId))){
  const facts=beltFacts.get(line.lineId)!;
  const stepInput={confirmed:true,binding:input.binding,tickStartUs:input.tickStartUs,tickEndUs:input.tickEndUs,installation:line.installation,material,power,actorId:facts.actorId,
   sourceLot:facts.sourceLot};
  if(beltCapability){
   if(stepInput.sourceLot!==null)stepInput.sourceLot=Object.freeze({...stepInput.sourceLot});
   // structuredClone proves the private request root without copying its large current material tree.
   Object.defineProperty(stepInput,"material",{enumerable:false});
  }
  const proposed=beltCapability?advanceFactoryBeltWithMaterialAuthority(line,stepInput,beltCapability):advanceFactoryBelt(line,stepInput);if(proposed.status!=="Prepared")throw Error(proposed.reason);
  if(beltCapability&&admittedMaterials.has(material)&&isIssuedFactoryBeltNoMaterialProposal(line,stepInput,proposed))belts.push(proposed.nextLine);
  else if(proposed.materialPlan===null&&isImmutableData(proposed))belts.push(proposed.nextLine);
  else {const committed=commitFactoryBeltStep(line,stepInput,proposed);if(committed.status==="Rejected")throw Error(committed.reason);material=committed.material;belts.push(committed.line);}
 }
 const next=freeze({...dryCore(state),revision:state.revision+1,tickEndUs:input.tickEndUs,power:power.nextState,machines,belts});
 if(!Number.isSafeInteger(next.revision)||readMaterialMassMg(material)!==readMaterialMassMg(input.material))throw Error("DryMassOrRevisionMismatch");
 return {state:next,material,power};
};
export const prepareDryFactoryStep = (state: DryFactoryState, input: DryFactoryStepInput): DryFactoryProposal => {
 try{
  const {state:next,material,power}=evaluateDryFactoryTransition(state,input),inputBytes=dryInputBytes(input),nextStateBytes=canonicalJson(Object.freeze(next)),materialBytes=factoryMaterialBytes(material);
  const proposal=freeze({status:"Prepared" as const,baseStateBytes:dryStateBytes(state),inputBytes,materialBaseBytes:factoryMaterialBytes(input.material),
   state:{...next,lastStep:{inputBytes,factsBytes:dryFactsBytes(input),nextStateBytes,materialBytes}},material,power});
  if(isImmutableData(state)&&isImmutableData(input.material)&&isImmutableData(proposal)&&dataOnly(input)){
   stateBytes.set(proposal.state,nextStateBytes);stateBytesAliasLastStepNextState.add(proposal.state);preparedTransitions.set(proposal,{base:state,material:input.material});
  }
  return proposal;
 }catch(error){return {status:"Rejected",reason:error instanceof Error?error.message:"DryStepRejected"};}
};
const readDryInputFacts=(input:DryFactoryStepInput):DryFactoryReplayV2["facts"]=>{
 if(!input||typeof input!=="object"||(Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null))throw Error("InvalidDryInputData");
 const descriptors=Object.getOwnPropertyDescriptors(input),facts:Record<string,unknown>={};
 if(Reflect.ownKeys(descriptors).some(key=>typeof key!=="string"))throw Error("InvalidDryInputData");
 for(const key of Object.keys(descriptors)){
  const descriptor=descriptors[key]!;if(!descriptor.enumerable||!("value" in descriptor))throw Error("InvalidDryInputData");
  if(key!=="material")Object.defineProperty(facts,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
 }
 if(!Object.hasOwn(descriptors,"material")||!("value" in descriptors.material!)||!dataOnlyShape(facts))throw Error("InvalidDryInputData");
 return facts as DryFactoryReplayV2["facts"];
};
const ownerFacts=(input:DryFactoryStepInput):DryFactoryReplayV2["facts"]=>{
 const facts=readDryInputFacts(input);
 if(!ownerDataShape(facts)||typeof globalThis.structuredClone!=="function")throw Error("InvalidDryInputData");
 return freeze(globalThis.structuredClone(facts)) as DryFactoryReplayV2["facts"];
};
const sameDataTree=(left:unknown,right:unknown):boolean=>{
 if(Object.is(left,right))return true;
 if(!left||!right||typeof left!=="object"||typeof right!=="object"||Array.isArray(left)!==Array.isArray(right))return false;
 const leftKeys=Object.keys(left),rightKeys=Object.keys(right);
 return leftKeys.length===rightKeys.length&&leftKeys.every(key=>Object.hasOwn(right,key)
  &&sameDataTree((left as Record<string,unknown>)[key],(right as Record<string,unknown>)[key]));
};
const ownerFactsMatch=(input:DryFactoryStepInput,facts:DryFactoryReplayV2["facts"]):boolean=>{
 let current:DryFactoryReplayV2["facts"];try{current=readDryInputFacts(input);if(!ownerDataShape(current)||!dataOnly(current))return false;}catch{return false;}
 return sameDataTree(current,facts);
};
const prepareFactoryDryOwnerStepInternal=(state:DryFactoryOwnerState,input:DryFactoryStepInput,beltCapability?:FactoryBeltMaterialFragmentContext):DryFactoryOwnerProposal=>{
 try{
  const facts=ownerFacts(input),{state:next,material,power}=evaluateDryFactoryTransition(state,input,beltCapability),inputMaterialBytes=factoryMaterialBytes(input.material),materialBytes=factoryMaterialBytes(material);
  const ownerState=freeze({...next,lastStep:freeze({version:"fp06-dry-replay-segments-v2" as const,facts,inputMaterialBytes,materialBytes})}) as DryFactoryOwnerState;
  const proposal=freeze({status:"Prepared" as const,state:ownerState,material,power});
  if(trustedFactoryDryOwners.has(state)&&admittedMaterials.has(input.material)){trustedFactoryDryOwners.add(ownerState);preparedOwnerTransitions.set(proposal,{base:state,inputMaterial:input.material,resultMaterial:material,facts});}
  return proposal;
 }catch(error){return {status:"Rejected",reason:error instanceof Error?error.message:"DryStepRejected"};}
};
export const prepareFactoryDryOwnerStep=(state:DryFactoryOwnerState,input:DryFactoryStepInput):DryFactoryOwnerProposal=>
 prepareFactoryDryOwnerStepInternal(state,input);
export const prepareFactoryDryOwnerStepWithAuthority=(state:DryFactoryOwnerState,input:DryFactoryStepInput,authority:FactoryMaterialAuthority):DryFactoryOwnerProposal=>{
 const beltCapability=authority&&typeof authority==="object"?runtimeFactoryMaterialAuthorities.get(authority):undefined;
 if(!beltCapability||!trustedFactoryDryOwners.has(state))return {status:"Rejected",reason:"UntrustedFactoryMaterialAuthority"};
 return prepareFactoryDryOwnerStepInternal(state,input,beltCapability);
};
const dryOwnerReplayMatches=(state:DryFactoryOwnerState,input:DryFactoryStepInput,proposal:Extract<DryFactoryOwnerProposal,{status:"Prepared"}>):boolean=>{
 const saved=state.lastStep,candidate=proposal.state.lastStep;if(!saved||!candidate||candidate.version!==saved.version)return false;
 const facts=ownerFacts(input);
 return sameDataTree(facts,saved.facts)
  &&candidate.inputMaterialBytes===saved.inputMaterialBytes
  &&factoryMaterialBytes(input.material)===saved.materialBytes
  &&uncachedCanonicalJson(dryCore(state))===uncachedCanonicalJson(dryCore(proposal.state))
  &&factoryMaterialBytes(proposal.material)===saved.materialBytes
  &&uncachedCanonicalJson(candidate)===uncachedCanonicalJson(saved);
};
export const commitFactoryDryOwnerStep=(state:DryFactoryOwnerState,input:DryFactoryStepInput,proposal:DryFactoryOwnerProposal):
 Readonly<{status:"Committed"|"NoOp";state:DryFactoryOwnerState;material:MaterialView}>|Readonly<{status:"Rejected";reason:string}>=>{
 if(proposal.status!=="Prepared")return proposal;
 try{
  validateDryMaterial(input.material);validateDryMaterial(proposal.material);
  const own=preparedOwnerTransitions.get(proposal);
  if(!own){const {canonicalJson:bytes,digest,...power}=proposal.power;if(canonicalJson(power)!==bytes||canonicalSignature(power)!==digest)throw Error("InvalidDryPowerOutput");}
  if(own?.base===state&&own.inputMaterial===input.material&&ownerFactsMatch(input,own.facts))return {status:"Committed",state:proposal.state,material:proposal.material};
  if(own&&state===proposal.state&&input.material===own.resultMaterial&&ownerFactsMatch(input,own.facts))return {status:"NoOp",state,material:input.material};
  const potentialReplay=Boolean(state.lastStep&&proposal.state.lastStep&&state.revision===proposal.state.revision&&state.tickEndUs===proposal.state.tickEndUs);
  if(potentialReplay){if(dryOwnerReplayMatches(state,input,proposal))return {status:"NoOp",state,material:input.material};
   return {status:"Rejected",reason:"InvalidDryProposal"};}
  const checked=prepareFactoryDryOwnerStep(state,input);
  if(checked.status!=="Prepared"||uncachedCanonicalJson(checked.state)!==uncachedCanonicalJson(proposal.state)
    ||factoryMaterialBytes(checked.material)!==factoryMaterialBytes(proposal.material)
    ||productionMaterialCanonicalJson(checked.material)!==productionMaterialCanonicalJson(proposal.material)
    ||canonicalJson(checked.power)!==canonicalJson(proposal.power))return {status:"Rejected",reason:"InvalidDryProposal"};
  return {status:"Committed",state:checked.state,material:checked.material};
 }catch(error){return {status:"Rejected",reason:error instanceof Error?error.message:"InvalidDryProposal"};}
};
export const commitDryFactoryStep = (state:DryFactoryState,input:DryFactoryStepInput,proposal:DryFactoryProposal):
  Readonly<{status:"Committed"|"NoOp";state:DryFactoryState;material:MaterialView}>|Readonly<{status:"Rejected";reason:string}> => {
  if(proposal.status!=="Prepared")return proposal;
  try{
  validateDryMaterial(input.material);validateDryMaterial(proposal.material);
  if(!preparedTransitions.has(proposal)){
    const {canonicalJson:bytes,digest,...power}=proposal.power;
    if(canonicalJson(power)!==bytes||canonicalSignature(power)!==digest)throw Error("InvalidDryPowerOutput");
  }
  if(state.lastStep?.inputBytes===proposal.inputBytes&&state.lastStep.nextStateBytes===dryStateBytes(state)
    &&state.lastStep.factsBytes===dryFactsBytes(input)
    &&state.lastStep.materialBytes===factoryMaterialBytes(input.material)&&dryStateBytes(proposal.state)===dryStateBytes(state)
    &&canonicalJson(state.lastStep)===canonicalJson(proposal.state.lastStep))return {status:"NoOp",state,material:input.material};
  if(dryStateBytes(state)!==proposal.baseStateBytes||dryInputBytes(input)!==proposal.inputBytes||factoryMaterialBytes(input.material)!==proposal.materialBaseBytes)return {status:"Rejected",reason:"StaleDryStep"};
  const own=preparedTransitions.get(proposal);
  // This exact immutable proposal was fully validated above. Fresh complete
  // input bytes and the same immutable Native material/base still bind it.
  if(own?.base===state&&own.material===input.material&&dataOnly(input))return {status:"Committed",state:proposal.state,material:proposal.material};
  const checked=prepareDryFactoryStep(state,input);
  if(checked.status!=="Prepared"||dryStateBytes(checked.state)!==dryStateBytes(proposal.state)||factoryMaterialBytes(checked.material)!==factoryMaterialBytes(proposal.material)
    ||productionMaterialCanonicalJson(checked.material)!==productionMaterialCanonicalJson(proposal.material)
    ||canonicalJson(checked.state.lastStep)!==canonicalJson(proposal.state.lastStep)
    ||canonicalJson(checked.power)!==canonicalJson(proposal.power))return {status:"Rejected",reason:"InvalidDryProposal"};
  return {status:"Committed",state:checked.state,material:checked.material};
  }catch(error){return {status:"Rejected",reason:error instanceof Error?error.message:"InvalidDryProposal"};}
};

/** Private capability shared by construction, handling and the confirmed factory step. */
export interface FactoryMaterialAuthority {
  read(): MaterialView;
  adopt(expected: MaterialView, candidate: MaterialView): boolean;
}
export interface RuntimeFactoryMaterialAuthority extends FactoryMaterialAuthority {
  readBeltMaterialFragmentBytes():number;
  clearBeltMaterialFragment():void;
  disposeBeltMaterialFragment():void;
}
export const createFactoryMaterialAuthority = (initial: MaterialView): FactoryMaterialAuthority => {
  let current = initial;
  return Object.freeze({ read: () => current, adopt: (expected: MaterialView, candidate: MaterialView) => {
    if (factoryMaterialBytes(current) !== factoryMaterialBytes(expected)) return false;
    // Complete byte validation above already proves this same immutable material.
    if (candidate === current && isImmutableData(current)) return true;
    if (current.catalog.canonicalJson !== candidate.catalog.canonicalJson || readMaterialMassMg(current) !== readMaterialMassMg(candidate)) return false;
    // Exercise the existing complete Resources/reservation/receipt validation without publishing its hypothetical empty command.
    const ids = new Set(candidate.receipts.map(r => r.transactionId)); let ordinal = 0;
    while (ids.has(`authority_validation_${ordinal}`)) ordinal++;
    const checked = prepareFactoryMaterialStep(candidate, { kind: "transfer", transactionId: `authority_validation_${ordinal}`, ownerId: "factory_authority", moves: [] });
    if (checked.status !== "Prepared") return false;
    current = candidate; return true;
  } });
};
export const createRuntimeFactoryMaterialAuthority=(initial:MaterialView):RuntimeFactoryMaterialAuthority=>{
 const base=createFactoryMaterialAuthority(initial),beltFragment=createFactoryBeltMaterialFragmentContext(base.read);
 let authority:RuntimeFactoryMaterialAuthority;
 authority=Object.freeze({
  read:base.read,
  adopt:(expected:MaterialView,candidate:MaterialView)=>{
   try{
    const current=base.read(),accepted=base.adopt(expected,candidate);
    if(!accepted||candidate!==current)beltFragment.clear();
    return accepted;
   }catch(error){beltFragment.clear();throw error;}
  },
  readBeltMaterialFragmentBytes:()=>beltFragment.readBytes(),
  clearBeltMaterialFragment:()=>beltFragment.clear(),
  disposeBeltMaterialFragment:()=>beltFragment.dispose()
 });
 runtimeFactoryMaterialAuthorities.set(authority,beltFragment);
 return authority;
};
export interface FactoryCommandHistory {
  readReceipt(commandId: string): FactoryUiReceipt | undefined;
  readAll(): readonly FactoryUiReceipt[];
  replay(command: FactoryUiCommand): FactoryUiResult | undefined;
  accept(command: FactoryUiCommand, receipt: FactoryUiReceipt): void;
}
const freeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const createFactoryCommandHistory = (initialReceipts: readonly FactoryUiReceipt[] = []): FactoryCommandHistory => {
  const receipts = new Map<string, FactoryUiReceipt>();
  for (const receipt of initialReceipts) {
    if (receipts.has(receipt.commandId)) throw new Error("DuplicateFactoryCommandReceipt");
    receipts.set(receipt.commandId, receipt);
  }
  return Object.freeze({ readReceipt: (id: string) => receipts.get(id), readAll: () => Object.freeze([...receipts.values()]), replay: (command: FactoryUiCommand) => {
    const old = receipts.get(command.commandId); if (!old) return undefined;
    if (old.requestCanonicalJson !== canonicalJson(command)) return freeze({ status: "Rejected" as const,
      receipt: { ...old, status: "Rejected" as const, reason: "IdempotencyConflict" } });
    return Object.freeze({ status: old.status === "Committed" ? "NoOp" as const : old.status, receipt: old });
  }, accept: (command: FactoryUiCommand, receipt: FactoryUiReceipt) => {
    if (receipt.commandId !== command.commandId || receipt.requestCanonicalJson !== canonicalJson(command)) throw new Error("InvalidCommandReceiptBinding");
    const old = receipts.get(command.commandId);
    if (old && old.requestCanonicalJson !== receipt.requestCanonicalJson) throw new Error("IdempotencyConflict");
    if (!old) receipts.set(command.commandId, freeze(JSON.parse(canonicalJson(receipt)) as FactoryUiReceipt));
  } });
};

/** Lossless UTF-16-unit encoding; Native and UI retain the original ID. W10 must rederive this binding. */
export const bindFactoryDomainSession = (rawNativeSessionId: string) => {
  if(typeof rawNativeSessionId!=="string"||rawNativeSessionId.length===0||rawNativeSessionId.length>37)throw Error("InvalidNativeSessionBinding");
  let hex="";for(let i=0;i<rawNativeSessionId.length;i++)hex+=rawNativeSessionId.charCodeAt(i).toString(16).padStart(4,"0");
  // Length preserves leading zero UTF-16 units. Base32 uses only save-safe lowercase alphanumerics.
  const domainSessionId=`fs_${rawNativeSessionId.length.toString(36)}_${BigInt(`0x${hex}`).toString(32)}`;
  if(domainSessionId.length>128)throw Error("InvalidNativeSessionBinding");
  return Object.freeze({version:"fp06-native-session-binding-v2" as const,rawNativeSessionId,domainSessionId});
};
