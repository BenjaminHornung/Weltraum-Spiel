import { parseExternalReferenceId, type PersistenceBrand } from "../persistence/ids";
import type { PersistenceSignature } from "../persistence/canonical";

export type TrajectoryPredictionId = PersistenceBrand<string, "TrajectoryPredictionId">;
export type TrajectorySegmentId = PersistenceBrand<string, "TrajectorySegmentId">;
export type TrajectoryHazardId = PersistenceBrand<string, "TrajectoryHazardId">;
export type TrajectoryCanonicalSignature = PersistenceSignature;

export type TrajectoryIdErrorCode = "InvalidTrajectoryId" | "InvalidTrajectoryCanonicalSignature";

export class TrajectoryIdError extends Error {
  public constructor(
    public readonly code: TrajectoryIdErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "TrajectoryIdError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const parseTrajectoryId = <T extends string>(
  value: unknown,
  label: string,
  path: string
): T => {
  let parsed: string;
  try {
    parsed = parseExternalReferenceId(value, path);
  } catch {
    throw new TrajectoryIdError("InvalidTrajectoryId", path, `${label} must be a stable lowercase ASCII identifier.`);
  }
  return parsed as T;
};

export const createTrajectoryPredictionId = (value: unknown, path = "/predictionId"): TrajectoryPredictionId =>
  parseTrajectoryId<TrajectoryPredictionId>(value, "Trajectory prediction ID", path);

export const createTrajectorySegmentId = (value: unknown, path = "/segmentId"): TrajectorySegmentId =>
  parseTrajectoryId<TrajectorySegmentId>(value, "Trajectory segment ID", path);

export const createTrajectoryHazardId = (value: unknown, path = "/hazardId"): TrajectoryHazardId =>
  parseTrajectoryId<TrajectoryHazardId>(value, "Trajectory hazard ID", path);

export const createTrajectoryCanonicalSignature = (
  value: unknown,
  path = "/canonicalSignature"
): TrajectoryCanonicalSignature => {
  if (typeof value !== "string" || !/^fnv1a32:[0-9a-f]{8}$/.test(value)) {
    throw new TrajectoryIdError(
      "InvalidTrajectoryCanonicalSignature",
      path,
      "Trajectory canonical signature must use fnv1a32 followed by eight lowercase hexadecimal digits."
    );
  }
  return value as TrajectoryCanonicalSignature;
};

export const parseTrajectoryPredictionId = createTrajectoryPredictionId;
export const parseTrajectorySegmentId = createTrajectorySegmentId;
export const parseTrajectoryHazardId = createTrajectoryHazardId;
