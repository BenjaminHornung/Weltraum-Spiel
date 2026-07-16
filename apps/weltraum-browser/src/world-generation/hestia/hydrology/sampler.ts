import type {
  HydrologySnapshot,
  HydrologyTerrainAdjustment,
  RiverSegmentPoint,
  WaterBodyId
} from "./contracts";
import { HESTIA_HYDROLOGY_GRID_V2 } from "./preset";

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));
const CELL_WIDTH = HESTIA_HYDROLOGY_GRID_V2.cellsX;
const SAMPLE_WIDTH = HESTIA_HYDROLOGY_GRID_V2.samplesX;
const QUANTUM_METERS = HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters;
const MAXIMUM_FINITE_DATASET_DISTANCE = Math.hypot(
  HESTIA_HYDROLOGY_GRID_V2.extentXMeters,
  HESTIA_HYDROLOGY_GRID_V2.extentZMeters
) + HESTIA_HYDROLOGY_GRID_V2.gridSpacingMeters;

const requireQueryCoordinate = (value: number, path: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${path} must be finite`);
  const quanta = value / QUANTUM_METERS;
  if (!Number.isSafeInteger(Math.trunc(quanta))) throw new RangeError(`${path} exceeds safe global-coordinate precision`);
  return value;
};

const distance = (x1: number, z1: number, x2: number, z2: number): number => Math.hypot(x1 - x2, z1 - z2);
const sampleIndex = (x: number, z: number): number => z * SAMPLE_WIDTH + x;
const cellIndex = (x: number, z: number): number => z * CELL_WIDTH + x;

const interpolateTerrainHeight = (snapshot: HydrologySnapshot, localX: number, localZ: number): number => {
  const x0 = Math.max(0, Math.min(SAMPLE_WIDTH - 1, Math.floor(localX)));
  const z0 = Math.max(0, Math.min(SAMPLE_WIDTH - 1, Math.floor(localZ)));
  const x1 = Math.min(SAMPLE_WIDTH - 1, x0 + 1);
  const z1 = Math.min(SAMPLE_WIDTH - 1, z0 + 1);
  const tx = localX - x0;
  const tz = localZ - z0;
  const north = snapshot.samples[sampleIndex(x0, z0)]!.terrainHeight * (1 - tx)
    + snapshot.samples[sampleIndex(x1, z0)]!.terrainHeight * tx;
  const south = snapshot.samples[sampleIndex(x0, z1)]!.terrainHeight * (1 - tx)
    + snapshot.samples[sampleIndex(x1, z1)]!.terrainHeight * tx;
  return north * (1 - tz) + south * tz;
};

/**
 * Pure query over frozen snapshot values. Raw terrain between the canonical
 * samples is bilinearly interpolated, so no retained caller function or mutable
 * runtime alias can change sampler results after the snapshot hash is fixed.
 */
export function sampleHydrologyTerrainAdjustment(
  snapshot: HydrologySnapshot,
  globalXMeters: number,
  globalZMeters: number
): HydrologyTerrainAdjustment;
export function sampleHydrologyTerrainAdjustment(
  globalXMeters: number,
  globalZMeters: number,
  snapshot: HydrologySnapshot
): HydrologyTerrainAdjustment;
export function sampleHydrologyTerrainAdjustment(
  first: HydrologySnapshot | number,
  second: number,
  third: number | HydrologySnapshot
): HydrologyTerrainAdjustment {
  const snapshot = typeof first === "number" ? third as HydrologySnapshot : first;
  const globalXMeters = typeof first === "number" ? first : second;
  const globalZMeters = typeof first === "number" ? second : third as number;
  requireQueryCoordinate(globalXMeters, "globalXMeters");
  requireQueryCoordinate(globalZMeters, "globalZMeters");
  if (typeof snapshot !== "object" || snapshot === null || !Object.isFrozen(snapshot)) {
    throw new TypeError("snapshot must be a frozen Hydrology V2 snapshot");
  }
  const originXMeters = snapshot.origin.xQuanta * QUANTUM_METERS;
  const originZMeters = snapshot.origin.zQuanta * QUANTUM_METERS;
  const localX = (globalXMeters - originXMeters) / HESTIA_HYDROLOGY_GRID_V2.gridSpacingMeters;
  const localZ = (globalZMeters - originZMeters) / HESTIA_HYDROLOGY_GRID_V2.gridSpacingMeters;
  if (localX < 0 || localZ < 0 || localX > CELL_WIDTH || localZ > CELL_WIDTH) {
    throw new RangeError("hydrology query lies outside the fixed dataset extent");
  }
  const terrainHeight = interpolateTerrainHeight(snapshot, localX, localZ);
  if (!Number.isFinite(terrainHeight)) throw new RangeError("snapshot terrain interpolation produced a non-finite value");

  let nearestRiver: RiverSegmentPoint | null = null;
  let channelDistance = MAXIMUM_FINITE_DATASET_DISTANCE;
  for (const segment of snapshot.riverSegments) {
    for (const point of segment.points) {
      const candidateDistance = distance(globalXMeters, globalZMeters, point.coordinate.xMeters, point.coordinate.zMeters);
      if (candidateDistance < channelDistance || (candidateDistance === channelDistance
        && (nearestRiver === null || point.coordinate.zQuanta < nearestRiver.coordinate.zQuanta
          || (point.coordinate.zQuanta === nearestRiver.coordinate.zQuanta
            && point.coordinate.xQuanta < nearestRiver.coordinate.xQuanta)))) {
        channelDistance = candidateDistance;
        nearestRiver = point;
      }
    }
  }

  let bankBlend = 0;
  let channelDepth = 0;
  if (nearestRiver !== null) {
    const bankRun = nearestRiver.carveDepth / snapshot.parameters.channelBankSlope;
    bankBlend = clampUnit((nearestRiver.halfWidth + bankRun - channelDistance) / bankRun);
    channelDepth = nearestRiver.carveDepth * bankBlend;
  }
  const adjustedTerrainHeight = terrainHeight - channelDepth;

  // The maximum dataset edge belongs to the final containing cell. Everywhere
  // else floor(local) is the same top-left cell convention used by cellIndices.
  const containingX = Math.min(CELL_WIDTH - 1, Math.floor(localX));
  const containingZ = Math.min(CELL_WIDTH - 1, Math.floor(localZ));
  const containingCellIndex = cellIndex(containingX, containingZ);
  const containingCell = snapshot.cells[containingCellIndex]!;
  const boundarySampleIndex = localX === CELL_WIDTH && Number.isInteger(localZ)
    ? sampleIndex(CELL_WIDTH, localZ)
    : localZ === CELL_WIDTH && Number.isInteger(localX)
      ? sampleIndex(localX, CELL_WIDTH)
      : null;
  const boundarySample = boundarySampleIndex === null ? undefined : snapshot.samples[boundarySampleIndex];
  const boundaryBody = boundarySample?.waterBodyId === null || boundarySample?.waterBodyId === undefined
    ? undefined
    : snapshot.waterBodies.find((candidate) => candidate.id === boundarySample.waterBodyId
      && candidate.sampleIndices.includes(boundarySampleIndex!));
  const body = containingCell.waterBodyId === null
    ? undefined
    : snapshot.waterBodies.find((candidate) => candidate.id === containingCell.waterBodyId
      && candidate.cellIndices.includes(containingCellIndex));
  let waterSurfaceHeight: number | undefined;
  let waterBodyIdentity: WaterBodyId | undefined;
  if (boundarySample !== undefined && boundaryBody !== undefined && boundarySample.waterSurfaceHeight !== null) {
    waterSurfaceHeight = boundarySample.waterSurfaceHeight;
    waterBodyIdentity = boundaryBody.id;
  } else if (body !== undefined && containingCell.waterSurfaceHeight !== null
    && terrainHeight < containingCell.waterSurfaceHeight - snapshot.parameters.comparisonEpsilonMeters) {
    waterSurfaceHeight = containingCell.waterSurfaceHeight;
    waterBodyIdentity = body.id;
  } else if (nearestRiver !== null && channelDistance <= nearestRiver.halfWidth
    && nearestRiver.waterSurfaceHeight > adjustedTerrainHeight + snapshot.parameters.comparisonEpsilonMeters) {
    waterSurfaceHeight = nearestRiver.waterSurfaceHeight;
  }

  let nearestWaterDistance = MAXIMUM_FINITE_DATASET_DISTANCE;
  for (const waterBody of snapshot.waterBodies) {
    for (const index of waterBody.sampleIndices) {
      const waterSample = snapshot.samples[index]!;
      nearestWaterDistance = Math.min(nearestWaterDistance, distance(
        globalXMeters,
        globalZMeters,
        waterSample.coordinate.xMeters,
        waterSample.coordinate.zMeters
      ));
    }
  }
  const wetDistance = Math.min(channelDistance, nearestWaterDistance);
  const distanceMoisture = clampUnit(1 - wetDistance / snapshot.parameters.moistureFalloffMeters);
  const depressionMoisture = clampUnit(
    containingCell.depressionDepth / snapshot.parameters.moistureFalloffMeters
  );
  const moisture = Math.max(distanceMoisture, depressionMoisture);
  if (![channelDepth, channelDistance, bankBlend, adjustedTerrainHeight, moisture].every(Number.isFinite)) {
    throw new RangeError("hydrology adjustment produced a non-finite result");
  }
  return Object.freeze({
    channelDepth,
    channelDistance,
    bankBlend,
    adjustedTerrainHeight,
    ...(waterSurfaceHeight === undefined ? {} : { waterSurfaceHeight }),
    ...(waterBodyIdentity === undefined ? {} : { waterBodyId: waterBodyIdentity }),
    moisture
  });
}

export const createHydrologyTerrainAdjustmentSampler = (
  snapshot: HydrologySnapshot
): ((globalXMeters: number, globalZMeters: number) => HydrologyTerrainAdjustment) => {
  if (!Object.isFrozen(snapshot)) throw new TypeError("snapshot must be frozen");
  return (globalXMeters, globalZMeters) => sampleHydrologyTerrainAdjustment(snapshot, globalXMeters, globalZMeters);
};
