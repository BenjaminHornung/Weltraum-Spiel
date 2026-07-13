import * as THREE from "three";
import {
  createDefaultGraphicsSettings,
  createDefaultRuntimeSnapshot,
  deepFreeze,
  detectGraphicsCapabilities,
  resolveShadowPolicy,
  resolveTexturePolicy,
  type FpsLimit,
  type GraphicsApplyResult,
  type GraphicsCapabilityMap,
  type GraphicsRuntimePort,
  type GraphicsRuntimeSnapshot,
  type GraphicsSettingId,
  type GraphicsSettingsV1,
  type ToneMappingPreference
} from "../../settings";

export class PresentationScheduler {
  private fpsLimit: FpsLimit = 0;
  private lastPresentedAt: number | null = null;

  setLimit(fpsLimit: FpsLimit): void {
    if (this.fpsLimit !== fpsLimit) {
      this.fpsLimit = fpsLimit;
      this.lastPresentedAt = null;
    }
  }

  getLimit(): FpsLimit {
    return this.fpsLimit;
  }

  shouldPresent(timestampMilliseconds: number): boolean {
    if (this.fpsLimit === 0) {
      this.lastPresentedAt = timestampMilliseconds;
      return true;
    }
    const interval = 1_000 / this.fpsLimit;
    if (this.lastPresentedAt === null || timestampMilliseconds < this.lastPresentedAt) {
      this.lastPresentedAt = timestampMilliseconds;
      return true;
    }
    const elapsed = timestampMilliseconds - this.lastPresentedAt;
    if (elapsed + 0.5 < interval) {
      return false;
    }
    this.lastPresentedAt = timestampMilliseconds - (elapsed % interval);
    return true;
  }
}

export interface ThreeGraphicsSettingsAdapterOptions {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  readonly fullscreenElement?: HTMLElement;
}

const liveSettingIds: readonly GraphicsSettingId[] = [
  "renderScale",
  "maxDevicePixelRatio",
  "fieldOfView",
  "renderDistance",
  "fpsLimit",
  "textureQuality",
  "lightingQuality",
  "toneMapping",
  "exposure",
  "effectsQuality",
  "decorDensity"
];

function toneMappingValue(preference: ToneMappingPreference): THREE.ToneMapping {
  if (preference === "Reinhard") return THREE.ReinhardToneMapping;
  if (preference === "ACESFilmic") return THREE.ACESFilmicToneMapping;
  return THREE.NoToneMapping;
}

function shadowMapValue(policy: ReturnType<typeof resolveShadowPolicy>): THREE.ShadowMapType {
  if (policy.mapType === "PCFSoft") return THREE.PCFSoftShadowMap;
  if (policy.mapType === "PCF") return THREE.PCFShadowMap;
  return THREE.BasicShadowMap;
}

function materialTextures(material: THREE.Material): readonly THREE.Texture[] {
  return Object.values(material).filter((value): value is THREE.Texture => value instanceof THREE.Texture);
}

export class ThreeGraphicsSettingsAdapter implements GraphicsRuntimePort {
  readonly scheduler = new PresentationScheduler();
  private settings = createDefaultGraphicsSettings();
  private runtime: GraphicsRuntimeSnapshot;

  constructor(private readonly options: ThreeGraphicsSettingsAdapterOptions) {
    const actualAntialias = options.renderer.getContext().getContextAttributes()?.antialias ?? false;
    this.runtime = createDefaultRuntimeSnapshot(actualAntialias);
    this.publishRuntimeMetadata();
  }

  getCapabilities(): GraphicsCapabilityMap {
    const hasShadowLight = this.options.scene.children.some((object) => object instanceof THREE.Light && object.castShadow);
    let hasCaster = false;
    let hasReceiver = false;
    this.options.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        hasCaster ||= object.castShadow;
        hasReceiver ||= object.receiveShadow;
      }
    });
    return detectGraphicsCapabilities({
      devicePixelRatio: window.devicePixelRatio,
      maxAnisotropy: this.options.renderer.capabilities.getMaxAnisotropy(),
      maxTextureSize: this.options.renderer.capabilities.maxTextureSize,
      fullscreenAvailable: document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function",
      antiAliasingApplied: this.runtime.antiAliasingApplied,
      effectiveShadows: hasShadowLight && hasCaster && hasReceiver,
      postProcessing: false,
      motionEffects: false,
      environmentReflections: false,
      textureVariants: false
    });
  }

  getSnapshot(): GraphicsRuntimeSnapshot {
    const fullscreenActual = document.fullscreenElement === null ? "Windowed" : "Fullscreen";
    return deepFreeze(structuredClone({ ...this.runtime, fullscreenActual })) as GraphicsRuntimeSnapshot;
  }

  resize(): void {
    const width = Math.max(1, this.options.canvas.clientWidth);
    const height = Math.max(1, this.options.canvas.clientHeight);
    this.options.camera.aspect = width / height;
    this.options.camera.updateProjectionMatrix();

    const requested = Math.min(window.devicePixelRatio, this.settings.display.maxDevicePixelRatio) * this.settings.display.renderScale;
    const maxTextureSize = Math.max(1, this.options.renderer.capabilities.maxTextureSize);
    const hardwareLimit = Math.min(maxTextureSize / width, maxTextureSize / height);
    const effectivePixelRatio = Math.max(Number.EPSILON, Math.min(requested, hardwareLimit));
    this.options.renderer.setPixelRatio(effectivePixelRatio);
    this.options.renderer.setSize(width, height, false);
    this.runtime = deepFreeze(structuredClone({
      ...this.runtime,
      renderScale: this.settings.display.renderScale,
      maxDevicePixelRatio: this.settings.display.maxDevicePixelRatio,
      effectivePixelRatio
    })) as GraphicsRuntimeSnapshot;
    this.publishRuntimeMetadata();
  }

  refreshManagedTextures(): void {
    const policy = resolveTexturePolicy(this.settings.textures.quality, this.options.renderer.capabilities.getMaxAnisotropy());
    this.options.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const texture of materialTextures(material)) {
          if (texture.anisotropy !== policy.anisotropy) {
            texture.anisotropy = policy.anisotropy;
            texture.needsUpdate = true;
          }
        }
      }
    });
    this.runtime = deepFreeze(structuredClone({ ...this.runtime, textureAnisotropy: policy.anisotropy })) as GraphicsRuntimeSnapshot;
    this.publishRuntimeMetadata();
  }

  async apply(settings: GraphicsSettingsV1, changedSettings: readonly GraphicsSettingId[]): Promise<GraphicsApplyResult> {
    this.settings = deepFreeze(structuredClone(settings)) as GraphicsSettingsV1;
    const capabilities = this.getCapabilities();
    const applied = new Set<GraphicsSettingId>();
    const skipped = new Set<GraphicsSettingId>();
    const warnings: string[] = [];

    this.options.camera.fov = settings.display.fieldOfView;
    this.options.camera.far = settings.display.renderDistance;
    this.options.camera.updateProjectionMatrix();
    this.scheduler.setLimit(settings.display.fpsLimit);
    this.options.renderer.toneMapping = toneMappingValue(settings.lighting.toneMapping);
    this.options.renderer.toneMappingExposure = settings.lighting.exposure;
    this.applyDecorDensity(settings.effects.decorDensity);
    this.resize();
    this.refreshManagedTextures();
    liveSettingIds.forEach((id) => {
      if (capabilities[id].status === "SupportedLive") applied.add(id);
      else skipped.add(id);
    });

    const shadowPolicy = resolveShadowPolicy(settings.shadows.quality);
    if (capabilities.shadows.status === "SupportedLive") {
      this.options.renderer.shadowMap.enabled = shadowPolicy.enabled;
      this.options.renderer.shadowMap.type = shadowMapValue(shadowPolicy);
      this.options.renderer.shadowMap.autoUpdate = shadowPolicy.updatePolicy === "EveryFrame";
      this.options.renderer.shadowMap.needsUpdate = shadowPolicy.updatePolicy !== "Never";
      this.options.scene.traverse((object) => {
        if (object instanceof THREE.Light && object.castShadow && "shadow" in object) {
          const light = object as THREE.Light & { shadow: THREE.LightShadow };
          if (shadowPolicy.mapSize > 0) light.shadow.mapSize.setScalar(shadowPolicy.mapSize);
        }
      });
      applied.add("shadows");
    } else {
      skipped.add("shadows");
    }

    if (changedSettings.includes("fullscreen")) {
      if (capabilities.fullscreen.status === "BrowserManaged" && await this.applyFullscreen(settings.display.fullscreenPreference, warnings)) {
        applied.add("fullscreen");
      } else {
        skipped.add("fullscreen");
      }
    }

    for (const id of ["textureVariants", "environmentReflections", "bloom", "motionEffects", "vsync"] as const) {
      skipped.add(id);
    }

    const antiAliasingApplied = this.runtime.antiAliasingApplied;
    const restartRequired: GraphicsSettingId[] = settings.antiAliasing.enabled === antiAliasingApplied ? [] : ["antiAliasing"];
    if (restartRequired.length === 0) applied.add("antiAliasing");

    this.runtime = deepFreeze(structuredClone({
      ...this.runtime,
      fieldOfView: settings.display.fieldOfView,
      renderDistance: settings.display.renderDistance,
      fpsLimit: settings.display.fpsLimit,
      fullscreenActual: document.fullscreenElement === null ? "Windowed" : "Fullscreen",
      shadowPolicy: capabilities.shadows.status === "SupportedLive" ? shadowPolicy : null,
      toneMapping: settings.lighting.toneMapping,
      exposure: settings.lighting.exposure,
      decorDensity: settings.effects.decorDensity
    })) as GraphicsRuntimeSnapshot;
    this.publishRuntimeMetadata();

    return deepFreeze({
      runtime: this.getSnapshot(),
      applied: [...applied],
      restartRequired,
      skipped: [...skipped],
      warnings
    }) as GraphicsApplyResult;
  }

  private applyDecorDensity(density: number): void {
    this.options.scene.traverse((object) => {
      if (object.userData.renderOnly !== true) return;
      const baseCount = Number(object.userData.graphicsDensityBaseCount);
      if (!Number.isInteger(baseCount) || baseCount < 0) return;
      const count = Math.max(0, Math.min(baseCount, Math.floor(baseCount * density)));
      if (object.userData.graphicsDensityMode === "drawRange" && object instanceof THREE.Points) {
        object.geometry.setDrawRange(0, count);
      } else if (object.userData.graphicsDensityMode === "instanceCount" && object instanceof THREE.InstancedMesh) {
        object.count = count;
      }
    });
  }

  private async applyFullscreen(preference: GraphicsSettingsV1["display"]["fullscreenPreference"], warnings: string[]): Promise<boolean> {
    try {
      if (preference === "Fullscreen" && document.fullscreenElement === null) {
        await (this.options.fullscreenElement ?? document.documentElement).requestFullscreen();
      } else if (preference === "Windowed" && document.fullscreenElement !== null) {
        await document.exitFullscreen();
      }
      return (document.fullscreenElement === null ? "Windowed" : "Fullscreen") === preference;
    } catch (error) {
      warnings.push(`Fullscreen request was declined: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private publishRuntimeMetadata(): void {
    const dataset = this.options.canvas.dataset;
    dataset.graphicsPreset = this.settings.qualityPreset;
    dataset.graphicsRenderScale = String(this.runtime.renderScale);
    dataset.graphicsMaxDpr = String(this.runtime.maxDevicePixelRatio);
    dataset.graphicsEffectivePixelRatio = String(Number(this.runtime.effectivePixelRatio.toFixed(4)));
    dataset.graphicsFov = String(this.runtime.fieldOfView);
    dataset.graphicsRenderDistance = String(this.runtime.renderDistance);
    dataset.graphicsFpsLimit = String(this.runtime.fpsLimit);
    dataset.graphicsAntialiasApplied = String(this.runtime.antiAliasingApplied);
    dataset.graphicsToneMapping = this.runtime.toneMapping;
    dataset.graphicsExposure = String(this.runtime.exposure);
    dataset.graphicsDecorDensity = String(this.runtime.decorDensity);
  }
}
