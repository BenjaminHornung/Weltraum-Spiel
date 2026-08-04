import { adaptiveLevel, deepFreeze } from "../adaptive";
import {
  REPRESENTATION_MAX_ESTIMATED_BYTES,
  REPRESENTATION_MAX_UPLOAD_UNITS,
  REPRESENTATION_MAX_WORK_UNITS,
  type VoxelQualityPolicy
} from "./types";
import {
  representationExactKeys,
  representationFail,
  representationNonNegativeSafeInteger,
  representationPositiveFinite,
  representationRecord
} from "./validation";

const POLICY_VALUES = Object.freeze({
  Low: Object.freeze({ maximumVisualAdaptiveLevel: 2, maximumEstimatedBytes: 64_000_000, maximumWorkUnits: 100_000, maximumUploadUnits: 100_000 }),
  Medium: Object.freeze({ maximumVisualAdaptiveLevel: 3, maximumEstimatedBytes: 128_000_000, maximumWorkUnits: 250_000, maximumUploadUnits: 250_000 }),
  High: Object.freeze({ maximumVisualAdaptiveLevel: 3, maximumEstimatedBytes: 256_000_000, maximumWorkUnits: 500_000, maximumUploadUnits: 500_000 }),
  Ultra: Object.freeze({ maximumVisualAdaptiveLevel: 4, maximumEstimatedBytes: 512_000_000, maximumWorkUnits: 1_000_000, maximumUploadUnits: 1_000_000 })
} as const);

type QualityName = keyof typeof POLICY_VALUES;

const qualityName = (value: unknown, path: string): QualityName => {
  if (typeof value !== "string" || !Object.hasOwn(POLICY_VALUES, value)) {
    return representationFail("InvalidContract", path, "Unsupported voxel quality preset.");
  }
  return value as QualityName;
};

export const createVoxelQualityPolicy = (value: unknown): VoxelQualityPolicy => {
  const record = representationRecord(value, "quality");
  representationExactKeys(record, ["detail", "detailDistanceMeters", "streamingBudget"], "quality");
  const detail = qualityName(record.detail, "quality/detail");
  const streamingBudget = qualityName(record.streamingBudget, "quality/streamingBudget");
  const detailValues = POLICY_VALUES[detail];
  const budgetValues = POLICY_VALUES[streamingBudget];
  return deepFreeze({
    schemaVersion: "voxel-quality-policy-v2" as const,
    detail,
    maximumVisualAdaptiveLevel: adaptiveLevel(detailValues.maximumVisualAdaptiveLevel),
    detailDistanceMeters: representationPositiveFinite(record.detailDistanceMeters, "quality/detailDistanceMeters"),
    streamingBudget,
    maximumEstimatedBytes: budgetValues.maximumEstimatedBytes,
    maximumWorkUnits: budgetValues.maximumWorkUnits,
    maximumUploadUnits: budgetValues.maximumUploadUnits
  });
};

export const validateVoxelQualityPolicy = (value: unknown): VoxelQualityPolicy => {
  const record = representationRecord(value, "qualityPolicy");
  representationExactKeys(record, [
    "schemaVersion",
    "detail",
    "maximumVisualAdaptiveLevel",
    "detailDistanceMeters",
    "streamingBudget",
    "maximumEstimatedBytes",
    "maximumWorkUnits",
    "maximumUploadUnits"
  ], "qualityPolicy");
  if (record.schemaVersion !== "voxel-quality-policy-v2") {
    return representationFail("InvalidContract", "qualityPolicy/schemaVersion", "Unsupported voxel quality policy schema.");
  }
  const detail = qualityName(record.detail, "qualityPolicy/detail");
  const streamingBudget = qualityName(record.streamingBudget, "qualityPolicy/streamingBudget");
  const expectedDetail = POLICY_VALUES[detail];
  const expectedBudget = POLICY_VALUES[streamingBudget];
  if (record.maximumVisualAdaptiveLevel !== 2
    && record.maximumVisualAdaptiveLevel !== 3
    && record.maximumVisualAdaptiveLevel !== 4) {
    return representationFail("InvalidContract", "qualityPolicy/maximumVisualAdaptiveLevel", "Visual Adaptive cap must be L2, L3, or L4.");
  }
  const maximumVisualAdaptiveLevel = adaptiveLevel(record.maximumVisualAdaptiveLevel);
  const maximumEstimatedBytes = representationNonNegativeSafeInteger(record.maximumEstimatedBytes, "qualityPolicy/maximumEstimatedBytes");
  const maximumWorkUnits = representationNonNegativeSafeInteger(record.maximumWorkUnits, "qualityPolicy/maximumWorkUnits");
  const maximumUploadUnits = representationNonNegativeSafeInteger(record.maximumUploadUnits, "qualityPolicy/maximumUploadUnits");
  if (maximumVisualAdaptiveLevel !== expectedDetail.maximumVisualAdaptiveLevel
    || maximumEstimatedBytes !== expectedBudget.maximumEstimatedBytes
    || maximumWorkUnits !== expectedBudget.maximumWorkUnits
    || maximumUploadUnits !== expectedBudget.maximumUploadUnits) {
    return representationFail("InvalidContract", "qualityPolicy", "Voxel quality policy values do not match their named presets.");
  }
  if (maximumEstimatedBytes > REPRESENTATION_MAX_ESTIMATED_BYTES
    || maximumWorkUnits > REPRESENTATION_MAX_WORK_UNITS
    || maximumUploadUnits > REPRESENTATION_MAX_UPLOAD_UNITS) {
    return representationFail("InvalidContract", "qualityPolicy", "Voxel quality policy exceeds representation hard limits.");
  }
  return deepFreeze({
    schemaVersion: "voxel-quality-policy-v2" as const,
    detail,
    maximumVisualAdaptiveLevel,
    detailDistanceMeters: representationPositiveFinite(record.detailDistanceMeters, "qualityPolicy/detailDistanceMeters"),
    streamingBudget,
    maximumEstimatedBytes,
    maximumWorkUnits,
    maximumUploadUnits
  });
};
