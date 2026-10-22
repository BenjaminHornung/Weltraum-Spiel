export default {
  "resolve": {
    "alias": {
      "vitest": "C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain/node_modules/vitest/dist/index.js"
    }
  },
  "test": {
    "include": [
      "tests/unit/hvp-negative-frame.test.ts"
    ],
    "environment": "node",
    "maxWorkers": 1,
    "fileParallelism": false
  }
};
