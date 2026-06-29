import { sub, type Vec3 } from "../core/vector";
import { absoluteToLocal, velocityToLocalPhysics, type FrameDescriptor, type FramedVelocity, type LocalCoordinate, type WorldCoordinate } from "./frames";

export interface WorldEntityState {
  readonly id: string;
  readonly absolutePosition: WorldCoordinate;
  readonly absoluteVelocity: FramedVelocity;
  readonly renderBatchKey?: string;
}

export interface ProjectedEntityState extends WorldEntityState {
  readonly localPosition: LocalCoordinate;
  readonly localVelocity: FramedVelocity;
}

export interface ProjectionShiftEvent {
  readonly type: "FloatingOriginProjectionShift";
  readonly previousFrame: FrameDescriptor;
  readonly nextFrame: FrameDescriptor;
  readonly originShiftAbsolute: Vec3;
  readonly projectedEntityCount: number;
}

export interface ProjectionShiftResult {
  readonly event: ProjectionShiftEvent;
  readonly before: readonly ProjectedEntityState[];
  readonly after: readonly ProjectedEntityState[];
}

export const projectEntityToLocalFrame = (entity: WorldEntityState, frame: FrameDescriptor): ProjectedEntityState => ({
  ...entity,
  localPosition: absoluteToLocal(entity.absolutePosition, frame),
  localVelocity: velocityToLocalPhysics(entity.absoluteVelocity, frame)
});

export const projectEntitiesToLocalFrame = (entities: readonly WorldEntityState[], frame: FrameDescriptor): readonly ProjectedEntityState[] =>
  entities.map((entity) => projectEntityToLocalFrame(entity, frame));

export const shiftFloatingOriginProjection = (
  entities: readonly WorldEntityState[],
  previousFrame: FrameDescriptor,
  nextFrame: FrameDescriptor
): ProjectionShiftResult => {
  const before = projectEntitiesToLocalFrame(entities, previousFrame);
  const after = projectEntitiesToLocalFrame(entities, nextFrame);
  return {
    event: {
      type: "FloatingOriginProjectionShift",
      previousFrame,
      nextFrame,
      originShiftAbsolute: sub(nextFrame.originAbsolutePosition, previousFrame.originAbsolutePosition),
      projectedEntityCount: entities.length
    },
    before,
    after
  };
};
