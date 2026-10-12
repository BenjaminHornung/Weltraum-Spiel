# PLAY-02 pure loader — request-capture P2 closure review

Reviewer: `/root/play_cell_bridge/independent_review`. Read-only review of the exact two-file correction, original business RED and fresh verification receipts. No test/typecheck/build/browser/Native/Blender/benchmark job, product edit or new agent was performed by the reviewer. This new report is the sole authorized reviewer output for this correction.

**Verdict: PASS for closure of Root's mutable-request P2 on the exact source/test fingerprints below. No open actionable finding was identified within this bounded correction.** The separate two-file fix commit/HOLD may proceed. Root immutable admission and all integrated runtime/S1/World/Owner decisions remain separate.

## Historical correction and scope

The earlier review missed the mutable request crossing asynchronous boundaries. Its report `independent-review.md`, SHA256 `45d4b64bbad0ac49082771c4338753f6e54b5a007b3ad9a774b0e199d86bcba7`, is unchanged historical evidence for source commit `5ea6978e54a049323e82185797b06bbee657b672` and the prior 62-test results. Those earlier results did not establish request immutability. No Root admission was issued for that original loader. This new review supersedes its request-binding assessment; it does not rewrite the original report or receipts.

Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-play-loader-2026-10-12`, observed HEAD `5ea6978e54a049323e82185797b06bbee657b672`. Root's follow-up authorization retains exactly the original two product paths. The final diff contains 52 insertions/10 deletions across only `apps/weltraum-browser/src/factory/presentation/playAssetLoader.ts` and `apps/weltraum-browser/tests/unit/factory/playAssetLoader.test.ts`. Status shows only those two modified paths; diff whitespace check is clean. No API/schema, parser, checksum, asset, dependency, global budget, Host, Native, controller, World or Save source changed.

## Finding and closure

| Severity / status | Location | Concrete behavior and reviewed correction |
| --- | --- | --- |
| P2 — CLOSED | playAssetLoader.ts:113–131,214 | The original loader read caller DTO properties after `await`, permitting Cutter→Former identity/deep-binding retargeting, instance-key changes, fetch-function replacement and substitution of the original AbortSignal. The fixed invocation destructures assetId/instanceId/signal/fetch and captures the global-fetch fallback at lines 116–117, serializes the complete expected binding at line 119, and reaches its first await only at line 121. Asset selection, binding comparison, fetch options, response-reader cancellation and post-hash abort checks use those captured values. MeshArtifact keys use the captured instanceId at line 214. No caller DTO property is read after the first await. |

The expected binding is captured as an immutable canonical JSON string, so mutation of nested definition/visual-anchor records cannot change this invocation's admission. The original signal object is retained, preserving its live abort state rather than replacing it with a copied boolean or the caller's later signal property. This is a small request-lifetime correction; it adds no new public override or authority.

## Test review

`playAssetLoader.test.ts:183–214` adds four focused business cases without changing the preceding 46 loader cases:

- Calling for Cutter, then synchronously changing assetId and the nested definitionRef to Former, must still return the original Cutter binding.
- Changing instanceId while the original fetch is pending must retain all original instance-specific keys.
- Replacing the caller's signal while fetch is pending and aborting the original signal must still reject with AbortError; the replacement signal remains un-aborted.
- Replacing the caller's fetch function immediately after invocation must not divert the original call to the replacement 404 response.

Deferred promises control the two pending-fetch boundaries. All four cases use real reviewed GLB bytes and the real SHA gate; no edited-GLB integrity stub is used in these tests. The four cases fail as genuine assertions on the original production bytes and pass with the same final test bytes against the corrected production code.

## Fresh receipts inspected, not rerun

Final source/input capture: `2026-10-12T10:26:56.308476+00:00`. All 29 current inputs in final runs 10 and 11 were SHA256-recomputed and matched, including source/test, sealed manifest, helpers and all 23 actual runtime GLBs. Both raw-log hashes matched. In run 09 only the production source intentionally differs from the current fixed source; its recorded original `c349e363…` hash matches the actual HEAD blob. Final tests are byte-identical to run 09's new test input.

| Receipt | Actual command outcome | UTC interval | Raw log SHA256 |
| --- | --- | --- | --- |
| 09-request-capture-business-red | Targeted four cases on original production: 4 assertion failures / 46 skipped; exit 1. No import/setup failure. | 10:24:13.241565–10:24:14.418746 | `3eed78a227d2b491b0c780cde2538492df634581439aea483a4e1152d0a4e9d5` |
| 10-request-capture-focused-green | 66/66 tests passed in two files: 50 loader cases, including four new cases and the 23 actual-payload positives, plus 16 existing presentation cases; exit 0. | 10:26:33.186970–10:26:34.926295 | `439bdbcd2aec2011de59097c14ccce1fb44bc4fb00d3909c0026085a4985e4a0` |
| 11-request-capture-original-typecheck | Unchanged project typecheck; exit 0. Empty stdout is corroborated by the actual child-exit receipt. | 10:26:34.926489–10:26:37.719363 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Run 10 argv: `bash -lc 'source /workspace/.cloud-setup/activate.sh && npm run test -- tests/unit/factory/playAssetLoader.test.ts tests/unit/factory/presentation.test.ts'`. Run 11 uses the same activation with `npx tsc -p tsconfig.json --noEmit`. Both cwd: `/workspace/Weltraum-Spiel/.worktrees/fp06-play-loader-2026-10-12/apps/weltraum-browser`. Exact argv/cwd/UTC/exit/input SHA256 fields remain in the sibling command receipts.

## Final fingerprints

| Repository-relative path | Final bytes | Final SHA256 |
| --- | ---: | --- |
| apps/weltraum-browser/src/factory/presentation/playAssetLoader.ts | 18,666 | `7db5db2357f58e6b7b5785f886939235b70af932134010ca0dc0ff96e6ec75b3` |
| apps/weltraum-browser/tests/unit/factory/playAssetLoader.test.ts | 14,718 | `4676e909f7f66d401f6d85924851732c589ccc6a932723b17f811a285b6fb138` |
| apps/weltraum-browser/public/factory/play-2026-10-12/manifest.json | 83,735 | `f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1` |

Original HEAD loader SHA256: `c349e363b0eeed9e0cf14a889f8a102574ecae192024cce46230497dd8b66a3e`; original HEAD test SHA256: `aa77dff76110e69abee244658ba60edf150e992f0a50fc21e439232f77ba55e9`. The older review SHA256 remains `45d4b64bbad0ac49082771c4338753f6e54b5a007b3ad9a774b0e199d86bcba7`.

## Acceptance limit

This closes only the concrete mutable-request defect in the pure loader and confirms the final focused regression/typecheck receipts at the exact correction bytes. It does not claim broad fuzzing, full runtime loading, Native presence/work joining, Host resource admission, controller/GLB stage/publish/disposal acceptance, normal-game S1, complete restore, World or human/Owner PASS. The separate fix commit must remain HOLD until Root's exact immutable admission.
