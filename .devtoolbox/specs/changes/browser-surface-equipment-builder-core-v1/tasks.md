# Tasks: Surface Equipment Builder Core V1

- [x] 1. Implement deterministic contracts, catalog, canonicalization, and six fixtures
  - **Objective:** Create the public package foundation and immutable validated catalog/module/slot/blueprint facts, including exactly six `provisional-v0` built-ins.
  - **Files/search targets:** `apps/weltraum-browser/src/surface-equipment/**`; reuse exports from `src/interaction/index.ts`, `src/suit/index.ts`, `src/combat/index.ts`, `src/resources/index.ts`; mirror deterministic patterns in `src/ship-builder/{ids,validation,canonicalJson,catalog,diagnostics,starterCatalog,fixtures,index}.ts`.
  - **Acceptance:** all required identities and closed vocabularies exist; slot/module contracts contain required fields; duplicate/invalid data rejects; inputs/outputs freeze; canonical ordering/signatures are stable; no duplicate authority; exactly six fixtures exist with documented decisions.
  - **Guidance:** keep display metadata out of gameplay signatures; use safe integers/plain JSON; no UI/runtime side effects or dependency edits.
  - **Skills/MCP:** repository AGENTS; `subagent-driven-development`; no Unity MCP/editor.
  - **Verification:** targeted surface-equipment identity/catalog/fixture tests plus `npx tsc -p tsconfig.json`.
  - **Report:** changed files, exports/contracts reused, fixture table, commands/tests, blockers/risks/unverified items.
  - **Stop:** stop on missing public dependency contract, need to edit dependency/package/config paths, or scope collision.

- [x] 2. Implement atomic commands, derived stats, diagnostics, readiness, and projections
  - **Objective:** Add all seven commands with exact CAS/duplicate rejection and pure functions for derived stats, validation, Suit readiness, Interaction projection, and Combat projection.
  - **Files/search targets:** only `apps/weltraum-browser/src/surface-equipment/**`; authority semantics in `src/interaction/**`, `src/suit/**`, `src/combat/**`, `src/resources/**` are read-only.
  - **Acceptance:** rejections do not mutate; Move preserves instance ID; Replace behavior is deterministic; rename leaves gameplay signature unchanged; calibration is discrete; diagnostics have fixed order; required stats/readiness checks exist; projections are frozen adapter inputs with no completion/runtime state/mutation.
  - **Guidance:** separate builder/validator/projections; consume Suit snapshot facts rather than reimplementing bus/energy authority; no arbitrary sliders or render-derived values.
  - **Skills/MCP:** repository AGENTS; `subagent-driven-development`; no Unity MCP/editor.
  - **Verification:** targeted command/stats/readiness/projection tests and `npx tsc -p tsconfig.json`.
  - **Report:** changed files, public APIs, invariant decisions, tests, blockers/risks/unverified items.
  - **Stop:** stop on contract mismatch, write need outside exclusive scope, or any runtime architecture expansion.

- [x] 3. Add comprehensive unit tests for the required V1 matrix
  - **Objective:** Prove all 38 requested identity, determinism, compatibility, budget, command, fixture, projection, and dependency-authority behaviors.
  - **Files/search targets:** `apps/weltraum-browser/tests/unit/surfaceEquipment*.test.ts`; implementation read-only except narrowly fixing test-discovered defects through the owning implementation lane.
  - **Acceptance:** tests cover IDs/duplicates/order/freeze/signatures; slot/role/tag/mass/bulk; Suit power/pulse/thermal/bus/incapacity/interfaces; imported authorities/no duplicates; CAS for every command/atomic rejection/stable IDs/replace/rename/calibration; six valid and broken fixtures; safety/magazine/energy/resource/legal/projection boundaries; no DOM/Three.js/Date/Random.
  - **Guidance:** assert exact ordered diagnostics and canonical bytes; avoid snapshots that hide semantics.
  - **Skills/MCP:** repository AGENTS; `verification-before-completion`; no Unity MCP/editor.
  - **Verification:** `npx vitest run tests/unit/surfaceEquipment*.test.ts --maxWorkers=1` and `npx tsc -p tsconfig.json`.
  - **Report:** test files, test counts, behavioral coverage map, failures/risks/unverified items.
  - **Stop:** stop if useful coverage requires forbidden product/runtime/package changes.

- [x] 4. Add browser proof, timestamp-free evidence, and implementation documentation
  - **Objective:** Prove deterministic public import and required scenario on normal `/` without UI/product integration.
  - **Files/search targets:** `tests/e2e/surface-equipment-builder-core.spec.ts`; `evidence/browser-surface-equipment-builder-core-v1-{summary.json,.md}`; `docs/browser-mainline/surface-equipment-builder-core-v1.md`; change `tests/test-protocol.md`.
  - **Acceptance:** TestBridge absent; dynamic import `/src/surface-equipment/index.ts`; six fixtures; nominal/low-energy cutter; unsafe/fixed sidearm; both projections; two runs byte-identical; evidence timestamp-free; health 0 console/page/network/request failures; no screenshots or CI grouping.
  - **Guidance:** write evidence only in allowed paths and make it deterministic; document V1 boundaries and fixture choices.
  - **Skills/MCP:** repository AGENTS; Playwright through test-runner/browser-debugger only; no Unity MCP/editor.
  - **Verification:** focused E2E `npm run test:e2e -- tests/e2e/surface-equipment-builder-core.spec.ts --workers=1 --retries=0`, then byte/hash comparison.
  - **Report:** changed files, scenario assertions, browser health, evidence hashes, blockers/risks/unverified items.
  - **Stop:** stop if browser proof requires `main.ts`, style, config, package, CI, or live product integration edits.

- [x] 5. Complete scope audit, dual review, full verification, and human-review package
  - **Objective:** Establish release-quality evidence without committing/pushing until explicit user confirmation.
  - **Files/search targets:** exact diff from `ffb858ba661ae2d30f1e8c331ef5e6c163e9cd97`; allowed/forbidden path lists in proposal; all change artifacts/evidence.
  - **Acceptance:** no dependency/package/lock/forbidden changes; authority/import/API, secret, and scope scans clean; targeted tests, full unit suite, build, focused E2E, `git diff --check`, evidence repeat, reviewer and reviewer-GLM pass; completion preflight passes; worktree Git-clean after approved commit only.
  - **Guidance:** findings first by severity/file; dispatch concrete fixes to owner and rerun focused review/verification; no PR/merge/archive.
  - **Skills/MCP:** `devtoolbox-review`, `requesting-code-review`, `verification-before-completion`, `commit-message`; no Unity MCP/editor.
  - **Verification:** commands in `tests/test-protocol.md`, exact diff/scans/hashes, DevToolbox verify/completion preflight.
  - **Report:** SHAs, imports/no duplicates, fixtures, test/build/E2E counts, browser health/hashes, reviews, DevToolbox, scope/V1 limits, remaining risks.
  - **Stop:** do not commit or push until user explicitly confirms the human-review package; never create PR/merge/archive.