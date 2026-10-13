import { createShipBlueprint, shipBlueprintLayoutHash } from "./blueprint";
import { canonicalJsonHash, canonicalJsonStringify } from "./canonicalJson";
import { STARTER_SHIP_BUILDER_VALIDATION_POLICY } from "./compatibility";
import { validateShipBlueprintStructure } from "./blueprintValidation";
import { evaluateShipStats } from "./shipStats";
import { socketTypeMetadataFor } from "./sockets";
import { createShipAnalysisPolicy, createShipStatPreview } from "./statCanonical";
import type {
  PartDefinition,
  PartInstance,
  PartSocket,
  ShipBuilderComponent,
  ShipPartCatalogSnapshot,
  ShipStatsEvaluationOptions,
  ShipStatsReport
} from "./types";
import { dataError, deepFreeze } from "./validation";
import type { JsonObject } from "./validation";

export const HANDLING_DIAGNOSTIC_CODE_ORDER = Object.freeze([
  "MissingControlCore",
  "InvalidRequiredStructure",
  "NoMainThrust",
  "MissingPropulsionMetadata",
  "UnsupportedPropulsionMode",
  "NoCompatibleFuel",
  "NoRequiredFuel",
  "MissingUsableRcs",
  "HardPartOverlap",
  "FunctionalSocketInvalid",
  "ThrustOffsetUnavailable",
  "ThrustOffsetExceeded",
  "BrakingRatioUnavailable",
  "WeakBraking",
  "LowAcceleration",
  "MissingRcsPositiveX",
  "MissingRcsNegativeX",
  "MissingRcsPositiveY",
  "MissingRcsNegativeY",
  "MissingRcsPositiveZ",
  "MissingRcsNegativeZ",
  "RcsAuthorityAsymmetric",
  "MissingPitchAuthority",
  "MissingYawAuthority",
  "MissingRollAuthority",
  "CargoMassOverCapacity",
  "CargoVolumeOverCapacity",
  "CameraAnchorMissing",
  "CameraAnchorAmbiguous",
  "StatUnavailable"
] as const);

export type HandlingDiagnosticCode = (typeof HANDLING_DIAGNOSTIC_CODE_ORDER)[number];
export type HandlingDiagnosticSeverity = "Error" | "Warning" | "Info";
export type HandlingDiagnosticPhase =
  | "ControlStructure"
  | "Propulsion"
  | "Rcs"
  | "Geometry"
  | "FunctionalSockets"
  | "Handling"
  | "Cargo"
  | "Camera"
  | "StatAvailability";
export type FlightReadinessLevel = "TestFlightReady" | "ActiveShipReady";

export const HANDLING_SUGGESTED_FIX_CODE_ORDER = Object.freeze([
  "AddControlCore",
  "ConnectRequiredStructure",
  "AddMainThruster",
  "DeclarePropulsionSupply",
  "UseSingleSupportedPropellant",
  "AddCompatibleFuelTank",
  "AddRequiredFuel",
  "AddUsableRcs",
  "ResolveHardOverlap",
  "FixFunctionalSocket",
  "AlignThrustAxisWithCenterOfMass",
  "IncreaseBrakingAuthority",
  "IncreaseAccelerationOrReduceMass",
  "AddRcsPositiveX",
  "AddRcsNegativeX",
  "AddRcsPositiveY",
  "AddRcsNegativeY",
  "AddRcsPositiveZ",
  "AddRcsNegativeZ",
  "RebalanceRcsAuthority",
  "AddPitchAuthority",
  "AddYawAuthority",
  "AddRollAuthority",
  "ReduceCargoPreviewMass",
  "ReduceCargoPreviewVolume",
  "AddUniqueCameraAnchor",
  "ProvideRequiredStatMetadata"
] as const);

export type HandlingSuggestedFixCode = (typeof HANDLING_SUGGESTED_FIX_CODE_ORDER)[number];

export interface HandlingDiagnostic {
  readonly phase: HandlingDiagnosticPhase;
  readonly code: HandlingDiagnosticCode;
  readonly severity: HandlingDiagnosticSeverity;
  readonly path: string;
  readonly relatedInstanceIds: readonly string[];
  readonly relatedPartDefinitionIds: readonly string[];
  readonly details: JsonObject;
  readonly blocks: readonly FlightReadinessLevel[];
  readonly suggestedFixCodes: readonly HandlingSuggestedFixCode[];
}

export interface HandlingDiagnosticsSummary {
  readonly diagnosticCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly blockingTestFlightCount: number;
  readonly blockingActiveShipCount: number;
}

export interface HandlingDiagnosticsReportPayload {
  readonly reportVersion: 1;
  readonly catalogSignature: string;
  readonly blueprintLayoutHash: string;
  readonly previewSignature: string;
  readonly policySignature: string;
  readonly statsSignature: string;
  readonly structureSignature: string;
  readonly diagnostics: readonly HandlingDiagnostic[];
  readonly suggestedFixCodes: readonly HandlingSuggestedFixCode[];
  readonly summary: HandlingDiagnosticsSummary;
}

export interface HandlingDiagnosticsReport extends HandlingDiagnosticsReportPayload {
  readonly signature: string;
}

export interface HandlingDiagnosticsEvaluationOptions extends ShipStatsEvaluationOptions {
  readonly statsReport?: ShipStatsReport;
}

interface MutableDiagnostic {
  readonly phase: HandlingDiagnosticPhase;
  readonly code: HandlingDiagnosticCode;
  readonly severity: HandlingDiagnosticSeverity;
  readonly path: string;
  readonly relatedInstanceIds?: readonly string[];
  readonly relatedPartDefinitionIds?: readonly string[];
  readonly details?: JsonObject;
  readonly blocks?: readonly FlightReadinessLevel[];
  readonly suggestedFixCodes?: readonly HandlingSuggestedFixCode[];
}

const phaseRank: Readonly<Record<HandlingDiagnosticPhase, number>> = Object.freeze({
  ControlStructure: 0,
  Propulsion: 1,
  Rcs: 2,
  Geometry: 3,
  FunctionalSockets: 4,
  Handling: 5,
  Cargo: 6,
  Camera: 7,
  StatAvailability: 8
});

const codeRank = new Map<HandlingDiagnosticCode, number>(
  HANDLING_DIAGNOSTIC_CODE_ORDER.map((code, index) => [code, index])
);

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const uniqueSorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort(compareText);

const createDiagnostic = (input: MutableDiagnostic): HandlingDiagnostic => ({
  phase: input.phase,
  code: input.code,
  severity: input.severity,
  path: input.path,
  relatedInstanceIds: uniqueSorted(input.relatedInstanceIds ?? []),
  relatedPartDefinitionIds: uniqueSorted(input.relatedPartDefinitionIds ?? []),
  details: input.details ?? {},
  blocks: [...new Set(input.blocks ?? [])],
  suggestedFixCodes: [...new Set(input.suggestedFixCodes ?? [])]
});

const compareDiagnostics = (left: HandlingDiagnostic, right: HandlingDiagnostic): number => {
  const phaseComparison = phaseRank[left.phase] - phaseRank[right.phase];
  if (phaseComparison !== 0) return phaseComparison;
  const codeComparison = (codeRank.get(left.code) ?? Number.MAX_SAFE_INTEGER) - (codeRank.get(right.code) ?? Number.MAX_SAFE_INTEGER);
  if (codeComparison !== 0) return codeComparison;
  const pathComparison = compareText(left.path, right.path);
  if (pathComparison !== 0) return pathComparison;
  return compareText(canonicalJsonStringify(left.details), canonicalJsonStringify(right.details));
};

const bothReadinessLevels = Object.freeze(["TestFlightReady", "ActiveShipReady"] as const);

const socketById = (definition: PartDefinition, socketId: string): PartSocket | undefined =>
  definition.sockets.find((socket) => socket.socketId === socketId);

const finiteNonZeroDirection = (socket: PartSocket | undefined): boolean =>
  socket !== undefined &&
  Number.isFinite(socket.direction.x) &&
  Number.isFinite(socket.direction.y) &&
  Number.isFinite(socket.direction.z) &&
  (socket.direction.x !== 0 || socket.direction.y !== 0 || socket.direction.z !== 0);

const socketMatches = (
  definition: PartDefinition,
  socketId: string,
  socketType: PartSocket["socketType"],
  role: PartSocket["role"],
  directionRole: PartSocket["directionRole"]
): boolean => {
  const socket = socketById(definition, socketId);
  const metadata = socketTypeMetadataFor(socketType);
  return (
    socket !== undefined &&
    socket.role === role &&
    socket.socketType === socketType &&
    socket.directionRole === directionRole &&
    (metadata?.requiresNonZeroDirection !== true || finiteNonZeroDirection(socket))
  );
};

const componentHasInvalidFunctionalSocket = (
  component: ShipBuilderComponent,
  definition: PartDefinition
): boolean => {
  switch (component.kind) {
    case "ControlCore":
      return !socketMatches(definition, component.controlSocketId, "hardpoint", "Functional", "Aim");
    case "Structural":
      return component.structuralSocketIds.some(
        (socketId) => !socketMatches(definition, socketId, "structural", "Structural", "MountNormal")
      );
    case "MainThruster":
      return !socketMatches(definition, component.nozzleSocketId, "mainThrusterNozzle", "Functional", "Thrust");
    case "RcsCluster":
      return component.nozzleSocketIds.some(
        (socketId) => !socketMatches(definition, socketId, "rcsNozzle", "Functional", "Thrust")
      );
    case "FuelTank":
      return (
        (component.feedSocketIds?.some(
          (socketId) => !socketMatches(definition, socketId, "hardpoint", "Functional", "MountNormal")
        ) ?? false) ||
        (component.fillSocketId !== undefined &&
          !socketMatches(definition, component.fillSocketId, "hardpoint", "Functional", "MountNormal"))
      );
    case "CargoStorage":
      return (
        component.cargoAttachSocketIds.some(
          (socketId) => !socketMatches(definition, socketId, "cargoAttach", "Functional", "MountNormal")
        ) ||
        (component.accessSocketId !== undefined &&
          !socketMatches(definition, component.accessSocketId, "hardpoint", "Functional", "Aim"))
      );
    case "FixedWeapon":
      return (
        !socketMatches(definition, component.hardpointSocketId, "hardpoint", "Functional", "Aim") ||
        !socketMatches(definition, component.muzzleSocketId, "muzzle", "Functional", "Aim") ||
        (component.muzzleFlashSocketId !== undefined &&
          !socketMatches(definition, component.muzzleFlashSocketId, "muzzleFlash", "Visual", "Aim"))
      );
    case "TurretWeapon":
      return (
        !socketMatches(definition, component.turretBaseSocketId, "turretBase", "Functional", "MountNormal") ||
        !socketMatches(definition, component.yawPivotSocketId, "turretYawPivot", "Functional", "Aim") ||
        !socketMatches(definition, component.pitchPivotSocketId, "turretPitchPivot", "Functional", "Aim") ||
        !socketMatches(definition, component.muzzleSocketId, "muzzle", "Functional", "Aim") ||
        (component.muzzleFlashSocketId !== undefined &&
          !socketMatches(definition, component.muzzleFlashSocketId, "muzzleFlash", "Visual", "Aim"))
      );
    case "SensorUtility":
      return !socketMatches(definition, component.mountSocketId, "hardpoint", "Functional", "Aim");
    case "DockingConnector":
      return !socketMatches(definition, component.connectorSocketId, "dockingConnector", "Functional", "Docking");
    default:
      return false;
  }
};

const validCameraAnchor = (definition: PartDefinition, socketId: string | undefined): boolean => {
  if (socketId === undefined) return false;
  const socket = socketById(definition, socketId);
  return (
    socket !== undefined &&
    socket.role === "Camera" &&
    socket.socketType === "cameraAnchor" &&
    socket.directionRole === "Camera" &&
    finiteNonZeroDirection(socket)
  );
};

interface Bounds {
  readonly minimum: { readonly x: number; readonly y: number; readonly z: number };
  readonly maximum: { readonly x: number; readonly y: number; readonly z: number };
  readonly volume: number;
}

const gameplayBounds = (instance: PartInstance, definition: PartDefinition): Bounds => {
  const footprint = definition.gridFootprint;
  const rotated = instance.localRotation.yaw === 90 || instance.localRotation.yaw === 270
    ? { x: footprint.z, y: footprint.y, z: footprint.x }
    : footprint;
  const half = { x: rotated.x / 2, y: rotated.y / 2, z: rotated.z / 2 };
  return {
    minimum: {
      x: instance.localGridPosition.x - half.x,
      y: instance.localGridPosition.y - half.y,
      z: instance.localGridPosition.z - half.z
    },
    maximum: {
      x: instance.localGridPosition.x + half.x,
      y: instance.localGridPosition.y + half.y,
      z: instance.localGridPosition.z + half.z
    },
    volume: rotated.x * rotated.y * rotated.z
  };
};

const sharedVolumeRatio = (left: Bounds, right: Bounds): number => {
  const x = Math.max(0, Math.min(left.maximum.x, right.maximum.x) - Math.max(left.minimum.x, right.minimum.x));
  const y = Math.max(0, Math.min(left.maximum.y, right.maximum.y) - Math.max(left.minimum.y, right.minimum.y));
  const z = Math.max(0, Math.min(left.maximum.z, right.maximum.z) - Math.max(left.minimum.z, right.minimum.z));
  const smallerVolume = Math.min(left.volume, right.volume);
  return smallerVolume > 0 ? (x * y * z) / smallerVolume : 0;
};

const availablePositive = (stat: { readonly availability: string; readonly value: unknown }): boolean =>
  stat.availability === "Available" && typeof stat.value === "number" && Number.isFinite(stat.value) && stat.value > 0;

const availableNumber = (
  stat: { readonly availability: string; readonly value: unknown }
): number | null =>
  stat.availability === "Available" && typeof stat.value === "number" && Number.isFinite(stat.value)
    ? stat.value
    : null;

const addRcsAxisDiagnostic = (
  diagnostics: MutableDiagnostic[],
  stat: { readonly availability: string; readonly value: unknown },
  code: HandlingDiagnosticCode,
  path: string,
  fix: HandlingSuggestedFixCode
): void => {
  if (!availablePositive(stat)) {
    diagnostics.push({
      phase: "Handling",
      code,
      severity: "Warning",
      path,
      details: { availability: stat.availability, value: stat.value as number | null },
      suggestedFixCodes: [fix]
    });
  }
};

const resolveStatsReport = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot,
  options: HandlingDiagnosticsEvaluationOptions,
  blueprintLayoutHashValue: string
): ShipStatsReport => {
  const report = options.statsReport ?? evaluateShipStats(source, catalog, options);

  const { signature: reportSignature, ...reportPayload } = report;
  if (canonicalJsonHash(reportPayload) !== reportSignature) {
    throw dataError("InvalidValue", "/statsReport/signature", "Stats report payload signature does not match.");
  }

  const canonicalPreview = createShipStatPreview(report.preview);
  if (
    canonicalPreview.signature !== report.preview.signature ||
    report.previewSignature !== report.preview.signature
  ) {
    throw dataError("InvalidValue", "/statsReport/previewSignature", "Embedded stats report preview provenance does not match.");
  }

  const canonicalPolicy = createShipAnalysisPolicy(report.policy);
  if (
    canonicalPolicy.signature !== report.policy.signature ||
    report.policySignature !== report.policy.signature
  ) {
    throw dataError("InvalidValue", "/statsReport/policySignature", "Embedded stats report policy provenance does not match.");
  }

  if (report.catalogSignature !== catalog.signature || report.blueprintLayoutHash !== blueprintLayoutHashValue) {
    throw dataError("InvalidValue", "/statsReport", "Stats report provenance does not match the evaluated ship.");
  }
  if (options.preview !== undefined && report.previewSignature !== createShipStatPreview(options.preview).signature) {
    throw dataError("InvalidValue", "/statsReport/previewSignature", "Stats report preview provenance does not match.");
  }
  if (options.policy !== undefined && report.policySignature !== createShipAnalysisPolicy(options.policy).signature) {
    throw dataError("InvalidValue", "/statsReport/policySignature", "Stats report policy provenance does not match.");
  }
  return report;
};

const unavailableRequiredStatKeys = Object.freeze([
  "dryMassKg",
  "totalLoadedMassKg",
  "mainThrustNewtons",
  "accelerationLoadedMps2",
  "centerOfMass"
] as const);

export const evaluateHandlingDiagnostics = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot,
  options: HandlingDiagnosticsEvaluationOptions = {}
): HandlingDiagnosticsReport => {
  const blueprint = createShipBlueprint(source, { catalog });
  const layoutHash = shipBlueprintLayoutHash(blueprint);
  const statsReport = resolveStatsReport(source, catalog, options, layoutHash);
  const structure = validateShipBlueprintStructure(blueprint, catalog, STARTER_SHIP_BUILDER_VALIDATION_POLICY);
  const diagnostics: MutableDiagnostic[] = [];
  const enabledInstances = blueprint.instances.filter((instance) => instance.enabled);
  const instanceEntries = enabledInstances.map((instance) => ({
    instance,
    definition: catalog.indexes.partById[instance.partDefinitionId]
  }));

  const controlCoreEntries = instanceEntries.flatMap(({ instance, definition }) =>
    definition.components
      .filter((component) => component.kind === "ControlCore")
      .map((component) => ({ instance, definition, component }))
  );
  if (controlCoreEntries.length === 0) {
    diagnostics.push({
      phase: "ControlStructure",
      code: "MissingControlCore",
      severity: "Error",
      path: "/instances",
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["AddControlCore"]
    });
  }

  if (structure.status === "Invalid") {
    diagnostics.push({
      phase: "ControlStructure",
      code: "InvalidRequiredStructure",
      severity: "Error",
      path: "/structure",
      relatedInstanceIds: structure.disconnectedInstanceIds,
      details: { diagnosticCodes: structure.diagnostics.filter((entry) => entry.severity === "Error").map((entry) => entry.code) },
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["ConnectRequiredStructure"]
    });
  }

  const stats = statsReport.stats;
  if (stats.mainThrustNewtons.availability !== "Available" || stats.mainThrustNewtons.value <= 0) {
    diagnostics.push({
      phase: "Propulsion",
      code: "NoMainThrust",
      severity: "Error",
      path: "/stats/mainThrustNewtons",
      details: { availability: stats.mainThrustNewtons.availability },
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["AddMainThruster"]
    });
  } else if (stats.deltaVMps.availability === "UnavailableMissingMetadata") {
    diagnostics.push({
      phase: "Propulsion",
      code: "MissingPropulsionMetadata",
      severity: "Error",
      path: "/stats/deltaVMps",
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["DeclarePropulsionSupply"]
    });
  } else if (stats.deltaVMps.availability === "UnavailableUnsupported") {
    diagnostics.push({
      phase: "Propulsion",
      code: "UnsupportedPropulsionMode",
      severity: "Error",
      path: "/stats/deltaVMps",
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["UseSingleSupportedPropellant"]
    });
  } else if (stats.deltaVMps.availability === "UnavailableNoFuel") {
    const requiredFuelKinds = instanceEntries.flatMap(({ definition }) =>
      definition.components.flatMap((component) =>
        component.kind === "MainThruster" && component.propulsionSupply?.mode === "Fuel"
          ? [component.propulsionSupply.fuelKind]
          : []
      )
    );
    const tankFuelKinds = new Set(
      instanceEntries.flatMap(({ definition }) =>
        definition.components.flatMap((component) => component.kind === "FuelTank" ? [component.fuelKind] : [])
      )
    );
    const hasCompatibleTank = requiredFuelKinds.length > 0 && requiredFuelKinds.every((fuelKind) => tankFuelKinds.has(fuelKind));
    diagnostics.push({
      phase: "Propulsion",
      code: hasCompatibleTank ? "NoRequiredFuel" : "NoCompatibleFuel",
      severity: "Error",
      path: "/stats/plannedFuelMassKg",
      details: { requiredFuelKinds: uniqueSorted(requiredFuelKinds) },
      blocks: bothReadinessLevels,
      suggestedFixCodes: [hasCompatibleTank ? "AddRequiredFuel" : "AddCompatibleFuelTank"]
    });
  }

  const translationStats = [
    stats.rcsTranslationPositiveX,
    stats.rcsTranslationNegativeX,
    stats.rcsTranslationPositiveY,
    stats.rcsTranslationNegativeY,
    stats.rcsTranslationPositiveZ,
    stats.rcsTranslationNegativeZ
  ];
  const torqueStats = [stats.pitchTorqueNm, stats.yawTorqueNm, stats.rollTorqueNm];
  if (!translationStats.some(availablePositive) || !torqueStats.some(availablePositive)) {
    diagnostics.push({
      phase: "Rcs",
      code: "MissingUsableRcs",
      severity: "Error",
      path: "/stats/rcs",
      details: {
        hasTranslation: translationStats.some(availablePositive),
        hasTorque: torqueStats.some(availablePositive)
      },
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["AddUsableRcs"]
    });
  }

  for (let leftIndex = 0; leftIndex < instanceEntries.length; leftIndex += 1) {
    const left = instanceEntries[leftIndex];
    const leftBounds = gameplayBounds(left.instance, left.definition);
    for (let rightIndex = leftIndex + 1; rightIndex < instanceEntries.length; rightIndex += 1) {
      const right = instanceEntries[rightIndex];
      const ratio = sharedVolumeRatio(leftBounds, gameplayBounds(right.instance, right.definition));
      if (ratio > statsReport.policy.hardOverlapRatio) {
        diagnostics.push({
          phase: "Geometry",
          code: "HardPartOverlap",
          severity: "Error",
          path: `/overlaps/${left.instance.stableInstanceId}/${right.instance.stableInstanceId}`,
          relatedInstanceIds: [left.instance.stableInstanceId, right.instance.stableInstanceId],
          relatedPartDefinitionIds: [left.definition.partDefinitionId, right.definition.partDefinitionId],
          details: { sharedVolumeRatio: ratio, threshold: statsReport.policy.hardOverlapRatio },
          blocks: bothReadinessLevels,
          suggestedFixCodes: ["ResolveHardOverlap"]
        });
      }
    }
  }

  for (const { instance, definition } of instanceEntries) {
    for (const component of definition.components) {
      if (componentHasInvalidFunctionalSocket(component, definition)) {
        diagnostics.push({
          phase: "FunctionalSockets",
          code: "FunctionalSocketInvalid",
          severity: "Error",
          path: `/instances/${instance.stableInstanceId}/components/${component.componentId}`,
          relatedInstanceIds: [instance.stableInstanceId],
          relatedPartDefinitionIds: [definition.partDefinitionId],
          details: { componentId: component.componentId, componentKind: component.kind },
          blocks: bothReadinessLevels,
          suggestedFixCodes: ["FixFunctionalSocket"]
        });
      }
    }
  }

  const thrustOffset = availableNumber(stats.thrustOffsetMeters);
  if (thrustOffset === null) {
    diagnostics.push({
      phase: "Handling",
      code: "ThrustOffsetUnavailable",
      severity: "Warning",
      path: "/stats/thrustOffsetMeters",
      details: { availability: stats.thrustOffsetMeters.availability },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["AlignThrustAxisWithCenterOfMass"]
    });
  } else if (thrustOffset > statsReport.policy.thrustOffsetWarningMeters) {
    diagnostics.push({
      phase: "Handling",
      code: "ThrustOffsetExceeded",
      severity: "Warning",
      path: "/stats/thrustOffsetMeters",
      details: { value: thrustOffset, threshold: statsReport.policy.thrustOffsetWarningMeters },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["AlignThrustAxisWithCenterOfMass"]
    });
  }
  const brakingRatio = availableNumber(stats.brakingRatio);
  if (brakingRatio === null) {
    diagnostics.push({
      phase: "Handling",
      code: "BrakingRatioUnavailable",
      severity: "Warning",
      path: "/stats/brakingRatio",
      details: { availability: stats.brakingRatio.availability },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["IncreaseBrakingAuthority"]
    });
  } else if (brakingRatio < statsReport.policy.weakBrakingRatio) {
    diagnostics.push({
      phase: "Handling",
      code: "WeakBraking",
      severity: "Warning",
      path: "/stats/brakingRatio",
      details: { value: brakingRatio, threshold: statsReport.policy.weakBrakingRatio },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["IncreaseBrakingAuthority"]
    });
  }
  const loadedAcceleration = availableNumber(stats.accelerationLoadedMps2);
  if (
    statsReport.policy.lowAccelerationMps2 !== null &&
    loadedAcceleration !== null &&
    loadedAcceleration < statsReport.policy.lowAccelerationMps2
  ) {
    diagnostics.push({
      phase: "Handling",
      code: "LowAcceleration",
      severity: "Warning",
      path: "/stats/accelerationLoadedMps2",
      details: { value: loadedAcceleration, threshold: statsReport.policy.lowAccelerationMps2 },
      suggestedFixCodes: ["IncreaseAccelerationOrReduceMass"]
    });
  }

  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationPositiveX, "MissingRcsPositiveX", "/stats/rcsTranslationPositiveX", "AddRcsPositiveX");
  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationNegativeX, "MissingRcsNegativeX", "/stats/rcsTranslationNegativeX", "AddRcsNegativeX");
  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationPositiveY, "MissingRcsPositiveY", "/stats/rcsTranslationPositiveY", "AddRcsPositiveY");
  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationNegativeY, "MissingRcsNegativeY", "/stats/rcsTranslationNegativeY", "AddRcsNegativeY");
  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationPositiveZ, "MissingRcsPositiveZ", "/stats/rcsTranslationPositiveZ", "AddRcsPositiveZ");
  addRcsAxisDiagnostic(diagnostics, stats.rcsTranslationNegativeZ, "MissingRcsNegativeZ", "/stats/rcsTranslationNegativeZ", "AddRcsNegativeZ");

  if (statsReport.policy.minimumRcsSymmetryRatio !== null) {
    const pairs = [
      [availableNumber(stats.rcsTranslationPositiveX), availableNumber(stats.rcsTranslationNegativeX)],
      [availableNumber(stats.rcsTranslationPositiveY), availableNumber(stats.rcsTranslationNegativeY)],
      [availableNumber(stats.rcsTranslationPositiveZ), availableNumber(stats.rcsTranslationNegativeZ)]
    ] as const;
    const ratios = pairs.flatMap(([positive, negative]) => {
      if (positive === null || negative === null || Math.max(positive, negative) <= 0) return [];
      return [Math.min(positive, negative) / Math.max(positive, negative)];
    });
    const symmetryRatio = ratios.length > 0 ? Math.min(...ratios) : null;
    if (symmetryRatio !== null && symmetryRatio < statsReport.policy.minimumRcsSymmetryRatio) {
      diagnostics.push({
        phase: "Handling",
        code: "RcsAuthorityAsymmetric",
        severity: "Warning",
        path: "/stats/rcsTranslation",
        details: { value: symmetryRatio, threshold: statsReport.policy.minimumRcsSymmetryRatio },
        suggestedFixCodes: ["RebalanceRcsAuthority"]
      });
    }
  }

  for (const [stat, code, path, fix] of [
    [stats.pitchTorqueNm, "MissingPitchAuthority", "/stats/pitchTorqueNm", "AddPitchAuthority"],
    [stats.yawTorqueNm, "MissingYawAuthority", "/stats/yawTorqueNm", "AddYawAuthority"],
    [stats.rollTorqueNm, "MissingRollAuthority", "/stats/rollTorqueNm", "AddRollAuthority"]
  ] as const) {
    if (!availablePositive(stat)) {
      diagnostics.push({
        phase: "Handling",
        code,
        severity: "Warning",
        path,
        details: { availability: stat.availability, value: stat.value },
        suggestedFixCodes: [fix]
      });
    }
  }

  const cargoMass = availableNumber(stats.plannedCargoMassKg);
  const cargoMassCapacity = availableNumber(stats.cargoMassCapacityKg);
  if (cargoMass !== null && cargoMassCapacity !== null && cargoMass > cargoMassCapacity) {
    diagnostics.push({
      phase: "Cargo",
      code: "CargoMassOverCapacity",
      severity: "Error",
      path: "/preview/cargoPreviewMassKg",
      details: { requested: cargoMass, capacity: cargoMassCapacity },
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["ReduceCargoPreviewMass"]
    });
  }
  const cargoVolume = availableNumber(stats.plannedCargoVolumeM3);
  const cargoVolumeCapacity = availableNumber(stats.cargoVolumeCapacityM3);
  if (cargoVolume !== null && cargoVolumeCapacity !== null && cargoVolume > cargoVolumeCapacity) {
    diagnostics.push({
      phase: "Cargo",
      code: "CargoVolumeOverCapacity",
      severity: "Error",
      path: "/preview/cargoPreviewVolumeM3",
      details: { requested: cargoVolume, capacity: cargoVolumeCapacity },
      blocks: bothReadinessLevels,
      suggestedFixCodes: ["ReduceCargoPreviewVolume"]
    });
  }

  const cameraEntries = controlCoreEntries.filter(({ definition, component }) =>
    validCameraAnchor(definition, component.cameraSocketId)
  );
  if (cameraEntries.length === 0) {
    diagnostics.push({
      phase: "Camera",
      code: "CameraAnchorMissing",
      severity: "Error",
      path: "/cameraAnchors",
      relatedInstanceIds: controlCoreEntries.map(({ instance }) => instance.stableInstanceId),
      details: { cameraAnchorCount: 0 },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["AddUniqueCameraAnchor"]
    });
  } else if (cameraEntries.length > 1) {
    diagnostics.push({
      phase: "Camera",
      code: "CameraAnchorAmbiguous",
      severity: "Error",
      path: "/cameraAnchors",
      relatedInstanceIds: cameraEntries.map(({ instance }) => instance.stableInstanceId),
      details: { cameraAnchorCount: cameraEntries.length },
      blocks: ["ActiveShipReady"],
      suggestedFixCodes: ["AddUniqueCameraAnchor"]
    });
  }

  const requiredUnavailable = new Set<string>();
  for (const key of unavailableRequiredStatKeys) {
    if (stats[key].availability !== "Available") requiredUnavailable.add(key);
  }
  for (const [key, stat] of Object.entries(stats).sort(([left], [right]) => compareText(left, right))) {
    if (stat.availability === "Available") continue;
    const required = requiredUnavailable.has(key) || stat.availability === "Invalid";
    diagnostics.push({
      phase: "StatAvailability",
      code: "StatUnavailable",
      severity: required ? "Error" : "Warning",
      path: `/stats/${key}`,
      details: { availability: stat.availability, required },
      blocks: required ? bothReadinessLevels : [],
      suggestedFixCodes: required ? ["ProvideRequiredStatMetadata"] : []
    });
  }

  const orderedDiagnostics = diagnostics.map(createDiagnostic).sort(compareDiagnostics);
  const suggestedFixCodes: HandlingSuggestedFixCode[] = [];
  for (const diagnostic of orderedDiagnostics) {
    for (const fix of diagnostic.suggestedFixCodes) {
      if (!suggestedFixCodes.includes(fix)) suggestedFixCodes.push(fix);
    }
  }
  const summary: HandlingDiagnosticsSummary = {
    diagnosticCount: orderedDiagnostics.length,
    errorCount: orderedDiagnostics.filter((entry) => entry.severity === "Error").length,
    warningCount: orderedDiagnostics.filter((entry) => entry.severity === "Warning").length,
    infoCount: orderedDiagnostics.filter((entry) => entry.severity === "Info").length,
    blockingTestFlightCount: orderedDiagnostics.filter((entry) => entry.blocks.includes("TestFlightReady")).length,
    blockingActiveShipCount: orderedDiagnostics.filter((entry) => entry.blocks.includes("ActiveShipReady")).length
  };
  const payload: HandlingDiagnosticsReportPayload = {
    reportVersion: 1,
    catalogSignature: catalog.signature,
    blueprintLayoutHash: layoutHash,
    previewSignature: statsReport.previewSignature,
    policySignature: statsReport.policySignature,
    statsSignature: statsReport.signature,
    structureSignature: structure.signature,
    diagnostics: orderedDiagnostics,
    suggestedFixCodes,
    summary
  };
  return deepFreeze({ ...payload, signature: canonicalJsonHash(payload) }) as HandlingDiagnosticsReport;
};
