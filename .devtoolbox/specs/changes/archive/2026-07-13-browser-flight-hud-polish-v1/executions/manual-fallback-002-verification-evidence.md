# Manual Execution: Task 3 — HUD tests and browser evidence

Execution ID: `manual-fallback-002-verification-evidence`

Reason for manual record: DevToolbox MCP is unavailable in this pre-restart session; direct `.devtoolbox/specs` fallback was approved by the user.

## Objective

Run fresh verification for the HUD polish and gather/record browser evidence without weakening flight-core, autopilot, lifecycle, planHash, terminal capture, long-range, or TestBridge guardrails.

## Required commands

From `apps/weltraum-browser`:

- `npm ci` if dependencies are missing.
- `npm run test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts`
- `npm run test:e2e`

## Required evidence

- Normal in-flight HUD screenshot.
- Autopilot-active HUD screenshot.
- Arrival/holding HUD screenshot if stable through existing browser/TestBridge flow.
- Optional debug-vs-player separation screenshot if already supported.
- Evidence markdown under `apps/weltraum-browser/evidence/browser-flight-hud-polish-v1.md`.

## Required report-back

- exact commands and results;
- screenshot/evidence paths;
- default TestBridge hidden confirmation;
- whether autopilot/planHash/terminal/lifecycle/TestBridge tests were left intact;
- blockers/unverified items.
