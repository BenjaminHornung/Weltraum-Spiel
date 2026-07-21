import type { Vec3 } from "../core/vector";
import { TrajectoryPropagationError } from "./integrators";
import type { TrajectoryIntegratedStep } from "./propagation";
import type {
  SphericalTrajectoryHazard,
  TrajectoryClosestApproach,
  TrajectoryHazardEvent,
  TrajectoryHazardEventLocation
} from "./types";

export interface TrajectorySweptHazardAnalysis {
  readonly hazard: SphericalTrajectoryHazard;
  readonly event: TrajectoryHazardEvent | null;
  readonly closestApproach: TrajectoryClosestApproach | null;
}

interface ChordContact {
  readonly entryFraction: number;
  readonly exitFraction: number | null;
  readonly startedInside: boolean;
  readonly tangent: boolean;
  readonly zeroLength: boolean;
}

const fail = (path: string, message: string): never => {
  throw new TrajectoryPropagationError("NonFiniteValue", path, message);
};

const finite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) {
    return fail(path, "Swept hazard geometry produced a nonfinite value.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const clampFraction = (value: number): number => Math.min(1, Math.max(0, finite(value, "/hazards/fraction")));

const subtract = (left: Vec3, right: Vec3, path: string): Vec3 => Object.freeze({
  x: finite(left.x - right.x, `${path}/x`),
  y: finite(left.y - right.y, `${path}/y`),
  z: finite(left.z - right.z, `${path}/z`)
});

const dot = (left: Vec3, right: Vec3, path: string): number =>
  finite(left.x * right.x + left.y * right.y + left.z * right.z, path);

const magnitude = (value: Vec3, path: string): number =>
  finite(Math.hypot(value.x, value.y, value.z), path);

const interpolate = (start: Vec3, end: Vec3, fraction: number, path: string): Vec3 => {
  const t = clampFraction(fraction);
  return Object.freeze({
    x: finite(start.x + (end.x - start.x) * t, `${path}/x`),
    y: finite(start.y + (end.y - start.y) * t, `${path}/y`),
    z: finite(start.z + (end.z - start.z) * t, `${path}/z`)
  });
};

const location = (
  step: TrajectoryIntegratedStep,
  fraction: number,
  path: string
): TrajectoryHazardEventLocation => {
  const ownedFraction = clampFraction(fraction);
  return Object.freeze({
    stepStartTick: step.startTick,
    stepEndTick: step.endTick,
    fraction: ownedFraction,
    positionMeters: interpolate(
      step.startState.positionMeters,
      step.endState.positionMeters,
      ownedFraction,
      `${path}/positionMeters`
    )
  });
};

const distanceAt = (
  step: TrajectoryIntegratedStep,
  center: Vec3,
  fraction: number,
  path: string
): number => magnitude(
  subtract(
    interpolate(step.startState.positionMeters, step.endState.positionMeters, fraction, `${path}/position`),
    center,
    `${path}/relative`
  ),
  `${path}/distance`
);

const closestFractionOnChord = (
  step: TrajectoryIntegratedStep,
  center: Vec3,
  path: string
): number => {
  const chord = subtract(step.endState.positionMeters, step.startState.positionMeters, `${path}/chord`);
  const chordLength = magnitude(chord, `${path}/chordLength`);
  if (chordLength === 0) {
    return 0;
  }
  const fromCenter = subtract(step.startState.positionMeters, center, `${path}/fromCenter`);
  const unitChord = Object.freeze({
    x: finite(chord.x / chordLength, `${path}/unitChord/x`),
    y: finite(chord.y / chordLength, `${path}/unitChord/y`),
    z: finite(chord.z / chordLength, `${path}/unitChord/z`)
  });
  return clampFraction(-dot(fromCenter, unitChord, `${path}/projectionMeters`) / chordLength);
};

const chordContact = (
  step: TrajectoryIntegratedStep,
  hazard: SphericalTrajectoryHazard,
  epsilonMeters: number,
  closestFraction: number,
  closestDistance: number,
  path: string
): ChordContact | null => {
  const radius = finite(hazard.radiusMeters + hazard.safetyMarginMeters, `${path}/effectiveRadiusMeters`);
  const relativeStart = subtract(step.startState.positionMeters, hazard.centerMeters, `${path}/relativeStart`);
  const startDistance = magnitude(relativeStart, `${path}/startDistance`);
  const startsInside = startDistance < radius;
  const penetratesInterior = closestDistance < radius;

  const chord = subtract(step.endState.positionMeters, step.startState.positionMeters, `${path}/chord`);
  const chordLengthSquared = dot(chord, chord, `${path}/chordLengthSquared`);
  if (chordLengthSquared === 0) {
    if (startsInside) {
      return Object.freeze({
        entryFraction: 0,
        exitFraction: null,
        startedInside: true,
        tangent: false,
        zeroLength: true
      });
    }
    if (startDistance <= radius + epsilonMeters) {
      return Object.freeze({
        entryFraction: 0,
        exitFraction: 0,
        startedInside: false,
        tangent: true,
        zeroLength: true
      });
    }
    return null;
  }

  if (!penetratesInterior) {
    if (closestDistance <= radius + epsilonMeters) {
      return Object.freeze({
        entryFraction: closestFraction,
        exitFraction: closestFraction,
        startedInside: false,
        tangent: true,
        zeroLength: false
      });
    }
    return null;
  }

  const projection = finite(
    -dot(relativeStart, chord, `${path}/projectionNumerator`) / chordLengthSquared,
    `${path}/projection`
  );
  const relativeAtProjection = Object.freeze({
    x: finite(relativeStart.x + chord.x * projection, `${path}/relativeAtProjection/x`),
    y: finite(relativeStart.y + chord.y * projection, `${path}/relativeAtProjection/y`),
    z: finite(relativeStart.z + chord.z * projection, `${path}/relativeAtProjection/z`)
  });
  const lineClosestDistanceSquared = dot(
    relativeAtProjection,
    relativeAtProjection,
    `${path}/lineClosestDistanceSquared`
  );
  const radiusSquared = finite(radius * radius, `${path}/radiusSquared`);
  const rootDiscriminant = finite(radiusSquared - lineClosestDistanceSquared, `${path}/rootDiscriminant`);
  const rootOffset = finite(
    Math.sqrt(Math.max(0, rootDiscriminant) / chordLengthSquared),
    `${path}/rootOffset`
  );
  const entryRoot = finite(projection - rootOffset, `${path}/entryRoot`);
  const exitRoot = finite(projection + rootOffset, `${path}/exitRoot`);
  const acceptedRoot = (root: number): number | null =>
    root >= 0 && root <= 1 ? clampFraction(root) : null;
  const acceptedEntryRoot = acceptedRoot(entryRoot);
  const entryFraction = acceptedEntryRoot ?? 0;
  const exitFraction = acceptedRoot(exitRoot);
  return Object.freeze({
    entryFraction,
    exitFraction,
    startedInside: startsInside,
    tangent: false,
    zeroLength: false
  });
};

const analyzeHazard = (
  steps: readonly TrajectoryIntegratedStep[],
  hazard: SphericalTrajectoryHazard,
  epsilonMeters: number
): TrajectorySweptHazardAnalysis => {
  let closestLocation: TrajectoryHazardEventLocation | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  let entryLocation: TrajectoryHazardEventLocation | null = null;
  let exitLocation: TrajectoryHazardEventLocation | null = null;
  let startedInside = false;
  let tangent = false;
  let exitStepIndex = -1;
  let eventOpenAtStepEnd = false;
  let eventComplete = false;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === undefined) {
      return fail(`/hazards/${hazard.hazardId}/steps/${index}`, "Swept hazard step is missing.");
    }
    const path = `/hazards/${hazard.hazardId}/steps/${index}`;
    const closestFraction = closestFractionOnChord(step, hazard.centerMeters, path);
    const stepClosestDistance = distanceAt(step, hazard.centerMeters, closestFraction, `${path}/minimum`);
    if (stepClosestDistance < closestDistance) {
      closestDistance = stepClosestDistance;
      closestLocation = location(step, closestFraction, `${path}/minimumLocation`);
    }

    if (eventComplete) {
      continue;
    }
    const contact = chordContact(
      step,
      hazard,
      epsilonMeters,
      closestFraction,
      stepClosestDistance,
      path
    );
    if (contact === null) {
      if (entryLocation !== null) {
        eventOpenAtStepEnd = false;
        eventComplete = true;
      }
      continue;
    }
    if (entryLocation === null) {
      entryLocation = location(step, contact.entryFraction, `${path}/entry`);
      startedInside = contact.startedInside;
      tangent = contact.tangent;
      if (contact.exitFraction !== null) {
        exitLocation = location(step, contact.exitFraction, `${path}/exit`);
        exitStepIndex = index;
      }
      eventOpenAtStepEnd = contact.exitFraction === null || contact.exitFraction === 1 || contact.zeroLength;
      eventComplete = contact.exitFraction !== null && !eventOpenAtStepEnd;
      continue;
    }

    if (exitLocation === null) {
      if (contact.entryFraction !== 0) {
        eventOpenAtStepEnd = false;
        eventComplete = true;
        continue;
      }
      tangent = false;
      if (contact.exitFraction !== null) {
        exitLocation = location(step, contact.exitFraction, `${path}/exit`);
        exitStepIndex = index;
      }
      eventOpenAtStepEnd = contact.exitFraction === null || contact.exitFraction === 1 || contact.zeroLength;
      eventComplete = contact.exitFraction !== null && !eventOpenAtStepEnd;
      continue;
    }

    const continuesAtSharedEndpoint =
      exitStepIndex === index - 1 &&
      eventOpenAtStepEnd &&
      contact.entryFraction === 0;
    if (!continuesAtSharedEndpoint) {
      eventOpenAtStepEnd = false;
      eventComplete = true;
      continue;
    }

    if (!contact.tangent) {
      tangent = false;
      exitLocation = contact.exitFraction === null
        ? null
        : location(step, contact.exitFraction, `${path}/exit`);
      exitStepIndex = contact.exitFraction === null ? -1 : index;
      eventOpenAtStepEnd = contact.exitFraction === null || contact.exitFraction === 1 || contact.zeroLength;
      eventComplete = contact.exitFraction !== null && !eventOpenAtStepEnd;
    } else if (contact.zeroLength) {
      exitStepIndex = index;
      eventOpenAtStepEnd = true;
    } else {
      eventOpenAtStepEnd = false;
      eventComplete = true;
    }
  }

  if (closestLocation === null) {
    return Object.freeze({ hazard, event: null, closestApproach: null });
  }
  const effectiveRadius = finite(
    hazard.radiusMeters + hazard.safetyMarginMeters,
    `/hazards/${hazard.hazardId}/effectiveRadiusMeters`
  );
  const clearance = finite(closestDistance - effectiveRadius, `/hazards/${hazard.hazardId}/minimumClearanceMeters`);
  const closestApproach: TrajectoryClosestApproach = Object.freeze({
    hazardId: hazard.hazardId,
    location: closestLocation,
    centerDistanceMeters: closestDistance,
    clearanceMeters: clearance
  });
  const event: TrajectoryHazardEvent | null = entryLocation === null
    ? null
    : Object.freeze({
        hazardId: hazard.hazardId,
        entry: entryLocation,
        exit: exitLocation,
        minimum: closestLocation,
        minimumCenterDistanceMeters: closestDistance,
        minimumClearanceMeters: clearance,
        startedInside,
        tangent
      });
  return Object.freeze({ hazard, event, closestApproach });
};

const compareHazardIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const analyzeSweptTrajectoryHazards = (
  steps: readonly TrajectoryIntegratedStep[],
  hazards: readonly SphericalTrajectoryHazard[],
  hazardGeometryEpsilonMeters: number
): readonly TrajectorySweptHazardAnalysis[] => {
  if (!Number.isFinite(hazardGeometryEpsilonMeters) || hazardGeometryEpsilonMeters < 0) {
    return fail("/toleranceProfile/hazardGeometryEpsilonMeters", "Hazard geometry tolerance must be finite and nonnegative.");
  }
  const orderedHazards = [...hazards].sort((left, right) => compareHazardIds(left.hazardId, right.hazardId));
  return Object.freeze(orderedHazards.map((hazard) => analyzeHazard(steps, hazard, hazardGeometryEpsilonMeters)));
};

export const createTrajectoryHazardEvents = (
  analyses: readonly TrajectorySweptHazardAnalysis[]
): readonly TrajectoryHazardEvent[] => Object.freeze(
  analyses
    .flatMap((analysis) => analysis.event === null ? [] : [analysis.event])
    .sort((left, right) =>
      left.entry.stepStartTick - right.entry.stepStartTick ||
      left.entry.fraction - right.entry.fraction ||
      compareHazardIds(left.hazardId, right.hazardId)
    )
);
