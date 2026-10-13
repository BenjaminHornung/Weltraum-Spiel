import type { TrajectoryClosestApproach } from "./types";
import type { TrajectorySweptHazardAnalysis } from "./hazards";

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const createTrajectoryClosestApproaches = (
  analyses: readonly TrajectorySweptHazardAnalysis[]
): readonly TrajectoryClosestApproach[] => Object.freeze(
  analyses
    .flatMap((analysis) => analysis.closestApproach === null ? [] : [analysis.closestApproach])
    .sort((left, right) =>
      left.clearanceMeters - right.clearanceMeters ||
      left.centerDistanceMeters - right.centerDistanceMeters ||
      compareIds(left.hazardId, right.hazardId)
    )
);
