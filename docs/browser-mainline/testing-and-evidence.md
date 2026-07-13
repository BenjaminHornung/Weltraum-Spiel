# Browser Mainline Testing And Evidence

Stand: 2026-07-13

## Principle

Browser-mainline work is complete only when the relevant domain rule, runtime behavior and player-visible claim are covered by inspectable verification. Visual plausibility alone is not evidence.

The active branch has no Unity project. Historical comparison sources are read through `unity-legacy-final-2026-07:<path>` or curated records under `docs/legacy-unity`; current reusable art lives under `art/`.

The browser test stack under `apps/weltraum-browser` uses:

- Vitest for deterministic unit and integration coverage;
- Playwright for normal-runtime player flows, UI/layout and browser domain smokes;
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

### `test:e2e:core`

Covers deterministic browser integration including autopilot/executor lifecycle, terminal capture, proving-ground and obstacle scenarios, negative fuel/authority/divergence contracts, resource/cargo, Ship Builder stats/readiness, Combat, Persistence and celestial/gravity domain smokes, plus Demo Scout nozzle-VFX binding.

### `test:e2e:live`

Covers normal player runtime and world presentation including visible planner interactions, live large-field flight, Range 500 m and Range 1000 m completion, admitted Range 2500 m preview, runtime-owned target/route/world presentation and world-streaming flows.

### `test:e2e:ui`

Covers player-facing HUD, planner and visual parity/layout checks.

CI validates that every `tests/e2e/**/*.spec.ts` is assigned to exactly one required group and rejects stale, duplicate or malformed script membership.

## Normal Runtime Versus TestBridge

### Normal player acceptance

Use `/` and visible interactions whenever the claim concerns gameplay or UI:

- select targets through visible controls;
- preview and engage the visible exact route hash;
- wait on runtime/player-facing conditions rather than synthetic skips;
- prove Arrival/Holding from executor/runtime truth;
- confirm `window.TestBridge` is absent;
- capture screenshots only after UI transitions are stable.

### Pure-domain browser smokes

A non-visible domain feature may open `/`, prove TestBridge is absent, dynamically import the public browser module and run deterministic probes. This is appropriate for foundations such as Celestial/Gravity, Combat, Persistence and Ship Builder analysis that intentionally have no runtime UI or renderer integration.

Such tests must use explicit inputs, repeat probes for deterministic equality, reject console/page/request failures attributable to the feature, and record JSON/Markdown evidence. They must not imply that a pure core is already integrated gameplay.

### Query-gated harness scenarios

Use `/?testBridge=1` only for explicitly synthetic deterministic scenarios that need direct harness orchestration, such as controlled streaming snapshots or fault injection.

TestBridge must never exist on `/`, become player UI, own product rules, snap position, zero velocity, replace a locked plan, or bypass admission and stable-hash checks.

## Evidence Levels

```text
Unit tests
  Domain rules, math, hashing, validation, planner/executor contracts,
  celestial propagation/gravity, resources and ship-builder calculations.

Integration/scenario tests
  Fixed-step runtime behavior and deterministic fixtures.

Normal-runtime browser E2E
  Visible player controls, physical execution and screenshot evidence on `/`.

Pure-domain browser smoke
  Deterministic module import/probe on `/`, usually JSON/Markdown evidence.

Query-gated harness E2E
  Explicit synthetic scenarios on `/?testBridge=1`.

Build and CI checks
  TypeScript compile, Vite build, grouped-suite inventory,
  required LFS validation and evidence parsing.
```

## Navigation And Flight Acceptance

A positive navigation/autopilot claim should prove the intended stable target, Ready/non-stale preview, exact-hash admission, exact Engage dispatch, immutable locked hash, no silent replan, no snap/velocity shortcut, truthful fuel/braking/authority, FlightController-owned terminal capture and valid Arrival/Holding envelopes.

A negative scenario must fail closed with a typed deterministic reason and must not expose false Ready, Engage or completion state.

Current live objective evidence proves Range 500 m Ready -> Enroute -> Complete, Range 1000 m Ready -> Complete and a new admitted Range 2500 m preview, all through visible planner controls on `/` with TestBridge absent. Range 2500 m is a preview proof, not a completed-arrival proof.

Primary files:

- `apps/weltraum-browser/evidence/browser-objective-chain-1000m-completion-v2.md`
- `apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts`
- `.devtoolbox/specs/changes/archive/2026-07-13-browser-objective-chain-1000m-completion-v2/tests/test-protocol.md`

## Celestial Core Acceptance

The celestial/gravity foundation must prove:

- schema and stable-ID validation fail closed;
- canonical serialization and signatures are deterministic;
- catalog/index ordering is stable;
- propagation uses explicit epoch/requested time and bound elliptic inputs only;
- repeated ephemeris and gravity probes are byte/signature stable;
- floating-origin or renderer state cannot alter orbital truth;
- minimum-radius gravity errors do not clamp to fake finite values;
- dominant-source ties resolve deterministically;
- no claim of flight, navigation, SOI, patched-conics or UI integration is made.

Evidence:

- `docs/browser-mainline/celestial-gravity-core-v1.md`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1-summary.json`
- `.devtoolbox/specs/changes/archive/2026-07-13-browser-celestial-gravity-core-v1/tests/test-protocol.md`

No screenshot is required for this feature because it deliberately has no visible UI or render change.

## Combat, Persistence And Ship Builder Core Acceptance

The standalone Combat, Persistence/Universe-Time/Event and Ship Builder
analysis cores use focused unit suites plus normal-route Browser E2E scenarios:

- `apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts`
- `apps/weltraum-browser/tests/e2e/persistence-universe-time-event-core.spec.ts`
- `apps/weltraum-browser/tests/e2e/ship-builder-full-stats-flight-readiness.spec.ts`
- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1.md`
- `apps/weltraum-browser/evidence/browser-persistence-universe-time-event-core-v1.md`
- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1.md`
- `docs/browser-mainline/combat-weapon-damage-core-v1.md`
- `docs/browser-mainline/persistence-universe-time-event-core-v1.md`
- `docs/browser-mainline/ship-builder-full-stats-flight-readiness-v1.md`

These scenarios prove that normal `/` remains healthy and does not expose
`TestBridge` before importing the bounded domain module. They are not evidence
of playable Combat, Browser storage, save/load UI, offline progression or
runtime persistence integration. Ship Builder analysis is likewise not
evidence of placement UI, completed test flight or active-ship handoff.

## Visual And Nozzle-VFX Evidence

Visible ship/VFX changes should prove that:

- Demo Scout and procedural fallback still load correctly;
- resolved GLB/manifest bindings match the visible effect locations;
- main and RCS effects derive from actuator telemetry, not raw input;
- inactive nozzles do not emit effects;
- renderer state does not create physical authority;
- screenshots correspond to matching telemetry/binding snapshots.

Current artifacts include `apps/weltraum-browser/evidence/demo-scout-nozzle-vfx-snapshot.json` and the main/translation/rotation screenshots in the same folder.

## Evidence Artifact Rules

Each durable artifact should identify feature/scenario ID, date, branch/commit where available, exact command, runtime route, relevant identities/hashes, final status, important numeric outcomes, artifact paths and known limitations.

Recommended shape:

```text
apps/weltraum-browser/evidence/
  <feature>.md
  <feature>-summary.json
  <feature>-<state>.png

.devtoolbox/specs/changes/<change>/tests/
  test-protocol.md
```

A screenshot is required for player-visible UI/render claims. A pure-data/math feature may omit screenshots when its protocol explicitly states that no visual behavior changed. Concept art, stale generated output or a screenshot without matching runtime state is not implementation evidence.

## Windows Playwright Caveat

If the downloaded Playwright browser cannot start on Windows, use:

```powershell
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Record the override in the test protocol. Do not change product behavior or assertions for a host-policy issue.

## Completion Gate

A browser feature is ready only when:

1. intent, scope and non-goals are explicit;
2. owner/domain rules have focused tests;
3. relevant required groups pass;
4. production build passes;
5. visible claims have fresh browser evidence;
6. TestBridge and runtime routes obey their boundary;
7. package/lockfile and active-tree Unity guardrails remain clean unless explicitly in scope;
8. docs describe the implementation honestly as complete, foundation, integrated, deferred or unsupported.
