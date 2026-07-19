import { deepFreeze, environmentSignature } from "./canonical";
import type {
  BreathabilityClass,
  EnvironmentHazard,
  EnvironmentHazardId,
  EnvironmentSampleInput,
  HazardSeverity,
  OutOfModelDescriptor,
  PlanetaryEnvironmentProfile,
  PlanetaryEnvironmentSample,
  PressureClass,
  ThermalClass
} from "./types";
import { PlanetaryEnvironmentValidationError, validateEnvironmentSampleInput, validatePlanetaryEnvironmentProfile } from "./validation";

export const ENVIRONMENT_THRESHOLDS = deepFreeze({
  vacuumPressurePa: 1,
  breathablePressureMinimumPa: 60_000,
  breathablePressureMaximumPa: 120_000,
  extremePressurePa: 500_000,
  oxygenPartialPressureMinimumPa: 16_000,
  oxygenPartialPressureMaximumPa: 30_000,
  toxicPartialPressurePa: 10,
  corrosiveExposure: 0.01,
  extremeColdK: 250,
  coldK: 273.15,
  hotK: 310,
  extremeHeatK: 330,
  radiationSvPerHour: 0.0001,
  dustLoad: 0.5,
  sporeLoad: 0.5,
  lowVisibilityM: 1_000
});

const HAZARD_ORDER: readonly EnvironmentHazardId[] = [
  "Vacuum", "LowPressure", "HighPressure", "Hypoxia", "Hyperoxia", "ToxicAtmosphere", "CorrosiveAtmosphere",
  "ExtremeCold", "ExtremeHeat", "Radiation", "Dust", "Spores", "LowVisibility", "UnknownComposition"
];

const hazard = (
  hazardId: EnvironmentHazardId,
  severity: HazardSeverity,
  measuredValue: number,
  relation: "below" | "above",
  threshold: number,
  unit: string,
  facts: Readonly<Record<string, string | number | boolean>>
): EnvironmentHazard => ({
  hazardId,
  severity,
  measuredValue,
  thresholdReference: { relation, value: threshold, unit },
  facts
});

const pressureClassFor = (pressurePa: number): PressureClass => {
  if (pressurePa < ENVIRONMENT_THRESHOLDS.vacuumPressurePa) return "Vacuum";
  if (pressurePa < ENVIRONMENT_THRESHOLDS.breathablePressureMinimumPa) return "Thin";
  if (pressurePa <= ENVIRONMENT_THRESHOLDS.breathablePressureMaximumPa) return "Nominal";
  if (pressurePa <= ENVIRONMENT_THRESHOLDS.extremePressurePa) return "High";
  return "Extreme";
};

const thermalClassFor = (temperatureK: number): ThermalClass => {
  if (temperatureK < ENVIRONMENT_THRESHOLDS.extremeColdK) return "ExtremeCold";
  if (temperatureK < ENVIRONMENT_THRESHOLDS.coldK) return "Cold";
  if (temperatureK <= ENVIRONMENT_THRESHOLDS.hotK) return "Temperate";
  if (temperatureK <= ENVIRONMENT_THRESHOLDS.extremeHeatK) return "Hot";
  return "ExtremeHeat";
};

type UnsignedSample = Omit<PlanetaryEnvironmentSample, "signature">;

const signSample = (sample: UnsignedSample): PlanetaryEnvironmentSample =>
  deepFreeze({ ...sample, signature: environmentSignature(sample) }) as PlanetaryEnvironmentSample;

const outOfModelSample = (
  profile: PlanetaryEnvironmentProfile,
  input: EnvironmentSampleInput,
  outOfModel: OutOfModelDescriptor
): PlanetaryEnvironmentSample => {
  const partialPressures = profile.composition.map((component) => ({ componentId: component.componentId, pressurePa: 0 }));
  return signSample({
    schemaVersion: 1,
    profileId: profile.profileId,
    bodyId: profile.bodyId,
    input,
    modelState: "OutOfModel",
    outOfModel,
    totalPressurePa: 0,
    temperatureK: null,
    densityKgPerM3: 0,
    componentPartialPressures: partialPressures,
    effectiveOxygenPartialPressurePa: 0,
    pressureClass: "OutOfModel",
    thermalClass: "OutOfModel",
    radiationSvPerHour: 0,
    contamination: 0,
    corrosiveExposure: 0,
    dustLoad: 0,
    sporeLoad: 0,
    visibilityM: 0,
    ...(input.wind === undefined ? {} : { wind: input.wind }),
    breathability: "Unknown",
    hazards: []
  });
};

const classifyBreathability = (
  modelState: "Valid" | "Vacuum",
  pressurePa: number,
  oxygenPressurePa: number,
  toxicPressurePa: number,
  unknownPressurePa: number,
  corrosiveExposure: number,
  dustLoad: number,
  sporeLoad: number
): BreathabilityClass => {
  if (modelState === "Vacuum") return "Vacuum";
  if (corrosiveExposure >= ENVIRONMENT_THRESHOLDS.corrosiveExposure) return "Corrosive";
  if (toxicPressurePa >= ENVIRONMENT_THRESHOLDS.toxicPartialPressurePa || sporeLoad >= ENVIRONMENT_THRESHOLDS.sporeLoad || oxygenPressurePa > ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMaximumPa) return "Toxic";
  if (unknownPressurePa > 0) return "Unknown";
  if (pressurePa < ENVIRONMENT_THRESHOLDS.breathablePressureMinimumPa || pressurePa > ENVIRONMENT_THRESHOLDS.breathablePressureMaximumPa) return "PressureSuitRequired";
  if (oxygenPressurePa < ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMinimumPa || dustLoad >= ENVIRONMENT_THRESHOLDS.dustLoad) return "RespiratorRequired";
  return "Breathable";
};

export const computeEnvironmentSample = (profileValue: unknown, inputValue: unknown): PlanetaryEnvironmentSample => {
  const profile = validatePlanetaryEnvironmentProfile(profileValue);
  const input = validateEnvironmentSampleInput(inputValue);
  if (input.profileId !== profile.profileId) throw new PlanetaryEnvironmentValidationError("InvalidValue", "/profileId", "Input profile ID does not match the supplied profile.");
  const altitudeRange = profile.validAltitudeRangeM;
  if (input.altitudeM < altitudeRange.minimum) return outOfModelSample(profile, input, {
    reason: "BelowMinimumAltitude", measuredValue: input.altitudeM, validRange: altitudeRange, unit: "m"
  });
  if (input.altitudeM > altitudeRange.maximum) return outOfModelSample(profile, input, {
    reason: "AboveMaximumAltitude", measuredValue: input.altitudeM, validRange: altitudeRange, unit: "m"
  });

  const temperatureK = profile.referenceTemperatureK - profile.lapseRateKPerM * input.altitudeM + (input.modifiers?.temperatureOffsetK ?? 0);
  if (!Number.isFinite(temperatureK) || temperatureK < profile.validTemperatureRangeK.minimum || temperatureK > profile.validTemperatureRangeK.maximum) {
    return outOfModelSample(profile, input, {
      reason: "TemperatureOutsideModelRange", measuredValue: temperatureK, validRange: profile.validTemperatureRangeK, unit: "K"
    });
  }
  const pressureMultiplier = input.modifiers?.pressureMultiplier ?? 1;
  const pressurePa = profile.atmospherePresent
    ? profile.surfacePressurePa * Math.exp(-input.altitudeM / profile.scaleHeightM) * pressureMultiplier
    : 0;
  if (!Number.isFinite(pressurePa) || pressurePa < 0 || pressurePa < profile.validPressureRangePa.minimum || pressurePa > profile.validPressureRangePa.maximum) {
    return outOfModelSample(profile, input, {
      reason: "PressureOutsideModelRange", measuredValue: pressurePa, validRange: profile.validPressureRangePa, unit: "Pa"
    });
  }

  const componentPartialPressures = profile.composition.map((component) => ({
    componentId: component.componentId,
    pressurePa: pressurePa * component.fraction
  }));
  const partialById = new Map(componentPartialPressures.map((partial) => [partial.componentId, partial.pressurePa]));
  const partialFor = (predicate: (component: PlanetaryEnvironmentProfile["composition"][number]) => boolean): number =>
    profile.composition.filter(predicate).reduce((sum, component) => sum + (partialById.get(component.componentId) ?? 0), 0);
  const oxygenPressurePa = partialFor((component) => component.oxygenLike);
  const toxicPressurePa = partialFor((component) => component.toxic);
  const corrosivePressurePa = partialFor((component) => component.corrosive);
  const unknownPressurePa = partialFor((component) => component.unknownOrExotic);
  const meanMolarMass = profile.composition.reduce((sum, component) => sum + component.fraction * component.molarMassKgPerMol, 0);
  const densityKgPerM3 = pressurePa === 0 ? 0 : (pressurePa * meanMolarMass) / (profile.densityModel.gasConstantJPerMolK * temperatureK);
  const contaminationMultiplier = input.modifiers?.contaminationMultiplier ?? 1;
  const dustLoad = profile.dustFactor * contaminationMultiplier;
  const sporeLoad = profile.sporeFactor * contaminationMultiplier;
  const corrosiveExposure = profile.corrosiveFactor * contaminationMultiplier + (pressurePa === 0 ? 0 : corrosivePressurePa / pressurePa);
  const contamination = Math.max(dustLoad, sporeLoad, corrosiveExposure);
  const visibilityM = profile.defaultVisibilityM * (input.modifiers?.visibilityMultiplier ?? 1) / (1 + dustLoad + sporeLoad * 2);
  const illuminationFactor = 0.75 + 0.25 * Math.max(0, Math.cos(input.latitudeDeg * Math.PI / 180) * Math.cos(input.illuminationPhase * Math.PI * 2));
  const radiationSvPerHour = profile.radiationBaselineSvPerHour * profile.stellarExposureMultiplier * illuminationFactor;
  const modelState = pressurePa < ENVIRONMENT_THRESHOLDS.vacuumPressurePa ? "Vacuum" : "Valid";
  const pressureClass = pressureClassFor(pressurePa);
  const thermalClass = thermalClassFor(temperatureK);
  const breathability = classifyBreathability(modelState, pressurePa, oxygenPressurePa, toxicPressurePa, unknownPressurePa, corrosiveExposure, dustLoad, sporeLoad);
  const hazards: EnvironmentHazard[] = [];
  if (pressurePa < ENVIRONMENT_THRESHOLDS.vacuumPressurePa) hazards.push(hazard("Vacuum", "Critical", pressurePa, "below", ENVIRONMENT_THRESHOLDS.vacuumPressurePa, "Pa", { pressureClass }));
  else if (pressurePa < ENVIRONMENT_THRESHOLDS.breathablePressureMinimumPa) hazards.push(hazard("LowPressure", "Critical", pressurePa, "below", ENVIRONMENT_THRESHOLDS.breathablePressureMinimumPa, "Pa", { pressureClass }));
  if (pressurePa > ENVIRONMENT_THRESHOLDS.breathablePressureMaximumPa) hazards.push(hazard("HighPressure", pressurePa > ENVIRONMENT_THRESHOLDS.extremePressurePa ? "Critical" : "Warning", pressurePa, "above", ENVIRONMENT_THRESHOLDS.breathablePressureMaximumPa, "Pa", { pressureClass }));
  if (modelState !== "Vacuum" && oxygenPressurePa < ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMinimumPa) hazards.push(hazard("Hypoxia", "Critical", oxygenPressurePa, "below", ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMinimumPa, "Pa", { oxygenLikeComponents: profile.composition.filter((component) => component.oxygenLike).length }));
  if (oxygenPressurePa > ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMaximumPa) hazards.push(hazard("Hyperoxia", "Critical", oxygenPressurePa, "above", ENVIRONMENT_THRESHOLDS.oxygenPartialPressureMaximumPa, "Pa", { oxygenLikeComponents: profile.composition.filter((component) => component.oxygenLike).length }));
  if (toxicPressurePa >= ENVIRONMENT_THRESHOLDS.toxicPartialPressurePa) hazards.push(hazard("ToxicAtmosphere", "Critical", toxicPressurePa, "above", ENVIRONMENT_THRESHOLDS.toxicPartialPressurePa, "Pa", { toxicComponents: profile.composition.filter((component) => component.toxic).length }));
  if (corrosiveExposure >= ENVIRONMENT_THRESHOLDS.corrosiveExposure) hazards.push(hazard("CorrosiveAtmosphere", "Critical", corrosiveExposure, "above", ENVIRONMENT_THRESHOLDS.corrosiveExposure, "ratio", { corrosiveComponents: profile.composition.filter((component) => component.corrosive).length }));
  if (temperatureK < ENVIRONMENT_THRESHOLDS.extremeColdK) hazards.push(hazard("ExtremeCold", "Critical", temperatureK, "below", ENVIRONMENT_THRESHOLDS.extremeColdK, "K", { thermalClass }));
  if (temperatureK > ENVIRONMENT_THRESHOLDS.extremeHeatK) hazards.push(hazard("ExtremeHeat", "Critical", temperatureK, "above", ENVIRONMENT_THRESHOLDS.extremeHeatK, "K", { thermalClass }));
  if (radiationSvPerHour >= ENVIRONMENT_THRESHOLDS.radiationSvPerHour) hazards.push(hazard("Radiation", "Warning", radiationSvPerHour, "above", ENVIRONMENT_THRESHOLDS.radiationSvPerHour, "Sv/h", { stellarExposureMultiplier: profile.stellarExposureMultiplier }));
  if (dustLoad >= ENVIRONMENT_THRESHOLDS.dustLoad) hazards.push(hazard("Dust", "Warning", dustLoad, "above", ENVIRONMENT_THRESHOLDS.dustLoad, "ratio", { contaminationClass: profile.contaminationClasses.includes("Dust") }));
  if (sporeLoad >= ENVIRONMENT_THRESHOLDS.sporeLoad) hazards.push(hazard("Spores", "Critical", sporeLoad, "above", ENVIRONMENT_THRESHOLDS.sporeLoad, "ratio", { contaminationClass: profile.contaminationClasses.includes("Biological") }));
  if (visibilityM < ENVIRONMENT_THRESHOLDS.lowVisibilityM) hazards.push(hazard("LowVisibility", "Warning", visibilityM, "below", ENVIRONMENT_THRESHOLDS.lowVisibilityM, "m", { defaultVisibilityM: profile.defaultVisibilityM }));
  if (unknownPressurePa > 0) hazards.push(hazard("UnknownComposition", "Critical", unknownPressurePa, "above", 0, "Pa", { unknownComponents: profile.composition.filter((component) => component.unknownOrExotic).length }));
  hazards.sort((a, b) => HAZARD_ORDER.indexOf(a.hazardId) - HAZARD_ORDER.indexOf(b.hazardId));

  return signSample({
    schemaVersion: 1,
    profileId: profile.profileId,
    bodyId: profile.bodyId,
    input,
    modelState,
    totalPressurePa: pressurePa,
    temperatureK,
    densityKgPerM3,
    componentPartialPressures,
    effectiveOxygenPartialPressurePa: oxygenPressurePa,
    pressureClass,
    thermalClass,
    radiationSvPerHour,
    contamination,
    corrosiveExposure,
    dustLoad,
    sporeLoad,
    visibilityM,
    ...(input.wind === undefined ? {} : { wind: input.wind }),
    breathability,
    hazards
  });
};
