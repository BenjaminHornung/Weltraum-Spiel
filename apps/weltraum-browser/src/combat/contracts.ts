export class CombatContractError extends Error {
  public readonly code: string;
  public readonly path: string;

  public constructor(code: string, path: string, message: string) {
    super(`${path || "combat"}: ${message}`);
    this.name = "CombatContractError";
    this.code = code;
    this.path = path;
  }
}

const contractError = (code: string, path: string, message: string): never => {
  throw new CombatContractError(code, path, message);
};

export type StableId<Name extends string> = string & { readonly __combatIdBrand: Name };
export type EntityId = StableId<"EntityId">;
export type OwnerId = StableId<"OwnerId">;
export type WeaponId = StableId<"WeaponId">;
export type ProjectileId = StableId<"ProjectileId">;
export type ProxyId = StableId<"ProxyId">;
export type ModuleId = StableId<"ModuleId">;
export type FrameId = StableId<"FrameId">;
export type HitId = StableId<"HitId">;
export type DamagePacketId = StableId<"DamagePacketId">;
export type EventId = StableId<"EventId">;

export const COMBAT_STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export const parseCombatId = <T extends string>(value: unknown, path: string): T => {
  if (typeof value !== "string" || !COMBAT_STABLE_ID_PATTERN.test(value)) {
    return contractError("InvalidId", path, "must match ^[a-z0-9][a-z0-9._:-]{0,127}$.");
  }
  return value as T;
};

export type CanonicalJson = null | boolean | number | string | readonly CanonicalJson[] | { readonly [key: string]: CanonicalJson };

const canonicalize = (value: unknown, path: string, ancestors: Set<object>): CanonicalJson => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return contractError("InvalidCanonicalJson", path, "must contain finite numbers only.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return contractError("InvalidCanonicalJson", path, "must not contain cycles.");
    ancestors.add(value);
    const result = value.map((item, index) => canonicalize(item, `${path}[${index}]`, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    if (ancestors.has(value)) return contractError("InvalidCanonicalJson", path, "must not contain cycles.");
    ancestors.add(value);
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") {
        return contractError("InvalidCanonicalJson", path ? `${path}.${key}` : key, "contains an unsupported value.");
      }
      result[key] = canonicalize(item, path ? `${path}.${key}` : key, ancestors);
    }
    ancestors.delete(value);
    return result;
  }
  return contractError("InvalidCanonicalJson", path, "accepts plain JSON values only.");
};

export const canonicalCombatJson = (value: unknown): string => JSON.stringify(canonicalize(value, "", new Set<object>()));

export const fnv1a64Utf8 = (input: string): string => {
  let hash = 0xcbf29ce484222325n;
  const applyByte = (byte: number): void => {
      hash ^= BigInt(byte);
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  };
  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.codePointAt(index);
    if (codePoint === undefined) continue;
    if (codePoint > 0xffff) index += 1;
    if (codePoint <= 0x7f) applyByte(codePoint);
    else if (codePoint <= 0x7ff) {
      applyByte(0xc0 | (codePoint >>> 6));
      applyByte(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      applyByte(0xe0 | (codePoint >>> 12));
      applyByte(0x80 | ((codePoint >>> 6) & 0x3f));
      applyByte(0x80 | (codePoint & 0x3f));
    } else {
      applyByte(0xf0 | (codePoint >>> 18));
      applyByte(0x80 | ((codePoint >>> 12) & 0x3f));
      applyByte(0x80 | ((codePoint >>> 6) & 0x3f));
      applyByte(0x80 | (codePoint & 0x3f));
    }
  }
  return hash.toString(16).padStart(16, "0");
};

export const combatHash = (value: unknown): string => fnv1a64Utf8(canonicalCombatJson(value));

export const deriveCombatId = <T extends string>(prefix: string, stableInput: unknown): T =>
  parseCombatId<T>(`${prefix}:${combatHash(stableInput)}`, "derivedId");

export const lexicalCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const freezeOwned = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeOwned(child);
    Object.freeze(value);
  }
  return value;
};

/** Clones canonical plain data before recursively freezing it, retaining caller ownership. */
export const deepFreeze = <T>(value: T): Readonly<T> => freezeOwned(canonicalize(value, "", new Set<object>()) as T);

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return contractError("InvalidNumber", path, "must be finite.");
  return Object.is(value, -0) ? 0 : value;
};
export const nonNegative = (value: unknown, path: string): number => {
  const result = finite(value, path);
  if (result < 0) return contractError("InvalidNumber", path, "must be non-negative.");
  return result;
};
export const positive = (value: unknown, path: string): number => {
  const result = finite(value, path);
  if (result <= 0) return contractError("InvalidNumber", path, "must be positive.");
  return result;
};
export const safeInteger = (value: unknown, path: string, allowZero = true): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    return contractError("InvalidInteger", path, allowZero ? "must be a non-negative safe integer." : "must be a positive safe integer.");
  }
  return value;
};
export const tick = (value: unknown, path = "tick"): number => safeInteger(value, path);

export const vec3 = (value: Vec3, path: string): Readonly<Vec3> => deepFreeze({
  x: finite(value?.x, `${path}.x`),
  y: finite(value?.y, `${path}.y`),
  z: finite(value?.z, `${path}.z`)
});
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, amount: number): Vec3 => ({ x: a.x * amount, y: a.y * amount, z: a.z * amount });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const magnitude = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3, path: string): Readonly<Vec3> => {
  const length = magnitude(a);
  if (!Number.isFinite(length) || length <= 0) return contractError("InvalidDirection", path, "must be non-zero and finite.");
  return vec3(scale(a, 1 / length), path);
};
export const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));
export const angle = (a: Vec3, b: Vec3): number => Math.acos(clamp(dot(normalize(a, "angle.a"), normalize(b, "angle.b")), -1, 1));

export const DAMAGE_TYPES = ["Kinetic", "Thermal", "ElectricalEmp", "Explosive", "Cutting"] as const;
export type DamageType = typeof DAMAGE_TYPES[number];
export type ResistanceMap = Readonly<Record<DamageType, number>>;

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], path: string): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) return contractError("InvalidEnum", path, `must be one of ${allowed.join(", ")}.`);
  return value as T;
};

export const resistanceMap = (value: Record<DamageType, number>, path: string): ResistanceMap => {
  const result = {} as Record<DamageType, number>;
  for (const type of DAMAGE_TYPES) {
    const resistance = finite(value?.[type], `${path}.${type}`);
    if (resistance < 0 || resistance > 1) contractError("InvalidResistance", `${path}.${type}`, "must be within [0, 1].");
    result[type] = resistance;
  }
  return deepFreeze(result);
};

export type WeaponMount =
  | { readonly kind: "Fixed"; readonly halfArcRadians: number }
  | { readonly kind: "Turret"; readonly yawLimitRadians: number; readonly pitchLimitRadians: number };
export type DeliveryRules =
  | { readonly kind: "Projectile"; readonly speedMetersPerSecond: number; readonly radiusMeters: number; readonly massKilograms: number; readonly lifetimeSeconds: number; readonly maximumPathRangeMeters: number }
  | { readonly kind: "Beam" };
export interface HeatRules { readonly heatPerShot: number; readonly maximumHeat: number; readonly coolingPerSecond: number }
export interface DamagePayload { readonly damageType: DamageType; readonly rawDamage: number }
export interface WeaponCapabilitySnapshot {
  readonly weaponId: WeaponId;
  readonly mount: WeaponMount;
  readonly delivery: DeliveryRules;
  readonly maximumRangeMeters: number;
  readonly damageType: DamageType;
  readonly rawDamage: number;
  readonly rateOfFirePerSecond: number;
  readonly maximumTrackingErrorRadians: number;
  readonly ammoPerShot: number | null;
  readonly energyPerShot: number | null;
  readonly heat: HeatRules | null;
}
export interface WeaponCapabilityInput extends Omit<WeaponCapabilitySnapshot, "weaponId"> { readonly weaponId: string }

export const createWeaponCapability = (input: WeaponCapabilityInput): Readonly<WeaponCapabilitySnapshot> => {
  let mount: WeaponMount;
  if (input.mount.kind === "Fixed") {
    mount = { kind: "Fixed", halfArcRadians: nonNegative(input.mount.halfArcRadians, "capability.mount.halfArcRadians") };
  } else if (input.mount.kind === "Turret") {
    mount = { kind: "Turret", yawLimitRadians: nonNegative(input.mount.yawLimitRadians, "capability.mount.yawLimitRadians"), pitchLimitRadians: nonNegative(input.mount.pitchLimitRadians, "capability.mount.pitchLimitRadians") };
  } else {
    mount = contractError("InvalidEnum", "capability.mount.kind", "must be Fixed or Turret.");
  }
  const delivery = input.delivery.kind === "Projectile"
    ? {
        kind: "Projectile" as const,
        speedMetersPerSecond: positive(input.delivery.speedMetersPerSecond, "capability.delivery.speedMetersPerSecond"),
        radiusMeters: positive(input.delivery.radiusMeters, "capability.delivery.radiusMeters"),
        massKilograms: positive(input.delivery.massKilograms, "capability.delivery.massKilograms"),
        lifetimeSeconds: positive(input.delivery.lifetimeSeconds, "capability.delivery.lifetimeSeconds"),
        maximumPathRangeMeters: positive(input.delivery.maximumPathRangeMeters, "capability.delivery.maximumPathRangeMeters")
      }
    : { kind: enumValue(input.delivery.kind, ["Beam"] as const, "capability.delivery.kind") };
  const ammoPerShot = input.ammoPerShot === null ? null : safeInteger(input.ammoPerShot, "capability.ammoPerShot", false);
  const energyPerShot = input.energyPerShot === null ? null : positive(input.energyPerShot, "capability.energyPerShot");
  if (ammoPerShot === null && energyPerShot === null) contractError("MissingResourceRequirement", "capability", "must require Ammo, Energy, or both.");
  const heat = input.heat === null ? null : {
    heatPerShot: positive(input.heat.heatPerShot, "capability.heat.heatPerShot"),
    maximumHeat: positive(input.heat.maximumHeat, "capability.heat.maximumHeat"),
    coolingPerSecond: nonNegative(input.heat.coolingPerSecond, "capability.heat.coolingPerSecond")
  };
  return deepFreeze({
    weaponId: parseCombatId<WeaponId>(input.weaponId, "capability.weaponId"), mount, delivery,
    maximumRangeMeters: positive(input.maximumRangeMeters, "capability.maximumRangeMeters"),
    damageType: enumValue(input.damageType, DAMAGE_TYPES, "capability.damageType"),
    rawDamage: positive(input.rawDamage, "capability.rawDamage"),
    rateOfFirePerSecond: positive(input.rateOfFirePerSecond, "capability.rateOfFirePerSecond"),
    maximumTrackingErrorRadians: nonNegative(input.maximumTrackingErrorRadians, "capability.maximumTrackingErrorRadians"),
    ammoPerShot, energyPerShot, heat
  });
};

export const WEAPON_LIFECYCLES = ["Operational", "Disabled", "Destroyed"] as const;
export type WeaponLifecycle = typeof WEAPON_LIFECYCLES[number];
export interface WeaponRuntimeState {
  readonly weaponId: WeaponId;
  readonly lifecycle: WeaponLifecycle;
  readonly cooldownSeconds: number;
  readonly ammo: number | null;
  readonly energy: number | null;
  readonly heat: number | null;
  readonly shotSequence: number;
}
export interface WeaponRuntimeStateInput extends Omit<WeaponRuntimeState, "weaponId"> { readonly weaponId: string }

export const createWeaponRuntimeState = (input: WeaponRuntimeStateInput, capability: WeaponCapabilitySnapshot): Readonly<WeaponRuntimeState> => {
  const weaponId = parseCombatId<WeaponId>(input.weaponId, "state.weaponId");
  if (weaponId !== capability.weaponId) contractError("WeaponMismatch", "state.weaponId", "must match capability weaponId.");
  if ((capability.ammoPerShot === null) !== (input.ammo === null)) contractError("ResourceStateMismatch", "state.ammo", "presence must match capability requirement.");
  if ((capability.energyPerShot === null) !== (input.energy === null)) contractError("ResourceStateMismatch", "state.energy", "presence must match capability requirement.");
  if ((capability.heat === null) !== (input.heat === null)) contractError("HeatStateMismatch", "state.heat", "presence must match capability heat rules.");
  return deepFreeze({
    weaponId,
    lifecycle: enumValue(input.lifecycle, WEAPON_LIFECYCLES, "state.lifecycle"),
    cooldownSeconds: nonNegative(input.cooldownSeconds, "state.cooldownSeconds"),
    ammo: input.ammo === null ? null : safeInteger(input.ammo, "state.ammo"),
    energy: input.energy === null ? null : nonNegative(input.energy, "state.energy"),
    heat: input.heat === null ? null : nonNegative(input.heat, "state.heat"),
    shotSequence: safeInteger(input.shotSequence, "state.shotSequence")
  });
};

export interface WeaponMountPose {
  readonly sourceEntityId: EntityId;
  readonly ownerId: OwnerId;
  readonly frameId: FrameId;
  readonly muzzlePosition: Readonly<Vec3>;
  readonly forward: Readonly<Vec3>;
  readonly up: Readonly<Vec3>;
  readonly right: Readonly<Vec3>;
  readonly muzzleDirection: Readonly<Vec3>;
  readonly sourceVelocity: Readonly<Vec3>;
}
export interface WeaponMountPoseInput extends Omit<WeaponMountPose, "sourceEntityId" | "ownerId" | "frameId" | "muzzlePosition" | "forward" | "up" | "right" | "muzzleDirection" | "sourceVelocity"> {
  readonly sourceEntityId: string; readonly ownerId: string; readonly frameId: string; readonly muzzlePosition: Vec3; readonly forward: Vec3; readonly up: Vec3; readonly muzzleDirection: Vec3; readonly sourceVelocity: Vec3;
}
export const createWeaponMountPose = (input: WeaponMountPoseInput): Readonly<WeaponMountPose> => {
  const forward = normalize(vec3(input.forward, "pose.forward"), "pose.forward");
  const up = normalize(vec3(input.up, "pose.up"), "pose.up");
  if (Math.abs(dot(forward, up)) > 1e-9) contractError("InvalidPoseBasis", "pose.up", "must be orthogonal to forward within 1e-9.");
  return deepFreeze({
    sourceEntityId: parseCombatId<EntityId>(input.sourceEntityId, "pose.sourceEntityId"),
    ownerId: parseCombatId<OwnerId>(input.ownerId, "pose.ownerId"), frameId: parseCombatId<FrameId>(input.frameId, "pose.frameId"),
    muzzlePosition: vec3(input.muzzlePosition, "pose.muzzlePosition"), forward, up,
    right: normalize(cross(up, forward), "pose.right"), muzzleDirection: normalize(vec3(input.muzzleDirection, "pose.muzzleDirection"), "pose.muzzleDirection"),
    sourceVelocity: vec3(input.sourceVelocity, "pose.sourceVelocity")
  });
};

export const TARGET_LIFECYCLES = ["Active", "Destroyed"] as const;
export type TargetLifecycle = typeof TARGET_LIFECYCLES[number];
export interface CombatTargetSnapshot { readonly targetId: EntityId; readonly ownerId: OwnerId; readonly frameId: FrameId; readonly tick: number; readonly position: Readonly<Vec3>; readonly velocity: Readonly<Vec3>; readonly targetable: boolean; readonly lifecycle: TargetLifecycle }
export interface CombatTargetInput extends Omit<CombatTargetSnapshot, "targetId" | "ownerId" | "frameId" | "position" | "velocity"> { readonly targetId: string; readonly ownerId: string; readonly frameId: string; readonly position: Vec3; readonly velocity: Vec3 }
export const createCombatTarget = (input: CombatTargetInput): Readonly<CombatTargetSnapshot> => deepFreeze({
  targetId: parseCombatId<EntityId>(input.targetId, "target.targetId"), ownerId: parseCombatId<OwnerId>(input.ownerId, "target.ownerId"), frameId: parseCombatId<FrameId>(input.frameId, "target.frameId"),
  tick: tick(input.tick, "target.tick"), position: vec3(input.position, "target.position"), velocity: vec3(input.velocity, "target.velocity"),
  targetable: typeof input.targetable === "boolean" ? input.targetable : contractError("InvalidBoolean", "target.targetable", "must be boolean."),
  lifecycle: enumValue(input.lifecycle, TARGET_LIFECYCLES, "target.lifecycle")
});

export const selectCombatTargetById = (targets: readonly CombatTargetSnapshot[], requestedId: string): Readonly<CombatTargetSnapshot> | null => {
  const targetId = parseCombatId<EntityId>(requestedId, "requestedTargetId");
  const seen = new Set<string>();
  let match: Readonly<CombatTargetSnapshot> | null = null;
  for (const raw of targets) {
    const target = createCombatTarget(raw);
    if (seen.has(target.targetId)) contractError("DuplicateTargetId", "targets", `contains duplicate ${target.targetId}.`);
    seen.add(target.targetId);
    if (target.targetId === targetId) match = target;
  }
  return match;
};

export type CollisionProxy = SphereCollisionProxy | AabbCollisionProxy;
interface CollisionProxyBase { readonly proxyId: ProxyId; readonly entityId: EntityId; readonly moduleId: ModuleId | null; readonly frameId: FrameId }
export interface SphereCollisionProxy extends CollisionProxyBase { readonly kind: "Sphere"; readonly center: Readonly<Vec3>; readonly radiusMeters: number }
export interface AabbCollisionProxy extends CollisionProxyBase { readonly kind: "Aabb"; readonly minimum: Readonly<Vec3>; readonly maximum: Readonly<Vec3> }
export type CollisionProxyInput =
  | { readonly kind: "Sphere"; readonly proxyId: string; readonly entityId: string; readonly moduleId: string | null; readonly frameId: string; readonly center: Vec3; readonly radiusMeters: number }
  | { readonly kind: "Aabb"; readonly proxyId: string; readonly entityId: string; readonly moduleId: string | null; readonly frameId: string; readonly minimum: Vec3; readonly maximum: Vec3 };
export const createCollisionProxy = (input: CollisionProxyInput): Readonly<CollisionProxy> => {
  const base = { proxyId: parseCombatId<ProxyId>(input.proxyId, "proxy.proxyId"), entityId: parseCombatId<EntityId>(input.entityId, "proxy.entityId"), moduleId: input.moduleId === null ? null : parseCombatId<ModuleId>(input.moduleId, "proxy.moduleId"), frameId: parseCombatId<FrameId>(input.frameId, "proxy.frameId") };
  if (input.kind === "Sphere") return deepFreeze({ ...base, kind: "Sphere", center: vec3(input.center, "proxy.center"), radiusMeters: positive(input.radiusMeters, "proxy.radiusMeters") });
  if (input.kind !== "Aabb") return contractError("InvalidEnum", "proxy.kind", "must be Sphere or Aabb.");
  const minimum = vec3(input.minimum, "proxy.minimum"); const maximum = vec3(input.maximum, "proxy.maximum");
  for (const axis of ["x", "y", "z"] as const) if (minimum[axis] >= maximum[axis]) contractError("InvalidAabb", `proxy.${axis}`, "minimum must be less than maximum.");
  return deepFreeze({ ...base, kind: "Aabb", minimum, maximum });
};

export interface RayDelivery { readonly kind: "Beam"; readonly sourceEntityId: EntityId; readonly weaponId: WeaponId; readonly frameId: FrameId; readonly tick: number; readonly shotSequence: number; readonly origin: Readonly<Vec3>; readonly direction: Readonly<Vec3>; readonly maximumDistanceMeters: number; readonly payload: Readonly<DamagePayload> }
export interface ProjectileState { readonly kind: "Projectile"; readonly projectileId: ProjectileId; readonly sourceEntityId: EntityId; readonly weaponId: WeaponId; readonly frameId: FrameId; readonly spawnTick: number; readonly shotSequence: number; readonly position: Readonly<Vec3>; readonly velocity: Readonly<Vec3>; readonly radiusMeters: number; readonly massKilograms: number; readonly remainingLifetimeSeconds: number; readonly remainingRangeMeters: number; readonly traveledDistanceMeters: number; readonly payload: Readonly<DamagePayload> }

export interface HitResult { readonly hitId: HitId; readonly deliveryKind: "Projectile" | "Beam"; readonly sourceEntityId: EntityId; readonly targetEntityId: EntityId; readonly weaponId: WeaponId; readonly projectileId: ProjectileId | null; readonly proxyId: ProxyId; readonly moduleId: ModuleId | null; readonly tick: number; readonly frameId: FrameId; readonly point: Readonly<Vec3>; readonly normal: Readonly<Vec3>; readonly distanceMeters: number; readonly segmentFraction: number; readonly incomingDirection: Readonly<Vec3>; readonly incomingSpeedMetersPerSecond: number | null }
export interface HitResultInput extends Omit<HitResult, "hitId" | "sourceEntityId" | "targetEntityId" | "weaponId" | "projectileId" | "proxyId" | "moduleId" | "frameId" | "point" | "normal" | "incomingDirection"> {
  readonly hitId: string; readonly sourceEntityId: string; readonly targetEntityId: string; readonly weaponId: string; readonly projectileId: string | null; readonly proxyId: string; readonly moduleId: string | null; readonly frameId: string; readonly point: Vec3; readonly normal: Vec3; readonly incomingDirection: Vec3;
}
const preserveUnitVector = (input: Vec3, path: string): Readonly<Vec3> => {
  const value = vec3(input, path);
  const length = magnitude(value);
  if (length <= 0 || Math.abs(length - 1) > 1e-9) contractError("InvalidUnitVector", path, "must have unit length within 1e-9.");
  return value;
};
export const createHitResult = (input: HitResultInput): Readonly<HitResult> => {
  if (input === null || typeof input !== "object") contractError("InvalidHit", "hit", "must be an object.");
  if (input.deliveryKind !== "Projectile" && input.deliveryKind !== "Beam") contractError("InvalidEnum", "hit.deliveryKind", "must be Projectile or Beam.");
  const projectileId = input.projectileId === null ? null : parseCombatId<ProjectileId>(input.projectileId, "hit.projectileId");
  if ((input.deliveryKind === "Projectile") !== (projectileId !== null)) contractError("DeliveryIdentityMismatch", "hit.projectileId", "presence must match delivery kind.");
  const incomingSpeedMetersPerSecond = input.incomingSpeedMetersPerSecond === null ? null : positive(input.incomingSpeedMetersPerSecond, "hit.incomingSpeedMetersPerSecond");
  if ((input.deliveryKind === "Projectile") !== (incomingSpeedMetersPerSecond !== null)) contractError("DeliverySpeedMismatch", "hit.incomingSpeedMetersPerSecond", "presence must match delivery kind.");
  const segmentFraction = finite(input.segmentFraction, "hit.segmentFraction");
  if (segmentFraction < 0 || segmentFraction > 1) contractError("InvalidFraction", "hit.segmentFraction", "must be within [0, 1].");
  return deepFreeze({
    hitId: parseCombatId<HitId>(input.hitId, "hit.hitId"), deliveryKind: input.deliveryKind,
    sourceEntityId: parseCombatId<EntityId>(input.sourceEntityId, "hit.sourceEntityId"), targetEntityId: parseCombatId<EntityId>(input.targetEntityId, "hit.targetEntityId"),
    weaponId: parseCombatId<WeaponId>(input.weaponId, "hit.weaponId"), projectileId,
    proxyId: parseCombatId<ProxyId>(input.proxyId, "hit.proxyId"), moduleId: input.moduleId === null ? null : parseCombatId<ModuleId>(input.moduleId, "hit.moduleId"),
    tick: tick(input.tick, "hit.tick"), frameId: parseCombatId<FrameId>(input.frameId, "hit.frameId"),
    point: vec3(input.point, "hit.point"), normal: preserveUnitVector(input.normal, "hit.normal"),
    distanceMeters: nonNegative(input.distanceMeters, "hit.distanceMeters"), segmentFraction,
    incomingDirection: preserveUnitVector(input.incomingDirection, "hit.incomingDirection"), incomingSpeedMetersPerSecond
  });
};

export const MODULE_ROLES = ["MainThrust", "Rcs", "Weapon", "Sensor", "Cargo", "Other"] as const;
export type ModuleRole = typeof MODULE_ROLES[number];
export const MODULE_STATUSES = ["Operational", "Degraded", "Disabled", "Destroyed"] as const;
export type ModuleStatus = typeof MODULE_STATUSES[number];
export type DisabledRecoverability = "Recoverable" | "RequiresReplacement";
export interface IntegrityLayer { readonly current: number; readonly maximum: number; readonly resistances: ResistanceMap }
export interface DamageableModule extends IntegrityLayer { readonly moduleId: ModuleId; readonly role: ModuleRole; readonly degradedThreshold: number; readonly disabledThreshold: number; readonly disabledRecoverability: DisabledRecoverability; readonly status: ModuleStatus }
export interface DamageableSnapshot { readonly targetEntityId: EntityId; readonly armor: IntegrityLayer; readonly hull: IntegrityLayer; readonly modules: readonly DamageableModule[] }
export interface IntegrityLayerInput { readonly current: number; readonly maximum: number; readonly resistances: Record<DamageType, number> }
export interface DamageableModuleInput extends IntegrityLayerInput { readonly moduleId: string; readonly role: ModuleRole; readonly degradedThreshold: number; readonly disabledThreshold: number; readonly disabledRecoverability: DisabledRecoverability }
export interface DamageableInput { readonly targetEntityId: string; readonly armor: IntegrityLayerInput; readonly hull: IntegrityLayerInput; readonly modules: readonly DamageableModuleInput[] }

const createLayer = (input: IntegrityLayerInput, path: string): IntegrityLayer => {
  const maximum = nonNegative(input.maximum, `${path}.maximum`); const current = nonNegative(input.current, `${path}.current`);
  if (current > maximum) contractError("InvalidIntegrity", `${path}.current`, "must not exceed maximum.");
  return deepFreeze({ current, maximum, resistances: resistanceMap(input.resistances, `${path}.resistances`) });
};
export const deriveModuleStatus = (integrity: number, degradedThreshold: number, disabledThreshold: number): ModuleStatus => integrity === 0 ? "Destroyed" : integrity <= disabledThreshold ? "Disabled" : integrity <= degradedThreshold ? "Degraded" : "Operational";
export const createDamageableSnapshot = (input: DamageableInput): Readonly<DamageableSnapshot> => {
  const moduleIds = new Set<string>();
  const modules = input.modules.map((module, index): DamageableModule => {
    const path = `damageable.modules[${index}]`; const layer = createLayer(module, path); const moduleId = parseCombatId<ModuleId>(module.moduleId, `${path}.moduleId`);
    if (moduleIds.has(moduleId)) contractError("DuplicateModuleId", `${path}.moduleId`, "must be unique."); moduleIds.add(moduleId);
    const degradedThreshold = nonNegative(module.degradedThreshold, `${path}.degradedThreshold`); const disabledThreshold = nonNegative(module.disabledThreshold, `${path}.disabledThreshold`);
    if (disabledThreshold > degradedThreshold || degradedThreshold > layer.maximum) contractError("InvalidThresholds", path, "must satisfy 0 <= disabled <= degraded <= maximum.");
    return deepFreeze({ ...layer, moduleId, role: enumValue(module.role, MODULE_ROLES, `${path}.role`), degradedThreshold, disabledThreshold, disabledRecoverability: enumValue(module.disabledRecoverability, ["Recoverable", "RequiresReplacement"] as const, `${path}.disabledRecoverability`), status: deriveModuleStatus(layer.current, degradedThreshold, disabledThreshold) });
  }).sort((a, b) => lexicalCompare(a.moduleId, b.moduleId));
  return deepFreeze({ targetEntityId: parseCombatId<EntityId>(input.targetEntityId, "damageable.targetEntityId"), armor: createLayer(input.armor, "damageable.armor"), hull: createLayer(input.hull, "damageable.hull"), modules });
};

export interface DamagePacket { readonly packetId: DamagePacketId; readonly sourceEntityId: EntityId; readonly targetEntityId: EntityId; readonly weaponId: WeaponId; readonly hitId: HitId; readonly moduleId: ModuleId | null; readonly damageType: DamageType; readonly rawDamage: number; readonly tick: number }
