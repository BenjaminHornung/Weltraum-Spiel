import { deepFreezeSuit, lexicalSuitCompare } from "./canonical";
import { requireDenseSuitArray } from "./denseArray";
import type { SuitAlert, SuitAlertCode, SuitAlertSeverity, SuitDefinition, SuitStateSnapshot } from "./types";
import { deriveBoundedSuitId } from "./derivedIdentity";
import {
  createSuitAlertId, createSuitSourceId, requireAlertCode, requireAlertSeverity, requireRecord,
  requireSafeInteger, requireVersionText
} from "./validation";

const alert = (
  code: SuitAlertCode,
  severity: SuitAlertSeverity,
  measurement: number,
  threshold: number,
  source: string,
  suggestedAction: string
): SuitAlert => {
  const sourceId = createSuitSourceId(source);
  return deepFreezeSuit({
    alertId: deriveBoundedSuitId(`alert:${code.toLowerCase()}:`, sourceId, "", "/alert/alertId"),
    code, severity, measurement, threshold, sourceId, suggestedAction
  });
};

export const SUIT_ALERT_CODES_IN_PRIORITY = [
  "ActorIncapacitated", "OxygenDepleted", "OxygenCritical", "EnergyCritical", "TemperatureCritical",
  "RadiationCritical", "ContaminationCritical", "SealCritical", "EquipmentBusOffline", "SubsystemFault",
  "OxygenLow", "EnergyLow", "TemperatureLow", "TemperatureHigh", "RadiationElevated",
  "ContaminationElevated", "SealDamaged"
] as const;

const cloneSuitAlert = (value: unknown, path: string): SuitAlert => {
  const input = requireRecord(value, path);
  return {
    alertId: createSuitAlertId(input.alertId, `${path}/alertId`),
    code: requireAlertCode(input.code, `${path}/code`),
    severity: requireAlertSeverity(input.severity, `${path}/severity`),
    measurement: requireSafeInteger(input.measurement, `${path}/measurement`),
    threshold: requireSafeInteger(input.threshold, `${path}/threshold`),
    sourceId: createSuitSourceId(input.sourceId, `${path}/sourceId`),
    suggestedAction: requireVersionText(input.suggestedAction, `${path}/suggestedAction`)
  };
};

export const sortSuitAlerts = (alerts: readonly SuitAlert[]): readonly SuitAlert[] => {
  const severityRank = { Critical: 3, Warning: 2, Caution: 1, Info: 0 } as const;
  const codeRank = new Map(SUIT_ALERT_CODES_IN_PRIORITY.map((code, index) => [code, index]));
  const canonicalAlerts = requireDenseSuitArray(alerts, "/alerts")
    .map((entry, index) => cloneSuitAlert(entry, `/alerts/${index}`));
  return deepFreezeSuit(canonicalAlerts.sort((a, b) =>
    severityRank[b.severity] - severityRank[a.severity]
    || (codeRank.get(a.code) ?? Number.MAX_SAFE_INTEGER) - (codeRank.get(b.code) ?? Number.MAX_SAFE_INTEGER)
    || lexicalSuitCompare(a.sourceId, b.sourceId)
    || lexicalSuitCompare(a.alertId, b.alertId)
  ));
};

type SuitAlertDerivationState = Pick<SuitStateSnapshot,
  "oxygenMilligrams" | "energyMillijoules" | "sealIntegrityBasisPoints" | "internalTemperatureMilliKelvin"
  | "radiationMicrosieverts" | "contaminationMicroUnits" | "subsystemStates" | "actorIncapacitated"
  | "healthMilliPoints"
>;

export const isSuitEquipmentBusOnline = (state: SuitAlertDerivationState, definition: SuitDefinition): boolean => {
  const busIds = definition.subsystemDefinitions.filter((entry) => entry.role === "equipment-bus").map((entry) => entry.subsystemId);
  return busIds.length > 0 && state.subsystemStates.some((entry) => busIds.includes(entry.subsystemId) && entry.status === "Enabled" && entry.powerState === "Powered");
};

export const deriveSuitAlerts = (state: SuitAlertDerivationState, definition: SuitDefinition): readonly SuitAlert[] => {
  const result: SuitAlert[] = [];
  const thresholds = definition.alerts;
  if (state.oxygenMilligrams === 0) result.push(alert("OxygenDepleted", "Critical", 0, 0, "suit:oxygen", "resupply-oxygen"));
  else if (state.oxygenMilligrams <= thresholds.oxygenCriticalMilligrams) result.push(alert("OxygenCritical", "Critical", state.oxygenMilligrams, thresholds.oxygenCriticalMilligrams, "suit:oxygen", "resupply-oxygen"));
  else if (state.oxygenMilligrams <= thresholds.oxygenLowMilligrams) result.push(alert("OxygenLow", "Warning", state.oxygenMilligrams, thresholds.oxygenLowMilligrams, "suit:oxygen", "conserve-oxygen"));

  if (state.energyMillijoules <= thresholds.energyCriticalMillijoules) result.push(alert("EnergyCritical", "Critical", state.energyMillijoules, thresholds.energyCriticalMillijoules, "suit:energy", "recharge-energy"));
  else if (state.energyMillijoules <= thresholds.energyLowMillijoules) result.push(alert("EnergyLow", "Warning", state.energyMillijoules, thresholds.energyLowMillijoules, "suit:energy", "conserve-energy"));

  if (state.sealIntegrityBasisPoints <= thresholds.sealCriticalBasisPoints) result.push(alert("SealCritical", "Critical", state.sealIntegrityBasisPoints, thresholds.sealCriticalBasisPoints, "suit:seal", "repair-seal"));
  else if (state.sealIntegrityBasisPoints <= thresholds.sealDamagedBasisPoints) result.push(alert("SealDamaged", "Warning", state.sealIntegrityBasisPoints, thresholds.sealDamagedBasisPoints, "suit:seal", "repair-seal"));

  const temperature = definition.temperature;
  if (state.internalTemperatureMilliKelvin <= temperature.criticalLowMilliKelvin) result.push(alert("TemperatureCritical", "Critical", state.internalTemperatureMilliKelvin, temperature.criticalLowMilliKelvin, "suit:temperature", "restore-thermal-control"));
  else if (state.internalTemperatureMilliKelvin >= temperature.criticalHighMilliKelvin) result.push(alert("TemperatureCritical", "Critical", state.internalTemperatureMilliKelvin, temperature.criticalHighMilliKelvin, "suit:temperature", "restore-thermal-control"));
  else if (state.internalTemperatureMilliKelvin <= temperature.warningLowMilliKelvin) result.push(alert("TemperatureLow", "Warning", state.internalTemperatureMilliKelvin, temperature.warningLowMilliKelvin, "suit:temperature", "restore-thermal-control"));
  else if (state.internalTemperatureMilliKelvin >= temperature.warningHighMilliKelvin) result.push(alert("TemperatureHigh", "Warning", state.internalTemperatureMilliKelvin, temperature.warningHighMilliKelvin, "suit:temperature", "restore-thermal-control"));

  if (state.radiationMicrosieverts >= thresholds.radiationCriticalMicrosieverts) result.push(alert("RadiationCritical", "Critical", state.radiationMicrosieverts, thresholds.radiationCriticalMicrosieverts, "suit:radiation", "leave-radiation"));
  else if (state.radiationMicrosieverts >= thresholds.radiationElevatedMicrosieverts) result.push(alert("RadiationElevated", "Warning", state.radiationMicrosieverts, thresholds.radiationElevatedMicrosieverts, "suit:radiation", "leave-radiation"));

  if (state.contaminationMicroUnits >= thresholds.contaminationCriticalMicroUnits) result.push(alert("ContaminationCritical", "Critical", state.contaminationMicroUnits, thresholds.contaminationCriticalMicroUnits, "suit:contamination", "decontaminate"));
  else if (state.contaminationMicroUnits >= thresholds.contaminationElevatedMicroUnits) result.push(alert("ContaminationElevated", "Warning", state.contaminationMicroUnits, thresholds.contaminationElevatedMicroUnits, "suit:contamination", "decontaminate"));

  // Fault presence is a binary scalar; subsystem revision is history, not an alert measurement.
  for (const subsystem of state.subsystemStates.filter((entry) => entry.status === "Faulted")) {
    result.push(alert("SubsystemFault", "Warning", 1, 1, subsystem.subsystemId, "repair-subsystem"));
  }
  if (!isSuitEquipmentBusOnline(state, definition)) result.push(alert("EquipmentBusOffline", "Critical", 0, 1, "suit:equipment-bus", "restore-equipment-bus"));
  if (state.actorIncapacitated) result.push(alert("ActorIncapacitated", "Critical", state.healthMilliPoints, 0, "suit:actor", "seek-assistance"));
  return sortSuitAlerts(result);
};
