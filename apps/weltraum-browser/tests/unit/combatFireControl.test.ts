import { describe, expect, it } from "vitest";
import {
  CombatContractError,
  advanceWeaponRuntimeState,
  combatTargetFixture,
  createWeaponCapability,
  createWeaponMountPose,
  evaluateFirePermission,
  fireWeapon,
  selectCombatTargetById,
  weaponCapabilityFixture,
  weaponMountPoseFixture,
  weaponRuntimeStateFixture,
  type WeaponFireRequest
} from "../../src/combat";

const requestFixture = (overrides: Partial<WeaponFireRequest> = {}): WeaponFireRequest => {
  const capability = overrides.capability ?? weaponCapabilityFixture();
  return {
    capability,
    state: overrides.state ?? weaponRuntimeStateFixture(capability),
    pose: overrides.pose ?? weaponMountPoseFixture(),
    target: overrides.target === undefined ? combatTargetFixture() : overrides.target,
    tick: overrides.tick ?? 12,
    policy: overrides.policy ?? { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" },
    lineOfFire: overrides.lineOfFire ?? "Clear"
  };
};

describe("combat fire control", () => {
  it("fires a valid Fixed Projectile shot atomically without applying a hit", () => {
    const capability = weaponCapabilityFixture({ ammoPerShot: 2, energyPerShot: 5, heat: { heatPerShot: 3, maximumHeat: 10, coolingPerSecond: 1 } });
    const state = weaponRuntimeStateFixture(capability, { ammo: 4, energy: 7, heat: 7 });
    const request = requestFixture({ capability, state });
    const before = JSON.stringify(request);
    const result = fireWeapon(request);
    expect(result.accepted).toBe(true);
    expect(result.state).toMatchObject({ ammo: 2, energy: 2, heat: 10, cooldownSeconds: 0.5, shotSequence: 1 });
    expect(result.delivery?.kind).toBe("Projectile");
    expect(result.events.map((event) => event.phase)).toEqual(["WeaponFire", "ProjectileSpawned"]);
    expect(result.events.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(request)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("accepts a Turret Beam inside inclusive yaw, pitch, and tracking bounds", () => {
    const capability = weaponCapabilityFixture({
      mount: { kind: "Turret", yawLimitRadians: Math.PI / 4, pitchLimitRadians: Math.PI / 4 },
      delivery: { kind: "Beam" }, maximumTrackingErrorRadians: Math.PI / 4
    });
    const target = combatTargetFixture({ position: { x: 100, y: 0, z: 100 } });
    const pose = weaponMountPoseFixture({ muzzleDirection: { x: 1, y: 0, z: 1 } });
    const result = fireWeapon(requestFixture({ capability, state: weaponRuntimeStateFixture(capability), target, pose }));
    expect(result.evaluation).toEqual({ allowed: true, blockers: [], primaryReason: null });
    expect(result.delivery).toMatchObject({ kind: "Beam", ray: { maximumDistanceMeters: 1000 } });
    expect(result.events.map((event) => event.phase)).toEqual(["WeaponFire"]);
  });

  it("reports each geometry blocker and invalid target deterministically", () => {
    expect(evaluateFirePermission(requestFixture({ target: null })).blockers).toEqual(["NoTarget"]);
    expect(evaluateFirePermission(requestFixture({ target: combatTargetFixture({ frameId: "frame:other" }) })).blockers).toEqual(["TargetInvalid"]);
    expect(evaluateFirePermission(requestFixture({ target: combatTargetFixture({ position: { x: 0, y: 0, z: 1001 } }) })).blockers).toEqual(["OutOfRange"]);
    expect(evaluateFirePermission(requestFixture({ target: combatTargetFixture({ position: { x: 100, y: 0, z: 0 } }) })).blockers).toContain("OutsideArc");
    const turret = weaponCapabilityFixture({ mount: { kind: "Turret", yawLimitRadians: 1, pitchLimitRadians: 1 }, maximumTrackingErrorRadians: 0.01 });
    expect(evaluateFirePermission(requestFixture({ capability: turret, state: weaponRuntimeStateFixture(turret), target: combatTargetFixture({ position: { x: 5, y: 0, z: 100 } }) })).blockers).toEqual(["NotAligned"]);
  });

  it("returns all runtime and policy blockers in the exact prescribed order", () => {
    const capability = weaponCapabilityFixture({ ammoPerShot: 2, energyPerShot: 3, heat: { heatPerShot: 2, maximumHeat: 4, coolingPerSecond: 0 } });
    const state = weaponRuntimeStateFixture(capability, { lifecycle: "Disabled", cooldownSeconds: 1, ammo: 0, energy: 2, heat: 3 });
    const evaluation = evaluateFirePermission(requestFixture({ capability, state, target: null, policy: { relation: "Friendly", friendlyFire: "Denied", permission: "Denied" }, lineOfFire: "Blocked" }));
    expect(evaluation.blockers).toEqual(["NoTarget", "CooldownActive", "AmmoEmpty", "EnergyInsufficient", "Overheated", "FirePermissionDenied", "LineOfFireBlocked"]);
    expect(evaluation.primaryReason).toBe("NoTarget");
  });

  it("keeps blocked hybrid fire completely inert when either pool is short", () => {
    const capability = weaponCapabilityFixture({ ammoPerShot: 2, energyPerShot: 5 });
    const state = weaponRuntimeStateFixture(capability, { ammo: 2, energy: 4 });
    const result = fireWeapon(requestFixture({ capability, state }));
    expect(result).toMatchObject({ accepted: false, state, delivery: null, events: [] });
    expect(result.state).not.toBe(state);
    expect(result.evaluation.blockers).toEqual(["EnergyInsufficient"]);
  });

  it("clones blocked state without freezing or mutating caller-owned input", () => {
    const capability = weaponCapabilityFixture();
    const mutableState = { ...weaponRuntimeStateFixture(capability), cooldownSeconds: 1 };
    const before = { ...mutableState };
    expect(Object.isFrozen(mutableState)).toBe(false);
    expect(Object.isExtensible(mutableState)).toBe(true);
    const result = fireWeapon(requestFixture({ capability, state: mutableState }));
    expect(result.accepted).toBe(false);
    expect(result.state).toEqual(before);
    expect(result.state).not.toBe(mutableState);
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(mutableState).toEqual(before);
    expect(Object.isFrozen(mutableState)).toBe(false);
    expect(Object.isExtensible(mutableState)).toBe(true);
  });

  it("keeps later non-geometric blockers when a present Target is invalid", () => {
    const capability = weaponCapabilityFixture({ ammoPerShot: 2, energyPerShot: 3, heat: { heatPerShot: 2, maximumHeat: 4, coolingPerSecond: 0 } });
    const state = weaponRuntimeStateFixture(capability, { lifecycle: "Disabled", cooldownSeconds: 1, ammo: 0, energy: 2, heat: 3 });
    const evaluation = evaluateFirePermission(requestFixture({
      capability, state, target: combatTargetFixture({ frameId: "frame:other" }),
      policy: { relation: "Friendly", friendlyFire: "Denied", permission: "Denied" }, lineOfFire: "Blocked"
    }));
    expect(evaluation.blockers).toEqual(["TargetInvalid", "CooldownActive", "AmmoEmpty", "EnergyInsufficient", "Overheated", "FirePermissionDenied", "LineOfFireBlocked"]);
  });

  it("accepts exact range, heat, and arc boundaries but blocks strict excess", () => {
    const capability = weaponCapabilityFixture({ maximumRangeMeters: 100, mount: { kind: "Fixed", halfArcRadians: 0 }, heat: { heatPerShot: 2, maximumHeat: 5, coolingPerSecond: 1 } });
    const exact = requestFixture({ capability, state: weaponRuntimeStateFixture(capability, { heat: 3 }), target: combatTargetFixture({ position: { x: 0, y: 0, z: 100 } }) });
    expect(evaluateFirePermission(exact).allowed).toBe(true);
    expect(evaluateFirePermission({ ...exact, state: weaponRuntimeStateFixture(capability, { heat: 3.000001 }) }).blockers).toContain("Overheated");
  });

  it("cools cooldown and heat without regenerating resources", () => {
    const capability = weaponCapabilityFixture({ heat: { heatPerShot: 2, maximumHeat: 10, coolingPerSecond: 3 } });
    const state = weaponRuntimeStateFixture(capability, { cooldownSeconds: 2, heat: 5, ammo: 7 });
    const advanced = advanceWeaponRuntimeState(state, 1.5, capability);
    expect(advanced).toMatchObject({ cooldownSeconds: 0.5, heat: 0.5, ammo: 7 });
    expect(state).toMatchObject({ cooldownSeconds: 2, heat: 5 });
  });

  it("selects only by stable ID, rejects duplicates, and validates malformed contracts", () => {
    const a = combatTargetFixture({ targetId: "ship:a", position: { x: 999, y: 0, z: 0 } });
    const b = combatTargetFixture({ targetId: "ship:b", position: { x: 1, y: 0, z: 0 } });
    expect(selectCombatTargetById([b, a], "ship:a")?.targetId).toBe("ship:a");
    expect(() => selectCombatTargetById([a, a], "ship:a")).toThrowError(CombatContractError);
    expect(() => createWeaponCapability({ ...weaponCapabilityFixture(), weaponId: "bad id" })).toThrowError(CombatContractError);
    expect(() => createWeaponMountPose({ ...weaponMountPoseFixture(), forward: { x: 0, y: 0, z: 0 } })).toThrowError(CombatContractError);
    expect(() => createWeaponMountPose({ ...weaponMountPoseFixture(), up: { x: 0, y: 0, z: 1 } })).toThrowError(CombatContractError);
  });
});
