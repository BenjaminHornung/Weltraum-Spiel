# Browser Mainline Testing And Evidence

Stand: 2026-07-13

## Principle

Browser-mainline work is complete only when the relevant domain rule, runtime behavior and player-visible claim are covered by inspectable verification. Visual plausibility alone is not evidence.

The browser test stack lives under `apps/weltraum-browser` and uses:

- Vitest for deterministic unit and integration coverage;
- Playwright for normal-runtime player flows, layout and query-gated harness scenarios;
- TypeScript/Vite production builds;
- Markdown, JSON and screenshot evidence under `apps/weltraum-browser/evidence` and change-specific test folders.

## Required Commands

Run from `apps/weltraum-browser`:

```bash
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
```

The aggregate local discovery command remains:

```bash
npm run test:e2e
```

Use focused commands while developing, then run the relevant required groups before completion. Do not weaken assertions, replace physical execution with shortcuts or move a failing test out of a required group to obtain a green result.

## E2E Groups

The package scripts define three required Chromium groups:

### `test:e2e:core`

Covers deterministic browser integration such as:

- bang-bang autopilot behavior;
- executor lifecycle and terminal capture;
- proving-ground and obstacle scenarios;
- negative fuel/authority/divergence contracts;
- resource/cargo core smokes;
- ship-builder domain, compatibility, structure and mass smokes.

### `test:e2e:live`

Covers normal player runtime and world presentation such as:

- visible navigation-planner interactions;
- live large-field flight;
- Range 500 m and Range 1000 m objective completion;
- admitted Range 2500 m preview;
- runtime-owned target/route/world presentation;
- normal-runtime planner safety behavior;
- world chunk/streaming scenarios where appropriate.

### `test:e2e:ui`

Covers player-facing HUD, planner and visual parity/layout checks.

CI validates that every `tests/e2e/**/*.spec.ts` is assigned to exactly one required group and rejects stale, duplicate or malformed script membership.

## Normal Runtime Versus TestBridge

### Normal player acceptance

Use `/` and visible player interactions whenever the claim concerns real gameplay or UI:

- select targets through visible controls;
- preview and engage the visible exact route hash;
- wait on runtime/player-facing conditions rather than synthetic time skips;
- prove Arrival/Holding from executor/runtime truth;
- confirm `window.TestBridge` is absent;
- capture screenshots only after UI transitions are stable.

### Query-gated harness scenarios

Use `/?testBridge=1` only for explicitly synthetic or deterministic scenarios that need direct harness orchestration, for example controlled world-streaming snapshots or fault injection.

TestBridge must never:

- exist on `/`;
- become player UI;
- own product rules;
- snap position or zero velocity to manufacture progress;
- replace a locked plan silently;
- bypass admission or stable-hash checks.

## Evidence Levels

```text
Unit tests
  Domain rules, math, hashing, validation, planner/executor contracts,
  resource/cargo and ship-builder calculations.

Integration/scenario tests
  Fixed-step runtime behavior and deterministic scenario fixtures.

Normal-runtime browser E2E
  Visible player controls, real runtime execution and screenshot evidence on `/`.

Query-gated harness E2E
  Explicit synthetic scenarios on `/?testBridge=1`.

Build and CI checks
  TypeScript compile, Vite production build, grouped suite inventory,
  required LFS binary validation and artifact parsing.
```

## Navigation And Flight Acceptance

A positive navigation/autopilot claim should prove, as applicable:

- the selected target is the intended stable target ID;
- the preview is Ready, non-stale and validated;
- admission authorizes the exact visible preview hash;
- Engage dispatches that exact hash;
- the executor keeps the same locked hash;
- no silent replan occurs;
- no position snap, waypoint snap or velocity-zero shortcut occurs;
- fuel, braking and authority remain truthful;
- terminal capture uses the shared FlightController path;
- Arrival/Holding satisfies runtime distance and motion envelopes;
- completion does not re-expose the completed route as a new admitted preview.

A negative scenario should fail closed with a typed, deterministic reason and must not expose false Ready, Engage or completion state.

## Required Proving-Ground Matrix

| Scenario | Minimum proof |
| --- | --- |
| Direct local arrival | Stable plan hash, physical terminal capture, valid final distance/speed and holding |
| Long-range direct flight | Meaningful acceleration/braking behavior without fake progress |
| Obstacle route | Route clearance and locked execution without executor-side replanning |
| Insufficient fuel | Planning or admission blocked with visible deterministic reason |
| No authority | No false execution/completion |
| Brake reserve insufficient | Engage or execution fails closed |
| Off-route divergence | Locked hash unchanged, explicit invalidation/replan-required state |
| New objective after completion | Completed hash remains history while a genuinely new admitted hash can be selected |
| Blocked display route | Context may remain visible only when typed rules allow it; Engage remains disabled |

## Current Live Objective Evidence

The current normal-runtime chain proves:

- Range 500 m Ready -> Enroute -> Complete;
- Range 1000 m Ready -> Complete;
- Range 2500 m becomes available and exposes a new admitted preview;
- TestBridge remains absent;
- player interactions use visible planner controls;
- completed preview hashes are not incorrectly reused.

Primary files:

- `apps/weltraum-browser/evidence/browser-objective-chain-1000m-completion-v2.md`
- `apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts`
- `.devtoolbox/specs/changes/browser-objective-chain-1000m-completion-v2/tests/test-protocol.md`

The Range 2500 m state is currently a preview proof, not a required 2500 m arrival proof.

## Evidence Artifact Rules

Each durable artifact should identify:

- scenario or feature ID;
- date;
- branch and commit where available;
- exact command;
- normal `/` or query-gated `/?testBridge=1` route;
- relevant target, route and plan hash;
- final status and important numeric outcomes;
- screenshot/JSON/Markdown paths;
- known limitations or environmental caveats.

Recommended shape:

```text
apps/weltraum-browser/evidence/
  <feature>.md
  <feature>-summary.json
  <feature>-<state>.png

.devtoolbox/specs/changes/<change>/tests/
  test-protocol.md
  focused summaries and additional artifacts
```

Do not treat concept art, stale generated output or a screenshot without matching runtime state as implementation evidence.

## UI Evidence

For player-visible changes:

- capture the normal runtime unless the feature is inherently harness-only;
- cover the intended viewport(s);
- verify no overlap, clipping, hidden primary action or debug leakage;
- wait for planner/dialog transitions to finish before capture;
- compare against relevant concept references without claiming pixel identity;
- keep gameplay state and screenshot state synchronized.

Reference images under `docs/UI-Screenshots/` are design inputs. They do not own UI behavior or runtime truth.

## Windows Playwright Caveat

If the downloaded Playwright browser cannot start on Windows, use the repository-supported override:

```powershell
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Record the override in the test protocol. Do not change product behavior or assertions to accommodate a host-policy issue.

## Completion Gate

A browser feature is ready only when:

1. intent, scope and non-goals are explicit;
2. owner/domain rules have focused tests;
3. relevant required groups pass;
4. production build passes;
5. player-visible claims have fresh browser evidence;
6. TestBridge and runtime routes obey their boundary;
7. package/lockfile and `Assets/**` guardrails remain clean unless explicitly in scope;
8. docs describe the implementation honestly as complete, foundation, deferred or unsupported.
