# FP06 raw pointer input R01

Goal: a slight physical mouse movement must produce a controlled first-person look in the user's external headed Chrome. Keep the current paused unsaved game, existing saves, explicit Play/Pause, neutral input and Native acknowledgement intact.

Current candidate HEAD: `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`. Baseline input SHA256: `ED69CF1E5AE60661A2386D84E97E8E298DC5504B7AA35F26F2ED890B4B9E638B`. Bootstrap remains `3B5DF6C4D0F58A18219AE108E2D6DE13BB54CAA77951815735705CF0662F7FE9`.

## Reproduction and decision

The user's slight physical movement produced 321 captured locked mousemove events with sumX 154412 (49.15 full turns at the existing 0.002 rad/unit), repeatedly approximately 950 per nonzero event. Inspection is excluded and the player handler applies each delta once. The initial input, previous camera and exact captured event rows are preserved in `E:/DEV/Weltraum-Spiel/FP06-Chromium-PointerLock-2026-10-19/hestia-human-mouse-baseline.json`.

An isolated page in the same actual Chrome requested `unadjustedMovement: true`. Both physical user runs acquired and released the lock successfully. The second run had 171 events, median absolute X 4, maximum 39 and sumX 1119. Raw input removes the repeated offset-size deltas. The physical device/OS origin of the normal-mode offset remains unproven; this is not attributed to mouse DPI or a second game listener. Full raw rows are preserved in `raw-human-control.json` beside the baseline.

Use the browser's raw pointer-lock option at the existing player-input boundary. Preserve the 0.002 gain, pitch bounds and quaternion update. No delta clamp, guessed divisor, new settings, automatic resume or relock. The W3C Pointer Lock specification describes raw platform events for this option: <https://w3c.github.io/pointerlock/>.

## Bounded implementation

Only `/root/fp06_writer` may edit `apps/weltraum-browser/src/hestia-prototype/player/input.ts` and the existing `tests/unit/hvp-player-input.test.ts`. Root is the sole runtime integrator. All other product writers remain quiescent.

1. Request raw pointer lock synchronously within the original explicit Play click.
2. Support exactly one optionsless compatibility retry only for `NotSupportedError`, while the same activation is current, visible, unblocked and undisposed. All other failures reject the activation. Cancellation or a stale completion cannot acquire Play authority.
3. The corresponding Promise owns Promise-returning request failures; do not let the accompanying pointerlockerror event cancel that request before its rejection can be classified. A late Promise and its error event cannot cancel a newer Promise-managed activation. Legacy void-returning browsers retain event-based rejection. Legacy error events have no request ID, so an old event during a newer legacy request can safely reject that request; this existing fail-closed limit is retained.
4. Native Play still requires the real canvas lock plus the existing Native Running acknowledgement; input remains neutral on Stop/blur/hidden/dispose. Existing command and persistence boundaries remain unchanged.

Internal representation: the existing pending activation adds `pointerLockRequest` (`none`/`requesting`/`promise`/`legacy`), `pointerLockErrorSeen` for an event before the API returns, and `fallbackUsed`. These transient fields are discarded with the activation and never enter checkpoints. No stored representation, schema, Clock policy, timeout, admission cap, asset, collider, resource or Golden changes.

## Verification and delivery

- Reuse the input harness: assert the raw request and unchanged once-per-event look; one NotSupported fallback despite its preceding error event; no fallback for other failures or cancellation; preserve existing late-ACK and neutral-input tests.
- Run the entire existing player-input suite, adjacent camera/presentation suites, TypeScript and diff whitespace checks; inspect the exact final delta against the above baseline before acceptance.
- Independent read-only source review, then export to a new clean directory and build offline. Retain previous Ready-v3 and failed historical evidence.
- Root verifies actual lock/Play/look/Pause in headed Chrome and obtains a physical mouse check on the new game build. Do not reload the user's unsaved old game or overwrite the completed Save12 merely to deploy the input fix. Open the new build in another tab if needed.
- Stop if a public contract, save/Clock change, broader input redesign or unbounded provider/runtime work becomes necessary. No new performance experiment: the previous performance window stays closed.

Progress: COMPLETE for this input defect. Product source remains frozen at input SHA256 `5E0A00047EC60149D79D66B1C59E1382C43DE9AD41BCABACC4456C7DD59D6A1E`, test `241E5075D0F057D1C2DE0DED217D75A745B36881859FA7ACB64905493DFF7361`. Targeted RED 3/3, GREEN activation 19/19, complete input/camera/presentation 63/63, TSC, whitespace and independent hash-bound source review PASS. Ready-v4 exported 879 files with exact hashes, installed 59 locked packages offline and built successfully. Only the acceptance README and this decision are refreshed after the build; product source and built assets remain unchanged.

## Actual game hardware acceptance

The user confirmed "Kontrollierbar, Fehler weg" after playing the new Ready-v4 build in the external Chrome. Three actual physical Play/Pause sessions lasted 18.745, 3.4948 and 13.0147 seconds, with 211/29/75 mouse events and median absolute X of 7/18/9. All 315 events were retained. Larger intentional deltas are retained too (X maxima 643/121/377); no clamp or sensitivity reduction hides them. The final camera quaternion for each session matches the actual event sequence with maximum component error 0, using the original gain and pitch bounds.

The new game ends Paused at Native2130, no held keys and no lock, with no page/request errors. The old unsaved tab stays Paused at Native1802 with its exact camera. Save12 still has SHA256 `7f131c2fb14e3043fe9ddded10114bc95e15856ae06a99c219a0e033848e98e2` and 13586523 bytes after the human test. No Save or Load was performed for this fix. Diagnostic listeners were removed; temporary port5199 was stopped; the Ready-v4 preview remains available on5197. Detailed game capture: `apps/weltraum-browser/evidence/factory/play/2026-10-19/mouse-input/PHYSICAL_GAME_MOUSE_PASS.json` in the Candidate. Other devices/browsers were NOT RUN; historical performance/test limits remain unchanged.
