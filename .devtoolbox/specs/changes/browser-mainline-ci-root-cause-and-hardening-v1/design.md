# Design

## Change

`browser-mainline-ci-root-cause-and-hardening-v1`

## Proven root cause

Runs 29118782519, 28750818330, 28746666576, and 28740264459 all fail at the same assertion with `count: 6` expected and `count: 14` received. The last green run is 28654066622.

The first red mainline introduced eight `playableLargeFieldVisualLandmarks` and appended them to the existing six-item `provingGroundAsteroidField`. `createProvingGroundLowPolyRenderBatch()` projects that complete registry. The failing E2E file remained unchanged, so its literal six became stale.

## Decisions

### Rendering-contract fix

Compare the rendered batch count with the exported `provingGroundAsteroidField.length` instead of another duplicated literal. This still detects dropped or extra rendered instances while keeping the source registry authoritative. No production file changes.

### CI grouping

Add explicit Playwright scripts for:

1. Core/autopilot: lifecycle smoothing, proving ground, terminal capture, debug vertical slice, multi-obstacle planning, and 2500m execution.
2. Live runtime/objectives: playable proving ground, live flight, navigation objective, and objective-chain live.
3. UI/layout: flight UI foundation and UI concept parity.

The workflow calls every group as a required named step. The existing aggregate `npm run test:e2e` remains available and is run locally as the full-suite gate.

### Artifact isolation

A CI-provided artifact group selects unique `evidence/playwright-output/<group>` and `evidence/playwright-report/<group>` folders. This prevents later Playwright invocations from replacing earlier group diagnostics.

### Diagnostics

- Print Node, npm, and Playwright versions.
- Print Demo Scout GLB file type and byte size after mandatory magic validation.
- Validate every top-level browser evidence JSON file in a named step.
- Upload automatic Playwright output/report and browser evidence with `if: always()`.
- Apply a finite job timeout.
- Keep CI at one worker explicitly and reject accidental `test.only`.
- Preserve failure trace/screenshot for the long normal-runtime live-flight spec in CI.

## Risks and mitigations

- **Omitted spec during grouping:** scripts enumerate all twelve tracked specs and local aggregate execution verifies discovery parity.
- **Parallel branches add specs after grouping:** a required CI preflight compares `tests/e2e/*.spec.ts` with all group-script entries and fails on missing, duplicate, or stale membership.
- **Artifact replacement:** group-specific folders isolate output.
- **Retry hiding a regression:** no automatic CI retry is added.
- **Parallel-agent conflicts:** no production world/UI files or UI parity spec are edited.
- **Future group classification:** adding a spec still requires choosing the correct group, but the coverage preflight makes an omitted or duplicate classification a hard CI failure instead of a silent coverage gap.
- **Actions Node deprecation warning:** the existing action majors may run on Node 24 automatically; upgrading action majors is separate from the proven test failure and is not bundled without need.

## Rollback / safe stop

Revert the test assertion and workflow/config/script changes together if any required spec is not executed or diagnostics are lost. Stop instead of editing production code if local reproduction differs from the recorded GitHub failure.
