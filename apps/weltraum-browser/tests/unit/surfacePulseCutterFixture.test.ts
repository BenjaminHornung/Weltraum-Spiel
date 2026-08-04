import { describe, expect, it } from "vitest";
import {
  HESTIA_PULSE_CUTTER_COOLDOWN_SECONDS,
  HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_DELAY_SECONDS,
  HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND,
  HESTIA_PULSE_CUTTER_ID,
  HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  HESTIA_PULSE_CUTTER_TERRAIN_EDIT_RADIUS_METERS,
  HESTIA_PULSE_CUTTER_V1,
  advanceSurfaceCombatRuntime,
  createHestiaPulseCutterState,
  createSurfaceCombatRuntimeState
} from "../../src/surface-play/combat";

describe("Hestia Pulse Cutter V1 fixture", () => {
  it("pins the explicit industrial Beam fixture without random spread", () => {
    expect(HESTIA_PULSE_CUTTER_V1).toMatchObject({
      weaponId: HESTIA_PULSE_CUTTER_ID,
      delivery: { kind: "Beam" },
      maximumRangeMeters: 45,
      damageType: "Cutting",
      rawDamage: 30,
      rateOfFirePerSecond: 2,
      ammoPerShot: null,
      energyPerShot: 12,
      heat: {
        heatPerShot: 18,
        maximumHeat: 54,
        coolingPerSecond: 12
      }
    });
    expect(HESTIA_PULSE_CUTTER_V1.mount).toEqual({
      kind: "Fixed",
      halfArcRadians: 2 * Math.PI / 180
    });
    expect(HESTIA_PULSE_CUTTER_V1.maximumTrackingErrorRadians).toBe(0.5 * Math.PI / 180);
    expect(HESTIA_PULSE_CUTTER_COOLDOWN_SECONDS).toBe(0.5);
    expect(HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES).toBe(240);
    expect(HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_DELAY_SECONDS).toBe(3);
    expect(HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND).toBe(12);
    expect(HESTIA_PULSE_CUTTER_TERRAIN_EDIT_RADIUS_METERS).toBe(0.75);
    expect(JSON.stringify(HESTIA_PULSE_CUTTER_V1)).not.toMatch(/spread|random/i);
  });

  it("creates an immutable full-energy runtime state", () => {
    const state = createHestiaPulseCutterState();
    expect(state).toMatchObject({
      lifecycle: "Operational",
      cooldownSeconds: 0,
      energy: 240,
      heat: 0,
      shotSequence: 0
    });
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("cools heat and cooldown deterministically", () => {
    const state = createSurfaceCombatRuntimeState("frame.surface.hestia", { x: 0, y: 1.5, z: 20 });
    const hot = {
      ...state,
      weapon: createHestiaPulseCutterState({
        cooldownSeconds: 0.5,
        heat: 54
      })
    };
    const first = advanceSurfaceCombatRuntime(hot, 1);
    const repeat = advanceSurfaceCombatRuntime(hot, 1);
    expect(first).toEqual(repeat);
    expect(first.weapon.cooldownSeconds).toBe(0);
    expect(first.weapon.heat).toBe(42);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("recovers finite Energy only after the accepted-shot delay", () => {
    const state = createSurfaceCombatRuntimeState("frame.surface.hestia", { x: 0, y: 1.5, z: 20 });
    const depleted = {
      ...state,
      weapon: createHestiaPulseCutterState({ energy: 0 }),
      energyRecoveryDelayRemainingSeconds: 3
    };
    const beforeDelay = advanceSurfaceCombatRuntime(depleted, 2.5);
    const atDelay = advanceSurfaceCombatRuntime(beforeDelay, 0.5);
    const recovered = advanceSurfaceCombatRuntime(atDelay, 1);

    expect(beforeDelay.weapon.energy).toBe(0);
    expect(beforeDelay.energyRecoveryDelayRemainingSeconds).toBe(0.5);
    expect(atDelay.weapon.energy).toBe(0);
    expect(atDelay.energyRecoveryDelayRemainingSeconds).toBe(0);
    expect(recovered.weapon.energy).toBe(12);
  });
});
