import { canonicalAdaptiveJson } from "../../voxel/adaptive/canonical";
import {
  compareCanonicalCodeUnits,
  deepFreeze,
  requireCanonicalString,
  requireDenseDataPropertyArray,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId
} from "../../voxel/adaptive/validation";
import {
  projectStructuralObject,
  projectStructuralResult
} from "../../voxel/structural/canonical";
import { validateStructuralAcceptedCommandResultProjection } from "../../voxel/structural/commands";
import { serializeStructuralCellAddress } from "../../voxel/structural/canonical";
import {
  validateSurfaceRigidBodyColliderRepresentation,
  type SurfaceRigidBodyCandidate
} from "../physics/surfaceRigidBody";
import { validateSurfaceRigidBodyWorldTransport } from "../physics/surfaceRigidBodyWorld";
import {
  deriveSurfaceTreeAuthority,
  projectSurfaceTreeAuthoritySnapshotTransport,
  validateSurfaceTreeAuthoritySnapshotTransport,
  validateSurfaceTreeDetachedComponentFactsTransport,
  type SurfaceTreeAuthoritySnapshot
} from "../vegetation/surfaceTreeAuthority";
import {
  validateSurfaceTreeCollisionSnapshotTransport,
  type SurfaceTreeCollisionSnapshot
} from "../vegetation/surfaceTreeCollision";
import {
  assertSurfaceTreePreparedBodySourceLifecycle,
  deriveSurfaceTreePreparedExistingBodyCandidate,
  prepareSurfaceTreeFire,
  validateSurfaceTreePreparedExistingBodySourceTransport,
  type SurfaceTreePreparedExistingBodySourceFacts,
  type SurfaceTreePreparedFire
} from "../vegetation/surfaceTreePreparedFire";
import {
  PREPARED_DERIVATION_TRANSACTION_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2,
  PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_COMMAND_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_CONTINUATION_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES,
  PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_DEFINITIONS,
  PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_ROOT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_PAGE_BYTES,
  PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_PHYSICAL_PAGE_ROOT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES,
  PREPARED_STRUCTURAL_FIRE_REQUEST_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_RESULT_MANIFEST_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES,
  PREPARED_STRUCTURAL_FIRE_SEED_MANIFEST_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES,
  PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION,
  type PreparedDerivationTransaction,
  type PreparedStructuralFireBodyPlan,
  type PreparedStructuralFireCanonicalItem,
  type PreparedStructuralFireCanonicalItemRecord,
  type PreparedStructuralFireCardinality,
  type PreparedStructuralFireCollisionResult,
  type PreparedStructuralFireCommand,
  type PreparedStructuralFireContinuationCursor,
  type PreparedStructuralFireDirection,
  type PreparedStructuralFireHash,
  type PreparedStructuralFireLogicalViewDescriptor,
  type PreparedStructuralFireLogicalViewName,
  type PreparedStructuralFirePageEnvelope,
  type PreparedStructuralFirePageHeader,
  type PreparedStructuralFireReady,
  type PreparedStructuralFireRequest,
  type PreparedStructuralFireResultManifest,
  type PreparedStructuralFireResultReceipt,
  type PreparedStructuralFireSeedManifest,
  type PreparedStructuralFireSourceIdentity
} from "./preparedStructuralFireWire";
import type {
  PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
} from "./preparedStructuralFireProtocol";

const encoder = new TextEncoder();
const HASH_PATTERN = /^fnv1a64-v1:[0-9a-f]{16}$/;
const CALLER_NONCE_PATTERN = /^[0-9a-f]{32}$/;
const ROOT_JOB_PATTERN = /^psf-root-v1:[0-9a-f]{16}$/;
const JOB_PATTERN = /^psf-job-v1:[0-9a-f]{16}$/;
const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

const safeNonNegativeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    throw new RangeError(`${path} must be a non-negative safe integer.`);
  }
  return value;
};

const safeAdd = (left: number, right: number, path: string): number => {
  safeNonNegativeInteger(left, `${path}.left`);
  safeNonNegativeInteger(right, `${path}.right`);
  if (right > Number.MAX_SAFE_INTEGER - left) {
    throw new RangeError(`${path} exceeds the safe-integer range.`);
  }
  return left + right;
};

const canonicalRecord = (value: unknown, path: string): Readonly<Record<string, unknown>> =>
  requirePlainRecord(value, path);

const canonicalBytes = (value: unknown): Uint8Array => encoder.encode(canonicalAdaptiveJson(value));

const ownCanonical = <T>(value: T): T =>
  deepFreeze(JSON.parse(canonicalAdaptiveJson(value)) as T);

const validateHash = (value: string, path: string): PreparedStructuralFireHash => {
  if (!HASH_PATTERN.test(value)) throw new RangeError(`${path} is not a canonical FNV-1a64 hash.`);
  return value as PreparedStructuralFireHash;
};

const hashHex = (hash: PreparedStructuralFireHash): string => hash.slice("fnv1a64-v1:".length);

const rawHashBytes = (hash: PreparedStructuralFireHash): Uint8Array => {
  const hex = hashHex(validateHash(hash, "hash"));
  const result = new Uint8Array(8);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
};

const joinBytes = (...parts: readonly Uint8Array[]): Uint8Array => {
  let byteLength = 0;
  for (const part of parts) byteLength = safeAdd(byteLength, part.byteLength, "joined byte length");
  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

export const preparedStructuralFireU32Be = (value: number): Uint8Array => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError("U32 value is outside the unsigned 32-bit range.");
  }
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value, false);
  return result;
};

export const preparedStructuralFireU64Be = (value: number): Uint8Array => {
  safeNonNegativeInteger(value, "U64 value");
  const result = new Uint8Array(8);
  new DataView(result.buffer).setBigUint64(0, BigInt(value), false);
  return result;
};

export class PreparedStructuralFireHashAccumulator {
  readonly #expectedPayloadBytes: number;
  #hash = FNV_OFFSET_BASIS;
  #payloadBytes = 0;
  #finished = false;

  constructor(domain: string, expectedPayloadBytes: number) {
    const canonicalDomain = requireCanonicalString(domain, "hash.domain");
    const domainBytes = encoder.encode(canonicalDomain);
    if (domainBytes.byteLength > 0xffff_ffff) throw new RangeError("Hash domain is too large.");
    this.#expectedPayloadBytes = safeNonNegativeInteger(
      expectedPayloadBytes,
      "hash.expectedPayloadBytes"
    );
    this.#mix(preparedStructuralFireU32Be(domainBytes.byteLength));
    this.#mix(domainBytes);
    this.#mix(preparedStructuralFireU64Be(this.#expectedPayloadBytes));
  }

  update(bytes: Uint8Array): this {
    if (this.#finished) throw new RangeError("Hash accumulator is already finished.");
    const next = safeAdd(this.#payloadBytes, bytes.byteLength, "hash payload length");
    if (next > this.#expectedPayloadBytes) throw new RangeError("Hash payload exceeds its framed length.");
    this.#mix(bytes);
    this.#payloadBytes = next;
    return this;
  }

  finish(): PreparedStructuralFireHash {
    if (this.#finished) throw new RangeError("Hash accumulator is already finished.");
    if (this.#payloadBytes !== this.#expectedPayloadBytes) {
      throw new RangeError("Hash payload is incomplete.");
    }
    this.#finished = true;
    return `fnv1a64-v1:${this.#hash.toString(16).padStart(16, "0")}`;
  }

  #mix(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.#hash ^= BigInt(byte);
      this.#hash = (this.#hash * FNV_PRIME) & FNV_MASK;
    }
  }
}

export const hashPreparedStructuralFireBytes = (
  domain: string,
  payload: Uint8Array
): PreparedStructuralFireHash =>
  new PreparedStructuralFireHashAccumulator(domain, payload.byteLength).update(payload).finish();

export const hashPreparedStructuralFireCanonical = (
  domain: string,
  payload: unknown
): PreparedStructuralFireHash => hashPreparedStructuralFireBytes(domain, canonicalBytes(payload));

type CanonicalJsonFrame =
  | {
      readonly kind: "Array";
      readonly value: unknown[];
      state: "ValueOrEnd" | "CommaOrEnd";
    }
  | {
      readonly kind: "Object";
      readonly value: Record<string, unknown>;
      state: "KeyOrEnd" | "Colon" | "Value" | "CommaOrEnd";
      key: string | null;
      lastKey: string | null;
    };

/**
 * Incremental canonical-JSON parser used by the private paged wire. Encoded
 * transport text is never accumulated; exactly one current owner payload is.
 */
class PreparedStructuralFireCanonicalJsonParser {
  readonly #frames: CanonicalJsonFrame[] = [];
  #root: unknown;
  #hasRoot = false;
  #token: "None" | "String" | "Number" | "Literal" = "None";
  #stringRole: "Key" | "Value" = "Value";
  #stringValue = "";
  #escape = false;
  #unicodeEscape = "";
  #pendingHighSurrogate = "";
  #number = "";
  #literal = "";
  #literalOffset = 0;

  get complete(): boolean {
    return this.#hasRoot && this.#frames.length === 0 && this.#token === "None";
  }

  write(text: string): number {
    let index = 0;
    while (index < text.length) {
      if (this.complete) return index;
      const character = text[index];
      if (this.#token === "String") {
        this.#writeString(character);
        index += 1;
        continue;
      }
      if (this.#token === "Number") {
        if (/[0-9eE+.-]/u.test(character)) {
          if (this.#number.length >= 64) throw new RangeError("Canonical JSON number is too long.");
          this.#number += character;
          index += 1;
          continue;
        }
        this.#finishNumber();
        continue;
      }
      if (this.#token === "Literal") {
        if (character !== this.#literal[this.#literalOffset]) {
          throw new RangeError("Canonical JSON literal is invalid.");
        }
        this.#literalOffset += 1;
        index += 1;
        if (this.#literalOffset === this.#literal.length) {
          const value = this.#literal === "true" ? true : this.#literal === "false" ? false : null;
          this.#token = "None";
          this.#completeValue(value);
        }
        continue;
      }
      if (/\s/u.test(character)) throw new RangeError("Canonical JSON must not contain whitespace.");
      const frame = this.#frames.at(-1);
      if (frame?.kind === "Object") {
        if (frame.state === "KeyOrEnd") {
          if (character === "}") {
            if (frame.lastKey !== null) {
              throw new RangeError("Canonical JSON objects must not have a trailing comma.");
            }
            this.#frames.pop();
            this.#completeValue(frame.value);
          } else if (character === "\"") {
            this.#beginString("Key");
          } else {
            throw new RangeError("Canonical JSON object key is invalid.");
          }
          index += 1;
          continue;
        }
        if (frame.state === "Colon") {
          if (character !== ":") throw new RangeError("Canonical JSON object colon is missing.");
          frame.state = "Value";
          index += 1;
          continue;
        }
        if (frame.state === "CommaOrEnd") {
          if (character === ",") frame.state = "KeyOrEnd";
          else if (character === "}") {
            this.#frames.pop();
            this.#completeValue(frame.value);
          } else throw new RangeError("Canonical JSON object delimiter is invalid.");
          index += 1;
          continue;
        }
      } else if (frame?.kind === "Array") {
        if (frame.state === "ValueOrEnd" && character === "]") {
          if (frame.value.length !== 0) {
            throw new RangeError("Canonical JSON arrays must not have a trailing comma.");
          }
          this.#frames.pop();
          this.#completeValue(frame.value);
          index += 1;
          continue;
        }
        if (frame.state === "CommaOrEnd") {
          if (character === ",") frame.state = "ValueOrEnd";
          else if (character === "]") {
            this.#frames.pop();
            this.#completeValue(frame.value);
          } else throw new RangeError("Canonical JSON array delimiter is invalid.");
          index += 1;
          continue;
        }
      }
      this.#beginValue(character);
      index += 1;
    }
    return index;
  }

  finish(): unknown {
    if (this.#token === "Number") this.#finishNumber();
    if (!this.complete) throw new RangeError("Canonical JSON value is incomplete.");
    return this.#root;
  }

  #beginValue(character: string): void {
    if (character === "{") {
      this.#frames.push({ kind: "Object", value: {}, state: "KeyOrEnd", key: null, lastKey: null });
      return;
    }
    if (character === "[") {
      this.#frames.push({ kind: "Array", value: [], state: "ValueOrEnd" });
      return;
    }
    if (character === "\"") {
      this.#beginString("Value");
      return;
    }
    if (character === "t" || character === "f" || character === "n") {
      this.#token = "Literal";
      this.#literal = character === "t" ? "true" : character === "f" ? "false" : "null";
      this.#literalOffset = 1;
      return;
    }
    if (character === "-" || /[0-9]/u.test(character)) {
      this.#token = "Number";
      this.#number = character;
      return;
    }
    throw new RangeError("Canonical JSON value is invalid.");
  }

  #beginString(role: "Key" | "Value"): void {
    this.#token = "String";
    this.#stringRole = role;
    this.#stringValue = "";
    this.#escape = false;
    this.#unicodeEscape = "";
    this.#pendingHighSurrogate = "";
  }

  #writeString(character: string): void {
    if (this.#unicodeEscape.length > 0) {
      if (!/[0-9a-f]/u.test(character)) {
        throw new RangeError("Canonical JSON unicode escape must use lowercase hexadecimal.");
      }
      this.#unicodeEscape += character;
      if (this.#unicodeEscape.length === 5) {
        const code = Number.parseInt(this.#unicodeEscape.slice(1), 16);
        if (code >= 0x20 || [0x08, 0x09, 0x0a, 0x0c, 0x0d].includes(code)) {
          throw new RangeError("Canonical JSON string uses a noncanonical unicode escape.");
        }
        this.#stringValue += String.fromCharCode(code);
        this.#unicodeEscape = "";
        this.#escape = false;
      }
      return;
    }
    if (this.#escape) {
      const escaped: Readonly<Record<string, string>> = {
        "\"": "\"", "\\": "\\", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t"
      };
      if (character === "u") {
        this.#unicodeEscape = "u";
        return;
      }
      const value = escaped[character];
      if (value === undefined) throw new RangeError("Canonical JSON string escape is invalid.");
      this.#stringValue += value;
      this.#escape = false;
      return;
    }
    if (character === "\\") {
      this.#escape = true;
      return;
    }
    if (character === "\"") {
      if (this.#pendingHighSurrogate !== "") {
        throw new RangeError("Canonical JSON string contains an unpaired surrogate.");
      }
      this.#token = "None";
      if (this.#stringRole === "Key") this.#completeKey(this.#stringValue);
      else this.#completeValue(this.#stringValue);
      return;
    }
    const code = character.charCodeAt(0);
    if (code < 0x20) throw new RangeError("Canonical JSON string contains a control character.");
    if (this.#pendingHighSurrogate !== "") {
      if (code < 0xdc00 || code > 0xdfff) {
        throw new RangeError("Canonical JSON string contains an unpaired surrogate.");
      }
      this.#stringValue += this.#pendingHighSurrogate + character;
      this.#pendingHighSurrogate = "";
      return;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      this.#pendingHighSurrogate = character;
      return;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new RangeError("Canonical JSON string contains an unpaired surrogate.");
    }
    this.#stringValue += character;
  }

  #finishNumber(): void {
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/u.test(this.#number)) {
      throw new RangeError("Canonical JSON number is invalid.");
    }
    const value = Number(this.#number);
    if (!Number.isFinite(value) || JSON.stringify(value) !== this.#number) {
      throw new RangeError("Canonical JSON number is noncanonical.");
    }
    this.#token = "None";
    this.#completeValue(value);
  }

  #completeKey(key: string): void {
    const frame = this.#frames.at(-1);
    if (frame?.kind !== "Object" || frame.state !== "KeyOrEnd") {
      throw new RangeError("Canonical JSON key is out of place.");
    }
    if (frame.lastKey !== null && compareCanonicalCodeUnits(frame.lastKey, key) >= 0) {
      throw new RangeError("Canonical JSON object keys must be unique and strictly ordered.");
    }
    frame.key = key;
    frame.lastKey = key;
    frame.state = "Colon";
  }

  #completeValue(value: unknown): void {
    const frame = this.#frames.at(-1);
    if (frame === undefined) {
      if (this.#hasRoot) throw new RangeError("Canonical JSON contains trailing values.");
      this.#root = value;
      this.#hasRoot = true;
      return;
    }
    if (frame.kind === "Array") {
      if (frame.state !== "ValueOrEnd") throw new RangeError("Canonical JSON array value is out of place.");
      frame.value.push(value);
      frame.state = "CommaOrEnd";
      return;
    }
    if (frame.state !== "Value" || frame.key === null) {
      throw new RangeError("Canonical JSON object value is out of place.");
    }
    Object.defineProperty(frame.value, frame.key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    frame.key = null;
    frame.state = "CommaOrEnd";
  }
}

const viewDefinition = (name: PreparedStructuralFireLogicalViewName) => {
  const definition = PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_DEFINITIONS.find(
    (candidate) => candidate.name === name
  );
  if (definition === undefined) throw new RangeError(`Unsupported logical view ${name}.`);
  return definition;
};

const assertViewPayloadShape = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  key: string,
  payload: unknown
): void => {
  const record = canonicalRecord(payload, `${logicalViewName}/${key}`);
  switch (logicalViewName) {
    case "seed.existingBodySourceFacts":
      requireExactKeys(record, [
        "schemaVersion",
        "bodyId",
        "sourceObject",
        "component",
        "fragment",
        "massProperties",
        "meshArtifactIsLazy"
      ], logicalViewName);
      if (record.bodyId !== key || record.meshArtifactIsLazy !== true) {
        throw new RangeError("Existing body-source facts must bind their key and lazy mesh boundary.");
      }
      return;
    case "seed.physicsImmutable":
      requireExactKeys(record, [
        "schemaVersion",
        "bodyId",
        "componentId",
        "objectId",
        "sourceObjectRevision",
        "sourceContentHash",
        "massKg",
        "inverseMassPerKg",
        "centerOfMassMeters",
        "inertiaTensorKgMetersSquared",
        "inverseInertiaTensorPerKgMetersSquared",
        "colliderRepresentation",
        "colliderRevision",
        "detachedAtSimulationTick",
        "activationSimulationTick"
      ], logicalViewName);
      if (record.bodyId !== key || Object.hasOwn(record, "colliders")) {
        throw new RangeError("Physics immutable facts must bind bodyId and omit the collider alias.");
      }
      return;
    case "seed.physicsDynamicState":
      if (record.kind === "World") {
        requireExactKeys(record, [
          "kind",
          "simulationTick",
          "gravityMetersPerSecondSquared",
          "terrainColliders",
          "physicsFailure"
        ], logicalViewName);
        if (key !== "0:world") throw new RangeError("Physics World facts use key 0:world.");
      } else if (record.kind === "Body") {
        requireExactKeys(record, ["kind", "bodyId", "candidateInitial", "current"], logicalViewName);
        if (key !== `1:${String(record.bodyId)}`) {
          throw new RangeError("Physics Body facts must use their canonical body key.");
        }
      } else {
        throw new RangeError("Physics dynamic facts require World or Body kind.");
      }
      return;
    case "result.bodyPlan":
      requireExactKeys(record, [
        "schemaVersion",
        "bodyId",
        "bodySource",
        "physicsImmutable",
        "initialDynamic"
      ], logicalViewName);
      if (record.bodyId !== key) throw new RangeError("Prepared body facts must bind their bodyId key.");
      return;
    default:
      return;
  }
};

const physicsImmutableProjection = (candidate: Readonly<SurfaceRigidBodyCandidate>) => ({
  schemaVersion: "prepared-structural-fire-physics-immutable-v1",
  bodyId: candidate.bodyId,
  componentId: candidate.componentId,
  objectId: candidate.objectId,
  sourceObjectRevision: candidate.sourceObjectRevision,
  sourceContentHash: candidate.sourceContentHash,
  massKg: candidate.massKg,
  inverseMassPerKg: candidate.inverseMassPerKg,
  centerOfMassMeters: candidate.centerOfMassMeters,
  inertiaTensorKgMetersSquared: candidate.inertiaTensorKgMetersSquared,
  inverseInertiaTensorPerKgMetersSquared: candidate.inverseInertiaTensorPerKgMetersSquared,
  colliderRepresentation: candidate.colliderRepresentation,
  colliderRevision: candidate.colliderRevision,
  detachedAtSimulationTick: candidate.detachedAtSimulationTick,
  activationSimulationTick: candidate.activationSimulationTick
});

const initialDynamicProjection = (candidate: Readonly<SurfaceRigidBodyCandidate>) => ({
  positionMeters: candidate.positionMeters,
  orientation: candidate.orientation,
  linearVelocityMetersPerSecond: candidate.linearVelocityMetersPerSecond,
  angularVelocityRadiansPerSecond: candidate.angularVelocityRadiansPerSecond
});

const preparedBodyCreateProjection = (
  source: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>["newBodySourcePlans"][number]
) => ({
  schemaVersion: "prepared-structural-fire-body-create-v1",
  bodyId: source.candidate.bodyId,
  bodySource: {
    sourceObject: projectStructuralObject(source.sourceObject),
    component: source.component,
    fragment: source.fragment,
    massProperties: source.massProperties
  },
  physicsImmutable: physicsImmutableProjection(source.candidate),
  initialDynamic: initialDynamicProjection(source.candidate)
});

export interface PreparedStructuralFireResultViewProjection {
  readonly logicalViewName: (typeof PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES)[number];
  readonly openItems: () => Iterable<Readonly<PreparedStructuralFireCanonicalItem>>;
}

export const createPreparedStructuralFireResultViewProjections = (
  prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>
): readonly PreparedStructuralFireResultViewProjection[] => Object.freeze(
  PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES.map((logicalViewName) => Object.freeze({
    logicalViewName,
    openItems: function* (): Generator<Readonly<PreparedStructuralFireCanonicalItem>> {
      switch (logicalViewName) {
        case "result.damageResult":
          yield Object.freeze({ key: "@", payload: projectStructuralResult(prepared.damageResult) });
          return;
        case "result.detachedFacts":
          for (const facts of prepared.detachedFacts) {
            yield Object.freeze({ key: facts.component.componentId, payload: facts });
          }
          return;
        case "result.bodyPlan":
          for (const source of prepared.newBodySourcePlans) {
            yield Object.freeze({
              key: source.candidate.bodyId,
              payload: preparedBodyCreateProjection(source)
            });
          }
          return;
        case "result.transferResult":
          if (prepared.transferResult !== null) {
            yield Object.freeze({
              key: "@transfer",
              payload: projectStructuralResult(prepared.transferResult)
            });
          }
          return;
        case "result.finalAuthority":
          yield Object.freeze({
            key: "@",
            payload: projectSurfaceTreeAuthoritySnapshotTransport(prepared.finalAuthority)
          });
          return;
        case "result.authorityTransfer":
          if (prepared.authorityTransfer !== null) {
            yield Object.freeze({ key: "@transfer", payload: prepared.authorityTransfer });
          }
          return;
        case "result.collision":
          yield Object.freeze({ key: "@", payload: prepared.collision });
          return;
        case "result.transition":
          yield Object.freeze({ key: "@", payload: prepared.transition });
          return;
        case "result.work":
          yield Object.freeze({
            key: "@",
            payload: {
              work: prepared.work,
              suggestedEditRadiusMeters: prepared.suggestedEditRadiusMeters
            }
          });
      }
    }
  }))
);

const ownerPreparedTransactions = new WeakSet<object>();

/** Owner-backed validator shared by all decoded views of one seed/request chain. */
export class PreparedStructuralFireOwnerPayloadValidator {
  readonly #diagnostics: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver | undefined;
  #seedAuthority: SurfaceTreeAuthoritySnapshot | null = null;
  #damageAuthority: SurfaceTreeAuthoritySnapshot | null = null;
  #finalAuthority: SurfaceTreeAuthoritySnapshot | null = null;
  readonly #bodySources = new Map<string, ReturnType<typeof validateSurfaceTreePreparedExistingBodySourceTransport>>();
  readonly #physicsImmutable = new Map<string, Readonly<Record<string, unknown>>>();
  #physicsWorld: Readonly<Record<string, unknown>> | null = null;
  readonly #physicsBodies = new Map<string, Readonly<Record<string, unknown>>>();
  #prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }> | null = null;
  #command: PreparedStructuralFireCommand | null = null;
  #seedHash: PreparedStructuralFireHash | null = null;
  #failed = false;
  readonly #decodedViews = new Map<
    PreparedStructuralFireLogicalViewName,
    PreparedStructuralFireLogicalViewDescriptor
  >();

  constructor(
    diagnostics?: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
  ) {
    this.#diagnostics = diagnostics;
  }

  readonly validate: PreparedStructuralFirePayloadValidator = (logicalViewName, key, payload) => {
    if (this.#failed) throw new RangeError("Owner payload scope is terminally invalid.");
    assertViewPayloadShape(logicalViewName, key, payload);
    if (logicalViewName === "seed.authority") {
      const authority = validateSurfaceTreeAuthoritySnapshotTransport(payload, this.#diagnostics);
      this.#seedAuthority = authority;
      return projectSurfaceTreeAuthoritySnapshotTransport(authority);
    }
    if (logicalViewName === "seed.collision") {
      const authority = this.#requireSeedAuthority();
      const collision = validateSurfaceTreeCollisionSnapshotTransport(
        authority,
        payload,
        this.#diagnostics
      );
      this.#expectedSeedCollision = collision;
      return collision;
    }
    if (logicalViewName === "seed.existingBodySourceFacts") {
      const source = validateSurfaceTreePreparedExistingBodySourceTransport(
        this.#requireSeedAuthority().tree,
        payload
      );
      if (source.bodyId !== key || this.#bodySources.has(key)) {
        throw new RangeError("Existing body-source facts key is duplicated or stale.");
      }
      this.#bodySources.set(key, source);
      return payload;
    }
    if (logicalViewName === "seed.physicsImmutable") {
      const record = canonicalRecord(payload, logicalViewName);
      if (record.bodyId !== key || this.#physicsImmutable.has(key)) {
        throw new RangeError("Physics immutable key is duplicated or stale.");
      }
      this.#physicsImmutable.set(key, record);
      return payload;
    }
    if (logicalViewName === "seed.physicsDynamicState") {
      const record = canonicalRecord(payload, logicalViewName);
      if (key === "0:world") {
        if (this.#physicsWorld !== null) throw new RangeError("Physics World facts are duplicated.");
        this.#physicsWorld = record;
      } else {
        const bodyId = String(record.bodyId);
        if (key !== `1:${bodyId}` || this.#physicsBodies.has(bodyId)) {
          throw new RangeError("Physics dynamic Body key is duplicated or stale.");
        }
        this.#physicsBodies.set(bodyId, record);
      }
      return payload;
    }
    const expected = this.#expectedResultPayload(logicalViewName, key);
    if (canonicalAdaptiveJson(expected) !== canonicalAdaptiveJson(payload)) {
      throw new RangeError(`${logicalViewName}/${key} does not reproduce Prepared Fire authority.`);
    }
    if (logicalViewName === "result.damageResult" || logicalViewName === "result.transferResult") {
      return validateStructuralAcceptedCommandResultProjection(payload);
    }
    if (logicalViewName === "result.finalAuthority") {
      const authority = validateSurfaceTreeAuthoritySnapshotTransport(payload);
      this.#finalAuthority = authority;
      return projectSurfaceTreeAuthoritySnapshotTransport(authority);
    }
    if (logicalViewName === "result.detachedFacts") {
      if (this.#damageAuthority === null) throw new RangeError("Damage authority is unavailable.");
      return validateSurfaceTreeDetachedComponentFactsTransport(this.#damageAuthority, payload);
    }
    if (logicalViewName === "result.collision") {
      return validateSurfaceTreeCollisionSnapshotTransport(
        this.#finalAuthority ?? this.#prepared!.finalAuthority,
        payload
      );
    }
    return expected;
  };

  decodeView(
    descriptor: Readonly<PreparedStructuralFireLogicalViewDescriptor>,
    pages: Iterable<Readonly<{
      readonly header: PreparedStructuralFirePageHeader;
      readonly bytes: Uint8Array;
    }>>
  ): PreparedStructuralFireLogicalViewDescriptor {
    if (this.#failed) throw new RangeError("Owner payload scope is terminally invalid.");
    if (this.#decodedViews.has(descriptor.logicalViewName)) {
      throw new RangeError(`Logical view ${descriptor.logicalViewName} is already decoded.`);
    }
    try {
      const facts = validatePreparedStructuralFirePageSequence(descriptor, pages, this.validate);
      const rebuilt = createPreparedStructuralFireLogicalViewDescriptor(
        descriptor.viewOrdinal,
        facts,
        viewDefinition(descriptor.logicalViewName).direction,
        facts
      );
      if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(descriptor)) {
        throw new RangeError("Decoded logical view does not reproduce its descriptor.");
      }
      this.#decodedViews.set(descriptor.logicalViewName, rebuilt);
      return rebuilt;
    } catch (error) {
      this.#failed = true;
      throw error;
    }
  }

  bindSeedManifest(manifestValue: Readonly<PreparedStructuralFireSeedManifest>): PreparedStructuralFireHash {
    if (this.#failed) throw new RangeError("Owner payload scope is terminally invalid.");
    if (this.#seedHash !== null) throw new RangeError("Seed manifest is already bound.");
    const manifest = validatePreparedStructuralFireSeedManifest(manifestValue);
    for (const descriptor of manifest.views) {
      const decoded = this.#decodedViews.get(descriptor.logicalViewName);
      if (decoded === undefined || canonicalAdaptiveJson(decoded) !== canonicalAdaptiveJson(descriptor)) {
        throw new RangeError(`Seed manifest does not bind decoded view ${descriptor.logicalViewName}.`);
      }
    }
    const seedHash = preparedStructuralFireSeedHash(manifest);
    this.#seedHash = seedHash;
    return seedHash;
  }

  forkSeed(): PreparedStructuralFireOwnerPayloadValidator {
    if (this.#failed || this.#seedHash === null || this.#seedAuthority === null
      || this.#expectedSeedCollision === null || this.#physicsWorld === null) {
      throw new RangeError("Prepared Fire seed is not complete.");
    }
    const fork = new PreparedStructuralFireOwnerPayloadValidator();
    fork.#seedAuthority = this.#seedAuthority;
    fork.#expectedSeedCollision = this.#expectedSeedCollision;
    fork.#physicsWorld = this.#physicsWorld;
    fork.#seedHash = this.#seedHash;
    for (const [key, value] of this.#bodySources) fork.#bodySources.set(key, value);
    for (const [key, value] of this.#physicsImmutable) fork.#physicsImmutable.set(key, value);
    for (const [key, value] of this.#physicsBodies) fork.#physicsBodies.set(key, value);
    for (const [name, descriptor] of this.#decodedViews) {
      if (name.startsWith("seed.")) fork.#decodedViews.set(name, descriptor);
    }
    return fork;
  }

  bindCommand(
    commandValue: Readonly<PreparedStructuralFireCommand>
  ): Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }> {
    if (this.#prepared !== null) throw new RangeError("Prepared Fire command is already bound.");
    const command = validatePreparedStructuralFireCommand(commandValue);
    if (this.#seedHash === null || command.seedHash !== this.#seedHash) {
      throw new RangeError("Prepared Fire command does not bind the decoded seed manifest.");
    }
    const authority = this.#requireSeedAuthority();
    if (this.#expectedSeedCollision === null) throw new RangeError("Seed collision is missing.");
    if (this.#physicsWorld === null) throw new RangeError("Physics World facts are missing.");
    const bodyIds = [...this.#bodySources.keys()].sort(compareCanonicalCodeUnits);
    if (bodyIds.length !== this.#physicsImmutable.size || bodyIds.length !== this.#physicsBodies.size) {
      throw new RangeError("Prepared physics body-key sets must be identical.");
    }
    const candidates: SurfaceRigidBodyCandidate[] = [];
    const bodySources: SurfaceTreePreparedExistingBodySourceFacts[] = [];
    for (const bodyId of bodyIds) {
      const immutable = this.#physicsImmutable.get(bodyId);
      const dynamic = this.#physicsBodies.get(bodyId);
      const source = this.#bodySources.get(bodyId)!;
      if (immutable === undefined || dynamic === undefined) {
        throw new RangeError("Prepared physics body facts are incomplete.");
      }
      const candidate = deriveSurfaceTreePreparedExistingBodyCandidate(
        source,
        immutable,
        dynamic.candidateInitial
      );
      validateSurfaceRigidBodyColliderRepresentation(candidate);
      candidates.push(candidate);
      bodySources.push(Object.freeze({
        sourceObject: source.sourceObject,
        component: source.component,
        fragment: source.fragment,
        massProperties: source.massProperties,
        candidate,
        meshArtifactIsLazy: true
      }));
    }
    const physicsWorld = this.#physicsWorld.physicsFailure === null
      && this.#physicsBodies.size === 0
      ? Object.freeze({ ...this.#physicsWorld, simulationTick: command.simulationTick })
      : this.#physicsWorld;
    const world = validateSurfaceRigidBodyWorldTransport(
      physicsWorld,
      bodyIds.map((bodyId) => this.#physicsBodies.get(bodyId)!),
      candidates
    );
    assertSurfaceTreePreparedBodySourceLifecycle(bodySources, world, bodySources);
    const prepared = prepareSurfaceTreeFire({
      authority,
      collision: validateSurfaceTreeCollisionSnapshotTransport(
        authority,
        this.#expectedSeedCollision
      ),
      physicsWorld: world,
      bodySources,
      fireCommandId: command.fireCommandId,
      hit: command.hit as Parameters<typeof prepareSurfaceTreeFire>[0]["hit"],
      simulationTick: command.simulationTick
    });
    if (prepared.status !== "Ready") {
      throw new RangeError("Prepared Fire command does not yield a Ready private derivation.");
    }
    this.#prepared = prepared;
    this.#command = command;
    this.#damageAuthority = deriveSurfaceTreeAuthority(authority.tree, prepared.damageResult.object);
    return prepared;
  }

  createTransaction(value: Readonly<{
    readonly request: PreparedStructuralFireRequest;
    readonly manifest: PreparedStructuralFireResultManifest;
    readonly dispatchIndex: number;
    readonly attemptIndex: number;
    readonly terminalJobId: string;
    readonly previousChainHash: PreparedStructuralFireHash;
    readonly terminalContinuation: PreparedStructuralFireContinuationCursor;
  }>): PreparedDerivationTransaction {
    const prepared = this.#prepared;
    const command = this.#command;
    const sourceAuthority = this.#seedAuthority;
    const sourceCollision = this.#expectedSeedCollision;
    if (prepared === null || command === null || sourceAuthority === null || sourceCollision === null) {
      throw new RangeError("Owner-validated seed and result facts are incomplete.");
    }
    const request = validatePreparedStructuralFireRequest(value.request);
    const manifest = validatePreparedStructuralFireResultManifest(request, value.manifest);
    for (const descriptor of manifest.views) {
      const decoded = this.#decodedViews.get(descriptor.logicalViewName);
      if (decoded === undefined || canonicalAdaptiveJson(decoded) !== canonicalAdaptiveJson(descriptor)) {
        throw new RangeError(`Result manifest does not bind decoded view ${descriptor.logicalViewName}.`);
      }
    }
    validatePreparedStructuralFireJobId(
      request,
      value.dispatchIndex,
      value.attemptIndex,
      value.terminalJobId
    );
    if (request.seedHash !== command.seedHash || request.commandHash !== command.commandHash) {
      throw new RangeError("Prepared request does not bind the owner-validated command.");
    }
    const byName = (name: PreparedStructuralFireLogicalViewName) => {
      const descriptor = manifest.views.find((candidate) => candidate.logicalViewName === name);
      if (descriptor === undefined) throw new RangeError(`Missing result descriptor ${name}.`);
      return descriptor;
    };
    const bodyDescriptor = byName("result.bodyPlan");
    const bodyIds = prepared.newBodySourcePlans.map((source) => source.candidate.bodyId);
    const bodyPlan = createPreparedStructuralFireBodyPlan(
      bodyIds,
      bodyDescriptor.logicalViewRoot,
      new Set(this.#bodySources.keys())
    );
    const detachedDescriptor = byName("result.detachedFacts");
    if (detachedDescriptor.itemCount !== prepared.detachedFacts.length
      || bodyDescriptor.itemCount !== bodyIds.length) {
      throw new RangeError("Prepared result descriptors do not bind owner-derived set counts.");
    }
    const sourceFragmentIds = prepared.detachedFacts.map((facts) => facts.fragment.fragmentId);
    const collisionCellRoot = (collision: Readonly<SurfaceTreeCollisionSnapshot>) =>
      hashPreparedStructuralFireCanonical(
        "prepared-structural-fire/collision-cell-set/v1",
        collision.cells
      );
    const sourceBinding = {
      objectId: sourceCollision.binding.objectId,
      objectRevision: sourceCollision.binding.objectRevision,
      objectContentHash: sourceCollision.binding.objectContentHash as PreparedStructuralFireHash
    };
    const resultingBinding = {
      objectId: prepared.collision.binding.objectId,
      objectRevision: prepared.collision.binding.objectRevision,
      objectContentHash: prepared.collision.binding.objectContentHash as PreparedStructuralFireHash
    };
    let collision: PreparedStructuralFireCollisionResult;
    if (prepared.damageResult.status === "NoChange") {
      collision = validatePreparedStructuralFireCollisionResult({
        schemaVersion: PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION,
        kind: "NoGeometryChange",
        sourceBinding,
        resultingBinding,
        unchangedCellSetRoot: collisionCellRoot(sourceCollision),
        sourceCollisionCommitmentHash: sourceCollision.contentHash as PreparedStructuralFireHash,
        resultingCollisionCommitmentHash: prepared.collision.contentHash as PreparedStructuralFireHash
      });
    } else {
      const sourceByKey = new Map(sourceCollision.cells.map((cell) => [
        serializeStructuralCellAddress(cell.address),
        cell
      ] as const));
      const resultByKey = new Map(prepared.collision.cells.map((cell) => [
        serializeStructuralCellAddress(cell.address),
        cell
      ] as const));
      const removedCellKeys = [...sourceByKey.keys()]
        .filter((key) => !resultByKey.has(key))
        .sort(compareCanonicalCodeUnits);
      const upsertedCells = [...resultByKey.entries()]
        .filter(([key, cell]) => canonicalAdaptiveJson(sourceByKey.get(key)) !== canonicalAdaptiveJson(cell))
        .sort(([left], [right]) => compareCanonicalCodeUnits(left, right))
        .map(([, cell]) => cell);
      collision = validatePreparedStructuralFireCollisionResult({
        schemaVersion: PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION,
        kind: "Delta",
        sourceBinding,
        sourceCellSetRoot: collisionCellRoot(sourceCollision),
        removedCellKeys,
        upsertedCells,
        resultingBinding,
        resultingCellSetRoot: collisionCellRoot(prepared.collision),
        resultingCollisionCommitmentHash: prepared.collision.contentHash as PreparedStructuralFireHash
      });
    }
    const expectedGlobalOrdinal = manifest.views.reduce((count, descriptor) =>
      safeAdd(count, descriptor.itemCount, "terminal global ordinal"), 0);
    const terminalContinuation = createPreparedStructuralFireContinuationCursor({
      rootJobId: request.rootJobId,
      requestHash: request.requestHash,
      domain: "result.work",
      lastItemKey: "@",
      ordinal: 1,
      globalOrdinal: expectedGlobalOrdinal
    }, value.previousChainHash);
    if (canonicalAdaptiveJson(terminalContinuation)
      !== canonicalAdaptiveJson(value.terminalContinuation)) {
      throw new RangeError("Terminal continuation does not bind the completed result manifest.");
    }
    const transaction = publishPreparedDerivationTransaction({
      seedHash: request.seedHash,
      commandHash: request.commandHash,
      requestHash: request.requestHash,
      rootJobId: request.rootJobId,
      terminalJobId: value.terminalJobId,
      source: request.source,
      result: {
        objectId: prepared.finalAuthority.objectId,
        objectRevision: prepared.finalAuthority.objectRevision,
        editRevision: prepared.finalAuthority.editRevision,
        contentHash: prepared.finalAuthority.objectContentHash as PreparedStructuralFireHash
      },
      resultManifestHash: manifest.manifestHash,
      structuralCommandId: prepared.structuralCommandId,
      outcome: prepared.damageResult.status,
      supportResult: prepared.supportResult,
      bodyPlan,
      detachedComponentCount: prepared.detachedFacts.length,
      detachedComponentRoot: detachedDescriptor.logicalViewRoot,
      sourceFragmentCount: sourceFragmentIds.length,
      sourceFragmentRoot: hashPreparedStructuralFireCanonical(
        "prepared-structural-fire/source-fragment-set/v1",
        sourceFragmentIds
      ),
      newBodyCount: bodyIds.length,
      newBodyRoot: bodyDescriptor.logicalViewRoot,
      collision,
      terminalContinuation
    });
    ownerPreparedTransactions.add(transaction);
    return transaction;
  }

  #expectedSeedCollision: SurfaceTreeCollisionSnapshot | null = null;

  #requireSeedAuthority(): SurfaceTreeAuthoritySnapshot {
    if (this.#seedAuthority === null) throw new RangeError("Seed authority must be decoded first.");
    return this.#seedAuthority;
  }

  #expectedResultPayload(
    logicalViewName: PreparedStructuralFireLogicalViewName,
    key: string
  ): unknown {
    const prepared = this.#prepared;
    if (prepared === null) throw new RangeError("Prepared Fire command must be bound before result decoding.");
    const projection = createPreparedStructuralFireResultViewProjections(prepared)
      .find((candidate) => candidate.logicalViewName === logicalViewName);
    if (projection === undefined) throw new RangeError(`${logicalViewName} is not a result view.`);
    for (const item of projection.openItems()) {
      if (item.key === key) return item.payload;
    }
    return undefined;
  }
}

const assertItemKey = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  cardinality: PreparedStructuralFireCardinality,
  key: string
): void => {
  requireCanonicalString(key, `${logicalViewName}.key`);
  if (cardinality === "Singleton" && key !== "@") {
    throw new RangeError(`${logicalViewName} singleton key must be @.`);
  }
  if (cardinality === "OrderedSet" && key.length === 0) {
    throw new RangeError(`${logicalViewName} ordered-set keys must be non-empty.`);
  }
  if ((logicalViewName === "result.transferResult"
      || logicalViewName === "result.authorityTransfer")
    && key !== "@transfer") {
    throw new RangeError(`${logicalViewName} uses only @transfer.`);
  }
};

export type PreparedStructuralFirePayloadValidator = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  key: string,
  payload: unknown
) => unknown;

class PreparedStructuralFireRecordDecoder {
  readonly #logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly #payloadValidator: PreparedStructuralFirePayloadValidator;
  #header = "";
  #record: Omit<PreparedStructuralFireCanonicalItemRecord, "payload"> | null = null;
  #parser: PreparedStructuralFireCanonicalJsonParser | null = null;
  #payloadHash: PreparedStructuralFireHashAccumulator | null = null;
  #payload: unknown;
  #suffix = "";

  constructor(
    logicalViewName: PreparedStructuralFireLogicalViewName,
    payloadValidator: PreparedStructuralFirePayloadValidator
  ) {
    this.#logicalViewName = logicalViewName;
    this.#payloadValidator = payloadValidator;
  }

  write(text: string): void {
    let offset = 0;
    while (offset < text.length) {
      if (this.#record === null) {
        this.#header += text.slice(offset);
        const boundary = this.#header.indexOf(',"payload":');
        if (boundary < 0) {
          if (encoder.encode(this.#header).byteLength > 4_096) {
            throw new RangeError("Prepared Structural Fire item header exceeds its bounded control size.");
          }
          return;
        }
        const payloadOffset = boundary + ',"payload":'.length;
        const remainder = this.#header.slice(payloadOffset);
        this.#header = this.#header.slice(0, payloadOffset);
        this.#beginPayload();
        if (remainder.length > 0) this.write(remainder);
        return;
      }
      if (this.#parser !== null && !this.#parser.complete) {
        const consumed = this.#parser.write(text.slice(offset));
        const payloadText = text.slice(offset, offset + consumed);
        const payloadBytes = encoder.encode(payloadText);
        this.#payloadHash?.update(payloadBytes);
        offset += consumed;
        if (!this.#parser.complete) return;
        this.#payload = this.#parser.finish();
        this.#parser = null;
        continue;
      }
      this.#suffix += text.slice(offset);
      if (this.#suffix.length > 1) {
        throw new RangeError("Prepared Structural Fire record contains trailing content.");
      }
      return;
    }
  }

  finish(): PreparedStructuralFireCanonicalItemRecord {
    if (this.#record === null || this.#parser !== null || this.#suffix !== "}") {
      throw new RangeError("Prepared Structural Fire record must use RS/JSON/LF framing.");
    }
    const itemHash = this.#payloadHash?.finish();
    if (itemHash === undefined || itemHash !== this.#record.itemHash) {
      throw new RangeError("Prepared Structural Fire record payload commitment is invalid.");
    }
    const validatedPayload = this.#payloadValidator(
      this.#logicalViewName,
      this.#record.key,
      this.#payload
    );
    return Object.freeze({ ...this.#record, payload: validatedPayload });
  }

  #beginPayload(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(`${this.#header}null}`) as unknown;
    } catch {
      throw new RangeError("Prepared Structural Fire item header is invalid JSON.");
    }
    const record = canonicalRecord(parsed, "item");
    requireExactKeys(record, ["itemByteLength", "itemHash", "key", "payload"], "item");
    if (record.payload !== null || canonicalAdaptiveJson(record) !== `${this.#header}null}`) {
      throw new RangeError("Prepared Structural Fire item header is not canonical JSON.");
    }
    const itemByteLength = safeNonNegativeInteger(
      record.itemByteLength as number,
      "item.itemByteLength"
    );
    const itemHash = validateHash(record.itemHash as string, "item.itemHash");
    if (typeof record.key !== "string") throw new RangeError("item.key must be a string.");
    const definition = viewDefinition(this.#logicalViewName);
    assertItemKey(this.#logicalViewName, definition.cardinality, record.key);
    this.#record = Object.freeze({ itemByteLength, itemHash, key: record.key });
    this.#parser = new PreparedStructuralFireCanonicalJsonParser();
    this.#payloadHash = new PreparedStructuralFireHashAccumulator(
      `prepared-structural-fire/item/${this.#logicalViewName}/v1`,
      itemByteLength
    );
  }
}

export const decodePreparedStructuralFireItemChunks = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  chunks: Iterable<Uint8Array>,
  payloadValidator: PreparedStructuralFirePayloadValidator
): PreparedStructuralFireCanonicalItemRecord => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const record = new PreparedStructuralFireRecordDecoder(logicalViewName, payloadValidator);
  let started = false;
  let finished = false;
  for (const chunk of chunks) {
    const owned = chunk.slice();
    let offset = 0;
    if (!started) {
      if (owned[0] !== 0x1e) {
        throw new RangeError("Prepared Structural Fire record must start with RS.");
      }
      started = true;
      offset = 1;
    }
    const lf = owned.indexOf(0x0a, offset);
    try {
      if (lf >= 0) {
        record.write(decoder.decode(owned.subarray(offset, lf), { stream: true }));
        record.write(decoder.decode());
      } else {
        record.write(decoder.decode(owned.subarray(offset), { stream: true }));
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new RangeError("Prepared Structural Fire record contains malformed UTF-8.");
      }
      throw error;
    }
    if (lf >= 0) {
      if (lf !== owned.byteLength - 1) {
        throw new RangeError("Prepared Structural Fire item chunks contain trailing bytes.");
      }
      finished = true;
    }
  }
  if (!started || !finished) {
    if (started) {
      try {
        record.write(decoder.decode());
      } catch (error) {
        if (error instanceof TypeError) {
          throw new RangeError("Prepared Structural Fire record contains malformed UTF-8.");
        }
        throw error;
      }
    }
    throw new RangeError("Prepared Structural Fire record must use RS/JSON/LF framing.");
  }
  return record.finish();
};

interface LogicalViewFacts {
  readonly logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly cardinality: PreparedStructuralFireCardinality;
  readonly itemCount: number;
  readonly byteLength: number;
  readonly logicalViewRoot: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireItemSource {
  readonly key: string;
  readonly payloadByteLength: number;
  readonly itemHash: PreparedStructuralFireHash;
  readonly openPayload: () => Iterable<Uint8Array>;
}

const itemRecordPrefix = (
  key: string,
  payloadByteLength: number,
  itemHash: PreparedStructuralFireHash
): Uint8Array => encoder.encode(
  `{"itemByteLength":${payloadByteLength},"itemHash":${JSON.stringify(itemHash)},`
  + `"key":${JSON.stringify(key)},"payload":`
);

const streamCanonicalString = function* (value: string): Generator<Uint8Array> {
  requireCanonicalString(value, "canonical string");
  let chunk = '"';
  const flush = function* (): Generator<Uint8Array> {
    if (chunk.length > 0) {
      yield encoder.encode(chunk);
      chunk = "";
    }
  };
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22) chunk += '\\"';
    else if (code === 0x5c) chunk += "\\\\";
    else if (code === 0x08) chunk += "\\b";
    else if (code === 0x09) chunk += "\\t";
    else if (code === 0x0a) chunk += "\\n";
    else if (code === 0x0c) chunk += "\\f";
    else if (code === 0x0d) chunk += "\\r";
    else if (code < 0x20) chunk += `\\u${code.toString(16).padStart(4, "0")}`;
    else if (code >= 0xd800 && code <= 0xdbff) {
      chunk += value[index] + value[index + 1];
      index += 1;
    } else chunk += value[index];
    if (chunk.length >= 16_384) yield* flush();
  }
  chunk += '"';
  yield* flush();
};

const streamCanonicalPayload = function* (
  value: unknown,
  ancestors = new WeakSet<object>()
): Generator<Uint8Array> {
  if (value === null) {
    yield encoder.encode("null");
    return;
  }
  if (typeof value === "string") {
    yield* streamCanonicalString(value);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Canonical payload numbers must be finite.");
    yield encoder.encode(JSON.stringify(Object.is(value, -0) ? 0 : value));
    return;
  }
  if (typeof value === "boolean") {
    yield encoder.encode(value ? "true" : "false");
    return;
  }
  if (typeof value !== "object") throw new RangeError("Unsupported canonical payload value.");
  if (ancestors.has(value)) throw new RangeError("Canonical payloads must not contain cycles.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const array = requireDenseDataPropertyArray(value, "canonical payload", "InvalidCanonicalValue");
    yield encoder.encode("[");
    for (let index = 0; index < array.length; index += 1) {
      if (index > 0) yield encoder.encode(",");
      yield* streamCanonicalPayload(array[index], ancestors);
    }
    yield encoder.encode("]");
  } else {
    const record = requirePlainRecord(value, "canonical payload");
    yield encoder.encode("{");
    const keys = Object.keys(record).sort(compareCanonicalCodeUnits);
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) yield encoder.encode(",");
      yield* streamCanonicalString(keys[index]);
      yield encoder.encode(":");
      yield* streamCanonicalPayload(record[keys[index]], ancestors);
    }
    yield encoder.encode("}");
  }
  ancestors.delete(value);
};

export const createPreparedStructuralFireCanonicalItemSource = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  item: Readonly<PreparedStructuralFireCanonicalItem>
): PreparedStructuralFireItemSource => {
  const definition = viewDefinition(logicalViewName);
  assertItemKey(logicalViewName, definition.cardinality, item.key);
  assertViewPayloadShape(logicalViewName, item.key, item.payload);
  let payloadByteLength = 0;
  for (const fragment of streamCanonicalPayload(item.payload)) {
    payloadByteLength = safeAdd(payloadByteLength, fragment.byteLength, "item payload bytes");
  }
  const accumulator = new PreparedStructuralFireHashAccumulator(
    `prepared-structural-fire/item/${logicalViewName}/v1`,
    payloadByteLength
  );
  for (const fragment of streamCanonicalPayload(item.payload)) {
    accumulator.update(fragment);
  }
  return Object.freeze({
    key: item.key,
    payloadByteLength,
    itemHash: accumulator.finish(),
    openPayload: () => streamCanonicalPayload(item.payload)
  });
};

export const streamPreparedStructuralFireItem = function* (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  source: Readonly<PreparedStructuralFireItemSource>
): Generator<Uint8Array> {
  const definition = viewDefinition(logicalViewName);
  assertItemKey(logicalViewName, definition.cardinality, source.key);
  const payloadByteLength = safeNonNegativeInteger(
    source.payloadByteLength,
    "itemSource.payloadByteLength"
  );
  const itemHash = validateHash(source.itemHash, "itemSource.itemHash");
  yield Uint8Array.of(0x1e);
  yield itemRecordPrefix(source.key, payloadByteLength, itemHash);
  const accumulator = new PreparedStructuralFireHashAccumulator(
    `prepared-structural-fire/item/${logicalViewName}/v1`,
    payloadByteLength
  );
  let emitted = 0;
  for (const value of source.openPayload()) {
    const owned = value.slice();
    if (owned.byteLength === 0 || owned.byteLength > PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES) {
      throw new RangeError("Payload source fragments must contain 1..1 MiB owned bytes.");
    }
    emitted = safeAdd(emitted, owned.byteLength, "itemSource.emittedBytes");
    if (emitted > payloadByteLength) throw new RangeError("Payload source exceeds its committed length.");
    accumulator.update(owned);
    yield owned;
  }
  if (emitted !== payloadByteLength || accumulator.finish() !== itemHash) {
    throw new RangeError("Payload source does not reproduce its item commitment.");
  }
  yield Uint8Array.of(0x7d, 0x0a);
};

export class PreparedStructuralFireLogicalViewAccumulator {
  readonly #logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly #cardinality: PreparedStructuralFireCardinality;
  #itemCount = 0;
  #byteLength = 0;
  #tailHash: PreparedStructuralFireHash;
  #lastKey: string | null = null;
  #finished = false;

  constructor(logicalViewName: PreparedStructuralFireLogicalViewName) {
    const definition = viewDefinition(logicalViewName);
    this.#logicalViewName = logicalViewName;
    this.#cardinality = definition.cardinality;
    this.#tailHash = hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/logical-empty/v1",
      { logicalViewName }
    );
  }

  appendSource(source: Readonly<PreparedStructuralFireItemSource>): void {
    if (this.#finished) throw new RangeError("Logical view is already finished.");
    if (this.#cardinality === "Singleton" && this.#itemCount !== 0) {
      throw new RangeError("Singleton logical views contain exactly one item.");
    }
    if (this.#lastKey !== null && compareCanonicalCodeUnits(this.#lastKey, source.key) >= 0) {
      throw new RangeError("Ordered-set keys must be unique and strictly canonical.");
    }
    if ((this.#logicalViewName === "result.transferResult"
        || this.#logicalViewName === "result.authorityTransfer")
      && this.#itemCount !== 0) {
      throw new RangeError("Optional transfer views contain at most one item.");
    }
    const definition = viewDefinition(this.#logicalViewName);
    assertItemKey(this.#logicalViewName, definition.cardinality, source.key);
    const itemByteLength = safeNonNegativeInteger(
      source.payloadByteLength,
      "itemSource.payloadByteLength"
    );
    const itemHash = validateHash(source.itemHash, "itemSource.itemHash");
    const recordByteLength = safeAdd(
      safeAdd(1, itemRecordPrefix(source.key, itemByteLength, itemHash).byteLength, "record prefix"),
      safeAdd(itemByteLength, 2, "record suffix"),
      "record byte length"
    );
    const stepPayload = joinBytes(
      rawHashBytes(this.#tailHash),
      canonicalBytes({
        ordinal: this.#itemCount,
        key: source.key,
        itemHash
      })
    );
    this.#tailHash = hashPreparedStructuralFireBytes(
      "prepared-structural-fire/logical-step/v1",
      stepPayload
    );
    this.#byteLength = safeAdd(
      this.#byteLength,
      recordByteLength,
      "logical view byte length"
    );
    this.#lastKey = source.key;
    this.#itemCount = safeAdd(this.#itemCount, 1, "logical view item count");
  }

  finish(): LogicalViewFacts {
    if (this.#finished) throw new RangeError("Logical view is already finished.");
    if (this.#cardinality === "Singleton" && this.#itemCount !== 1) {
      throw new RangeError("Singleton logical views must contain exactly one item.");
    }
    this.#finished = true;
    return Object.freeze({
      logicalViewName: this.#logicalViewName,
      cardinality: this.#cardinality,
      itemCount: this.#itemCount,
      byteLength: this.#byteLength,
      logicalViewRoot: hashPreparedStructuralFireCanonical(
        "prepared-structural-fire/logical-root/v1",
        {
          logicalViewName: this.#logicalViewName,
          itemCount: this.#itemCount,
          tailHash: this.#tailHash
        }
      )
    });
  }
}

export const createPreparedStructuralFireLogicalViewFacts = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  openItems: () => Iterable<Readonly<PreparedStructuralFireItemSource>>
): Readonly<LogicalViewFacts> => {
  const accumulator = new PreparedStructuralFireLogicalViewAccumulator(logicalViewName);
  for (const item of openItems()) accumulator.appendSource(item);
  return accumulator.finish();
};

export const streamPreparedStructuralFireLogicalView = function* (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  openItems: () => Iterable<Readonly<PreparedStructuralFireItemSource>>
): Generator<Uint8Array> {
  for (const item of openItems()) yield* streamPreparedStructuralFireItem(logicalViewName, item);
};

export const preparedStructuralFirePageCount = (logicalByteLength: number): number => {
  const length = safeNonNegativeInteger(logicalByteLength, "logicalByteLength");
  return length === 0 ? 0 : Math.floor((length - 1) / PREPARED_STRUCTURAL_FIRE_PAGE_BYTES) + 1;
};

export const preparedStructuralFirePageRange = (
  logicalByteLength: number,
  pageIndexValue: number
): Readonly<{ readonly pageIndex: number; readonly byteOffset: number; readonly byteLength: number }> => {
  const length = safeNonNegativeInteger(logicalByteLength, "logicalByteLength");
  const pageIndex = safeNonNegativeInteger(pageIndexValue, "pageIndex");
  const pageCount = preparedStructuralFirePageCount(length);
  if (pageIndex >= pageCount) throw new RangeError("pageIndex is outside the logical view.");
  const byteOffset = pageIndex * PREPARED_STRUCTURAL_FIRE_PAGE_BYTES;
  if (!Number.isSafeInteger(byteOffset)) throw new RangeError("Page byte offset is unsafe.");
  const byteLength = Math.min(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES, length - byteOffset);
  if (byteLength <= 0) throw new RangeError("Page byte length must be positive.");
  return Object.freeze({ pageIndex, byteOffset, byteLength });
};

const pageHeaderCore = (header: Omit<PreparedStructuralFirePageHeader, "pageHash">) => ({
  schemaVersion: header.schemaVersion,
  direction: header.direction,
  logicalViewName: header.logicalViewName,
  pageIndex: header.pageIndex,
  byteOffset: header.byteOffset,
  byteLength: header.byteLength,
  logicalViewRoot: header.logicalViewRoot,
  pageBytesHash: header.pageBytesHash
});

export const createPreparedStructuralFirePageHeader = (
  logical: Readonly<LogicalViewFacts>,
  direction: PreparedStructuralFireDirection,
  pageIndex: number,
  bytes: Uint8Array
): PreparedStructuralFirePageHeader => {
  if (viewDefinition(logical.logicalViewName).direction !== direction) {
    throw new RangeError("Page direction does not match its logical view.");
  }
  const range = preparedStructuralFirePageRange(logical.byteLength, pageIndex);
  if (bytes.byteLength !== range.byteLength) {
    throw new RangeError("Page bytes do not match the canonical page range.");
  }
  const withoutHash = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION,
    direction,
    logicalViewName: logical.logicalViewName,
    pageIndex: range.pageIndex,
    byteOffset: range.byteOffset,
    byteLength: range.byteLength,
    logicalViewRoot: logical.logicalViewRoot,
    pageBytesHash: hashPreparedStructuralFireBytes(
      "prepared-structural-fire/page-bytes/v1",
      bytes
    )
  });
  return Object.freeze({
    ...withoutHash,
    pageHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/page/v1",
      withoutHash
    )
  });
};

export const validatePreparedStructuralFirePageHeader = (
  logicalByteLength: number,
  bytes: Uint8Array,
  value: Readonly<PreparedStructuralFirePageHeader>
): PreparedStructuralFirePageHeader => {
  const record = canonicalRecord(value, "page");
  requireExactKeys(record, [
    "schemaVersion",
    "direction",
    "logicalViewName",
    "pageIndex",
    "byteOffset",
    "byteLength",
    "logicalViewRoot",
    "pageBytesHash",
    "pageHash"
  ], "page");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION) {
    throw new RangeError("Unsupported page schema.");
  }
  const definition = viewDefinition(value.logicalViewName);
  if (definition.direction !== value.direction) throw new RangeError("Page direction is invalid.");
  const range = preparedStructuralFirePageRange(logicalByteLength, value.pageIndex);
  if (value.byteOffset !== range.byteOffset
    || value.byteLength !== range.byteLength
    || bytes.byteLength !== range.byteLength
    || validateHash(value.logicalViewRoot, "page.logicalViewRoot") !== value.logicalViewRoot
    || hashPreparedStructuralFireBytes("prepared-structural-fire/page-bytes/v1", bytes)
      !== value.pageBytesHash
    || hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/page/v1",
      pageHeaderCore(value)
    ) !== value.pageHash) {
    throw new RangeError("Page range or commitment is invalid.");
  }
  return value;
};

interface PhysicalPageFacts {
  readonly pageCount: number;
  readonly physicalPageRoot: PreparedStructuralFireHash;
}

export class PreparedStructuralFirePhysicalPageAccumulator {
  readonly #direction: PreparedStructuralFireDirection;
  readonly #logicalViewName: PreparedStructuralFireLogicalViewName;
  #pageCount = 0;
  #tailHash: PreparedStructuralFireHash;
  #finished = false;

  constructor(
    direction: PreparedStructuralFireDirection,
    logicalViewName: PreparedStructuralFireLogicalViewName
  ) {
    if (viewDefinition(logicalViewName).direction !== direction) {
      throw new RangeError("Physical page direction does not match its logical view.");
    }
    this.#direction = direction;
    this.#logicalViewName = logicalViewName;
    this.#tailHash = hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/physical-empty/v1",
      { direction, logicalViewName }
    );
  }

  append(header: Readonly<PreparedStructuralFirePageHeader>): void {
    if (this.#finished) throw new RangeError("Physical page root is already finished.");
    if (header.pageIndex !== this.#pageCount
      || header.direction !== this.#direction
      || header.logicalViewName !== this.#logicalViewName
      || header.pageHash !== hashPreparedStructuralFireCanonical(
        "prepared-structural-fire/page/v1",
        pageHeaderCore(header)
      )) {
      throw new RangeError("Physical page order or header commitment is invalid.");
    }
    this.#tailHash = hashPreparedStructuralFireBytes(
      "prepared-structural-fire/physical-step/v1",
      joinBytes(
        rawHashBytes(this.#tailHash),
        canonicalBytes({ pageIndex: this.#pageCount, pageHash: header.pageHash })
      )
    );
    this.#pageCount = safeAdd(this.#pageCount, 1, "physical page count");
  }

  finish(): PhysicalPageFacts {
    if (this.#finished) throw new RangeError("Physical page root is already finished.");
    this.#finished = true;
    return Object.freeze({
      pageCount: this.#pageCount,
      physicalPageRoot: hashPreparedStructuralFireCanonical(
        "prepared-structural-fire/physical-root/v1",
        {
          schemaVersion: PREPARED_STRUCTURAL_FIRE_PHYSICAL_PAGE_ROOT_SCHEMA_VERSION,
          direction: this.#direction,
          logicalViewName: this.#logicalViewName,
          pageCount: this.#pageCount,
          tailHash: this.#tailHash
        }
      )
    });
  }
}

export const streamPreparedStructuralFirePages = function* (
  logical: Readonly<LogicalViewFacts>,
  direction: PreparedStructuralFireDirection,
  openLogicalBytes: () => Iterable<Uint8Array>
): Generator<Readonly<{ readonly header: PreparedStructuralFirePageHeader; readonly bytes: Uint8Array }>> {
  if (viewDefinition(logical.logicalViewName).direction !== direction) {
    throw new RangeError("Page direction does not match its logical view.");
  }
  let page = new Uint8Array(Math.min(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES, logical.byteLength));
  let pageOffset = 0;
  let pageIndex = 0;
  let totalBytes = 0;
  for (const sourceBytes of openLogicalBytes()) {
    const owned = sourceBytes.slice();
    if (owned.byteLength === 0 || owned.byteLength > PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES) {
      throw new RangeError("Logical byte chunks must contain 1..1 MiB owned bytes.");
    }
    let sourceOffset = 0;
    while (sourceOffset < owned.byteLength) {
      const copyLength = Math.min(page.byteLength - pageOffset, owned.byteLength - sourceOffset);
      page.set(owned.subarray(sourceOffset, sourceOffset + copyLength), pageOffset);
      pageOffset += copyLength;
      sourceOffset += copyLength;
      totalBytes = safeAdd(totalBytes, copyLength, "logical emitted byte length");
      if (totalBytes > logical.byteLength) {
        throw new RangeError("Logical byte source exceeds its committed length.");
      }
      if (pageOffset === page.byteLength) {
        const bytes = page;
        yield Object.freeze({
          header: createPreparedStructuralFirePageHeader(logical, direction, pageIndex, bytes),
          bytes
        });
        pageIndex += 1;
        const remaining = logical.byteLength - totalBytes;
        page = new Uint8Array(Math.min(PREPARED_STRUCTURAL_FIRE_PAGE_BYTES, remaining));
        pageOffset = 0;
      }
    }
  }
  if (totalBytes !== logical.byteLength || pageOffset !== 0) {
    throw new RangeError("Logical byte source is incomplete.");
  }
  if (pageIndex !== preparedStructuralFirePageCount(logical.byteLength)) {
    throw new RangeError("Logical byte source produced an invalid page count.");
  }
};

export const createPreparedStructuralFirePhysicalPageFacts = (
  logical: Readonly<LogicalViewFacts>,
  direction: PreparedStructuralFireDirection,
  openLogicalBytes: () => Iterable<Uint8Array>
): PhysicalPageFacts => {
  const accumulator = new PreparedStructuralFirePhysicalPageAccumulator(
    direction,
    logical.logicalViewName
  );
  for (const page of streamPreparedStructuralFirePages(logical, direction, openLogicalBytes)) {
    accumulator.append(page.header);
  }
  return accumulator.finish();
};

export const createPreparedStructuralFireLogicalViewDescriptor = (
  viewOrdinal: number,
  logical: Readonly<LogicalViewFacts>,
  direction: PreparedStructuralFireDirection,
  physical: Readonly<PhysicalPageFacts>
): PreparedStructuralFireLogicalViewDescriptor => {
  safeNonNegativeInteger(viewOrdinal, "viewOrdinal");
  const pageCount = preparedStructuralFirePageCount(logical.byteLength);
  if (viewDefinition(logical.logicalViewName).direction !== direction) {
    throw new RangeError("Logical view descriptor direction is invalid.");
  }
  if (physical.pageCount !== pageCount) throw new RangeError("Physical page count is invalid.");
  const physicalPageRoot = validateHash(physical.physicalPageRoot, "physicalPageRoot");
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_ROOT_SCHEMA_VERSION,
    viewOrdinal,
    logicalViewName: logical.logicalViewName,
    cardinality: logical.cardinality,
    itemCount: logical.itemCount,
    byteLength: logical.byteLength,
    logicalViewRoot: logical.logicalViewRoot,
    pageCount,
    physicalPageRoot
  });
};

export class PreparedStructuralFireLogicalViewPageDecoder {
  readonly #descriptor: Readonly<PreparedStructuralFireLogicalViewDescriptor>;
  readonly #payloadValidator: PreparedStructuralFirePayloadValidator;
  readonly #logical: PreparedStructuralFireLogicalViewAccumulator;
  readonly #physical: PreparedStructuralFirePhysicalPageAccumulator;
  #nextPageIndex = 0;
  #totalBytes = 0;
  #decoder: TextDecoder | null = null;
  #record: PreparedStructuralFireRecordDecoder | null = null;
  #finished = false;

  constructor(
    descriptor: Readonly<PreparedStructuralFireLogicalViewDescriptor>,
    payloadValidator: PreparedStructuralFirePayloadValidator
  ) {
    this.#descriptor = descriptor;
    this.#payloadValidator = payloadValidator;
    this.#logical = new PreparedStructuralFireLogicalViewAccumulator(descriptor.logicalViewName);
    this.#physical = new PreparedStructuralFirePhysicalPageAccumulator(
      viewDefinition(descriptor.logicalViewName).direction,
      descriptor.logicalViewName
    );
  }

  appendPage(
    value: Readonly<{ readonly header: PreparedStructuralFirePageHeader; readonly bytes: Uint8Array }>
  ): void {
    if (this.#finished) throw new RangeError("Logical page stream is already finished.");
    const bytes = value.bytes.slice();
    const header = validatePreparedStructuralFirePageHeader(
      this.#descriptor.byteLength,
      bytes,
      value.header
    );
    if (header.pageIndex !== this.#nextPageIndex) {
      throw new RangeError("Logical pages must be drained in contiguous page order.");
    }
    if (header.logicalViewName !== this.#descriptor.logicalViewName
      || header.logicalViewRoot !== this.#descriptor.logicalViewRoot) {
      throw new RangeError("Page does not belong to its logical descriptor.");
    }
    this.#physical.append(header);
    this.#nextPageIndex += 1;
    this.#totalBytes = safeAdd(this.#totalBytes, bytes.byteLength, "decoded logical bytes");
    let offset = 0;
    while (offset < bytes.byteLength) {
      if (this.#record === null) {
        if (bytes[offset] !== 0x1e) {
          throw new RangeError("Prepared Structural Fire record must start with RS.");
        }
        this.#decoder = new TextDecoder("utf-8", { fatal: true });
        this.#record = new PreparedStructuralFireRecordDecoder(
          this.#descriptor.logicalViewName,
          this.#payloadValidator
        );
        offset += 1;
      }
      const lf = bytes.indexOf(0x0a, offset);
      const boundary = lf < 0 ? bytes.byteLength : lf;
      while (offset < boundary) {
        const fragmentEnd = Math.min(
          boundary,
          offset + PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES
        );
        let text: string;
        try {
          text = this.#decoder!.decode(bytes.subarray(offset, fragmentEnd), { stream: true });
        } catch {
          throw new RangeError("Prepared Structural Fire record contains malformed UTF-8.");
        }
        this.#record.write(text);
        offset = fragmentEnd;
      }
      if (lf < 0) continue;
      try {
        this.#record.write(this.#decoder!.decode());
      } catch {
        throw new RangeError("Prepared Structural Fire record contains malformed UTF-8.");
      }
      const decoded = this.#record.finish();
      this.#logical.appendSource(Object.freeze({
        key: decoded.key,
        payloadByteLength: decoded.itemByteLength,
        itemHash: decoded.itemHash,
        openPayload: () => []
      }));
      this.#decoder = null;
      this.#record = null;
      offset = lf + 1;
    }
  }

  finish(): Readonly<LogicalViewFacts & PhysicalPageFacts> {
    if (this.#finished) throw new RangeError("Logical page stream is already finished.");
    this.#finished = true;
    if (this.#record !== null || this.#decoder !== null) {
      throw new RangeError("Logical page stream ends with an incomplete record.");
    }
    if (this.#nextPageIndex !== this.#descriptor.pageCount
      || this.#totalBytes !== this.#descriptor.byteLength) {
      throw new RangeError("Logical page stream is incomplete.");
    }
    const logical = this.#logical.finish();
    const physical = this.#physical.finish();
    if (logical.itemCount !== this.#descriptor.itemCount
      || logical.byteLength !== this.#descriptor.byteLength
      || logical.logicalViewRoot !== this.#descriptor.logicalViewRoot
      || physical.pageCount !== this.#descriptor.pageCount
      || physical.physicalPageRoot !== this.#descriptor.physicalPageRoot) {
      throw new RangeError("Logical or physical page commitment is invalid.");
    }
    return Object.freeze({ ...logical, ...physical });
  }
}

export const validatePreparedStructuralFirePageSequence = (
  descriptor: Readonly<PreparedStructuralFireLogicalViewDescriptor>,
  pages: Iterable<Readonly<{ readonly header: PreparedStructuralFirePageHeader; readonly bytes: Uint8Array }>>,
  payloadValidator: PreparedStructuralFirePayloadValidator
): Readonly<LogicalViewFacts & PhysicalPageFacts> => {
  const decoder = new PreparedStructuralFireLogicalViewPageDecoder(descriptor, payloadValidator);
  for (const page of pages) decoder.appendPage(page);
  return decoder.finish();
};

const viewDescriptorCore = (value: Readonly<PreparedStructuralFireLogicalViewDescriptor>) => ({
  schemaVersion: value.schemaVersion,
  viewOrdinal: value.viewOrdinal,
  logicalViewName: value.logicalViewName,
  cardinality: value.cardinality,
  itemCount: value.itemCount,
  byteLength: value.byteLength,
  logicalViewRoot: value.logicalViewRoot,
  pageCount: value.pageCount,
  physicalPageRoot: value.physicalPageRoot
});

const validateManifestViews = (
  direction: PreparedStructuralFireDirection,
  values: readonly Readonly<PreparedStructuralFireLogicalViewDescriptor>[]
): readonly PreparedStructuralFireLogicalViewDescriptor[] => {
  const names = direction === "Seed"
    ? PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES
    : PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES;
  if (values.length !== names.length) throw new RangeError("Manifest view count is invalid.");
  return Object.freeze(values.map((value, index) => {
    const record = canonicalRecord(value, `views/${index}`);
    requireExactKeys(record, [
      "schemaVersion",
      "viewOrdinal",
      "logicalViewName",
      "cardinality",
      "itemCount",
      "byteLength",
      "logicalViewRoot",
      "pageCount",
      "physicalPageRoot"
    ], `views/${index}`);
    const definition = viewDefinition(value.logicalViewName);
    if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_ROOT_SCHEMA_VERSION
      || value.viewOrdinal !== index
      || value.logicalViewName !== names[index]
      || definition.direction !== direction
      || value.cardinality !== definition.cardinality
      || safeNonNegativeInteger(value.itemCount, `views/${index}.itemCount`) !== value.itemCount
      || safeNonNegativeInteger(value.byteLength, `views/${index}.byteLength`) !== value.byteLength
      || value.pageCount !== preparedStructuralFirePageCount(value.byteLength)
      || (value.cardinality === "Singleton" && value.itemCount !== 1)
      || validateHash(value.logicalViewRoot, `views/${index}.logicalViewRoot`) !== value.logicalViewRoot
      || validateHash(value.physicalPageRoot, `views/${index}.physicalPageRoot`)
        !== value.physicalPageRoot) {
      throw new RangeError("Manifest view descriptor is invalid.");
    }
    return Object.freeze({ ...value });
  }));
};

export const createPreparedStructuralFireSeedManifest = (
  viewsValue: readonly Readonly<PreparedStructuralFireLogicalViewDescriptor>[]
): PreparedStructuralFireSeedManifest => {
  const views = validateManifestViews("Seed", viewsValue);
  const core = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_SEED_MANIFEST_SCHEMA_VERSION,
    wireSchemaVersion: PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION,
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2,
    views: views.map(viewDescriptorCore)
  });
  return ownCanonical({
    ...core,
    manifestHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/seed-manifest/v1",
      core
    )
  });
};

export const validatePreparedStructuralFireSeedManifest = (
  value: Readonly<PreparedStructuralFireSeedManifest>
): PreparedStructuralFireSeedManifest => {
  const record = canonicalRecord(value, "seedManifest");
  requireExactKeys(record, [
    "schemaVersion",
    "wireSchemaVersion",
    "algorithmVersion",
    "views",
    "manifestHash"
  ], "seedManifest");
  const rebuilt = createPreparedStructuralFireSeedManifest(value.views);
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)) {
    throw new RangeError("Seed manifest commitment is invalid.");
  }
  return rebuilt;
};

export const preparedStructuralFireSeedHash = (
  manifest: Readonly<PreparedStructuralFireSeedManifest>
): PreparedStructuralFireHash => hashPreparedStructuralFireCanonical(
  "prepared-structural-fire/seed/v1",
  { seedManifestHash: validatePreparedStructuralFireSeedManifest(manifest).manifestHash }
);

const commandCore = (value: Omit<PreparedStructuralFireCommand, "commandHash">) => ({
  schemaVersion: value.schemaVersion,
  seedHash: value.seedHash,
  fireCommandId: value.fireCommandId,
  structuralCommandId: value.structuralCommandId,
  hit: value.hit,
  simulationTick: value.simulationTick
});

export const createPreparedStructuralFireCommand = (
  value: Omit<PreparedStructuralFireCommand, "schemaVersion" | "commandHash">
): PreparedStructuralFireCommand => {
  validateHash(value.seedHash, "command.seedHash");
  const core = ownCanonical(commandCore({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_COMMAND_SCHEMA_VERSION,
    seedHash: value.seedHash,
    fireCommandId: stableAuthorityId(value.fireCommandId, "command.fireCommandId"),
    structuralCommandId: stableAuthorityId(
      value.structuralCommandId,
      "command.structuralCommandId"
    ),
    hit: value.hit,
    simulationTick: safeNonNegativeInteger(value.simulationTick, "command.simulationTick")
  }));
  return deepFreeze({
    ...core,
    commandHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/command/v1",
      core
    )
  });
};

export const validatePreparedStructuralFireCommand = (
  value: Readonly<PreparedStructuralFireCommand>
): PreparedStructuralFireCommand => {
  const record = canonicalRecord(value, "command");
  requireExactKeys(record, [
    "schemaVersion",
    "seedHash",
    "fireCommandId",
    "structuralCommandId",
    "hit",
    "simulationTick",
    "commandHash"
  ], "command");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_COMMAND_SCHEMA_VERSION) {
    throw new RangeError("Command schema is invalid.");
  }
  const rebuilt = createPreparedStructuralFireCommand({
    seedHash: value.seedHash,
    fireCommandId: value.fireCommandId,
    structuralCommandId: value.structuralCommandId,
    hit: value.hit,
    simulationTick: value.simulationTick
  });
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)) {
    throw new RangeError("Command commitment is invalid.");
  }
  return rebuilt;
};

export const preparedStructuralFireRootJobId = (
  seedHash: PreparedStructuralFireHash,
  commandHash: PreparedStructuralFireHash,
  callerNonce: string
): string => {
  validateHash(seedHash, "seedHash");
  validateHash(commandHash, "commandHash");
  if (!CALLER_NONCE_PATTERN.test(callerNonce)) throw new RangeError("callerNonce is invalid.");
  const digest = hashPreparedStructuralFireCanonical(
    "prepared-structural-fire/root-job-id/v1",
    { seedHash, commandHash, callerNonce }
  );
  return `psf-root-v1:${hashHex(digest)}`;
};

const sourceIdentity = (
  value: Readonly<PreparedStructuralFireSourceIdentity>,
  path: string
): PreparedStructuralFireSourceIdentity => Object.freeze({
  objectId: stableAuthorityId(value.objectId, `${path}.objectId`),
  objectRevision: safeNonNegativeInteger(value.objectRevision, `${path}.objectRevision`),
  editRevision: safeNonNegativeInteger(value.editRevision, `${path}.editRevision`),
  contentHash: validateHash(value.contentHash, `${path}.contentHash`)
});

const REQUEST_LEVELS = Object.freeze([
  "ExactBoxes",
  "SparseBoxes",
  "HierarchicalBounds",
  "AdaptiveCoarse"
] as const);

const requestCore = (value: Omit<PreparedStructuralFireRequest, "requestHash">) => ({
  schemaVersion: value.schemaVersion,
  wireSchemaVersion: value.wireSchemaVersion,
  algorithmVersion: value.algorithmVersion,
  seedHash: value.seedHash,
  commandHash: value.commandHash,
  callerNonce: value.callerNonce,
  rootJobId: value.rootJobId,
  source: value.source,
  activationTick: value.activationTick,
  deadlineTick: value.deadlineTick,
  physicsRepresentationPolicy: value.physicsRepresentationPolicy
});

export const createPreparedStructuralFireRequest = (
  value: Readonly<{
    readonly seedHash: PreparedStructuralFireHash;
    readonly commandHash: PreparedStructuralFireHash;
    readonly callerNonce: string;
    readonly source: Readonly<PreparedStructuralFireSourceIdentity>;
    readonly activationTick: number;
    readonly deadlineTick: number;
  }>
): PreparedStructuralFireRequest => {
  validateHash(value.seedHash, "request.seedHash");
  validateHash(value.commandHash, "request.commandHash");
  if (!CALLER_NONCE_PATTERN.test(value.callerNonce)) throw new RangeError("callerNonce is invalid.");
  const rootJobId = preparedStructuralFireRootJobId(
    value.seedHash,
    value.commandHash,
    value.callerNonce
  );
  const activationTick = safeNonNegativeInteger(value.activationTick, "request.activationTick");
  const deadlineTick = safeNonNegativeInteger(value.deadlineTick, "request.deadlineTick");
  if (deadlineTick < activationTick) throw new RangeError("Request deadline precedes activation.");
  const core = ownCanonical(requestCore({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_REQUEST_SCHEMA_VERSION,
    wireSchemaVersion: PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION,
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2,
    seedHash: value.seedHash,
    commandHash: value.commandHash,
    callerNonce: value.callerNonce,
    rootJobId,
    source: sourceIdentity(value.source, "request.source"),
    activationTick,
    deadlineTick,
    physicsRepresentationPolicy: Object.freeze({
      authorityResolution: "ExactStructural" as const,
      allowedLevels: REQUEST_LEVELS
    })
  }));
  return ownCanonical({
    ...core,
    requestHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/request/v2",
      core
    )
  });
};

export const validatePreparedStructuralFireRequest = (
  value: Readonly<PreparedStructuralFireRequest>
): PreparedStructuralFireRequest => {
  const record = canonicalRecord(value, "request");
  requireExactKeys(record, [
    "schemaVersion",
    "wireSchemaVersion",
    "algorithmVersion",
    "seedHash",
    "commandHash",
    "callerNonce",
    "rootJobId",
    "source",
    "activationTick",
    "deadlineTick",
    "physicsRepresentationPolicy",
    "requestHash"
  ], "request");
  const source = canonicalRecord(value.source, "request.source");
  requireExactKeys(source, ["objectId", "objectRevision", "editRevision", "contentHash"], "request.source");
  const policy = canonicalRecord(
    value.physicsRepresentationPolicy,
    "request.physicsRepresentationPolicy"
  );
  requireExactKeys(policy, ["authorityResolution", "allowedLevels"], "request.physicsRepresentationPolicy");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_REQUEST_SCHEMA_VERSION
    || value.wireSchemaVersion !== PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION
    || value.algorithmVersion !== PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2
    || value.physicsRepresentationPolicy.authorityResolution !== "ExactStructural"
    || canonicalAdaptiveJson(value.physicsRepresentationPolicy.allowedLevels)
      !== canonicalAdaptiveJson(REQUEST_LEVELS)) {
    throw new RangeError("Request version or representation policy is invalid.");
  }
  const rebuilt = createPreparedStructuralFireRequest({
    seedHash: value.seedHash,
    commandHash: value.commandHash,
    callerNonce: value.callerNonce,
    source: value.source,
    activationTick: value.activationTick,
    deadlineTick: value.deadlineTick
  });
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)) {
    throw new RangeError("Request commitment is invalid.");
  }
  return rebuilt;
};

export const preparedStructuralFireJobId = (
  request: Readonly<PreparedStructuralFireRequest>,
  dispatchIndexValue: number,
  attemptIndexValue: number
): string => {
  if (!ROOT_JOB_PATTERN.test(request.rootJobId)) throw new RangeError("rootJobId is invalid.");
  validateHash(request.requestHash, "requestHash");
  const dispatchIndex = safeNonNegativeInteger(dispatchIndexValue, "dispatchIndex");
  const attemptIndex = safeNonNegativeInteger(attemptIndexValue, "attemptIndex");
  const digest = hashPreparedStructuralFireCanonical(
    "prepared-structural-fire/job-id/v1",
    { rootJobId: request.rootJobId, requestHash: request.requestHash, dispatchIndex, attemptIndex }
  );
  return `psf-job-v1:${hashHex(digest)}`;
};

export const validatePreparedStructuralFireJobId = (
  request: Readonly<PreparedStructuralFireRequest>,
  dispatchIndex: number,
  attemptIndex: number,
  value: string
): string => {
  if (!JOB_PATTERN.test(value)
    || value !== preparedStructuralFireJobId(request, dispatchIndex, attemptIndex)) {
    throw new RangeError("Prepared Structural Fire jobId commitment is invalid.");
  }
  return value;
};

export const preparedStructuralFireReplicaKey = (
  workerEpochValue: number,
  seedHash: PreparedStructuralFireHash
): PreparedStructuralFireHash => hashPreparedStructuralFireCanonical(
  "prepared-structural-fire/replica-key/v1",
  {
    workerEpoch: safeNonNegativeInteger(workerEpochValue, "workerEpoch"),
    seedHash: validateHash(seedHash, "seedHash")
  }
);

export const createPreparedStructuralFirePageEnvelope = (
  request: Readonly<PreparedStructuralFireRequest>,
  workerEpochValue: number,
  header: Readonly<PreparedStructuralFirePageHeader>,
  bytes: Uint8Array
): PreparedStructuralFirePageEnvelope => {
  const workerEpoch = safeNonNegativeInteger(workerEpochValue, "workerEpoch");
  const headerRecord = canonicalRecord(header, "pageEnvelope.header");
  requireExactKeys(headerRecord, [
    "schemaVersion", "direction", "logicalViewName", "pageIndex", "byteOffset",
    "byteLength", "logicalViewRoot", "pageBytesHash", "pageHash"
  ], "pageEnvelope.header");
  const ownedHeader = deepFreeze({
    schemaVersion: header.schemaVersion,
    direction: header.direction,
    logicalViewName: header.logicalViewName,
    pageIndex: safeNonNegativeInteger(header.pageIndex, "pageEnvelope.header.pageIndex"),
    byteOffset: safeNonNegativeInteger(header.byteOffset, "pageEnvelope.header.byteOffset"),
    byteLength: safeNonNegativeInteger(header.byteLength, "pageEnvelope.header.byteLength"),
    logicalViewRoot: validateHash(header.logicalViewRoot, "pageEnvelope.header.logicalViewRoot"),
    pageBytesHash: validateHash(header.pageBytesHash, "pageEnvelope.header.pageBytesHash"),
    pageHash: validateHash(header.pageHash, "pageEnvelope.header.pageHash")
  });
  const ownedBytes = bytes.slice();
  const definition = viewDefinition(ownedHeader.logicalViewName);
  const expectedByteOffset = ownedHeader.pageIndex * PREPARED_STRUCTURAL_FIRE_PAGE_BYTES;
  if (!ROOT_JOB_PATTERN.test(request.rootJobId)) throw new RangeError("rootJobId is invalid.");
  if (request.requestHash !== validateHash(request.requestHash, "requestHash")) {
    throw new RangeError("requestHash is invalid.");
  }
  if (ownedHeader.schemaVersion !== PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION
    || definition.direction !== ownedHeader.direction
    || !Number.isSafeInteger(expectedByteOffset)
    || ownedHeader.byteOffset !== expectedByteOffset
    || ownedHeader.byteLength <= 0
    || ownedHeader.byteLength > PREPARED_STRUCTURAL_FIRE_PAGE_BYTES
    || ownedBytes.byteLength !== ownedHeader.byteLength
    || ownedHeader.pageBytesHash !== hashPreparedStructuralFireBytes(
      "prepared-structural-fire/page-bytes/v1",
      ownedBytes
    )
    || ownedHeader.pageHash !== hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/page/v1",
      pageHeaderCore(ownedHeader)
    )) {
    throw new RangeError("Page envelope contains an invalid page commitment.");
  }
  const core = Object.freeze({
    workerEpoch,
    rootJobId: request.rootJobId,
    requestHash: request.requestHash,
    pageHash: ownedHeader.pageHash
  });
  return Object.freeze({
    workerEpoch,
    rootJobId: request.rootJobId,
    requestHash: request.requestHash,
    header: ownedHeader,
    bytes: ownedBytes,
    pageEnvelopeHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/page-envelope/v1",
      core
    )
  });
};

export const preparedStructuralFireBackpressureDecision = (
  retainedBytesValue: number,
  incomingBytesValue: number
): Readonly<
  | { readonly kind: "Accepted"; readonly retainedBytesAfterAcceptance: number }
  | { readonly kind: "Deferred"; readonly reason: "RetainedInFlightBackpressure" }
> => {
  const retainedBytes = safeNonNegativeInteger(retainedBytesValue, "retainedBytes");
  const incomingBytes = safeNonNegativeInteger(incomingBytesValue, "incomingBytes");
  if (retainedBytes > PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES) {
    throw new RangeError("Retained-byte accounting already exceeds its transport capacity.");
  }
  if (incomingBytes > PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES - retainedBytes) {
    return Object.freeze({
      kind: "Deferred" as const,
      reason: "RetainedInFlightBackpressure" as const
    });
  }
  return Object.freeze({
    kind: "Accepted" as const,
    retainedBytesAfterAcceptance: retainedBytes + incomingBytes
  });
};

export const createPreparedStructuralFireResultManifest = (
  request: Readonly<PreparedStructuralFireRequest>,
  viewsValue: readonly Readonly<PreparedStructuralFireLogicalViewDescriptor>[]
): PreparedStructuralFireResultManifest => {
  const views = validateManifestViews("PreparedResult", viewsValue);
  const core = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_RESULT_MANIFEST_SCHEMA_VERSION,
    wireSchemaVersion: PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION,
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2,
    rootJobId: request.rootJobId,
    seedHash: request.seedHash,
    commandHash: request.commandHash,
    requestHash: request.requestHash,
    views: views.map(viewDescriptorCore)
  });
  return ownCanonical({
    ...core,
    manifestHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/result-manifest/v1",
      core
    )
  });
};

export const validatePreparedStructuralFireResultManifest = (
  request: Readonly<PreparedStructuralFireRequest>,
  value: Readonly<PreparedStructuralFireResultManifest>
): PreparedStructuralFireResultManifest => {
  const record = canonicalRecord(value, "resultManifest");
  requireExactKeys(record, [
    "schemaVersion",
    "wireSchemaVersion",
    "algorithmVersion",
    "rootJobId",
    "seedHash",
    "commandHash",
    "requestHash",
    "views",
    "manifestHash"
  ], "resultManifest");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_MANIFEST_SCHEMA_VERSION
    || value.wireSchemaVersion !== PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION
    || value.algorithmVersion !== PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2) {
    throw new RangeError("Result manifest version is invalid.");
  }
  const rebuilt = createPreparedStructuralFireResultManifest(
    validatePreparedStructuralFireRequest(request),
    value.views
  );
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)) {
    throw new RangeError("Result manifest commitment is invalid.");
  }
  return rebuilt;
};

export const createPreparedStructuralFireBodyPlan = (
  bodyIdsValue: readonly string[],
  bodyPlanRoot: PreparedStructuralFireHash,
  seedBodyIds: ReadonlySet<string>
): PreparedStructuralFireBodyPlan => {
  validateHash(bodyPlanRoot, "bodyPlanRoot");
  const bodyIds = bodyIdsValue.map((bodyId) => stableAuthorityId(bodyId, "bodyId"));
  for (let index = 0; index < bodyIds.length; index += 1) {
    if (seedBodyIds.has(bodyIds[index])) throw new RangeError("Body plan collides with a seeded body.");
    if (index > 0 && compareCanonicalCodeUnits(bodyIds[index - 1], bodyIds[index]) >= 0) {
      throw new RangeError("Body plan IDs must be unique and strictly canonical.");
    }
  }
  if (bodyIds.length === 0) {
    return Object.freeze({
      schemaVersion: PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION,
      kind: "Empty",
      count: 0,
      bodyPlanRoot
    });
  }
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION,
    kind: "CreateOnly",
    count: bodyIds.length,
    firstBodyId: bodyIds[0],
    lastBodyId: bodyIds[bodyIds.length - 1],
    bodyPlanRoot
  });
};

const validateCollisionBinding = (
  value: Readonly<{ readonly objectId: string; readonly objectRevision: number; readonly objectContentHash: PreparedStructuralFireHash }>,
  path: string
) => {
  const record = canonicalRecord(value, path);
  requireExactKeys(record, ["objectId", "objectRevision", "objectContentHash"], path);
  return Object.freeze({
    objectId: stableAuthorityId(value.objectId, `${path}.objectId`),
    objectRevision: safeNonNegativeInteger(value.objectRevision, `${path}.objectRevision`),
    objectContentHash: validateHash(value.objectContentHash, `${path}.objectContentHash`)
  });
};

export const validatePreparedStructuralFireCollisionResult = (
  value: PreparedStructuralFireCollisionResult
): PreparedStructuralFireCollisionResult => {
  const record = canonicalRecord(value, "collision");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION) {
    throw new RangeError("Collision result schema is invalid.");
  }
  const sourceBinding = validateCollisionBinding(value.sourceBinding, "collision.sourceBinding");
  const resultingBinding = validateCollisionBinding(
    value.resultingBinding,
    "collision.resultingBinding"
  );
  if (sourceBinding.objectId !== resultingBinding.objectId
    || resultingBinding.objectRevision <= sourceBinding.objectRevision) {
    throw new RangeError("Collision result must advance its revision-bound binding.");
  }
  if (value.kind === "NoGeometryChange") {
    requireExactKeys(record, [
      "schemaVersion", "kind", "sourceBinding", "resultingBinding",
      "unchangedCellSetRoot", "sourceCollisionCommitmentHash",
      "resultingCollisionCommitmentHash"
    ], "collision");
    validateHash(value.unchangedCellSetRoot, "collision.unchangedCellSetRoot");
    validateHash(value.sourceCollisionCommitmentHash, "collision.sourceCommitment");
    validateHash(value.resultingCollisionCommitmentHash, "collision.resultCommitment");
    if (resultingBinding.objectRevision !== sourceBinding.objectRevision + 1
      || sourceBinding.objectContentHash !== resultingBinding.objectContentHash
      || value.sourceCollisionCommitmentHash === value.resultingCollisionCommitmentHash) {
      throw new RangeError("NoGeometryChange must preserve geometry but advance its commitment.");
    }
    return Object.freeze({ ...value, sourceBinding, resultingBinding });
  }
  if (value.kind !== "Delta") throw new RangeError("Collision result kind is invalid.");
  requireExactKeys(record, [
    "schemaVersion", "kind", "sourceBinding", "sourceCellSetRoot", "removedCellKeys",
    "upsertedCells", "resultingBinding", "resultingCellSetRoot",
    "resultingCollisionCommitmentHash"
  ], "collision");
  validateHash(value.sourceCellSetRoot, "collision.sourceCellSetRoot");
  validateHash(value.resultingCellSetRoot, "collision.resultingCellSetRoot");
  validateHash(value.resultingCollisionCommitmentHash, "collision.resultCommitment");
  for (let index = 0; index < value.removedCellKeys.length; index += 1) {
    const key = requireCanonicalString(value.removedCellKeys[index], "removedCellKey");
    if (index > 0
      && compareCanonicalCodeUnits(value.removedCellKeys[index - 1], key) >= 0) {
      throw new RangeError("Removed collision keys must be strictly canonical.");
    }
  }
  return Object.freeze({ ...value, sourceBinding, resultingBinding });
};

const validatePreparedStructuralFireBodyPlan = (
  value: Readonly<PreparedStructuralFireBodyPlan>
): PreparedStructuralFireBodyPlan => {
  const record = canonicalRecord(value, "bodyPlan");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION) {
    throw new RangeError("Body plan schema is invalid.");
  }
  if (value.kind === "Empty") {
    requireExactKeys(record, ["schemaVersion", "kind", "count", "bodyPlanRoot"], "bodyPlan");
    if (value.count !== 0) throw new RangeError("Empty body plan count is invalid.");
    validateHash(value.bodyPlanRoot, "bodyPlan.bodyPlanRoot");
    return Object.freeze({ ...value });
  }
  if (value.kind !== "CreateOnly") throw new RangeError("Body plan kind is invalid.");
  requireExactKeys(record, [
    "schemaVersion", "kind", "count", "firstBodyId", "lastBodyId", "bodyPlanRoot"
  ], "bodyPlan");
  if (safeNonNegativeInteger(value.count, "bodyPlan.count") === 0
    || compareCanonicalCodeUnits(
      stableAuthorityId(value.firstBodyId, "bodyPlan.firstBodyId"),
      stableAuthorityId(value.lastBodyId, "bodyPlan.lastBodyId")
    ) > 0) {
    throw new RangeError("CreateOnly body plan boundary is invalid.");
  }
  validateHash(value.bodyPlanRoot, "bodyPlan.bodyPlanRoot");
  return Object.freeze({ ...value });
};

const transactionCore = (
  value: Omit<PreparedDerivationTransaction, "preparedDerivationTransactionHash">
) => ({
  schemaVersion: value.schemaVersion,
  seedHash: value.seedHash,
  commandHash: value.commandHash,
  requestHash: value.requestHash,
  rootJobId: value.rootJobId,
  terminalJobId: value.terminalJobId,
  source: value.source,
  result: value.result,
  resultManifestHash: value.resultManifestHash,
  structuralCommandId: value.structuralCommandId,
  outcome: value.outcome,
  supportResult: value.supportResult,
  bodyPlan: value.bodyPlan,
  detachedComponentCount: value.detachedComponentCount,
  detachedComponentRoot: value.detachedComponentRoot,
  sourceFragmentCount: value.sourceFragmentCount,
  sourceFragmentRoot: value.sourceFragmentRoot,
  newBodyCount: value.newBodyCount,
  newBodyRoot: value.newBodyRoot,
  collision: value.collision,
  terminalContinuation: value.terminalContinuation
});

const publishPreparedDerivationTransaction = (
  value: Omit<PreparedDerivationTransaction, "schemaVersion" | "preparedDerivationTransactionHash">
): PreparedDerivationTransaction => {
  if (!ROOT_JOB_PATTERN.test(value.rootJobId) || !JOB_PATTERN.test(value.terminalJobId)) {
    throw new RangeError("Prepared derivation job identity is invalid.");
  }
  const source = sourceIdentity(value.source, "transaction.source");
  const result = sourceIdentity(value.result, "transaction.result");
  if (source.objectId !== result.objectId || result.objectRevision <= source.objectRevision) {
    throw new RangeError("Prepared derivation result must advance its source revision.");
  }
  if (value.outcome === "NoChange" && result.objectRevision !== source.objectRevision + 1) {
    throw new RangeError("NoChange must advance its source revision once.");
  }
  const bodyPlan = validatePreparedStructuralFireBodyPlan(value.bodyPlan);
  if ((value.outcome === "NoChange" && bodyPlan.kind !== "Empty")
    || (bodyPlan.kind === "CreateOnly" && bodyPlan.count !== value.newBodyCount)
    || (bodyPlan.kind === "Empty" && value.newBodyCount !== 0)) {
    throw new RangeError("Prepared derivation body plan is inconsistent.");
  }
  const core = Object.freeze(transactionCore({
    ...value,
    bodyPlan,
    schemaVersion: PREPARED_DERIVATION_TRANSACTION_SCHEMA_VERSION,
    seedHash: validateHash(value.seedHash, "transaction.seedHash"),
    commandHash: validateHash(value.commandHash, "transaction.commandHash"),
    requestHash: validateHash(value.requestHash, "transaction.requestHash"),
    source,
    result,
    resultManifestHash: validateHash(
      value.resultManifestHash,
      "transaction.resultManifestHash"
    ),
    structuralCommandId: stableAuthorityId(
      value.structuralCommandId,
      "transaction.structuralCommandId"
    ),
    detachedComponentCount: safeNonNegativeInteger(
      value.detachedComponentCount,
      "transaction.detachedComponentCount"
    ),
    detachedComponentRoot: validateHash(
      value.detachedComponentRoot,
      "transaction.detachedComponentRoot"
    ),
    sourceFragmentCount: safeNonNegativeInteger(
      value.sourceFragmentCount,
      "transaction.sourceFragmentCount"
    ),
    sourceFragmentRoot: validateHash(
      value.sourceFragmentRoot,
      "transaction.sourceFragmentRoot"
    ),
    newBodyCount: safeNonNegativeInteger(value.newBodyCount, "transaction.newBodyCount"),
    newBodyRoot: validateHash(value.newBodyRoot, "transaction.newBodyRoot"),
    collision: validatePreparedStructuralFireCollisionResult(value.collision),
    terminalContinuation: value.terminalContinuation
  }));
  return ownCanonical({
    ...core,
    preparedDerivationTransactionHash: hashPreparedStructuralFireCanonical(
      "prepared-derivation-transaction/v1",
      core
    )
  });
};

export const validatePreparedDerivationTransaction = (
  value: Readonly<PreparedDerivationTransaction>,
  expected: Readonly<PreparedDerivationTransaction>
): PreparedDerivationTransaction => {
  if (!ownerPreparedTransactions.has(expected)) {
    throw new RangeError("Expected transaction was not derived by the owner payload scope.");
  }
  const record = canonicalRecord(value, "transaction");
  requireExactKeys(record, [
    "schemaVersion",
    "seedHash",
    "commandHash",
    "requestHash",
    "rootJobId",
    "terminalJobId",
    "source",
    "result",
    "resultManifestHash",
    "structuralCommandId",
    "outcome",
    "supportResult",
    "bodyPlan",
    "detachedComponentCount",
    "detachedComponentRoot",
    "sourceFragmentCount",
    "sourceFragmentRoot",
    "newBodyCount",
    "newBodyRoot",
    "collision",
    "terminalContinuation",
    "preparedDerivationTransactionHash"
  ], "transaction");
  if (value.schemaVersion !== PREPARED_DERIVATION_TRANSACTION_SCHEMA_VERSION) {
    throw new RangeError("Prepared derivation schema is invalid.");
  }
  const { preparedDerivationTransactionHash: _hash, schemaVersion: _schema, ...core } = value;
  const rebuilt = publishPreparedDerivationTransaction(core);
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)
    || canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(expected)) {
    throw new RangeError("Prepared derivation commitment is invalid.");
  }
  return expected;
};

const receiptCore = (value: Omit<PreparedStructuralFireResultReceipt, "receiptHash">) => ({
  schemaVersion: value.schemaVersion,
  kind: value.kind,
  rootJobId: value.rootJobId,
  terminalJobId: value.terminalJobId,
  seedHash: value.seedHash,
  commandHash: value.commandHash,
  requestHash: value.requestHash,
  resultManifestHash: value.resultManifestHash,
  preparedDerivationTransactionHash: value.preparedDerivationTransactionHash
});

export const createPreparedStructuralFireResultReceipt = (
  transaction: Readonly<PreparedDerivationTransaction>
): PreparedStructuralFireResultReceipt => {
  if (!ownerPreparedTransactions.has(transaction)) {
    throw new RangeError("Result receipts require an owner-derived transaction.");
  }
  const core = Object.freeze(receiptCore({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION,
    kind: transaction.outcome === "NoChange" ? "NoChangeReceipt" : "AppliedReceipt",
    rootJobId: transaction.rootJobId,
    terminalJobId: transaction.terminalJobId,
    seedHash: transaction.seedHash,
    commandHash: transaction.commandHash,
    requestHash: transaction.requestHash,
    resultManifestHash: transaction.resultManifestHash,
    preparedDerivationTransactionHash: transaction.preparedDerivationTransactionHash
  }));
  return ownCanonical({
    ...core,
    receiptHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/result-receipt/v1",
      core
    )
  }) as PreparedStructuralFireResultReceipt;
};

export const validatePreparedStructuralFireResultReceipt = (
  transactionValue: Readonly<PreparedDerivationTransaction>,
  value: PreparedStructuralFireResultReceipt
): PreparedStructuralFireResultReceipt => {
  const record = canonicalRecord(value, "receipt");
  requireExactKeys(record, [
    "schemaVersion",
    "kind",
    "rootJobId",
    "terminalJobId",
    "seedHash",
    "commandHash",
    "requestHash",
    "resultManifestHash",
    "preparedDerivationTransactionHash",
    "receiptHash"
  ], "receipt");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION) {
    throw new RangeError("Prepared result receipt schema is invalid.");
  }
  const transaction = validatePreparedDerivationTransaction(transactionValue, transactionValue);
  const rebuilt = createPreparedStructuralFireResultReceipt(transaction);
  if (canonicalAdaptiveJson(rebuilt) !== canonicalAdaptiveJson(value)) {
    throw new RangeError("Prepared result receipt commitment is invalid.");
  }
  return rebuilt;
};

export const createPreparedStructuralFireReady = (
  manifest: Readonly<PreparedStructuralFireResultManifest>,
  transaction: Readonly<PreparedDerivationTransaction>,
  receipt: PreparedStructuralFireResultReceipt
): PreparedStructuralFireReady => {
  if (!ownerPreparedTransactions.has(transaction)) {
    throw new RangeError("Ready requires an owner-derived transaction.");
  }
  validatePreparedStructuralFireResultReceipt(transaction, receipt);
  const expectedReceiptHash = hashPreparedStructuralFireCanonical(
    "prepared-structural-fire/result-receipt/v1",
    receiptCore(receipt)
  );
  if (receipt.rootJobId !== manifest.rootJobId
    || receipt.seedHash !== manifest.seedHash
    || receipt.commandHash !== manifest.commandHash
    || receipt.requestHash !== manifest.requestHash
    || receipt.resultManifestHash !== manifest.manifestHash
    || receipt.receiptHash !== expectedReceiptHash) {
    throw new RangeError("Ready receipt does not bind its result manifest.");
  }
  return ownCanonical({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION,
    type: "Ready",
    manifest,
    receipt
  });
};

/** Clone-safe Main-side framing check. Owner derivation remains worker-private. */
export const validatePreparedStructuralFireReadyAgainstRequest = (
  requestValue: Readonly<PreparedStructuralFireRequest>,
  value: Readonly<PreparedStructuralFireReady>,
  dispatchIndex: number,
  attemptIndex: number
): PreparedStructuralFireReady => {
  const request = validatePreparedStructuralFireRequest(requestValue);
  const readyRecord = canonicalRecord(value, "ready");
  requireExactKeys(readyRecord, ["schemaVersion", "type", "manifest", "receipt"], "ready");
  if (value.schemaVersion !== PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION
    || value.type !== "Ready") {
    throw new RangeError("Prepared Ready version is invalid.");
  }
  const manifest = validatePreparedStructuralFireResultManifest(request, value.manifest);
  const receiptRecord = canonicalRecord(value.receipt, "receipt");
  requireExactKeys(receiptRecord, [
    "schemaVersion",
    "kind",
    "rootJobId",
    "terminalJobId",
    "seedHash",
    "commandHash",
    "requestHash",
    "resultManifestHash",
    "preparedDerivationTransactionHash",
    "receiptHash"
  ], "receipt");
  const receipt = value.receipt;
  if (receipt.schemaVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION
    || (receipt.kind !== "NoChangeReceipt" && receipt.kind !== "AppliedReceipt")
    || receipt.rootJobId !== request.rootJobId
    || receipt.terminalJobId !== preparedStructuralFireJobId(
      request,
      dispatchIndex,
      attemptIndex
    )
    || receipt.seedHash !== request.seedHash
    || receipt.commandHash !== request.commandHash
    || receipt.requestHash !== request.requestHash
    || receipt.resultManifestHash !== manifest.manifestHash
    || validateHash(
      receipt.preparedDerivationTransactionHash,
      "receipt.preparedDerivationTransactionHash"
    ) !== receipt.preparedDerivationTransactionHash
    || hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/result-receipt/v1",
      receiptCore(receipt)
    ) !== receipt.receiptHash) {
    throw new RangeError("Prepared Ready receipt does not bind the retained request.");
  }
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION,
    type: "Ready" as const,
    manifest,
    receipt: Object.freeze({ ...receipt })
  });
};

export const createPreparedStructuralFireContinuationCursor = (
  value: Omit<PreparedStructuralFireContinuationCursor, "schemaVersion" | "chainHash">,
  previousChainHash: PreparedStructuralFireHash
): PreparedStructuralFireContinuationCursor => {
  if (!ROOT_JOB_PATTERN.test(value.rootJobId)) throw new RangeError("Continuation rootJobId is invalid.");
  validateHash(value.requestHash, "continuation.requestHash");
  validateHash(previousChainHash, "continuation.previousChainHash");
  const ordinal = safeNonNegativeInteger(value.ordinal, "continuation.ordinal");
  const globalOrdinal = safeNonNegativeInteger(
    value.globalOrdinal,
    "continuation.globalOrdinal"
  );
  if (value.lastItemKey === null ? ordinal !== 0 : ordinal === 0) {
    throw new RangeError("Continuation item boundary is invalid.");
  }
  if (value.lastItemKey !== null) requireCanonicalString(value.lastItemKey, "lastItemKey");
  const core = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_CONTINUATION_SCHEMA_VERSION,
    rootJobId: value.rootJobId,
    requestHash: value.requestHash,
    domain: value.domain,
    lastItemKey: value.lastItemKey,
    ordinal,
    globalOrdinal,
    previousChainHash
  });
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_CONTINUATION_SCHEMA_VERSION,
    rootJobId: value.rootJobId,
    requestHash: value.requestHash,
    domain: value.domain,
    lastItemKey: value.lastItemKey,
    ordinal,
    globalOrdinal,
    chainHash: hashPreparedStructuralFireCanonical(
      "prepared-structural-fire/continuation/v1",
      core
    )
  });
};
