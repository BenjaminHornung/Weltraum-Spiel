Temporary main V8 profiler source self-review (91)

Only the existing E2E changes relative to baseline201394; all other29 product bytes match. The reviewed89b passive forwarding observer and public-CDP S gesture payload/error closure are retained. The normal030fc source is separately archived byte-exact.

Three original-budget serial cases use the same Page/World: ordinary Ready/Open/Play, Page Profiler.enable/setSamplingInterval1000/start plus a real neutral five-second Node wait, then one125ms released trusted S gesture. Profiling covers the main Page isolate only; Worker/GPU/solver are not sampled. No measurement opt-in, Runtime/source changes, artificial ticks, pose changes, timeout/cap changes, input retries or movement assertion are introduced. Actual seed/source/camera/resources, project config, Node and Chromium versions are captured through existing read-only fields.

The third case finishes profiling in finally. An idempotent afterAll fallback stops/disables and writes metadata even when earlier cases fail or the profile is missing. All original gesture and cleanup error objects remain represented by the sole original throw or AggregateError; context teardown errors also propagate. Complete Profiler.stop profile output is saved independently from metadata. Missing profile or failed stop/disable remains an explicit failure, not synthetic success.

Original npm run build (full TypeScript/Vite) passed91, Exit0,4.181339s, raw1904B/SHA8f913cbd1d518865a514e8eecc19278e166dac4b2d9151522e1151fc8999c235. Browser execution is NOT_RUN/HOLD. This source preparation proves neither gameplay nor performance improvement; observed function attribution requires the separately authorized diagnostic.
