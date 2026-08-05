import * as THREE from "three";
import { CHUNK_EDGE, SEA_LEVEL_METERS, VOXEL_SIZE_METERS } from "../domain/constants";
import { paletteRecord } from "../domain/palette";
import type { GreedyChunkMesh } from "../domain/mesher";
import type { Vec3 } from "../domain/types";
import type { VoxelV2RenderStats, VoxelV2RendererPort } from "../runtime/ports";

interface RenderedChunk {
  readonly authorityRevision: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly mesh: THREE.Mesh;
}

const colorBytes = (mesh: GreedyChunkMesh): Uint8Array => {
  const colors = new Uint8Array(mesh.vertexCount * 3);
  for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
    const material = paletteRecord(mesh.materialIds[vertex]!);
    const base = new THREE.Color(material.baseColor);
    const occlusion = 0.55 + (mesh.ao[vertex]! / 3) * 0.45;
    colors[vertex * 3] = Math.max(0, Math.min(255, Math.round(base.r * occlusion * 255)));
    colors[vertex * 3 + 1] = Math.max(0, Math.min(255, Math.round(base.g * occlusion * 255)));
    colors[vertex * 3 + 2] = Math.max(0, Math.min(255, Math.round(base.b * occlusion * 255)));
  }
  return colors;
};

const directionFor = (yaw: number, pitch: number): THREE.Vector3 => {
  const horizontal = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal
  ).normalize();
};

export class VoxelV2ThreeRenderer implements VoxelV2RendererPort {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.05, 180);
  private readonly chunks = new Map<string, RenderedChunk>();
  private readonly water: THREE.Mesh;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly hitMarker: THREE.Mesh;
  private currentView: "player" | "coast" | "river" = "player";
  private playerPosition: Vec3 = { x: 8.625, y: 4, z: 14.125 };
  private playerYaw = 0;
  private playerPitch = -0.14;
  private currentStats: VoxelV2RenderStats = Object.freeze({ visibleChunks: 0, vertices: 0, triangles: 0, drawCalls: 0 });

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = new THREE.Fog(0x76cbd1, 42, 118);

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

    const waterGeometry = new THREE.PlaneGeometry(64, 64, 1, 1);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x20b8c1,
      roughness: 0.24,
      metalness: 0.02,
      transparent: true,
      opacity: 0.43,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.name = "voxel-v2-static-water";
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = SEA_LEVEL_METERS + VOXEL_SIZE_METERS * 0.04;
    this.water.renderOrder = 10;
    this.water.castShadow = false;
    this.water.receiveShadow = false;
    this.scene.add(this.water);

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

  public adoptMesh(mesh: GreedyChunkMesh): boolean {
    const existing = this.chunks.get(mesh.key);
    if (existing && existing.authorityRevision > mesh.chunkAuthorityRevision) return false;
    if (existing) this.disposeChunk(existing);
    if (mesh.vertexCount === 0) {
      this.chunks.delete(mesh.key);
      return true;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
    const colorAttribute = new THREE.Uint8BufferAttribute(colorBytes(mesh), 3);
    colorAttribute.normalized = true;
    geometry.setAttribute("color", colorAttribute);
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.01,
      flatShading: false,
      side: THREE.FrontSide
    });
    const rendered = new THREE.Mesh(geometry, material);
    rendered.name = `voxel-v2-chunk-${mesh.key}`;
    rendered.position.set(
      mesh.coord.x * CHUNK_EDGE * VOXEL_SIZE_METERS,
      mesh.coord.y * CHUNK_EDGE * VOXEL_SIZE_METERS,
      mesh.coord.z * CHUNK_EDGE * VOXEL_SIZE_METERS
    );
    rendered.castShadow = true;
    rendered.receiveShadow = true;
    this.scene.add(rendered);
    this.chunks.set(mesh.key, {
      authorityRevision: mesh.chunkAuthorityRevision,
      vertexCount: mesh.vertexCount,
      triangleCount: mesh.triangleCount,
      geometry,
      material,
      mesh: rendered
    });
    return true;
  }

  public removeMesh(key: string): void {
    const existing = this.chunks.get(key);
    if (!existing) return;
    this.disposeChunk(existing);
    this.chunks.delete(key);
  }

  public setView(view: "player" | "coast" | "river"): void {
    this.currentView = view;
    if (view === "coast") {
      this.camera.position.set(30, 29, 31);
      this.camera.lookAt(-8, 7, 0);
    } else if (view === "river") {
      this.camera.position.set(4, 33, 31);
      this.camera.lookAt(3, 8, -5);
    }
  }

  public setPlayerPose(position: Vec3, yaw: number, pitch: number): void {
    this.playerPosition = { ...position };
    this.playerYaw = yaw;
    this.playerPitch = pitch;
  }

  public setHitMarker(position: Vec3 | null, accepted: boolean): void {
    this.hitMarker.visible = position !== null;
    if (position) {
      this.hitMarker.position.set(position.x, position.y, position.z);
      (this.hitMarker.material as THREE.MeshBasicMaterial).color.set(accepted ? 0xffdc72 : 0xff6c6c);
    }
  }

  public render(): void {
    this.resize();
    if (this.currentView === "player") {
      const eye = new THREE.Vector3(this.playerPosition.x, this.playerPosition.y + 1.52, this.playerPosition.z);
      const target = eye.clone().add(directionFor(this.playerYaw, this.playerPitch).multiplyScalar(12));
      this.camera.position.copy(eye);
      this.camera.lookAt(target);
    }
    this.renderer.render(this.scene, this.camera);
    let vertices = 0;
    let triangles = 0;
    for (const chunk of this.chunks.values()) {
      vertices += chunk.vertexCount;
      triangles += chunk.triangleCount;
    }
    this.currentStats = Object.freeze({
      visibleChunks: this.chunks.size,
      vertices,
      triangles,
      drawCalls: this.renderer.info.render.calls
    });
  }

  public stats(): VoxelV2RenderStats { return this.currentStats; }

  public dispose(): void {
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.water.geometry.dispose();
    (this.water.material as THREE.Material).dispose();
    this.hitMarker.geometry.dispose();
    (this.hitMarker.material as THREE.Material).dispose();
    this.renderer.dispose();
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

  private disposeChunk(chunk: RenderedChunk): void {
    this.scene.remove(chunk.mesh);
    chunk.geometry.dispose();
    chunk.material.dispose();
  }
}
