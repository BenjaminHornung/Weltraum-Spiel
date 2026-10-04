// Compile-only ownership/constructor surface. NEVER invoked in phase1.
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
export async function publicSurfaceCompileOnly(canvas: HTMLCanvasElement) {
  const gpu = new WebGPUEngine(canvas, { doNotHandleContextLost: true });
  await gpu.initAsync({ jsPath: '', wasmPath: '' }, { jsPath: '', wasmPath: '' });
  const device: GPUDevice = gpu._device; const scene = new Scene(gpu); scene.detachControl(); scene.useRightHandedSystem = true;
  const camera = new FreeCamera('compile-only', Vector3.Zero(), scene); camera.detachControl();
  const material = new StandardMaterial('compile-only', scene); const mesh = new Mesh('compile-only', scene); mesh.setEnabled(false); mesh.hasVertexAlpha = false; mesh.material = material;
  const vertices = new VertexData(); vertices.positions = new Float32Array(9); vertices.indices = new Uint16Array([0, 1, 2]); vertices.applyToMesh(mesh);
  await material.forceCompilationAsync(mesh); scene.render(); gpu.endFrame(); scene.dispose(); gpu.dispose();
  const gl2 = canvas.getContext('webgl2'); if (!gl2) { throw new Error('WebGL2 absent'); }
  const gl = new Engine(gl2, true, { doNotHandleContextLost: true }); const observedVersion: number = gl.webGLVersion; gl.dispose();
  return { device, observedVersion, shaderLanguage: material.shaderLanguage, controlsDetached: !camera.inputs.attachedToElement };
}
