import { createBrowserRuntime } from "../runtime/browserRuntime";
import type { BrowserRuntimeController } from "../runtime/browserRuntime";
import type { RenderDebugSnapshot } from "../render/three/debugScene";
import { autopilotProvingGroundCourses, runAutopilotProvingGroundCourse, runAutopilotProvingGroundMatrix, runScenario, scenarioCatalog } from "./scenarioRunner";
import type { AutopilotSpeedProfileId } from "../core";
import type { AutopilotProvingGroundCourseId } from "../world/autopilotProvingGroundCourses";
import type { AutopilotProvingGroundCourseResult } from "./scenarioRunner";
import type { ScenarioId, ScenarioResult } from "./scenarios";

export interface TestBridge extends BrowserRuntimeController {
  listScenarios(): readonly ScenarioId[];
  runScenario(id: ScenarioId): ScenarioResult;
  listAutopilotProvingGroundCourses(): readonly AutopilotProvingGroundCourseId[];
  runAutopilotProvingGroundCourse(id: AutopilotProvingGroundCourseId, profile?: AutopilotSpeedProfileId): AutopilotProvingGroundCourseResult;
  runAutopilotProvingGroundMatrix(profile?: AutopilotSpeedProfileId): readonly AutopilotProvingGroundCourseResult[];
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
    },
    listAutopilotProvingGroundCourses() {
      return autopilotProvingGroundCourses.map((course) => course.id as AutopilotProvingGroundCourseId);
    },
    runAutopilotProvingGroundCourse(id: AutopilotProvingGroundCourseId, profile: AutopilotSpeedProfileId = "Balanced") {
      return runAutopilotProvingGroundCourse(id, profile);
    },
    runAutopilotProvingGroundMatrix(profile: AutopilotSpeedProfileId = "Balanced") {
      return runAutopilotProvingGroundMatrix(profile);
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
