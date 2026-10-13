import {defineConfig,mergeConfig} from "vitest/config";
import base from "./vite.config";
export default mergeConfig(base,defineConfig({test:{include:["tests/fixture-binding.test.ts","producer/tests/candidate-profile.test.ts",
  "producer/snapshot/c/tests/unit/structuralPgTragwerkF7.test.ts"]}}));
