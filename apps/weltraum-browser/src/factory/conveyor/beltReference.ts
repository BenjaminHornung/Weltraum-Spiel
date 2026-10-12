import { commitFactoryMaterialStep, prepareFactoryMaterialStep, type MaterialPlan, type MaterialView, type MaterialIntent } from "../material/reservations";
import { assertMaterialSnapshots } from "../material/resourcesAdapter";
import { findFactoryItem, safeWhole, safeBigIntNumber, validateFactoryAmount } from "../material/quantity";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import type { ResourceStack } from "../../resources/types";
import { assertFactoryBeltPorts, assertFactoryBeltItemPorts, type BeltInstallation } from "./beltPorts";

/** Conservative versioned reference: one native packet per short, straight line. */
export const FACTORY_BELT_POLICY = Object.freeze({ version: "fp06-one-packet-belt-v1", maxPackets: 1,
  stepUs: "100000", speedMmPerSecond: 750, movementMmPerStep: 75,
  maxPacketMassMg: 10_000_000, creditMgPerStep: 100_000, maxCreditMg: 10_000_000 });
export interface BeltBinding {
  readonly sessionId: string; readonly epoch: number; readonly netRevision: number;
  readonly catalogDigest: string; readonly sourceProfileDigest: string;
}
/** Structural seam to W03 FactoryPowerSuccess, including its complete canonical receipt. */
export interface BeltPowerReceipt {
  readonly ok: true; readonly binding: BeltBinding;
  readonly tickStartUs: string; readonly tickEndUs: string;
  readonly grants: readonly Readonly<{ consumerId: string; deviceInstanceId: string; jobId: string; portId: string;
    requiredMilliWatt: string; allocatedMilliWatt: string; work: Readonly<{ n: string; d: string }>;
    status: "Powered" | "Idle" | "WAIT_POWER" | "WAIT_RESTART" | "NET_DISCONNECTED" | "NET_CAPACITY" }>[];
  readonly canonicalJson: string; readonly digest: string;
}
export interface BeltPacket {
  readonly packetId: string; readonly stackId: string; readonly itemId: string;
  readonly itemVersion: number; readonly itemDigest: string;
  readonly parentStackId: string; readonly injectionTransactionId: string;
  readonly injectionReceiptCanonicalJson: string;
  readonly sourceRevisionAfterInjection: number; readonly targetRevisionAtInjection: number;
  readonly positionMm: number;
}
export interface BeltState {
  readonly version: "fp06-one-packet-belt-v1"; readonly lineId: string; readonly revision: number;
  readonly binding: BeltBinding; readonly installation: BeltInstallation;
  readonly tickEndUs: string; readonly creditMg: number; readonly packetCursor: number;
  readonly packet: BeltPacket | null;
  readonly lastStep: Readonly<{ tickEndUs: string; requestDigest: string; outcome: string }> | null;
}
export interface BeltStepInput {
  readonly confirmed: boolean; readonly binding: BeltBinding;
  readonly tickStartUs: string; readonly tickEndUs: string;
  readonly installation: BeltInstallation; readonly material: MaterialView;
  readonly power: BeltPowerReceipt; readonly actorId: string;
  /** Optional exact intake command (e.g. CUT8kg); quantity authority remains the native source stack. */
  readonly sourceLot: Readonly<{ stackId: string; itemId: string; quantityUnits?: number }> | null;
}
export type BeltStepProposal = Readonly<{ status: "Prepared"; baseLineCanonicalJson: string;
  inputCanonicalJson: string; nextLine: BeltState; materialPlan: MaterialPlan | null;
  outcome: "Injected" | "Moved" | "Delivered" | "WAIT_SOURCE" | "WAIT_CREDIT" | "WAIT_OUTPUT" | "WAIT_POWER" }>
  | Readonly<{ status: "Rejected"; reason: string }>;
export type BeltStepResult = Readonly<{ status: "Committed" | "NoOp"; line: BeltState; material: MaterialView }>
  | Readonly<{ status: "Rejected"; line: BeltState; material: MaterialView; reason: string }>;
const require = (condition: boolean, reason: string): void => { if (!condition) throw new Error(reason); };
const integer = (value: string): bigint => {
  require(typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value), "InvalidBeltInteger");
  const result = BigInt(value); require(result <= 9_223_372_036_854_775_807n, "BeltIntegerOverflow"); return result;
};
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// W08 reuses only a successful W02 snapshot validation of the exact immutable
// catalog/list pair. No line, power, receipt, port or custody decision is cached.
const immutableSnapshotData = new WeakSet<object>();
const cloneableSnapshotData = new WeakSet<object>();
const validatedSnapshotSets = new WeakMap<MaterialView["catalog"], WeakSet<MaterialView["containers"]>>();
const isImmutableSnapshotData = (value: unknown, parents = new WeakSet<object>()): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return typeof value === "string" || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
  if (immutableSnapshotData.has(value)) return true;
  if (!Object.isFrozen(value) || parents.has(value)) return false;
  const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string")) return false;
  // Standard cloneability must visit every fact; hidden values stay uncached.
  if (keys.some(key => !(array && key === "length") && !descriptors[key as string]!.enumerable)) return false;
  if (array && (keys.some(key => key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key as string)
    || !Number.isSafeInteger(Number(key)) || Number(key) >= value.length))
    || keys.length !== value.length + 1)) return false;
  parents.add(value);
  const valid = Object.values(descriptors).every(descriptor => "value" in descriptor
    && isImmutableSnapshotData(descriptor.value, parents));
  parents.delete(value);
  if (valid) immutableSnapshotData.add(value);
  return valid;
};
const isCloneableSnapshotData = (value: object): boolean => {
  if (typeof globalThis.structuredClone !== "function") return false;
  if (cloneableSnapshotData.has(value)) return true;
  try {
    // Unlike descriptor inspection, the standard clone operation rejects even
    // nested frozen Proxies with virtual inherited iterators/methods. Its output
    // is discarded; the original W02 input and canonical authority stay intact.
    globalThis.structuredClone(value);
    cloneableSnapshotData.add(value);
    return true;
  } catch { return false; }
};
const assertBeltMaterialSnapshots = (material: MaterialView): void => {
  // Read caller accessors once: only the very same pair checked by W02 may enter.
  const { catalog, containers } = material;
  if (validatedSnapshotSets.get(catalog)?.has(containers)) return;
  assertMaterialSnapshots(catalog, containers);
  if (!isImmutableSnapshotData(catalog) || !isImmutableSnapshotData(containers)) return;
  if (!isCloneableSnapshotData(catalog) || !isCloneableSnapshotData(containers)) return;
  let sets = validatedSnapshotSets.get(catalog);
  if (!sets) { sets = new WeakSet(); validatedSnapshotSets.set(catalog, sets); }
  sets.add(containers);
};
const snapshot = (material: MaterialView, id: string) => {
  const found = material.containers.find((entry) => entry.state.containerId === id);
  require(!!found, "MissingBeltContainer"); return found!;
};
// Resources deliberately exposes depletion:undefined for non-mining snapshots.
// Omit that one native optional projection; bind every other complete snapshot fact.
const materialData = (material: MaterialView) => ({ ...material, containers: material.containers.map((entry) => {
  const { depletion, ...data } = entry;
  return depletion === undefined ? data : { ...data, depletion };
}) });
const inputBytes = (input: BeltStepInput): string => canonicalJson({ ...input, material: materialData(input.material) });
const proposalBytes = (proposal: Extract<BeltStepProposal, { status: "Prepared" }>): string => canonicalJson({ ...proposal,
  materialPlan: proposal.materialPlan ? { ...proposal.materialPlan, candidate: materialData(proposal.materialPlan.candidate) } : null });
const capacityBlocked = (reason: string): boolean => ["TargetMassExceeded", "TargetVolumeExceeded", "TargetStackLimitExceeded"].includes(reason);
const assertProductionRef = (lot: ResourceStack, itemId: string, material: MaterialView): void => {
  const production = lot.extensions["factory.production"];
  if (production === undefined) return;
  require(production !== null && typeof production === "object" && !Array.isArray(production) && "recipeRef" in production, "InvalidBeltProductionRef");
  const ref = (production as { recipeRef: unknown }).recipeRef;
  require(ref !== null && typeof ref === "object" && !Array.isArray(ref) && "sourceId" in ref && "version" in ref && "digest" in ref,
    "InvalidBeltProductionRef");
  const reference = ref as { sourceId: unknown; version: unknown; digest: unknown };
  const recipe = material.catalog.recipes.find((entry) => entry.sourceId === reference.sourceId);
  require(!!recipe && recipe.version === reference.version && recipe.digest === reference.digest
    && recipe.outputs.some((term) => term.itemId === itemId), "StaleBeltProductionRecipe");
};

/** Public restore/read validation; it proves reference consistency, not World admission. */
export function assertFactoryBeltState(line: BeltState, material: MaterialView): void {
  require(line.version === FACTORY_BELT_POLICY.version && isSaveSafeResourceId(line.lineId), "InvalidBeltState");
  safeWhole(line.revision, "BeltRevision", true); safeWhole(line.packetCursor, "PacketCursor", true);
  safeWhole(line.creditMg, "BeltCredit", true); require(line.creditMg <= FACTORY_BELT_POLICY.maxCreditMg, "BeltCreditOverflow");
  require(integer(line.tickEndUs) % 100_000n === 0n, "InvalidBeltClockCursor");
  safeWhole(line.binding.epoch, "BeltEpoch", true); safeWhole(line.binding.netRevision, "BeltNetRevision", true);
  require(isSaveSafeResourceId(line.binding.sessionId) && line.binding.catalogDigest === material.catalog.catalogDigest
    && line.installation.catalogDigest === line.binding.catalogDigest && line.installation.sourceProfileDigest === line.binding.sourceProfileDigest,
    "BeltAuthorityBindingMismatch");
  require((line.revision === 0 && line.lastStep === null) || (line.revision > 0 && line.lastStep?.tickEndUs === line.tickEndUs), "InvalidBeltStepCursor");
  require(line.revision > 0 || (line.creditMg === 0 && line.packetCursor === 0 && line.packet === null), "InvalidInitialBeltCredit");
  assertBeltMaterialSnapshots(material);
  assertFactoryBeltPorts(line.installation, material);
  const band = snapshot(material, line.installation.bandContainerId);
  if (line.packet === null) { require(band.state.contents.length === 0, "OrphanedBeltLot"); return; }
  const p = line.packet;
  require([p.packetId, p.stackId, p.parentStackId, p.injectionTransactionId].every(isSaveSafeResourceId), "InvalidBeltPacketId");
  safeWhole(p.positionMm, "BeltPosition", true); require(p.positionMm <= line.installation.lengthMm, "BeltPositionOutsideRoute");
  safeWhole(p.sourceRevisionAfterInjection, "BeltSourceRevision", true); safeWhole(p.targetRevisionAtInjection, "BeltTargetRevision", true);
  const item = findFactoryItem(material.catalog, p.itemId);
  require(item.digest === p.itemDigest && item.version === p.itemVersion, "BeltPacketItemBindingMismatch");
  require(band.state.contents.length === 1 && band.state.contents[0].stackId === p.stackId && band.state.contents[0].resourceId === item.resourceId,
    "BeltLotCustodyMismatch");
  const amount = validateFactoryAmount(p.itemId, band.state.contents[0].quantity, material.catalog);
  assertFactoryBeltItemPorts(line.installation, p.itemId, material);
  assertProductionRef(band.state.contents[0], p.itemId, material);
  require(amount.massMg <= FACTORY_BELT_POLICY.maxPacketMassMg, "BeltPacketTooHeavy");
  const receipt = material.receipts.find((entry) => entry.transactionId === p.injectionTransactionId);
  require(!!receipt && canonicalJson(receipt) === p.injectionReceiptCanonicalJson, "BeltInjectionReceiptMismatch");
  const intent = JSON.parse(receipt!.requestCanonicalJson) as MaterialIntent;
  require(intent.kind === "transfer" && intent.ownerId === line.installation.driveInstanceId && intent.moves.length === 1
    && intent.moves[0].sourceContainerId === line.installation.source.containerId && intent.moves[0].sourceStackId === p.parentStackId
    && intent.moves[0].targetContainerId === band.state.containerId && intent.moves[0].targetStackId === p.stackId
    && intent.moves[0].itemId === p.itemId && intent.moves[0].quantityUnits === amount.quantityUnits
    && intent.moves[0].sourcePortId === line.installation.source.nativePortId && intent.moves[0].targetPortId === line.installation.bandInPortId,
    "BeltPacketLineageMismatch");
  require(snapshot(material, line.installation.source.containerId).state.revision >= p.sourceRevisionAfterInjection
    && snapshot(material, line.installation.target.containerId).state.revision >= p.targetRevisionAtInjection, "BeltContainerRevisionRegressed");
}

const powered = (line: BeltState, input: BeltStepInput): boolean => {
  const p = input.power;
  require(p.ok === true && canonicalJson(p.binding) === canonicalJson(input.binding)
    && p.tickStartUs === input.tickStartUs && p.tickEndUs === input.tickEndUs, "StaleBeltPowerGrant");
  const { canonicalJson: bytes, digest, ...body } = p;
  require(canonicalJson(body) === bytes && canonicalSignature(body) === digest, "InvalidBeltPowerReceipt");
  const grants = p.grants.filter((grant) => grant.consumerId === line.installation.consumerId);
  require(grants.length === 1, "MissingOrDuplicateBeltPowerGrant");
  const grant = grants[0];
  require(grant.deviceInstanceId === line.installation.driveInstanceId && grant.jobId === line.installation.jobId
    && grant.portId === line.installation.powerPortId, "ForeignBeltPowerConsumer");
  const required = BigInt(line.installation.lengthMm) * 25n;
  const declared = integer(grant.requiredMilliWatt), allocated = integer(grant.allocatedMilliWatt);
  const n = integer(grant.work.n), d = integer(grant.work.d);
  require(d > 0n && declared <= required && allocated <= declared && n * 10n === allocated * d, "InconsistentBeltPowerWork");
  return grant.status === "Powered" && declared === required && allocated === required;
};

export function advanceFactoryBelt(line: BeltState, input: BeltStepInput): BeltStepProposal {
  try {
    assertFactoryBeltState(line, input.material);
    require(input.confirmed === true && canonicalJson(input.binding) === canonicalJson(line.binding)
      && canonicalJson(input.installation) === canonicalJson(line.installation), "StaleBeltAuthority");
    require(isSaveSafeResourceId(input.actorId), "InvalidBeltActor");
    require(input.tickStartUs === line.tickEndUs && integer(input.tickEndUs) - integer(input.tickStartUs) === 100_000n, "InvalidConfirmedBeltStep");
    const revision = safeBigIntNumber(BigInt(line.revision) + 1n, "BeltRevision");
    const requestBytes = inputBytes(input);
    let outcome: Extract<BeltStepProposal, { status: "Prepared" }>["outcome"] = "WAIT_POWER";
    let packet = line.packet, packetCursor = line.packetCursor, creditMg = line.creditMg;
    let materialPlan: MaterialPlan | null = null;
    if (powered(line, input)) {
      creditMg = Math.min(FACTORY_BELT_POLICY.maxCreditMg, creditMg + FACTORY_BELT_POLICY.creditMgPerStep);
      if (packet) {
        packet = { ...packet, positionMm: Math.min(line.installation.lengthMm, packet.positionMm + FACTORY_BELT_POLICY.movementMmPerStep) };
        outcome = "Moved";
        if (packet.positionMm === line.installation.lengthMm) {
          const lot = snapshot(input.material, line.installation.bandContainerId).state.contents[0];
          const intent: MaterialIntent = { kind: "transfer", transactionId: `${packet.packetId}_exit`, ownerId: line.installation.driveInstanceId,
            actorId: input.actorId, moves: [{ sourceContainerId: line.installation.bandContainerId, sourceStackId: packet.stackId,
              sourcePortId: line.installation.bandOutPortId, targetContainerId: line.installation.target.containerId,
              targetPortId: line.installation.target.nativePortId, targetStackId: packet.stackId, itemId: packet.itemId, quantityUnits: lot.quantity }] };
          const plan = prepareFactoryMaterialStep(input.material, intent);
          if (plan.status === "Prepared") { materialPlan = plan; packet = null; outcome = "Delivered"; }
          else if (capacityBlocked(plan.reason)) outcome = "WAIT_OUTPUT";
          else throw new Error(plan.reason);
        }
      } else if (input.sourceLot) {
        const source = snapshot(input.material, line.installation.source.containerId);
        const lot = source.state.contents.find((entry) => entry.stackId === input.sourceLot!.stackId);
        if (!lot) outcome = "WAIT_SOURCE";
        else {
          const item = findFactoryItem(input.material.catalog, input.sourceLot.itemId);
          require(lot.resourceId === item.resourceId, "BeltSourceItemMismatch");
          assertFactoryBeltItemPorts(line.installation, item.sourceId, input.material);
          assertProductionRef(lot, item.sourceId, input.material);
          const available = safeWhole(lot.quantity, "SourceQuantity");
          const quantity = input.sourceLot.quantityUnits === undefined
            ? Math.min(available, Math.floor(FACTORY_BELT_POLICY.maxPacketMassMg / item.massMgPerUnit))
            : safeWhole(input.sourceLot.quantityUnits, "BeltIntakeQuantity");
          require(quantity > 0, "BeltSourceUnitTooHeavy");
          require(quantity <= available, "InsufficientBeltSourceQuantity");
          const amount = validateFactoryAmount(item.sourceId, quantity, input.material.catalog);
          require(amount.massMg <= FACTORY_BELT_POLICY.maxPacketMassMg, "BeltIntakeTooHeavy");
          const definition = input.material.catalog.resources.resources.find((entry) => entry.resourceId === item.resourceId)!;
          require(quantity === lot.quantity || (definition.stackRule.splitAllowed && !lot.sealed), "UnsplittableBeltSourceLot");
          if (creditMg < amount.massMg) outcome = "WAIT_CREDIT";
          else {
            const cursor = safeBigIntNumber(BigInt(packetCursor) + 1n, "PacketCursor");
            const id = `${line.lineId}_packet_${cursor}`;
            require(!input.material.containers.some((entry) => entry.state.contents.some((stack) => stack.stackId === id)), "DuplicateBeltChildId");
            const intent: MaterialIntent = { kind: "transfer", transactionId: `${id}_enter`, ownerId: line.installation.driveInstanceId,
              actorId: input.actorId, moves: [{ sourceContainerId: source.state.containerId, sourceStackId: lot.stackId,
                sourcePortId: line.installation.source.nativePortId, targetContainerId: line.installation.bandContainerId,
                targetPortId: line.installation.bandInPortId, targetStackId: id, itemId: item.sourceId, quantityUnits: quantity }] };
            const plan = prepareFactoryMaterialStep(input.material, intent);
            if (plan.status === "Prepared") {
              const acceptedLot = snapshot(plan.candidate, line.installation.bandContainerId).state.contents;
              require(acceptedLot.length === 1 && acceptedLot[0].stackId === id && acceptedLot[0].quantity === quantity, "BeltNativeChildAdmissionMismatch");
              const receipt = plan.candidate.receipts.find((entry) => entry.transactionId === intent.transactionId)!;
              packet = { packetId: id, stackId: id, itemId: item.sourceId, itemVersion: item.version, itemDigest: item.digest,
                parentStackId: lot.stackId, injectionTransactionId: intent.transactionId, injectionReceiptCanonicalJson: canonicalJson(receipt),
                sourceRevisionAfterInjection: snapshot(plan.candidate, source.state.containerId).state.revision,
                targetRevisionAtInjection: snapshot(input.material, line.installation.target.containerId).state.revision, positionMm: 0 };
              materialPlan = plan; packetCursor = cursor; creditMg -= amount.massMg; outcome = "Injected";
            } else if (capacityBlocked(plan.reason)) outcome = "WAIT_OUTPUT";
            else throw new Error(plan.reason);
          }
        }
      } else outcome = "WAIT_SOURCE";
    }
    // Accrue -> one admission/debit OR existing-packet motion. Newly admitted packets remain at s=0.
    const nextLine: BeltState = { ...line, revision, tickEndUs: input.tickEndUs, creditMg, packetCursor, packet,
      lastStep: { tickEndUs: input.tickEndUs, requestDigest: canonicalSignature(requestBytes), outcome } };
    assertFactoryBeltState(nextLine, materialPlan?.candidate ?? input.material);
    return freeze({ status: "Prepared", baseLineCanonicalJson: canonicalJson(line), inputCanonicalJson: requestBytes, nextLine, materialPlan, outcome });
  } catch (error) { return { status: "Rejected", reason: error instanceof Error ? error.message : "InvalidBeltStep" }; }
}
/** Returns an atomic pair for the sole Host to adopt at its combined World CAS. */
export function commitFactoryBeltStep(line: BeltState, input: BeltStepInput, proposal: BeltStepProposal): BeltStepResult {
  const reject = (reason: string): BeltStepResult => ({ status: "Rejected", line, material: input.material, reason });
  if (proposal.status !== "Prepared") return reject(proposal.reason);
  try {
    // Replay only the exact already-adopted pair and the exact original non-material request.
    if (canonicalJson(line) === canonicalJson(proposal.nextLine)) {
      const prior = JSON.parse(proposal.inputCanonicalJson) as BeltStepInput;
      const expectedMaterial = proposal.materialPlan?.candidate ?? prior.material;
      if (canonicalJson(materialData(input.material)) !== canonicalJson(materialData(expectedMaterial))
        || inputBytes({ ...input, material: prior.material }) !== proposal.inputCanonicalJson) return reject("StaleBeltReplay");
      const oldLine = JSON.parse(proposal.baseLineCanonicalJson) as BeltState;
      const verified = advanceFactoryBelt(oldLine, prior);
      if (verified.status !== "Prepared" || proposalBytes(verified) !== proposalBytes(proposal)) return reject("InvalidBeltReplay");
      assertFactoryBeltState(line, input.material);
      return { status: "NoOp", line, material: input.material };
    }
    if (canonicalJson(line) !== proposal.baseLineCanonicalJson || inputBytes(input) !== proposal.inputCanonicalJson) return reject("StaleBeltStep");
    const verified = advanceFactoryBelt(line, input);
    if (verified.status !== "Prepared" || proposalBytes(verified) !== proposalBytes(proposal)) return reject("InvalidBeltProposal");
    if (verified.materialPlan) {
      const material = commitFactoryMaterialStep(input.material, verified.materialPlan);
      if (material.status !== "Committed") return reject(material.status === "Rejected" ? material.reason : "ReplayedMaterialWithoutBeltAdoption");
      return { status: "Committed", line: verified.nextLine, material: material.view };
    }
    return { status: "Committed", line: verified.nextLine, material: input.material };
  } catch (error) { return reject(error instanceof Error ? error.message : "InvalidBeltProposal"); }
}
