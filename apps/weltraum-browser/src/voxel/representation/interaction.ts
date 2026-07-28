import {
  adaptiveLevel,
  adaptivePlanningEpoch,
  brickExtentQuantumForLevel,
  deepFreeze,
  globalQuantumCoordinate,
  stableAuthorityId,
  validateQuantumBounds,
  type AdaptiveRefinementRegion,
  type AdaptiveRefinementRequest,
  type AdaptivePlanningEpoch,
  type QuantumPoint
} from "../adaptive";
import {
  HARD_ADAPTIVE_REFINEMENT_REASONS,
  REPRESENTATION_MAX_ACTIVE_PINS,
  REPRESENTATION_MAX_WORK_UNITS,
  type EvictionEligibility,
  type HardAdaptiveRefinementReason,
  type ProxyInteractionResult,
  type RepresentationLifecyclePinReason,
  type StructuralLifecycleState
} from "./types";
import {
  representationDenseArray,
  representationFail,
  representationFinite
} from "./validation";

const hardReasons = new Set<HardAdaptiveRefinementReason>(HARD_ADAPTIVE_REFINEMENT_REASONS);
export const HARD_AUTHORITY_TARGET_LEVEL = adaptiveLevel(4);
const hardAuthorityExtentQuantum = brickExtentQuantumForLevel(HARD_AUTHORITY_TARGET_LEVEL);

const copyRegion = (region: AdaptiveRefinementRegion): AdaptiveRefinementRegion => {
  if (region.kind === "aabb") {
    const bounds = validateQuantumBounds(region.bounds);
    for (const axis of ["x", "y", "z"] as const) {
      if (bounds.min[axis] % hardAuthorityExtentQuantum !== 0 || bounds.max[axis] % hardAuthorityExtentQuantum !== 0) {
        return representationFail("InvalidContract", `region/bounds/${axis}`, "Hard L4 AABB coverage must align to target bricks.");
      }
    }
    return deepFreeze({ kind: "aabb", bounds });
  }
  if ((region as { readonly kind?: unknown }).kind !== "sphere") {
    return representationFail("InvalidContract", "region/kind", "Unsupported hard Authority region kind.");
  }
  const center = deepFreeze({
    x: globalQuantumCoordinate(region.center.x, "region/center/x"),
    y: globalQuantumCoordinate(region.center.y, "region/center/y"),
    z: globalQuantumCoordinate(region.center.z, "region/center/z")
  });
  const radiusQuantum = globalQuantumCoordinate(region.radiusQuantum, "region/radiusQuantum");
  if (radiusQuantum <= 0) return representationFail("InvalidContract", "region/radiusQuantum", "Sphere radius must be positive.");
  return deepFreeze({ kind: "sphere", center, radiusQuantum });
};

export const createHardAuthorityRequirement = (value: Readonly<{
  requestId: string;
  reason: HardAdaptiveRefinementReason;
  region: AdaptiveRefinementRegion;
  deadlinePlanningEpoch?: AdaptivePlanningEpoch;
  priority: number;
}>): AdaptiveRefinementRequest => {
  if (!hardReasons.has(value.reason)) return representationFail("InvalidContract", "requirement/reason", "Reason is not a hard L4 interaction reason.");
  const deadlinePlanningEpoch = value.deadlinePlanningEpoch === undefined
    ? undefined
    : adaptivePlanningEpoch(value.deadlinePlanningEpoch);
  return deepFreeze({
    requestId: stableAuthorityId(value.requestId, "requirement/requestId"),
    reason: value.reason,
    region: copyRegion(value.region),
    targetLevel: HARD_AUTHORITY_TARGET_LEVEL,
    requiredForCoverage: true,
    ...(deadlinePlanningEpoch === undefined ? {} : { deadlinePlanningEpoch }),
    priority: representationFinite(value.priority, "requirement/priority")
  });
};

const copyQuantumPoint = (value: QuantumPoint): QuantumPoint => deepFreeze({
  x: globalQuantumCoordinate(value.x, "interaction/authorityCoordinates/x"),
  y: globalQuantumCoordinate(value.y, "interaction/authorityCoordinates/y"),
  z: globalQuantumCoordinate(value.z, "interaction/authorityCoordinates/z")
});

export const resolveProxyInteraction = (value: Readonly<{
  requestId: string;
  reason: HardAdaptiveRefinementReason;
  authorityCoordinates: QuantumPoint | null;
  hasLevel4Coverage: boolean;
  requiredAuthorityWork: number;
  authorityWorkBudget: number;
  priority: number;
}>): ProxyInteractionResult => {
  if (!Number.isSafeInteger(value.requiredAuthorityWork) || value.requiredAuthorityWork < 0 || !Number.isSafeInteger(value.authorityWorkBudget) || value.authorityWorkBudget < 0) {
    return representationFail("InvalidContract", "interaction/budget", "Authority work and budget must be non-negative safe integers.");
  }
  if (value.requiredAuthorityWork > REPRESENTATION_MAX_WORK_UNITS || value.authorityWorkBudget > REPRESENTATION_MAX_WORK_UNITS) {
    return representationFail("InvalidContract", "interaction/budget", `Authority work and budget cannot exceed ${REPRESENTATION_MAX_WORK_UNITS}.`);
  }
  const requestId = stableAuthorityId(value.requestId, "interaction/requestId");
  const reason = value.reason;
  if (!hardReasons.has(reason)) return representationFail("InvalidContract", "interaction/reason", "Reason is not a hard L4 interaction reason.");
  const priority = representationFinite(value.priority, "interaction/priority");
  const hasLevel4Coverage = value.hasLevel4Coverage;
  if (typeof hasLevel4Coverage !== "boolean") {
    return representationFail("InvalidContract", "interaction/hasLevel4Coverage", "Level 4 coverage state must be boolean.");
  }
  if (value.authorityCoordinates === null) {
    return deepFreeze({ status: "NOT_READY", authorityCoordinates: null, authorityRequest: null, code: "AuthorityCoordinatesMissing" });
  }
  const coordinates = copyQuantumPoint(value.authorityCoordinates);
  const request = createHardAuthorityRequirement({
    requestId,
    reason,
    region: { kind: "sphere", center: coordinates, radiusQuantum: globalQuantumCoordinate(1) },
    priority
  });
  if (value.requiredAuthorityWork > value.authorityWorkBudget) {
    return deepFreeze({ status: "Blocked", authorityCoordinates: null, authorityRequest: request, code: "AuthorityBudgetExceeded" });
  }
  if (!hasLevel4Coverage) {
    return deepFreeze({ status: "NOT_READY", authorityCoordinates: null, authorityRequest: request, code: "Level4CoverageMissing" });
  }
  return deepFreeze({ status: "READY", authorityCoordinates: coordinates, authorityRequest: request });
};

const lifecyclePins = new Set<RepresentationLifecyclePinReason>([
  "ActiveRigidBody", "UnsettledFragment", "StructuralSolvePending", "PhysicsHandoffPending"
]);

export const deriveEvictionEligibility = (value: Readonly<{
  structuralState: StructuralLifecycleState;
  activePins: readonly RepresentationLifecyclePinReason[];
}>): EvictionEligibility => {
  const pins = representationDenseArray(value.activePins, "lifecycle/activePins", REPRESENTATION_MAX_ACTIVE_PINS).map((pin, index) => {
    if (typeof pin !== "string" || !lifecyclePins.has(pin as RepresentationLifecyclePinReason)) {
      return representationFail("InvalidContract", `lifecycle/activePins/${index}`, "Unsupported representation lifecycle pin.");
    }
    return pin as RepresentationLifecyclePinReason;
  });
  if (value.structuralState !== "Dirty" && value.structuralState !== "Solving" && value.structuralState !== "Settled") {
    return representationFail("InvalidContract", "lifecycle/structuralState", "Unsupported Structural lifecycle state.");
  }
  const reasons = [
    ...(value.structuralState === "Settled" ? [] : [`Structural${value.structuralState}`]),
    ...[...new Set(pins)].sort()
  ];
  return deepFreeze({
    derivedProductsEvictable: value.structuralState === "Settled" && reasons.length === 0,
    retainedSourceBindings: ["AdaptiveAuthority", "EditJournal", "StructuralAuthority"] as const,
    reasons: deepFreeze(reasons)
  });
};
