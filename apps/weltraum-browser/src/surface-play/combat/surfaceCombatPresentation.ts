import { deepFreeze } from "../../combat";
import {
  createSurfaceImpactPresentationSnapshot,
  createSurfaceTargetPresentationSnapshot,
  createSurfaceWeaponPresentationSnapshot
} from "../contracts";
import type {
  SurfaceCombatPresentationReplay,
  SurfaceCombatRuntimeResult
} from "./surfaceCombatContracts";

export const replaySurfaceCombatPresentation = (
  result: Readonly<SurfaceCombatRuntimeResult>,
  ownerPlayerId: string,
  muzzlePositionMeters: Readonly<{ x: number; y: number; z: number }>
): Readonly<SurfaceCombatPresentationReplay> => {
  const weapon = createSurfaceWeaponPresentationSnapshot({
    weaponId: result.snapshot.activeWeaponId,
    ownerPlayerId,
    surfaceFrameId: result.state.drone.frameId,
    muzzlePositionMeters,
    cooldownSeconds: result.snapshot.cooldownSeconds,
    firing: result.kind !== "BlockedFire"
  });
  const target = createSurfaceTargetPresentationSnapshot({
    targetId: result.state.drone.damageable.targetEntityId,
    surfaceFrameId: result.state.drone.frameId,
    positionMeters: result.state.drone.positionMeters,
    condition: result.snapshot.target?.condition ?? "Operational"
  });
  const impact = result.hitPointMeters === null || result.hitNormal === null
    ? null
    : createSurfaceImpactPresentationSnapshot({
      impactId: result.impactIntent?.intentId
        ?? result.combatEvents.find((event) => event.phase === "Hit")?.eventId
        ?? "surface-impact:unresolved",
      surfaceFrameId: result.state.drone.frameId,
      positionMeters: result.hitPointMeters,
      normal: result.hitNormal,
      kind: result.kind === "TerrainHit" ? "Terrain" : "Target",
      simulationTick: result.snapshot.simulationTick
    });
  return deepFreeze({
    weapon,
    target,
    impact,
    combatEventIds: result.combatEvents.map((event) => event.eventId)
  });
};
