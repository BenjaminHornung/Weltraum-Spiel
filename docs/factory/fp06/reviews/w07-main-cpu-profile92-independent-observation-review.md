# W07 diagnostic92: independent Main V8 observations

**Retained data/attribution binding MATCH; diagnostic only, no normal/package/performance gate.** Actual 3 diagnostic cases PASS, exit 0, wrapper 41.930041123 s, ended `2026-10-11T18:40:28.531075+00:00`. No new execution, profiling, source/product/evidence edits; this external report is the only write.

Own run: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`; archive `browser-main-cpu-profile-diagnostic-92/`.

Actual raw-gzip SHA `3e201fae4bf6e5551cab669ea90f0f4e75320cbdf17697f6dff0530b0c5a5a00` decompresses to 1,169 bytes / SHA `c6ca04133f11ed7d2ebc3d7ea8e0fcfa368500509c39796d30aa7cf8dc50cff1`, matching command and exit. All 7 actual artifact payload hashes/sizes match receipt `4db6b86f2da6f2071611737d050422fc700c29f426fa9dca640a2237fae6251e`, total 966,610 bytes. All 7 additional evidence-seal references also match.

Actual profile: 93,231 bytes / SHA `42a5d758572a7bf1fd420b4ac8f2e2d01ae21f0c343dafa595cd456c5679abbb`; metadata: 19,333 bytes / SHA `a9dee4080770e1b1901e2509705b8bd24b11e59eec4457ab1e9cdb385eece3e1`. Independent reconstruction confirms 220 nodes, 6,752 samples and 6,752 timeDeltas, zero negative deltas; V8 duration 8.980424 s, weighted delta sum 8.978045 s.

Every reported self/inclusive weight in attribution JSON SHA `940d981a7ceea9d69fcb869a2e1c815c669b1ee3d67c528362f0ba57bedba2ba` reproduces exactly, weighting leaves/unique frame ancestors. **(program)=8,320,192µs /92.672647553%** of weighted sampling time, with no JavaScript source frame. This is unattributed sample time, not a concrete Native/GPU culprit or whole-machine CPU utilization.

Attributed inclusive samples: renderFrame 494.944 ms; publishCurrentSet/updateProjection 396.758 ms; applyProjection 345.598 ms; canonicalSignature 343.919 ms. Self: encode 111.567 ms; writeLength 103.094 ms; writeCanonical 73.458 ms; writeString 32.979 ms. Inclusive rows overlap and cannot be summed as exclusive cost. Visible serialization/render paths are observed, but this capture cannot prove they caused dominant longtasks. Reviewed prose report SHA `d334810a15ed7e0e82c91a120694ca91e356d351c12ac74e6137a5a6c08cc5e4` states these limits correctly.

Independent pulse subtraction confirms trusted 125 ms S event-stamp gap 126.3 ms, Main handler gap 0.7 ms, Main FactoryInput-post gap 0.3 ms, **zero XYZ movement / 89 native ticks**. Observer drops/id-map drops/errors/product errors are zero. Input ACKs do not establish Worker acceptance, input lifetime or specific tick consumption.

The Page-main-isolate profile spans a 4999.929861 ms neutral Node wait plus gesture/projections/cleanup. Node protocol and V8 clocks differ; sampling/profiling adds overhead. Worker/GPU/solver are excluded. Metadata records successful stop/disable ACKs and cleanupErrors=[]; this is not a device comparison or FPS claim.

Current 30 product hashes independently match restore receipt SHA `83073b54b131c9198c07fc6f1393d3e94c014e7972e99bff0b3f84e4326f6632`; normal E2E 030fc restored. Fixed-output/absence restoration and free 5174 are recorded there; no server was launched or port queried by this reviewer. Full W07 normal gate remains FAIL88.
