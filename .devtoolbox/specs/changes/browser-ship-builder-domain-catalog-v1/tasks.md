# Tasks: Browser Ship Builder Domain Catalog v1

## Shared execution contract

- `plan_status=approved`; `explicit_replan=false`.
- Workspace: `C:\Users\benni\AppData\Local\Temp\opencode\weltraum-spiel-browser-ship-builder-domain-catalog-v1` on `feature/browser-ship-builder-domain-catalog-v1` from refreshed `origin/main`.
- This is a Browser-only worktree of a Unity repository. Do not start Unity or use Unity MCP/editor operations. The active original checkout is owned by parallel UI/Unity work and must remain untouched.
- Allowed product paths are only `apps/weltraum-browser/src/ship-builder/**`, named `shipBuilder*.test.ts` unit files, the named domain E2E/evidence files, the three listed Browser-mainline docs, and this change folder.
- Forbidden: `index.html`, `src/main.ts`, `src/style.css`, `src/ui/**`, `src/render/**`, `src/runtime/**`, `src/sim/**`, `Assets/**`, package/lockfiles, existing UI screenshots/evidence, renderer/runtime truth, final economy, Builder UI, Unity ports, and test-flight spawning.
- Every worker must load project `AGENTS.md`, this change proposal/spec/design/tasks, and the required `devtoolbox-specs-execution` skill. Do not reformat or clean files outside the owned list. Stop and escalate on scope overlap, required forbidden-path edits, unclear schema authority, or failing unrelated baseline tests.
- Report back for every task: changed files; design/behavior delivered; tests/checks run with results; blockers; remaining risks; and unverified items. No commits or pushes until user confirmation after final verification.

## Phase 1: Domain foundation

- [x] 1. Implement identity, category, component, socket, validation, and canonical primitives.
  - **Objective:** Create the JSON-safe foundational contracts on which catalog and blueprint code can depend, with category/capability separation enforced structurally.
  - **Owned files:** `apps/weltraum-browser/src/ship-builder/ids.ts`, `types.ts`, `categories.ts`, `components.ts`, `sockets.ts`, `validation.ts`, `canonicalJson.ts`.
  - **Exact guidance:** Implement all branded ID/version parsers and stable `ShipBuilderDataError`; JSON-safe namespaced extension validation and deep freeze; serializable vectors, dimensions, footprints, Euler/quaternion records; eight open-registry category constants/definitions sorted by order then ID; all twelve required discriminated component kinds with the prompt-defined typed fields; component socket-reference extraction; all required socket type constants/metadata and local reference checks; future non-serialized component-handler interfaces; canonical plain-JSON key ordering using core `fnv1aHash` only. Do not export a generic primary stats bag and do not derive capability from category.
  - **Acceptance:** Malformed IDs/versions/extensions/numbers/vectors fail with deterministic code/path; categories remain extensible; functions cannot enter serialized data; functional directions never silently fall back; modules compile independently.
  - **Required skills/MCPs:** `devtoolbox-specs-execution`; use repository read/search only for existing TS conventions.
  - **Verification:** from `apps/weltraum-browser`, run `npm run build` if dependencies are available; otherwise run the narrowest TypeScript check available and report the environment blocker. Inspect changed paths against ownership.
  - **Stopping rule:** do not create catalog, blueprint, fixtures, tests, docs, or touch any non-owned file; escalate if the component fields in the approved requirement cannot be represented without widening scope.

- [x] 2. Implement immutable catalog, authoritative blueprint, canonical serialization, and migration seams.
  - **Objective:** Turn Task 1 contracts into validated immutable catalog snapshots and versioned blueprint parse/serialize/hash APIs.
  - **Owned files:** `apps/weltraum-browser/src/ship-builder/catalog.ts`, `blueprint.ts`, `serialization.ts`; Task 1 files may be changed only for a concrete integration defect and must be listed explicitly.
  - **Exact guidance:** Create catalog document/snapshot builders, deterministic summary/signature, deep-frozen record/array indexes, duplicate/unknown/category/socket/component/reference/numeric checks and fixed validation ordering. Create part-instance transform helpers preserving IDs; v1 yaw-step validation with zero preserved pitch/roll; first-class connections; blueprint reference derivation/checking and optional catalog endpoint validation. Canonical catalog/blueprint serialization must parse from `unknown`, sort domain arrays, reject unsupported versions, and expose empty catalog/blueprint migration registry interfaces. Blueprint layout hash must use a separate authority projection excluding IDs/names/custom labels/draft timestamps/caches/active state.
  - **Acceptance:** no blind JSON assertions, mutable Map/Set exposure, serialized indexes, inferred mesh connections, cache authority, or future-version acceptance. Equivalent insertion orders canonicalize identically.
  - **Required skills/MCPs:** `devtoolbox-specs-execution`; read Task 1 public contracts before editing.
  - **Verification:** `npm run build` when available plus small local compile-time/API checks; inspect owned diff and report any Task 1 edits.
  - **Stopping rule:** do not add starter data, fixtures, tests, browser code, docs, or full compatibility/stat/flight validators; escalate if immutability or canonicalization requires public contract changes beyond Task 1.

## Phase 2: Data and unit acceptance

- [x] 3. Implement the sixteen-part starter catalog, three fixtures, public exports, and required unit suites.
  - **Objective:** Exercise the public domain APIs with fixed concept data and all requested deterministic/error/roundtrip tests.
  - **Owned files:** `apps/weltraum-browser/src/ship-builder/starterCatalog.ts`, `fixtures.ts`, `index.ts`; `apps/weltraum-browser/tests/unit/shipBuilderCatalog.test.ts`, `shipBuilderBlueprint.test.ts`, `shipBuilderSerialization.test.ts`. Earlier ship-builder files may change only to fix defects exposed by these tests and must be reported.
  - **Exact guidance:** Implement exactly two named concepts per built-in category from the spec, preserve published IDs, freeze deterministic IDs for the rest, omit final build costs, and attach namespaced provisional balance/source metadata. Every definition uses explicit typed components/sockets. Add fixed scout/cargo/weapon blueprints with stable instance/connection IDs and explicit connections. Export a browser-usable public surface. Cover all 18 user-requested cases plus immutable index/snapshot behavior and stable error codes; pin deterministic signature/hash where useful.
  - **Acceptance:** eight categories, sixteen valid definitions, at least one definition/category, category/capability separation test, all fixtures resolve only existing definitions/sockets, canonical roundtrips and ID stability pass.
  - **Required skills/MCPs:** `devtoolbox-specs-execution`; read `ship-builder-modular-parts.md` and the approved spec/design for concept authority.
  - **Verification:** run the three focused commands exactly: `npm run test -- tests/unit/shipBuilderCatalog.test.ts`; `npm run test -- tests/unit/shipBuilderBlueprint.test.ts`; `npm run test -- tests/unit/shipBuilderSerialization.test.ts`.
  - **Stopping rule:** do not add UI/runtime/render/Unity/economy/test-flight behavior or edit unrelated tests; escalate if concept documents contradict a required typed field instead of inventing final balance.

## Phase 3: Browser evidence and documentation

- [x] 4. Add the normal-runtime Vite module smoke, evidence, and Browser-mainline coverage documentation.
  - **Objective:** Prove the domain module runs in a real browser without TestBridge/UI integration and document implemented versus future catalog scope.
  - **Owned files:** `apps/weltraum-browser/tests/e2e/ship-builder-domain-catalog.spec.ts`; `apps/weltraum-browser/evidence/browser-ship-builder-domain-catalog-v1.md`; `apps/weltraum-browser/evidence/browser-ship-builder-domain-catalog-v1-summary.json`; `docs/browser-mainline/ship-builder-domain-catalog-v1.md`; scoped edits to `docs/browser-mainline/feature-intent-index.md` and `port-roadmap.md`. Ship-builder source may change only for a browser-only defect and must be reported.
  - **Exact guidance:** Playwright loads `/`, asserts `window.TestBridge` absent, dynamically imports `/src/ship-builder/index.ts` inside page context, creates the starter catalog, checks 8/16+, pins stable signature, and roundtrips the scout blueprint. Node-side test writes deterministic JSON/Markdown evidence; no screenshots because rendering is not relevant. Documentation explains ID/schema/category-component/socket/connection/index/hash/migration contracts, fixtures/non-goals, provisional balance, and all 32 concept names with exactly 16 implemented/16 future. Index/roadmap must say domain foundation implemented while UI/runtime remain deferred.
  - **Acceptance:** no main/UI/runtime/render changes; evidence contains reproducible counts/signature/roundtrip/TestBridge status and valid JSON; docs do not overclaim flight readiness or final balance.
  - **Required skills/MCPs:** `devtoolbox-specs-execution`; `playwright` only for the browser verification lane, not for UI implementation.
  - **Verification:** `npm run test:e2e -- tests/e2e/ship-builder-domain-catalog.spec.ts`; parse the generated JSON; inspect console/network failures if the smoke fails.
  - **Stopping rule:** do not add screenshots, TestBridge hooks, HUD/panels, routes, runtime imports, or package changes; escalate if Vite cannot import the source module without a forbidden config change.

## Phase 4: Review and release evidence

- [x] 5. Complete dual review, fresh verification, scope audit, and DevToolbox evidence.
  - **Objective:** Establish spec compliance and readiness without committing or pushing.
  - **Owned files:** implementation fixes only through the original owning task; DevToolbox execution/review/verification metadata under this change. No opportunistic refactors.
  - **Exact guidance:** run reviewer and reviewer-glm findings-first review for correctness, deterministic ordering/hashing, runtime immutability, error stability, category/capability separation, socket/reference safety, migration seam, test gaps, and forbidden-path drift. Route concrete fixes to the correct owner and rerun focused review. Use test-runner for focused unit suites, full `npm run test`, and `npm run build`; use browser-debugger for the targeted Playwright smoke and evidence consistency.
  - **Acceptance:** all required commands pass or a user-accepted risk is recorded; new JSON parses; `git diff --check` passes; staged diff check runs only if staged; status confirms no `Assets`, package, or lockfile modifications; changed paths all match allowlist; review has no unresolved high/medium correctness findings.
  - **Required skills/MCPs:** `devtoolbox-review`, `verification-before-completion`, `devtoolbox-specs-execution`; use DevToolbox verify/review/completion preflight records.
  - **Verification commands:** all three focused unit commands; `npm run test`; `npm run build`; targeted E2E; JSON parse; `git diff --check`; optional `git diff --cached --check`; exact forbidden-path status command from the user request.
  - **Stopping rule:** do not mark tasks complete or claim readiness before fresh evidence; do not commit/push; stop for user confirmation after presenting grouped Browser-domain changes, tests, evidence, remaining 16 planned parts, risks, branch, and uncommitted diff.