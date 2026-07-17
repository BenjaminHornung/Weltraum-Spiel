import { compareAdaptiveBrickKeys, validateAdaptiveBrickKey } from "./coordinates";
import { validateAdaptiveEditJournal } from "./edits";
import { validateAdaptiveBaseFieldDescriptor } from "./canonical";
import type { AdaptiveBaseFieldDescriptor, AdaptiveBrickKey, AdaptiveEditJournal } from "./types";
import { deepFreeze, fail, isDeepFrozen, requireExactKeys, requirePlainRecord } from "./validation";

export interface AdaptiveAuthorityRetention {
  readonly baseField: AdaptiveBaseFieldDescriptor;
  readonly editJournal: AdaptiveEditJournal;
}

export const createAdaptiveAuthorityRetention = (input: AdaptiveAuthorityRetention): AdaptiveAuthorityRetention => {
  const record = requirePlainRecord(input, "authority");
  requireExactKeys(record, ["baseField", "editJournal"], "authority");
  return deepFreeze({
    baseField: validateAdaptiveBaseFieldDescriptor(input.baseField),
    editJournal: validateAdaptiveEditJournal(input.editJournal)
  });
};

const validateAuthorityRetention = (value: AdaptiveAuthorityRetention): AdaptiveAuthorityRetention => {
  const record = requirePlainRecord(value, "authority");
  requireExactKeys(record, ["baseField", "editJournal"], "authority");
  validateAdaptiveBaseFieldDescriptor(value.baseField);
  validateAdaptiveEditJournal(value.editJournal);
  if (!isDeepFrozen(value)) return fail("InvalidBaseField", "authority", "Authority retention descriptors must be created and deeply frozen before release.");
  return value;
};

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
  const authority = validateAuthorityRetention(authorityValue);
  const resident = residentValues.map(validateAdaptiveBrickKey);
  const releaseIds = new Set(releaseValues.map((key) => JSON.stringify(validateAdaptiveBrickKey(key))));
  const residentIds = new Set(resident.map((key) => JSON.stringify(key)));
  const released = releaseValues
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
