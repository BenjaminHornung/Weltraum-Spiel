import type { FrameDescriptor, LocalCoordinate } from "./frames";
import type { ProjectedEntityState } from "./floatingOrigin";

export interface LowPolyInstanceDescriptor {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly batchKey: string;
  readonly frame: FrameDescriptor;
  readonly localPosition: LocalCoordinate;
  readonly localScale: number;
  readonly renderOnly: true;
}

export interface LowPolyInstanceBatch {
  readonly id: string;
  readonly batchKey: string;
  readonly sourceId?: string;
  readonly frame: FrameDescriptor;
  readonly renderOnly: true;
  readonly rendererOwnsWorldTruth: false;
  readonly maxInstances: number;
  readonly instances: readonly LowPolyInstanceDescriptor[];
}

export interface LowPolyInstanceBatchOptions {
  readonly batchId: string;
  readonly batchKey: string;
  readonly sourceId?: string;
  readonly maxInstances: number;
  readonly localScale?: number | ((entity: ProjectedEntityState, index: number) => number);
}

export interface LowPolyInstanceBudgetSummary {
  readonly sourceEntityCount: number;
  readonly renderedInstanceCount: number;
  readonly maxInstances: number;
  readonly culledByBudget: number;
}

export const createLowPolyInstanceBatch = (
  projectedEntities: readonly ProjectedEntityState[],
  options: LowPolyInstanceBatchOptions
): LowPolyInstanceBatch => {
  if (!options.batchId.trim() || !options.batchKey.trim()) {
    throw new Error("Low-poly instance batch id and key are required");
  }
  if (!Number.isInteger(options.maxInstances) || options.maxInstances < 0) {
    throw new Error("Low-poly instance maxInstances must be a non-negative integer");
  }
  if (projectedEntities.length === 0) {
    throw new Error("Low-poly instance batch requires at least one projected source entity");
  }

  const candidates = projectedEntities
    .filter((entity) => (entity.renderBatchKey ?? options.batchKey) === options.batchKey)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, options.maxInstances);

  const instances = candidates.map((entity, index): LowPolyInstanceDescriptor => {
    const localScale = typeof options.localScale === "function" ? options.localScale(entity, index) : (options.localScale ?? 1);
    return {
      id: `${options.batchId}:${entity.id}`,
      sourceEntityId: entity.id,
      batchKey: options.batchKey,
      frame: entity.localPosition.frame,
      localPosition: entity.localPosition,
      localScale,
      renderOnly: true
    };
  });

  return {
    id: options.batchId,
    batchKey: options.batchKey,
    sourceId: options.sourceId,
    frame: instances[0]?.frame ?? projectedEntities[0].localPosition.frame,
    renderOnly: true,
    rendererOwnsWorldTruth: false,
    maxInstances: options.maxInstances,
    instances
  };
};

export const summarizeLowPolyInstanceBudget = (batch: LowPolyInstanceBatch, sourceEntityCount: number): LowPolyInstanceBudgetSummary => ({
  sourceEntityCount,
  renderedInstanceCount: batch.instances.length,
  maxInstances: batch.maxInstances,
  culledByBudget: Math.max(0, sourceEntityCount - batch.instances.length)
});
