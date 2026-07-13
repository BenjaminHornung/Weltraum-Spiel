import { describe, expect, it } from "vitest";
import {
  CombatContractError,
  applyDamage,
  combatTargetFixture,
  createDamagePacketFromHit,
  createDamageableSnapshot,
  damageableFixture,
  damageableModuleFixture,
  fireWeapon,
  resolveBeamHit,
  sphereCollisionProxyFixture,
  weaponCapabilityFixture,
  weaponMountPoseFixture,
  weaponRuntimeStateFixture,
  zeroResistanceFixture,
  type DamagePayload,
  type HitResult,
  type ModuleRole
} from "../../src/combat";

const hitFixture = (moduleId: string | null = "module:weapon"): Readonly<HitResult> => {
  const capability = weaponCapabilityFixture({ delivery: { kind: "Beam" } });
  const fired = fireWeapon({ capability, state: weaponRuntimeStateFixture(capability), pose: weaponMountPoseFixture(), target: combatTargetFixture(), tick: 30, policy: { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" }, lineOfFire: "Clear" });
  if (fired.delivery?.kind !== "Beam") throw new Error("Expected Beam fixture.");
  const resolved = resolveBeamHit(fired.delivery.ray, [sphereCollisionProxyFixture({ moduleId })], 31);
  if (resolved === null) throw new Error("Expected Hit fixture.");
  return resolved.hit;
};
const packetFixture = (payload: DamagePayload = { damageType: "Kinetic", rawDamage: 100 }, moduleId: string | null = "module:weapon") => createDamagePacketFromHit(hitFixture(moduleId), payload);

describe("combat Damage", () => {
  it("applies Armor first, then independently damages Hull and the explicit Module", () => {
    const damageable = damageableFixture({ modules: [damageableModuleFixture({ resistances: zeroResistanceFixture({ Kinetic: 0.5 }) })] });
    const before = JSON.stringify(damageable); const result = applyDamage(packetFixture(), damageable);
    expect(result).toMatchObject({ armorDamage: 20, penetratingDamage: 80, hullDamage: 80, moduleDamage: 40, effects: ["WeaponDisabled"], moduleRecoverability: "Recoverable" });
    expect(result.after).toMatchObject({ armor: { current: 0 }, hull: { current: 20 }, modules: [{ current: 20, status: "Disabled" }] });
    expect(result.events.map((event) => event.phase)).toEqual(["DamageApplied", "ModuleStateChanged"]);
    expect(JSON.stringify(damageable)).toBe(before);
    expect(Object.isFrozen(result.after.modules)).toBe(true);
  });

  it("uses the selected Damage Type Resistance", () => {
    const damageable = damageableFixture({ armor: { current: 100, maximum: 100, resistances: zeroResistanceFixture({ Kinetic: 0.5, ElectricalEmp: 0 }) }, modules: [] });
    const kinetic = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 40 }, null), damageable);
    const emp = applyDamage(packetFixture({ damageType: "ElectricalEmp", rawDamage: 40 }, null), damageable);
    expect(kinetic.armorDamage).toBe(20);
    expect(emp.armorDamage).toBe(40);
  });

  it("damages no Module when omitted and rejects an unknown explicit Module", () => {
    const damageable = damageableFixture();
    const absent = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 100 }, null), damageable);
    expect(absent.moduleDamage).toBe(0);
    expect(absent.after.modules).toEqual(damageable.modules);
    expect(() => applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 100 }, "module:missing"), damageable)).toThrowError(CombatContractError);
  });

  it("derives Degraded, Disabled, and sticky Destroyed states with recoverability", () => {
    const base = damageableFixture({ armor: { current: 0, maximum: 0, resistances: zeroResistanceFixture() }, modules: [damageableModuleFixture({ current: 80 })] });
    const degraded = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 15 }), base);
    expect(degraded.after.modules[0].status).toBe("Degraded");
    const disabled = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 40 }), degraded.after);
    expect(disabled.after.modules[0].status).toBe("Disabled");
    expect(disabled.moduleRecoverability).toBe("Recoverable");
    const destroyed = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 100 }), disabled.after);
    expect(destroyed.after.modules[0]).toMatchObject({ current: 0, status: "Destroyed" });
    expect(destroyed.moduleRecoverability).toBe("RequiresReplacement");
    const again = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 100 }), destroyed.after);
    expect(again.after.modules[0]).toMatchObject({ current: 0, status: "Destroyed" });
    expect(again.events.map((event) => event.phase)).toEqual(["DamageApplied"]);
  });

  it.each([
    ["MainThrust", "MainThrustAuthorityReduced"],
    ["Rcs", "RcsAuthorityReduced"],
    ["Weapon", "WeaponDisabled"],
    ["Sensor", "SensorDegraded"],
    ["Cargo", "CargoBreach"]
  ] as const)("returns the semantic %s effect without applying runtime side effects", (role, effect) => {
    const damageable = damageableFixture({ armor: { current: 0, maximum: 0, resistances: zeroResistanceFixture() }, modules: [damageableModuleFixture({ role: role as ModuleRole, current: 40 })] });
    expect(applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 20 }), damageable).effects).toEqual([effect]);
  });

  it("returns no semantic effect for the Other Module role", () => {
    const damageable = damageableFixture({
      armor: { current: 0, maximum: 0, resistances: zeroResistanceFixture() },
      modules: [damageableModuleFixture({ role: "Other", current: 40 })]
    });
    const result = applyDamage(packetFixture({ damageType: "Kinetic", rawDamage: 20 }), damageable);
    expect(result.after.modules[0].status).toBe("Disabled");
    expect(result.effects).toEqual([]);
  });

  it("emits TargetDestroyed only for the first positive-to-zero Hull transition", () => {
    const damageable = damageableFixture({ armor: { current: 0, maximum: 0, resistances: zeroResistanceFixture() }, hull: { current: 10, maximum: 100, resistances: zeroResistanceFixture() }, modules: [] });
    const first = applyDamage(packetFixture({ damageType: "Explosive", rawDamage: 50 }, null), damageable);
    expect(first.after.hull.current).toBe(0);
    expect(first.events.map((event) => event.phase)).toEqual(["DamageApplied", "TargetDestroyed"]);
    const later = applyDamage(packetFixture({ damageType: "Explosive", rawDamage: 50 }, null), first.after);
    expect(later.events.map((event) => event.phase)).toEqual(["DamageApplied"]);
  });

  it("clamps all integrity and rejects NaN/Infinity inputs", () => {
    const result = applyDamage(packetFixture({ damageType: "Cutting", rawDamage: 1_000_000 }), damageableFixture());
    expect(result.after.armor.current).toBe(0);
    expect(result.after.hull.current).toBe(0);
    expect(result.after.modules[0].current).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|-\d/);
    expect(() => createDamageableSnapshot({ targetEntityId: "ship:target", armor: { current: Number.NaN, maximum: 1, resistances: zeroResistanceFixture() }, hull: { current: 1, maximum: 1, resistances: zeroResistanceFixture() }, modules: [] })).toThrowError(CombatContractError);
    expect(() => createDamageableSnapshot({ targetEntityId: "ship:target", armor: { current: 0, maximum: 1, resistances: zeroResistanceFixture({ Thermal: Number.POSITIVE_INFINITY }) }, hull: { current: 1, maximum: 1, resistances: zeroResistanceFixture() }, modules: [] })).toThrowError(CombatContractError);
  });
});
