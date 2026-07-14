import { createCelestialBodyId, type CelestialBodyId } from "../celestial/ids";
import { parseExternalReferenceId, type ExternalReferenceId, type PersistenceBrand } from "../persistence/ids";
import { failPhysicsSpace } from "./errors";

export type PhysicsSpaceId = PersistenceBrand<ExternalReferenceId, "PhysicsSpaceId">;
export type PhysicsProbeId = PersistenceBrand<ExternalReferenceId, "PhysicsProbeId">;
export type GravitySourceBindingId = CelestialBodyId;

export const parsePhysicsSpaceId = (value: unknown, path = ""): PhysicsSpaceId => {
  const parsed = parseExternalReferenceId(value, path);
  if (!parsed.startsWith("physics-space:")) {
    return failPhysicsSpace("INVALID_PHYSICS_SPACE_ID", path, "Physics space ID must use the physics-space: namespace.");
  }
  return parsed as PhysicsSpaceId;
};

export const parsePhysicsProbeId = (value: unknown, path = ""): PhysicsProbeId => {
  const parsed = parseExternalReferenceId(value, path);
  if (!parsed.startsWith("probe:")) {
    return failPhysicsSpace("INVALID_PROBE_ID", path, "Physics probe ID must use the probe: namespace.");
  }
  return parsed as PhysicsProbeId;
};

export const parseGravitySourceBindingId = (value: unknown, path = ""): GravitySourceBindingId =>
  createCelestialBodyId(value, path);
