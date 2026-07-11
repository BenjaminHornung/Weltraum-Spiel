import { createResourceCategory, type ResourceCategory, type ResourceCategoryInput } from "./categories";
import {
  createResourceCatalogId,
  createResourceId,
  failResourceValidation,
  isSaveSafeResourceId,
  type ResourceCatalogId,
  type ResourceId
} from "./ids";
import { canonicalJson, canonicalSignature } from "./serialization";
import {
  cloneResourceExtensions,
  createResourceDefinition,
  createResourceRequirement,
  createResourceStack,
  type ResourceDefinition,
  type ResourceDefinitionInput,
  type ResourceExtensions,
  type ResourceRequirement,
  type ResourceStack,
} from "./types";

export interface ResourceCatalogInput {
  readonly catalogId: ResourceCatalogId | string;
  readonly categories: readonly ResourceCategoryInput[];
  readonly resources: readonly ResourceDefinitionInput[];
  readonly extensions?: ResourceExtensions;
}

/** Canonical, immutable data snapshot; lookups remain pure functions instead of hidden mutable registries. */
export interface ResourceCatalog {
  readonly catalogId: ResourceCatalogId;
  readonly categories: readonly ResourceCategory[];
  readonly resources: readonly ResourceDefinition[];
  readonly extensions: ResourceExtensions;
  readonly canonicalJson: string;
  readonly signature: string;
}

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const catalogPayload = (catalog: Pick<ResourceCatalog, "catalogId" | "categories" | "resources" | "extensions">) => ({
  catalogId: catalog.catalogId,
  categories: catalog.categories,
  resources: catalog.resources,
  extensions: catalog.extensions
});

const canonicalCategoryList = (value: unknown): readonly ResourceCategory[] => {
  if (!Array.isArray(value)) {
    return failResourceValidation("INVALID_CATALOG", "Resource catalog categories must be an array");
  }

  const ids = new Set<string>();
  const categories = value.map((entry) => createResourceCategory(entry));
  for (const category of categories) {
    if (ids.has(category.categoryId)) {
      return failResourceValidation("DUPLICATE_CATEGORY_ID", `Duplicate resource category id: ${category.categoryId}`);
    }
    ids.add(category.categoryId);
  }

  return Object.freeze([...categories].sort((a, b) => codeUnitCompare(a.categoryId, b.categoryId)));
};

const canonicalResourceList = (value: unknown, categories: readonly ResourceCategory[]): readonly ResourceDefinition[] => {
  if (!Array.isArray(value)) {
    return failResourceValidation("INVALID_CATALOG", "Resource catalog resources must be an array");
  }

  const categoryIds = new Set(categories.map((category) => category.categoryId));
  const resourceIds = new Set<string>();
  const resources = value.map((entry) => createResourceDefinition(entry));
  for (const resource of resources) {
    if (!categoryIds.has(resource.categoryId)) {
      return failResourceValidation("UNKNOWN_CATEGORY", `Resource ${resource.resourceId} has unknown category ${resource.categoryId}`);
    }
    if (resourceIds.has(resource.resourceId)) {
      return failResourceValidation("DUPLICATE_RESOURCE_ID", `Duplicate resource id: ${resource.resourceId}`);
    }
    resourceIds.add(resource.resourceId);
  }

  return Object.freeze([...resources].sort((a, b) => codeUnitCompare(a.resourceId, b.resourceId)));
};

export const createResourceCatalog = (value: unknown): ResourceCatalog => {
  if (!isRecord(value)) {
    return failResourceValidation("INVALID_CATALOG", "Resource catalog must be an object");
  }

  const categories = canonicalCategoryList(value.categories);
  const resources = canonicalResourceList(value.resources, categories);
  const catalog = {
    catalogId: createResourceCatalogId(value.catalogId),
    categories,
    resources,
    extensions: cloneResourceExtensions(value.extensions)
  };
  const json = canonicalJson(catalogPayload(catalog));

  return Object.freeze({
    ...catalog,
    canonicalJson: json,
    signature: canonicalSignature(catalogPayload(catalog))
  });
};

export const resourceCatalogCanonicalJson = (catalog: ResourceCatalog): string => canonicalJson(catalogPayload(catalog));

export const resourceCatalogSignature = (catalog: ResourceCatalog): string => canonicalSignature(catalogPayload(catalog));

export const findResourceDefinition = (
  catalog: ResourceCatalog,
  resourceId: ResourceId | string
): ResourceDefinition | undefined => {
  const normalizedId = createResourceId(resourceId);
  return catalog.resources.find((resource) => resource.resourceId === normalizedId);
};

export const hasResourceDefinition = (catalog: ResourceCatalog, resourceId: unknown): boolean =>
  isSaveSafeResourceId(resourceId) && catalog.resources.some((resource) => resource.resourceId === resourceId);

export const validateResourceRequirement = (value: unknown, catalog: ResourceCatalog): ResourceRequirement => {
  const requirement = createResourceRequirement(value);
  if (!findResourceDefinition(catalog, requirement.resourceId)) {
    return failResourceValidation("UNKNOWN_RESOURCE", `Resource requirement references unknown id: ${requirement.resourceId}`);
  }

  return requirement;
};

export const validateResourceRequirements = (value: unknown, catalog: ResourceCatalog): readonly ResourceRequirement[] => {
  if (!Array.isArray(value)) {
    return failResourceValidation("INVALID_REQUIREMENT", "Resource requirements must be an array");
  }

  const requirements = value.map((entry) => validateResourceRequirement(entry, catalog));
  const ids = new Set<string>();
  for (const requirement of requirements) {
    if (ids.has(requirement.resourceId)) {
      return failResourceValidation(
        "DUPLICATE_REQUIREMENT_RESOURCE",
        `Resource requirement is duplicated: ${requirement.resourceId}`
      );
    }
    ids.add(requirement.resourceId);
  }

  return Object.freeze([...requirements].sort((a, b) => codeUnitCompare(a.resourceId, b.resourceId)));
};

/** Applies a catalog definition's runtime stack constraints without keeping any shared state. */
export const validateResourceStackForCatalog = (value: unknown, catalog: ResourceCatalog): ResourceStack => {
  const stack = createResourceStack(value);
  const definition = findResourceDefinition(catalog, stack.resourceId);
  if (!definition) {
    return failResourceValidation("UNKNOWN_RESOURCE", `Resource stack references unknown id: ${stack.resourceId}`);
  }

  if (stack.quantity > definition.stackRule.maxQuantity) {
    return failResourceValidation(
      "INVALID_STACK",
      `Resource stack quantity exceeds ${definition.resourceId} maxQuantity ${definition.stackRule.maxQuantity}`
    );
  }

  if (
    (definition.stackRule.kind === "Discrete" || definition.stackRule.kind === "Sealed") &&
    !Number.isSafeInteger(stack.quantity)
  ) {
    return failResourceValidation("INVALID_STACK", `${definition.stackRule.kind} stacks require an integer quantity`);
  }

  if (definition.stackRule.kind === "Sealed" && !stack.sealed) {
    return failResourceValidation("INVALID_STACK", "Sealed resource stacks must set sealed to true");
  }

  return stack;
};
