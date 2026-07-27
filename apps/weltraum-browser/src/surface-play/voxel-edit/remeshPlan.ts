import { VOXEL_BRICK_CELL_COUNT } from "../../voxel";
import { freezePlain } from "./canonical";
import type {
  SurfaceVoxelEditResult,
  SurfaceVoxelRemeshPlanResult,
  SurfaceVoxelResidentCoverage
} from "./types";

const reject = (
  reason: "EditNotApplied" | "StaleCoverage" | "MissingCoverage" | "BudgetExceeded",
  message: string,
  editResult: Readonly<SurfaceVoxelEditResult>
): Readonly<SurfaceVoxelRemeshPlanResult> => freezePlain({
  status: "Rejected" as const,
  reason,
  message,
  expectedRegionRevision: editResult.resultingRegionRevision,
  expectedEditRevision: editResult.resultingEditRevision
});

const validBudget = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0 && !Object.is(value, -0);

export const createSurfaceVoxelRemeshPlan = (
  editResult: Readonly<SurfaceVoxelEditResult>,
  residentCoverage: Readonly<SurfaceVoxelResidentCoverage>
): Readonly<SurfaceVoxelRemeshPlanResult> => {
  if (editResult.status !== "Applied") {
    return reject("EditNotApplied", "Only an Applied voxel edit can produce a remesh plan.", editResult);
  }
  if (
    residentCoverage.regionRevision !== editResult.resultingRegionRevision
    || residentCoverage.editRevision !== editResult.resultingEditRevision
  ) {
    return reject("StaleCoverage", "Resident coverage revision does not match the applied edit.", editResult);
  }
  const resident = new Set(residentCoverage.residentBrickKeys);
  const orderedRemeshKeys = [...new Set(editResult.requiredRemeshKeys)].sort();
  const missing = orderedRemeshKeys.filter((key) => !resident.has(key));
  if (missing.length > 0) {
    return reject("MissingCoverage", `Required remesh coverage is missing: ${missing.join(", ")}.`, editResult);
  }
  if (!validBudget(residentCoverage.maxRemeshBricks) || !validBudget(residentCoverage.maxEstimatedCellWork)) {
    return reject("BudgetExceeded", "Remesh budgets must be positive safe integers.", editResult);
  }
  const estimatedCellWork = orderedRemeshKeys.length * VOXEL_BRICK_CELL_COUNT;
  if (
    !Number.isSafeInteger(estimatedCellWork)
    || orderedRemeshKeys.length > residentCoverage.maxRemeshBricks
    || estimatedCellWork > residentCoverage.maxEstimatedCellWork
  ) {
    return reject("BudgetExceeded", "Remesh brick-count or estimated cell-work budget was exceeded.", editResult);
  }
  return freezePlain({
    status: "Planned" as const,
    changedBrickKeys: [...new Set(editResult.changedBrickKeys)].sort(),
    seamNeighborKeys: [...new Set(editResult.seamNeighborKeys)].sort(),
    orderedRemeshKeys,
    expectedRegionRevision: editResult.resultingRegionRevision,
    expectedEditRevision: editResult.resultingEditRevision,
    estimatedCellWork
  });
};
