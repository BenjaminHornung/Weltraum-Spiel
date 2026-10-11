# W07 render-wall diagnostic94: independent observations

**Arithmetic/artifact binding MATCH; diagnostic only. W07 remains FAIL88.** Actual three diagnostic cases PASS, exit 0, 43.853671474s, ended `2026-10-11T18:54:41.297938+00:00`. No new job, source/evidence edit, package/Git or hardware acceptance.

Own run: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`; archive `browser-render-wall-diagnostic-94/`.

All six actual artifact payloads match receipt SHA `666078a207a4ac9d56a159703ca56565965107dc955f37e72d7e790cf6e5ed84`, total 987,748 bytes. Actual 94 raw gzip decompresses to 1,138 bytes / SHA `b507159c5e2072b3e802295e3706f90256597b0085e9b03af92365df6f40e339`, matching command/exit. Build 93 retained raw 1,904 bytes / SHA `0c7bf7fea149454a6532d866b517afc138bf5f52e95e2d64fc93d0e64356ef1a` matches receipt/exit 0 and its archived temporary source75a286. This is historical diagnostic-source build evidence.

Independent recomputation matches attribution JSON SHA `5871b3fea5f01c8e291dddb098b8f9567cea433ce48ebb02f15aadbcab08ab35` and prose SHA `c9c4edc1377a13e793d1d6d331531685f7a250779890aaa2cb93f5fe2054ad01`:

- renderFrame: 60 calls; conventional median 0.600 ms, p95(nearest-rank) 1.200, maximum 28.800, sum 66.600 ms.
- dispatch: 120 calls; conventional median 2.350 ms, averaging the even middle 0.800/3.900 pair; p95=8.200, maximum 22.300, sum 435.200 ms. Nearest-rank p50=0.800 is a different statistic.
- Longtasks starting at/after first observed render start: 59; range 136–236 ms, median 166 ms, sum 9899 ms; measured render overlap 66.000 ms. All method calls returned; no throws.

The measured synchronous render wrapper occupies little of these longtask intervals. This leaves work outside the measured wrapper unidentified. Nested durations/overlaps are not independent CPU costs, and asynchronous GPU/browser work is not measured. The app-created WebGL context reports ANGLE/SwiftShader Vulkan; that establishes renderer-string presence, not a GPU culprit or physical-device benchmark. Every 60-frame dataset freshness remains unknown.

Actual 125 ms S: trusted event-stamp gap 127 ms→Main DOM handler 0.7 ms→FactoryInput posts 0.3 ms; zero XYZ movement despite78 native ticks. Observer/id-map drops, observer/product errors are zero. Worker input acceptance, processing/step timing remain unobserved.

Metadata SHA `574c1d71347ac9569dcd2449075265bd86f41efc14bed5d102738e01be55af56` records original canvas/renderFrame/dispatch restoration. Historical restore receipt SHA `45149c0ca6b91acc0c0c389541f1670140f7fa836f29646eb8238a1e65aaf237` binds baseline 30. Independently 29 other current files match; archived 93 normal E2E is 16,961 bytes / SHA `030fc301147af6a45da6412847368e6c7d5243b70811018e53883b83210ef605`, matching its restore reference. Current E2E is the root-authorized 95 Timeline overlay 62ba0362…, so a live 30-normal comparison is **NOT_APPLICABLE**, not a 94 restore failure. No final source-byte test or package gate follows.
