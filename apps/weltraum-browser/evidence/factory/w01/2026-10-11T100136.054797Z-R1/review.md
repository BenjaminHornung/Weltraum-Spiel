# W01 R1 self-review — narrow independent re-review pending

The first independent review identified one source contract mismatch: accepted FP02 B06 cassette name is CASS-OFFCUT, while the candidate used OFFCUT. Corrected only B06:OFFCUT → B06:CASS-OFFCUT; the explicit save-safe runtime alias fp02_b06_offcut stays stable. Added a literal source-port and source/runtime-map oracle, including rejection of the old invented source ID in the mapped profile.

Actual RED before the catalog correction: 1 failed / 11 passed W01 tests. The literal source CASS-OFFCUT port was missing; failure is an assertion against real loaded data, not an import failure. After the single source ID correction: 12 W01 plus 34 existing Resources regression tests PASS (46 total, four files), exit0. TypeScript/Vite build PASS, exit0; baseline large-bundle warning unchanged. Staged diffcheck PASS. Plain logs trim trailing whitespace only; matching raw.gz retains original stdout/stderr bytes.

Regenerated actual runtime catalog oracles, complete canonical data, and cargo snapshot via middleware-only Vite SSR with HMR/watch disabled. New unique R1 run leaves all original run files unchanged. The catalog/cutter signatures change because normative source bytes change. Cargo/recipes/quantities/BOM and all other physical/source/authority boundaries remain exactly as independently reviewed before. Original independent FAIL review copied unchanged for provenance. No unrelated product writes or downstream implementation.

This self-review does not issue the independent package gate. Product WRITE HOLD resumes after committing this R1 correction pending root re-review.

Evidence recovery: the first whitespace check captured a raw diff context-space warning into its own staged log, leaving an evidence-only whitespace issue in commit14ebfb44194d36ae23663fedf6a66a384a40800f. This failure is preserved as diff-check-failure.txt and raw.gz. The follow-up changes only new R1 evidence, clears the pass-output log before staging, recomputes artifact hashes and verifies the complete staged diff against b8edd17bfdeb2bc724afc76c148d8aeacacde7b1. No additional product change.
