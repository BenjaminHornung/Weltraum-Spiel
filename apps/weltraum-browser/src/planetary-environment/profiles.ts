import { assertAllowedPlainDataFields, validatePlanetaryEnvironmentProfile } from "./validation";
import type { AtmosphereFamily, AtmosphericComponent, ContaminationClass, PlanetaryEnvironmentProfile } from "./types";

export interface ProfileDefinition {
  readonly profileId: string;
  readonly bodyId: string;
  readonly atmosphereFamily: AtmosphereFamily;
  readonly referenceRadiusM: number;
  readonly referenceGravityMps2: number;
  readonly surfacePressurePa: number;
  readonly referenceTemperatureK: number;
  readonly scaleHeightM: number;
  readonly lapseRateKPerM: number;
  readonly composition: readonly AtmosphericComponent[];
  readonly radiationBaselineSvPerHour: number;
  readonly stellarExposureMultiplier: number;
  readonly contaminationClasses?: readonly ContaminationClass[];
  readonly dustFactor?: number;
  readonly sporeFactor?: number;
  readonly corrosiveFactor?: number;
  readonly defaultVisibilityM?: number;
  readonly validAltitudeRangeM: { readonly minimum: number; readonly maximum: number };
  readonly validTemperatureRangeK: { readonly minimum: number; readonly maximum: number };
  readonly validPressureRangePa: { readonly minimum: number; readonly maximum: number };
}

export const createPlanetaryEnvironmentProfile = (definition: ProfileDefinition): PlanetaryEnvironmentProfile => {
  assertAllowedPlainDataFields(definition, "", [
    "profileId", "bodyId", "atmosphereFamily", "referenceRadiusM", "referenceGravityMps2", "surfacePressurePa",
    "referenceTemperatureK", "scaleHeightM", "lapseRateKPerM", "composition", "radiationBaselineSvPerHour",
    "stellarExposureMultiplier", "contaminationClasses", "dustFactor", "sporeFactor", "corrosiveFactor",
    "defaultVisibilityM", "validAltitudeRangeM", "validTemperatureRangeK", "validPressureRangePa"
  ]);
  return validatePlanetaryEnvironmentProfile({
    schemaVersion: 1,
    profileId: definition.profileId,
    bodyId: definition.bodyId,
    atmosphereFamily: definition.atmosphereFamily,
    referenceRadiusM: definition.referenceRadiusM,
    referenceGravityMps2: definition.referenceGravityMps2,
    atmospherePresent: definition.atmosphereFamily !== "Airless",
    surfacePressurePa: definition.surfacePressurePa,
    referenceTemperatureK: definition.referenceTemperatureK,
    scaleHeightM: definition.scaleHeightM,
    lapseRateKPerM: definition.lapseRateKPerM,
    composition: definition.composition,
    densityModel: { gasConstantJPerMolK: 8.31446261815324 },
    radiationBaselineSvPerHour: definition.radiationBaselineSvPerHour,
    stellarExposureMultiplier: definition.stellarExposureMultiplier,
    contaminationClasses: definition.contaminationClasses ?? [],
    dustFactor: definition.dustFactor ?? 0,
    sporeFactor: definition.sporeFactor ?? 0,
    corrosiveFactor: definition.corrosiveFactor ?? 0,
    defaultVisibilityM: definition.defaultVisibilityM ?? 100_000,
    validAltitudeRangeM: definition.validAltitudeRangeM,
    validTemperatureRangeK: definition.validTemperatureRangeK,
    validPressureRangePa: definition.validPressureRangePa
  });
};
