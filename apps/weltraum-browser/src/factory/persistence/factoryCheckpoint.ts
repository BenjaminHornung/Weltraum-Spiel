import { canonicalizePersistenceValue, createPersistenceSignature, createUniverseClock, serializeCanonicalPersistenceValue } from "../../persistence";
import { HVP_SAVE_DECODE_BYTES, HVP_SAVE_PROFILES, HVP_SAVE_TRANSPORT_BYTES, validateHvpViewCheckpoint } from "../../hestia-prototype/persistence/gameCheckpoint";
import { decodeHvpGrid, hvpGridCheckpointBytes } from "../../hestia-prototype/persistence/gridCheckpoint";
import { decodeHvpPlant, hvpPlantCheckpointBytes } from "../../hestia-prototype/persistence/plantCheckpoint";
import { decodeHvpWorld, hvpWorldCheckpointBytes } from "../../hestia-prototype/persistence/worldCheckpoint";
import { decodeHvpReceipts } from "../../hestia-prototype/persistence/receiptCheckpoint";
import { restoreHvpTerrainRoot } from "../../hestia-prototype/terrain/cutPlan";
import { HVP_BRANCH_CELLS, HVP_SALVAGE_CELLS, resolveHvpGravity } from "../../hestia-prototype/physics/profile";
import { readHvpBodyCells } from "../../hestia-prototype/physics/bodyCutPlan";
import { collisionInputs } from "../../hestia-prototype/physics/terrainColliders";
import { validateHvpSalvageCheckpoint, savedHvpSalvageObservation } from "../../hestia-prototype/gameplay/salvageLoop";
import { restoreHvpEastRegion } from "../../hestia-prototype/runtime/regionSource";
import { createHvpFactorySourceSnapshotV5, createHvpFactorySourceSnapshotV6, HVP_COAST_MATERIAL_REGISTRY } from "../../hvp/hvpCoastSource";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";
import { createFp02Fixture } from "../catalog/fp02Catalog";
import { commitFactoryMaterialStep, prepareFactoryMaterialStep, validateFactoryMaterialCheckpointView } from "../material/reservations";
import type { MaterialIntent, MaterialReceipt, MaterialReservation, MaterialView } from "../material/reservations";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState, type ResourceContainerDefinition, type ResourceContainerState } from "../../resources/containers";
import { FACTORY_POWER_POLICY } from "../power/factoryPower";
import type { FactoryPowerLink, FactoryPowerPort, FactoryPowerSuccess } from "../power/factoryPower";
import { prepareFactoryPowerSources } from "../power/sourceAdapter";
import type { FactoryFixedNetObservation, FactoryInstalledPowerAsset, FactoryPowerSourceSnapshot } from "../power/sourceAdapter";
import { FACTORY_BELT_POLICY } from "../conveyor/beltReference";
import { FACTORY_PRODUCTION_POLICY } from "../production/productionStep";
import type { ProductionStart } from "../production/recipeAdmission";
import { factoryMaterialBytes, type FactoryInstallation } from "../construction/placement";
import { createFactoryInstallationProfile, FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES, transformFactoryBounds, transformFactoryPoint, type FactoryBoundsMm, type FactoryVector } from "../construction/installationProfile";
import { readCargoHandlingProfile } from "../construction/cargoHandlingProfile";
import { bindFactoryDomainSession, validateDryFactoryCheckpointState, validateDryFactoryOwnerCheckpointState, importDryFactoryStateV1, FACTORY_DRY_PORT_CAPACITY_BINDING_VERSION, FACTORY_NATIVE_BELT_FRAME_BINDING_VERSION } from "../session/dryFactorySlice";
import type { DryFactoryOwnerState, DryFactoryState } from "../session/dryFactorySlice";
import type { FactoryUiBinding, FactoryUiCommand, FactoryUiReceipt, FactoryUiRecipeRef } from "../session/hostPort";
import { validateFactoryNativeWorldParts } from "../../hestia-prototype/persistence/factoryWorldParts";
import type { FactoryNativeCoreV1, FactoryNativeWorldPartsV1 } from "../../hestia-prototype/persistence/factoryWorldParts";

export const FACTORY_SAVE_TRANSPORT_BYTES = HVP_SAVE_TRANSPORT_BYTES;
export const FACTORY_SAVE_DECODE_BYTES = HVP_SAVE_DECODE_BYTES;
export const FACTORY_SAVE_CPU_BYTES = 256 * 1024 * 1024;
// The HVP adapter retains one extra reference to the backend-owned frozen projection snapshot.
const FACTORY_FRAME_PROJECTION_REFERENCE_RESERVE_BYTES = 1024;
const FACTORY_LOGICAL_CAMERA_RESERVE_BYTES = 16 * 1024;
export const FACTORY_COMBINED_SAVE_VERSION = "fp06-combined-checkpoint-v1" as const;
export const FACTORY_COMBINED_SAVE_V2_VERSION = "fp06-combined-checkpoint-v2" as const;
export const FACTORY_DRY_REPLAY_V2_VERSION = "fp06-dry-replay-segments-v2" as const;
export const FACTORY_SAVE_GAME_VERSION = "hestia-factory-play-v1" as const;
export const FACTORY_SAVE_DATABASE = "weltraum-hestia-factory-v1";
export const FACTORY_SAVE_SLOT = "factory-primary";

const currentCatalog = createFp02Fixture("cargo").catalog;
const nativeProfiles = Object.freeze({ ...HVP_SAVE_PROFILES, source: "hvp-factory-startsite-v5" as const });
const nativeProfilesV6 = Object.freeze({ ...HVP_SAVE_PROFILES, source: "hvp-factory-startsite-v6" as const });
export const FACTORY_COMBINED_SAVE_PROFILES = Object.freeze({
  native: nativeProfiles,
  catalogDigest: currentCatalog.catalogDigest,
  sourceObservation: FACTORY_POWER_POLICY.sourceObservationVersion,
  power: FACTORY_POWER_POLICY.version,
  production: FACTORY_PRODUCTION_POLICY.version,
  belt: FACTORY_BELT_POLICY.version,
  dryPorts: FACTORY_DRY_PORT_CAPACITY_BINDING_VERSION,
  nativeBeltFrame: FACTORY_NATIVE_BELT_FRAME_BINDING_VERSION
});
export const FACTORY_COMBINED_SAVE_V6_PROFILES = Object.freeze({
  ...FACTORY_COMBINED_SAVE_PROFILES,
  native: nativeProfilesV6
});
export const FACTORY_COMBINED_SAVE_V2_PROFILES = Object.freeze({
  ...FACTORY_COMBINED_SAVE_PROFILES,
  dryReplay: FACTORY_DRY_REPLAY_V2_VERSION
});
export const FACTORY_COMBINED_SAVE_V2_V6_PROFILES = Object.freeze({
  ...FACTORY_COMBINED_SAVE_V6_PROFILES,
  dryReplay: FACTORY_DRY_REPLAY_V2_VERSION
});
type FactoryCombinedSaveProfiles = typeof FACTORY_COMBINED_SAVE_PROFILES | typeof FACTORY_COMBINED_SAVE_V6_PROFILES;
type FactoryCombinedSaveV2Profiles = typeof FACTORY_COMBINED_SAVE_V2_PROFILES | typeof FACTORY_COMBINED_SAVE_V2_V6_PROFILES;
const combinedProfilesFor = (version: string, source: unknown): FactoryCombinedSaveProfiles | FactoryCombinedSaveV2Profiles => {
  if (source === "hvp-factory-startsite-v5") return version === FACTORY_COMBINED_SAVE_VERSION ? FACTORY_COMBINED_SAVE_PROFILES : FACTORY_COMBINED_SAVE_V2_PROFILES;
  if (source === "hvp-factory-startsite-v6") return version === FACTORY_COMBINED_SAVE_VERSION ? FACTORY_COMBINED_SAVE_V6_PROFILES : FACTORY_COMBINED_SAVE_V2_V6_PROFILES;
  throw new Error("Unsupported combined Factory checkpoint source profile");
};

export interface FactoryMaterialCheckpointV1 {
  readonly version: "fp06-material-owner-v1";
  readonly catalogDigest: string;
  readonly revision: number;
  readonly containers: readonly Readonly<{ definition: ResourceContainerDefinition; state: ResourceContainerState }>[];
  readonly reservations: readonly MaterialReservation[];
  readonly receipts: readonly MaterialReceipt[];
}
export interface FactoryPaidPowerLinkV1 {
  readonly version: "fp06-paid-native-cable-v1";
  readonly linkId: string;
  readonly fromPortId: string;
  readonly toPortId: string;
  readonly active: boolean;
  readonly maxMilliWatt: string;
  readonly lengthMm: number;
  readonly containerId: string;
  readonly routeMm: readonly FactoryVector[];
  readonly sourceProfileDigest: string;
  readonly targetProfileDigest: string;
}
export interface FactoryRecipeSelectionV1 { readonly instanceId: string; readonly recipe: FactoryUiRecipeRef; readonly revision: number }
export interface FactoryHostCursorV1 { readonly sessionId: string; readonly epoch: number; readonly nativeTick: number; readonly remainderTicks: number; readonly steps: number }
export interface FactorySessionCheckpointV1 {
  readonly version: "fp06-factory-session-owner-v1";
  readonly installations: readonly FactoryInstallation[];
  readonly material: FactoryMaterialCheckpointV1;
  readonly domain: DryFactoryState;
  readonly lastPower: FactoryPowerSuccess | null;
  readonly links: readonly FactoryPaidPowerLinkV1[];
  readonly recipeSelections: readonly FactoryRecipeSelectionV1[];
  readonly waitingStarts: readonly Readonly<{ instanceId: string; command: ProductionStart }>[];
  readonly commandReceipts: readonly FactoryUiReceipt[];
  readonly lastReceipt: FactoryUiReceipt | null;
  readonly publicationRevision: number;
}
export interface FactoryCombinedCheckpointV1 {
  readonly version: typeof FACTORY_COMBINED_SAVE_VERSION;
  readonly profiles: FactoryCombinedSaveProfiles;
  readonly host: FactoryHostCursorV1;
  readonly native: FactoryNativeCoreV1;
  readonly nativeFactory: FactoryNativeWorldPartsV1;
  readonly factory: FactorySessionCheckpointV1;
  readonly signature: string;
}
export type FactoryCombinedCheckpointInput = Omit<FactoryCombinedCheckpointV1, "version" | "profiles" | "signature">;
export interface FactorySessionCheckpointV2 extends Omit<FactorySessionCheckpointV1, "version" | "domain"> {
  readonly version: "fp06-factory-session-owner-v2";
  readonly domain: DryFactoryOwnerState;
}
export interface FactoryCombinedCheckpointV2 {
  readonly version: typeof FACTORY_COMBINED_SAVE_V2_VERSION;
  readonly profiles: FactoryCombinedSaveV2Profiles;
  readonly host: FactoryHostCursorV1;
  readonly native: FactoryNativeCoreV1;
  readonly nativeFactory: FactoryNativeWorldPartsV1;
  readonly factory: FactorySessionCheckpointV2;
  readonly signature: string;
}
export type FactoryCombinedCheckpointV2Input = Omit<FactoryCombinedCheckpointV2, "version" | "profiles" | "signature">;
export type FactoryStoredCheckpoint = FactoryCombinedCheckpointV1 | FactoryCombinedCheckpointV2;

type FactorySaveEnvelopeSource = Pick<FactoryStoredCheckpoint, "native"> & { readonly signature: string };

/** The one raw V1 storage wrapper used both for exact admission counts and repository validation. */
export const createFactorySaveEnvelopeInput = (checkpoint: FactorySaveEnvelopeSource): unknown => {
  const tick = checkpoint.native.world.tick.ticks, time = createUniverseClock(tick * 2);
  const saveId = `save:factory.${checkpoint.signature.split(":").at(-1)}`;
  return { schemaVersion: 1, gameVersion: FACTORY_SAVE_GAME_VERSION, saveId, universeTime: time, definitionsVersionRefs: [],
    player: { playerId: "player:hvp", activeShipId: null, activeMissionRef: null, data: { factory: checkpoint } },
    ships: [], drones: [], stations: [], bases: [], missions: [], encounters: [], discoveries: [], worldEvents: { events: [] },
    metadata: { createdAtTick: time.tick, updatedAtTick: time.tick, provenance: { owner: "hestia-factory-play" } } };
};

const exactKeys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const safeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const saveId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(value);
const vector = (value: unknown): value is FactoryVector => Array.isArray(value) && value.length === 3 && value.every(Number.isSafeInteger);
const bounds = (value: unknown): value is FactoryBoundsMm => {
  if (!exactKeys(value, ["min", "max"])) return false;
  const min = value.min, max = value.max;
  return vector(min) && vector(max) && min.every((n, i) => n <= max[i]!);
};
const canonicalBytes = (value: unknown, cap = FACTORY_SAVE_TRANSPORT_BYTES): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > cap) return false;
  try { return canonicalJson(JSON.parse(value)) === value; } catch { return false; }
};

const validateMaterialIntentBytes = (bytes: string): void => {
  if (!canonicalBytes(bytes)) throw new Error("Invalid Factory material receipt bytes");
  const command = JSON.parse(bytes) as Record<string, unknown>, common = ["kind", "ownerId", "transactionId"];
  if (!saveId(command.transactionId) || !saveId(command.ownerId)) throw new Error("Invalid Factory material receipt identity");
  const optional = ["actorId", "missionId", ...(command.kind === "reserve" ? ["recipeRef"] : [])].filter(key => Object.hasOwn(command, key));
  const tail: Record<string, readonly string[]> = {
    transfer: ["moves"], split: ["sourceContainerId", "sourceStackId", "children"],
    reserve: ["wipContainerId", "reservationId", "moves", "outputs"], "finish-recipe": ["reservationId"], release: ["reservationId"]
  };
  const fields = tail[String(command.kind)];
  if (!fields || !exactKeys(command, [...common, ...optional, ...fields])) throw new Error("Invalid Factory material receipt command");
};

const decodeFactoryMaterial = (value: unknown, historicalBytes?: string, powerAuthorityBytes?: string): MaterialView => {
  if (!exactKeys(value, ["version", "catalogDigest", "revision", "containers", "reservations", "receipts"])) throw new Error("Invalid Factory material owner shape");
  const saved = value as unknown as FactoryMaterialCheckpointV1;
  if (saved.version !== "fp06-material-owner-v1" || saved.catalogDigest !== currentCatalog.catalogDigest || !safeInt(saved.revision)
    || !Array.isArray(saved.containers) || saved.containers.length < 1 || saved.containers.length > 128
    || !Array.isArray(saved.reservations) || saved.reservations.length > 16 || !Array.isArray(saved.receipts) || saved.receipts.length > 16_384) {
    throw new Error("Factory material owner profile or count mismatch");
  }
  const containers = saved.containers.map(entry => {
    if (!exactKeys(entry, ["definition", "state"])) throw new Error("Invalid Factory material container shape");
    const definition = createResourceContainerDefinition(entry.definition), state = createResourceContainerState(entry.state, currentCatalog.resources);
    if (canonicalJson(definition) !== canonicalJson(entry.definition) || canonicalJson(state) !== canonicalJson(entry.state)) throw new Error("Factory material container bytes mismatch");
    const snapshot = createResourceContainerSnapshot(definition, state, currentCatalog.resources);
    return snapshot;
  });
  for (const reservation of saved.reservations) {
    if (!exactKeys(reservation, ["reservationId", "ownerId", "wipContainerId", "recipeRef", "recipeCanonicalJson", "outputs"])
      || !Array.isArray(reservation.outputs) || reservation.outputs.length > 64) throw new Error("Invalid Factory material reservation shape");
    if (reservation.recipeRef !== null && !exactKeys(reservation.recipeRef, ["sourceId", "version", "digest"])) throw new Error("Invalid Factory material recipe reference");
    if (reservation.recipeCanonicalJson !== null && (typeof reservation.recipeCanonicalJson !== "string" || !canonicalBytes(reservation.recipeCanonicalJson))) throw new Error("Invalid Factory material recipe bytes");
    for (const output of reservation.outputs) if (!exactKeys(output, ["itemId", "quantityUnits", "targetContainerId", "stackId"])) throw new Error("Invalid Factory material reserved output");
  }
  for (const receipt of saved.receipts) {
    if (!exactKeys(receipt, ["transactionId", "ownerId", "requestCanonicalJson", "revisionBefore", "revisionAfter"])) throw new Error("Invalid Factory material receipt shape");
    if (typeof receipt.requestCanonicalJson !== "string") throw new Error("Invalid Factory material receipt bytes");
    validateMaterialIntentBytes(receipt.requestCanonicalJson);
  }
  const view: MaterialView = { catalog: currentCatalog, revision: saved.revision, containers, reservations: saved.reservations, receipts: saved.receipts };
  const checked = validateFactoryMaterialCheckpointView(view);
  validateFactoryMaterialProvenance(saved, checked, historicalBytes, powerAuthorityBytes);
  return checked;
};

/** Replay every paid material receipt from the immutable FP02 start cargo. This
 * prevents a caller-rehashed checkpoint from inventing or deleting inventory. */
const validateFactoryMaterialProvenance = (saved: FactoryMaterialCheckpointV1, view: MaterialView, historicalBytes?: string, powerAuthorityBytes?: string): void => {
  const fixture = createFp02Fixture("cargo"), initialOwner = fixture.resourceState.ownerId;
  const cargoDefinition = createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200 });
  const cargo = view.containers.find(c => c.state.containerId === fixture.resourceState.containerId);
  if (!cargo || canonicalJson(cargo.definition) !== canonicalJson(cargoDefinition)) throw new Error("Factory initial cargo definition mismatch");
  for (const entry of view.containers) if (entry.state.ownerId !== initialOwner) throw new Error("Factory material owner mismatch");
  const emptySnapshots = view.containers.map(entry => entry.state.containerId === fixture.resourceState.containerId
    ? createResourceContainerSnapshot(cargoDefinition, fixture.resourceState, currentCatalog.resources)
    : createResourceContainerSnapshot(entry.definition, createResourceContainerState({ containerId: entry.state.containerId, ownerId: initialOwner, contents: [] }, currentCatalog.resources), currentCatalog.resources));
  // Keep the live append order. Canonical material bytes bind container arrays;
  // createFactoryMaterialView sorts initial inputs and would rewrite that order.
  let replay = validateFactoryMaterialCheckpointView({ catalog: currentCatalog, revision: 0, containers: emptySnapshots, reservations: [], receipts: [] });
  let historicalSnapshot: Readonly<{ revision: number; containers: readonly Readonly<{ containerId: string; definitionBytes: string }>[] }> | undefined;
  let matchedHistoricalSnapshot = false;
  let powerResources: readonly Readonly<{ containerId: string; revision: number; canonicalJson: string }>[] | undefined;
  if (powerAuthorityBytes !== undefined) {
    if (!canonicalBytes(powerAuthorityBytes, 8_388_608)) throw new Error("Invalid historical power source bytes");
    const source = JSON.parse(powerAuthorityBytes) as Record<string, unknown>;
    if (!exactKeys(source, ["catalogCanonicalJson", "installed", "resources", "observation"]) || source.catalogCanonicalJson !== currentCatalog.canonicalJson
      || !Array.isArray(source.installed) || !Array.isArray(source.resources) || source.resources.length > 128) throw new Error("Invalid historical power source snapshot");
    const seen = new Set<string>();
    powerResources = source.resources.map(raw => {
      if (!exactKeys(raw, ["containerId", "revision", "canonicalJson"]) || !saveId(raw.containerId) || !safeInt(raw.revision)
        || typeof raw.canonicalJson !== "string" || !canonicalBytes(raw.canonicalJson, 8_388_608) || seen.has(raw.containerId)) throw new Error("Invalid historical power resource");
      seen.add(raw.containerId);
      return { containerId: raw.containerId, revision: raw.revision, canonicalJson: raw.canonicalJson };
    });
    if (seen.size === 0) throw new Error("Empty historical power resource snapshot");
  }
  const matchesHistoricalPowerResources = (candidate: MaterialView): boolean => !powerResources || (powerResources.length <= candidate.containers.length
    && powerResources.every(savedState => {
      const found = candidate.containers.find(c => c.state.containerId === savedState.containerId)?.state;
      return !!found && found.revision === savedState.revision && found.canonicalJson === savedState.canonicalJson;
    }));
  let matchedPowerResources = matchesHistoricalPowerResources(replay);
  if (historicalBytes !== undefined) {
    if (!canonicalBytes(historicalBytes)) throw new Error("Invalid historical Factory material bytes");
    const historical = JSON.parse(historicalBytes) as Record<string, unknown>;
    if (!exactKeys(historical, ["catalogBytes", "revision", "containers", "reservations", "receipts"]) || historical.catalogBytes !== currentCatalog.canonicalJson
      || !safeInt(historical.revision) || historical.revision > view.revision || !Array.isArray(historical.containers)
      || historical.containers.length < 1 || historical.containers.length > 128
      || !Array.isArray(historical.reservations) || !Array.isArray(historical.receipts) || historical.receipts.length > saved.receipts.length
      || canonicalJson(historical.receipts) !== canonicalJson(saved.receipts.slice(0, historical.receipts.length))) throw new Error("Invalid historical Factory material snapshot");
    const seen = new Set<string>();
    const historicalContainers = historical.containers.map(raw => {
      if (!exactKeys(raw, ["definitionBytes", "stateBytes"]) || typeof raw.definitionBytes !== "string" || typeof raw.stateBytes !== "string"
        || !canonicalBytes(raw.definitionBytes) || !canonicalBytes(raw.stateBytes)) throw new Error("Invalid historical Factory material container");
      const definition = createResourceContainerDefinition(JSON.parse(raw.definitionBytes));
      const state = createResourceContainerState(JSON.parse(raw.stateBytes), currentCatalog.resources);
      if (definition.canonicalJson !== raw.definitionBytes || state.canonicalJson !== raw.stateBytes || state.containerId !== definition.containerId
        || seen.has(state.containerId)) throw new Error("Invalid historical Factory material container");
      const current = view.containers.find(c => c.state.containerId === state.containerId);
      if (!current || current.definition.canonicalJson !== raw.definitionBytes) throw new Error("Historical Factory material membership mismatch");
      seen.add(state.containerId);
      return { containerId: state.containerId, definitionBytes: raw.definitionBytes };
    });
    historicalSnapshot = { revision: historical.revision, containers: historicalContainers };
  }
  const historicalContainerIds = historicalSnapshot ? new Set(historicalSnapshot.containers.map(c => c.containerId)) : undefined;
  const referencedIntentContainers = (intent: MaterialIntent): readonly string[] => {
    switch (intent.kind) {
      case "transfer": return intent.moves.flatMap(move => [move.sourceContainerId, move.targetContainerId]);
      case "split": return [intent.sourceContainerId, ...intent.children.map(child => child.targetContainerId)];
      case "reserve": return [intent.wipContainerId, ...intent.moves.flatMap(move => [move.sourceContainerId, move.targetContainerId]), ...intent.outputs.map(output => output.targetContainerId)];
      case "finish-recipe": case "release": return [];
    }
  };
  const verifyHistoricalSnapshot = (candidate: MaterialView): void => {
    if (!historicalSnapshot || candidate.revision !== historicalSnapshot.revision) return;
    if (!historicalContainerIds || candidate.receipts.some(receipt => {
      const intent = JSON.parse(receipt.requestCanonicalJson) as MaterialIntent;
      return referencedIntentContainers(intent).some(id => !historicalContainerIds.has(id));
    })) throw new Error("Historical Factory material receipt references a future container");
    const containers = historicalSnapshot.containers.map(savedContainer => {
      const current = candidate.containers.find(c => c.state.containerId === savedContainer.containerId);
      if (!current || current.definition.canonicalJson !== savedContainer.definitionBytes) throw new Error("Historical Factory material membership mismatch");
      return current;
    });
    const historical = validateFactoryMaterialCheckpointView({ catalog: currentCatalog, revision: candidate.revision,
      containers, reservations: candidate.reservations, receipts: candidate.receipts });
    if (factoryMaterialBytes(historical) !== historicalBytes) throw new Error("Historical Factory material snapshot mismatch");
    matchedHistoricalSnapshot = true;
  };
  verifyHistoricalSnapshot(replay);
  for (const savedReceipt of saved.receipts) {
    const intent = JSON.parse(savedReceipt.requestCanonicalJson) as MaterialIntent;
    const plan = prepareFactoryMaterialStep(replay, intent);
    if (plan.status !== "Prepared") throw new Error("Factory material receipt replay rejected");
    const committed = commitFactoryMaterialStep(replay, plan);
    if (committed.status !== "Committed" || canonicalJson(committed.receipt) !== canonicalJson(savedReceipt)) throw new Error("Factory material receipt replay mismatch");
    replay = committed.view;
    matchedPowerResources ||= matchesHistoricalPowerResources(replay);
    verifyHistoricalSnapshot(replay);
  }
  if (canonicalJson(saved.receipts) !== canonicalJson(replay.receipts) || factoryMaterialBytes(replay) !== factoryMaterialBytes(view)) {
    throw new Error("Factory material does not derive from finite start inventory");
  }
  if (historicalSnapshot && !matchedHistoricalSnapshot) throw new Error("Historical Factory material revision is absent from receipt history");
  if (!matchedPowerResources) throw new Error("Power source inventory is absent from Factory material history");
};

const validateInstallations = (value: unknown): readonly FactoryInstallation[] => {
  if (!Array.isArray(value) || value.length > 16) throw new Error("Factory installation membership budget");
  const ids = new Set<string>();
  for (const item of value) {
    if (!exactKeys(item, ["instanceId", "definitionSourceId", "profileDigest", "sourceDigest", "massMg", "materialContainerId", "centerMm", "quarterTurns", "boundsMm", "serviceBoundsMm"])) throw new Error("Invalid logical Factory installation shape");
    const installation = item as unknown as FactoryInstallation, profile = createFactoryInstallationProfile(installation.definitionSourceId);
    if (!saveId(installation.instanceId) || ids.has(installation.instanceId) || !saveId(installation.materialContainerId)
      || installation.materialContainerId !== `installed_${installation.instanceId}` || !vector(installation.centerMm)
      || !installation.centerMm.every(n => n % 250 === 0) || !Number.isInteger(installation.quarterTurns) || installation.quarterTurns < 0 || installation.quarterTurns > 3
      || installation.profileDigest !== profile.profileDigest || installation.sourceDigest !== profile.sourceDigest || installation.massMg !== profile.massMg
      || !bounds(installation.boundsMm) || !bounds(installation.serviceBoundsMm)
      || canonicalJson(installation.boundsMm) !== canonicalJson(transformFactoryBounds(profile.boundsMm, installation.centerMm, installation.quarterTurns))
      || canonicalJson(installation.serviceBoundsMm) !== canonicalJson(transformFactoryBounds(profile.serviceBoundsMm, installation.centerMm, installation.quarterTurns))) {
      throw new Error("Logical Factory installation binding mismatch");
    }
    ids.add(installation.instanceId);
  }
  return value as readonly FactoryInstallation[];
};

const decodePowerPortId = (portId: string, installations: readonly FactoryInstallation[], material: MaterialView) => {
  if (!portId.startsWith("power_")) throw new Error("Invalid paid power endpoint");
  const ownerId = portId.slice("power_".length), owner = installations.find(i => i.instanceId === ownerId);
  if (!owner) throw new Error("Unknown paid power endpoint owner");
  const profile = createFactoryInstallationProfile(owner.definitionSourceId), port = profile.source.ports.find(p => p.role.startsWith("Power"));
  if (!port) throw new Error("Paid power endpoint has no source port");
  const centerMm = transformFactoryPoint(port.centerM.map(n => n * 1000), owner.centerMm, owner.quarterTurns);
  let capacity: bigint;
  if (owner.definitionSourceId === "B06") capacity = 1_700_000n;
  else if (owner.definitionSourceId === "B07") capacity = 2_500_000n;
  else if (owner.definitionSourceId === "fp06.line.belt_4m") capacity = 600_000n;
  else if (owner.definitionSourceId === "fp02.device.distribution_40kw") capacity = 40_000_000n;
  else {
    const paid = material.containers.find(c => c.state.containerId === owner.materialContainerId);
    const source = paid?.state.contents.flatMap(stack => {
      const origin = stack.extensions["factory.source"];
      return origin && typeof origin === "object" && !Array.isArray(origin) && "instanceId" in origin ? [String(origin.instanceId)] : [];
    })[0];
    if (/^fp02_cargo_c01_unit_[12]$/.test(source ?? "")) capacity = 6_000_000n;
    else if (/^fp02_cargo_c02_unit_[1-4]$/.test(source ?? "")) capacity = 2_000_000n;
    else if (source === "fp02_cargo_c03_unit_1") capacity = 8_000_000n;
    else throw new Error("Unknown paid power capacity source");
  }
  return { owner, profile, port, centerMm, capacity };
};

const validatePaidPowerLinks = (value: unknown, installations: readonly FactoryInstallation[], material: MaterialView): readonly FactoryPaidPowerLinkV1[] => {
  if (!Array.isArray(value) || value.length > 64) throw new Error("Paid power link budget");
  const ids = new Set<string>(), endpoints = new Set<string>();
  for (const item of value) {
    if (!exactKeys(item, ["version", "linkId", "fromPortId", "toPortId", "active", "maxMilliWatt", "lengthMm", "containerId", "routeMm", "sourceProfileDigest", "targetProfileDigest"])) throw new Error("Invalid paid power link shape");
    const link = item as unknown as FactoryPaidPowerLinkV1;
    if (link.version !== "fp06-paid-native-cable-v1" || !saveId(link.linkId) || !saveId(link.fromPortId) || !saveId(link.toPortId)
      || link.fromPortId === link.toPortId || typeof link.active !== "boolean" || !/^(0|[1-9][0-9]{0,18})$/.test(link.maxMilliWatt)
      || !Number.isSafeInteger(link.lengthMm) || link.lengthMm <= 0 || link.lengthMm > 40_000 || link.lengthMm % 250 !== 0
      || !saveId(link.containerId) || !Array.isArray(link.routeMm) || link.routeMm.length !== 4 || !link.routeMm.every(vector)
      || !/^[0-9a-f]{8}$/.test(link.sourceProfileDigest) || !/^[0-9a-f]{8}$/.test(link.targetProfileDigest) || ids.has(link.linkId)) throw new Error("Invalid paid power link");
    ids.add(link.linkId);
    const commandId = link.linkId.slice("link_".length);
    if (!link.linkId.startsWith("link_") || link.containerId !== `installed_cable_${commandId}`) throw new Error("Paid cable ledger identity mismatch");
    const from = decodePowerPortId(link.fromPortId, installations, material), to = decodePowerPortId(link.toPortId, installations, material);
    const pair = [link.fromPortId, link.toPortId].sort().join("|");
    if (endpoints.has(pair) || from.owner.instanceId === to.owner.instanceId || from.port.role === "PowerConsumer" || to.port.role === "PowerProducer"
      || link.sourceProfileDigest !== from.owner.profileDigest || link.targetProfileDigest !== to.owner.profileDigest) throw new Error("Paid power link endpoint mismatch");
    endpoints.add(pair);
    const a = from.centerMm, b = to.centerMm, expectedRoute = [a, [b[0], a[1], a[2]], [b[0], a[1], b[2]], b];
    if (canonicalJson(link.routeMm) !== canonicalJson(expectedRoute)) throw new Error("Paid power route geometry mismatch");
    const rawLength = a.reduce((sum, n, i) => sum + Math.abs(b[i]! - n), 0), length = Math.ceil(rawLength / 250) * 250;
    if (link.lengthMm !== length || BigInt(link.maxMilliWatt) !== (from.capacity < to.capacity ? from.capacity : to.capacity)) throw new Error("Paid power length/capacity mismatch");
    const ledger = material.containers.find(c => c.state.containerId === link.containerId), cable = material.catalog.items.find(i => i.sourceId === "fp02.comp.field_cable");
    if (!ledger || !cable || ledger.state.contents.length !== 1 || ledger.state.contents[0]!.resourceId !== cable.resourceId
      || ledger.state.contents[0]!.stackId !== `cable_${commandId}` || ledger.state.contents[0]!.quantity !== link.lengthMm) throw new Error("Paid cable/material ledger mismatch");
    const receipt = material.receipts.find(r => r.transactionId === commandId);
    if (!receipt) throw new Error("Paid cable material receipt missing");
    const intent = JSON.parse(receipt.requestCanonicalJson) as {kind?: string; moves?: readonly Record<string, unknown>[]};
    const move = intent.moves?.[0];
    if (intent.kind !== "transfer" || intent.moves?.length !== 1 || move?.targetContainerId !== link.containerId || move.targetStackId !== `cable_${commandId}`
      || move.itemId !== "fp02.comp.field_cable" || move.quantityUnits !== link.lengthMm) throw new Error("Paid cable receipt/ledger mismatch");
  }
  return value as readonly FactoryPaidPowerLinkV1[];
};

type PowerFraction = readonly [bigint, bigint];
const powerGcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) { const r = a % b; a = b; b = r; } return a; };
const powerFraction = (n: bigint, d = 1n): PowerFraction => { if (d <= 0n) throw new Error("Invalid power rational"); const g = powerGcd(n, d); return [n / g, d / g]; };
const powerAdd = (a: PowerFraction, b: PowerFraction): PowerFraction => powerFraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const powerSub = (a: PowerFraction, b: PowerFraction): PowerFraction => powerFraction(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const powerEqual = (a: PowerFraction, b: PowerFraction): boolean => a[0] * b[1] === b[0] * a[1];
const readPowerFraction = (value: unknown, signed = false): PowerFraction => {
  if (!exactKeys(value, ["n", "d"])) throw new Error("Invalid saved power rational");
  const n = value.n, d = value.d, number = signed ? /^-?(0|[1-9][0-9]{0,24})$/ : /^(0|[1-9][0-9]{0,24})$/;
  if (typeof n !== "string" || !number.test(n) || n === "-0" || typeof d !== "string" || !/^[1-9][0-9]{0,24}$/.test(d)) throw new Error("Invalid saved power rational");
  const raw = [BigInt(n), BigInt(d)] as const, normalized = powerFraction(raw[0], raw[1]);
  if (normalized[0] !== raw[0] || normalized[1] !== raw[1]) throw new Error("Noncanonical saved power rational");
  return raw;
};
const readPowerInteger = (value: unknown, max = 40_000_000n): bigint => {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > max) throw new Error("Invalid saved power integer");
  return BigInt(value);
};

const validatePowerReceipt = (value: unknown, domain: Pick<DryFactoryState, "binding" | "power" | "tickEndUs">,
  paidLinks: readonly FactoryPaidPowerLinkV1[]): FactoryPowerSuccess | null => {
  if (value === null) return null;
  if (!exactKeys(value, ["ok", "supplyCanonicalJson", "nameplateMilliWatt", "binding", "tickStartUs", "tickEndUs", "nextState", "grants", "balance", "canonicalJson", "digest"])) throw new Error("Invalid saved power receipt shape");
  const receipt = value as unknown as FactoryPowerSuccess, { canonicalJson: bytes, digest, ...payload } = receipt;
  if (receipt.ok !== true || !canonicalBytes(receipt.supplyCanonicalJson) || !/^(0|[1-9][0-9]{0,18})$/.test(receipt.nameplateMilliWatt)
    || !canonicalBytes(bytes) || !/^[0-9a-f]{8}$/.test(digest) || canonicalJson(payload) !== bytes || canonicalSignature(payload) !== digest
    || canonicalJson(receipt.nextState) !== canonicalJson(domain.power) || receipt.tickEndUs !== domain.tickEndUs
    || receipt.nextState.tickEndUs !== domain.tickEndUs || canonicalJson(receipt.binding) !== canonicalJson(domain.binding)) throw new Error("Saved power receipt/state mismatch");
  const prior = BigInt(domain.tickEndUs) - 100_000n;
  if (prior < 0n || receipt.tickStartUs !== String(prior)) throw new Error("Saved power receipt clock mismatch");
  if (!Array.isArray(receipt.grants) || receipt.grants.length > 64 || !exactKeys(receipt.balance,
    ["sourcePotential", "sourceActual", "curtailed", "work", "chargeFromBus", "dischargeToBus", "chargeLoss", "dischargeLoss", "storedDelta"])) throw new Error("Saved power output shape mismatch");
  const supply = JSON.parse(receipt.supplyCanonicalJson) as Record<string, unknown>;
  if (!exactKeys(supply, ["version", "binding", "tickStartUs", "tickEndUs", "offers", "ports", "links", "battery", "authorityBytes"])
    || supply.version !== "fp06-power-supply-v1" || supply.tickStartUs !== receipt.tickStartUs || supply.tickEndUs !== domain.tickEndUs
    || !exactKeys(supply.binding, ["sessionId", "epoch", "netRevision", "catalogDigest", "sourceProfileDigest"])
    || canonicalJson(supply.binding) !== canonicalJson(domain.binding) || !Array.isArray(supply.offers) || supply.offers.length > 6
    || !Array.isArray(supply.ports) || supply.ports.length > 256 || !Array.isArray(supply.links) || supply.links.length > 255
    || !canonicalBytes(supply.authorityBytes, 8_388_608)) throw new Error("Saved power supply receipt malformed");
  const authority = JSON.parse(supply.authorityBytes as string) as Record<string, unknown>;
  if (!exactKeys(authority, ["catalogCanonicalJson", "installed", "resources", "observation"])
    || authority.catalogCanonicalJson !== currentCatalog.canonicalJson || !Array.isArray(authority.installed) || authority.installed.length > 7
    || !Array.isArray(authority.resources) || authority.resources.length > 128) throw new Error("Saved power source authority malformed");
  const ports: FactoryPowerPort[] = supply.ports.map(raw => {
    if (!exactKeys(raw, ["portId", "assetId", "direction", "active", "maxMilliWatt"])) throw new Error("Saved power port malformed");
    const port = raw as unknown as FactoryPowerPort;
    if (!saveId(port.portId) || !saveId(port.assetId) || !["in", "out", "both"].includes(port.direction) || typeof port.active !== "boolean") throw new Error("Saved power port malformed");
    readPowerInteger(port.maxMilliWatt);
    return port;
  });
  const links: FactoryPowerLink[] = supply.links.map(raw => {
    const legacyKeys = ["linkId", "fromPortId", "toPortId", "active", "maxMilliWatt"] as const;
    const isLegacy = exactKeys(raw, legacyKeys), isPaid = exactKeys(raw, ["version", "linkId", "fromPortId", "toPortId", "active", "maxMilliWatt",
      "lengthMm", "containerId", "routeMm", "sourceProfileDigest", "targetProfileDigest"]);
    if (!isLegacy && !isPaid) throw new Error("Saved power link malformed");
    const link = raw as unknown as FactoryPowerLink;
    if (!saveId(link.linkId) || !saveId(link.fromPortId) || !saveId(link.toPortId) || typeof link.active !== "boolean") throw new Error("Saved power link malformed");
    readPowerInteger(link.maxMilliWatt);
    if (isPaid) {
      const paid = paidLinks.find(candidate => candidate.linkId === link.linkId);
      if (!paid) throw new Error("Saved power link missing from paid ledger");
      if (canonicalJson(raw) !== canonicalJson(paid)) throw new Error("Saved power link/paid ledger mismatch");
    }
    return link;
  });
  for (const raw of supply.offers) {
    if (!exactKeys(raw, ["instanceId", "portId", "availableMilliWatt", "nameplateMilliWatt", "quality"])) throw new Error("Saved power offer malformed");
    const offer = raw as Record<string, unknown>;
    if (!saveId(offer.instanceId) || !saveId(offer.portId) || !["confirmed", "pending", "unsupported"].includes(String(offer.quality))) throw new Error("Saved power offer malformed");
    readPowerInteger(offer.availableMilliWatt); readPowerInteger(offer.nameplateMilliWatt);
  }
  if (supply.battery !== null && (!exactKeys(supply.battery, ["instanceId", "portId"])
    || !saveId(supply.battery.instanceId) || !saveId(supply.battery.portId))) throw new Error("Saved power battery port malformed");
  const installed: FactoryInstalledPowerAsset[] = authority.installed.map(raw => {
    if (!exactKeys(raw, ["instanceId", "cargoId", "itemSourceId", "definitionVersion", "definitionDigest", "containerId", "ownerId", "portId", "installationRevision", "confirmed"])) throw new Error("Saved power installation malformed");
    const asset = raw as unknown as FactoryInstalledPowerAsset;
    const cargo = currentCatalog.cargo.find(row => row.cargoId === asset.cargoId);
    const definition = currentCatalog.items.find(item => item.sourceId === asset.itemSourceId);
    const finiteInstances = cargo ? Array.from({ length: cargo.quantityUnits }, (_, i) => `${cargo.runtimeId}_unit_${i + 1}`) : [];
    if (!saveId(asset.instanceId) || typeof asset.itemSourceId !== "string" || !cargo || !definition || cargo.itemId !== asset.itemSourceId
      || definition.quantityBasis !== "piece" || asset.definitionVersion !== definition.version || asset.definitionDigest !== definition.digest
      || !finiteInstances.includes(asset.instanceId)
      || !saveId(asset.containerId) || !saveId(asset.ownerId) || !saveId(asset.portId) || !safeInt(asset.installationRevision) || asset.installationRevision < 1
      || asset.confirmed !== true) throw new Error("Saved power installation malformed");
    return asset;
  });
  const resourceContainers = authority.resources.map(raw => {
    if (!exactKeys(raw, ["containerId", "revision", "canonicalJson"]) || !saveId(raw.containerId) || !safeInt(raw.revision)
      || typeof raw.canonicalJson !== "string" || !canonicalBytes(raw.canonicalJson, 8_388_608)) throw new Error("Saved power Resources state malformed");
    const state = createResourceContainerState(JSON.parse(raw.canonicalJson), currentCatalog.resources);
    if (state.containerId !== raw.containerId || state.revision !== raw.revision || state.canonicalJson !== raw.canonicalJson) throw new Error("Saved power Resources state mismatch");
    return state;
  });
  const observation = authority.observation as FactoryFixedNetObservation | null;
  const sourceSnapshot: FactoryPowerSourceSnapshot = { binding: domain.binding, tickStartUs: supply.tickStartUs as string,
    tickEndUs: supply.tickEndUs as string, installed, resourceContainers, ports, links, observation };
  const recomputedSupply = prepareFactoryPowerSources(currentCatalog, sourceSnapshot);
  const { canonicalJson: _supplyBytes, digest: _supplyDigest, ...recomputedData } = recomputedSupply;
  if (canonicalJson(recomputedData) !== receipt.supplyCanonicalJson) throw new Error("Saved power supply does not match its source authority");

  const elapsedUs = BigInt(receipt.tickEndUs) - BigInt(receipt.tickStartUs);
  const consumerById = new Map(receipt.nextState.consumers.map(consumer => [consumer.consumerId, consumer]));
  const grantIds = new Set<string>(); let work = powerFraction(0n), nameplate = 0n;
  for (const raw of receipt.grants) {
    if (!exactKeys(raw, ["consumerId", "deviceInstanceId", "jobId", "portId", "requiredMilliWatt", "allocatedMilliWatt", "work", "status"])) throw new Error("Saved power grant malformed");
    const grant = raw;
    const status = grant.status;
    const required = readPowerInteger(grant.requiredMilliWatt), allocated = readPowerInteger(grant.allocatedMilliWatt);
    if (!saveId(grant.consumerId) || !saveId(grant.deviceInstanceId) || !saveId(grant.jobId) || !saveId(grant.portId)
      || grantIds.has(grant.consumerId) || allocated > required
      || typeof status !== "string" || !["Powered", "Idle", "WAIT_POWER", "WAIT_RESTART", "NET_DISCONNECTED", "NET_CAPACITY"].includes(status)) throw new Error("Saved power grant malformed");
    grantIds.add(grant.consumerId);
    const savedWork = readPowerFraction(grant.work), expectedWork = powerFraction(allocated * elapsedUs, 1_000_000n);
    if (!powerEqual(savedWork, expectedWork) || (status === "Powered" ? required === 0n || allocated !== required : allocated !== 0n)
      || (status === "Idle" ? required !== 0n : status !== "Powered" && required === 0n)) throw new Error("Saved power grant/work mismatch");
    const consumer = consumerById.get(grant.consumerId);
    if (!consumer || !canonicalBytes(consumer.requestKey, 2048)) throw new Error("Saved power grant request missing");
    const request = JSON.parse(consumer.requestKey) as Record<string, unknown>;
    if (!exactKeys(request, ["consumerId", "deviceInstanceId", "jobId", "portId", "priority", "requiredMilliWatt", "enabled"])
      || request.consumerId !== grant.consumerId || request.deviceInstanceId !== grant.deviceInstanceId || request.jobId !== grant.jobId || request.portId !== grant.portId
      || !["P0", "P1", "P2", "P3"].includes(String(request.priority)) || typeof request.enabled !== "boolean") throw new Error("Saved power grant request mismatch");
    const originalRequired = readPowerInteger(request.requiredMilliWatt);
    if (grant.requiredMilliWatt !== (request.enabled ? String(originalRequired) : "0")) throw new Error("Saved power grant request amount mismatch");
    work = powerAdd(work, savedWork);
  }
  for (const raw of supply.offers) nameplate += BigInt((raw as Record<string, unknown>).nameplateMilliWatt as string);
  if (String(nameplate) !== receipt.nameplateMilliWatt) throw new Error("Saved power nameplate mismatch");
  const balance = receipt.balance as unknown as Record<string, unknown>;
  const sourcePotential = readPowerFraction(balance.sourcePotential), sourceActual = readPowerFraction(balance.sourceActual);
  const curtailed = readPowerFraction(balance.curtailed), balanceWork = readPowerFraction(balance.work);
  const charge = readPowerFraction(balance.chargeFromBus), discharge = readPowerFraction(balance.dischargeToBus);
  const chargeLoss = readPowerFraction(balance.chargeLoss), dischargeLoss = readPowerFraction(balance.dischargeLoss);
  const storedDelta = readPowerFraction(balance.storedDelta, true);
  const potentialFromOffers = supply.offers.reduce((sum, raw) => {
    const offer = raw as Record<string, unknown>;
    return offer.quality === "confirmed" ? sum + BigInt(offer.availableMilliWatt as string) : sum;
  }, 0n);
  if (!powerEqual(sourcePotential, powerFraction(potentialFromOffers * elapsedUs, 1_000_000n)) || !powerEqual(curtailed, powerSub(sourcePotential, sourceActual))
    || sourceActual[0] < 0n || !powerEqual(balanceWork, work)
    || !powerEqual(powerAdd(sourceActual, discharge), powerAdd(work, charge))
    || !powerEqual(chargeLoss, powerFraction(charge[0], charge[1] * 20n))
    || !powerEqual(dischargeLoss, powerFraction(discharge[0] * 1n, discharge[1] * 19n))
    || !powerEqual(storedDelta, powerSub(powerFraction(charge[0] * 19n, charge[1] * 20n), powerFraction(discharge[0] * 20n, discharge[1] * 19n)))) {
    throw new Error("Saved power balance mismatch");
  }
  return receipt;
};

const validateBinding = (value: unknown): FactoryUiBinding => {
  if (!exactKeys(value, ["catalogDigest", "terrainSourceDigest", "powerSourceProfileDigest", "terrainRevision", "facilityRevision", "materialRevision", "netRevision", "handlingRevision"])) throw new Error("Invalid saved UI binding");
  const binding = value as unknown as FactoryUiBinding;
  if (![binding.catalogDigest, binding.terrainSourceDigest, binding.powerSourceProfileDigest].every(s => typeof s === "string" && s.length > 0 && s.length <= 128)
    || ![binding.terrainRevision, binding.facilityRevision, binding.materialRevision, binding.netRevision, binding.handlingRevision].every(safeInt)) throw new Error("Invalid saved UI binding");
  return binding;
};

const validateUiEntityRef = (value: unknown): void => {
  if (!exactKeys(value, ["id", "revision"]) || !saveId(value.id) || !safeInt(value.revision)) throw new Error("Invalid Factory UI entity reference");
};
const validateUiLot = (value: unknown): void => {
  if (!exactKeys(value, ["containerId", "containerRevision", "stackId", "quantityUnits"]) || !saveId(value.containerId)
    || !safeInt(value.containerRevision) || !saveId(value.stackId) || !safeInt(value.quantityUnits) || value.quantityUnits < 1) throw new Error("Invalid Factory UI material lot");
};
const validateUiLots = (value: unknown): void => {
  if (!Array.isArray(value) || value.length > 64) throw new Error("Factory UI material lot budget");
  for (const lot of value) validateUiLot(lot);
};
const validateFactoryUiCommand = (bytes: string, receipt: FactoryUiReceipt, host: FactoryHostCursorV1): FactoryUiCommand => {
  const value = JSON.parse(bytes) as Record<string, unknown>;
  const fields: Record<string, readonly string[]> = {
    "open-cargo": [], pickup: ["profileId", "sourceLots"], deposit: ["handling", "target"], return: ["handling", "target"], build: ["preview"],
    "select-recipe": ["machine", "recipe"], start: ["machine", "sourceLots"], "manual-work": ["machine", "jobId"], "manual-finish": ["machine", "jobId"],
    transfer: ["source", "target"], "connect-power": ["sourcePortId", "targetPortId", "cableLot"], "connect-belt": ["sourcePortId", "targetPortId", "sourceLots"],
    "set-enabled": ["machine", "enabled"]
  };
  const extras = typeof value.kind === "string" ? fields[value.kind] : undefined;
  if (!extras || !exactKeys(value, ["version", "commandId", "sessionId", "epoch", "expected", "kind", ...extras])) throw new Error("Invalid saved Factory command shape");
  const command = value as unknown as FactoryUiCommand;
  if (command.version !== "fp06-ui-command-v1" || !saveId(command.commandId) || command.commandId !== receipt.commandId
    || command.sessionId !== host.sessionId || command.epoch !== host.epoch || !safeInt(command.epoch)) throw new Error("Saved Factory command identity mismatch");
  validateBinding(command.expected);
  switch (command.kind) {
    case "open-cargo": break;
    case "pickup":
      if (typeof command.profileId !== "string" || !readCargoHandlingProfile(currentCatalog, command.profileId)) throw new Error("Invalid Factory pickup profile");
      validateUiLots(command.sourceLots); break;
    case "deposit":
      validateUiEntityRef(command.handling);
      if (command.target.kind === "ground") {
        if (!exactKeys(command.target, ["kind"])) throw new Error("Invalid Factory deposit target");
      } else if (command.target.kind === "container") {
        if (!exactKeys(command.target, ["kind", "container"])) throw new Error("Invalid Factory deposit target");
        validateUiEntityRef(command.target.container);
      } else throw new Error("Invalid Factory deposit target");
      break;
    case "return": validateUiEntityRef(command.handling); validateUiEntityRef(command.target); break;
    case "build": validateUiEntityRef(command.preview); break;
    case "select-recipe":
      validateUiEntityRef(command.machine);
      if (!exactKeys(command.recipe, ["sourceId", "version", "digest"])) throw new Error("Invalid Factory recipe reference");
      if (!currentCatalog.recipes.some(recipe => recipe.sourceId === command.recipe.sourceId && recipe.version === command.recipe.version && recipe.digest === command.recipe.digest)) throw new Error("Unknown Factory recipe reference");
      break;
    case "start": validateUiEntityRef(command.machine); validateUiLots(command.sourceLots); break;
    case "manual-work": case "manual-finish": validateUiEntityRef(command.machine); if (!saveId(command.jobId)) throw new Error("Invalid Factory job reference"); break;
    case "transfer": validateUiLot(command.source); validateUiEntityRef(command.target); break;
    case "connect-power":
      if (!saveId(command.sourcePortId) || !saveId(command.targetPortId)) throw new Error("Invalid Factory power endpoint");
      validateUiLot(command.cableLot); break;
    case "connect-belt":
      if (!saveId(command.sourcePortId) || !saveId(command.targetPortId)) throw new Error("Invalid Factory belt endpoint");
      validateUiLots(command.sourceLots); break;
    case "set-enabled": validateUiEntityRef(command.machine); if (typeof command.enabled !== "boolean") throw new Error("Invalid Factory control state"); break;
    default: throw new Error("Unsupported saved Factory command");
  }
  return command;
};

const validateUiHistory = (factory: Pick<FactorySessionCheckpointV1, "commandReceipts" | "lastReceipt" | "publicationRevision">, host: FactoryHostCursorV1): void => {
  if (!Array.isArray(factory.commandReceipts) || factory.commandReceipts.length > 16_384 || !safeInt(factory.publicationRevision)) throw new Error("Factory UI history budget");
  const receipts = new Map<string, FactoryUiReceipt>();
  for (const rawReceipt of factory.commandReceipts) {
    if (!exactKeys(rawReceipt, ["commandId", "requestCanonicalJson", "status", "reason", "publicationRevision", "binding"])) throw new Error("Invalid saved Factory receipt");
    const receipt = rawReceipt as unknown as FactoryUiReceipt;
    if (!saveId(receipt.commandId) || !["Committed", "Rejected", "RecoveryHold"].includes(receipt.status) || !(receipt.reason === null || typeof receipt.reason === "string")
      || !safeInt(receipt.publicationRevision) || receipt.publicationRevision > factory.publicationRevision || receipts.has(receipt.commandId)) throw new Error("Invalid saved Factory receipt");
    validateBinding(receipt.binding);
    if (typeof receipt.requestCanonicalJson !== "string" || !canonicalBytes(receipt.requestCanonicalJson)) throw new Error("Invalid saved Factory request bytes");
    validateFactoryUiCommand(receipt.requestCanonicalJson, receipt, host);
    receipts.set(receipt.commandId, receipt);
  }
  if (factory.lastReceipt !== null) {
    const found = receipts.get(factory.lastReceipt.commandId);
    if (!found || canonicalJson(found) !== canonicalJson(factory.lastReceipt)) throw new Error("Factory last receipt/history mismatch");
  }
};

export interface FactoryCheckpointPreflight {
  readonly objectCount: number;
  readonly arrayCount: number;
  readonly sourceSlots: number;
  readonly utf16Bytes: number;
  readonly jsonUtf8Bytes: number;
  readonly nodeCount: number;
}

type InspectionFrame = {
  readonly value: object;
  readonly array: boolean;
  readonly length: number;
  readonly keys?: readonly string[];
  index: number;
  gridVersion?: unknown;
  gridSize?: unknown;
};

/** Count JSON's exact UTF-8 spelling without creating a checkpoint-sized string. */
const jsonStringUtf8Bytes = (value: string): number => {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c || code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      bytes += 2;
    } else if (code <= 0x1f) {
      bytes += 6;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index += 1; }
      else bytes += 6;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes += 6;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

/** Inspect with an O(depth) cursor stack; never builds descriptors or value-entry stacks. */
const inspectFactoryCheckpointTreeBounded = (root: unknown, saveTransport: boolean): FactoryCheckpointPreflight => {
  const frames: InspectionFrame[] = [], active = new WeakSet<object>();
  let pending: unknown = root, hasPending = true;
  let objectCount = 0, arrayCount = 0, sourceSlots = 0, utf16Bytes = 0, jsonUtf8Bytes = 0, nodeCount = 0;
  const addJsonBytes = (count: number): void => {
    jsonUtf8Bytes += count;
    if (!Number.isSafeInteger(jsonUtf8Bytes) || jsonUtf8Bytes > (saveTransport ? FACTORY_SAVE_TRANSPORT_BYTES : FACTORY_SAVE_CPU_BYTES)) {
      throw new Error(saveTransport ? "Factory save transport budget" : "Factory checkpoint CPU/decode budget before allocation");
    }
  };
  const checkUtf16Bytes = (): void => {
    if (!Number.isSafeInteger(utf16Bytes) || utf16Bytes > (saveTransport ? FACTORY_SAVE_TRANSPORT_BYTES * 2 : FACTORY_SAVE_CPU_BYTES)) {
      throw new Error(saveTransport ? "Factory save transport budget" : "Factory checkpoint CPU/decode budget before allocation");
    }
  };
  const dataDescriptor = (value: object, key: string, array: boolean): PropertyDescriptor & { readonly value: unknown } => {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); }
    catch { throw new Error("Factory checkpoint property could not be inspected"); }
    if (descriptor === undefined || (!array || key !== "length") && (!descriptor.enumerable || !("value" in descriptor))) {
      throw new Error("Factory checkpoint accessor");
    }
    if (!("value" in descriptor)) throw new Error("Factory checkpoint accessor");
    return descriptor as PropertyDescriptor & { readonly value: unknown };
  };
  const finishGridSlotCount = (frame: InspectionFrame): void => {
    if (frame.array || frame.gridVersion !== "hvp-grid-v1" || !frame.gridSize || typeof frame.gridSize !== "object") return;
    let isArray = false;
    try { isArray = Array.isArray(frame.gridSize); } catch { return; }
    if (!isArray) return;
    const size = frame.gridSize as object;
    const length = dataDescriptor(size, "length", true).value;
    if (length !== 3) return;
    const x = dataDescriptor(size, "0", true).value, y = dataDescriptor(size, "1", true).value, z = dataDescriptor(size, "2", true).value;
    if (![x, y, z].every(value => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 256)) return;
    const next = sourceSlots + (x as number) * (y as number) * (z as number);
    if (!Number.isSafeInteger(next)) throw new Error("Factory checkpoint slot budget");
    sourceSlots = next;
  };

  while (hasPending || frames.length > 0) {
    if (hasPending) {
      const value = pending;
      hasPending = false;
      nodeCount += 1;
      if (nodeCount > 1_000_000) throw new Error("Factory checkpoint node budget");
      if (value === null) { addJsonBytes(4); continue; }
      if (typeof value === "boolean") { addJsonBytes(value ? 4 : 5); continue; }
      if (typeof value === "string") {
        utf16Bytes += value.length * 2;
        checkUtf16Bytes();
        addJsonBytes(jsonStringUtf8Bytes(value));
        continue;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error("Factory checkpoint number");
        addJsonBytes(JSON.stringify(value)!.length);
        continue;
      }
      if (typeof value !== "object") throw new Error("Factory checkpoint is not JSON data");
      if (active.has(value)) throw new Error("Factory checkpoint cycle");
      active.add(value);

      let array: boolean, prototype: object | null, ownKeys: PropertyKey[];
      try {
        array = Array.isArray(value);
        prototype = Object.getPrototypeOf(value);
        if (array) {
          const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
          const length = lengthDescriptor?.value;
          if (!Number.isSafeInteger(length) || (length as number) < 0 || nodeCount + (length as number) > 1_000_000) {
            throw new Error("Factory checkpoint node budget");
          }
          ownKeys = Reflect.ownKeys(value);
        } else {
          ownKeys = Reflect.ownKeys(value);
        }
      } catch (error) {
        active.delete(value);
        if (error instanceof Error && error.message === "Factory checkpoint node budget") throw error;
        throw new Error("Factory checkpoint shape could not be inspected");
      }
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
        active.delete(value); throw new Error("Factory checkpoint prototype");
      }
      if (ownKeys.some(key => typeof key !== "string")) { active.delete(value); throw new Error("Factory checkpoint symbol key"); }

      if (array) {
        let length: number;
        try { length = Object.getOwnPropertyDescriptor(value, "length")!.value as number; }
        catch { active.delete(value); throw new Error("Factory checkpoint sparse array"); }
        if (ownKeys.length !== length + 1 || ownKeys.some(key => key !== "length"
          && (!/^(0|[1-9][0-9]*)$/.test(key as string) || Number(key) >= length))) {
          active.delete(value); throw new Error("Factory checkpoint sparse array");
        }
        arrayCount += 1; addJsonBytes(1);
        frames.push({ value, array: true, length, index: 0 });
      } else {
        if (ownKeys.length + nodeCount > 1_000_000) { active.delete(value); throw new Error("Factory checkpoint node budget"); }
        objectCount += 1; addJsonBytes(1);
        frames.push({ value, array: false, length: 0, keys: ownKeys as string[], index: 0 });
      }
      continue;
    }

    const frame = frames[frames.length - 1]!;
    if (frame.index >= (frame.array ? frame.length : frame.keys!.length)) {
      addJsonBytes(1); active.delete(frame.value); finishGridSlotCount(frame); frames.pop();
      continue;
    }
    const index = frame.index++;
    if (index > 0) addJsonBytes(1);
    if (frame.array) {
      const key = String(index), descriptor = dataDescriptor(frame.value, key, true);
      utf16Bytes += key.length * 2;
      checkUtf16Bytes();
      pending = descriptor.value; hasPending = true;
    } else {
      const key = frame.keys![index]!, descriptor = dataDescriptor(frame.value, key, false);
      utf16Bytes += key.length * 2;
      checkUtf16Bytes();
      addJsonBytes(jsonStringUtf8Bytes(key) + 1);
      if (key === "version") frame.gridVersion = descriptor.value;
      else if (key === "size") frame.gridSize = descriptor.value;
      pending = descriptor.value; hasPending = true;
    }
  }

  return Object.freeze({ objectCount, arrayCount, sourceSlots, utf16Bytes, jsonUtf8Bytes, nodeCount });
};

/** Save/decode inputs retain the existing strict transport-size cap. */
export const inspectFactoryCheckpointTree = (root: unknown): FactoryCheckpointPreflight =>
  inspectFactoryCheckpointTreeBounded(root, true);

/** Trusted live-owner telemetry: same safe cursor and node limit, without imposing the Save transport cap. */
export const inspectFactoryCheckpointMemoryTree = (root: unknown): FactoryCheckpointPreflight =>
  inspectFactoryCheckpointTreeBounded(root, false);

const retainedBytesForImportedOwner = (owner: FactorySessionCheckpointV2): number => {
  const domain = owner.domain, replay = domain.lastStep;
  const facts = replay ? inspectFactoryCheckpointMemoryTree(replay.facts) : undefined;
  const factoryKeys = Object.keys(owner), domainKeys = Object.keys(domain), replayKeys = replay ? Object.keys(replay) : [];
  const objectCount = (facts?.objectCount ?? 0) + 2 + (replay ? 1 : 0);
  const arrayCount = facts?.arrayCount ?? 0;
  // The facts root is already counted as the replay.facts value node.
  const nodeCount = 1 + factoryKeys.length + domainKeys.length + (replay ? replayKeys.length + Math.max(0, (facts?.nodeCount ?? 0) - 1) : 0);
  const keyBytes = [...factoryKeys, ...domainKeys, ...replayKeys].reduce((sum, key) => sum + key.length * 2, 0);
  const textBytes = (facts?.utf16Bytes ?? 0) + keyBytes + owner.version.length * 2
    + (replay ? replay.version.length * 2 + replay.inputMaterialBytes.length * 2 : 0);
  const units = 64 * (objectCount + arrayCount) + 16 * Math.max(0, nodeCount - 1);
  const total = textBytes + units;
  if (!Number.isSafeInteger(total)) throw new Error("Factory checkpoint compact-owner memory count invalid");
  return total;
};

const assertCloneableFactoryCheckpoint = (root: unknown): void => {
  try { structuredClone(root); } catch { throw new Error("Factory checkpoint is not cloneable data"); }
};

const validateNativeCore = (value: unknown) => {
  if (!exactKeys(value, ["version", "profiles", "terrain", "plants", "world", "receipts", "view", "progress", "neighbor"])) throw new Error("Invalid Factory Native core shape");
  const native = value as unknown as FactoryNativeCoreV1;
  const expectedProfiles = native.profiles?.source === "hvp-factory-startsite-v6" ? nativeProfilesV6 : nativeProfiles;
  if (native.version !== "fp06-native-core-checkpoint-v1" || canonicalJson(native.profiles) !== canonicalJson(expectedProfiles)
    || !Array.isArray(native.plants) || native.plants.length > 256 || !Array.isArray(native.terrain?.leaves) || native.terrain.leaves.length > 2048
    || !native.world || native.world.gravity !== resolveHvpGravity() || native.world.terrainGeneration !== native.terrain.revision
    || native.world.player === null || native.world.tick.status !== "Paused") throw new Error("Factory Native core profile or pause mismatch");
  if (native.neighbor !== null && (!exactKeys(native.neighbor, ["version", "terrain", "lod"]) || native.neighbor.version !== "hvp-neighbor-scene-v1"
    || (native.neighbor.lod !== .125 && native.neighbor.lod !== .5) || native.world.neighbor?.sourceDigest !== native.neighbor.terrain.sourceDigest)) {
    throw new Error("Invalid Factory Native neighbour binding");
  }
  if (native.neighbor === null && native.world.neighbor) throw new Error("Missing Factory Native neighbour source");
  if (!exactKeys(native.receipts, ["terrain", "structural", "moving"])) throw new Error("Factory Native command history missing");
  validateHvpViewCheckpoint(native.view);
  return native;
};

/** Include the separately owned Factory facility bodies before Native World allocation. */
const validateCombinedNativeAllocationCount = (native: FactoryNativeCoreV1, value: unknown, installationCount: number): void => {
  if (!Array.isArray(native.world.bodies) || !exactKeys(value, ["version", "revision", "state", "transactionId", "prepared", "cargo", "carrier", "owners", "completedTransactionIds"])) {
    throw new Error("Combined Native allocation membership malformed");
  }
  const parts = value as Record<string, unknown>;
  if (!Array.isArray(parts.owners) || parts.owners.length !== installationCount || parts.cargo === null
    || (parts.carrier !== null && (typeof parts.carrier !== "object" || Array.isArray(parts.carrier)))) throw new Error("Combined Native facility membership malformed");
  const factoryBodies = 1 + installationCount + (parts.carrier === null ? 0 : 1);
  if (factoryBodies > 16) throw new Error("Combined Factory membership budget");
  for (const body of native.world.bodies) {
    if (!body || !Array.isArray(body.surfaces) || body.surfaces.length < 1 || body.surfaces.length > 64) throw new Error("Native collider membership malformed");
  }
  if (native.world.bodies.length + (native.world.player === null ? 0 : 1) + factoryBodies > 64) throw new Error("Combined Native body budget");
};
const validateCombinedNativeAllocationBudget = (native: FactoryNativeCoreV1, value: unknown, installations: readonly FactoryInstallation[]): void =>
  validateCombinedNativeAllocationCount(native, value, installations.length);

interface FactoryNativeDecodeBudget {
  readonly baseBytes: number;
  readonly neighborBaseBytes: number;
  readonly decodedBytes: number;
  readonly ownershipBytes: number;
  readonly decodeWorkingBytes: number;
}

/** Pure bounded source-size pass; it creates no grids, roots, plants or World bodies. */
const inspectFactoryNativeDecodeBudget = (native: FactoryNativeCoreV1): FactoryNativeDecodeBudget => {
  const terrain = native.terrain;
  if (!exactKeys(terrain, ["version", "sessionId", "epoch", "revision", "baseDigest", "sourceDigest", "base", "leaves"])
    || terrain.version !== "hvp-terrain-checkpoint-v1" || typeof terrain.sessionId !== "string" || !/^[A-Za-z0-9:._-]{1,37}$/.test(terrain.sessionId)
    || !safeInt(terrain.epoch) || !safeInt(terrain.revision)
    || !/^[0-9a-f]{8}$/.test(terrain.baseDigest) || !/^[0-9a-f]{8}$/.test(terrain.sourceDigest)) throw new Error("Invalid Factory V5 terrain identity");
  const baseBytes = hvpGridCheckpointBytes(terrain.base);
  if (JSON.stringify(terrain.base.size) !== "[256,128,256]" || canonicalJson(terrain.base.origin) !== canonicalJson({ x: -16, y: -8, z: -16 })) throw new Error("Factory V5 base frame mismatch");
  let decodedBytes = baseBytes;
  const neighborBaseBytes = native.neighbor ? hvpGridCheckpointBytes(native.neighbor.terrain.base) : 0;
  if (native.neighbor) {
    const t = native.neighbor.terrain;
    if (!Array.isArray(t.leaves) || t.leaves.length > 2048) throw new Error("Factory Native neighbour leaf budget");
    decodedBytes += neighborBaseBytes;
    for (const leaf of t.leaves) decodedBytes += hvpGridCheckpointBytes(leaf.grid);
  }
  for (const leaf of terrain.leaves) decodedBytes += hvpGridCheckpointBytes(leaf.grid);
  const plantIds = new Set<string>();
  for (const plant of native.plants) {
    decodedBytes += hvpPlantCheckpointBytes(plant);
    if (!plant?.instance?.id || plantIds.has(plant.instance.id)) throw new Error("Duplicate Factory Native plant owner");
    plantIds.add(plant.instance.id);
  }
  decodedBytes += hvpWorldCheckpointBytes(native.world);
  if (!Array.isArray(native.world.bodies) || native.world.bodies.length > 64) throw new Error("Factory Native body membership budget");
  const ownershipBytes = native.world.bodies.some(body => body.family === "terrain") ? baseBytes : 0;
  const decodeWorkingBytes = decodedBytes + 3 * baseBytes + ownershipBytes + (native.neighbor ? 3 * neighborBaseBytes : 0);
  if (decodeWorkingBytes > FACTORY_SAVE_DECODE_BYTES) throw new Error("Factory combined decode budget before allocation");
  return { baseBytes, neighborBaseBytes, decodedBytes, ownershipBytes, decodeWorkingBytes };
};

/** Exact current Native source-decode working charge, before any source expansion. */
export const estimateFactoryNativeDecodeWorkingBytes = (native: FactoryNativeCoreV1): number =>
  inspectFactoryNativeDecodeBudget(native).decodeWorkingBytes;

const validateNativeSourceAndOwners = (native: FactoryNativeCoreV1) => {
  const terrain = native.terrain;
  const budget = inspectFactoryNativeDecodeBudget(native);
  const { decodedBytes, ownershipBytes, decodeWorkingBytes } = budget;

  // All bounded RLE/source bytes are admitted before the first decoded grid or V5 copy exists.
  if(native.profiles.source==="hvp-factory-startsite-v6"&&terrain.baseDigest!=="360b00fa")
    throw new Error("Factory V6 base bytes/digest mismatch");
  const decodedBaseGrid = decodeHvpGrid(terrain.base);
  const base = native.profiles.source === "hvp-factory-startsite-v6"
    ? createHvpFactorySourceSnapshotV6(decodedBaseGrid.copySlots())
    : createHvpFactorySourceSnapshotV5(decodedBaseGrid.copySlots());
  if (base.sourceDigest !== terrain.baseDigest) throw new Error(`Factory ${native.profiles.source.slice(-2).toUpperCase()} base bytes/digest mismatch`);
  const root = restoreHvpTerrainRoot(terrain), plants = native.plants.map(plant => decodeHvpPlant(plant, root.read()));
  const world = decodeHvpWorld(native.world), neighborRoot = native.neighbor ? restoreHvpEastRegion(native.neighbor.terrain) : undefined;
  const view = validateHvpViewCheckpoint(native.view);
  const receipts = {
    terrain: decodeHvpReceipts(native.receipts.terrain, "terrain", terrain.revision),
    structural: decodeHvpReceipts(native.receipts.structural, "structural"),
    moving: decodeHvpReceipts(native.receipts.moving, "moving")
  };
  for (const [receipt, prefix, count] of [[receipts.terrain, "cut-", view.tool.sequence],
    [receipts.structural, "branch-cut-", view.tool.structureSequence], [receipts.moving, "moving-cut-", view.tool.movingSequence]] as const) {
    for (const entry of receipt.entries) if (entry.id.startsWith(prefix)) {
      const n = Number(entry.id.slice(prefix.length));
      if (!safeInt(n) || n < 1 || n > count) throw new Error("Factory Native receipt would reuse a command identity");
    }
  }
  if (native.progress !== null) {
    if (native.progress.sessionId !== terrain.sessionId) throw new Error("Foreign Factory objective session");
    validateHvpSalvageCheckpoint(native.progress, savedHvpSalvageObservation(world), createPersistenceSignature(native.world));
  } else if (native.world.branch?.kind === "salvage") throw new Error("Missing Factory Native objective state");

  const terrainOwners = new Uint8Array(ownershipBytes), branchOwners = new Set<string>();
  const branchCells = new Set((native.world.branch?.kind === "salvage" ? HVP_SALVAGE_CELLS : HVP_BRANCH_CELLS).map(c => `${c.x}:${c.y}:${c.z}`));
  for (const body of world.bodies) {
    const family = body.checkpoint.family;
    if (family !== "terrain" && family !== "branch") continue;
    if (body.checkpoint.dynamic && body.checkpoint.ownerId !== body.recipe.source.objectId) throw new Error("Factory Native fragment owner/source mismatch");
    for (const material of body.recipe.source.materials) {
      const expected = family === "terrain" ? HVP_COAST_MATERIAL_REGISTRY.find(m => m.slot === material.materialId) : undefined;
      if (family === "terrain" ? (!expected || material.densityKgPerCubicMeter !== expected.densityKgPerM3 || material.structuralClass !== expected.role)
        : (material.materialId !== 1 || material.densityKgPerCubicMeter !== 600 || material.structuralClass !== "wood")) throw new Error("Factory Native fragment material profile mismatch");
    }
    let anchored = false;
    for (const cell of readHvpBodyCells(body.recipe.source)) {
      if (family === "terrain") {
        const index = cell.x + cell.y * 256 + cell.z * 256 * 128;
        if (cell.x < 0 || cell.x >= 256 || cell.y < 1 || cell.y >= 128 || cell.z < 0 || cell.z >= 256
          || base.readSlot(cell.x, cell.y, cell.z) !== cell.materialId || root.read().readSlot(cell.x, cell.y, cell.z) !== 0 || terrainOwners[index] !== 0) {
          throw new Error("Factory Native terrain ownership overlap or missing origin");
        }
        terrainOwners[index] = 1;
      } else {
        const key = `${cell.x}:${cell.y}:${cell.z}`;
        if (!branchCells.has(key) || branchOwners.has(key) || cell.materialId !== 1) throw new Error("Factory Native wood ownership overlap or missing origin");
        branchOwners.add(key); anchored ||= cell.x === 0 && cell.y === 0 && cell.z === 0;
      }
    }
    if (family === "branch" && body.checkpoint.dynamic === anchored) throw new Error("Factory Native wood anchor/body-kind mismatch");
  }
  return { root, plants, world, neighborRoot, base, receipts, view, decodedBytes, decodeWorkingBytes };
};

const countNonEmptyCollisionSectors = (source: Parameters<typeof collisionInputs>[0]): number => {
  let count = 0;
  for (const input of collisionInputs(source)) {
    const { sizeX: sx, sizeY: sy, sizeZ: sz, slots } = input, strideX = sx + 2, strideY = sy + 2;
    let hasSurface = false;
    for (let z = 1; z <= sz && !hasSurface; z++) for (let y = 1; y <= sy && !hasSurface; y++) for (let x = 1; x <= sx; x++) {
      const at = x + y * strideX + z * strideX * strideY;
      if (slots[at] !== 0 && (slots[at - 1] === 0 || slots[at + 1] === 0 || slots[at - strideX] === 0 || slots[at + strideX] === 0
        || slots[at - strideX * strideY] === 0 || slots[at + strideX * strideY] === 0)) { hasSurface = true; break; }
    }
    if (hasSurface) count++;
  }
  return count;
};

const validateExactNativeColliderBudget = (native: ReturnType<typeof validateNativeSourceAndOwners>, installations: readonly FactoryInstallation[], parts: FactoryNativeWorldPartsV1): void => {
  const parked = new Set(native.world.checkpoint.parked ?? []);
  const coreBodies = native.world.bodies.length;
  const coreColliders = native.world.bodies.filter(body => !parked.has(body.checkpoint.ownerId)).reduce((sum, body) => sum + body.recipe.colliders.length, 0)
    + countNonEmptyCollisionSectors(native.root.read()) + (native.neighborRoot ? countNonEmptyCollisionSectors(native.neighborRoot.read()) : 0)
    + (native.world.checkpoint.player === null ? 0 : 1);
  const factoryBodies = 1 + installations.length + (parts.carrier === null ? 0 : 1);
  const factoryColliders = 1 + installations.reduce((sum, installation) => sum + createFactoryInstallationProfile(installation.definitionSourceId).colliders.length, 0)
    + (parts.carrier === null ? 0 : 5) + (native.base.version === "hvp-factory-startsite-v6" ? 8 : 0);
  if (coreBodies + (native.world.checkpoint.player === null ? 0 : 1) + factoryBodies > 64 || parts.owners.length + 1 + (parts.carrier === null ? 0 : 1) > 16
    || coreColliders + factoryColliders > 4096) throw new Error("Combined Native body/collider budget");
};

export interface FactoryDecodedCheckpointV1 {
  readonly checkpoint: FactoryCombinedCheckpointV1;
  readonly native: ReturnType<typeof validateNativeSourceAndOwners>;
  readonly material: MaterialView;
  readonly preflight: FactoryCheckpointPreflight;
  readonly decodeWorkingBytes: number;
  readonly cpuWorkingBytes: number;
}
export interface FactoryDecodedCheckpointV2 {
  readonly checkpoint: FactoryCombinedCheckpointV2;
  readonly native: ReturnType<typeof validateNativeSourceAndOwners>;
  readonly material: MaterialView;
  readonly preflight: FactoryCheckpointPreflight;
  readonly decodeWorkingBytes: number;
  readonly cpuWorkingBytes: number;
}
export type FactoryDecodedCheckpoint = FactoryDecodedCheckpointV1 | FactoryDecodedCheckpointV2;
export interface FactoryCheckpointAdmissionMetrics {
  /** Counts for the exact complete SaveGame envelope, including its wrapper fields. */
  readonly tree: FactoryCheckpointPreflight;
  readonly decodeWorkingBytes: number;
}
export type FactoryCheckpointAdmission = (metrics: FactoryCheckpointAdmissionMetrics) => void;
const factoryCheckpointCpuWorkingBytes = (tree: FactoryCheckpointPreflight, decodeWorkingBytes: number): number => {
  const units = 64 * (tree.objectCount + tree.arrayCount) + 16 * Math.max(0, tree.nodeCount - 1);
  const payload = tree.jsonUtf8Bytes;
  const total = tree.utf16Bytes + 8 * units + Math.max(decodeWorkingBytes + 3 * payload, 5 * payload + FACTORY_SAVE_TRANSPORT_BYTES);
  if (!Number.isSafeInteger(units) || !Number.isSafeInteger(total) || total > FACTORY_SAVE_CPU_BYTES) {
    throw new Error("Factory checkpoint CPU/decode budget before allocation");
  }
  return total;
};

const FACTORY_V2_OWNER_KEYS = ["version", "installations", "material", "domain", "lastPower", "links", "recipeSelections",
  "waitingStarts", "commandReceipts", "lastReceipt", "publicationRevision"] as const;
const FACTORY_V2_OWNER_VERSION = "fp06-factory-session-owner-v2";

/** Counts final compact wrappers and conservative overlapping import intermediates. */
const estimateFactoryV1OwnerWrapperBytes = (coreKeys: readonly string[]): number => {
  if (!Array.isArray(coreKeys) || coreKeys.some(key => typeof key !== "string")) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const domainKeys = [...coreKeys, "lastStep"];
  const ownerKeyBytes = FACTORY_V2_OWNER_KEYS.reduce((sum, key) => sum + key.length * 2, 0);
  const domainKeyBytes = domainKeys.reduce((sum, key) => sum + key.length * 2, 0);
  const versionBytes = FACTORY_V2_OWNER_VERSION.length * 2;
  const retained = 64 * 2 + 16 * (FACTORY_V2_OWNER_KEYS.length + domainKeys.length)
    + ownerKeyBytes + domainKeyBytes + versionBytes;
  // Core projection/validation intermediates can overlap the two retained wrappers.
  const transient = 64 * 3 + 16 * (FACTORY_V2_OWNER_KEYS.length + coreKeys.length * 3 + 12)
    + 2 * (ownerKeyBytes + domainKeyBytes) + versionBytes;
  const total = retained + transient;
  if (!Number.isSafeInteger(total)) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  return total;
};

/** Upper-bound the parsed V1 input wrapper before importing its compact Owner segments. */
export const estimateFactoryV1OwnerImportBytes = (inputBytes: string | null, coreKeys: readonly string[]): number => {
  if (!Array.isArray(coreKeys) || coreKeys.some(key => typeof key !== "string")) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const ownerWrapperBytes = estimateFactoryV1OwnerWrapperBytes(coreKeys);
  if (inputBytes === null) return ownerWrapperBytes;
  let objectCount = 0, arrayCount = 0, separators = 0, quoted = false, escaped = false;
  for (let index = 0; index < inputBytes.length; index += 1) {
    const character = inputBytes[index]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") objectCount += 1;
    else if (character === "[") arrayCount += 1;
    else if (character === "," || character === ":") separators += 1;
  }
  // Each object value has a colon; each array's first element has no comma.
  const nodesUpperBound = separators + arrayCount + 1;
  const segmentUnits = 64 * (objectCount + arrayCount) + 16 * Math.max(0, nodesUpperBound - 1);
  // The input string can coexist with parsed F/M0, replay validation, and wrappers.
  const total = inputBytes.length * 2 + segmentUnits + ownerWrapperBytes;
  if (!Number.isSafeInteger(segmentUnits) || !Number.isSafeInteger(total)) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  return total;
};

export const admitFactoryV1OwnerImport = (baseCpuBytes: number, inputBytes: string | null, coreKeys: readonly string[]): number => {
  const total = baseCpuBytes + estimateFactoryV1OwnerImportBytes(inputBytes, coreKeys);
  if (!Number.isSafeInteger(total) || total > FACTORY_SAVE_CPU_BYTES) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  return total;
};
const issuedFactoryCheckpoints = new WeakSet<object>();
const issuedFactoryCheckpointPayloads = new WeakSet<object>();
const issuedFactoryDecodedOwners = new WeakMap<object, FactorySessionCheckpointV2>();
const issuedFactoryDecodedOwnerImportBytes = new WeakMap<object, number>();
export const assertFactoryDecodedCheckpoint = (value: FactoryDecodedCheckpointV1): void => {
  if (!issuedFactoryCheckpoints.has(value) || value.checkpoint.version !== FACTORY_COMBINED_SAVE_VERSION) {
    throw new Error("Unvalidated Factory restore candidate");
  }
};
export const assertFactoryStoredDecodedCheckpoint = (value: FactoryDecodedCheckpoint): void => {
  if (!issuedFactoryCheckpoints.has(value)) throw new Error("Unvalidated Factory restore candidate");
};
/** Exact V1 payload identity returned only after full validation and deep freezing. */
export const isIssuedFactoryCheckpointPayload = (value: unknown): value is FactoryCombinedCheckpointV1 =>
  typeof value === "object" && value !== null && issuedFactoryCheckpointPayloads.has(value)
    && Object.getOwnPropertyDescriptor(value, "version")?.value === FACTORY_COMBINED_SAVE_VERSION;
/** Exact payload identity for either explicitly supported stored checkpoint version. */
export const isIssuedFactoryStoredCheckpointPayload = (value: unknown): value is FactoryStoredCheckpoint =>
  typeof value === "object" && value !== null && issuedFactoryCheckpointPayloads.has(value);

/** Returns only the compact Owner bound to this exact fully validated decoder result. */
export const readFactoryDecodedOwner = (decoded: FactoryDecodedCheckpoint): FactorySessionCheckpointV2 => {
  assertFactoryStoredDecodedCheckpoint(decoded);
  const owner = issuedFactoryDecodedOwners.get(decoded);
  if (!owner) throw new Error("Factory decoded checkpoint has no issued compact owner");
  return owner;
};

/** Additional retained bytes created only when a stored V1 Owner is adapted in memory. */
export const readFactoryDecodedOwnerImportBytes = (decoded: FactoryDecodedCheckpoint): number => {
  readFactoryDecodedOwner(decoded);
  return issuedFactoryDecodedOwnerImportBytes.get(decoded) ?? 0;
};

/** Prevents a copied or caller-constructed compact Owner from entering restore. */
export const assertFactoryDecodedOwner = (decoded: FactoryDecodedCheckpoint, owner: FactorySessionCheckpointV2): void => {
  if (readFactoryDecodedOwner(decoded) !== owner) throw new Error("Factory restore owner is not bound to its issued checkpoint");
};

/** Shared full decode. Each format keeps its exact profile and Dry validator while the Native gates run once. */
const decodeFactoryCheckpointInspected = (value: unknown, preflight: FactoryCheckpointPreflight,
  expectedVersion: typeof FACTORY_COMBINED_SAVE_VERSION | typeof FACTORY_COMBINED_SAVE_V2_VERSION, adaptV1Owner = false,retainedCpuBytes=0): FactoryDecodedCheckpoint => {
  if(!Number.isSafeInteger(retainedCpuBytes)||retainedCpuBytes<0)throw new Error("Factory checkpoint CPU/decode budget before allocation");
  if (!exactKeys(value, ["version", "profiles", "host", "native", "nativeFactory", "factory", "signature"])) throw new Error("Invalid combined Factory checkpoint shape");
  const rawVersion = Object.getOwnPropertyDescriptor(value as object, "version")?.value;
  if (rawVersion !== expectedVersion) throw new Error("Unsupported combined Factory checkpoint profile");
  const rawCheckpoint = value as unknown as FactoryStoredCheckpoint;
  if (!exactKeys(rawCheckpoint.native, ["version", "profiles", "terrain", "plants", "world", "receipts", "view", "progress", "neighbor"])) {
    throw new Error("Invalid Factory Native core shape");
  }
  if (Array.isArray(rawCheckpoint.factory?.installations)) {
    // Keep the pure combined-body membership guard ahead of source RLE sizing.
    // It needs only the saved owner count and allocates no Native source buffers.
    validateCombinedNativeAllocationCount(rawCheckpoint.native as FactoryNativeCoreV1, rawCheckpoint.nativeFactory,
      rawCheckpoint.factory.installations.length);
  }
  const nativeBudget = inspectFactoryNativeDecodeBudget(rawCheckpoint.native as FactoryNativeCoreV1);
  const materialContainers = rawCheckpoint.factory?.material?.containers;
  if (!Array.isArray(materialContainers) || materialContainers.length > 128) throw new Error("Factory material owner profile or count mismatch");
  const decodeWorkingBytes = nativeBudget.decodeWorkingBytes + materialContainers.length * 1024;
  if (decodeWorkingBytes > FACTORY_SAVE_DECODE_BYTES) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const envelopeTree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(rawCheckpoint));
  let cpuWorkingBytes = factoryCheckpointCpuWorkingBytes(envelopeTree, decodeWorkingBytes);
  const logicalCameraReserveBytes=expectedVersion===FACTORY_COMBINED_SAVE_V2_VERSION||adaptV1Owner
    ?FACTORY_LOGICAL_CAMERA_RESERVE_BYTES:0;
  if (cpuWorkingBytes > FACTORY_SAVE_CPU_BYTES - retainedCpuBytes - FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES
    - FACTORY_FRAME_PROJECTION_REFERENCE_RESERVE_BYTES-logicalCameraReserveBytes) {
    throw new Error("Factory checkpoint CPU/decode budget before allocation");
  }
  // The full arbitrary DTO has passed both its bounded memory gate and exact
  // transport gate before this public cloneability probe or signature work.
  assertCloneableFactoryCheckpoint(value);
  // Stored V1 adaptation and V2 validation operate on the final canonical,
  // deeply frozen DTO. The public V1 decoder retains its original validation path.
  const cloneBeforeValidation = expectedVersion === FACTORY_COMBINED_SAVE_V2_VERSION || adaptV1Owner;
  const checkpoint = cloneBeforeValidation
    ? canonicalizePersistenceValue(rawCheckpoint) as unknown as FactoryStoredCheckpoint
    : rawCheckpoint;
  const expectedProfiles = combinedProfilesFor(expectedVersion, checkpoint.native?.profiles?.source);
  if (canonicalJson(checkpoint.profiles) !== canonicalJson(expectedProfiles)) throw new Error("Unsupported combined Factory checkpoint profile");
  const transportBytes = preflight.jsonUtf8Bytes;
  if (transportBytes === 0 || transportBytes > FACTORY_SAVE_TRANSPORT_BYTES) throw new Error("Factory save transport budget");
  const { signature, ...unsigned } = checkpoint;
  if (typeof signature !== "string" || signature !== createPersistenceSignature(unsigned)) throw new Error("Factory checkpoint signature mismatch");

  const native = validateNativeCore(checkpoint.native);
  if (!exactKeys(checkpoint.host, ["sessionId", "epoch", "nativeTick", "remainderTicks", "steps"])
    || checkpoint.host.sessionId !== native.terrain.sessionId || !/^[A-Za-z0-9:._-]{1,37}$/.test(checkpoint.host.sessionId)
    || !safeInt(checkpoint.host.epoch) || checkpoint.host.epoch > 1_000_000_000 || checkpoint.host.epoch !== native.terrain.epoch
    || !safeInt(checkpoint.host.nativeTick) || checkpoint.host.nativeTick !== native.world.tick.ticks
    || !safeInt(checkpoint.host.remainderTicks) || checkpoint.host.remainderTicks > 5 || !safeInt(checkpoint.host.steps)) throw new Error("Factory host cursor mismatch");
  if (BigInt(checkpoint.host.steps) * 6n + BigInt(checkpoint.host.remainderTicks) > BigInt(checkpoint.host.nativeTick)) {
    throw new Error("Factory host cursor exceeds Native tick history");
  }
  let powerAuthorityBytes: string | undefined;
  const powerSupplyBytes = checkpoint.factory?.lastPower?.supplyCanonicalJson;
  if (typeof powerSupplyBytes === "string" && canonicalBytes(powerSupplyBytes)) {
    const savedSupply = JSON.parse(powerSupplyBytes) as Record<string, unknown>;
    if (typeof savedSupply.authorityBytes === "string") powerAuthorityBytes = savedSupply.authorityBytes;
  }
  const material = decodeFactoryMaterial(checkpoint.factory?.material, checkpoint.factory?.domain?.lastStep?.materialBytes, powerAuthorityBytes);
  const installations = validateInstallations(checkpoint.factory?.installations);
  validateCombinedNativeAllocationBudget(native, checkpoint.nativeFactory, installations);
  const factory = checkpoint.factory;
  if (!exactKeys(factory, ["version", "installations", "material", "domain", "lastPower", "links", "recipeSelections", "waitingStarts", "commandReceipts", "lastReceipt", "publicationRevision"])
    || (expectedVersion === FACTORY_COMBINED_SAVE_VERSION ? factory.version !== "fp06-factory-session-owner-v1" : factory.version !== "fp06-factory-session-owner-v2")) {
    throw new Error("Invalid Factory session owner shape");
  }
  const domain = factory.domain;
  if (domain.binding.sessionId !== bindFactoryDomainSession(checkpoint.host.sessionId).domainSessionId || domain.binding.epoch !== checkpoint.host.epoch
    || BigInt(domain.tickEndUs) / 100_000n !== BigInt(checkpoint.host.steps)) throw new Error("Factory logical session/cursor mismatch");
  const nativeFactory = validateFactoryNativeWorldParts(checkpoint.nativeFactory, native.terrain, installations, material);
  const nativeOwners = nativeFactory.owners.map(owner => ({ instanceId: owner.instanceId, installationRevision: owner.installationRevision }));
  let decodedOwner: FactorySessionCheckpointV2 | undefined, ownerImportRetainedBytes = 0;
  if (checkpoint.version === FACTORY_COMBINED_SAVE_V2_VERSION) {
    validateDryFactoryOwnerCheckpointState(checkpoint.factory.domain, material, installations, domain.lastStep?.materialBytes ?? null, nativeOwners);
    decodedOwner = checkpoint.factory;
  } else if (adaptV1Owner) {
    const legacyFactory = checkpoint.factory;
    const compactDomain = importDryFactoryStateV1(legacyFactory.domain, material, installations,
      legacyFactory.domain.lastStep?.materialBytes ?? null, nativeOwners, parts => {
        // Parsing creates F and M0 alongside the retained V1; Core references are shared.
        const admittedBytes = admitFactoryV1OwnerImport(cpuWorkingBytes, parts.replay?.inputBytes ?? null, Object.keys(parts.core));
        if (admittedBytes + retainedCpuBytes > FACTORY_SAVE_CPU_BYTES - FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES
          - FACTORY_FRAME_PROJECTION_REFERENCE_RESERVE_BYTES-FACTORY_LOGICAL_CAMERA_RESERVE_BYTES) {
          throw new Error("Factory checkpoint CPU/decode budget before allocation");
        }
        cpuWorkingBytes = admittedBytes;
      });
    decodedOwner = Object.freeze({ ...legacyFactory, version: "fp06-factory-session-owner-v2", domain: compactDomain });
    ownerImportRetainedBytes = retainedBytesForImportedOwner(decodedOwner);
  } else {
    validateDryFactoryCheckpointState(checkpoint.factory.domain, material, installations, domain.lastStep?.materialBytes ?? null, nativeOwners);
  }
  const paidPowerLinks = validatePaidPowerLinks(factory.links, installations, material);
  validatePowerReceipt(factory.lastPower, domain, paidPowerLinks);
  validateUiHistory(factory, checkpoint.host);
  if (!Array.isArray(factory.recipeSelections) || factory.recipeSelections.length > installations.length
    || !Array.isArray(factory.waitingStarts) || factory.waitingStarts.length > installations.length) throw new Error("Factory session recipe/job membership budget");
  const machines = new Set(domain.machines.map(machine => machine.machineInstanceId)), selectionIds = new Set<string>();
  const selectionHistory = new Map<string, FactoryUiRecipeRef[]>();
  for (const receipt of factory.commandReceipts) if (receipt.status === "Committed") {
    const command = JSON.parse(receipt.requestCanonicalJson) as FactoryUiCommand;
    if (command.kind === "select-recipe") {
      const history = selectionHistory.get(command.machine.id) ?? [];
      history.push(command.recipe); selectionHistory.set(command.machine.id, history);
    }
  }
  for (const rawSelection of factory.recipeSelections) {
    if (!exactKeys(rawSelection, ["instanceId", "recipe", "revision"])) throw new Error("Invalid saved recipe selection");
    const selection = rawSelection as unknown as FactoryRecipeSelectionV1;
    if (!machines.has(selection.instanceId) || selectionIds.has(selection.instanceId) || !safeInt(selection.revision) || selection.revision < 1
      || !exactKeys(selection.recipe, ["sourceId", "version", "digest"])) throw new Error("Invalid saved recipe selection");
    const recipe = currentCatalog.recipes.find(r => r.sourceId === selection.recipe.sourceId && r.version === selection.recipe.version && r.digest === selection.recipe.digest);
    if (!recipe || !recipe.processes.some(p => p.availability === "first-dry-loop")) throw new Error("Saved recipe selection is unavailable");
    const history = selectionHistory.get(selection.instanceId);
    if (!history || history.length !== selection.revision || canonicalJson(history.at(-1)) !== canonicalJson(selection.recipe)) throw new Error("Saved recipe selection/history mismatch");
    selectionIds.add(selection.instanceId);
  }
  if ([...selectionHistory.keys()].some(instanceId => !selectionIds.has(instanceId))) throw new Error("Missing saved recipe selection");
  const waitingIds = new Set<string>(), waitingCommands = new Set<string>();
  for (const rawWaiting of factory.waitingStarts) {
    if (!exactKeys(rawWaiting, ["instanceId", "command"])) throw new Error("Invalid saved waiting production start");
    const waiting = rawWaiting as unknown as { readonly instanceId: string; readonly command: ProductionStart };
    const command = waiting.command;
    if (!machines.has(waiting.instanceId) || waitingIds.has(waiting.instanceId)
      || !exactKeys(command, ["kind", "commandId", "jobId", "batchOrdinal", "ownerId", "actorId", "recipeRef", "processKind", "sourceLots", ...(Object.hasOwn(command, "missionId") ? ["missionId"] : [])])
      || command.kind !== "start" || !saveId(command.commandId) || command.jobId !== `job_${command.commandId}` || !saveId(command.jobId) || !saveId(command.ownerId)
      || !saveId(command.actorId) || !safeInt(command.batchOrdinal)
      || !exactKeys(command.recipeRef, ["sourceId", "version", "digest"]) || !["manual", "electric"].includes(command.processKind)
      || !Array.isArray(command.sourceLots) || command.sourceLots.length > 64
      || waitingCommands.has(command.commandId)) throw new Error("Invalid saved waiting production start");
    for (const lot of command.sourceLots) if (!exactKeys(lot, ["itemId", "containerId", "stackId"])
      || typeof lot.itemId !== "string" || !currentCatalog.items.some(item => item.sourceId === lot.itemId)
      || !saveId(lot.containerId) || !saveId(lot.stackId)) throw new Error("Invalid saved waiting source lot");
    const machine = domain.machines.find(m => m.machineInstanceId === waiting.instanceId);
    if (machine?.job && machine.job.phase !== "COMPLETED") throw new Error("Waiting start duplicates an active production job");
    const recipe = currentCatalog.recipes.find(r => r.sourceId === command.recipeRef.sourceId && r.version === command.recipeRef.version && r.digest === command.recipeRef.digest);
    const owner = installations.find(i => i.instanceId === waiting.instanceId), device = owner && currentCatalog.devices.find(d => d.sourceId === owner.definitionSourceId);
    const process = recipe?.processes.find(p => p.kind === command.processKind && p.availability === "first-dry-loop" && device?.capabilities.includes(p.capability));
    const selected = factory.recipeSelections.find(selection => selection.instanceId === waiting.instanceId)?.recipe;
    const defaultRecipe = device && currentCatalog.recipes.find(candidate => candidate.processes.some(p => p.availability === "first-dry-loop" && device.capabilities.includes(p.capability)));
    if (!recipe || !device || !process || command.ownerId !== "fp02_wreck_owner" || command.actorId !== "hvp_player"
      || command.sourceLots.length !== recipe.inputs.length || recipe.inputs.some(term => !command.sourceLots.some(lot => lot.itemId === term.itemId))
      || (selected ? canonicalJson(selected) !== canonicalJson(command.recipeRef) : defaultRecipe?.sourceId !== command.recipeRef.sourceId)
      || command.batchOrdinal !== machine?.commandReceipts.filter(r => r.kind === "start").length) throw new Error("Waiting start recipe/history mismatch");
    waitingIds.add(waiting.instanceId); waitingCommands.add(command.commandId);
  }
  for (const waiting of factory.waitingStarts) {
    const receipt = factory.commandReceipts.find(r => r.commandId === waiting.command.commandId);
    const request = receipt ? JSON.parse(receipt.requestCanonicalJson) as FactoryUiCommand : null;
    const recipe = currentCatalog.recipes.find(r => r.sourceId === waiting.command.recipeRef.sourceId && r.version === waiting.command.recipeRef.version && r.digest === waiting.command.recipeRef.digest);
    if (!request || receipt?.status !== "Committed" || request.kind !== "start" || request.machine.id !== waiting.instanceId || !recipe
      || request.sourceLots.length !== recipe.inputs.length || waiting.command.sourceLots.length !== recipe.inputs.length
      ) throw new Error("Waiting Factory start has no committed UI history");
    const uiSourceLots: Extract<FactoryUiCommand, { kind: "start" }>["sourceLots"] = request.sourceLots;
    const savedSourceLots: ProductionStart["sourceLots"] = waiting.command.sourceLots;
    if (recipe.inputs.some(term => {
        const savedLot = savedSourceLots.find((lot: ProductionStart["sourceLots"][number]) => lot.itemId === term.itemId);
        const uiLot = uiSourceLots.find((lot: Extract<FactoryUiCommand, { kind: "start" }>["sourceLots"][number]) => lot.containerId === savedLot?.containerId && lot.stackId === savedLot.stackId);
        return !savedLot || !uiLot || uiLot.quantityUnits !== term.quantityUnits;
      })) throw new Error("Waiting Factory start has no committed UI history");
  }
  if (nativeFactory.owners.length !== installations.length) throw new Error("Native Factory checkpoint bound mismatch");
  // Expand the full native scene and perform the exact collider scan only after every
  // independent material, power, link, UI, recipe, and waiting-start gate passes.
  const nativeDecoded = validateNativeSourceAndOwners(native);
  validateExactNativeColliderBudget(nativeDecoded, installations, nativeFactory);
  const validatedDecodeWorkingBytes = nativeDecoded.decodeWorkingBytes + material.containers.length * 1024;
  if (validatedDecodeWorkingBytes !== decodeWorkingBytes) throw new Error("Factory checkpoint decode admission changed");
  const owned = cloneBeforeValidation ? checkpoint : canonicalizePersistenceValue(checkpoint) as unknown as FactoryStoredCheckpoint;
  const decoded: FactoryDecodedCheckpoint = expectedVersion === FACTORY_COMBINED_SAVE_VERSION
    ? Object.freeze({ checkpoint: owned as FactoryCombinedCheckpointV1, native: nativeDecoded, material, preflight, decodeWorkingBytes, cpuWorkingBytes })
    : Object.freeze({ checkpoint: owned as FactoryCombinedCheckpointV2, native: nativeDecoded, material, preflight, decodeWorkingBytes, cpuWorkingBytes });
  if (decodedOwner) {
    issuedFactoryDecodedOwners.set(decoded, decodedOwner);
    issuedFactoryDecodedOwnerImportBytes.set(decoded, ownerImportRetainedBytes);
  }
  issuedFactoryCheckpointPayloads.add(owned);
  issuedFactoryCheckpoints.add(decoded);
  return decoded;
};

export const decodeFactoryCheckpoint = (value: unknown): FactoryDecodedCheckpointV1 => {
  const preflight = inspectFactoryCheckpointTree(value);
  const decoded = decodeFactoryCheckpointInspected(value, preflight, FACTORY_COMBINED_SAVE_VERSION);
  if (decoded.checkpoint.version !== FACTORY_COMBINED_SAVE_VERSION) throw new Error("Unsupported combined Factory checkpoint profile");
  return decoded as FactoryDecodedCheckpointV1;
};

export const decodeFactoryCheckpointV2 = (value: unknown): FactoryDecodedCheckpointV2 => {
  const preflight = inspectFactoryCheckpointTree(value);
  const decoded = decodeFactoryCheckpointInspected(value, preflight, FACTORY_COMBINED_SAVE_V2_VERSION);
  if (decoded.checkpoint.version !== FACTORY_COMBINED_SAVE_V2_VERSION) throw new Error("Unsupported combined Factory checkpoint profile");
  return decoded as FactoryDecodedCheckpointV2;
};

/** Strict dispatcher for persisted combined saves; unknown and malformed versions reject. */
export const decodeStoredFactoryCheckpoint = (value: unknown,retainedCpuBytes=0): FactoryDecodedCheckpoint => {
  if(!Number.isSafeInteger(retainedCpuBytes)||retainedCpuBytes<0)throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const preflight = inspectFactoryCheckpointTree(value);
  if (!exactKeys(value, ["version", "profiles", "host", "native", "nativeFactory", "factory", "signature"])) {
    throw new Error("Invalid combined Factory checkpoint shape");
  }
  const version = Object.getOwnPropertyDescriptor(value as object, "version")?.value;
  if (version !== FACTORY_COMBINED_SAVE_VERSION && version !== FACTORY_COMBINED_SAVE_V2_VERSION) {
    throw new Error("Unsupported combined Factory checkpoint profile");
  }
  return decodeFactoryCheckpointInspected(value, preflight, version, version === FACTORY_COMBINED_SAVE_VERSION,retainedCpuBytes);
};

/** Store-write validation does not adapt a V1 payload because it is not a restore boundary. */
export const decodeFactoryCheckpointForSave = (value: unknown): FactoryStoredCheckpoint => {
  const preflight = inspectFactoryCheckpointTree(value);
  if (!exactKeys(value, ["version", "profiles", "host", "native", "nativeFactory", "factory", "signature"])) {
    throw new Error("Invalid combined Factory checkpoint shape");
  }
  const version = Object.getOwnPropertyDescriptor(value as object, "version")?.value;
  if (version !== FACTORY_COMBINED_SAVE_VERSION && version !== FACTORY_COMBINED_SAVE_V2_VERSION) {
    throw new Error("Unsupported combined Factory checkpoint profile");
  }
  return decodeFactoryCheckpointInspected(value, preflight, version).checkpoint;
};

const encoderDescriptorValue=(descriptor:PropertyDescriptor|undefined,key:PropertyKey):unknown=>{
  if(!descriptor?.enumerable)throw new Error("Invalid Factory checkpoint encoder data");
  if(!("value" in descriptor))throw new Error(`Factory checkpoint encoder ${String(key)} accessor is not allowed`);
  return descriptor.value;
};
const ownEncoderDataValue=(value:unknown,key:string):unknown=>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid Factory checkpoint encoder data");
  return encoderDescriptorValue(Object.getOwnPropertyDescriptor(value,key),key);
};
const captureEncoderInput=(data:FactoryCombinedCheckpointInput|FactoryCombinedCheckpointV2Input)=>{
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Invalid Factory checkpoint encoder data");
  const expected=["host","native","nativeFactory","factory"] as const;
  let hostValue:unknown,nativeValue:unknown,nativeFactoryValue:unknown,factoryValue:unknown;
  const seen=new Set<string>();
  for(const key of Reflect.ownKeys(data)){
    const descriptor=Object.getOwnPropertyDescriptor(data,key);
    if(!descriptor?.enumerable)continue;
    if(typeof key!=="string"||!expected.includes(key as typeof expected[number]))
      throw new Error("Invalid Factory checkpoint encoder shape");
    const captured=encoderDescriptorValue(descriptor,key);
    seen.add(key);
    if(key==="host")hostValue=captured;
    else if(key==="native")nativeValue=captured;
    else if(key==="nativeFactory")nativeFactoryValue=captured;
    else factoryValue=captured;
  }
  if(seen.size!==expected.length)throw new Error("Invalid Factory checkpoint encoder data");
  const host=hostValue as FactoryHostCursorV1;
  const native=nativeValue as FactoryNativeCoreV1;
  const nativeFactory=nativeFactoryValue as FactoryNativeWorldPartsV1;
  const factory=factoryValue as FactorySessionCheckpointV1|FactorySessionCheckpointV2;
  const nativeProfiles=ownEncoderDataValue(native,"profiles");
  const source=ownEncoderDataValue(nativeProfiles,"source");
  return {host,native,nativeFactory,factory,source};
};

export const encodeFactoryCheckpoint = (data: FactoryCombinedCheckpointInput, admit?: FactoryCheckpointAdmission): FactoryCombinedCheckpointV1 => {
  const {source,...input}=captureEncoderInput(data);
  const profiles = combinedProfilesFor(FACTORY_COMBINED_SAVE_VERSION, source) as FactoryCombinedSaveProfiles;
  const unsigned = { version: FACTORY_COMBINED_SAVE_VERSION, profiles, ...input };
  // The fixed-width placeholder has the same UTF-16 and UTF-8 length as the real
  // FNV signature. Count the actual full storage envelope before signing or cloning.
  const measuredCheckpoint = { ...unsigned, signature: "fnv1a32:00000000" };
  const tree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(measuredCheckpoint));
  const decodeWorkingBytes = estimateFactoryNativeDecodeWorkingBytes(input.native) + input.factory.material.containers.length * 1024;
  admit?.({ tree, decodeWorkingBytes });
  factoryCheckpointCpuWorkingBytes(tree, decodeWorkingBytes);
  if (decodeWorkingBytes > FACTORY_SAVE_DECODE_BYTES) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const checkpoint = { ...unsigned, signature: createPersistenceSignature(unsigned) } as FactoryCombinedCheckpointV1;
  if (!/^fnv1a32:[0-9a-f]{8}$/.test(checkpoint.signature)) throw new Error("Factory checkpoint signature width mismatch");
  const signedTree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(checkpoint));
  if (signedTree.objectCount !== tree.objectCount || signedTree.arrayCount !== tree.arrayCount || signedTree.sourceSlots !== tree.sourceSlots
    || signedTree.utf16Bytes !== tree.utf16Bytes || signedTree.jsonUtf8Bytes !== tree.jsonUtf8Bytes || signedTree.nodeCount !== tree.nodeCount) {
    throw new Error("Factory checkpoint signature changed admitted envelope size");
  }
  return decodeFactoryCheckpoint(checkpoint).checkpoint;
};

export const encodeFactoryCheckpointV2 = (data: FactoryCombinedCheckpointV2Input, admit?: FactoryCheckpointAdmission): FactoryCombinedCheckpointV2 => {
  const {source,...input}=captureEncoderInput(data);
  const profiles = combinedProfilesFor(FACTORY_COMBINED_SAVE_V2_VERSION, source) as FactoryCombinedSaveV2Profiles;
  const unsigned = { version: FACTORY_COMBINED_SAVE_V2_VERSION, profiles, ...input };
  const measuredCheckpoint = { ...unsigned, signature: "fnv1a32:00000000" };
  const tree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(measuredCheckpoint));
  const decodeWorkingBytes = estimateFactoryNativeDecodeWorkingBytes(input.native) + input.factory.material.containers.length * 1024;
  admit?.({ tree, decodeWorkingBytes });
  factoryCheckpointCpuWorkingBytes(tree, decodeWorkingBytes);
  if (decodeWorkingBytes > FACTORY_SAVE_DECODE_BYTES) throw new Error("Factory checkpoint CPU/decode budget before allocation");
  const checkpoint = { ...unsigned, signature: createPersistenceSignature(unsigned) } as FactoryCombinedCheckpointV2;
  if (!/^fnv1a32:[0-9a-f]{8}$/.test(checkpoint.signature)) throw new Error("Factory checkpoint signature width mismatch");
  const signedTree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(checkpoint));
  if (signedTree.objectCount !== tree.objectCount || signedTree.arrayCount !== tree.arrayCount || signedTree.sourceSlots !== tree.sourceSlots
    || signedTree.utf16Bytes !== tree.utf16Bytes || signedTree.jsonUtf8Bytes !== tree.jsonUtf8Bytes || signedTree.nodeCount !== tree.nodeCount) {
    throw new Error("Factory checkpoint signature changed admitted envelope size");
  }
  return decodeFactoryCheckpointV2(checkpoint).checkpoint;
};

export const parseFactoryCheckpoint = (bytes: Uint8Array): FactoryDecodedCheckpointV1 => {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > FACTORY_SAVE_TRANSPORT_BYTES) throw new Error("Factory save transport budget before decode");
  return decodeFactoryCheckpoint(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
};

export const factoryCheckpointBytes = (value: FactoryCombinedCheckpointV1): Uint8Array => {
  const bytes = new TextEncoder().encode(serializeCanonicalPersistenceValue(value));
  if (bytes.byteLength > FACTORY_SAVE_TRANSPORT_BYTES) throw new Error("Factory save transport budget");
  return bytes;
};
