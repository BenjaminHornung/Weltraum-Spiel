import {
  canonicalValuesEqual,
  cloneCanonicalValue,
  identifier,
  inverseQuaternion,
  multiplyQuaternions,
  quaternion,
  revision,
  vector3
} from "./internal";
import {
  bodyFixedToSurfaceLocal,
  surfaceLocalToBodyFixed,
  transformDirectionBodyFixedToLocal,
  transformDirectionLocalToBodyFixed,
  validateSurfaceLocalFrame
} from "./frame";
import {
  ABSOLUTE_SURFACE_STATE_SCHEMA,
  PROJECTED_SURFACE_STATE_SCHEMA,
  SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
  SurfaceLocalFrameError,
  type AbsoluteSurfaceDirection,
  type AbsoluteSurfaceState,
  type ProjectedSurfaceDirection,
  type ProjectedSurfaceState,
  type SurfaceCanonicalValue,
  type SurfaceLocalFrame,
  type SurfaceQuaternion,
  type SurfaceSemanticIdentity,
  type SurfaceVector3
} from "./types";

export interface CreateAbsoluteSurfaceStateInput {
  readonly stateId: string;
  readonly semanticIdentity: SurfaceSemanticIdentity;
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly bodyRevision: number;
  readonly positionBodyFixedMeters: SurfaceVector3;
  readonly velocityBodyFixedMetersPerSecond: SurfaceVector3;
  readonly orientationBodyFixed?: SurfaceQuaternion;
  readonly directionsBodyFixed?: readonly AbsoluteSurfaceDirection[];
}

const semanticIdentity = (value: SurfaceSemanticIdentity): SurfaceSemanticIdentity => {
  if (value === null || typeof value !== "object") {
    throw new SurfaceLocalFrameError("InvalidIdentifier", "Semantic identity is required.");
  }
  return Object.freeze({
    kind: identifier(value.kind, "Semantic identity kind"),
    id: identifier(value.id, "Semantic identity ID")
  });
};

const absoluteDirections = (
  values: readonly AbsoluteSurfaceDirection[] | undefined
): readonly AbsoluteSurfaceDirection[] | undefined => {
  if (values === undefined) {
    return undefined;
  }
  if (!Array.isArray(values)) {
    throw new SurfaceLocalFrameError("InvalidVector", "Body-fixed directions must be an array.");
  }
  const ids = new Set<string>();
  return Object.freeze(values.map((value, index) => {
    const id = identifier(value.id, `Body-fixed direction ${index} ID`);
    if (ids.has(id)) {
      throw new SurfaceLocalFrameError("InvalidIdentifier", `Body-fixed direction ID ${id} is duplicated.`);
    }
    ids.add(id);
    return Object.freeze({ id, valueBodyFixed: vector3(value.valueBodyFixed, `Body-fixed direction ${id}`) });
  }));
};

export const createAbsoluteSurfaceState = (input: CreateAbsoluteSurfaceStateInput): AbsoluteSurfaceState => {
  const directions = absoluteDirections(input.directionsBodyFixed);
  const result: AbsoluteSurfaceState = {
    schema: ABSOLUTE_SURFACE_STATE_SCHEMA,
    schemaVersion: SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
    stateId: identifier(input.stateId, "Absolute state ID"),
    semanticIdentity: semanticIdentity(input.semanticIdentity),
    bodyId: identifier(input.bodyId, "Absolute state body ID"),
    bodyFixedFrameId: identifier(input.bodyFixedFrameId, "Absolute state body-fixed frame ID"),
    bodyRevision: revision(input.bodyRevision, "Absolute state body revision"),
    positionBodyFixedMeters: vector3(input.positionBodyFixedMeters, "Absolute body-fixed position"),
    velocityBodyFixedMetersPerSecond: vector3(input.velocityBodyFixedMetersPerSecond, "Absolute body-fixed velocity"),
    ...(input.orientationBodyFixed === undefined
      ? {}
      : { orientationBodyFixed: quaternion(input.orientationBodyFixed, "Absolute body-fixed orientation") }),
    ...(directions === undefined ? {} : { directionsBodyFixed: directions })
  };
  return Object.freeze(result);
};

const assertAbsoluteAuthority = (state: AbsoluteSurfaceState, frame: SurfaceLocalFrame): void => {
  if (
    state.bodyId !== frame.bodyId ||
    state.bodyFixedFrameId !== frame.bodyFixedFrameId ||
    state.bodyRevision !== frame.shape.revision
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Absolute state authority does not match the surface frame.");
  }
};

const assertProjectedAuthority = (state: ProjectedSurfaceState, frame: SurfaceLocalFrame): void => {
  if (
    state.bodyId !== frame.bodyId ||
    state.bodyFixedFrameId !== frame.bodyFixedFrameId ||
    state.bodyRevision !== frame.shape.revision ||
    state.surfaceFrameId !== frame.surfaceFrameId ||
    state.frameRevision !== frame.revision ||
    state.anchorId !== frame.anchor.anchorId ||
    state.anchorRevision !== frame.anchor.revision
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Projected state authority does not match the surface frame.");
  }
  assertCanonicalAuthorityContext(state, frame);
};

const hasOwnAuthorityContext = (value: object): boolean => Object.hasOwn(value, "authorityContext");

const assertCanonicalAuthorityContext = (
  left: { readonly authorityContext?: SurfaceCanonicalValue },
  right: { readonly authorityContext?: SurfaceCanonicalValue }
): void => {
  const leftHasContext = hasOwnAuthorityContext(left);
  const rightHasContext = hasOwnAuthorityContext(right);
  if (
    leftHasContext !== rightHasContext ||
    (leftHasContext && (
      left.authorityContext === undefined ||
      right.authorityContext === undefined ||
      !canonicalValuesEqual(left.authorityContext, right.authorityContext)
    ))
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Surface frame authority contexts do not match canonically.");
  }
};

export const projectAbsoluteSurfaceState = (
  stateInput: CreateAbsoluteSurfaceStateInput | AbsoluteSurfaceState,
  frame: SurfaceLocalFrame
): ProjectedSurfaceState => {
  validateSurfaceLocalFrame(frame);
  const state = createAbsoluteSurfaceState(stateInput);
  assertAbsoluteAuthority(state, frame);
  const directions: readonly ProjectedSurfaceDirection[] | undefined = state.directionsBodyFixed === undefined
    ? undefined
    : Object.freeze(state.directionsBodyFixed.map((direction) => Object.freeze({
      id: direction.id,
      valueLocal: transformDirectionBodyFixedToLocal(direction.valueBodyFixed, frame)
    })));
  const result: ProjectedSurfaceState = {
    schema: PROJECTED_SURFACE_STATE_SCHEMA,
    schemaVersion: SURFACE_LOCAL_FRAME_SCHEMA_VERSION,
    stateId: state.stateId,
    semanticIdentity: state.semanticIdentity,
    bodyId: state.bodyId,
    bodyFixedFrameId: state.bodyFixedFrameId,
    bodyRevision: state.bodyRevision,
    surfaceFrameId: frame.surfaceFrameId,
    frameRevision: frame.revision,
    anchorId: frame.anchor.anchorId,
    anchorRevision: frame.anchor.revision,
    ...(frame.authorityContext === undefined
      ? {}
      : { authorityContext: cloneCanonicalValue(frame.authorityContext, "Projected state authority context") }),
    positionLocalMeters: bodyFixedToSurfaceLocal(state.positionBodyFixedMeters, frame),
    velocityLocalMetersPerSecond: transformDirectionBodyFixedToLocal(state.velocityBodyFixedMetersPerSecond, frame),
    ...(state.orientationBodyFixed === undefined
      ? {}
      : {
          orientationLocal: multiplyQuaternions(
            inverseQuaternion(frame.orientationLocalToBodyFixed),
            state.orientationBodyFixed
          )
        }),
    ...(directions === undefined ? {} : { directionsLocal: directions })
  };
  return Object.freeze(result);
};

export const restoreAbsoluteSurfaceState = (
  state: ProjectedSurfaceState,
  frame: SurfaceLocalFrame
): AbsoluteSurfaceState => {
  validateSurfaceLocalFrame(frame);
  if (state === null || typeof state !== "object" || state.schema !== PROJECTED_SURFACE_STATE_SCHEMA || state.schemaVersion !== 1) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "A version 1 projected surface state is required.");
  }
  assertProjectedAuthority(state, frame);
  const directions = state.directionsLocal === undefined
    ? undefined
    : state.directionsLocal.map((direction, index) => ({
        id: identifier(direction.id, `Local direction ${index} ID`),
        valueBodyFixed: transformDirectionLocalToBodyFixed(direction.valueLocal, frame)
      }));
  return createAbsoluteSurfaceState({
    stateId: state.stateId,
    semanticIdentity: state.semanticIdentity,
    bodyId: state.bodyId,
    bodyFixedFrameId: state.bodyFixedFrameId,
    bodyRevision: state.bodyRevision,
    positionBodyFixedMeters: surfaceLocalToBodyFixed(state.positionLocalMeters, frame),
    velocityBodyFixedMetersPerSecond: transformDirectionLocalToBodyFixed(state.velocityLocalMetersPerSecond, frame),
    ...(state.orientationLocal === undefined
      ? {}
      : {
          orientationBodyFixed: multiplyQuaternions(
            frame.orientationLocalToBodyFixed,
            quaternion(state.orientationLocal, "Local orientation")
          )
        }),
    ...(directions === undefined ? {} : { directionsBodyFixed: directions })
  });
};

export const reanchorSurfaceLocalFrame = (
  state: ProjectedSurfaceState,
  currentFrame: SurfaceLocalFrame,
  nextFrame: SurfaceLocalFrame
): ProjectedSurfaceState => {
  validateSurfaceLocalFrame(currentFrame);
  validateSurfaceLocalFrame(nextFrame);
  if (
    currentFrame.bodyId !== nextFrame.bodyId ||
    currentFrame.bodyFixedFrameId !== nextFrame.bodyFixedFrameId ||
    currentFrame.shape.revision !== nextFrame.shape.revision ||
    currentFrame.shape.kind !== nextFrame.shape.kind ||
    currentFrame.shape.semiMajorAxisMeters !== nextFrame.shape.semiMajorAxisMeters ||
    currentFrame.shape.semiMinorAxisMeters !== nextFrame.shape.semiMinorAxisMeters
  ) {
    throw new SurfaceLocalFrameError("AuthorityMismatch", "Reanchoring requires identical body authority and body revision.");
  }
  assertCanonicalAuthorityContext(currentFrame, nextFrame);
  return projectAbsoluteSurfaceState(restoreAbsoluteSurfaceState(state, currentFrame), nextFrame);
};
