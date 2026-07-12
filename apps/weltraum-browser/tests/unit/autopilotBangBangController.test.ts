import { describe, expect, it } from "vitest";
import { applyFlightControllerStep, orientationFromForward, rotateVectorByQuaternion } from "../../src/flight/flightController";
import { createShipStateV2 } from "../../src/flight/state";
import { defaultCrewlessDroneAccelerationEnvelope, defaultHumanCrewAccelerationEnvelope, highGCrewlessDronePropulsionCapability } from "../../src/flight/propulsionCapability";
import { magnitude, vec3 } from "../../src/core/vector";

const dot = (a: ReturnType<typeof vec3>, b: ReturnType<typeof vec3>): number => a.x * b.x + a.y * b.y + a.z * b.z;

describe("physical body-forward bang-bang flight control", () => {
  it("does not let a world-space desired acceleration bypass sideways body alignment", () => {
    const requestedBurn = vec3(1, 0, 0);
    const sidewaysShip = createShipStateV2({
      fuel: 50,
      orientation: orientationFromForward(vec3(0, 0, 1)),
      sasEnabled: false
    });

    const first = applyFlightControllerStep(sidewaysShip, {
      controlMode: "Cruise",
      mainThrottleCommand: 1,
      desiredAcceleration: requestedBurn,
      desiredFacingDirection: requestedBurn,
      mainThrustAlignmentToleranceRadians: 0.12
    }, 1 / 30);

    expect(first.velocity).toEqual(vec3());
    expect(first.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(first.actuatorTelemetry.lastAppliedAcceleration).toEqual(vec3());
    expect(first.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(first.orientation).not.toEqual(sidewaysShip.orientation);

    let aligned = first;
    for (let tick = 0; tick < 300 && !aligned.actuatorTelemetry.mainThrustActive; tick += 1) {
      aligned = applyFlightControllerStep(aligned, {
        controlMode: "Cruise",
        mainThrottleCommand: 1,
        desiredAcceleration: requestedBurn,
        desiredFacingDirection: requestedBurn,
        mainThrustAlignmentToleranceRadians: 0.12
      }, 1 / 30);
    }

    const actualForward = rotateVectorByQuaternion(aligned.orientation, vec3(1, 0, 0));
    expect(aligned.actuatorTelemetry.mainThrustActive).toBe(true);
    expect(dot(actualForward, requestedBurn)).toBeGreaterThan(Math.cos(0.12));
    expect(aligned.actuatorTelemetry.lastAppliedAcceleration.x).toBeGreaterThan(0);
    expect(Math.abs(aligned.actuatorTelemetry.lastAppliedAcceleration.z)).toBeLessThan(0.2);
  });

  it("applies finite human and drone limits through actual thrust telemetry", () => {
    const controllerLimits = { maxAcceleration: 100, maxThrustKilonewtons: 1_000 };
    const humanShip = createShipStateV2({
      fuel: 50,
      propulsionCapability: highGCrewlessDronePropulsionCapability,
      occupantAccelerationEnvelope: defaultHumanCrewAccelerationEnvelope
    });
    const droneShip = createShipStateV2({
      fuel: 50,
      propulsionCapability: highGCrewlessDronePropulsionCapability,
      occupantAccelerationEnvelope: defaultCrewlessDroneAccelerationEnvelope
    });

    const humanAfter = applyFlightControllerStep(humanShip, { mainThrottleCommand: 1 }, 1, controllerLimits);
    const droneAfter = applyFlightControllerStep(droneShip, { mainThrottleCommand: 1 }, 1, controllerLimits);
    const humanApplied = magnitude(humanAfter.actuatorTelemetry.lastAppliedAcceleration);
    const droneApplied = magnitude(droneAfter.actuatorTelemetry.lastAppliedAcceleration);

    expect(Number.isFinite(humanApplied)).toBe(true);
    expect(Number.isFinite(droneApplied)).toBe(true);
    expect(humanApplied).toBeLessThanOrEqual(defaultHumanCrewAccelerationEnvelope.maximumPeakAccelerationMps2 ?? 0);
    expect(droneApplied).toBeGreaterThan(humanApplied);
    expect(droneApplied).toBeLessThanOrEqual(highGCrewlessDronePropulsionCapability.sustainedThermalMaxAccelerationMps2);
    expect(humanAfter.velocity.x).toBeCloseTo(humanApplied, 8);
    expect(droneAfter.velocity.x).toBeCloseTo(droneApplied, 8);
  });

  it("allocates simultaneous body-forward main thrust and cross-track RCS under one combined ceiling", () => {
    const ship = createShipStateV2({ fuel: 50 });
    const after = applyFlightControllerStep(ship, {
      controlMode: "Cruise",
      mainThrottleCommand: 1,
      desiredAcceleration: vec3(4.8, 0, 0),
      desiredFacingDirection: vec3(1, 0, 0),
      maximumMainAccelerationMps2: 4.8,
      maximumCombinedAccelerationMps2: 5,
      translationCommand: vec3(0, 1, 0),
      allowRcsTranslationOutsideTranslationMode: true
    }, 1 / 30);

    expect(after.actuatorTelemetry.mainThrustActive).toBe(true);
    expect(after.actuatorTelemetry.rcsTranslationActive).toBe(true);
    expect(after.actuatorTelemetry.appliedMainAccelerationMps2).toBeCloseTo(4.8, 8);
    expect(magnitude(after.actuatorTelemetry.lastAppliedAcceleration)).toBeLessThanOrEqual(5 + 1e-9);
    expect(after.actuatorTelemetry.combinedAccelerationLimitMps2).toBe(5);
  });
});
