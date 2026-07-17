import { createSuitSignature, deepFreezeSuit } from "./canonical";
import { isSuitEquipmentBusOnline } from "./alerts";
import { validateSuitStateSnapshot } from "./models";
import type { SuitDefinition, SuitEquipmentInterfaceSnapshot, SuitStateSnapshot } from "./types";
import { saturatingIncrease } from "./validation";

export const createSuitEquipmentInterfaceSnapshot = (
  state: SuitStateSnapshot,
  definition: SuitDefinition
): SuitEquipmentInterfaceSnapshot => {
  const validatedState = validateSuitStateSnapshot(state, definition);
  const equipmentBusOnline = isSuitEquipmentBusOnline(validatedState, definition);
  const sum = (field: "continuousPowerBudgetMilliwatts" | "pulseEnergyReserveMillijoules" | "thermalDissipationBudgetMilliwatts"): number =>
    definition.interfaceDefinitions.reduce((total, entry) => saturatingIncrease(total, entry[field], Number.MAX_SAFE_INTEGER, `/equipment/${field}`), 0);
  const unsigned = {
    stateId: validatedState.stateId,
    definitionId: definition.definitionId,
    revision: validatedState.revision,
    interfaceIds: definition.interfaceDefinitions.map((entry) => entry.interfaceId),
    continuousPowerBudgetMilliwatts: equipmentBusOnline ? sum("continuousPowerBudgetMilliwatts") : 0,
    pulseEnergyAvailableMillijoules: equipmentBusOnline ? Math.min(validatedState.energyMillijoules, sum("pulseEnergyReserveMillijoules")) : 0,
    thermalDissipationBudgetMilliwatts: equipmentBusOnline ? sum("thermalDissipationBudgetMilliwatts") : 0,
    equipmentBusOnline,
    actorIncapacitated: validatedState.actorIncapacitated
  };
  return deepFreezeSuit({ ...unsigned, canonicalSignature: createSuitSignature(unsigned) });
};
