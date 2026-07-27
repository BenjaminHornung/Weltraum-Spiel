export type QualityPreset = "Low" | "Medium" | "High" | "Ultra" | "Custom";
export type ConcreteQualityPreset = Exclude<QualityPreset, "Custom">;
export type ShadowQuality = "Off" | "Low" | "Medium" | "High";
export type TextureQuality = "Low" | "Medium" | "High" | "Ultra";
export type VoxelQuality = "Low" | "Medium" | "High" | "Ultra";
export type ToneMappingPreference = "None" | "Reinhard" | "ACESFilmic";
export type FullscreenPreference = "Windowed" | "Fullscreen";
export type FpsLimit = 0 | 30 | 60 | 120;
export type CapabilityStatus =
  | "SupportedLive"
  | "SupportedAfterRendererRestart"
  | "BrowserManaged"
  | "Unsupported"
  | "Planned";

export type GraphicsSettingId =
  | "renderScale"
  | "maxDevicePixelRatio"
  | "fieldOfView"
  | "renderDistance"
  | "fpsLimit"
  | "fullscreen"
  | "shadows"
  | "textureQuality"
  | "textureVariants"
  | "lightingQuality"
  | "toneMapping"
  | "exposure"
  | "environmentReflections"
  | "effectsQuality"
  | "decorDensity"
  | "bloom"
  | "motionEffects"
  | "antiAliasing"
  | "vsync";

export type GraphicsSettingPath =
  | "display.renderScale"
  | "display.maxDevicePixelRatio"
  | "display.fieldOfView"
  | "display.renderDistance"
  | "display.fpsLimit"
  | "display.fullscreenPreference"
  | "shadows.quality"
  | "textures.quality"
  | "lighting.quality"
  | "lighting.toneMapping"
  | "lighting.exposure"
  | "lighting.environmentReflectionQuality"
  | "effects.quality"
  | "effects.decorDensity"
  | "effects.bloomPreference"
  | "effects.motionEffectsPreference"
  | "antiAliasing.enabled";

export interface GraphicsSettingsV1 {
  readonly qualityPreset: QualityPreset;
  readonly display: {
    readonly renderScale: number;
    readonly maxDevicePixelRatio: number;
    readonly fieldOfView: number;
    readonly renderDistance: number;
    readonly fpsLimit: FpsLimit;
    readonly fullscreenPreference: FullscreenPreference;
  };
  readonly shadows: {
    readonly quality: ShadowQuality;
  };
  readonly textures: {
    readonly quality: TextureQuality;
  };
  readonly lighting: {
    readonly quality: QualityPreset;
    readonly toneMapping: ToneMappingPreference;
    readonly exposure: number;
    readonly environmentReflectionQuality: ConcreteQualityPreset;
  };
  readonly effects: {
    readonly quality: QualityPreset;
    readonly decorDensity: number;
    readonly bloomPreference: boolean;
    readonly motionEffectsPreference: boolean;
  };
  readonly antiAliasing: {
    readonly enabled: boolean;
  };
  readonly vsync: {
    readonly mode: "BrowserManaged";
  };
}

export interface GraphicsSettingsV2 extends GraphicsSettingsV1 {
  readonly voxel: {
    readonly detail: VoxelQuality;
    readonly detailDistanceMeters: number;
    readonly streamingBudget: VoxelQuality;
  };
}

export interface ShadowPolicy {
  readonly enabled: boolean;
  readonly mapType: "Basic" | "PCF" | "PCFSoft";
  readonly mapSize: 0 | 512 | 1024 | 2048;
  readonly updatePolicy: "Never" | "OnDemand" | "EveryFrame";
}

export interface TexturePolicy {
  readonly anisotropy: number;
  readonly maxTextureSizePolicy: "Native";
  readonly mipPolicy: "RendererManaged";
  readonly assetLoaderPreference: "CurrentAsset";
}

export interface GraphicsCapability {
  readonly status: CapabilityStatus;
  readonly reason: string;
  readonly numericLimit?: number;
}

export type GraphicsCapabilityMap = Readonly<Record<GraphicsSettingId, GraphicsCapability>>;

export interface GraphicsCapabilityProbe {
  readonly devicePixelRatio: number;
  readonly maxAnisotropy: number;
  readonly maxTextureSize: number;
  readonly fullscreenAvailable: boolean;
  readonly antiAliasingApplied: boolean;
  readonly effectiveShadows: boolean;
  readonly postProcessing: boolean;
  readonly motionEffects: boolean;
  readonly environmentReflections: boolean;
  readonly textureVariants: boolean;
}

export interface GraphicsRuntimeSnapshot {
  readonly renderScale: number;
  readonly maxDevicePixelRatio: number;
  readonly effectivePixelRatio: number;
  readonly fieldOfView: number;
  readonly renderDistance: number;
  readonly fpsLimit: FpsLimit;
  readonly fullscreenActual: FullscreenPreference;
  readonly shadowPolicy: ShadowPolicy | null;
  readonly textureAnisotropy: number;
  readonly toneMapping: ToneMappingPreference;
  readonly exposure: number;
  readonly decorDensity: number;
  readonly antiAliasingApplied: boolean;
}

export interface GraphicsApplyResult {
  readonly runtime: GraphicsRuntimeSnapshot;
  readonly applied: readonly GraphicsSettingId[];
  readonly restartRequired: readonly GraphicsSettingId[];
  readonly skipped: readonly GraphicsSettingId[];
  readonly warnings: readonly string[];
}

export interface GraphicsRuntimePort {
  getCapabilities(): GraphicsCapabilityMap;
  getSnapshot(): GraphicsRuntimeSnapshot;
  apply(
    settings: GraphicsSettingsV2,
    changedSettings: readonly GraphicsSettingId[]
  ): Promise<GraphicsApplyResult>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type GraphicsSettingsLoadReason = "Stored" | "Missing" | "Corrupt" | "Invalid" | "FutureVersion" | "Unavailable";

export interface GraphicsSettingsLoadResult {
  readonly settings: GraphicsSettingsV2;
  readonly reason: GraphicsSettingsLoadReason;
  readonly message: string;
}

export interface GraphicsSettingsControllerSnapshot {
  readonly confirmed: GraphicsSettingsV2;
  readonly draft: GraphicsSettingsV2;
  readonly runtime: GraphicsRuntimeSnapshot;
  readonly capabilities: GraphicsCapabilityMap;
  readonly hasPendingChanges: boolean;
  readonly restartRequired: readonly GraphicsSettingId[];
  readonly loadReason: GraphicsSettingsLoadReason;
  readonly message: string;
}

export interface GraphicsControllerApplyResult {
  readonly ok: boolean;
  readonly snapshot: GraphicsSettingsControllerSnapshot;
  readonly message: string;
}

export interface GraphicsSettingsController {
  getSnapshot(): GraphicsSettingsControllerSnapshot;
  subscribe(listener: (snapshot: GraphicsSettingsControllerSnapshot) => void): () => void;
  applyPreset(preset: ConcreteQualityPreset): void;
  updateSetting(path: GraphicsSettingPath, value: unknown): void;
  resetDefaults(): void;
  cancel(): void;
  initializeRuntime(): Promise<GraphicsControllerApplyResult>;
  apply(): Promise<GraphicsControllerApplyResult>;
}
