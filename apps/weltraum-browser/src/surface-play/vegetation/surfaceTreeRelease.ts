import {
  createSpatialVector3,
  crossSpatialVectors,
  scaleSpatialVector,
  subtractSpatialVectors
} from "../../spatial/quaternion";
import type { SpatialVector3 } from "../../spatial/types";
import type { StructuralInertiaTensor } from "../../voxel/structural";
import {
  SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS,
  SURFACE_RIGID_BODY_MAX_SUBSTEPS,
  SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS,
  SURFACE_RIGID_BODY_TICK_SECONDS
} from "../physics";

const HESTIA_CUTTER_TREE_RELEASE_IMPULSE_NEWTON_SECONDS = 128 as const;

export interface SurfaceTreeReleaseVelocityInput {
  readonly pointMeters: SpatialVector3;
  readonly normal: SpatialVector3;
  readonly positionMeters: SpatialVector3;
  readonly inverseMassPerKg: number;
  readonly inverseInertiaTensorPerKgMetersSquared: StructuralInertiaTensor;
  readonly gravityMetersPerSecondSquared: number;
}

export interface SurfaceTreeReleaseVelocity {
  readonly impulseScale: number;
  readonly linearVelocityMetersPerSecond: SpatialVector3;
  readonly angularVelocityRadiansPerSecond: SpatialVector3;
}

const angularVelocityForImpulse = (
  input: Readonly<SurfaceTreeReleaseVelocityInput>,
  impulseNewtonSeconds: Readonly<SpatialVector3>
): SpatialVector3 => {
  const angularImpulseKgMetersSquaredPerSecond = crossSpatialVectors(
    subtractSpatialVectors(input.pointMeters, input.positionMeters),
    impulseNewtonSeconds
  );
  const inverseInertia = input.inverseInertiaTensorPerKgMetersSquared;
  return createSpatialVector3({
    x: inverseInertia.xx * angularImpulseKgMetersSquaredPerSecond.x
      + inverseInertia.xy * angularImpulseKgMetersSquaredPerSecond.y
      + inverseInertia.xz * angularImpulseKgMetersSquaredPerSecond.z,
    y: inverseInertia.xy * angularImpulseKgMetersSquaredPerSecond.x
      + inverseInertia.yy * angularImpulseKgMetersSquaredPerSecond.y
      + inverseInertia.yz * angularImpulseKgMetersSquaredPerSecond.z,
    z: inverseInertia.xz * angularImpulseKgMetersSquaredPerSecond.x
      + inverseInertia.yz * angularImpulseKgMetersSquaredPerSecond.y
      + inverseInertia.zz * angularImpulseKgMetersSquaredPerSecond.z
  }, "/surfaceTreeRelease/angularVelocityRadiansPerSecond");
};

const magnitude = (value: Readonly<SpatialVector3>): number =>
  Math.hypot(value.x, value.y, value.z);

const boundedRatio = (limit: number, value: number): number =>
  value === 0 ? Number.POSITIVE_INFINITY : limit / value;

export const deriveSurfaceTreeReleaseVelocity = (
  input: Readonly<SurfaceTreeReleaseVelocityInput>
): Readonly<SurfaceTreeReleaseVelocity> => {
  const impulseNewtonSeconds = scaleSpatialVector(
    input.normal,
    -HESTIA_CUTTER_TREE_RELEASE_IMPULSE_NEWTON_SECONDS
  );
  const rawLinearVelocityMetersPerSecond = scaleSpatialVector(
    impulseNewtonSeconds,
    input.inverseMassPerKg
  );
  const rawAngularVelocityRadiansPerSecond = angularVelocityForImpulse(
    input,
    impulseNewtonSeconds
  );
  const releaseSubstepBudget = SURFACE_RIGID_BODY_MAX_SUBSTEPS - 1;
  const linearLimitMetersPerSecond =
    releaseSubstepBudget * SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS
      / SURFACE_RIGID_BODY_TICK_SECONDS
    - Math.abs(input.gravityMetersPerSecondSquared) * SURFACE_RIGID_BODY_TICK_SECONDS;
  const angularLimitRadiansPerSecond =
    releaseSubstepBudget * SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS
      / SURFACE_RIGID_BODY_TICK_SECONDS;
  const impulseScale = Math.min(
    1,
    boundedRatio(linearLimitMetersPerSecond, magnitude(rawLinearVelocityMetersPerSecond)),
    boundedRatio(angularLimitRadiansPerSecond, magnitude(rawAngularVelocityRadiansPerSecond))
  );
  const boundedImpulseNewtonSeconds = scaleSpatialVector(impulseNewtonSeconds, impulseScale);
  return Object.freeze({
    impulseScale,
    linearVelocityMetersPerSecond: scaleSpatialVector(
      boundedImpulseNewtonSeconds,
      input.inverseMassPerKg
    ),
    angularVelocityRadiansPerSecond: angularVelocityForImpulse(
      input,
      boundedImpulseNewtonSeconds
    )
  });
};
