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
    expect(ship.actuatorTelemetry.controlModeEffect).toEqual(
      expect.objectContaining({
        controlMode: "Cruise",
        mainThrustAllowed: true,
        rcsTranslationAllowed: false,
        rcsRotationAllowed: true,
        sasAllowed: true,
        modeEffectLabel: "main thrust enabled"
      })
    );
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
    expect(full.actuatorTelemetry.controlModeEffect.mainThrustAllowed).toBe(true);
    expect(full.actuatorTelemetry.lastAppliedAcceleration.x).toBeGreaterThan(0);
  });

  it("blocks and clears main throttle in Precision and Translation", () => {
    const ship = createShipStateV2({ fuel: 50, mainThrottleCommand: 0 });

    const precision = applyFlightControllerStep(ship, { controlMode: "Precision", mainThrottleCommand: 1 }, 1);
    const translation = applyFlightControllerStep(ship, { controlMode: "Translation", mainThrottleCommand: 1 }, 1);

    expect(precision.throttle).toBe(0);
    expect(precision.mainThrottleCommand).toBe(0);
    expect(precision.velocity).toEqual(vec3());
    expect(precision.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(precision.actuatorTelemetry.controlModeEffect).toEqual(
      expect.objectContaining({
        controlMode: "Precision",
        mainThrustAllowed: false,
        rcsTranslationAllowed: false,
        rcsRotationAllowed: true,
        modeEffectLabel: "RCS attitude / main thrust blocked"
      })
    );
    expect(precision.actuatorTelemetry.controlModeEffect.blockedReasonCodes).toEqual(expect.arrayContaining(["MainThrustModeBlocked", "RcsTranslationModeBlocked"]));

    expect(translation.throttle).toBe(0);
    expect(translation.mainThrottleCommand).toBe(0);
    expect(translation.velocity).toEqual(vec3());
    expect(translation.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(translation.actuatorTelemetry.controlModeEffect).toEqual(
      expect.objectContaining({
        controlMode: "Translation",
        mainThrustAllowed: false,
        rcsTranslationAllowed: true,
        rcsRotationAllowed: true,
        modeEffectLabel: "RCS translation / main thrust blocked"
      })
    );
    expect(translation.actuatorTelemetry.controlModeEffect.blockedReasonCodes).toContain("MainThrustModeBlocked");
  });

  it("does not bank non-Cruise throttle for a later Cruise burn", () => {
    const ship = createShipStateV2({ fuel: 50, controlMode: "Precision", throttle: 0.75, mainThrottleCommand: 0.75 });

    const precision = applyFlightControllerStep(ship, { controlMode: "Precision", mainThrottleCommand: 1 }, 1);
    const backToCruise = applyFlightControllerStep(precision, { controlMode: "Cruise" }, 1);

    expect(precision.throttle).toBe(0);
    expect(precision.mainThrottleCommand).toBe(0);
    expect(precision.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(backToCruise.throttle).toBe(0);
    expect(backToCruise.mainThrottleCommand).toBe(0);
    expect(backToCruise.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(backToCruise.velocity).toEqual(vec3());
  });

  it("makes Precision RCS rotation effective but finer than Cruise", () => {
    const ship = createShipStateV2({ fuel: 50, rcsEnabled: true, sasEnabled: false });

    const cruise = applyFlightControllerStep(ship, { controlMode: "Cruise", rotationCommand: vec3(0, 0, 1) }, 1);
    const precision = applyFlightControllerStep(ship, { controlMode: "Precision", rotationCommand: vec3(0, 0, 1) }, 1);

    expect(cruise.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(precision.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(precision.angularVelocity.z).toBeGreaterThan(0);
    expect(precision.angularVelocity.z).toBeLessThan(cruise.angularVelocity.z);
    expect(precision.actuatorTelemetry.controlModeEffect.rotationResponseScale).toBeLessThan(cruise.actuatorTelemetry.controlModeEffect.rotationResponseScale);
  });

  it("keeps Translation RCS translation and Q/E roll rotation independently observable", () => {
    const ship = createShipStateV2({ fuel: 50, controlMode: "Translation", rcsEnabled: true, sasEnabled: false });

    const translated = applyFlightControllerStep(ship, { translationCommand: vec3(1, 0, 0), rotationCommand: vec3() }, 1);
    const rolled = applyFlightControllerStep(ship, { translationCommand: vec3(), rotationCommand: vec3(1, 0, 0) }, 1);

    expect(translated.actuatorTelemetry.rcsTranslationActive).toBe(true);
    expect(translated.actuatorTelemetry.rcsRotationActive).toBe(false);
    expect(magnitude(translated.actuatorTelemetry.lastAppliedAcceleration)).toBeGreaterThan(0);
    expect(magnitude(translated.actuatorTelemetry.lastAppliedAngularAcceleration)).toBe(0);
    expect(rolled.actuatorTelemetry.rcsTranslationActive).toBe(false);
    expect(rolled.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(magnitude(rolled.actuatorTelemetry.lastAppliedAcceleration)).toBe(0);
    expect(magnitude(rolled.actuatorTelemetry.lastAppliedAngularAcceleration)).toBeGreaterThan(0);
  });

  it("masks Translation rotation to roll-only while ignoring yaw and pitch", () => {
    const ship = createShipStateV2({ fuel: 50, controlMode: "Translation", rcsEnabled: true, sasEnabled: false });

    const yawPitchOnly = applyFlightControllerStep(ship, { rotationCommand: vec3(0, 1, 1) }, 1);
    const rollWithYawPitch = applyFlightControllerStep(ship, { rotationCommand: vec3(1, 1, 1) }, 1);

    expect(yawPitchOnly.rotationCommand).toEqual(vec3());
    expect(yawPitchOnly.actuatorTelemetry.rcsRotationActive).toBe(false);
    expect(yawPitchOnly.angularVelocity).toEqual(vec3());
    expect(yawPitchOnly.actuatorTelemetry.lastAppliedAngularAcceleration).toEqual(vec3());

    expect(rollWithYawPitch.rotationCommand).toEqual(vec3(1, 0, 0));
    expect(rollWithYawPitch.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(rollWithYawPitch.angularVelocity.x).toBeGreaterThan(0);
    expect(rollWithYawPitch.angularVelocity.y).toBe(0);
    expect(rollWithYawPitch.angularVelocity.z).toBe(0);
  });

  it("reports RCS-disabled Precision and Translation authority as visibly blocked", () => {
    const ship = createShipStateV2({ fuel: 50, rcsEnabled: false, sasEnabled: true });

    const precision = applyFlightControllerStep(ship, { controlMode: "Precision", rcsEnabled: false, rotationCommand: vec3(0, 0, 1) }, 1);
    const translation = applyFlightControllerStep(ship, { controlMode: "Translation", rcsEnabled: false, translationCommand: vec3(0, 1, 0) }, 1);

    expect(precision.actuatorTelemetry.rcsRotationActive).toBe(false);
    expect(precision.actuatorTelemetry.controlModeEffect.rcsRotationAllowed).toBe(false);
    expect(precision.actuatorTelemetry.controlModeEffect.sasAllowed).toBe(false);
    expect(precision.actuatorTelemetry.controlModeEffect.blockedReasonCodes).toEqual(expect.arrayContaining(["RcsDisabled", "SasNoRcsAuthority"]));
    expect(translation.actuatorTelemetry.rcsTranslationActive).toBe(false);
    expect(translation.actuatorTelemetry.controlModeEffect.rcsTranslationAllowed).toBe(false);
    expect(translation.actuatorTelemetry.controlModeEffect.blockedReasonCodes).toEqual(expect.arrayContaining(["RcsDisabled", "SasNoRcsAuthority"]));
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

  it("keeps SAS damping strength independent from manual rotation response scale", () => {
    const rotating = createShipStateV2({ fuel: 50, angularVelocity: vec3(0, 1, 0), sasEnabled: true, rcsEnabled: true });

    const cruise = applyFlightControllerStep(rotating, { controlMode: "Cruise", rotationCommand: vec3() }, 0.25);
    const precision = applyFlightControllerStep(rotating, { controlMode: "Precision", rotationCommand: vec3() }, 0.25);
    const translation = applyFlightControllerStep(rotating, { controlMode: "Translation", rotationCommand: vec3() }, 0.25);

    expect(cruise.actuatorTelemetry.controlModeEffect.rotationResponseScale).toBe(1);
    expect(precision.actuatorTelemetry.controlModeEffect.rotationResponseScale).toBeLessThan(1);
    expect(translation.actuatorTelemetry.controlModeEffect.rotationResponseScale).toBeLessThan(1);
    expect(precision.angularVelocity.y).toBeCloseTo(cruise.angularVelocity.y, 8);
    expect(translation.angularVelocity.y).toBeCloseTo(cruise.angularVelocity.y, 8);
    expect(cruise.actuatorTelemetry.sasCorrectionActive).toBe(true);
    expect(precision.actuatorTelemetry.sasCorrectionActive).toBe(true);
    expect(translation.actuatorTelemetry.sasCorrectionActive).toBe(true);
  });

  it("blocks SAS damping when rotation authority is missing", () => {
    const rotating = createShipStateV2({
      fuel: 50,
      angularVelocity: vec3(0, 1, 0),
      sasEnabled: true,
      rcsEnabled: true,
      authority: { rotationAuthority: 0 }
    });

    const after = applyFlightControllerStep(rotating, { rotationCommand: vec3() }, 1);

    expect(after.actuatorTelemetry.controlModeEffect.rcsRotationAllowed).toBe(false);
    expect(after.actuatorTelemetry.controlModeEffect.sasAllowed).toBe(false);
    expect(after.actuatorTelemetry.controlModeEffect.blockedReasonCodes).toEqual(expect.arrayContaining(["RcsRotationNoAuthority", "SasNoRcsAuthority"]));
    expect(after.actuatorTelemetry.sasCorrectionActive).toBe(false);
    expect(after.angularVelocity).toEqual(rotating.angularVelocity);
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
