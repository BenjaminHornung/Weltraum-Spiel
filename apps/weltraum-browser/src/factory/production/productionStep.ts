import type { MaterialPlan, MaterialRecipeRef, MaterialView } from "../material/reservations";
import type { FactoryPowerBinding, FactoryPowerRequest, FactoryPowerSuccess } from "../power/factoryPower";
import type { ProductionHostFacts, ProductionInstallation, ProductionStart } from "./recipeAdmission";
import { admitFactoryRecipe, isImmutableProductionData, productionContainer, productionId, productionMaterialCanonicalJson, productionOutputs, productionRevision } from "./recipeAdmission";
import { commitFactoryMaterialStep, prepareFactoryMaterialStep } from "../material/reservations";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";

export type ProductionCommand = ProductionStart | Readonly<{
  kind: "manual-work" | "manual-finish"; commandId: string; jobId: string; actorId: string;
}>;
export type ProductionStatus = "IDLE" | "RUNNING" | "WAIT_INPUT" | "WAIT_POWER" | "WAIT_OUTPUT" | "WAIT_WASTE" | "FAULT" | "COMPLETED" | "LAID_OUT" | "ASSEMBLED";
export interface ProductionJob {
  readonly start: ProductionStart;
  readonly recipeRef: MaterialRecipeRef;
  readonly recipeCanonicalJson: string;
  readonly processCanonicalJson: string;
  readonly installationCanonicalJson: string;
  readonly reservationId: string;
  readonly beginReceiptCanonicalJson: string;
  readonly workMilliJoule: string;
  readonly phase: "RUNNING" | "LAID_OUT" | "ASSEMBLED" | "COMPLETED";
  readonly manualWorkReceiptId: string | null;
  readonly completionReceiptId: string | null;
}
export interface ProductionCommandReceipt {
  readonly commandId: string; readonly jobId: string; readonly commandCanonicalJson: string;
  readonly tickEndUs: string; readonly kind: ProductionCommand["kind"] | "electric-finish";
  readonly materialTransactionId: string | null;
}
export interface ProductionInputBinding {
  readonly authorityCanonicalJson: string;
  readonly materialCanonicalJson: string;
}
export interface ProductionAdoptedPayload {
  readonly proposalCanonicalJson: string;
  readonly inputBinding: ProductionInputBinding;
  readonly nextStateCoreCanonicalJson: string;
  readonly materialCanonicalJson: string;
  readonly materialPlansCanonicalJson: string;
}
export interface ProductionReplayReceipt {
  readonly inputBinding: ProductionInputBinding;
  readonly resultCoreCanonicalJson: string;
  readonly adoptedPayload: ProductionAdoptedPayload;
}
export interface ProductionState {
  readonly version: "fp06-production-state-v1";
  readonly machineInstanceId: string;
  readonly binding: FactoryPowerBinding;
  readonly revision: number;
  readonly tickEndUs: string;
  readonly status: ProductionStatus;
  readonly job: ProductionJob | null;
  readonly commandReceipts: readonly ProductionCommandReceipt[];
  readonly lastStep: ProductionReplayReceipt | null;
}
export interface ProductionStepInput {
  readonly confirmed: boolean; readonly binding: FactoryPowerBinding;
  readonly tickStartUs: string; readonly tickEndUs: string;
  readonly material: MaterialView; readonly facts: ProductionHostFacts;
  readonly power: FactoryPowerSuccess | null;
  readonly command?: ProductionCommand;
}
export type ProductionProposal = Readonly<{
  status: "Prepared"; baseStateCanonicalJson: string; inputBinding: ProductionInputBinding;
  nextState: ProductionState; material: MaterialView; materialPlans: readonly MaterialPlan[];
  workMilliJoule: string;
}> | Readonly<{ status: "Rejected"; reason: string }>;
export type ProductionCommit = Readonly<{
  status: "Committed" | "NoOp"; state: ProductionState; material: MaterialView;
}> | Readonly<{ status: "Rejected"; reason: string; state: ProductionState; material: MaterialView }>;

export const FACTORY_PRODUCTION_POLICY = Object.freeze({ version: "fp06-constant-cold-process-v1", intervalUs: "100000",
  manualSequence: "manual-brace-sequence-v1", receiptRepresentation: "closed-canonical-segments-v1",
  sourceRefs: ["FP02:5", "FP02:7:B05", "FP02:7:B06", "FP02:7:B07", "FP02:12", "FP01:6"] });
const integer = (value: string): bigint => {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > 9_223_372_036_854_775_807n) throw Error("InvalidProductionInteger");
  return BigInt(value);
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
};
const checkedInputBindings = new WeakSet<ProductionInputBinding>();
const checkedPayloads = new WeakSet<ProductionAdoptedPayload>();
const exactKeys = (value: object, expected: readonly string[]): void => {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length || keys.some(k => typeof k !== "string" || !expected.includes(k))) throw Error("ProductionReceiptKeysMismatch");
};
const validateCanonicalBytes = (bytes: string): void => {
  if (typeof bytes !== "string" || canonicalJson(JSON.parse(bytes)) !== bytes) throw Error("ProductionReceiptBytesMismatch");
};
const validateInputBinding = (binding: ProductionInputBinding): void => {
  if (checkedInputBindings.has(binding)) return;
  exactKeys(binding, ["authorityCanonicalJson", "materialCanonicalJson"]);
  validateCanonicalBytes(binding.authorityCanonicalJson); validateCanonicalBytes(binding.materialCanonicalJson);
  if (isImmutableProductionData(binding)) checkedInputBindings.add(binding);
};
const inputBytes = (input: ProductionStepInput): ProductionInputBinding => {
  const { material, ...current } = input;
  const binding = freeze({ authorityCanonicalJson: canonicalJson(current), materialCanonicalJson: productionMaterialCanonicalJson(material) });
  // These two complete strings just came from the canonical serializer and
  // validated native snapshots. Re-parsing our own immutable output adds no
  // admission evidence. External records take validateInputBinding instead.
  if (isImmutableProductionData(binding)) checkedInputBindings.add(binding); return binding;
};
const sameInputBinding = (a: ProductionInputBinding, b: ProductionInputBinding): boolean => {
  validateInputBinding(a); validateInputBinding(b);
  return a.authorityCanonicalJson === b.authorityCanonicalJson && a.materialCanonicalJson === b.materialCanonicalJson;
};
const validatePayload = (payload: ProductionAdoptedPayload): void => {
  if (checkedPayloads.has(payload)) return;
  exactKeys(payload, ["proposalCanonicalJson", "inputBinding", "nextStateCoreCanonicalJson", "materialCanonicalJson", "materialPlansCanonicalJson"]);
  validateInputBinding(payload.inputBinding);
  for (const bytes of [payload.proposalCanonicalJson, payload.nextStateCoreCanonicalJson, payload.materialCanonicalJson, payload.materialPlansCanonicalJson]) validateCanonicalBytes(bytes);
  if (isImmutableProductionData(payload)) checkedPayloads.add(payload);
};
const samePayload = (a: ProductionAdoptedPayload, b: ProductionAdoptedPayload): boolean => {
  validatePayload(a); validatePayload(b);
  return a.proposalCanonicalJson === b.proposalCanonicalJson && sameInputBinding(a.inputBinding, b.inputBinding)
    && a.nextStateCoreCanonicalJson === b.nextStateCoreCanonicalJson && a.materialCanonicalJson === b.materialCanonicalJson
    && a.materialPlansCanonicalJson === b.materialPlansCanonicalJson;
};
const sameReplay = (a: ProductionReplayReceipt | null, b: ProductionReplayReceipt | null): boolean => {
  if (!a || !b) return a === b;
  exactKeys(a, ["inputBinding", "resultCoreCanonicalJson", "adoptedPayload"]); exactKeys(b, ["inputBinding", "resultCoreCanonicalJson", "adoptedPayload"]);
  return a.resultCoreCanonicalJson === b.resultCoreCanonicalJson && sameInputBinding(a.inputBinding, b.inputBinding) && samePayload(a.adoptedPayload, b.adoptedPayload);
};
const stateCore = (state: ProductionState) => { const { lastStep: _lastStep, ...core } = state; return canonicalJson(core); };
const bindingCore = (binding: FactoryPowerBinding) => canonicalJson({ sessionId: binding.sessionId, epoch: binding.epoch,
  catalogDigest: binding.catalogDigest, sourceProfileDigest: binding.sourceProfileDigest });
const reason = (error: unknown) => error instanceof Error ? error.message : "ProductionRejected";
const waiting = (value: string): value is "WAIT_INPUT" | "WAIT_OUTPUT" | "WAIT_WASTE" => ["WAIT_INPUT", "WAIT_OUTPUT", "WAIT_WASTE"].includes(value);
const commandReceipt = (input: ProductionStepInput, command: ProductionCommand, materialTransactionId: string | null): ProductionCommandReceipt => ({
  commandId: command.commandId, jobId: command.jobId, commandCanonicalJson: canonicalJson(command), tickEndUs: input.tickEndUs, kind: command.kind, materialTransactionId
});
const checkedStates = new WeakSet<ProductionState>();
const issuedDryRuntimeProductionProposals = new WeakMap<ProductionState, WeakMap<ProductionStepInput,
  WeakMap<Extract<ProductionProposal, { status: "Prepared" }>, ProductionState>>>();
const strictRuntimeProductionData = (value: unknown, parents = new WeakSet<object>()): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || !Object.isFrozen(value) || parents.has(value)) return false;
  const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string")) return false;
  if (array && (keys.length !== value.length + 1 || keys.some(key => key !== "length"
    && (!/^(0|[1-9][0-9]*)$/.test(key as string) || Number(key) >= value.length)))) return false;
  if (keys.some(key => !(array && key === "length") && !descriptors[key as string]!.enumerable)
    || !Object.values(descriptors).every(descriptor => "value" in descriptor)) return false;
  parents.add(value);
  const valid = Object.values(descriptors).every(descriptor => strictRuntimeProductionData(descriptor.value, parents));
  parents.delete(value);
  return valid;
};
const hasStrictRuntimeProductionInput = (input: ProductionStepInput): boolean => {
  try {
    if (!input || typeof input !== "object" || !Object.isFrozen(input) || Object.getPrototypeOf(input) !== Object.prototype
      || typeof globalThis.structuredClone !== "function") return false;
    const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
    const expected = ["binding", "confirmed", "facts", "material", "power", "tickEndUs", "tickStartUs"];
    if (Object.hasOwn(descriptors, "command")) expected.push("command");
    if (keys.length !== expected.length || keys.some(key => typeof key !== "string" || !expected.includes(key))) return false;
    for (const key of expected) {
      const descriptor = descriptors[key]!;
      if (!("value" in descriptor) || descriptor.enumerable !== (key !== "material")) return false;
      if (key !== "material" && !strictRuntimeProductionData(descriptor.value)) return false;
    }
    // Dry hides the already-admitted MaterialView from this standard clone so
    // cloneability proves the exact non-material input without copying inventory.
    globalThis.structuredClone(input);
    return true;
  } catch { return false; }
};
const hasStrictCloneableRuntimeCore = (core: ProductionState): boolean => {
  if (core.lastStep !== null || typeof globalThis.structuredClone !== "function") return false;
  try { return strictRuntimeProductionData(core) && (globalThis.structuredClone(core), true); }
  catch { return false; }
};
export const isIssuedDryRuntimeProductionProposal = (state: ProductionState, input: ProductionStepInput, proposal: ProductionProposal): boolean => {
  if (proposal.status !== "Prepared") return false;
  const issued = issuedDryRuntimeProductionProposals.get(state)?.get(input)?.get(proposal);
  return issued !== undefined && issued === proposal.nextState;
};
const validateState = (state: ProductionState): void => {
  if (checkedStates.has(state)) return;
  if (state.version !== "fp06-production-state-v1") throw Error("ProductionStateVersionMismatch");
  if (!["IDLE", "RUNNING", "WAIT_INPUT", "WAIT_POWER", "WAIT_OUTPUT", "WAIT_WASTE", "FAULT", "COMPLETED", "LAID_OUT", "ASSEMBLED"].includes(state.status)) throw Error("ProductionStatusMismatch");
  productionId(state.machineInstanceId); productionRevision(state.revision);
  if (integer(state.tickEndUs) % 100_000n !== 0n) throw Error("ProductionClockMismatch");
  productionId(state.binding.sessionId); productionRevision(state.binding.epoch); productionRevision(state.binding.netRevision);
  const ids = new Set<string>();
  for (const receipt of state.commandReceipts) {
    productionId(receipt.commandId); productionId(receipt.jobId);
    const command = JSON.parse(receipt.commandCanonicalJson);
    if (ids.has(receipt.commandId) || canonicalJson(JSON.parse(receipt.commandCanonicalJson)) !== receipt.commandCanonicalJson
      || integer(receipt.tickEndUs) > integer(state.tickEndUs) || integer(receipt.tickEndUs) % 100_000n !== 0n
      || command.jobId !== receipt.jobId || command.kind !== receipt.kind
      || (receipt.kind !== "electric-finish" && command.commandId !== receipt.commandId)) throw Error("ProductionReceiptMismatch");
    ids.add(receipt.commandId);
  }
  if (state.job) {
    integer(state.job.workMilliJoule); productionId(state.job.reservationId);
    if (!["RUNNING", "LAID_OUT", "ASSEMBLED", "COMPLETED"].includes(state.job.phase)
      || (state.job.start.processKind === "manual" && (state.job.workMilliJoule !== "0" || state.job.phase === "RUNNING"))
      || (state.job.start.processKind === "electric" && (state.job.phase === "LAID_OUT" || state.job.phase === "ASSEMBLED" || state.job.manualWorkReceiptId !== null))) throw Error("ProductionPhaseMismatch");
    if (canonicalJson(state.job.recipeRef) !== canonicalJson(state.job.start.recipeRef)
      || !state.commandReceipts.some(r => r.commandId === state.job!.start.commandId && r.commandCanonicalJson === canonicalJson(state.job!.start))) throw Error("ProductionJobBindingMismatch");
    if (state.job.phase === "ASSEMBLED" && !state.commandReceipts.some(r => r.kind === "manual-work" && r.commandId === state.job!.manualWorkReceiptId && r.jobId === state.job!.start.jobId)) throw Error("ProductionManualReceiptMissing");
    if (state.job.phase === "COMPLETED" && !state.commandReceipts.some(r => r.commandId === state.job!.completionReceiptId && r.jobId === state.job!.start.jobId)) throw Error("ProductionCompletionReceiptMissing");
  }
  if (state.lastStep) {
    exactKeys(state.lastStep, ["inputBinding", "resultCoreCanonicalJson", "adoptedPayload"]);
    const payload = state.lastStep.adoptedPayload, core = stateCore(state); validatePayload(payload);
    if (state.lastStep.resultCoreCanonicalJson !== core || payload.nextStateCoreCanonicalJson !== core
      || !sameInputBinding(payload.inputBinding, state.lastStep.inputBinding)) throw Error("ProductionReplayReceiptMismatch");
  }
  if (isImmutableProductionData(state)) checkedStates.add(state);
};
const validateInterval = (state: ProductionState, input: Omit<ProductionStepInput, "power">): void => {
  validateState(state);
  if (input.confirmed !== true || input.facts.confirmed !== true || bindingCore(input.binding) !== bindingCore(state.binding)
    || input.binding.netRevision < state.binding.netRevision || canonicalJson(input.facts.binding) !== canonicalJson(input.binding)
    || input.facts.installation.instanceId !== state.machineInstanceId || input.facts.tickEndUs !== input.tickEndUs
    || input.binding.catalogDigest !== input.material.catalog.catalogDigest) throw Error("ProductionHostBindingMismatch");
  productionRevision(input.binding.netRevision);
  const start = integer(input.tickStartUs), end = integer(input.tickEndUs);
  if (start !== integer(state.tickEndUs) || end - start !== 100_000n) throw Error("ProductionClockMismatch");
};
const validateJobMaterial = (job: ProductionJob, view: MaterialView, machine: Pick<ProductionInstallation, "outputContainerId" | "offcutContainerId" | "wipContainerId">): void => {
  const reservation = view.reservations.find(r => r.reservationId === job.reservationId);
  const recipe = view.catalog.recipes.find(r => r.sourceId === job.recipeRef.sourceId)!;
  if (!reservation || reservation.ownerId !== job.start.ownerId || reservation.wipContainerId !== machine.wipContainerId
    || canonicalJson(reservation.recipeRef) !== canonicalJson(job.recipeRef) || reservation.recipeCanonicalJson !== job.recipeCanonicalJson
    || canonicalJson(reservation.outputs) !== canonicalJson(recipe.outputs.map((term, i) => ({
      ...term,
      targetContainerId: term.itemId === "fp02.bulk.steel_offcut" ? machine.offcutContainerId : machine.outputContainerId,
      stackId: `${job.start.jobId}_output_${i}`
    })))
    || !view.receipts.some(r => canonicalJson(r) === job.beginReceiptCanonicalJson)) throw Error("ProductionWipBindingMismatch");
  const wip = productionContainer(view, machine.wipContainerId);
  const actual = wip.state.contents.map(s => ({ itemId: view.catalog.items.find(i => i.resourceId === s.resourceId)!.sourceId, quantityUnits: s.quantity }));
  const sorted = (terms: typeof actual) => canonicalJson([...terms].sort((a, b) => a.itemId < b.itemId ? -1 : 1));
  if (sorted(actual) !== sorted([...recipe.inputs]) || wip.state.contents.some((s, i) => s.stackId !== `${job.start.jobId}_input_${i}`)) throw Error("ProductionWipBindingMismatch");
};
const selectedStart = (state: ProductionState, input: Omit<ProductionStepInput, "power">): ProductionStart | null => {
  if (input.command?.kind === "start") {
    const receipt = state.commandReceipts.find(r => r.commandId === input.command!.commandId);
    if (receipt) { if (receipt.commandCanonicalJson !== canonicalJson(input.command)) throw Error("ProductionIdempotencyConflict"); return null; }
    if (state.job && state.job.phase !== "COMPLETED") throw Error("ProductionJobOccupied");
    if (state.commandReceipts.some(r => r.jobId === input.command!.jobId)) throw Error("ProductionJobIdReused");
    if (state.job && input.command.batchOrdinal !== state.job.start.batchOrdinal + 1) throw Error("ProductionBatchOrdinalMismatch");
    return input.command;
  }
  return state.job?.phase !== "COMPLETED" ? state.job?.start ?? null : null;
};
/** Host calls this before W03 so blocked machines request zero power. Admission
 * does not reserve material, produce work, or mutate the electrical authority. */
export const readFactoryProductionRequest = (state: ProductionState, input: Omit<ProductionStepInput, "power">): FactoryPowerRequest => {
  let watts = 0, enabled = false;
  try {
    validateInterval(state, input);
    const start = selectedStart(state, input);
    if (start) {
      const admission = admitFactoryRecipe(input.material, input.facts, start, state.job?.phase !== "COMPLETED" && !!state.job);
      if (admission.ok && admission.process.kind === "electric") {
        watts = admission.process.powerWatts;
        enabled = !state.job || state.job.phase === "COMPLETED" || integer(state.job.workMilliJoule) < BigInt(admission.process.workJ) * 1_000n;
      }
    }
  } catch { /* Host request is disabled; the production evaluator supplies the rejection. */ }
  return { consumerId: input.facts.installation.powerConsumerId, deviceInstanceId: state.machineInstanceId,
    jobId: input.command?.jobId ?? state.job?.start.jobId ?? "idle_job", portId: input.facts.installation.powerPortId,
    priority: "P2", requiredMilliWatt: String(watts * 1_000), enabled };
};
const allocatedWork = (state: ProductionState, input: ProductionStepInput): bigint => {
  const demand = readFactoryProductionRequest(state, input), power = input.power;
  if (!power) { if (demand.enabled) throw Error("ProductionPowerReceiptMissing"); return 0n; }
  const { canonicalJson: bytes, digest, ...body } = power;
  if (canonicalJson(body) !== bytes || canonicalSignature(body) !== digest || canonicalJson(power.binding) !== canonicalJson(input.binding)
    || power.tickStartUs !== input.tickStartUs || power.tickEndUs !== input.tickEndUs || power.nextState.tickEndUs !== input.tickEndUs
    || canonicalJson(power.nextState.binding) !== canonicalJson(input.binding)) throw Error("ProductionPowerReceiptMismatch");
  const grants = power.grants.filter(g => g.consumerId === demand.consumerId);
  // A manual bench has no electrical In-port. The shared allocator may omit
  // any disabled consumer; its complete current receipt still binds this step.
  if (grants.length === 0 && !demand.enabled) return 0n;
  if (grants.length !== 1) throw Error("ProductionPowerGrantMissing");
  const grant = grants[0]!;
  if (grant.deviceInstanceId !== state.machineInstanceId || grant.jobId !== demand.jobId || grant.portId !== demand.portId
    || grant.requiredMilliWatt !== (demand.enabled ? demand.requiredMilliWatt : "0")) throw Error("ProductionPowerGrantMismatch");
  const allocated = integer(grant.allocatedMilliWatt), n = integer(grant.work.n), d = integer(grant.work.d);
  if (d === 0n || n * 1_000_000n !== allocated * 100_000n * d || (allocated !== 0n && (!demand.enabled || grant.status !== "Powered" || allocated !== integer(demand.requiredMilliWatt)))
    || (allocated === 0n && grant.status === "Powered") || n % d !== 0n) throw Error("ProductionPowerWorkMismatch");
  return n / d;
};
export const createFactoryProductionState = (machineInstanceId: string, binding: FactoryPowerBinding, tickEndUs = "0"): ProductionState => {
  const state: ProductionState = { version: "fp06-production-state-v1", machineInstanceId, binding, revision: 0, tickEndUs,
    status: "IDLE", job: null, commandReceipts: [], lastStep: null };
  validateState(state); return freeze(state);
};

/** Validates persisted production history and its current reservation/WIP custody without advancing a tick. */
export const validateFactoryProductionCheckpointState = (
  state: ProductionState,
  material: MaterialView,
  installation: Pick<ProductionInstallation, "instanceId" | "outputContainerId" | "offcutContainerId" | "wipContainerId">
): void => {
  validateState(state);
  if (state.machineInstanceId !== installation.instanceId) throw Error("ProductionCheckpointMachineMismatch");
  const job = state.job;
  if (!job) return;
  const recipe = material.catalog.recipes.find(r => r.sourceId === job.recipeRef.sourceId);
  const process = recipe?.processes.find(p => p.kind === job.start.processKind);
  if (!recipe || recipe.version !== job.recipeRef.version || recipe.digest !== job.recipeRef.digest
    || !process || job.recipeCanonicalJson !== canonicalJson(recipe) || job.processCanonicalJson !== canonicalJson(process)
    || job.installationCanonicalJson.length === 0 || canonicalJson(JSON.parse(job.installationCanonicalJson)) !== job.installationCanonicalJson) {
    throw Error("ProductionCheckpointDefinitionMismatch");
  }
  for (const receipt of state.commandReceipts) {
    if (receipt.materialTransactionId !== null && !material.receipts.some(r => r.transactionId === receipt.materialTransactionId)) {
      throw Error("ProductionCheckpointMaterialReceiptMissing");
    }
  }
  const wip = productionContainer(material, installation.wipContainerId);
  if (job.phase === "COMPLETED") {
    if (material.reservations.some(r => r.reservationId === job.reservationId) || wip.state.contents.length !== 0) {
      throw Error("ProductionCheckpointCompletedWipPresent");
    }
  } else {
    validateJobMaterial(job, material, installation);
  }
};
/** Pure proposed pair. Only the common Host may atomically adopt Material,
 * Production and the actual W03 interval receipt at its World CAS boundary. */
const stepFactoryProductionCore = (state: ProductionState, input: ProductionStepInput, dryRuntime: boolean): ProductionProposal => {
  try {
    validateInterval(state, input);
    // lastStep is a derived replay record, excluded from the complete authority
    // core so adopting the next record does not recursively embed all history.
    const initialInputBytes = inputBytes(input), baseStateCanonicalJson = stateCore(state);
    const selected = selectedStart(state, input);
    let command = input.command;
    if (command && command.kind !== "start") {
      productionId(command.commandId);
      const commandId = command.commandId;
      const old = state.commandReceipts.find(r => r.commandId === commandId);
      if (old && old.commandCanonicalJson !== canonicalJson(command)) throw Error("ProductionIdempotencyConflict");
      if (old) command = undefined;
      else if (!state.job || command.jobId !== state.job.start.jobId || command.actorId !== state.job.start.actorId || state.job.start.processKind !== "manual") throw Error("ProductionManualCommandMismatch");
    }
    let material = input.material, job = state.job, status = state.status;
    let commandReceipts = [...state.commandReceipts], work = 0n;
    const materialPlans: MaterialPlan[] = [];
    const adoptMaterial = (plan: MaterialPlan): void => {
      const committed = commitFactoryMaterialStep(material, plan);
      if (committed.status !== "Committed") throw Error(committed.status === "Rejected" ? committed.reason : "ProductionHistoricalMaterialReceipt");
      materialPlans.push(plan); material = committed.view;
    };
    const passiveManual = !!job && job.start.processKind === "manual" && job.phase !== "COMPLETED" && !command;
    let admission = selected && !passiveManual ? admitFactoryRecipe(material, input.facts, selected, !!job && job.phase !== "COMPLETED") : null;
    if (admission && !admission.ok && !waiting(admission.reason)) throw Error(admission.reason);
    const actualWork = allocatedWork(state, input);
    // Walking away is not a failed world clock and cannot perform montage.
    // Existing native WIP/recipe bindings remain checked; fresh interaction,
    // service and tool admission is required on each active manual command.
    if (passiveManual) { validateJobMaterial(job!, input.material, input.facts.installation); if (actualWork !== 0n) throw Error("ProductionManualPowerMismatch"); }
    if (admission && !admission.ok) status = admission.reason as ProductionStatus;
    else if (selected && admission?.ok) {
      if (job && job.phase !== "COMPLETED") {
        if (job.installationCanonicalJson !== canonicalJson(input.facts.installation) || job.recipeCanonicalJson !== canonicalJson(admission.recipe)
          || job.processCanonicalJson !== canonicalJson(admission.process)) throw Error("ProductionActiveBindingMismatch");
        validateJobMaterial(job, input.material, input.facts.installation);
      } else if (admission.process.kind === "electric" && actualWork === 0n) status = "WAIT_POWER";
      else {
        const reserveId = `${selected.jobId}_reserve`, outputs = productionOutputs(input.facts, selected, admission.recipe);
        const plan = prepareFactoryMaterialStep(material, { kind: "reserve", transactionId: reserveId, ownerId: selected.ownerId, actorId: selected.actorId,
          ...(selected.missionId === undefined ? {} : { missionId: selected.missionId }), reservationId: `${selected.jobId}_reservation`, wipContainerId: input.facts.installation.wipContainerId,
          recipeRef: selected.recipeRef, moves: admission.recipe.inputs.map((term, i) => {
            const source = selected.sourceLots.find(s => s.itemId === term.itemId)!;
            return { ...term, sourceContainerId: source.containerId, sourceStackId: source.stackId, targetContainerId: input.facts.installation.wipContainerId, targetStackId: `${selected.jobId}_input_${i}` };
          }), outputs });
        if (plan.status !== "Prepared") throw Error(plan.reason);
        adoptMaterial(plan);
        job = { start: selected, recipeRef: selected.recipeRef, recipeCanonicalJson: canonicalJson(admission.recipe), processCanonicalJson: canonicalJson(admission.process),
          installationCanonicalJson: canonicalJson(input.facts.installation), reservationId: `${selected.jobId}_reservation`, beginReceiptCanonicalJson: canonicalJson(material.receipts.at(-1)),
          workMilliJoule: "0", phase: admission.process.kind === "manual" ? "LAID_OUT" : "RUNNING", manualWorkReceiptId: null, completionReceiptId: null };
        commandReceipts.push(commandReceipt(input, selected, reserveId));
      }
      if (job && job.phase !== "COMPLETED") {
        if (admission.process.kind === "electric") {
          const target = BigInt(admission.process.workJ) * 1_000n;
          const before = integer(job.workMilliJoule);
          if (before > target || before + actualWork > target) throw Error("ProductionWorkOversupply");
          work = actualWork; job = { ...job, workMilliJoule: String(before + work) }; status = work > 0n ? "RUNNING" : "WAIT_POWER";
        } else {
          const old = command && commandReceipts.find(r => r.commandId === command.commandId);
          if (command?.kind === "manual-work" && !old) {
            if (job.phase !== "LAID_OUT") throw Error("ProductionManualPhaseMismatch");
            job = { ...job, phase: "ASSEMBLED", manualWorkReceiptId: command.commandId };
            commandReceipts.push(commandReceipt(input, command, null));
          }
          if (command?.kind === "manual-finish" && !old && job.phase !== "ASSEMBLED") throw Error("ProductionManualPhaseMismatch");
          status = job.phase === "ASSEMBLED" ? "ASSEMBLED" : "LAID_OUT";
        }
        const complete = admission.process.kind === "electric" ? integer(job.workMilliJoule) === BigInt(admission.process.workJ) * 1_000n
          : command?.kind === "manual-finish" && job.phase === "ASSEMBLED";
        if (complete) {
          const finishId = `${job.start.jobId}_finish`;
          const plan = prepareFactoryMaterialStep(material, { kind: "finish-recipe", transactionId: finishId, ownerId: job.start.ownerId, actorId: job.start.actorId,
            ...(job.start.missionId === undefined ? {} : { missionId: job.start.missionId }), reservationId: job.reservationId });
          if (plan.status !== "Prepared") { status = "WAIT_OUTPUT"; }
          else {
            adoptMaterial(plan);
            const completionId = admission.process.kind === "manual" ? command!.commandId : finishId;
            const completion: ProductionCommandReceipt = admission.process.kind === "manual" ? commandReceipt(input, command!, finishId)
              : { commandId: completionId, jobId: job.start.jobId, commandCanonicalJson: canonicalJson({ kind: "electric-finish", jobId: job.start.jobId, recipeRef: job.recipeRef,
                reservationId: job.reservationId, workMilliJoule: job.workMilliJoule }), tickEndUs: input.tickEndUs, kind: "electric-finish", materialTransactionId: finishId };
            commandReceipts.push(completion); job = { ...job, phase: "COMPLETED", completionReceiptId: completionId }; status = "COMPLETED";
          }
        }
      }
    }
    const core: ProductionState = { ...state, binding: input.binding, revision: state.revision + 1, tickEndUs: input.tickEndUs, status, job, commandReceipts, lastStep: null };
    productionRevision(core.revision);
    const materialDescriptor = dryRuntime ? Object.getOwnPropertyDescriptor(input, "material") : undefined;
    const runtimeCandidate = dryRuntime && materialPlans.length === 0 && !!materialDescriptor
      && "value" in materialDescriptor && material === materialDescriptor.value;
    const prepared = { status: "Prepared" as const, baseStateCanonicalJson, inputBinding: initialInputBytes, nextState: core, material, materialPlans, workMilliJoule: String(work) };
    const payload = proposalBytes(prepared);
    const nextState = freeze({ ...core, lastStep: { inputBinding: initialInputBytes, resultCoreCanonicalJson: stateCore(core), adoptedPayload: payload } });
    validateState(nextState);
    const result = freeze({ ...prepared, nextState });
    if (runtimeCandidate) Object.freeze(core);
    if (runtimeCandidate && hasStrictCloneableRuntimeCore(core)) {
      let byInput = issuedDryRuntimeProductionProposals.get(state);
      if (!byInput) { byInput = new WeakMap<ProductionStepInput, WeakMap<Extract<ProductionProposal, { status: "Prepared" }>, ProductionState>>();
        issuedDryRuntimeProductionProposals.set(state, byInput); }
      let byProposal = byInput.get(input);
      if (!byProposal) { byProposal = new WeakMap<Extract<ProductionProposal, { status: "Prepared" }>, ProductionState>(); byInput.set(input, byProposal); }
      byProposal.set(result, nextState);
    } else if (isImmutableProductionData(result)) checkedProposals.set(result, payload);
    return result;
  } catch (error) { return { status: "Rejected", reason: reason(error) }; }
};
export const stepFactoryProduction = (state: ProductionState, input: ProductionStepInput): ProductionProposal =>
  stepFactoryProductionCore(state, input, false);
/** Private compact-Dry entry; the public producer keeps its original full-data proof path. */
export const stepFactoryProductionForDryRuntime = (state: ProductionState, input: ProductionStepInput): ProductionProposal =>
  stepFactoryProductionCore(state, input, hasStrictRuntimeProductionInput(input));
const checkedProposals = new WeakMap<Extract<ProductionProposal, { status: "Prepared" }>, ProductionAdoptedPayload>();
const proposalBytes = (proposal: Extract<ProductionProposal, { status: "Prepared" }>): ProductionAdoptedPayload => {
  const cached = checkedProposals.get(proposal); if (cached) return cached;
  const { inputBinding, nextState, material, materialPlans, ...current } = proposal;
  validateInputBinding(inputBinding);
  const payload = freeze({ proposalCanonicalJson: canonicalJson(current), inputBinding, nextStateCoreCanonicalJson: stateCore(nextState),
    materialCanonicalJson: productionMaterialCanonicalJson(material),
    materialPlansCanonicalJson: canonicalJson(materialPlans.map(plan => { const { candidate, ...planData } = plan;
      return { ...planData, candidateCanonicalJson: productionMaterialCanonicalJson(candidate) }; })) });
  if (isImmutableProductionData(payload)) checkedPayloads.add(payload); return payload;
};
export const commitFactoryProductionStep = (state: ProductionState, input: ProductionStepInput, proposal: ProductionProposal): ProductionCommit => {
  try {
    if (proposal.status !== "Prepared") throw Error(proposal.reason);
    validateState(state);
    if (state.lastStep && sameInputBinding(state.lastStep.inputBinding, proposal.inputBinding)
      && stateCore(state) === stateCore(proposal.nextState) && sameReplay(state.lastStep, proposal.nextState.lastStep)) {
      const original = JSON.parse(state.lastStep.inputBinding.authorityCanonicalJson);
      const { material: _currentMaterial, ...current } = input;
      if (canonicalJson(original) !== canonicalJson(current) || !samePayload(proposalBytes(proposal), state.lastStep.adoptedPayload)) throw Error("ProductionReplayMismatch");
      if (productionMaterialCanonicalJson(input.material) !== productionMaterialCanonicalJson(proposal.material)) throw Error("ProductionReplayMaterialMismatch");
      return { status: "NoOp", state, material: input.material };
    }
    if (stateCore(state) !== proposal.baseStateCanonicalJson || !sameInputBinding(inputBytes(input), proposal.inputBinding)) throw Error("StaleProductionProposal");
    const verified = stepFactoryProduction(state, input);
    if (verified.status !== "Prepared") throw Error(verified.reason);
    if (!samePayload(proposalBytes(verified), proposalBytes(proposal))
      || !sameReplay(verified.nextState.lastStep, proposal.nextState.lastStep)) throw Error("ForgedProductionProposal");
    return { status: "Committed", state: verified.nextState, material: verified.material };
  } catch (error) { return { status: "Rejected", state, material: input.material, reason: reason(error) }; }
};
