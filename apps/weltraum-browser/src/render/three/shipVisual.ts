import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ActuatorTelemetry, Quaternion } from "../../core/types";
import { selectCompatibleRcsNozzles } from "./nozzleVfx";

export interface ShipMarkerDescriptor {
  readonly id: string;
  readonly localPosition: { readonly x: number; readonly y: number; readonly z: number };
}

export interface ShipThrusterNozzleDescriptor {
  readonly id: string;
  readonly role: "MainEngine" | "Rcs";
  readonly blockId: string;
  readonly expectedNodeNames: readonly string[];
  readonly fallbackLocalPosition: ShipMarkerDescriptor["localPosition"];
  /** Body-local force direction used for translation and torque compatibility. */
  readonly localForceDirection: ShipMarkerDescriptor["localPosition"];
  /** Body-local exhaust direction used by the visual; opposite localForceDirection. */
  readonly localExhaustDirection: ShipMarkerDescriptor["localPosition"];
}

export type ShipVisualNozzleBindingSource = "GLBNode" | "ManifestNozzleFallback";
export type ShipVisualVfxBindingKind = "DirectionalNozzle" | "LegacyMarkerFallback";
export type ShipVisualNozzleDiagnosticStatus =
  | "Resolved"
  | "ManifestOnly"
  | "MissingNode"
  | "DuplicateNode"
  | "AmbiguousCandidates"
  | "NodeAlreadyBound"
  | "InvalidPosition";

export interface ShipVisualNozzleBindingDiagnostic {
  readonly status: ShipVisualNozzleDiagnosticStatus;
  readonly expectedNodeNames: readonly string[];
  readonly matchedNodeNames: readonly string[];
  readonly matchedNodeCount: number;
  readonly reason: string;
}

export interface ShipVisualNozzleBindingSnapshot {
  readonly kind: "DirectionalNozzle";
  readonly id: string;
  readonly role: ShipThrusterNozzleDescriptor["role"];
  readonly blockId: string;
  readonly source: ShipVisualNozzleBindingSource;
  readonly sourceObjectName: string | null;
  readonly localPosition: ShipMarkerDescriptor["localPosition"];
  readonly localForceDirection: ShipMarkerDescriptor["localPosition"];
  readonly localExhaustDirection: ShipMarkerDescriptor["localPosition"];
  readonly diagnostic: ShipVisualNozzleBindingDiagnostic;
}

export interface ShipVisualLegacyMarkerBindingSnapshot {
  readonly kind: "LegacyMarkerFallback";
  readonly id: string;
  readonly role: "Rcs";
  readonly source: "LegacyMarkerFallback";
  readonly sourceObjectName: null;
  readonly localPosition: ShipMarkerDescriptor["localPosition"];
}

export type ShipVisualVfxBindingSnapshot =
  | ShipVisualNozzleBindingSnapshot
  | ShipVisualLegacyMarkerBindingSnapshot;

export interface ShipVisualDirectionalRcsPuffSnapshot extends ShipVisualNozzleBindingSnapshot {
  readonly visible: boolean;
  readonly translationCompatible: boolean;
  readonly torqueCompatible: boolean;
  readonly translationScore: number;
  readonly torqueScore: number;
}

export interface ShipVisualLegacyRcsPuffSnapshot extends ShipVisualLegacyMarkerBindingSnapshot {
  readonly visible: boolean;
  /** Aggregate presentation truth only; this does not claim per-marker allocation. */
  readonly aggregateTranslationActivity: boolean;
  /** Aggregate presentation truth only; this does not claim per-marker allocation. */
  readonly aggregateAngularActivity: boolean;
}

export type ShipVisualRcsPuffSnapshot =
  | ShipVisualDirectionalRcsPuffSnapshot
  | ShipVisualLegacyRcsPuffSnapshot;

export interface ShipCameraAnchorDescriptor {
  readonly id: string;
  readonly localPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly chaseOffset: { readonly x: number; readonly y: number; readonly z: number };
  readonly lookAhead: number;
}

export interface ShipVisualDescriptor {
  readonly id: string;
  readonly strategy: "ProceduralLowPolyFallback" | "BrowserGlbAsset";
  readonly displayName: string;
  readonly sourceAssetPath: string | null;
  readonly hullParts: readonly string[];
  readonly cockpitMarker: ShipMarkerDescriptor;
  readonly mainEngineMarkers: readonly ShipMarkerDescriptor[];
  readonly mainEngineNozzle: ShipThrusterNozzleDescriptor | null;
  readonly rcsMarkers: readonly ShipMarkerDescriptor[];
  readonly rcsNozzles: readonly ShipThrusterNozzleDescriptor[];
  readonly muzzleMarker: ShipMarkerDescriptor;
  readonly cameraAnchor: ShipCameraAnchorDescriptor;
}

export type ShipVisualSourceState = "Loading" | "GLBLoaded" | "GLBFailedFallback" | "ProceduralFallback";

export interface ShipVisualAxisCorrectionSnapshot {
  readonly from: "glb:-Z-forward,+Y-up" | "browser-native";
  readonly to: "+X-forward,+Y-up,+/-Z-lateral";
  readonly rotationYRadians: number;
  readonly mapping: "browserX=-glbZ,browserY=glbY,browserZ=glbX" | "identity";
}

export interface ShipVisualSourceSnapshot {
  readonly state: ShipVisualSourceState;
  readonly label: "Demo Scout GLB" | "Procedural fallback" | "Loading Demo Scout GLB";
  readonly candidateAssetPath: string | null;
  readonly sourceAssetPath: string | null;
  readonly browserAssetPath: string | null;
  readonly fallbackReason: string | null;
  readonly appliedScale: number;
  readonly axisCorrection: ShipVisualAxisCorrectionSnapshot;
}

export interface ShipVisualDescriptorValidation {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly counts: {
    readonly hullParts: number;
    readonly mainEngines: number;
    readonly mainEngineNozzles: number;
    readonly rcs: number;
    readonly legacyRcsMarkers: number;
    readonly rcsNozzles: number;
    readonly muzzle: number;
    readonly cameraAnchors: number;
  };
}

export type ShipVisualMarkerBindingSource = "GLBNode" | "ManifestFallback";

export interface ShipVisualMarkerBindingSnapshot {
  readonly id: string;
  readonly role: "cockpit" | "mainEngine" | "rcs" | "muzzle" | "cameraAnchor";
  readonly source: ShipVisualMarkerBindingSource;
  readonly sourceObjectName: string | null;
  readonly localPosition: { readonly x: number; readonly y: number; readonly z: number };
}

export interface ShipVisualVfxSnapshot {
  readonly mainThrustVisible: boolean;
  readonly mainThrustScale: number;
  readonly mainEngineBinding: ShipVisualMarkerBindingSnapshot;
  readonly mainNozzleBinding: ShipVisualNozzleBindingSnapshot | null;
  readonly rcsTranslationVisible: boolean;
  readonly rcsRotationVisible: boolean;
  readonly sasCorrectionVisible: boolean;
  readonly visibleRcsPuffCount: number;
  readonly rcsBindings: readonly ShipVisualMarkerBindingSnapshot[];
  readonly rcsPuffs: readonly ShipVisualRcsPuffSnapshot[];
  readonly bindingKindCounts: Readonly<Record<ShipVisualVfxBindingKind, number>>;
  readonly nozzleSourceCounts: Readonly<Record<ShipVisualNozzleBindingSource, number>>;
  readonly bindingDiagnosticCounts: Readonly<Record<ShipVisualNozzleDiagnosticStatus, number>>;
  readonly frameSemantics: {
    readonly translation: "BodyLocalFromOwnerOrientation";
    readonly angular: "BodyLocalTelemetry";
  };
}

export interface ShipVisualSnapshot {
  readonly descriptor: ShipVisualDescriptor;
  readonly visualSource: ShipVisualSourceSnapshot;
  readonly descriptorValidation: ShipVisualDescriptorValidation;
  readonly groupChildren: number;
  readonly markerCounts: {
    readonly hullParts: number;
    readonly mainEngines: number;
    readonly rcs: number;
    readonly muzzle: number;
    readonly cameraAnchors: number;
  };
  readonly markerBindings: readonly ShipVisualMarkerBindingSnapshot[];
  readonly nozzleBindings: readonly ShipVisualVfxBindingSnapshot[];
  readonly nozzleBindingDiagnostics: readonly ShipVisualNozzleBindingDiagnostic[];
  readonly cameraAnchorBinding: ShipVisualMarkerBindingSnapshot;
  readonly vfx: ShipVisualVfxSnapshot;
  readonly oldConeOnlyPlaceholder: false;
}

export interface ShipVisual {
  readonly group: THREE.Group;
  readonly descriptor: ShipVisualDescriptor;
  updatePose(position: THREE.Vector3, orientation: Quaternion): void;
  updateVfx(telemetry: ActuatorTelemetry, ownerOrientation: Quaternion): void;
  getSnapshot(): ShipVisualSnapshot;
}

export interface DemoScoutShipVisual extends ShipVisual {
  /** Retries the GLB source and falls back atomically when that attempt fails. */
  reload(): Promise<void>;
}

export type ProceduralShipVisual = ShipVisual;

export const demoScoutGlbCandidatePath = "art/source/ships/prototype-ship-kit/exports/demo-ships/demo_scout_mk1.glb";
export const demoScoutGlbBrowserPath = "/ships/demo_scout_mk1.glb";
export const demoScoutGlbAppliedScale = 3.2;

const browserAxisCorrection: ShipVisualAxisCorrectionSnapshot = {
  from: "glb:-Z-forward,+Y-up",
  to: "+X-forward,+Y-up,+/-Z-lateral",
  rotationYRadians: -Math.PI / 2,
  mapping: "browserX=-glbZ,browserY=glbY,browserZ=glbX"
};

const nativeAxisCorrection: ShipVisualAxisCorrectionSnapshot = {
  from: "browser-native",
  to: "+X-forward,+Y-up,+/-Z-lateral",
  rotationYRadians: 0,
  mapping: "identity"
};

const normalizePlainVector = (vector: ShipMarkerDescriptor["localPosition"]): ShipMarkerDescriptor["localPosition"] => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length <= 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const negateCanonicalComponent = (value: number): number => value === 0 ? 0 : -value;

const createNozzleDescriptor = (
  id: string,
  role: ShipThrusterNozzleDescriptor["role"],
  blockId: string,
  expectedNodeNames: readonly string[],
  fallbackLocalPosition: ShipMarkerDescriptor["localPosition"],
  exhaustDirection: ShipMarkerDescriptor["localPosition"]
): ShipThrusterNozzleDescriptor => {
  const localExhaustDirection = normalizePlainVector(exhaustDirection);
  return {
    id,
    role,
    blockId,
    expectedNodeNames,
    fallbackLocalPosition,
    localForceDirection: {
      x: negateCanonicalComponent(localExhaustDirection.x),
      y: negateCanonicalComponent(localExhaustDirection.y),
      z: negateCanonicalComponent(localExhaustDirection.z)
    },
    localExhaustDirection
  };
};

const proceduralRcsMarkers: readonly ShipMarkerDescriptor[] = [
  { id: "rcs-front-left", localPosition: { x: 3.5, y: 0.8, z: -2.8 } },
  { id: "rcs-front-right", localPosition: { x: 3.5, y: 0.8, z: 2.8 } },
  { id: "rcs-aft-left", localPosition: { x: -3.8, y: 0.4, z: -2.7 } },
  { id: "rcs-aft-right", localPosition: { x: -3.8, y: 0.4, z: 2.7 } },
  { id: "rcs-dorsal", localPosition: { x: 0.4, y: 1.9, z: 0 } },
  { id: "rcs-ventral", localPosition: { x: 0.4, y: -1.2, z: 0 } }
];

const demoScoutRcsMarkers: readonly ShipMarkerDescriptor[] = [
  { id: "rcs-front-left", localPosition: { x: 1.856, y: 0.576, z: -2.352 } },
  { id: "rcs-front-right", localPosition: { x: 1.856, y: 0.576, z: 2.352 } },
  { id: "rcs-aft-left", localPosition: { x: -1.856, y: -0.576, z: -2.352 } },
  { id: "rcs-aft-right", localPosition: { x: -1.856, y: -0.576, z: 2.352 } }
];

export const demoScoutRcsNozzleRegistry: readonly ShipThrusterNozzleDescriptor[] = [
  createNozzleDescriptor("rcs-front-left-nozzle-back", "Rcs", "rcs-front-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1_Back"], { x: 0.896, y: 0.576, z: -3.152 }, { x: -1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-front-left-nozzle-down", "Rcs", "rcs-front-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1_Down"], { x: 1.856, y: -0.576, z: -3.152 }, { x: 0, y: -1, z: 0 }),
  createNozzleDescriptor("rcs-front-left-nozzle-forward", "Rcs", "rcs-front-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1_Forward"], { x: 2.816, y: 0.576, z: -3.152 }, { x: 1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-front-left-nozzle-left", "Rcs", "rcs-front-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1_Left"], { x: 1.856, y: 0.576, z: -4.272 }, { x: 0, y: 0, z: -1 }),
  createNozzleDescriptor("rcs-front-left-nozzle-up", "Rcs", "rcs-front-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1_Up"], { x: 1.856, y: 1.728, z: -3.152 }, { x: 0, y: 1, z: 0 }),
  createNozzleDescriptor("rcs-front-right-nozzle-back", "Rcs", "rcs-front-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1002_Back"], { x: 0.896, y: 0.576, z: 3.152 }, { x: -1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-front-right-nozzle-down", "Rcs", "rcs-front-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1002_Down"], { x: 1.856, y: -0.576, z: 3.152 }, { x: 0, y: -1, z: 0 }),
  createNozzleDescriptor("rcs-front-right-nozzle-forward", "Rcs", "rcs-front-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1002_Forward"], { x: 2.816, y: 0.576, z: 3.152 }, { x: 1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-front-right-nozzle-right", "Rcs", "rcs-front-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1002_Right"], { x: 1.856, y: 0.576, z: 4.272 }, { x: 0, y: 0, z: 1 }),
  createNozzleDescriptor("rcs-front-right-nozzle-up", "Rcs", "rcs-front-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1002_Up"], { x: 1.856, y: 1.728, z: 3.152 }, { x: 0, y: 1, z: 0 }),
  createNozzleDescriptor("rcs-aft-left-nozzle-back", "Rcs", "rcs-aft-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1001_Back"], { x: -2.816, y: -0.576, z: -3.152 }, { x: -1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-aft-left-nozzle-down", "Rcs", "rcs-aft-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1001_Down"], { x: -1.856, y: -1.728, z: -3.152 }, { x: 0, y: -1, z: 0 }),
  createNozzleDescriptor("rcs-aft-left-nozzle-forward", "Rcs", "rcs-aft-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1001_Forward"], { x: -0.896, y: -0.576, z: -3.152 }, { x: 1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-aft-left-nozzle-left", "Rcs", "rcs-aft-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1001_Left"], { x: -1.856, y: -0.576, z: -4.272 }, { x: 0, y: 0, z: -1 }),
  createNozzleDescriptor("rcs-aft-left-nozzle-up", "Rcs", "rcs-aft-left", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1001_Up"], { x: -1.856, y: 0.576, z: -3.152 }, { x: 0, y: 1, z: 0 }),
  createNozzleDescriptor("rcs-aft-right-nozzle-back", "Rcs", "rcs-aft-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1003_Back"], { x: -2.816, y: -0.576, z: 3.152 }, { x: -1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-aft-right-nozzle-down", "Rcs", "rcs-aft-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1003_Down"], { x: -1.856, y: -1.728, z: 3.152 }, { x: 0, y: -1, z: 0 }),
  createNozzleDescriptor("rcs-aft-right-nozzle-forward", "Rcs", "rcs-aft-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1003_Forward"], { x: -0.896, y: -0.576, z: 3.152 }, { x: 1, y: 0, z: 0 }),
  createNozzleDescriptor("rcs-aft-right-nozzle-right", "Rcs", "rcs-aft-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1003_Right"], { x: -1.856, y: -0.576, z: 4.272 }, { x: 0, y: 0, z: 1 }),
  createNozzleDescriptor("rcs-aft-right-nozzle-up", "Rcs", "rcs-aft-right", ["RCS_Nozzle_DEMOScoutMk1PARTRCSPod4WayMk1003_Up"], { x: -1.856, y: 0.576, z: 3.152 }, { x: 0, y: 1, z: 0 })
];

export const proceduralScoutDescriptor: ShipVisualDescriptor = {
  id: "procedural-demo-scout-mk1-fallback",
  strategy: "ProceduralLowPolyFallback",
  displayName: "Procedural Demo Scout Mk1 fallback",
  sourceAssetPath: null,
  hullParts: ["main-hull", "left-wing", "right-wing", "spine-fin"],
  cockpitMarker: { id: "cockpit-front", localPosition: { x: 5.4, y: 1.2, z: 0 } },
  mainEngineMarkers: [{ id: "main-engine-aft", localPosition: { x: -5.2, y: 0, z: 0 } }],
  mainEngineNozzle: null,
  rcsMarkers: proceduralRcsMarkers,
  rcsNozzles: [],
  muzzleMarker: { id: "muzzle-placeholder", localPosition: { x: 6.6, y: 0, z: 0 } },
  cameraAnchor: {
    id: "chase-camera-anchor",
    localPosition: { x: -1.5, y: 1.3, z: 0 },
    chaseOffset: { x: -30, y: 12, z: 0 },
    lookAhead: 11
  }
};

export const demoScoutGlbDescriptor: ShipVisualDescriptor = {
  id: "demo-scout-mk1-glb",
  strategy: "BrowserGlbAsset",
  displayName: "Demo Scout GLB",
  sourceAssetPath: demoScoutGlbCandidatePath,
  hullParts: [
    "main-hull",
    "DEMO_Scout_Mk1_GEO_Hull_Core_Faceted",
    "DEMO_Scout_Mk1_GEO_Cockpit_Canopy_DarkBlue",
    "DEMO_Scout_Mk1_GEO_MainEngine_Bell_DarkMetal"
  ],
  cockpitMarker: { id: "cockpit-front", localPosition: { x: 6.176, y: 0.96, z: 0 } },
  mainEngineMarkers: [{ id: "main-engine-aft", localPosition: { x: -6.208, y: 0, z: 0 } }],
  mainEngineNozzle: createNozzleDescriptor("main-engine-aft-nozzle-main", "MainEngine", "main-engine-aft", ["DEMO_Scout_Mk1_PART_Main_Engine_Bell_Mk1_THRUST_NOZZLE_MAIN"], { x: -6.208, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }),
  rcsMarkers: demoScoutRcsMarkers,
  rcsNozzles: demoScoutRcsNozzleRegistry,
  muzzleMarker: { id: "muzzle-placeholder", localPosition: { x: 5.056, y: -1.888, z: 0 } },
  cameraAnchor: {
    id: "chase-camera-anchor",
    localPosition: { x: -1.2, y: 2.1, z: 0 },
    chaseOffset: { x: -30, y: 12, z: 0 },
    lookAhead: 11
  }
};

const glbMarkerNodeNames: Record<string, readonly string[]> = {
  "cockpit-front": ["DEMO_Scout_Mk1_GEO_Cockpit_Canopy_DarkBlue", "DEMO_Scout_Mk1_PART_Cockpit_Wedge_Mk1"],
  "main-engine-aft": ["MainThrusterNozzle.001", "DEMO_Scout_Mk1_PART_Main_Engine_Bell_Mk1_THRUST_NOZZLE_MAIN"],
  "rcs-front-left": ["DEMO_Scout_Mk1_RCS_Hardpoint_Left_Front"],
  "rcs-front-right": ["DEMO_Scout_Mk1_RCS_Hardpoint_Right_Front"],
  "rcs-aft-left": ["DEMO_Scout_Mk1_RCS_Hardpoint_Left_Rear"],
  "rcs-aft-right": ["DEMO_Scout_Mk1_RCS_Hardpoint_Right_Rear"],
  "muzzle-placeholder": ["WEAPON_MUZZLE_PRIMARY", "WEAPON_MUZZLE_FLASH_PRIMARY"],
  "chase-camera-anchor": []
};

export const proceduralShipVisualSource: ShipVisualSourceSnapshot = {
  state: "ProceduralFallback",
  label: "Procedural fallback",
  candidateAssetPath: demoScoutGlbCandidatePath,
  sourceAssetPath: null,
  browserAssetPath: null,
  fallbackReason: "Procedural fallback factory was requested explicitly; no GLB load was attempted.",
  appliedScale: 1,
  axisCorrection: nativeAxisCorrection
};

const hasFinitePosition = (marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor | undefined): boolean => {
  if (!marker) {
    return false;
  }
  return Number.isFinite(marker.localPosition.x) && Number.isFinite(marker.localPosition.y) && Number.isFinite(marker.localPosition.z);
};

const hasFiniteVector = (vector: ShipMarkerDescriptor["localPosition"]): boolean =>
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

const isValidNozzle = (nozzle: ShipThrusterNozzleDescriptor | null | undefined): boolean => {
  if (!nozzle || !nozzle.id || !nozzle.blockId || !hasFiniteVector(nozzle.fallbackLocalPosition)) {
    return false;
  }
  const forceMagnitude = Math.hypot(nozzle.localForceDirection.x, nozzle.localForceDirection.y, nozzle.localForceDirection.z);
  const exhaustMagnitude = Math.hypot(nozzle.localExhaustDirection.x, nozzle.localExhaustDirection.y, nozzle.localExhaustDirection.z);
  const oppositeDot = nozzle.localForceDirection.x * nozzle.localExhaustDirection.x +
    nozzle.localForceDirection.y * nozzle.localExhaustDirection.y +
    nozzle.localForceDirection.z * nozzle.localExhaustDirection.z;
  return hasFiniteVector(nozzle.localForceDirection) &&
    hasFiniteVector(nozzle.localExhaustDirection) &&
    Math.abs(forceMagnitude - 1) <= 1e-6 &&
    Math.abs(exhaustMagnitude - 1) <= 1e-6 &&
    Math.abs(oppositeDot + 1) <= 1e-6;
};

const toPlainPosition = (position: THREE.Vector3): ShipMarkerDescriptor["localPosition"] => ({
  x: Number(position.x.toFixed(4)),
  y: Number(position.y.toFixed(4)),
  z: Number(position.z.toFixed(4))
});

const markerPosition = (marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor) =>
  new THREE.Vector3(marker.localPosition.x, marker.localPosition.y, marker.localPosition.z);

export const validateShipVisualDescriptor = (descriptor: ShipVisualDescriptor): ShipVisualDescriptorValidation => {
  const missing: string[] = [];
  if (descriptor.hullParts.length < 1 || !descriptor.hullParts.includes("main-hull")) {
    missing.push("hull/body identity");
  }
  if (!hasFinitePosition(descriptor.cockpitMarker)) {
    missing.push("cockpit/front marker");
  }
  if (descriptor.mainEngineMarkers.length < 1 || descriptor.mainEngineMarkers.some((marker) => !hasFinitePosition(marker))) {
    missing.push("main engine marker");
  }
  const requiredRcsMarkerCount = descriptor.strategy === "ProceduralLowPolyFallback" ? 6 : 4;
  if (descriptor.rcsMarkers.length !== requiredRcsMarkerCount || descriptor.rcsMarkers.some((marker) => !hasFinitePosition(marker))) {
    missing.push(descriptor.strategy === "ProceduralLowPolyFallback" ? "exactly six legacy RCS markers" : "exactly four RCS hardpoint markers");
  }
  if (descriptor.strategy === "BrowserGlbAsset") {
    if (!isValidNozzle(descriptor.mainEngineNozzle)) {
      missing.push("main engine directional nozzle");
    }
    if (descriptor.rcsNozzles.length !== 20 || descriptor.rcsNozzles.some((nozzle) => !isValidNozzle(nozzle))) {
      missing.push("exactly twenty valid directional RCS nozzles");
    }
    const directionalNozzles = descriptor.mainEngineNozzle
      ? [descriptor.mainEngineNozzle, ...descriptor.rcsNozzles]
      : [...descriptor.rcsNozzles];
    const nozzleIds = directionalNozzles.map((nozzle) => nozzle.id);
    if (new Set(nozzleIds).size !== nozzleIds.length) {
      missing.push("unique nozzle logical ids");
    }
    const expectedNames = directionalNozzles.flatMap((nozzle) => nozzle.expectedNodeNames);
    if (directionalNozzles.some((nozzle) => nozzle.expectedNodeNames.length < 1)) {
      missing.push("authored nozzle node names");
    }
    if (new Set(expectedNames).size !== expectedNames.length) {
      missing.push("unique authored nozzle node names");
    }
  } else if (descriptor.mainEngineNozzle !== null || descriptor.rcsNozzles.length !== 0) {
    missing.push("procedural fallback must use position-only markers");
  }
  if (!hasFinitePosition(descriptor.muzzleMarker)) {
    missing.push("muzzle placeholder");
  }
  if (!hasFinitePosition(descriptor.cameraAnchor) || !Number.isFinite(descriptor.cameraAnchor.lookAhead)) {
    missing.push("camera anchor");
  }

  return {
    ok: missing.length === 0,
    missing,
    counts: {
      hullParts: descriptor.hullParts.length,
      mainEngines: descriptor.mainEngineMarkers.length,
      mainEngineNozzles: isValidNozzle(descriptor.mainEngineNozzle) ? 1 : 0,
      rcs: descriptor.rcsMarkers.length,
      legacyRcsMarkers: descriptor.strategy === "ProceduralLowPolyFallback" ? descriptor.rcsMarkers.length : 0,
      rcsNozzles: descriptor.rcsNozzles.length,
      muzzle: hasFinitePosition(descriptor.muzzleMarker) ? 1 : 0,
      cameraAnchors: hasFinitePosition(descriptor.cameraAnchor) ? 1 : 0
    }
  };
};

const applyMarkerTransform = (object: THREE.Object3D, marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor): void => {
  object.position.copy(markerPosition(marker));
  object.name = marker.id;
};

const createMarker = (marker: ShipMarkerDescriptor, color: number, radius: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.35 })
  );
  applyMarkerTransform(mesh, marker);
  return mesh;
};

const setQuaternion = (object: THREE.Object3D, orientation: Quaternion): void => {
  object.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w).normalize();
};

const createProceduralGeometryGroup = (descriptor: ShipVisualDescriptor): THREE.Group => {
  const group = new THREE.Group();
  group.name = `${descriptor.id}-geometry`;

  const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.5, metalness: 0.08 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x9ad7ff, roughness: 0.42, metalness: 0.12 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.65, metalness: 0.05 });

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 8.8, 4, 8), hullMaterial);
  hull.name = "main-hull";
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.78, 0.9);
  group.add(hull);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.8, 5), accentMaterial);
  nose.name = "cockpit-nose";
  nose.position.x = 5.4;
  nose.rotation.z = -Math.PI / 2;
  group.add(nose);

  const cockpit = createMarker(descriptor.cockpitMarker, 0x7df9ff, 0.34);
  cockpit.name = "cockpit-front-marker";
  group.add(cockpit);

  const wingGeometry = new THREE.BoxGeometry(3.8, 0.22, 1.25);
  const leftWing = new THREE.Mesh(wingGeometry, darkMaterial);
  leftWing.name = "left-wing";
  leftWing.position.set(-0.9, -0.05, -2.05);
  leftWing.rotation.y = 0.18;
  group.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.name = "right-wing";
  rightWing.position.z = 2.05;
  rightWing.rotation.y = -0.18;
  group.add(rightWing);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 0.18), darkMaterial);
  spine.name = "spine-fin";
  spine.position.set(-0.5, 1.18, 0);
  group.add(spine);

  for (const marker of descriptor.mainEngineMarkers) {
    group.add(createMarker(marker, 0xffc15a, 0.42));
  }

  for (const marker of descriptor.rcsMarkers) {
    group.add(createMarker(marker, 0x9affc7, 0.22));
  }

  const muzzle = createMarker(descriptor.muzzleMarker, 0xffef9a, 0.2);
  muzzle.name = "muzzle-placeholder";
  group.add(muzzle);

  return group;
};

const createManifestBinding = (
  marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor,
  role: ShipVisualMarkerBindingSnapshot["role"]
): ShipVisualMarkerBindingSnapshot => ({
  id: marker.id,
  role,
  source: "ManifestFallback",
  sourceObjectName: null,
  localPosition: marker.localPosition
});

const createManifestBindings = (descriptor: ShipVisualDescriptor): readonly ShipVisualMarkerBindingSnapshot[] => [
  createManifestBinding(descriptor.cockpitMarker, "cockpit"),
  ...descriptor.mainEngineMarkers.map((marker) => createManifestBinding(marker, "mainEngine")),
  ...descriptor.rcsMarkers.map((marker) => createManifestBinding(marker, "rcs")),
  createManifestBinding(descriptor.muzzleMarker, "muzzle"),
  createManifestBinding(descriptor.cameraAnchor, "cameraAnchor")
];

const findBinding = (bindings: readonly ShipVisualMarkerBindingSnapshot[], id: string): ShipVisualMarkerBindingSnapshot => {
  const binding = bindings.find((candidate) => candidate.id === id);
  if (!binding) {
    throw new Error(`Missing ship visual marker binding: ${id}`);
  }
  return binding;
};

const updateMarkerPosition = <TMarker extends ShipMarkerDescriptor | ShipCameraAnchorDescriptor>(marker: TMarker, binding: ShipVisualMarkerBindingSnapshot): TMarker => ({
  ...marker,
  localPosition: binding.localPosition
});

const applyBindingsToDescriptor = (descriptor: ShipVisualDescriptor, bindings: readonly ShipVisualMarkerBindingSnapshot[]): ShipVisualDescriptor => ({
  ...descriptor,
  cockpitMarker: updateMarkerPosition(descriptor.cockpitMarker, findBinding(bindings, descriptor.cockpitMarker.id)),
  mainEngineMarkers: descriptor.mainEngineMarkers.map((marker) => updateMarkerPosition(marker, findBinding(bindings, marker.id))),
  rcsMarkers: descriptor.rcsMarkers.map((marker) => updateMarkerPosition(marker, findBinding(bindings, marker.id))),
  muzzleMarker: updateMarkerPosition(descriptor.muzzleMarker, findBinding(bindings, descriptor.muzzleMarker.id)),
  cameraAnchor: updateMarkerPosition(descriptor.cameraAnchor, findBinding(bindings, descriptor.cameraAnchor.id))
});

const convertGlbPositionToBrowser = (position: THREE.Vector3, scale: number): ShipMarkerDescriptor["localPosition"] =>
  toPlainPosition(new THREE.Vector3(-position.z * scale, position.y * scale, position.x * scale));

const resolveGlbBinding = (
  scene: THREE.Object3D,
  marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor,
  role: ShipVisualMarkerBindingSnapshot["role"],
  scale: number
): ShipVisualMarkerBindingSnapshot => {
  const names = glbMarkerNodeNames[marker.id] ?? [];
  for (const name of names) {
    const object = scene.getObjectByName(name);
    if (!object) {
      continue;
    }
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);
    const localPosition = convertGlbPositionToBrowser(worldPosition, scale);
    if (Number.isFinite(localPosition.x) && Number.isFinite(localPosition.y) && Number.isFinite(localPosition.z)) {
      return { id: marker.id, role, source: "GLBNode", sourceObjectName: object.name, localPosition };
    }
  }

  return createManifestBinding(marker, role);
};

const resolveGlbBindings = (scene: THREE.Object3D, descriptor: ShipVisualDescriptor, scale: number): readonly ShipVisualMarkerBindingSnapshot[] => {
  scene.updateMatrixWorld(true);
  return [
    resolveGlbBinding(scene, descriptor.cockpitMarker, "cockpit", scale),
    ...descriptor.mainEngineMarkers.map((marker) => resolveGlbBinding(scene, marker, "mainEngine", scale)),
    ...descriptor.rcsMarkers.map((marker) => resolveGlbBinding(scene, marker, "rcs", scale)),
    resolveGlbBinding(scene, descriptor.muzzleMarker, "muzzle", scale),
    resolveGlbBinding(scene, descriptor.cameraAnchor, "cameraAnchor", scale)
  ];
};

const createManifestNozzleBinding = (
  nozzle: ShipThrusterNozzleDescriptor,
  status: ShipVisualNozzleDiagnosticStatus = "ManifestOnly",
  reason = "The active procedural descriptor uses its deterministic manifest nozzle position.",
  matchedNodeNames: readonly string[] = []
): ShipVisualNozzleBindingSnapshot => ({
  kind: "DirectionalNozzle",
  id: nozzle.id,
  role: nozzle.role,
  blockId: nozzle.blockId,
  source: "ManifestNozzleFallback",
  sourceObjectName: null,
  localPosition: nozzle.fallbackLocalPosition,
  localForceDirection: nozzle.localForceDirection,
  localExhaustDirection: nozzle.localExhaustDirection,
  diagnostic: {
    status,
    expectedNodeNames: [...nozzle.expectedNodeNames],
    matchedNodeNames: [...matchedNodeNames],
    matchedNodeCount: matchedNodeNames.length,
    reason
  }
});

const createLegacyMarkerBinding = (marker: ShipMarkerDescriptor): ShipVisualLegacyMarkerBindingSnapshot => ({
  kind: "LegacyMarkerFallback",
  id: marker.id,
  role: "Rcs",
  source: "LegacyMarkerFallback",
  sourceObjectName: null,
  localPosition: marker.localPosition
});

const createInitialVfxBindings = (descriptor: ShipVisualDescriptor): readonly ShipVisualVfxBindingSnapshot[] => {
  if (descriptor.strategy === "ProceduralLowPolyFallback") {
    return descriptor.rcsMarkers.map(createLegacyMarkerBinding);
  }
  if (!descriptor.mainEngineNozzle) {
    throw new Error("Browser GLB descriptor is missing its directional main nozzle.");
  }
  return [
    createManifestNozzleBinding(descriptor.mainEngineNozzle),
    ...descriptor.rcsNozzles.map((nozzle) => createManifestNozzleBinding(nozzle))
  ];
};

const buildGlbNodeNameIndex = (scene: THREE.Object3D): ReadonlyMap<string, readonly THREE.Object3D[]> => {
  const mutable = new Map<string, THREE.Object3D[]>();
  scene.traverse((object) => {
    const authoredName = typeof object.userData.name === "string" && object.userData.name.length > 0
      ? object.userData.name
      : object.name;
    if (!authoredName) {
      return;
    }
    const entries = mutable.get(authoredName) ?? [];
    entries.push(object);
    mutable.set(authoredName, entries);
  });
  return mutable;
};

export const resolveGlbNozzleBindings = (
  scene: THREE.Object3D,
  nozzles: readonly ShipThrusterNozzleDescriptor[],
  scale: number
): readonly ShipVisualNozzleBindingSnapshot[] => {
  scene.updateMatrixWorld(true);
  const nameIndex = buildGlbNodeNameIndex(scene);
  const usedObjects = new Set<THREE.Object3D>();

  return nozzles.map((nozzle) => {
    const matchesByName = nozzle.expectedNodeNames.map((name) => ({ name, objects: nameIndex.get(name) ?? [] }));
    const matchedObjects = matchesByName.flatMap((candidate) => candidate.objects);
    const matchedNodeNames = matchesByName.flatMap((candidate) => candidate.objects.map(() => candidate.name));
    const duplicateCandidate = matchesByName.find((candidate) => candidate.objects.length > 1);
    if (duplicateCandidate) {
      return createManifestNozzleBinding(
        nozzle,
        "DuplicateNode",
        `Expected GLB nozzle node '${duplicateCandidate.name}' occurs ${duplicateCandidate.objects.length} times.`,
        matchedNodeNames
      );
    }
    if (matchedObjects.length === 0) {
      return createManifestNozzleBinding(
        nozzle,
        "MissingNode",
        `No expected GLB nozzle node was found for '${nozzle.id}'.`,
        matchedNodeNames
      );
    }
    const uniqueObjects = [...new Set(matchedObjects)];
    if (uniqueObjects.length !== 1) {
      return createManifestNozzleBinding(
        nozzle,
        "AmbiguousCandidates",
        `Multiple distinct GLB nozzle candidates matched '${nozzle.id}'.`,
        matchedNodeNames
      );
    }
    const object = uniqueObjects[0];
    if (!object) {
      return createManifestNozzleBinding(nozzle, "MissingNode", `No usable GLB nozzle node was found for '${nozzle.id}'.`, matchedNodeNames);
    }
    if (usedObjects.has(object)) {
      return createManifestNozzleBinding(
        nozzle,
        "NodeAlreadyBound",
        `GLB nozzle node '${matchedNodeNames[0] ?? object.name}' was already bound to another logical nozzle.`,
        matchedNodeNames
      );
    }
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);
    const localPosition = convertGlbPositionToBrowser(worldPosition, scale);
    if (!hasFiniteVector(localPosition)) {
      return createManifestNozzleBinding(
        nozzle,
        "InvalidPosition",
        `GLB nozzle node '${matchedNodeNames[0] ?? object.name}' produced a non-finite browser-local position.`,
        matchedNodeNames
      );
    }
    usedObjects.add(object);
    return {
      kind: "DirectionalNozzle",
      id: nozzle.id,
      role: nozzle.role,
      blockId: nozzle.blockId,
      source: "GLBNode",
      sourceObjectName: matchedNodeNames[0] ?? object.name,
      localPosition,
      localForceDirection: nozzle.localForceDirection,
      localExhaustDirection: nozzle.localExhaustDirection,
      diagnostic: {
        status: "Resolved",
        expectedNodeNames: [...nozzle.expectedNodeNames],
        matchedNodeNames,
        matchedNodeCount: matchedNodeNames.length,
        reason: `Resolved '${nozzle.id}' to one unique GLB node.`
      }
    };
  });
};

const nozzleSourceCounts = (
  bindings: readonly ShipVisualVfxBindingSnapshot[]
): Readonly<Record<ShipVisualNozzleBindingSource, number>> => ({
  GLBNode: bindings.filter((binding) => binding.kind === "DirectionalNozzle" && binding.source === "GLBNode").length,
  ManifestNozzleFallback: bindings.filter((binding) => binding.kind === "DirectionalNozzle" && binding.source === "ManifestNozzleFallback").length
});

const bindingKindCounts = (
  bindings: readonly ShipVisualVfxBindingSnapshot[]
): Readonly<Record<ShipVisualVfxBindingKind, number>> => ({
  DirectionalNozzle: bindings.filter((binding) => binding.kind === "DirectionalNozzle").length,
  LegacyMarkerFallback: bindings.filter((binding) => binding.kind === "LegacyMarkerFallback").length
});

const diagnosticStatuses: readonly ShipVisualNozzleDiagnosticStatus[] = [
  "Resolved",
  "ManifestOnly",
  "MissingNode",
  "DuplicateNode",
  "AmbiguousCandidates",
  "NodeAlreadyBound",
  "InvalidPosition"
];

const bindingDiagnosticCounts = (
  bindings: readonly ShipVisualVfxBindingSnapshot[]
): Readonly<Record<ShipVisualNozzleDiagnosticStatus, number>> => Object.fromEntries(
  diagnosticStatuses.map((status) => [status, bindings.filter((binding) =>
    binding.kind === "DirectionalNozzle" && binding.diagnostic.status === status
  ).length])
) as Readonly<Record<ShipVisualNozzleDiagnosticStatus, number>>;

const orientObjectAlongExhaust = (
  object: THREE.Object3D,
  exhaustDirection: ShipMarkerDescriptor["localPosition"]
): void => {
  const direction = new THREE.Vector3(exhaustDirection.x, exhaustDirection.y, exhaustDirection.z).normalize();
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
};

const createVfxObjects = (group: THREE.Group) => {
  const mainFlame = new THREE.Mesh(
    new THREE.ConeGeometry(1.18, 8.6, 16),
    new THREE.MeshBasicMaterial({
      color: 0x43d9ff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mainFlame.name = "main-thruster-vfx";
  mainFlame.rotation.z = Math.PI / 2;
  mainFlame.visible = false;
  group.add(mainFlame);

  const createRcsPuff = (index: number) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x9affc7, transparent: true, opacity: 0.62, depthWrite: false })
    );
    puff.name = `rcs-puff-${index}`;
    puff.visible = false;
    group.add(puff);
    return puff;
  };

  return { mainFlame, createRcsPuff };
};

const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.dispose();
  }
};

const configureImportedScene = (scene: THREE.Object3D): void => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });
};

interface MutableShipVisual extends ShipVisual {
  setVisualState(
    descriptor: ShipVisualDescriptor,
    source: ShipVisualSourceSnapshot,
    markerBindings: readonly ShipVisualMarkerBindingSnapshot[],
    nozzleBindings: readonly ShipVisualVfxBindingSnapshot[]
  ): void;
}

const createShipVisualInternal = (initialDescriptor: ShipVisualDescriptor, initialSource: ShipVisualSourceSnapshot): MutableShipVisual => {
  const group = new THREE.Group();
  group.name = initialDescriptor.id;
  let activeDescriptor = initialDescriptor;
  let descriptorValidation = validateShipVisualDescriptor(activeDescriptor);
  if (!descriptorValidation.ok) {
    throw new Error(`Ship visual descriptor missing required markers: ${descriptorValidation.missing.join(", ")}`);
  }

  const geometryGroup = createProceduralGeometryGroup(activeDescriptor);
  const vfxGroup = new THREE.Group();
  vfxGroup.name = "ship-visual-vfx";
  group.add(geometryGroup, vfxGroup);
  const { mainFlame, createRcsPuff } = createVfxObjects(vfxGroup);
  let rcsPuffMeshes: THREE.Mesh[] = [];
  let visualSource = initialSource;
  let markerBindings = createManifestBindings(activeDescriptor);
  let nozzleBindings = createInitialVfxBindings(activeDescriptor);
  let rcsPuffSnapshots: readonly ShipVisualRcsPuffSnapshot[] = [];
  let vfxSnapshot!: ShipVisualVfxSnapshot;

  const activeRcsBindings = () => nozzleBindings.filter((binding) => binding.role === "Rcs");
  const mainNozzleBinding = (): ShipVisualNozzleBindingSnapshot | null =>
    nozzleBindings.find((binding): binding is ShipVisualNozzleBindingSnapshot =>
      binding.kind === "DirectionalNozzle" && binding.role === "MainEngine"
    ) ?? null;
  const createIdlePuffSnapshots = (): readonly ShipVisualRcsPuffSnapshot[] => activeRcsBindings().map((binding) => {
    if (binding.kind === "LegacyMarkerFallback") {
      return {
        ...binding,
        visible: false,
        aggregateTranslationActivity: false,
        aggregateAngularActivity: false
      };
    }
    return {
      ...binding,
      visible: false,
      translationCompatible: false,
      torqueCompatible: false,
      translationScore: 0,
      torqueScore: 0
    };
  });
  const buildVfxSnapshot = (
    mainThrustVisible = false,
    mainThrustScale = 0,
    rcsTranslationVisible = false,
    rcsRotationVisible = false,
    sasCorrectionVisible = false
  ): ShipVisualVfxSnapshot => ({
    mainThrustVisible,
    mainThrustScale,
    mainEngineBinding: findBinding(markerBindings, activeDescriptor.mainEngineMarkers[0]?.id ?? "main-engine-aft"),
    mainNozzleBinding: mainNozzleBinding(),
    rcsTranslationVisible,
    rcsRotationVisible,
    sasCorrectionVisible,
    visibleRcsPuffCount: rcsPuffSnapshots.filter((puff) => puff.visible).length,
    rcsBindings: markerBindings.filter((binding) => binding.role === "rcs"),
    rcsPuffs: rcsPuffSnapshots,
    bindingKindCounts: bindingKindCounts(nozzleBindings),
    nozzleSourceCounts: nozzleSourceCounts(nozzleBindings),
    bindingDiagnosticCounts: bindingDiagnosticCounts(nozzleBindings),
    frameSemantics: {
      translation: "BodyLocalFromOwnerOrientation",
      angular: "BodyLocalTelemetry"
    }
  });

  const syncVfxToDescriptor = () => {
    const mainNozzle = mainNozzleBinding();
    if (mainNozzle) {
      mainFlame.position.copy(markerPosition({ id: mainNozzle.id, localPosition: mainNozzle.localPosition }));
      orientObjectAlongExhaust(mainFlame, mainNozzle.localExhaustDirection);
    } else {
      const mainMarker = findBinding(markerBindings, activeDescriptor.mainEngineMarkers[0]?.id ?? "main-engine-aft");
      mainFlame.position.copy(markerPosition({ id: mainMarker.id, localPosition: mainMarker.localPosition }));
      mainFlame.rotation.set(0, 0, Math.PI / 2);
    }

    const rcsBindings = activeRcsBindings();
    while (rcsPuffMeshes.length < rcsBindings.length) {
      rcsPuffMeshes.push(createRcsPuff(rcsPuffMeshes.length));
    }
    while (rcsPuffMeshes.length > rcsBindings.length) {
      const puff = rcsPuffMeshes.pop();
      if (puff) {
        vfxGroup.remove(puff);
        disposeMesh(puff);
      }
    }
    for (const [index, binding] of rcsBindings.entries()) {
      const puff = rcsPuffMeshes[index];
      if (!puff) {
        continue;
      }
      puff.position.copy(markerPosition({ id: binding.id, localPosition: binding.localPosition }));
      if (binding.kind === "DirectionalNozzle") {
        orientObjectAlongExhaust(puff, binding.localExhaustDirection);
      } else {
        puff.quaternion.identity();
      }
      puff.name = `${binding.id}-vfx`;
      puff.visible = false;
    }
    rcsPuffSnapshots = createIdlePuffSnapshots();
    vfxSnapshot = buildVfxSnapshot();
  };
  syncVfxToDescriptor();

  return {
    group,
    get descriptor() {
      return activeDescriptor;
    },
    setVisualState(descriptor, source, nextMarkerBindings, nextNozzleBindings) {
      activeDescriptor = descriptor;
      visualSource = source;
      markerBindings = nextMarkerBindings;
      nozzleBindings = nextNozzleBindings;
      descriptorValidation = validateShipVisualDescriptor(activeDescriptor);
      if (!descriptorValidation.ok) {
        throw new Error(`Ship visual descriptor missing required markers: ${descriptorValidation.missing.join(", ")}`);
      }
      syncVfxToDescriptor();
    },
    updatePose(position, orientation) {
      group.position.copy(position);
      setQuaternion(group, orientation);
    },
    updateVfx(telemetry, ownerOrientation) {
      const mainAccelerationMagnitude = Math.hypot(
        telemetry.lastAppliedMainAcceleration.x,
        telemetry.lastAppliedMainAcceleration.y,
        telemetry.lastAppliedMainAcceleration.z
      );
      const mainThrustScale = telemetry.mainThrustActive ? 1.35 + Math.min(2.35, mainAccelerationMagnitude * 0.12) : 0;
      mainFlame.visible = telemetry.mainThrustActive;
      mainFlame.scale.set(1 + mainThrustScale * 0.08, mainThrustScale, 1 + mainThrustScale * 0.08);

      const directionalRcsBindings = activeRcsBindings().filter((binding): binding is ShipVisualNozzleBindingSnapshot =>
        binding.kind === "DirectionalNozzle"
      );
      const selection = selectCompatibleRcsNozzles(directionalRcsBindings, {
        ownerOrientation,
        rcsTranslationAccelerationWorld: telemetry.lastAppliedRcsTranslationAcceleration,
        angularAccelerationBody: telemetry.lastAppliedAngularAcceleration,
        rcsTranslationActive: telemetry.rcsTranslationActive,
        rcsRotationActive: telemetry.rcsRotationActive,
        sasCorrectionActive: telemetry.sasCorrectionActive
      });
      const compatibilityById = new Map(selection.compatibility.map((compatibility) => [compatibility.id, compatibility]));
      const aggregateTranslationActivity = Math.hypot(
        telemetry.lastAppliedRcsTranslationAcceleration.x,
        telemetry.lastAppliedRcsTranslationAcceleration.y,
        telemetry.lastAppliedRcsTranslationAcceleration.z
      ) > 1e-6;
      const aggregateAngularActivity = Math.hypot(
        telemetry.lastAppliedAngularAcceleration.x,
        telemetry.lastAppliedAngularAcceleration.y,
        telemetry.lastAppliedAngularAcceleration.z
      ) > 1e-6;
      rcsPuffSnapshots = activeRcsBindings().map((binding, index) => {
        const puff = rcsPuffMeshes[index];
        const pulse = telemetry.sasCorrectionActive ? 1.35 : telemetry.rcsRotationActive ? 1.15 : 1;
        if (binding.kind === "LegacyMarkerFallback") {
          const visible = aggregateTranslationActivity || aggregateAngularActivity;
          if (puff) {
            puff.visible = visible;
            puff.scale.setScalar(pulse);
          }
          return {
            ...binding,
            visible,
            aggregateTranslationActivity,
            aggregateAngularActivity
          };
        }
        const compatibility = compatibilityById.get(binding.id);
        const visible = compatibility?.visible === true;
        if (puff) {
          puff.visible = visible;
          puff.scale.setScalar(pulse);
        }
        return {
          ...binding,
          visible,
          translationCompatible: compatibility?.translationCompatible ?? false,
          torqueCompatible: compatibility?.torqueCompatible ?? false,
          translationScore: Number((compatibility?.translationScore ?? 0).toFixed(6)),
          torqueScore: Number((compatibility?.torqueScore ?? 0).toFixed(6))
        };
      });
      const rcsTranslationVisible = rcsPuffSnapshots.some((puff) =>
        puff.visible && (puff.kind === "DirectionalNozzle" ? puff.translationCompatible : puff.aggregateTranslationActivity)
      );
      const angularPuffVisible = rcsPuffSnapshots.some((puff) =>
        puff.visible && (puff.kind === "DirectionalNozzle" ? puff.torqueCompatible : puff.aggregateAngularActivity)
      );
      vfxSnapshot = buildVfxSnapshot(
        telemetry.mainThrustActive,
        Number(mainThrustScale.toFixed(3)),
        rcsTranslationVisible,
        telemetry.rcsRotationActive && angularPuffVisible,
        telemetry.sasCorrectionActive && angularPuffVisible
      );
    },
    getSnapshot() {
      return {
        descriptor: activeDescriptor,
        visualSource,
        descriptorValidation,
        groupChildren: group.children.length,
        markerCounts: {
          hullParts: activeDescriptor.hullParts.length,
          mainEngines: activeDescriptor.mainEngineMarkers.length,
          rcs: activeDescriptor.rcsMarkers.length,
          muzzle: 1,
          cameraAnchors: 1
        },
        markerBindings,
        nozzleBindings,
        nozzleBindingDiagnostics: nozzleBindings
          .filter((binding): binding is ShipVisualNozzleBindingSnapshot => binding.kind === "DirectionalNozzle")
          .map((binding) => binding.diagnostic),
        cameraAnchorBinding: findBinding(markerBindings, activeDescriptor.cameraAnchor.id),
        vfx: vfxSnapshot,
        oldConeOnlyPlaceholder: false
      };
    }
  };
};

export interface DemoScoutShipVisualOptions {
  readonly browserAssetPath?: string;
  readonly autoLoad?: boolean;
  readonly loadGltf?: (browserAssetPath: string) => Promise<{ readonly scene: THREE.Object3D }>;
}

export const createProceduralShipVisual = (descriptor: ShipVisualDescriptor = proceduralScoutDescriptor): ProceduralShipVisual =>
  createShipVisualInternal(descriptor, proceduralShipVisualSource);

export const createDemoScoutShipVisual = (options: DemoScoutShipVisualOptions = {}): DemoScoutShipVisual => {
  const browserAssetPath = options.browserAssetPath ?? demoScoutGlbBrowserPath;
  const loadingSource: ShipVisualSourceSnapshot = {
    state: "Loading",
    label: "Loading Demo Scout GLB",
    candidateAssetPath: demoScoutGlbCandidatePath,
    sourceAssetPath: demoScoutGlbCandidatePath,
    browserAssetPath,
    fallbackReason: null,
    appliedScale: demoScoutGlbAppliedScale,
    axisCorrection: browserAxisCorrection
  };

  const visual = createShipVisualInternal(proceduralScoutDescriptor, loadingSource);
  const rootGroup = visual.group;
  const fallbackGeometry = rootGroup.children.find((child) => child.name === `${proceduralScoutDescriptor.id}-geometry`);
  const loadGltf = options.loadGltf ?? ((assetPath: string) => new GLTFLoader().loadAsync(assetPath));
  const glbContainer = new THREE.Group();
  glbContainer.name = "demo-scout-glb-container";
  glbContainer.visible = false;
  rootGroup.add(glbContainer);

  const load = async () => {
    try {
      const gltf = await loadGltf(browserAssetPath);
      configureImportedScene(gltf.scene);
      const resolvedBindings = resolveGlbBindings(gltf.scene, demoScoutGlbDescriptor, demoScoutGlbAppliedScale);
      if (!demoScoutGlbDescriptor.mainEngineNozzle) {
        throw new Error("Demo Scout GLB manifest is missing its directional main nozzle.");
      }
      const resolvedNozzleBindings = resolveGlbNozzleBindings(
        gltf.scene,
        [demoScoutGlbDescriptor.mainEngineNozzle, ...demoScoutGlbDescriptor.rcsNozzles],
        demoScoutGlbAppliedScale
      );
      const glbDescriptor = applyBindingsToDescriptor(demoScoutGlbDescriptor, resolvedBindings);
      const descriptorValidation = validateShipVisualDescriptor(glbDescriptor);
      if (!descriptorValidation.ok) {
        throw new Error(`Loaded GLB descriptor missing required markers: ${descriptorValidation.missing.join(", ")}`);
      }
      const correction = new THREE.Group();
      correction.name = "demo-scout-glb-axis-correction";
      correction.rotation.y = browserAxisCorrection.rotationYRadians;
      correction.scale.setScalar(demoScoutGlbAppliedScale);
      correction.add(gltf.scene);
      glbContainer.clear();
      glbContainer.add(correction);
      glbContainer.visible = true;
      if (fallbackGeometry) {
        fallbackGeometry.visible = false;
      }
      visual.setVisualState(glbDescriptor, {
        state: "GLBLoaded",
        label: "Demo Scout GLB",
        candidateAssetPath: demoScoutGlbCandidatePath,
        sourceAssetPath: demoScoutGlbCandidatePath,
        browserAssetPath,
        fallbackReason: null,
        appliedScale: demoScoutGlbAppliedScale,
        axisCorrection: browserAxisCorrection
      }, resolvedBindings, resolvedNozzleBindings);
    } catch (error) {
      glbContainer.clear();
      glbContainer.visible = false;
      if (fallbackGeometry) {
        fallbackGeometry.visible = true;
      }
      visual.setVisualState(proceduralScoutDescriptor, {
        state: "GLBFailedFallback",
        label: "Procedural fallback",
        candidateAssetPath: demoScoutGlbCandidatePath,
        sourceAssetPath: demoScoutGlbCandidatePath,
        browserAssetPath,
        fallbackReason: error instanceof Error ? error.message : String(error),
        appliedScale: 1,
        axisCorrection: nativeAxisCorrection
      }, createManifestBindings(proceduralScoutDescriptor), createInitialVfxBindings(proceduralScoutDescriptor));
    }
  };

  let loadInFlight: Promise<void> | null = null;
  const demoVisual = Object.assign(visual, {
    reload(): Promise<void> {
      if (loadInFlight) {
        return loadInFlight;
      }
      loadInFlight = load().finally(() => {
        loadInFlight = null;
      });
      return loadInFlight;
    }
  }) as DemoScoutShipVisual;

  if (options.autoLoad !== false) {
    void demoVisual.reload();
  }

  return demoVisual;
};
