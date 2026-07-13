import {
  createCollisionProxy,
  createCombatTarget,
  createDamageableSnapshot,
  createWeaponCapability,
  createWeaponMountPose,
  createWeaponRuntimeState,
  type CollisionProxyInput,
  type CombatTargetInput,
  type DamageType,
  type DamageableInput,
  type DamageableModuleInput,
  type ResistanceMap,
  type WeaponCapabilityInput,
  type WeaponMountPoseInput,
  type WeaponRuntimeStateInput
} from "./contracts";

export const zeroResistanceFixture = (overrides: Partial<Record<DamageType, number>> = {}): ResistanceMap => ({
  Kinetic: 0, Thermal: 0, ElectricalEmp: 0, Explosive: 0, Cutting: 0, ...overrides
});

export const weaponCapabilityFixture = (overrides: Partial<WeaponCapabilityInput> = {}) => createWeaponCapability({
  weaponId: "weapon:fixture",
  mount: { kind: "Fixed", halfArcRadians: Math.PI / 4 },
  delivery: { kind: "Projectile", speedMetersPerSecond: 100, radiusMeters: 0.5, massKilograms: 2, lifetimeSeconds: 10, maximumPathRangeMeters: 1000 },
  maximumRangeMeters: 1000,
  damageType: "Kinetic",
  rawDamage: 40,
  rateOfFirePerSecond: 2,
  maximumTrackingErrorRadians: 0.05,
  ammoPerShot: 1,
  energyPerShot: null,
  heat: null,
  ...overrides
});

export const weaponRuntimeStateFixture = (capability = weaponCapabilityFixture(), overrides: Partial<WeaponRuntimeStateInput> = {}) => createWeaponRuntimeState({
  weaponId: capability.weaponId,
  lifecycle: "Operational",
  cooldownSeconds: 0,
  ammo: capability.ammoPerShot === null ? null : 10,
  energy: capability.energyPerShot === null ? null : 100,
  heat: capability.heat === null ? null : 0,
  shotSequence: 0,
  ...overrides
}, capability);

export const weaponMountPoseFixture = (overrides: Partial<WeaponMountPoseInput> = {}) => createWeaponMountPose({
  sourceEntityId: "ship:source",
  ownerId: "owner:source",
  frameId: "frame:combat",
  muzzlePosition: { x: 0, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
  up: { x: 0, y: 1, z: 0 },
  muzzleDirection: { x: 0, y: 0, z: 1 },
  sourceVelocity: { x: 0, y: 0, z: 0 },
  ...overrides
});

export const combatTargetFixture = (overrides: Partial<CombatTargetInput> = {}) => createCombatTarget({
  targetId: "ship:target",
  ownerId: "owner:target",
  frameId: "frame:combat",
  tick: 10,
  position: { x: 0, y: 0, z: 100 },
  velocity: { x: 0, y: 0, z: 0 },
  targetable: true,
  lifecycle: "Active",
  ...overrides
});

export const sphereCollisionProxyFixture = (overrides: Partial<Extract<CollisionProxyInput, { kind: "Sphere" }>> = {}) => createCollisionProxy({
  kind: "Sphere", proxyId: "proxy:target", entityId: "ship:target", moduleId: null, frameId: "frame:combat", center: { x: 0, y: 0, z: 100 }, radiusMeters: 2, ...overrides
});
export const aabbCollisionProxyFixture = (overrides: Partial<Extract<CollisionProxyInput, { kind: "Aabb" }>> = {}) => createCollisionProxy({
  kind: "Aabb", proxyId: "proxy:target", entityId: "ship:target", moduleId: null, frameId: "frame:combat", minimum: { x: -2, y: -2, z: 98 }, maximum: { x: 2, y: 2, z: 102 }, ...overrides
});

export const damageableModuleFixture = (overrides: Partial<DamageableModuleInput> = {}): DamageableModuleInput => ({
  moduleId: "module:weapon", role: "Weapon", current: 60, maximum: 100, resistances: zeroResistanceFixture(), degradedThreshold: 70, disabledThreshold: 30, disabledRecoverability: "Recoverable", ...overrides
});
export const damageableFixture = (overrides: Partial<DamageableInput> = {}) => createDamageableSnapshot({
  targetEntityId: "ship:target",
  armor: { current: 20, maximum: 20, resistances: zeroResistanceFixture() },
  hull: { current: 100, maximum: 100, resistances: zeroResistanceFixture() },
  modules: [damageableModuleFixture()],
  ...overrides
});
