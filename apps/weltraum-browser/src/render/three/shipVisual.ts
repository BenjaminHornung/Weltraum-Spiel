import * as THREE from "three";
import type { ActuatorTelemetry, Quaternion } from "../../core/types";

export interface ShipMarkerDescriptor {
  readonly id: string;
  readonly localPosition: { readonly x: number; readonly y: number; readonly z: number };
}

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
  readonly rcsMarkers: readonly ShipMarkerDescriptor[];
  readonly muzzleMarker: ShipMarkerDescriptor;
  readonly cameraAnchor: ShipCameraAnchorDescriptor;
}

export type ShipVisualSourceState = "ProceduralFallback" | "GLBUnavailableFallback" | "GLBLoaded";

export interface ShipVisualSourceSnapshot {
  readonly state: ShipVisualSourceState;
  readonly candidateAssetPath: string | null;
  readonly browserAssetPath: string | null;
  readonly fallbackReason: string | null;
}

export interface ShipVisualDescriptorValidation {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly counts: {
    readonly hullParts: number;
    readonly mainEngines: number;
    readonly rcs: number;
    readonly muzzle: number;
    readonly cameraAnchors: number;
  };
}

export interface ShipVisualVfxSnapshot {
  readonly mainThrustVisible: boolean;
  readonly mainThrustScale: number;
  readonly rcsTranslationVisible: boolean;
  readonly rcsRotationVisible: boolean;
  readonly sasCorrectionVisible: boolean;
  readonly visibleRcsPuffCount: number;
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
  readonly vfx: ShipVisualVfxSnapshot;
  readonly oldConeOnlyPlaceholder: false;
}

export interface ProceduralShipVisual {
  readonly group: THREE.Group;
  readonly descriptor: ShipVisualDescriptor;
  updatePose(position: THREE.Vector3, orientation: Quaternion): void;
  updateVfx(telemetry: ActuatorTelemetry): void;
  getSnapshot(): ShipVisualSnapshot;
}

export const proceduralScoutDescriptor: ShipVisualDescriptor = {
  id: "procedural-demo-scout-mk1-fallback",
  strategy: "ProceduralLowPolyFallback",
  displayName: "Procedural Demo Scout Mk1 fallback",
  sourceAssetPath: null,
  hullParts: ["main-hull", "left-wing", "right-wing", "spine-fin"],
  cockpitMarker: { id: "cockpit-front", localPosition: { x: 5.4, y: 1.2, z: 0 } },
  mainEngineMarkers: [{ id: "main-engine-aft", localPosition: { x: -5.2, y: 0, z: 0 } }],
  rcsMarkers: [
    { id: "rcs-front-left", localPosition: { x: 3.5, y: 0.8, z: -2.8 } },
    { id: "rcs-front-right", localPosition: { x: 3.5, y: 0.8, z: 2.8 } },
    { id: "rcs-aft-left", localPosition: { x: -3.8, y: 0.4, z: -2.7 } },
    { id: "rcs-aft-right", localPosition: { x: -3.8, y: 0.4, z: 2.7 } },
    { id: "rcs-dorsal", localPosition: { x: 0.4, y: 1.9, z: 0 } },
    { id: "rcs-ventral", localPosition: { x: 0.4, y: -1.2, z: 0 } }
  ],
  muzzleMarker: { id: "muzzle-placeholder", localPosition: { x: 6.6, y: 0, z: 0 } },
  cameraAnchor: {
    id: "chase-camera-anchor",
    localPosition: { x: -1.5, y: 1.3, z: 0 },
    chaseOffset: { x: -30, y: 12, z: 0 },
    lookAhead: 11
  }
};

export const demoScoutGlbCandidatePath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb";

export const proceduralShipVisualSource: ShipVisualSourceSnapshot = {
  state: "GLBUnavailableFallback",
  candidateAssetPath: demoScoutGlbCandidatePath,
  browserAssetPath: null,
  fallbackReason: "Demo Scout GLB is intentionally not loaded in this slice; the procedural fallback preserves deterministic marker/socket descriptors."
};

const hasFinitePosition = (marker: ShipMarkerDescriptor | ShipCameraAnchorDescriptor | undefined): boolean => {
  if (!marker) {
    return false;
  }
  return Number.isFinite(marker.localPosition.x) && Number.isFinite(marker.localPosition.y) && Number.isFinite(marker.localPosition.z);
};

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
  if (descriptor.rcsMarkers.length < 4 || descriptor.rcsMarkers.some((marker) => !hasFinitePosition(marker))) {
    missing.push("at least four RCS markers");
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
      rcs: descriptor.rcsMarkers.length,
      muzzle: hasFinitePosition(descriptor.muzzleMarker) ? 1 : 0,
      cameraAnchors: hasFinitePosition(descriptor.cameraAnchor) ? 1 : 0
    }
  };
};

const markerPosition = (marker: ShipMarkerDescriptor) => new THREE.Vector3(marker.localPosition.x, marker.localPosition.y, marker.localPosition.z);

const applyMarkerTransform = (object: THREE.Object3D, marker: ShipMarkerDescriptor): void => {
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

export const createProceduralShipVisual = (descriptor: ShipVisualDescriptor = proceduralScoutDescriptor): ProceduralShipVisual => {
  const descriptorValidation = validateShipVisualDescriptor(descriptor);
  if (!descriptorValidation.ok) {
    throw new Error(`Ship visual descriptor missing required markers: ${descriptorValidation.missing.join(", ")}`);
  }

  const group = new THREE.Group();
  group.name = descriptor.id;

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

  const engineMarkers = descriptor.mainEngineMarkers.map((marker) => createMarker(marker, 0xffc15a, 0.42));
  for (const marker of engineMarkers) {
    group.add(marker);
  }

  const rcsMarkers = descriptor.rcsMarkers.map((marker) => createMarker(marker, 0x9affc7, 0.22));
  for (const marker of rcsMarkers) {
    group.add(marker);
  }

  const muzzle = createMarker(descriptor.muzzleMarker, 0xffef9a, 0.2);
  muzzle.name = "muzzle-placeholder";
  group.add(muzzle);

  const mainFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 4.8, 10),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.74, depthWrite: false })
  );
  mainFlame.name = "main-thruster-vfx";
  mainFlame.position.set(descriptor.mainEngineMarkers[0]?.localPosition.x ?? -5.4, 0, 0);
  mainFlame.rotation.z = Math.PI / 2;
  mainFlame.visible = false;
  group.add(mainFlame);

  const rcsPuffs = descriptor.rcsMarkers.map((marker) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x9affc7, transparent: true, opacity: 0.62, depthWrite: false })
    );
    applyMarkerTransform(puff, marker);
    puff.name = `${marker.id}-vfx`;
    puff.visible = false;
    group.add(puff);
    return puff;
  });

  let vfxSnapshot: ShipVisualVfxSnapshot = {
    mainThrustVisible: false,
    mainThrustScale: 0,
    rcsTranslationVisible: false,
    rcsRotationVisible: false,
    sasCorrectionVisible: false,
    visibleRcsPuffCount: 0
  };

  return {
    group,
    descriptor,
    updatePose(position, orientation) {
      group.position.copy(position);
      setQuaternion(group, orientation);
    },
    updateVfx(telemetry) {
      const accelerationMagnitude = Math.hypot(
        telemetry.lastAppliedAcceleration.x,
        telemetry.lastAppliedAcceleration.y,
        telemetry.lastAppliedAcceleration.z
      );
      const mainThrustScale = telemetry.mainThrustActive ? 1 + Math.min(1.4, accelerationMagnitude * 0.08) : 0;
      mainFlame.visible = telemetry.mainThrustActive;
      mainFlame.scale.set(1, mainThrustScale, 1);
      const rcsVisible = telemetry.rcsTranslationActive || telemetry.rcsRotationActive || telemetry.sasCorrectionActive;
      for (const [index, puff] of rcsPuffs.entries()) {
        puff.visible = rcsVisible && (telemetry.rcsTranslationActive || telemetry.sasCorrectionActive || index % 2 === 0);
        const pulse = telemetry.sasCorrectionActive ? 1.35 : telemetry.rcsRotationActive ? 1.15 : 1;
        puff.scale.setScalar(pulse);
      }
      vfxSnapshot = {
        mainThrustVisible: telemetry.mainThrustActive,
        mainThrustScale: Number(mainThrustScale.toFixed(3)),
        rcsTranslationVisible: telemetry.rcsTranslationActive,
        rcsRotationVisible: telemetry.rcsRotationActive,
        sasCorrectionVisible: telemetry.sasCorrectionActive,
        visibleRcsPuffCount: rcsPuffs.filter((puff) => puff.visible).length
      };
    },
    getSnapshot() {
      return {
        descriptor,
        visualSource: proceduralShipVisualSource,
        descriptorValidation,
        groupChildren: group.children.length,
        markerCounts: {
          hullParts: descriptor.hullParts.length,
          mainEngines: descriptor.mainEngineMarkers.length,
          rcs: descriptor.rcsMarkers.length,
          muzzle: 1,
          cameraAnchors: 1
        },
        vfx: vfxSnapshot,
        oldConeOnlyPlaceholder: false
      };
    }
  };
};
