import type { MaterialView } from "../material/reservations";
import { canonicalJson } from "../../resources/serialization";
import { prepareFactoryPlacement, factoryPlacementBytes, factoryMaterialBytes, type FactoryPlacementView, type FactoryPlacementRequest, type FactoryPlacementPlan, type FactoryInstallation } from "./placement";
import type { FactoryFacilityRequest } from "../../hestia-prototype/physics/factoryFacilitySession";
import type { FactoryMaterialAuthority } from "../session/dryFactorySlice";
export interface FactoryConstructionHost {
  readonly materialAuthority?: FactoryMaterialAuthority;
  readonly canCommit?: () => boolean;
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
  /** Trusted Host-only paired domain adoption; no caller/renderer authority. */
  prepareAdoption?(plan:FactoryPlacementPlan):Readonly<{material:MaterialView;publish():void;rollback():void}>|undefined;
}
export interface FactoryConstructionResult { readonly status: "Committed" | "Rejected" | "RecoveryHold"; readonly reason: string; readonly transactionId: string }
/** One Host-owned complete MaterialView. UI/Renderer/Worker receive projections or bounded commands only. */
export const createFactoryConstruction = (host: FactoryConstructionHost, initial: MaterialView, initialInstallations:readonly FactoryInstallation[] = []) => {
  let legacyMaterial=initial, installations:readonly FactoryInstallation[]=initialInstallations, state:"Ready"|"Preparing"|"Finalizing"|"RecoveryHold"="Ready";
  const material=()=>host.materialAuthority?.read()??legacyMaterial;
  const current=():FactoryPlacementView=>({...host.readPlacementView(),material:material(),installations});
  const same=(plan:FactoryPlacementPlan)=>factoryPlacementBytes(current())===plan.baseBytes;
  const notify=()=>host.notify?.();
  return {
    read:()=>Object.freeze({material:material(),installations,state}),
    previewKey:()=>{const view=current();return canonicalJson({binding:view.binding,revision:material().revision,actor:{...view.actor,ownerId:view.actor.ownerId??null}});},
    get busy():boolean{return state!=="Ready";},
    preview:(request:FactoryPlacementRequest)=>state==="Ready"?prepareFactoryPlacement(current(),request):{status:"Rejected" as const,reason:"BUILD_BUSY"},
    async commit(plan:FactoryPlacementPlan):Promise<FactoryConstructionResult>{
      const id=plan.request.transactionId;
      const rejected=(reason:string):FactoryConstructionResult=>({status:"Rejected",reason,transactionId:id});
      if(host.canCommit?.()===false)return rejected("BUILD_BUSY");
      if(state!=="Ready")return rejected("BUILD_BUSY");
      if(!same(plan))return rejected("STALE_PLACEMENT");
      const checked=prepareFactoryPlacement(current(),plan.request);
      if(checked.status!=="Prepared"||checked.profile.canonicalJson!==plan.profile.canonicalJson||factoryMaterialBytes(checked.materialCandidate)!==factoryMaterialBytes(plan.materialCandidate)||canonicalJson(checked.installation)!==canonicalJson(plan.installation)||canonicalJson(checked.consumedCustody??null)!==canonicalJson(plan.consumedCustody??null))return rejected("INVALID_PLACEMENT_PLAN");
      if(!host.pause||!host.prepareNative||!host.commitNative||!host.publishNative||!host.rollbackNative||!host.finalizeNative||!host.stageProjection||!host.publishProjection||!host.rollbackProjection||!host.finalizeProjection)return rejected("NATIVE_INSTALLATION_UNAVAILABLE");
      state="Preparing";notify();const oldMaterial=material(),oldInstallations=installations;let native=false,projection=false,published=false,materialAdopted=false,domainAdopted=false;
      let adoption:ReturnType<NonNullable<FactoryConstructionHost["prepareAdoption"]>>,candidate=plan.materialCandidate;
      try{
        await host.pause();if(!same(plan))throw new Error("STALE_PLACEMENT");
        adoption=host.prepareAdoption?.(plan);candidate=adoption?.material??plan.materialCandidate;
        const view=current();
        await host.prepareNative({transactionId:id,ownerId:plan.installation.instanceId,instanceId:plan.installation.instanceId,definitionRef:plan.profile.definitionRef,
          expectedRevision:view.binding.facilityRevision,expectedTerrainRevision:view.binding.terrainRevision,materialBinding:factoryMaterialBytes(candidate),profileDigest:plan.profile.profileDigest,centerMm:plan.installation.centerMm,quarterTurns:plan.installation.quarterTurns,...(plan.consumedCustody?{consumedCustody:plan.consumedCustody}:{})});native=true;
        if(!same(plan))throw new Error("STALE_PLACEMENT");
        await host.stageProjection(plan);projection=true;if(!same(plan))throw new Error("STALE_PLACEMENT");
        await host.commitNative(id);if(!same(plan))throw new Error("STALE_PLACEMENT");
        // No await: complete Resources, logical owner, held native snapshot and visibility adopt together.
        if(host.materialAuthority){if(!host.materialAuthority.adopt(oldMaterial,candidate))throw new Error("STALE_MATERIAL_AUTHORITY");}else legacyMaterial=candidate;
        materialAdopted=true;installations=Object.freeze([...oldInstallations,plan.installation]);
        adoption?.publish();domainAdopted=!!adoption;
        host.publishNative(id);host.publishProjection(plan);published=true;
        state="Finalizing";notify();
        await host.finalizeNative(id);host.finalizeProjection(id);state="Ready";notify();
        return {status:"Committed",reason:"INSTALLED",transactionId:id};
      }catch(error){
        // Unknown finalization cannot be guessed or refunded. Keep the admitted state held for Recovery.
        if(state==="Finalizing"||(error instanceof Error&&error.message.includes("RecoveryHold"))){state="RecoveryHold";notify();return {status:"RecoveryHold",reason:"FINALIZE_OUTCOME_UNKNOWN",transactionId:id};}
        try{if(native)await host.rollbackNative(id);if(native||projection)host.rollbackProjection(id);
          if(materialAdopted&&host.materialAuthority&&!host.materialAuthority.adopt(candidate,oldMaterial))throw new Error("MaterialRollbackNotProven");
          if(domainAdopted)adoption!.rollback();
          if(!host.materialAuthority)legacyMaterial=oldMaterial;installations=oldInstallations;
          if(published)throw new Error("PublishedRollbackNotProven");state="Ready";notify();return rejected(error instanceof Error?error.message:"INSTALLATION_FAILED");
        }catch{state="RecoveryHold";notify();return {status:"RecoveryHold",reason:"ROLLBACK_NOT_PROVEN",transactionId:id};}
      }
    }
  };
};
export type FactoryConstruction=ReturnType<typeof createFactoryConstruction>;

export const commitFactoryPlacement=(session:FactoryConstruction,plan:FactoryPlacementPlan):Promise<FactoryConstructionResult>=>session.commit(plan);
