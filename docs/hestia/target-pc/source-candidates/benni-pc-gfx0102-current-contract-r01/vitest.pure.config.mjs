export default {
  root: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-gfx0102-current-contract-r01',
  envDir: false,
  cacheDir: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-gfx0102-current-contract-r01/cache',
  resolve: { alias: { vitest: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-target-pc-2026-10-13/m5-toolchain/node_modules/vitest/dist/index.js' } },
  test: {
    include: ['tests/*.test.ts', 'control/tests/unit/graphicsSettings*.test.ts'],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false,
    watch: false, setupFiles: [], globalSetup: [], reporters: ['json'],
    outputFile: 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-gfx0102-current-contract-r01/evidence/RESULTS.json'
  }
};
