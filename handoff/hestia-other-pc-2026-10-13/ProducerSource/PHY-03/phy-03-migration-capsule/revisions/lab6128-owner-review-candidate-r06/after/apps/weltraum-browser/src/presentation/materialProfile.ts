import { canonicalSignature } from "./canonical";
import { validateSemanticId, type ContentHash, type MaterialProfileId } from "./ids";
import { invalidResult, issue, type ValidationIssue, type ValidationResult, validResult, throwIfInvalid } from "./validation";

export type MaterialProfileKind = "Unlit" | "BasicLit" | "DebugWireframe";

export interface LinearColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface MaterialProfile {
  readonly id: MaterialProfileId;
  readonly kind: MaterialProfileKind;
  readonly baseColor: LinearColor;
  readonly opacity: number;
  readonly doubleSided: boolean;
  readonly wireframe: boolean;
  readonly depthWrite: boolean;
}

export const validateMaterialProfile = (profile: MaterialProfile): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const idValidation = validateSemanticId(profile.id, "id");
  if (!idValidation.valid) issues.push(...idValidation.issues);
  if (!(["Unlit", "BasicLit", "DebugWireframe"] as const).includes(profile.kind)) {
    issues.push(issue("UnsupportedMaterialKind", "kind", "must be Unlit, BasicLit, or DebugWireframe"));
  }
  for (const channel of ["r", "g", "b"] as const) {
    const value = profile.baseColor[channel];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      issues.push(issue("InvalidBaseColor", `baseColor.${channel}`, "must be finite and between 0 and 1"));
    }
  }
  if (!Number.isFinite(profile.opacity) || profile.opacity < 0 || profile.opacity > 1) {
    issues.push(issue("InvalidOpacity", "opacity", "must be finite and between 0 and 1"));
  }
  if (profile.kind === "DebugWireframe" && !profile.wireframe) {
    issues.push(issue("WireframeRequired", "wireframe", "DebugWireframe requires wireframe=true"));
  }
  for (const field of ["doubleSided", "wireframe", "depthWrite"] as const) {
    if (typeof profile[field] !== "boolean") {
      issues.push(issue("InvalidMaterialFlag", field, "must be boolean"));
    }
  }
  return issues.length === 0 ? validResult() : invalidResult(issues);
};

export const createMaterialProfile = (input: MaterialProfile): MaterialProfile => {
  const profile = Object.freeze({
    id: input.id,
    kind: input.kind,
    baseColor: Object.freeze({ r: input.baseColor.r, g: input.baseColor.g, b: input.baseColor.b }),
    opacity: input.opacity,
    doubleSided: input.doubleSided,
    wireframe: input.wireframe,
    depthWrite: input.depthWrite
  });
  throwIfInvalid("MaterialProfile", validateMaterialProfile(profile));
  return profile;
};

export const materialProfileSignature = (profile: MaterialProfile): ContentHash => canonicalSignature({ version: 1, ...profile });
