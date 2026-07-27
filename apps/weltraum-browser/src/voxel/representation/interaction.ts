import {
  adaptiveLevel,
  deepFreeze,
  globalQuantumCoordinate,
  stableAuthorityId,
  validateQuantumBounds,
  type AdaptiveRefinementRegion,
  type AdaptiveRefinementRequest,
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

const copyRegion = (region: AdaptiveRefinementRegion): AdaptiveRefinementRegion => {
  if (region.kind === "aabb") return deepFreeze({ kind: "aabb", bounds: validateQuantumBounds(region.bounds) });
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
  priority: number;
}>): AdaptiveRefinementRequest => {
  if (!hardReasons.has(value.reason)) return representationFail("InvalidContract", "requirement/reason", "Reason is not a hard L4 interaction reason.");
  return deepFreeze({
    requestId: stableAuthorityId(value.requestId, "requirement/requestId"),
    reason: value.reason,
    region: copyRegion(value.region),
    targetLevel: adaptiveLevel(4),
    requiredForCoverage: true,
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
  if (value.authorityCoordinates === null) {
    return deepFreeze({ status: "NOT_READY", authorityCoordinates: null, authorityRequest: null, code: "AuthorityCoordinatesMissing" });
  }
  if (!Number.isSafeInteger(value.requiredAuthorityWork) || value.requiredAuthorityWork < 0 || !Number.isSafeInteger(value.authorityWorkBudget) || value.authorityWorkBudget < 0) {
    return representationFail("InvalidContract", "interaction/budget", "Authority work and budget must be non-negative safe integers.");
  }
  if (value.requiredAuthorityWork > REPRESENTATION_MAX_WORK_UNITS || value.authorityWorkBudget > REPRESENTATION_MAX_WORK_UNITS) {
    return representationFail("InvalidContract", "interaction/budget", `Authority work and budget cannot exceed ${REPRESENTATION_MAX_WORK_UNITS}.`);
  }
  const coordinates = copyQuantumPoint(value.authorityCoordinates);
  const request = createHardAuthorityRequirement({
    requestId: value.requestId,
    reason: value.reason,
    region: { kind: "sphere", center: coordinates, radiusQuantum: globalQuantumCoordinate(1) },
    priority: value.priority
  });
  if (value.requiredAuthorityWork > value.authorityWorkBudget) {
    return deepFreeze({ status: "Blocked", authorityCoordinates: null, authorityRequest: request, code: "AuthorityBudgetExceeded" });
  }
  if (value.hasLevel4Coverage !== true) {
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
