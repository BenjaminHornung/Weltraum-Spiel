import {
  canonicalizePersistenceValue,
  createPersistenceSignature,
  serializeCanonicalPersistenceValue,
  type PersistenceSignature
} from "../persistence/canonical";

export type PhysicsSpaceSignature = PersistenceSignature;

export const canonicalizePhysicsSpaceValue = <T>(value: unknown): Readonly<T> =>
  canonicalizePersistenceValue<T>(value);

export const serializeCanonicalPhysicsSpaceValue = (value: unknown): string =>
  serializeCanonicalPersistenceValue(value);

export const createPhysicsSpaceSignature = (value: unknown): PhysicsSpaceSignature =>
  createPersistenceSignature(value);
