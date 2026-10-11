import type { MaterialView, MaterialMove } from "../material/reservations";
import { prepareFactoryMaterialStep, commitFactoryMaterialStep } from "../material/reservations";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../resources/containers";
import { canonicalJson } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import { createFactoryInstallationProfile, transformFactoryBounds, type FactoryVector, type FactoryBoundsMm, type FactoryInstallationProfile } from "./installationProfile";

export interface FactoryCargoAccess {
  readonly ownerId:string; readonly containerId:string; readonly opened:boolean; readonly sourceDigest:string; readonly profileDigest:string;
  readonly positionMm:readonly number[]; readonly accessBoundsMm:FactoryBoundsMm; readonly bodyHandle:number; readonly accessible?:boolean;
}
export interface FactoryPlacementRequest {
  readonly transactionId: string; readonly instanceId: string; readonly definitionSourceId: string;
  readonly centerMm: readonly number[]; readonly quarterTurns: number;
}
export interface FactoryInstallation {
  readonly instanceId: string; readonly definitionSourceId: string; readonly profileDigest: string; readonly sourceDigest: string;
  readonly massMg: number; readonly materialContainerId: string; readonly centerMm: FactoryVector; readonly quarterTurns: number;
  readonly boundsMm: FactoryBoundsMm; readonly serviceBoundsMm: FactoryBoundsMm;
}
export interface FactoryPlacementView {
  readonly cargoAccess?:FactoryCargoAccess;
  readonly binding: Readonly<{ sessionId: string; epoch: number; terrainRevision: number; sourceDigest: string; baseDigest: string; facilityRevision: number }>;
  readonly material: MaterialView; readonly installations: readonly FactoryInstallation[];
  readonly actor: Readonly<{ actorId: string; ownerId?: string; positionMm: readonly number[]; canBuild: boolean }>;
  readonly terrain: Readonly<{ cellMm: number; originMm: readonly number[]; size: readonly number[]; readSlot(x: number,y: number,z: number): number | undefined }>;
}
export interface FactoryPlacementPlan {
  readonly status: "Prepared"; readonly request: FactoryPlacementRequest; readonly baseBytes: string;
  readonly profile: FactoryInstallationProfile; readonly installation: FactoryInstallation; readonly materialCandidate: MaterialView;
}
export interface FactoryPlacementRejected { readonly status: "Rejected"; readonly reason: string }
export const factoryMaterialBytes = (material: MaterialView): string => canonicalJson({ catalogBytes: material.catalog.canonicalJson, revision: material.revision,
  containers: material.containers.map(snapshot => ({ definitionBytes: snapshot.definition.canonicalJson, stateBytes: snapshot.state.canonicalJson })), reservations: material.reservations, receipts: material.receipts });
export const factoryPlacementBytes = (view: FactoryPlacementView): string => canonicalJson({ binding: view.binding, materialBytes: factoryMaterialBytes(view.material), installations: view.installations,
  actor: { ...view.actor, ownerId: view.actor.ownerId ?? null }, cargoAccess: view.cargoAccess ?? null, terrain: { cellMm: view.terrain.cellMm, originMm: view.terrain.originMm, size: view.terrain.size } });
const overlap = (a: FactoryBoundsMm,b: FactoryBoundsMm): boolean => a.min.every((v,i) => v < b.max[i]! - .5 && a.max[i]! > b.min[i]! + .5);
const reason = (code: string): never => { throw new Error(code); };
const readSlot = (view: FactoryPlacementView,x: number,y: number,z: number): number => {
  const cell = [x,y,z].map((v,i) => Math.floor((v-view.terrain.originMm[i]!)/view.terrain.cellMm));
  if (cell.some((v,i) => v < 0 || v >= view.terrain.size[i]!)) reason("TERRAIN_UNKNOWN");
  const slot = view.terrain.readSlot(cell[0]!,cell[1]!,cell[2]!);
  if (slot === undefined) reason("TERRAIN_UNKNOWN"); return slot!;
};
const assertAir = (view: FactoryPlacementView,bounds: FactoryBoundsMm): void => {
  const starts = bounds.min.map((v,i) => Math.floor((v+.5-view.terrain.originMm[i]!)/125));
  const ends = bounds.max.map((v,i) => Math.ceil((v-.5-view.terrain.originMm[i]!)/125));
  const total = ends.reduce((n,v,i) => n * Math.max(0,v-starts[i]!),1);
  if (!Number.isSafeInteger(total) || total > 262144) reason("PLACEMENT_QUERY_BUDGET");
  for (let z=starts[2]!;z<ends[2]!;z++) for (let y=starts[1]!;y<ends[1]!;y++) for (let x=starts[0]!;x<ends[0]!;x++)
    if (readSlot(view,view.terrain.originMm[0]!+(x+.5)*125,view.terrain.originMm[1]!+(y+.5)*125,view.terrain.originMm[2]!+(z+.5)*125)!==0) reason("SPACE_BLOCKED");
};
/** Pure planning. Materials remain in the original complete view until Host joint publication. */
export const prepareFactoryPlacement = (view: FactoryPlacementView, request: FactoryPlacementRequest): FactoryPlacementPlan | FactoryPlacementRejected => {
  try {
    if (![request.transactionId,request.instanceId].every(isSaveSafeResourceId) || request.centerMm.length !== 3 || !request.centerMm.every(v=>Number.isSafeInteger(v)&&v%250===0) || !Number.isInteger(request.quarterTurns)||request.quarterTurns<0||request.quarterTurns>3) reason("INVALID_BUILD_FRAME");
    if (!view.actor.canBuild || !view.actor.ownerId || view.terrain.cellMm!==125) reason("BUILD_UNAVAILABLE");
    if (view.installations.length>=16 || request.instanceId===view.cargoAccess?.ownerId || view.installations.some(v=>v.instanceId===request.instanceId) || view.material.receipts.some(v=>v.transactionId===request.transactionId)) reason("DUPLICATE_OR_CAPACITY");
    const profile=createFactoryInstallationProfile(request.definitionSourceId);
    const cargo=view.cargoAccess;
    if(!cargo || cargo.ownerId!==view.actor.ownerId || cargo.containerId!=="fp02_wreck_cargo") reason("CARGO_UNAVAILABLE");
    if(!cargo!.opened) reason("CARGO_CLOSED");
    if(cargo!.accessible===false)reason("OUT_OF_REACH");
    if(cargo!.sourceDigest!==view.binding.baseDigest || !cargo!.profileDigest || !Number.isFinite(cargo!.bodyHandle)) reason("CARGO_BINDING_MISMATCH");
    // Player reaches a local service edge and the actual immutable native Cargo access volume.
    const service=transformFactoryBounds(profile.serviceBoundsMm,request.centerMm,request.quarterTurns);
    const distance=(point:readonly number[],bounds:FactoryBoundsMm)=>Math.hypot(...point.map((v,i)=>Math.max(bounds.min[i]!-v,0,v-bounds.max[i]!)));
    if (distance(view.actor.positionMm,service)>3000 || distance(view.actor.positionMm,cargo!.accessBoundsMm)>4000) reason("OUT_OF_REACH");
    const bounds=transformFactoryBounds(profile.boundsMm,request.centerMm,request.quarterTurns);
    if(view.installations.some(v=>overlap(v.boundsMm,bounds)||overlap(v.boundsMm,service)||overlap(v.serviceBoundsMm,bounds))) reason("FACILITY_OVERLAP");
    const playerBounds={min:view.actor.positionMm.map((v,i)=>v-(i===1?900:350)) as unknown as FactoryVector,max:view.actor.positionMm.map((v,i)=>v+(i===1?900:350)) as unknown as FactoryVector};
    if(overlap(bounds,playerBounds)) reason("PLAYER_BLOCKED");
    for(const patch of profile.supportPatchesMm){
      const corners=transformFactoryBounds({min:[patch.centerMm[0]-patch.sizeMm[0]/2,patch.centerMm[1],patch.centerMm[2]-patch.sizeMm[1]/2],max:[patch.centerMm[0]+patch.sizeMm[0]/2,patch.centerMm[1],patch.centerMm[2]+patch.sizeMm[1]/2]},request.centerMm,request.quarterTurns);
      for(let z=corners.min[2]+62.5;z<corners.max[2];z+=125)for(let x=corners.min[0]+62.5;x<corners.max[0];x+=125){
        if(readSlot(view,x,corners.min[1]-1,z)===0) reason("SUPPORT_MISSING");
        if(readSlot(view,x,corners.min[1]+1,z)!==0) reason("SUPPORT_OCCUPIED");
      }
    }
    assertAir(view,bounds); assertAir(view,service);
    for(const sweep of profile.sweepBoundsMm) assertAir(view,transformFactoryBounds(sweep,request.centerMm,request.quarterTurns));
    const containerId=`installed_${request.instanceId}`;
    // Stored capacity is an integer mm³ ceiling of the exact source-bound input pack envelope.
    let numerator=0n,denominator=1n;
    for(const term of profile.bom){const item=view.material.catalog.items.find(v=>v.sourceId===term.itemId)!;const volume=item.volumeProfile;
      if(volume.kind==="unknown")reason("UNKNOWN_BOM_VOLUME");
      if(volume.kind!=="unknown"){numerator=numerator*BigInt(volume.denominatorUnits)+BigInt(term.quantityUnits)*BigInt(volume.numeratorMm3)*denominator;denominator*=BigInt(volume.denominatorUnits);}}
    const volumeMm3=Number((numerator+denominator-1n)/denominator);
    if(!Number.isSafeInteger(volumeMm3))reason("BOM_VOLUME_OVERFLOW");
    const target=createResourceContainerSnapshot(createResourceContainerDefinition({containerId,kind:"OutpostStorage",maxMassKg:profile.massMg/1_000_000,maxVolumeM3:volumeMm3/1_000_000_000,maxStackCount:200}),
      createResourceContainerState({containerId,ownerId:view.actor.ownerId,contents:[]},view.material.catalog.resources),view.material.catalog.resources);
    const moves:MaterialMove[]=[];
    for(const term of profile.bom){let remaining=term.quantityUnits;const item=view.material.catalog.items.find(v=>v.sourceId===term.itemId)!;
      for(const container of view.material.containers){if(container.state.containerId!=="fp02_wreck_cargo" || container.state.ownerId!==view.actor.ownerId || container.state.containerId.startsWith("installed_") || view.material.reservations.some(v=>v.wipContainerId===container.state.containerId))continue;
        for(const stack of container.state.contents){if(stack.resourceId!==item.resourceId||remaining===0)continue;const amount=Math.min(remaining,stack.quantity);moves.push({sourceContainerId:container.state.containerId,sourceStackId:stack.stackId,targetContainerId:containerId,targetStackId:amount===stack.quantity?stack.stackId:`${request.instanceId}_part_${moves.length}`,itemId:term.itemId,quantityUnits:amount});remaining-=amount;}}
      if(remaining!==0)reason("BOM_MISSING");}
    const augmented:MaterialView={...view.material,containers:[...view.material.containers,target]};
    const materialPlan=prepareFactoryMaterialStep(augmented,{kind:"transfer",transactionId:request.transactionId,ownerId:view.actor.ownerId!,actorId:view.actor.actorId,moves});
    if(materialPlan.status!=="Prepared")reason(materialPlan.reason);
    if(materialPlan.status!=="Prepared")throw new Error("Unreachable");
    const committed=commitFactoryMaterialStep(augmented,materialPlan);if(committed.status==="Rejected")reason(committed.reason);
    const installation:FactoryInstallation=Object.freeze({instanceId:request.instanceId,definitionSourceId:request.definitionSourceId,profileDigest:profile.profileDigest,sourceDigest:profile.sourceDigest,massMg:profile.massMg,materialContainerId:containerId,centerMm:Object.freeze([...request.centerMm]) as FactoryVector,quarterTurns:request.quarterTurns,boundsMm:bounds,serviceBoundsMm:service});
    return Object.freeze({status:"Prepared",request:Object.freeze({...request,centerMm:Object.freeze([...request.centerMm])}),baseBytes:factoryPlacementBytes(view),profile,installation,materialCandidate:committed.view});
  }catch(error){return Object.freeze({status:"Rejected",reason:error instanceof Error?error.message:"INVALID_BUILD_REQUEST"});}
};
