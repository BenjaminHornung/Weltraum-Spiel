# Admission runName R02: source correction ready for independent review

Disposition: SOURCE_READY_FOR_INDEPENDENT_REVIEW. Actual current admission remains HOLD; runtimeGrant NONE_HOLD. This is a pure data checker correction, not an execution capability.

The existing output-custody condition now requires `text(slot?.runName)` before accepting matching run names. Missing names on both fields and numeric 7 on both fields are refused with OUTPUT_CUSTODY. No normalization, new dependency or launch API was added. CHANGE.patch records the entire code/test difference; all original 61 tests are retained and two regressions added. R01 and the reused old pure boundary/unconditional runtime veto remain unchanged.

## Executed evidence

- RED: unchanged copied R01 checker plus both new regressions, Exit 1, 61 PASS / 2 FAIL. Both failures are actual HOLD-vs-ROOT_REVIEW_READY assertion failures, not setup or syntax failures. Testhost operation 719 ms; observed command 4.0803144 seconds.
- GREEN: minimal checker correction and identical test bytes, Exit 0, 63 PASS / 0 FAIL. Testhost operation 750 ms; observed command 4.1066941 seconds.
- Each phase exercised all 1250 ordered role pins, all 24 canonical cases and 144 identity mutations. These are data mutations, not Native24 case executions.
- Both owned PinNode22 hosts signaled termination, closed their actual handles, completed stdout/stderr, and required no timeout, kill or retry. Both entire observed submissions were below the 30-second per-host limit. Private removal of the same nine environment names is recorded without exposing values.
- Snapshots/red preserves exact failing source and tests. Phase COMMAND/RESULT/STDOUT/STDERR and HOST_TOOL_RECEIPTS retain commands, source hashes, raw results, timing and actual owned-handle proof. CURRENT_DISPOSITION.json preserves the real unissued-binding HOLD, including clock origin and containment.

## Preservation and bindings

The copied PRESERVATION_BEFORE.json is byte-identical to R01's original 4007-file baseline, SHA256 `6e32d7f58314b006e67117bd23decac8e1286cd4b0aae307046f3076bee0e740`; no current values replaced original expectations. Before and after checks verified all 4007 protected files, all 1250 ordered role rows including seven duplicates, all 24 R01 physical files, and 2064 R11 historical presence/byte states (1351 present, 713 absent). PRESERVATION_AFTER.json records the completed checks. The immutable R01 final manifest remains `5347b41cf5f07af26a616fcc658e9ea073ba5ae174f00e36fad997f5151f1b56`.

Corrected checker SHA256: `dcd652f1851ee3d180672613c94f3d03aa62f1d86f2dcb13ec359c3f66047f77`.

Complete tests SHA256: `3de539f513f5f871568b8ce107dcf45544a131b5b283cebab9c2ef8809978b0e`.

BOUND_INPUTS remains `c6a0bd2aa34cc55091bfe37878d084ca2551fd1587abec20dedc1bd4e91eea34`. Source and tests did not change after GREEN. Final source/test/full manifests use ordinal slash-normalized relative paths, byte counts and SHA256; the full manifest excludes only itself.

## Authority, timing and limits

Same actual Native owner `01a13648-c55b-7250-bf07-34921d70b43b`; current environment Paseo/workspace bindings remain UNKNOWN. Direct human approval for admission checker and pure data tests was independently read in the Root chat at user message `01a149c6-0297-7032-b82f-87bbdc0ef9c8`, answering question `call_318d9551347b4c27b8a36116c1ffe277`. The correction task is NATIVE24_ADMISSION_RUNNAME_FIX_TASK-20261017.md, expected SHA256 `77d30297e571d476c3baa608363770b898e81fac02e75c06b9c32c827f06c8c7`.

The original task start remains 2026-10-17T12:49:47Z, with a 600000 ms budget including report/manifests. It was not reset after compaction or the mistaken read-only response. Final full-manifest taskTiming records elapsed time from this original start after the report and source/test manifests have been written.

Procedure deviation: post-compaction read-only inspection used embedded execution outside CIFI before the correction was resumed. No complete-session CIFI-only PASS is claimed. All correction file operations and RED/GREEN submissions used explicitly nested CIFI PowerShell; the only approved data-test executable was qualified PinNode22. No secret environment values were dumped or global environment changed.

Native24, physics, GPU, family fixtures, compiler, framework, Save and app build: NOT_RUN in this correction. No agents, installation, network operation, Git command, publish, service, driver, database or configuration mutation. Independent re-review and Root acceptance remain open. STOP idle; no automatic continuation.
