import { canonicalSurfaceEquipmentJson, cloneAndFreezeSurfaceEquipmentValue } from "./canonical";
import type { SurfaceEquipmentModuleInstanceId, SurfaceEquipmentSlotId } from "./ids";
import { compareSurfaceEquipmentText } from "./validation";

export const SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER = Object.freeze([
  "MissingRequiredSlot",
  "SlotCountMismatch",
  "SlotTypeMismatch",
  "SlotRoleMismatch",
  "TagIncompatible",
  "InterfaceMissing",
  "MassLimitExceeded",
  "BulkLimitExceeded",
  "ContinuousPowerExceeded",
  "PulseEnergyExceeded",
  "ThermalBudgetExceeded",
  "AmmoFeedMissing",
  "MagazineMissing",
  "ControlMissing",
  "SafetyMissing",
  "SafetyCertificationInvalid",
  "DamageDeliveryIncomplete",
  "CapabilityUnsatisfied",
  "ResourceRequirementInvalid",
  "AggregateOverflow",
  "SuitActorIncapacitated",
  "SuitEquipmentBusOffline",
  "LegalConfigurationInvalid",
  "DuplicateModuleInstance",
  "RevisionConflict",
  "DuplicateCommand",
  "BlueprintMismatch",
  "UnknownModuleInstance",
  "UnknownModule",
  "UnknownSlot",
  "SlotCapacityExceeded",
  "CalibrationInvalid",
  "GripRequirementUnsatisfied",
  "InvalidCommand"
] as const);

export type SurfaceEquipmentDiagnosticCode = (typeof SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER)[number];
export type SurfaceEquipmentDiagnosticSeverity = "Error" | "Warning" | "Info";
export type SurfaceEquipmentDiagnosticPhase =
  | "Command"
  | "Structure"
  | "Compatibility"
  | "Capability"
  | "Resource"
  | "Suit"
  | "SafetyLegal";

export interface SurfaceEquipmentDiagnostic {
  readonly code: SurfaceEquipmentDiagnosticCode;
  readonly severity: SurfaceEquipmentDiagnosticSeverity;
  readonly phase: SurfaceEquipmentDiagnosticPhase;
  readonly path: string;
  readonly moduleInstanceId?: SurfaceEquipmentModuleInstanceId;
  readonly slotId?: SurfaceEquipmentSlotId;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SurfaceEquipmentDiagnosticInput extends Omit<SurfaceEquipmentDiagnostic, "details"> {
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

const codeRank = new Map<SurfaceEquipmentDiagnosticCode, number>(
  SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER.map((code, index) => [code, index])
);
const severityRank: Readonly<Record<SurfaceEquipmentDiagnosticSeverity, number>> = Object.freeze({
  Error: 0,
  Warning: 1,
  Info: 2
});

export const createSurfaceEquipmentDiagnostic = (
  input: SurfaceEquipmentDiagnosticInput
): SurfaceEquipmentDiagnostic => cloneAndFreezeSurfaceEquipmentValue({
  code: input.code,
  severity: input.severity,
  phase: input.phase,
  path: input.path,
  ...(input.moduleInstanceId === undefined ? {} : { moduleInstanceId: input.moduleInstanceId }),
  ...(input.slotId === undefined ? {} : { slotId: input.slotId }),
  message: input.message,
  ...(input.details === undefined ? {} : { details: input.details })
}) as SurfaceEquipmentDiagnostic;

export const compareSurfaceEquipmentDiagnostics = (
  left: SurfaceEquipmentDiagnostic,
  right: SurfaceEquipmentDiagnostic
): number => {
  const codeComparison = (codeRank.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
    (codeRank.get(right.code) ?? Number.MAX_SAFE_INTEGER);
  if (codeComparison !== 0) return codeComparison;
  const phaseComparison = compareSurfaceEquipmentText(left.phase, right.phase);
  if (phaseComparison !== 0) return phaseComparison;
  const severityComparison = severityRank[left.severity] - severityRank[right.severity];
  if (severityComparison !== 0) return severityComparison;
  const pathComparison = compareSurfaceEquipmentText(left.path, right.path);
  if (pathComparison !== 0) return pathComparison;
  const instanceComparison = compareSurfaceEquipmentText(left.moduleInstanceId ?? "", right.moduleInstanceId ?? "");
  if (instanceComparison !== 0) return instanceComparison;
  const slotComparison = compareSurfaceEquipmentText(left.slotId ?? "", right.slotId ?? "");
  return slotComparison !== 0
    ? slotComparison
    : compareSurfaceEquipmentText(canonicalSurfaceEquipmentJson(left), canonicalSurfaceEquipmentJson(right));
};

export const orderSurfaceEquipmentDiagnostics = (
  diagnostics: readonly SurfaceEquipmentDiagnosticInput[]
): readonly SurfaceEquipmentDiagnostic[] => cloneAndFreezeSurfaceEquipmentValue(
  diagnostics.map(createSurfaceEquipmentDiagnostic).sort(compareSurfaceEquipmentDiagnostics)
) as readonly SurfaceEquipmentDiagnostic[];
