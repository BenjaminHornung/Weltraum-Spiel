import { compareCanonicalCodeUnits, deepFreeze, hashAdaptiveCanonical } from "../adaptive";
import { validateRepresentationLadderDescriptor } from "./descriptor";
import { createHardAuthorityRequirement } from "./interaction";
import { validateVoxelQualityPolicy } from "./policy";
import {
  REPRESENTATION_DECISION_SCHEMA_VERSION,
  REPRESENTATION_MAX_ACTIVE_PINS,
  REPRESENTATION_MAX_SELECTION_CANDIDATES,
  type EvictionEligibility,
  type RepresentationBand,
  type RepresentationCandidate,
  type RepresentationSelectionInput,
  type RepresentationSelectionRejected,
  type RepresentationSelectionResult,
  type ScreenSpaceErrorInput,
  type ScreenSpaceErrorResult
} from "./types";
import { resolveAtomicFallback } from "./fallback";
import {
  representationArrayLengthPreflight,
  representationDenseArray,
  representationExactKeys,
  representationFail,
  representationFinite,
  representationId,
  representationPositiveFinite,
  representationRecord,
  representationString
} from "./validation";

const point = (value: unknown, path: string) => {
  const record = representationRecord(value, path);
  representationExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: representationFinite(record.x, `${path}/x`),
    y: representationFinite(record.y, `${path}/y`),
    z: representationFinite(record.z, `${path}/z`)
  });
};

export const computeScreenSpaceError = (value: ScreenSpaceErrorInput): ScreenSpaceErrorResult => {
  const camera = point(value.cameraPosition, "projection/cameraPosition");
  const center = point(value.boundsCenter, "projection/boundsCenter");
  const radius = representationPositiveFinite(value.boundsRadiusMeters, "projection/boundsRadiusMeters");
  const error = representationPositiveFinite(value.geometricErrorMeters, "projection/geometricErrorMeters");
  const viewportHeight = representationPositiveFinite(value.viewportHeightPixels, "projection/viewportHeightPixels");
  const fov = representationPositiveFinite(value.verticalFovRadians, "projection/verticalFovRadians");
  if (fov >= Math.PI) return representationFail("InvalidProjection", "projection/verticalFovRadians", "Vertical FOV must be less than pi radians.");
  const minimumDistance = representationPositiveFinite(value.minimumDistanceMeters, "projection/minimumDistanceMeters");
  const centerDistanceMeters = Math.hypot(camera.x - center.x, camera.y - center.y, camera.z - center.z);
  if (!Number.isFinite(centerDistanceMeters)) return representationFail("InvalidProjection", "projection", "Distance arithmetic must remain finite.");
  const focalLengthPixels = viewportHeight / (2 * Math.tan(fov / 2));
  const distanceToBoundsMeters = Math.max(minimumDistance, centerDistanceMeters - radius);
  const projectedErrorPixels = error * focalLengthPixels / distanceToBoundsMeters;
  const projectedBoundsRadiusPixels = radius * focalLengthPixels / distanceToBoundsMeters;
  if (![focalLengthPixels, distanceToBoundsMeters, projectedErrorPixels, projectedBoundsRadiusPixels].every(Number.isFinite)) {
    return representationFail("InvalidProjection", "projection", "Projection arithmetic must remain finite.");
  }
  return deepFreeze({
    focalLengthPixels,
    centerDistanceMeters,
    distanceToBoundsMeters,
    projectedErrorPixels,
    projectedBoundsRadiusPixels
  });
};

const validateCandidates = (
  entries: readonly unknown[],
  bandIds: ReadonlySet<string>
): readonly RepresentationCandidate[] => {
  const candidates = entries.map((entry, index) => {
    const path = `selection/candidates/${index}`;
    const record = representationRecord(entry, path);
    representationExactKeys(record, ["bandId", "readiness", "sourceCurrent"], path);
    const bandId = representationId(record.bandId, `${path}/bandId`);
    if (!bandIds.has(bandId)) return representationFail("InvalidSelection", `${path}/bandId`, "Candidate references an unknown band.");
    if (!["Ready", "Loading", "Stale", "Invalid", "Incomplete", "Cancelled"].includes(record.readiness as string)) {
      return representationFail("InvalidSelection", `${path}/readiness`, "Unsupported candidate readiness.");
    }
    if (typeof record.sourceCurrent !== "boolean") return representationFail("InvalidSelection", `${path}/sourceCurrent`, "Source-current flag must be boolean.");
    return deepFreeze({ bandId, readiness: record.readiness as RepresentationCandidate["readiness"], sourceCurrent: record.sourceCurrent });
  }).sort((left, right) => compareCanonicalCodeUnits(left.bandId, right.bandId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].bandId === candidates[index].bandId) {
      return representationFail("InvalidSelection", "selection/candidates", "Candidate band IDs must be unique.");
    }
  }
  return deepFreeze(candidates);
};

const copyEvictionEligibility = (value: EvictionEligibility): EvictionEligibility => {
  const record = representationRecord(value, "selection/evictionEligibility");
  representationExactKeys(record, ["derivedProductsEvictable", "retainedSourceBindings", "reasons"], "selection/evictionEligibility");
  if (typeof record.derivedProductsEvictable !== "boolean") return representationFail("InvalidSelection", "selection/evictionEligibility/derivedProductsEvictable", "Eviction flag must be boolean.");
  const bindings = representationDenseArray(record.retainedSourceBindings, "selection/evictionEligibility/retainedSourceBindings", 3);
  if (bindings.length !== 3 || bindings[0] !== "AdaptiveAuthority" || bindings[1] !== "EditJournal" || bindings[2] !== "StructuralAuthority") {
    return representationFail("InvalidSelection", "selection/evictionEligibility/retainedSourceBindings", "Authority, journal, and Structural sources must remain retained.");
  }
  const reasons = representationDenseArray(record.reasons, "selection/evictionEligibility/reasons", REPRESENTATION_MAX_ACTIVE_PINS)
    .map((entry, index) => representationString(entry, `selection/evictionEligibility/reasons/${index}`));
  if (record.derivedProductsEvictable && reasons.length !== 0) {
    return representationFail("InvalidSelection", "selection/evictionEligibility", "Evictable derived products cannot retain lifecycle blockers.");
  }
  return deepFreeze({
    derivedProductsEvictable: record.derivedProductsEvictable,
    retainedSourceBindings: ["AdaptiveAuthority", "EditJournal", "StructuralAuthority"] as const,
    reasons: deepFreeze(reasons)
  });
};

const reject = (
  code: RepresentationSelectionRejected["code"],
  reason: string,
  decisionInputs: unknown
): RepresentationSelectionRejected => {
  const payload = deepFreeze({
    schemaVersion: REPRESENTATION_DECISION_SCHEMA_VERSION,
    status: "Rejected" as const,
    code,
    renderSelection: null,
    simulationRequirements: [] as const,
    requiredAuthorityRequests: [] as const,
    fallbackDecision: null,
    readiness: [] as const,
    evictionEligibility: null,
    decisionReasons: deepFreeze([reason])
  });
  return deepFreeze({ ...payload, decisionHash: hashAdaptiveCanonical({ decisionInputs, outcome: payload }) });
};

const bandProjection = (input: RepresentationSelectionInput, band: RepresentationBand): ScreenSpaceErrorResult =>
  computeScreenSpaceError({ ...input.projection, geometricErrorMeters: band.geometricErrorMeters });

export const selectRepresentation = (input: RepresentationSelectionInput): RepresentationSelectionResult => {
  // All count caps precede descriptor re-hashing, array entry validation, copying, and sorting.
  representationArrayLengthPreflight(input.candidates, "selection/candidates", REPRESENTATION_MAX_SELECTION_CANDIDATES);
  representationArrayLengthPreflight(input.simulationRequirements, "selection/simulationRequirements", REPRESENTATION_MAX_ACTIVE_PINS);
  representationArrayLengthPreflight(input.requiredAuthorityRequests, "selection/requiredAuthorityRequests", REPRESENTATION_MAX_ACTIVE_PINS);
  representationArrayLengthPreflight(input.readiness, "selection/readiness", REPRESENTATION_MAX_SELECTION_CANDIDATES);
  const fallbackDecision = input.fallbackGroup === null ? null : resolveAtomicFallback(input.fallbackGroup);
  const rawCandidates = representationDenseArray(input.candidates, "selection/candidates", REPRESENTATION_MAX_SELECTION_CANDIDATES);
  const rawSimulationRequirements = representationDenseArray(input.simulationRequirements, "selection/simulationRequirements", REPRESENTATION_MAX_ACTIVE_PINS);
  const rawAuthorityRequests = representationDenseArray(input.requiredAuthorityRequests, "selection/requiredAuthorityRequests", REPRESENTATION_MAX_ACTIVE_PINS);
  const rawReadiness = representationDenseArray(input.readiness, "selection/readiness", REPRESENTATION_MAX_SELECTION_CANDIDATES);

  const descriptor = validateRepresentationLadderDescriptor({
    schemaVersion: input.descriptor.schemaVersion,
    descriptorId: input.descriptor.descriptorId,
    bands: input.descriptor.bands
  });
  if (descriptor.descriptorHash !== input.descriptor.descriptorHash) {
    return representationFail("InvalidSelection", "selection/descriptorHash", "Descriptor hash does not match its canonical content.");
  }
  const candidates = validateCandidates(rawCandidates, new Set(descriptor.bands.map((band) => band.bandId)));
  const descriptorBandIds = new Set(descriptor.bands.map((band) => band.bandId));
  const priorBandId = input.priorBandId === null
    ? null
    : representationId(input.priorBandId, "selection/priorBandId");
  if (priorBandId !== null && !descriptorBandIds.has(priorBandId)) {
    return representationFail("InvalidSelection", "selection/priorBandId", "Prior selection references an unknown band.");
  }
  const policy = validateVoxelQualityPolicy(input.qualityPolicy);
  const refine = representationPositiveFinite(input.thresholds.refineErrorPixels, "selection/thresholds/refineErrorPixels");
  const collapse = representationPositiveFinite(input.thresholds.collapseErrorPixels, "selection/thresholds/collapseErrorPixels");
  if (collapse >= refine) return representationFail("InvalidSelection", "selection/thresholds", "Collapse threshold must be lower than refine threshold.");
  const cullDistance = representationPositiveFinite(input.thresholds.cullDistanceMeters, "selection/thresholds/cullDistanceMeters");
  const cullRadius = representationPositiveFinite(input.thresholds.cullProjectedBoundsRadiusPixels, "selection/thresholds/cullProjectedBoundsRadiusPixels");
  const simulationRequirements = deepFreeze(rawSimulationRequirements
    .map((entry, index) => representationString(entry, `selection/simulationRequirements/${index}`)).sort(compareCanonicalCodeUnits));
  const authorityRequests = rawAuthorityRequests
    .map((entry) => {
      const request = entry as RepresentationSelectionInput["requiredAuthorityRequests"][number];
      return createHardAuthorityRequirement({
        requestId: request.requestId,
        reason: request.reason as never,
        region: request.region,
        deadlinePlanningEpoch: request.deadlinePlanningEpoch,
        priority: request.priority
      });
    }).sort((left, right) => compareCanonicalCodeUnits(left.requestId, right.requestId));
  for (let index = 1; index < authorityRequests.length; index += 1) {
    if (authorityRequests[index - 1].requestId === authorityRequests[index].requestId) {
      return representationFail("InvalidSelection", "selection/requiredAuthorityRequests", "Authority request IDs must be unique.");
    }
  }
  const requiredAuthorityRequests = deepFreeze(authorityRequests);
  const readiness = deepFreeze(rawReadiness
    .map((entry, index) => representationString(entry, `selection/readiness/${index}`)).sort(compareCanonicalCodeUnits));
  const evictionEligibility = copyEvictionEligibility(input.evictionEligibility);
  const cullingProjection = bandProjection(input, descriptor.bands[0]);
  const thresholds = deepFreeze({
    refineErrorPixels: refine,
    collapseErrorPixels: collapse,
    cullDistanceMeters: cullDistance,
    cullProjectedBoundsRadiusPixels: cullRadius
  });
  const decisionInputs = deepFreeze({
    descriptorHash: descriptor.descriptorHash,
    candidates,
    projection: cullingProjection,
    qualityPolicy: policy,
    thresholds,
    priorBandId
  });

  let renderSelection: Readonly<{ kind: "Band"; bandId: string }> | Readonly<{ kind: "Culled" }>;
  let decisionReasons: readonly string[];
  if (cullingProjection.distanceToBoundsMeters >= cullDistance && cullingProjection.projectedBoundsRadiusPixels <= cullRadius) {
    renderSelection = deepFreeze({ kind: "Culled" as const });
    decisionReasons = deepFreeze(["CullingThresholdsMet"]);
  } else {
    const readyIds = new Set(candidates.filter((candidate) => candidate.readiness === "Ready" && candidate.sourceCurrent).map((candidate) => candidate.bandId));
    const visualAdaptiveLevelLimit = cullingProjection.distanceToBoundsMeters <= policy.detailDistanceMeters
      ? policy.maximumVisualAdaptiveLevel
      : 2;
    const visuallyEligible = descriptor.bands.filter((band) =>
      readyIds.has(band.bandId)
      && band.allowedDomains.includes("Render")
      && (band.visualAdaptiveLevel === null || band.visualAdaptiveLevel <= visualAdaptiveLevelLimit)
    );
    const budgeted = visuallyEligible.filter((band) =>
      band.costs.estimatedBytes <= policy.maximumEstimatedBytes
      && band.costs.workUnits <= policy.maximumWorkUnits
      && band.costs.uploadUnits <= policy.maximumUploadUnits
    );
    if (budgeted.length === 0) {
      const hasReady = visuallyEligible.length > 0;
      return reject(hasReady ? "BudgetExceeded" : "NoReadyCandidate", hasReady ? "RenderBudgetExceeded" : "NoCurrentReadyRenderCandidate", decisionInputs);
    }
    const withinError = budgeted.filter((band) => bandProjection(input, band).projectedErrorPixels <= refine);
    let selected = withinError.length === 0
      ? budgeted.reduce((best, candidate) => candidate.rank < best.rank ? candidate : best)
      : withinError.reduce((best, candidate) =>
          candidate.rank > best.rank || (candidate.rank === best.rank && compareCanonicalCodeUnits(candidate.bandId, best.bandId) < 0) ? candidate : best
        );
    decisionReasons = deepFreeze([withinError.length === 0 ? "FinestReadyFallback" : "CoarsestWithinError"]);

    if (priorBandId !== null) {
      const prior = budgeted.find((band) => band.bandId === priorBandId);
      if (prior !== undefined && selected.rank < prior.rank && bandProjection(input, prior).projectedErrorPixels <= refine) {
        selected = prior;
        decisionReasons = deepFreeze(["HysteresisHoldBeforeRefine"]);
      } else if (prior !== undefined && selected.rank > prior.rank && bandProjection(input, selected).projectedErrorPixels >= collapse) {
        selected = prior;
        decisionReasons = deepFreeze(["HysteresisHoldBeforeCollapse"]);
      } else if (prior !== undefined && selected.rank < prior.rank) {
        decisionReasons = deepFreeze(["RefinedAcrossBoundary"]);
      } else if (prior !== undefined && selected.rank > prior.rank) {
        decisionReasons = deepFreeze(["CollapsedAcrossBoundary"]);
      }
    }
    renderSelection = deepFreeze({ kind: "Band" as const, bandId: selected.bandId });
  }

  const payload = deepFreeze({
    schemaVersion: REPRESENTATION_DECISION_SCHEMA_VERSION,
    status: "Accepted" as const,
    renderSelection,
    simulationRequirements,
    requiredAuthorityRequests,
    fallbackDecision,
    readiness,
    evictionEligibility,
    decisionReasons
  });
  return deepFreeze({ ...payload, decisionHash: hashAdaptiveCanonical({ decisionInputs, outcome: payload }) });
};
