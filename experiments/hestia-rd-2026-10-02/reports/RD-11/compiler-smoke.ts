// Diagnostic only: isolate the pinned compiler from the renderer/lifecycle implementation.
import { MeshLambertNodeMaterial, TSL } from 'three/webgpu';
const material = new MeshLambertNodeMaterial();
material.colorNode = TSL.materialColor;
