import { canonicalCelestialJson, canonicalizeCelestialValue } from "../celestial/canonical";
import type { CelestialBodyDefinition } from "../celestial/types";
import { createCelestialBodyDefinition } from "../celestial/validation";
import { createBodyFixedFrameId } from "../spatial/ids";
import { normalizeSpatialVector } from "../spatial/quaternion";
import type { SpatialVector3 } from "../spatial/types";
import { validateVoxelStableId } from "../voxel/ids";
import { fbm3, fnv1a32Ascii } from "./latticeNoise";
import { PLANETARY_MACRO_IMPLEMENTATION_DIGEST } from "./planetaryMacroModelPin";

export interface PlanetaryMacroRef { readonly id: string; readonly version: number; readonly digest: `sha256:${string}` }
export interface PlanetaryMacroProfile {
  readonly id: string; readonly version: number; readonly seed: string; readonly amplitudeMeters: number;
  readonly liquidEnvelope: "GeometricCandidateBelowDatum0";
  readonly materialPolicy: "ExplicitId0SolidRockAndUnusedAirSamples";
}
export const PLANETARY_MACRO_GENERATOR = "pmd.global-fbm3.v1";
export const PLANETARY_MACRO_KNOWLEDGE = Object.freeze({ physicalComposition: "UNKNOWN" as const,
  realReservoirInventory: "UNKNOWN" as const, biome: "UNKNOWN" as const });
export interface PlanetaryMacroSource extends PlanetaryMacroRef {
  readonly schema: "pmd.generated-global/v1"; readonly bodyId: string; readonly radiusMeters: number;
  readonly bodyContext: { readonly radiusMeters: number; readonly rotation: CelestialBodyDefinition["rotation"] };
  readonly sourceOwner: "pmd.generated-global"; readonly sourceRevision: "1";
  readonly terrainGenerator: PlanetaryMacroRef;
  readonly bodyFixed: { readonly frameId: string; readonly northAxis: "+Z"; readonly datum: "RadiusSphere" };
  readonly profile: PlanetaryMacroProfile;
  readonly longSeed: number; readonly detailSeed: number;
  readonly minimumElevationMeters: number; readonly maximumElevationMeters: number;
  readonly missingFaces: readonly string[]; readonly coverage: readonly string[];
  readonly provenance: { readonly kind: "GeneratedCandidate"; readonly note: string };
  readonly knowledge: typeof PLANETARY_MACRO_KNOWLEDGE;
}
export interface PlanetaryMacroSample {
  readonly elevationMeters: number; readonly landFraction: number; readonly openLiquidFraction: number; readonly roughness: number;
  readonly reservoir: { readonly status: "UNKNOWN" }; readonly physicalComposition: "UNKNOWN";
  readonly realReservoirInventory: "UNKNOWN"; readonly biome: "UNKNOWN";
}
export async function planetaryMacroDigest(value: unknown): Promise<`sha256:${string}`> {
  const bytes = new TextEncoder().encode(canonicalCelestialJson(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${Array.from(digest, b => b.toString(16).padStart(2, "0")).join("")}`;
}
function profileForBody(raw: PlanetaryMacroProfile, body: CelestialBodyDefinition): PlanetaryMacroProfile {
  const p = canonicalizeCelestialValue(raw) as unknown as PlanetaryMacroProfile;
  if (Object.keys(p).sort().join("|") !== "amplitudeMeters|id|liquidEnvelope|materialPolicy|seed|version"
    || !validateVoxelStableId(p.id).valid || !Number.isSafeInteger(p.version) || p.version < 1
    || typeof p.seed !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(p.seed)
    || !Number.isFinite(p.amplitudeMeters) || p.amplitudeMeters < 0 || p.amplitudeMeters >= body.radiusMeters
    || p.liquidEnvelope !== "GeometricCandidateBelowDatum0" || p.materialPolicy !== "ExplicitId0SolidRockAndUnusedAirSamples") {
    throw new TypeError("PMD_PROFILE");
  }
  return p;
}
export async function createPlanetaryMacroSource(rawBody: CelestialBodyDefinition, rawProfile: PlanetaryMacroProfile): Promise<PlanetaryMacroSource> {
  const body = createCelestialBodyDefinition(rawBody), profile = profileForBody(rawProfile, body);
  const seed = (domain: string) => fnv1a32Ascii(`${profile.seed}\0${body.bodyId}\0${PLANETARY_MACRO_GENERATOR}\0${domain}`);
  const payload = { id: profile.id, version: profile.version, schema: "pmd.generated-global/v1" as const,
    bodyId: body.bodyId, radiusMeters: body.radiusMeters, bodyContext: { radiusMeters: body.radiusMeters, rotation: body.rotation },
    sourceOwner: "pmd.generated-global" as const, sourceRevision: "1" as const,
    terrainGenerator: { id: PLANETARY_MACRO_GENERATOR, version: 1, digest: PLANETARY_MACRO_IMPLEMENTATION_DIGEST },
    bodyFixed: { frameId: createBodyFixedFrameId(body.bodyId), northAxis: "+Z" as const, datum: "RadiusSphere" as const },
    profile, longSeed: seed("long"), detailSeed: seed("detail"),
    minimumElevationMeters: -profile.amplitudeMeters, maximumElevationMeters: profile.amplitudeMeters,
    missingFaces: [], coverage: ["px", "nx", "py", "ny", "pz", "nz"],
    provenance: { kind: "GeneratedCandidate" as const, note: "Candidate geography and geometric liquid envelope; not existing geography or physical inventory." },
    knowledge: PLANETARY_MACRO_KNOWLEDGE };
  return canonicalizeCelestialValue({ ...payload, digest: await planetaryMacroDigest(payload) }) as unknown as PlanetaryMacroSource;
}
export async function validatePlanetaryMacro(source: PlanetaryMacroSource, expectedBody: CelestialBodyDefinition,
  expectedProfile: PlanetaryMacroProfile): Promise<PlanetaryMacroSource> {
  const detached = canonicalizeCelestialValue(source) as unknown as PlanetaryMacroSource;
  const expected = await createPlanetaryMacroSource(expectedBody, expectedProfile);
  if (canonicalCelestialJson(detached) !== canonicalCelestialJson(expected)) throw new TypeError("PMD_SOURCE_MISMATCH");
  return detached;
}
export function samplePlanetaryMacro(source: PlanetaryMacroSource, bodyFixedPoint: SpatialVector3): PlanetaryMacroSample {
  const n = normalizeSpatialVector(bodyFixedPoint);
  const long = fbm3(source.longSeed, 2 * n.x, 2 * n.y, 2 * n.z, 4);
  const detail = fbm3(source.detailSeed, 16 * n.x, 16 * n.y, 16 * n.z, 3);
  const elevationMeters = source.profile.amplitudeMeters * (0.75 * long + 0.25 * detail);
  if (long < -1 || long > 1 || detail < -1 || detail > 1 || !Number.isFinite(elevationMeters)
    || elevationMeters < source.minimumElevationMeters || elevationMeters > source.maximumElevationMeters) throw new RangeError("PMD_NOISE_BOUNDS");
  const landFraction = elevationMeters >= 0 ? 1 : 0;
  return Object.freeze({ elevationMeters, landFraction, openLiquidFraction: 1 - landFraction, roughness: Math.abs(detail),
    reservoir: Object.freeze({ status: "UNKNOWN" as const }), ...PLANETARY_MACRO_KNOWLEDGE });
}
