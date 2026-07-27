import {
  createSurfaceCapsuleSweepResult,
  createSurfaceCollisionRejection,
  createSurfaceGroundContactResult,
  createSurfaceLineResult,
  createSurfaceRayResult,
  type SurfaceAuthorityBinding,
  type SurfaceCapsuleSweepQuery,
  type SurfaceCapsuleSweepResult,
  type SurfaceCapsuleSweepResultInput,
  type SurfaceCollisionQueryPort,
  type SurfaceCollisionRejection,
  type SurfaceCollisionRejectionCode,
  type SurfaceGroundContactQuery,
  type SurfaceGroundContactResult,
  type SurfaceGroundContactResultInput,
  type SurfaceLineQuery,
  type SurfaceLineResult,
  type SurfaceLineResultInput,
  type SurfaceRayQuery,
  type SurfaceRayResult,
  type SurfaceRayResultInput
} from "../contracts";

export interface SurfaceCollisionDelegate {
  queryGroundContact(query: SurfaceGroundContactQuery): SurfaceGroundContactResultInput;
  sweepCapsule(query: SurfaceCapsuleSweepQuery): SurfaceCapsuleSweepResultInput;
  queryRay(query: SurfaceRayQuery): SurfaceRayResultInput;
  queryLine(query: SurfaceLineQuery): SurfaceLineResultInput;
}

export interface RevisionBoundSurfaceCollisionPortOptions {
  readonly readAuthorityBinding: () => Readonly<SurfaceAuthorityBinding>;
  readonly delegate: SurfaceCollisionDelegate;
}

type BoundQuery = SurfaceGroundContactQuery | SurfaceCapsuleSweepQuery | SurfaceRayQuery | SurfaceLineQuery;

const rejection = (
  query: BoundQuery,
  code: SurfaceCollisionRejectionCode,
  message: string
): SurfaceCollisionRejection =>
  createSurfaceCollisionRejection({
    status: "Rejected",
    queryId: query.queryId,
    code,
    message
  });

const validateBinding = (
  query: BoundQuery,
  binding: Readonly<SurfaceAuthorityBinding>
): SurfaceCollisionRejection | null => {
  if (query.bodyId !== binding.bodyId) return rejection(query, "BodyMismatch", "Collision body does not match current authority.");
  if (query.regionId !== binding.regionId) return rejection(query, "RegionMismatch", "Collision region does not match current authority.");
  if (query.surfaceFrameId !== binding.surfaceFrameId) return rejection(query, "FrameMismatch", "Collision frame does not match current authority.");
  if (query.regionRevision !== binding.regionRevision) return rejection(query, "StaleRevision", "Collision revision is not current.");
  if (query.simulationTick !== binding.simulationTick) return rejection(query, "StaleTick", "Collision tick is not current.");
  return null;
};

const resolve = <TInput extends { readonly queryId: string }, TResult>(
  query: BoundQuery,
  readAuthorityBinding: () => Readonly<SurfaceAuthorityBinding>,
  invoke: () => TInput,
  createResult: (input: TInput) => TResult
): TResult | SurfaceCollisionRejection => {
  try {
    const bindingRejection = validateBinding(query, readAuthorityBinding());
    if (bindingRejection !== null) return bindingRejection;
    const input = invoke();
    if (input.queryId !== query.queryId) {
      return rejection(query, "AuthorityUnavailable", "Collision delegate returned a mismatched query identity.");
    }
    return createResult(input);
  } catch {
    return rejection(query, "AuthorityUnavailable", "Collision authority returned invalid or unavailable data.");
  }
};

export const createRevisionBoundSurfaceCollisionPort = (
  options: RevisionBoundSurfaceCollisionPortOptions
): SurfaceCollisionQueryPort => ({
  queryGroundContact(query): SurfaceGroundContactResult {
    return resolve(
      query,
      options.readAuthorityBinding,
      () => options.delegate.queryGroundContact(query),
      createSurfaceGroundContactResult
    );
  },
  sweepCapsule(query): SurfaceCapsuleSweepResult {
    return resolve(
      query,
      options.readAuthorityBinding,
      () => options.delegate.sweepCapsule(query),
      createSurfaceCapsuleSweepResult
    );
  },
  queryRay(query): SurfaceRayResult {
    return resolve(query, options.readAuthorityBinding, () => options.delegate.queryRay(query), createSurfaceRayResult);
  },
  queryLine(query): SurfaceLineResult {
    return resolve(query, options.readAuthorityBinding, () => options.delegate.queryLine(query), createSurfaceLineResult);
  }
});
