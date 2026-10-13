import { createCelestialCatalog } from "./catalog";
import {
  CELESTIAL_SCHEMA_VERSION,
  type AtmosphereDefinitionInput,
  type CelestialBodyDefinitionInput,
  type CelestialBodyType,
  type OrbitDefinitionInput,
  type RotationDefinitionInput,
  type SurfaceAccessMode
} from "./types";
import { GRAVITATIONAL_CONSTANT } from "./validation";

export const ASTRONOMICAL_UNIT_METERS = 149_597_870_700;
export const SOLAR_RADIUS_METERS = 695_700_000;
export const SOLAR_MASS_KG = 1.98847e30;
export const EARTH_MASS_KG = 5.9722e24;
export const LUNAR_MASS_KG = 7.342e22;
export const DAY_SECONDS = 86_400;

export const STARTER_BODY_IDS = Object.freeze({
  aurelia: "star.aurelia",
  korus: "planet.korus",
  pyra: "planet.pyra",
  hestia: "planet.hestia",
  tharos: "planet.tharos",
  aureon: "planet.aureon",
  nereion: "planet.nereion",
  umbra: "planet.umbra",
  luma: "moon.hestia.luma",
  sela: "moon.hestia.sela",
  nixia: "moon.hestia.nixia",
  oru: "moon.hestia.oru",
  eber: "asteroid.eber",
  kallisto: "asteroid.kallisto",
  minoa: "asteroid.minoa"
} as const);

const identityVisualScale = () => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  mapRadiusScale: 1,
  localRadiusScale: 1,
  impostorRadiusScale: 1,
  renderOnly: true as const
});

const deferredGameplay = () => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  mode: "Deferred" as const,
  tags: [] as const
});

const circularOrbit = (parentBodyId: string, semiMajorAxisMeters: number): OrbitDefinitionInput => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  parentBodyId,
  semiMajorAxisMeters,
  eccentricity: 0,
  inclinationDegrees: 0,
  longitudeOfAscendingNodeDegrees: 0,
  argumentOfPeriapsisDegrees: 0,
  meanAnomalyAtEpochDegrees: 0
});

interface BodySeed {
  readonly bodyId: string;
  readonly displayName: string;
  readonly bodyType: CelestialBodyType;
  readonly parentBodyId: string | null;
  readonly radiusMeters: number;
  readonly massKg: number;
  readonly gravitationalParameterMu: number;
  readonly orbit: OrbitDefinitionInput | null;
  readonly surfaceAccessMode: SurfaceAccessMode;
  readonly rotation?: RotationDefinitionInput;
  readonly atmosphere?: AtmosphereDefinitionInput;
}

const body = (seed: BodySeed): CelestialBodyDefinitionInput => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  bodyId: seed.bodyId,
  displayName: seed.displayName,
  bodyType: seed.bodyType,
  parentBodyId: seed.parentBodyId,
  radiusMeters: seed.radiusMeters,
  massKg: seed.massKg,
  gravity: {
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    gravitationalParameterMu: seed.gravitationalParameterMu,
    canBeDominantSource: true
  },
  orbit: seed.orbit,
  rotation: seed.rotation ?? null,
  atmosphere: seed.atmosphere ?? null,
  visualScale: identityVisualScale(),
  surfaceAccess: { schemaVersion: CELESTIAL_SCHEMA_VERSION, mode: seed.surfaceAccessMode },
  gameplayAccess: deferredGameplay()
});

const starterBodies: readonly CelestialBodyDefinitionInput[] = Object.freeze([
  body({
    bodyId: STARTER_BODY_IDS.aurelia,
    displayName: "Aurelia",
    bodyType: "Star",
    parentBodyId: null,
    radiusMeters: 0.75 * SOLAR_RADIUS_METERS,
    massKg: 0.78 * SOLAR_MASS_KG,
    gravitationalParameterMu: 1.035e20,
    orbit: null,
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.korus,
    displayName: "Korus",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 2_421_000,
    massKg: 0.055 * EARTH_MASS_KG,
    gravitationalParameterMu: 2.19e13,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.16 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.pyra,
    displayName: "Pyra",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 6_052_000,
    massKg: 0.82 * EARTH_MASS_KG,
    gravitationalParameterMu: 3.27e14,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.31 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.hestia,
    displayName: "Hestia",
    bodyType: "SuperEarth",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 8_282_000,
    massKg: 1.21e25,
    gravitationalParameterMu: 8.09e14,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.6 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred",
    rotation: {
      schemaVersion: CELESTIAL_SCHEMA_VERSION,
      rotationPeriodSeconds: 36 * 3_600,
      axialTiltDegrees: 10,
      retrograde: false,
      primeMeridianAtEpochDegrees: 0
    },
    atmosphere: {
      schemaVersion: CELESTIAL_SCHEMA_VERSION,
      hasAtmosphere: true,
      surfacePressurePa: 145_000,
      hazards: ["HighPressure", "HighOxygen", "Storms"]
    }
  }),
  body({
    bodyId: STARTER_BODY_IDS.tharos,
    displayName: "Tharos",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 3_695_000,
    massKg: 0.12 * EARTH_MASS_KG,
    gravitationalParameterMu: 4.78e13,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.95 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.aureon,
    displayName: "Aureon",
    bodyType: "GasGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 68_807_000,
    massKg: 210 * EARTH_MASS_KG,
    gravitationalParameterMu: 8.37e16,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 3 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.nereion,
    displayName: "Nereion",
    bodyType: "IceGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 25_484_000,
    massKg: 15 * EARTH_MASS_KG,
    gravitationalParameterMu: 5.98e15,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 6.4 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.umbra,
    displayName: "Umbra",
    bodyType: "IceGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 22_298_000,
    massKg: 9 * EARTH_MASS_KG,
    gravitationalParameterMu: 3.59e15,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 11.5 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.luma,
    displayName: "Luma",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 650_000,
    massKg: 0.049 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.049 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 100_000_000),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.sela,
    displayName: "Sela",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 430_000,
    massKg: 0.013 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.013 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 158_700_000),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.nixia,
    displayName: "Nixia",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 300_000,
    massKg: 0.004 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.004 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 252_000_000),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.oru,
    displayName: "Oru",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 210_000,
    massKg: 0.0013 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.0013 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 400_000_000),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.eber,
    displayName: "Eber",
    bodyType: "Asteroid",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 390_000,
    massKg: 5e20,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 5e20,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 1.32 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.kallisto,
    displayName: "Kallisto",
    bodyType: "Asteroid",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 260_000,
    massKg: 1.6e20,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 1.6e20,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 1.48 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.minoa,
    displayName: "Minoa",
    bodyType: "Asteroid",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 155_000,
    massKg: 4e19,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 4e19,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 1.67 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "OrbitOnly"
  })
]);

export const createStarterCelestialCatalog = () =>
  createCelestialCatalog({
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    catalogId: "catalog.aurelia.v1",
    bodies: starterBodies
  });

export const STARTER_CELESTIAL_CATALOG = createStarterCelestialCatalog();
export const STARTER_CELESTIAL_CATALOG_SIGNATURE = STARTER_CELESTIAL_CATALOG.signature;
