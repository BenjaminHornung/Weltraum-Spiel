import * as THREE from "three";
import {
  CHUNK_EDGE,
  VOXEL_SIZE_METERS
} from "../domain/constants";
import type { MacroWorldDescriptor } from "../domain/macroDescriptor";
import { paletteRecord } from "../domain/palette";
import type { GreedyChunkMesh } from "../domain/mesher";
import type { Vec3 } from "../domain/types";
import type { EditChunkChange } from "../domain/types";
import type { VoxelV2RenderStats, VoxelV2RendererPort } from "../runtime/ports";
import { getVoxelV2CameraPreset } from "./voxelV2CameraPresets";
import { createVoxelV2RadialProjection } from "./voxelV2RenderProjection";
import {
  createVoxelV2VegetationProjection,
  groupVoxelV2Vegetation,
  removeVoxelV2VegetationAnchors,
  voxelV2VegetationBatchKey,
  voxelV2VegetationInvalidationKeys,
  type VoxelV2VegetationBatch,
  type VoxelV2VegetationKind,
  type VoxelV2VegetationProjection
} from "./voxelV2Vegetation";

interface ChunkRenderData {
  readonly authorityRevision: number;
  readonly requestedRevision: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly regionKey: string;
  readonly mesh: GreedyChunkMesh;
}

interface RenderedRegion {
  readonly geometry: THREE.BufferGeometry;
  readonly mesh: THREE.Mesh;
}

interface VegetationResources {
  readonly geometries: Readonly<Record<VoxelV2VegetationKind, THREE.BufferGeometry>>;
  readonly materials: Readonly<{
    readonly wood: THREE.MeshStandardMaterial;
    readonly canopy: THREE.MeshStandardMaterial;
    readonly flora: THREE.MeshStandardMaterial;
  }>;
}

export interface VoxelV2RegionBatch {
  readonly regionKey: string;
  readonly origin: Vec3;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly materialIds: Uint8Array;
  readonly ao: Uint8Array;
  readonly colors: Uint8Array;
  readonly tint: Uint8Array;
  readonly roughness: Float32Array;
  readonly emissive: Float32Array;
  readonly wetness: Float32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

const REGION_CHUNK_EDGE = 2;
const CHUNK_SIZE_METERS = CHUNK_EDGE * VOXEL_SIZE_METERS;
const TERRAIN_SURFACE_OFFSET_METERS = 0.01;
const NEAR_AUTHORITY_HALF_EXTENT_METERS = 32;
const PROJECTION_OVERLAP_METERS = 4;
const MID_TERRAIN_INNER_RADIUS_METERS = NEAR_AUTHORITY_HALF_EXTENT_METERS - PROJECTION_OVERLAP_METERS;
const PLAYER_TERRAIN_RENDER_RADIUS_METERS = 20;
const ZERO_INSTANCE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export const VOXEL_V2_WATER_PRESENTATION = Object.freeze({
  roughness: 0.16,
  metalness: 0.04,
  clearcoat: 0.72,
  clearcoatRoughness: 0.12,
  ior: 1.333,
  reflectivity: 0.68,
  opacity: 0.43
});

const regionCoordinate = (chunkCoordinate: number): number => Math.floor(chunkCoordinate / REGION_CHUNK_EDGE);

const regionCoordinates = (coord: GreedyChunkMesh["coord"]): Vec3 => ({
  x: regionCoordinate(coord.x),
  y: regionCoordinate(coord.y),
  z: regionCoordinate(coord.z)
});

export const voxelV2RegionKey = (coord: GreedyChunkMesh["coord"]): string => {
  const region = regionCoordinates(coord);
  return `${region.x},${region.y},${region.z}`;
};

export const shouldAdoptVoxelV2Chunk = (
  existing: Pick<ChunkRenderData, "authorityRevision" | "requestedRevision"> | null | undefined,
  candidate: Pick<GreedyChunkMesh, "chunkAuthorityRevision" | "requestedRevision">
): boolean => existing === null || existing === undefined
  || candidate.chunkAuthorityRevision > existing.authorityRevision
  || (candidate.chunkAuthorityRevision === existing.authorityRevision
    && candidate.requestedRevision >= existing.requestedRevision);

export const shouldRenderVoxelV2NearRegion = (
  centerX: number,
  centerZ: number,
  radius: number,
  playerX: number,
  playerZ: number
): boolean => Math.hypot(centerX, centerZ) <= MID_TERRAIN_INNER_RADIUS_METERS + radius
  || Math.hypot(centerX - playerX, centerZ - playerZ) <= PLAYER_TERRAIN_RENDER_RADIUS_METERS + radius;

const createProjectionMesh = (
  descriptor: MacroWorldDescriptor,
  kind: "terrain" | "water",
  innerRadiusMeters: number,
  radiusMeters: number,
  radialSegments: number,
  rings: number,
  surfaceOffsetMeters = 0,
  role: "beauty" | "mid" | "far" | "water" = kind === "water" ? "water" : "far"
): THREE.Mesh => {
  const projection = createVoxelV2RadialProjection(descriptor, {
    kind,
    innerRadiusMeters,
    radiusMeters,
    radialSegments,
    rings,
    surfaceOffsetMeters
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(projection.positions, 3));
  geometry.setAttribute("color", new THREE.Uint8BufferAttribute(projection.colors, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(projection.indices, 1));
  geometry.computeVertexNormals();
  const material = kind === "water"
    ? new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: VOXEL_V2_WATER_PRESENTATION.roughness,
      metalness: VOXEL_V2_WATER_PRESENTATION.metalness,
      clearcoat: VOXEL_V2_WATER_PRESENTATION.clearcoat,
      clearcoatRoughness: VOXEL_V2_WATER_PRESENTATION.clearcoatRoughness,
      ior: VOXEL_V2_WATER_PRESENTATION.ior,
      reflectivity: VOXEL_V2_WATER_PRESENTATION.reflectivity,
      transparent: true,
      opacity: VOXEL_V2_WATER_PRESENTATION.opacity,
      depthWrite: false,
       side: THREE.DoubleSide,
      flatShading: false
    })
    : new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      transparent: false,
      opacity: 1,
      depthWrite: true,
       side: THREE.FrontSide,
      flatShading: true
    });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = role === "water" ? "voxel-v2-static-water" : `voxel-v2-radial-${role}-terrain`;
  mesh.renderOrder = role === "water" ? 10 : role === "beauty" ? -3 : role === "mid" ? -4 : -5;
  mesh.castShadow = false;
  mesh.receiveShadow = kind !== "water";
  return mesh;
};

const createVegetationResources = (): VegetationResources => ({
  geometries: {
    trunk: new THREE.CylinderGeometry(0.5, 0.72, 1, 6, 1),
    canopy: new THREE.DodecahedronGeometry(1, 0),
    branch: new THREE.CylinderGeometry(0.5, 0.72, 1, 5, 1),
    flora: new THREE.ConeGeometry(0.72, 1, 5, 1)
  },
  materials: {
    wood: new THREE.MeshStandardMaterial({ color: 0x5b4028, roughness: 0.92, flatShading: true }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x5b9c4b, roughness: 0.86, flatShading: true }),
    flora: new THREE.MeshStandardMaterial({ color: 0x9fcf62, roughness: 0.88, flatShading: true })
  }
});

const colorBytes = (mesh: GreedyChunkMesh): Uint8Array => {
  const colors = new Uint8Array(mesh.vertexCount * 3);
  for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
    const material = paletteRecord(mesh.materialIds[vertex]!);
    const base = new THREE.Color(material.baseColor);
    colors[vertex * 3] = Math.max(0, Math.min(255, Math.round(base.r * 255)));
    colors[vertex * 3 + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255)));
    colors[vertex * 3 + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255)));
  }
  return colors;
};

const configureTerrainMaterial = (material: THREE.MeshStandardMaterial): void => {
  material.onBeforeCompile = (shader) => {
    const vertexDeclarations = [
      "attribute float voxelMaterialId;",
      "attribute float voxelAo;",
      "attribute vec3 voxelTint;",
      "attribute float voxelRoughness;",
      "attribute float voxelEmissive;",
      "attribute float voxelWetness;",
      "varying float vVoxelMaterialId;",
      "varying float vVoxelAo;",
      "varying vec3 vVoxelTint;",
      "varying float vVoxelRoughness;",
      "varying float vVoxelEmissive;",
      "varying float vVoxelWetness;"
    ].join("\n");
    const vertexAssignments = [
      "vVoxelMaterialId = voxelMaterialId;",
      "vVoxelAo = voxelAo;",
      "vVoxelTint = voxelTint;",
      "vVoxelRoughness = voxelRoughness;",
      "vVoxelEmissive = voxelEmissive;",
      "vVoxelWetness = voxelWetness;"
    ].join("\n");
    const fragmentDeclarations = [
      "varying float vVoxelMaterialId;",
      "varying float vVoxelAo;",
      "varying vec3 vVoxelTint;",
      "varying float vVoxelRoughness;",
      "varying float vVoxelEmissive;",
      "varying float vVoxelWetness;"
    ].join("\n");

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${vertexDeclarations}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertexAssignments}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${fragmentDeclarations}`)
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n"
          + "float voxelAoFactor = mix( 0.55, 1.0, clamp( vVoxelAo / 3.0, 0.0, 1.0 ) );\n"
          + "float voxelMaterialIdValid = step( 0.0, vVoxelMaterialId ) * step( vVoxelMaterialId, 11.0 );\n"
          + "float voxelWetFactor = clamp( vVoxelWetness, 0.0, 1.0 );\n"
          + "diffuseColor.rgb *= voxelAoFactor;\n"
          + "diffuseColor.rgb *= mix( vec3( 1.0 ), vVoxelTint, 0.08 * voxelMaterialIdValid );\n"
          + "diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.72, 0.90, 0.94 ), clamp( voxelWetFactor * 0.35, 0.0, 0.35 ) );"
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\n"
          + "roughnessFactor = clamp( mix( roughnessFactor, vVoxelRoughness, 0.82 ), 0.05, 1.0 );"
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n"
          + "totalEmissiveRadiance += vec3( vVoxelEmissive * 0.25 );"
      );
  };
  material.customProgramCacheKey = () => "voxel-v2-terrain-attributes-v1";
};

export const combineVoxelV2Region = (meshes: readonly GreedyChunkMesh[]): VoxelV2RegionBatch => {
  const orderedMeshes = [...meshes].sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  const region = orderedMeshes.length > 0 ? regionCoordinates(orderedMeshes[0]!.coord) : { x: 0, y: 0, z: 0 };
  const regionKey = `${region.x},${region.y},${region.z}`;
  const origin = {
    x: region.x * REGION_CHUNK_EDGE * CHUNK_SIZE_METERS,
    y: region.y * REGION_CHUNK_EDGE * CHUNK_SIZE_METERS,
    z: region.z * REGION_CHUNK_EDGE * CHUNK_SIZE_METERS
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const materialIds: number[] = [];
  const ao: number[] = [];
  const colors: number[] = [];
  const tint: number[] = [];
  const roughness: number[] = [];
  const emissive: number[] = [];
  const wetness: number[] = [];

  for (const mesh of orderedMeshes) {
    const vertexOffset = positions.length / 3;
    const chunkOffset = {
      x: (mesh.coord.x - region.x * REGION_CHUNK_EDGE) * CHUNK_SIZE_METERS,
      y: (mesh.coord.y - region.y * REGION_CHUNK_EDGE) * CHUNK_SIZE_METERS,
      z: (mesh.coord.z - region.z * REGION_CHUNK_EDGE) * CHUNK_SIZE_METERS
    };
    const meshColors = colorBytes(mesh);
    for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
      const positionIndex = vertex * 3;
      positions.push(
        mesh.positions[positionIndex]! + chunkOffset.x,
        mesh.positions[positionIndex + 1]! + chunkOffset.y,
        mesh.positions[positionIndex + 2]! + chunkOffset.z
      );
      normals.push(mesh.normals[positionIndex]!, mesh.normals[positionIndex + 1]!, mesh.normals[positionIndex + 2]!);
      colors.push(meshColors[positionIndex]!, meshColors[positionIndex + 1]!, meshColors[positionIndex + 2]!);

      const materialId = mesh.materialIds[vertex]!;
      const material = paletteRecord(materialId);
      const baseColor = new THREE.Color(material.baseColor);
      materialIds.push(materialId);
      ao.push(mesh.ao[vertex]!);
      tint.push(Math.round(baseColor.r * 255), Math.round(baseColor.g * 255), Math.round(baseColor.b * 255));
      roughness.push(material.roughness);
      emissive.push(material.emissive);
      wetness.push(material.physicalClass === "wet" ? 1 : 0);
    }
    for (const index of mesh.indices) indices.push(index + vertexOffset);
  }

  return Object.freeze({
    regionKey,
    origin,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    materialIds: new Uint8Array(materialIds),
    ao: new Uint8Array(ao),
    colors: new Uint8Array(colors),
    tint: new Uint8Array(tint),
    roughness: new Float32Array(roughness),
    emissive: new Float32Array(emissive),
    wetness: new Float32Array(wetness),
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3
  });
};

const directionFor = (yaw: number, pitch: number): THREE.Vector3 => {
  const horizontal = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal
  ).normalize();
};

const geometryCounts = (object: THREE.Mesh | THREE.InstancedMesh): { readonly vertices: number; readonly triangles: number } => {
  const positions = object.geometry.getAttribute("position");
  const indexCount = object.geometry.getIndex()?.count ?? positions?.count ?? 0;
  const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
  return {
    vertices: (positions?.count ?? 0) * instanceCount,
    triangles: (indexCount / 3) * instanceCount
  };
};

export class VoxelV2ThreeRenderer implements VoxelV2RendererPort {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.05, 180);
  private readonly chunks = new Map<string, ChunkRenderData>();
  private readonly chunkRevisionWatermarks = new Map<string, Pick<ChunkRenderData, "authorityRevision" | "requestedRevision">>();
  private readonly regionChunks = new Map<string, Set<string>>();
  private readonly regions = new Map<string, RenderedRegion>();
  private farTerrain: THREE.Mesh | null = null;
  private beautyTerrain: THREE.Mesh | null = null;
  private midTerrain: THREE.Mesh | null = null;
  private water: THREE.Mesh | null = null;
  private waterPhase = 0;
  private vegetationProjection: VoxelV2VegetationProjection | null = null;
  private readonly vegetationMeshes = new Map<string, THREE.InstancedMesh>();
  private readonly vegetationAnchorSlots = new Map<string, { readonly mesh: THREE.InstancedMesh; readonly index: number }[]>();
  private readonly vegetationResources = createVegetationResources();
  private readonly sky: THREE.Mesh;
  private readonly clouds: THREE.InstancedMesh;
  private readonly terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.01,
    flatShading: false,
    side: THREE.FrontSide
  });
  private readonly keyLight: THREE.DirectionalLight;
  private readonly hitMarker: THREE.Mesh;
  private currentView: "player" | "coast" | "archipelago" | "river" = "player";
  private playerPosition: Vec3 = { x: 8.625, y: 4, z: 14.125 };
  private playerYaw = 0;
  private playerPitch = -0.14;
  private currentStats: VoxelV2RenderStats = Object.freeze({ visibleChunks: 0, vertices: 0, triangles: 0, drawCalls: 0 });
  private worldDescriptor: MacroWorldDescriptor | null = null;
  private disposed = false;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.background = new THREE.Color(0x62b8e8);
    configureTerrainMaterial(this.terrainMaterial);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = new THREE.Fog(0x7aaec5, 92, 310);

    const hemisphere = new THREE.HemisphereLight(0x9bdce3, 0x314437, 1.45);
    this.keyLight = new THREE.DirectionalLight(0xffe1ae, 2.15);
    this.keyLight.position.set(-32, 52, 30);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1536, 1536);
    this.keyLight.shadow.camera.left = -34;
    this.keyLight.shadow.camera.right = 34;
    this.keyLight.shadow.camera.top = 36;
    this.keyLight.shadow.camera.bottom = -30;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 130;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.015;
    const fill = new THREE.DirectionalLight(0x6aaab4, 0.45);
    fill.position.set(28, 18, -34);
    this.scene.add(hemisphere, this.keyLight, fill, this.keyLight.target);

    const skyGeometry = new THREE.SphereGeometry(150, 32, 16);
    const skyColors = new Uint8Array(skyGeometry.getAttribute("position").count * 3);
    const skyPosition = skyGeometry.getAttribute("position");
    const skyTop = new THREE.Color(0x0878cf);
    const skyHorizon = new THREE.Color(0x84cbe8);
    const skyLower = new THREE.Color(0x6da9ae);
    for (let vertex = 0; vertex < skyPosition.count; vertex += 1) {
      const height = (skyPosition.getY(vertex) + 30) / 120;
      const color = height >= 0
        ? skyHorizon.clone().lerp(skyTop, Math.min(1, height))
        : skyLower.clone().lerp(skyHorizon, height + 1);
      skyColors[vertex * 3] = Math.round(color.r * 255);
      skyColors[vertex * 3 + 1] = Math.round(color.g * 255);
      skyColors[vertex * 3 + 2] = Math.round(color.b * 255);
    }
    skyGeometry.setAttribute("color", new THREE.Uint8BufferAttribute(skyColors, 3, true));
    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.name = "voxel-v2-sky-horizon";
    this.sky.renderOrder = -20;

    const cloudGeometry = new THREE.DodecahedronGeometry(1, 0);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      vertexColors: true
    });
    const cloudLayout = [
      [-118, 58, -72, 24, 3.2, 10], [-82, 52, -44, 15, 2.4, 7], [-46, 64, 18, 30, 3.8, 11],
      [-4, 55, -76, 19, 2.7, 8], [42, 68, -38, 27, 3.4, 10], [90, 57, 12, 22, 3, 9],
      [126, 72, 68, 34, 4.2, 13], [62, 49, 105, 17, 2.3, 7], [-142, 47, 84, 26, 3.1, 10],
      [8, 76, 128, 32, 4, 12], [-64, 70, 128, 20, 2.8, 8]
    ] as const;
    this.clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudLayout.length);
    const cloudMatrix = new THREE.Matrix4();
    const cloudQuaternion = new THREE.Quaternion();
    for (let index = 0; index < cloudLayout.length; index += 1) {
      const [x, y, z, scaleX, scaleY, scaleZ] = cloudLayout[index]!;
      cloudMatrix.compose(new THREE.Vector3(x, y, z), cloudQuaternion, new THREE.Vector3(scaleX, scaleY, scaleZ));
      this.clouds.setMatrixAt(index, cloudMatrix);
      this.clouds.setColorAt(index, new THREE.Color(index % 3 === 0 ? 0xe7f5e4 : 0xc8e4df));
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    if (this.clouds.instanceColor) this.clouds.instanceColor.needsUpdate = true;
    this.clouds.name = "voxel-v2-low-poly-clouds";
    this.clouds.castShadow = false;
    this.clouds.receiveShadow = false;
    this.clouds.renderOrder = 6;

    this.scene.add(this.sky, this.clouds);

    this.hitMarker = new THREE.Mesh(
      new THREE.BoxGeometry(VOXEL_SIZE_METERS * 1.15, VOXEL_SIZE_METERS * 1.15, VOXEL_SIZE_METERS * 1.15),
      new THREE.MeshBasicMaterial({ color: 0xffe38a, transparent: true, opacity: 0.88, wireframe: true })
    );
    this.hitMarker.name = "voxel-v2-hit-marker";
    this.hitMarker.visible = false;
    this.scene.add(this.hitMarker);
    this.setView("player");
    this.resize();
  }

  public setWorldDescriptor(descriptor: MacroWorldDescriptor): void {
    if (this.disposed || this.worldDescriptor === descriptor) return;
    this.worldDescriptor = descriptor;
    this.disposeProjection(this.farTerrain);
    this.disposeProjection(this.beautyTerrain);
    this.disposeProjection(this.midTerrain);
    this.disposeProjection(this.water);
    this.farTerrain = createProjectionMesh(
      descriptor,
      "terrain",
      96 - PROJECTION_OVERLAP_METERS,
      460,
      96,
      18,
      TERRAIN_SURFACE_OFFSET_METERS
    );
    this.beautyTerrain = createProjectionMesh(descriptor, "terrain", 0, 40, 128, 40, TERRAIN_SURFACE_OFFSET_METERS, "beauty");
    this.midTerrain = createProjectionMesh(
      descriptor,
      "terrain",
      NEAR_AUTHORITY_HALF_EXTENT_METERS - PROJECTION_OVERLAP_METERS,
      96,
      128,
      96,
      TERRAIN_SURFACE_OFFSET_METERS,
      "mid"
    );
    this.water = createProjectionMesh(descriptor, "water", 0, 520, 96, 12);
    this.scene.add(this.farTerrain, this.beautyTerrain, this.midTerrain, this.water);
    this.updateBeautyVisibility();
    this.rebuildVegetation();
  }

  public invalidateVegetation(changes: readonly EditChunkChange[]): void {
    if (this.disposed || this.worldDescriptor === null || changes.length === 0) return;
    const projection = this.vegetationProjection;
    if (projection === null) return;
    const invalidated = voxelV2VegetationInvalidationKeys(projection, changes);
    if (invalidated.length === 0) return;
    const invalidatedSet = new Set(invalidated);
    const invalidatedMeshes = new Set<THREE.InstancedMesh>();
    for (const anchorId of invalidatedSet) {
      for (const slot of this.vegetationAnchorSlots.get(anchorId) ?? []) {
        slot.mesh.setMatrixAt(slot.index, ZERO_INSTANCE_MATRIX);
        invalidatedMeshes.add(slot.mesh);
      }
      this.vegetationAnchorSlots.delete(anchorId);
    }
    for (const mesh of invalidatedMeshes) mesh.instanceMatrix.needsUpdate = true;
    this.vegetationProjection = removeVoxelV2VegetationAnchors(projection, invalidated);
  }

  public adoptMesh(mesh: GreedyChunkMesh): boolean {
    if (this.disposed) return false;
    const existing = this.chunks.get(mesh.key);
    const currentRevision = existing ?? this.chunkRevisionWatermarks.get(mesh.key);
    if (!shouldAdoptVoxelV2Chunk(currentRevision, mesh)) return false;
    this.chunkRevisionWatermarks.set(mesh.key, {
      authorityRevision: mesh.chunkAuthorityRevision,
      requestedRevision: mesh.requestedRevision
    });
    const affectedRegions = new Set<string>();
    if (existing) {
      affectedRegions.add(existing.regionKey);
      this.removeChunkFromRegion(existing.regionKey, mesh.key);
      this.chunks.delete(mesh.key);
    }
    if (mesh.vertexCount > 0) {
      const regionKey = voxelV2RegionKey(mesh.coord);
      const regionChunkKeys = this.regionChunks.get(regionKey) ?? new Set<string>();
      regionChunkKeys.add(mesh.key);
      this.regionChunks.set(regionKey, regionChunkKeys);
      this.chunks.set(mesh.key, {
        authorityRevision: mesh.chunkAuthorityRevision,
        requestedRevision: mesh.requestedRevision,
        vertexCount: mesh.vertexCount,
        triangleCount: mesh.triangleCount,
        regionKey,
        mesh
      });
      affectedRegions.add(regionKey);
    }
    for (const regionKey of affectedRegions) this.rebuildRegion(regionKey);
    return true;
  }

  public removeMesh(key: string): void {
    if (this.disposed) return;
    const existing = this.chunks.get(key);
    if (!existing) return;
    this.removeChunkFromRegion(existing.regionKey, key);
    this.chunks.delete(key);
    this.rebuildRegion(existing.regionKey);
  }

  public setView(view: "player" | "coast" | "archipelago" | "river"): void {
    if (this.disposed) return;
    this.currentView = view;
    this.keyLight.castShadow = view !== "player";
    this.renderer.shadowMap.enabled = view !== "player";
    this.renderer.setPixelRatio(view === "player" ? 0.75 : 1);
    this.updateBeautyVisibility();
    const preset = getVoxelV2CameraPreset(
      view === "player"
        ? "first-person-spawn"
        : view === "coast"
          ? "coastal-valley"
          : view === "archipelago"
            ? "archipelago-mountain"
            : "wetland-roots"
    );
    this.camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    this.camera.fov = preset.fov;
    this.camera.near = preset.near;
    this.camera.far = preset.far;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(preset.target.x, preset.target.y, preset.target.z);
  }

  public setPlayerPose(position: Vec3, yaw: number, pitch: number): void {
    if (this.disposed) return;
    this.playerPosition = { ...position };
    this.playerYaw = yaw;
    this.playerPitch = pitch;
  }

  public setHitMarker(position: Vec3 | null, accepted: boolean): void {
    if (this.disposed) return;
    this.hitMarker.visible = position !== null;
    if (position) {
      this.hitMarker.position.set(position.x, position.y, position.z);
      (this.hitMarker.material as THREE.MeshBasicMaterial).color.set(accepted ? 0xffdc72 : 0xff6c6c);
    }
  }

  public render(deltaSeconds: number): void {
    if (this.disposed) return;
    this.resize();
    this.updateWaterPresentation(deltaSeconds);
    if (this.currentView === "player") {
      const eye = new THREE.Vector3(this.playerPosition.x, this.playerPosition.y + 1.52, this.playerPosition.z);
      const target = eye.clone().add(directionFor(this.playerYaw, this.playerPitch).multiplyScalar(12));
      this.camera.position.copy(eye);
      this.camera.lookAt(target);
    }
    this.updateRegionVisibility();
    this.renderer.render(this.scene, this.camera);
    let vertices = 0;
    let triangles = 0;
    for (const chunk of this.chunks.values()) {
      vertices += chunk.vertexCount;
      triangles += chunk.triangleCount;
    }
    for (const object of [this.farTerrain, this.beautyTerrain, this.midTerrain, this.water, this.sky, this.clouds, ...this.vegetationMeshes.values()]) {
      if (object) {
        const counts = geometryCounts(object);
        vertices += counts.vertices;
        triangles += counts.triangles;
      }
    }
    const hitMarkerCounts = geometryCounts(this.hitMarker);
    vertices += hitMarkerCounts.vertices;
    triangles += hitMarkerCounts.triangles;
    this.currentStats = Object.freeze({
      visibleChunks: this.chunks.size,
      vertices,
      triangles,
      drawCalls: this.renderer.info.render.calls
    });
  }

  public stats(): VoxelV2RenderStats { return this.currentStats; }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const region of this.regions.values()) this.disposeRegion(region);
    this.regions.clear();
    this.regionChunks.clear();
    this.chunks.clear();
    this.chunkRevisionWatermarks.clear();
    this.disposeProjection(this.farTerrain);
    this.disposeProjection(this.beautyTerrain);
    this.disposeProjection(this.midTerrain);
    this.disposeProjection(this.water);
    this.disposeVegetationMeshes();
    for (const geometry of Object.values(this.vegetationResources.geometries)) geometry.dispose();
    for (const material of Object.values(this.vegetationResources.materials)) material.dispose();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.clouds.dispatchEvent({ type: "dispose" });
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.hitMarker.geometry.dispose();
    (this.hitMarker.material as THREE.Material).dispose();
    this.terrainMaterial.dispose();
    this.keyLight.shadow.map?.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }

  private updateWaterPresentation(deltaSeconds: number): void {
    if (!this.water) return;
    this.waterPhase = (this.waterPhase + deltaSeconds * 1.08) % (Math.PI * 2);
    const material = this.water.material;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.clearcoat = VOXEL_V2_WATER_PRESENTATION.clearcoat + Math.sin(this.waterPhase) * 0.06;
      material.reflectivity = VOXEL_V2_WATER_PRESENTATION.reflectivity + Math.sin(this.waterPhase * 1.7) * 0.045;
      material.opacity = VOXEL_V2_WATER_PRESENTATION.opacity + Math.sin(this.waterPhase * 0.8) * 0.018;
    }
    this.water.position.y = Math.sin(this.waterPhase * 0.65) * 0.008;
  }

  private rebuildVegetation(): void {
    if (this.worldDescriptor === null) {
      this.disposeVegetationMeshes();
      this.vegetationProjection = null;
      return;
    }
    this.vegetationProjection = createVoxelV2VegetationProjection(this.worldDescriptor);
    this.rebuildVegetationMeshes();
  }

  private rebuildVegetationMeshes(): void {
    this.disposeVegetationMeshes();
    if (this.vegetationProjection === null) return;
    for (const batch of groupVoxelV2Vegetation(this.vegetationProjection)) {
      const batchKey = voxelV2VegetationBatchKey(batch.band, batch.kind);
      const mesh = this.createVegetationMesh(batch);
      this.vegetationMeshes.set(batchKey, mesh);
      this.scene.add(mesh);
    }
  }

  private createVegetationMesh(batch: VoxelV2VegetationBatch): THREE.InstancedMesh {
    const geometry = this.vegetationResources.geometries[batch.kind];
    const material = batch.kind === "canopy"
      ? this.vegetationResources.materials.canopy
      : batch.kind === "flora"
        ? this.vegetationResources.materials.flora
        : this.vegetationResources.materials.wood;
    const mesh = new THREE.InstancedMesh(geometry, material, batch.instances.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < batch.instances.length; index += 1) {
      const instance = batch.instances[index]!;
      position.set(instance.position.x, instance.position.y, instance.position.z);
      rotation.set(instance.rotation.x, instance.rotation.y, instance.rotation.z);
      quaternion.setFromEuler(rotation);
      scale.set(instance.scale.x, instance.scale.y, instance.scale.z);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      const slots = this.vegetationAnchorSlots.get(instance.anchorId) ?? [];
      slots.push({ mesh, index });
      this.vegetationAnchorSlots.set(instance.anchorId, slots);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `voxel-v2-vegetation-${batch.band}-${batch.kind}`;
    mesh.visible = batch.band === "near"
      ? this.currentView === "player"
      : batch.band !== "far" || this.currentView !== "player";
    mesh.castShadow = batch.band === "near";
    mesh.receiveShadow = batch.band === "near" && batch.kind !== "canopy";
    mesh.renderOrder = batch.band === "near" ? 0 : batch.band === "mid" ? -1 : -2;
    return mesh;
  }

  private disposeVegetationMeshes(): void {
    for (const mesh of this.vegetationMeshes.values()) {
      this.scene.remove(mesh);
      mesh.dispatchEvent({ type: "dispose" });
    }
    this.vegetationMeshes.clear();
    this.vegetationAnchorSlots.clear();
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  private removeChunkFromRegion(regionKey: string, chunkKey: string): void {
    const chunkKeys = this.regionChunks.get(regionKey);
    if (!chunkKeys) return;
    chunkKeys.delete(chunkKey);
    if (chunkKeys.size === 0) this.regionChunks.delete(regionKey);
  }

  private rebuildRegion(regionKey: string): void {
    const previous = this.regions.get(regionKey);
    if (previous) {
      this.disposeRegion(previous);
      this.regions.delete(regionKey);
    }
    const chunkKeys = this.regionChunks.get(regionKey);
    if (!chunkKeys || chunkKeys.size === 0) return;
    const meshes = [...chunkKeys]
      .map((key) => this.chunks.get(key)?.mesh)
      .filter((mesh): mesh is GreedyChunkMesh => mesh !== undefined);
    if (meshes.length === 0) return;

    const combined = combineVoxelV2Region(meshes);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(combined.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(combined.normals, 3));
    geometry.setAttribute("color", new THREE.Uint8BufferAttribute(combined.colors, 3, true));
    geometry.setAttribute("voxelMaterialId", new THREE.Uint8BufferAttribute(combined.materialIds, 1));
    geometry.setAttribute("voxelAo", new THREE.Uint8BufferAttribute(combined.ao, 1));
    geometry.setAttribute("voxelTint", new THREE.Uint8BufferAttribute(combined.tint, 3, true));
    geometry.setAttribute("voxelRoughness", new THREE.Float32BufferAttribute(combined.roughness, 1));
    geometry.setAttribute("voxelEmissive", new THREE.Float32BufferAttribute(combined.emissive, 1));
    geometry.setAttribute("voxelWetness", new THREE.Float32BufferAttribute(combined.wetness, 1));
    geometry.setIndex(new THREE.BufferAttribute(combined.indices, 1));
    geometry.computeBoundingSphere();
    const rendered = new THREE.Mesh(geometry, this.terrainMaterial);
    rendered.name = `voxel-v2-region-${regionKey}`;
    rendered.visible = this.currentView === "player";
    rendered.position.set(combined.origin.x, combined.origin.y, combined.origin.z);
    rendered.castShadow = true;
    rendered.receiveShadow = true;
    this.scene.add(rendered);
    this.regions.set(regionKey, {
      geometry,
      mesh: rendered
    });
  }

  private updateBeautyVisibility(): void {
    const beauty = this.currentView !== "player";
    if (this.beautyTerrain) this.beautyTerrain.visible = beauty;
    this.updateRegionVisibility();
    for (const mesh of this.vegetationMeshes.values()) {
      if (mesh.name.includes("-near-")) mesh.visible = !beauty;
      if (mesh.name.includes("-far-")) mesh.visible = beauty;
    }
  }

  private updateRegionVisibility(): void {
    if (this.currentView !== "player") {
      for (const region of this.regions.values()) region.mesh.visible = false;
      return;
    }
    for (const region of this.regions.values()) {
      const sphere = region.geometry.boundingSphere;
      const centerX = region.mesh.position.x + (sphere?.center.x ?? 0);
      const centerZ = region.mesh.position.z + (sphere?.center.z ?? 0);
      const radius = sphere?.radius ?? 0;
      region.mesh.visible = shouldRenderVoxelV2NearRegion(
        centerX,
        centerZ,
        radius,
        this.playerPosition.x,
        this.playerPosition.z
      );
    }
  }

  private disposeRegion(region: RenderedRegion): void {
    this.scene.remove(region.mesh);
    region.geometry.dispose();
  }

  private disposeProjection(projection: THREE.Mesh | null): void {
    if (!projection) return;
    this.scene.remove(projection);
    projection.geometry.dispose();
    (projection.material as THREE.Material).dispose();
  }
}
