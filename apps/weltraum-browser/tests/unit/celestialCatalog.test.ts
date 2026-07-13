import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  CelestialError,
  bodyIdsForType,
  canonicalCelestialJson,
  childBodyIdsFor,
  createCelestialCatalog,
  createStarterCelestialCatalog,
  requireCelestialBody
} from "../../src/celestial";

const expectCelestialError = (action: () => unknown, code: CelestialError["code"], path: string): void => {
  try {
    action();
    throw new Error(`Expected CelestialError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CelestialError);
    expect((error as CelestialError).code).toBe(code);
    expect((error as CelestialError).path).toBe(path);
  }
};

const EXPECTED_STARTER_IDS = [
  "asteroid.eber",
  "asteroid.kallisto",
  "asteroid.minoa",
  "moon.hestia.luma",
  "moon.hestia.nixia",
  "moon.hestia.oru",
  "moon.hestia.sela",
  "planet.aureon",
  "planet.hestia",
  "planet.korus",
  "planet.nereion",
  "planet.pyra",
  "planet.tharos",
  "planet.umbra",
  "star.aurelia"
];

describe("starter celestial catalog", () => {
  it("contains only the 15 source-documented bodies with stable IDs and a single root star", () => {
    const catalog = createStarterCelestialCatalog();

    expect(catalog.catalogId).toBe("catalog.aurelia.v1");
    expect(catalog.rootBodyId).toBe(STARTER_BODY_IDS.aurelia);
    expect(catalog.bodies.map((body) => body.bodyId)).toEqual(EXPECTED_STARTER_IDS);
    expect(catalog.bodies).toHaveLength(15);
    expect(bodyIdsForType(catalog, "Station")).toEqual([]);
    expect(bodyIdsForType(catalog, "ArtificialStructure")).toEqual([]);
    expect(bodyIdsForType(catalog, "Comet")).toEqual([]);
  });

  it("exposes deterministic parent, child, and type indexes", () => {
    const catalog = STARTER_CELESTIAL_CATALOG;

    expect(childBodyIdsFor(catalog, STARTER_BODY_IDS.hestia)).toEqual([
      STARTER_BODY_IDS.luma,
      STARTER_BODY_IDS.nixia,
      STARTER_BODY_IDS.oru,
      STARTER_BODY_IDS.sela
    ]);
    expect(bodyIdsForType(catalog, "Moon")).toEqual([
      STARTER_BODY_IDS.luma,
      STARTER_BODY_IDS.nixia,
      STARTER_BODY_IDS.oru,
      STARTER_BODY_IDS.sela
    ]);
    expect(requireCelestialBody(catalog, STARTER_BODY_IDS.luma).parentBodyId).toBe(STARTER_BODY_IDS.hestia);
    expect(requireCelestialBody(catalog, STARTER_BODY_IDS.hestia).orbit?.parentBodyId).toBe(STARTER_BODY_IDS.aurelia);
  });

  it("canonicalizes catalog registration order without rounding source numbers", () => {
    const forward = createStarterCelestialCatalog();
    const reversed = createCelestialCatalog({
      schemaVersion: forward.schemaVersion,
      catalogId: forward.catalogId,
      bodies: [...forward.bodies].reverse()
    });

    expect(reversed.canonicalJson).toBe(forward.canonicalJson);
    expect(reversed.signature).toBe(forward.signature);
    expect(canonicalCelestialJson({ z: 0.123456789012345, a: -0 })).toBe('{"a":0,"z":0.123456789012345}');
  });

  it("deep-freezes catalog data and null-prototype indexes", () => {
    const catalog = createStarterCelestialCatalog();

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.bodies)).toBe(true);
    expect(Object.isFrozen(catalog.bodies[0])).toBe(true);
    expect(Object.isFrozen(catalog.indexes)).toBe(true);
    expect(Object.isFrozen(catalog.indexes.bodyById)).toBe(true);
    expect(Object.getPrototypeOf(catalog.indexes.bodyById)).toBeNull();
  });

  it("rejects sparse body arrays with a stable catalog error", () => {
    const sparseBodies = new Array(2);
    sparseBodies[0] = STARTER_CELESTIAL_CATALOG.bodies[0];

    expectCelestialError(
      () => createCelestialCatalog({
        schemaVersion: 1,
        catalogId: "catalog.sparse.v1",
        bodies: sparseBodies
      }),
      "InvalidCatalog",
      "/bodies/1"
    );
  });
});
