import { parseExternalReferenceId, type ExternalReferenceId, type PersistenceBrand } from "../persistence/ids";
import type { CelestialBodyId } from "../celestial/ids";
import { failSpatial } from "./errors";

export type FrameId = PersistenceBrand<ExternalReferenceId, "FrameId">;

export const parseFrameId = (value: unknown, path = ""): FrameId => {
  const parsed = parseExternalReferenceId(value, path);
  if (!parsed.startsWith("frame:")) {
    return failSpatial("INVALID_FRAME_ID", path, "Frame ID must use the frame: namespace.");
  }
  return parsed as FrameId;
};

export const createSystemInertialFrameId = (suffix = "system"): FrameId => parseFrameId(`frame:${suffix}`);

export const createBodyInertialFrameId = (bodyId: CelestialBodyId | string): FrameId =>
  parseFrameId(`frame:body-inertial.${bodyId}`);

export const createBodyFixedFrameId = (bodyId: CelestialBodyId | string): FrameId =>
  parseFrameId(`frame:body-fixed.${bodyId}`);

export const createSurfaceLocalFrameId = (suffix: string): FrameId => parseFrameId(`frame:surface.${suffix}`);
