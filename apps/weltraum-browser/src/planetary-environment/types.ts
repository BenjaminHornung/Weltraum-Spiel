export type AtmosphereFamily =
  | "Airless"
  | "ThinExponential"
  | "EarthLike"
  | "Co2Rich"
  | "HighPressureToxic"
  | "WetSpore"
  | "UnknownExotic";

export type ContaminationClass = "Chemical" | "Biological" | "Dust" | "Exotic";

export interface AtmosphericComponent {
  readonly componentId: string;
  readonly fraction: number;
  readonly molarMassKgPerMol: number;
  readonly oxygenLike: boolean;
  readonly toxic: boolean;
  readonly corrosive: boolean;
  readonly inert: boolean;
  readonly greenhouse: boolean;
  readonly unknownOrExotic: boolean;
}

export interface NumericRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface DensityModelParameters {
  readonly gasConstantJPerMolK: number;
}

export interface PlanetaryEnvironmentProfile {
  readonly schemaVersion: 1;
  readonly profileId: string;
  readonly bodyId: string;
  readonly atmosphereFamily: AtmosphereFamily;
  readonly referenceRadiusM: number;
  readonly referenceGravityMps2: number;
  readonly atmospherePresent: boolean;
  readonly surfacePressurePa: number;
  readonly referenceTemperatureK: number;
  readonly scaleHeightM: number;
  readonly lapseRateKPerM: number;
  readonly composition: readonly AtmosphericComponent[];
  readonly densityModel: DensityModelParameters;
  readonly radiationBaselineSvPerHour: number;
  readonly stellarExposureMultiplier: number;
  readonly contaminationClasses: readonly ContaminationClass[];
  readonly dustFactor: number;
  readonly sporeFactor: number;
  readonly corrosiveFactor: number;
  readonly defaultVisibilityM: number;
  readonly validAltitudeRangeM: NumericRange;
  readonly validTemperatureRangeK: NumericRange;
  readonly validPressureRangePa: NumericRange;
}

export interface EnvironmentModifiers {
  readonly temperatureOffsetK?: number;
  readonly pressureMultiplier?: number;
  readonly visibilityMultiplier?: number;
  readonly contaminationMultiplier?: number;
}

export interface EnvironmentWindInput {
  readonly eastMps: number;
  readonly northMps: number;
  readonly upMps: number;
}

export interface EnvironmentSampleInput {
  readonly profileId: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly altitudeM: number;
  readonly illuminationPhase: number;
  readonly modifiers?: EnvironmentModifiers;
  readonly wind?: EnvironmentWindInput;
}

export type EnvironmentModelState = "Valid" | "Vacuum" | "OutOfModel";
export type OutOfModelReason =
  | "BelowMinimumAltitude"
  | "AboveMaximumAltitude"
  | "TemperatureOutsideModelRange"
  | "PressureOutsideModelRange";

export interface OutOfModelDescriptor {
  readonly reason: OutOfModelReason;
  readonly measuredValue: number;
  readonly validRange: NumericRange;
  readonly unit: "m" | "K" | "Pa";
}

export type PressureClass = "Vacuum" | "Thin" | "Nominal" | "High" | "Extreme" | "OutOfModel";
export type ThermalClass = "ExtremeCold" | "Cold" | "Temperate" | "Hot" | "ExtremeHeat" | "OutOfModel";
export type BreathabilityClass =
  | "Breathable"
  | "RespiratorRequired"
  | "PressureSuitRequired"
  | "Toxic"
  | "Corrosive"
  | "Vacuum"
  | "Unknown";

export type EnvironmentHazardId =
  | "Vacuum"
  | "LowPressure"
  | "HighPressure"
  | "Hypoxia"
  | "Hyperoxia"
  | "ToxicAtmosphere"
  | "CorrosiveAtmosphere"
  | "ExtremeCold"
  | "ExtremeHeat"
  | "Radiation"
  | "Dust"
  | "Spores"
  | "LowVisibility"
  | "UnknownComposition";

export type HazardSeverity = "Advisory" | "Warning" | "Critical";

export interface EnvironmentHazard {
  readonly hazardId: EnvironmentHazardId;
  readonly severity: HazardSeverity;
  readonly measuredValue: number;
  readonly thresholdReference: {
    readonly relation: "below" | "above";
    readonly value: number;
    readonly unit: string;
  };
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface ComponentPartialPressure {
  readonly componentId: string;
  readonly pressurePa: number;
}

export interface PlanetaryEnvironmentSample {
  readonly schemaVersion: 1;
  readonly profileId: string;
  readonly bodyId: string;
  readonly input: EnvironmentSampleInput;
  readonly modelState: EnvironmentModelState;
  readonly outOfModel?: OutOfModelDescriptor;
  readonly totalPressurePa: number;
  readonly temperatureK: number | null;
  readonly densityKgPerM3: number;
  readonly componentPartialPressures: readonly ComponentPartialPressure[];
  readonly effectiveOxygenPartialPressurePa: number;
  readonly pressureClass: PressureClass;
  readonly thermalClass: ThermalClass;
  readonly radiationSvPerHour: number;
  readonly contamination: number;
  readonly corrosiveExposure: number;
  readonly dustLoad: number;
  readonly sporeLoad: number;
  readonly visibilityM: number;
  readonly wind?: EnvironmentWindInput;
  readonly breathability: BreathabilityClass;
  readonly hazards: readonly EnvironmentHazard[];
  readonly signature: string;
}
