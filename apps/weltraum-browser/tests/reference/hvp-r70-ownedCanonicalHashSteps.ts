import { createFnv1a64State, fnv1a64StateHex, updateFnv1a64State, type Fnv1a64State } from "../../src/core/fnv1a64";
import { compareCanonicalCodeUnits, fail, requireCanonicalString, requirePlainRecord, isValidatedFrozenDenseArray } from "../../src/voxel/adaptive/validation";

/**
 * PRIVATE (module export only; not in the adaptive barrel): a bounded
 * cursor over a schema-owned, deep-frozen canonical payload whose streamed UTF-8 bytes and digest
 * equal canonicalAdaptiveJson(payload) / hashAdaptiveCanonical(payload). It visits nodes in the same
 * depth-first sorted-key order and raises the same AdaptiveAuthorityError (code, path, message) the
 * public canonicalize raises first for these shapes. The public functions stay the only authority for
 * caller values; this cursor never replaces them.
 *
 * Owned-payload construction obligations (the caller must guarantee them; they are not checkable in
 * bounded work): arrays come from first-party literals/map/slice (no named or symbol own keys, no
 * Proxy) and records are fixed-shape literals. Checked fail-closed per container: frozen (stability
 * across advances, not trust), arrays with Array.prototype and a safe data length, every index an
 * own enumerable data property (one unit each, before any child, like the public dense check), and
 * records plain with at most OWNED_RECORD_MAX_KEYS keys (a record's own-key read/sort is one unit).
 * The opt-in path reuses module-local witnesses for immutable dense array shape; each witnessed
 * visit still yields on opening and validates every child and scalar while emitting all bytes.
 *
 * One unit is one of: a container open (record key read/sort), one array integrity/index check, one scalar,
 * one string/key chunk of at most STRING_CHUNK_UNITS code units, one record key. A unit may also
 * encode at most PENDING_UNITS code units per encode and fold at most BUFFER_BYTES bytes per fold, with
 * at most two folds in a unit (the final unit: pending-encode flush plus last flush) before it builds
 * the digest (no whole-JSON finalizer). This bounds bytes per unit, not time.
 *
 * Scratch (released on done/failure/dispose): one BUFFER_BYTES Uint8Array, one pending string of at
 * most PENDING_UNITS code units, one ancestor Set and one generator frame (path string, at most
 * OWNED_RECORD_MAX_KEYS sorted keys) per open container depth. No payload copy. Optional shape
 * witnesses live in validation's module-local WeakSet and do not retain arrays after collection.
 */
export const OWNED_RECORD_MAX_KEYS = 16;
const BUFFER_BYTES = 4_096;
const PENDING_UNITS = 1_024;
const STRING_CHUNK_UNITS = 128;

export interface OwnedCanonicalHashResult {
  readonly contentHash: string;
  readonly byteLength: number;
}

export interface OwnedCanonicalHashCursor {
  /** Runs at most `maxUnits` units; returns the one result when done, otherwise undefined. */
  advance(maxUnits: number): OwnedCanonicalHashResult | undefined;
  /** Idempotent, never throws; releases scratch and the payload, keeps a result or first failure. */
  dispose(): void;
}

interface Emitter {
  readonly encoder: TextEncoder;
  readonly buffer: Uint8Array;
  readonly state: Fnv1a64State;
  readonly ancestors: Set<object>;
  /** Test-only byte observer; receives a borrowed view that is valid only during the call. */
  readonly sink: ((bytes: Uint8Array) => void) | undefined;
  readonly reuseValidatedArrayShape: boolean;
  /** Set by dispose (also from inside the sink): no later encode, fold or emission happens. */
  cancelled: boolean;
  used: number;
  pending: string;
  byteLength: number;
}

const flushBytes = (emitter: Emitter): void => {
  if (emitter.cancelled || emitter.used === 0) {
    return;
  }
  const bytes = emitter.buffer.subarray(0, emitter.used);
  updateFnv1a64State(emitter.state, bytes);
  emitter.sink?.(bytes);
  emitter.used = 0;
};

const encodePending = (emitter: Emitter): void => {
  const text = emitter.pending;
  if (emitter.cancelled || text.length === 0) {
    return;
  }
  // At most 3 UTF-8 bytes per UTF-16 code unit; PENDING_UNITS * 3 fits one empty buffer.
  if (BUFFER_BYTES - emitter.used < text.length * 3) {
    flushBytes(emitter);
    if (emitter.cancelled) {
      return;
    }
  }
  const { read, written } = emitter.encoder.encodeInto(text, emitter.buffer.subarray(emitter.used));
  if (read !== text.length) {
    throw new Error("Owned canonical hash encoder did not consume its bounded chunk.");
  }
  emitter.used += written;
  emitter.byteLength += written;
  emitter.pending = "";
};

const write = (emitter: Emitter, text: string): void => {
  if (emitter.pending.length + text.length > PENDING_UNITS) {
    encodePending(emitter);
  }
  emitter.pending += text;
};

/** JSON.stringify escaping per chunk; chunks never split a high/low surrogate pair. */
function* emitString(emitter: Emitter, value: string, path: string, validate: boolean): Generator<void, void, void> {
  if (value.length === 0) {
    // Still one unit, so arrays of empty strings stay bounded per advance.
    write(emitter, "\"\"");
    yield;
    return;
  }
  write(emitter, "\"");
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + STRING_CHUNK_UNITS, value.length);
    const last = value.charCodeAt(end - 1);
    const next = value.charCodeAt(end);
    if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      end += 1;
    }
    const chunk = value.slice(start, end);
    if (validate) {
      requireCanonicalString(chunk, path);
    }
    write(emitter, JSON.stringify(chunk).slice(1, -1));
    start = end;
    yield;
  }
  write(emitter, "\"");
}

const requireOwnedFrozen = (value: object, path: string): void => {
  if (!Object.isFrozen(value)) {
    fail("InvalidCanonicalValue", path, "Owned canonical containers must be frozen.");
  }
};

function* emitArray(emitter: Emitter, value: unknown[], path: string): Generator<void, void, void> {
  if (emitter.ancestors.has(value)) {
    fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
  }
  let length: number;
  const witnessed = emitter.reuseValidatedArrayShape && isValidatedFrozenDenseArray(value);
  if (witnessed) {
    // Complete descriptor validation already proved this exact immutable container.
    // One open yield remains even for empty arrays; descendants and bytes are still checked.
    length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
    yield;
  } else {
    // The producer guarantees index-only, non-Proxy arrays. Complete the frozen flag pass before
    // prototype/density/children, preserving native isFrozen precedence without a bulk integrity call.
    if (Object.isExtensible(value)) {
      fail("InvalidCanonicalValue", path, "Owned canonical containers must be frozen.");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor?.configurable || lengthDescriptor?.writable) {
      fail("InvalidCanonicalValue", path, "Owned canonical containers must be frozen.");
    }
    length = lengthDescriptor?.value as number;
    yield;
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      // A missing index is not a mutable property: sealed sparse arrays can still be frozen.
      if (descriptor !== undefined && (descriptor.configurable || ("value" in descriptor && descriptor.writable))) {
        fail("InvalidCanonicalValue", path, "Owned canonical containers must be frozen.");
      }
      yield;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      fail("InvalidCanonicalValue", path, "Owned canonical arrays must be plain arrays.");
    }
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
      fail("InvalidCanonicalValue", path, "Array length must be a safe data property.");
    }
    yield;
    // Every entry is checked before any child, like the public dense-array check: a present
    // non-enumerable/accessor entry anywhere wins over an earlier hole, then the first hole is reported.
    let firstHole = -1;
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) {
        if (firstHole < 0) {
          firstHole = index;
        }
      } else if (!descriptor.enumerable || !("value" in descriptor)) {
        fail("InvalidCanonicalValue", `${path}/${index}`, "Array entries must be enumerable data properties.");
      }
      yield;
    }
    if (firstHole >= 0) {
      fail("InvalidCanonicalValue", `${path}/${firstHole}`, "Sparse arrays are rejected.");
    }
  }
  emitter.ancestors.add(value);
  write(emitter, "[");
  for (let index = 0; index < length; index += 1) {
    if (index > 0) {
      write(emitter, ",");
    }
    // A witnessed array has immutable own data entries; every child still follows emitValue.
    yield* emitValue(emitter, witnessed ? value[index] : Object.getOwnPropertyDescriptor(value, String(index))!.value, `${path}/${index}`);
  }
  write(emitter, "]");
  emitter.ancestors.delete(value);
}

function* emitRecord(emitter: Emitter, value: unknown, path: string): Generator<void, void, void> {
  const record = requirePlainRecord(value, path);
  if (emitter.ancestors.has(record)) {
    fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
  }
  requireOwnedFrozen(record, path);
  const keys = Object.keys(record);
  if (keys.length > OWNED_RECORD_MAX_KEYS) {
    fail("InvalidCanonicalValue", path, `Owned canonical records may have at most ${OWNED_RECORD_MAX_KEYS} fields.`);
  }
  keys.sort(compareCanonicalCodeUnits);
  emitter.ancestors.add(record);
  write(emitter, "{");
  yield;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    if (index > 0) {
      write(emitter, ",");
    }
    // Keys are not surrogate-validated by the public path either; JSON.stringify escapes them.
    yield* emitString(emitter, key, path, false);
    write(emitter, ":");
    yield;
    yield* emitValue(emitter, record[key], `${path}/${key}`);
  }
  write(emitter, "}");
  emitter.ancestors.delete(record);
}

function* emitValue(emitter: Emitter, value: unknown, path: string): Generator<void, void, void> {
  if (value === null || typeof value === "boolean") {
    write(emitter, value === null ? "null" : value ? "true" : "false");
    yield;
    return;
  }
  if (typeof value === "string") {
    yield* emitString(emitter, value, path, true);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("InvalidCanonicalValue", path, "Non-finite numbers are not canonical.");
    }
    // JSON.stringify(-0) is "0", matching the public -0 normalization.
    write(emitter, JSON.stringify(value));
    yield;
    return;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" || value === undefined) {
    fail("InvalidCanonicalValue", path, "Unsupported canonical value.");
  }
  if (Array.isArray(value)) {
    yield* emitArray(emitter, value, path);
    return;
  }
  yield* emitRecord(emitter, value, path);
}

function* hashSteps(emitter: Emitter, payload: unknown): Generator<void, OwnedCanonicalHashResult, void> {
  yield* emitValue(emitter, payload, "");
  encodePending(emitter);
  flushBytes(emitter);
  return Object.freeze({
    contentHash: `fnv1a64-v1:${fnv1a64StateHex(emitter.state)}`,
    byteLength: emitter.byteLength
  });
}

/** Creates the cursor without doing any work; `sink` is a test-only bounded byte observer. */
export const createOwnedCanonicalHashCursor = (
  payload: unknown,
  sink?: (bytes: Uint8Array) => void,
  reuseValidatedArrayShape = false
): OwnedCanonicalHashCursor => {
  let emitter: Emitter | undefined = {
    encoder: new TextEncoder(),
    buffer: new Uint8Array(BUFFER_BYTES),
    state: createFnv1a64State(),
    ancestors: new Set<object>(),
    sink,
    reuseValidatedArrayShape,
    cancelled: false,
    used: 0,
    pending: "",
    byteLength: 0
  };
  let steps: Generator<void, OwnedCanonicalHashResult, void> | undefined = hashSteps(emitter, payload);
  let result: OwnedCanonicalHashResult | undefined;
  let failure: { readonly error: unknown } | undefined;
  let running = false;
  const release = (): void => {
    const current = steps;
    steps = undefined;
    if (emitter !== undefined) {
      emitter.cancelled = true;
      emitter.ancestors.clear();
    }
    emitter = undefined;
    // A running generator is released by the advance that owns it, right after its step.
    if (current !== undefined && !running) {
      current.return(undefined as never);
    }
  };
  return {
    advance(maxUnits: number): OwnedCanonicalHashResult | undefined {
      if (!Number.isSafeInteger(maxUnits) || maxUnits < 1) {
        throw new RangeError("Owned canonical hash advance needs a positive integer unit budget.");
      }
      if (running) {
        throw new Error("Owned canonical hash cursor is already advancing.");
      }
      if (failure !== undefined) {
        throw failure.error;
      }
      if (result !== undefined) {
        throw new Error("Owned canonical hash cursor is exhausted.");
      }
      if (steps === undefined) {
        throw new Error("Owned canonical hash cursor is disposed.");
      }
      const current = steps;
      running = true;
      try {
        for (let unit = 0; unit < maxUnits; unit += 1) {
          const step = current.next();
          if (steps === undefined) {
            // Disposed during this step (sink re-entry), also in the final one: no result.
            if (!step.done) {
              current.return(undefined as never);
            }
            return undefined;
          }
          if (step.done) {
            result = step.value;
            return result;
          }
        }
        return undefined;
      } catch (error) {
        failure = { error };
        throw error;
      } finally {
        running = false;
        if (result !== undefined || failure !== undefined) {
          release();
        }
      }
    },
    dispose(): void {
      release();
    }
  };
};
