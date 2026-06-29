import { createBrowserRuntime } from "../runtime/browserRuntime";
import type { BrowserRuntimeController } from "../runtime/browserRuntime";
import { runScenario, scenarioCatalog } from "./scenarioRunner";
import type { ScenarioId, ScenarioResult } from "./scenarios";

export interface TestBridge extends BrowserRuntimeController {
  listScenarios(): readonly ScenarioId[];
  runScenario(id: ScenarioId): ScenarioResult;
}

declare global {
  interface Window {
    TestBridge?: TestBridge;
  }
}

export const createTestBridge = (controller: BrowserRuntimeController = createBrowserRuntime().controller): TestBridge => {
  const bridge: TestBridge = {
    ...controller,
    listScenarios() {
      return scenarioCatalog.map((scenario) => scenario.id);
    },
    runScenario(id: ScenarioId) {
      return runScenario(id);
    }
  };

  return bridge;
};

export const installTestBridge = (controller?: BrowserRuntimeController): TestBridge => {
  const bridge = createTestBridge(controller);
  window.TestBridge = bridge;
  return bridge;
};
