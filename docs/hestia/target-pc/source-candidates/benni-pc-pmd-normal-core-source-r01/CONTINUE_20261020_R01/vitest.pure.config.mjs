// Existing isolated pure Vitest configuration, with explicit original tool resolvers and private outputs.
export default {
  root: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/apps/weltraum-browser',
  envDir: false,
  cacheDir: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-pmd-normal-core-source-r01/CONTINUE_20261020_R01/cache',
  resolve: { alias: [
    { find: /^vitest$/, replacement: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain/node_modules/vitest/dist/index.js' },
    { find: /^typescript\/unstable\/ast$/, replacement: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain/node_modules/typescript/dist/ast/index.js' },
    { find: /^typescript\/unstable\/sync$/, replacement: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain/node_modules/typescript/dist/api/sync/api.js' }
  ] },
  test: {
    include: ['tests/unit/hestiaSeedDeterminism.test.ts', 'tests/unit/hestiaDensityGenerator.test.ts'],
    environment: 'node', pool: 'forks', maxWorkers: 1,
    fileParallelism: false, isolate: true,
    setupFiles: [], globalSetup: [], execArgv: []
  }
};
