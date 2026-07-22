import {
  deserializeSaveGameEnvelopeV1,
  serializeSaveGameEnvelopeV1,
  type DefinitionResolutionSnapshot,
  type SaveGameEnvelopeV1
} from "../persistence";
import { SaveRepositoryError } from "./errors";

const textEncoder = new TextEncoder();
const fatalTextDecoder = new TextDecoder("utf-8", { fatal: true });

export interface CanonicalSavePayload {
  readonly envelope: SaveGameEnvelopeV1;
  readonly canonicalPayload: string;
  readonly payloadBytes: Uint8Array;
}

export const captureDefinitionResolutionSnapshots = (
  value: readonly DefinitionResolutionSnapshot[]
): readonly DefinitionResolutionSnapshot[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new SaveRepositoryError("InvalidEnvelope", "configureCodec", "Definition snapshots must be a plain array.");
  }

  const snapshots = value.map((snapshot) => {
    if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new SaveRepositoryError("InvalidEnvelope", "configureCodec", "Definition snapshot must be a plain object.");
    }
    if (!Array.isArray(snapshot.definitionIds) || Object.getPrototypeOf(snapshot.definitionIds) !== Array.prototype) {
      throw new SaveRepositoryError("InvalidEnvelope", "configureCodec", "Definition IDs must be a plain array.");
    }
    const definitionIds = Object.freeze([...snapshot.definitionIds]);
    return Object.freeze({
      domain: snapshot.domain,
      version: snapshot.version,
      definitionIds
    });
  });
  return Object.freeze(snapshots);
};

export const encodeUtf8 = (value: string): Uint8Array => textEncoder.encode(value);

export const decodeUtf8Fatal = (value: Uint8Array): string => fatalTextDecoder.decode(value);

export const createCanonicalSavePayload = (
  value: unknown,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): CanonicalSavePayload => {
  const canonicalPayload = serializeSaveGameEnvelopeV1(value, definitionSnapshots);
  const envelope = deserializeSaveGameEnvelopeV1(canonicalPayload, definitionSnapshots);
  return Object.freeze({
    envelope,
    canonicalPayload,
    payloadBytes: encodeUtf8(canonicalPayload)
  });
};

export const parseCanonicalSavePayload = (
  payloadBytes: Uint8Array,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): CanonicalSavePayload => {
  const canonicalPayload = decodeUtf8Fatal(payloadBytes);
  const envelope = deserializeSaveGameEnvelopeV1(canonicalPayload, definitionSnapshots);
  if (serializeSaveGameEnvelopeV1(envelope, definitionSnapshots) !== canonicalPayload) {
    throw new Error("Save payload is valid JSON but is not the compact canonical representation.");
  }
  return Object.freeze({
    envelope,
    canonicalPayload,
    payloadBytes: new Uint8Array(payloadBytes)
  });
};
