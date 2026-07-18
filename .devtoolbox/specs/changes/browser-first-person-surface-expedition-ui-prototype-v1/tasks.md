# Tasks: Browser First-Person Surface Expedition UI Prototype v1

DevToolbox MCP/CLI is unavailable. Direct-file fallback tracking applies. Every checkbox remains open until fresh evidence and equivalent completion preflight exist. This exact four-file contract-correction fallback is assigned to `small-worker-sol-low` because the first `worker` lane exhausted its bounded step budget without edits; the implementer must not create a duplicate execution record.

## 1. Implement the isolated deterministic prototype

- [x] **Objective:** Build the direct route, deterministic fixture/reducer, exact six primary states, separate detail toggle, exact HUD zones, and keyboard/button parity without runtime authority.
  - **Exact files/search targets:** Search only for an existing convention that fits, then create/edit only `apps/weltraum-browser/prototypes/first-person-surface-expedition-v1/**`.
  - **Acceptance criteria:** `/prototypes/first-person-surface-expedition-v1/`; persistent `Prototype Fixture`; six states; Q Scanner, E Interaction/Hold, I Inventory Detail, Tab Detail Panels, 1–5 Toolbelt, H Minimal HUD, R repeatable Hazard Scenario, Escape overlay close; all visible-button equivalents; exact HUD fields; deterministic reload; no external/runtime/TestBridge dependency.
  - **Guidance:** Use immutable fixture constants and one local reducer. Keep Tab separate from primary state. Use deterministic decorative CSS/canvas only.
  - **Verification:** Run existing browser app on port 5202; exercise every key and visible button; reload twice and compare fixture/state/world output.
  - **Stopping rule:** Stop before any need to edit forbidden scope or make an architecture/cross-layer decision.

## 2. Implement restrained visuals, accessibility, and reflow

- [x] **Objective:** Deliver center-clear, readable hard-sci-fi rails and accessible behavior across all states.
  - **Exact files/search targets:** Only the prototype folder and this behavioral spec.
  - **Acceptance criteria:** Structural center safe zone; dark translucent rails; no dashboard/glass-card/MMO clutter; visible focus; non-color redundancy; semantic DOM/ARIA; logical focus order; reduced motion; 200% zoom reflow; 1280×720 no horizontal overflow; persistent Prototype Fixture honesty.
  - **Required skills/MCPs:** `uncodixfy`, `devtoolbox-specs-execution`; no Unity MCP/editor.
  - **Verification:** Keyboard-only pass, accessible-name/state inspection, reduced-motion emulation, 200% zoom, and `scrollWidth <= clientWidth` at 1280×720.
  - **Stopping rule:** Stop if a dependency, config, app-route, source-layer, or reusable product-component change appears necessary.

## 3. Add the exact focused E2E and six screenshots

- [x] **Objective:** Verify the contract on port 5202 and capture exactly the approved evidence.
  - **Exact files/search targets:** Search existing E2E conventions, then add exactly `apps/weltraum-browser/tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts`; write only the six approved `first-person-surface-expedition-ui-prototype-v1-*.png` files under `apps/weltraum-browser/evidence/`.
  - **Acceptance criteria:** E2E verifies route isolation, all six states, separate Tab detail toggle, every key/button pair, ARIA/focus order, reduced motion, 200% zoom, 1280×720 no horizontal overflow, exact screenshot sizes, absent `window.TestBridge`, visible Prototype Fixture, and zero console/page/request/HTTP errors.
  - **Required PNGs:** exploration, scanner, interaction-hold, hazard-warning at 1920×1080; responsive at 1280×720; keyboard-focus at 1920×1080, using the exact filenames in `spec.md`. InventoryDetail, MinimalHud, reduced-motion, and 200% zoom are behavior-only checks.
  - **Verification:** Run `npx playwright test tests/e2e/first-person-surface-expedition-ui-prototype.spec.ts --config=playwright.config.ts --workers=1` from `apps/weltraum-browser` against existing port 5202 setup; verify PNG dimensions; run scoped `git diff --check`.
  - **Stopping rule:** Do not edit Playwright/Vite/package/lock config, routes, TestBridge, normal app code, unrelated tests, or unrelated evidence.

## 4. Add the design audit and complete focused reviews

- [x] **Objective:** Record and review presentation, authority, accessibility, regression, scope, and maintainability.
  - **Exact files/search targets:** `docs/design-audits/first-person-surface-expedition-ui-prototype-v1.md`, the change folder, prototype folder, focused E2E file, and six approved evidence PNGs.
  - **Acceptance criteria:** Focused UI review and independent reviewer confirm center-clear hierarchy, restrained visual language, non-color redundancy, six-state differentiation, accessibility/reflow, fixture honesty, test completeness, and scope compliance with no blocking finding.
  - **Required skills/MCPs:** `uncodixfy`, `requesting-code-review`, `devtoolbox-review`, `maintainability-decay-review`; no Unity MCP/editor.
  - **Verification:** Inspect all six PNGs at exact dimensions, compare findings with `spec.md`, rerun focused E2E and `git diff --check` after any bounded fix.
  - **Stopping rule:** Return architecture, cross-layer, disputed-authority, config, or out-of-scope findings to the orchestrator.

## 5. Human visual review and completion preflight

- [x] **Objective:** Obtain explicit human visual acceptance and confirm readiness while leaving all task checkboxes open for orchestrator-owned completion.
  - **Exact files/search targets:** Present the six required screenshots, focused E2E result, design audit/reviewer findings, and scoped diff.
  - **Acceptance criteria:** Human accepts or rejects hierarchy, Hestia atmosphere, center-safe composition, six-state differentiation, warning/safe/info redundancy, Prototype Fixture honesty, 1280×720 response, keyboard focus, and 200% zoom behavior. Direct-file fallback preflight confirms fresh evidence and resolved blockers.
  - **Verification:** Fresh focused E2E; exact PNG inventory/dimensions; `git diff --check`; focused UI review; independent reviewer; human visual decision.
  - **Stopping rule:** Do not close tasks, archive, commit, push, open a PR, or merge during review/preflight.

## 6. Commit and non-force push after explicit release authorization

- [ ] **Objective:** Publish only the accepted bounded prototype when explicitly authorized.
  - **Allowed final scope:** This change folder; `apps/weltraum-browser/prototypes/first-person-surface-expedition-v1/**`; the focused E2E file; approved evidence prefix under `apps/weltraum-browser/evidence/`; and `docs/design-audits/first-person-surface-expedition-ui-prototype-v1.md`.
  - **Forbidden:** `src/**`, package/lock/Vite/Playwright config, routes, Hestia/Voxel/Worker code, existing UI/concepts, Unity files, unrelated evidence, and unrelated Git changes.
  - **Acceptance criteria:** Fresh focused E2E and `git diff --check` pass; UI, reviewer, and human visual reviews are accepted; scoped staging is clean; exact commit message is `#WELTRAUM-000 Add first-person surface expedition UI prototype`; push is normal and non-force.
  - **Verification:** Inspect status/diff/log before staging; stage exact paths; verify before commit; inspect commit/status after commit; use plain `git push` only to the authorized remote/branch.
  - **Stopping rule:** Stop if authorization, ownership, evidence freshness, preflight, review, or scoped staging is missing. Never force-push, open a PR, merge, or archive.
