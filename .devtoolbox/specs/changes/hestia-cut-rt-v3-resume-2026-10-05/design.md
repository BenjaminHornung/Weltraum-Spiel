# Design: execute the retained-owner plan

Reuse the existing one-owner/retained-plan, child projection, bounded kernels/ledger, mesh-only worker, native Stage, geometry admission and atomic publish/rollback/finalize seams. Do not add a second plan/owner, generic orchestration framework or renderer subsystem.

The ordered technical design and exact permitted seams are already specified in the recovered `01_RESTPLAN.md`, `02_ABNAHME_UND_SCOPE.md`, original B1 integration plan and living `EXECPLAN.md`. Record an exact write set/preimage for each implementation slice. Reviews bind immutable commits or sealed preimage/postimage packets; the parent is the only shared product writer.

Privacy is repaired at the existing reporter/collector boundary with explicit CDP metadata projection and synthetic canaries. Historical private originals remain protected; only safe additive evidence is published. Keep whole-path timing and real allocation/native coexistence proof separate from source correctness.
