# Browser Vertical Slice v1 Tasks

DevToolbox MCP note: `workspace_discover` is blocked for this repo path with `unauthorized_path`, so this task file is the direct-file fallback execution source of truth.

## Task 1: Runtime target selection and route preview contract

- [x] Objective: Add explicit runtime support for selecting existing proving-ground targets and previewing/engaging the selected route without moving planner logic into UI.
- Files/search targets: `apps/weltraum-browser/src/runtime/commands.ts`, `apps/weltraum-browser/src/runtime/browserRuntime.ts`, `apps/weltraum-browser/src/world/provingGroundWorld.ts`, `apps/weltraum-browser/src/core/types.ts` only if a narrow snapshot type is required, `apps/weltraum-browser/tests/unit/simulation.test.ts`.
- Acceptance criteria: selected target is represented in runtime telemetry/snapshot state; route preview targets the selected descriptor; invalid target IDs or malformed commands fail closed without root/zero/default fallback, canceling a plan, or replacing a locked `planHash`; engage locks the selected plan using existing planner/executor invariants.
- Guidance: keep target catalog and selection in runtime/world data; route preview planning belongs to runtime/core; UI receives snapshot/ViewModel data only.
- Required skills/MCPs: follow project `AGENTS.md`, `subagent-driven-development`, `verification-before-completion`; DevToolbox MCP unavailable due `unauthorized_path`.
- Verification: `npm run test -- tests/unit/simulation.test.ts` plus any new targeted runtime unit tests.
- Report-back: changed files, command contract added, invalid-input behavior, tests run, blockers/risks.
- Stopping rule: stop if target selection requires new gameplay systems, root fallback, or changing executor locked-plan semantics.

## Task 2: Player HUD and compact radar-style status

- [x] Objective: Add player-facing selected-target, route-preview, and compact radar-style status while preserving HUD/debug separation.
- Files/search targets: `apps/weltraum-browser/index.html`, `apps/weltraum-browser/src/ui/statusHud.ts`, `apps/weltraum-browser/src/style.css`, `apps/weltraum-browser/src/render/three/debugScene.ts` only for wiring, `apps/weltraum-browser/tests/unit/statusHud.test.ts`.
- Acceptance criteria: HUD shows selected target and route/preview/autopilot/failure state from snapshots/ViewModels; player labels are translated; no raw TestBridge text, raw JSON telemetry, raw failure codes, planner internals, or route computations appear in the player HUD; layout remains usable in desktop/mobile E2E viewports.
- Guidance: keep one primary action per context where practical; use existing warning-chip translation patterns; compact radar-style means status/readout, not a full map/minimap.
- Required skills/MCPs: `ui-designer` for review later, `verification-before-completion`; DevToolbox MCP unavailable due `unauthorized_path`.
- Verification: `npm run test -- tests/unit/statusHud.test.ts tests/unit/simulation.test.ts`.
- Report-back: changed files, ViewModel fields, UI actions, accessibility/mobile notes, tests run, blockers/risks.
- Stopping rule: stop if implementation starts requiring a full radar/minimap/map redesign or debug/player UI leakage.

## Task 3: Browser scene, TestBridge evidence, and E2E vertical slice

- [x] Objective: Extend browser scene and gated test evidence so Playwright proves selected target, route preview, autopilot outcome, and player-facing explanation.
- Files/search targets: `apps/weltraum-browser/src/render/three/debugScene.ts`, `apps/weltraum-browser/src/test-harness/browserBridge.ts`, `apps/weltraum-browser/tests/e2e/debug-scene.spec.ts`, `apps/weltraum-browser/evidence/browser-vertical-slice-v1.md`, refreshed `apps/weltraum-browser/evidence/debug-scene.png`, `debug-scene-mobile.png`, `telemetry.json`, `scenario-matrix.json` if generated.
- Acceptance criteria: default page exposes no `window.TestBridge` and no debug-only text; `?testBridge=1` evidence records selected target, route preview/plan hash, autopilot arrival or fail-closed state, and screenshot; rendered target/route align with runtime selected target and locked plan.
- Guidance: extend TestBridge only for evidence; avoid tautological assertions by checking visible render snapshot and runtime telemetry alignment; use existing negative flight cases for failure explanation where possible.
- Required skills/MCPs: `playwright`/browser verification via `test-runner`; DevToolbox MCP unavailable due `unauthorized_path`.
- Verification: `npm run test:e2e`; if known `browserType.launch: spawn UNKNOWN` occurs, rerun with `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"` and document both.
- Report-back: changed files, E2E scenarios, screenshots/evidence refreshed, default vs gated TestBridge behavior, blockers/risks.
- Stopping rule: stop if E2E needs hardcoded local browser paths, ungated debug APIs, or non-browser gameplay systems.

## Task 4: Docs, evidence, review, verification, and merge readiness

- [ ] Objective: Update M7 documentation/evidence, run fresh verification, fix review findings, then prepare commit/merge if gates pass.
- Files/search targets: `.devtoolbox/specs/changes/browser-vertical-slice-v1/**`, `docs/browser-mainline/port-roadmap.md`, `docs/browser-mainline/feature-intent-index.md`, `docs/browser-mainline/known-unity-bug-traps.md` only if a new trap is identified, `apps/weltraum-browser/evidence/browser-vertical-slice-v1.md`.
- Acceptance criteria: docs accurately state implemented/deferred M7 behavior; evidence lists exact commands/results and Playwright fallback if used; dual review plus UI review finds no blockers; no `unity-legacy-final-2026-07:Assets/**` changes; branch is ready for IFI-format commit.
- Guidance: do not overclaim full radar/minimap/open-world gameplay; document DevToolbox MCP `unauthorized_path` fallback; keep residual risks explicit.
- Required skills/MCPs: `requesting-code-review`, `verification-before-completion`, `ifi-commit-message`; DevToolbox MCP unavailable due `unauthorized_path`.
- Verification: `npm ci`, `npm run test -- tests/unit/statusHud.test.ts tests/unit/simulation.test.ts`, `npm run test`, `npm run build`, `npm run test:e2e` and Chrome fallback if needed, `git status --short -- Assets`.
- Report-back: changed files/evidence, verification table, review result, residual risks, skipped checks, commit/merge recommendation.
- Stopping rule: do not commit/merge unless implementation, fresh verification, review, and no-Assets check pass or the user explicitly accepts documented unverified risk.
