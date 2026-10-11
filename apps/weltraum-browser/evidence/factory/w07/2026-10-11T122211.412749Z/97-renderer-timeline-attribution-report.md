97 actual Chrome renderer timeline diagnostic

3/3 diagnostic cases PASS, npm Exit0, 2026-10-11T19:04:34.641990+00:00→2026-10-11T19:05:17.375531+00:00, 42.733550s. Original helper53a55/30s cases/native60Hz/pending8/deadline20s remain unchanged. No W07 gameplay gate or product performance change follows from this capture.

The complete raw trace is4023557B SHAf07c6b284b9c841885e5411169cd0f807c3c8a19ef896085047974778a8fd88c,24069 events; renderer process/thread98409/98409 is explicitly metadata-labeled Renderer/CrRendererMain. Actual tracingComplete has dataLossOccurred=false; stream closed; cleanupErrors empty. Metadata names52 main Commit slices.

| Main-thread event | Count | Inclusive wall sum ms | Trace-declared thread duration sum ms |
|---|---:|---:|---:|
| RunTask |578|8880.150|652.130|
| Commit |52|8384.424|65.443|
| FunctionCall |246|533.328|see raw attribution|
| FireAnimationFrame |52|521.012|see raw attribution|
| Layout |53|9.454|see raw attribution|

Inclusive intervals overlap and cannot be added as independent costs. Commit wall median161.5055ms/p95 nearest rank191.994ms/min126.678/max228.125; median trace tdur1.164ms. Example RunTask238.582ms contains Commit228.125ms (tdur1.680ms). The dominant observed renderer-main elapsed region is the browser Commit slice. The difference between wall and trace tdur does not identify which external wait/scheduler/compositor/driver caused it, and does not establish hardware GPU performance. Source shaders, viewport, renderer policy and World remain unchanged.

Direct same-thread trace evidence ties pulse collapse to this region: preceding Commit ts36731015344..36731176891us; keydown EventDispatch begins36731177203us (0.312ms after Commit end), keyup36731178472us (1.581ms after end), dispatch-start gap1.269ms. Passive trusted DOM event timestamps differ140.7ms, but handlers differ0.8ms and FactoryInput posts0.4ms. Native advanced86ticks with poseΔ0. The Node requested gesture125ms; actual DOM timestamps and Node clocks differ. Natural key-event pairing maps passive and trace clocks approximately (offset spread1.533ms), not as an exact global clock. FactoryInput tinyACK still does not reveal native acceptance/execution boundaries.

Observer/idMap drops/errors0. Rawtrace plus7other actual artifacts total5020067B are hash-bound; rawCLI1169B SHAaf0c5c46d7e8fac534acdff36a684087fc45e2e057e73a02bc3d09c47f4d2728. Exact normal030fc16961 and all30baseline201 hashes match after restore; fixed original/absence states restored,5174empty and CPU/GPU/port released. Restoration filename retains historical stem97-after-main-cpu-diagnostic-full-restore-port-receipt.json. No further browser/optimization executed or authorized here; HOLD.
