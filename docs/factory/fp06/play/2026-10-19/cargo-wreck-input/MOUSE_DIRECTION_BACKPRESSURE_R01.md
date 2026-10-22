# Mouse-direction producer backpressure R01

HEAD `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`, checkout `E:/DEV/Weltraum-Spiel/FP06-Candidate`, branch `feature/hestia-fp06-review-continuation-2026-10-15`. This is the Rapier0.12 gameplay candidate, not the separate CIFI-A0/Core0.21 checkout. No source transfer or shared-engine change is authorized by a matching filename.

## Actual first new stop

During the user's requested walking/look lag test, Ready-v4 entered `HVP-02 UNAVAILABLE / Technical initialization failure: Physics command backpressure`. The scene cleaned its Native datasets. Exact DOM, errors and frame intervals are preserved in `apps/weltraum-browser/evidence/factory/play/2026-10-19/cargo-wreck-input/BACKPRESSURE_FATAL.json` and its screenshot. Save12's entire payload remains unchanged at SHA256 `7f131c2fb14e3043fe9ddded10114bc95e15856ae06a99c219a0e033848e98e2`.

The sample before cleanup recorded about32FPS while Playing and30.72FPS Paused. An empty same-Chrome page recorded30.77FPS, so the browser/display cadence itself has a roughly31FPS floor here. This does not prove the origin of that cadence, nor explain away the terminal gameplay failure. No new CPU/GPU profile or fourth historical optimization candidate was run.

## Source cause and boundary

Client `send()` rejects at the unchanged eight outstanding requests. `sendFactoryInput().catch(fail)` makes overflow terminal. Current Mousemove integrates yaw then immediately calls `publishEventIntent()`. With WASD held every yaw change changes world-space X/Z, defeating the valid existing identical-level deduplication. Neutral mouse-only levels are already deduplicated. CameraOffset is carried by the single busy-protected Read and does not add separate RPCs. Last-eight command kinds were not retained by the actual failed runtime, so first prove this concrete compatible trigger in the existing Native harness.

The proposed fix is private gameplay input production only: continue integrating every raw mouse delta immediately; publish the resulting walking direction at the existing `input.update()`/RAF, which already performs that publication. Keydown, keyup, jump, Stop, blur/hidden/Dispose and explicit Raw pointer-lock/Native-ACK behavior remain unchanged. No new timer, Clock policy, queue representation, generic coalescer or public contract is added. Client, Worker, ACK accounting, cap8, Native physics, camera publication, Save and timeout behavior are untouched. Root owns review/integration; there is no Core-engine patch to adopt.

## Test-first lease

`/root/fp06_writer` owns only `src/hestia-prototype/player/input.ts` and `tests/unit/hvp-player-input.test.ts` under the browser app. First extend the existing real NativeTransport/client harness: start the real PlayerInput, hold input ACKs with one Read pending, W-down and32 mouse events before a frame. The old source must reproduce the bounded failure. If it does not, report and stop before any product edit.

Only after that RED, remove the immediate mouse-driven level publication; do not alter keyboard or frame publication. GREEN must prove all yaw deltas retained, at most the current direction at the next update, immediate neutral on W-up, no tick/pose advance through the blocked Read and unchanged existing eight-pending terminal test. Run full player/input/camera/presentation suites, TSC and whitespace; inspect the exact final diff and immutable client/worker hashes.

Original real-browser walking+look at normal controls must then survive without the same stop. Keep the raw-input fix and newly completed E/I UI. Asset revision is held with no source/art writes yet; resume only after the gameplay stopper passes. Historical failed evidence, performance limits, caps and Goldens stay intact.

Progress: actual runtime failure preserved. The real NativeTransport/client harness reproduced terminal backpressure before the fix. Removing only the mouseMove publication passed the same regression, all53 PlayerInput cases,11 adjacent camera/presentation cases, TypeScript and scoped whitespace checks. All32 raw yaw deltas remain integrated, the next frame publishes the latest direction, key-up publishes neutral immediately, and blocked Read does not advance Native ticks/pose. The deliberate eight-pending terminal test still passes. Final independent source review and actual external-Chrome walking/look remain pending.

Frozen source SHA256: input `4CC5D01E849F76A80851C1A4B1887006E2448B8C3FC9B360A70620CA545159DD`; test `D9E541E378C42F76FA9A2D22D46DD68DB4A421813E45F48A90A205DEECD1328E`. Unchanged Client `6CF6746D7B6A5BD2CB8D8EB63C312A61C66D7068EF8297B03EE9F83778C98966`; Worker `09BF987ED7BE9F2C954E5CA2F3063067B15168564DA9295A758DA0B2D4BFFEC6`. Independent final source/test diff review by `/root/combined_save_plan` PASS at these hashes. Product writer quiescent; Root owns clean export and actual runtime acceptance.
