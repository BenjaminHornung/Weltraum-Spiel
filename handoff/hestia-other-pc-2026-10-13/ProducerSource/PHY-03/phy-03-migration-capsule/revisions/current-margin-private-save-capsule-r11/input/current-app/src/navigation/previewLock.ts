import { fnv1aHash, planHashFor, stableStringify } from "../core/hash";
import type {
  AutopilotSpeedProfileId,
  FuelState,
  ObstacleDescriptor,
  RoutePlan,
  ShipMass,
  ShipState,
  TargetDescriptor
} from "../core/types";
import { distance, magnitude, sub } from "../core/vector";
import { createFlightSnapshot } from "../flight/state";
import { validatePlanningContext, validateRouteSegments } from "./validation";

export interface RoutePreviewProvenance {
  readonly sourcePosition: ShipState["position"];
  readonly sourceVelocity: ShipState["velocity"];
  readonly sourceMass: ShipMass;
  readonly sourceFuel: FuelState;
  readonly authorityFingerprint: string;
  readonly targetFingerprint: string;
  readonly environmentFingerprint: string;
  readonly planner: RoutePlan["planner"];
  readonly speedProfile: AutopilotSpeedProfileId;
  readonly sourceTick: number;
}

export type RoutePreviewStaleReason = "Cancelled" | "ExplicitlyInvalidated";

export type PreviewLockRejectionCode =
  | "MissingPreview"
  | "ExpectedPlanHashMismatch"
  | "PlanAlreadyLocked"
  | "PreviewStale"
  | "PlanHashInvalid"
  | "ProvenanceTickMismatch"
  | "ProvenancePositionMismatch"
  | "TargetMismatch"
  | "SpeedProfileMismatch"
  | "PlannerMismatch"
  | "EnvironmentMismatch"
  | "AuthorityMismatch"
  | "VelocityMismatch"
  | "MassMismatch"
  | "FuelMismatch"
  | "InvalidSegment"
  | "SegmentDiscontinuity"
  | "FirstSegmentStartMismatch"
  | "PlanningContextRejected"
  | "RouteValidationRejected"
  | "FlightAdmissionRejected";

export type PreviewLockValidationResult =
  | {
      readonly ok: true;
      readonly code: "Ready";
      readonly message: string;
      readonly planHash: string;
      readonly firstSegmentStartTolerance: number;
    }
  | {
      readonly ok: false;
      readonly code: PreviewLockRejectionCode;
      readonly message: string;
      readonly planHash: string | null;
      readonly firstSegmentStartTolerance: number | null;
    };

export interface PreviewForLock {
  readonly plan: RoutePlan | null;
  readonly provenance: RoutePreviewProvenance | null;
  readonly stale: boolean;
}

export interface ValidatePreviewForLockInput {
  readonly preview: PreviewForLock | null;
  readonly expectedPlanHash?: string | null;
  readonly lockedPlan: RoutePlan | null;
  readonly ship: ShipState;
  readonly target: TargetDescriptor | null;
  readonly obstacles: readonly ObstacleDescriptor[];
  readonly planner: RoutePlan["planner"];
  readonly speedProfile: AutopilotSpeedProfileId;
}

const fingerprintFor = (value: unknown): string => fnv1aHash(stableStringify(value));
const cloneVec3 = (value: ShipState["position"]): ShipState["position"] => ({ x: value.x, y: value.y, z: value.z });
const cloneMass = (mass: ShipMass): ShipMass => ({
  dryMass: mass.dryMass,
  ...(mass.cargoMass === undefined ? {} : { cargoMass: mass.cargoMass }),
  fuelMass: mass.fuelMass,
  totalMass: mass.totalMass
});
const cloneFuel = (fuel: FuelState): FuelState => ({ ...fuel, reasonCodes: [...fuel.reasonCodes] });

const canonicalObstacles = (obstacles: readonly ObstacleDescriptor[]): readonly ObstacleDescriptor[] =>
  [...obstacles]
    .map((obstacle) => ({ ...obstacle, center: cloneVec3(obstacle.center) }))
    .sort((left, right) =>
      left.id.localeCompare(right.id) ||
      left.center.x - right.center.x ||
      left.center.y - right.center.y ||
      left.center.z - right.center.z ||
      left.radius - right.radius ||
      left.padding - right.padding
    );

export const authorityFingerprintFor = (ship: ShipState): string => fingerprintFor(ship.authority);
export const targetFingerprintFor = (target: TargetDescriptor): string => fingerprintFor(target);
export const environmentFingerprintFor = (obstacles: readonly ObstacleDescriptor[]): string => fingerprintFor(canonicalObstacles(obstacles));

export const createRoutePreviewProvenance = (input: {
  readonly ship: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles: readonly ObstacleDescriptor[];
  readonly planner: RoutePlan["planner"];
  readonly speedProfile: AutopilotSpeedProfileId;
  readonly sourceTick: number;
}): RoutePreviewProvenance => ({
  sourcePosition: cloneVec3(input.ship.position),
  sourceVelocity: cloneVec3(input.ship.velocity),
  sourceMass: cloneMass(input.ship.mass),
  sourceFuel: cloneFuel(input.ship.fuel),
  authorityFingerprint: authorityFingerprintFor(input.ship),
  targetFingerprint: targetFingerprintFor(input.target),
  environmentFingerprint: environmentFingerprintFor(input.obstacles),
  planner: input.planner,
  speedProfile: input.speedProfile,
  sourceTick: input.sourceTick
});

const rejection = (
  code: PreviewLockRejectionCode,
  message: string,
  planHash: string | null,
  firstSegmentStartTolerance: number | null = null
): PreviewLockValidationResult => ({ ok: false, code, message, planHash, firstSegmentStartTolerance });

const isFiniteVec3 = (value: ShipState["position"]): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

const hasValidSegments = (plan: RoutePlan): boolean =>
  plan.segments.length > 0 && plan.segments.every((segment) =>
    typeof segment.id === "string" &&
    segment.id.length > 0 &&
    isFiniteVec3(segment.start) &&
    isFiniteVec3(segment.end) &&
    Number.isFinite(segment.desiredSpeed) &&
    segment.desiredSpeed > 0 &&
    Number.isFinite(segment.clearanceRadius) &&
    segment.clearanceRadius >= 0 &&
    (segment.brakeMarginMultiplier === undefined ||
      (Number.isFinite(segment.brakeMarginMultiplier) && segment.brakeMarginMultiplier > 0))
  );

const hasContinuousSegments = (plan: RoutePlan): boolean =>
  plan.segments.every((segment, index) => index === 0 || distance(plan.segments[index - 1].end, segment.start) <= 1e-6);

const hasSameMass = (left: ShipMass, right: ShipMass): boolean =>
  left.dryMass === right.dryMass &&
  left.cargoMass === right.cargoMass &&
  left.fuelMass === right.fuelMass &&
  left.totalMass === right.totalMass;

const hasSameFuel = (left: FuelState, right: FuelState): boolean =>
  left.capacity === right.capacity &&
  left.current === right.current &&
  left.reserve === right.reserve &&
  left.burnRate === right.burnRate &&
  left.status === right.status &&
  left.reasonCodes.length === right.reasonCodes.length &&
  left.reasonCodes.every((code, index) => code === right.reasonCodes[index]);

export const validatePreviewForLock = (input: ValidatePreviewForLockInput): PreviewLockValidationResult => {
  const preview = input.preview;
  if (!preview?.plan || !preview.provenance) {
    return rejection("MissingPreview", "Create a route preview before engaging autopilot.", preview?.plan?.planHash ?? null);
  }
  const plan = preview.plan;
  const provenance = preview.provenance;

  if (input.expectedPlanHash !== undefined && input.expectedPlanHash !== null && input.expectedPlanHash !== plan.planHash) {
    return rejection("ExpectedPlanHashMismatch", "The visible route changed. Review the current preview before engaging.", plan.planHash);
  }
  if (input.lockedPlan) {
    return rejection("PlanAlreadyLocked", "Cancel the current autopilot route before engaging another plan.", plan.planHash);
  }
  if (preview.stale) {
    return rejection("PreviewStale", "The route preview is stale. Preview or replan before engaging.", plan.planHash);
  }
  if (planHashFor(plan) !== plan.planHash) {
    return rejection("PlanHashInvalid", "The route preview failed its integrity check. Replan before engaging.", plan.planHash);
  }
  if (provenance.sourceTick !== plan.createdAtTick) {
    return rejection("ProvenanceTickMismatch", "The route preview source tick does not match the plan metadata. Replan before engaging.", plan.planHash);
  }
  if (!input.target || provenance.targetFingerprint !== targetFingerprintFor(input.target) || targetFingerprintFor(plan.target) !== targetFingerprintFor(input.target)) {
    return rejection("TargetMismatch", "The selected target no longer matches the route preview.", plan.planHash);
  }
  if (provenance.speedProfile !== input.speedProfile || plan.speedProfile !== input.speedProfile) {
    return rejection("SpeedProfileMismatch", "The selected speed profile no longer matches the route preview.", plan.planHash);
  }
  if (provenance.planner !== input.planner || plan.planner !== input.planner) {
    return rejection("PlannerMismatch", "The route planner no longer matches the visible preview.", plan.planHash);
  }
  if (provenance.environmentFingerprint !== environmentFingerprintFor(input.obstacles)) {
    return rejection("EnvironmentMismatch", "The navigation environment changed. Replan before engaging.", plan.planHash);
  }
  if (provenance.authorityFingerprint !== authorityFingerprintFor(input.ship)) {
    return rejection("AuthorityMismatch", "Ship flight authority changed. Replan before engaging.", plan.planHash);
  }
  if (magnitude(sub(input.ship.velocity, provenance.sourceVelocity)) > 1e-6) {
    return rejection("VelocityMismatch", "Ship velocity changed. Replan before engaging.", plan.planHash);
  }
  if (!hasSameMass(input.ship.mass, provenance.sourceMass)) {
    return rejection("MassMismatch", "Ship mass changed. Replan before engaging.", plan.planHash);
  }
  if (!hasSameFuel(input.ship.fuel, provenance.sourceFuel)) {
    return rejection("FuelMismatch", "Ship fuel state changed. Replan before engaging.", plan.planHash);
  }
  if (!hasValidSegments(plan)) {
    return rejection("InvalidSegment", "The route preview contains an invalid segment. Replan before engaging.", plan.planHash);
  }
  const firstUsableSegment = plan.segments.find((segment) => distance(segment.start, segment.end) > 1e-9) ?? plan.segments[0];
  if (distance(provenance.sourcePosition, firstUsableSegment.start) > 1e-6) {
    return rejection("ProvenancePositionMismatch", "The route preview source position does not match its first usable segment. Replan before engaging.", plan.planHash);
  }
  if (!hasContinuousSegments(plan)) {
    return rejection("SegmentDiscontinuity", "The route preview contains a discontinuity. Replan before engaging.", plan.planHash);
  }

  const firstSegment = plan.segments[0];
  const firstSegmentStartTolerance = Math.max(1, firstSegment.clearanceRadius * 0.1);
  if (distance(input.ship.position, firstSegment.start) > firstSegmentStartTolerance) {
    return rejection("FirstSegmentStartMismatch", "The ship moved too far from the route start. Replan before engaging.", plan.planHash, firstSegmentStartTolerance);
  }

  const context = {
    tick: plan.createdAtTick,
    ship: input.ship,
    target: input.target,
    obstacles: input.obstacles,
    speedProfile: input.speedProfile
  };
  const planningValidation = validatePlanningContext(context);
  if (!planningValidation.ok) {
    return rejection("PlanningContextRejected", "Current navigation conditions reject this route. Replan before engaging.", plan.planHash, firstSegmentStartTolerance);
  }
  const routeValidation = validateRouteSegments(context, plan.segments, planningValidation);
  if (!plan.validation.ok || !routeValidation.ok) {
    return rejection("RouteValidationRejected", "The exact preview route no longer passes route validation.", plan.planHash, firstSegmentStartTolerance);
  }

  const flightSnapshot = createFlightSnapshot(input.ship, plan);
  if (!flightSnapshot.routeValid || !flightSnapshot.brakingReserve.canBrake) {
    return rejection("FlightAdmissionRejected", "Current fuel, braking reserve, or flight authority cannot safely engage this route.", plan.planHash, firstSegmentStartTolerance);
  }

  return {
    ok: true,
    code: "Ready",
    message: "Route preview is ready to engage.",
    planHash: plan.planHash,
    firstSegmentStartTolerance
  };
};
