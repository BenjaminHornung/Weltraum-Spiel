# ExecPlan: RD40 usable gallery, phase 1

ProductIntegrated=false

## Goal
Implement the real single-viewport gallery and focused runnable checks. This is
a local leaf candidate, not HEAD-integrated delivery or the RD51/RD52 package.

## Context
Accepted START `c531783536cc0fc617e928781633101b43cd2bfa`, tree
`49c4dccc756ff8916227db371296ff858de35f88`; product readbase
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Authority is input-package 01–04,
RD-40, SO-05/taskboard and HEAD's SO05-PREPARATION-c5317835.md/admission.
RD01 and RD03 are accepted dependencies. RD11 factories are already present.

## Non-goals
No shared/root/product/config/fixture/media changes, delegation, browser,
port/server/GPU/performance use, remote publication, cleanup of existing files,
DevToolbox or platform-log access. All writes are the three RD40 roots or a
fresh external RD40 phase1 run. One sequential CPU job at a time.

## Architecture decision
Native DOM/CSS, known C0/C1/C2 hosts behind a gallery-only typed adapter.
Reuse bounded assets, validated scenarios, mountExperiment and scenarioRunner.
No generic contract extension or second render loop. Fixed camera is a validated
derived scenario, separately hashed. Suspend clock, invalidate/abort/await/dispose,
then fresh canvas; one pending mount and coalesced latest selection. READY requires
a newer matching actual submission (C0 current frame plus rendered identity;
RD11 also backend/camera/projection generation). Restore Play only after READY.
Tool-owned evidence sidecar, not an extension of LabRunResultV1.

## Implementation phases
1. Add focused negative/ownership tests, record initial failure, install exact
   lock only if dependencies are absent, using C-only process environment.
2. Implement comparison state/lifecycle, known factories and actual UI; expose
   diagnostic/reference gaps honestly and gate evidence export on byte bindings.
3. Write ready-for-HEAD browser.spec.ts; run root and stricter focused types,
   focused CPU checks and gallery-only optimized build sequentially.
4. Self-review exact diff, fresh full boundary/source/input checks, local narrow
   commit directly descended from START, external SHA/tree/command/hash receipt.

## Tests and evidence
UI40 paused nonzero A/B/A, actual snapshot/reset boundaries and backward seek.
UI41 unsupported/late/failed mount, replacement and disposal, missing media.
UI42 actual browser keyboard/Escape/focus/narrow screenshots: NOT_RUN phase1.
UI43 stable export hashes, complete source/scenario/frame/quality/media bindings
and rejection of missing/mismatched/pending evidence. CPU doubles are CONTROLLED,
not native renderer/UI proof. Browser spec is compiled, not executed.
Root build is not gallery proof; reports/RD-40/vite.phase1.config.ts builds the
actual leaf HTML separately. Full guard uses --task RD-40 --start c531783536cc0fc617e928781633101b43cd2bfa
--base b3c6523a94cd050f5a9a22dc27f4777fcc03363e. Recheck original 52 inputs,
current shared18 and all START files, fixtures/media against immutable freeze.

## Risks
Abort during async init, disposal errors, same-tick camera/resize readiness,
snapshot rollback, stale evidence, unsupported C2 fallback. REN12 original
vertex-color omission oracle FAIL remains unchanged; visual adoption DEFER;
no qualified GPU/art/product success. Git/build provenance from evidence is
external metadata, never silently inferred from semantic sourceDigest.

## Rollback / safe stop
Preserve attempts/files. Stop on authorization, boundary, contract or failed
disposal requiring shared-owner repair. No reset/discard/delete. HEAD integrates
only after the leaf commit; it alone adds the Vite input and root navigation link.

## Progress log
- [x] Mandatory authority and actual factories/runner/native hosts inspected.
- Initial missing-module red check preserved. Root types then passed. Optional
  noUncheckedIndexedAccess experiment found 27 diagnostics exclusively in pinned
  shared dependencies; no shared/type-pin edits. Focused config keeps strict and
  adds noImplicitReturns/noImplicitOverride/noFallthroughCasesInSwitch instead.
- [x] Focused tests and actual implementation; 13 controlled CPU checks pass.
- [x] Fresh verify-g: root/focused types, CPU, leaf build, original52 guard.
- [x] Exact source binding and START645/fixture-media429/current shared18 verified.
- [x] Staged-diff self-review and C-only commit/receipt procedure prepared.
- Actual local commit and postcommit receipt status: authoritative external
  candidate-a/receipt.json; no source edits after candidate creation.
- Self-review fixed a disposal-retirement race (selection during failed command),
  added its focused regression, and fail-closed failed-init cleanup handling.
- Source proof exposed Vite's importer exclusion and Vitest's CSS stub. Explicit
  self raw import and RD40-only raw-CSS config fix both; all file SHA values match.
- START .mts has inherited text=auto/core.autocrlf=true: compare with Git builtin
  clean (filter unspecified), record raw SHA; no file rewrite or new scope exception.
- Staged review additionally guards current active-card quality on pair export
  (focused negative check) and preserves disposal ERROR instead of saying IDLE.
- Pending commanded frames display PREPARING/last-submitted, not false READY;
  Pause is queued behind the one in-flight clock command instead of being lost.

## Definition of Done
Source runtime, focused types and CPU PASS, exact scope/source receipt, compiled
browser acceptance spec, honest NOT_RUN browser/screenshots/GPU and minimal HEAD
wiring instructions. No claim of optimized integrated gallery/programme completion.
