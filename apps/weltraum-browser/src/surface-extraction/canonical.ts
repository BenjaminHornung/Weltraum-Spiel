import {
  canonicalEnvironmentJson,
  deepFreeze,
  environmentSignature
} from "../planetary-environment/index";

export class SurfaceExtractionCanonicalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SurfaceExtractionCanonicalError";
  }
}

export const canonicalSurfaceExtractionJson = (value: unknown): string => canonicalEnvironmentJson(value);

export const surfaceExtractionSignature = (value: unknown): string => {
  const hash = environmentSignature(value).replace(/^fnv1a32:/, "");
  return `weltraum.surface-extraction/v1/fnv1a32:${hash}`;
};

export const freezeSurfaceExtraction = <T>(value: T): Readonly<T> => deepFreeze(value);

export const cloneAndFreezeSurfaceExtraction = <T>(value: T): Readonly<T> => {
  try {
    return deepFreeze(JSON.parse(canonicalSurfaceExtractionJson(value)) as T);
  } catch (error) {
    if (error instanceof Error) {
      throw new SurfaceExtractionCanonicalError(error.message);
    }
    throw error;
  }
};
