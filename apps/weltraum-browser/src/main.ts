import "./style.css";
import { DebugScene } from "./render/three/debugScene";
import { createBrowserRuntime, createRuntimeShipForFlightCase } from "./runtime/browserRuntime";
import { createProvingGroundLowPolyRenderBatch } from "./world/provingGroundWorld";

const canvas = document.querySelector<HTMLCanvasElement>("#debug-scene");
if (!canvas) {
  throw new Error("Missing #debug-scene canvas");
}

const searchParams = new URLSearchParams(window.location.search);
const uiScenario = searchParams.get("uiScenario");
if (uiScenario) {
  document.body.dataset.uiScenario = uiScenario;
}

const runtime = createBrowserRuntime({ initialShip: createRuntimeShipForFlightCase(searchParams.get("flightCase")) });
const lowPolyInstanceBatch = createProvingGroundLowPolyRenderBatch();

const scene = new DebugScene(canvas, runtime.controller, { lowPolyInstanceBatch });

if (searchParams.get("testBridge") === "1") {
  void import("./test-harness/browserBridge").then(({ installTestBridge }) => installTestBridge(runtime.controller, () => scene.getRenderSnapshot()));
}

scene.start();
