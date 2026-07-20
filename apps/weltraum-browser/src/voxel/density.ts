import {
  invalidVoxelResult,
  validVoxelResult,
  voxelIssue,
  VoxelContractError,
  type VoxelValidationIssue,
  type VoxelValidationResult
} from "./types";

export const validateDensityChannel = (value: unknown, expectedLength: number): VoxelValidationResult => {
  if (!(value instanceof Float32Array)) {
    return invalidVoxelResult([voxelIssue("InvalidChannelType", "densityBuffer", "must be a Float32Array")]);
  }
  const issues: VoxelValidationIssue[] = [];
  if (value.length !== expectedLength) {
    issues.push(voxelIssue("InvalidChannelLength", "densityBuffer", `must contain exactly ${expectedLength} samples`));
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Number.isFinite(value[index])) {
      issues.push(voxelIssue("NonFiniteDensity", `densityBuffer[${index}]`, "must be finite"));
      break;
    }
  }
  return issues.length === 0 ? validVoxelResult() : invalidVoxelResult(issues);
};

/** V1 sign convention: density <= 0 is solid; density > 0 is air. */
export const isSolidDensity = (value: number): boolean => {
  if (!Number.isFinite(value)) {
    throw new VoxelContractError("Density value is invalid", [
      voxelIssue("NonFiniteDensity", "density", "must be finite")
    ]);
  }
  return value <= 0;
};
