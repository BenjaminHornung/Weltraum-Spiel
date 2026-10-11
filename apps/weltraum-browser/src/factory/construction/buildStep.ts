import type { MaterialView } from "../material/reservations";
import { canonicalJson } from "../../resources/serialization";
import { prepareFactoryPlacement, factoryPlacementBytes, factoryMaterialBytes, type FactoryPlacementView, type FactoryPlacementRequest, type FactoryPlacementPlan, type FactoryInstallation } from "./placement";
import type { FactoryFacilityRequest } from "../../hestia-prototype/physics/factoryFacilitySession";
export interface FactoryConstructionHost {
  readPlacementView(): FactoryPlacementView;
  pause?(): Promise<void>;
  prepareNative?(request: FactoryFacilityRequest): Promise<unknown>;
  commitNative?(id: string): Promise<unknown>;
  publishNative?(id: string): void;
  rollbackNative?(id: string): Promise<unknown>;
  finalizeNative?(id: string): Promise<unknown>;
  stageProjection?(plan: FactoryPlacementPlan): Promise<void>;
  publishProjection?(plan: FactoryPlacementPlan): void;
  rollbackProjection?(id: string): void;
  finalizeProjection?(id: string): void;
  notify?(): void;
}
export interface FactoryConstructionResult { readonly status: "Committed" | "Rejected" | "RecoveryHold"; readonly reason: string; readonly transactionId: string }
/** One Host-owned complete MaterialView. UI/Renderer/Worker receive projections or bounded commands only. */
export const createFactoryConstruction = (host: FactoryConstructionHost, initial: MaterialView) => {
  let material=initial, installations:readonly FactoryInstallation[]=[], state:"Ready"|"Preparing"|"Finalizing"|"RecoveryHold"="Ready";
  const current=():FactoryPlacementView=>({...host.readPlacementView(),material,installations});
  const same=(plan:FactoryPlacementPlan)=>factoryPlacementBytes(current())===plan.baseBytes;
  const notify=()=>host.notify?.();
  return {
    read:()=>Object.freeze({material,installations,state}),
    previewKey:()=>{const view=current();return canonicalJson({binding:view.binding,revision:material.revision,actor:{...view.actor,ownerId:view.actor.ownerId??null}});},
    get busy():boolean{return state!=="Ready";},
    preview:(request:FactoryPlacementRequest)=>state==="Ready"?prepareFactoryPlacement(current(),request):{status:"Rejected" as const,reason:"BUILD_BUSY"},
    async commit(plan:FactoryPlacementPlan):Promise<FactoryConstructionResult>{
      const id=plan.request.transactionId;
      const rejected=(reason:string):FactoryConstructionResult=>({status:"Rejected",reason,transactionId:id});
      if(state!=="Ready")return rejected("BUILD_BUSY");
      if(!same(plan))return rejected("STALE_PLACEMENT");
      const checked=prepareFactoryPlacement(current(),plan.request);
      if(checked.status!=="Prepared"||checked.profile.canonicalJson!==plan.profile.canonicalJson||factoryMaterialBytes(checked.materialCandidate)!==factoryMaterialBytes(plan.materialCandidate)||canonicalJson(checked.installation)!==canonicalJson(plan.installation))return rejected("INVALID_PLACEMENT_PLAN");
      if(!host.pause||!host.prepareNative||!host.commitNative||!host.publishNative||!host.rollbackNative||!host.finalizeNative||!host.stageProjection||!host.publishProjection||!host.rollbackProjection||!host.finalizeProjection)return rejected("NATIVE_INSTALLATION_UNAVAILABLE");
      state="Preparing";notify();const oldMaterial=material,oldInstallations=installations;let native=false,projection=false,published=false;
      try{
        await host.pause();if(!same(plan))throw new Error("STALE_PLACEMENT");
        const view=current();
        await host.prepareNative({transactionId:id,ownerId:plan.installation.instanceId,instanceId:plan.installation.instanceId,definitionRef:plan.profile.definitionRef,
          expectedRevision:view.binding.facilityRevision,expectedTerrainRevision:view.binding.terrainRevision,materialBinding:factoryMaterialBytes(plan.materialCandidate),profileDigest:plan.profile.profileDigest,centerMm:plan.installation.centerMm,quarterTurns:plan.installation.quarterTurns});native=true;
        if(!same(plan))throw new Error("STALE_PLACEMENT");
        await host.stageProjection(plan);projection=true;if(!same(plan))throw new Error("STALE_PLACEMENT");
        await host.commitNative(id);if(!same(plan))throw new Error("STALE_PLACEMENT");
        // No await: complete Resources, logical owner, held native snapshot and visibility adopt together.
        material=plan.materialCandidate;installations=Object.freeze([...oldInstallations,plan.installation]);
        host.publishNative(id);host.publishProjection(plan);published=true;
        state="Finalizing";notify();
        await host.finalizeNative(id);host.finalizeProjection(id);state="Ready";notify();
        return {status:"Committed",reason:"INSTALLED",transactionId:id};
      }catch(error){
        // Unknown finalization cannot be guessed or refunded. Keep the admitted state held for Recovery.
        if(state==="Finalizing"||(error instanceof Error&&error.message.includes("RecoveryHold"))){state="RecoveryHold";notify();return {status:"RecoveryHold",reason:"FINALIZE_OUTCOME_UNKNOWN",transactionId:id};}
        try{if(native)await host.rollbackNative(id);if(native||projection)host.rollbackProjection(id);material=oldMaterial;installations=oldInstallations;
          if(published)throw new Error("PublishedRollbackNotProven");state="Ready";notify();return rejected(error instanceof Error?error.message:"INSTALLATION_FAILED");
        }catch{state="RecoveryHold";notify();return {status:"RecoveryHold",reason:"ROLLBACK_NOT_PROVEN",transactionId:id};}
      }
    }
  };
};
export type FactoryConstruction=ReturnType<typeof createFactoryConstruction>;

export const commitFactoryPlacement=(session:FactoryConstruction,plan:FactoryPlacementPlan):Promise<FactoryConstructionResult>=>session.commit(plan);
