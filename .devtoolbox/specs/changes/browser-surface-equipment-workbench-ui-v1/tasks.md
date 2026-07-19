# Tasks: Surface Equipment Workbench UI Prototype V1

## Phase 1 — Prototype

- [x] **1. Implement the standalone workbench and local mock state engine**
  - **Objective:** Deliver the fixed route, exact six fixtures, local mock catalog, assembly state, derived metrics/readiness/diagnostics, commands, and local history.
  - **Files:** `apps/weltraum-browser/prototypes/surface-equipment-workbench-v1/index.html`, `styles.css`, `app.js` only.
  - **Acceptance:** Authority banner is exact; six fixtures and every required module role are visible; all required scenarios derive deterministically; install/remove/replace/move and branch-clearing undo/redo work; compare presents two builds; no runtime error on initial load.
  - **Guidance:** Keep mock catalog/state/derive/command/render responsibilities distinct inside `app.js`; all mutations use commands; invalid commands do not mutate history; preserve the documented future snapshot/view-model plus command adapter seam without inventing core contracts.
  - **Skills/MCPs:** `uncodixfy`; repository `AGENTS.md`; no Unity MCP/editor; no DevToolbox writes by the subagent.
  - **Verification:** focused static inspection plus manual smoke at `http://127.0.0.1:5224/prototypes/surface-equipment-workbench-v1/` when the implementation slice is complete.
  - **Report back:** changed files, implemented scenarios/commands, checks run, blockers, remaining risks, unverified items.
  - **Stop:** stop before touching `src/**`, package/config/CI, tests, evidence, audit, or any out-of-scope file; escalate any route/port blocker.

- [x] **2. Complete industrial presentation, responsive panes, keyboard, focus, and drag/drop**
  - **Objective:** Make the same standalone route visually usable, accessible, responsive, and pointer/keyboard interactive.
  - **Files:** the same three prototype files only; do not touch the E2E, audit, or evidence in this slice.
  - **Acceptance:** desktop three-column workbench; mobile Library/Assembly/Inspection panes with Assembly primary; schematic slot treatment; drag and click install; visible focus; keyboard shortcuts and text-input suppression; status not color-only; no prohibited generic AI/fantasy/toy styling.
  - **Guidance:** reuse the existing browser’s industrial visual language as reference only; use native controls/ARIA/live regions and deterministic `data-testid` hooks needed by the approved spec.
  - **Skills/MCPs:** `uncodixfy`; repository `AGENTS.md`; no Unity MCP/editor.
  - **Verification:** manual keyboard/focus and responsive smoke at port 5224; report viewport(s) checked.
  - **Report back:** changed files, interaction/accessibility coverage, checks run, blockers, remaining risks, unverified items.
  - **Stop:** no visual changes outside the prototype directory and no asset/config additions.

## Phase 2 — Automated acceptance and evidence

- [x] **3. Add targeted Playwright acceptance coverage and produce evidence**
  - **Objective:** Prove the required behavior against port 5224 and generate deterministic evidence.
  - **Files:** `apps/weltraum-browser/tests/e2e/surface-equipment-workbench-ui.spec.ts` and `apps/weltraum-browser/evidence/surface-equipment-workbench-ui-v1-*` only.
  - **Acceptance:** assertions cover six fixtures, install/remove/replace/move, diagnostics and suggested fixes, undo/redo, compare, keyboard/focus, responsive panes, and health 0/0/0/0; screenshots exist for Scanner, Cutter, blocked Sidearm, ready Sidearm, and responsive state.
  - **Guidance:** own/start a 5224 Vite process within the allowed spec or use an already started 5224 process without config edits; test the absolute prototype URL; clean up only owned process state; write concise machine-readable health evidence if useful.
  - **Skills/MCPs:** `playwright`; repository `AGENTS.md`; no Unity MCP/editor; use installed dependencies only and do not install packages.
  - **Verification:** run the targeted Playwright spec and inspect screenshot dimensions/names plus health counters.
  - **Report back:** changed/evidence files, exact command, test counts, health counters, screenshot list, blockers, risks/unverified.
  - **Stop:** stop before editing Playwright/package/Vite config, package/lock files, `src/**`, or unrelated tests/evidence.

- [x] **4. Document the design audit and future adapter point**
  - **Objective:** Persist the prototype’s UX decisions, evidence, authority boundary, and later Equipment Core integration seam.
  - **Files:** `docs/design-audits/surface-equipment-workbench-ui-v1.md` only.
  - **Acceptance:** audit maps requirements to implementation/evidence; documents responsive and keyboard/focus behavior, health definition/results, screenshot matrix, local-only history, and snapshot/view-model plus command adapter seam without proposing unpublished domain APIs.
  - **Guidance:** state mock limitations and any unverified risk plainly; link only repository-relative evidence paths.
  - **Skills/MCPs:** repository `AGENTS.md`; no Unity MCP/editor.
  - **Verification:** cross-check audit statements against current files and fresh evidence.
  - **Report back:** changed file, mapped evidence, blockers, remaining risks/unverified.
  - **Stop:** do not expand into domain design or modify other docs.

## Phase 3 — Review and verification

- [x] **5. Review, fix concrete findings, and complete fresh verification**
  - **Objective:** Establish spec compliance, UI quality, scoped diff integrity, and sufficient fresh evidence.
  - **Files/search targets:** all files in this change’s explicit write scope; `git diff afa1fa4a`.
  - **Acceptance:** UI review and correctness review have no unresolved material findings; focused fixes are re-reviewed; targeted E2E passes at port 5224; health is 0/0/0/0; five screenshots exist; browser app build passes if dependencies are already present; diff contains no forbidden paths.
  - **Guidance:** use `ui-designer` and `reviewer` findings-first; dispatch fixes only to the owning implementation lane; use `test-runner` for fresh commands and `verification-reviewer` for evidence sufficiency; do not hide build/test commands in Context Mode.
  - **Skills/MCPs:** `devtoolbox-review`, `verification-before-completion`, `playwright`; no Unity MCP/editor.
  - **Verification:** `git diff --name-only afa1fa4a`; targeted Playwright spec; browser-health report; screenshot inventory; `npm run build` only if no install is needed.
  - **Report back:** findings and resolutions, exact verification commands/results, changed files, blockers, remaining risks/unverified.
  - **Stop:** do not commit or push. Await explicit user confirmation after final report.