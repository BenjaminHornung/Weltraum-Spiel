# Bounded Native worker diagnostic

Functional browser path: FAIL. Actual normal New Game / Play stopped at Native SimulationHold tick5; original5000ms wait retained. No World/pose/clock writes, no TestBridge, no budget/timeout/queue changes. Current finite mass2984400000mg remains unchanged. This is diagnostic capture, not a gameplay or performance acceptance.

The first Native profiler harness discarded its trace when Play failed. This repeat preserves the actual partial worker profile in finally, plus actual final published Native read. The owning helper launches and closes only its own localhost-CDP Chromium and temporary user profile. Playwright automation/no-first-run flags were added to match the bounded intended launch. LP_NUM_THREADS=1 and external taskset0,1,2 are local run limits, not game settings. Profiler overhead can change the measured scheduling.

Actual command: ['taskset', '-c', '0,1,2', 'node', '/workspace/.cloud-setup/fp06-native-worker-profile.mjs', 'evidence/factory/play/2026-10-12/PLAY-06/20261012T231100Z-root-native-preserved-profile/normal']. Exit1, elapsed24.51700162599809s; rawSHA256af08120687608518dc0f380009fb4cc313cb288b27c1bbbc44d43ff37600451e.

Profile: 6.892648s, 5350 samples. Of sampled time6.7647s is idle; ~80ms total is in native Wasm functions clustered near the first active advances. This establishes a narrow first-active-step/Wasm diagnostic hypothesis; it does not establish JIT, KCC or OS scheduling as a proven cause. Final clock maxAdvance81.6ms and SimulationHoldgap81.7ms, previous Play handler1.2ms / advance2.9ms. The original fixed60Hz/four-step backlog contract is intact.

Actual trace SHA256: fec5a0be69d1a2a3bac864d8d880a5a738903371226cef8ce8990327a8766dc6; bytes49887. Source0e2a0bcb; currentbuild before SurfaceV2integration. No speculative warmup or Physics policy change applied. Independent readonly source attribution requested.
