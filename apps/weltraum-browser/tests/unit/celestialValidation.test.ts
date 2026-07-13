import { describe, expect, it } from "vitest";
import {
  CELESTIAL_SCHEMA_VERSION,
  CelestialError,
  GRAVITATIONAL_CONSTANT,
  canonicalCelestialJson,
  createCelestialCatalog,
  createStarterCelestialCatalog
} from "../../src/celestial";
import type { CelestialBodyDefinitionInput } from "../../src/celestial";

const expectCelestialError = (action: () => unknown, code: CelestialError["code"], path?: string): void => {
  try {
    action();
    throw new Error(`Expected CelestialError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CelestialError);
    expect((error as CelestialError).code).toBe(code);
    if (path !== undefined) {
      expect((error as CelestialError).path).toBe(path);
    }
  }
};

const body = (
  bodyId: string,
  parentBodyId: string | null,
  overrides: Partial<CelestialBodyDefinitionInput> = {}
): CelestialBodyDefinitionInput => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  bodyId,
  displayName: bodyId,
  bodyType: parentBodyId === null ? "Star" : "RockyPlanet",
  parentBodyId,
  radiusMeters: 1_000_000,
  massKg: 1e22,
  gravity: {
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 1e22,
    canBeDominantSource: true
  },
  orbit: parentBodyId === null
    ? null
    : {
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        parentBodyId,
        semiMajorAxisMeters: 10_000_000,
        eccentricity: 0,
        inclinationDegrees: 0,
        longitudeOfAscendingNodeDegrees: 0,
        argumentOfPeriapsisDegrees: 0,
        meanAnomalyAtEpochDegrees: 0
      },
  rotation: null,
  atmosphere: null,
  visualScale: {
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    mapRadiusScale: 1,
    localRadiusScale: 1,
    impostorRadiusScale: 1,
    renderOnly: true
  },
  surfaceAccess: { schemaVersion: CELESTIAL_SCHEMA_VERSION, mode: "Deferred" },
  gameplayAccess: { schemaVersion: CELESTIAL_SCHEMA_VERSION, mode: "Deferred", tags: [] },
  ...overrides
});

const catalog = (bodies: readonly CelestialBodyDefinitionInput[], schemaVersion: number = CELESTIAL_SCHEMA_VERSION) => ({
  schemaVersion,
  catalogId: "catalog.fixture.v1",
  bodies
});

describe("celestial fail-closed validation", () => {
  it("rejects malformed and duplicate stable body identities", () => {
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star fixture", null)])),
      "InvalidId",
      "/bodies/0/bodyId"
    );
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null), body("star.fixture", null)])),
      "DuplicateBodyId",
      "/bodies/star.fixture/bodyId"
    );
  });

  it("rejects unknown parents and parent cycles deterministically", () => {
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null), body("planet.fixture", "planet.missing")])),
      "UnknownParent",
      "/bodies/planet.fixture/parentBodyId"
    );
    const first = body("planet.first", "planet.second");
    const second = body("planet.second", "planet.first");
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null), first, second])),
      "ParentCycle"
    );
  });

  it("rejects invalid physical values and inconsistent mass/mu pairs", () => {
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null, { radiusMeters: 0 })])),
      "OutOfRange"
    );
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null, { massKg: Number.NaN })])),
      "InvalidNumber"
    );
    expectCelestialError(
      () =>
        createCelestialCatalog(
          catalog([
            body("star.fixture", null, {
              gravity: {
                schemaVersion: CELESTIAL_SCHEMA_VERSION,
                gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 2e22,
                canBeDominantSource: true
              }
            })
          ])
        ),
      "InconsistentMassMu"
    );
  });

  it("rejects unsupported root and nested schema versions", () => {
    expectCelestialError(
      () => createCelestialCatalog(catalog([body("star.fixture", null)], 2)),
      "UnsupportedSchemaVersion",
      "/schemaVersion"
    );
    const invalidNested = body("star.fixture", null, {
      gravity: { schemaVersion: 2, gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 1e22, canBeDominantSource: true }
    });
    expectCelestialError(
      () => createCelestialCatalog(catalog([invalidNested])),
      "UnsupportedSchemaVersion",
      "/bodies/star.fixture/gravity/schemaVersion"
    );
  });

  it("rejects non-finite, undefined, sparse, and cyclic canonical JSON", () => {
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = "present";
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expectCelestialError(() => canonicalCelestialJson({ value: Number.POSITIVE_INFINITY }), "InvalidCanonicalJson");
    expectCelestialError(() => canonicalCelestialJson({ value: undefined }), "InvalidCanonicalJson");
    expectCelestialError(() => canonicalCelestialJson(sparse), "InvalidCanonicalJson");
    expectCelestialError(() => canonicalCelestialJson(cyclic), "InvalidCanonicalJson");
  });

  it("accepts the reconciled starter dataset under all validation gates", () => {
    expect(() => createStarterCelestialCatalog()).not.toThrow();
  });
});
