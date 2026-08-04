import "./style.css";
import { DebugScene } from "./render/three/debugScene";
import { createBrowserRuntime, createRuntimeShipForFlightCase } from "./runtime/browserRuntime";
import { createGraphicsSettingsController, loadGraphicsSettings } from "./settings";
import { startSurfaceLabRoute } from "./surface-lab/surfaceLabFailurePresenter";
import { isSurfaceLabQuery } from "./surface-lab/surfaceLabQuery";
import { startSurfacePlayRoute } from "./surface-play/surfacePlayFailurePresenter";
import { isSurfacePlayQuery } from "./surface-play/surfacePlayQuery";
import { createGraphicsSettingsPanel } from "./ui/graphicsSettingsPanel";
import { createProvingGroundLowPolyRenderBatch } from "./world/provingGroundWorld";

const searchParams = new URLSearchParams(window.location.search);

const startNormalRuntime = (): void => {
  const canvas = document.querySelector<HTMLCanvasElement>("#debug-scene");
  if (!canvas) {
    throw new Error("Missing #debug-scene canvas");
  }
  const uiScenario = searchParams.get("uiScenario");
  const uiSurface = uiScenario === "combat-contact" ? "combat" : "flight";
  const debugHudEnabled = searchParams.get("debugHud") === "1";
  let graphicsStorage: Storage | null = null;
  try {
    graphicsStorage = window.localStorage;
  } catch {
    // Storage access can be denied by browser policy; the settings domain falls back safely.
  }
  const graphicsSettingsLoad = loadGraphicsSettings(graphicsStorage);

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
    antiAliasing: graphicsSettingsLoad.settings.antiAliasing.enabled,
    showDebugGrid: searchParams.get("debugGrid") === "1",
    surface: uiSurface,
    showDebugHelpers: debugHudEnabled
  });
  const graphicsSettingsController = createGraphicsSettingsController({
    initial: graphicsSettingsLoad,
    storage: graphicsStorage,
    runtime: scene.getGraphicsSettingsPort()
  });
  createGraphicsSettingsPanel(graphicsSettingsController);

  if (searchParams.get("testBridge") === "1") {
    void import("./test-harness/browserBridge").then(({ installTestBridge }) => installTestBridge(runtime.controller, () => scene.getRenderSnapshot()));
  }

  void graphicsSettingsController.initializeRuntime().then((result) => {
    document.body.dataset.graphicsSettingsReady = String(result.ok);
    scene.start();
  });
};

if (isSurfacePlayQuery(searchParams)) {
  void startSurfacePlayRoute(document, () => import("./surface-play"));
} else if (isSurfaceLabQuery(searchParams)) {
  void startSurfaceLabRoute(document, () => import("./surface-lab"));
} else {
  startNormalRuntime();
}
