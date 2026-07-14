import { issue, invalidResult, type ValidationResult, validResult } from "./validation";

declare const representationKeyBrand: unique symbol;
declare const materialProfileIdBrand: unique symbol;
declare const frameIdBrand: unique symbol;
declare const contentHashBrand: unique symbol;
declare const backendRevisionBrand: unique symbol;
declare const frameRevisionBrand: unique symbol;
declare const sourceRevisionBrand: unique symbol;
declare const artifactRevisionBrand: unique symbol;
declare const visibilityPlanRevisionBrand: unique symbol;

export type RepresentationKey = string & { readonly [representationKeyBrand]: true };
export type MaterialProfileId = string & { readonly [materialProfileIdBrand]: true };
export type FrameId = string & { readonly [frameIdBrand]: true };
export type ContentHash = string & { readonly [contentHashBrand]: true };
export type BackendRevision = number & { readonly [backendRevisionBrand]: true };
export type FrameRevision = number & { readonly [frameRevisionBrand]: true };
export type SourceRevision = number & { readonly [sourceRevisionBrand]: true };
export type ArtifactRevision = number & { readonly [artifactRevisionBrand]: true };
export type VisibilityPlanRevision = number & { readonly [visibilityPlanRevisionBrand]: true };

export interface ArtifactVersion {
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
}

export const compareAscii = (left: string, right: string): -1 | 0 | 1 => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const semanticIdPattern = /^[a-z][a-z0-9]*(?:[_:-][a-z0-9]+)*$/;
const contentHashPattern = /^fnv1a64:[0-9a-f]{16}$/;

export const validateSemanticId = (value: unknown, path = "id"): ValidationResult => {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 || !semanticIdPattern.test(value)) {
    return invalidResult([issue("InvalidSemanticId", path, "must be a 1-128 character stable lowercase ASCII identifier")]);
  }
  return validResult();
};

const semanticId = <T extends string>(value: string, name: string): T => {
  const validation = validateSemanticId(value, name);
  if (!validation.valid) {
    throw new TypeError(`${name} is not a stable semantic ASCII identifier`);
  }
  return value as T;
};

export const representationKey = (value: string): RepresentationKey => semanticId(value, "representationKey");
export const materialProfileId = (value: string): MaterialProfileId => semanticId(value, "materialProfileId");
export const frameId = (value: string): FrameId => semanticId(value, "frameId");

export const contentHash = (value: string): ContentHash => {
  if (!contentHashPattern.test(value)) {
    throw new TypeError("contentHash must use the fnv1a64:<16 lowercase hex digits> format");
  }
  return value as ContentHash;
};

export const validateRevision = (value: unknown, path = "revision"): ValidationResult => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    return invalidResult([issue("InvalidRevision", path, "must be a non-negative safe integer")]);
  }
  return validResult();
};

const revision = <T extends number>(value: number, name: string): T => {
  if (!validateRevision(value, name).valid) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value as T;
};

export const backendRevision = (value: number): BackendRevision => revision(value, "backendRevision");
export const frameRevision = (value: number): FrameRevision => revision(value, "frameRevision");
export const sourceRevision = (value: number): SourceRevision => revision(value, "sourceRevision");
export const artifactRevision = (value: number): ArtifactRevision => revision(value, "artifactRevision");
export const visibilityPlanRevision = (value: number): VisibilityPlanRevision => revision(value, "visibilityPlanRevision");

export const compareArtifactVersions = (left: ArtifactVersion, right: ArtifactVersion): -1 | 0 | 1 => {
  if (left.sourceRevision !== right.sourceRevision) {
    return left.sourceRevision < right.sourceRevision ? -1 : 1;
  }
  if (left.artifactRevision === right.artifactRevision) {
    return 0;
  }
  return left.artifactRevision < right.artifactRevision ? -1 : 1;
};

export const isContentHash = (value: unknown): value is ContentHash =>
  typeof value === "string" && contentHashPattern.test(value);
