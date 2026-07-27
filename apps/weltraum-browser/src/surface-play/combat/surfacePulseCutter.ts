import {
  createWeaponCapability,
  createWeaponRuntimeState,
  type WeaponCapabilitySnapshot,
  type WeaponRuntimeState
} from "../../combat";

export const HESTIA_PULSE_CUTTER_ID = "hestia.pulse-cutter.v1";
export const HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES = 120;
export const HESTIA_PULSE_CUTTER_COOLDOWN_SECONDS = 0.5;
export const HESTIA_PULSE_CUTTER_TERRAIN_EDIT_RADIUS_METERS = 0.75;

export const HESTIA_PULSE_CUTTER_V1: Readonly<WeaponCapabilitySnapshot> = createWeaponCapability({
  weaponId: HESTIA_PULSE_CUTTER_ID,
  mount: {
    kind: "Fixed",
    halfArcRadians: 2 * Math.PI / 180
  },
  delivery: { kind: "Beam" },
  maximumRangeMeters: 45,
  damageType: "Cutting",
  rawDamage: 30,
  rateOfFirePerSecond: 2,
  maximumTrackingErrorRadians: 0.5 * Math.PI / 180,
  ammoPerShot: null,
  energyPerShot: 12,
  heat: {
    heatPerShot: 18,
    maximumHeat: 54,
    coolingPerSecond: 12
  }
});

export const createHestiaPulseCutterState = (
  overrides: Partial<Pick<WeaponRuntimeState, "lifecycle" | "cooldownSeconds" | "energy" | "heat" | "shotSequence">> = {}
): Readonly<WeaponRuntimeState> => createWeaponRuntimeState({
  weaponId: HESTIA_PULSE_CUTTER_ID,
  lifecycle: overrides.lifecycle ?? "Operational",
  cooldownSeconds: overrides.cooldownSeconds ?? 0,
  ammo: null,
  energy: overrides.energy ?? HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  heat: overrides.heat ?? 0,
  shotSequence: overrides.shotSequence ?? 0
}, HESTIA_PULSE_CUTTER_V1);
