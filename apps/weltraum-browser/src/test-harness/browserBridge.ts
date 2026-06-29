import { createBrowserRuntime } from "../runtime/browserRuntime";
import type { BrowserRuntimeController } from "../runtime/browserRuntime";
import type { RenderDebugSnapshot } from "../render/three/debugScene";
import { runScenario, scenarioCatalog } from "./scenarioRunner";
import type { ScenarioId, ScenarioResult } from "./scenarios";

export interface TestBridge extends BrowserRuntimeController {
  listScenarios(): readonly ScenarioId[];
  runScenario(id: ScenarioId): ScenarioResult;
  getRenderSnapshot?: () => RenderDebugSnapshot;
}

declare global {
  interface Window {
    TestBridge?: TestBridge;
  }
}

export const createTestBridge = (
  controller: BrowserRuntimeController = createBrowserRuntime().controller,
  getRenderSnapshot?: () => RenderDebugSnapshot
): TestBridge => {
  const bridge: TestBridge = {
    ...controller,
    listScenarios() {
      return scenarioCatalog.map((scenario) => scenario.id);
    },
    runScenario(id: ScenarioId) {
      return runScenario(id);
    }
  };

  if (getRenderSnapshot) {
    bridge.getRenderSnapshot = getRenderSnapshot;
  }

  return bridge;
};

export const installTestBridge = (controller?: BrowserRuntimeController, getRenderSnapshot?: () => RenderDebugSnapshot): TestBridge => {
  const bridge = createTestBridge(controller, getRenderSnapshot);
  window.TestBridge = bridge;
  return bridge;
};
