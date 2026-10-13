import {
  createFrameProjectionSnapshot,
  createRenderCommand,
  createVisibilityPlan,
  frameRevision,
  visibilityPlanRevision,
  type FrameId,
  type RenderBackend,
  type RenderCommand,
  type RenderCommandResult,
  type RepresentationKey
} from "../presentation";

export interface SurfaceLabProjectionCameraSnapshot {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly orientation: Readonly<{ x: number; y: number; z: number; w: number }>;
  readonly verticalFovDegrees: number;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
}

export interface SurfaceLabPresentationBackendOptions {
  readonly backend: RenderBackend;
  readonly readCamera: () => SurfaceLabProjectionCameraSnapshot;
}

const accepted = (result: RenderCommandResult): boolean =>
  result.status === "Accepted" || result.status === "AlreadyApplied";

const removalAccepted = (result: RenderCommandResult): boolean =>
  accepted(result) || result.status === "NotFound";

const requireAccepted = (result: RenderCommandResult, operation: string): void => {
  if (!accepted(result)) throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
};

/**
 * Adds Surface-Lab-owned projection and visibility commands without changing the
 * renderer or the deterministic generation controller contracts.
 */
export const createSurfaceLabPresentationBackend = (
  options: SurfaceLabPresentationBackendOptions
): RenderBackend => {
  const framesByRepresentation = new Map<RepresentationKey, FrameId>();
  let lastFrameId: FrameId | undefined;
  let projectionRevision = 0;

  const publishCurrentSet = (): void => {
    const frameId = framesByRepresentation.values().next().value ?? lastFrameId;
    if (frameId === undefined) return;
    for (const candidate of framesByRepresentation.values()) {
      if (candidate !== frameId) throw new Error("Surface Lab representations must share one projection frame.");
    }

    projectionRevision += 1;
    const camera = options.readCamera();
    const keys = [...framesByRepresentation.keys()];
    const backendRevision = options.backend.readDiagnostics().backendRevision;
    requireAccepted(options.backend.dispatch(createRenderCommand({
      kind: "ApplyFrameProjection",
      backendRevision,
      snapshot: createFrameProjectionSnapshot({
        frameId,
        frameRevision: frameRevision(projectionRevision),
        cameraPositionRelative: camera.position,
        cameraOrientation: camera.orientation,
        projectionParameters: {
          kind: "Perspective",
          verticalFovDegrees: camera.verticalFovDegrees,
          aspect: camera.aspect,
          near: camera.near,
          far: camera.far
        },
        representationTransforms: keys.map((representationKey) => ({
          representationKey,
          positionRelative: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 }
        }))
      })
    })), "Surface Lab frame projection");
    requireAccepted(options.backend.dispatch(createRenderCommand({
      kind: "ApplyVisibilityPlan",
      backendRevision,
      plan: createVisibilityPlan({
        planRevision: visibilityPlanRevision(projectionRevision),
        visibleRepresentationKeys: keys,
        fallbackRepresentationKeys: [],
        hiddenRepresentationKeys: []
      })
    })), "Surface Lab visibility plan");
  };

  const dispatch = (command: RenderCommand): RenderCommandResult => {
    const result = options.backend.dispatch(command);
    if (command.kind === "UpsertMeshArtifact" && accepted(result)) {
      lastFrameId = command.artifact.frameId;
      framesByRepresentation.set(command.artifact.representationKey, command.artifact.frameId);
      publishCurrentSet();
    } else if (command.kind === "RemoveRepresentation" && removalAccepted(result)) {
      framesByRepresentation.delete(command.representationKey);
      publishCurrentSet();
    } else if (command.kind === "ResetBackend" || command.kind === "DisposeBackend") {
      framesByRepresentation.clear();
      lastFrameId = undefined;
    }
    return result;
  };

  return Object.freeze({
    dispatch,
    renderFrame: () => options.backend.renderFrame(),
    getCapabilities: () => options.backend.getCapabilities(),
    readDiagnostics: () => options.backend.readDiagnostics()
  });
};
