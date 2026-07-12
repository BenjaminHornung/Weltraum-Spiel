import type { OccupantAccelerationEnvelope, OccupantMode, ResolvedTransitPolicy, ShipMass, ShipPropulsionCapability } from "../core/types";

export const STANDARD_GRAVITY_MPS2 = 9.80665;

const finiteNonNegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
};

const finitePositive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number.`);
  }
};

const isJsonValue = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
};

/** Rejects non-serializable or non-finite propulsion snapshots at the Browser boundary. */
export const assertValidShipPropulsionCapability = (capability: ShipPropulsionCapability): ShipPropulsionCapability => {
  finiteNonNegative(capability.mainThrustNewton, "mainThrustNewton");
  finiteNonNegative(capability.effectiveBrakingThrustNewton, "effectiveBrakingThrustNewton");
  finiteNonNegative(capability.structuralMaxAccelerationMps2, "structuralMaxAccelerationMps2");
  finiteNonNegative(capability.sustainedThermalMaxAccelerationMps2, "sustainedThermalMaxAccelerationMps2");
  finiteNonNegative(capability.maximumPeakAccelerationMps2, "maximumPeakAccelerationMps2");
  finiteNonNegative(capability.maximumAngularAcceleration, "maximumAngularAcceleration");
  finiteNonNegative(capability.maximumAngularVelocity, "maximumAngularVelocity");

  if (capability.maximumCruiseSpeedMps !== undefined) {
    finiteNonNegative(capability.maximumCruiseSpeedMps, "maximumCruiseSpeedMps");
  }
  if (capability.fuelEfficiency) {
    finiteNonNegative(capability.fuelEfficiency.modeledImpulsePerFuelKilogram, "fuelEfficiency.modeledImpulsePerFuelKilogram");
  }
  if (capability.heat) {
    finiteNonNegative(capability.heat.heatLoadPerNewtonSecond, "heat.heatLoadPerNewtonSecond");
    finiteNonNegative(capability.heat.sustainedCoolingCapacity, "heat.sustainedCoolingCapacity");
  }
  for (const [key, value] of Object.entries(capability.extensions ?? {})) {
    if (!key.includes(":")) {
      throw new RangeError("Capability extension keys must be namespaced.");
    }
    if (!isJsonValue(value)) {
      throw new RangeError(`Capability extension ${key} must be JSON-serializable.`);
    }
  }

  return capability;
};

/** Rejects non-finite occupant data without inventing biological limits for drones. */
export const assertValidOccupantAccelerationEnvelope = (envelope: OccupantAccelerationEnvelope): OccupantAccelerationEnvelope => {
  finiteNonNegative(envelope.preferredAccelerationMps2, "preferredAccelerationMps2");
  finiteNonNegative(envelope.minimumComfortAccelerationMps2, "minimumComfortAccelerationMps2");
  finiteNonNegative(envelope.maximumJerkMps3, "maximumJerkMps3");
  if (envelope.maximumSustainedAccelerationMps2 !== undefined) {
    finiteNonNegative(envelope.maximumSustainedAccelerationMps2, "maximumSustainedAccelerationMps2");
  }
  if (envelope.maximumPeakAccelerationMps2 !== undefined) {
    finiteNonNegative(envelope.maximumPeakAccelerationMps2, "maximumPeakAccelerationMps2");
  }
  if (envelope.occupantMode === "HumanCrew" && (envelope.maximumSustainedAccelerationMps2 === undefined || envelope.maximumPeakAccelerationMps2 === undefined)) {
    throw new RangeError("Human crew envelopes require finite sustained and peak acceleration maxima.");
  }
  return envelope;
};

const fixture = (capability: ShipPropulsionCapability): ShipPropulsionCapability => Object.freeze(assertValidShipPropulsionCapability(capability));

/** Deterministic generic fixtures; they intentionally do not encode engine technology names. */
export const normalCrewedScoutPropulsionCapability = fixture({
  version: 1,
  mainThrustNewton: 30_000,
  effectiveBrakingThrustNewton: 27_000,
  structuralMaxAccelerationMps2: 24,
  sustainedThermalMaxAccelerationMps2: 18,
  maximumPeakAccelerationMps2: 25,
  maximumAngularAcceleration: 1.8,
  maximumAngularVelocity: 1.25,
  maximumCruiseSpeedMps: 220,
  fuelEfficiency: { version: 1, modeledImpulsePerFuelKilogram: 500_000 },
  heat: { version: 1, heatLoadPerNewtonSecond: 0.0004, sustainedCoolingCapacity: 12 },
  extensions: { "weltraum-browser:fixture": "normal-crewed-scout" }
});

export const highThrustCrewedShipPropulsionCapability = fixture({
  version: 1,
  mainThrustNewton: 90_000,
  effectiveBrakingThrustNewton: 82_000,
  structuralMaxAccelerationMps2: 52,
  sustainedThermalMaxAccelerationMps2: 44,
  maximumPeakAccelerationMps2: 56,
  maximumAngularAcceleration: 2.6,
  maximumAngularVelocity: 1.65,
  maximumCruiseSpeedMps: 460,
  fuelEfficiency: { version: 1, modeledImpulsePerFuelKilogram: 470_000 },
  heat: { version: 1, heatLoadPerNewtonSecond: 0.0008, sustainedCoolingCapacity: 34 },
  extensions: { "weltraum-browser:fixture": "high-thrust-crewed-ship" }
});

export const underpoweredCrewedCargoShipPropulsionCapability = fixture({
  version: 1,
  mainThrustNewton: 6_500,
  effectiveBrakingThrustNewton: 6_000,
  structuralMaxAccelerationMps2: 9,
  sustainedThermalMaxAccelerationMps2: 7,
  maximumPeakAccelerationMps2: 10,
  maximumAngularAcceleration: 0.9,
  maximumAngularVelocity: 0.8,
  maximumCruiseSpeedMps: 90,
  fuelEfficiency: { version: 1, modeledImpulsePerFuelKilogram: 540_000 },
  heat: { version: 1, heatLoadPerNewtonSecond: 0.0002, sustainedCoolingCapacity: 5 },
  extensions: { "weltraum-browser:fixture": "underpowered-crewed-cargo-ship" }
});

export const highGCrewlessDronePropulsionCapability = fixture({
  version: 1,
  mainThrustNewton: 180_000,
  effectiveBrakingThrustNewton: 165_000,
  structuralMaxAccelerationMps2: 75,
  sustainedThermalMaxAccelerationMps2: 60,
  maximumPeakAccelerationMps2: 80,
  maximumAngularAcceleration: 4.5,
  maximumAngularVelocity: 3.2,
  maximumCruiseSpeedMps: 720,
  fuelEfficiency: { version: 1, modeledImpulsePerFuelKilogram: 420_000 },
  heat: { version: 1, heatLoadPerNewtonSecond: 0.0011, sustainedCoolingCapacity: 68 },
  extensions: { "weltraum-browser:fixture": "high-g-crewless-drone" }
});

export const genericShipPropulsionCapabilityFixtures = Object.freeze({
  normalCrewedScout: normalCrewedScoutPropulsionCapability,
  highThrustCrewedShip: highThrustCrewedShipPropulsionCapability,
  underpoweredCrewedCargoShip: underpoweredCrewedCargoShipPropulsionCapability,
  highGCrewlessDrone: highGCrewlessDronePropulsionCapability
});

export const defaultHumanCrewAccelerationEnvelope: OccupantAccelerationEnvelope = Object.freeze({
  version: 1,
  occupantMode: "HumanCrew",
  preferredAccelerationMps2: STANDARD_GRAVITY_MPS2,
  minimumComfortAccelerationMps2: STANDARD_GRAVITY_MPS2 * 0.8,
  maximumSustainedAccelerationMps2: STANDARD_GRAVITY_MPS2 * 1.5,
  maximumPeakAccelerationMps2: STANDARD_GRAVITY_MPS2 * 1.5,
  maximumJerkMps3: 4,
  gravityFloorPolicy: "Preferred"
});

export const defaultCrewlessDroneAccelerationEnvelope: OccupantAccelerationEnvelope = Object.freeze({
  version: 1,
  occupantMode: "CrewlessDrone",
  preferredAccelerationMps2: 0,
  minimumComfortAccelerationMps2: 0,
  maximumJerkMps3: 80,
  gravityFloorPolicy: "Disabled"
});

export const occupantAccelerationEnvelopeFor = (occupantMode: OccupantMode): OccupantAccelerationEnvelope =>
  occupantMode === "CrewlessDrone" ? defaultCrewlessDroneAccelerationEnvelope : defaultHumanCrewAccelerationEnvelope;

export interface PropulsionAccelerationDerivationInput {
  readonly mass: ShipMass;
  readonly capability: ShipPropulsionCapability;
  readonly occupantAccelerationEnvelope: OccupantAccelerationEnvelope;
  readonly policy: ResolvedTransitPolicy;
  /** Temporary migration clamp supplied by legacy FlightModelOptions, when present. */
  readonly compatibilityMaximumAccelerationMps2?: number;
}

export interface UsablePropulsionAccelerations {
  readonly mainAccelerationMps2: number;
  readonly brakingAccelerationMps2: number;
  readonly rawMainAccelerationMps2: number;
  readonly rawBrakingAccelerationMps2: number;
  readonly capabilityAccelerationLimitMps2: number;
  readonly occupantAccelerationLimitMps2?: number;
  readonly policyMaximumAccelerationMps2: number;
  readonly compatibilityMaximumAccelerationMps2?: number;
}

/**
 * One authority model for planning and execution. A locked plan supplies the
 * ceiling; live ship data may lower it but can never raise it. The combined
 * limit is the scalar ceiling used when main and RCS translation are applied
 * in the same controller tick.
 */
export interface EffectiveMotionAuthorityInput {
  readonly mass: ShipMass;
  readonly liveCapability: ShipPropulsionCapability;
  readonly liveOccupantAccelerationEnvelope: OccupantAccelerationEnvelope;
  readonly policy: ResolvedTransitPolicy;
  readonly lockedCapability?: ShipPropulsionCapability;
  readonly lockedOccupantAccelerationEnvelope?: OccupantAccelerationEnvelope;
  readonly compatibilityMaximumAccelerationMps2?: number;
}

export interface EffectiveMotionAuthority {
  readonly mainAccelerationMps2: number;
  readonly brakingAccelerationMps2: number;
  readonly combinedAccelerationLimitMps2: number;
  readonly maximumJerkMps3: number;
}

const assertValidPolicy = (policy: ResolvedTransitPolicy): void => {
  finiteNonNegative(policy.maximumAccelerationMps2, "policy.maximumAccelerationMps2");
  finiteNonNegative(policy.maximumJerkMps3, "policy.maximumJerkMps3");
  if (policy.targetAccelerationMps2 !== undefined) {
    finiteNonNegative(policy.targetAccelerationMps2, "policy.targetAccelerationMps2");
  }
  if (policy.targetAccelerationFraction !== undefined && (!Number.isFinite(policy.targetAccelerationFraction) || policy.targetAccelerationFraction < 0 || policy.targetAccelerationFraction > 1)) {
    throw new RangeError("policy.targetAccelerationFraction must be finite and between zero and one.");
  }
};

const accelerationForDirection = (
  rawAccelerationMps2: number,
  capabilityAccelerationLimitMps2: number,
  occupantAccelerationLimitMps2: number | undefined,
  policy: ResolvedTransitPolicy,
  compatibilityMaximumAccelerationMps2: number | undefined
): number => {
  const beforePolicy = occupantAccelerationLimitMps2 === undefined
    ? Math.min(rawAccelerationMps2, capabilityAccelerationLimitMps2)
    : Math.min(rawAccelerationMps2, capabilityAccelerationLimitMps2, occupantAccelerationLimitMps2);
  const requestedAcceleration = policy.targetAccelerationMps2 ?? beforePolicy * (policy.targetAccelerationFraction ?? 1);
  const constrained = Math.min(beforePolicy, requestedAcceleration, policy.maximumAccelerationMps2);
  return compatibilityMaximumAccelerationMps2 === undefined ? constrained : Math.min(constrained, compatibilityMaximumAccelerationMps2);
};

const capabilityAccelerationCeiling = (capability: ShipPropulsionCapability): number => {
  assertValidShipPropulsionCapability(capability);
  return Math.min(
    capability.structuralMaxAccelerationMps2,
    capability.sustainedThermalMaxAccelerationMps2,
    capability.maximumPeakAccelerationMps2
  );
};

const occupantAccelerationCeiling = (envelope: OccupantAccelerationEnvelope): number | undefined => {
  assertValidOccupantAccelerationEnvelope(envelope);
  return envelope.occupantMode === "HumanCrew"
    ? Math.min(envelope.maximumSustainedAccelerationMps2 ?? 0, envelope.maximumPeakAccelerationMps2 ?? 0)
    : undefined;
};

/**
 * Calculates live main and braking authority separately from current mass. The
 * optional compatibility clamp is intentionally applied last, after physical,
 * policy, and occupant limits have determined the available acceleration.
 */
export const deriveUsablePropulsionAccelerations = (input: PropulsionAccelerationDerivationInput): UsablePropulsionAccelerations => {
  assertValidShipPropulsionCapability(input.capability);
  assertValidOccupantAccelerationEnvelope(input.occupantAccelerationEnvelope);
  assertValidPolicy(input.policy);
  finitePositive(input.mass.totalMass, "mass.totalMass");
  if (input.compatibilityMaximumAccelerationMps2 !== undefined) {
    finiteNonNegative(input.compatibilityMaximumAccelerationMps2, "compatibilityMaximumAccelerationMps2");
  }

  const capabilityAccelerationLimitMps2 = Math.min(
    input.capability.structuralMaxAccelerationMps2,
    input.capability.sustainedThermalMaxAccelerationMps2,
    input.capability.maximumPeakAccelerationMps2
  );
  const occupantAccelerationLimitMps2 = input.occupantAccelerationEnvelope.occupantMode === "HumanCrew"
    ? Math.min(
        input.occupantAccelerationEnvelope.maximumSustainedAccelerationMps2 ?? 0,
        input.occupantAccelerationEnvelope.maximumPeakAccelerationMps2 ?? 0
      )
    : undefined;
  const rawMainAccelerationMps2 = input.capability.mainThrustNewton / input.mass.totalMass;
  const rawBrakingAccelerationMps2 = input.capability.effectiveBrakingThrustNewton / input.mass.totalMass;

  return {
    mainAccelerationMps2: accelerationForDirection(
      rawMainAccelerationMps2,
      capabilityAccelerationLimitMps2,
      occupantAccelerationLimitMps2,
      input.policy,
      input.compatibilityMaximumAccelerationMps2
    ),
    brakingAccelerationMps2: accelerationForDirection(
      rawBrakingAccelerationMps2,
      capabilityAccelerationLimitMps2,
      occupantAccelerationLimitMps2,
      input.policy,
      input.compatibilityMaximumAccelerationMps2
    ),
    rawMainAccelerationMps2,
    rawBrakingAccelerationMps2,
    capabilityAccelerationLimitMps2,
    ...(occupantAccelerationLimitMps2 === undefined ? {} : { occupantAccelerationLimitMps2 }),
    policyMaximumAccelerationMps2: input.policy.maximumAccelerationMps2,
    ...(input.compatibilityMaximumAccelerationMps2 === undefined ? {} : { compatibilityMaximumAccelerationMps2: input.compatibilityMaximumAccelerationMps2 })
  };
};

export const deriveEffectiveMotionAuthority = (input: EffectiveMotionAuthorityInput): EffectiveMotionAuthority => {
  const lockedCapability = input.lockedCapability ?? input.liveCapability;
  const lockedOccupantAccelerationEnvelope = input.lockedOccupantAccelerationEnvelope ?? input.liveOccupantAccelerationEnvelope;
  const live = deriveUsablePropulsionAccelerations({
    mass: input.mass,
    capability: input.liveCapability,
    occupantAccelerationEnvelope: input.liveOccupantAccelerationEnvelope,
    policy: input.policy,
    ...(input.compatibilityMaximumAccelerationMps2 === undefined
      ? {}
      : { compatibilityMaximumAccelerationMps2: input.compatibilityMaximumAccelerationMps2 })
  });
  const locked = deriveUsablePropulsionAccelerations({
    mass: input.mass,
    capability: lockedCapability,
    occupantAccelerationEnvelope: lockedOccupantAccelerationEnvelope,
    policy: input.policy,
    ...(input.compatibilityMaximumAccelerationMps2 === undefined
      ? {}
      : { compatibilityMaximumAccelerationMps2: input.compatibilityMaximumAccelerationMps2 })
  });
  const combinedAccelerationLimitMps2 = Math.min(
    capabilityAccelerationCeiling(input.liveCapability),
    capabilityAccelerationCeiling(lockedCapability),
    occupantAccelerationCeiling(input.liveOccupantAccelerationEnvelope) ?? Number.POSITIVE_INFINITY,
    occupantAccelerationCeiling(lockedOccupantAccelerationEnvelope) ?? Number.POSITIVE_INFINITY,
    input.policy.maximumAccelerationMps2,
    input.compatibilityMaximumAccelerationMps2 ?? Number.POSITIVE_INFINITY
  );

  return {
    mainAccelerationMps2: Math.min(live.mainAccelerationMps2, locked.mainAccelerationMps2, combinedAccelerationLimitMps2),
    brakingAccelerationMps2: Math.min(live.brakingAccelerationMps2, locked.brakingAccelerationMps2, combinedAccelerationLimitMps2),
    combinedAccelerationLimitMps2,
    maximumJerkMps3: Math.min(
      input.policy.maximumJerkMps3,
      input.liveOccupantAccelerationEnvelope.maximumJerkMps3,
      lockedOccupantAccelerationEnvelope.maximumJerkMps3
    )
  };
};
