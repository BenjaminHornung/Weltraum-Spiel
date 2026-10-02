# ExecPlan: Hestia Living-World R&D

## Goal
Deliver executable renderer, wind, weather and authoring comparisons, honest evidence,
six strand reports and adoption cards. Product integration always remains **no**.

## Context
Read base: `BenjaminHornung/Weltraum-Spiel@b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Base tree: `cdf8a92b17eecd764bac4588054167bd566485f1`.
Source package: `input-package/`, copied byte-for-byte from the user ZIP;
ZIP SHA-256: `510c87e3754f395daf76eb3a2ca44b818041067c13e240c8ebc2c93be95b6c8f`.
The package's `05_TASKBOARD.json` is the authoritative 25-card dependency DAG.
The frozen root `AGENTS.md`, `README.md`, `docs/current-mainline-state.md`,
`.agent/PLANS.md` and applicable rules are read-only.

## Non-goals
No changes outside `experiments/hestia-rd-2026-10-02/`; no active product-checkout
writes, native cut implementation, real saves, goldens, global configuration,
push, PR, main merge, release, deployment, third-party upload or new subscription.
Do not run product builds or tests. Historical status documents are not current acceptance.

## Architecture decision
Use the three small frozen lab boundaries from package document 03, one lab
package and a static registry. RD-03 owns a single Three host for effect composition.
Snapshot replay is presentation evidence, never Rapier or product acceptance.
RD-00 is the initial sole config/contract writer; HEAD assumes that ownership only
after its terminal handoff. Each other card has a separate allowlist and worktree.

## Implementation phases
1. Verify source bytes, base commit/tree, independent clone, tools and capacity.
2. RD-00 freezes installable contracts, negative tests and boundary verification.
   SO-01 and SO-02 prepare source-bound leaf briefs; SO-06 prepares independent QA.
3. Integrate verified RD-01/02/10/50 candidates serially; RD-03 delivers the control.
4. Follow the DAG for RD-20/30, wind/rain/materials/renderers and the early gallery.
5. Verify lifecycle and tools; combine surviving Three effects on one canvas.
6. Report decisions, explicit missing evidence and the smallest adoption steps.
Optional RD-22/33 require an explicit HEAD capacity/hypothesis gate.

## Tests and evidence
Each card retains its named negative/parity tests, red/green evidence, exact
commands and exit codes. Run focused unit/lifecycle checks, type/build checks,
real browser smoke and separate image/motion evidence. Benchmark only correct
candidates, with the predeclared AB/BA sessions from document 04 and an exclusive
GPU lease. Unavailable data is NOT_RUN/UNSUPPORTED, never zero or PASS.
HEAD reviews exact candidate diffs, checks committed/staged/worktree/untracked
scope and write-escaping links, and verifies fresh integration evidence.
Raw logs, browser profiles and generated artifacts live in the external run root.
Repository DevToolbox rules are honored through equivalent local checks: this
task does not authorize a tracked `.devtoolbox` change/execution outside the lab.

## Risks
Only ~4.5 GiB free RAM was observed at discovery; existing product agents have
priority. The provider does not advertise a numeric host thread limit. Start
conservatively: at most three open RD children, normally two active and one
reserved recovery/review slot, one writer and one heavy RD job. No nested spawn
without a named HEAD lease. Inspect actual child tools before claiming nesting.
No GPU/performance lease is initially granted; functional work can continue.
Pinned product dependencies are Three 0.185.1, TypeScript 7.0.2, Vite 8.1.5,
Vitest 4.1.11 and Playwright 1.61.1 (the package, not stale prose, wins).
Unavailable concept/LFS/media bytes block only their corresponding art/provenance gate.

## Rollback / safe stop
Stop the affected writer on a scope violation, unverified dependency or ownership
conflict. Retain candidate commits and durable handoffs; do not reset, delete,
clean or rebase foreign work. Integrate only exact reviewed commits, serially.
Stop only task-owned services, never shared browser contexts or foreign processes.

## Progress log
- [x] Correct ZIP: CRC and all 52 payload hashes verified.
- [x] Fresh independent clone created; clean branch at the exact base and tree.
- [x] Node 22.23.2 and a C:/IFI_SourceCode Chromium binary located; Playwright MCP connected.
- [ ] Real spawn/completion/close and nested-tool capability verified.
- [ ] RD-00 frozen and freshly verified.
- [ ] L1 control scene, L2 candidates, L3 tools, L4 combination and L5 decision delivered.

## Definition of Done
Exact installation/start/test commands and local commit/tree; verified write
boundary; six strand reports; seven honest reference cards; available images/clips
and raw measurements; RESULTS.md, RUNBOOK.md and ADOPTION_QUEUE.md. Report each
capability separately as implemented, unit tested, browser tested, performance
qualified, human art accepted and product integrated. Missing external/owner gates
stay open; never label an unstarted experiment as a failed benchmark.
