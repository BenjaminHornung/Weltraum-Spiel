import "./style.css";
import { DebugScene } from "./render/three/debugScene";
import { createBrowserRuntime, createRuntimeShipForFlightCase } from "./runtime/browserRuntime";

const canvas = document.querySelector<HTMLCanvasElement>("#debug-scene");
if (!canvas) {
  throw new Error("Missing #debug-scene canvas");
}

const searchParams = new URLSearchParams(window.location.search);
const runtime = createBrowserRuntime({ initialShip: createRuntimeShipForFlightCase(searchParams.get("flightCase")) });

if (searchParams.get("testBridge") === "1") {
  void import("./test-harness/browserBridge").then(({ installTestBridge }) => installTestBridge(runtime.controller));
}

const scene = new DebugScene(canvas, runtime.controller);
scene.start();
