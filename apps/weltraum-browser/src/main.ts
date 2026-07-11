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
const uiSurface = uiScenario === "combat-contact" ? "combat" : "flight";
const debugHudEnabled = searchParams.get("debugHud") === "1";

document.body.dataset.uiSurface = uiSurface;
document.body.dataset.debugHud = String(debugHudEnabled);
if (uiScenario) {
  document.body.dataset.uiScenario = uiScenario;
}

const debugHud = document.querySelector<HTMLElement>("#debug-hud");
if (debugHud) {
  debugHud.hidden = !debugHudEnabled;
}

const runtime = createBrowserRuntime({ initialShip: createRuntimeShipForFlightCase(searchParams.get("flightCase")) });
const lowPolyInstanceBatch = createProvingGroundLowPolyRenderBatch();

const scene = new DebugScene(canvas, runtime.controller, {
  lowPolyInstanceBatch,
  showDebugGrid: searchParams.get("debugGrid") === "1",
  surface: uiSurface,
  showDebugHelpers: debugHudEnabled
});

if (searchParams.get("testBridge") === "1") {
  void import("./test-harness/browserBridge").then(({ installTestBridge }) => installTestBridge(runtime.controller, () => scene.getRenderSnapshot()));
}

scene.start();
