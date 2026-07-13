import { canonicalCelestialJson, celestialSignature } from "./canonical";
import { failCelestial } from "./errors";
import { createCelestialBodyId, createCelestialCatalogId, type CelestialBodyId } from "./ids";
import {
  CELESTIAL_BODY_TYPES,
  CELESTIAL_SCHEMA_VERSION,
  type CelestialBodyDefinition,
  type CelestialBodyType,
  type CelestialCatalog,
  type CelestialCatalogIndexes
} from "./types";
import {
  assertCelestialSchemaVersion,
  createCelestialBodyDefinition,
  deepFreezeCelestial,
  isCelestialRecord
} from "./validation";

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const frozenRecord = <T>(entries: readonly (readonly [string, T])[]): Readonly<Record<string, T>> => {
  const record = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) {
    Object.defineProperty(record, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false
    });
  }
  return Object.freeze(record);
};

const validateParentGraph = (bodies: readonly CelestialBodyDefinition[]): CelestialBodyId => {
  const bodyById = new Map(bodies.map((body) => [body.bodyId, body] as const));
  for (const body of bodies) {
    if (body.parentBodyId !== null && !bodyById.has(body.parentBodyId)) {
      return failCelestial("UnknownParent", `/bodies/${body.bodyId}/parentBodyId`, `Unknown parent ${body.parentBodyId}.`);
    }
  }
  for (const body of bodies) {
    if (body.parentBodyId === null) {
      if (body.orbit !== null) {
        return failCelestial("RootOrbitMismatch", `/bodies/${body.bodyId}/orbit`, "A root body cannot declare an orbit.");
      }
    } else if (body.orbit === null || body.orbit.parentBodyId !== body.parentBodyId) {
      return failCelestial(
        "ParentOrbitMismatch",
        `/bodies/${body.bodyId}/orbit`,
        "A non-root body needs one orbit whose parent matches parentBodyId."
      );
    }
  }

  const visitState = new Map<CelestialBodyId, "Visiting" | "Done">();
  const visit = (body: CelestialBodyDefinition): void => {
    const state = visitState.get(body.bodyId);
    if (state === "Visiting") {
      return failCelestial("ParentCycle", `/bodies/${body.bodyId}/parentBodyId`, `Parent cycle includes ${body.bodyId}.`);
    }
    if (state === "Done") {
      return;
    }
    visitState.set(body.bodyId, "Visiting");
    if (body.parentBodyId !== null) {
      const parent = bodyById.get(body.parentBodyId);
      if (parent) {
        visit(parent);
      }
    }
    visitState.set(body.bodyId, "Done");
  };
  bodies.forEach(visit);

  const roots = bodies.filter((body) => body.parentBodyId === null);
  if (roots.length !== 1 || roots[0].bodyType !== "Star") {
    return failCelestial("InvalidCatalog", "/bodies", "A celestial catalog requires exactly one root Star.");
  }
  return roots[0].bodyId;
};

const buildIndexes = (bodies: readonly CelestialBodyDefinition[]): CelestialCatalogIndexes => {
  const bodyById = frozenRecord(bodies.map((body) => [body.bodyId, body] as const));
  const children = new Map<CelestialBodyId, CelestialBodyId[]>(bodies.map((body) => [body.bodyId, []]));
  for (const body of bodies) {
    if (body.parentBodyId !== null) {
      children.get(body.parentBodyId)?.push(body.bodyId);
    }
  }
  const childIdsByParentId = frozenRecord(
    bodies.map((body) => [body.bodyId, Object.freeze([...(children.get(body.bodyId) ?? [])].sort(compareIds))] as const)
  );
  const bodyIdsByType = frozenRecord(
    CELESTIAL_BODY_TYPES.map((bodyType) => [
      bodyType,
      Object.freeze(bodies.filter((body) => body.bodyType === bodyType).map((body) => body.bodyId))
    ] as const)
  ) as Readonly<Record<CelestialBodyType, readonly CelestialBodyId[]>>;
  return deepFreezeCelestial({ bodyById, childIdsByParentId, bodyIdsByType });
};

const catalogPayload = (catalog: Pick<CelestialCatalog, "schemaVersion" | "catalogId" | "bodies">) => ({
  schemaVersion: catalog.schemaVersion,
  catalogId: catalog.catalogId,
  bodies: catalog.bodies
});

export const createCelestialCatalog = (value: unknown): CelestialCatalog => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidCatalog", "", "Celestial catalog must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, "/schemaVersion");
  const catalogId = createCelestialCatalogId(value.catalogId, "/catalogId");
  if (!Array.isArray(value.bodies) || value.bodies.length === 0) {
    return failCelestial("InvalidCatalog", "/bodies", "Celestial catalog bodies must be a non-empty array.");
  }

  const rawBodies = value.bodies.map((entry, index) => {
    if (!isCelestialRecord(entry)) {
      return failCelestial("InvalidBody", `/bodies/${index}`, "Celestial body must be an object.");
    }
    return { bodyId: createCelestialBodyId(entry.bodyId, `/bodies/${index}/bodyId`), entry };
  });
  const seen = new Set<string>();
  for (const { bodyId } of [...rawBodies].sort((a, b) => compareIds(a.bodyId, b.bodyId))) {
    if (seen.has(bodyId)) {
      return failCelestial("DuplicateBodyId", `/bodies/${bodyId}/bodyId`, `Duplicate celestial body ID ${bodyId}.`);
    }
    seen.add(bodyId);
  }

  const bodies = Object.freeze(
    rawBodies
      .sort((a, b) => compareIds(a.bodyId, b.bodyId))
      .map(({ bodyId, entry }) => createCelestialBodyDefinition(entry, `/bodies/${bodyId}`))
  );
  const rootBodyId = validateParentGraph(bodies);
  const indexes = buildIndexes(bodies);
  const base = { schemaVersion: CELESTIAL_SCHEMA_VERSION, catalogId, bodies };
  return deepFreezeCelestial({
    ...base,
    rootBodyId,
    indexes,
    canonicalJson: canonicalCelestialJson(catalogPayload(base)),
    signature: celestialSignature(catalogPayload(base))
  });
};

export const findCelestialBody = (
  catalog: CelestialCatalog,
  bodyId: CelestialBodyId | string
): CelestialBodyDefinition | undefined => catalog.indexes.bodyById[bodyId];

export const requireCelestialBody = (
  catalog: CelestialCatalog,
  bodyId: CelestialBodyId | string
): CelestialBodyDefinition =>
  findCelestialBody(catalog, bodyId) ??
  failCelestial("InvalidCatalog", `/indexes/bodyById/${bodyId}`, `Catalog does not contain body ${bodyId}.`);

export const childBodyIdsFor = (
  catalog: CelestialCatalog,
  parentBodyId: CelestialBodyId | string
): readonly CelestialBodyId[] => catalog.indexes.childIdsByParentId[parentBodyId] ?? Object.freeze([]);

export const bodyIdsForType = (
  catalog: CelestialCatalog,
  bodyType: CelestialBodyType
): readonly CelestialBodyId[] => catalog.indexes.bodyIdsByType[bodyType];
