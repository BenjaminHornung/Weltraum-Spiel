import type { ControlModeEffectReasonCode, ControlModeEffectSnapshot, FlightControlMode, Quaternion, ShipState } from "../core/types";
import { add, clamp, magnitude, normalize, scale, vec3, type Vec3 } from "../core/vector";
import { accelerationLimitForMass, createFuelState, createShipMass, defaultFlightModelOptions, inactiveActuatorTelemetry, type FlightModelOptions } from "./state";

export interface FlightControllerOptions extends FlightModelOptions {
  readonly rcsAcceleration: number;
  readonly rcsAngularAcceleration: number;
  readonly sasDamping: number;
}

export interface FlightControllerStepRequest {
  readonly controlMode?: FlightControlMode;
  readonly rcsEnabled?: boolean;
  readonly sasEnabled?: boolean;
  readonly mainThrottleCommand?: number;
  readonly translationCommand?: Vec3;
  readonly rotationCommand?: Vec3;
  readonly desiredAcceleration?: Vec3;
  readonly desiredFacingDirection?: Vec3;
  readonly allowRcsTranslationOutsideTranslationMode?: boolean;
}

export const defaultFlightControllerOptions: FlightControllerOptions = {
  ...defaultFlightModelOptions,
  rcsAcceleration: 2.5,
  rcsAngularAcceleration: 1.8,
  sasDamping: 1.35
};

const modeEffectLabel = (controlMode: FlightControlMode): string => {
  if (controlMode === "Cruise") {
    return "main thrust enabled";
  }
  if (controlMode === "Precision") {
    return "RCS attitude / main thrust blocked";
  }
  return "RCS translation / main thrust blocked";
};

const rotationResponseScaleForMode = (controlMode: FlightControlMode): number => {
  if (controlMode === "Precision") {
    return 0.45;
  }
  if (controlMode === "Translation") {
    return 0.65;
  }
  return 1;
};

const uniqueReasonCodes = (codes: readonly ControlModeEffectReasonCode[]): readonly ControlModeEffectReasonCode[] => [...new Set(codes)];

export const identityQuaternion = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 });

export const normalizeQuaternion = (q: Quaternion): Quaternion => {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (length <= 1e-9) {
    return identityQuaternion();
  }

  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
};

export const multiplyQuaternion = (a: Quaternion, b: Quaternion): Quaternion =>
  normalizeQuaternion({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  });

const multiplyQuaternionRaw = (a: Quaternion, b: Quaternion): Quaternion => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
});

export const quaternionFromAxisAngle = (axis: Vec3, radians: number): Quaternion => {
  const unitAxis = normalize(axis);
  const half = radians * 0.5;
  const sinHalf = Math.sin(half);
  return normalizeQuaternion({ x: unitAxis.x * sinHalf, y: unitAxis.y * sinHalf, z: unitAxis.z * sinHalf, w: Math.cos(half) });
};

export const rotateVectorByQuaternion = (q: Quaternion, v: Vec3): Vec3 => {
  const orientation = normalizeQuaternion(q);
  const vectorQuaternion = { x: v.x, y: v.y, z: v.z, w: 0 };
  const inverse = { x: -orientation.x, y: -orientation.y, z: -orientation.z, w: orientation.w };
  const rotated = multiplyQuaternionRaw(multiplyQuaternionRaw(orientation, vectorQuaternion), inverse);
  return vec3(rotated.x, rotated.y, rotated.z);
};

export const orientationFromForward = (forward: Vec3): Quaternion => {
  const target = normalize(forward);
  if (magnitude(target) <= 1e-9) {
    return identityQuaternion();
  }

  const localForward = vec3(1, 0, 0);
  const dot = clamp(localForward.x * target.x + localForward.y * target.y + localForward.z * target.z, -1, 1);
  if (dot > 0.999999) {
    return identityQuaternion();
  }
  if (dot < -0.999999) {
    return quaternionFromAxisAngle(vec3(0, 1, 0), Math.PI);
  }

  const axis = normalize(vec3(localForward.y * target.z - localForward.z * target.y, localForward.z * target.x - localForward.x * target.z, localForward.x * target.y - localForward.y * target.x));
  return quaternionFromAxisAngle(axis, Math.acos(dot));
};

const clampCommandVector = (command: Vec3 | undefined): Vec3 => vec3(clamp(command?.x ?? 0, -1, 1), clamp(command?.y ?? 0, -1, 1), clamp(command?.z ?? 0, -1, 1));

const clampAccelerationVector = (acceleration: Vec3, accelerationLimit: number): Vec3 => {
  const accelerationMagnitude = magnitude(acceleration);
  if (accelerationMagnitude <= accelerationLimit) {
    return acceleration;
  }

  return scale(normalize(acceleration), accelerationLimit);
};

const rotationCommandForFacing = (orientation: Quaternion, desiredFacingDirection: Vec3 | undefined): Vec3 => {
  const desiredForward = normalize(desiredFacingDirection ?? vec3());
  if (magnitude(desiredForward) <= 1e-9) {
    return vec3();
  }

  const currentForward = normalize(rotateVectorByQuaternion(orientation, vec3(1, 0, 0)));
  const alignment = clamp(
    currentForward.x * desiredForward.x + currentForward.y * desiredForward.y + currentForward.z * desiredForward.z,
    -1,
    1
  );
  const angle = Math.acos(alignment);
  if (angle <= 1e-4) {
    return vec3();
  }

  let axis = vec3(
    currentForward.y * desiredForward.z - currentForward.z * desiredForward.y,
    currentForward.z * desiredForward.x - currentForward.x * desiredForward.z,
    currentForward.x * desiredForward.y - currentForward.y * desiredForward.x
  );
  if (magnitude(axis) <= 1e-6) {
    axis = Math.abs(currentForward.y) < 0.9 ? vec3(0, 1, 0) : vec3(0, 0, 1);
  }

  return scale(normalize(axis), clamp(angle / (Math.PI * 0.5), 0, 1));
};

const createControlModeEffect = (
  ship: ShipState,
  controlMode: FlightControlMode,
  rcsEnabled: boolean,
  sasEnabled: boolean,
  allowRcsTranslationOutsideTranslationMode: boolean
): ControlModeEffectSnapshot => {
  const blockedReasonCodes: ControlModeEffectReasonCode[] = [];
  const notes: string[] = [];
  const mainThrustModeAllowed = controlMode === "Cruise";
  const mainThrustAllowed = mainThrustModeAllowed && ship.authority.mainThrustersAvailable && ship.fuel.current > 0;
  const rcsBaseAllowed = rcsEnabled && ship.authority.rcsAvailable;
  const rcsRotationAllowed = rcsBaseAllowed && ship.authority.rotationAuthority > 0;
  const translationModeAllowed = controlMode === "Translation" || allowRcsTranslationOutsideTranslationMode;
  const rcsTranslationAllowed = rcsBaseAllowed && ship.authority.translationAuthority > 0 && translationModeAllowed;
  const sasAllowed = sasEnabled && ship.authority.sasAvailable && rcsRotationAllowed;

  if (!mainThrustModeAllowed) {
    blockedReasonCodes.push("MainThrustModeBlocked");
    notes.push("main thrust mode-blocked");
  } else if (!ship.authority.mainThrustersAvailable) {
    blockedReasonCodes.push("MainThrustUnavailable");
    notes.push("main thrust unavailable");
  } else if (ship.fuel.current <= 0) {
    blockedReasonCodes.push("MainThrustFuelBlocked");
    notes.push("main thrust fuel-blocked");
  } else {
    notes.push("main thrust ready");
  }

  if (!rcsEnabled) {
    blockedReasonCodes.push("RcsDisabled");
    notes.push("RCS disabled");
  } else if (!ship.authority.rcsAvailable) {
    blockedReasonCodes.push("RcsUnavailable");
    notes.push("RCS unavailable");
  } else {
    notes.push("RCS available");
  }

  if (!translationModeAllowed) {
    blockedReasonCodes.push("RcsTranslationModeBlocked");
  } else if (ship.authority.translationAuthority <= 0) {
    blockedReasonCodes.push("RcsTranslationNoAuthority");
  }

  if (ship.authority.rotationAuthority <= 0) {
    blockedReasonCodes.push("RcsRotationNoAuthority");
  }

  if (!sasEnabled) {
    blockedReasonCodes.push("SasDisabled");
  } else if (!ship.authority.sasAvailable) {
    blockedReasonCodes.push("SasUnavailable");
  } else if (!rcsRotationAllowed) {
    blockedReasonCodes.push("SasNoRcsAuthority");
  }

  return {
    controlMode,
    mainThrustAllowed,
    rcsTranslationAllowed,
    rcsRotationAllowed,
    sasAllowed,
    modeEffectLabel: modeEffectLabel(controlMode),
    blockedReasonCodes: uniqueReasonCodes(blockedReasonCodes),
    notes,
    rotationResponseScale: rotationResponseScaleForMode(controlMode)
  };
};

const integrateOrientation = (orientation: Quaternion, angularVelocity: Vec3, fixedDeltaSeconds: number): Quaternion => {
  const angularSpeed = magnitude(angularVelocity);
  if (angularSpeed <= 1e-9 || fixedDeltaSeconds <= 0) {
    return normalizeQuaternion(orientation);
  }

  return multiplyQuaternion(normalizeQuaternion(orientation), quaternionFromAxisAngle(angularVelocity, angularSpeed * fixedDeltaSeconds));
};

const burnFuelForAcceleration = (ship: ShipState, accelerationMagnitude: number, fixedDeltaSeconds: number): Pick<ShipState, "fuel" | "mass"> => {
  const kilonewtonSeconds = accelerationMagnitude * (ship.mass.totalMass / 1_000) * fixedDeltaSeconds;
  const fuel = createFuelState({
    capacity: ship.fuel.capacity,
    current: ship.fuel.current - kilonewtonSeconds * ship.fuel.burnRate,
    reserve: ship.fuel.reserve,
    burnRate: ship.fuel.burnRate
  });
  return { fuel, mass: createShipMass({ dryMass: ship.mass.dryMass, cargoMass: ship.mass.cargoMass, fuelMass: fuel.current }) };
};

export const applyFlightControllerStep = (
  ship: ShipState,
  request: FlightControllerStepRequest = {},
  fixedDeltaSeconds: number,
  options: Partial<FlightControllerOptions> = {}
): ShipState => {
  const controllerOptions = { ...defaultFlightControllerOptions, ...options };
  const controlMode = request.controlMode ?? ship.controlMode;
  const rcsEnabled = request.rcsEnabled ?? ship.rcsEnabled;
  const sasEnabled = request.sasEnabled ?? ship.sasEnabled;
  const requestedMainThrottleCommand = clamp(request.mainThrottleCommand ?? ship.mainThrottleCommand, 0, 1);
  const mainThrottleCommand = controlMode === "Cruise" ? requestedMainThrottleCommand : 0;
  const translationCommand = clampCommandVector(request.translationCommand ?? ship.translationCommand);
  const requestedRotationCommand = clampCommandVector(add(request.rotationCommand ?? ship.rotationCommand, rotationCommandForFacing(ship.orientation, request.desiredFacingDirection)));
  const rotationCommand = controlMode === "Translation" ? vec3(requestedRotationCommand.x, 0, 0) : requestedRotationCommand;
  const accelerationLimit = accelerationLimitForMass(ship.mass, controllerOptions);
  const desiredAcceleration = request.desiredAcceleration ? clampAccelerationVector(request.desiredAcceleration, accelerationLimit) : null;
  const controlModeEffect = createControlModeEffect(ship, controlMode, rcsEnabled, sasEnabled, request.allowRcsTranslationOutsideTranslationMode === true);
  const canUseMainThrust = controlModeEffect.mainThrustAllowed && (mainThrottleCommand > 1e-6 || magnitude(desiredAcceleration ?? vec3()) > 1e-6);
  const mainAccelerationMagnitude = canUseMainThrust ? accelerationLimit * mainThrottleCommand : 0;
  const mainAcceleration = canUseMainThrust ? (desiredAcceleration ?? scale(rotateVectorByQuaternion(ship.orientation, vec3(1, 0, 0)), mainAccelerationMagnitude)) : vec3();

  const translationMagnitude = magnitude(translationCommand);
  const canTranslateWithRcs = controlModeEffect.rcsTranslationAllowed && translationMagnitude > 1e-6;
  const rcsTranslationAcceleration = canTranslateWithRcs
    ? scale(rotateVectorByQuaternion(ship.orientation, normalize(translationCommand)), controllerOptions.rcsAcceleration * ship.authority.translationAuthority)
    : vec3();
  const appliedAcceleration = add(mainAcceleration, rcsTranslationAcceleration);

  const rcsRotationAngularAcceleration =
    controlModeEffect.rcsRotationAllowed && magnitude(rotationCommand) > 1e-6
      ? scale(rotationCommand, controllerOptions.rcsAngularAcceleration * ship.authority.rotationAuthority * controlModeEffect.rotationResponseScale)
      : vec3();
  const sasAngularAcceleration =
    controlModeEffect.sasAllowed && magnitude(ship.angularVelocity) > 1e-6 ? scale(ship.angularVelocity, -controllerOptions.sasDamping) : vec3();
  const appliedAngularAcceleration = add(rcsRotationAngularAcceleration, sasAngularAcceleration);

  const elapsed = Math.max(0, fixedDeltaSeconds);
  const nextVelocity = add(ship.velocity, scale(appliedAcceleration, elapsed));
  const nextPosition = add(ship.position, scale(nextVelocity, elapsed));
  const nextAngularVelocity = add(ship.angularVelocity, scale(appliedAngularAcceleration, elapsed));
  const nextOrientation = integrateOrientation(ship.orientation, nextAngularVelocity, elapsed);
  const burned = burnFuelForAcceleration(ship, magnitude(appliedAcceleration), elapsed);
  const actuatorTelemetry = {
    ...inactiveActuatorTelemetry(),
    mainThrustActive: canUseMainThrust,
    rcsTranslationActive: canTranslateWithRcs,
    rcsRotationActive: magnitude(rcsRotationAngularAcceleration) > 1e-6,
    sasCorrectionActive: magnitude(sasAngularAcceleration) > 1e-6,
    controlModeEffect,
    lastAppliedAcceleration: appliedAcceleration,
    lastAppliedAngularAcceleration: appliedAngularAcceleration
  };

  return {
    ...ship,
    position: nextPosition,
    velocity: nextVelocity,
    orientation: nextOrientation,
    angularVelocity: nextAngularVelocity,
    throttle: mainThrottleCommand,
    controlMode,
    rcsEnabled,
    sasEnabled,
    mainThrottleCommand,
    translationCommand,
    rotationCommand,
    actuatorTelemetry,
    fuel: burned.fuel,
    mass: burned.mass
  };
};
