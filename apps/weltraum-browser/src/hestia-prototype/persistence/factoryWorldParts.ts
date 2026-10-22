import { canonicalJson } from "../../resources/serialization";
import type { FactoryInstallation } from "../../factory/construction/placement";
import { createFactoryInstallationProfile, type FactoryVector } from "../../factory/construction/installationProfile";
import { assertFactoryCargoSite, type FactoryCargoSite } from "../../factory/fixtures/cargoSite";
import type { FactoryFacilityOwner, FactoryCargoOpenIntent, FactoryNativeCargoRead } from "../physics/factoryFacilitySession";
import type { MaterialView } from "../../factory/material/reservations";
import { validateFactoryAmount } from "../../factory/material/quantity";
import { readCargoHandlingProfile } from "../../factory/construction/cargoHandlingProfile";
import { createFp02Fixture } from "../../factory/catalog/fp02Catalog";
import type { HvpTerrainCheckpoint } from "../terrain/cutPlan";
import type { HvpPlantCheckpoint } from "./plantCheckpoint";
import type { HvpWorldCheckpoint } from "./worldCheckpoint";
import type { HvpReceiptCheckpoint, HvpSimpleOutcome } from "./receiptCheckpoint";
import type { HvpCutOutcome } from "../terrain/terrainConsumer";
import type { HvpViewCheckpoint } from "./gameCheckpoint";
import type { HvpSalvageCheckpoint } from "../gameplay/salvageLoop";
import type { HvpFactorySourceVersion } from "../../hvp/hvpCoastSource";

export interface FactoryNativeCoreV1 {
  readonly version: "fp06-native-core-checkpoint-v1";
  readonly profiles: Readonly<{ source: HvpFactorySourceVersion; vegetation: string; look: string; effects: string; player: string; solver: "rapier-0.12.0" }>;
  readonly terrain: HvpTerrainCheckpoint;
  readonly plants: readonly HvpPlantCheckpoint[];
  readonly world: HvpWorldCheckpoint;
  readonly receipts: Readonly<{
    terrain: HvpReceiptCheckpoint<HvpCutOutcome>;
    structural: HvpReceiptCheckpoint<HvpSimpleOutcome>;
    moving: HvpReceiptCheckpoint<HvpSimpleOutcome>;
  }>;
  readonly view: HvpViewCheckpoint;
  readonly progress: HvpSalvageCheckpoint | null;
  readonly neighbor: Readonly<{ version: "hvp-neighbor-scene-v1"; terrain: HvpTerrainCheckpoint; lod: .125 | .5 }> | null;
}

export type FactoryNativeOwnerCheckpoint = Omit<FactoryFacilityOwner, "bodyHandle" | "colliderHandles">;
export type FactoryNativeCargoCheckpoint = Pick<FactoryNativeCargoRead, "ownerId" | "containerId" | "opened" | "sourceDigest" | "profileDigest" | "site" | "openReceipt">;
export interface FactoryNativeCarrierCheckpoint {
  readonly ownerId: string;
  readonly transactionId: string;
  readonly profileId: string;
  readonly profileDigest: string;
  readonly phase: "Carrying" | "Deposited";
  readonly massMg: number;
  readonly materialBinding: string;
  readonly containerId: string;
  readonly positionMm: FactoryVector;
  readonly physicalRotation: Readonly<{ x: number; y: number; z: number; w: number }>;
  readonly physicalBodyPhase: "KinematicPositionBased" | "Fixed";
}

export interface FactoryNativeWorldPartsV1 {
  readonly version: "fp06-native-factory-parts-v1";
  readonly revision: number;
  readonly state: "Idle";
  readonly transactionId: null;
  readonly prepared: null;
  readonly cargo: FactoryNativeCargoCheckpoint;
  readonly carrier: FactoryNativeCarrierCheckpoint | null;
  readonly owners: readonly FactoryNativeOwnerCheckpoint[];
  readonly completedTransactionIds: readonly string[];
}

export interface FactoryPhysicsCheckpoint {
  readonly world: HvpWorldCheckpoint;
  readonly facilities: FactoryNativeWorldPartsV1;
}

const keys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const denseArray = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) return false;
  }
  return true;
};
const safeRevision = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9:_-]{1,128}$/.test(value);
const vector = (value: unknown): value is readonly number[] => denseArray(value) && value.length === 3
  && value.every(n => Number.isSafeInteger(n)) && value.every(n => (n as number) % 250 === 0);
const canonicalBytes = (value: unknown, max = 16 * 1024 * 1024): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > max) return false;
  try { return canonicalJson(JSON.parse(value)) === value; } catch { return false; }
};

/** Revalidates the clone-safe Native DTO before it is admitted to a Rapier World. */
export const inspectFactoryNativeWorldParts = (
  value: unknown,
  expectedCargoSite?: FactoryCargoSite
): FactoryNativeWorldPartsV1 => {
  if (!keys(value, ["version", "revision", "state", "transactionId", "prepared", "cargo", "carrier", "owners", "completedTransactionIds"])) {
    throw new Error("Invalid Native Factory checkpoint shape");
  }
  const parts = value as unknown as FactoryNativeWorldPartsV1;
  if (parts.version !== "fp06-native-factory-parts-v1" || !safeRevision(parts.revision) || parts.state !== "Idle"
    || parts.transactionId !== null || parts.prepared !== null || !denseArray(parts.owners) || parts.owners.length > 16
    || !denseArray(parts.completedTransactionIds) || parts.completedTransactionIds.length > 4096
    || new Set(parts.completedTransactionIds).size !== parts.completedTransactionIds.length
    || !parts.completedTransactionIds.every(id)) throw new Error("Invalid Native Factory checkpoint membership");

  const cargo = parts.cargo;
  if (!keys(cargo, ["ownerId", "containerId", "opened", "sourceDigest", "profileDigest", "site", "openReceipt"])) throw new Error("Invalid Native cargo checkpoint shape");
  if (cargo.ownerId !== "fp02_wreck_owner" || cargo.containerId !== "fp02_wreck_cargo" || !/^[0-9a-f]{8}$/.test(cargo.sourceDigest)
    || typeof cargo.opened !== "boolean" || typeof cargo.profileDigest !== "string" || !/^[0-9a-f]{8}$/.test(cargo.profileDigest)) {
    throw new Error("Invalid Native cargo checkpoint binding");
  }
  assertFactoryCargoSite(cargo.site as FactoryCargoSite);
  if (cargo.site.sourceDigest !== cargo.sourceDigest || cargo.site.profileDigest !== cargo.profileDigest
    || (expectedCargoSite !== undefined && canonicalJson(cargo.site) !== canonicalJson(expectedCargoSite))) {
    throw new Error("Native cargo site mismatch");
  }
  if (cargo.openReceipt !== null) {
    const receipt = cargo.openReceipt as FactoryCargoOpenIntent;
    if (!keys(receipt, ["ownerId", "profileDigest", "expectedTerrainRevision", "expectedRevision"])
      || receipt.ownerId !== cargo.ownerId || receipt.profileDigest !== cargo.profileDigest
      || !safeRevision(receipt.expectedTerrainRevision) || !safeRevision(receipt.expectedRevision)
      || receipt.expectedRevision > parts.revision) throw new Error("Invalid Native cargo open receipt");
  }
  if (cargo.opened !== (cargo.openReceipt !== null)) throw new Error("Native cargo/open receipt mismatch");

  const transactions = new Set<string>();
  const nativeOwners = new Map<string, FactoryNativeOwnerCheckpoint>();
  for (const owner of parts.owners) {
    if (!keys(owner, ["ownerId", "instanceId", "transactionId", "definitionRef", "profileDigest", "sourceDigest", "massMg", "materialBinding", "centerMm", "quarterTurns", "installationRevision"])) throw new Error("Invalid Native installation owner shape");
    const savedOwner = owner as unknown as FactoryNativeOwnerCheckpoint;
    if (!id(savedOwner.ownerId) || !id(savedOwner.instanceId) || !id(savedOwner.transactionId) || savedOwner.ownerId !== savedOwner.instanceId
      || nativeOwners.has(savedOwner.ownerId) || transactions.has(savedOwner.transactionId)
      || !keys(savedOwner.definitionRef, ["sourceId", "version", "digest"]) || typeof savedOwner.definitionRef.sourceId !== "string"
      || !Number.isSafeInteger(savedOwner.definitionRef.version) || typeof savedOwner.definitionRef.digest !== "string"
      || !/^[0-9a-f]{8}$/.test(savedOwner.profileDigest) || !/^[0-9a-f]{8}$/.test(savedOwner.sourceDigest)
      || !Number.isSafeInteger(savedOwner.massMg) || savedOwner.massMg <= 0
      || !vector(savedOwner.centerMm) || !Number.isInteger(savedOwner.quarterTurns) || savedOwner.quarterTurns < 0 || savedOwner.quarterTurns > 3
      || !safeRevision(savedOwner.installationRevision) || !canonicalBytes(savedOwner.materialBinding)) throw new Error("Invalid Native installation owner");
    let profile;
    try { profile = createFactoryInstallationProfile(savedOwner.definitionRef.sourceId); }
    catch { throw new Error("Invalid Native installation profile"); }
    if (profile.definitionRef.version !== savedOwner.definitionRef.version || profile.definitionRef.digest !== savedOwner.definitionRef.digest
      || profile.profileDigest !== savedOwner.profileDigest || profile.sourceDigest !== savedOwner.sourceDigest || profile.massMg !== savedOwner.massMg) {
      throw new Error("Native installation profile mismatch");
    }
    nativeOwners.set(savedOwner.instanceId, savedOwner);
    transactions.add(savedOwner.transactionId);
  }

  if (parts.carrier !== null) {
    if (!keys(parts.carrier, ["ownerId", "transactionId", "profileId", "profileDigest", "phase", "massMg", "materialBinding", "containerId", "positionMm", "physicalRotation", "physicalBodyPhase"])) throw new Error("Invalid Native carrier checkpoint shape");
    const carrier = parts.carrier as unknown as FactoryNativeCarrierCheckpoint;
    if (typeof carrier.physicalRotation !== "object" || carrier.physicalRotation === null) throw new Error("Invalid Native carrier checkpoint rotation");
    const profileIdValid = typeof carrier.profileId === "string" && carrier.profileId.length > 0 && carrier.profileId.length <= 128;
    const positionValid = denseArray(carrier.positionMm) && carrier.positionMm.length === 3 && carrier.positionMm.every(Number.isFinite);
    const rotation = carrier.physicalRotation;
    const rotationValid = keys(rotation, ["x", "y", "z", "w"]) && [rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)
      && Math.abs(rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2 - 1) < 1e-5;
    const q = Math.SQRT1_2, positiveQ1 = Math.abs(rotation.y - q) < 1e-5 && Math.abs(rotation.w - q) < 1e-5;
    const negativeQ1 = Math.abs(rotation.y + q) < 1e-5 && Math.abs(rotation.w + q) < 1e-5;
    if (carrier.ownerId !== "factory_carrier" || !id(carrier.transactionId) || transactions.has(carrier.transactionId) || !profileIdValid
      || !["Carrying", "Deposited"].includes(carrier.phase) || !safeRevision(carrier.massMg) || carrier.massMg === 0
      || !canonicalBytes(carrier.materialBinding) || !id(carrier.containerId) || !/^[0-9a-f]{8}$/.test(carrier.profileDigest)
      || !positionValid || !rotationValid || Math.abs(rotation.x) > 1e-5 || Math.abs(rotation.z) > 1e-5 || !(positiveQ1 || negativeQ1)
      || (carrier.phase === "Carrying" ? carrier.physicalBodyPhase !== "KinematicPositionBased" : carrier.physicalBodyPhase !== "Fixed")) {
      throw new Error("Invalid Native carrier checkpoint");
    }
    const handling = readCargoHandlingProfile(createFp02Fixture("cargo").catalog, carrier.profileId);
    if (!handling || handling.digest !== carrier.profileDigest || handling.massMg !== carrier.massMg) throw new Error("Native carrier profile mismatch");
    transactions.add(carrier.transactionId);
  }
  for (const transactionId of transactions) {
    if (!parts.completedTransactionIds.includes(transactionId)) throw new Error("Missing Native transaction history");
  }
  return parts;
};

/** Validates only semantic Native data. Runtime body/collider handles are never persisted. */
export const validateFactoryNativeWorldParts = (
  value: unknown,
  terrain: HvpTerrainCheckpoint,
  installations: readonly FactoryInstallation[],
  material: MaterialView
): FactoryNativeWorldPartsV1 => {
  if (!keys(value, ["version", "revision", "state", "transactionId", "prepared", "cargo", "carrier", "owners", "completedTransactionIds"])) throw new Error("Invalid Native Factory checkpoint shape");
  const parts = value as unknown as FactoryNativeWorldPartsV1;
  if (parts.version !== "fp06-native-factory-parts-v1" || !safeRevision(parts.revision) || parts.state !== "Idle"
    || parts.transactionId !== null || parts.prepared !== null || !denseArray(parts.owners) || parts.owners.length > 16
    || !denseArray(parts.completedTransactionIds) || parts.completedTransactionIds.length > 4096
    || new Set(parts.completedTransactionIds).size !== parts.completedTransactionIds.length
    || !parts.completedTransactionIds.every(id)) throw new Error("Invalid Native Factory checkpoint membership");

  const cargo = parts.cargo;
  if (!keys(cargo, ["ownerId", "containerId", "opened", "sourceDigest", "profileDigest", "site", "openReceipt"])) throw new Error("Invalid Native cargo checkpoint shape");
  if (cargo.ownerId !== "fp02_wreck_owner" || cargo.containerId !== "fp02_wreck_cargo" || cargo.sourceDigest !== terrain.baseDigest
    || typeof cargo.opened !== "boolean" || typeof cargo.profileDigest !== "string" || !/^[0-9a-f]{8}$/.test(cargo.profileDigest)) {
    throw new Error("Invalid Native cargo checkpoint binding");
  }
  assertFactoryCargoSite(cargo.site as FactoryCargoSite);
  if (cargo.site.sourceDigest !== terrain.baseDigest || cargo.site.profileDigest !== cargo.profileDigest) throw new Error("Native cargo site mismatch");
  if (cargo.openReceipt !== null) {
    const receipt = cargo.openReceipt as FactoryCargoOpenIntent;
    if (!keys(receipt, ["ownerId", "profileDigest", "expectedTerrainRevision", "expectedRevision"])
      || receipt.ownerId !== cargo.ownerId || receipt.profileDigest !== cargo.profileDigest
      || !safeRevision(receipt.expectedTerrainRevision) || receipt.expectedTerrainRevision > terrain.revision
      || !safeRevision(receipt.expectedRevision) || receipt.expectedRevision > parts.revision) throw new Error("Invalid Native cargo open receipt");
  }
  if (cargo.opened !== (cargo.openReceipt !== null)) throw new Error("Native cargo/open receipt mismatch");

  const nativeOwners = new Map<string, FactoryNativeOwnerCheckpoint>();
  for (const owner of parts.owners) {
    if (!keys(owner, ["ownerId", "instanceId", "transactionId", "definitionRef", "profileDigest", "sourceDigest", "massMg", "materialBinding", "centerMm", "quarterTurns", "installationRevision"])) throw new Error("Invalid Native installation owner shape");
    const savedOwner = owner as unknown as FactoryNativeOwnerCheckpoint;
    if (!id(savedOwner.ownerId) || !id(savedOwner.instanceId) || !id(savedOwner.transactionId) || savedOwner.ownerId !== savedOwner.instanceId || nativeOwners.has(savedOwner.ownerId)
      || !keys(savedOwner.definitionRef, ["sourceId", "version", "digest"]) || typeof savedOwner.definitionRef.sourceId !== "string"
      || !Number.isSafeInteger(savedOwner.definitionRef.version) || typeof savedOwner.definitionRef.digest !== "string"
      || !/^[0-9a-f]{8}$/.test(savedOwner.profileDigest) || !/^[0-9a-f]{8}$/.test(savedOwner.sourceDigest)
      || !Number.isSafeInteger(savedOwner.massMg) || savedOwner.massMg <= 0
      || !vector(savedOwner.centerMm) || !Number.isInteger(savedOwner.quarterTurns) || savedOwner.quarterTurns < 0 || savedOwner.quarterTurns > 3
      || !safeRevision(savedOwner.installationRevision) || !canonicalBytes(savedOwner.materialBinding)) throw new Error("Invalid Native installation owner");
    nativeOwners.set(savedOwner.instanceId, savedOwner);
  }
  if (nativeOwners.size !== installations.length) throw new Error("Native/logical installation count mismatch");
  for (const installed of installations) {
    const owner = nativeOwners.get(installed.instanceId), profile = createFactoryInstallationProfile(installed.definitionSourceId);
    if (!owner || owner.definitionRef.sourceId !== installed.definitionSourceId
      || owner.definitionRef.version !== profile.definitionRef.version || owner.definitionRef.digest !== profile.definitionRef.digest
      || owner.profileDigest !== installed.profileDigest || owner.sourceDigest !== installed.sourceDigest || owner.massMg !== installed.massMg
      || canonicalJson(owner.centerMm) !== canonicalJson(installed.centerMm) || owner.quarterTurns !== installed.quarterTurns
      || installed.profileDigest !== profile.profileDigest || installed.sourceDigest !== profile.sourceDigest || installed.massMg !== profile.massMg
      || !material.containers.some(c => c.state.containerId === installed.materialContainerId)) throw new Error("Native/logical installation binding mismatch");
    // materialBinding is a historical receipt. Check its bytes, never compare it with today's material view.
  }

  if (parts.carrier !== null) {
    if (!keys(parts.carrier, ["ownerId", "transactionId", "profileId", "profileDigest", "phase", "massMg", "materialBinding", "containerId", "positionMm", "physicalRotation", "physicalBodyPhase"])) throw new Error("Invalid Native carrier checkpoint shape");
    const carrier = parts.carrier as unknown as FactoryNativeCarrierCheckpoint;
    const materialOwnerId = material.containers.find(c => c.state.containerId === "fp02_wreck_cargo")?.state.ownerId;
    const profileIdValid = typeof carrier.profileId === "string" && carrier.profileId.length > 0 && carrier.profileId.length <= 128;
    const positionValid = denseArray(carrier.positionMm) && carrier.positionMm.length === 3 && carrier.positionMm.every(Number.isFinite);
    const rotation = carrier.physicalRotation;
    const rotationValid = keys(rotation, ["x", "y", "z", "w"]) && [rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)
      && Math.abs(rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2 - 1) < 1e-5;
    const q = Math.SQRT1_2, positiveQ1 = Math.abs(rotation.y - q) < 1e-5 && Math.abs(rotation.w - q) < 1e-5;
    const negativeQ1 = Math.abs(rotation.y + q) < 1e-5 && Math.abs(rotation.w + q) < 1e-5;
    if (carrier.ownerId !== "factory_carrier" || !id(carrier.transactionId) || !profileIdValid || !["Carrying", "Deposited"].includes(carrier.phase)
      || !safeRevision(carrier.massMg) || carrier.massMg === 0 || !canonicalBytes(carrier.materialBinding) || !id(carrier.containerId)
      || !/^[0-9a-f]{8}$/.test(carrier.profileDigest) || !positionValid || !rotationValid
      || Math.abs(rotation.x) > 1e-5 || Math.abs(rotation.z) > 1e-5 || !(positiveQ1 || negativeQ1)
      || (carrier.phase === "Carrying" ? carrier.physicalBodyPhase !== "KinematicPositionBased" : carrier.physicalBodyPhase !== "Fixed")) throw new Error("Invalid Native carrier checkpoint");
    const handling = readCargoHandlingProfile(material.catalog, carrier.profileId);
    if (!handling || handling.digest !== carrier.profileDigest || handling.massMg !== carrier.massMg) throw new Error("Native carrier profile mismatch");
    const snapshot = material.containers.find(c => c.state.containerId === carrier.containerId);
    if (!materialOwnerId || !snapshot || snapshot.state.ownerId !== materialOwnerId || snapshot.state.contents.length === 0
      || snapshot.state.contents.reduce((mass, stack) => {
        const item = material.catalog.items.find(v => v.resourceId === stack.resourceId);
        return mass + BigInt(validateFactoryAmount(item?.sourceId ?? "", stack.quantity, material.catalog).massMg);
      }, 0n) !== BigInt(carrier.massMg)) {
      throw new Error("Native carrier/material custody mismatch");
    }
    const actualTerms = new Map<string, number>();
    for (const stack of snapshot.state.contents) {
      const item = material.catalog.items.find(v => v.resourceId === stack.resourceId);
      if (!item || (stack.condition !== undefined && stack.condition !== 1)) throw new Error("Native carrier/material custody mismatch");
      actualTerms.set(item.sourceId, (actualTerms.get(item.sourceId) ?? 0) + stack.quantity);
    }
    const sortedTerms = (values: readonly (readonly [string, number])[]) => canonicalJson([...values].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    if (sortedTerms([...actualTerms]) !== sortedTerms(handling.terms.map(term => [term.itemId, term.quantityUnits] as const))) throw new Error("Native carrier/material terms mismatch");
    if (!parts.completedTransactionIds.includes(carrier.transactionId)) throw new Error("Missing Native carrier transaction history");
  }
  for (const owner of nativeOwners.values()) if (!parts.completedTransactionIds.includes(owner.transactionId)) throw new Error("Missing Native installation transaction history");
  return parts;
};
