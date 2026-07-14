import * as THREE from "three";
import {
  backendRevision,
  renderCommandResult,
  type RenderCommand,
  type RenderCommandResult
} from "../../../presentation";
import { ThreeRenderBackend } from "./threeRenderBackend";

export interface DeterministicRenderHarness {
  readonly canvas: HTMLCanvasElement;
  readonly backend: ThreeRenderBackend;
  dispatch(command: RenderCommand): RenderCommandResult;
  render(): RenderCommandResult;
  dispose(): RenderCommandResult;
}

export interface DeterministicHarnessOptions {
  readonly parent?: HTMLElement;
  readonly backgroundColor?: number;
}

export const createDeterministicRenderHarness = (
  options: DeterministicHarnessOptions = {}
): DeterministicRenderHarness => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  canvas.style.width = "640px";
  canvas.style.height = "360px";
  canvas.style.display = "block";
  canvas.dataset.renderBackendHarness = "v1";
  options.parent?.append(canvas);

  const backend = new ThreeRenderBackend({
    canvas,
    width: 640,
    height: 360,
    pixelRatio: 1,
    antialias: false,
    preserveDrawingBuffer: true,
    backgroundColor: options.backgroundColor ?? 0x101820,
    lightingMode: "None",
    rendererFactory: (rendererCanvas, parameters) => {
      const renderer = new THREE.WebGLRenderer({ ...parameters, canvas: rendererCanvas });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.shadowMap.enabled = false;
      return renderer;
    }
  });
  const initialized = backend.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) });
  if (initialized.status !== "Accepted") {
    canvas.remove();
    throw new Error(`Deterministic render backend initialization failed: ${initialized.reasonCode ?? initialized.status}`);
  }
  let disposed = false;
  return Object.freeze({
    canvas,
    backend,
    dispatch: (command: RenderCommand): RenderCommandResult => backend.dispatch(command),
    render: (): RenderCommandResult => backend.renderFrame(),
    dispose: (): RenderCommandResult => {
      if (disposed) return renderCommandResult("AlreadyApplied");
      disposed = true;
      const revision = backend.readDiagnostics().backendRevision;
      const result = backend.dispatch({ kind: "DisposeBackend", backendRevision: revision });
      canvas.remove();
      return result;
    }
  });
};
