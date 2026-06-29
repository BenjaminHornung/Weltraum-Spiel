import { add, sub, vec3, type Vec3 } from "../core/vector";

export type FrameType = "AbsoluteSystem" | "LocalPhysics" | "ShipLocal" | "PlanetCentered" | "SurfaceLocal" | "OutpostSite";

export interface FrameDescriptor {
  readonly id: string;
  readonly type: FrameType;
  readonly originAbsolutePosition: Vec3;
  readonly orientation: "identity";
  readonly units: "meters";
  readonly referenceBodyId?: string;
  readonly validTimeTick?: number;
}

export interface WorldCoordinate {
  readonly kind: "WorldCoordinate";
  readonly value: Vec3;
  readonly frame: FrameDescriptor;
}

export interface LocalCoordinate {
  readonly kind: "LocalCoordinate";
  readonly value: Vec3;
  readonly frame: FrameDescriptor;
}

export type VelocityRelationship = "Absolute" | "LocalPhysics" | "ShipRelative" | "PlanetRelative" | "SurfaceRelative";

export interface FramedVelocity {
  readonly kind: "FramedVelocity";
  readonly value: Vec3;
  readonly frame: FrameDescriptor;
  readonly relationship: VelocityRelationship;
}

const assertFiniteVec3 = (value: Vec3, label: string): void => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${label} must be finite`);
  }
};

export const createFrameDescriptor = (descriptor: {
  readonly id: string;
  readonly type: FrameType;
  readonly originAbsolutePosition?: Vec3;
  readonly referenceBodyId?: string;
  readonly validTimeTick?: number;
}): FrameDescriptor => {
  const originAbsolutePosition = descriptor.originAbsolutePosition ?? vec3();
  if (!descriptor.id.trim()) {
    throw new Error("Frame descriptor id is required");
  }
  assertFiniteVec3(originAbsolutePosition, "Frame originAbsolutePosition");

  return {
    id: descriptor.id,
    type: descriptor.type,
    originAbsolutePosition,
    orientation: "identity",
    units: "meters",
    referenceBodyId: descriptor.referenceBodyId,
    validTimeTick: descriptor.validTimeTick
  };
};

export const ABSOLUTE_SYSTEM_FRAME: FrameDescriptor = createFrameDescriptor({ id: "absolute-system", type: "AbsoluteSystem" });

export const createLocalPhysicsFrame = (id: string, originAbsolutePosition: Vec3, validTimeTick?: number): FrameDescriptor =>
  createFrameDescriptor({ id, type: "LocalPhysics", originAbsolutePosition, validTimeTick });

export const worldCoordinate = (value: Vec3, frame: FrameDescriptor = ABSOLUTE_SYSTEM_FRAME): WorldCoordinate => {
  if (frame.type !== "AbsoluteSystem") {
    throw new Error(`WorldCoordinate requires an AbsoluteSystem frame, received ${frame.type}`);
  }
  assertFiniteVec3(value, "WorldCoordinate value");
  return { kind: "WorldCoordinate", value, frame };
};

export const localCoordinate = (value: Vec3, frame: FrameDescriptor): LocalCoordinate => {
  if (frame.type !== "LocalPhysics") {
    throw new Error(`LocalCoordinate requires a LocalPhysics frame, received ${frame.type}`);
  }
  assertFiniteVec3(value, "LocalCoordinate value");
  return { kind: "LocalCoordinate", value, frame };
};

export const framedVelocity = (value: Vec3, frame: FrameDescriptor, relationship: VelocityRelationship): FramedVelocity => {
  assertFiniteVec3(value, "FramedVelocity value");
  return { kind: "FramedVelocity", value, frame, relationship };
};

export const absoluteVelocity = (value: Vec3, frame: FrameDescriptor = ABSOLUTE_SYSTEM_FRAME): FramedVelocity => {
  if (frame.type !== "AbsoluteSystem") {
    throw new Error(`Absolute velocity requires an AbsoluteSystem frame, received ${frame.type}`);
  }
  return framedVelocity(value, frame, "Absolute");
};

export const localPhysicsVelocity = (value: Vec3, frame: FrameDescriptor): FramedVelocity => {
  if (frame.type !== "LocalPhysics") {
    throw new Error(`Local physics velocity requires a LocalPhysics frame, received ${frame.type}`);
  }
  return framedVelocity(value, frame, "LocalPhysics");
};

export const absoluteToLocal = (position: WorldCoordinate, localFrame: FrameDescriptor): LocalCoordinate =>
  localCoordinate(sub(position.value, localFrame.originAbsolutePosition), localFrame);

export const localToAbsolute = (position: LocalCoordinate, frame: FrameDescriptor = ABSOLUTE_SYSTEM_FRAME): WorldCoordinate =>
  worldCoordinate(add(position.value, position.frame.originAbsolutePosition), frame);

export const velocityToLocalPhysics = (velocity: FramedVelocity, localFrame: FrameDescriptor): FramedVelocity =>
  localPhysicsVelocity(vec3(velocity.value.x, velocity.value.y, velocity.value.z), localFrame);

export const velocityToAbsolute = (velocity: FramedVelocity, frame: FrameDescriptor = ABSOLUTE_SYSTEM_FRAME): FramedVelocity =>
  absoluteVelocity(vec3(velocity.value.x, velocity.value.y, velocity.value.z), frame);

export const sameFrame = (a: FrameDescriptor, b: FrameDescriptor): boolean => a.id === b.id && a.type === b.type;
