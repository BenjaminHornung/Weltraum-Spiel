declare const resourceIdBrand: unique symbol;
declare const resourceCategoryIdBrand: unique symbol;
declare const resourceCatalogIdBrand: unique symbol;
declare const resourceStackIdBrand: unique symbol;

/** Stable, save-safe resource identity. */
export type ResourceId = string & { readonly [resourceIdBrand]: "ResourceId" };

/** Extensible category identity; category values are catalog data, not an enum. */
export type ResourceCategoryId = string & { readonly [resourceCategoryIdBrand]: "ResourceCategoryId" };

/** Stable catalog identity for persistence and deterministic signatures. */
export type ResourceCatalogId = string & { readonly [resourceCatalogIdBrand]: "ResourceCatalogId" };

/** Stable stack identity for later container and transfer state. */
export type ResourceStackId = string & { readonly [resourceStackIdBrand]: "ResourceStackId" };

export type ResourceValidationErrorCode =
  | "INVALID_ID"
  | "INVALID_CATEGORY"
  | "INVALID_CATALOG"
  | "INVALID_RESOURCE"
  | "INVALID_STACK_RULE"
  | "INVALID_STACK"
  | "INVALID_NUMERIC_VALUE"
  | "INVALID_EXTENSION"
  | "INVALID_REQUIREMENT"
  | "DUPLICATE_CATEGORY_ID"
  | "DUPLICATE_RESOURCE_ID"
  | "DUPLICATE_REQUIREMENT_RESOURCE"
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_RESOURCE";

export class ResourceValidationError extends Error {
  public readonly code: ResourceValidationErrorCode;

  public constructor(code: ResourceValidationErrorCode, message: string) {
    super(message);
    this.name = "ResourceValidationError";
    this.code = code;
  }
}

export const failResourceValidation = (code: ResourceValidationErrorCode, message: string): never => {
  throw new ResourceValidationError(code, message);
};

const saveSafeIdPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** Returns whether a value can be persisted as a lowercase resource-domain identity. */
export const isSaveSafeResourceId = (value: unknown): value is string =>
  typeof value === "string" && saveSafeIdPattern.test(value);

const createSaveSafeId = (value: unknown, label: string): string => {
  if (!isSaveSafeResourceId(value)) {
    return failResourceValidation(
      "INVALID_ID",
      `${label} must be lowercase, save-safe, and use underscore-separated alphanumeric segments`
    );
  }

  return value;
};

export const createResourceId = (value: unknown): ResourceId => createSaveSafeId(value, "Resource id") as ResourceId;

export const createResourceCategoryId = (value: unknown): ResourceCategoryId =>
  createSaveSafeId(value, "Resource category id") as ResourceCategoryId;

export const createResourceCatalogId = (value: unknown): ResourceCatalogId =>
  createSaveSafeId(value, "Resource catalog id") as ResourceCatalogId;

export const createResourceStackId = (value: unknown): ResourceStackId =>
  createSaveSafeId(value, "Resource stack id") as ResourceStackId;
