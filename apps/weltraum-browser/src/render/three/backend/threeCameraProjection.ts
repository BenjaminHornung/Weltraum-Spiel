import * as THREE from "three";
import type { FrameProjectionSnapshot, RepresentationKey } from "../../../presentation";

const f32 = (value: number): number => Math.fround(value);

export const applyCameraProjection = (
  camera: THREE.PerspectiveCamera,
  snapshot: FrameProjectionSnapshot
): ReadonlyMap<RepresentationKey, FrameProjectionSnapshot["representationTransforms"][number]> => {
  const projection = snapshot.projectionParameters;
  camera.fov = f32(projection.verticalFovDegrees);
  camera.aspect = f32(projection.aspect);
  camera.near = f32(projection.near);
  camera.far = f32(projection.far);
  camera.position.set(
    f32(snapshot.cameraPositionRelative.x),
    f32(snapshot.cameraPositionRelative.y),
    f32(snapshot.cameraPositionRelative.z)
  );
  camera.quaternion.set(
    f32(snapshot.cameraOrientation.x),
    f32(snapshot.cameraOrientation.y),
    f32(snapshot.cameraOrientation.z),
    f32(snapshot.cameraOrientation.w)
  );
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return new Map(snapshot.representationTransforms.map((transform) => [transform.representationKey, transform]));
};

export const applyRepresentationTransform = (
  object: THREE.Object3D,
  transform: FrameProjectionSnapshot["representationTransforms"][number]
): void => {
  object.position.set(f32(transform.positionRelative.x), f32(transform.positionRelative.y), f32(transform.positionRelative.z));
  object.quaternion.set(
    f32(transform.orientation.x),
    f32(transform.orientation.y),
    f32(transform.orientation.z),
    f32(transform.orientation.w)
  );
  object.scale.set(f32(transform.scale.x), f32(transform.scale.y), f32(transform.scale.z));
  object.updateMatrix();
};
