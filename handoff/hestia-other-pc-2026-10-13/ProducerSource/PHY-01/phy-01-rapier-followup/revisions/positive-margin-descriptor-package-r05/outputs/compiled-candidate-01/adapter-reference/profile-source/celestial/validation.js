import { failCelestial } from "./errors";
import { createCelestialBodyId, isStableCelestialId } from "./ids";
import { CELESTIAL_BODY_TYPES, CELESTIAL_SCHEMA_VERSION } from "./types";
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export const MASS_MU_RELATIVE_TOLERANCE = 0.01;
const bodyTypes = new Set(CELESTIAL_BODY_TYPES);
const atmosphereHazards = new Set([
    "HighPressure",
    "LowPressure",
    "Toxic",
    "Corrosive",
    "HighOxygen",
    "Radiation",
    "Storms",
    "ThermalExtreme"
]);
const surfaceAccessModes = new Set(["Deferred", "OrbitOnly", "NoSolidSurface"]);
const gameplayAccessModes = new Set(["Deferred", "OrbitOnly"]);
export const isCelestialRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
export const assertCelestialSchemaVersion = (value, path) => {
    if (value !== CELESTIAL_SCHEMA_VERSION) {
        return failCelestial("UnsupportedSchemaVersion", path, `Celestial schema version must be exactly ${CELESTIAL_SCHEMA_VERSION}.`);
    }
};
export const requireFiniteNumber = (value, path) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return failCelestial("InvalidNumber", path, "Value must be a finite number.");
    }
    return Object.is(value, -0) ? 0 : value;
};
export const requireFinitePositive = (value, path) => {
    const number = requireFiniteNumber(value, path);
    if (number <= 0) {
        return failCelestial("OutOfRange", path, "Value must be greater than zero.");
    }
    return number;
};
export const requireFiniteNonNegative = (value, path) => {
    const number = requireFiniteNumber(value, path);
    if (number < 0) {
        return failCelestial("OutOfRange", path, "Value must be non-negative.");
    }
    return number;
};
export const requireFiniteVec3 = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidNumber", path, "Value must be a finite three-dimensional vector.");
    }
    return Object.freeze({
        x: requireFiniteNumber(value.x, `${path}/x`),
        y: requireFiniteNumber(value.y, `${path}/y`),
        z: requireFiniteNumber(value.z, `${path}/z`)
    });
};
const requireText = (value, path) => {
    if (typeof value !== "string" || !value.trim()) {
        return failCelestial("InvalidBody", path, "Value must be a non-empty string.");
    }
    return value.trim();
};
const requireBoolean = (value, path) => {
    if (typeof value !== "boolean") {
        return failCelestial("InvalidBody", path, "Value must be boolean.");
    }
    return value;
};
const requireChoice = (value, choices, path) => {
    if (typeof value !== "string" || !choices.has(value)) {
        return failCelestial("InvalidBody", path, "Value is not supported by this schema version.");
    }
    return value;
};
const requireDegrees = (value, path, include360 = false) => {
    const degrees = requireFiniteNumber(value, path);
    const upperValid = include360 ? degrees <= 360 : degrees < 360;
    if (degrees < 0 || !upperValid) {
        return failCelestial("InvalidOrbit", path, include360 ? "Angle must be within [0, 360]." : "Angle must be within [0, 360).");
    }
    return degrees;
};
export const deepFreezeCelestial = (value, seen = new WeakSet()) => {
    if (value === null || typeof value !== "object" || seen.has(value)) {
        return value;
    }
    seen.add(value);
    for (const nested of Object.values(value)) {
        deepFreezeCelestial(nested, seen);
    }
    return Object.freeze(value);
};
const canonicalTokenList = (value, path) => {
    if (!Array.isArray(value) || value.some((entry) => !isStableCelestialId(entry))) {
        return failCelestial("InvalidBody", path, "Tags must be stable lowercase ASCII identifiers.");
    }
    return Object.freeze([...new Set(value)].sort());
};
const createOrbitDefinition = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidOrbit", path, "Orbit definition must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    const eccentricity = requireFiniteNumber(value.eccentricity, `${path}/eccentricity`);
    if (eccentricity < 0 || eccentricity >= 1) {
        return failCelestial("InvalidOrbit", `${path}/eccentricity`, "Bound elliptic eccentricity must satisfy 0 <= e < 1.");
    }
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        parentBodyId: createCelestialBodyId(value.parentBodyId, `${path}/parentBodyId`),
        semiMajorAxisMeters: requireFinitePositive(value.semiMajorAxisMeters, `${path}/semiMajorAxisMeters`),
        eccentricity,
        inclinationDegrees: (() => {
            const inclination = requireFiniteNumber(value.inclinationDegrees, `${path}/inclinationDegrees`);
            if (inclination < 0 || inclination > 180) {
                return failCelestial("InvalidOrbit", `${path}/inclinationDegrees`, "Inclination must be within [0, 180].");
            }
            return inclination;
        })(),
        longitudeOfAscendingNodeDegrees: requireDegrees(value.longitudeOfAscendingNodeDegrees, `${path}/longitudeOfAscendingNodeDegrees`),
        argumentOfPeriapsisDegrees: requireDegrees(value.argumentOfPeriapsisDegrees, `${path}/argumentOfPeriapsisDegrees`),
        meanAnomalyAtEpochDegrees: requireDegrees(value.meanAnomalyAtEpochDegrees, `${path}/meanAnomalyAtEpochDegrees`)
    });
};
const createRotationDefinition = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Rotation definition must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    const axialTiltDegrees = requireFiniteNumber(value.axialTiltDegrees, `${path}/axialTiltDegrees`);
    if (axialTiltDegrees < 0 || axialTiltDegrees > 180) {
        return failCelestial("OutOfRange", `${path}/axialTiltDegrees`, "Axial tilt must be within [0, 180].");
    }
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        rotationPeriodSeconds: requireFinitePositive(value.rotationPeriodSeconds, `${path}/rotationPeriodSeconds`),
        axialTiltDegrees,
        retrograde: requireBoolean(value.retrograde, `${path}/retrograde`),
        primeMeridianAtEpochDegrees: requireDegrees(value.primeMeridianAtEpochDegrees, `${path}/primeMeridianAtEpochDegrees`)
    });
};
const createAtmosphereDefinition = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Atmosphere definition must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    if (!Array.isArray(value.hazards)) {
        return failCelestial("InvalidBody", `${path}/hazards`, "Atmosphere hazards must be an array.");
    }
    const hazards = value.hazards.map((hazard, index) => requireChoice(hazard, atmosphereHazards, `${path}/hazards/${index}`));
    const surfacePressurePa = value.surfacePressurePa === undefined
        ? undefined
        : requireFiniteNonNegative(value.surfacePressurePa, `${path}/surfacePressurePa`);
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        hasAtmosphere: requireBoolean(value.hasAtmosphere, `${path}/hasAtmosphere`),
        ...(surfacePressurePa === undefined ? {} : { surfacePressurePa }),
        hazards: Object.freeze([...new Set(hazards)].sort())
    });
};
const createGravityDefinition = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Gravity definition must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        gravitationalParameterMu: requireFinitePositive(value.gravitationalParameterMu, `${path}/gravitationalParameterMu`),
        canBeDominantSource: requireBoolean(value.canBeDominantSource, `${path}/canBeDominantSource`)
    });
};
const createVisualScaleProfile = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Visual scale profile must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    if (value.renderOnly !== true) {
        return failCelestial("InvalidBody", `${path}/renderOnly`, "Visual scale profiles must be explicitly render-only.");
    }
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        mapRadiusScale: requireFinitePositive(value.mapRadiusScale, `${path}/mapRadiusScale`),
        localRadiusScale: requireFinitePositive(value.localRadiusScale, `${path}/localRadiusScale`),
        impostorRadiusScale: requireFinitePositive(value.impostorRadiusScale, `${path}/impostorRadiusScale`),
        renderOnly: true
    });
};
const createSurfaceAccessProfile = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Surface access profile must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        mode: requireChoice(value.mode, surfaceAccessModes, `${path}/mode`)
    });
};
const createGameplayAccessProfile = (value, path) => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Gameplay access profile must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        mode: requireChoice(value.mode, gameplayAccessModes, `${path}/mode`),
        tags: canonicalTokenList(value.tags, `${path}/tags`)
    });
};
export const createCelestialBodyDefinition = (value, path = "/body") => {
    if (!isCelestialRecord(value)) {
        return failCelestial("InvalidBody", path, "Celestial body definition must be an object.");
    }
    assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
    const bodyId = createCelestialBodyId(value.bodyId, `${path}/bodyId`);
    const parentBodyId = value.parentBodyId === null
        ? null
        : createCelestialBodyId(value.parentBodyId, `${path}/parentBodyId`);
    const radiusMeters = requireFinitePositive(value.radiusMeters, `${path}/radiusMeters`);
    const massKg = requireFinitePositive(value.massKg, `${path}/massKg`);
    const gravity = createGravityDefinition(value.gravity, `${path}/gravity`);
    const expectedMu = GRAVITATIONAL_CONSTANT * massKg;
    const relativeDifference = Math.abs(gravity.gravitationalParameterMu - expectedMu) /
        Math.max(gravity.gravitationalParameterMu, expectedMu);
    if (relativeDifference > MASS_MU_RELATIVE_TOLERANCE) {
        return failCelestial("InconsistentMassMu", `${path}/gravity/gravitationalParameterMu`, `Body ${bodyId} mass and mu differ by more than ${MASS_MU_RELATIVE_TOLERANCE * 100}%.`);
    }
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        bodyId,
        displayName: requireText(value.displayName, `${path}/displayName`),
        bodyType: requireChoice(value.bodyType, bodyTypes, `${path}/bodyType`),
        parentBodyId,
        radiusMeters,
        massKg,
        gravity,
        orbit: value.orbit === null ? null : createOrbitDefinition(value.orbit, `${path}/orbit`),
        rotation: value.rotation === null ? null : createRotationDefinition(value.rotation, `${path}/rotation`),
        atmosphere: value.atmosphere === null ? null : createAtmosphereDefinition(value.atmosphere, `${path}/atmosphere`),
        visualScale: createVisualScaleProfile(value.visualScale, `${path}/visualScale`),
        surfaceAccess: createSurfaceAccessProfile(value.surfaceAccess, `${path}/surfaceAccess`),
        gameplayAccess: createGameplayAccessProfile(value.gameplayAccess, `${path}/gameplayAccess`)
    });
};
