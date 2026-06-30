import { describe, expect, it } from "vitest";
import { applyFlightControllerStep, createShipStateV2, magnitude, orientationFromForward, serializeTelemetry, vec3 } from "../../src/core";

describe("flight controller", () => {
  it("initializes Flight State V2 defaults on owner ship state", () => {
    const ship = createShipStateV2({ fuel: 25 });

    expect(ship.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(ship.angularVelocity).toEqual(vec3());
    expect(ship.controlMode).toBe("Cruise");
    expect(ship.rcsEnabled).toBe(true);
    expect(ship.sasEnabled).toBe(true);
    expect(ship.mainThrottleCommand).toBe(0);
    expect(ship.translationCommand).toEqual(vec3());
    expect(ship.rotationCommand).toEqual(vec3());
    expect(ship.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(ship.actuatorTelemetry.lastAppliedAcceleration).toEqual(vec3());
  });

  it("clamps throttle commands and applies deterministic main thrust in Cruise mode", () => {
    const ship = createShipStateV2({ fuel: 50, mainThrottleCommand: 0 });

    const cut = applyFlightControllerStep(ship, { mainThrottleCommand: -1 }, 1);
    const full = applyFlightControllerStep(ship, { mainThrottleCommand: 4 }, 1);

    expect(cut.throttle).toBe(0);
    expect(cut.velocity).toEqual(vec3());
    expect(cut.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(full.throttle).toBe(1);
    expect(full.velocity.x).toBeGreaterThan(0);
    expect(full.position.x).toBeGreaterThan(0);
    expect(full.fuel.current).toBeLessThan(ship.fuel.current);
    expect(full.actuatorTelemetry.mainThrustActive).toBe(true);
    expect(full.actuatorTelemetry.lastAppliedAcceleration.x).toBeGreaterThan(0);
  });

  it("applies RCS translation only when enabled and in Translation mode unless explicitly requested", () => {
    const ship = createShipStateV2({ fuel: 50, controlMode: "Cruise", rcsEnabled: true });

    const cruiseIgnored = applyFlightControllerStep(ship, { translationCommand: vec3(0, 1, 0) }, 1);
    const translation = applyFlightControllerStep(ship, { controlMode: "Translation", translationCommand: vec3(0, 1, 0) }, 1);
    const autopilotOverride = applyFlightControllerStep(ship, { translationCommand: vec3(0, 0, 1), allowRcsTranslationOutsideTranslationMode: true }, 1);
    const rcsOff = applyFlightControllerStep(ship, { controlMode: "Translation", rcsEnabled: false, translationCommand: vec3(0, 1, 0) }, 1);

    expect(cruiseIgnored.actuatorTelemetry.rcsTranslationActive).toBe(false);
    expect(cruiseIgnored.velocity.y).toBe(0);
    expect(translation.actuatorTelemetry.rcsTranslationActive).toBe(true);
    expect(translation.velocity.y).toBeGreaterThan(0);
    expect(autopilotOverride.actuatorTelemetry.rcsTranslationActive).toBe(true);
    expect(autopilotOverride.velocity.z).toBeGreaterThan(0);
    expect(rcsOff.actuatorTelemetry.rcsTranslationActive).toBe(false);
    expect(rcsOff.velocity.y).toBe(0);
  });

  it("applies RCS rotation and SAS damping from shared actuator telemetry", () => {
    const rotating = createShipStateV2({ fuel: 50, angularVelocity: vec3(0, 1, 0), sasEnabled: true, rcsEnabled: true });

    const afterSas = applyFlightControllerStep(rotating, { rotationCommand: vec3() }, 1);
    const afterRotation = applyFlightControllerStep(createShipStateV2({ fuel: 50, sasEnabled: false }), { rotationCommand: vec3(0, 0, 1) }, 1);

    expect(afterSas.actuatorTelemetry.sasCorrectionActive).toBe(true);
    expect(magnitude(afterSas.angularVelocity)).toBeLessThan(magnitude(rotating.angularVelocity));
    expect(afterRotation.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(afterRotation.angularVelocity.z).toBeGreaterThan(0);
    expect(afterRotation.orientation).not.toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it("uses ship orientation as the main-thrust forward direction", () => {
    const ship = createShipStateV2({ fuel: 50, orientation: orientationFromForward(vec3(0, 0, 1)) });

    const after = applyFlightControllerStep(ship, { mainThrottleCommand: 1 }, 1);

    expect(after.velocity.z).toBeGreaterThan(0);
    expect(Math.abs(after.velocity.x)).toBeLessThan(0.000001);
  });

  it("serializes Flight State V2 numeric fields without losing actuator telemetry", () => {
    const ship = applyFlightControllerStep(createShipStateV2({ fuel: 50 }), { mainThrottleCommand: 1, rotationCommand: vec3(0.25, 0, 0) }, 1 / 3);
    const snapshot = serializeTelemetry({
      ship,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ship.fuel,
        flightSnapshot: { mass: ship.mass, fuel: ship.fuel, authority: ship.authority, brakingReserve: { requiredDeltaV: 0, availableDeltaV: 0, canBrake: true, reasonCodes: [] }, routeValid: true, failureReasonCodes: [], etaSeconds: null },
        position: ship.position,
        velocity: ship.velocity
      },
      lockedPlan: null,
      flightSnapshot: { mass: ship.mass, fuel: ship.fuel, authority: ship.authority, brakingReserve: { requiredDeltaV: 0, availableDeltaV: 0, canBrake: true, reasonCodes: [] }, routeValid: true, failureReasonCodes: [], etaSeconds: null }
    });

    expect(snapshot.ship.orientation.w).toBe(Number(snapshot.ship.orientation.w.toFixed(6)));
    expect(snapshot.ship.mainThrottleCommand).toBe(1);
    expect(snapshot.ship.actuatorTelemetry.mainThrustActive).toBe(true);
    expect(snapshot.ship.actuatorTelemetry.lastAppliedAcceleration.x).toBeGreaterThan(0);
  });
});
