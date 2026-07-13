import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CombatContractError,
  applyDamage,
  canonicalCombatJson,
  combatHash,
  combatTargetFixture,
  createCanonicalCombatEventSequence,
  createDamagePacketFromHit,
  createHitEvent,
  createModuleStateChangedEvent,
  createProjectileExpiredEvent,
  damageableFixture,
  damageableModuleFixture,
  fireWeapon,
  fnv1a64Utf8,
  resolveBeamHit,
  sortCombatEvents,
  sphereCollisionProxyFixture,
  weaponCapabilityFixture,
  weaponMountPoseFixture,
  weaponRuntimeStateFixture,
  zeroResistanceFixture,
  type CombatEvent,
  type DamagePacket,
  type HitEvent,
  type HitResult,
  type ModuleStateChangedEvent,
  type ProjectileExpiredEvent
} from "../../src/combat";

const allEventFixture = (): readonly CombatEvent[] => {
  const projectileCapability = weaponCapabilityFixture();
  const firedProjectile = fireWeapon({ capability: projectileCapability, state: weaponRuntimeStateFixture(projectileCapability), pose: weaponMountPoseFixture(), target: combatTargetFixture(), tick: 50, policy: { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" }, lineOfFire: "Clear" });
  if (firedProjectile.delivery?.kind !== "Projectile") throw new Error("Expected Projectile fixture.");
  const projectile = firedProjectile.delivery.projectile;
  const expired = createProjectileExpiredEvent({ tick: 50, sourceEntityId: projectile.sourceEntityId, targetEntityId: null, weaponId: projectile.weaponId, projectileId: projectile.projectileId, moduleId: null, frameId: projectile.frameId, position: projectile.position, reason: "Range" });

  const beamCapability = weaponCapabilityFixture({ weaponId: "weapon:beam", delivery: { kind: "Beam" }, rawDamage: 40 });
  const firedBeam = fireWeapon({ capability: beamCapability, state: weaponRuntimeStateFixture(beamCapability), pose: weaponMountPoseFixture(), target: combatTargetFixture(), tick: 50, policy: { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" }, lineOfFire: "Clear" });
  if (firedBeam.delivery?.kind !== "Beam") throw new Error("Expected Beam fixture.");
  const resolved = resolveBeamHit(firedBeam.delivery.ray, [sphereCollisionProxyFixture({ moduleId: "module:weapon" })], 50);
  if (resolved === null) throw new Error("Expected Hit fixture.");
  const packet = createDamagePacketFromHit(resolved.hit, firedBeam.delivery.ray.payload);
  const damage = applyDamage(packet, damageableFixture({ armor: { current: 0, maximum: 0, resistances: zeroResistanceFixture() }, hull: { current: 10, maximum: 100, resistances: zeroResistanceFixture() }, modules: [damageableModuleFixture({ current: 10 })] }));
  return [...firedProjectile.events, expired, resolved.event, ...damage.events];
};

describe("canonical Combat events", () => {
  it("sorts by tick, exact phase order, then stable identity tie-breakers", () => {
    const events = allEventFixture(); const reversed = [...events].reverse();
    expect(sortCombatEvents(reversed).map((event) => event.phase)).toEqual(["WeaponFire", "ProjectileSpawned", "ProjectileExpired", "Hit", "DamageApplied", "ModuleStateChanged", "TargetDestroyed"]);
    expect(sortCombatEvents(reversed).every(Object.isFrozen)).toBe(true);
    expect(reversed).toEqual([...events].reverse());
  });

  it("makes differently ordered equivalent input arrays byte-identical", () => {
    const events = allEventFixture(); const first = createCanonicalCombatEventSequence(events); const second = createCanonicalCombatEventSequence([...events].reverse());
    expect(first).toEqual(second);
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.signature).toMatch(/^[0-9a-f]{16}$/);
    expect(Object.isFrozen(first.events)).toBe(true);
  });

  it("canonicalizes recursively sorted keys, preserves semantic array order, and uses FNV-1a 64-bit", () => {
    expect(canonicalCombatJson({ z: 1, a: { y: 2, x: 3 }, ordered: [3, 1, 2] })).toBe('{"a":{"x":3,"y":2},"ordered":[3,1,2],"z":1}');
    expect(combatHash({ b: 2, a: 1 })).toBe(combatHash({ a: 1, b: 2 }));
    expect(combatHash({ a: 1, b: 2 })).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv1a64Utf8("hello")).toBe("a430d84680aabd0b");
  });

  it("creates Hit events from a validated clone without freezing caller-owned Hit data", () => {
    const source = allEventFixture().find((event): event is HitEvent => event.phase === "Hit");
    if (source === undefined) throw new Error("Expected Hit event fixture.");
    const mutableHit = JSON.parse(JSON.stringify(source.hit)) as HitResult;
    const before = JSON.stringify(mutableHit);
    expect(Object.isFrozen(mutableHit)).toBe(false);
    expect(Object.isFrozen(mutableHit.point)).toBe(false);
    const event = createHitEvent(mutableHit);
    expect(event.hit).toEqual(mutableHit);
    expect(event.hit).not.toBe(mutableHit);
    expect(event.hit.point).not.toBe(mutableHit.point);
    expect(Object.isFrozen(event.hit)).toBe(true);
    expect(Object.isFrozen(event.hit.point)).toBe(true);
    expect(JSON.stringify(mutableHit)).toBe(before);
    expect(Object.isFrozen(mutableHit)).toBe(false);
    expect(Object.isFrozen(mutableHit.point)).toBe(false);
    expect(Object.isExtensible(mutableHit)).toBe(true);
  });

  it("keeps non-axis-aligned unit Hit vectors identity-stable across repeated event validation", () => {
    const source = allEventFixture().find((event): event is HitEvent => event.phase === "Hit");
    if (source === undefined) throw new Error("Expected Hit event fixture.");
    const togglingVector = { x: 0.24882372729452093, y: 0.6573620723355631, z: 0.7113099595745553 };
    const hit = { ...source.hit, normal: { ...togglingVector }, incomingDirection: { ...togglingVector } };
    const event = createHitEvent(hit);
    const first = createCanonicalCombatEventSequence([event]);
    const second = createCanonicalCombatEventSequence(first.events);
    const third = createCanonicalCombatEventSequence(second.events);
    expect(second.events[0].eventId).toBe(event.eventId);
    expect(third.events[0].eventId).toBe(event.eventId);
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(second.canonicalJson).toBe(third.canonicalJson);
    expect(first.signature).toBe(second.signature);
    expect(second.signature).toBe(third.signature);
  });

  it("rejects non-unit Hit normals and incoming directions", () => {
    const source = allEventFixture().find((event): event is HitEvent => event.phase === "Hit");
    if (source === undefined) throw new Error("Expected Hit event fixture.");
    expect(() => createHitEvent({ ...source.hit, normal: { x: 1, y: 1, z: 1 } })).toThrowError(CombatContractError);
    expect(() => createHitEvent({ ...source.hit, incomingDirection: { x: 2, y: 0, z: 0 } })).toThrowError(CombatContractError);
  });

  it("rejects invalid expiry reasons and Module statuses in public factories", () => {
    const events = allEventFixture();
    const expiry = events.find((event): event is ProjectileExpiredEvent => event.phase === "ProjectileExpired");
    const moduleChange = events.find((event): event is ModuleStateChangedEvent => event.phase === "ModuleStateChanged");
    if (expiry === undefined || moduleChange === undefined) throw new Error("Expected event fixtures.");
    expect(() => createProjectileExpiredEvent({ ...expiry, reason: "Never" as ProjectileExpiredEvent["reason"] })).toThrowError(CombatContractError);
    const packet = {
      packetId: "packet:event-test", sourceEntityId: moduleChange.sourceEntityId, targetEntityId: moduleChange.targetEntityId,
      weaponId: moduleChange.weaponId, hitId: "hit:event-test", moduleId: moduleChange.moduleId,
      damageType: "Kinetic", rawDamage: 1, tick: moduleChange.tick
    } as DamagePacket;
    expect(() => createModuleStateChangedEvent(packet, moduleChange.previousStatus, "Broken" as ModuleStateChangedEvent["currentStatus"])).toThrowError(CombatContractError);
  });

  it("rejects invalid phase, amounts, status, and nested Hit data during event sorting", () => {
    const events = allEventFixture();
    const hit = events.find((event): event is HitEvent => event.phase === "Hit");
    const damage = events.find((event) => event.phase === "DamageApplied");
    const moduleChange = events.find((event): event is ModuleStateChangedEvent => event.phase === "ModuleStateChanged");
    if (hit === undefined || damage === undefined || moduleChange === undefined) throw new Error("Expected event fixtures.");
    expect(() => sortCombatEvents([{ ...hit, hit: { ...hit.hit, distanceMeters: Number.NaN } }])).toThrowError(CombatContractError);
    expect(() => sortCombatEvents([{ ...damage, armorDamage: -1 }])).toThrowError(CombatContractError);
    expect(() => sortCombatEvents([{ ...moduleChange, currentStatus: "Broken" as ModuleStateChangedEvent["currentStatus"] }])).toThrowError(CombatContractError);
    expect(() => sortCombatEvents([{ ...hit, phase: "Unknown" } as unknown as CombatEvent])).toThrowError(CombatContractError);
  });

  it("rejects unsupported, cyclic, and non-finite canonical data", () => {
    expect(() => canonicalCombatJson({ value: Number.NaN })).toThrowError(CombatContractError);
    expect(() => canonicalCombatJson({ value: undefined })).toThrowError(CombatContractError);
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(() => canonicalCombatJson(cyclic)).toThrowError(CombatContractError);
  });

  it("derives stable event IDs and signatures without clock, random, or display identity", () => {
    const first = allEventFixture(); const second = allEventFixture();
    expect(first).toEqual(second);
    expect(createCanonicalCombatEventSequence(first).signature).toBe(createCanonicalCombatEventSequence(second).signature);
    for (const event of first) expect(event.eventId).toMatch(/^event:[0-9a-f]{16}$/);
  });

  it("keeps the Combat source boundary renderer-, runtime-, and browser-independent", () => {
    const directory = fileURLToPath(new URL("../../src/combat", import.meta.url));
    const files = readdirSync(directory).filter((file) => file.endsWith(".ts"));
    const source = files.map((file) => readFileSync(`${directory}/${file}`, "utf8")).join("\n");
    expect(source).not.toMatch(/from\s+["'][^"']*(three|render|runtime|ui|ship-builder|resources|test-harness)/i);
    expect(source).not.toMatch(/\b(window|document|performance|Date\.now|Math\.random)\b/);
  });
});
