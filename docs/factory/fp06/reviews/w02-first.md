# Independent W02 precommit review

Reviewer `/root/w00_repo_audit`; all product inspection read-only during WRITE HOLD. No product edits, commits, new tests/builds, browser execution or subagents. Candidate is uncommitted, HEAD/base `a30630dd7963c165c673df7ea1b46d52735752ef`, branch `codex/hestia-fp06-domain-2026-10-11`, worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11`.

Bound snapshot: `/workspace/.cloud-setup/fp06-task-briefs/w02-precommit-review.json`; supplied patch SHA256 `277797d437efce4897abffdd6e548b29487d426cafd2c9f837969784da97e144`. The patch exactly equals the actual standard staged BASE diff of the four product files. All four snapshot digests were verified both before inspection and again at review completion; zero differences.

## SPEC_COMPLIANCE: PASS for current runtime and exit invariants

Full W02 brief and the relevant literal source sections were read: FP02 §§4–6 and §12; FP03 §13; FP06 §12.1 and W02's exit contract. Existing native Resources snapshot constructors, metadata compatibility, transfer admission, capacity and access/port/mission/ownership rules were inspected alongside all four added files and all 15 material tests.

The current code's data and transaction boundaries meet the inspected W02 runtime requirements. Positive safe integer quantities and overflow guards are explicit. Source-packed/conservative capacity compares exact rational BigInt cross-products against exactly admitted integer mg/mm³ limits, without rounding credits. Real rock/gravel remain inadmissible; T009 uses an explicitly separate synthetic fixture. Parent bulk stock becomes unique provenance-carrying children, and serialized pieces remain indivisible. All available material quantities remain solely in `ResourceContainerSnapshot.state.contents`; computed mass, output-space claims and native historical `initialContents` are not available shadow inventories.

Prepare builds immutable complete candidates using existing `transferResource`; rejection does not publish partial withdrawals. Commit compares full catalog/definition/state/reservation/receipt bindings and independently re-evaluates the request before publishing the complete verified candidate. The finite C26 moves into one real WIP container; the competing prepared job is stale after the first commit. Recipe WIP is inaccessible to ordinary transfer even for its owner; release requires empty owner-bound WIP. Exact outputs/offcut, stack-slot/mass/volume entitlement, custody, grade/condition and command idempotence are covered. Recipe output policy is tested hypothetically before publishing the start reservation. W04's energy/work completion admission and Host session/epoch admission remain explicitly outside this pure W02 seam; no claim that W02 alone authorizes powered completion.

No current concrete runtime/spec blocker found. This verdict is scoped to these four pinned product files and the package's current invariants, not a claim that all historical workflow steps complied or that the still separately tracked browser exit gate passed.

## Historical TDD compliance: FAIL / original RED NOT_RUN

**R1 — P2 process finding, retained.** Evidence `apps/weltraum-browser/evidence/factory/w02/run-20261011T101118Z/review.md:21` and `manifest.json:29` correctly state that the initial attempt failed importing missing modules and collected zero tests. The expected business RED before the original T009–T012 implementation (`material.test.ts:48`, `:71`, `:90`, `:103`) is **NOT_RUN**. Thus that initial implementation sequence did not satisfy the user's requested test-first business-failure step. A passing test written before implementation without an observed body failure is not retroactively RED evidence.

FP06 §12.1 line 579 explicitly says: “Ein Importfehler kann der erste Red-Schritt sein, ersetzt aber nicht den späteren fachlichen Negativfall.” Later actual WIP-lock, condition and incompatible-grade failures were inspected: respectively 1 failed/12 passed, 1 failed/13 passed, and 2 failed/13 passed before their respective fixes. They substantiate actual later RED→fix→GREEN cycles for those precise cases, including current package safety invariants. They do not manufacture an earlier T009–T012 body failure. Preserve the historical deviation in the final report. There is no claim of owner waiver, no retrospective replay, and no invented permanently irreversible gate rule: current runtime/exit acceptance and historical process compliance are different conclusions.

## CODE_QUALITY: PASS

No concrete blocking defect identified in the inspected current material arithmetic, immutable transaction composition, native policy preservation, reservation/WIP ownership, canonical stale/forgery checks, quality propagation or idempotence. Existing shared Resources, host, physics, save, UI, renderer, contracts, dependencies and configuration remain untouched. The implementation is contained in the three granted material modules and one focused test file.

**R2 — P3 evidence accuracy.** `apps/weltraum-browser/evidence/factory/w02/run-20261011T101118Z/review.md:28` reports 15 W02 + 10 W01 + 36 existing Resources tests. The actual supplied file contents contain **15 W02 + 12 W01 + 34 Resources = 61** tests: resourceCatalog 10, resourceContainers 9, resourceTransfer 15. The 61-test total is corroborated by the fresh log; the component counts should be corrected when finalizing evidence. This is an evidence typo, not a runtime defect.

## Verified evidence and limits

Final product hashes:

- `apps/weltraum-browser/src/factory/material/quantity.ts`: `ba29fc004b20d9bb0cd6e41f39f2b28acf036e0e395f50421f42ccf5d8721328`
- `apps/weltraum-browser/src/factory/material/reservations.ts`: `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e`
- `apps/weltraum-browser/src/factory/material/resourcesAdapter.ts`: `00fb33b5774fd96980e02e8c1bb92a178d5aedb18b612499cde21a3b0ab1c509`
- `apps/weltraum-browser/tests/unit/factory/material.test.ts`: `b59a9bc6fc18f927f07632396a2396950210d0cabffbb46d4848c3654c6c5721`

All 12 compressed raw stdout/stderr archives named by `raw-log-index.json` decompress and match their independently recomputed uncompressed SHA256. Read existing final focused/affected unit output: five files, 61 tests passed at 10:22:59; final TypeScript/Vite build succeeded with the existing chunk warning. Initial setup and typing-build failures remain retained. These are implementer runs, not reviewer reruns. Read-only `git diff --cached --check` exits 0 for the four staged product files; evidence was not yet staged and this is not a complete future commit-diff check.

The supplied review snapshot labels Cargo-E2E RUNNING; the evidence manifest still says NOT_RUN/port pending. A later `browser-core-exit.txt` contains 0, but this reviewer has not independently bound the complete fresh browser command/log/report to that exit file. Therefore required Cargo-E2E result is **PENDING in this review**, not PASS or NOT_RUN if actually executing elsewhere. Full browser evidence and final manifest remain root/writer finalization work. Browser visuals/full regression suite: **NOT_RUN by reviewer**; W02 makes no visual/UI changes.

## Gate disposition

The technical runtime/spec and code/contract reviews are **PASS** on the pinned product snapshot. Original T009–T012 TDD compliance remains **FAIL/NOT_RUN**, honestly archived and never erased by this acceptance. Full W02 completion receipt is **PENDING** until the required fresh Cargo-E2E evidence, corrected component counts, final evidence inventory and complete staged-diff check are supplied and bound to the final commit. Root retains responsibility for the package receipt and dependency grants; this reviewer does not mutate grants or claim a final commit SHA for uncommitted code.
