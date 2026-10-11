# W09 closed UI supplemental CI compatibility delta

Read-only addition to preflight2168eca3; no product/historical/evidence edits, tests/build/browser/verifier or package execution. **CI: NOT_RUN.** A W04/W08-only adapter is insufficient.

Actual independently read candidates:

- Integrator `apps/weltraum-browser/evidence/factory/w09/ui-20261011T202036Z/manifest.json`: **`0eba3c96623bc19cc336167e8f830c4b3e1fdb2d4c70b1831fe23d42087ad58f`**,20560B. Copied UI worktree manifest has identical bytes. Root-bound four-panels supplemental;37 files/185886B,36 bound references, five historical product receipts. Literal captured fields remain `status:IN_REVIEW`, `browser:NOT_RUN`, `packageGate:NOT_RUN`; those are not rewritten into package completion.
- UI worktree `apps/weltraum-browser/evidence/factory/w09/ui-cargo-20261011T214209Z/manifest.json`: **`ab822f4e21614eacd4cfd8492ef28d02f174028e0f4c1f35414c35fcf5138ef3`**,3697B;13 files/27109B,12 bound references. **Precommit/HOLD, independentReview:PENDING, commitSha:null, browser:NOT_RUN.** This remains a candidate for later admission, not an already accepted commit.

All48 actual artifact SHA/length pairs and both end-read manifest hashes match. Each supplemental is well below unchanged per-run caps.

Three exact current checker failures:

1. Four-panels schema `hestia.fp06.w09-ui-evidence/v1` already satisfies `tools/factory/verify-evidence.mjs:48`. However its receipts are in **`artifactRefs`**(manifest34); checker52 reads only `artifacts`/`evidenceFiles` and therefore throws **“manifest has no bound artifacts”** at57.
2. Cargo schema **`hestia.fp06.w09.ui-cargo-evidence/v1`**(manifest2) contains the extra dot and is rejected at48–49. Its12 `artifacts` are otherwise standard receipts. Local product-seal.json is bound at SHA`2722578365bf46b11d6924dc549b66023d29f0757d3b53243a1d8a9885f05423`; it records two historical product changes.
3. Four-panels contains **`history-before-tech-focus-fix/manifest.json`**,14341B/SHA`15e257c3063ca24d3774e21258e1611c822529d6a7cae97ff62817fb2f3147b2`, explicitly hash-bound among its36 artifacts. Checker30 independently discovers it as a second active manifest. Its23 old artifactRefs include19 paths absent beneath that history directory; generic normalization of all UI manifests would incorrectly demand a fresh standalone bundle there.

Smallest closed extension to the existing future proposal: add exact supplemental roles keyed by **run path + admitted manifest digest**, separate from the two W04/W08 historical adapters. For accepted0eba only, normalize artifactRefs and five productSeal receipt forms in memory, bind actualCommandReceipts.receiptPath and rawLogArchive.path to that list, and validate all artifacts with existing path/hash/byte/symlink/cap rules. Treat **only the exact parent-bound15e257 history path/digest** as immutable historical data, not another active run; still parse/admit/hash its bytes. Do not broadly ignore nested manifests or historical directories.

After actual independent commit/source/evidence admission of Cargo, add its exact final digest/run role; accept only that one dotted schema, bind its local product seal and validate historical receipt forms. Any changed final digest requires a new admission receipt. Keep the generic schema regex unchanged; no arbitrary UI schema aliases or current-HEAD comparison of historical sources.

No additional future paths beyond checker, per-run workflow and meaningful evidenceAdmission.test.ts are needed. Add genuine RED cases for both exact supplemental shapes, the bound historical nested snapshot, tampered child/hash, unadmitted dotted schema and unsafe/missing artifacts. Per-run CI must discover direct package/run manifests, preserve these separate supplemental results, and leave W09 gameplay/package gate to the main supported `hestia.fp06.w09/v1` run. All implementation/proposed tests remain NOT_RUN.
