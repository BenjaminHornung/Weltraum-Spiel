import { commitFactoryMaterialStep, prepareFactoryMaterialStep, type MaterialView, type MaterialPlan } from "../material/reservations";
import { readCargoHandlingProfile, type CargoHandlingProfile } from "../construction/cargoHandlingProfile";
import { createResourceContainerDefinition,createResourceContainerState,createResourceContainerSnapshot } from "../../resources/containers";
import { factoryMaterialBytes } from "../construction/placement";
import type { FactoryUiCommand } from "./hostPort";
import type { FactoryCarrierRequest } from "../../hestia-prototype/physics/factoryFacilitySession";
import { canonicalJson } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import { hasCompatibleMetadata } from "../../resources/transfer";
export interface CargoHandlingLot { readonly containerId: string; readonly stackId: string; readonly quantityUnits: number }
export interface CargoHandlingIntent {
  readonly commandId: string; readonly ownerId: string; readonly actorId: string;
  readonly expectedMaterialRevision: number; readonly profileId: string; readonly carrierContainerId: string;
  readonly sourceLots: readonly CargoHandlingLot[];
}
export interface CargoHandlingPlan {
  readonly status: "Prepared"; readonly intent: CargoHandlingIntent; readonly profile: CargoHandlingProfile;
  readonly materialPlan: MaterialPlan;
}
/** Pure custody proposal. The Host separately binds fresh native source/reach and adopts material+native together. */
const freeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const prepareCargoHandling = (material: MaterialView, intent: CargoHandlingIntent): CargoHandlingPlan | Readonly<{ status: "Rejected"; reason: string }> => {
  const reject = (reason: string) => ({ status: "Rejected" as const, reason });
  try {
    if (![intent.commandId, intent.ownerId, intent.actorId, intent.carrierContainerId].every(isSaveSafeResourceId)) return reject("InvalidHandlingId");
    if (intent.expectedMaterialRevision !== material.revision) return reject("StaleMaterialRevision");
    const profile = readCargoHandlingProfile(material.catalog, intent.profileId);
    if (!profile) return reject("UnsupportedHandlingProfile");
    const carrier = material.containers.find(c => c.state.containerId === intent.carrierContainerId);
    if (!carrier || carrier.state.contents.length || material.reservations.some(r => r.wipContainerId === intent.carrierContainerId)) return reject("CarrierOccupied");
    if (!Array.isArray(intent.sourceLots) || !intent.sourceLots.length) return reject("MissingHandlingSource");
    const totals = new Map<string, number>();
    const identities = new Set<string>();
    const moves = intent.sourceLots.map((lot, index) => {
      const source = material.containers.find(c => c.state.containerId === lot.containerId), stack = source?.state.contents.find(s => s.stackId === lot.stackId);
      if (!source || !stack || source.state.containerId === intent.carrierContainerId || !Number.isSafeInteger(lot.quantityUnits) || lot.quantityUnits < 1 || lot.quantityUnits > stack.quantity) throw new Error("InvalidHandlingSource");
      if (source.state.ownerId !== intent.ownerId || stack.ownerId !== intent.ownerId) throw new Error("HandlingOwnerMismatch");
      const key = canonicalJson([lot.containerId, lot.stackId]); if (identities.has(key)) throw new Error("DuplicateHandlingSource"); identities.add(key);
      const item = material.catalog.items.find(i => i.resourceId === stack.resourceId); if (!item) throw new Error("UnknownHandlingItem");
      if (item.quantityBasis === "piece" && (lot.quantityUnits !== 1 || stack.quantity !== 1)) throw new Error("SerializedPieceCannotSplit");
      totals.set(item.sourceId, (totals.get(item.sourceId) ?? 0) + lot.quantityUnits);
      return { sourceContainerId: lot.containerId, sourceStackId: lot.stackId, targetContainerId: intent.carrierContainerId,
        targetStackId: lot.quantityUnits === stack.quantity ? stack.stackId : `${intent.commandId}_lot_${index}`, itemId: item.sourceId, quantityUnits: lot.quantityUnits };
    });
    const expected = [...profile.terms].map(t => [t.itemId, t.quantityUnits]).sort(), actual = [...totals].sort();
    if (canonicalJson(actual) !== canonicalJson(expected)) return reject("HandlingProfileTermsMismatch");
    const plan = prepareFactoryMaterialStep(material, { kind: "transfer", transactionId: intent.commandId, ownerId: intent.ownerId, actorId: intent.actorId, moves });
    if (plan.status !== "Prepared") return plan;
    return freeze({ status: "Prepared", intent: JSON.parse(canonicalJson(intent)) as CargoHandlingIntent, profile, materialPlan: plan });
  } catch (error) { return reject(error instanceof Error ? error.message : "InvalidHandlingRequest"); }
};

export interface FactoryHandlingHost {
  readonly materialAuthority: import("./dryFactorySlice").FactoryMaterialAuthority;
  readonly native: import("./hostPort").FactoryNativeHandlingPort;
  pause(): Promise<void>;
  current(): boolean;
}
export const createFactoryHandling = (host: FactoryHandlingHost) => {
  let phase:"Ready"|"Preparing"|"Finalizing"|"RecoveryHold"="Ready";
  const rejection=(reason:string)=>({status:"Rejected" as const,reason});
  const sourceAccess=(id:string,native:ReturnType<typeof host.native.read>)=>{
    if(id===native.cargo?.containerId)return native.cargo.opened&&native.cargo.accessible;
    if(id===native.carrier?.containerId)return native.carrier.phase==="Carrying"||native.carrier.accessible===true;
    return native.sources?.some(s=>s.containerId===id&&s.accessible)===true;
  };
  return {
    get busy():boolean{return phase!=="Ready";},get recovery():boolean{return phase==="RecoveryHold";},
    async submit(command:FactoryUiCommand):Promise<Readonly<{status:"Committed"|"Rejected"|"RecoveryHold";reason:string|null}>>{
      if(phase!=="Ready")return rejection("HandlingBusy");
      if(!host.current()||!isSaveSafeResourceId(command.commandId))return rejection("InvalidHandlingHost");
      const before=host.materialAuthority.read();let candidate=before,request:FactoryCarrierRequest|undefined,operation:"pickup"|"deposit"|"release"|undefined;
      let prepared=false,adopted=false,published=false;
      phase="Preparing";
      try{
        await host.pause();if(!host.current()||host.materialAuthority.read()!==before)throw Error("StaleHandlingAuthority");
        const native=host.native.read(),owner=before.containers.find(c=>c.state.containerId===native.cargo?.containerId)?.state.ownerId;
        if(native.state!=="Idle"||!owner||command.expected.materialRevision!==before.revision||command.expected.facilityRevision!==native.revision)throw Error("StaleHandlingBinding");
        if(command.kind==="pickup"){
          if(native.carrier)throw Error("CarrierOccupied");
          const profile=readCargoHandlingProfile(before.catalog,command.profileId);if(!profile)throw Error("UnsupportedHandlingProfile");
          const sourceIds=new Set(command.sourceLots.map(l=>l.containerId));if(sourceIds.size!==1)throw Error("HandlingRequiresOneLocalSource");
          const sourceId=command.sourceLots[0]?.containerId;if(!sourceId||!sourceAccess(sourceId,native))throw Error("HandlingSourceOutOfReach");
          for(const lot of command.sourceLots){const container=before.containers.find(c=>c.state.containerId===lot.containerId);if(container?.state.revision!==lot.containerRevision)throw Error("StaleHandlingSource");}
          const cid=`carrier_${command.commandId}`;
          const empty=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:cid,kind:"OutpostStorage",maxMassKg:profile.massMg/1000000,maxVolumeM3:profile.capacityMm3/1000000000,maxStackCount:200}),createResourceContainerState({containerId:cid,ownerId:owner,contents:[]},before.catalog.resources),before.catalog.resources);
          const augmented={...before,containers:[...before.containers,empty]};
          const plan=prepareCargoHandling(augmented,{commandId:command.commandId,ownerId:owner,actorId:"hvp_player",expectedMaterialRevision:before.revision,profileId:profile.profileId,carrierContainerId:cid,sourceLots:command.sourceLots});
          if(plan.status!=="Prepared")throw Error(plan.reason);const committed=commitFactoryMaterialStep(augmented,plan.materialPlan);if(committed.status!=="Committed")throw Error("HistoricalMaterialCannotAllocateNative");candidate=committed.view;
          const sourceInstanceId=native.sources?.find(s=>s.containerId===sourceId)?.instanceId;
          request={transactionId:command.commandId,ownerId:"factory_carrier",profileId:profile.profileId,profileDigest:profile.digest,expectedRevision:native.revision,expectedTerrainRevision:command.expected.terrainRevision,sourceContainerId:sourceId,...(sourceInstanceId?{sourceInstanceId}:{}),custodyContainerId:cid,materialBinding:factoryMaterialBytes(candidate)};operation="pickup";
        }else if(command.kind==="deposit"&&command.target.kind==="ground"){
          const c=native.carrier;if(!c||c.phase!=="Carrying"||command.handling.id!==c.ownerId||command.handling.revision!==native.revision)throw Error("StaleCarrier");
          request={transactionId:command.commandId,ownerId:c.ownerId,profileId:c.profileId,profileDigest:c.profileDigest,expectedRevision:native.revision,expectedTerrainRevision:command.expected.terrainRevision,sourceContainerId:c.containerId,materialBinding:factoryMaterialBytes(candidate)};operation="deposit";
        }else if(command.kind==="transfer"||command.kind==="return"||(command.kind==="deposit"&&command.target.kind==="container")){
          const c=native.carrier;let targetId:string,targetRevision:number,moves:import("../material/reservations").MaterialMove[];
          if(command.kind==="transfer"){
            targetId=command.target.id;targetRevision=command.target.revision;const source=before.containers.find(v=>v.state.containerId===command.source.containerId),stack=source?.state.contents.find(s=>s.stackId===command.source.stackId);
            if(!source||!stack||source.state.revision!==command.source.containerRevision||!sourceAccess(source.state.containerId,native))throw Error("StaleOrRemoteTransferSource");
            if(source.state.containerId===c?.containerId&&(source.state.contents.length!==1||command.source.quantityUnits!==stack.quantity))throw Error("PartialCarrierTransferUnsupported");
            const item=before.catalog.items.find(i=>i.resourceId===stack.resourceId);if(!item)throw Error("UnknownTransferItem");
            const targetSnapshot=before.containers.find(v=>v.state.containerId===targetId);
            // Milligram bulk lots may merge; pieces and cable-mm custody keep their existing IDs.
            const compatibleBulkStack=item.quantityBasis==="mg"?targetSnapshot?.state.contents.find(candidate=>hasCompatibleMetadata(candidate,stack)):undefined;
            const targetStackId=compatibleBulkStack?.stackId??(command.source.quantityUnits===stack.quantity?stack.stackId:`${command.commandId}_lot`);
            moves=[{sourceContainerId:source.state.containerId,sourceStackId:stack.stackId,itemId:item.sourceId,quantityUnits:command.source.quantityUnits,targetContainerId:targetId,targetStackId}];
          }else{
            if(!c||command.handling.id!==c.ownerId||command.handling.revision!==native.revision||!sourceAccess(c.containerId,native))throw Error("StaleCarrier");
            const target=command.kind==="return"?command.target:command.target.kind==="container"?command.target.container:null;if(!target)throw Error("UnsupportedDeposit");targetId=target.id;targetRevision=target.revision;
            const container=before.containers.find(v=>v.state.containerId===c.containerId);if(!container)throw Error("MissingCustody");
            moves=container.state.contents.map(stack=>({sourceContainerId:c.containerId,sourceStackId:stack.stackId,itemId:before.catalog.items.find(i=>i.resourceId===stack.resourceId)!.sourceId,quantityUnits:stack.quantity,targetContainerId:targetId,targetStackId:stack.stackId}));
          }
          const target=before.containers.find(v=>v.state.containerId===targetId);if(!target||target.state.revision!==targetRevision||!sourceAccess(targetId,native))throw Error("StaleOrRemoteTransferTarget");
          const plan=prepareFactoryMaterialStep(before,{kind:"transfer",transactionId:command.commandId,ownerId:owner,actorId:"hvp_player",moves});if(plan.status!=="Prepared")throw Error(plan.reason);
          const committed=commitFactoryMaterialStep(before,plan);if(committed.status!=="Committed")throw Error("HistoricalMaterialCannotAllocateNative");candidate=committed.view;
          const custody=c&&candidate.containers.find(v=>v.state.containerId===c.containerId);
          if(c&&custody?.state.contents.length===0){request={transactionId:command.commandId,ownerId:c.ownerId,profileId:c.profileId,profileDigest:c.profileDigest,expectedRevision:native.revision,expectedTerrainRevision:command.expected.terrainRevision,sourceContainerId:c.containerId,emptyCustodyCanonicalJson:custody.state.canonicalJson,materialBinding:factoryMaterialBytes(candidate)};operation="release";}
        }else throw Error("UnsupportedHandlingCommand");
        if(request&&operation){await host.native.prepare(request,operation);prepared=true;await host.native.commit(request.transactionId);}
        if(!host.current()||!host.materialAuthority.adopt(before,candidate))throw Error("StaleHandlingAuthority");adopted=true;
        if(request){host.native.publish(request.transactionId);published=true;phase="Finalizing";await host.native.finalize(request.transactionId);}
        phase="Ready";return {status:"Committed",reason:null};
      }catch(error){
        if(phase==="Finalizing"||published||String(error).includes("RecoveryHold")){phase="RecoveryHold";return {status:"RecoveryHold",reason:String(error)};}
        try{if(prepared&&request)await host.native.rollback(request.transactionId);if(adopted&&!host.materialAuthority.adopt(candidate,before))throw Error("RollbackNotProven");phase="Ready";return rejection(error instanceof Error?error.message:String(error));}
        catch(rollback){phase="RecoveryHold";return {status:"RecoveryHold",reason:String(rollback)};}
      }
    }
  };
};
