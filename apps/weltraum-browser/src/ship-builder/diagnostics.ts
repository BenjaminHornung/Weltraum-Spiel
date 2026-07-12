import { canonicalizeJson, canonicalJsonStringify } from "./canonicalJson";
import type { ConnectionId, PartInstanceId, SocketId } from "./ids";
import { deepFreeze } from "./validation";
import type { JsonValue } from "./validation";

export const SHIP_BUILDER_DIAGNOSTIC_CODE_ORDER = Object.freeze([
  "NoEnabledInstances",
  "ConnectionEndpointDisabled",
  "IdenticalConnectionEndpoints",
  "SelfConnectionNotAllowed",
  "SocketTypeIncompatible",
  "ConnectionTypeIncompatible",
  "SocketCapacityIncompatible",
  "SocketCategoryIncompatible",
  "SocketComponentKindIncompatible",
  "SocketMountSideIncompatible",
  "SocketDirectionInvalid",
  "SocketDirectionsIncompatible",
  "ExclusiveSocketOccupiedMultipleTimes",
  "RequiredSocketUnused",
  "DisconnectedInstances",
  "NonFiniteDryMassAggregate",
  "ZeroDryMass",
  "NonFiniteCenterOfMass",
  "InvalidGridBounds"
] as const);

export type ShipBuilderDiagnosticCode = (typeof SHIP_BUILDER_DIAGNOSTIC_CODE_ORDER)[number];
export type ShipBuilderDiagnosticSeverity = "Error" | "Warning" | "Info";
export type ShipBuilderValidationStatus = "Invalid" | "ValidWithWarnings" | "Valid";
export type ShipBuilderDiagnosticPhase =
  | "Blueprint"
  | "ConnectionCompatibility"
  | "Occupancy"
  | "RequiredSockets"
  | "Graph"
  | "MassProperties";

export interface ShipBuilderDiagnosticEndpoint {
  readonly partInstanceId: PartInstanceId;
  readonly socketId: SocketId;
}

export interface ShipBuilderDiagnostic {
  readonly code: ShipBuilderDiagnosticCode;
  readonly severity: ShipBuilderDiagnosticSeverity;
  readonly phase: ShipBuilderDiagnosticPhase;
  readonly path: string;
  readonly instanceIds: readonly PartInstanceId[];
  readonly connectionIds: readonly ConnectionId[];
  readonly endpoints: readonly ShipBuilderDiagnosticEndpoint[];
  readonly details?: JsonValue;
}

export interface ShipBuilderDiagnosticInput {
  readonly code: ShipBuilderDiagnosticCode;
  readonly severity: ShipBuilderDiagnosticSeverity;
  readonly phase: ShipBuilderDiagnosticPhase;
  readonly path: string;
  readonly instanceIds?: readonly PartInstanceId[];
  readonly connectionIds?: readonly ConnectionId[];
  readonly endpoints?: readonly ShipBuilderDiagnosticEndpoint[];
  readonly details?: unknown;
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const sortedUniqueText = <TValue extends string>(values: readonly TValue[]): readonly TValue[] =>
  [...new Set(values)].sort(compareText) as TValue[];

export const compareShipBuilderDiagnosticEndpoints = (
  left: ShipBuilderDiagnosticEndpoint,
  right: ShipBuilderDiagnosticEndpoint
): number => {
  const instanceComparison = compareText(left.partInstanceId, right.partInstanceId);
  return instanceComparison !== 0 ? instanceComparison : compareText(left.socketId, right.socketId);
};

const orderedUniqueEndpoints = (
  endpoints: readonly ShipBuilderDiagnosticEndpoint[]
): readonly ShipBuilderDiagnosticEndpoint[] => {
  const ordered = endpoints
    .map((endpoint) => ({
      partInstanceId: endpoint.partInstanceId,
      socketId: endpoint.socketId
    }))
    .sort(compareShipBuilderDiagnosticEndpoints);
  return ordered.filter(
    (endpoint, index) =>
      index === 0 || compareShipBuilderDiagnosticEndpoints(ordered[index - 1], endpoint) !== 0
  );
};

export const createShipBuilderDiagnostic = (input: ShipBuilderDiagnosticInput): ShipBuilderDiagnostic =>
  deepFreeze({
    code: input.code,
    severity: input.severity,
    phase: input.phase,
    path: input.path,
    instanceIds: sortedUniqueText(input.instanceIds ?? []),
    connectionIds: sortedUniqueText(input.connectionIds ?? []),
    endpoints: orderedUniqueEndpoints(input.endpoints ?? []),
    ...(input.details !== undefined ? { details: canonicalizeJson(input.details) } : {})
  }) as ShipBuilderDiagnostic;

const diagnosticCodeRank = new Map<ShipBuilderDiagnosticCode, number>(
  SHIP_BUILDER_DIAGNOSTIC_CODE_ORDER.map((code, index) => [code, index])
);

const severityRank: Readonly<Record<ShipBuilderDiagnosticSeverity, number>> = Object.freeze({
  Error: 0,
  Warning: 1,
  Info: 2
});

export const compareShipBuilderDiagnostics = (
  left: ShipBuilderDiagnostic,
  right: ShipBuilderDiagnostic
): number => {
  const codeComparison = (diagnosticCodeRank.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
    (diagnosticCodeRank.get(right.code) ?? Number.MAX_SAFE_INTEGER);
  if (codeComparison !== 0) {
    return codeComparison;
  }

  const severityComparison = severityRank[left.severity] - severityRank[right.severity];
  if (severityComparison !== 0) {
    return severityComparison;
  }

  const phaseComparison = compareText(left.phase, right.phase);
  if (phaseComparison !== 0) {
    return phaseComparison;
  }

  const pathComparison = compareText(left.path, right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }

  return compareText(canonicalJsonStringify(left), canonicalJsonStringify(right));
};

export const orderShipBuilderDiagnostics = (
  diagnostics: readonly ShipBuilderDiagnostic[]
): readonly ShipBuilderDiagnostic[] =>
  deepFreeze(diagnostics.map((diagnostic) => createShipBuilderDiagnostic(diagnostic)).sort(compareShipBuilderDiagnostics));

export const shipBuilderValidationStatusForDiagnostics = (
  diagnostics: readonly Pick<ShipBuilderDiagnostic, "severity">[]
): ShipBuilderValidationStatus => {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "Error")) {
    return "Invalid";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "Warning")) {
    return "ValidWithWarnings";
  }
  return "Valid";
};
