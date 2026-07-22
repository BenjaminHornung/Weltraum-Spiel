import {
  cloneAndFreezeShipPowerThermalValue,
  createShipPowerThermalSignature,
  serializeCanonicalShipPowerThermalValue
} from "./canonical";
import { createShipPowerThermalEvents } from "./events";
import { evaluateShipPowerAllocation } from "./powerAllocation";
import { deriveShipPowerThermalProtectionActions } from "./protection";
import { evaluateShipThermal } from "./thermal";
import type {
  ShipPowerThermalState,
  ShipPowerThermalStepInput,
  ShipPowerThermalStepResult,
  ShipPowerThermalStepSuccess
} from "./types";
import {
  ShipPowerThermalValidationError,
  type ShipPowerThermalValidationIssue,
  validateShipPowerThermalStepInput
} from "./validation";

type ShipPowerThermalSemanticStepSuccess = Omit<
  ShipPowerThermalStepSuccess,
  "canonicalJson" | "signature"
>;

const failure = (
  issues: readonly ShipPowerThermalValidationIssue[]
): ShipPowerThermalStepResult<ShipPowerThermalValidationIssue> =>
  cloneAndFreezeShipPowerThermalValue({ ok: false as const, issues }) as ShipPowerThermalStepResult<ShipPowerThermalValidationIssue>;

/**
 * Evaluates one authoritative fixed step. The numbered blocks preserve the
 * approved pipeline order; stages 2-7 are one indivisible power-allocation
 * evaluation and therefore cannot perform a hidden second consumer round.
 */
export const evaluateShipPowerThermalStep = (
  input: ShipPowerThermalStepInput
): ShipPowerThermalStepResult<ShipPowerThermalValidationIssue> => {
  // 1. Validate and canonicalize definitions, state, tick, and delta time.
  const validation = validateShipPowerThermalStepInput(input);
  if (!validation.ok) return failure(validation.issues);
  const validated = validation.value;

  try {
    // 2. Determine source outputs within ramp limits.
    // 3. Determine normal and Critical-only emergency battery discharge.
    // 4. Allocate consumers by fixed priority.
    // 5. Distribute an undersupplied class proportionally with stable-ID remainder.
    // 6. Finalize consumer outcomes without reallocation.
    // 7. Charge batteries from final surplus.
    const power = evaluateShipPowerAllocation(validated);

    // 8. Build loss/explicit heat, apply cooling, and integrate temperature.
    const thermal = evaluateShipThermal(validated, power);

    // 9. Derive protection actions and canonical events.
    const actions = deriveShipPowerThermalProtectionActions(validated.definitions, power, thermal);
    const events = createShipPowerThermalEvents(validated, power, thermal);

    const state: ShipPowerThermalState = {
      tick: validated.tick,
      sources: power.nextSourceStates,
      batteries: power.nextBatteryStates,
      thermalNodes: thermal.nextThermalNodeStates,
      cooling: thermal.nextCoolingStates
    };
    const semantic: ShipPowerThermalSemanticStepSuccess = {
      ok: true,
      state,
      sourceResults: power.sourceResults,
      consumerResults: power.consumerResults,
      batteryResults: power.batteryResults,
      coolingResults: thermal.coolingResults,
      thermalResults: thermal.thermalResults,
      actions,
      events
    };
    const canonicalJson = serializeCanonicalShipPowerThermalValue(semantic);
    const signature = createShipPowerThermalSignature(semantic);

    // 10. Publish only the recursively frozen canonical result.
    return cloneAndFreezeShipPowerThermalValue({
      ...semantic,
      canonicalJson,
      signature
    }) as ShipPowerThermalStepSuccess;
  } catch (error) {
    if (error instanceof ShipPowerThermalValidationError) return failure(error.issues);
    if (error instanceof RangeError) {
      return failure([{
        code: "ARITHMETIC_OVERFLOW",
        path: "/state",
        message: "Validated values would produce non-finite arithmetic."
      }]);
    }
    throw error;
  }
};
