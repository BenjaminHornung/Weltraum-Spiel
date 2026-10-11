# W10/W11 CI evidence compatibility — source-only preflight

Reviewer `/root/w00_repo_audit`; actual integrator HEAD `7b23d072670ecfd4b0b5f1c3f037539f24e5b07e`. Read-only source/data/hash inspection; no tests/build/browser/verifier/CI execution or edits. **Actual CI run: NOT_RUN.** This finding does not hold W09 implementation.

Two concrete current CI failures need a narrow future correction:

1. `.github/workflows/browser-mainline-ci.yml:295–298` invokes the W06 checker on the complete `evidence/factory` tree. `tools/factory/verify-evidence.mjs:22–24` accumulates all bytes under that invocation and rejects beyond256MiB. The ten existing manifest runs alone contain **1912 files/316674693B**; current tree including unsealed W09 evidence has1924 files/316689304B. W07 itself remains1202 files/222854181B, within its own cap. Therefore the current aggregate invocation necessarily rejects; this is source/data proof, not a claimed executed RED.
2. Checker`:48–49` accepts only `hestia.fp06.<name>/v1`. Accepted W04/W08 use literal `fp06-package-evidence-v1` (`manifest.json:2`) and fail even individually. A schema-only allowance would then reject both at`:73–75`: `productFiles` is a three-entry historical path→SHA map (`manifest.json:13`), not an array.

| Immutable accepted run | Manifest SHA256 | Bound artifacts | Own files/bytes |
|---|---|---:|---:|
| `w04/run-20261011T124704Z` | `7654cb46edef96a71211555c7b6d71a530664634a6e5d150d31ede42b5dbe621` |40|41/2558658|
| `w08/run-20261011T115409Z` | `9e99dbeb65f10ddd9e2c5f22e62d81d5ee77f39133543803d393a7993bcdcdab` |37|38/147268|

All77 actual artifact SHA/size pairs were independently checked; no mismatches. Historical source maps have safe relative paths/64-hex hashes. The other eight manifest runs already use supported schemas. New W09 should use **`hestia.fp06.w09/v1`**, supported without any schema expansion.

Smallest closed proposal, requiring Root's later exact scope and genuine negative tests:

- Change only the workflow's evidence step to enumerate bounded, nonsymlink package/run directories and call the existing checker separately on each complete run, with fresh counters. Reject nonempty/incomplete or foreign-shaped runs; retain4096entry/file,12depth,32MiB/file,8MiB/JSON and256MiB **per-run** limits. Report each run separately; never claim the historical aggregate passed256MiB. No timeout/global/game/Worker cap changes.
- In `tools/factory/verify-evidence.mjs`, admit **only the two exact immutable manifest hashes/run identities above** through a closed compatibility adapter. Retain the existing generic schema rule unchanged. Normalize their historical three-entry maps only for current receipt-form validation; never compare them with today's HEAD. Keep original artifact/path/symlink/hash/byte/duplicate checks. Also bind W04's listed receipt/log paths and W08's receipt-map keys to the existing artifact list. All other legacy-schema bytes remain rejected. Do not rewrite accepted manifests.
- Exact future integration paths: checker and workflow above; new `apps/weltraum-browser/tests/unit/factory/evidenceAdmission.test.ts` for meaningful subprocess/cap/admission cases; `apps/weltraum-browser/package.json` only for explicit upcoming spec registration. Suggested true REDs: existing immutable W04/W08 own-run rejection; two individually admitted synthetic runs whose combined bytes exceed256MiB; tampered historical hash, missing artifact/unsafe path and individually over-budget run still reject after correction.

Current grouping is source-consistent: **43 discovered/listed specs,26 core/13 live/4 UI; zero missing/stale/duplicates**. Workflow`:188–205,244–252` requires literal spec tokens exactly once; keep that parser. Register actual `factory-dry-flow.spec.ts`(W09), `factory-save.spec.ts`(W10) and `factory-acceptance.spec.ts`(W11) once in the appropriate existing script as each file is introduced. No workflow-group redesign is needed. All proposed tests/CI execution and compatibility implementation remain NOT_RUN.
