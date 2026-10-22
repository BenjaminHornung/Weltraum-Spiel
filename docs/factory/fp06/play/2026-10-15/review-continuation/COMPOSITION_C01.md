# Canonical JSON private capture v1

Composition cause candidate 1 of at most 3; decision 17 October 2026.
The unchanged pair currently passes in 6.14 s aggregate test time. Function
attribution measured 2,118.6 ms in cross-module canonicalJson over 81 steps.
Private captures currently use property descriptors and recursive freezing even
when canonicalJson immediately serializes and discards them.

Keep two-phase capture then serialization. A private freezeResult choice in the
existing recursive canonicalizer permits canonicalJson to use unfrozen newly
allocated arrays and null-prototype records with ordinary own data properties.
These private captures contain no caller-owned object references and are never
published. The exported canonicalizeJsonValue keeps its frozen clones and
non-writable properties. All finite/plain/dense/cycle checks, sorted property
reads, for-of iteration, error behavior and public bytes/signatures remain.
No state/material trust boundary changes, public V2 format, cache or Golden edit.

Direct streaming was rejected during plan review because encoding must still
follow all input getter/iterator evaluation. Interception of internal native
Object.freeze/defineProperty calls is not a public semantic contract; canonical
bytes and public immutable results are. Native plan review supports this bounded
alternative with compatibility tests; no performance gain is assumed in advance.

Writer scope: src/resources/serialization.ts and the existing canonical-bytes
test only. Parent owns integration, verification and acceptance. Verify current
canonical-byte/error/immutable-clone cases and meaningful two-phase cases, then
the SAME unprofiled original W09 pair. No new profiling run or timeout increase.
Retain failed-candidate results if there is no useful improvement or a regression.

The user explicitly authorized local Codex implementation after Pi's five-hour
provider limit; no further Pi execution is needed until that service is usable.

## Candidate result — rejected 17 October 2026

The exact implementation diff is preserved at
`apps/weltraum-browser/evidence/factory/play/2026-10-15/review-continuation/composition-c01-rejected.patch`.
The unchanged W09 pair measured 6.14 s aggregate test time / 6.77 s overall;
C01 measured 6.08 s / 6.57 s (2 PASS, 39 filtered SKIP). The aggregate test-time
change is about 1%, which is not a useful demonstrated performance gain. The
independent exact-diff review found no blockers. C01 is rejected as a
performance candidate (rejection 1 of 3), and its source/test changes were
reverted. No additional test or profile run was made for rejection handling.
