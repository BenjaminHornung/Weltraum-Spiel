import type { PerspectiveCamera, DepthTexture, Material } from 'three';
import { createDepthCameraPort, windInputs, assertOwner, type MaterialData, type Variant } from '../build-input/dist/src/port.js';
import { surfaceMaterial, setWind } from '../build-input/dist/src/b2-materials.js';
import { admitAdapter } from '../build-input/dist/src/capability.mjs';
import { compareImages } from '../build-input/dist/src/image-oracle.mjs';

const variants: Variant[] = ['historical-webgl', 'current-webgl', 'current-webgpu'];
const profile: MaterialData = { id: 'leaf', role: 'foliage', colorLinearRgb: [.19, .48, .11] };
const materialFactory: (api: typeof import('three'), node: boolean, data: MaterialData, water?: boolean, leaf?: boolean) => Material = surfaceMaterial;
function consumer(camera: PerspectiveCamera, depth: DepthTexture) {
  const port = createDepthCameraPort(camera, depth, 1, { fixture: 'F00-CONTROL' });
  const epoch: number = port.epoch;
  const x: number = windInputs('leaf', 120, .35, [4, 0, 2], [0, 0, 0, 1]).x;
  assertOwner({ owner: 'terrain', generation: 0 }, { owner: 'terrain', generation: 0 });
  setWind(x, 0);
  const result = compareImages(new Uint8Array(64), new Uint8Array(64), 4, 4);
  const accepted: boolean = result.pass;
  const admission = admitAdapter(null);
  return { epoch, accepted, admission, variants, profile, materialFactory };
}
export type ExistingConsumerContract = typeof consumer;
