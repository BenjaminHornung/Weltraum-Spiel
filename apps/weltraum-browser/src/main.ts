import "./style.css";
import { DebugScene } from "./render/three/debugScene";
import { createBrowserRuntime } from "./runtime/browserRuntime";

const canvas = document.querySelector<HTMLCanvasElement>("#debug-scene");
if (!canvas) {
  throw new Error("Missing #debug-scene canvas");
}

const runtime = createBrowserRuntime();

if (new URLSearchParams(window.location.search).get("testBridge") === "1") {
  void import("./test-harness/browserBridge").then(({ installTestBridge }) => installTestBridge(runtime.controller));
}

const scene = new DebugScene(canvas, runtime.controller);
scene.start();
