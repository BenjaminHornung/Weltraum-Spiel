import type { FactoryCatalog, FactoryRecipe } from "../contracts";
import type { ResourceContainerSnapshot } from "../../resources/containers";
import { isSaveSafeResourceId } from "../../resources/ids";
import { canonicalJson } from "../../resources/serialization";
import { transferResource } from "../../resources/transfer";
import { createResourceStack, type ResourceStack } from "../../resources/types";
import { FactoryMaterialError, rejectMaterial, safeWhole, validateFactoryAmount } from "./quantity";
import { assertExactContainerCapacity, assertMaterialSnapshots, readMaterialMassMg, replaceMaterialContents } from "./resourcesAdapter";

export interface MaterialMove {
  readonly sourceContainerId: string;
  readonly sourceStackId: string;
  readonly targetContainerId: string;
  readonly targetStackId: string;
  readonly itemId: string;
  readonly quantityUnits: number;
  readonly sourcePortId?: string;
  readonly targetPortId?: string;
}
export interface MaterialOutput {
  readonly itemId: string;
  readonly quantityUnits: number;
  readonly targetContainerId: string;
  readonly stackId: string;
}
export interface MaterialRecipeRef { readonly sourceId: string; readonly version: number; readonly digest: string; }
interface MaterialCommand { readonly transactionId: string; readonly ownerId: string; readonly actorId?: string; readonly missionId?: string; }
export type MaterialIntent = MaterialCommand & (
  | Readonly<{ kind: "transfer"; moves: readonly MaterialMove[] }>
  | Readonly<{ kind: "split"; sourceContainerId: string; sourceStackId: string; children: readonly Readonly<{ targetContainerId: string; stackId: string; quantityUnits: number }>[] }>
  | Readonly<{ kind: "reserve"; reservationId: string; wipContainerId: string; recipeRef?: MaterialRecipeRef; moves: readonly MaterialMove[]; outputs: readonly MaterialOutput[] }>
  | Readonly<{ kind: "finish-recipe"; reservationId: string }>
  | Readonly<{ kind: "release"; reservationId: string }>
);
export interface MaterialReservation {
  readonly reservationId: string;
  readonly ownerId: string;
  readonly wipContainerId: string;
  readonly recipeRef: MaterialRecipeRef | null;
  readonly recipeCanonicalJson: string | null;
  readonly outputs: readonly MaterialOutput[];
}
export interface MaterialReceipt {
  readonly transactionId: string;
  readonly ownerId: string;
  readonly requestCanonicalJson: string;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
}
/** Host-owned facts. Every material quantity resides only in containers[].state.contents. */
export interface MaterialView {
  readonly catalog: FactoryCatalog;
  readonly revision: number;
  readonly containers: readonly ResourceContainerSnapshot[];
  readonly reservations: readonly MaterialReservation[];
  readonly receipts: readonly MaterialReceipt[];
}
export interface MaterialPlan {
  readonly status: "Prepared";
  readonly intent: MaterialIntent;
  readonly requestCanonicalJson: string;
  readonly baseCanonicalJson: string;
  readonly candidate: MaterialView;
}
export interface MaterialRejection { readonly status: "Rejected"; readonly reason: string; }
export type MaterialStepResult = Readonly<{ status: "Committed" | "NoOp"; view: MaterialView; receipt: MaterialReceipt }>
  | Readonly<{ status: "Rejected"; view: MaterialView; reason: string }>;

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const identity = (value: string): string => isSaveSafeResourceId(value) ? value : rejectMaterial("InvalidMaterialId");
const binding = (view: MaterialView): string => canonicalJson({ catalog: view.catalog, revision: view.revision,
  containers: view.containers.map((snapshot) => ({ definition: snapshot.definition, state: snapshot.state })), reservations: view.reservations, receipts: view.receipts });
const errorReason = (error: unknown): string => error instanceof FactoryMaterialError ? error.reason : "InvalidMaterialRequest";
const container = (view: MaterialView, id: string): ResourceContainerSnapshot => view.containers.find((entry) => entry.state.containerId === identity(id)) ?? rejectMaterial("UnknownMaterialContainer");
const replaceContainer = (view: MaterialView, snapshot: ResourceContainerSnapshot): MaterialView => ({ ...view, containers: view.containers.map((entry) => entry.state.containerId === snapshot.state.containerId ? snapshot : entry) });
const claims = (view: MaterialView, containerId: string): readonly MaterialOutput[] => view.reservations.flatMap((reservation) => reservation.outputs.filter((output) => output.targetContainerId === containerId));
const assertClaims = (view: MaterialView): void => {
  const ids = new Set<string>(view.containers.flatMap((entry) => entry.state.contents.map((stack) => stack.stackId)));
  const reservationIds = new Set<string>();
  const wipIds = new Set<string>();
  for (const reservation of view.reservations) {
    identity(reservation.reservationId); identity(reservation.ownerId); container(view, reservation.wipContainerId);
    if (reservationIds.has(reservation.reservationId) || wipIds.has(reservation.wipContainerId)) rejectMaterial("DuplicateReservation");
    reservationIds.add(reservation.reservationId); wipIds.add(reservation.wipContainerId);
    for (const output of reservation.outputs) {
      identity(output.stackId); container(view, output.targetContainerId);
      if (ids.has(output.stackId)) rejectMaterial("DuplicateOutputStackId");
      ids.add(output.stackId);
    }
  }
  for (const snapshot of view.containers) assertExactContainerCapacity(snapshot, view.catalog, claims(view, snapshot.state.containerId));
};
const assertView = (view: MaterialView): void => {
  safeWhole(view.revision, "MaterialRevision", true);
  const receipts = new Set<string>();
  let previousRevision = 0;
  for (const receipt of view.receipts) {
    identity(receipt.transactionId); identity(receipt.ownerId);
    if (receipts.has(receipt.transactionId) || receipt.revisionBefore !== previousRevision || receipt.revisionAfter !== previousRevision + 1) rejectMaterial("InvalidMaterialReceipt");
    const request = JSON.parse(receipt.requestCanonicalJson) as MaterialCommand;
    if (canonicalJson(request) !== receipt.requestCanonicalJson || request.transactionId !== receipt.transactionId || request.ownerId !== receipt.ownerId) rejectMaterial("InvalidMaterialReceipt");
    receipts.add(receipt.transactionId); previousRevision = receipt.revisionAfter;
  }
  if (previousRevision !== view.revision) rejectMaterial("InvalidMaterialReceipt");
  assertMaterialSnapshots(view.catalog, view.containers);
  assertClaims(view);
};

export const createFactoryMaterialView = (catalog: FactoryCatalog, containers: readonly ResourceContainerSnapshot[]): MaterialView => {
  const view: MaterialView = { catalog, revision: 0, containers: [...containers].sort((a, b) => a.state.containerId < b.state.containerId ? -1 : 1), reservations: [], receipts: [] };
  assertView(view);
  return freeze(view);
};

const assertWipAccess = (view: MaterialView, id: string, ownerId: string): void => {
  const owner = view.reservations.find((reservation) => reservation.wipContainerId === id);
  if (owner && owner.ownerId !== ownerId) rejectMaterial("ReservationOwnerMismatch");
  if (owner?.recipeRef) rejectMaterial("RecipeWipLocked");
};
const applyMove = (view: MaterialView, intent: MaterialCommand, move: MaterialMove, partition?: Readonly<{ parentStackId: string; childStackId: string; transactionId: string }>): MaterialView => {
  identity(move.sourceStackId); identity(move.targetStackId);
  const amount = validateFactoryAmount(move.itemId, move.quantityUnits, view.catalog);
  let source = container(view, move.sourceContainerId);
  const target = container(view, move.targetContainerId);
  assertWipAccess(view, move.sourceContainerId, intent.ownerId); assertWipAccess(view, move.targetContainerId, intent.ownerId);
  const originalStack = source.state.contents.find((stack) => stack.stackId === move.sourceStackId);
  if (!originalStack || originalStack.resourceId !== amount.resourceId) rejectMaterial("UnknownSourceStack");
  if (view.containers.some((snapshot) => snapshot.state.containerId !== source.state.containerId && snapshot.state.containerId !== target.state.containerId && snapshot.state.contents.some((stack) => stack.stackId === move.targetStackId))) rejectMaterial("DuplicateStackId");
  if (move.targetStackId === originalStack.stackId && move.quantityUnits !== originalStack.quantity) rejectMaterial("DuplicateStackId");
  if (partition) source = replaceMaterialContents(source, source.state.contents.map((stack) => stack.stackId === originalStack.stackId
    ? createResourceStack({ ...stack, extensions: { ...stack.extensions, "factory.partition": partition } }) : stack), view.catalog, source.state.revision);
  const result = transferResource({ source: { containerId: source.state.containerId, expectedRevision: source.state.revision, ...(move.sourcePortId ? { portId: move.sourcePortId } : {}) },
    target: { containerId: target.state.containerId, expectedRevision: target.state.revision, ...(move.targetPortId ? { portId: move.targetPortId } : {}) },
    resourceId: amount.resourceId, quantity: amount.quantityUnits, sourceStackId: originalStack.stackId, targetStackId: move.targetStackId, allowPartial: false,
    context: { ...(intent.actorId === undefined ? {} : { actorId: intent.actorId }), ...(intent.missionId === undefined ? {} : { missionId: intent.missionId }) } }, view.catalog.resources, source, target);
  if (result.status !== "Accepted" || result.acceptedQuantity !== amount.quantityUnits) rejectMaterial(result.code ?? "ResourceTransferRejected");
  const afterSource = partition ? replaceMaterialContents(result.source, result.source.state.contents.map((stack) => stack.stackId === originalStack.stackId
    ? createResourceStack({ ...stack, extensions: originalStack.extensions }) : stack), view.catalog, result.source.state.revision) : result.source;
  assertExactContainerCapacity(result.target, view.catalog, claims(view, target.state.containerId));
  return replaceContainer(replaceContainer(view, afterSource), result.target);
};
const applyMoves = (view: MaterialView, intent: MaterialCommand, moves: readonly MaterialMove[]): MaterialView => {
  if (!Array.isArray(moves)) rejectMaterial("InvalidMaterialMoves");
  for (const move of moves) view = applyMove(view, intent, move);
  return view;
};

const requireRecipe = (catalog: FactoryCatalog, ref: MaterialRecipeRef): FactoryRecipe => {
  const recipe = catalog.recipes.find((entry) => entry.sourceId === ref.sourceId);
  if (!recipe || recipe.version !== ref.version || recipe.digest !== ref.digest) rejectMaterial("RecipeBindingMismatch");
  return recipe;
};
const termTotals = (terms: readonly Readonly<{ itemId: string; quantityUnits: number }>[], catalog: FactoryCatalog): string => {
  const totals = new Map<string, bigint>();
  for (const term of terms) {
    validateFactoryAmount(term.itemId, term.quantityUnits, catalog);
    totals.set(term.itemId, (totals.get(term.itemId) ?? 0n) + BigInt(term.quantityUnits));
  }
  return canonicalJson([...totals.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([id, quantity]) => [id, quantity.toString()]));
};

const reserve = (view: MaterialView, intent: Extract<MaterialIntent, { kind: "reserve" }>): MaterialView => {
  identity(intent.reservationId);
  const wip = container(view, intent.wipContainerId);
  if (wip.state.contents.length || view.reservations.some((entry) => entry.wipContainerId === intent.wipContainerId || entry.reservationId === intent.reservationId)) rejectMaterial("WipOccupied");
  if (intent.moves.some((move) => move.targetContainerId !== intent.wipContainerId) || intent.outputs.some((output) => output.targetContainerId === intent.wipContainerId)) rejectMaterial("InvalidWipBinding");
  let recipe: FactoryRecipe | null = null;
  if (intent.recipeRef) {
    recipe = requireRecipe(view.catalog, intent.recipeRef);
    if (termTotals(intent.moves, view.catalog) !== termTotals(recipe.inputs, view.catalog)) rejectMaterial("RecipeInputMismatch");
    if (termTotals(intent.outputs, view.catalog) !== termTotals(recipe.outputs, view.catalog)) rejectMaterial("RecipeOutputMismatch");
  }
  view = applyMoves(view, intent, intent.moves);
  const reservation: MaterialReservation = { reservationId: intent.reservationId, ownerId: intent.ownerId, wipContainerId: intent.wipContainerId,
    recipeRef: intent.recipeRef ?? null, recipeCanonicalJson: recipe ? canonicalJson(recipe) : null, outputs: intent.outputs };
  view = { ...view, reservations: [...view.reservations, reservation] };
  assertClaims(view);
  // Prove output policy/custody and complete capacity now, without publishing the hypothetical product candidate.
  if (recipe) finishRecipe(view, { kind: "finish-recipe", transactionId: intent.transactionId, ownerId: intent.ownerId, reservationId: intent.reservationId,
    ...(intent.actorId === undefined ? {} : { actorId: intent.actorId }), ...(intent.missionId === undefined ? {} : { missionId: intent.missionId }) });
  return view;
};
const ownedReservation = (view: MaterialView, intent: Extract<MaterialIntent, { kind: "release" | "finish-recipe" }>): MaterialReservation => {
  const reservation = view.reservations.find((entry) => entry.reservationId === identity(intent.reservationId)) ?? rejectMaterial("UnknownReservation");
  if (reservation.ownerId !== intent.ownerId) rejectMaterial("ReservationOwnerMismatch");
  return reservation;
};

/** W04 owns energy/work admission. This pure seam only converts one already authorized, recipe-bound WIP batch. */
const finishRecipe = (view: MaterialView, intent: Extract<MaterialIntent, { kind: "finish-recipe" }>): MaterialView => {
  const reservation = ownedReservation(view, intent);
  if (!reservation.recipeRef) rejectMaterial("RecipeBindingMismatch");
  const recipe = requireRecipe(view.catalog, reservation.recipeRef);
  if (canonicalJson(recipe) !== reservation.recipeCanonicalJson) rejectMaterial("RecipeBindingMismatch");
  const wip = container(view, reservation.wipContainerId);
  const wipTerms = wip.state.contents.map((stack) => ({ itemId: view.catalog.items.find((entry) => entry.resourceId === stack.resourceId)?.sourceId ?? rejectMaterial("UnknownFactoryResource"), quantityUnits: stack.quantity }));
  if (termTotals(wipTerms, view.catalog) !== termTotals(recipe.inputs, view.catalog)) rejectMaterial("RecipeInputMismatch");
  if (termTotals(reservation.outputs, view.catalog) !== termTotals(recipe.outputs, view.catalog)) rejectMaterial("RecipeOutputMismatch");
  const masses = (terms: readonly Readonly<{ itemId: string; quantityUnits: number }>[]) => terms.reduce((total, term) => total + BigInt(validateFactoryAmount(term.itemId, term.quantityUnits, view.catalog).massMg), 0n);
  if (masses(recipe.inputs) !== masses(recipe.outputs)) rejectMaterial("RecipeMassMismatch");
  const first = wip.state.contents[0] ?? rejectMaterial("RecipeInputMismatch");
  if (wip.state.contents.some((stack) => stack.ownerId !== first.ownerId || stack.missionId !== first.missionId || stack.legalStatus !== first.legalStatus)) rejectMaterial("MixedMaterialCustody");
  if (wip.state.contents.some((stack) => stack.grade !== first.grade || stack.condition !== first.condition)) rejectMaterial("MixedMaterialQuality");
  const produced: ResourceStack[] = reservation.outputs.map((output) => {
    const amount = validateFactoryAmount(output.itemId, output.quantityUnits, view.catalog);
    if (amount.quantityBasis === "piece" && output.quantityUnits !== 1) rejectMaterial("SerializedPieceCannotSplit");
    return createResourceStack({ stackId: output.stackId, resourceId: amount.resourceId, quantity: amount.quantityUnits,
      ...(first.ownerId === undefined ? {} : { ownerId: first.ownerId }), ...(first.missionId === undefined ? {} : { missionId: first.missionId }),
      ...(first.legalStatus === undefined ? {} : { legalStatus: first.legalStatus }), ...(first.grade === undefined ? {} : { grade: first.grade }),
      ...(first.condition === undefined ? {} : { condition: first.condition }),
      extensions: { "factory.production": { recipeRef: reservation.recipeRef, sourceLots: wip.state.contents.map((stack) => ({ stackId: stack.stackId, resourceId: stack.resourceId, quantityUnits: stack.quantity, extensions: stack.extensions })) },
        ...(amount.quantityBasis === "piece" ? { "factory.instance": { instanceId: output.stackId } } : {}) } });
  });
  // The temporary product candidate never publishes alongside the old WIP. The final commit replaces the complete view once.
  view = replaceContainer({ ...view, reservations: view.reservations.filter((entry) => entry !== reservation) }, replaceMaterialContents(wip, produced, view.catalog));
  for (const output of reservation.outputs) view = applyMove(view, intent, { sourceContainerId: wip.state.containerId, sourceStackId: output.stackId,
    targetContainerId: output.targetContainerId, targetStackId: output.stackId, itemId: output.itemId, quantityUnits: output.quantityUnits });
  if (container(view, wip.state.containerId).state.contents.length) rejectMaterial("IncompleteRecipeTransfer");
  return view;
};

export const prepareFactoryMaterialStep = (view: MaterialView, input: MaterialIntent): MaterialPlan | MaterialRejection => {
  try {
    identity(input.transactionId); identity(input.ownerId);
    if (input.actorId !== undefined) identity(input.actorId);
    const requestCanonicalJson = canonicalJson(input);
    const intent: MaterialIntent = freeze(JSON.parse(requestCanonicalJson) as MaterialIntent);
    const oldReceipt = view.receipts.find((entry) => entry.transactionId === intent.transactionId);
    if (oldReceipt && oldReceipt.requestCanonicalJson !== requestCanonicalJson) rejectMaterial("IdempotencyConflict");
    assertView(view);
    const baseCanonicalJson = binding(view);
    if (oldReceipt) return freeze({ status: "Prepared", intent, requestCanonicalJson, baseCanonicalJson, candidate: view });
    let candidate = view;
    switch (intent.kind) {
      case "transfer": candidate = applyMoves(view, intent, intent.moves); break;
      case "reserve": candidate = reserve(view, intent); break;
      case "split": {
        const source = container(view, intent.sourceContainerId);
        const stack = source.state.contents.find((entry) => entry.stackId === identity(intent.sourceStackId)) ?? rejectMaterial("UnknownSourceStack");
        const item = view.catalog.items.find((entry) => entry.resourceId === stack.resourceId) ?? rejectMaterial("UnknownFactoryResource");
        if (item.quantityBasis === "piece" || stack.sealed || !Array.isArray(intent.children) || intent.children.length < 2) rejectMaterial("SerializedPieceCannotSplit");
        const childIds = new Set<string>();
        let total = 0n;
        for (const child of intent.children) {
          identity(child.stackId); validateFactoryAmount(item.sourceId, child.quantityUnits, view.catalog);
          if (childIds.has(child.stackId) || child.stackId === stack.stackId || view.containers.some((entry) => entry.state.contents.some((present) => present.stackId === child.stackId))) rejectMaterial("DuplicateStackId");
          childIds.add(child.stackId); total += BigInt(child.quantityUnits);
        }
        if (total !== BigInt(stack.quantity)) rejectMaterial("SplitQuantityMismatch");
        for (const child of intent.children) candidate = applyMove(candidate, intent, { sourceContainerId: source.state.containerId, sourceStackId: stack.stackId, targetContainerId: child.targetContainerId,
          targetStackId: child.stackId, itemId: item.sourceId, quantityUnits: child.quantityUnits }, { parentStackId: stack.stackId, childStackId: child.stackId, transactionId: intent.transactionId });
        break;
      }
      case "finish-recipe": candidate = finishRecipe(view, intent); break;
      case "release": {
        const reservation = ownedReservation(view, intent);
        if (container(view, reservation.wipContainerId).state.contents.length) rejectMaterial("WipOccupied");
        candidate = { ...view, reservations: view.reservations.filter((entry) => entry !== reservation) };
        break;
      }
      default: rejectMaterial("UnknownMaterialIntent");
    }
    assertView(candidate);
    if (readMaterialMassMg(candidate) !== readMaterialMassMg(view)) rejectMaterial("MaterialMassMismatch");
    const revision = safeWhole(view.revision + 1, "MaterialRevision");
    const receipt: MaterialReceipt = { transactionId: intent.transactionId, ownerId: intent.ownerId, requestCanonicalJson, revisionBefore: view.revision, revisionAfter: revision };
    candidate = freeze({ ...candidate, revision, receipts: [...view.receipts, receipt] });
    return freeze({ status: "Prepared", intent, requestCanonicalJson, baseCanonicalJson, candidate });
  } catch (error) { return Object.freeze({ status: "Rejected", reason: errorReason(error) }); }
};

/** Re-evaluation protects against forged candidate bytes; commit publishes only the freshly verified complete candidate. */
export const commitFactoryMaterialStep = (current: MaterialView, plan: MaterialPlan): MaterialStepResult => {
  try {
    if (plan.status !== "Prepared" || canonicalJson(plan.intent) !== plan.requestCanonicalJson) rejectMaterial("InvalidMaterialPlan");
    const receipt = current.receipts.find((entry) => entry.transactionId === plan.intent.transactionId);
    if (receipt) {
      if (receipt.requestCanonicalJson !== plan.requestCanonicalJson) rejectMaterial("IdempotencyConflict");
      return Object.freeze({ status: "NoOp", view: current, receipt });
    }
    if (binding(current) !== plan.baseCanonicalJson) rejectMaterial("StaleMaterialView");
    const verified = prepareFactoryMaterialStep(current, plan.intent);
    if (verified.status !== "Prepared") return Object.freeze({ ...verified, view: current });
    if (binding(verified.candidate) !== binding(plan.candidate)) rejectMaterial("InvalidMaterialPlan");
    return Object.freeze({ status: "Committed", view: verified.candidate, receipt: verified.candidate.receipts.at(-1)! });
  } catch (error) { return Object.freeze({ status: "Rejected", reason: errorReason(error), view: current }); }
};
