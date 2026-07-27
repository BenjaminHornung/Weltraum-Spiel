import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createCollisionProxy,
  createCombatTarget,
  createWeaponMountPose,
  resolveBeamHit
} from "../../src/combat";
import {
  createSurfacePlayerSnapshot,
  createSurfacePlayIdentity,
  createSurfaceRayResult,
  type SurfaceAuthorityBinding
} from "../../src/surface-play/contracts";
import {
  SURFACE_SURVEY_DRONE_ARMOR,
  SURFACE_SURVEY_DRONE_HULL,
  advanceSurfaceCombatRuntime,
  createCombatCoreSurfaceRaycastPort,
  createHestiaPulseCutterState,
  createSurfaceCombatRuntimeState,
  executeSurfaceCombatFire,
  replaySurfaceCombatPresentation,
  type SurfaceCombatExecutionInput,
  type SurfaceCombatRuntimeState,
  type SurfaceTerrainRaycastPort
} from "../../src/surface-play/combat";

const FRAME_ID = "frame.surface.hestia.landing";
const PLAYER_ID = "surface-player:one";

const binding = (tick = 10): Readonly<SurfaceAuthorityBinding> => {
  const identity = createSurfacePlayIdentity({
    bodyId: "body.hestia",
    regionId: "region.hestia.landing",
    surfaceFrameId: FRAME_ID,
    generatorVersion: "hestia.generator.v1",
    seed: "hestia-surface-combat-v1",
    regionRevision: 4
  });
  return {
    bodyId: identity.bodyId,
    regionId: identity.regionId,
    surfaceFrameId: identity.surfaceFrameId,
    regionRevision: identity.regionRevision,
    simulationTick: tick
  };
};

const missTerrainPort = (): SurfaceTerrainRaycastPort => ({
  queryTerrain: (_binding, ray) => createSurfaceRayResult({
    status: "Resolved",
    queryId: `surface-ray:${ray.tick}`,
    contact: null
  })
});

const terrainHitPort = (distanceMeters = 10): SurfaceTerrainRaycastPort => ({
  queryTerrain: (_binding, ray) => createSurfaceRayResult({
    status: "Resolved",
    queryId: `surface-ray:${ray.tick}`,
    contact: {
      pointMeters: {
        x: ray.origin.x + ray.direction.x * distanceMeters,
        y: ray.origin.y + ray.direction.y * distanceMeters,
        z: ray.origin.z + ray.direction.z * distanceMeters
      },
      normal: { x: 0, y: 0, z: -1 },
      distanceMeters,
      colliderId: "terrain:hestia.landing"
    }
  })
});

const execution = (
  state: Readonly<SurfaceCombatRuntimeState> = createSurfaceCombatRuntimeState(
    FRAME_ID,
    { x: 0, y: 1.5, z: 20 }
  ),
  tick = 10,
  terrain: SurfaceTerrainRaycastPort = missTerrainPort()
): SurfaceCombatExecutionInput => ({
  state,
  player: createSurfacePlayerSnapshot({
    playerId: PLAYER_ID,
    surfaceFrameId: FRAME_ID,
    positionMeters: { x: 0, y: 0, z: 0 },
    velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
    yawRadians: 0,
    pitchRadians: 0,
    grounded: true,
    movementMode: "Walk",
    capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
    simulationTick: tick
  }),
  command: {
    commandId: `surface-command:fire-${tick}`,
    playerId: PLAYER_ID,
    surfaceFrameId: FRAME_ID,
    simulationTick: tick
  },
  pose: createWeaponMountPose({
    sourceEntityId: PLAYER_ID,
    ownerId: "surface-owner:player",
    frameId: FRAME_ID,
    muzzlePosition: { x: 0, y: 1.5, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    muzzleDirection: { x: 0, y: 0, z: 1 },
    sourceVelocity: { x: 0, y: 0, z: 0 }
  }),
  binding: binding(tick),
  raycast: createCombatCoreSurfaceRaycastPort(terrain)
});

describe("surface combat runtime", () => {
  it("consumes energy, adds heat, and starts cooldown for a valid shot", () => {
    const result = executeSurfaceCombatFire(execution());
    expect(result.kind).toBe("CombatTargetHit");
    expect(result.state.weapon).toMatchObject({
      energy: 108,
      heat: 18,
      cooldownSeconds: 0.5,
      shotSequence: 1
    });
  });

  it("blocks follow-up fire during cooldown without resource or damage mutation", () => {
    const first = executeSurfaceCombatFire(execution());
    const before = first.state;
    const blocked = executeSurfaceCombatFire(execution(before, 10));
    expect(blocked.kind).toBe("BlockedFire");
    expect(blocked.snapshot.latestFireResult).toMatchObject({ status: "Rejected", code: "Cooldown" });
    expect(blocked.state.weapon).toEqual(before.weapon);
    expect(blocked.state.drone).toEqual(before.drone);
    expect(blocked.combatEvents).toEqual([]);
  });

  it("blocks insufficient energy and overheat without authoritative mutation", () => {
    const base = createSurfaceCombatRuntimeState(FRAME_ID, { x: 0, y: 1.5, z: 20 });
    const insufficient = {
      ...base,
      weapon: createHestiaPulseCutterState({ energy: 11 })
    };
    const hot = {
      ...base,
      weapon: createHestiaPulseCutterState({ heat: 54 })
    };
    const energyResult = executeSurfaceCombatFire(execution(insufficient));
    const heatResult = executeSurfaceCombatFire(execution(hot));
    expect(energyResult.snapshot.latestFireResult).toMatchObject({
      status: "Rejected",
      code: "InsufficientEnergy"
    });
    expect(heatResult.snapshot.latestFireResult).toMatchObject({
      status: "Rejected",
      code: "Overheated"
    });
    expect(energyResult.state.weapon).toEqual(insufficient.weapon);
    expect(heatResult.state.weapon).toEqual(hot.weapon);
    expect(energyResult.state.drone.damageable).toEqual(base.drone.damageable);
    expect(heatResult.state.drone.damageable).toEqual(base.drone.damageable);
  });

  it("uses Combat Core Beam resolution to choose the nearest valid proxy", () => {
    const terrain = missTerrainPort();
    const port = createCombatCoreSurfaceRaycastPort(terrain);
    const ray = {
      kind: "Beam" as const,
      sourceEntityId: PLAYER_ID as never,
      weaponId: "hestia.pulse-cutter.v1" as never,
      frameId: FRAME_ID as never,
      tick: 10,
      shotSequence: 1,
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      maximumDistanceMeters: 45,
      payload: { damageType: "Cutting" as const, rawDamage: 30 }
    };
    const targets = [
      createCombatTarget({
        targetId: "surface-target:far",
        ownerId: "surface-owner:security",
        frameId: FRAME_ID,
        tick: 10,
        position: { x: 0, y: 0, z: 20 },
        velocity: { x: 0, y: 0, z: 0 },
        targetable: true,
        lifecycle: "Active"
      }),
      createCombatTarget({
        targetId: "surface-target:near",
        ownerId: "surface-owner:security",
        frameId: FRAME_ID,
        tick: 10,
        position: { x: 0, y: 0, z: 10 },
        velocity: { x: 0, y: 0, z: 0 },
        targetable: true,
        lifecycle: "Active"
      })
    ];
    const proxies = [
      createCollisionProxy({
        kind: "Sphere",
        proxyId: "surface-proxy:far",
        entityId: "surface-target:far",
        moduleId: null,
        frameId: FRAME_ID,
        center: { x: 0, y: 0, z: 20 },
        radiusMeters: 1
      }),
      createCollisionProxy({
        kind: "Sphere",
        proxyId: "surface-proxy:near",
        entityId: "surface-target:near",
        moduleId: null,
        frameId: FRAME_ID,
        center: { x: 0, y: 0, z: 10 },
        radiusMeters: 1
      })
    ];
    const candidate = port.query({ binding: binding(), ray, targets, proxies });
    expect(candidate).toMatchObject({
      kind: "CombatTargetHit",
      target: { targetId: "surface-target:near" },
      proxy: { proxyId: "surface-proxy:near" },
      distanceMeters: 9
    });
  });

  it("rejects frame mismatch before raycast, resources, or damage", () => {
    let raycastCalled = false;
    const input = execution();
    const result = executeSurfaceCombatFire({
      ...input,
      command: { ...input.command, surfaceFrameId: "frame.surface.other" },
      raycast: {
        query: () => {
          raycastCalled = true;
          return { kind: "Miss" };
        }
      }
    });
    expect(result.kind).toBe("BlockedFire");
    expect(result.snapshot.latestFireResult).toMatchObject({ status: "Rejected", code: "FrameMismatch" });
    expect(result.state.weapon).toEqual(input.state.weapon);
    expect(result.state.drone).toEqual(input.state.drone);
    expect(raycastCalled).toBe(false);
  });

  it("orders target damage and destruction events canonically", () => {
    const first = executeSurfaceCombatFire(execution());
    const secondState = advanceSurfaceCombatRuntime(first.state, 0.5);
    const second = executeSurfaceCombatFire(execution(secondState, 11));
    const thirdState = advanceSurfaceCombatRuntime(second.state, 0.5);
    const third = executeSurfaceCombatFire(execution(thirdState, 12));
    expect(third.kind).toBe("CombatTargetHit");
    expect(third.combatEvents.map((event) => event.phase)).toEqual([
      "WeaponFire",
      "Hit",
      "DamageApplied",
      "TargetDestroyed"
    ]);
    expect(third.snapshot.events.map((event) => event.kind)).toEqual([
      "FireAccepted",
      "TargetDamaged",
      "TargetDestroyed"
    ]);
    expect(third.state.drone.mode).toBe("Destroyed");
  });

  it("changes target health only through Damage Apply and keeps Destroyed sticky", () => {
    const input = execution();
    const damageableBefore = JSON.stringify(input.state.drone.damageable);
    const probe = {
      kind: "Beam" as const,
      sourceEntityId: input.pose.sourceEntityId,
      weaponId: "hestia.pulse-cutter.v1" as never,
      frameId: input.pose.frameId,
      tick: 10,
      shotSequence: 1,
      origin: input.pose.muzzlePosition,
      direction: input.pose.muzzleDirection,
      maximumDistanceMeters: 45,
      payload: { damageType: "Cutting" as const, rawDamage: 30 }
    };
    expect(resolveBeamHit(probe, [
      createCollisionProxy({
        kind: "Sphere",
        proxyId: "surface-proxy:probe",
        entityId: input.state.drone.damageable.targetEntityId,
        moduleId: null,
        frameId: FRAME_ID,
        center: input.state.drone.positionMeters,
        radiusMeters: 0.8
      })
    ], 10)).not.toBeNull();
    expect(JSON.stringify(input.state.drone.damageable)).toBe(damageableBefore);

    let state = input.state;
    for (const tick of [10, 11, 12]) {
      const result = executeSurfaceCombatFire(execution(state, tick));
      state = advanceSurfaceCombatRuntime(result.state, 0.5);
    }
    expect(state.drone.mode).toBe("Destroyed");
    const destroyed = state.drone.damageable;
    const later = executeSurfaceCombatFire(execution(state, 13));
    expect(later.state.drone.mode).toBe("Destroyed");
    expect(later.state.drone.damageable).toEqual(destroyed);
  });

  it("creates exactly one immutable terrain intent and no Damage event", () => {
    const state = createSurfaceCombatRuntimeState(FRAME_ID, { x: 10, y: 1.5, z: 20 });
    const result = executeSurfaceCombatFire(execution(state, 10, terrainHitPort()));
    expect(result.kind).toBe("TerrainHit");
    expect(result.impactIntent).toMatchObject({
      sourceWeaponId: "hestia.pulse-cutter.v1",
      frameId: FRAME_ID,
      simulationTick: 10,
      energyDamageScalar: 30,
      suggestedEditRadiusMeters: 0.75
    });
    expect(result.snapshot.events.filter((event) => event.kind === "TerrainHit")).toHaveLength(1);
    expect(result.combatEvents.map((event) => event.phase)).toEqual(["WeaponFire"]);
    expect(Object.isFrozen(result.impactIntent)).toBe(true);
    expect(result.state.drone.damageable).toEqual(state.drone.damageable);
  });

  it("returns Miss without damage or edit intent", () => {
    const state = createSurfaceCombatRuntimeState(FRAME_ID, { x: 10, y: 1.5, z: 20 });
    const result = executeSurfaceCombatFire(execution(state));
    expect(result.kind).toBe("Miss");
    expect(result.impactIntent).toBeNull();
    expect(result.combatEvents.map((event) => event.phase)).toEqual(["WeaponFire"]);
    expect(result.state.drone.damageable).toEqual(state.drone.damageable);
  });

  it("produces identical IDs and event order for identical inputs", () => {
    const input = execution();
    const first = executeSurfaceCombatFire(input);
    const repeat = executeSurfaceCombatFire(input);
    expect(first).toEqual(repeat);
    expect(first.combatEvents.map((event) => event.eventId)).toEqual(
      repeat.combatEvents.map((event) => event.eventId)
    );
  });

  it("replays presentation without applying damage a second time", () => {
    const result = executeSurfaceCombatFire(execution());
    const damageBefore = JSON.stringify(result.state.drone.damageable);
    const first = replaySurfaceCombatPresentation(result, PLAYER_ID, { x: 0, y: 1.5, z: 0 });
    const repeat = replaySurfaceCombatPresentation(result, PLAYER_ID, { x: 0, y: 1.5, z: 0 });
    expect(first).toEqual(repeat);
    expect(JSON.stringify(result.state.drone.damageable)).toBe(damageBefore);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("keeps the Surface Combat runtime free of Three.js and browser authority", () => {
    const directory = fileURLToPath(new URL("../../src/surface-play/combat", import.meta.url));
    const source = readdirSync(directory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(`${directory}/${file}`, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/from\s+["'][^"']*three/i);
    expect(source).not.toMatch(/\b(THREE|window|document|performance|Date\.now|Math\.random)\b/);
  });

  it("starts with the pinned drone armor and hull model", () => {
    const state = createSurfaceCombatRuntimeState(FRAME_ID);
    expect(state.drone.damageable.armor).toMatchObject({
      current: SURFACE_SURVEY_DRONE_ARMOR,
      maximum: SURFACE_SURVEY_DRONE_ARMOR
    });
    expect(state.drone.damageable.hull).toMatchObject({
      current: SURFACE_SURVEY_DRONE_HULL,
      maximum: SURFACE_SURVEY_DRONE_HULL
    });
  });
});
