# Owned-data integration result — 2026-10-14

**FAIL — REJECTED_REVERTED. No product code from this candidate is retained.**
The one owner-approved integration window was executed. Both unchanged original paid-band cases exceeded 5,000 ms. Five useful baseline-compatible business tests remain; native gameplay and Save are still blocked.

## Source, ownership and scope

- Actual local base: `9724ba4f66be54afa560b3e398dab17ae2c8bfc1`; branch `codex/hestia-fp06-play-candidate-2026-10-12`.
- Actual freshly read remote main: `e40592c113b72a8dc93725187f92cf948e07f44d`; not used as a substitute base.
- Sole writer/Integrator: `/root`. Actual independent read-only reviewer: `/root/composition_contract_readonly`. No other writer was active.
- Forward approval: OWNER_GRANT.json. Historical proposal/source-lock/receipts remain unchanged. Exact pre-gate eight-file bytes: evidence pre-gate-source-lock.json.
- Retained source changes: only `tests/unit/factory/{production,conveyor,dryFactorySlice}.test.ts`. No live ownedData helper/seam test. Full actual changed paths and commit SHA are recorded in CHANGESET.json / FINAL_CHECKPOINT.json.
- No dependency, recipe/golden, Save, terrain/native Physics, renderer, limits, main merge, push or publishing change.

## Executed gates

All npm commands used Node 22.23.3 through `/workspace/.cloud-setup/toolchain/node_modules/node/bin` and ran from `apps/weltraum-browser`. Canonical limits were unchanged.

| Check | Result | Actual evidence |
| --- | --- | --- |
| Source bindings | PASS, all 13 | before-bindings.json and OWNER_GRANT.json |
| New seam red | Expected missing-module suite failure, **0 semantic tests**; not claimed as business red | 01-red-seam.log |
| Baseline capture first attempt | Test-setup FAIL: direct raw Native snapshots include optional undefined depletion | 02-baseline-bytes.log |
| Corrected baseline capture | PASS 3; 81 filtered | 03-baseline-bytes-corrected.log |
| Initial helper run | 6 PASS/1 test-setup FAIL; altered iterator also affected Object.keys iteration | 04-helper-guards.log |
| Initial preliminary run | 87 PASS/2 Conveyor timeouts/2 filtered paid cases; not final-source admission because subsequent correctness edits overlapped the running preliminary process | 05-preliminary-guards.log |
| Review-correction subset | PASS 14; 40 filtered | 06-review-correction-guards.log |
| Final preliminary | 106 PASS/3 FAIL/2 filtered: two existing Conveyor 5,000 ms timeout failures, one new IteratorClose test expected 1 closure instead of baseline 2 | 07-final-preliminary-guards.log |
| Corrected boundary subset | PASS 18; 93 filtered (including 13 already-tested Resources cases not selected in this subset) | 08-final-boundary-and-bytes.log |
| TypeScript | PASS, exit 0 | 09-typecheck.log |
| Complete original/candidate bytes | PASS Production 7,267,042 B, Conveyor 707,428 B, Dry 2,332,494 B; existing receipt bytes/digests included | byte-comparison.json, full gzip payloads |
| Original paid-band blackout/graph revision | **FAIL 8,164 ms / 5,000 ms** | 10-original-paid-pair.log |
| Original paid-band output blockage | **FAIL 20,463 ms / 5,000 ms** | same original pair, unchanged fixture/order |
| Product rollback | PASS exact original three product hashes; new helper absent; excluded paths unchanged | rollback-proof.json |
| Retained tests on restored baseline | PASS 5; 81 filtered | 11-restored-domain-guards.log |
| Original/candidate/restored full bytes | PASS identical in all three fixtures | restored-byte-comparison.json, nine verified gzip payloads |
| Rejected patch reconstruction | PASS all eight sealed hashes | rejected-patch-reconstruction.json |
| Further candidate/profile/pair | NOT RUN; allowance closed | one candidate, zero post-grant profiles, one pair |
| Candidate build / ordinary browser after gate | NOT RUN: phase required pair PASS | no successful browser/native claim |

The original paid block remains byte-identical: 15,736 B, SHA-256 `a16258decde43993c5b6bc6c41248ef6e34294a86572bca2f108eb64c6ae8223`. Complete fixture export omits the Native optional undefined depletion property through ordinary JSON export; full canonical receipt strings and existing digests stay exact. Unknown values still use public defensive paths in the reviewed candidate. No historical material booking changed.

The earlier baseline output-only run failed with a 14.27 s test phase. The approved candidate uses the required paired topology; this is not a controlled speedup comparison. Performance was not accepted. No further profiling or repair loop was performed after the failed gate.

## Review and retained behavior

CANDIDATE_REVIEW.md records the actual independent source review and all four full product hashes. Three concrete correctness findings were fixed before the single performance trial: cold Proxy probes, copying borrowed accessor roots, and inherited iterator/IteratorClose guards. Final source review found no further blocking correctness issue; it did not certify performance.

After rollback, retained tests exercise full cold/copied/adopted/replay bytes, tail receipt forgery rejection, and passive borrowed job/packet accessor identity. The original paid block is untouched. The rejected helper and its adversarial seam tests remain only in rejected-candidate.patch and `.rejected.txt` evidence, not live source. The patch was reconstructed in an isolated temporary source copy without executing it or creating a second optimization trial.

## Hardware and honest package state

CPU: Intel Xeon Platinum 8573C, x86_64, cgroup quota `400000 100000` (four CPU equivalents). During the pair no Node/browser/art process ran concurrently. Earlier ordinary-browser evidence used Chromium 154.0.8037.57 and Mesa llvmpipe, LP_NUM_THREADS=1; its result remains separate.

| Package / dimension | Current status | Boundaries |
| --- | --- | --- |
| W09 Functional | BLOCKED | Original paid-band timing FAIL; retained domain guards and source conservation do not complete the loop |
| W09 Gameplay | BLOCKED | Earlier ordinary input picked up actual 341 kg, then first loaded move entered NativeSimulationHold at tick 324; no depot/Former/full fresh 16 kg loop proof |
| W10 Save / Recovery | BLOCKED_NOT_RUN | Behind W09; no complete interrupted-process save/restart claim |
| W11 UI | PARTIAL / unchanged this window | Existing English UI evidence; no new acceptance from pure-domain work |
| W11 Visual | OWNER_REVIEW_PENDING | Wreck V2 remains the actual Blender art candidate; no native-admission/visual acceptance invented |
| W11 Performance | FAIL | Both original paid-band gates fail; candidate removed |

Earlier native material stayed `2,643,400,000 mg cargo + 341,000,000 mg carrier = 2,984,400,000 mg`; the current window did not alter that scene or solve its hold. Owner terrain/art acceptance remains OWNER_REVIEW_PENDING. W12–W29 were not started.

## Evidence access and reproducibility

The manifest binds exact local payload bytes and sizes. Readable `.log` projections trim terminal blank lines only; `.log.raw.gz` archives preserve all original stdout/stderr bytes. raw-log-archives.json binds decoded sizes and SHA-256. The repository ignores `*.log`, so only these authorized run logs were explicitly added. Gzip archives are actual payloads, not LFS pointers in the working files; their decoded SHA is in restored-byte-comparison.json. The original trial command was:

```bash
npm run test -- tests/unit/factory/dryFactorySlice.test.ts -t 'W09 paid-band'
```

It has already been executed once for this window; this document does not grant a repeat. The current retained business check is:

```bash
npm run test -- tests/unit/factory/production.test.ts tests/unit/factory/conveyor.test.ts tests/unit/factory/dryFactorySlice.test.ts -t 'owned-data'
```

Earlier normal baseline build already passed today; no new production build is claimed here. Cloud/executor skill catalogs returned empty in this turn; existing toolchain, dependencies and permissions were preserved. No external application write or messaging occurred.
