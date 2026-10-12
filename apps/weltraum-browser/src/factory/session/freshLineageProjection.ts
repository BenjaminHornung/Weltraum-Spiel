import type {MaterialIntent,MaterialMove,MaterialReservation,MaterialView} from "../material/reservations";
import type {ProductionState,ProductionCommandReceipt} from "../production/productionStep";
import {productionMaterialCanonicalJson,type ProductionStart} from "../production/recipeAdmission";
import type {FactoryInstallation} from "../construction/placement";
import {createFactoryInstallationProfile,transformFactoryBounds} from "../construction/installationProfile";
import type {FactoryFacilityRead} from "../../hestia-prototype/physics/factoryFacilitySession";
import type {FactoryProductionGoalFacts} from "../ui/onboarding";
import type {FactoryRecipe} from "../contracts";
import type {ResourceStack} from "../../resources/types";
import {canonicalJson,canonicalSignature} from "../../resources/serialization";
import {isSaveSafeResourceId} from "../../resources/ids";
import {validateFactoryAmount} from "../material/quantity";

export interface FactoryProductionGoalInput {
 readonly initialMaterial:MaterialView;
 readonly material:MaterialView;
 readonly machines:readonly Pick<ProductionState,"machineInstanceId"|"commandReceipts">[];
 readonly installations:readonly FactoryInstallation[];
 readonly native:FactoryFacilityRead;
 readonly binding:Readonly<{catalogDigest:string;terrainRevision:number;facilityRevision:number;confirmed:boolean}>;
}
const requireFact=(value:unknown):void=>{if(!value)throw Error("UnconfirmedProductionLineage");};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const parse=<T>(bytes:string):T=>{const value:unknown=JSON.parse(bytes);requireFact(canonicalJson(value)===bytes);return value as T;};
const id=(value:string)=>requireFact(isSaveSafeResourceId(value));
const whole=(value:number)=>requireFact(Number.isSafeInteger(value)&&value>=0);
const key=(containerId:string,stackId:string)=>canonicalJson([containerId,stackId]);
const metadata=(stack:ResourceStack)=>{const {stackId:_id,quantity:_quantity,...data}=stack;return data;};
interface Lot {stack:ResourceStack;origin:string|null;producer:string|null;}
interface Job {
 start:ProductionStart;recipe:FactoryRecipe;begin:ProductionCommandReceipt;
 finish:ProductionCommandReceipt|null;inputs:readonly Lot[];completed:boolean;
}
interface Reservation {intent:Extract<MaterialIntent,{kind:"reserve"}>;job:Job;read:MaterialReservation;}
const recipes=new Map([["REC-01-CUT","B06"],["REC-02-PROFILE","B07"],["REC-03-SHEET","B07"],["REC-05-BRACE","B05"]]);

/** Reads the actual retained baseline and adopted receipts. Local lot
 * descriptors exist only during this call; no commands, material owner,
 * progression clock, inventory, or World observations are constructed.
 * The private Host must supply current confirmed Native/owner DTOs. */
export const projectFactoryProductionGoals=(input:FactoryProductionGoalInput):FactoryProductionGoalFacts|null=>{
 try {
  const {initialMaterial:initial,material,native,binding}=input,catalog=material.catalog;
  productionMaterialCanonicalJson(initial);productionMaterialCanonicalJson(material);
  requireFact(binding.confirmed&&binding.catalogDigest===catalog.catalogDigest&&same(initial.catalog,catalog));
  whole(binding.terrainRevision);whole(binding.facilityRevision);
  requireFact(native.state==="Idle"&&native.transactionId===null&&native.prepared===null&&native.revision===binding.facilityRevision);
  const owners=new Map(native.owners.map(o=>[o.instanceId,o])),installations=new Map(input.installations.map(i=>[i.instanceId,i]));
  requireFact(owners.size===native.owners.length&&installations.size===input.installations.length);
  const rows=native.production??[],rowIds=new Set<string>();
  for(const row of rows){
   const owner=owners.get(row.instanceId);requireFact(!rowIds.has(row.instanceId));rowIds.add(row.instanceId);
   requireFact(owner&&row.terrainRevision===binding.terrainRevision&&row.facilityRevision===binding.facilityRevision
    &&row.installationRevision===owner.installationRevision&&row.profileDigest===owner.profileDigest&&row.sourceDigest===owner.sourceDigest);
  }
  const jobs=new Map<string,Job>(),commandIds=new Set<string>(),machineIds=new Set<string>();
  for(const machine of input.machines){
   id(machine.machineInstanceId);requireFact(!machineIds.has(machine.machineInstanceId));machineIds.add(machine.machineInstanceId);
   const installation=installations.get(machine.machineInstanceId),owner=owners.get(machine.machineInstanceId),row=rows.find(r=>r.instanceId===machine.machineInstanceId);
   requireFact(installation&&owner&&row?.confirmed);
   const profile=createFactoryInstallationProfile(installation!.definitionSourceId);
   requireFact(owner!.ownerId===installation!.instanceId&&same(owner!.definitionRef,profile.definitionRef)&&owner!.sourceDigest===profile.sourceDigest&&owner!.profileDigest===profile.profileDigest
    &&owner!.massMg===profile.massMg&&installation!.massMg===profile.massMg&&installation!.sourceDigest===profile.sourceDigest&&installation!.profileDigest===profile.profileDigest&&same(owner!.centerMm,installation!.centerMm)&&owner!.quarterTurns===installation!.quarterTurns);
   let previousTick=0n;const manualWork=new Set<string>();
   for(const receipt of machine.commandReceipts){
    id(receipt.commandId);id(receipt.jobId);requireFact(!commandIds.has(receipt.commandId));commandIds.add(receipt.commandId);
    const command=parse<Record<string,unknown>>(receipt.commandCanonicalJson);
    requireFact(command.kind===receipt.kind&&command.jobId===receipt.jobId&&/^(0|[1-9][0-9]*)$/.test(receipt.tickEndUs));
    const tick=BigInt(receipt.tickEndUs);requireFact(tick>=previousTick&&tick%100000n===0n);previousTick=tick;
    if(receipt.kind==="start"){
     const start=command as unknown as ProductionStart,recipe=catalog.recipes.find(r=>r.sourceId===start.recipeRef.sourceId);
     requireFact(command.commandId===receipt.commandId&&!jobs.has(receipt.jobId)&&recipe&&recipes.get(recipe.sourceId)===installation!.definitionSourceId
      &&same(start.recipeRef,{sourceId:recipe.sourceId,version:recipe.version,digest:recipe.digest})&&start.processKind===(recipe.sourceId==="REC-05-BRACE"?"manual":"electric")
      &&receipt.materialTransactionId===`${start.jobId}_reserve`);
     id(start.ownerId);id(start.actorId);
     jobs.set(start.jobId,{start,recipe:recipe!,begin:receipt,finish:null,inputs:[],completed:false});
    }else{
     const job=jobs.get(receipt.jobId);requireFact(job&&!job.finish&&machine.commandReceipts.some(r=>r===job.begin));
     if(receipt.kind==="electric-finish"){
      const process=job!.recipe.processes.find(p=>p.kind==="electric"&&p.availability==="first-dry-loop");
      requireFact(job!.start.processKind==="electric"&&process&&receipt.commandId===`${job!.start.jobId}_finish`
       &&command.reservationId===`${job!.start.jobId}_reservation`&&same(command.recipeRef,job!.start.recipeRef)&&command.workMilliJoule===String(BigInt(process!.workJ)*1000n)
       &&tick-BigInt(job!.begin.tickEndUs)>=BigInt(process!.durationMs!)*1000n-100000n);
     }else{
      requireFact(job!.start.processKind==="manual"&&command.commandId===receipt.commandId&&command.actorId===job!.start.actorId&&tick>BigInt(job!.begin.tickEndUs));
      if(receipt.kind==="manual-work"){
       requireFact(receipt.materialTransactionId===null&&!manualWork.has(receipt.jobId));manualWork.add(receipt.jobId);continue;
      }
      requireFact(receipt.kind==="manual-finish"&&manualWork.has(receipt.jobId));
      const work=machine.commandReceipts.find(r=>r.kind==="manual-work"&&r.jobId===receipt.jobId)!;
      requireFact(tick>BigInt(work.tickEndUs));
     }
     requireFact(receipt.materialTransactionId===`${job!.start.jobId}_finish`);job!.finish=receipt;
    }
   }
  }
  requireFact(initial.reservations.length===0);whole(initial.revision);whole(material.revision);
  requireFact(material.revision>=initial.revision&&same(initial.receipts,material.receipts.slice(0,initial.receipts.length)));
  const lots=new Map<string,Lot>(),reservations=new Map<string,Reservation>();
  const payments:{transactionId:string;containerId:string;stackId:string;producer:string|null}[]=[];
  for(const c of initial.containers)for(const stack of c.state.contents){
   const source=stack.extensions["factory.source"] as {cargoId?:string;itemId?:string;definitionVersion?:number;definitionDigest?:string;sourceEventId?:string;instanceId?:string}|undefined;
   let origin:string|null=null;
   if(stack.resourceId==="fp02_bulk_steel_known"){
    const item=catalog.items.find(i=>i.sourceId==="fp02.bulk.steel_known")!;
    requireFact(source?.cargoId==="C10"&&source.itemId===item.sourceId&&source.definitionVersion===item.version&&source.definitionDigest===item.digest
     &&source.instanceId===stack.stackId&&typeof source.sourceEventId==="string"&&source.sourceEventId.length>0);
    origin=canonicalJson([c.state.containerId,stack.stackId,source]);
   }
   lots.set(key(c.state.containerId,stack.stackId),{stack,origin,producer:null});
  }
  const move=(m:MaterialMove,partition?:Readonly<{parentStackId:string;childStackId:string;transactionId:string}>)=>{
   id(m.sourceContainerId);id(m.targetContainerId);id(m.sourceStackId);id(m.targetStackId);
   const amount=validateFactoryAmount(m.itemId,m.quantityUnits,catalog),from=key(m.sourceContainerId,m.sourceStackId),to=key(m.targetContainerId,m.targetStackId),lot=lots.get(from);
   requireFact(lot&&m.sourceContainerId!==m.targetContainerId&&lot.stack.resourceId===amount.resourceId&&lot.stack.quantity>=m.quantityUnits);
   const original=lot!,stack={...original.stack,stackId:m.targetStackId as ResourceStack["stackId"],quantity:m.quantityUnits,
    extensions:partition?{...original.stack.extensions,"factory.partition":partition}:original.stack.extensions};
   requireFact(m.sourceStackId!==m.targetStackId||m.quantityUnits===original.stack.quantity);
   if(m.quantityUnits===original.stack.quantity)lots.delete(from);else lots.set(from,{...original,stack:{...original.stack,quantity:original.stack.quantity-m.quantityUnits}});
   const target=lots.get(to);
   if(target){requireFact(same(metadata(target.stack),metadata(stack))&&target.origin===original.origin&&target.producer===original.producer);const quantity=target.stack.quantity+m.quantityUnits;whole(quantity);lots.set(to,{...target,stack:{...target.stack,quantity}});}
   else {requireFact(![...lots.values()].some(l=>l.stack.stackId===m.targetStackId));lots.set(to,{stack,origin:original.origin,producer:original.producer});}
   return original;
  };
  let revision=0;const transactions=new Set<string>();
  for(const receipt of material.receipts){
   const intent=parse<MaterialIntent>(receipt.requestCanonicalJson);id(receipt.transactionId);id(receipt.ownerId);
   requireFact(!transactions.has(receipt.transactionId)&&intent.transactionId===receipt.transactionId&&intent.ownerId===receipt.ownerId&&receipt.revisionBefore===revision&&receipt.revisionAfter===revision+1);transactions.add(receipt.transactionId);revision++;
   if(revision<=initial.revision)continue;
   switch(intent.kind){
    case "transfer":for(const m of intent.moves){const moved=move(m);payments.push({transactionId:receipt.transactionId,containerId:m.targetContainerId,stackId:m.targetStackId,producer:moved.producer});}break;
    case "split":{
     const parent=lots.get(key(intent.sourceContainerId,intent.sourceStackId));requireFact(parent&&intent.children.length>=2&&intent.children.reduce((n,c)=>n+c.quantityUnits,0)===parent.stack.quantity);
     const item=catalog.items.find(i=>i.resourceId===parent!.stack.resourceId)!;requireFact(item.quantityBasis!=="piece"&&!parent!.stack.sealed);
     for(const child of intent.children)move({sourceContainerId:intent.sourceContainerId,sourceStackId:intent.sourceStackId,targetContainerId:child.targetContainerId,targetStackId:child.stackId,itemId:item.sourceId,quantityUnits:child.quantityUnits},{parentStackId:intent.sourceStackId,childStackId:child.stackId,transactionId:intent.transactionId});break;
    }
    case "reserve":{
     const job=[...jobs.values()].find(j=>intent.transactionId===j.begin.materialTransactionId);requireFact(job&&same(intent.recipeRef,job.start.recipeRef)&&intent.reservationId===`${job.start.jobId}_reservation`&&intent.ownerId===job.start.ownerId&&intent.actorId===job.start.actorId&&intent.missionId===job.start.missionId);
     const recipe=job!.recipe;
     requireFact(intent.moves.length===recipe.inputs.length&&job!.start.sourceLots.length===recipe.inputs.length&&intent.outputs.length===recipe.outputs.length&&!reservations.has(intent.reservationId)
      &&![...lots.keys()].some(k=>JSON.parse(k)[0]===intent.wipContainerId));
     for(const [i,term] of recipe.inputs.entries()){
      const m=intent.moves[i]!,source=job!.start.sourceLots.find(s=>s.itemId===term.itemId);
      requireFact(source&&m.itemId===term.itemId&&m.quantityUnits===term.quantityUnits&&m.sourceContainerId===source.containerId&&m.sourceStackId===source.stackId&&m.targetContainerId===intent.wipContainerId&&m.targetStackId===`${job!.start.jobId}_input_${i}`);move(m);
     }
     for(const [i,term] of recipe.outputs.entries())requireFact(intent.outputs[i]!.itemId===term.itemId&&intent.outputs[i]!.quantityUnits===term.quantityUnits&&intent.outputs[i]!.stackId===`${job!.start.jobId}_output_${i}`);
     const read:MaterialReservation={reservationId:intent.reservationId,ownerId:intent.ownerId,wipContainerId:intent.wipContainerId,recipeRef:intent.recipeRef!,recipeCanonicalJson:canonicalJson(recipe),outputs:intent.outputs};
     reservations.set(intent.reservationId,{intent,job:job!,read});break;
    }
    case "finish-recipe":{
     const reservation=reservations.get(intent.reservationId);requireFact(reservation&&reservation.job.finish&&intent.transactionId===reservation.job.finish.materialTransactionId&&intent.ownerId===reservation.intent.ownerId&&intent.actorId===reservation.intent.actorId&&intent.missionId===reservation.intent.missionId);
     const {job,intent:reserve}=reservation!,inputs=[...lots.entries()].filter(([k])=>JSON.parse(k)[0]===reserve.wipContainerId).map(([,l])=>l).sort((a,b)=>a.stack.stackId<b.stack.stackId?-1:1),first=inputs[0]!;
     requireFact(inputs.length===job.recipe.inputs.length&&!job.completed);
     requireFact(inputs.every(l=>l.stack.ownerId===first.stack.ownerId&&l.stack.missionId===first.stack.missionId&&l.stack.legalStatus===first.stack.legalStatus&&l.stack.grade===first.stack.grade&&l.stack.condition===first.stack.condition));
     for(const [i,term] of job.recipe.inputs.entries())requireFact(inputs[i]!.stack.resourceId===validateFactoryAmount(term.itemId,term.quantityUnits,catalog).resourceId&&inputs[i]!.stack.quantity===term.quantityUnits);
     job.inputs=inputs;job.completed=true;
     for(const [k] of lots)if(JSON.parse(k)[0]===reserve.wipContainerId)lots.delete(k);
     for(const output of reserve.outputs){
      const amount=validateFactoryAmount(output.itemId,output.quantityUnits,catalog),stack:ResourceStack={...first.stack,stackId:output.stackId as ResourceStack["stackId"],resourceId:amount.resourceId as ResourceStack["resourceId"],quantity:output.quantityUnits,sealed:false,
       extensions:{"factory.production":{recipeRef:{...reserve.recipeRef!},sourceLots:inputs.map(l=>({stackId:l.stack.stackId,resourceId:l.stack.resourceId,quantityUnits:l.stack.quantity,extensions:l.stack.extensions}))},...(amount.quantityBasis==="piece"?{"factory.instance":{instanceId:output.stackId}}:{})}};
      requireFact(![...lots.values()].some(l=>l.stack.stackId===output.stackId));lots.set(key(output.targetContainerId,output.stackId),{stack,origin:null,producer:job.start.jobId});
     }
     reservations.delete(intent.reservationId);break;
    }
    case "release":{
     const reservation=reservations.get(intent.reservationId);requireFact(reservation&&reservation.intent.ownerId===intent.ownerId&&![...lots.keys()].some(k=>JSON.parse(k)[0]===reservation.intent.wipContainerId));reservations.delete(intent.reservationId);break;
    }
    default:requireFact(false);
   }
  }
  requireFact(revision===material.revision&&same([...reservations.values()].map(r=>r.read),material.reservations));
  const current=material.containers.flatMap(c=>c.state.contents.map(stack=>[key(c.state.containerId,stack.stackId),stack] as const));
  requireFact(lots.size===current.length&&current.every(([k,stack])=>same(lots.get(k)?.stack,stack))&&[...jobs.values()].every(j=>transactions.has(j.begin.materialTransactionId!)&&Boolean(j.finish)===j.completed));
  const finished=[...jobs.values()].filter(j=>j.completed),cuts=finished.filter(j=>j.recipe.sourceId==="REC-01-CUT"&&j.inputs.length===1&&j.inputs[0]!.origin&&j.inputs[0]!.producer===null);
  const parent=(job:Job,recipeId:string)=>job.inputs.map(l=>l.producer?jobs.get(l.producer):undefined).find(j=>j?.recipe.sourceId===recipeId);
  const candidates:{pair:readonly Job[];profile:Job|undefined;sheet:Job|undefined;brace:Job|undefined;score:number}[]=[];
  for(let a=0;a<cuts.length;a++)for(let b=a+1;b<cuts.length;b++){
   const pair=[cuts[a]!,cuts[b]!];if(pair[0]!.inputs[0]!.origin!==pair[1]!.inputs[0]!.origin)continue;
   const forms=(recipeId:string)=>finished.filter(j=>j.recipe.sourceId===recipeId&&j.inputs.length===1&&pair.includes(parent(j,"REC-01-CUT")!));
   const profiles=forms("REC-02-PROFILE"),sheets=forms("REC-03-SHEET");if(profiles.length>1||sheets.length>1)continue;
   const profile=profiles[0],sheet=sheets[0];if(profile&&sheet&&parent(profile,"REC-01-CUT")===parent(sheet,"REC-01-CUT"))continue;
   const braces=finished.filter(j=>j.recipe.sourceId==="REC-05-BRACE"&&profile&&sheet&&parent(j,"REC-02-PROFILE")===profile&&parent(j,"REC-03-SHEET")===sheet);
   if(braces.length>1)continue;const brace=braces[0];candidates.push({pair,profile,sheet,brace,score:brace?3:profile&&sheet?2:profile||sheet?1:0});
  }
  const score=Math.max(...candidates.map(c=>c.score)),selected=candidates.filter(c=>c.score===score);requireFact(selected.length===1);
  const {pair,profile,sheet,brace}=selected[0]!;
  let paid=false;
  if(brace)for(const installation of input.installations.filter(i=>i.definitionSourceId==="fp02.comp.small_brace")){
   const owner=owners.get(installation.instanceId),source=createFactoryInstallationProfile(installation.definitionSourceId);
   if(!owner||owner.ownerId!==installation.instanceId||!same(owner.definitionRef,source.definitionRef)||owner.sourceDigest!==source.sourceDigest||owner.profileDigest!==source.profileDigest||owner.massMg!==source.massMg
    ||installation.sourceDigest!==source.sourceDigest||installation.profileDigest!==source.profileDigest||installation.massMg!==source.massMg||installation.materialContainerId!==`installed_${installation.instanceId}`
    ||!same(owner.centerMm,installation.centerMm)||owner.quarterTurns!==installation.quarterTurns||!same(installation.boundsMm,transformFactoryBounds(source.boundsMm,installation.centerMm,installation.quarterTurns))
    ||!same(installation.serviceBoundsMm,transformFactoryBounds(source.serviceBoundsMm,installation.centerMm,installation.quarterTurns))||!Number.isSafeInteger(owner.installationRevision)||owner.installationRevision<1||owner.installationRevision>native.revision)continue;
   const paidLot=[...lots.entries()].find(([k,l])=>JSON.parse(k)[0]===installation.materialContainerId&&l.producer===brace.start.jobId&&l.stack.resourceId==="fp02_comp_small_brace"&&l.stack.quantity===1);
   if(!paidLot)continue;const lot=paidLot[1],unit=lot.stack.extensions["factory.instance"] as {instanceId?:string}|undefined;
   if(unit?.instanceId!==`${brace.start.jobId}_output_0`||!payments.some(p=>p.transactionId===owner.transactionId&&p.containerId===installation.materialContainerId&&p.stackId===lot.stack.stackId&&p.producer===brace.start.jobId))continue;
   const receipt=material.receipts.find(r=>r.transactionId===owner.transactionId);
   const bound=parse<{catalogBytes:string;revision:number;receipts:MaterialView["receipts"];containers:readonly {stateBytes:string}[]}>(owner.materialBinding);
   if(!receipt||bound.catalogBytes!==catalog.canonicalJson||bound.revision!==receipt.revisionAfter||!same(bound.receipts,material.receipts.slice(0,receipt.revisionAfter)))continue;
   const states=bound.containers.map(c=>parse<{containerId:string;contents:readonly ResourceStack[]}>(c.stateBytes));
   if(states.some(s=>s.containerId===installation.materialContainerId&&s.contents.length===1&&same(s.contents[0],lot.stack)))paid=true;
  }
  const outputMass=(job:Job|undefined,itemId:string)=>job?job.recipe.outputs.filter(t=>t.itemId===itemId).reduce((n,t)=>n+validateFactoryAmount(t.itemId,t.quantityUnits,catalog).massMg,0):0;
  return Object.freeze({lineageId:canonicalSignature({origin:pair[0]!.inputs[0]!.origin,jobs:pair.map(j=>j.start.jobId).sort()}),inputSteelMg:pair.reduce((n,j)=>n+j.recipe.inputs.reduce((m,t)=>m+validateFactoryAmount(t.itemId,t.quantityUnits,catalog).massMg,0),0),cutBatches:pair.length,
   cutOutputMg:pair.reduce((n,j)=>n+outputMass(j,"fp02.bulk.steel_semi"),0),cutOffcutMg:pair.reduce((n,j)=>n+outputMass(j,"fp02.bulk.steel_offcut"),0),profileOutputMg:outputMass(profile,"fp02.bulk.steel_profile"),sheetOutputMg:outputMass(sheet,"fp02.bulk.steel_sheet"),formerOffcutMg:outputMass(profile,"fp02.bulk.steel_offcut")+outputMass(sheet,"fp02.bulk.steel_offcut"),
   braceOutputMg:outputMass(brace,"fp02.comp.small_brace"),braceOffcutMg:outputMass(brace,"fp02.bulk.steel_offcut"),installedBraceMg:paid?outputMass(brace,"fp02.comp.small_brace"):0,paidBraceInstallation:paid});
 }catch{return null;}
};
