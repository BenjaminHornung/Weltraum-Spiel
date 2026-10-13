// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/core/hash.js
var fnv1aHash = (input) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/errors.js
var CelestialError = class extends Error {
  code;
  path;
  constructor(code, path, message) {
    super(message);
    this.name = "CelestialError";
    this.code = code;
    this.path = path;
  }
};
var failCelestial = (code, path, message) => {
  throw new CelestialError(code, path, message);
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/canonical.js
var isPlainRecord = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
var requireDenseArray = (value, path) => {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return failCelestial("InvalidCanonicalJson", `${path}/${index}`, "Canonical celestial JSON rejects sparse arrays.");
    }
  }
};
var canonicalize = (value, path, ancestors) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects non-finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects cycles.");
    }
    requireDenseArray(value, path);
    ancestors.add(value);
    const result2 = value.map((entry, index) => canonicalize(entry, `${path}/${index}`, ancestors));
    ancestors.delete(value);
    return Object.freeze(result2);
  }
  if (!isPlainRecord(value)) {
    return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON accepts only plain JSON values.");
  }
  if (ancestors.has(value)) {
    return failCelestial("InvalidCanonicalJson", path, "Canonical celestial JSON rejects cycles.");
  }
  ancestors.add(value);
  const result = /* @__PURE__ */ Object.create(null);
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (entry === void 0) {
      return failCelestial("InvalidCanonicalJson", `${path}/${key}`, "Canonical celestial JSON rejects undefined values.");
    }
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      value: canonicalize(entry, `${path}/${key}`, ancestors),
      writable: false
    });
  }
  ancestors.delete(value);
  return Object.freeze(result);
};
var canonicalizeCelestialValue = (value) => canonicalize(value, "", /* @__PURE__ */ new WeakSet());
var serialize = (value) => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    const serialized = JSON.stringify(value);
    return serialized ?? failCelestial("InvalidCanonicalJson", "", "Canonical celestial JSON could not serialize a value.");
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  const record = value;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(",")}}`;
};
var canonicalCelestialJson = (value) => serialize(canonicalizeCelestialValue(value));
var celestialSignature = (value) => fnv1aHash(canonicalCelestialJson(value));

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/ids.js
var stableCelestialIdPattern = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
var isStableCelestialId = (value) => typeof value === "string" && stableCelestialIdPattern.test(value);
var createStableId = (value, path, label) => {
  if (!isStableCelestialId(value)) {
    return failCelestial("InvalidId", path, `${label} must be lowercase ASCII with dot- or underscore-separated alphanumeric segments.`);
  }
  return value;
};
var createCelestialBodyId = (value, path = "/bodyId") => createStableId(value, path, "Celestial body ID");
var createCelestialCatalogId = (value, path = "/catalogId") => createStableId(value, path, "Celestial catalog ID");

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/types.js
var CELESTIAL_SCHEMA_VERSION = 1;
var CELESTIAL_BODY_TYPES = [
  "Star",
  "RockyPlanet",
  "SuperEarth",
  "GasGiant",
  "IceGiant",
  "Moon",
  "Asteroid",
  "Comet",
  "Station",
  "ArtificialStructure"
];

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/validation.js
var GRAVITATIONAL_CONSTANT = 66743e-15;
var MASS_MU_RELATIVE_TOLERANCE = 0.01;
var bodyTypes = new Set(CELESTIAL_BODY_TYPES);
var atmosphereHazards = /* @__PURE__ */ new Set([
  "HighPressure",
  "LowPressure",
  "Toxic",
  "Corrosive",
  "HighOxygen",
  "Radiation",
  "Storms",
  "ThermalExtreme"
]);
var surfaceAccessModes = /* @__PURE__ */ new Set(["Deferred", "OrbitOnly", "NoSolidSurface"]);
var gameplayAccessModes = /* @__PURE__ */ new Set(["Deferred", "OrbitOnly"]);
var isCelestialRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var assertCelestialSchemaVersion = (value, path) => {
  if (value !== CELESTIAL_SCHEMA_VERSION) {
    return failCelestial("UnsupportedSchemaVersion", path, `Celestial schema version must be exactly ${CELESTIAL_SCHEMA_VERSION}.`);
  }
};
var requireFiniteNumber = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return failCelestial("InvalidNumber", path, "Value must be a finite number.");
  }
  return Object.is(value, -0) ? 0 : value;
};
var requireFinitePositive = (value, path) => {
  const number2 = requireFiniteNumber(value, path);
  if (number2 <= 0) {
    return failCelestial("OutOfRange", path, "Value must be greater than zero.");
  }
  return number2;
};
var requireFiniteNonNegative = (value, path) => {
  const number2 = requireFiniteNumber(value, path);
  if (number2 < 0) {
    return failCelestial("OutOfRange", path, "Value must be non-negative.");
  }
  return number2;
};
var requireText = (value, path) => {
  if (typeof value !== "string" || !value.trim()) {
    return failCelestial("InvalidBody", path, "Value must be a non-empty string.");
  }
  return value.trim();
};
var requireBoolean = (value, path) => {
  if (typeof value !== "boolean") {
    return failCelestial("InvalidBody", path, "Value must be boolean.");
  }
  return value;
};
var requireChoice = (value, choices, path) => {
  if (typeof value !== "string" || !choices.has(value)) {
    return failCelestial("InvalidBody", path, "Value is not supported by this schema version.");
  }
  return value;
};
var requireDegrees = (value, path, include360 = false) => {
  const degrees = requireFiniteNumber(value, path);
  const upperValid = include360 ? degrees <= 360 : degrees < 360;
  if (degrees < 0 || !upperValid) {
    return failCelestial("InvalidOrbit", path, include360 ? "Angle must be within [0, 360]." : "Angle must be within [0, 360).");
  }
  return degrees;
};
var deepFreezeCelestial = (value, seen = /* @__PURE__ */ new WeakSet()) => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreezeCelestial(nested, seen);
  }
  return Object.freeze(value);
};
var canonicalTokenList = (value, path) => {
  if (!Array.isArray(value) || value.some((entry) => !isStableCelestialId(entry))) {
    return failCelestial("InvalidBody", path, "Tags must be stable lowercase ASCII identifiers.");
  }
  return Object.freeze([...new Set(value)].sort());
};
var createOrbitDefinition = (value, path) => {
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
var createRotationDefinition = (value, path) => {
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
var createAtmosphereDefinition = (value, path) => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidBody", path, "Atmosphere definition must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
  if (!Array.isArray(value.hazards)) {
    return failCelestial("InvalidBody", `${path}/hazards`, "Atmosphere hazards must be an array.");
  }
  const hazards = value.hazards.map((hazard, index) => requireChoice(hazard, atmosphereHazards, `${path}/hazards/${index}`));
  const surfacePressurePa = value.surfacePressurePa === void 0 ? void 0 : requireFiniteNonNegative(value.surfacePressurePa, `${path}/surfacePressurePa`);
  return deepFreezeCelestial({
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    hasAtmosphere: requireBoolean(value.hasAtmosphere, `${path}/hasAtmosphere`),
    ...surfacePressurePa === void 0 ? {} : { surfacePressurePa },
    hazards: Object.freeze([...new Set(hazards)].sort())
  });
};
var createGravityDefinition = (value, path) => {
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
var createVisualScaleProfile = (value, path) => {
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
var createSurfaceAccessProfile = (value, path) => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidBody", path, "Surface access profile must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
  return deepFreezeCelestial({
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    mode: requireChoice(value.mode, surfaceAccessModes, `${path}/mode`)
  });
};
var createGameplayAccessProfile = (value, path) => {
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
var createCelestialBodyDefinition = (value, path = "/body") => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidBody", path, "Celestial body definition must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, `${path}/schemaVersion`);
  const bodyId = createCelestialBodyId(value.bodyId, `${path}/bodyId`);
  const parentBodyId = value.parentBodyId === null ? null : createCelestialBodyId(value.parentBodyId, `${path}/parentBodyId`);
  const radiusMeters = requireFinitePositive(value.radiusMeters, `${path}/radiusMeters`);
  const massKg = requireFinitePositive(value.massKg, `${path}/massKg`);
  const gravity = createGravityDefinition(value.gravity, `${path}/gravity`);
  const expectedMu = GRAVITATIONAL_CONSTANT * massKg;
  const relativeDifference = Math.abs(gravity.gravitationalParameterMu - expectedMu) / Math.max(gravity.gravitationalParameterMu, expectedMu);
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

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/catalog.js
var compareIds = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var frozenRecord = (entries) => {
  const record = /* @__PURE__ */ Object.create(null);
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
var validateParentGraph = (bodies) => {
  const bodyById = new Map(bodies.map((body2) => [body2.bodyId, body2]));
  for (const body2 of bodies) {
    if (body2.parentBodyId !== null && !bodyById.has(body2.parentBodyId)) {
      return failCelestial("UnknownParent", `/bodies/${body2.bodyId}/parentBodyId`, `Unknown parent ${body2.parentBodyId}.`);
    }
  }
  for (const body2 of bodies) {
    if (body2.parentBodyId === null) {
      if (body2.orbit !== null) {
        return failCelestial("RootOrbitMismatch", `/bodies/${body2.bodyId}/orbit`, "A root body cannot declare an orbit.");
      }
    } else if (body2.orbit === null || body2.orbit.parentBodyId !== body2.parentBodyId) {
      return failCelestial("ParentOrbitMismatch", `/bodies/${body2.bodyId}/orbit`, "A non-root body needs one orbit whose parent matches parentBodyId.");
    }
  }
  const visitState = /* @__PURE__ */ new Map();
  const visit = (body2) => {
    const state = visitState.get(body2.bodyId);
    if (state === "Visiting") {
      return failCelestial("ParentCycle", `/bodies/${body2.bodyId}/parentBodyId`, `Parent cycle includes ${body2.bodyId}.`);
    }
    if (state === "Done") {
      return;
    }
    visitState.set(body2.bodyId, "Visiting");
    if (body2.parentBodyId !== null) {
      const parent = bodyById.get(body2.parentBodyId);
      if (parent) {
        visit(parent);
      }
    }
    visitState.set(body2.bodyId, "Done");
  };
  bodies.forEach(visit);
  const roots = bodies.filter((body2) => body2.parentBodyId === null);
  if (roots.length !== 1 || roots[0].bodyType !== "Star") {
    return failCelestial("InvalidCatalog", "/bodies", "A celestial catalog requires exactly one root Star.");
  }
  return roots[0].bodyId;
};
var buildIndexes = (bodies) => {
  const bodyById = frozenRecord(bodies.map((body2) => [body2.bodyId, body2]));
  const children = new Map(bodies.map((body2) => [body2.bodyId, []]));
  for (const body2 of bodies) {
    if (body2.parentBodyId !== null) {
      children.get(body2.parentBodyId)?.push(body2.bodyId);
    }
  }
  const childIdsByParentId = frozenRecord(bodies.map((body2) => [body2.bodyId, Object.freeze([...children.get(body2.bodyId) ?? []].sort(compareIds))]));
  const bodyIdsByType = frozenRecord(CELESTIAL_BODY_TYPES.map((bodyType) => [
    bodyType,
    Object.freeze(bodies.filter((body2) => body2.bodyType === bodyType).map((body2) => body2.bodyId))
  ]));
  return deepFreezeCelestial({ bodyById, childIdsByParentId, bodyIdsByType });
};
var catalogPayload = (catalog) => ({
  schemaVersion: catalog.schemaVersion,
  catalogId: catalog.catalogId,
  bodies: catalog.bodies
});
var createCelestialCatalog = (value) => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidCatalog", "", "Celestial catalog must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, "/schemaVersion");
  const catalogId = createCelestialCatalogId(value.catalogId, "/catalogId");
  if (!Array.isArray(value.bodies) || value.bodies.length === 0) {
    return failCelestial("InvalidCatalog", "/bodies", "Celestial catalog bodies must be a non-empty array.");
  }
  for (let index = 0; index < value.bodies.length; index += 1) {
    if (!Object.hasOwn(value.bodies, index)) {
      return failCelestial("InvalidCatalog", `/bodies/${index}`, "Celestial catalog bodies must be a dense array.");
    }
  }
  const rawBodies = value.bodies.map((entry, index) => {
    if (!isCelestialRecord(entry)) {
      return failCelestial("InvalidBody", `/bodies/${index}`, "Celestial body must be an object.");
    }
    return { bodyId: createCelestialBodyId(entry.bodyId, `/bodies/${index}/bodyId`), entry };
  });
  const seen = /* @__PURE__ */ new Set();
  for (const { bodyId } of [...rawBodies].sort((a, b) => compareIds(a.bodyId, b.bodyId))) {
    if (seen.has(bodyId)) {
      return failCelestial("DuplicateBodyId", `/bodies/${bodyId}/bodyId`, `Duplicate celestial body ID ${bodyId}.`);
    }
    seen.add(bodyId);
  }
  const bodies = Object.freeze(rawBodies.sort((a, b) => compareIds(a.bodyId, b.bodyId)).map(({ bodyId, entry }) => createCelestialBodyDefinition(entry, `/bodies/${bodyId}`)));
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
var findCelestialBody = (catalog, bodyId) => catalog.indexes.bodyById[bodyId];
var requireCelestialBody = (catalog, bodyId) => findCelestialBody(catalog, bodyId) ?? failCelestial("InvalidCatalog", `/indexes/bodyById/${bodyId}`, `Catalog does not contain body ${bodyId}.`);

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/starterSystem.js
var ASTRONOMICAL_UNIT_METERS = 149597870700;
var SOLAR_RADIUS_METERS = 6957e5;
var SOLAR_MASS_KG = 198847e25;
var EARTH_MASS_KG = 59722e20;
var LUNAR_MASS_KG = 7342e19;
var STARTER_BODY_IDS = Object.freeze({
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
});
var identityVisualScale = () => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  mapRadiusScale: 1,
  localRadiusScale: 1,
  impostorRadiusScale: 1,
  renderOnly: true
});
var deferredGameplay = () => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  mode: "Deferred",
  tags: []
});
var circularOrbit = (parentBodyId, semiMajorAxisMeters) => ({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  parentBodyId,
  semiMajorAxisMeters,
  eccentricity: 0,
  inclinationDegrees: 0,
  longitudeOfAscendingNodeDegrees: 0,
  argumentOfPeriapsisDegrees: 0,
  meanAnomalyAtEpochDegrees: 0
});
var body = (seed) => ({
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
var starterBodies = Object.freeze([
  body({
    bodyId: STARTER_BODY_IDS.aurelia,
    displayName: "Aurelia",
    bodyType: "Star",
    parentBodyId: null,
    radiusMeters: 0.75 * SOLAR_RADIUS_METERS,
    massKg: 0.78 * SOLAR_MASS_KG,
    gravitationalParameterMu: 1035e17,
    orbit: null,
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.korus,
    displayName: "Korus",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 2421e3,
    massKg: 0.055 * EARTH_MASS_KG,
    gravitationalParameterMu: 219e11,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.16 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.pyra,
    displayName: "Pyra",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 6052e3,
    massKg: 0.82 * EARTH_MASS_KG,
    gravitationalParameterMu: 327e12,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.31 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.hestia,
    displayName: "Hestia",
    bodyType: "SuperEarth",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 8282e3,
    massKg: 121e23,
    gravitationalParameterMu: 809e12,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.6 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred",
    rotation: {
      schemaVersion: CELESTIAL_SCHEMA_VERSION,
      rotationPeriodSeconds: 36 * 3600,
      axialTiltDegrees: 10,
      retrograde: false,
      primeMeridianAtEpochDegrees: 0
    },
    atmosphere: {
      schemaVersion: CELESTIAL_SCHEMA_VERSION,
      hasAtmosphere: true,
      surfacePressurePa: 145e3,
      hazards: ["HighPressure", "HighOxygen", "Storms"]
    }
  }),
  body({
    bodyId: STARTER_BODY_IDS.tharos,
    displayName: "Tharos",
    bodyType: "RockyPlanet",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 3695e3,
    massKg: 0.12 * EARTH_MASS_KG,
    gravitationalParameterMu: 478e11,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 0.95 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "Deferred"
  }),
  body({
    bodyId: STARTER_BODY_IDS.aureon,
    displayName: "Aureon",
    bodyType: "GasGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 68807e3,
    massKg: 210 * EARTH_MASS_KG,
    gravitationalParameterMu: 837e14,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 3 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.nereion,
    displayName: "Nereion",
    bodyType: "IceGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 25484e3,
    massKg: 15 * EARTH_MASS_KG,
    gravitationalParameterMu: 598e13,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 6.4 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.umbra,
    displayName: "Umbra",
    bodyType: "IceGiant",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 22298e3,
    massKg: 9 * EARTH_MASS_KG,
    gravitationalParameterMu: 359e13,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 11.5 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "NoSolidSurface"
  }),
  body({
    bodyId: STARTER_BODY_IDS.luma,
    displayName: "Luma",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 65e4,
    massKg: 0.049 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.049 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 1e8),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.sela,
    displayName: "Sela",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 43e4,
    massKg: 0.013 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 0.013 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 1587e5),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.nixia,
    displayName: "Nixia",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 3e5,
    massKg: 4e-3 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 4e-3 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 252e6),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.oru,
    displayName: "Oru",
    bodyType: "Moon",
    parentBodyId: STARTER_BODY_IDS.hestia,
    radiusMeters: 21e4,
    massKg: 13e-4 * LUNAR_MASS_KG,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 13e-4 * LUNAR_MASS_KG,
    orbit: circularOrbit(STARTER_BODY_IDS.hestia, 4e8),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.eber,
    displayName: "Eber",
    bodyType: "Asteroid",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 39e4,
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
    radiusMeters: 26e4,
    massKg: 16e19,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 16e19,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 1.48 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "OrbitOnly"
  }),
  body({
    bodyId: STARTER_BODY_IDS.minoa,
    displayName: "Minoa",
    bodyType: "Asteroid",
    parentBodyId: STARTER_BODY_IDS.aurelia,
    radiusMeters: 155e3,
    massKg: 4e19,
    gravitationalParameterMu: GRAVITATIONAL_CONSTANT * 4e19,
    orbit: circularOrbit(STARTER_BODY_IDS.aurelia, 1.67 * ASTRONOMICAL_UNIT_METERS),
    surfaceAccessMode: "OrbitOnly"
  })
]);
var createStarterCelestialCatalog = () => createCelestialCatalog({
  schemaVersion: CELESTIAL_SCHEMA_VERSION,
  catalogId: "catalog.aurelia.v1",
  bodies: starterBodies
});
var STARTER_CELESTIAL_CATALOG = createStarterCelestialCatalog();
var STARTER_CELESTIAL_CATALOG_SIGNATURE = STARTER_CELESTIAL_CATALOG.signature;

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/celestial/kepler.js
var TWO_PI = Math.PI * 2;
var DEGREES_TO_RADIANS = Math.PI / 180;
var requireFinitePositiveResult = (value, path, label) => {
  const result = requireFiniteNumber(value, path);
  if (result <= 0) {
    return failCelestial("InvalidNumber", path, `${label} must be finite and greater than zero.`);
  }
  return result;
};
var DEFAULT_KEPLER_SOLVER_OPTIONS = Object.freeze({
  toleranceRadians: 1e-13,
  maxIterations: 32
});
var orbitalPeriodSeconds = (semiMajorAxisMeters, parentMu) => {
  const semiMajorAxis = requireFinitePositive(semiMajorAxisMeters, "/orbit/semiMajorAxisMeters");
  const mu = requireFinitePositive(parentMu, "/parentMu");
  return requireFinitePositiveResult(TWO_PI * Math.sqrt(semiMajorAxis ** 3 / mu), "/orbitalPeriodSeconds", "Orbital period");
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/persistence/time.js
var UniverseTimeError = class extends Error {
  code;
  path;
  constructor(code, path, message) {
    super(message);
    this.name = "UniverseTimeError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var createSimulationTick = (value, path = "/tick") => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new UniverseTimeError("INVALID_TICK", path, "Simulation tick must be a nonnegative safe integer.");
  }
  return Object.is(value, -0) ? 0 : value;
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/persistence/ids.js
var MAX_STABLE_ID_LENGTH = 128;
var STABLE_ID_PREFIXES = Object.freeze({
  save: "save:",
  player: "player:",
  ship: "ship:",
  drone: "drone:",
  station: "station:",
  base: "base:",
  mission: "mission:",
  encounter: "encounter:",
  event: "event:",
  container: "container:",
  site: "site:",
  "resource-node": "resource-node:",
  "ship-variant": "ship-variant:"
});
var STABLE_ID_CLASSIFICATIONS = Object.freeze({
  save: "Instance",
  player: "Instance",
  ship: "Instance",
  drone: "Instance",
  station: "Instance",
  base: "Instance",
  mission: "Instance",
  encounter: "Instance",
  event: "Instance",
  container: "Instance",
  site: "Instance",
  "resource-node": "Instance",
  "ship-variant": "Definition"
});
var stableIdKinds = Object.freeze(Object.keys(STABLE_ID_PREFIXES));
var externalReferencePattern = /^[a-z][a-z0-9-]*:[a-z0-9._-]+$/;
var StableIdError = class extends Error {
  code;
  path;
  constructor(code, path, message) {
    super(message);
    this.name = "StableIdError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var isAscii = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 127) {
      return false;
    }
  }
  return true;
};
var parseExternalReferenceId = (value, path = "") => {
  if (typeof value !== "string" || value.length > MAX_STABLE_ID_LENGTH || !isAscii(value) || !externalReferencePattern.test(value)) {
    throw new StableIdError("INVALID_STABLE_ID", path, "Expected a stable lowercase ASCII reference identifier.");
  }
  return value;
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/spatial/errors.js
var SpatialError = class extends Error {
  code;
  path;
  constructor(code, path, message) {
    super(message);
    this.code = code;
    this.path = path;
    this.name = "SpatialError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var failSpatial = (code, path, message) => {
  throw new SpatialError(code, path, message);
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/snapshot/product/spatial/ids.js
var parseFrameId = (value, path = "") => {
  const parsed = parseExternalReferenceId(value, path);
  if (!parsed.startsWith("frame:")) {
    return failSpatial("INVALID_FRAME_ID", path, "Frame ID must use the frame: namespace.");
  }
  return parsed;
};
var createBodyFixedFrameId = (bodyId) => parseFrameId(`frame:body-fixed.${bodyId}`);

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/vendor/plt/src/numerics.mjs
var MAX_TICK = BigInt(Number.MAX_SAFE_INTEGER);
var normalizeIdentity = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Identity must be a nonempty string.");
  }
  for (let index = 0; index < value.length; index += 1) {
    const unit2 = value.charCodeAt(index);
    if (unit2 >= 55296 && unit2 <= 56319) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 56320 && next <= 57343)) {
        throw new TypeError("Identity contains an isolated surrogate.");
      }
      index += 1;
    } else if (unit2 >= 56320 && unit2 <= 57343) {
      throw new TypeError("Identity contains an isolated surrogate.");
    }
  }
  const normalized = value.normalize("NFC");
  if (new TextEncoder().encode(normalized).byteLength > 256) {
    throw new RangeError("Identity exceeds 256 UTF-8 bytes.");
  }
  return normalized;
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/src/model-pin.js
var IMPLEMENTATION_DIGEST = "sha256:6a51ff1ab2ca347befe5aca796e230034368671abb98d1fe83a504025ed20c4e";

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/dist/src/contracts.js
var ContractError = class extends Error {
  code;
  path;
  constructor(code, path) {
    super(`${code}:${path}`);
    this.code = code;
    this.path = path;
    this.name = "ContractError";
  }
};
function fail(code, path) {
  throw new ContractError(code, path);
}
var clone = (v) => canonicalizeCelestialValue(v);
var keys = (v, names, path) => {
  if (v === null || typeof v !== "object" || Array.isArray(v))
    fail("OBJECT_REQUIRED", path);
  const actual = Object.keys(v).sort();
  if (actual.join("|") !== [...names].sort().join("|"))
    fail("SCHEMA_KEYS", path);
};
var finite = (v, min, max, path) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail("NUMBER_RANGE", path);
  return v;
};
var identity = (v, path) => {
  if (typeof v !== "string")
    return fail("IDENTITY", path);
  try {
    if (normalizeIdentity(v) !== v)
      fail("NONCANONICAL_IDENTITY", path);
  } catch {
    fail("IDENTITY", path);
  }
  return v;
};
var digest = (v, path) => {
  if (typeof v !== "string" || !/^sha256:[a-f0-9]{64}$/.test(v))
    fail("DIGEST", path);
  return v;
};
var exactRef = (v) => ({ id: v.id, version: v.version, digest: v.digest });
function validateExactRef(v, path = "/ref") {
  keys(v, ["id", "version", "digest"], path);
  identity(v.id, path + "/id");
  digest(v.digest, path + "/digest");
  if (!Number.isSafeInteger(v.version) || v.version < 1)
    fail("VERSION", path);
}
var same = (a, b, path) => {
  if (canonicalCelestialJson(a) !== canonicalCelestialJson(b))
    fail("REFERENCE_MISMATCH", path);
};
async function contentDigest(v) {
  const bytes = new TextEncoder().encode(canonicalCelestialJson(v));
  const output = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return "sha256:" + Array.from(output, (x) => x.toString(16).padStart(2, "0")).join("");
}
async function self(v, path) {
  validateExactRef(exactRef(v), path);
  const { digest: actual, ...payload } = v;
  if (await contentDigest(payload) !== actual)
    fail("PROFILE_DIGEST", path);
}
function provenance(v, path) {
  keys(v, ["kind", "note"], path);
  if (!["Catalog", "TestAssumption", "Unavailable"].includes(v.kind))
    fail("PROVENANCE", path);
  identity(v.note, path + "/note");
}
function range(v, positive, path) {
  if (!Array.isArray(v) || v.length !== 2)
    fail("RANGE", path);
  finite(v[0], positive ? Number.MIN_VALUE : 0, Number.MAX_VALUE, path);
  finite(v[1], v[0], Number.MAX_VALUE, path);
}
function vector(v, nonnegative, path) {
  keys(v, ["x", "y", "z"], path);
  for (const k of ["x", "y", "z"])
    finite(v[k], nonnegative ? 0 : -Number.MAX_VALUE, Number.MAX_VALUE, path + "/" + k);
}
function uniqueIds(values, path) {
  if (!Array.isArray(values))
    fail("ARRAY", path);
  values.forEach((v) => identity(v, path));
  if (new Set(values).size !== values.length)
    fail("DUPLICATE_ID", path);
  if ([...values].sort().join("|") !== values.join("|"))
    fail("CANONICAL_ORDER", path);
}
async function validateBundle(input) {
  const f = clone(input);
  keys(f, ["name", "catalog", "physics", "optics", "profile", "binding", "query", "records", "geography", "climate", "events"], "/bundle");
  identity(f.name, "/name");
  const catalog = createCelestialCatalog({ schemaVersion: f.catalog.schemaVersion, catalogId: f.catalog.catalogId, bodies: f.catalog.bodies });
  same(f.catalog, catalog, "/catalog");
  same(catalog, STARTER_CELESTIAL_CATALOG, "/catalog/frozen-source");
  const p = f.physics;
  keys(p, ["id", "version", "digest", "schema", "body", "star", "ephemeris", "frameId", "units", "radiusMeters", "rotation", "hasAtmosphere", "classificationProvenance", "referencePressurePa", "pressureCoordinate", "hazards", "temperatureRangeK", "pressureRangePa", "gasMixture", "thermodynamics", "condensibleSpecies", "aerosolSpecies", "scaleHeightMeters", "outerRadiusMeters", "bondAlbedo", "internalHeatFluxWPerM2", "assumptionProvenance"], "/physics");
  if (p.schema !== "cel.atmosphere-physics/v1")
    fail("SCHEMA", "/physics");
  await self(p, "/physics");
  const body2 = requireCelestialBody(catalog, p.body.id);
  const star = requireCelestialBody(catalog, p.star.id);
  same(p.body, { id: body2.bodyId, version: body2.schemaVersion, digest: await contentDigest(body2) }, "/physics/body");
  same(p.star, { id: star.bodyId, version: star.schemaVersion, digest: await contentDigest(star) }, "/physics/star");
  if (star.bodyType !== "Star")
    fail("STAR_REFERENCE", "/physics/star");
  let ancestor = body2;
  while (ancestor.parentBodyId !== null)
    ancestor = requireCelestialBody(catalog, ancestor.parentBodyId);
  if (ancestor.bodyId !== star.bodyId)
    fail("STAR_REFERENCE", "/physics/star");
  same(p.ephemeris, { id: "ephemeris." + body2.bodyId, version: 1, digest: await contentDigest({ bodyId: body2.bodyId, orbit: body2.orbit, epochTick: 0 }) }, "/physics/ephemeris");
  same(p.units, { temperature: "K", pressure: "Pa", length: "m" }, "/physics/units");
  same(p.radiusMeters, body2.radiusMeters, "/physics/radiusMeters");
  same(p.frameId, createBodyFixedFrameId(body2.bodyId), "/physics/frameId");
  provenance(p.classificationProvenance, "/physics/classificationProvenance");
  provenance(p.assumptionProvenance, "/physics/assumptionProvenance");
  if (p.assumptionProvenance.kind !== "TestAssumption")
    fail("UNPROVEN_CONSTANTS", "/physics/assumptionProvenance");
  keys(p.rotation, ["mode", "value", "provenance"], "/physics/rotation");
  provenance(p.rotation.provenance, "/physics/rotation/provenance");
  if (!["Free", "Synchronous"].includes(p.rotation.mode))
    fail("ROTATION_MODE", "/physics/rotation");
  keys(p.rotation.value, ["schemaVersion", "rotationPeriodSeconds", "axialTiltDegrees", "retrograde", "primeMeridianAtEpochDegrees"], "/physics/rotation/value");
  finite(p.rotation.value.rotationPeriodSeconds, Number.MIN_VALUE, Number.MAX_VALUE, "/physics/rotation/period");
  finite(p.rotation.value.axialTiltDegrees, 0, 180, "/physics/rotation/tilt");
  finite(p.rotation.value.primeMeridianAtEpochDegrees, 0, 360, "/physics/rotation/meridian");
  if (p.rotation.value.schemaVersion !== 1 || typeof p.rotation.value.retrograde !== "boolean")
    fail("ROTATION", "/physics/rotation");
  if (body2.rotation !== null) {
    same(p.rotation.value, body2.rotation, "/physics/rotation");
    if (p.rotation.provenance.kind !== "Catalog")
      fail("PROVENANCE", "/physics/rotation");
  } else if (p.rotation.provenance.kind !== "TestAssumption")
    fail("PROVENANCE", "/physics/rotation");
  if (p.rotation.mode === "Synchronous") {
    if (body2.orbit === null || body2.parentBodyId !== star.bodyId || p.rotation.value.retrograde || p.rotation.value.axialTiltDegrees !== 0)
      fail("SYNCHRONOUS_ROTATION", "/physics/rotation");
    const period = orbitalPeriodSeconds(body2.orbit.semiMajorAxisMeters, star.gravity.gravitationalParameterMu);
    if (Math.abs(p.rotation.value.rotationPeriodSeconds - period) > period * 1e-12)
      fail("SYNCHRONOUS_PERIOD", "/physics/rotation");
  }
  if (typeof p.hasAtmosphere !== "boolean")
    fail("ATMOSPHERE", "/physics/hasAtmosphere");
  uniqueIds(p.hazards, "/physics/hazards");
  if (p.hazards.some((h) => !["HighPressure", "LowPressure", "Toxic", "Corrosive", "HighOxygen", "Radiation", "Storms", "ThermalExtreme"].includes(h)))
    fail("HAZARD", "/physics/hazards");
  if (body2.atmosphere !== null) {
    same(p.hasAtmosphere, body2.atmosphere.hasAtmosphere, "/physics/hasAtmosphere");
    same(p.hazards, body2.atmosphere.hazards, "/physics/hazards");
    if (body2.atmosphere.surfacePressurePa !== void 0)
      same(p.referencePressurePa, body2.atmosphere.surfacePressurePa, "/physics/pressure");
    if (p.classificationProvenance.kind !== "Catalog")
      fail("PROVENANCE", "/physics/classification");
  } else if (p.classificationProvenance.kind !== "TestAssumption")
    fail("UNKNOWN_ATMOSPHERE", "/physics/classification");
  range(p.temperatureRangeK, true, "/physics/temperatureRange");
  range(p.pressureRangePa, false, "/physics/pressureRange");
  finite(p.referencePressurePa, p.pressureRangePa[0], p.pressureRangePa[1], "/physics/referencePressurePa");
  if (p.hasAtmosphere && p.referencePressurePa <= 0)
    fail("REFERENCE_PRESSURE", "/physics/referencePressurePa");
  const gasGiant = body2.surfaceAccess.mode === "NoSolidSurface";
  if (p.pressureCoordinate !== (gasGiant ? "PressurePa" : "AltitudeMeters"))
    fail("VERTICAL_COORDINATE", "/physics/pressureCoordinate");
  if (p.gasMixture !== null) {
    if (!Array.isArray(p.gasMixture) || !p.gasMixture.length && p.hasAtmosphere)
      fail("GAS_MIXTURE", "/physics/gasMixture");
    uniqueIds(p.gasMixture.map((g) => g.speciesId), "/physics/gasMixture");
    let sum = 0;
    p.gasMixture.forEach((g) => {
      keys(g, ["speciesId", "moleFraction"], "/physics/gasMixture");
      sum += finite(g.moleFraction, 0, 1, "/physics/moleFraction");
    });
    if (p.hasAtmosphere && Math.abs(sum - 1) > 1e-12)
      fail("MOLAR_SUM", "/physics/gasMixture");
  }
  if (p.thermodynamics !== null) {
    keys(p.thermodynamics, ["molarMassKgPerMol", "specificHeatJPerKgK", "provenance"], "/physics/thermodynamics");
    provenance(p.thermodynamics.provenance, "/physics/thermodynamics");
    finite(p.thermodynamics.molarMassKgPerMol, Number.MIN_VALUE, Number.MAX_VALUE, "/physics/molarMass");
    finite(p.thermodynamics.specificHeatJPerKgK, Number.MIN_VALUE, Number.MAX_VALUE, "/physics/specificHeat");
  }
  if (!Array.isArray(p.condensibleSpecies))
    fail("ARRAY", "/physics/condensibleSpecies");
  uniqueIds(p.condensibleSpecies.map((x) => x.speciesId), "/physics/condensibleSpecies");
  p.condensibleSpecies.forEach((x) => {
    keys(x, ["speciesId", "saturation"], "/physics/condensibleSpecies");
    if (x.saturation !== null)
      fail("UNBOUND_SATURATION", "/physics/condensibleSpecies");
  });
  uniqueIds(p.aerosolSpecies, "/physics/aerosolSpecies");
  if (p.scaleHeightMeters !== null)
    finite(p.scaleHeightMeters, Number.MIN_VALUE, Number.MAX_VALUE, "/physics/scaleHeight");
  if (p.outerRadiusMeters !== null)
    finite(p.outerRadiusMeters, p.radiusMeters, Number.MAX_VALUE, "/physics/outerRadius");
  if (p.hasAtmosphere && p.outerRadiusMeters !== null && p.outerRadiusMeters <= p.radiusMeters)
    fail("OUTER_RADIUS", "/physics/outerRadius");
  finite(p.bondAlbedo, 0, 1, "/physics/albedo");
  finite(p.internalHeatFluxWPerM2, 0, Number.MAX_VALUE, "/physics/internalHeat");
  if (!p.hasAtmosphere && (p.referencePressurePa !== 0 || p.gasMixture === null || p.gasMixture.length || p.condensibleSpecies.length || p.aerosolSpecies.length || p.hazards.length || p.scaleHeightMeters !== null || p.outerRadiusMeters !== p.radiusMeters))
    fail("AIRLESS_CONFLICT", "/physics");
  const o = f.optics;
  keys(o, ["id", "version", "digest", "schema", "physics", "coefficientUnit", "rayleighPerM", "miePerM", "mieAnisotropy", "provenance"], "/optics");
  if (o.schema !== "cel.atmosphere-optics/v1" || o.coefficientUnit !== "1/m")
    fail("UNITS", "/optics");
  await self(o, "/optics");
  same(o.physics, exactRef(p), "/optics/physics");
  vector(o.rayleighPerM, true, "/optics/rayleigh");
  finite(o.miePerM, 0, Number.MAX_VALUE, "/optics/mie");
  finite(o.mieAnisotropy, -1 + Number.EPSILON, 1 - Number.EPSILON, "/optics/anisotropy");
  provenance(o.provenance, "/optics/provenance");
  if (!p.hasAtmosphere && (o.miePerM !== 0 || Object.values(o.rayleighPerM).some((x) => x !== 0)))
    fail("AIRLESS_OPTICS", "/optics");
  const w = f.profile;
  keys(w, ["id", "version", "digest", "schema", "bodyId", "frameId", "physics", "optics", "numerics", "model", "macroGeography", "climateNormals", "ticksPerWeatherStep", "strategy"], "/profile");
  if (w.schema !== "cel.planet-weather/v1" || w.strategy !== "analytic-synoptic-v1")
    fail("SCHEMA", "/profile");
  await self(w, "/profile");
  same(w.physics, exactRef(p), "/profile/physics");
  same(w.optics, exactRef(o), "/profile/optics");
  same(w.bodyId, body2.bodyId, "/profile/bodyId");
  same(w.frameId, p.frameId, "/profile/frameId");
  same(w.numerics, { id: "deterministicMathV1", version: 1, digest: "sha256:64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714" }, "/profile/numerics");
  validateExactRef(w.model, "/profile/model");
  if (w.model.id !== "authored-diagnostic-read-v1" || w.model.version !== 1)
    fail("UNSUPPORTED_MODEL", "/profile/model");
  if (w.model.digest !== IMPLEMENTATION_DIGEST)
    fail("MODEL_IMPLEMENTATION_DRIFT", "/profile/model");
  if (!Number.isSafeInteger(w.ticksPerWeatherStep) || w.ticksPerWeatherStep < 1)
    fail("WEATHER_INTERVAL", "/profile");
  same(w.climateNormals, { id: "fixture.climate." + f.name, version: 1, digest: await contentDigest(f.climate) }, "/profile/climateNormals");
  if (f.geography === null) {
    if (!gasGiant || w.macroGeography !== null)
      fail("GEOGRAPHY_REQUIRED", "/profile/macroGeography");
  } else
    same(w.macroGeography, { id: "fixture.macro-projection." + f.name, version: 1, digest: await contentDigest(f.geography) }, "/profile/macroGeography");
  const b = f.binding;
  keys(b, ["worldId", "sessionId", "sourceOwner", "sourceEpoch", "sourceRevision", "sourceDigest", "atmosphereEpoch", "authorityRevision", "eventCursor", "eventDigest", "checkpointDigest", "profile", "model", "climateNormals", "macroGeography", "simulationTick"], "/binding");
  for (const k of ["worldId", "sessionId", "sourceOwner", "sourceEpoch", "sourceRevision", "atmosphereEpoch", "authorityRevision", "eventCursor"])
    identity(b[k], "/binding/" + k);
  same(b.profile, exactRef(w), "/binding/profile");
  same(b.model, w.model, "/binding/model");
  same(b.climateNormals, w.climateNormals, "/binding/climate");
  same(b.macroGeography, w.macroGeography, "/binding/geography");
  if (!Array.isArray(f.events))
    fail("ARRAY", "/events");
  same(b.eventDigest, await contentDigest(f.events), "/binding/eventDigest");
  if (b.checkpointDigest !== null)
    digest(b.checkpointDigest, "/binding/checkpointDigest");
  createSimulationTick(b.simulationTick);
  validateQuery(f.query, p, w.bodyId);
  if (!Array.isArray(f.records))
    fail("ARRAY", "/records");
  const recordKeys = /* @__PURE__ */ new Set();
  same(b.sourceDigest, await contentDigest(f.records), "/binding/sourceDigest");
  for (const r of f.records) {
    validateQuery(r.query, p, w.bodyId);
    const k = canonicalCelestialJson(r.query);
    if (recordKeys.has(k))
      fail("DUPLICATE_RECORD", "/records");
    recordKeys.add(k);
    if (r.status === "Known") {
      keys(r, ["status", "query", "sample", "supportRadiusMeters", "provenance"], "/record");
      validateSample(r.sample, p);
      finite(r.supportRadiusMeters, Number.MIN_VALUE, Number.MAX_VALUE, "/record/support");
      provenance(r.provenance, "/record/provenance");
      if (r.query.vertical.kind === "PressurePa")
        same(r.sample.pressurePa, r.query.vertical.pressurePa, "/record/pressure-level");
      if (r.provenance.kind !== "TestAssumption")
        fail("UNPROVEN_SAMPLE", "/record/provenance");
    } else if (r.status === "Pending") {
      keys(r, ["status", "query", "dependency"], "/record");
      identity(r.dependency, "/record/dependency");
    } else if (r.status === "UnknownCoverage") {
      keys(r, ["status", "query", "reasonCode"], "/record");
      identity(r.reasonCode, "/record/reasonCode");
    } else
      fail("RECORD_STATUS", "/record");
  }
  return f;
}
function validateQuery(q, p, bodyId) {
  keys(q, ["bodyId", "frameId", "frameKind", "bodyFixedPositionMeters", "simulationTick", "vertical", "requiredAccuracy"], "/query");
  same(q.bodyId, bodyId, "/query/body");
  same(q.frameId, p.frameId, "/query/frame");
  if (q.frameKind !== "BodyFixed")
    fail("FRAME_KIND", "/query");
  createSimulationTick(q.simulationTick);
  vector(q.bodyFixedPositionMeters, false, "/query/position");
  if (!["macro", "regional", "interacting"].includes(q.requiredAccuracy))
    fail("ACCURACY", "/query");
  if (p.pressureCoordinate === "PressurePa") {
    keys(q.vertical, ["kind", "pressurePa"], "/query/vertical");
    if (q.vertical.kind !== "PressurePa")
      fail("VERTICAL", "/query");
    finite(q.vertical.pressurePa, Math.max(Number.MIN_VALUE, p.pressureRangePa[0]), p.pressureRangePa[1], "/query/pressure");
  } else {
    keys(q.vertical, ["kind", "altitudeMeters"], "/query/vertical");
    if (q.vertical.kind !== "AltitudeMeters")
      fail("VERTICAL", "/query");
    const altitude = finite(q.vertical.altitudeMeters, 0, p.outerRadiusMeters === null ? Number.MAX_VALUE : p.outerRadiusMeters - p.radiusMeters, "/query/altitude");
    const radius = Math.hypot(q.bodyFixedPositionMeters.x, q.bodyFixedPositionMeters.y, q.bodyFixedPositionMeters.z);
    if (!Number.isFinite(radius) || radius <= 0 || Math.abs(radius - p.radiusMeters - altitude) > 1e-5)
      fail("ALTITUDE_POSITION_MISMATCH", "/query/position");
  }
}
function validateSample(s, p) {
  keys(s, ["temperatureK", "pressurePa", "windBodyFixedMps", "extinctionPerM", "condensates", "aerosols", "precipitation", "stormIds"], "/sample");
  finite(s.temperatureK, p.temperatureRangeK[0], p.temperatureRangeK[1], "/sample/temperature");
  finite(s.pressurePa, p.pressureRangePa[0], p.pressureRangePa[1], "/sample/pressure");
  vector(s.windBodyFixedMps, false, "/sample/wind");
  finite(s.extinctionPerM, 0, Number.MAX_VALUE, "/sample/extinction");
  for (const k of ["condensates", "aerosols"]) {
    if (!Array.isArray(s[k]))
      fail("ARRAY", "/sample/" + k);
    uniqueIds(s[k].map((x) => x.speciesId), "/sample/" + k);
    s[k].forEach((x) => {
      keys(x, ["speciesId", "massMixingRatio"], "/sample/" + k);
      finite(x.massMixingRatio, 0, 1, "/sample/" + k);
      if (k === "aerosols" ? !p.aerosolSpecies.includes(x.speciesId) : !p.condensibleSpecies.some((c) => c.speciesId === x.speciesId && c.saturation !== null))
        fail("UNKNOWN_SPECIES", "/sample/" + k);
    });
  }
  if (!Array.isArray(s.precipitation))
    fail("ARRAY", "/sample/precipitation");
  uniqueIds(s.precipitation.map((x) => x.speciesId), "/sample/precipitation");
  s.precipitation.forEach((x) => {
    keys(x, ["speciesId", "phase", "massFluxKgPerM2S"], "/sample/precipitation");
    if (!["liquid", "solid"].includes(x.phase))
      fail("PHASE", "/sample/precipitation");
    finite(x.massFluxKgPerM2S, 0, Number.MAX_VALUE, "/sample/precipitation");
    if (!p.condensibleSpecies.some((c) => c.speciesId === x.speciesId && c.saturation !== null))
      fail("UNSUPPORTED_PRECIPITATION", "/sample/precipitation");
  });
  uniqueIds(s.stormIds, "/sample/stormIds");
  if (!p.hasAtmosphere && (s.precipitation.length || s.condensates.length || s.aerosols.length || s.stormIds.length || s.pressurePa !== 0 || s.extinctionPerM !== 0 || Object.values(s.windBodyFixedMps).some((v) => v !== 0)))
    fail("AIRLESS_WEATHER", "/sample");
}
async function createWeatherReadView(input) {
  const f = await validateBundle(input);
  const p = f.physics;
  const byQuery = new Map(f.records.map((r) => [canonicalCelestialJson(r.query), r]));
  return Object.freeze({ profile: f.profile, binding: f.binding, read: async (raw) => {
    const q = clone(raw);
    validateQuery(q, p, f.profile.bodyId);
    let state;
    if (!p.hasAtmosphere)
      state = { status: "NoAtmosphere", precipitation: [] };
    else if (p.gasMixture === null)
      state = { status: "Unsupported", reasonCode: "MISSING_GAS_MIXTURE" };
    else if (p.thermodynamics === null || p.scaleHeightMeters === null || p.outerRadiusMeters === null)
      state = { status: "Unsupported", reasonCode: "MISSING_SUBSTANCE_DATA" };
    else if (p.condensibleSpecies.some((x) => x.saturation === null))
      state = { status: "Unsupported", reasonCode: "SATURATION_UNDEFINED" };
    else if (q.simulationTick !== f.binding.simulationTick)
      state = { status: "Pending", dependency: "EXPLICIT_TICK_MATERIALIZATION" };
    else if (q.requiredAccuracy !== "macro")
      state = { status: "Unsupported", reasonCode: "ACCURACY_UNAVAILABLE" };
    else {
      const record = byQuery.get(canonicalCelestialJson(q));
      if (record?.status === "Known")
        state = { status: "Known", sample: record.sample, supportRadiusMeters: record.supportRadiusMeters, accuracy: "macro", provenance: record.provenance };
      else if (record?.status === "Pending")
        state = { status: "Pending", dependency: record.dependency };
      else
        state = { status: "UnknownCoverage", reasonCode: record?.reasonCode ?? "NO_BOUND_RECORD" };
    }
    const payload = { query: q, binding: f.binding, weatherStep: Number(BigInt(q.simulationTick) / BigInt(f.profile.ticksPerWeatherStep)), ...state };
    return clone({ ...payload, WeatherSnapshotId: await contentDigest(payload) });
  } });
}

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/common.js
var immutable = (v) => canonicalizeCelestialValue(v);
function number(v, min, max, name) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error("NUMBER_RANGE:" + name);
  return v;
}
function keys2(v, names, name) {
  if (v === null || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join("|") !== [...names].sort().join("|"))
    throw Error("SCHEMA_KEYS:" + name);
}
function same2(a, b, name) {
  if (canonicalCelestialJson(a) !== canonicalCelestialJson(b))
    throw Error("REFERENCE_MISMATCH:" + name);
}
var assumption = { kind: "TestAssumption", note: "Synthetic authoring constants, not accepted planetary climate or natural atmosphere data." };

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/geometry.js
var FACES = Object.freeze(["px", "nx", "py", "ny", "pz", "nz"]);
var AXES = Object.freeze({
  px: { normal: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 1, z: 0 } },
  nx: { normal: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  py: { normal: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } },
  ny: { normal: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  pz: { normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  nz: { normal: { x: 0, y: 0, z: -1 }, u: { x: -1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } }
});
var finite2 = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
};
var vector2 = (value, name = "vector") => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a Vec3`);
  }
  const candidate = value;
  return {
    x: finite2(candidate.x, `${name}.x`),
    y: finite2(candidate.y, `${name}.y`),
    z: finite2(candidate.z, `${name}.z`)
  };
};
var add = (a, b) => {
  const left = vector2(a, "a");
  const right = vector2(b, "b");
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
};
var scale = (value, factor) => {
  const v = vector2(value);
  const amount = finite2(factor, "factor");
  return { x: v.x * amount, y: v.y * amount, z: v.z * amount };
};
var dot = (a, b) => {
  const left = vector2(a, "a");
  const right = vector2(b, "b");
  return left.x * right.x + left.y * right.y + left.z * right.z;
};
var cross = (a, b) => {
  const left = vector2(a, "a");
  const right = vector2(b, "b");
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
};
var unit = (value) => {
  const v = vector2(value);
  const largest = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (largest === 0)
    throw new RangeError("cannot normalize the zero vector");
  const x = v.x / largest;
  const y = v.y / largest;
  const z = v.z / largest;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/macro.js
async function validateMacro(raw, bodyId) {
  const s = immutable(raw);
  keys2(s, ["id", "version", "digest", "schema", "bodyId", "sourceOwner", "sourceRevision", "terrainGenerator", "provenance", "continentAxis", "maximumElevationMeters", "roughness", "reservoirSpeciesId", "reservoirKgPerM2", "missingFaces"], "macro");
  validateExactRef(exactRef(s));
  validateExactRef(s.terrainGenerator);
  const { digest: digest2, ...payload } = s;
  same2(digest2, await contentDigest(payload), "macro.digest");
  if (s.schema !== "wxg.synthetic-macro/v1" || s.bodyId !== bodyId || !s.sourceOwner || !s.sourceRevision || s.provenance.kind !== "TestAssumption")
    throw Error("MACRO_SOURCE");
  unit(s.continentAxis);
  number(s.maximumElevationMeters, 0, 1e4, "elevation");
  number(s.roughness, 0, 1, "roughness");
  number(s.reservoirKgPerM2, 0, 1e9, "reservoir");
  if (s.reservoirSpeciesId === null ? s.reservoirKgPerM2 !== 0 : typeof s.reservoirSpeciesId !== "string" || !s.reservoirSpeciesId)
    throw Error("RESERVOIR_SPECIES");
  if (!Array.isArray(s.missingFaces) || s.missingFaces.some((f) => !FACES.includes(f)) || new Set(s.missingFaces).size !== s.missingFaces.length || [...s.missingFaces].sort().join("|") !== s.missingFaces.join("|"))
    throw Error("FACE_COVERAGE");
  return s;
}
function sampleMacro(s, nRaw) {
  const n = unit(nRaw);
  const signal = dot(n, unit(s.continentAxis));
  const landFraction = Math.max(0, Math.min(1, 0.5 + 0.75 * signal));
  return immutable({
    landFraction,
    openLiquidFraction: 1 - landFraction,
    elevationMeters: Math.max(0, signal) * s.maximumElevationMeters,
    roughness: s.roughness * landFraction,
    reservoir: s.reservoirSpeciesId === null ? null : { speciesId: s.reservoirSpeciesId, massKgPerM2: s.reservoirKgPerM2 * (1 - landFraction) }
  });
}

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/model-pin.js
var IMPLEMENTATION_DIGEST2 = "sha256:78f9b7dd581faf7db0b09c37cdabda15814dd8884e173cf20eeaa722918a7f50";

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/climate.js
function validateConfig(raw) {
  const c = immutable(raw);
  keys2(c, ["schema", "referenceTemperatureK", "solarFluxWPerM2", "longwaveAtReferenceWPerM2", "feedbackWPerM2K", "diffusionWPerM2K", "p2ForcingWPerM2", "lapseKPerM", "seasonalAmplitudeK", "seasonPeriodTicks", "tidalContrastK", "substellarDirection", "circulationHeightMeters", "circulationDeltaK", "zonalWindMps", "provenance"], "climate.config");
  if (c.schema !== "wxg.synthetic-climate-config/v1" || c.provenance.kind !== "TestAssumption")
    throw Error("CLIMATE_CONFIG");
  number(c.referenceTemperatureK, 50, 600, "referenceK");
  number(c.solarFluxWPerM2, 0, 5e3, "solar");
  number(c.longwaveAtReferenceWPerM2, 0, 2e3, "longwave");
  number(c.feedbackWPerM2K, 0.1, 10, "feedback");
  number(c.diffusionWPerM2K, 0, 10, "diffusion");
  number(c.p2ForcingWPerM2, -200, 200, "p2");
  number(c.lapseKPerM, 0, 0.01, "lapse");
  number(c.seasonalAmplitudeK, 0, 50, "seasonal");
  number(c.tidalContrastK, 0, 50, "tidal");
  if (!Number.isSafeInteger(c.seasonPeriodTicks) || c.seasonPeriodTicks < 120)
    throw Error("SEASON_TICKS");
  unit(c.substellarDirection);
  number(c.circulationHeightMeters, 1, 1e5, "circulationHeight");
  number(c.circulationDeltaK, 0, 100, "circulationDelta");
  number(c.zonalWindMps, 0, 100, "zonalWind");
  return c;
}
function ebmCoefficients(c, albedo, internalFlux) {
  const config = validateConfig(c);
  number(albedo, 0, 1, "albedo");
  number(internalFlux, 0, 1e3, "internalFlux");
  return {
    meanTemperatureK: config.referenceTemperatureK + (config.solarFluxWPerM2 * (1 - albedo) / 4 + internalFlux - config.longwaveAtReferenceWPerM2) / config.feedbackWPerM2K,
    p2AmplitudeK: config.p2ForcingWPerM2 / (config.feedbackWPerM2K + 6 * config.diffusionWPerM2K)
  };
}
function heldHouWidth(c, radiusMeters, rotationSeconds, gravityMps2) {
  validateConfig(c);
  number(radiusMeters, 1, 1e9, "radius");
  number(rotationSeconds, 1, 1e12, "rotation");
  number(gravityMps2, 1e-3, 1e3, "gravity");
  const omega = 2 * Math.PI / rotationSeconds;
  const width = Math.sqrt(5 * gravityMps2 * c.circulationHeightMeters * c.circulationDeltaK / (3 * omega * omega * radiusMeters * radiusMeters * c.referenceTemperatureK));
  return width <= 0.5 ? width : null;
}
async function typedClimateBuilder(raw, macroRaw, configRaw) {
  const bundle = await validateBundle(raw), config = validateConfig(configRaw);
  const macro = macroRaw === null ? null : await validateMacro(macroRaw, bundle.profile.bodyId);
  if (macro === null && bundle.physics.pressureCoordinate !== "PressurePa")
    throw Error("MACRO_REQUIRED");
  const inputs = { physics: exactRef(bundle.physics), macroGeography: macro === null ? null : exactRef(macro), config, compiler: { id: "two-mode-linear-diffusive-ebm/v1", digest: IMPLEMENTATION_DIGEST2 } };
  const binding = { id: "wxg.climate." + bundle.name, version: 1, digest: await contentDigest(inputs) };
  const supported = await (await createWeatherReadView(bundle)).read(bundle.query);
  if (supported.status === "NoAtmosphere")
    return immutable({ status: "NoAtmosphere", reasonCode: "AIRLESS", binding });
  if (supported.status === "Unsupported")
    return immutable({ status: "Unsupported", reasonCode: supported.reasonCode, binding });
  const coefficients = ebmCoefficients(config, bundle.physics.bondAlbedo, bundle.physics.internalHeatFluxWPerM2);
  const lo = coefficients.meanTemperatureK - Math.abs(coefficients.p2AmplitudeK) - config.seasonalAmplitudeK - config.tidalContrastK - (macro?.maximumElevationMeters ?? 0) * config.lapseKPerM;
  const hi = coefficients.meanTemperatureK + Math.abs(coefficients.p2AmplitudeK) + config.seasonalAmplitudeK + config.tidalContrastK;
  number(lo, bundle.physics.temperatureRangeK[0], bundle.physics.temperatureRangeK[1], "climate.minimum");
  number(hi, bundle.physics.temperatureRangeK[0], bundle.physics.temperatureRangeK[1], "climate.maximum");
  const body2 = bundle.catalog.indexes.bodyById[bundle.profile.bodyId];
  const gravityMps2 = body2.gravity.gravitationalParameterMu / (bundle.physics.radiusMeters * bundle.physics.radiusMeters);
  const hadleyWidthRadians = bundle.physics.rotation.mode === "Synchronous" ? null : heldHouWidth(config, bundle.physics.radiusMeters, bundle.physics.rotation.value.rotationPeriodSeconds, gravityMps2);
  const result = {
    status: "Known",
    bodyId: bundle.profile.bodyId,
    physics: exactRef(bundle.physics),
    macroGeography: inputs.macroGeography,
    config,
    ...coefficients,
    hadleyWidthRadians,
    physicsRangeK: bundle.physics.temperatureRangeK,
    pressureCoordinate: bundle.physics.pressureCoordinate,
    seasonalBins: Array.from({ length: 12 }, (_, i) => config.seasonalAmplitudeK * (1 - Math.abs(i - 6) / 3)),
    diagnostics: { equation: "two-mode-linear-diffusive-ebm/v1", reference: "no-transport D=0", surfaceExchange: "authoring lapse only", heldHou: "separate small-angle scaling diagnostic", heldSuarez: "NOT_RUN_EXTERNAL_BENCHMARK", moisture: "NO_SATURATION_NO_PRECIPITATION" }
  };
  return immutable({ ...result, binding: { ...binding, digest: await contentDigest({ inputs, result }) } });
}
function sampleClimate(c, f, macro, nRaw) {
  if (c.status !== "Known")
    throw Error("CLIMATE_UNAVAILABLE");
  same2(c.physics, exactRef(f.physics), "climate.physics");
  same2(c.macroGeography, macro === null ? null : exactRef(macro), "climate.macro");
  const n = unit(nRaw), geo = macro === null ? null : sampleMacro(macro, n);
  const p2 = (3 * n.y * n.y - 1) / 2;
  const tidal = f.physics.rotation.mode === "Synchronous" ? c.config.tidalContrastK * dot(n, unit(c.config.substellarDirection)) : 0;
  const temperatureK = c.meanTemperatureK + c.p2AmplitudeK * p2 - (geo?.elevationMeters ?? 0) * c.config.lapseKPerM + tidal;
  number(temperatureK, c.physicsRangeK[0], c.physicsRangeK[1], "climate.sample");
  return immutable({
    temperatureK,
    biomeHint: geo === null ? "NoGround" : temperatureK < 273.15 ? "ColdSurface" : geo.landFraction < 0.5 ? "OpenReservoir" : "DryLand",
    hydrologyHint: geo?.reservoir === null || geo === null ? "NoBoundReservoir" : "ReservoirPresentFluxUnsupported",
    geo
  });
}

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/vendor/cel/vendor/plt/src/numerics.mjs
var U32_MAX = 4294967295;
var U32_MASK = 0xffffffffn;
var MAX_TICK2 = BigInt(Number.MAX_SAFE_INTEGER);
var Q16_SCALE = 65536n;
var THREEFRY_C240 = 466688986;
var THREEFRY_ROTATIONS = [13, 15, 26, 6, 17, 29, 16, 24];
var assertU32 = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > U32_MAX) {
    throw new RangeError("Value must be an unsigned 32-bit integer.");
  }
  return value >>> 0;
};
var assertTick = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Tick must be a nonnegative safe integer.");
  }
  return value;
};
var threefry2x32 = (counter, key) => {
  if (!Array.isArray(counter) || counter.length !== 2 || !Array.isArray(key) || key.length !== 2) {
    throw new TypeError("Threefry2x32 requires two-word counter and key arrays.");
  }
  const counter0 = assertU32(counter[0]);
  const counter1 = assertU32(counter[1]);
  const key0 = assertU32(key[0]);
  const key1 = assertU32(key[1]);
  const keyWords = [key0, key1, (THREEFRY_C240 ^ key0 ^ key1) >>> 0];
  let x0 = counter0 + key0 >>> 0;
  let x1 = counter1 + key1 >>> 0;
  for (let round = 0; round < 20; round += 1) {
    x0 = x0 + x1 >>> 0;
    const rotation = THREEFRY_ROTATIONS[round % THREEFRY_ROTATIONS.length];
    x1 = ((x1 << rotation | x1 >>> 32 - rotation) ^ x0) >>> 0;
    if ((round & 3) === 3) {
      const subkey = (round + 1) / 4;
      x0 = x0 + keyWords[subkey % 3] >>> 0;
      x1 = x1 + keyWords[(subkey + 1) % 3] + subkey >>> 0;
    }
  }
  return Object.freeze([x0, x1]);
};
var q16Smoothstep = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65536) {
    throw new RangeError("Q16 smoothstep input must be an integer from 0 through 65536.");
  }
  const n = BigInt(value);
  const denominator = Q16_SCALE * Q16_SCALE;
  const numerator = 3n * n * n * Q16_SCALE - 2n * n * n * n;
  return Number((numerator + denominator / 2n) / denominator);
};
var tickCounter = (tick) => {
  const value = BigInt(assertTick(tick));
  return [Number(value & U32_MASK), Number(value >> 32n)];
};

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/synoptic.js
var EPOCH_TICKS = 72e5;
var smooth = (x) => q16Smoothstep(Math.round(Math.max(0, Math.min(1, x)) * 65536)) / 65536;
function periodicForcing(tick, periodTicks) {
  createSimulationTick(tick);
  if (!Number.isSafeInteger(periodTicks) || periodTicks < 120)
    throw Error("PERIOD_TICKS");
  const phase = Number(BigInt(tick) % BigInt(periodTicks)) / periodTicks;
  return phase < 0.5 ? 2 * smooth(phase * 2) - 1 : 1 - 2 * smooth((phase - 0.5) * 2);
}
function synopticObjects(profileDigest, tick, allowVortices) {
  createSimulationTick(tick);
  if (!/^sha256:[a-f0-9]{64}$/.test(profileDigest) || typeof allowVortices !== "boolean")
    throw Error("SYNOPTIC_PROFILE");
  const key = [Number.parseInt(profileDigest.slice(7, 15), 16), Number.parseInt(profileDigest.slice(15, 23), 16)];
  const epoch = BigInt(tick) / BigInt(EPOCH_TICKS);
  const out = [];
  for (let offset = -2; offset <= 0; offset++) {
    const e = epoch + BigInt(offset);
    if (e < 0n)
      continue;
    for (let slot = 0; slot < 2; slot++) {
      if (slot === 1 && !allowVortices)
        continue;
      const words = tickCounter(Number(e));
      const rand = threefry2x32(words, [(key[0] ^ slot * 2654435769) >>> 0, key[1]]);
      const a = rand[0] / 4294967296, b = rand[1] / 4294967296;
      const born = e * BigInt(EPOCH_TICKS) + BigInt(Math.floor(a * EPOCH_TICKS / 4));
      const age = BigInt(tick) - born;
      const lifetime = 2 * EPOCH_TICKS;
      if (age < 0n || age >= BigInt(lifetime))
        continue;
      const phase = Number(age) / lifetime;
      const origin = unit({ x: 2 * a - 1, y: b - 0.5, z: 0.3 + Math.abs(a - b) });
      const drift = scale(cross({ x: 0, y: 1, z: 0 }, origin), 0.8 * (b < 0.5 ? -1 : 1));
      const envelopeQ16 = Math.round(smooth(Math.min(1, phase * 4)) * smooth(Math.min(1, (1 - phase) * 4)) * 65536);
      out.push({
        id: `${profileDigest}/epoch.${e}/slot.${slot}`,
        kind: slot === 0 ? "Front" : "Vortex",
        bornTick: Number(born),
        lifetimeTicks: lifetime,
        centerBodyFixed: unit(add(origin, scale(drift, phase))),
        trajectoryOrigin: origin,
        trajectoryDrift: drift,
        envelopeQ16,
        pressureFraction: slot === 0 ? 0.01 : -0.01,
        thermalAmplitudeK: (2 * a - 1) * 3,
        windAmplitudeMps: 2 + 2 * b
      });
    }
  }
  return immutable(out.sort((a, b) => a.id.localeCompare(b.id)));
}
function sampleSynoptic(objects, normal) {
  const n = unit(normal);
  let pressureFraction = 0, temperatureDeltaK = 0, aerosolDelta = 0;
  let wind = { x: 0, y: 0, z: 0 };
  const activeIds = [];
  for (const o of objects) {
    const spatial = o.kind === "Vortex" ? smooth((dot(n, o.centerBodyFixed) - 0.85) / 0.15) : smooth(1 - Math.abs(dot(n, o.centerBodyFixed)) / 0.2);
    const weight = spatial * o.envelopeQ16 / 65536;
    pressureFraction += o.pressureFraction * weight;
    temperatureDeltaK += o.thermalAmplitudeK * weight;
    aerosolDelta += 2e-4 * weight;
    wind = add(wind, scale(cross(o.centerBodyFixed, n), o.windAmplitudeMps * weight));
    if (weight > 0)
      activeIds.push(o.id);
  }
  number(pressureFraction, -0.06, 0.06, "pressure residual");
  number(aerosolDelta, 0, 12e-4, "aerosol source");
  return immutable({ pressureFraction, temperatureDeltaK, aerosolDelta, wind, activeIds: activeIds.sort(), budget: { maximumObjects: 6, pressureResidualBound: 0.06, maximumAddedAerosolMixingRatio: 12e-4, conservation: "NOT_A_CONSERVATIVE_GCM" } });
}

// inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/weather.js
async function createAnalyticReadView(raw) {
  const detached = immutable(raw);
  keys2(detached, ["bundle", "macro", "config"], "analytic.input");
  const bundle = await validateBundle(detached.bundle), config = validateConfig(detached.config);
  const macro = detached.macro === null ? null : await validateMacro(detached.macro, bundle.profile.bodyId);
  const climate = await typedClimateBuilder(bundle, macro, config);
  const model = { id: "wxg.analytic-synoptic/v1", version: 1, digest: IMPLEMENTATION_DIGEST2 };
  const profile = { id: "wxg.weather." + bundle.name, version: 1, digest: await contentDigest({ baseProfile: bundle.profile, model, climate, macro, config, epochTicks: EPOCH_TICKS, ticksPerWeatherStep: bundle.profile.ticksPerWeatherStep, numerics: bundle.profile.numerics }) };
  const input = immutable({ bundle, macro, config });
  return Object.freeze({ profile: immutable(profile), input, climate, read: async (rawQuery) => {
    const query = immutable(rawQuery);
    validateQuery(query, bundle.physics, bundle.profile.bodyId);
    const binding = immutable({ ...bundle.binding, profile, model, climateNormals: climate.binding, macroGeography: macro === null ? null : exactRef(macro), simulationTick: query.simulationTick });
    let state;
    if (climate.status === "NoAtmosphere")
      state = { status: "NoAtmosphere", precipitation: [] };
    else if (climate.status === "Unsupported")
      state = { status: "Unsupported", reasonCode: climate.reasonCode };
    else if (query.requiredAccuracy !== "macro")
      state = { status: "Unsupported", reasonCode: "USE_REGIONAL_EXPOSURE_PORT" };
    else {
      const n = unit(query.bodyFixedPositionMeters);
      const missing = macro?.missingFaces ?? [];
      const dominant = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
      const faces = [n.x >= 0 ? "px" : "nx", n.y >= 0 ? "py" : "ny", n.z >= 0 ? "pz" : "nz"];
      const haloMissing = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].some((v, i) => v >= dominant * 0.75 && missing.includes(faces[i]));
      if (haloMissing)
        state = { status: "UnknownCoverage", reasonCode: "MACRO_FACE_OR_HALO_MISSING" };
      else {
        const normals = sampleClimate(climate, bundle, macro, n);
        const objects = synopticObjects(profile.digest, query.simulationTick, bundle.physics.hazards.includes("Storms"));
        const anomaly = sampleSynoptic(objects, n);
        const height = query.vertical.kind === "AltitudeMeters" ? query.vertical.altitudeMeters : 0;
        const temperatureK = normals.temperatureK + config.seasonalAmplitudeK * n.y * periodicForcing(query.simulationTick, config.seasonPeriodTicks) + anomaly.temperatureDeltaK - height * config.lapseKPerM;
        number(temperatureK, bundle.physics.temperatureRangeK[0], bundle.physics.temperatureRangeK[1], "weather.temperatureK");
        const pressurePa = query.vertical.kind === "PressurePa" ? query.vertical.pressurePa : bundle.physics.referencePressurePa * Math.exp(-height / bundle.physics.scaleHeightMeters) * (1 + anomaly.pressureFraction);
        number(pressurePa, Math.max(Number.MIN_VALUE, bundle.physics.pressureRangePa[0]), bundle.physics.pressureRangePa[1], "weather.pressurePa");
        const wind = add(scale(cross({ x: 0, y: 1, z: 0 }, n), config.zonalWindMps), anomaly.wind);
        const aerosols = bundle.physics.aerosolSpecies.map((speciesId) => ({ speciesId, massMixingRatio: 1e-3 + anomaly.aerosolDelta }));
        state = {
          status: "Known",
          sample: { temperatureK, pressurePa, windBodyFixedMps: wind, extinctionPerM: bundle.optics.miePerM + anomaly.aerosolDelta * 0.01, condensates: [], aerosols, precipitation: [], stormIds: anomaly.activeIds.filter((id) => objects.some((o) => o.id === id && o.kind === "Vortex")) },
          supportRadiusMeters: bundle.physics.radiusMeters * 0.2,
          accuracy: "macro",
          provenance: assumption
        };
      }
    }
    const payload = { query, binding, weatherStep: Number(BigInt(query.simulationTick) / BigInt(bundle.profile.ticksPerWeatherStep)), ...state };
    return immutable({ ...payload, WeatherSnapshotId: await contentDigest(payload) });
  } });
}
async function assertCurrentAnalytic(result, query, view) {
  const copy = immutable(result);
  const expected = await view.read(query);
  same2(copy, expected, "STALE_ANALYTIC_RESULT");
  return copy;
}

// src/optics.ts
var finite3 = (v, min = 0, max = Infinity) => {
  if (!Number.isFinite(v) || v < min || v > max) throw Error("OPTICAL_RANGE");
  return v;
};
var vector3 = (v) => {
  if (!Array.isArray(v) || v.length !== 3 || ![...v].every(Number.isFinite)) throw Error("VECTOR");
  return v;
};
function validateFrame(frame) {
  if (!frame || !["Known", "NoAtmosphere"].includes(frame.status) || typeof frame.bodyId !== "string" || !frame.bodyId || !frame.binding || typeof frame.binding !== "object") throw Error("FRAME_STATUS");
  if (!/^sha256:[a-f0-9]{64}$/.test(frame.weatherSnapshotId) || !/^sha256:[a-f0-9]{64}$/.test(frame.opticsDigest)) throw Error("FRAME_DIGEST");
  const binding = frame.binding;
  for (const key of ["worldId", "sessionId", "sourceEpoch", "sourceOwner", "sourceRevision", "sourceDigest", "atmosphereEpoch", "authorityRevision", "eventCursor", "eventDigest"]) if (typeof binding[key] !== "string" || !binding[key]) throw Error("WEATHER_BINDING:" + key);
  if (binding.simulationTick !== frame.simulationTick) throw Error("WEATHER_TICK_BINDING");
  for (const key of ["profile", "model", "climateNormals"]) {
    const ref = binding[key];
    if (!ref || typeof ref.id !== "string" || !Number.isSafeInteger(ref.version) || !/^sha256:[a-f0-9]{64}$/.test(ref.digest ?? "")) throw Error("WEATHER_REFERENCE:" + key);
  }
  for (const n of [frame.simulationTick, frame.sourceRevision, frame.atlasEpoch]) if (!Number.isSafeInteger(n) || n < 0) throw Error("FRAME_TICK");
  finite3(frame.bodyRadiusMeters, 1);
  vector3(frame.bodyNormal);
  if (Math.abs(Math.hypot(...frame.bodyNormal) - 1) > 1e-8) throw Error("BODY_NORMAL");
  vector3(frame.originMeters);
  vector3(frame.windMps);
  finite3(frame.weatherExtinctionPerM);
  finite3(frame.authoredCloudCoverage, 0, 1);
  finite3(frame.rain01, 0, 1);
  if (!Array.isArray(frame.stormIds) || !frame.stormIds.every((s) => typeof s === "string" && s.length > 0) || new Set(frame.stormIds).size !== frame.stormIds.length) throw Error("STORM_IDS");
  if (frame.status === "NoAtmosphere" && (frame.weatherExtinctionPerM !== 0 || frame.authoredCloudCoverage !== 0 || frame.rain01 !== 0)) throw Error("NO_ATMOSPHERE_OPTICS");
  const detached = structuredClone(frame);
  const freeze = (v) => {
    if (v && typeof v === "object") {
      Object.freeze(v);
      for (const child of Object.values(v)) freeze(child);
    }
  };
  freeze(detached);
  return detached;
}

// src/weather-port.ts
function tangentBasis(position) {
  const length = Math.hypot(position.x, position.y, position.z);
  if (!Number.isFinite(length) || length === 0) throw Error("TANGENT_POSITION");
  const up = [position.x / length, position.y / length, position.z / length];
  const east = Math.abs(up[1]) < 0.999999 ? [up[2], 0, -up[0]] : [0, -up[2], up[1]];
  const e = Math.hypot(...east);
  for (let i = 0; i < 3; i++) east[i] /= e;
  const north = [east[1] * up[2] - east[2] * up[1], east[2] * up[0] - east[0] * up[2], east[0] * up[1] - east[1] * up[0]];
  return { up, east, north };
}
async function createOpticalReadPort(input) {
  const view = await createAnalyticReadView(input);
  return Object.freeze({ view, read: async (query, mask, presentation) => {
    const result = await view.read(query);
    if (result.status !== "Known" && result.status !== "NoAtmosphere") return { status: result.status, result, frame: null };
    const { up, east, north } = tangentBasis(result.query.bodyFixedPositionMeters);
    const wind = result.status === "Known" ? result.sample.windBodyFixedMps : { x: 0, y: 0, z: 0 };
    const project = (axis) => wind.x * axis[0] + wind.y * axis[1] + wind.z * axis[2];
    const frame = validateFrame({
      status: result.status,
      simulationTick: result.query.simulationTick,
      weatherSnapshotId: result.WeatherSnapshotId,
      binding: result.binding,
      bodyId: result.query.bodyId,
      bodyRadiusMeters: view.input.bundle.physics.radiusMeters,
      bodyNormal: up,
      ...presentation,
      weatherExtinctionPerM: result.status === "Known" ? result.sample.extinctionPerM : 0,
      windMps: [project(east), project(up), project(north)],
      stormIds: result.status === "Known" ? [...result.sample.stormIds] : [],
      authoredCloudCoverage: result.status === "Known" ? mask.cloudCoverage : 0,
      rain01: result.status === "Known" ? mask.rain01 : 0,
      opticsDigest: view.input.bundle.optics.digest
    });
    return { status: result.status, result, frame };
  } });
}
export {
  assertCurrentAnalytic,
  createAnalyticReadView,
  createOpticalReadPort,
  tangentBasis
};
