# RD13 owning P2 repair: CPU handoff

**Result:** both confirmed owning defects repaired; **39/39 CPU tests PASS**,
focused/root types and real optimized entry build PASS. `productIntegrated=false`.
Native/browser/art/performance and root integration are **NOT RUN**.

## Parent and preservation

The local repair's sole direct parent is original candidate
`36ba3cf37640c4eac7ab8f6e4143150fa922c2b3`, tree
`ca22267fb95cd1dac48a18426d0f0d414f01c0a5`. HEAD's accepted root remains
`d17d970403440ccbf02d378998f69a92c87d8f09`; no root/shared/product change.
HEAD's independently verified original-candidate proof is read-only, SHA256
`dcbf1e9fb800340a7ff744bb553a18a477d32e6667e5ef6355c072a65a881f4b`.
No rewrite/amend/reset of the original candidate or relabeling of its evidence.

Only `src/experiments/voxel-rays/ray.ts` and `index.ts` are modified existing
files. Supplementary additions are `tests/RD-13/production-cpu.ts`,
`tests/RD-13/repair-36ba3cf3.test.ts` and this separately versioned report/config
directory. Original 23 CPU tests, 12 native inputs, all six native gate bodies,
the independent analytical geometric oracle, other 16 original candidate files,
986 frozen baseline files, 18 shared pins and 429 public files remain byte-identical.
Original materials, IDs, selection, fixtures and thresholds are not rewritten.

## Owning fixes

1. **Visible hit selection:** the shared production DDA accepts a visible-selector
   flag. A front-only back exit is rejected inside the same bounded traversal,
   which continues to a later real front entry. Unknown accumulation, current
   interval/world-metre parameter, tied crossings and total 193-step bound are
   retained; no epsilon/restart/budget reset. Double-sided exits still select.
   The old two-argument geometric call explicitly selects geometric first-exit
   semantics. The visible fragment invokes the shared visible selector instead
   of discarding the whole volume after a geometric back hit.
2. **Adopted facts cache:** successful replacement validates new base facts
   against the replacement digest/revision and caches them before unlocking
   pending. R0→R1 success followed by a terminal R1 error without an intervening
   facts read now retains readable R1 facts through the real outer mount.
   Failed/invalid replacement retains the previous valid snapshot and first
   terminal cause; root retirement, canvas hiding and disposal are unchanged.

Hard-coded witness `[1,0,1]`, origin `[.5,.5,.5]`, unit +X: geometric exit stays
`t=.5`, normal +X; front-only visible selection is the later `t=1.5`, normal −X.
Supplementary cases cover double-sided/last-cell-material exits, miss, Unknown,
negative/exact-boundary/tied/thin-scaled rays, one total budget, all 12 unchanged
geometric cases and real wrapper/outer-mount success/failure/invalid adoption.
A deliberate test-local discard fault fails the owner witness.

## Evidence and limits

Fresh external run (all evidence/helpers/outputs are C-only and write-once):
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/repair-36ba3cf3-20261004-a/`.

The supplementary CPU adapter extracts and executes the actual production
GLSL scalar/control-flow body with explicit known vector/value-copy and integer
sampling translations. Expected results are hard-coded witnesses or the unchanged
independent interval oracle. This is **NOT a GLSL compiler, native precision,
GPU/driver or image proof**. The original numeric native helper still follows
the geometric path; it does not establish visible-selector native correctness.
Both repaired paths require later explicit native qualification authorization.

Final pre-repair seal `red/qualified-seal.json` SHA256:
`7b69361f20584ef55f72c69249aa19aa7f1da80cd6647887e4d542c1e255e04a`.
Exact RED/GREEN supplementary bytes:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `tests/RD-13/repair-36ba3cf3.test.ts` | 11467 | `528dcdc7acb4f322883147c55e1aaac1bc433e83368e1f598e970e6577f918de` |
| `tests/RD-13/production-cpu.ts` | 4724 | `f53b76902da561c07a7804006c146241cfde6ee5eb0995bcb6b39f9a6a55a889` |

| Receipt label | Result | Actual process wall clock |
| --- | --- | ---: |
| `focused-red-qualified-actual36` | Expected RED: 16 total, 11 meaningful failures, five controls passing; actual unchanged parent runtime | 941.4576 ms |
| `full-cpu-green` | PASS: original 23 + new 16 = 39/39 | 4483.7734 ms |
| `focused-types-final` | PASS | 184.7383 ms |
| `root-types-final` | PASS | 1214.3089 ms |
| `entry-build-final` | PASS: actual HTML entry, 26 modules, 433 outputs including original 429 public files | 932.7307 ms (Vite: 531 ms) |

Wall clocks include process overhead and are not benchmarks or speedup claims.
Main chunk 599.59 kB (estimated gzip 156.61 kB); unchanged 500 kB warning retained.
GPU timing/native VRAM remain UNKNOWN, not zero. Root build is NOT RUN; the
unchanged root registration/Vite entry list does NOT BUNDLE RD13.

GREEN raw stdout SHA256:
`479546eca81636436780ae4b63307151d3a626b109ffa090e7bc4aa1e31ce770`.
Entry-build raw stdout SHA256:
`52838dc5a7f0755df53804601252acdb3817a16ce6025b50738691a840195459`.
Pre-build source binding `source-before-build.json` SHA256:
`7e55ae2b7bd8430afdfdda4ec292849a51912e752d7418e3c3d4cebb78851d21`.
Earlier RED seals/logs retain the new harness scalar-floor/signed-zero errors;
all corrections/reseals preceded runtime edits. No original test was changed.

## Commit, scope, review and cleanup

Inspect external `postcommit-audit.json` for the actual repair full SHA/tree,
sole parent, exact delta, preserved-source/test/build/dependency/helper hashes
and accepted-root d17 proof. `commands/scope-postcommit.*` records the fresh
52-pin guard, zero violations/links and only the accepted automatic-log exception
`FAIL_ACCEPTED_NARROW_EXCEPTION`. Logs are not manually read/copied/edited/deleted
or committed. External descriptors avoid a self-referential commit hash.

Review performed here: own runtime/test/final diff review. HEAD's independent
repair review and fresh acceptance remain separate; neither is claimed done.
No delegation, installation/package edits, server/browser/port/native job,
publication, deletion or global configuration change. CPU subprocesses exit;
ownership mocks dispose and restore registered mount counts. Original/new
evidence, installed dependencies, caches and checkout are retained safely.

Stop after the genuine local committed CPU repair and postchecks. HEAD owns
independent acceptance, actual root integration/wiring, a new freeze and any
later native lease. No programme/core-card/art/performance/product acceptance.
