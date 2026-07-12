import type {
  LegacyTransitPolicyId,
  RequestedTransitPolicyId,
  ResolvedTransitPolicy,
  TransitPolicyConstraints,
  TransitPolicyId
} from "../core/types";
import { STANDARD_GRAVITY_MPS2 } from "./propulsionCapability";

export const transitPolicyIds: readonly TransitPolicyId[] = ["CrewComfort", "CrewSprint", "Economy", "DroneSprint", "Custom"];

export const legacyTransitPolicyIds: readonly LegacyTransitPolicyId[] = ["Safe", "Balanced", "Fast"];

export const legacyTransitPolicyAliases: Readonly<Record<LegacyTransitPolicyId, Exclude<TransitPolicyId, "Custom">>> = Object.freeze({
  Safe: "CrewComfort",
  Balanced: "CrewComfort",
  Fast: "CrewSprint"
});

const finiteNonNegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
};

const validateConstraints = (constraints: TransitPolicyConstraints): void => {
  const hasTargetAcceleration = constraints.targetAccelerationMps2 !== undefined;
  const hasTargetFraction = constraints.targetAccelerationFraction !== undefined;
  if (hasTargetAcceleration === hasTargetFraction) {
    throw new RangeError("A transit policy requires exactly one finite target acceleration or target acceleration fraction.");
  }
  if (hasTargetAcceleration) {
    finiteNonNegative(constraints.targetAccelerationMps2 ?? 0, "targetAccelerationMps2");
  }
  if (hasTargetFraction) {
    const fraction = constraints.targetAccelerationFraction ?? 0;
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new RangeError("targetAccelerationFraction must be finite and between zero and one.");
    }
  }
  finiteNonNegative(constraints.maximumAccelerationMps2, "maximumAccelerationMps2");
  finiteNonNegative(constraints.maximumJerkMps3, "maximumJerkMps3");
  if (constraints.maximumPeakSpeedMps !== undefined) {
    finiteNonNegative(constraints.maximumPeakSpeedMps, "maximumPeakSpeedMps");
  }
  if (!Number.isFinite(constraints.coastFraction) || constraints.coastFraction < 0 || constraints.coastFraction > 1) {
    throw new RangeError("coastFraction must be finite and between zero and one.");
  }
  if (!constraints.coastAllowed && constraints.coastFraction !== 0) {
    throw new RangeError("coastFraction must be zero when coast is not allowed.");
  }
  if (!Number.isFinite(constraints.brakingReserveMultiplier) || constraints.brakingReserveMultiplier <= 0) {
    throw new RangeError("brakingReserveMultiplier must be a finite positive number.");
  }
  if (!(["Conservative", "Balanced", "Aggressive"] as const).includes(constraints.turnBehavior)) {
    throw new RangeError("turnBehavior is invalid.");
  }
  if (!(["BrakeForWaypoint", "PreserveMomentum"] as const).includes(constraints.waypointBehavior)) {
    throw new RangeError("waypointBehavior is invalid.");
  }
  if (!(["Preferred", "RequiredWhenPhysicallyAvailable", "Disabled"] as const).includes(constraints.gravityFloorPolicy)) {
    throw new RangeError("gravityFloorPolicy is invalid.");
  }
};

const resolve = (
  requestedPolicyId: RequestedTransitPolicyId,
  resolvedPolicyId: TransitPolicyId,
  constraints: TransitPolicyConstraints
): ResolvedTransitPolicy => {
  validateConstraints(constraints);
  const policy: ResolvedTransitPolicy = {
    version: 1,
    requestedPolicyId,
    resolvedPolicyId,
    ...(constraints.targetAccelerationMps2 === undefined ? {} : { targetAccelerationMps2: constraints.targetAccelerationMps2 }),
    ...(constraints.targetAccelerationFraction === undefined ? {} : { targetAccelerationFraction: constraints.targetAccelerationFraction }),
    maximumAccelerationMps2: constraints.maximumAccelerationMps2,
    maximumJerkMps3: constraints.maximumJerkMps3,
    ...(constraints.maximumPeakSpeedMps === undefined ? {} : { maximumPeakSpeedMps: constraints.maximumPeakSpeedMps }),
    coastAllowed: constraints.coastAllowed,
    coastFraction: constraints.coastFraction,
    minimumTime: constraints.minimumTime,
    brakingReserveMultiplier: constraints.brakingReserveMultiplier,
    turnBehavior: constraints.turnBehavior,
    waypointBehavior: constraints.waypointBehavior,
    gravityFloorPolicy: constraints.gravityFloorPolicy
  };
  return Object.freeze(policy);
};

const crewComfort = (requestedPolicyId: "Safe" | "Balanced" | "CrewComfort"): ResolvedTransitPolicy =>
  resolve(
    requestedPolicyId,
    "CrewComfort",
    requestedPolicyId === "Safe"
      ? {
          targetAccelerationMps2: STANDARD_GRAVITY_MPS2 * 0.8,
          maximumAccelerationMps2: STANDARD_GRAVITY_MPS2 * 1.5,
          maximumJerkMps3: 2.5,
          coastAllowed: false,
          coastFraction: 0,
          minimumTime: false,
          brakingReserveMultiplier: 1.3,
          turnBehavior: "Conservative",
          waypointBehavior: "BrakeForWaypoint",
          gravityFloorPolicy: "RequiredWhenPhysicallyAvailable"
        }
      : {
          targetAccelerationMps2: STANDARD_GRAVITY_MPS2,
          maximumAccelerationMps2: STANDARD_GRAVITY_MPS2 * 1.5,
          maximumJerkMps3: 5,
          coastAllowed: false,
          coastFraction: 0,
          minimumTime: false,
          brakingReserveMultiplier: 1.15,
          turnBehavior: "Balanced",
          waypointBehavior: "BrakeForWaypoint",
          gravityFloorPolicy: "Preferred"
        }
  );

const crewSprint = (requestedPolicyId: "Fast" | "CrewSprint"): ResolvedTransitPolicy =>
  resolve(requestedPolicyId, "CrewSprint", {
    targetAccelerationFraction: 1,
    maximumAccelerationMps2: 1_000,
    maximumJerkMps3: 18,
    coastAllowed: false,
    coastFraction: 0,
    minimumTime: true,
    brakingReserveMultiplier: 1.05,
    turnBehavior: "Aggressive",
    waypointBehavior: "BrakeForWaypoint",
    gravityFloorPolicy: "Preferred"
  });

const economy = (): ResolvedTransitPolicy =>
  resolve("Economy", "Economy", {
    targetAccelerationMps2: STANDARD_GRAVITY_MPS2 * 0.4,
    maximumAccelerationMps2: STANDARD_GRAVITY_MPS2 * 0.55,
    maximumJerkMps3: 2,
    maximumPeakSpeedMps: 36,
    coastAllowed: true,
    coastFraction: 0.55,
    minimumTime: false,
    brakingReserveMultiplier: 1.35,
    turnBehavior: "Conservative",
    waypointBehavior: "BrakeForWaypoint",
    gravityFloorPolicy: "Preferred"
  });

const droneSprint = (): ResolvedTransitPolicy =>
  resolve("DroneSprint", "DroneSprint", {
    targetAccelerationFraction: 1,
    maximumAccelerationMps2: 1_000,
    maximumJerkMps3: 60,
    coastAllowed: false,
    coastFraction: 0,
    minimumTime: true,
    brakingReserveMultiplier: 0.95,
    turnBehavior: "Aggressive",
    waypointBehavior: "PreserveMomentum",
    gravityFloorPolicy: "Disabled"
  });

/**
 * Resolves legacy aliases and canonical policy IDs to a finite snapshot. Custom
 * policies must supply every required finite constraint explicitly.
 */
export const resolveTransitPolicy = (
  requestedPolicyId: RequestedTransitPolicyId,
  customConstraints?: TransitPolicyConstraints
): ResolvedTransitPolicy => {
  switch (requestedPolicyId) {
    case "Safe":
    case "Balanced":
    case "CrewComfort":
      return crewComfort(requestedPolicyId);
    case "Fast":
    case "CrewSprint":
      return crewSprint(requestedPolicyId);
    case "Economy":
      return economy();
    case "DroneSprint":
      return droneSprint();
    case "Custom":
      if (!customConstraints) {
        throw new RangeError("Custom transit policies require explicit finite constraints.");
      }
      return resolve("Custom", "Custom", customConstraints);
  }
};
