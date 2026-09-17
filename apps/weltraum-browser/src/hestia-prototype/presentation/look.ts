import {
  createMaterialProfile,
  materialProfileId,
  type MaterialProfile
} from "../../presentation";

export type HvpLookVariant = "readable";

export type HvpLookMaterialRole =
  | "limestone-dry"
  | "limestone-wet"
  | "soil"
  | "moss";

export interface HvpCanonicalMaterialState {
  readonly materialIds: readonly string[];
  readonly densityKgPerM3: readonly number[];
  readonly contentHash: string;
}

export interface HvpLookMaterial {
  readonly role: HvpLookMaterialRole;
  readonly materialProfile: MaterialProfile;
}

export interface HvpWaterPresentation {
  readonly transparent: true;
  readonly depthWrite: false;
  readonly renderOrder: 1;
  readonly collision: "none";
  readonly physics: "not-simulated";
  readonly opacity: number;
  readonly materialProfile: MaterialProfile;
}

/** Fail-closed contract for the render-only water surface. */
export const assertHvpWaterPresentation = (water: HvpWaterPresentation): void => {
  if (water.transparent !== true || water.depthWrite !== false || water.renderOrder !== 1) {
    throw new Error("HVP water must be transparent, depth-write disabled, and render at order 1.");
  }
  if (!(water.opacity > 0) || !(water.opacity < 1) || water.materialProfile.opacity !== water.opacity) {
    throw new Error("HVP water opacity must stay strictly between 0 and 1.");
  }
  if (water.materialProfile.depthWrite !== false || water.collision !== "none" || water.physics !== "not-simulated") {
    throw new Error("HVP water must remain presentation-only and non-colliding.");
  }
};

export interface HvpLightRole {
  readonly color: number;
  readonly intensity: number;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  /** Hemisphere ground bounce; declared on the ambient role only. */
  readonly groundColor?: number;
}

export interface HvpLookProfile {
  readonly id: string;
  readonly variant: HvpLookVariant;
  readonly materials: readonly HvpLookMaterial[];
  readonly water: HvpWaterPresentation;
  readonly lighting: Readonly<{
    readonly ambient: HvpLightRole;
    readonly key: HvpLightRole;
    readonly fill: HvpLightRole;
  }>;
  readonly background: Readonly<{
    readonly color: number;
    readonly fogNear: number;
    readonly fogFar: number;
  }>;
  readonly distantCoast: Readonly<{
    readonly editable: false;
    readonly radiusMeters: number;
  }>;
}

export interface HvpLookProjection extends HvpCanonicalMaterialState {
  readonly profile: HvpLookProfile;
}

export const HVP_READABLE_COAST_LOOK_ID = "hvp:readable-coast-v6";

const profile = (
  role: HvpLookMaterialRole,
  baseColor: Readonly<{ r: number; g: number; b: number }>
): HvpLookMaterial => Object.freeze({
  role,
  materialProfile: createMaterialProfile({
    id: materialProfileId(`hvp:look:${role}`),
    kind: "BasicLit",
    baseColor,
    opacity: 1,
    doubleSided: true,
    wireframe: false,
    depthWrite: true
  })
});

const readableProfile: HvpLookProfile = Object.freeze({
  id: HVP_READABLE_COAST_LOOK_ID,
  variant: "readable",
  materials: Object.freeze([
    profile("limestone-dry", Object.freeze({ r: 0.78, g: 0.76, b: 0.69 })),
    profile("limestone-wet", Object.freeze({ r: 0.27, g: 0.29, b: 0.27 })),
    profile("soil", Object.freeze({ r: 0.39, g: 0.30, b: 0.2 })),
    profile("moss", Object.freeze({ r: 0.26, g: 0.47, b: 0.18 }))
  ]),
  water: Object.freeze({
    transparent: true,
    depthWrite: false,
    renderOrder: 1,
    collision: "none",
    physics: "not-simulated",
    opacity: 0.55,
    materialProfile: createMaterialProfile({
      id: materialProfileId("hvp:look:water"),
      kind: "BasicLit",
      baseColor: { r: 0.035, g: 0.55, b: 0.8 },
      opacity: 0.55,
      doubleSided: true,
      wireframe: false,
      depthWrite: false
    })
  }),
  lighting: Object.freeze({
    ambient: Object.freeze({
      color: 0xbfd9e8,
      intensity: 0.85,
      position: Object.freeze({ x: 0, y: 1, z: 0 }),
      // Pale coast/foliage bounce keeps new root and crown undersides readable.
      groundColor: 0x8c9376
    }),
    key: Object.freeze({
      color: 0xffe2b0,
      intensity: 2.3,
      position: Object.freeze({ x: -28, y: 42, z: -18 })
    }),
    fill: Object.freeze({
      color: 0x6fa8d8,
      intensity: 0.9,
      position: Object.freeze({ x: 30, y: 18, z: 26 })
    })
  }),
  background: Object.freeze({
    color: 0x87b5d9,
    fogNear: 48,
    fogFar: 170
  }),
  distantCoast: Object.freeze({
    editable: false,
    radiusMeters: 86
  })
});

export const createHvpLookProfile = (variant: HvpLookVariant): HvpLookProfile => {
  if (variant !== "readable") {
    throw new TypeError(`Unsupported HVP look variant: ${String(variant)}`);
  }
  assertHvpWaterPresentation(readableProfile.water);
  return readableProfile;
};

export const projectHvpLook = (
  canonical: HvpCanonicalMaterialState,
  variant: HvpLookVariant
): HvpLookProjection => {
  const selected = createHvpLookProfile(variant);
  return Object.freeze({
    materialIds: Object.freeze([...canonical.materialIds]),
    densityKgPerM3: Object.freeze([...canonical.densityKgPerM3]),
    contentHash: canonical.contentHash,
    profile: selected
  });
};
