# Composition cost result — existing single diagnostic run

Current candidate/Node24.19.0/Ryzen7950X3D; original W09 paid-band pair, same original 5-second test limits. The instrumented run is not directly comparable to uninstrumented wall time. Its one profile-requested attempt emitted no V8 dump; no second composition profile was taken. Source: domain-cost-baseline-2026-10-17-r01.json, opt-in dryFactoryCosts.diagnostic.test.ts. Inclusive parent/child rows overlap and must not be summed.

| Measured part | Custody/blackout case (24 steps) | Output-blockage case (57 steps) |
| --- | ---: | ---: |
| Test wall | 1958.18 ms | 4063.12 ms |
| Wrapped explicit validation, exclusive | 43.01 ms | 62.26 ms |
| Canonical serialization + signatures + hash, exclusive | 1128.85 ms | 2203.58 ms |
| Dry prepare residual, exclusive of wrapped callees | 625.00 ms | 1528.63 ms |
| Full Dry commit path, inclusive | 53.03 ms | 135.50 ms |
| Dry commit residual, exclusive of wrapped callees | 32.61 ms | 80.13 ms |
| Wall outside wrapped roots | 10.75 ms | 8.89 ms |

The residuals contain both internal validation and transformation/cloning: ESM intra-module calls are not intercepted by import mocks. Explicit validation is therefore a lower bound, not the complete validation cost. A pure transformation total is NOT MEASURED. Commit residual includes its internal recomputation checks; full commit includes nested serialization/validation already present above. Outside-root wall includes setup/allocation/assertions; exact Vitest matcher time is NOT MEASURED. Final state bindings reach about 4.78 million UTF-16 units; transient internal canonical strings are NOT MEASURED.

Prepare p50 46.69/49.13 ms, p95 56.52/67.55 ms, max 284.16/277.95 ms. Commit p50 2.18/2.34 ms; supply p50 3.45/3.49 ms. Serial canonicalJson alone was 703/1410 ms, canonicalSignature exclusive 331/583 ms, hashing 92/207 ms. These measured boundaries establish serialization as a substantial cost; they do not justify deleting public validation or receipt history.

C01 private serialization-only no-freeze capture was rejected/reverted after approximately 1% observed difference; historical patch remains. C02 records the already computed canonical state bytes for its privately owned immutable next state, excluding lastStep exactly as the current public encoding does. External data still follows complete validation/serialization, with unchanged bytes, replay and tamper rejection. No public representation or Clock policy changes. Fresh original pair after C02: 5.91 s tests / 6.36 s total versus 6.14 / 6.77 before (about 3.7% lower test time in this single observed comparison). No statistical/FPS/100-ms-tick guarantee follows. Two of three composition candidates used; no extra profile or speculative third patch is planned.

## Independent final reading of the same sealed run, 17 October

No new run/profile. The disjoint categories above omit other wrapped exports:117.95ms for24steps and179.63ms for57steps. Including those mixed exports, explicit validation43.01/62.26, canonical/signature/hash1128.85/2203.58, mixed prepare625.00/1528.63, mixed commit32.61/80.13 and outside10.75/8.89 accounts for the1958.18/4063.12 test wall (rounding applies). Full inclusive commit53.03/135.50 must not be added again. Even canonicalJson includes its internal checking/cloning; its Export time is not pure encoding time. Pure internal transformation, all validation and pure matcher time remain NOT MEASURED.

The older14October V8 attribution manifest belongs to commit a89c199 and is historical; its5800.926ms serializer and5686.615ms structuredClone self-samples cannot be substituted for the17October baseline. No V8 dump exists for the latter.

Subsequent actual cache ownership diagnosis justified the final composition candidate C03 / MemoryR02: retain canonical memo entries only up to1MiBUTF16, avoid charging a second private state-byte alias only when exact assignment ownership proves it, keep full public bytes/validation. CompleteDry44/44 passes. Original pair before6.23s tests/6.65s total, after6.73/7.15, one observation of about0.50s extra CPU test time in exchange for less retained optional text. Thus composition candidates3of3 are used. MemoryR03 only corrects the separately proven expired Native transaction reservation; it is not a fourth serializer candidate. The new lossless stored-representation proposal requires its own explicit schema decision and preserves these historical results.
