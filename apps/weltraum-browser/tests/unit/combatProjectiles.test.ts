import { describe, expect, it } from "vitest";
import {
  CombatContractError,
  aabbCollisionProxyFixture,
  advanceProjectile,
  combatTargetFixture,
  fireWeapon,
  sphereCollisionProxyFixture,
  weaponCapabilityFixture,
  weaponMountPoseFixture,
  weaponRuntimeStateFixture,
  type ProjectileState
} from "../../src/combat";

const projectileFixture = (capability = weaponCapabilityFixture()): Readonly<ProjectileState> => {
  const fired = fireWeapon({ capability, state: weaponRuntimeStateFixture(capability), pose: weaponMountPoseFixture(), target: combatTargetFixture(), tick: 11, policy: { relation: "Hostile", friendlyFire: "Denied", permission: "Allowed" }, lineOfFire: "Clear" });
  if (fired.delivery?.kind !== "Projectile") throw new Error("Fixture did not fire a Projectile.");
  return fired.delivery.projectile;
};

describe("combat Projectile motion", () => {
  it("advances constant velocity reproducibly without mutating caller state", () => {
    const projectile = projectileFixture(); const before = JSON.stringify(projectile);
    const first = advanceProjectile(projectile, 0.25, 12, []); const repeat = advanceProjectile(projectile, 0.25, 12, []);
    expect(first).toEqual(repeat);
    expect(first.status).toBe("Active");
    expect(first.projectile?.position).toEqual({ x: 0, y: 0, z: 25 });
    expect(first.projectile).toMatchObject({ traveledDistanceMeters: 25, remainingLifetimeSeconds: 9.75, remainingRangeMeters: 975 });
    expect(JSON.stringify(projectile)).toBe(before);
    expect(Object.isFrozen(first.projectile)).toBe(true);
  });

  it("expires once at the lifetime cap and emits no Hit", () => {
    const capability = weaponCapabilityFixture({ delivery: { kind: "Projectile", speedMetersPerSecond: 100, radiusMeters: 0.5, massKilograms: 2, lifetimeSeconds: 0.5, maximumPathRangeMeters: 1000 } });
    const result = advanceProjectile(projectileFixture(capability), 1, 12, []);
    expect(result).toMatchObject({ status: "Expired", projectile: null, hit: null });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ phase: "ProjectileExpired", reason: "Lifetime", position: { z: 50 } });
  });

  it("expires at the path-range cap while lifetime remains", () => {
    const capability = weaponCapabilityFixture({ delivery: { kind: "Projectile", speedMetersPerSecond: 100, radiusMeters: 0.5, massKilograms: 2, lifetimeSeconds: 10, maximumPathRangeMeters: 30 } });
    const result = advanceProjectile(projectileFixture(capability), 1, 12, []);
    expect(result).toMatchObject({ status: "Expired", projectile: null, hit: null });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ phase: "ProjectileExpired", reason: "Range", position: { z: 30 } });
  });

  it("uses swept Sphere collision and cannot tunnel through a target", () => {
    const result = advanceProjectile(projectileFixture(), 1, 12, [sphereCollisionProxyFixture()]);
    expect(result.status).toBe("Hit");
    expect(result.hit).toMatchObject({ deliveryKind: "Projectile", targetEntityId: "ship:target", proxyId: "proxy:target", distanceMeters: 97.5, incomingSpeedMetersPerSecond: 100 });
    expect(result.events.map((event) => event.phase)).toEqual(["Hit"]);
  });

  it("uses expanded AABB authority and evaluates a boundary hit before range expiry", () => {
    const capability = weaponCapabilityFixture({ maximumRangeMeters: 100, delivery: { kind: "Projectile", speedMetersPerSecond: 100, radiusMeters: 0.5, massKilograms: 2, lifetimeSeconds: 1, maximumPathRangeMeters: 100 } });
    const proxy = aabbCollisionProxyFixture({ minimum: { x: -1, y: -1, z: 100.5 }, maximum: { x: 1, y: 1, z: 102 } });
    const result = advanceProjectile(projectileFixture(capability), 2, 12, [proxy]);
    expect(result.status).toBe("Hit");
    expect(result.hit?.distanceMeters).toBe(100);
    expect(result.events).toHaveLength(1);
  });

  it("reports start overlap at zero with the opposite travel normal fallback", () => {
    const proxy = sphereCollisionProxyFixture({ center: { x: 0, y: 0, z: 0 }, radiusMeters: 1 });
    const result = advanceProjectile(projectileFixture(), 0.1, 12, [proxy]);
    expect(result.hit).toMatchObject({ distanceMeters: 0, segmentFraction: 0, normal: { x: 0, y: 0, z: -1 } });
  });

  it("ignores owner proxies, then returns Active", () => {
    const owner = sphereCollisionProxyFixture({ entityId: "ship:source", center: { x: 0, y: 0, z: 5 } });
    expect(advanceProjectile(projectileFixture(), 0.1, 12, [owner]).status).toBe("Active");
  });

  it("rejects frame mismatches, non-positive dt, and zero travel", () => {
    const projectile = projectileFixture();
    expect(() => advanceProjectile(projectile, 1, 12, [sphereCollisionProxyFixture({ frameId: "frame:other" })])).toThrowError(CombatContractError);
    expect(() => advanceProjectile(projectile, 0, 12, [])).toThrowError(CombatContractError);
    expect(() => advanceProjectile({ ...projectile, velocity: { x: 0, y: 0, z: 0 } }, 1, 12, [])).toThrowError(CombatContractError);
  });
});
