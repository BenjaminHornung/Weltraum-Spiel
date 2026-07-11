import { createResourceCategoryId, failResourceValidation, type ResourceCategoryId } from "./ids";
import { cloneResourceExtensions, type ResourceExtensions } from "./types";

export interface ResourceCategoryInput {
  readonly categoryId: ResourceCategoryId | string;
  readonly label: string;
  readonly description?: string;
  readonly extensions?: ResourceExtensions;
}

/** A category is catalog data so later modules can add entries without changing a closed enum. */
export interface ResourceCategory {
  readonly categoryId: ResourceCategoryId;
  readonly label: string;
  readonly description?: string;
  readonly extensions: ResourceExtensions;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireText = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    return failResourceValidation("INVALID_CATEGORY", `${label} must be a non-empty string`);
  }

  return value.trim();
};

export const createResourceCategory = (value: unknown): ResourceCategory => {
  if (!isRecord(value)) {
    return failResourceValidation("INVALID_CATEGORY", "Resource category must be an object");
  }

  const description = value.description;
  const normalizedDescription =
    description === undefined
      ? undefined
      : typeof description === "string" && description.trim()
        ? description.trim()
        : failResourceValidation("INVALID_CATEGORY", "Resource category description must be non-empty when provided");

  return Object.freeze({
    categoryId: createResourceCategoryId(value.categoryId),
    label: requireText(value.label, "Resource category label"),
    ...(normalizedDescription === undefined ? {} : { description: normalizedDescription }),
    extensions: cloneResourceExtensions(value.extensions)
  });
};
