# Tasks

## Phase 1 – Domain core and focused units

- [x] 1. Implement validated shapes, anchors, frames, transforms, state projection/reanchor, canonical serialization/signatures, and focused unit tests.
  - **Objective:** Deliver the complete pure deterministic API from the capability spec.
  - **Files/search targets:** `apps/weltraum-browser/src/surface-frame/**`; `apps/weltraum-browser/tests/unit/surfaceLocalFrame*.test.ts`; consult read-only `src/core/vector.ts`, `src/core/hash.ts`, `src/world/frames.ts`, and `src/world/floatingOrigin.ts` for conventions only.
  - **Acceptance:** All named public functions exist; X-East/Y-Up/Z-South basis is right-handed; sphere/ellipsoid, pole, antimeridian, heights, round trips, velocity, reanchor, signature, frozen/input-safe, invalid/fail-closed, dependency-ban, and precision scenarios pass.
  - **Implementation guidance:** Keep module standalone and explicit; bounded deterministic inverse; clone/freeze outputs; dedicated canonical encoding; no edits outside listed scope.
  - **Required skills/MCPs:** `subagent-driven-development`; repository AGENTS; no Unity MCP/editor.
  - **Verification:** Node 22; focused Vitest files serially with one worker. Do not run full suite in this slice.
  - **Report back:** changed files, public API summary, focused tests/command/result, blockers, numerical tolerances, risks/unverified items.
  - **Stopping rule:** Stop on authority ambiguity, inability to meet proper handedness, convergence failure that requires fallback, or any needed out-of-scope dependency/config edit.

## Phase 2 – Browser proof, docs, and evidence

- [x] 2. Add normal-route dynamic-import browser proof plus deterministic evidence and public V1 documentation.
  - **Objective:** Prove browser portability and reanchor invariants without runtime integration or UI.
  - **Files/search targets:** `apps/weltraum-browser/tests/e2e/surface-local-frame-core.spec.ts`; the two allowed evidence files; `docs/browser-mainline/surface-local-frame-core-v1.md`; import only `/src/surface-frame/index.ts`.
  - **Acceptance:** Hestia-like shape, two distant anchors, Player/Ship/Drone absolute states, projection/reanchor/restore invariance, changed locals, TestBridge absent, no screenshots/UI, deterministic JSON/Markdown.
  - **Implementation guidance:** Generate stable evidence with no timestamps/randomness; avoid application source/runtime imports beyond the one dynamic module import; preserve semantic identities.
  - **Required skills/MCPs:** `playwright`; repository AGENTS; no Unity MCP/editor.
  - **Verification:** Focused Playwright spec with one worker; repeat twice and compare SHA-256 of both evidence files.
  - **Report back:** changed files, scenario details, E2E command/result, evidence hashes for both runs, blockers, risks/unverified items.
  - **Stopping rule:** Stop if proof requires TestBridge, UI, screenshots, runtime wiring, config edits, or out-of-scope evidence.

## Phase 3 – Review and verification

- [x] 3. Complete independent review, fresh verification, scope audit, and verification assessment.
  - **Objective:** Establish spec compliance, numerical correctness, regression safety, deterministic evidence, and readiness for commit.
  - **Files/search targets:** complete branch diff and all artifacts in this change; no mutations except bounded reviewer-found fixes delegated to the appropriate implementation lane.
  - **Acceptance:** Reviewer and independent GLM findings resolved; Node 22 confirmed; focused units serial pass; full units pass with at most four workers; build passes; focused E2E passes; evidence is byte-identical across two runs; final diff is entirely in scope; verification reviewer accepts evidence.
  - **Implementation guidance:** Findings first with file references; no opportunistic refactor; rerun focused checks after fixes; update evidence only via approved E2E.
  - **Required skills/MCPs:** `devtoolbox-review`, `verification-before-completion`; no Unity MCP/editor.
  - **Verification:** `npx vitest run "tests/unit/surfaceLocalFrame*.test.ts" --maxWorkers=1 --minWorkers=1` or installed equivalent; `npx vitest run --maxWorkers=4`; `npm run build`; `npx playwright test tests/e2e/surface-local-frame-core.spec.ts --workers=1`; SHA-256 comparison; final Git scope audit.
  - **Report back:** review findings/disposition, exact fresh commands/results, evidence hashes, scope audit, blockers, remaining risks/unverified items.
  - **Stopping rule:** Do not complete on failed checks, unresolved findings, nondeterministic evidence, out-of-scope diff, or unaccepted verification gap.

## Phase 4 – Commit and push

- [x] 4. Commit and non-force push the verified branch.
  - **Objective:** Publish the completed branch without integration actions.
  - **Files/search targets:** only verified in-scope diff.
  - **Acceptance:** exact commit subject `#WELTRAUM-000 Add SurfaceLocalFrame core`; branch `feature/browser-surface-local-frame-core-v1` pushed normally to origin; no PR/merge/archive.
  - **Implementation guidance:** inspect status/diff/log first; stage only approved files; never force push.
  - **Required skills/MCPs:** `commit-message`, `finishing-a-development-branch` as applicable.
  - **Verification:** verify clean status, commit subject/SHA, and upstream branch after push.
  - **Report back:** commit SHA, push result, untouched original checkout, no PR/merge/archive confirmation.
  - **Stopping rule:** Stop before commit/push if verification is incomplete, staging contains out-of-scope files, hooks fail, or push would require force.