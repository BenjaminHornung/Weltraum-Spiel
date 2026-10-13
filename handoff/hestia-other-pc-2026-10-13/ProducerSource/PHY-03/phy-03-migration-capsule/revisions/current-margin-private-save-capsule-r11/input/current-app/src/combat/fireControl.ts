import {
  CombatContractError,
  add,
  angle,
  clamp,
  createCombatTarget,
  createWeaponCapability,
  createWeaponMountPose,
  createWeaponRuntimeState,
  deepFreeze,
  deriveCombatId,
  dot,
  magnitude,
  normalize,
  nonNegative,
  safeInteger,
  scale,
  subtract,
  tick,
  type CombatTargetSnapshot,
  type DamagePayload,
  type ProjectileId,
  type ProjectileState,
  type RayDelivery,
  type WeaponCapabilitySnapshot,
  type WeaponMountPose,
  type WeaponRuntimeState
} from "./contracts";
import { createProjectileSpawnedEvent, createWeaponFireEvent, type CombatEvent } from "./events";

export const FIRE_BLOCKER_ORDER = ["NoTarget", "TargetInvalid", "OutOfRange", "OutsideArc", "NotAligned", "CooldownActive", "AmmoEmpty", "EnergyInsufficient", "Overheated", "FirePermissionDenied", "LineOfFireBlocked"] as const;
export type FireBlocker = typeof FIRE_BLOCKER_ORDER[number];
export type TargetRelation = "Self" | "Friendly" | "Neutral" | "Hostile";
export interface FirePolicy { readonly relation: TargetRelation; readonly friendlyFire: "Allowed" | "Denied"; readonly permission: "Allowed" | "Denied" }
export interface WeaponFireRequest {
  readonly capability: WeaponCapabilitySnapshot;
  readonly state: WeaponRuntimeState;
  readonly pose: WeaponMountPose;
  readonly target: CombatTargetSnapshot | null;
  readonly tick: number;
  readonly policy: FirePolicy;
  readonly lineOfFire: "Clear" | "Blocked";
}
export interface FirePermissionResult { readonly allowed: boolean; readonly blockers: readonly FireBlocker[]; readonly primaryReason: FireBlocker | null }

const validPolicy = (policy: FirePolicy): void => {
  if (!["Self", "Friendly", "Neutral", "Hostile"].includes(policy.relation)) throw new CombatContractError("InvalidEnum", "policy.relation", "is invalid.");
  if (!["Allowed", "Denied"].includes(policy.friendlyFire)) throw new CombatContractError("InvalidEnum", "policy.friendlyFire", "is invalid.");
  if (!["Allowed", "Denied"].includes(policy.permission)) throw new CombatContractError("InvalidEnum", "policy.permission", "is invalid.");
};

export const evaluateFirePermission = (request: WeaponFireRequest): Readonly<FirePermissionResult> => {
  const capability = createWeaponCapability(request.capability);
  const state = createWeaponRuntimeState(request.state, capability);
  const pose = createWeaponMountPose(request.pose);
  tick(request.tick, "request.tick"); validPolicy(request.policy);
  if (!["Clear", "Blocked"].includes(request.lineOfFire)) throw new CombatContractError("InvalidEnum", "request.lineOfFire", "is invalid.");
  const blockers = new Set<FireBlocker>();
  let target: Readonly<CombatTargetSnapshot> | null = null;
  let targetGeometryValid = false;
  if (request.target === null) {
    blockers.add("NoTarget");
  } else {
    target = createCombatTarget(request.target);
    const offset = subtract(target.position, pose.muzzlePosition);
    targetGeometryValid = target.targetable && target.lifecycle === "Active" && target.frameId === pose.frameId && magnitude(offset) > 0;
    if (!targetGeometryValid) {
      blockers.add("TargetInvalid");
    } else {
      const distance = magnitude(offset); const direction = normalize(offset, "target.direction");
      if (distance > capability.maximumRangeMeters) blockers.add("OutOfRange");
      if (capability.mount.kind === "Fixed") {
        if (angle(pose.forward, direction) > capability.mount.halfArcRadians) blockers.add("OutsideArc");
      } else {
        const yaw = Math.atan2(dot(direction, pose.right), dot(direction, pose.forward));
        const pitch = Math.asin(clamp(dot(direction, pose.up), -1, 1));
        if (Math.abs(yaw) > capability.mount.yawLimitRadians || Math.abs(pitch) > capability.mount.pitchLimitRadians) blockers.add("OutsideArc");
      }
      if (angle(pose.muzzleDirection, direction) > capability.maximumTrackingErrorRadians) blockers.add("NotAligned");
    }
  }
  if (state.cooldownSeconds > 0) blockers.add("CooldownActive");
  if (capability.ammoPerShot !== null && (state.ammo ?? 0) < capability.ammoPerShot) blockers.add("AmmoEmpty");
  if (capability.energyPerShot !== null && (state.energy ?? 0) < capability.energyPerShot) blockers.add("EnergyInsufficient");
  if (capability.heat !== null && (state.heat ?? 0) + capability.heat.heatPerShot > capability.heat.maximumHeat) blockers.add("Overheated");
  const sameOwner = target !== null && target.ownerId === pose.ownerId;
  if (state.lifecycle !== "Operational" || request.policy.permission === "Denied" || request.policy.relation === "Self" || ((request.policy.relation === "Friendly" || sameOwner) && request.policy.friendlyFire === "Denied")) blockers.add("FirePermissionDenied");
  if (request.lineOfFire === "Blocked") blockers.add("LineOfFireBlocked");
  const ordered = FIRE_BLOCKER_ORDER.filter((reason) => blockers.has(reason));
  return deepFreeze({ allowed: ordered.length === 0, blockers: ordered, primaryReason: ordered[0] ?? null });
};

export const advanceWeaponRuntimeState = (stateInput: WeaponRuntimeState, elapsedSeconds: number, capabilityInput: WeaponCapabilitySnapshot): Readonly<WeaponRuntimeState> => {
  const capability = createWeaponCapability(capabilityInput); const state = createWeaponRuntimeState(stateInput, capability); const elapsed = nonNegative(elapsedSeconds, "elapsedSeconds");
  return createWeaponRuntimeState({
    ...state,
    cooldownSeconds: Math.max(0, state.cooldownSeconds - elapsed),
    heat: state.heat === null ? null : Math.max(0, state.heat - elapsed * (capability.heat?.coolingPerSecond ?? 0))
  }, capability);
};

export type FireDelivery = { readonly kind: "Projectile"; readonly projectile: Readonly<ProjectileState> } | { readonly kind: "Beam"; readonly ray: Readonly<RayDelivery> };
export interface FireWeaponResult { readonly accepted: boolean; readonly evaluation: Readonly<FirePermissionResult>; readonly state: Readonly<WeaponRuntimeState>; readonly delivery: FireDelivery | null; readonly events: readonly Readonly<CombatEvent>[] }

export const fireWeapon = (request: WeaponFireRequest): Readonly<FireWeaponResult> => {
  const evaluation = evaluateFirePermission(request);
  if (!evaluation.allowed || request.target === null) return deepFreeze({ accepted: false, evaluation, state: request.state, delivery: null, events: [] });
  const capability = createWeaponCapability(request.capability); const state = createWeaponRuntimeState(request.state, capability); const pose = createWeaponMountPose(request.pose); const target = createCombatTarget(request.target); const fireTick = tick(request.tick, "request.tick");
  const shotSequence = safeInteger(state.shotSequence + 1, "state.shotSequence");
  const nextState = createWeaponRuntimeState({
    ...state, cooldownSeconds: 1 / capability.rateOfFirePerSecond,
    ammo: state.ammo === null ? null : state.ammo - (capability.ammoPerShot ?? 0),
    energy: state.energy === null ? null : state.energy - (capability.energyPerShot ?? 0),
    heat: state.heat === null ? null : state.heat + (capability.heat?.heatPerShot ?? 0), shotSequence
  }, capability);
  const fireEvent = createWeaponFireEvent({ tick: fireTick, sourceEntityId: pose.sourceEntityId, targetEntityId: target.targetId, weaponId: capability.weaponId, projectileId: null, moduleId: null, shotSequence });
  const payload = deepFreeze<DamagePayload>({ damageType: capability.damageType, rawDamage: capability.rawDamage });
  if (capability.delivery.kind === "Beam") {
    const ray = deepFreeze<RayDelivery>({ kind: "Beam", sourceEntityId: pose.sourceEntityId, weaponId: capability.weaponId, frameId: pose.frameId, tick: fireTick, shotSequence, origin: pose.muzzlePosition, direction: pose.muzzleDirection, maximumDistanceMeters: capability.maximumRangeMeters, payload });
    return deepFreeze({ accepted: true, evaluation, state: nextState, delivery: { kind: "Beam", ray }, events: [fireEvent] });
  }
  const projectileId = deriveCombatId<ProjectileId>("projectile", { sourceEntityId: pose.sourceEntityId, targetEntityId: target.targetId, weaponId: capability.weaponId, tick: fireTick, shotSequence });
  const projectile = deepFreeze<ProjectileState>({ kind: "Projectile", projectileId, sourceEntityId: pose.sourceEntityId, weaponId: capability.weaponId, frameId: pose.frameId, spawnTick: fireTick, shotSequence, position: pose.muzzlePosition, velocity: add(pose.sourceVelocity, scale(pose.muzzleDirection, capability.delivery.speedMetersPerSecond)), radiusMeters: capability.delivery.radiusMeters, massKilograms: capability.delivery.massKilograms, remainingLifetimeSeconds: capability.delivery.lifetimeSeconds, remainingRangeMeters: Math.min(capability.delivery.maximumPathRangeMeters, capability.maximumRangeMeters), traveledDistanceMeters: 0, payload });
  const spawnEvent = createProjectileSpawnedEvent({ tick: fireTick, sourceEntityId: pose.sourceEntityId, targetEntityId: target.targetId, weaponId: capability.weaponId, projectileId, moduleId: null, frameId: pose.frameId, position: pose.muzzlePosition });
  return deepFreeze({ accepted: true, evaluation, state: nextState, delivery: { kind: "Projectile", projectile }, events: [fireEvent, spawnEvent] });
};
