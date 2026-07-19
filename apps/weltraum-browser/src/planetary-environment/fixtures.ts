import { deepFreeze } from "./canonical";
import { createPlanetaryEnvironmentProfile } from "./profiles";
import type { AtmosphericComponent, EnvironmentSampleInput, PlanetaryEnvironmentProfile } from "./types";

const component = (
  componentId: string,
  fraction: number,
  molarMassKgPerMol: number,
  traits: Partial<Omit<AtmosphericComponent, "componentId" | "fraction" | "molarMassKgPerMol">> = {}
): AtmosphericComponent => ({
  componentId, fraction, molarMassKgPerMol,
  oxygenLike: traits.oxygenLike ?? false,
  toxic: traits.toxic ?? false,
  corrosive: traits.corrosive ?? false,
  inert: traits.inert ?? false,
  greenhouse: traits.greenhouse ?? false,
  unknownOrExotic: traits.unknownOrExotic ?? false
});

export const REQUIRED_ENVIRONMENT_FIXTURE_IDS = deepFreeze([
  "environment.airless-moon",
  "environment.thin-co2-moon",
  "environment.earth-reference",
  "environment.high-pressure-toxic",
  "environment.hestia-wet-spore",
  "environment.unknown-exotic"
] as const);

export const createRequiredEnvironmentFixtures = (): readonly PlanetaryEnvironmentProfile[] => deepFreeze([
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[0], bodyId: "moon.airless", atmosphereFamily: "Airless",
    referenceRadiusM: 1_737_400, referenceGravityMps2: 1.62, surfacePressurePa: 0, referenceTemperatureK: 220,
    scaleHeightM: 0, lapseRateKPerM: 0, composition: [], radiationBaselineSvPerHour: 0.0005, stellarExposureMultiplier: 1.2,
    validAltitudeRangeM: { minimum: -2_000, maximum: 100_000 }, validTemperatureRangeK: { minimum: 80, maximum: 400 }, validPressureRangePa: { minimum: 0, maximum: 0 }
  }),
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[1], bodyId: "moon.thin-co2", atmosphereFamily: "ThinExponential",
    referenceRadiusM: 2_000_000, referenceGravityMps2: 2.1, surfacePressurePa: 610, referenceTemperatureK: 220,
    scaleHeightM: 11_000, lapseRateKPerM: 0.001, composition: [component("gas.carbon-dioxide", 0.96, 0.04401, { toxic: true, greenhouse: true }), component("gas.nitrogen", 0.04, 0.0280134, { inert: true })],
    radiationBaselineSvPerHour: 0.0002, stellarExposureMultiplier: 1.1, dustFactor: 0.6, contaminationClasses: ["Dust"], defaultVisibilityM: 5_000,
    validAltitudeRangeM: { minimum: -1_000, maximum: 80_000 }, validTemperatureRangeK: { minimum: 120, maximum: 350 }, validPressureRangePa: { minimum: 0, maximum: 700 }
  }),
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[2], bodyId: "planet.earth-reference", atmosphereFamily: "EarthLike",
    referenceRadiusM: 6_371_000, referenceGravityMps2: 9.80665, surfacePressurePa: 101_325, referenceTemperatureK: 288.15,
    scaleHeightM: 8_500, lapseRateKPerM: 0.0065, composition: [component("gas.argon", 0.0093, 0.039948, { inert: true }), component("gas.carbon-dioxide", 0.0004, 0.04401, { greenhouse: true }), component("gas.nitrogen", 0.7808, 0.0280134, { inert: true }), component("gas.oxygen", 0.2095, 0.031998, { oxygenLike: true })],
    radiationBaselineSvPerHour: 0.00001, stellarExposureMultiplier: 1, defaultVisibilityM: 100_000,
    validAltitudeRangeM: { minimum: -500, maximum: 20_000 }, validTemperatureRangeK: { minimum: 150, maximum: 330 }, validPressureRangePa: { minimum: 0, maximum: 110_000 }
  }),
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[3], bodyId: "planet.high-pressure-toxic", atmosphereFamily: "HighPressureToxic",
    referenceRadiusM: 6_000_000, referenceGravityMps2: 10.5, surfacePressurePa: 1_500_000, referenceTemperatureK: 360,
    scaleHeightM: 15_000, lapseRateKPerM: 0.004, composition: [component("gas.carbon-dioxide", 0.9, 0.04401, { toxic: true, greenhouse: true }), component("gas.nitrogen", 0.08, 0.0280134, { inert: true }), component("gas.sulfuric-vapor", 0.02, 0.098079, { toxic: true, corrosive: true })],
    radiationBaselineSvPerHour: 0.00005, stellarExposureMultiplier: 0.8, contaminationClasses: ["Chemical"], corrosiveFactor: 0.4, defaultVisibilityM: 700,
    validAltitudeRangeM: { minimum: -1_000, maximum: 60_000 }, validTemperatureRangeK: { minimum: 150, maximum: 500 }, validPressureRangePa: { minimum: 0, maximum: 1_700_000 }
  }),
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[4], bodyId: "planet.hestia", atmosphereFamily: "WetSpore",
    referenceRadiusM: 5_500_000, referenceGravityMps2: 8.7, surfacePressurePa: 110_000, referenceTemperatureK: 302,
    scaleHeightM: 9_200, lapseRateKPerM: 0.005, composition: [component("gas.nitrogen", 0.77, 0.0280134, { inert: true }), component("gas.oxygen", 0.21, 0.031998, { oxygenLike: true }), component("bio.airborne-spores", 0.02, 0.05, { toxic: true })],
    radiationBaselineSvPerHour: 0.00002, stellarExposureMultiplier: 1, contaminationClasses: ["Biological"], sporeFactor: 0.9, defaultVisibilityM: 2_000,
    validAltitudeRangeM: { minimum: -500, maximum: 18_000 }, validTemperatureRangeK: { minimum: 180, maximum: 340 }, validPressureRangePa: { minimum: 0, maximum: 120_000 }
  }),
  createPlanetaryEnvironmentProfile({
    profileId: REQUIRED_ENVIRONMENT_FIXTURE_IDS[5], bodyId: "planet.unknown-exotic", atmosphereFamily: "UnknownExotic",
    referenceRadiusM: 4_500_000, referenceGravityMps2: 6.5, surfacePressurePa: 90_000, referenceTemperatureK: 280,
    scaleHeightM: 10_000, lapseRateKPerM: 0.004, composition: [component("gas.nitrogen", 0.8, 0.0280134, { inert: true }), component("exotic.unknown-a", 0.2, 0.07, { unknownOrExotic: true })],
    radiationBaselineSvPerHour: 0.00008, stellarExposureMultiplier: 1.5, contaminationClasses: ["Exotic"], defaultVisibilityM: 20_000,
    validAltitudeRangeM: { minimum: -500, maximum: 25_000 }, validTemperatureRangeK: { minimum: 150, maximum: 360 }, validPressureRangePa: { minimum: 0, maximum: 100_000 }
  })
]) as readonly PlanetaryEnvironmentProfile[];

export const createRequiredEnvironmentSampleInputs = (): readonly EnvironmentSampleInput[] =>
  deepFreeze(REQUIRED_ENVIRONMENT_FIXTURE_IDS.map((profileId, index) => ({
    profileId,
    latitudeDeg: index === 4 ? 12.5 : 0,
    longitudeDeg: index === 5 ? 190 : 0,
    altitudeM: index === 1 ? 1_000 : 0,
    illuminationPhase: 0.25
  }))) as readonly EnvironmentSampleInput[];
