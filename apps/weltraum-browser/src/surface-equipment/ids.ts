import { surfaceEquipmentDataError } from "./validation";

type SurfaceEquipmentBrand<T, Name extends string> = T & { readonly __surfaceEquipmentBrand: Name };

export type SurfaceEquipmentCatalogId = SurfaceEquipmentBrand<string, "SurfaceEquipmentCatalogId">;
export type SurfaceEquipmentModuleId = SurfaceEquipmentBrand<string, "SurfaceEquipmentModuleId">;
export type SurfaceEquipmentModuleInstanceId = SurfaceEquipmentBrand<string, "SurfaceEquipmentModuleInstanceId">;
export type SurfaceEquipmentBlueprintId = SurfaceEquipmentBrand<string, "SurfaceEquipmentBlueprintId">;
export type SurfaceEquipmentSlotId = SurfaceEquipmentBrand<string, "SurfaceEquipmentSlotId">;
export type SurfaceEquipmentSlotTypeId = SurfaceEquipmentBrand<string, "SurfaceEquipmentSlotTypeId">;
export type SurfaceEquipmentCommandId = SurfaceEquipmentBrand<string, "SurfaceEquipmentCommandId">;
export type SurfaceEquipmentTagId = SurfaceEquipmentBrand<string, "SurfaceEquipmentTagId">;
export type SurfaceEquipmentLegalClassId = SurfaceEquipmentBrand<string, "SurfaceEquipmentLegalClassId">;
export type SurfaceEquipmentCalibrationId = SurfaceEquipmentBrand<string, "SurfaceEquipmentCalibrationId">;
export type SurfaceEquipmentCalibrationOptionId = SurfaceEquipmentBrand<string, "SurfaceEquipmentCalibrationOptionId">;

export type SurfaceEquipmentCatalogVersion = SurfaceEquipmentBrand<number, "SurfaceEquipmentCatalogVersion">;
export type SurfaceEquipmentModuleVersion = SurfaceEquipmentBrand<number, "SurfaceEquipmentModuleVersion">;
export type SurfaceEquipmentRevision = SurfaceEquipmentBrand<number, "SurfaceEquipmentRevision">;
export type SurfaceEquipmentSignature = SurfaceEquipmentBrand<string, "SurfaceEquipmentSignature">;

export const SURFACE_EQUIPMENT_SCHEMA_VERSION = 1 as const;
export const SURFACE_EQUIPMENT_STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

const parseId = <T extends string>(value: unknown, path: string, label: string): T => {
  if (typeof value !== "string" || !SURFACE_EQUIPMENT_STABLE_ID_PATTERN.test(value)) {
    throw surfaceEquipmentDataError(
      "InvalidId",
      path,
      `${label} must match ${SURFACE_EQUIPMENT_STABLE_ID_PATTERN.source}.`
    );
  }
  return value as T;
};

const parsePositiveVersion = <T extends number>(value: unknown, path: string, label: string): T => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw surfaceEquipmentDataError("InvalidInteger", path, `${label} must be a positive safe integer.`);
  }
  return value as T;
};

export const createSurfaceEquipmentCatalogId = (value: unknown, path = "/catalogId"): SurfaceEquipmentCatalogId =>
  parseId<SurfaceEquipmentCatalogId>(value, path, "Catalog ID");
export const createSurfaceEquipmentModuleId = (value: unknown, path = "/moduleId"): SurfaceEquipmentModuleId =>
  parseId<SurfaceEquipmentModuleId>(value, path, "Module ID");
export const createSurfaceEquipmentModuleInstanceId = (
  value: unknown,
  path = "/moduleInstanceId"
): SurfaceEquipmentModuleInstanceId => parseId<SurfaceEquipmentModuleInstanceId>(value, path, "Module instance ID");
export const createSurfaceEquipmentBlueprintId = (
  value: unknown,
  path = "/blueprintId"
): SurfaceEquipmentBlueprintId => parseId<SurfaceEquipmentBlueprintId>(value, path, "Blueprint ID");
export const createSurfaceEquipmentSlotId = (value: unknown, path = "/slotId"): SurfaceEquipmentSlotId =>
  parseId<SurfaceEquipmentSlotId>(value, path, "Slot ID");
export const createSurfaceEquipmentSlotTypeId = (
  value: unknown,
  path = "/slotTypeId"
): SurfaceEquipmentSlotTypeId => parseId<SurfaceEquipmentSlotTypeId>(value, path, "Slot type ID");
export const createSurfaceEquipmentCommandId = (value: unknown, path = "/commandId"): SurfaceEquipmentCommandId =>
  parseId<SurfaceEquipmentCommandId>(value, path, "Command ID");
export const createSurfaceEquipmentTagId = (value: unknown, path = "/tagId"): SurfaceEquipmentTagId =>
  parseId<SurfaceEquipmentTagId>(value, path, "Tag ID");
export const createSurfaceEquipmentLegalClassId = (
  value: unknown,
  path = "/legalClassId"
): SurfaceEquipmentLegalClassId => parseId<SurfaceEquipmentLegalClassId>(value, path, "Legal class ID");
export const createSurfaceEquipmentCalibrationId = (
  value: unknown,
  path = "/calibrationId"
): SurfaceEquipmentCalibrationId => parseId<SurfaceEquipmentCalibrationId>(value, path, "Calibration ID");
export const createSurfaceEquipmentCalibrationOptionId = (
  value: unknown,
  path = "/optionId"
): SurfaceEquipmentCalibrationOptionId => parseId<SurfaceEquipmentCalibrationOptionId>(value, path, "Calibration option ID");

export const createSurfaceEquipmentCatalogVersion = (
  value: unknown,
  path = "/catalogVersion"
): SurfaceEquipmentCatalogVersion => parsePositiveVersion<SurfaceEquipmentCatalogVersion>(value, path, "Catalog version");
export const createSurfaceEquipmentModuleVersion = (
  value: unknown,
  path = "/moduleVersion"
): SurfaceEquipmentModuleVersion => parsePositiveVersion<SurfaceEquipmentModuleVersion>(value, path, "Module version");
export const createSurfaceEquipmentRevision = (
  value: unknown,
  path = "/revision"
): SurfaceEquipmentRevision => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw surfaceEquipmentDataError("InvalidInteger", path, "Revision must be a non-negative safe integer.");
  }
  return value as SurfaceEquipmentRevision;
};
