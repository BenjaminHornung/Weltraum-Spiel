import { describe, expect, it } from "vitest";
import {
  CombatContractError,
  aabbCollisionProxyFixture,
  combatTargetFixture,
  createDamagePacketFromHit,
  damageableFixture,
  fireWeapon,
  resolveBeamHit,
  sphereCollisionProxyFixture,
  weaponCapabilityFixture,
  weaponMountPoseFixture,
  weaponRuntimeStateFixture,
  type RayDelivery
} from "../../src/combat";

const beamFixture = (pose = weaponMountPoseFixture()): Readonly<RayDelivery> => {
  const capability = weaponCapabilityFixture({ delivery: { kind: "Beam" }, maximumTrackingErrorRadians: Math.PI });
  const fired = fireWeapon({ capability, state: weaponRuntimeStateFixture(capability), pose, target: combatTargetFixture(), tick: 20, policy: { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" }, lineOfFire: "Clear" });
  if (fired.delivery?.kind !== "Beam") throw new Error("Fixture did not fire a Beam.");
  return fired.delivery.ray;
};

describe("combat Hit resolution", () => {
  it("selects the nearest authoritative proxy independent of input order", () => {
    const near = sphereCollisionProxyFixture({ proxyId: "proxy:near", entityId: "ship:near", center: { x: 0, y: 0, z: 20 }, radiusMeters: 1 });
    const far = sphereCollisionProxyFixture({ proxyId: "proxy:far", entityId: "ship:far", center: { x: 0, y: 0, z: 50 }, radiusMeters: 1 });
    const first = resolveBeamHit(beamFixture(), [far, near], 21);
    const repeat = resolveBeamHit(beamFixture(), [near, far], 21);
    expect(first?.hit).toMatchObject({ proxyId: "proxy:near", targetEntityId: "ship:near", distanceMeters: 19 });
    expect(first).toEqual(repeat);
  });

  it("uses lexical Proxy ID for intersections tied within 1e-9", () => {
    const lexicalFirst = sphereCollisionProxyFixture({ proxyId: "proxy:a", entityId: "ship:a", center: { x: 0, y: 0, z: 20.0000000005 }, radiusMeters: 1 });
    const slightlyNearer = sphereCollisionProxyFixture({ proxyId: "proxy:z", entityId: "ship:z", center: { x: 0, y: 0, z: 20 }, radiusMeters: 1 });
    expect(resolveBeamHit(beamFixture(), [slightlyNearer, lexicalFirst], 21)?.hit.proxyId).toBe("proxy:a");
  });

  it("uses the strict minimum tie set for chained epsilon distances independent of input order", () => {
    const minimum = sphereCollisionProxyFixture({ proxyId: "proxy:z-min", entityId: "ship:z", center: { x: 0, y: 0, z: 20 }, radiusMeters: 1 });
    const tied = sphereCollisionProxyFixture({ proxyId: "proxy:m-tie", entityId: "ship:m", center: { x: 0, y: 0, z: 20 + 0.8e-9 }, radiusMeters: 1 });
    const outside = sphereCollisionProxyFixture({ proxyId: "proxy:a-outside", entityId: "ship:a", center: { x: 0, y: 0, z: 20 + 1.6e-9 }, radiusMeters: 1 });
    const permutations = [
      [minimum, tied, outside], [minimum, outside, tied], [tied, minimum, outside],
      [tied, outside, minimum], [outside, minimum, tied], [outside, tied, minimum]
    ];
    expect(permutations.map((proxies) => resolveBeamHit(beamFixture(), proxies, 21)?.hit.proxyId)).toEqual(Array(6).fill("proxy:m-tie"));
  });

  it("includes Beam shot sequence in Hit, Hit-event, and Damage Packet identities", () => {
    const capability = weaponCapabilityFixture({ delivery: { kind: "Beam" } });
    const fire = (shotSequence: number) => fireWeapon({
      capability, state: weaponRuntimeStateFixture(capability, { shotSequence }), pose: weaponMountPoseFixture(), target: combatTargetFixture(), tick: 20,
      policy: { relation: "Hostile" as const, friendlyFire: "Denied" as const, permission: "Allowed" as const }, lineOfFire: "Clear" as const
    });
    const firstFire = fire(0); const secondFire = fire(1);
    if (firstFire.delivery?.kind !== "Beam" || secondFire.delivery?.kind !== "Beam") throw new Error("Expected Beam deliveries.");
    const proxy = sphereCollisionProxyFixture();
    const first = resolveBeamHit(firstFire.delivery.ray, [proxy], 21); const second = resolveBeamHit(secondFire.delivery.ray, [proxy], 21);
    if (first === null || second === null) throw new Error("Expected Beam Hits.");
    expect(first.hit.hitId).not.toBe(second.hit.hitId);
    expect(first.event.eventId).not.toBe(second.event.eventId);
    expect(createDamagePacketFromHit(first.hit, firstFire.delivery.ray.payload).packetId).not.toBe(createDamagePacketFromHit(second.hit, secondFire.delivery.ray.payload).packetId);
  });

  it("uses X before Y and Z for equal AABB slab entries", () => {
    const direction = { x: 1, y: 1, z: 1 };
    const pose = weaponMountPoseFixture({ muzzleDirection: direction });
    const proxy = aabbCollisionProxyFixture({ minimum: { x: 10, y: 10, z: 10 }, maximum: { x: 20, y: 20, z: 20 } });
    const hit = resolveBeamHit(beamFixture(pose), [proxy], 21)?.hit;
    expect(hit?.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it("returns byte-identical Beam hits with explicit null speed and one event", () => {
    const ray = beamFixture(); const proxy = sphereCollisionProxyFixture(); const before = JSON.stringify({ ray, proxy });
    const first = resolveBeamHit(ray, [proxy], 21); const repeat = resolveBeamHit(ray, [proxy], 21);
    expect(first).toEqual(repeat);
    expect(first?.hit).toMatchObject({ deliveryKind: "Beam", projectileId: null, incomingSpeedMetersPerSecond: null, frameId: "frame:combat" });
    expect(first?.event.phase).toBe("Hit");
    expect(Object.isFrozen(first?.hit)).toBe(true);
    expect(JSON.stringify({ ray, proxy })).toBe(before);
  });

  it("does not mutate damage state while resolving a Hit", () => {
    const damageable = damageableFixture(); const before = JSON.stringify(damageable);
    expect(resolveBeamHit(beamFixture(), [sphereCollisionProxyFixture({ moduleId: "module:weapon" })], 21)?.hit.moduleId).toBe("module:weapon");
    expect(JSON.stringify(damageable)).toBe(before);
  });

  it("ignores owner entities, caps range, and rejects frame mismatch", () => {
    const owner = sphereCollisionProxyFixture({ entityId: "ship:source", center: { x: 0, y: 0, z: 5 } });
    const tooFar = sphereCollisionProxyFixture({ proxyId: "proxy:far", center: { x: 0, y: 0, z: 1200 } });
    expect(resolveBeamHit(beamFixture(), [owner, tooFar], 21)).toBeNull();
    expect(() => resolveBeamHit(beamFixture(), [sphereCollisionProxyFixture({ frameId: "frame:other" })], 21)).toThrowError(CombatContractError);
  });
});
