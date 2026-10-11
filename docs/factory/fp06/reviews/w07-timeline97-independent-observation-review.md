# W07 timeline diagnostic97: independent observation review

**Actual evidence/arithmetic MATCH; diagnostic only. W07 remains FAIL88.** Three diagnostic cases PASS, exit0, 42.733550060 s, ended `2026-10-11T19:05:17.375531+00:00`. No new execution, source/evidence edit or final package/performance gate.

Own run: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`; archive `browser-timeline-diagnostic-97/`.

All **8 actual payloads**, total **5,020,067 bytes**, match artifact receipt SHA `81dec2e2f5daec9f62ce68e19350491d8cc8f7aa1384840bf5529add626e2af3`. Raw gzip independently decompresses to **1,169 bytes / SHA `af0c5c46d7e8fac534acdff36a684087fc45e2e057e73a02bc3d09c47f4d2728`**, matching command/exit.

Trace: **4,023,557 bytes / SHA `f07c6b284b9c841885e5411169cd0f807c3c8a19ef896085047974778a8fd88c`**; independently **24,069 events**, process 98409 metadata `Renderer`, thread 98409 `CrRendererMain`. Attribution JSON SHA `fab1357a8fc465b3512ba0e249c0715435377a0732723748caed6d59631b62d4` and prose SHA `473e5c15b0cab2e549fa6f41a6e05c24cd0e3c31e84bf015bd79a9d14b91cdf7` agree with recomputed complete main-thread intervals:

| Event | Count | Inclusive wall sum ms | Trace thread-duration sum ms |
| --- | ---: | ---: | ---: |
| RunTask | 578 | 8880.150 | 652.130 |
| Commit | 52 | 8384.424 | 65.443 |
| FunctionCall | 246 | 533.328 | 477.313 |
| Layout | 53 | 9.454 | 9.288 |

Commit conventional wall median **161.5055 ms**, nearest-rank p95 **191.994 ms**, range 126.678–228.125 ms; declared thread-duration median 1.164 ms. Intervals overlap: their sums are not additive independent costs. Large Commit elapsed/thread-duration separation identifies the observed browser-main category and is consistent with waiting/scheduling; it does not establish a concrete compositor/driver/GPU cause or hardware bottleneck.

**Direct same-thread pulse relation recomputed:** preceding Commit ends **36731176891 µs**; actual keydown EventDispatch begins **312 µs later**, keyup **1581 µs later**; start-to-start gap **1269 µs**. These are one trace clock. Passive trusted DOM stamps differ **140.7 ms**, handler callbacks **0.8 ms**, Main FactoryInput posts **0.4 ms**; Native ticks advance **86**, XYZ pose unchanged. The observed long Commit is followed immediately by compressed input dispatch. This supports browser-main delivery delay; Worker acceptance/input lifetime/individual step boundaries remain unobserved.

Natural KeyS/cleanup-keyup pairing gives approximately aligned clocks, with 1.533 ms offset spread; it is not exact Node↔trace equivalence. No physical-key hold or GPU timing is inferred.

Metadata SHA `704dcfffc1558c82d0e31682945abaf0329d0b07e58fc14bffc27bd22e46fc99` records complete tracing, `dataLossOccurred:false`, `ioClosed:true`, cleanupErrors=[]; observer/id-map drops/errors/product errors are zero. Wall-observer metadata records original canvas/renderFrame/dispatch restoration. All **30 current product hashes** independently match restore receipt SHA `3c2f9cdb8eff9302af50df1f48c4ab569be6385c53325f98627f2ba8b1f35a10`, including normal E2E 030fc. Fixed-origin/absence and released-port status are recorded there, without a new query. No normal gameplay, source optimization or final Git acceptance follows.
