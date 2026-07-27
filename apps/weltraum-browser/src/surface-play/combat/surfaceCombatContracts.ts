import {
  deepFreeze,
  deriveCombatId,
  type CollisionProxy,
  type CombatEvent,
  type CombatTargetSnapshot,
  type EventId,
  type RayDelivery,
  type Vec3,
  type WeaponId,
  type WeaponMountPose,
  type WeaponRuntimeState
} from "../../combat";
import type {
  SurfaceAuthorityBinding,
  SurfaceCombatSnapshot,
  SurfaceImpactPresentationSnapshot,
  SurfacePlayerSnapshot,
  SurfaceRayResult,
  SurfaceTargetPresentationSnapshot,
  SurfaceWeaponPresentationSnapshot
} from "../contracts";
import type { SurfaceSurveyDroneState } from "./surfaceSurveyDrone";

export interface SurfaceFireCommand {
  readonly commandId: string;
  readonly playerId: string;
  readonly surfaceFrameId: string;
  readonly simulationTick: number;
}

export interface SurfaceCombatRaycastRequest {
  readonly binding: Readonly<SurfaceAuthorityBinding>;
  readonly ray: Readonly<RayDelivery>;
  readonly targets: readonly Readonly<CombatTargetSnapshot>[];
  readonly proxies: readonly Readonly<CollisionProxy>[];
}

export type SurfaceCombatRaycastCandidate =
  | Readonly<{
    readonly kind: "CombatTargetHit";
    readonly target: Readonly<CombatTargetSnapshot>;
    readonly proxy: Readonly<CollisionProxy>;
    readonly point: Readonly<Vec3>;
    readonly normal: Readonly<Vec3>;
    readonly distanceMeters: number;
  }>
  | Readonly<{
    readonly kind: "TerrainHit";
    readonly colliderId: string;
    readonly point: Readonly<Vec3>;
    readonly normal: Readonly<Vec3>;
    readonly distanceMeters: number;
  }>
  | Readonly<{ readonly kind: "Miss" }>
  | Readonly<{
    readonly kind: "Blocked";
    readonly code: "FrameMismatch" | "StaleRevision" | "AuthorityRefused";
    readonly message: string;
  }>;

export interface SurfaceTargetTerrainRaycastPort {
  query(request: Readonly<SurfaceCombatRaycastRequest>): SurfaceCombatRaycastCandidate;
}

export interface SurfaceTerrainRaycastPort {
  queryTerrain(
    binding: Readonly<SurfaceAuthorityBinding>,
    ray: Readonly<RayDelivery>
  ): SurfaceRayResult;
}

export interface SurfaceImpactIntent {
  readonly intentId: string;
  readonly sourceWeaponId: WeaponId;
  readonly fireEventId: EventId;
  readonly frameId: string;
  readonly simulationTick: number;
  readonly hitPointMeters: Readonly<Vec3>;
  readonly hitNormal: Readonly<Vec3>;
  readonly energyDamageScalar: number;
  readonly suggestedEditRadiusMeters: number;
}

export const createSurfaceImpactIntent = (
  input: Omit<SurfaceImpactIntent, "intentId">
): Readonly<SurfaceImpactIntent> => {
  const stable = {
    sourceWeaponId: input.sourceWeaponId,
    fireEventId: input.fireEventId,
    frameId: input.frameId,
    simulationTick: input.simulationTick,
    hitPointMeters: input.hitPointMeters,
    hitNormal: input.hitNormal,
    energyDamageScalar: input.energyDamageScalar,
    suggestedEditRadiusMeters: input.suggestedEditRadiusMeters
  };
  return deepFreeze({
    intentId: deriveCombatId<string>("surface-impact-intent", stable),
    ...stable
  });
};

export interface SurfaceCombatRuntimeState {
  readonly weapon: Readonly<WeaponRuntimeState>;
  readonly drone: Readonly<SurfaceSurveyDroneState>;
  readonly nextSurfaceEventSequence: number;
}

export type SurfaceCombatResolutionKind =
  | "CombatTargetHit"
  | "TerrainHit"
  | "Miss"
  | "BlockedFire";

export interface SurfaceCombatRuntimeResult {
  readonly kind: SurfaceCombatResolutionKind;
  readonly state: Readonly<SurfaceCombatRuntimeState>;
  readonly snapshot: Readonly<SurfaceCombatSnapshot>;
  readonly combatEvents: readonly Readonly<CombatEvent>[];
  readonly impactIntent: Readonly<SurfaceImpactIntent> | null;
  readonly hitPointMeters: Readonly<Vec3> | null;
  readonly hitNormal: Readonly<Vec3> | null;
}

export interface SurfaceCombatExecutionInput {
  readonly state: Readonly<SurfaceCombatRuntimeState>;
  readonly player: Readonly<SurfacePlayerSnapshot>;
  readonly command: Readonly<SurfaceFireCommand>;
  readonly pose: Readonly<WeaponMountPose>;
  readonly binding: Readonly<SurfaceAuthorityBinding>;
  readonly raycast: SurfaceTargetTerrainRaycastPort;
}

export interface SurfaceCombatPresentationReplay {
  readonly weapon: Readonly<SurfaceWeaponPresentationSnapshot>;
  readonly target: Readonly<SurfaceTargetPresentationSnapshot>;
  readonly impact: Readonly<SurfaceImpactPresentationSnapshot> | null;
  readonly combatEventIds: readonly string[];
}
