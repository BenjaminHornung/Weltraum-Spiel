import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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
    readonly rcs: number;
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
  readonly rcsTranslationVisible: boolean;
  readonly rcsRotationVisible: boolean;
  readonly sasCorrectionVisible: boolean;
  readonly visibleRcsPuffCount: number;
  readonly rcsBindings: readonly ShipVisualMarkerBindingSnapshot[];
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
  readonly cameraAnchorBinding: ShipVisualMarkerBindingSnapshot;
  readonly vfx: ShipVisualVfxSnapshot;
  readonly oldConeOnlyPlaceholder: false;
}

export interface ShipVisual {
  readonly group: THREE.Group;
  readonly descriptor: ShipVisualDescriptor;
  updatePose(position: THREE.Vector3, orientation: Quaternion): void;
  updateVfx(telemetry: ActuatorTelemetry): void;
  getSnapshot(): ShipVisualSnapshot;
}

export type ProceduralShipVisual = ShipVisual;

export const demoScoutGlbCandidatePath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb";
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
  rcsMarkers: [
    { id: "rcs-front-left", localPosition: { x: 1.856, y: 0.576, z: -2.352 } },
    { id: "rcs-front-right", localPosition: { x: 1.856, y: 0.576, z: 2.352 } },
    { id: "rcs-aft-left", localPosition: { x: -1.856, y: -0.576, z: -2.352 } },
    { id: "rcs-aft-right", localPosition: { x: -1.856, y: -0.576, z: 2.352 } }
  ],
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

const createVfxObjects = (group: THREE.Group) => {
  const mainFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 4.8, 10),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.74, depthWrite: false })
  );
  mainFlame.name = "main-thruster-vfx";
  mainFlame.rotation.z = Math.PI / 2;
  mainFlame.visible = false;
  group.add(mainFlame);

  const rcsPuffs = Array.from({ length: 6 }, (_, index) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x9affc7, transparent: true, opacity: 0.62, depthWrite: false })
    );
    puff.name = `rcs-puff-${index}`;
    puff.visible = false;
    group.add(puff);
    return puff;
  });

  return { mainFlame, rcsPuffs };
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
    bindings: readonly ShipVisualMarkerBindingSnapshot[]
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
  const { mainFlame, rcsPuffs } = createVfxObjects(vfxGroup);
  let visualSource = initialSource;
  let markerBindings = createManifestBindings(activeDescriptor);
  let vfxSnapshot: ShipVisualVfxSnapshot = {
    mainThrustVisible: false,
    mainThrustScale: 0,
    mainEngineBinding: findBinding(markerBindings, activeDescriptor.mainEngineMarkers[0]?.id ?? "main-engine-aft"),
    rcsTranslationVisible: false,
    rcsRotationVisible: false,
    sasCorrectionVisible: false,
    visibleRcsPuffCount: 0,
    rcsBindings: markerBindings.filter((binding) => binding.role === "rcs")
  };

  const syncVfxToDescriptor = () => {
    const mainEngine = activeDescriptor.mainEngineMarkers[0];
    if (mainEngine) {
      mainFlame.position.copy(markerPosition(mainEngine));
    }
    for (const [index, puff] of rcsPuffs.entries()) {
      const marker = activeDescriptor.rcsMarkers[index % activeDescriptor.rcsMarkers.length];
      if (marker) {
        applyMarkerTransform(puff, marker);
        puff.name = `${marker.id}-vfx`;
      }
    }
    vfxSnapshot = {
      ...vfxSnapshot,
      mainEngineBinding: findBinding(markerBindings, activeDescriptor.mainEngineMarkers[0]?.id ?? "main-engine-aft"),
      rcsBindings: markerBindings.filter((binding) => binding.role === "rcs")
    };
  };
  syncVfxToDescriptor();

  return {
    group,
    descriptor: initialDescriptor,
    setVisualState(descriptor, source, bindings) {
      activeDescriptor = descriptor;
      visualSource = source;
      markerBindings = bindings;
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
      const activePuffs = rcsPuffs.slice(0, activeDescriptor.rcsMarkers.length);
      for (const [index, puff] of rcsPuffs.entries()) {
        const participates = index < activePuffs.length;
        puff.visible = participates && rcsVisible && (telemetry.rcsTranslationActive || telemetry.sasCorrectionActive || index % 2 === 0);
        const pulse = telemetry.sasCorrectionActive ? 1.35 : telemetry.rcsRotationActive ? 1.15 : 1;
        puff.scale.setScalar(pulse);
      }
      vfxSnapshot = {
        mainThrustVisible: telemetry.mainThrustActive,
        mainThrustScale: Number(mainThrustScale.toFixed(3)),
        mainEngineBinding: findBinding(markerBindings, activeDescriptor.mainEngineMarkers[0]?.id ?? "main-engine-aft"),
        rcsTranslationVisible: telemetry.rcsTranslationActive,
        rcsRotationVisible: telemetry.rcsRotationActive,
        sasCorrectionVisible: telemetry.sasCorrectionActive,
        visibleRcsPuffCount: rcsPuffs.filter((puff) => puff.visible).length,
        rcsBindings: markerBindings.filter((binding) => binding.role === "rcs")
      };
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
}

export const createProceduralShipVisual = (descriptor: ShipVisualDescriptor = proceduralScoutDescriptor): ProceduralShipVisual =>
  createShipVisualInternal(descriptor, proceduralShipVisualSource);

export const createDemoScoutShipVisual = (options: DemoScoutShipVisualOptions = {}): ShipVisual => {
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
  const glbContainer = new THREE.Group();
  glbContainer.name = "demo-scout-glb-container";
  glbContainer.visible = false;
  rootGroup.add(glbContainer);

  let loadStarted = false;

  const load = async () => {
    if (loadStarted) {
      return;
    }
    loadStarted = true;
    try {
      const gltf = await new GLTFLoader().loadAsync(browserAssetPath);
      configureImportedScene(gltf.scene);
      const resolvedBindings = resolveGlbBindings(gltf.scene, demoScoutGlbDescriptor, demoScoutGlbAppliedScale);
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
      }, resolvedBindings);
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
      }, createManifestBindings(proceduralScoutDescriptor));
    }
  };

  if (options.autoLoad !== false) {
    void load();
  }

  return visual;
};
