import {
  canonicalizePersistenceValue,
  createPersistenceSignature,
  serializeCanonicalPersistenceValue,
  type PersistenceSignature
} from "../persistence/canonical";

export type SpatialSignature = PersistenceSignature;

export const canonicalizeSpatialValue = <T>(value: unknown): Readonly<T> =>
  canonicalizePersistenceValue<T>(value);

export const serializeCanonicalSpatialValue = (value: unknown): string =>
  serializeCanonicalPersistenceValue(value);

export const createSpatialSignature = (value: unknown): SpatialSignature => createPersistenceSignature(value);
