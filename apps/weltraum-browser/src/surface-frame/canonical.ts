import { normalizeZero, requireDenseCanonicalArray } from "./internal";
import { SURFACE_LOCAL_FRAME_SCHEMA_VERSION, SurfaceLocalFrameError } from "./types";

export const SURFACE_CANONICAL_SIGNATURE_NAMESPACE = "weltraum.surface-local-frame/v1/fnv1a32" as const;

const serialize = (value: unknown, active: WeakSet<object>, path: string): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} cannot be serialized.`);
    }
    return encoded;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} must be finite.`);
    }
    return String(normalizeZero(value));
  }
  if (Array.isArray(value)) {
    if (active.has(value)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} cannot contain cycles.`);
    }
    requireDenseCanonicalArray(value, path);
    active.add(value);
    try {
      return `[${value.map((entry, index) => serialize(entry, active, `${path}[${index}]`)).join(",")}]`;
    } finally {
      active.delete(value);
    }
  }
  if (typeof value === "object") {
    const object = value as object;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} must contain only plain objects.`);
    }
    if (Object.getOwnPropertySymbols(object).length > 0 || active.has(object)) {
      throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} contains a cycle or symbol key.`);
    }
    active.add(object);
    try {
      return `{${Object.keys(object).sort().map((key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry === undefined) {
          throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path}.${key} cannot be undefined.`);
        }
        return `${JSON.stringify(key)}:${serialize(entry, active, `${path}.${key}`)}`;
      }).join(",")}}`;
    } finally {
      active.delete(object);
    }
  }
  throw new SurfaceLocalFrameError("InvalidCanonicalValue", `${path} is not canonical JSON data.`);
};

const assertVersionedPayload = (value: unknown): void => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SurfaceLocalFrameError("InvalidCanonicalValue", "Canonical payload must be a versioned object.");
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.schema !== "string" || payload.schema.length === 0 || payload.schemaVersion !== SURFACE_LOCAL_FRAME_SCHEMA_VERSION) {
    throw new SurfaceLocalFrameError("InvalidCanonicalValue", "Canonical payload must include a schema and schemaVersion 1.");
  }
};

export const canonicalSerializeSurfaceLocalFrame = (value: unknown): string => {
  assertVersionedPayload(value);
  return serialize(value, new WeakSet<object>(), "$payload");
};

const fnv1aUtf8 = (input: string): string => {
  let hash = 0x811c9dc5;
  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const bytes = codePoint <= 0x7f
      ? [codePoint]
      : codePoint <= 0x7ff
        ? [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)]
        : codePoint <= 0xffff
          ? [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
          : [
              0xf0 | (codePoint >> 18),
              0x80 | ((codePoint >> 12) & 0x3f),
              0x80 | ((codePoint >> 6) & 0x3f),
              0x80 | (codePoint & 0x3f)
            ];
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const surfaceLocalFrameSignature = (value: unknown): string =>
  `${SURFACE_CANONICAL_SIGNATURE_NAMESPACE}:${fnv1aUtf8(canonicalSerializeSurfaceLocalFrame(value))}`;
