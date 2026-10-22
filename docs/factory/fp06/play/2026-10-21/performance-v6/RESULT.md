# V6 performance window result — 21 October 2026

**Diagnosis complete; optimization target NOT MET. No product or test change was accepted or made.** Root ends this window before its fixed15:07:20UTC stop. Historical windows stay closed. No claim of higher FPS, improved latency or completed optimization follows.

## Measured result

Current candidate HEAD `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`, branch `feature/hestia-fp06-review-continuation-2026-10-15`. Dirty newer work preserved. Actual served build remains clean-copy Ready21-v4 `factory-D3ew0Sm8.js`.

| Same Chrome155 /1249×1221 /DPR1 /hardware RX7900XTX | Native RAF meanFPS | RAF p95 |
|---|---:|---:|
| Blank page5s |30.555|33.1ms|
| Saved V6 Paused30s |30.661|33.1ms|
| Saved V6 Playing30s, measurements enabled |30.610|33.1ms|
| Saved V6 Playing30s, measurements disabled |30.579|33.1ms|

No SimulationHold or other game stop was reproduced in these standing samples. No mouse movement, player/view change, observer drops or pageerrors occurred. A heavy game render workload does not explain the entire30.6FPS ceiling, because the blank page and paused control share it. Exact physical/remote display cause remains unverified. ANGLE/D3D11 reports hardware acceleration; software fallback was not found.

Playing pre-render main CPU p95 is42.2ms, versus frozen target<=32ms. This metric ends before backend.renderFrame, and cannot establish GPU cost or end-to-end input latency. Inclusive Factory domain work8.609s/30s and publication listener work13.041s/30s overlap; they are never added. Native solver p95 is0.2ms.

The single separate MAIN profile10.111s uses12 exact Ready21-v4 source maps. Inclusive Factory observe41%, advanceDomain27.5%, belt10.1%, production8.3%; canonical serialization has10% self at resources/serialization.ts104 plus3.8% at56 and3.8% at124. Nested profile paths also overlap. These identify repeated canonical proof/serialization as material CPU cost, rather than demonstrating GPU, map or collider cost. Profiled FPS is not a comparison result.

## Decisions and incomplete fix

Existing two read-only reviewers and authorized Pi/DeepSeek reviewed bounded plans. Pi's claim that Shell publication falls outside mainFrameCpuMs was rejected against current source; only backend rendering is excluded.

General whole-tree native JSON serialization was rejected BEFORE implementation: observable prototype/getter/global serialization behavior can change canonical output. Public byte/security contracts were not weakened.

A private exact-identity Power-string memo received conditional native plan approval, but admission fit inside the EXISTING2MiB total fragment cap was not proved. The saved Power JSON alone is537795 UTF16 characters (1075590B); compact saved-material length is not the runtime fragment length. Host-private checkpoint accounting cannot be inferred from an absent DOM field. No writer lease was issued for an unmeasured/inert cache. Potential two-prefix thrash is a hypothesis, not a finding.

A smaller private production Core-string reuse was examined but not implemented: it affects only part of8.3% inclusive production cost, and had no demonstrated prospect of reaching the frozen target.

Actual product candidates0/3; MAIN profile1/1; Worker profile0/1. No further attempts are silently authorized in this closed window. Root did not renew a deadline or substitute benchmark/unit durations for FPS. The next technical prerequisite is a bounded, read-only measurement of actual runtime material fragment/prefix sizes and repeated Power identity before deciding whether an existing-cap cache can be useful. That measurement and a validated optimization remain outstanding.

## Preservation and final user state

Final692 manifest-covered source/test/config entries match immutable Ready21-v4 exactly. No unit/TSC/build rerun was needed for product code because no product or tests changed; comparison build and after-optimization measurement are NOT RUN.

Actual original Chrome was closed and disconnected, then relaunched against the SAME original persistent profile and origin. Ordinary combined checkpoint loading returned Paused Native48547/Factory8091,10owners,2984400000mg, same actor position/sourceDigest360b00fa/V6 profile, no TestBridge. Save19 remains13199495B/SHA256 `a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0`. No Save button, IndexedDB write or profile copy was used. Final browser has no profiling init script or hvpMeasure query.

Stored formats, caps, Clock, public contracts, colliders, margins, old Goldens and dependencies remain unchanged. No new internal product representation was introduced. Normal moving/looking performance and active-production FPS were NOT RUN in this window; prior functional16kg/WIP/cold-restart acceptance remains a separate historical PASS.

Evidence directory: `apps/weltraum-browser/evidence/factory/play/2026-10-21/performance-v6/`. Raw baseline samples/profile and all rejected plans remain preserved. Final browser is paused and ready for explicit Play; original immutable delivery was not resealed or overwritten.

