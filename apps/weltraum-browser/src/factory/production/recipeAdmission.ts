import type { FactoryCatalog, FactoryProcess, FactoryRecipe } from "../contracts";
import type { MaterialRecipeRef, MaterialView } from "../material/reservations";
import type { FactoryPowerBinding } from "../power/factoryPower";
import { assertMaterialSnapshots, assertExactContainerCapacity } from "../material/resourcesAdapter";
import { loadFactoryCatalog } from "../catalog/fp02Catalog";
import { canonicalJson } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import { exactScaledLimit } from "../material/quantity";

export interface ProductionInstallation {
  readonly instanceId: string;
  readonly definitionRef: MaterialRecipeRef;
  readonly installationRevision: number;
  readonly confirmed: boolean;
  readonly supported: boolean;
  readonly serviceClear: boolean;
  readonly installedContainerId: string;
  readonly inputContainerId: string;
  readonly outputContainerId: string;
  readonly offcutContainerId: string;
  readonly wipContainerId: string;
  readonly powerConsumerId: string;
  readonly powerPortId: string;
  readonly tool: Readonly<{ partId: string; sourceItemId: string; revision: number; condition: "OK" | "damaged" }>;
}
/** Facts originate in the confirmed native Host, never the camera or UI. */
export interface ProductionHostFacts {
  readonly version: "fp06-production-host-facts-v1";
  readonly binding: FactoryPowerBinding;
  readonly confirmed: boolean;
  readonly tickEndUs: string;
  readonly installation: ProductionInstallation;
  readonly interaction: Readonly<{
    actorId: string;
    actorRevision: number;
    confirmed: boolean;
    serviceReachable: boolean;
    accessibleContainers: readonly Readonly<{ containerId: string; revision: number }>[];
  }> | null;
}
export interface ProductionStart {
  readonly kind: "start";
  readonly commandId: string;
  readonly jobId: string;
  readonly batchOrdinal: number;
  readonly ownerId: string;
  readonly actorId: string;
  readonly missionId?: string;
  readonly recipeRef: MaterialRecipeRef;
  readonly processKind: "electric" | "manual";
  readonly sourceLots: readonly Readonly<{ itemId: string; containerId: string; stackId: string }>[];
}
export type ProductionRecipeAdmission = Readonly<{ ok: true; recipe: FactoryRecipe; process: FactoryProcess }>
  | Readonly<{ ok: false; reason: string }>;

export const productionId = (id: string): void => { if (!isSaveSafeResourceId(id)) throw Error("InvalidProductionId"); };
export const productionRevision = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw Error("InvalidProductionRevision");
};
export const productionContainer = (view: MaterialView, id: string) => {
  productionId(id); const found = view.containers.find(c => c.state.containerId === id);
  if (!found) throw Error("ProductionContainerMissing"); return found;
};
export const productionOutputs = (facts: ProductionHostFacts, start: ProductionStart, recipe: FactoryRecipe) => recipe.outputs.map((term, i) => ({
  ...term, targetContainerId: term.itemId === "fp02.bulk.steel_offcut" ? facts.installation.offcutContainerId : facts.installation.outputContainerId,
  stackId: `${start.jobId}_output_${i}`
}));
// Derived validation caches retain no quantities or authoritative state. Only
// recursively immutable source objects qualify; mutable caller data is rechecked.
const immutable = new WeakSet<object>();
export const isImmutableProductionData = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return true;
  if (immutable.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  // Frozen accessors may still read mutable external data. Cache data-only
  // records/arrays, never a getter's current observation.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(k => typeof k !== "string")
    || !Object.values(descriptors).every(d => "value" in d && isImmutableProductionData(d.value))) return false;
  immutable.add(value); return true;
};
const checkedCatalogs = new WeakMap<FactoryCatalog, FactoryCatalog>();
const checkedMaterials = new WeakSet<MaterialView>();
const validateMaterial = (material: MaterialView): FactoryCatalog => {
  const catalog = material.catalog;
  let checked = checkedCatalogs.get(catalog);
  if (!checked) {
    checked = loadFactoryCatalog(JSON.parse(catalog.canonicalJson));
    const { resources: _resources, canonicalJson: _json, catalogDigest: _digest, ...data } = catalog;
    if (canonicalJson(data) !== catalog.canonicalJson || catalog.catalogDigest !== checked.catalogDigest
      || canonicalJson(catalog.resources) !== canonicalJson(checked.resources)) throw Error("ProductionCatalogMismatch");
    if (isImmutableProductionData(catalog)) checkedCatalogs.set(catalog, checked);
  }
  if (!checkedMaterials.has(material)) {
    assertMaterialSnapshots(catalog, material.containers);
    if (isImmutableProductionData(material)) checkedMaterials.add(material);
  }
  return checked;
};
const materialBytes = new WeakMap<MaterialView, string>();
/** Complete native quantities, source and receipt bytes, not a digest or a
 * second inventory. A WeakMap reuses only a recursively immutable, validated
 * snapshot; mutable caller data always runs validation and serialization. */
export const productionMaterialCanonicalJson = (material: MaterialView): string => {
  validateMaterial(material);
  const cached = materialBytes.get(material);
  if (cached !== undefined) return cached;
  const bytes = canonicalJson({ ...material, containers: material.containers.map(c => ({ definition: c.definition, state: c.state })) });
  if (isImmutableProductionData(material)) materialBytes.set(material, bytes);
  return bytes;
};

/** Reads an existing material serialization cache without populating it. */
export const readProductionFactoryMaterialCacheTextBytes = (material: MaterialView): number =>
  (materialBytes.get(material)?.length ?? 0) * 2;

/** Estimates retained catalog data and checked-catalog caches without validating or serializing them. */
export const readProductionFactoryCatalogCheckpointBytes = (...catalogs: readonly FactoryCatalog[]): number => {
  let objectCount = 0, arrayCount = 0, entries = 0, utf16Bytes = 0;
  const visited = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") { utf16Bytes += value.length * 2; return; }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      arrayCount++; entries += value.length;
      for (const child of value) visit(child);
      return;
    }
    objectCount++;
    for (const key in value) if (Object.hasOwn(value, key)) {
      entries++; utf16Bytes += key.length * 2;
      visit((value as Record<string, unknown>)[key]);
    }
  };
  for (const catalog of catalogs) {
    visit(catalog);
    const checked = checkedCatalogs.get(catalog);
    if (checked) visit(checked);
  }
  return utf16Bytes + 64 * (objectCount + arrayCount) + 16 * entries;
};

/** Estimates the current recipe-admission cache owners without validating or serializing them. */
export const readProductionFactoryCheckpointCacheBytes = (material: MaterialView, retainedCatalogs: readonly FactoryCatalog[] = []): number =>
  readProductionFactoryMaterialCacheTextBytes(material) + readProductionFactoryCatalogCheckpointBytes(material.catalog, ...retainedCatalogs);

/** Validate current native material and source-bound machine facts. These are
 * admission calculations only. The Host owns provenance of the native facts. */
export const admitFactoryRecipe = (material: MaterialView, facts: ProductionHostFacts, start: ProductionStart, active = false): ProductionRecipeAdmission => {
  try {
    const catalog = material.catalog, machine = facts.installation;
    const checked = validateMaterial(material);
    if (facts.binding.catalogDigest !== catalog.catalogDigest) throw Error("ProductionCatalogMismatch");
    productionRevision(material.revision);
    productionId(start.commandId); productionId(start.jobId); productionId(start.ownerId); productionId(start.actorId);
    if (start.missionId !== undefined) productionId(start.missionId);
    productionRevision(start.batchOrdinal); productionRevision(machine.installationRevision); productionRevision(machine.tool.revision);
    productionId(machine.instanceId); productionId(machine.tool.partId); productionId(machine.powerConsumerId); productionId(machine.powerPortId);
    if (facts.version !== "fp06-production-host-facts-v1" || facts.confirmed !== true || machine.confirmed !== true
      || machine.supported !== true || machine.serviceClear !== true || machine.installationRevision < 1 || machine.tool.condition !== "OK") throw Error("ProductionMachineUnavailable");
    const recipe = checked.recipes.find(r => r.sourceId === start.recipeRef.sourceId);
    const device = checked.devices.find(d => d.sourceId === machine.definitionRef.sourceId);
    if (!recipe || recipe.version !== start.recipeRef.version || recipe.digest !== start.recipeRef.digest) throw Error("ProductionRecipeMismatch");
    if (!device || device.version !== machine.definitionRef.version || device.digest !== machine.definitionRef.digest) throw Error("ProductionDeviceMismatch");
    const process = recipe.processes.find(p => p.kind === start.processKind && p.availability === "first-dry-loop" && device.capabilities.includes(p.capability));
    if (!process || (process.kind === "electric" && !["REC-01-CUT", "REC-02-PROFILE", "REC-03-SHEET"].includes(recipe.sourceId))
      || (process.kind === "manual" && (recipe.sourceId !== "REC-05-BRACE" || device.sourceId !== "B05"))) throw Error("ProductionProcessUnavailable");
    const requiredTool = device.sourceId === "B06" ? "fp02.tool.cutter_head" : device.sourceId === "B07" ? "fp02.tool.forming_die" : "fp02.device.field_workbench";
    if (machine.tool.sourceItemId !== requiredTool) throw Error("ProductionToolMismatch");
    if (process.kind === "electric") {
      if (!Number.isSafeInteger(process.durationMs) || process.durationMs! <= 0 || process.durationMs! % 100 !== 0
        || !Number.isSafeInteger(process.powerWatts) || process.powerWatts <= 0 || !Number.isSafeInteger(process.workJ)
        || BigInt(process.durationMs!) * BigInt(process.powerWatts) !== BigInt(process.workJ) * 1_000n) throw Error("ProductionProcessArithmetic");
    } else if (process.durationMs !== null || process.powerWatts !== 0 || process.workJ !== 0) throw Error("ProductionManualProfileMismatch");
    const ids = [machine.installedContainerId, machine.inputContainerId, machine.outputContainerId, machine.offcutContainerId, machine.wipContainerId];
    if (new Set(ids).size !== ids.length) throw Error("ProductionContainerRoleMismatch");
    for (const id of ids) productionContainer(material, id);
    const paid = productionContainer(material, machine.installedContainerId);
    const paidTerms = new Map<string, number>();
    for (const stack of paid.state.contents) {
      if (stack.condition !== undefined && stack.condition !== 1) throw Error("ProductionInstalledPartDamaged");
      const item = catalog.items.find(i => i.resourceId === stack.resourceId)!;
      const total = (paidTerms.get(item.sourceId) ?? 0) + stack.quantity;
      if (!Number.isSafeInteger(total)) throw Error("ProductionInstalledQuantityOverflow");
      paidTerms.set(item.sourceId, total);
    }
    const sorted = (entries: readonly (readonly [string, number])[]) => canonicalJson([...entries].sort(([a], [b]) => a < b ? -1 : 1));
    if (sorted([...paidTerms.entries()]) !== sorted(device.bom.map(t => [t.itemId, t.quantityUnits] as const))) throw Error("ProductionPaidInstallationMismatch");
    for (const [role, containerId] of [["input", machine.inputContainerId], ["output", machine.outputContainerId], ["offcut", machine.offcutContainerId]] as const) {
      const limit = device.buffers.find(b => b.role === role);
      if (limit && exactScaledLimit(productionContainer(material, containerId).definition.maxMassKg, 6, "ProductionBufferCapacity") > limit.massMg) throw Error("ProductionBufferExceedsSource");
    }
    if (!Array.isArray(start.sourceLots) || start.sourceLots.length !== recipe.inputs.length || new Set(start.sourceLots.map(s => s.itemId)).size !== recipe.inputs.length) throw Error("ProductionInputBindingMismatch");
    for (const term of recipe.inputs) {
      const source = start.sourceLots.find(s => s.itemId === term.itemId);
      if (!source) throw Error("ProductionInputBindingMismatch");
      productionId(source.stackId);
      if (process.kind === "electric" && source.containerId !== machine.inputContainerId) throw Error("ProductionInputPortMismatch");
      const container = productionContainer(material, source.containerId);
      const lot = container.state.contents.find(s => s.stackId === source.stackId);
      if (!active && (!lot || lot.resourceId !== catalog.items.find(i => i.sourceId === term.itemId)!.resourceId || lot.quantity < term.quantityUnits)) throw Error("WAIT_INPUT");
    }
    if (process.kind === "manual") {
      const actor = facts.interaction;
      if (!actor || actor.confirmed !== true || actor.actorId !== start.actorId || actor.serviceReachable !== true) throw Error("ProductionInteractionUnavailable");
      productionRevision(actor.actorRevision);
      for (const id of [...start.sourceLots.map(s => s.containerId), machine.outputContainerId, machine.offcutContainerId]) {
        const c = productionContainer(material, id);
        if (!actor.accessibleContainers.some(a => a.containerId === id && a.revision === c.state.revision)) throw Error("ProductionContainerUnreachable");
      }
    }
    for (const id of [machine.outputContainerId, machine.offcutContainerId]) {
      const claims = material.reservations.flatMap(r => r.outputs.filter(o => o.targetContainerId === id));
      const own = active ? [] : productionOutputs(facts, start, recipe).filter(o => o.targetContainerId === id);
      try { assertExactContainerCapacity(productionContainer(material, id), catalog, [...claims, ...own]); }
      catch { throw Error(id === machine.offcutContainerId ? "WAIT_WASTE" : "WAIT_OUTPUT"); }
    }
    return { ok: true, recipe, process };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : "ProductionAdmissionRejected" }; }
};
