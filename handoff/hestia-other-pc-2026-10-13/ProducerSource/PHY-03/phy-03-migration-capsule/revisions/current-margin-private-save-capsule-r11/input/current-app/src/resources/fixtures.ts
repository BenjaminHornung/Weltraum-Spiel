import { type ResourceCategoryInput } from "./categories";
import { createResourceCatalog, type ResourceCatalog } from "./catalog";
import { createStarterResourceCatalog } from "./starterCatalog";
import { type ResourceDefinitionInput, type ResourceRequirementInput } from "./types";
import {
  createResourceContainerDefinition,
  createResourceContainerState,
  type ResourceContainerDefinition,
  type ResourceContainerDefinitionInput,
  type ResourceContainerState,
  type ResourceContainerStateInput
} from "./containers";

export const resourceCategoryFixture = (overrides: Partial<ResourceCategoryInput> = {}): ResourceCategoryInput => ({
  categoryId: "fixture_category",
  label: "Fixture Category",
  ...overrides
});

export const resourceDefinitionFixture = (overrides: Partial<ResourceDefinitionInput> = {}): ResourceDefinitionInput => ({
  resourceId: "fixture_resource",
  displayName: "Fixture Resource",
  categoryId: "fixture_category",
  massPerUnitKg: 1,
  volumePerUnitM3: 0.001,
  baseValueCredits: 1,
  stackRule: { kind: "Bulk", maxQuantity: 100, splitAllowed: true },
  rarityTier: "Common",
  tags: ["fixture"],
  hazardFlags: [],
  legalStatus: "Legal",
  ownershipImplication: "None",
  defaultUse: "fixture",
  ...overrides
});

export const resourceRequirementFixture = (overrides: Partial<ResourceRequirementInput> = {}): ResourceRequirementInput => ({
  resourceId: "fixture_resource",
  quantity: 1,
  ...overrides
});

export const resourceCatalogFixture = (overrides: {
  readonly catalogId?: string;
  readonly categories?: readonly ResourceCategoryInput[];
  readonly resources?: readonly ResourceDefinitionInput[];
} = {}): ResourceCatalog =>
  createResourceCatalog({
    catalogId: overrides.catalogId ?? "fixture_resource_catalog",
    categories: overrides.categories ?? [resourceCategoryFixture()],
    resources: overrides.resources ?? [resourceDefinitionFixture()]
  });

export const starterResourceCatalogFixture = (): ResourceCatalog => createStarterResourceCatalog();

export const resourceContainerDefinitionFixture = (
  overrides: Partial<ResourceContainerDefinitionInput> = {}
): ResourceContainerDefinition =>
  createResourceContainerDefinition({
    containerId: "fixture_container",
    kind: "ShipCargo",
    maxMassKg: 1000,
    maxVolumeM3: 10,
    maxStackCount: 20,
    ...overrides
  });

export const resourceContainerStateFixture = (
  overrides: Partial<ResourceContainerStateInput> = {},
  catalog: ResourceCatalog = starterResourceCatalogFixture()
): ResourceContainerState =>
  createResourceContainerState({
    containerId: "fixture_container",
    contents: [],
    ...overrides
  }, catalog);

export const suitContainerFixture = (): ResourceContainerDefinition =>
  resourceContainerDefinitionFixture({ containerId: "suit_pack", kind: "Suit", maxMassKg: 30, maxVolumeM3: 0.08, maxStackCount: 4 });

export const shipHoldContainerFixture = (): ResourceContainerDefinition =>
  resourceContainerDefinitionFixture({ containerId: "ship_hold", kind: "ShipCargo", maxMassKg: 5000, maxVolumeM3: 40, maxStackCount: 100 });

export const missionCargoContainerFixture = (): ResourceContainerDefinition =>
  resourceContainerDefinitionFixture({
    containerId: "mission_cargo_bay",
    kind: "MissionCargo",
    maxMassKg: 1000,
    maxVolumeM3: 5,
    maxStackCount: 10,
    policy: { ownershipPolicy: "OwnerOnly", partialTransferPolicy: "Forbidden" }
  });

export const miningReservoirContainerFixture = (): ResourceContainerDefinition =>
  resourceContainerDefinitionFixture({ containerId: "mining_node_reservoir", kind: "MiningNodeReservoir", maxMassKg: 100000, maxVolumeM3: 1000, maxStackCount: 10 });
