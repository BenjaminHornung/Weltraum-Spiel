import { createShipBlueprint, shipBlueprintLayoutHash } from "./blueprint";
import { canonicalJsonHash } from "./canonicalJson";
import { evaluateHandlingDiagnostics } from "./handlingDiagnostics";
import type {
  FlightReadinessLevel,
  HandlingDiagnostic,
  HandlingDiagnosticCode,
  HandlingDiagnosticsReport,
  HandlingSuggestedFixCode
} from "./handlingDiagnostics";
import { evaluateShipStats } from "./shipStats";
import type { ShipPartCatalogSnapshot, ShipStatsEvaluationOptions, ShipStatsReport } from "./types";
import { deepFreeze } from "./validation";

export type ShipFlightReadinessStatus = "DraftValid" | "TestFlightReady" | "ActiveShipReady";

export interface ShipFlightReadinessAssessment {
  readonly level: ShipFlightReadinessStatus;
  readonly eligible: boolean;
  readonly blockingDiagnosticCodes: readonly HandlingDiagnosticCode[];
  readonly warningDiagnosticCodes: readonly HandlingDiagnosticCode[];
  readonly suggestedFixCodes: readonly HandlingSuggestedFixCode[];
}

export interface ShipFlightReadinessAssessments {
  readonly draft: ShipFlightReadinessAssessment;
  readonly testFlight: ShipFlightReadinessAssessment;
  readonly activeShip: ShipFlightReadinessAssessment;
}

export interface ShipFlightReadinessReportPayload {
  readonly reportVersion: 1;
  readonly catalogSignature: string;
  readonly blueprintLayoutHash: string;
  readonly previewSignature: string;
  readonly policySignature: string;
  readonly statsSignature: string;
  readonly handlingSignature: string;
  readonly status: ShipFlightReadinessStatus;
  readonly assessments: ShipFlightReadinessAssessments;
  readonly statsReport: ShipStatsReport;
  readonly handlingReport: HandlingDiagnosticsReport;
}

export interface ShipFlightReadinessReport extends ShipFlightReadinessReportPayload {
  readonly signature: string;
}

const uniqueCodes = <TValue extends string>(values: readonly TValue[]): readonly TValue[] => [...new Set(values)];

const assessmentFor = (
  level: ShipFlightReadinessStatus,
  diagnostics: readonly HandlingDiagnostic[],
  blockingLevel: FlightReadinessLevel | null
): ShipFlightReadinessAssessment => {
  const blockingDiagnostics = blockingLevel === null
    ? []
    : diagnostics.filter((diagnostic) => diagnostic.blocks.includes(blockingLevel));
  const warningDiagnostics = blockingLevel === null
    ? diagnostics
    : diagnostics.filter((diagnostic) => !diagnostic.blocks.includes(blockingLevel));
  return {
    level,
    eligible: blockingDiagnostics.length === 0,
    blockingDiagnosticCodes: uniqueCodes(blockingDiagnostics.map((diagnostic) => diagnostic.code)),
    warningDiagnosticCodes: uniqueCodes(warningDiagnostics.map((diagnostic) => diagnostic.code)),
    suggestedFixCodes: uniqueCodes(
      diagnostics.flatMap((diagnostic) => diagnostic.suggestedFixCodes)
    )
  };
};

export const evaluateShipFlightReadiness = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot,
  options: ShipStatsEvaluationOptions = {}
): ShipFlightReadinessReport => {
  const blueprint = createShipBlueprint(source, { catalog });
  const statsReport = evaluateShipStats(blueprint, catalog, options);
  const handlingReport = evaluateHandlingDiagnostics(blueprint, catalog, { statsReport });
  const draft = assessmentFor("DraftValid", handlingReport.diagnostics, null);
  const testFlight = assessmentFor("TestFlightReady", handlingReport.diagnostics, "TestFlightReady");
  const activeShip = assessmentFor("ActiveShipReady", handlingReport.diagnostics, "ActiveShipReady");
  const status: ShipFlightReadinessStatus = activeShip.eligible
    ? "ActiveShipReady"
    : testFlight.eligible
      ? "TestFlightReady"
      : "DraftValid";
  const payload: ShipFlightReadinessReportPayload = {
    reportVersion: 1,
    catalogSignature: catalog.signature,
    blueprintLayoutHash: shipBlueprintLayoutHash(blueprint),
    previewSignature: statsReport.previewSignature,
    policySignature: statsReport.policySignature,
    statsSignature: statsReport.signature,
    handlingSignature: handlingReport.signature,
    status,
    assessments: { draft, testFlight, activeShip },
    statsReport,
    handlingReport
  };
  return deepFreeze({ ...payload, signature: canonicalJsonHash(payload) }) as ShipFlightReadinessReport;
};
