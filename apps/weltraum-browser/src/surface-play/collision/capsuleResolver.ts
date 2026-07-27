import { add, dot, magnitude, scale, sub, vec3, type Vec3 } from "../../core/vector";
import {
  createSurfaceCapsuleSweepQuery,
  createSurfaceCollisionRejection,
  createSurfaceGroundContactQuery,
  type SurfaceAuthorityBindingInput,
  type SurfaceCapsule,
  type SurfaceCollisionQueryPort,
  type SurfaceCollisionRejection,
  type SurfaceContact
} from "../contracts";

export interface SurfaceCapsuleMotionConfig {
  readonly maximumSlopeRadians: number;
  readonly stepHeightMeters: number;
  readonly collisionSkinMeters: number;
  readonly groundProbeDistanceMeters: number;
  readonly maximumSlideIterations: number;
}

export interface SurfaceCapsuleMotionRequest {
  readonly binding: SurfaceAuthorityBindingInput;
  readonly queryIdPrefix: string;
  readonly capsule: SurfaceCapsule;
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
  readonly displacementMeters: Vec3;
  readonly wasGrounded: boolean;
}

export type SurfaceCapsuleMotionResult =
  | Readonly<{
    readonly status: "Resolved";
    readonly positionMeters: Vec3;
    readonly velocityMetersPerSecond: Vec3;
    readonly grounded: boolean;
    readonly groundNormal: Vec3;
    readonly contacts: readonly SurfaceContact[];
  }>
  | Readonly<{
    readonly status: "Rejected";
    readonly rejection: SurfaceCollisionRejection;
  }>;

const UP = vec3(0, 1, 0);
const ZERO = vec3();

const queryId = (prefix: string, phase: string, index: number): string =>
  `${prefix}:${phase}:${index}`;

const isWalkable = (normal: Vec3, maximumSlopeRadians: number): boolean =>
  dot(normal, UP) >= Math.cos(maximumSlopeRadians);

const withoutIntoNormal = (value: Vec3, normal: Vec3): Vec3 => {
  const intoNormal = dot(value, normal);
  return intoNormal < 0 ? sub(value, scale(normal, intoNormal)) : value;
};

const unavailable = (request: SurfaceCapsuleMotionRequest, message: string): SurfaceCapsuleMotionResult => ({
  status: "Rejected",
  rejection: createSurfaceCollisionRejection({
    status: "Rejected",
    queryId: queryId(request.queryIdPrefix, "invalid", 0),
    code: "AuthorityUnavailable",
    message
  })
});

const sweep = (
  port: SurfaceCollisionQueryPort,
  request: SurfaceCapsuleMotionRequest,
  positionMeters: Vec3,
  displacementMeters: Vec3,
  phase: string,
  index: number
) => port.sweepCapsule(createSurfaceCapsuleSweepQuery({
  ...request.binding,
  kind: "CapsuleSweep",
  queryId: queryId(request.queryIdPrefix, phase, index),
  capsule: request.capsule,
  startPositionMeters: positionMeters,
  displacementMeters
}));

const tryStep = (
  port: SurfaceCollisionQueryPort,
  request: SurfaceCapsuleMotionRequest,
  config: SurfaceCapsuleMotionConfig,
  positionMeters: Vec3,
  horizontalDisplacement: Vec3,
  iteration: number
): SurfaceCapsuleMotionResult | null => {
  if (!request.wasGrounded || magnitude(horizontalDisplacement) <= 1e-9) return null;

  const upDisplacement = vec3(0, config.stepHeightMeters, 0);
  const upResult = sweep(port, request, positionMeters, upDisplacement, "step_up", iteration);
  if (upResult.status === "Rejected") return { status: "Rejected", rejection: upResult };
  if (upResult.contact !== null && upResult.fraction < 1) return null;

  const raisedPosition = add(positionMeters, upDisplacement);
  const forwardResult = sweep(port, request, raisedPosition, horizontalDisplacement, "step_forward", iteration);
  if (forwardResult.status === "Rejected") return { status: "Rejected", rejection: forwardResult };
  if (forwardResult.contact !== null && forwardResult.fraction < 1) return null;

  const forwardPosition = add(raisedPosition, horizontalDisplacement);
  const downDistance = config.stepHeightMeters + config.groundProbeDistanceMeters;
  const downDisplacement = vec3(0, -downDistance, 0);
  const downResult = sweep(port, request, forwardPosition, downDisplacement, "step_down", iteration);
  if (downResult.status === "Rejected") return { status: "Rejected", rejection: downResult };
  if (downResult.contact === null || !isWalkable(downResult.contact.normal, config.maximumSlopeRadians)) return null;

  const skinFraction = config.collisionSkinMeters / downDistance;
  const travelFraction = Math.max(0, downResult.fraction - skinFraction);
  return {
    status: "Resolved",
    positionMeters: add(forwardPosition, scale(downDisplacement, travelFraction)),
    velocityMetersPerSecond: withoutIntoNormal(request.velocityMetersPerSecond, downResult.contact.normal),
    grounded: true,
    groundNormal: downResult.contact.normal,
    contacts: [downResult.contact]
  };
};

export const resolveSurfaceCapsuleMotion = (
  port: SurfaceCollisionQueryPort,
  request: SurfaceCapsuleMotionRequest,
  config: SurfaceCapsuleMotionConfig
): SurfaceCapsuleMotionResult => {
  if (
    !Number.isFinite(config.maximumSlopeRadians)
    || config.maximumSlopeRadians <= 0
    || config.maximumSlopeRadians >= Math.PI / 2
    || !Number.isFinite(config.stepHeightMeters)
    || config.stepHeightMeters < 0
    || !Number.isFinite(config.collisionSkinMeters)
    || config.collisionSkinMeters < 0
    || !Number.isFinite(config.groundProbeDistanceMeters)
    || config.groundProbeDistanceMeters < 0
    || !Number.isSafeInteger(config.maximumSlideIterations)
    || config.maximumSlideIterations < 1
  ) {
    return unavailable(request, "Capsule motion configuration is invalid.");
  }

  let positionMeters = request.positionMeters;
  let velocityMetersPerSecond = request.velocityMetersPerSecond;
  let remaining = request.displacementMeters;
  const contacts: SurfaceContact[] = [];

  for (let iteration = 0; iteration < config.maximumSlideIterations && magnitude(remaining) > 1e-9; iteration += 1) {
    const result = sweep(port, request, positionMeters, remaining, "motion", iteration);
    if (result.status === "Rejected") return { status: "Rejected", rejection: result };
    if (result.contact === null || result.fraction >= 1) {
      positionMeters = add(positionMeters, remaining);
      remaining = ZERO;
      break;
    }

    const contact = result.contact;
    contacts.push(contact);
    const horizontal = vec3(remaining.x, 0, remaining.z);
    if (!isWalkable(contact.normal, config.maximumSlopeRadians)) {
      const stepped = tryStep(port, request, config, positionMeters, horizontal, iteration);
      if (stepped?.status === "Rejected") return stepped;
      if (stepped?.status === "Resolved") {
        return {
          ...stepped,
          contacts: [...contacts, ...stepped.contacts]
        };
      }
    }

    const distanceMeters = magnitude(remaining);
    const skinFraction = distanceMeters <= 1e-9 ? 0 : config.collisionSkinMeters / distanceMeters;
    const travelFraction = Math.max(0, result.fraction - skinFraction);
    positionMeters = add(positionMeters, scale(remaining, travelFraction));
    velocityMetersPerSecond = withoutIntoNormal(velocityMetersPerSecond, contact.normal);
    const unresolved = scale(remaining, Math.max(0, 1 - result.fraction));
    remaining = withoutIntoNormal(unresolved, contact.normal);
    if (!isWalkable(contact.normal, config.maximumSlopeRadians) && remaining.y > 0) {
      remaining = vec3(remaining.x, 0, remaining.z);
    }
  }

  const groundResult = port.queryGroundContact(createSurfaceGroundContactQuery({
    ...request.binding,
    kind: "GroundContact",
    queryId: queryId(request.queryIdPrefix, "ground", 0),
    capsule: request.capsule,
    positionMeters,
    maximumDistanceMeters: config.groundProbeDistanceMeters
  }));
  if (groundResult.status === "Rejected") return { status: "Rejected", rejection: groundResult };

  const groundContact = groundResult.contact;
  const grounded = groundContact !== null
    && groundContact.distanceMeters <= config.groundProbeDistanceMeters
    && isWalkable(groundContact.normal, config.maximumSlopeRadians);
  if (grounded && groundContact !== null) {
    velocityMetersPerSecond = withoutIntoNormal(velocityMetersPerSecond, groundContact.normal);
    contacts.push(groundContact);
  }

  const values = [
    positionMeters.x,
    positionMeters.y,
    positionMeters.z,
    velocityMetersPerSecond.x,
    velocityMetersPerSecond.y,
    velocityMetersPerSecond.z
  ];
  if (!values.every(Number.isFinite)) return unavailable(request, "Capsule motion produced non-finite state.");

  return {
    status: "Resolved",
    positionMeters,
    velocityMetersPerSecond,
    grounded,
    groundNormal: grounded && groundContact !== null ? groundContact.normal : UP,
    contacts
  };
};
