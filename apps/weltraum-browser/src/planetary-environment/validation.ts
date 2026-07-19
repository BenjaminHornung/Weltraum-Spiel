import { deepFreeze } from "./canonical";
import type {
  AtmosphereFamily,
  AtmosphericComponent,
  ContaminationClass,
  EnvironmentModifiers,
  EnvironmentSampleInput,
  EnvironmentWindInput,
  NumericRange,
  PlanetaryEnvironmentProfile
} from "./types";

export type PlanetaryEnvironmentValidationCode =
  | "InvalidType"
  | "MissingField"
  | "UnknownField"
  | "InvalidNumber"
  | "OutOfRange"
  | "InvalidValue"
  | "DuplicateId"
  | "CompositionSum";

export class PlanetaryEnvironmentValidationError extends Error {
  public constructor(
    public readonly code: PlanetaryEnvironmentValidationCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "PlanetaryEnvironmentValidationError";
  }
}

const fail = (code: PlanetaryEnvironmentValidationCode, path: string, message: string): never => {
  throw new PlanetaryEnvironmentValidationError(code, path, message);
};

const childPath = (path: string, key: string | number): string => `${path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;

const readOwnDataDescriptor = (
  owner: object,
  key: PropertyKey,
  path: string
): PropertyDescriptor & { readonly value: unknown } => {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined || !("value" in descriptor)) return fail("InvalidType", path, "Accessors are not allowed in plain data.");
  if (!descriptor.enumerable) fail("UnknownField", path, "Non-enumerable fields are not allowed in plain data.");
  return descriptor as PropertyDescriptor & { readonly value: unknown };
};

const readObject = (value: unknown, path: string): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fail("InvalidType", path, "Expected a plain object.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("InvalidType", path, "Expected a plain object.");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") return fail("UnknownField", path, "Symbol fields are not allowed.");
    readOwnDataDescriptor(value, key, childPath(path, key));
  }
  return value as Readonly<Record<string, unknown>>;
};

const assertFields = (value: Readonly<Record<string, unknown>>, path: string, fields: readonly string[]): void => {
  const keys = Reflect.ownKeys(value);
  for (const key of (keys as string[]).sort()) if (!fields.includes(key)) fail("UnknownField", childPath(path, key), "Unexpected field.");
};

export const assertAllowedPlainDataFields = (value: unknown, path: string, fields: readonly string[]): void => {
  const object = readObject(value, path);
  assertFields(object, path, fields);
};

const required = (value: Readonly<Record<string, unknown>>, key: string, path: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return fail("MissingField", childPath(path, key), "Required field is missing.");
  if (!("value" in descriptor) || !descriptor.enumerable) return fail("InvalidType", childPath(path, key), "Required fields must be enumerable data properties.");
  return descriptor.value;
};

const readString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) return fail("InvalidType", path, "Expected a non-empty string.");
  return value;
};

const readId = (value: unknown, path: string): string => {
  const id = readString(value, path);
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(id)) fail("InvalidValue", path, "Expected a stable lower-ASCII ID.");
  return id;
};

const readBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") return fail("InvalidType", path, "Expected a boolean.");
  return value;
};

const readNumber = (value: unknown, path: string, minimum = -Number.MAX_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    return fail("InvalidNumber", path, "Expected a finite safe number.");
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  if (normalized < minimum || normalized > maximum) fail("OutOfRange", path, "Number is outside the allowed range.");
  return normalized;
};

const readEnum = <T extends string>(value: unknown, path: string, values: readonly T[]): T => {
  const candidate = readString(value, path);
  if (!values.includes(candidate as T)) fail("InvalidValue", path, "Value is not supported by schema version 1.");
  return candidate as T;
};

const readArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return fail("InvalidType", path, "Expected an array.");
  if (Object.getPrototypeOf(value) !== Array.prototype) fail("InvalidType", path, "Expected an ordinary array.");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") return fail("UnknownField", path, "Array contains a symbol property.");
    if (key === "length") continue;
    if (!/^(?:0|[1-9]\d*)$/.test(key)) fail("UnknownField", childPath(path, key), "Array contains a non-canonical index property.");
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index >= value.length || String(index) !== key) {
      fail("UnknownField", childPath(path, key), "Array contains a non-canonical index property.");
    }
    readOwnDataDescriptor(value, key, childPath(path, key));
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) return fail("InvalidValue", childPath(path, index), "Sparse arrays are not allowed.");
    if (!("value" in descriptor) || !descriptor.enumerable) return fail("InvalidType", childPath(path, index), "Array indices must be enumerable data properties.");
  }
  return value;
};

const readRange = (value: unknown, path: string, floor?: number): NumericRange => {
  const object = readObject(value, path);
  assertFields(object, path, ["minimum", "maximum"]);
  const minimum = readNumber(required(object, "minimum", path), childPath(path, "minimum"), floor);
  const maximum = readNumber(required(object, "maximum", path), childPath(path, "maximum"), floor);
  if (maximum < minimum) fail("InvalidValue", path, "Range maximum must be greater than or equal to minimum.");
  return { minimum, maximum };
};

const ATMOSPHERE_FAMILIES: readonly AtmosphereFamily[] = [
  "Airless", "ThinExponential", "EarthLike", "Co2Rich", "HighPressureToxic", "WetSpore", "UnknownExotic"
];
const CONTAMINATION_CLASSES: readonly ContaminationClass[] = ["Chemical", "Biological", "Dust", "Exotic"];

const readComponent = (value: unknown, path: string): AtmosphericComponent => {
  const object = readObject(value, path);
  assertFields(object, path, [
    "componentId", "fraction", "molarMassKgPerMol", "oxygenLike", "toxic", "corrosive", "inert", "greenhouse", "unknownOrExotic"
  ]);
  return {
    componentId: readId(required(object, "componentId", path), childPath(path, "componentId")),
    fraction: readNumber(required(object, "fraction", path), childPath(path, "fraction"), 0, 1),
    molarMassKgPerMol: readNumber(required(object, "molarMassKgPerMol", path), childPath(path, "molarMassKgPerMol"), 0.001, 1),
    oxygenLike: readBoolean(required(object, "oxygenLike", path), childPath(path, "oxygenLike")),
    toxic: readBoolean(required(object, "toxic", path), childPath(path, "toxic")),
    corrosive: readBoolean(required(object, "corrosive", path), childPath(path, "corrosive")),
    inert: readBoolean(required(object, "inert", path), childPath(path, "inert")),
    greenhouse: readBoolean(required(object, "greenhouse", path), childPath(path, "greenhouse")),
    unknownOrExotic: readBoolean(required(object, "unknownOrExotic", path), childPath(path, "unknownOrExotic"))
  };
};

export const validatePlanetaryEnvironmentProfile = (value: unknown): PlanetaryEnvironmentProfile => {
  const path = "";
  const object = readObject(value, path);
  assertFields(object, path, [
    "schemaVersion", "profileId", "bodyId", "atmosphereFamily", "referenceRadiusM", "referenceGravityMps2",
    "atmospherePresent", "surfacePressurePa", "referenceTemperatureK", "scaleHeightM", "lapseRateKPerM", "composition",
    "densityModel", "radiationBaselineSvPerHour", "stellarExposureMultiplier", "contaminationClasses", "dustFactor", "sporeFactor",
    "corrosiveFactor", "defaultVisibilityM", "validAltitudeRangeM", "validTemperatureRangeK", "validPressureRangePa"
  ]);
  if (required(object, "schemaVersion", path) !== 1) fail("InvalidValue", "/schemaVersion", "Only schema version 1 is supported.");
  const atmosphereFamily = readEnum(required(object, "atmosphereFamily", path), "/atmosphereFamily", ATMOSPHERE_FAMILIES);
  const composition = readArray(required(object, "composition", path), "/composition")
    .map((entry, index) => readComponent(entry, `/composition/${index}`))
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
  if (new Set(composition.map((component) => component.componentId)).size !== composition.length) fail("DuplicateId", "/composition", "Component IDs must be unique.");
  const atmospherePresent = readBoolean(required(object, "atmospherePresent", path), "/atmospherePresent");
  const surfacePressurePa = readNumber(required(object, "surfacePressurePa", path), "/surfacePressurePa", 0);
  const scaleHeightM = readNumber(required(object, "scaleHeightM", path), "/scaleHeightM", 0);
  const fractionSum = composition.reduce((sum, component) => sum + component.fraction, 0);
  if (atmosphereFamily === "Airless") {
    if (atmospherePresent || surfacePressurePa !== 0 || scaleHeightM !== 0 || composition.length !== 0) fail("InvalidValue", "/atmosphereFamily", "Airless profiles must have no atmosphere or composition.");
  } else {
    if (!atmospherePresent || surfacePressurePa <= 0 || scaleHeightM <= 0 || composition.length === 0) fail("InvalidValue", "/atmosphereFamily", "Atmospheric profiles require positive pressure, scale height, and composition.");
    if (Math.abs(fractionSum - 1) > 1e-12) fail("CompositionSum", "/composition", "Atmospheric fractions must sum to exactly 1 within 1e-12.");
  }
  const densityObject = readObject(required(object, "densityModel", path), "/densityModel");
  assertFields(densityObject, "/densityModel", ["gasConstantJPerMolK"]);
  const contaminationClasses = readArray(required(object, "contaminationClasses", path), "/contaminationClasses")
    .map((entry, index) => readEnum(entry, `/contaminationClasses/${index}`, CONTAMINATION_CLASSES))
    .sort();
  if (new Set(contaminationClasses).size !== contaminationClasses.length) fail("InvalidValue", "/contaminationClasses", "Contamination classes must be unique.");
  const profile: PlanetaryEnvironmentProfile = {
    schemaVersion: 1,
    profileId: readId(required(object, "profileId", path), "/profileId"),
    bodyId: readId(required(object, "bodyId", path), "/bodyId"),
    atmosphereFamily,
    referenceRadiusM: readNumber(required(object, "referenceRadiusM", path), "/referenceRadiusM", 1),
    referenceGravityMps2: readNumber(required(object, "referenceGravityMps2", path), "/referenceGravityMps2", 0),
    atmospherePresent,
    surfacePressurePa,
    referenceTemperatureK: readNumber(required(object, "referenceTemperatureK", path), "/referenceTemperatureK", 1, 5000),
    scaleHeightM,
    lapseRateKPerM: readNumber(required(object, "lapseRateKPerM", path), "/lapseRateKPerM", -0.02, 0.02),
    composition,
    densityModel: { gasConstantJPerMolK: readNumber(required(densityObject, "gasConstantJPerMolK", "/densityModel"), "/densityModel/gasConstantJPerMolK", 1, 100) },
    radiationBaselineSvPerHour: readNumber(required(object, "radiationBaselineSvPerHour", path), "/radiationBaselineSvPerHour", 0),
    stellarExposureMultiplier: readNumber(required(object, "stellarExposureMultiplier", path), "/stellarExposureMultiplier", 0),
    contaminationClasses,
    dustFactor: readNumber(required(object, "dustFactor", path), "/dustFactor", 0, 1),
    sporeFactor: readNumber(required(object, "sporeFactor", path), "/sporeFactor", 0, 1),
    corrosiveFactor: readNumber(required(object, "corrosiveFactor", path), "/corrosiveFactor", 0, 1),
    defaultVisibilityM: readNumber(required(object, "defaultVisibilityM", path), "/defaultVisibilityM", 0.001),
    validAltitudeRangeM: readRange(required(object, "validAltitudeRangeM", path), "/validAltitudeRangeM"),
    validTemperatureRangeK: readRange(required(object, "validTemperatureRangeK", path), "/validTemperatureRangeK", 1),
    validPressureRangePa: readRange(required(object, "validPressureRangePa", path), "/validPressureRangePa", 0)
  };
  if (profile.referenceTemperatureK < profile.validTemperatureRangeK.minimum || profile.referenceTemperatureK > profile.validTemperatureRangeK.maximum) fail("InvalidValue", "/referenceTemperatureK", "Reference temperature must be inside the model range.");
  if (profile.surfacePressurePa < profile.validPressureRangePa.minimum || profile.surfacePressurePa > profile.validPressureRangePa.maximum) fail("InvalidValue", "/surfacePressurePa", "Surface pressure must be inside the model range.");
  return deepFreeze(profile) as PlanetaryEnvironmentProfile;
};

export const canonicalLatitudeDeg = (value: unknown): number => readNumber(value, "/latitudeDeg", -90, 90);

export const canonicalLongitudeDeg = (value: unknown): number => {
  const longitude = readNumber(value, "/longitudeDeg");
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
};

const readModifiers = (value: unknown, path: string): EnvironmentModifiers => {
  const object = readObject(value, path);
  assertFields(object, path, ["temperatureOffsetK", "pressureMultiplier", "visibilityMultiplier", "contaminationMultiplier"]);
  const result: EnvironmentModifiers = {
    ...(Object.hasOwn(object, "temperatureOffsetK") ? { temperatureOffsetK: readNumber(object.temperatureOffsetK, `${path}/temperatureOffsetK`, -1000, 1000) } : {}),
    ...(Object.hasOwn(object, "pressureMultiplier") ? { pressureMultiplier: readNumber(object.pressureMultiplier, `${path}/pressureMultiplier`, 0.000001, 1000) } : {}),
    ...(Object.hasOwn(object, "visibilityMultiplier") ? { visibilityMultiplier: readNumber(object.visibilityMultiplier, `${path}/visibilityMultiplier`, 0.000001, 1000) } : {}),
    ...(Object.hasOwn(object, "contaminationMultiplier") ? { contaminationMultiplier: readNumber(object.contaminationMultiplier, `${path}/contaminationMultiplier`, 0, 1000) } : {})
  };
  return result;
};

const readWind = (value: unknown, path: string): EnvironmentWindInput => {
  const object = readObject(value, path);
  assertFields(object, path, ["eastMps", "northMps", "upMps"]);
  return {
    eastMps: readNumber(required(object, "eastMps", path), `${path}/eastMps`, -1000, 1000),
    northMps: readNumber(required(object, "northMps", path), `${path}/northMps`, -1000, 1000),
    upMps: readNumber(required(object, "upMps", path), `${path}/upMps`, -1000, 1000)
  };
};

export const validateEnvironmentSampleInput = (value: unknown): EnvironmentSampleInput => {
  const object = readObject(value, "");
  assertFields(object, "", ["profileId", "latitudeDeg", "longitudeDeg", "altitudeM", "illuminationPhase", "modifiers", "wind"]);
  const input: EnvironmentSampleInput = {
    profileId: readId(required(object, "profileId", ""), "/profileId"),
    latitudeDeg: canonicalLatitudeDeg(required(object, "latitudeDeg", "")),
    longitudeDeg: canonicalLongitudeDeg(required(object, "longitudeDeg", "")),
    altitudeM: readNumber(required(object, "altitudeM", ""), "/altitudeM"),
    illuminationPhase: readNumber(required(object, "illuminationPhase", ""), "/illuminationPhase", 0, 1 - Number.EPSILON),
    ...(Object.hasOwn(object, "modifiers") ? { modifiers: readModifiers(object.modifiers, "/modifiers") } : {}),
    ...(Object.hasOwn(object, "wind") ? { wind: readWind(object.wind, "/wind") } : {})
  };
  return deepFreeze(input) as EnvironmentSampleInput;
};
