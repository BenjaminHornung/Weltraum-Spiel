import { createSuitSignature } from "./canonical";
import { failSuitValidation } from "./errors";
import { requireSuitId } from "./validation";

const SUIT_ID_MAX_LENGTH = 128;

export const deriveBoundedSuitId = <T extends string>(
  prefix: string,
  identity: string,
  suffix = "",
  path = "/derivedId"
): T => {
  const unabridged = `${prefix}${identity}${suffix}`;
  if (unabridged.length <= SUIT_ID_MAX_LENGTH) return requireSuitId<T>(unabridged, path);

  const hash = createSuitSignature({ identity, prefix, suffix }).slice("fnv1a32:".length);
  const identityLength = SUIT_ID_MAX_LENGTH - prefix.length - suffix.length - hash.length - 1;
  if (identityLength < 1) {
    return failSuitValidation("InvalidId", path, "Derived suit ID affixes leave no room for a stable identity.");
  }
  return requireSuitId<T>(`${prefix}${identity.slice(0, identityLength)}:${hash}${suffix}`, path);
};
