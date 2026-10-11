# Independent W01 review

Reviewer: `/root/w00_repo_audit`. Product inspected read-only; implementer was on WRITE HOLD. No product edits, commits, tests, builds, browser runs or subagent delegation by this reviewer.

Candidate branch `codex/hestia-fp06-integrator-2026-10-11`, worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`.
BASE `656c52458eff15133025bb21dc3e5b7b708cfbf7`; HEAD `b8edd17bfdeb2bc724afc76c148d8aeacacde7b1`.
Complete supplied patch SHA256 `157b39c1d6c80c45dd376af97a14c3d2196a5543a6c6e0464d094d2d3f20e2fd` (285011 bytes).

## SPEC_COMPLIANCE: FAIL

**R1 — P2, preserve the frozen B06 cassette source ID.** `apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts:117` declares the cutter's cassette source ID as `B06:OFFCUT`. The literal accepted FP02 source, `01_PLANUNG_VERBINDLICHE_QUELLEN/HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md:545`, names this 6-kg port **`CASS-OFFCUT`**. Its catalog source ID must therefore be `B06:CASS-OFFCUT`; the distinct save-safe runtime alias may remain explicit. This is a public contract error, not cosmetic spelling: the source/runtime map is derived from these ports and `loadFactoryCatalog` (lines 157–161) admits only these exact canonical bytes. A source-correct port is presently absent and is rejected by the source lock. The user's actual W01 freeze explicitly preserves FP02 ports (current root controlplane `source-lock.json:461` and `decisions.md:24`, reply “W01-Freeze freigeben”, received `2026-10-11T09:23:32Z`). Downstream packages must not freeze the invented source ID.

The five granted product files were read in full and compared with the literal sources: FP02 §§4–6, B05–B09 in §7, layout/port/conveyor definitions in §8, §§9–10, FP03 §1.2 and FP04 §1.2. Other checked values agree: C01–C28 packing/mass quantities and totals (2,984,400,000 mg / 12,450,000,000 mm³); all seven recipe material balances; B06/B07/B08 chassis-inclusive BOM masses 208/341/499 kg; explicit build-grid 250 mm vs terrain 125 mm and eight-cell 37.5 kg oracle; source-bound exact rational pack allocation and clearly labelled conservative product envelopes; unknown rock/gravel volume remains absent from native Resource definitions. Static layouts do not install or duplicate cargo. No independent additional blocking source mismatch found.

## CODE_QUALITY: FAIL

R1 also affects the immutable public boundary and its regression protection. `apps/weltraum-browser/tests/unit/factory/catalog.test.ts:37` checks the cutter input and former output but does not check the literal cassette source ID; subsequent bijection/immutability checks accept the internally consistent incorrect ID. Add a literal source-port oracle for `B06:CASS-OFFCUT`, demonstrate its expected failure against this candidate, then correct the catalog. Regenerate catalog signatures/snapshots and evidence because canonical bytes change. No separate unrelated quality changes requested.

Otherwise the inspected implementation maintains a single native Resources quantity authority, frozen source/catalog records, explicit source/runtime mappings, complete canonical-byte admission before Resource construction, safe integer units and rational volume metadata. FNV signatures are explicitly noncryptographic and independent document SHA256s remain present. Native floating Resource seams are explicitly deferred to exact W02 admission/capacity logic rather than claimed to implement those transitions here. No existing host, physics, save, Resources core, dependency, renderer or UI writes appear in this package.

## Evidence provenance and verification

Inspected all 29 changed paths: five granted product files plus 24 package evidence files. `git status --short` was empty; HEAD contains the reported W01 commit. Read-only `git diff --check BASE HEAD` exited 0. The recorded `product-diff.patch` exactly equals the actual five-product-file Git diff. Independently recomputed all five manifest product digests and 22 artifact digests: zero mismatches; all nine actual `.raw.gz` logs decompress successfully. Raw logs are LFS-managed; no claim that textual Git pointers themselves contain the original log bytes. FP02 source SHA256 independently equals `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39`.

Read existing implementer logs in `apps/weltraum-browser/evidence/factory/w01/2026-10-11T093328.263557Z/`: initial RED has seven runtime-body failures with resolved imports; source-binding RED has five passed/two failed; verified GREEN records four files/45 tests passed (11 W01 and 34 Resources regressions); verified build records TypeScript/Vite success with the existing large-chunk warning. The earlier failed test-typing build is retained and distinguished from final success. These are implementer executions, not reviewer reruns. Reviewer tests/build/browser/full suite: **NOT_RUN**, as instructed. The passing reported tests do not cover R1 and therefore do not establish package acceptance.

Exact evidence commands used included `git log -1 --format='%H%n%s'`, `git status --short`, `git diff --stat BASE HEAD`, `git diff --check BASE HEAD`, numbered source/code reads, and Python hashlib/gzip/full-product-diff comparisons. User receipts and grant were checked against the current W00 root controlplane, not just the integrator's inherited documents.

## Gate

W01 independent gate **FAIL** for R1. Hold downstream grants until the source ID, focused literal oracle and regenerated evidence are reviewed on a new full commit SHA. Scope of follow-up review: R1 and changed canonical data/evidence only.
