import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../../src/voxel";
import { generateHestiaScatter } from "../../src/world-generation/hestia";
import { createSurfaceLabEnvironment } from "../../src/surface-lab/surfaceLabEnvironment";
import { snapshotSurfaceLabTelemetry, type SurfaceLabTelemetrySnapshot } from "../../src/surface-lab/surfaceLabTelemetry";

const telemetry = (overrides: Partial<SurfaceLabTelemetrySnapshot> = {}): SurfaceLabTelemetrySnapshot => snapshotSurfaceLabTelemetry({
  lifecycle: "Ready",
  seed: "hestia-surface-lab-v1",
  presetId: "hestia.nebelwald-archipelago.preview.v1",
  voxelSizeMeters: 0.5,
  regionExtentMeters: { x: 64, y: 32, z: 64 },
  requestedChunks: 16,
  readyChunks: 16,
  failedChunks: 0,
  cancelledJobs: 0,
  staleRejects: 0,
  workerQueueDepth: 0,
  runningWorkers: 0,
  workerRestarts: 0,
  planningEpoch: 1,
  latestWorkerEpoch: 1,
  vertices: 12,
  triangles: 4,
  meshBytes: 256,
  generationMilliseconds: 10,
  meshingMilliseconds: 4,
  uploadMilliseconds: 1,
  cacheHits: 0,
  cacheMisses: 16,
  cacheBypasses: 0,
  brickHashes: ["brick-a"],
  meshHashes: ["mesh-a"],
  bodyId: "planet.hestia",
  systemFrameId: "frame:system_inertial_v1",
  bodyInertialFrameId: "frame:body_inertial_hestia",
  bodyFixedFrameId: "frame:body_fixed_hestia",
  surfaceFrameId: "frame:surface_hestia_surface_lab_v1",
  universeTick: 0,
  universeEpochSeconds: 7_200,
  ...overrides
});

describe("Surface Lab environment", () => {
  it("owns atmosphere, deterministic scatter, water, boundaries and wireframe outside terrain authority", () => {
    const scene = new THREE.Scene();
    const representationRoot = new THREE.Group();
    representationRoot.name = "authoritative-representation-root";
    scene.add(representationRoot);
    const terrainGeometry = new THREE.BoxGeometry(4, 2, 4);
    const terrainMaterial = new THREE.MeshBasicMaterial({ color: 0x123456 });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    representationRoot.add(terrain);
    const geometryDispose = vi.spyOn(terrainGeometry, "dispose");
    const materialDispose = vi.spyOn(terrainMaterial, "dispose");

    const environment = createSurfaceLabEnvironment({ scene, representationRoot });
    environment.sync(telemetry());

    const presentation = scene.getObjectByName("surface-lab-presentation");
    expect(presentation).toBeInstanceOf(THREE.Group);
    expect(presentation).not.toBe(representationRoot);
    expect(representationRoot.parent).toBe(scene);
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect((scene.background as THREE.Color).getHex()).toBe(0x0c2224);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect((scene.fog as THREE.Fog).color.getHex()).toBe(0x173638);
    expect((scene.fog as THREE.Fog).near).toBe(28);
    expect((scene.fog as THREE.Fog).far).toBe(104);
    const hemisphere = scene.getObjectByName("surface-lab-hemisphere-light") as THREE.HemisphereLight;
    const keyLight = scene.getObjectByName("surface-lab-key-light") as THREE.DirectionalLight;
    const rimLight = scene.getObjectByName("surface-lab-rim-light") as THREE.DirectionalLight;
    expect(hemisphere.intensity).toBe(1.35);
    expect(hemisphere.color.getHex()).toBe(0xb7d8c6);
    expect(hemisphere.groundColor.getHex()).toBe(0x21372d);
    expect(keyLight.intensity).toBe(3.2);
    expect(keyLight.position.toArray()).toEqual([-30, 52, 24]);
    expect(rimLight.intensity).toBe(1.1);
    expect(rimLight.position.toArray()).toEqual([34, 20, -28]);
    const water = scene.getObjectByName("surface-lab-presentation-water") as THREE.Mesh;
    expect(water).toBeInstanceOf(THREE.Mesh);
    expect(water.geometry).toBeInstanceOf(THREE.ShapeGeometry);
    expect(water.position.y).toBe(0.04);
    expect(water.scale.toArray()).toEqual([20.48, 17.92, 1]);
    expect(water.position.x).toBe(3.84);
    expect(water.position.z).toBe(-2.56);
    const waterMaterial = water.material as THREE.MeshPhongMaterial;
    expect(waterMaterial.color.getHex()).toBe(0x286c73);
    expect(waterMaterial.transparent).toBe(true);
    expect(waterMaterial.opacity).toBe(0.3);
    expect(waterMaterial.depthWrite).toBe(false);
    expect(waterMaterial.side).toBe(THREE.FrontSide);
    const waterline = scene.getObjectByName("surface-lab-presentation-waterline") as THREE.LineLoop;
    expect(waterline).toBeInstanceOf(THREE.LineLoop);
    expect(waterline.geometry.getAttribute("position").count).toBe(10);
    expect(waterline.scale.toArray()).toEqual([20.48, 1, 17.92]);
    expect(waterline.position.toArray()).toEqual([3.84, 0.09, -2.56]);
    water.updateWorldMatrix(true, false);
    waterline.updateWorldMatrix(true, false);
    const worldContour = (object: THREE.Object3D, geometry: THREE.BufferGeometry): readonly string[] => {
      const positions = geometry.getAttribute("position");
      return [...new Set(Array.from({ length: positions.count }, (_, index) => {
        const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        return `${point.x.toFixed(6)}:${point.z.toFixed(6)}`;
      }))].sort();
    };
    expect(worldContour(waterline, waterline.geometry)).toEqual(worldContour(water, water.geometry));
    expect(scene.getObjectByName("surface-lab-vegetation")?.children.length).toBeGreaterThan(0);
    expect(scene.getObjectByName("surface-lab-wireframe")?.children).toHaveLength(0);
    expect(scene.getObjectByName("surface-lab-boundaries")?.children.length).toBeGreaterThan(0);
    expect(terrain.material).toBe(terrainMaterial);

    environment.setWireframeEnabled(true);
    environment.setBoundariesEnabled(true);
    environment.setVegetationEnabled(false);
    environment.setFogEnabled(false);
    expect(environment.readState()).toMatchObject({
      wireframeEnabled: true,
      boundariesEnabled: true,
      vegetationEnabled: false,
      fogEnabled: false
    });
    expect(scene.getObjectByName("surface-lab-wireframe")?.visible).toBe(true);
    expect(scene.getObjectByName("surface-lab-wireframe")?.children).toHaveLength(1);
    const wireframeMaterial = (scene.getObjectByName("surface-lab-wireframe")?.children[0] as THREE.LineSegments)
      .material as THREE.LineBasicMaterial;
    expect(wireframeMaterial.opacity).toBe(0.13);
    expect(wireframeMaterial.depthTest).toBe(true);
    expect(wireframeMaterial.depthWrite).toBe(false);
    expect(scene.getObjectByName("surface-lab-boundaries")?.visible).toBe(true);
    const boundaryMaterial = (scene.getObjectByName("surface-lab-boundaries")?.children[0] as THREE.LineSegments)
      .material as THREE.LineDashedMaterial;
    expect(boundaryMaterial).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(boundaryMaterial.opacity).toBe(0.2);
    expect(boundaryMaterial.depthTest).toBe(true);
    expect(boundaryMaterial.depthWrite).toBe(false);
    expect(boundaryMaterial.dashSize).toBe(1.1);
    expect(boundaryMaterial.gapSize).toBe(1.7);
    expect(scene.getObjectByName("surface-lab-vegetation")?.visible).toBe(false);
    expect(scene.fog).toBeNull();

    environment.dispose();
    environment.dispose();
    expect(scene.getObjectByName("surface-lab-presentation")).toBeUndefined();
    expect(scene.background).toBeNull();
    expect(scene.getObjectByName("authoritative-representation-root")).toBe(representationRoot);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
  });

  it("rebuilds presentation scatter and boundaries when deterministic inputs change", () => {
    const scene = new THREE.Scene();
    const representationRoot = new THREE.Group();
    scene.add(representationRoot);
    const environment = createSurfaceLabEnvironment({ scene, representationRoot });
    environment.sync(telemetry());
    const firstVegetation = [...(scene.getObjectByName("surface-lab-vegetation")?.children ?? [])];

    environment.sync(telemetry());
    expect(scene.getObjectByName("surface-lab-vegetation")?.children).toEqual(firstVegetation);

    environment.sync(telemetry({
      seed: "hestia-surface-lab-v1-changed",
      voxelSizeMeters: 0.25,
      regionExtentMeters: { x: 32, y: 16, z: 32 },
      meshHashes: ["mesh-b"]
    }));
    expect(scene.getObjectByName("surface-lab-vegetation")?.children[0]).not.toBe(firstVegetation[0]);
    const water = scene.getObjectByName("surface-lab-presentation-water") as THREE.Mesh;
    expect(water.scale.x).toBeCloseTo(10.24);
    expect(water.scale.y).toBeCloseTo(8.96);
    expect(water.position.x).toBeCloseTo(1.92);
    expect(water.position.z).toBeCloseTo(-1.28);
    environment.dispose();
  });

  it("maps only recognized Lambert terrain colors and restores them on disposal", () => {
    const scene = new THREE.Scene();
    const representationRoot = new THREE.Group();
    scene.add(representationRoot);
    const recognized = new THREE.MeshLambertMaterial({ flatShading: false });
    recognized.color.setRGB(0.08, 0.12, 0.11);
    const unrecognized = new THREE.MeshLambertMaterial({ flatShading: false });
    unrecognized.color.setRGB(0.51, 0.37, 0.23);
    const nonLambert = new THREE.MeshBasicMaterial();
    nonLambert.color.setRGB(0.08, 0.12, 0.11);
    representationRoot.add(
      new THREE.Mesh(new THREE.BoxGeometry(), recognized),
      new THREE.Mesh(new THREE.BoxGeometry(), unrecognized),
      new THREE.Mesh(new THREE.BoxGeometry(), nonLambert)
    );
    const originalRecognized = recognized.color.clone();
    const originalUnrecognized = unrecognized.color.clone();
    const originalNonLambert = nonLambert.color.clone();
    const environment = createSurfaceLabEnvironment({ scene, representationRoot });

    environment.sync(telemetry());
    expect(recognized.color.toArray()).toEqual([0.13, 0.19, 0.19]);
    expect(recognized.flatShading).toBe(true);
    expect(unrecognized.color.equals(originalUnrecognized)).toBe(true);
    expect(unrecognized.flatShading).toBe(false);
    expect(nonLambert.color.equals(originalNonLambert)).toBe(true);

    environment.dispose();
    expect(recognized.color.equals(originalRecognized)).toBe(true);
    expect(recognized.flatShading).toBe(false);
    expect(unrecognized.color.equals(originalUnrecognized)).toBe(true);
    expect(nonLambert.color.equals(originalNonLambert)).toBe(true);
  });

  it("reconstructs the same authoritative scatter records without changing their fields", () => {
    const scene = new THREE.Scene();
    const representationRoot = new THREE.Group();
    scene.add(representationRoot);
    const environment = createSurfaceLabEnvironment({ scene, representationRoot });
    const canonical = telemetry();
    const authoritativeRecords = [-2, -1, 0, 1].flatMap((z) => [-2, -1, 0, 1].flatMap((x) =>
      generateHestiaScatter({
        rootSeed: canonical.seed,
        bodyId: voxelBodyId(canonical.bodyId),
        surfaceFrameId: surfaceFrameId(canonical.surfaceFrameId),
        regionId: voxelRegionId("region:hestia.surface-lab.v1"),
        brickCoordinate: { x, y: -1, z },
        voxelSizeMeters: canonical.voxelSizeMeters
      })
    ));
    const authoritativeById = new Map(authoritativeRecords.map((record) => [record.id, record]));
    const authoritativeSnapshot = structuredClone(authoritativeRecords);
    const readPresentedRecords = () =>
      (scene.getObjectByName("surface-lab-vegetation")?.children ?? []).flatMap((child) => {
        const mesh = child as THREE.InstancedMesh;
        return (mesh.userData.sourceScatterIds as readonly string[]).map((id, index) => {
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(index, matrix);
          return { id, matrix: matrix.toArray() };
        });
      });

    environment.sync(canonical);
    const first = readPresentedRecords();
    expect(first.length).toBeGreaterThan(0);
    first.forEach(({ id, matrix }) => {
      const record = authoritativeById.get(id);
      expect(record, `presented scatter ${id} must come from authoritative reconstruction`).toBeDefined();
      if (record === undefined) throw new Error(`Missing authoritative scatter record ${id}`);
      const heightOffset = record.kind === "cyan_luminous_cap" ? 1.05 : record.kind === "black_trunk" ? 1.6 : 0.58;
      const expected = new THREE.Matrix4().compose(
        new THREE.Vector3(
          record.positionMeters.x,
          record.positionMeters.y + heightOffset * record.uniformScale,
          record.positionMeters.z
        ),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), record.yawRadians),
        new THREE.Vector3().setScalar(record.uniformScale)
      );
      const expectedElements = expected.toArray();
      expect(matrix).toHaveLength(expectedElements.length);
      expectedElements.forEach((value, index) => {
        expect(matrix[index]).toBeCloseTo(value, 5);
      });
    });
    const firstRecords = structuredClone(first);

    environment.sync(telemetry({ seed: "temporary-reconstruction-seed" }));
    environment.sync(canonical);
    const reconstructed = readPresentedRecords();
    expect(reconstructed).toEqual(firstRecords);
    expect(reconstructed.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
    expect(authoritativeRecords).toEqual(authoritativeSnapshot);
    environment.dispose();
  });

  it("restores prior scene presentation and disposes only its owned water and overlay resources", () => {
    const scene = new THREE.Scene();
    const priorBackground = new THREE.Color(0x020304);
    const priorFog = new THREE.Fog(0x050607, 1, 10);
    scene.background = priorBackground;
    scene.fog = priorFog;
    const representationRoot = new THREE.Group();
    scene.add(representationRoot);
    const environment = createSurfaceLabEnvironment({ scene, representationRoot });
    environment.sync(telemetry());

    const water = scene.getObjectByName("surface-lab-presentation-water") as THREE.Mesh;
    const waterGeometryDispose = vi.spyOn(water.geometry, "dispose");
    const waterMaterialDispose = vi.spyOn(water.material as THREE.Material, "dispose");
    const boundary = scene.getObjectByName("surface-lab-boundaries")?.children[0] as THREE.LineSegments;
    const boundaryGeometryDispose = vi.spyOn(boundary.geometry, "dispose");
    const boundaryMaterialDispose = vi.spyOn(boundary.material as THREE.Material, "dispose");

    environment.setFogEnabled(false);
    expect(scene.fog).toBe(priorFog);
    environment.setFogEnabled(true);
    expect(scene.fog).not.toBe(priorFog);
    environment.dispose();
    environment.dispose();

    expect(scene.background).toBe(priorBackground);
    expect(scene.fog).toBe(priorFog);
    expect(waterGeometryDispose).toHaveBeenCalledOnce();
    expect(waterMaterialDispose).toHaveBeenCalledOnce();
    expect(boundaryGeometryDispose).toHaveBeenCalledOnce();
    expect(boundaryMaterialDispose).toHaveBeenCalledOnce();
  });

  it("builds wireframe only for enabled settled generations and clears it across regeneration", () => {
    const scene = new THREE.Scene();
    const representationRoot = new THREE.Group();
    scene.add(representationRoot);
    representationRoot.add(new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 4),
      new THREE.MeshBasicMaterial({ color: 0x123456 })
    ));
    const createWireframeGeometry = vi.fn((source: THREE.BufferGeometry) => new THREE.WireframeGeometry(source));
    const environment = createSurfaceLabEnvironment(
      { scene, representationRoot },
      { createWireframeGeometry }
    );
    const wireframeGroup = scene.getObjectByName("surface-lab-wireframe") as THREE.Group;

    environment.sync(telemetry({ lifecycle: "Partial", readyChunks: 4, meshHashes: ["mesh-partial"] }));
    environment.sync(telemetry());
    expect(createWireframeGeometry).not.toHaveBeenCalled();
    expect(wireframeGroup.children).toHaveLength(0);

    environment.setWireframeEnabled(true);
    expect(createWireframeGeometry).toHaveBeenCalledOnce();
    expect(wireframeGroup.children).toHaveLength(1);
    const staleGeometry = (wireframeGroup.children[0] as THREE.LineSegments).geometry;
    const staleGeometryDispose = vi.spyOn(staleGeometry, "dispose");

    environment.sync(telemetry());
    expect(createWireframeGeometry).toHaveBeenCalledOnce();

    environment.sync(telemetry({
      lifecycle: "Regenerating",
      planningEpoch: 2,
      readyChunks: 0,
      meshHashes: []
    }));
    expect(wireframeGroup.children).toHaveLength(0);
    expect(staleGeometryDispose).toHaveBeenCalledOnce();
    environment.sync(telemetry({
      lifecycle: "Partial",
      planningEpoch: 2,
      readyChunks: 7,
      meshHashes: ["mesh-next-partial"]
    }));
    expect(createWireframeGeometry).toHaveBeenCalledOnce();
    expect(wireframeGroup.children).toHaveLength(0);

    environment.sync(telemetry({ planningEpoch: 2, meshHashes: ["mesh-next"] }));
    environment.sync(telemetry({ planningEpoch: 2, meshHashes: ["mesh-next"] }));
    expect(createWireframeGeometry).toHaveBeenCalledTimes(2);
    expect(wireframeGroup.children).toHaveLength(1);

    environment.setWireframeEnabled(false);
    environment.sync(telemetry({ lifecycle: "Regenerating", planningEpoch: 3, readyChunks: 0, meshHashes: [] }));
    environment.sync(telemetry({ planningEpoch: 3, meshHashes: ["mesh-disabled"] }));
    expect(createWireframeGeometry).toHaveBeenCalledTimes(2);
    expect(wireframeGroup.children).toHaveLength(0);
    environment.dispose();
  });

  it("leaves retained public environment commands and disposed resources inert", () => {
    const scene = new THREE.Scene();
    const priorBackground = new THREE.Color(0x010203);
    const priorFog = new THREE.Fog(0x040506, 2, 20);
    scene.background = priorBackground;
    scene.fog = priorFog;
    const representationRoot = new THREE.Group();
    representationRoot.add(new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 4),
      new THREE.MeshBasicMaterial({ color: 0x123456 })
    ));
    scene.add(representationRoot);
    const createWireframeGeometry = vi.fn((source: THREE.BufferGeometry) => new THREE.WireframeGeometry(source));
    const environment = createSurfaceLabEnvironment(
      { scene, representationRoot },
      { createWireframeGeometry }
    );
    environment.sync(telemetry());
    environment.setWireframeEnabled(true);
    environment.setWireframeEnabled(false);
    environment.setFogEnabled(false);
    environment.sync(telemetry({ meshHashes: ["mesh-newer"] }));

    const presentationRoot = scene.getObjectByName("surface-lab-presentation") as THREE.Group;
    const water = scene.getObjectByName("surface-lab-presentation-water") as THREE.Mesh;
    const vegetationGroup = scene.getObjectByName("surface-lab-vegetation") as THREE.Group;
    const wireframeGroup = scene.getObjectByName("surface-lab-wireframe") as THREE.Group;
    const boundaryGroup = scene.getObjectByName("surface-lab-boundaries") as THREE.Group;
    const ownedGeometries = new Set<THREE.BufferGeometry>();
    const ownedMaterials = new Set<THREE.Material>();
    presentationRoot.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry !== undefined) ownedGeometries.add(renderable.geometry);
      const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      materials.forEach((material) => {
        if (material !== undefined) ownedMaterials.add(material);
      });
    });
    ownedGeometries.forEach((geometry) => vi.spyOn(geometry, "dispose"));
    ownedMaterials.forEach((material) => vi.spyOn(material, "dispose"));
    const {
      readState,
      setFogEnabled,
      setWaterEnabled,
      setVegetationEnabled,
      setWireframeEnabled,
      setBoundariesEnabled,
      sync,
      dispose
    } = environment;

    dispose();
    const disposedState = readState();
    const disposedVisibility = {
      water: water.visible,
      vegetation: vegetationGroup.visible,
      wireframe: wireframeGroup.visible,
      boundaries: boundaryGroup.visible
    };
    const disposedWireframeChildren = [...wireframeGroup.children];
    const wireframeGeometryCreations = createWireframeGeometry.mock.calls.length;

    setFogEnabled(true);
    setWaterEnabled(false);
    setVegetationEnabled(false);
    setWireframeEnabled(true);
    setBoundariesEnabled(true);
    sync(telemetry({
      planningEpoch: 2,
      seed: "post-dispose-seed",
      meshHashes: ["post-dispose-mesh"],
      regionExtentMeters: { x: 32, y: 16, z: 32 }
    }));
    dispose();

    expect(readState()).toBe(disposedState);
    expect(scene.background).toBe(priorBackground);
    expect(scene.fog).toBe(priorFog);
    expect(presentationRoot.parent).toBeNull();
    expect(water.visible).toBe(disposedVisibility.water);
    expect(vegetationGroup.visible).toBe(disposedVisibility.vegetation);
    expect(wireframeGroup.visible).toBe(disposedVisibility.wireframe);
    expect(boundaryGroup.visible).toBe(disposedVisibility.boundaries);
    expect(wireframeGroup.children).toEqual(disposedWireframeChildren);
    expect(createWireframeGeometry).toHaveBeenCalledTimes(wireframeGeometryCreations);
    ownedGeometries.forEach((geometry) => expect(geometry.dispose).toHaveBeenCalledOnce());
    ownedMaterials.forEach((material) => expect(material.dispose).toHaveBeenCalledOnce());
  });
});
