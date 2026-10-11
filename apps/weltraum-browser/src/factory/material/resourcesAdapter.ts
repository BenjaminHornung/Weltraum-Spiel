import type { FactoryCatalog } from "../contracts";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState, type ResourceContainerSnapshot } from "../../resources/containers";
import type { ResourceStack } from "../../resources/types";
import { exactScaledLimit, findFactoryItem, rejectMaterial, safeBigIntNumber, safeWhole, validateFactoryAmount } from "./quantity";

export interface MaterialCapacityClaim { readonly itemId: string; readonly quantityUnits: number; }
interface Rational { readonly numerator: bigint; readonly denominator: bigint; }
const gcd = (a: bigint, b: bigint): bigint => { while (b !== 0n) [a, b] = [b, a % b]; return a; };
const addVolume = (a: Rational, b: Rational): Rational => {
  const numerator = a.numerator * b.denominator + b.numerator * a.denominator;
  const denominator = a.denominator * b.denominator;
  const common = gcd(numerator, denominator);
  return { numerator: numerator / common, denominator: denominator / common };
};

/** Computed exclusively from the same Resources contents; not an independently stored ledger. */
export const assertExactContainerCapacity = (snapshot: ResourceContainerSnapshot, catalog: FactoryCatalog, claims: readonly MaterialCapacityClaim[] = []): void => {
  let mass = 0n;
  let volume: Rational = { numerator: 0n, denominator: 1n };
  const terms = [...snapshot.state.contents.map((stack) => {
    const item = catalog.items.find((entry) => entry.resourceId === stack.resourceId) ?? rejectMaterial("UnknownFactoryResource");
    if (item.quantityBasis === "piece" && stack.quantity !== 1) rejectMaterial("SerializedPieceCannotSplit");
    return { itemId: item.sourceId, quantityUnits: stack.quantity };
  }), ...claims];
  for (const term of terms) {
    const amount = validateFactoryAmount(term.itemId, term.quantityUnits, catalog);
    const profile = findFactoryItem(catalog, term.itemId).volumeProfile;
    if (profile.kind === "unknown") rejectMaterial("UnknownVolumeProfile");
    mass += BigInt(amount.massMg);
    volume = addVolume(volume, { numerator: BigInt(term.quantityUnits) * BigInt(profile.numeratorMm3), denominator: BigInt(profile.denominatorUnits) });
  }
  safeBigIntNumber(mass, "ContainerMass");
  if (mass > BigInt(exactScaledLimit(snapshot.definition.maxMassKg, 6, "MassCapacity"))) rejectMaterial("TargetMassExceeded");
  if (volume.numerator > BigInt(exactScaledLimit(snapshot.definition.maxVolumeM3, 9, "VolumeCapacity")) * volume.denominator) rejectMaterial("TargetVolumeExceeded");
  if (snapshot.state.contents.length + claims.length > safeWhole(snapshot.definition.maxStackCount, "StackCapacity", true)) rejectMaterial("TargetStackLimitExceeded");
};

export const replaceMaterialContents = (snapshot: ResourceContainerSnapshot, contents: readonly ResourceStack[], catalog: FactoryCatalog, revision = snapshot.state.revision + 1): ResourceContainerSnapshot => {
  safeWhole(revision, "ContainerRevision", true);
  const state = createResourceContainerState({ ...snapshot.state, revision, contents }, catalog.resources);
  return createResourceContainerSnapshot(snapshot.definition, state, catalog.resources);
};

export const assertMaterialSnapshots = (catalog: FactoryCatalog, snapshots: readonly ResourceContainerSnapshot[]): void => {
  const containers = new Set<string>();
  const stacks = new Set<string>();
  const serializedInstances = new Set<string>();
  for (const snapshot of snapshots) {
    if (containers.has(snapshot.state.containerId)) rejectMaterial("DuplicateContainerId");
    containers.add(snapshot.state.containerId);
    const definition = createResourceContainerDefinition(snapshot.definition);
    const state = createResourceContainerState(snapshot.state, catalog.resources);
    if (definition.canonicalJson !== snapshot.definition.canonicalJson || definition.signature !== snapshot.definition.signature || state.canonicalJson !== snapshot.state.canonicalJson || state.signature !== snapshot.state.signature || definition.containerId !== state.containerId) rejectMaterial("InvalidResourceSnapshot");
    const normalized = createResourceContainerSnapshot(definition, state, catalog.resources);
    if (normalized.canonicalJson !== snapshot.canonicalJson || normalized.signature !== snapshot.signature) rejectMaterial("InvalidResourceSnapshot");
    assertExactContainerCapacity(snapshot, catalog);
    for (const stack of snapshot.state.contents) {
      if (stacks.has(stack.stackId)) rejectMaterial("DuplicateStackId");
      stacks.add(stack.stackId);
      const item = catalog.items.find((entry) => entry.resourceId === stack.resourceId)!;
      if (item.quantityBasis !== "piece") continue;
      const source = stack.extensions["factory.source"];
      const produced = stack.extensions["factory.instance"];
      const instanceId = source && typeof source === "object" && !Array.isArray(source) && "instanceId" in source ? String(source.instanceId)
        : produced && typeof produced === "object" && !Array.isArray(produced) && "instanceId" in produced ? String(produced.instanceId) : stack.stackId;
      if (serializedInstances.has(instanceId)) rejectMaterial("DuplicateSerializedInstance");
      serializedInstances.add(instanceId);
    }
  }
};

export const readMaterialMassMg = (view: Readonly<{ catalog: FactoryCatalog; containers: readonly ResourceContainerSnapshot[] }>): number => {
  let mass = 0n;
  for (const container of view.containers) for (const stack of container.state.contents) {
    const item = view.catalog.items.find((entry) => entry.resourceId === stack.resourceId) ?? rejectMaterial("UnknownFactoryResource");
    mass += BigInt(validateFactoryAmount(item.sourceId, stack.quantity, view.catalog).massMg);
  }
  return safeBigIntNumber(mass, "MaterialMass");
};
