# Test Protocol — Structural Hestia Vegetation V1

Run from `apps/weltraum-browser` unless stated otherwise.

## Dependency audit
Pinned values:
- Structural `67daf4f532873214b506967af46dd90d85b45986`
- Adaptive parent `5fb372bdba677e43e71566121c53efb5e244b93a`
- Hydrology `501c24390b9ea2b8320b55cea56087875f2a63e2`
- Dependency merge `4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae`

Before completion, query the hydrology remote again for stability only; do not consume the moving head. Stop if it differs.

## Install and compile
```powershell
npm ci
npx tsc -p tsconfig.json
```

## Adaptive dependency gate
```powershell
npx vitest run `
  tests/unit/adaptiveMicrovoxelContracts.test.ts `
  tests/unit/adaptiveMicrovoxelMaterialization.test.ts `
  tests/unit/adaptiveMicrovoxelPlanner.test.ts `
  --maxWorkers=1
```

## Structural dependency gate
```powershell
npx vitest run `
  tests/unit/structuralMicrovoxelCommands.test.ts `
  tests/unit/structuralMicrovoxelConnectivity.test.ts `
  tests/unit/structuralMicrovoxelContracts.test.ts `
  tests/unit/structuralMicrovoxelGreedyMesher.test.ts `
  tests/unit/structuralMicrovoxelMassProperties.test.ts `
  tests/unit/structuralMicrovoxelPersistence.test.ts `
  --maxWorkers=1
```

## Hydrology dependency gate
```powershell
npx vitest run tests/unit/hestiaHydrologyGeneratorV2.test.ts --maxWorkers=1
```

## Vegetation and full gates
```powershell
npx vitest run tests/unit/hestiaStructuralVegetation*.test.ts --maxWorkers=1
npm run test -- --maxWorkers=4
npm run build
npm run test:e2e -- tests/e2e/hestia-structural-vegetation.spec.ts --workers=1 --retries=0
```

## Mandatory behavior matrix
Verify and cite tests for: stable registry; ID validation; deterministic population/hashes; input-order invariance; no region duplicates; jitter bound; Ocean/Lake rejection; river/moisture/slope rules; missing terrain rejection; no floating roots; crown spacing; budget rejection; complete/acyclic Umbrella graph; stable segment/node IDs; proxy not one cone/sphere; Level-4 compilation; Adaptive keys; root anchors; intact connectivity; deterministic trunk cut; stable detached component; finite mass/COM/inertia; signed nonzero cross terms; region split; input immutability; frozen results; no Three.js/DOM/Date/Random; browser byte identity; health 0/0/0/0; TestBridge absent.

## Scope and safety
From repository root:
```powershell
git diff --check
git status --short
git diff --name-only 4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae...HEAD
```
Check every changed path against the exact allowlist. Confirm package and lock files are unchanged. Scan vegetation source/tests for forbidden imports/APIs (`three`, DOM globals, `Date`, `Math.random`, internal forbidden authority paths), and scan the complete diff for common secret/token/private-key patterns. Record commands and outcomes.

## Evidence reproducibility
Generate the JSON/Markdown evidence twice from clean deterministic inputs, hash each output after each run, and require byte-identical hashes. Evidence must be timestamp-free and contain no screenshots.

## Reviews and completion
Run reviewer and reviewer-GLM; resolve concrete findings and rerun focused review. Run fresh verification through test-runner, then verification-reviewer. Run DevToolbox validation, verification record, task completion preflight, and task toggles only after evidence passes. Final human review is required before commit/push completion is reported.