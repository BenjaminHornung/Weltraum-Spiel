94 actual render-wall diagnostic

3/3 diagnostic cases PASS, Exit0, 2026-10-11T18:53:57.444280+00:00→2026-10-11T18:54:41.297938+00:00 (43.853671s). Original30s test budgets and helper53a55 unchanged. Ready is displayed30.0s rounded and passed. No W07 gameplay gate or performance candidate follows from this diagnostic.

Actual app renderFrame60calls: median0.600ms/p95 nearest rank1.200/max28.800/sum66.600. dispatch120calls: median2.350ms/p958.200/max22.300/sum435.200. Zero methods threw. Calls prove the exact app ESM prototype was observed. Zero observer/idMap drops/errors. Original canvas/renderFrame/dispatch restoration receipts all true.

59 longtasks starting at/after the first observed render start ranged136–236ms, median166, sum9899.000ms; measured renderFrame overlap totals66.000ms. Example longtask29360.3..29553.3 contains render29370.2..29370.8, only0.6ms. Synchronous renderer submission is not the dominant observed portion. Unwrapped browser/native/JS work remains unidentified; no GPU hardware cost established. Inclusive overlap is not independent CPU cost. Exact bounded intervals and method distributions are in94-render-wall-attribution.json.

Original app-created context VENDOR='WebKit'; RENDERER='WebKit WebGL'; debug vendor='Google Inc. (Google)'; debug renderer='ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'. This records the browser string, not a physical-device benchmark. The diagnostic never called getContext itself. Every60-frame dataset snapshots are copied verbatim with freshness unknown (no timestamp), without forcing frames.

Trusted125msS: event stamps127.000ms, main DOM observer handlers0.700ms, FactoryInput posts0.300ms; Native+78ticks/poseΔ0. TinyACK acceptance and handler timing remain unobserved.

Raw1138B SHAb507159c5e2072b3e802295e3706f90256597b0085e9b03af92365df6f40e339;6actual artifacts987748B hash-bound. Prior92's7artifacts verified unchanged. Exact normal030fc16961/all30baseline201 restored, original/absent fixed writers restored,5174 empty and CPU/GPU/port released. The restoration filename retains earlier runner stem:94-after-main-cpu-diagnostic-full-restore-port-receipt.json. No product optimization or further browser run.
