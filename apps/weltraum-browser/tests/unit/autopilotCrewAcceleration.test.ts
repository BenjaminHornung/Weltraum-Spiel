import { describe, expect, it } from "vitest";
import { accelerationLimitForMass, createShipMass, createShipStateV2, defaultFlightModelOptions } from "../../src/flight/state";
import {
  STANDARD_GRAVITY_MPS2,
  defaultCrewlessDroneAccelerationEnvelope,
  defaultHumanCrewAccelerationEnvelope,
  deriveUsablePropulsionAccelerations,
  genericShipPropulsionCapabilityFixtures,
  highGCrewlessDronePropulsionCapability,
  highThrustCrewedShipPropulsionCapability,
  normalCrewedScoutPropulsionCapability,
  underpoweredCrewedCargoShipPropulsionCapability
} from "../../src/flight/propulsionCapability";
import { resolveTransitPolicy } from "../../src/flight/transitPolicies";

const nominalMass = createShipMass({ dryMass: 1_000, fuelMass: 100 });

describe("autopilot crew acceleration envelopes", () => {
  it("provides four deterministic finite generic propulsion fixtures and a normal-scout legacy factory default", () => {
    expect(Object.keys(genericShipPropulsionCapabilityFixtures)).toEqual([
      "normalCrewedScout",
      "highThrustCrewedShip",
      "underpoweredCrewedCargoShip",
      "highGCrewlessDrone"
    ]);

    for (const capability of Object.values(genericShipPropulsionCapabilityFixtures)) {
      expect(JSON.parse(JSON.stringify(capability))).toEqual(capability);
      expect(capability.mainThrustNewton).toBeGreaterThanOrEqual(0);
      expect(capability.effectiveBrakingThrustNewton).toBeGreaterThanOrEqual(0);
      expect(capability.structuralMaxAccelerationMps2).toBeGreaterThanOrEqual(0);
      expect(capability.sustainedThermalMaxAccelerationMps2).toBeGreaterThanOrEqual(0);
      expect(capability.maximumPeakAccelerationMps2).toBeGreaterThanOrEqual(0);
      expect(capability.maximumAngularAcceleration).toBeGreaterThanOrEqual(0);
      expect(capability.maximumAngularVelocity).toBeGreaterThanOrEqual(0);
      expect(Object.keys(capability.extensions ?? {}).every((key) => key.includes(":"))).toBe(true);
    }

    expect(createShipStateV2().propulsionCapability).toBe(normalCrewedScoutPropulsionCapability);
  });

  it("uses current mass and separate main/braking thrust while capping human Sprint at 1.5 g", () => {
    const policy = resolveTransitPolicy("CrewSprint");
    const light = deriveUsablePropulsionAccelerations({
      mass: nominalMass,
      capability: highThrustCrewedShipPropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
      policy
    });
    const heavy = deriveUsablePropulsionAccelerations({
      mass: createShipMass({ dryMass: 10_000, fuelMass: 100 }),
      capability: highThrustCrewedShipPropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
      policy
    });

    expect(light.mainAccelerationMps2).toBeLessThanOrEqual(STANDARD_GRAVITY_MPS2 * 1.5);
    expect(light.brakingAccelerationMps2).toBeLessThanOrEqual(STANDARD_GRAVITY_MPS2 * 1.5);
    expect(light.rawMainAccelerationMps2).toBeCloseTo(highThrustCrewedShipPropulsionCapability.mainThrustNewton / nominalMass.totalMass, 8);
    expect(heavy.mainAccelerationMps2).toBeLessThan(light.mainAccelerationMps2);
    expect(heavy.brakingAccelerationMps2).toBeLessThan(heavy.mainAccelerationMps2);
  });

  it("honors comfort targets when supported, reports underpowered comfort shortfall honestly, and lets drones use physical authority", () => {
    const comfort = deriveUsablePropulsionAccelerations({
      mass: nominalMass,
      capability: highThrustCrewedShipPropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
      policy: resolveTransitPolicy("CrewComfort")
    });
    const underpowered = deriveUsablePropulsionAccelerations({
      mass: nominalMass,
      capability: underpoweredCrewedCargoShipPropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
      policy: resolveTransitPolicy("CrewComfort")
    });
    const drone = deriveUsablePropulsionAccelerations({
      mass: nominalMass,
      capability: highGCrewlessDronePropulsionCapability,
      occupantAccelerationEnvelope: defaultCrewlessDroneAccelerationEnvelope,
      policy: resolveTransitPolicy("DroneSprint")
    });

    expect(comfort.mainAccelerationMps2).toBeCloseTo(STANDARD_GRAVITY_MPS2, 8);
    expect(underpowered.mainAccelerationMps2).toBeLessThan(STANDARD_GRAVITY_MPS2 * 0.8);
    expect(drone.mainAccelerationMps2).toBeGreaterThan(STANDARD_GRAVITY_MPS2 * 1.5);
    expect(drone.mainAccelerationMps2).toBeLessThanOrEqual(highGCrewlessDronePropulsionCapability.sustainedThermalMaxAccelerationMps2);
    expect(Number.isFinite(drone.mainAccelerationMps2)).toBe(true);
    expect(drone.occupantAccelerationLimitMps2).toBeUndefined();
  });

  it("retains FlightModelOptions only as a final migration clamp", () => {
    const physical = deriveUsablePropulsionAccelerations({
      mass: nominalMass,
      capability: highThrustCrewedShipPropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope,
      policy: resolveTransitPolicy("CrewSprint")
    });
    const legacyCompatible = accelerationLimitForMass(
      nominalMass,
      { ...defaultFlightModelOptions, maxThrustKilonewtons: 5, maxAcceleration: 6 },
      highThrustCrewedShipPropulsionCapability,
      defaultHumanCrewAccelerationEnvelope
    );

    expect(legacyCompatible).toBeCloseTo(5_000 / nominalMass.totalMass, 8);
    expect(legacyCompatible).toBeLessThan(physical.mainAccelerationMps2);
  });
});
