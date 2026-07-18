# Tasks

## Phase 1 — Deterministic vegetation authority
- [x] Implement species, validation, canonical population, placement, and proxy contracts.
  - Objective: create exact three-species registry plus deterministic global-grid candidates, hydrology/terrain placement, budgets, crown spacing, stable hashes, and multi-part proxies.
  - Files/search targets: write only `apps/weltraum-browser/src/world-generation/hestia/vegetation/**`; read public barrels under adaptive, structural, hydrology and existing Hestia density/scatter/index patterns.
  - Acceptance: required tests 1–12, 16, 25–28 pass; exact 6 m/48-quanta grid, ±2 m jitter, unjittered ownership, canonical Z/X/species/hash order, fail-closed placement, no duplicates, immutable inputs/frozen outputs.
  - Guidance: consume pinned public contracts; normalize input order; no Date/Math.random/DOM/Three.js; do not modify forbidden dependencies or design a second authority.
  - Skills/MCPs: repository instructions; `devtoolbox-review` reuse-first; no Unity MCP/editor.
  - Verification: focused Vitest files matching `tests/unit/hestiaStructuralVegetation*.test.ts` plus `npx tsc -p tsconfig.json` from `apps/weltraum-browser`.
  - Report: changed files, exported API, tests/checks, blockers, remaining risks, unverified items.
  - Stop: stop on missing/incompatible pinned public contract, required forbidden-file change, scope overlap, or moving hydrology dependency.

## Phase 2 — Umbrella structural graph and destruction compilation
- [x] Implement the complete Umbrella Tree graph, Level-4 Structural brick compiler, anchor/connectivity, and deterministic cut/detachment facts.
  - Objective: produce stable acyclic trunk/branch/canopy graphs and compile only intersected 16³ Level-4 bricks using existing Adaptive/Structural contracts.
  - Files/search targets: write only `.../hestia/vegetation/**` and focused `tests/unit/hestiaStructuralVegetation*.test.ts`; read Structural commands/connectivity/mass/persistence/greedy-mesh APIs.
  - Acceptance: required tests 13–15 and 17–27 pass, including stable IDs, Adaptive key reuse, root anchors, intact anchoring, deterministic trunk cut, stable detached component, finite mass/COM/inertia, signed nonzero cross terms, region-split invariance, frozen results.
  - Guidance: use Level 4 only; root cells anchors; existing Structural hashes/materials/persistence/components authoritative; joints never create connectivity; greedy mesh derived only.
  - Skills/MCPs: repository instructions; `devtoolbox-review`; no Unity MCP/editor.
  - Verification: focused vegetation Vitest plus pinned adaptive/structural dependency test gates and TypeScript compile.
  - Report: changed files, graph/compiler/cut APIs, test evidence, blockers, remaining risks, unverified items.
  - Stop: stop before duplicating Structural Core concepts or changing adaptive/structural/hydrology files.

## Phase 3 — Browser proof, evidence, and documentation
- [x] Add unit coverage, normal-route dynamic-import E2E proof, deterministic evidence, and browser-mainline documentation.
  - Objective: cover all 31 mandatory checks and emit timestamp-free byte-stable evidence.
  - Files/search targets: `tests/unit/hestiaStructuralVegetation*.test.ts`, `tests/e2e/hestia-structural-vegetation.spec.ts`, `evidence/browser-hestia-structural-vegetation-v1-summary.json`, `evidence/browser-hestia-structural-vegetation-v1.md`, `docs/browser-mainline/hestia-structural-vegetation-v1.md`, and change `tests/test-protocol.md` only.
  - Acceptance: dynamic import is exactly `/src/world-generation/hestia/vegetation/index.ts`; hydrology fixture → population → Umbrella proxy → bricks → intact classification → trunk cut → detached crown/branch; two executions byte-identical; health 0/0/0/0; TestBridge absent; no screenshots.
  - Guidance: normal `/` route only; do not edit main/style/workers/config; deterministic serialization without timestamps.
  - Skills/MCPs: repository instructions; Playwright only through verification/browser lane if needed; no Unity MCP/editor.
  - Verification: focused unit tests, `npm run test:e2e -- tests/e2e/hestia-structural-vegetation.spec.ts --workers=1 --retries=0`, compare evidence hashes/bytes.
  - Report: changed files, scenarios/assertions, evidence hashes, browser health, blockers, risks.
  - Stop: stop if proof requires TestBridge, route source changes, screenshots, or forbidden config changes.

## Phase 4 — Final gates and delivery
- [ ] Complete dependency gates, full verification, dual review, scope/security checks, completion preflight, commit, and non-force push.
  - Objective: prove dependency compatibility, full repository health, exact allowlist, and review readiness.
  - Files/search targets: no new implementation scope; inspect complete branch diff and DevToolbox artifacts.
  - Acceptance: dependency tests, all vegetation tests, full tests, build, E2E, diff check, forbidden-import/API scan, secret scan, allowlist/package-lock check, hydrology remote stability check, reviewer + reviewer-GLM, verification review, completion preflight all pass; clean worktree after commit; remote SHA equals local; no PR/merge/archive.
  - Guidance: run commands in `tests/test-protocol.md`; fixes return to the owning implementation task/lane; commit exactly `#WELTRAUM-000 Add structural Hestia vegetation`; push non-force only to `origin/feature/browser-hestia-structural-vegetation-v1`.
  - Skills/MCPs: `devtoolbox-review`, `verification-before-completion`, `commit-message`; test-runner and verification-reviewer lanes.
  - Verification: complete final command matrix and independent review evidence.
  - Report: dependency/merge/commit/remote SHAs, contracts/facts, tests/build/E2E, evidence hashes, review/DevToolbox state, clean worktree, no PR/merge.
  - Stop: stop on changed hydrology remote SHA, review blocker, verification failure, secret, forbidden file/import, or non-fast-forward push requirement.