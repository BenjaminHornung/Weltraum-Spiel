import * as THREE from "three";
import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createRenderCommand,
  createVisibilityPlan,
  frameRevision,
  visibilityPlanRevision,
  type FrameId,
  type MeshArtifact,
  type RenderCommandResult,
  type RepresentationKey
} from "../presentation";
import { ThreeRenderBackend } from "../render/three/backend";
import {
  createHestiaSurfaceEnvironment,
  createHestiaSurfacePresentationSnapshot,
  createHestiaStructuralTreePresentation,
  hestiaSurfaceMaterialProfilesForProfile,
  HESTIA_SURFACE_ENVIRONMENT_NAMES,
  hestiaSurfaceMaterialProfileIdForKey,
  type HestiaStructuralTreePresentation,
  type HestiaSurfaceEnvironment,
  type ResolveSurfaceStructuralMeshArtifact
} from "./environment";
import type { SurfaceStructuralPresentationSnapshot } from "./contracts";
import type { SurfaceRegionMaterializedVoxelBrick } from "./voxel-edit";
import { createSurfaceNetsVoxelMeshProduct } from "../voxel";
import { createMeshArtifactFromVoxelMeshProduct } from "../voxel/meshArtifactAdapter";
import {
  surfacePlayPresentationBrickId,
  type SurfacePlayRuntimeSnapshot
} from "./surfacePlayRuntime";
import type { HestiaSurfaceWorldFacts } from "./world";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_PRESET_ID,
  type HestiaGeneratorProfile
} from "../world-generation/hestia";

export interface SurfacePlayPresentationOptions {
  readonly backend: ThreeRenderBackend;
  readonly materializeBrick: (key: string) => Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined;
  readonly initialSnapshot: Readonly<SurfacePlayRuntimeSnapshot>;
  readonly resolveStructuralMeshArtifact?: ResolveSurfaceStructuralMeshArtifact;
  readonly initialStructuralSnapshot?: Readonly<SurfaceStructuralPresentationSnapshot>;
}

export interface SurfacePlayPresentation {
  present(snapshot: Readonly<SurfacePlayRuntimeSnapshot>): void;
  presentStructural(snapshot: Readonly<SurfaceStructuralPresentationSnapshot>): void;
  render(): void;
  dispose(): void;
}

const accepted = (result: RenderCommandResult): boolean =>
  result.status === "Accepted" || result.status === "AlreadyApplied";

const requireAccepted = (result: RenderCommandResult, operation: string): void => {
  if (!accepted(result) && result.status !== "NotFound") {
    throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
  }
};

const disposeObjectResources = (root: THREE.Object3D): void => {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
};

const coordinateKey = (
  value: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): string => `${value.x}:${value.y}:${value.z}`;

const profileForWorld = (world: Readonly<HestiaSurfaceWorldFacts> | null): HestiaGeneratorProfile =>
  world?.identity.regionId.includes("coast-lush") ? HESTIA_COAST_LUSH_PRESET_ID : HESTIA_PRESET_ID;

const applyCoastRockStrata = (root: THREE.Object3D, waterHeightMeters: number): void => {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshLambertMaterial)) return;
      const rock = Math.abs(material.color.r - 0.391572) <= 0.000001
        && Math.abs(material.color.g - 0.327778) <= 0.000001
        && Math.abs(material.color.b - 0.168269) <= 0.000001;
      material.flatShading = true;
      material.userData.hestiaCoastBlockSurface = true;
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>${rock ? "\nvarying float vHestiaCoastHeight;" : ""}`
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            transformed.y = floor(transformed.y * 2.0 + 0.5) / 2.0;
            ${rock ? "vHestiaCoastHeight = transformed.y;" : ""}`
          );
        if (!rock) return;
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vHestiaCoastHeight;")
          .replace("#include <color_fragment>", `#include <color_fragment>
            float hestiaShoreHeight = vHestiaCoastHeight - ${waterHeightMeters.toFixed(6)};
            float hestiaStrataMix = hestiaShoreHeight >= 0.0 && hestiaShoreHeight < 0.5
              ? 0.65
              : hestiaShoreHeight >= 0.0 && hestiaShoreHeight < 1.0
                ? 0.45
                : hestiaShoreHeight >= 0.0 && hestiaShoreHeight < 1.5
                  ? 0.25
                  : 0.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.597202, 0.520996, 0.296138), hestiaStrataMix);`);
      };
      material.customProgramCacheKey = () => rock
        ? "hestia-coast-block-rock-strata-v1"
        : "hestia-coast-block-surface-v1";
      material.needsUpdate = true;
      if (!rock) return;
      material.userData.hestiaCoastStrata = true;
    });
  });
};

const requireWorldBinding = (
  snapshot: Readonly<SurfacePlayRuntimeSnapshot>
): Readonly<HestiaSurfaceWorldFacts> => {
  const world = snapshot.world;
  if (world === null) throw new Error("Surface Play presentation requires World-owned environment facts.");
  const state = snapshot.authorityState;
  if (
    world.identity.bodyId !== state.bodyId
    || world.identity.regionId !== state.regionId
    || world.identity.surfaceFrameId !== state.surfaceFrameId
    || world.identity.regionRevision !== state.regionRevision
    || world.environment.rootSeed !== state.seed
    || world.environment.voxelSizeMeters !== state.voxelSizeMeters
  ) throw new Error("Surface Play World environment facts are stale for the voxel authority.");
  const worldCoordinates = world.residentBrickCoordinates.map(coordinateKey).sort();
  const authorityCoordinates = state.residentBrickCoordinates.map(coordinateKey).sort();
  if (
    worldCoordinates.length !== authorityCoordinates.length
    || worldCoordinates.some((key, index) => key !== authorityCoordinates[index])
  ) throw new Error("Surface Play World environment facts do not match resident voxel coverage.");
  return world;
};

export const createSurfacePlayPresentation = (
  options: SurfacePlayPresentationOptions
): SurfacePlayPresentation => {
  requireWorldBinding(options.initialSnapshot);
  const { backend } = options;
  requireAccepted(backend.dispatch(createRenderCommand({
    kind: "InitializeBackend",
    backendRevision: backendRevision(0)
  })), "Surface Play backend initialization");

  const artifactsByBrickKey = new Map<string, MeshArtifact>();
  const framesByRepresentation = new Map<RepresentationKey, FrameId>();
  let lastFrameId: FrameId | undefined;
  let projectionRevision = 0;
  const combatRoot = new THREE.Group();
  combatRoot.name = "surface-play-combat-presentation";

  const droneMaterial = new THREE.MeshStandardMaterial({ color: 0x5ba49f, roughness: 0.42, metalness: 0.62 });
  const drone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), droneMaterial);
  drone.name = "surface-play-survey-drone";
  const droneEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 5),
    new THREE.MeshBasicMaterial({ color: 0x8debf0 })
  );
  droneEye.position.set(0, 0, -0.72);
  drone.add(droneEye);
  combatRoot.add(drone);

  const impact = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.22, 12),
    new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  impact.name = "surface-play-impact";
  impact.visible = false;
  combatRoot.add(impact);

  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x8debf0, transparent: true, opacity: 0.72 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), beamMaterial);
  beam.name = "surface-play-pulse-cutter-beam";
  beam.visible = false;
  combatRoot.add(beam);

  const weapon = new THREE.Group();
  weapon.name = "surface-play-held-pulse-cutter";
  const weaponBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.16, 0.66),
    new THREE.MeshStandardMaterial({ color: 0x172f31, roughness: 0.48, metalness: 0.72 })
  );
  const weaponEmitter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.065, 0.34, 8),
    new THREE.MeshBasicMaterial({ color: 0x57c9c6 })
  );
  weaponEmitter.rotation.x = Math.PI / 2;
  weaponEmitter.position.z = -0.46;
  weapon.add(weaponBody, weaponEmitter);
  weapon.position.set(0.34, -0.28, -0.72);
  backend.camera.add(weapon);
  backend.scene.add(combatRoot);

  const environmentIdentity = {
    bodyId: options.initialSnapshot.authorityState.bodyId,
    regionId: options.initialSnapshot.authorityState.regionId,
    surfaceFrameId: options.initialSnapshot.authorityState.surfaceFrameId
  };
  const environment: HestiaSurfaceEnvironment = createHestiaSurfaceEnvironment(
    { scene: backend.scene, terrainRoot: backend.representationRoot },
    environmentIdentity
  );
  const structuralParent = backend.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.structuralVegetation);
  if (structuralParent === undefined) throw new Error("Hestia structural vegetation presentation root is unavailable.");
  const structuralPresentation: HestiaStructuralTreePresentation | null =
    options.resolveStructuralMeshArtifact === undefined
      ? null
      : createHestiaStructuralTreePresentation(
          structuralParent,
          environmentIdentity,
          options.resolveStructuralMeshArtifact
        );
  if (options.initialStructuralSnapshot !== undefined) {
    if (structuralPresentation === null) {
      throw new Error("Initial Structural presentation requires a Structural mesh artifact resolver.");
    }
    const result = structuralPresentation.sync(options.initialStructuralSnapshot);
    if (result !== "Applied" && result !== "Unchanged") {
      throw new Error(`Surface Play Structural presentation rejected its initial snapshot: ${result}`);
    }
  }
  let disposed = false;
  let lastPresentedEditRevision = options.initialSnapshot.authorityState.editRevision;
  let currentProfile = profileForWorld(options.initialSnapshot.world);
  let currentWaterHeightMeters = requireWorldBinding(options.initialSnapshot).waterSurfaceHeightMeters;

  const publishCurrentSet = (): void => {
    const frameId = framesByRepresentation.values().next().value ?? lastFrameId;
    if (frameId === undefined) return;
    for (const candidate of framesByRepresentation.values()) {
      if (candidate !== frameId) throw new Error("Surface Play terrain representations must share one projection frame.");
    }
    projectionRevision += 1;
    const keys = [...framesByRepresentation.keys()];
    const currentBackendRevision = backend.readDiagnostics().backendRevision;
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "ApplyFrameProjection",
      backendRevision: currentBackendRevision,
      snapshot: createFrameProjectionSnapshot({
        frameId,
        frameRevision: frameRevision(projectionRevision),
        cameraPositionRelative: backend.camera.position,
        cameraOrientation: backend.camera.quaternion,
        projectionParameters: {
          kind: "Perspective",
          verticalFovDegrees: backend.camera.fov,
          aspect: backend.camera.aspect,
          near: backend.camera.near,
          far: backend.camera.far
        },
        representationTransforms: keys.map((representationKey) => ({
          representationKey,
          positionRelative: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 }
        }))
      })
    })), "Surface Play terrain frame projection");
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "ApplyVisibilityPlan",
      backendRevision: currentBackendRevision,
      plan: createVisibilityPlan({
        planRevision: visibilityPlanRevision(projectionRevision),
        visibleRepresentationKeys: keys,
        fallbackRepresentationKeys: [],
        hiddenRepresentationKeys: []
      })
    })), "Surface Play terrain visibility plan");
  };

  const publishBrick = (key: string): void => {
    const materialized = options.materializeBrick(key);
    if (materialized === undefined) return;
    const product = createSurfaceNetsVoxelMeshProduct(materialized.voxelBrick);
    const previous = artifactsByBrickKey.get(key);
    if (product.positions.length === 0) {
      if (previous !== undefined) {
        requireAccepted(backend.dispatch(createRenderCommand({
          kind: "RemoveRepresentation",
          backendRevision: backend.readDiagnostics().backendRevision,
          representationKey: previous.representationKey,
          expectedSourceRevision: previous.sourceRevision,
          expectedArtifactRevision: previous.artifactRevision,
          expectedContentHash: previous.contentHash
        })), `Surface Play terrain removal ${key}`);
        artifactsByBrickKey.delete(key);
        framesByRepresentation.delete(previous.representationKey);
        publishCurrentSet();
      }
      return;
    }
    const artifact = createMeshArtifactFromVoxelMeshProduct(product, {
      artifactRevision: artifactRevision(materialized.editRevision),
      materialProfileIdForKey: hestiaSurfaceMaterialProfileIdForKey
    });
    if (previous !== undefined && previous.representationKey !== artifact.representationKey) {
      requireAccepted(backend.dispatch(createRenderCommand({
        kind: "RemoveRepresentation",
        backendRevision: backend.readDiagnostics().backendRevision,
        representationKey: previous.representationKey,
        expectedSourceRevision: previous.sourceRevision,
        expectedArtifactRevision: previous.artifactRevision,
        expectedContentHash: previous.contentHash
      })), `Surface Play superseded terrain removal ${key}`);
      framesByRepresentation.delete(previous.representationKey);
    }
    const referencedProfiles = new Set(artifact.materialRanges.map((range) => range.materialProfileId));
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backend.readDiagnostics().backendRevision,
      artifact,
      materialProfiles: hestiaSurfaceMaterialProfilesForProfile(currentProfile)
        .filter((profile) => referencedProfiles.has(profile.id))
    })), `Surface Play terrain publication ${key}`);
    if (currentProfile === HESTIA_COAST_LUSH_PRESET_ID) {
      applyCoastRockStrata(backend.representationRoot, currentWaterHeightMeters);
    }
    artifactsByBrickKey.set(key, artifact);
    lastFrameId = artifact.frameId;
    framesByRepresentation.set(artifact.representationKey, artifact.frameId);
    publishCurrentSet();
  };

  const syncEnvironment = (snapshot: Readonly<SurfacePlayRuntimeSnapshot>): void => {
    const world = requireWorldBinding(snapshot);
    const result = environment.sync(createHestiaSurfacePresentationSnapshot({
      terrain: snapshot.presentation.terrain,
      world,
      profile: profileForWorld(world),
      bricks: snapshot.authorityState.materializedBricks.map((brick) => ({
        brickId: surfacePlayPresentationBrickId(brick.coordinate),
        coordinate: brick.coordinate,
        terrainHash: brick.contentHash
      }))
    }));
    if (result !== "Applied" && result !== "Unchanged") {
      throw new Error(`Surface Play environment rejected authoritative presentation: ${result}`);
    }
  };

  const updateCameraAndCombat = (snapshot: Readonly<SurfacePlayRuntimeSnapshot>): void => {
    const view = snapshot.firstPersonView;
    backend.camera.position.set(view.eyePositionMeters.x, view.eyePositionMeters.y, view.eyePositionMeters.z);
    backend.camera.up.set(view.up.x, view.up.y, view.up.z);
    backend.camera.lookAt(
      view.eyePositionMeters.x + view.forward.x,
      view.eyePositionMeters.y + view.forward.y,
      view.eyePositionMeters.z + view.forward.z
    );

    const target = snapshot.presentation.target;
    drone.position.set(target.positionMeters.x, target.positionMeters.y, target.positionMeters.z);
    drone.visible = target.condition !== "Destroyed";
    droneMaterial.color.setHex(target.condition === "Damaged" ? 0xd58b58 : 0x5ba49f);

    const latestImpact = snapshot.presentation.impact;
    impact.visible = latestImpact !== null;
    if (latestImpact !== null) {
      impact.position.set(latestImpact.positionMeters.x, latestImpact.positionMeters.y, latestImpact.positionMeters.z);
      impact.lookAt(
        latestImpact.positionMeters.x + latestImpact.normal.x,
        latestImpact.positionMeters.y + latestImpact.normal.y,
        latestImpact.positionMeters.z + latestImpact.normal.z
      );
    }

    beam.visible = snapshot.presentation.weapon.firing;
    if (beam.visible) {
      const start = snapshot.presentation.weapon.muzzlePositionMeters;
      const end = latestImpact?.positionMeters ?? {
        x: start.x + view.forward.x * 45,
        y: start.y + view.forward.y * 45,
        z: start.z + view.forward.z * 45
      };
      const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
      const length = direction.length();
      beam.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
      beam.scale.set(1, length, 1);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
  };

  const present = (snapshot: Readonly<SurfacePlayRuntimeSnapshot>): void => {
    if (disposed) return;
    if (snapshot.authorityState.editRevision < lastPresentedEditRevision) return;
    currentProfile = profileForWorld(snapshot.world);
    currentWaterHeightMeters = requireWorldBinding(snapshot).waterSurfaceHeightMeters;
    for (const transition of snapshot.appliedVoxelTransitions) {
      if (transition.result.status !== "Applied") continue;
      if (transition.result.resultingEditRevision <= lastPresentedEditRevision) continue;
      if (transition.remeshPlan?.status !== "Planned") {
        throw new Error(`Applied Surface Play edit ${transition.intent.editId} has no accepted remesh plan.`);
      }
      transition.remeshPlan.orderedRemeshKeys.forEach(publishBrick);
      lastPresentedEditRevision = transition.result.resultingEditRevision;
    }
    syncEnvironment(snapshot);
    updateCameraAndCombat(snapshot);
  };

  const presentStructural = (snapshot: Readonly<SurfaceStructuralPresentationSnapshot>): void => {
    if (disposed) return;
    if (structuralPresentation === null) {
      throw new Error("Surface Play Structural presentation has no mesh artifact resolver.");
    }
    const result = structuralPresentation.sync(snapshot);
    if (result !== "Applied" && result !== "Unchanged" && result !== "Stale") {
      throw new Error(`Surface Play Structural presentation rejected authoritative presentation: ${result}`);
    }
  };

  options.initialSnapshot.authorityState.materializedBricks.map((brick) => brick.key).sort().forEach(publishBrick);
  present(options.initialSnapshot);

  return Object.freeze({
    present,
    presentStructural,
    render: () => {
      if (!disposed) requireAccepted(backend.renderFrame(), "Surface Play frame render");
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      structuralPresentation?.dispose();
      environment.dispose();
      backend.scene.remove(combatRoot);
      backend.camera.remove(weapon);
      disposeObjectResources(combatRoot);
      disposeObjectResources(weapon);
      combatRoot.clear();
      weapon.clear();
      requireAccepted(backend.dispatch(createRenderCommand({
        kind: "DisposeBackend",
        backendRevision: backend.readDiagnostics().backendRevision
      })), "Surface Play backend disposal");
      artifactsByBrickKey.clear();
      framesByRepresentation.clear();
      lastFrameId = undefined;
    }
  });
};
