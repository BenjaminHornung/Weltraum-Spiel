import { compareAdaptiveBrickKeys, validateAdaptiveBrickKey } from "./coordinates";
import { validateAdaptiveEditJournal, adaptiveValidateEditJournalSteps, type AdaptiveOwnedJournalOptions } from "./edits";
import { ADAPTIVE_MAX_RESIDENT_SUMMARIES, validateAdaptiveBaseFieldDescriptor } from "./canonical";
import type { AdaptiveBaseFieldDescriptor, AdaptiveBrickKey, AdaptiveEditJournal } from "./types";
import { deepFreeze, fail, adaptiveDrainSteps, adaptiveIsDeepFrozenSteps, requireDenseDataPropertyArray, requireExactKeys, requirePlainRecord } from "./validation";

export interface AdaptiveAuthorityRetention {
  readonly baseField: AdaptiveBaseFieldDescriptor;
  readonly editJournal: AdaptiveEditJournal;
}

export const createAdaptiveAuthorityRetention = (input: AdaptiveAuthorityRetention): AdaptiveAuthorityRetention =>
  adaptiveDrainSteps(adaptiveAuthorityRetentionSteps(input));

/** Direct-module only, one borrowed ledger; retains the complete original authority. */
export function* adaptiveAuthorityRetentionSteps(input: AdaptiveAuthorityRetention,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveAuthorityRetention, void> {
  owned?.reserve(8_192, true);
  const record = requirePlainRecord(input, "authority");
  requireExactKeys(record, ["baseField", "editJournal"], "authority");
  const baseField = validateAdaptiveBaseFieldDescriptor(input.baseField);
  const editJournal = owned === undefined ? validateAdaptiveEditJournal(input.editJournal)
    : yield* adaptiveValidateEditJournalSteps(input.editJournal, owned);
  return owned === undefined ? deepFreeze({ baseField, editJournal }) : Object.freeze({ baseField, editJournal });
}

const validateAuthorityRetention = (value: AdaptiveAuthorityRetention): AdaptiveAuthorityRetention =>
  adaptiveDrainSteps(adaptiveValidateAuthorityRetentionSteps(value));

/** Checks the ORIGINAL retained object, not a freshly frozen replacement or an invented brand. */
export function* adaptiveValidateAuthorityRetentionSteps(value: AdaptiveAuthorityRetention,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveAuthorityRetention, void> {
  owned?.reserve(8_192);
  const record = requirePlainRecord(value, "authority");
  requireExactKeys(record, ["baseField", "editJournal"], "authority");
  validateAdaptiveBaseFieldDescriptor(value.baseField);
  if (owned === undefined) { validateAdaptiveEditJournal(value.editJournal); }
  else { yield* adaptiveValidateEditJournalSteps(value.editJournal, owned); }
  if (!(yield* adaptiveIsDeepFrozenSteps(value, undefined, owned?.reserve))) {
    return fail("InvalidBaseField", "authority", "Authority retention descriptors must be created and deeply frozen before release.");
  }
  return value;
}

export interface AdaptiveResidencyRelease {
  readonly mode: "collapse" | "evict";
  readonly authorityRetained: true;
  readonly authority: AdaptiveAuthorityRetention;
  readonly residentKeys: readonly AdaptiveBrickKey[];
  readonly releasedKeys: readonly AdaptiveBrickKey[];
}

export const releaseAdaptiveResidency = (
  residentValues: readonly AdaptiveBrickKey[],
  releaseValues: readonly AdaptiveBrickKey[],
  mode: "collapse" | "evict",
  authorityValue: AdaptiveAuthorityRetention
): AdaptiveResidencyRelease => {
  if (mode !== "collapse" && mode !== "evict") return fail("InvalidPlannerInput", "mode", "Residency release mode must be collapse or evict.");
  const residentInput = requireDenseDataPropertyArray(
    residentValues,
    "residentKeys",
    "InvalidPlannerInput",
    { maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES }
  ) as readonly AdaptiveBrickKey[];
  const releaseInput = requireDenseDataPropertyArray(
    releaseValues,
    "releasedKeys",
    "InvalidPlannerInput",
    { maximumLength: ADAPTIVE_MAX_RESIDENT_SUMMARIES }
  ) as readonly AdaptiveBrickKey[];
  const authority = validateAuthorityRetention(authorityValue);
  const resident = residentInput.map(validateAdaptiveBrickKey);
  const releaseIds = new Set(releaseInput.map((key) => JSON.stringify(validateAdaptiveBrickKey(key))));
  const residentIds = new Set(resident.map((key) => JSON.stringify(key)));
  const released = releaseInput
    .map(validateAdaptiveBrickKey)
    .filter((key) => residentIds.has(JSON.stringify(key)))
    .filter((key, index, values) => values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(key)) === index)
    .sort(compareAdaptiveBrickKeys);
  return deepFreeze({
    mode,
    authorityRetained: true,
    authority,
    residentKeys: deepFreeze(resident.filter((key) => !releaseIds.has(JSON.stringify(key))).sort(compareAdaptiveBrickKeys)),
    releasedKeys: deepFreeze(released)
  });
};
