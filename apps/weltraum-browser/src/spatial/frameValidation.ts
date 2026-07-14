import { validateUniverseTime, type UniverseTime } from "../persistence/time";
import { canonicalizeSpatialValue, createSpatialSignature, serializeCanonicalSpatialValue } from "./canonical";
import { failSpatial } from "./errors";
import { parseFrameId, type FrameId } from "./ids";
import { createSpatialQuaternion, createSpatialVector3 } from "./quaternion";
import { FRAME_KINDS, type FrameDefinition, type FrameDefinitionInput, type FrameGraph } from "./types";

const isFrameKind = (value: unknown): value is FrameDefinition["kind"] =>
  typeof value === "string" && (FRAME_KINDS as readonly string[]).includes(value);

interface ParsedFrameIdentity {
  readonly frameId: FrameId;
  readonly parentFrameId: FrameId | null;
  readonly kind: unknown;
  readonly canonicalAuthority: unknown;
}

const validateDefinitionIdentity = (input: unknown, index: number): ParsedFrameIdentity => {
  const path = `/definitions/${index}`;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failSpatial("INVALID_INPUT", path, "Frame definition must be an object.");
  }
  const record = input as Readonly<Record<string, unknown>>;
  const frameId = parseFrameId(record.frameId, `${path}/frameId`);
  const parentFrameId = record.parentFrameId === null ? null : parseFrameId(record.parentFrameId, `${path}/parentFrameId`);
  if (record.canonicalAuthority !== undefined && typeof record.canonicalAuthority !== "boolean") {
    return failSpatial("INVALID_INPUT", `${path}/canonicalAuthority`, "Canonical authority must be boolean.");
  }
  return Object.freeze({
    frameId,
    parentFrameId,
    kind: record.kind,
    canonicalAuthority: record.canonicalAuthority
  });
};

const finalizeDefinition = (input: ParsedFrameIdentity, index: number): FrameDefinition => {
  if (!isFrameKind(input.kind)) {
    return failSpatial("INVALID_FRAME_KIND", `/definitions/${index}/kind`, "Frame kind is unsupported.");
  }
  return Object.freeze({
    frameId: input.frameId,
    kind: input.kind,
    parentFrameId: input.parentFrameId,
    canonicalAuthority: (input.canonicalAuthority as boolean | undefined) ?? input.kind !== "RenderRelative"
  });
};

export const createFrameGraph = (inputs: readonly FrameDefinitionInput[]): FrameGraph => {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return failSpatial("INVALID_INPUT", "/definitions", "Frame graph requires at least one definition.");
  }
  const identities = inputs.map(validateDefinitionIdentity);

  const identityById = new Map<FrameId, ParsedFrameIdentity>();
  for (const definition of identities) {
    if (identityById.has(definition.frameId)) {
      return failSpatial("DUPLICATE_FRAME_ID", `/definitions/${definition.frameId}`, "Frame IDs must be unique.");
    }
    identityById.set(definition.frameId, definition);
  }

  for (const definition of identities) {
    if (definition.parentFrameId !== null && !identityById.has(definition.parentFrameId)) {
      return failSpatial(
        "UNKNOWN_PARENT_FRAME",
        `/definitions/${definition.frameId}/parentFrameId`,
        "Frame parent must exist in the same graph."
      );
    }
  }

  const parsed = identities.map(finalizeDefinition);
  const byId = new Map<FrameId, FrameDefinition>(
    parsed.map((definition) => [definition.frameId, definition])
  );

  const roots = parsed.filter((definition) => definition.parentFrameId === null);
  if (roots.length !== 1 || roots[0]?.kind !== "SystemInertial") {
    return failSpatial("INVALID_FRAME_ROOT", "/definitions", "Frame graph requires exactly one SystemInertial root.");
  }
  for (const definition of parsed) {
    if (definition.kind === "SystemInertial" && definition.parentFrameId !== null) {
      return failSpatial("INVALID_FRAME_ROOT", `/definitions/${definition.frameId}`, "SystemInertial must be the graph root.");
    }
  }

  const visitState = new Map<FrameId, "Visiting" | "Done">();
  const visit = (frameId: FrameId): void => {
    const state = visitState.get(frameId);
    if (state === "Visiting") {
      failSpatial("FRAME_CYCLE", `/definitions/${frameId}`, "Frame graph must be acyclic.");
    }
    if (state === "Done") {
      return;
    }
    visitState.set(frameId, "Visiting");
    const parent = byId.get(frameId)?.parentFrameId;
    if (parent !== null && parent !== undefined) {
      visit(parent);
    }
    visitState.set(frameId, "Done");
  };
  for (const definition of parsed) {
    visit(definition.frameId);
  }

  for (const definition of parsed) {
    if (definition.kind === "RenderRelative" && definition.canonicalAuthority) {
      return failSpatial(
        "INVALID_FRAME_AUTHORITY",
        `/definitions/${definition.frameId}/canonicalAuthority`,
        "RenderRelative frames cannot be canonical world authority."
      );
    }
  }

  const definitions = canonicalizeSpatialValue<readonly FrameDefinition[]>(
    parsed
      .slice()
      .sort((left, right) => (left.frameId < right.frameId ? -1 : left.frameId > right.frameId ? 1 : 0))
  ) as readonly FrameDefinition[];
  const index = Object.freeze(
    Object.fromEntries(definitions.map((definition) => [definition.frameId, definition]))
  ) as Readonly<Record<string, FrameDefinition>>;
  const canonicalValue = { rootFrameId: roots[0].frameId, definitions };
  const graph: FrameGraph = {
    rootFrameId: roots[0].frameId,
    definitions,
    definitionById: index,
    canonicalJson: serializeCanonicalSpatialValue(canonicalValue),
    signature: createSpatialSignature(canonicalValue),
    getDefinition: (frameId: FrameId | string): FrameDefinition => {
      const parsedId = parseFrameId(frameId, "/frameId");
      const definition = index[parsedId];
      if (definition === undefined) {
        return failSpatial("UNKNOWN_PARENT_FRAME", "/frameId", "Frame does not exist in this graph.");
      }
      return definition;
    }
  };
  return Object.freeze(graph);
};

export const cloneUniverseTime = (time: UniverseTime, path = "/time"): UniverseTime => {
  const validated = validateUniverseTime(time, path);
  return Object.freeze({ tick: validated.tick, epochSeconds: validated.epochSeconds });
};

export const assertSameUniverseTime = (
  left: UniverseTime,
  right: UniverseTime,
  path = "/time"
): void => {
  const a = validateUniverseTime(left, `${path}/left`);
  const b = validateUniverseTime(right, `${path}/right`);
  if (a.tick !== b.tick || a.epochSeconds !== b.epochSeconds) {
    failSpatial("TIME_MISMATCH", path, "Frame operations require exactly matching Universe times.");
  }
};

export const canonicalFrameVector = createSpatialVector3;
export const canonicalFrameQuaternion = createSpatialQuaternion;
