export { surfaceMaterial, sky, setWind } from './b2-materials.js';
export { installOwnedGenericOverride, withOwnedOverrideBinding, requireDefaultOverrideCache, replaceOwnedObjectCallback, requireSynchronousCallback } from './generic-mask-override.js';
export type { OverrideLease } from './generic-mask-override.js';
export { createDepthCameraPort, windInputs, assertOwner, lightDepthPolicy } from './port.js';
export type { MaterialData, Variant, SceneId } from './port.js';
export type {
  Upscaler, UpscalerOptions, UpscalerConfig, DispatchInputs, GuideDispatchInputs,
  TemporalGuides, UpscalerNode, UpscalerNodeOptions, UpscalePass, UpscalePassConfig,
  QualityMode, RuntimeSettings,
} from '@pmndrs/upscaler';

import type { Upscaler, DispatchInputs } from '@pmndrs/upscaler';
import type { DepthTexture, Texture } from 'three';
import type { createDepthCameraPort, assertOwner } from './port.js';

export type BorrowedDepthCameraPort = ReturnType<typeof createDepthCameraPort>;
export type ExistingMaterialOwner = Parameters<typeof assertOwner>[0];
export type TemporalDispatchInputs = DispatchInputs & {
  depth: DepthTexture;
  velocity: Texture;
};
export type DispatchCamera = Parameters<Upscaler['dispatch']>[1];
export type SceneNodeFactory = typeof import('@pmndrs/upscaler').upscaleScene;
export type ExplicitNodeFactory = typeof import('@pmndrs/upscaler').upscale;
