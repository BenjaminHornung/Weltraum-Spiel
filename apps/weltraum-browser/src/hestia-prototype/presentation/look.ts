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

export const HVP_READABLE_COAST_LOOK_ID = "hvp:readable-coast-v1";

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
    profile("limestone-dry", Object.freeze({ r: 0.58, g: 0.48, b: 0.34 })),
    profile("limestone-wet", Object.freeze({ r: 0.04, g: 0.38, b: 0.76 })),
    profile("soil", Object.freeze({ r: 0.32, g: 0.24, b: 0.15 })),
    profile("moss", Object.freeze({ r: 0.18, g: 0.38, b: 0.24 }))
  ]),
  water: Object.freeze({
    transparent: true,
    depthWrite: false,
    renderOrder: 1,
    collision: "none",
    physics: "not-simulated",
    opacity: 0.62,
    materialProfile: createMaterialProfile({
      id: materialProfileId("hvp:look:water"),
      kind: "BasicLit",
      baseColor: { r: 0.01, g: 0.4, b: 0.95 },
      opacity: 0.62,
      doubleSided: true,
      wireframe: false,
      depthWrite: false
    })
  }),
  lighting: Object.freeze({
    ambient: Object.freeze({
      color: 0x7b9ca8,
      intensity: 0.7,
      position: Object.freeze({ x: 0, y: 1, z: 0 })
    }),
    key: Object.freeze({
      color: 0xffd6a3,
      intensity: 2.2,
      position: Object.freeze({ x: -28, y: 42, z: -18 })
    }),
    fill: Object.freeze({
      color: 0x5a9dcc,
      intensity: 1.15,
      position: Object.freeze({ x: 30, y: 18, z: 26 })
    })
  }),
  background: Object.freeze({
    color: 0x081820,
    fogNear: 58,
    fogFar: 150
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
