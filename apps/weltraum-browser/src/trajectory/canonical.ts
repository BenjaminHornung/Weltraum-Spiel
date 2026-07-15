import {
  canonicalizePersistenceValue,
  createPersistenceSignature,
  serializeCanonicalPersistenceValue
} from "../persistence/canonical";
import { deepFreeze } from "../persistence/validation";
import type {
  CompletedTrajectoryPredictionResult,
  RejectedTrajectoryPredictionResult,
  TrajectoryPredictionRequest
} from "./types";

export type CompletedTrajectoryResultPayload = Omit<CompletedTrajectoryPredictionResult, "canonicalSignature">;
export type RejectedTrajectoryResultPayload = Omit<RejectedTrajectoryPredictionResult, "canonicalSignature">;

export const canonicalizeTrajectoryValue = <T>(value: unknown): Readonly<T> =>
  canonicalizePersistenceValue<T>(value);

export const serializeCanonicalTrajectoryValue = (value: unknown): string =>
  serializeCanonicalPersistenceValue(value);

export const createTrajectoryResultSignature = (value: unknown): CompletedTrajectoryPredictionResult["canonicalSignature"] =>
  createPersistenceSignature(value);

const withoutOwnCanonicalSignature = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  delete descriptors.canonicalSignature;
  return Object.create(Object.getPrototypeOf(value), descriptors) as unknown;
};

export const createCompletedTrajectoryPredictionResult = (
  request: TrajectoryPredictionRequest,
  payload: CompletedTrajectoryResultPayload
): CompletedTrajectoryPredictionResult => {
  const ownedRequest = canonicalizeTrajectoryValue<TrajectoryPredictionRequest>(request);
  const ownedPayload = canonicalizeTrajectoryValue<CompletedTrajectoryResultPayload>(
    withoutOwnCanonicalSignature(payload)
  );
  const canonicalPayload = canonicalizeTrajectoryValue({ request: ownedRequest, result: ownedPayload });
  return deepFreeze({
    ...ownedPayload,
    canonicalSignature: createTrajectoryResultSignature(canonicalPayload)
  }) as CompletedTrajectoryPredictionResult;
};

export const createRejectedTrajectoryPredictionResult = (
  payload: RejectedTrajectoryResultPayload
): RejectedTrajectoryPredictionResult => {
  const canonicalPayload = canonicalizeTrajectoryValue<RejectedTrajectoryResultPayload>(
    withoutOwnCanonicalSignature(payload)
  );
  return deepFreeze({
    ...canonicalPayload,
    canonicalSignature: createTrajectoryResultSignature(canonicalPayload)
  }) as RejectedTrajectoryPredictionResult;
};
