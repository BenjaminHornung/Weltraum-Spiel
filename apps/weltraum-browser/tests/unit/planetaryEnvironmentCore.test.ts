import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PlanetaryEnvironmentCanonicalError,
  PlanetaryEnvironmentValidationError,
  REQUIRED_ENVIRONMENT_FIXTURE_IDS,
  canonicalEnvironmentJson,
  canonicalLongitudeDeg,
  computeEnvironmentSample,
  createPlanetaryEnvironmentProfile,
  createRequiredEnvironmentFixtures,
  createRequiredEnvironmentSampleInputs,
  environmentSignature,
  validateEnvironmentSampleInput,
  validatePlanetaryEnvironmentProfile
} from "../../src/planetary-environment";

type MutableRecord = Record<string, any>;

const createFixtureMap = () => {
  const profiles = createRequiredEnvironmentFixtures();
  const inputs = createRequiredEnvironmentSampleInputs();
  return new Map(profiles.map((profile, index) => [profile.profileId, { profile, input: inputs[index] }]));
};

const createCustomProfileDefinition = () => ({
  profileId: "environment.custom-test", bodyId: "planet.custom-test", atmosphereFamily: "Co2Rich" as const,
  referenceRadiusM: 1_000_000, referenceGravityMps2: 3, surfacePressurePa: 5_000, referenceTemperatureK: 250,
  scaleHeightM: 5_000, lapseRateKPerM: 0.002,
  composition: [{ componentId: "gas.carbon-dioxide", fraction: 1, molarMassKgPerMol: 0.04401, oxygenLike: false, toxic: true, corrosive: false, inert: false, greenhouse: true, unknownOrExotic: false }],
  radiationBaselineSvPerHour: 0, stellarExposureMultiplier: 0,
  validAltitudeRangeM: { minimum: 0, maximum: 10_000 }, validTemperatureRangeK: { minimum: 200, maximum: 300 }, validPressureRangePa: { minimum: 0, maximum: 5_000 }
});

describe("planetary environment profile validation", () => {
  it("provides all six distinct required fixtures with strict normalized composition", () => {
    const profiles = createRequiredEnvironmentFixtures();
    expect(profiles.map((profile) => profile.profileId)).toEqual(REQUIRED_ENVIRONMENT_FIXTURE_IDS);
    expect(new Set(profiles.map((profile) => profile.bodyId)).size).toBe(6);
    expect(profiles.map((profile) => profile.atmosphereFamily)).toEqual([
      "Airless", "ThinExponential", "EarthLike", "HighPressureToxic", "WetSpore", "UnknownExotic"
    ]);
    for (const profile of profiles) {
      const sum = profile.composition.reduce((total, component) => total + component.fraction, 0);
      expect(profile.atmospherePresent ? sum : 0).toBeCloseTo(profile.atmospherePresent ? 1 : 0, 12);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.composition)).toBe(true);
    }
  });

  it("rejects composition drift, duplicate component IDs, nonfinite values, and unknown fields", () => {
    const earth = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    earth.composition[0].fraction += 0.01;
    expect(() => validatePlanetaryEnvironmentProfile(earth)).toThrowError(PlanetaryEnvironmentValidationError);

    const duplicate = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    duplicate.composition[1].componentId = duplicate.composition[0].componentId;
    expect(() => validatePlanetaryEnvironmentProfile(duplicate)).toThrowError(PlanetaryEnvironmentValidationError);

    const nonfinite = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    nonfinite.surfacePressurePa = Number.NaN;
    expect(() => validatePlanetaryEnvironmentProfile(nonfinite)).toThrowError(PlanetaryEnvironmentValidationError);

    const unknown = { ...createRequiredEnvironmentFixtures()[2], displayName: "forbidden" };
    expect(() => validatePlanetaryEnvironmentProfile(unknown)).toThrowError(PlanetaryEnvironmentValidationError);
  });

  it("fails closed for inconsistent airless and invalid analytic configurations", () => {
    const airless = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[0])) as MutableRecord;
    airless.atmospherePresent = true;
    expect(() => validatePlanetaryEnvironmentProfile(airless)).toThrowError(PlanetaryEnvironmentValidationError);

    const earth = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    earth.scaleHeightM = 0;
    expect(() => validatePlanetaryEnvironmentProfile(earth)).toThrowError(PlanetaryEnvironmentValidationError);

    earth.scaleHeightM = 8_500;
    earth.referenceTemperatureK = 100;
    expect(() => validatePlanetaryEnvironmentProfile(earth)).toThrowError(PlanetaryEnvironmentValidationError);
  });
});

describe("planetary environment analytic sampling", () => {
  it("computes SI pressure decay, density, lapse rate, and component partial pressures", () => {
    const earth = createRequiredEnvironmentFixtures()[2];
    const seaLevel = computeEnvironmentSample(earth, {
      profileId: earth.profileId, latitudeDeg: 0, longitudeDeg: 0, altitudeM: 0, illuminationPhase: 0.25
    });
    const altitudeM = 1_000;
    const elevated = computeEnvironmentSample(earth, {
      profileId: earth.profileId, latitudeDeg: 0, longitudeDeg: 0, altitudeM, illuminationPhase: 0.25
    });

    expect(seaLevel.totalPressurePa).toBe(101_325);
    expect(elevated.totalPressurePa).toBeCloseTo(earth.surfacePressurePa * Math.exp(-altitudeM / earth.scaleHeightM), 10);
    expect(elevated.temperatureK).toBeCloseTo(earth.referenceTemperatureK - earth.lapseRateKPerM * altitudeM, 12);
    expect(seaLevel.componentPartialPressures.reduce((sum, entry) => sum + entry.pressurePa, 0)).toBeCloseTo(seaLevel.totalPressurePa, 10);
    const meanMolarMass = earth.composition.reduce((sum, entry) => sum + entry.fraction * entry.molarMassKgPerMol, 0);
    expect(seaLevel.densityKgPerM3).toBeCloseTo((seaLevel.totalPressurePa * meanMolarMass) / (earth.densityModel.gasConstantJPerMolK * (seaLevel.temperatureK ?? 1)), 12);
    expect(seaLevel.effectiveOxygenPartialPressurePa).toBeCloseTo(101_325 * 0.2095, 10);
  });

  it("returns deterministic vacuum and explicit OutOfModel states without clamping", () => {
    const airless = createRequiredEnvironmentFixtures()[0];
    const vacuum = computeEnvironmentSample(airless, createRequiredEnvironmentSampleInputs()[0]);
    expect(vacuum.modelState).toBe("Vacuum");
    expect(vacuum.pressureClass).toBe("Vacuum");
    expect(vacuum.totalPressurePa).toBe(0);
    expect(vacuum.densityKgPerM3).toBe(0);
    expect(vacuum.hazards.map((entry) => entry.hazardId)).toContain("Vacuum");

    const outOfModel = computeEnvironmentSample(airless, {
      ...createRequiredEnvironmentSampleInputs()[0], altitudeM: airless.validAltitudeRangeM.maximum + 1
    });
    expect(outOfModel.modelState).toBe("OutOfModel");
    expect(outOfModel.pressureClass).toBe("OutOfModel");
    expect(outOfModel.thermalClass).toBe("OutOfModel");
    expect(outOfModel.temperatureK).toBeNull();
    expect(outOfModel.outOfModel).toEqual({
      reason: "AboveMaximumAltitude",
      measuredValue: airless.validAltitudeRangeM.maximum + 1,
      validRange: airless.validAltitudeRangeM,
      unit: "m"
    });
    expect(outOfModel.hazards).toEqual([]);
    expect(outOfModel.hazards.map((entry) => entry.hazardId)).not.toContain("UnknownComposition");
  });

  it("reports actual temperature and pressure OutOfModel measurements with typed units", () => {
    const earth = createRequiredEnvironmentFixtures()[2];
    const input = createRequiredEnvironmentSampleInputs()[2];
    const temperature = computeEnvironmentSample(earth, { ...input, modifiers: { temperatureOffsetK: 100 } });
    expect(temperature.outOfModel).toEqual({
      reason: "TemperatureOutsideModelRange",
      measuredValue: earth.referenceTemperatureK + 100,
      validRange: earth.validTemperatureRangeK,
      unit: "K"
    });
    expect(temperature.hazards).toEqual([]);

    const pressure = computeEnvironmentSample(earth, { ...input, modifiers: { pressureMultiplier: 2 } });
    expect(pressure.outOfModel).toEqual({
      reason: "PressureOutsideModelRange",
      measuredValue: earth.surfacePressurePa * 2,
      validRange: earth.validPressureRangePa,
      unit: "Pa"
    });
    expect(pressure.hazards).toEqual([]);
  });

  it("uses explicit modifiers and emits wind only for explicit wind input", () => {
    const earth = createRequiredEnvironmentFixtures()[2];
    const baseInput = createRequiredEnvironmentSampleInputs()[2];
    const base = computeEnvironmentSample(earth, baseInput);
    const modified = computeEnvironmentSample(earth, {
      ...baseInput,
      modifiers: { pressureMultiplier: 0.9, temperatureOffsetK: 2, visibilityMultiplier: 0.5, contaminationMultiplier: 1 },
      wind: { eastMps: 5, northMps: -2, upMps: 0 }
    });
    expect(base.wind).toBeUndefined();
    expect(modified.wind).toEqual({ eastMps: 5, northMps: -2, upMps: 0 });
    expect(modified.totalPressurePa).toBeCloseTo(base.totalPressurePa * 0.9, 10);
    expect(modified.temperatureK).toBeCloseTo((base.temperatureK ?? 0) + 2, 12);
    expect(modified.visibilityM).toBeCloseTo(base.visibilityM * 0.5, 12);
  });

  it("derives radiation only from explicit profile, latitude, and illumination phase", () => {
    const profile = createRequiredEnvironmentFixtures()[5];
    const day = computeEnvironmentSample(profile, { profileId: profile.profileId, latitudeDeg: 0, longitudeDeg: 0, altitudeM: 0, illuminationPhase: 0 });
    const night = computeEnvironmentSample(profile, { profileId: profile.profileId, latitudeDeg: 0, longitudeDeg: 0, altitudeM: 0, illuminationPhase: 0.5 });
    expect(day.radiationSvPerHour).toBe(profile.radiationBaselineSvPerHour * profile.stellarExposureMultiplier);
    expect(night.radiationSvPerHour).toBe(profile.radiationBaselineSvPerHour * profile.stellarExposureMultiplier * 0.75);
    expect(day.hazards.map((entry) => entry.hazardId)).toContain("Radiation");
  });
});

describe("planetary environment breathability and hazards", () => {
  it("classifies required fixture outcomes with typed stable hazards", () => {
    const fixtureMap = createFixtureMap();
    const samples = REQUIRED_ENVIRONMENT_FIXTURE_IDS.map((id) => {
      const fixture = fixtureMap.get(id)!;
      return computeEnvironmentSample(fixture.profile, fixture.input);
    });
    expect(samples.map((sample) => sample.breathability)).toEqual([
      "Vacuum", "Toxic", "Breathable", "Corrosive", "Toxic", "Unknown"
    ]);
    expect(samples[3].hazards.map((entry) => entry.hazardId)).toEqual(expect.arrayContaining(["HighPressure", "ToxicAtmosphere", "CorrosiveAtmosphere"]));
    expect(samples[4].hazards.map((entry) => entry.hazardId)).toEqual(expect.arrayContaining(["ToxicAtmosphere", "Spores"]));
    expect(samples[5].hazards.map((entry) => entry.hazardId)).toContain("UnknownComposition");
    for (const hazard of samples.flatMap((sample) => sample.hazards)) {
      expect(hazard.thresholdReference.unit.length).toBeGreaterThan(0);
      expect(Number.isFinite(hazard.measuredValue)).toBe(true);
      expect(Object.keys(hazard.facts).length).toBeGreaterThan(0);
    }
  });

  it("applies toxic, corrosive, and biological contamination overrides before breathable pressure", () => {
    const hestia = createRequiredEnvironmentFixtures()[4];
    const sample = computeEnvironmentSample(hestia, createRequiredEnvironmentSampleInputs()[4]);
    expect(sample.pressureClass).toBe("Nominal");
    expect(sample.effectiveOxygenPartialPressurePa).toBeGreaterThan(16_000);
    expect(sample.breathability).toBe("Toxic");
    expect(sample.sporeLoad).toBe(0.9);
    expect(sample.contamination).toBeGreaterThanOrEqual(sample.sporeLoad);
  });
});

describe("planetary environment determinism and boundaries", () => {
  it("canonicalizes longitude and negative zero while rejecting invalid latitude and illumination", () => {
    expect(canonicalLongitudeDeg(190)).toBe(-170);
    expect(canonicalLongitudeDeg(540)).toBe(-180);
    const input = validateEnvironmentSampleInput({
      profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[2], latitudeDeg: -0, longitudeDeg: -0, altitudeM: -0, illuminationPhase: -0
    });
    expect(Object.is(input.latitudeDeg, -0)).toBe(false);
    expect(Object.is(input.longitudeDeg, -0)).toBe(false);
    expect(() => validateEnvironmentSampleInput({ ...input, latitudeDeg: 91 })).toThrowError(PlanetaryEnvironmentValidationError);
    expect(() => validateEnvironmentSampleInput({ ...input, illuminationPhase: 1 })).toThrowError(PlanetaryEnvironmentValidationError);
  });

  it("produces byte-identical equal samples and changes bytes/signature for changed input", () => {
    const earth = createRequiredEnvironmentFixtures()[2];
    const input = createRequiredEnvironmentSampleInputs()[2];
    const first = computeEnvironmentSample(earth, input);
    const second = computeEnvironmentSample(JSON.parse(JSON.stringify(earth)), JSON.parse(JSON.stringify(input)));
    const changed = computeEnvironmentSample(earth, { ...input, longitudeDeg: 1 });
    expect(canonicalEnvironmentJson(first)).toBe(canonicalEnvironmentJson(second));
    expect(first.signature).toBe(second.signature);
    expect(canonicalEnvironmentJson(changed)).not.toBe(canonicalEnvironmentJson(first));
    expect(changed.signature).not.toBe(first.signature);
    expect(first.signature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  });

  it("preserves numeric precision, sorts keys, and rejects unsupported canonical values", () => {
    expect(canonicalEnvironmentJson({ z: 0.12345678901234566, a: -0 })).toBe('{"a":0,"z":0.12345678901234566}');
    expect(environmentSignature({ b: 2, a: 1 })).toBe(environmentSignature({ a: 1, b: 2 }));
    expect(() => canonicalEnvironmentJson({ value: Number.POSITIVE_INFINITY })).toThrowError(PlanetaryEnvironmentCanonicalError);
    expect(() => canonicalEnvironmentJson({ value: new Date(0) })).toThrowError(PlanetaryEnvironmentCanonicalError);
  });

  it("rejects accessors and hidden fields without invoking getters", () => {
    let getterInvocations = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => {
        getterInvocations += 1;
        return 1;
      }
    });
    expect(() => canonicalEnvironmentJson(accessor)).toThrowError(PlanetaryEnvironmentCanonicalError);
    expect(getterInvocations).toBe(0);

    const input = { ...createRequiredEnvironmentSampleInputs()[2] } as MutableRecord;
    Object.defineProperty(input, "altitudeM", {
      enumerable: true,
      get: () => {
        getterInvocations += 1;
        return 0;
      }
    });
    expect(() => validateEnvironmentSampleInput(input)).toThrowError(PlanetaryEnvironmentValidationError);
    expect(getterInvocations).toBe(0);

    const hidden = { visible: 1 } as MutableRecord;
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: 2 });
    expect(() => canonicalEnvironmentJson(hidden)).toThrowError(PlanetaryEnvironmentCanonicalError);
    const hiddenInput = { ...createRequiredEnvironmentSampleInputs()[2] } as MutableRecord;
    Object.defineProperty(hiddenInput, "hidden", { enumerable: false, value: true });
    expect(() => validateEnvironmentSampleInput(hiddenInput)).toThrowError(PlanetaryEnvironmentValidationError);
  });

  it("rejects non-canonical array keys and factory fields before values can be dropped", () => {
    const array = [1, 2] as unknown[] & Record<string, unknown>;
    Object.defineProperty(array, "01", { enumerable: true, value: 99 });
    expect(() => canonicalEnvironmentJson(array)).toThrowError(PlanetaryEnvironmentCanonicalError);

    const profile = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    Object.defineProperty(profile.composition, "01", { enumerable: true, value: profile.composition[0] });
    expect(() => validatePlanetaryEnvironmentProfile(profile)).toThrowError(PlanetaryEnvironmentValidationError);

    const extra = { ...createCustomProfileDefinition(), unexpectedAuthority: true } as any;
    expect(() => createPlanetaryEnvironmentProfile(extra)).toThrowError(PlanetaryEnvironmentValidationError);
    const hiddenExtra = createCustomProfileDefinition() as MutableRecord;
    Object.defineProperty(hiddenExtra, "hiddenAuthority", { enumerable: false, value: true });
    expect(() => createPlanetaryEnvironmentProfile(hiddenExtra as any)).toThrowError(PlanetaryEnvironmentValidationError);

    let getterInvocations = 0;
    const accessor = { ...createCustomProfileDefinition() } as MutableRecord;
    Object.defineProperty(accessor, "profileId", {
      enumerable: true,
      get: () => {
        getterInvocations += 1;
        return "environment.getter";
      }
    });
    expect(() => createPlanetaryEnvironmentProfile(accessor as any)).toThrowError(PlanetaryEnvironmentValidationError);
    expect(getterInvocations).toBe(0);
  });

  it("returns defensive deeply frozen results and never mutates caller inputs", () => {
    const profile = JSON.parse(JSON.stringify(createRequiredEnvironmentFixtures()[2])) as MutableRecord;
    const input = JSON.parse(JSON.stringify(createRequiredEnvironmentSampleInputs()[2])) as MutableRecord;
    const beforeProfile = JSON.stringify(profile);
    const beforeInput = JSON.stringify(input);
    const sample = computeEnvironmentSample(profile, input);
    expect(JSON.stringify(profile)).toBe(beforeProfile);
    expect(JSON.stringify(input)).toBe(beforeInput);
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample.input)).toBe(true);
    expect(Object.isFrozen(sample.componentPartialPressures)).toBe(true);
    expect(Object.isFrozen(sample.hazards)).toBe(true);
    profile.composition[0].fraction = 0;
    input.longitudeDeg = 99;
    expect(sample.input.longitudeDeg).toBe(0);
    expect(sample.componentPartialPressures[0].pressurePa).toBeGreaterThan(0);
  });

  it("rejects unknown input fields, nonfinite input, and mismatched profile identity", () => {
    const earth = createRequiredEnvironmentFixtures()[2];
    const input = createRequiredEnvironmentSampleInputs()[2];
    expect(() => computeEnvironmentSample(earth, { ...input, uiWarning: true })).toThrowError(PlanetaryEnvironmentValidationError);
    expect(() => computeEnvironmentSample(earth, { ...input, altitudeM: Number.POSITIVE_INFINITY })).toThrowError(PlanetaryEnvironmentValidationError);
    expect(() => computeEnvironmentSample(earth, { ...input, profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[1] })).toThrowError(PlanetaryEnvironmentValidationError);
  });

  it("contains no forbidden dependency or ambient-authority imports", () => {
    const sourceDir = path.resolve(process.cwd(), "src/planetary-environment");
    const source = readdirSync(sourceDir).filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(path.join(sourceDir, file), "utf8")).join("\n");
    expect(source).not.toMatch(/from\s+["'][^"']*(?:suit|surface-lab|world-generation|voxel|flight|celestial|spatial|three|renderer)[^"']*["']/i);
    expect(source).not.toMatch(/\b(?:Date|Math\.random|document|window|TestBridge|THREE)\b/);
  });

  it("supports caller-defined valid profiles without a global profile registry", () => {
    const custom = createPlanetaryEnvironmentProfile(createCustomProfileDefinition());
    expect(computeEnvironmentSample(custom, { profileId: custom.profileId, latitudeDeg: 0, longitudeDeg: 0, altitudeM: 0, illuminationPhase: 0 }).profileId).toBe(custom.profileId);
  });
});
