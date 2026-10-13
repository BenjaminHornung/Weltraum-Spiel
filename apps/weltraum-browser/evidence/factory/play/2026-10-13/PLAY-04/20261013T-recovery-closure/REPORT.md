# PLAY-04: Explicit Factory SimulationHold recovery

Actor `/root`, sole shared Integrator; branch `codex/hestia-fp06-play-candidate-2026-10-12`; base `eb84b3e06b8e4f1b01cc4cca93b0fbafbc46e80a`. Exact amended 14-path grant applies. Local source commit `d59f978250348e8ec85360a49b2863520949135c` (14 paths) after final verification; no merge, push, PR or publication.

## Result and scope

Separate visible **Sitzung freigeben** action restores only the same finite Native World from SimulationHold to Paused, at the exact current tick. The player must choose Spielen separately. Native advances, bodies, colliders, terrain, material, adopted WIP, battery, belt and history are unchanged. Held unconfirmed intervals grant no retrospective work. The Session rebase changes only the observation cursor and preserves confirmed remainder. Unadopted queued work receives one known replayable rejection. Wrong ACK binding and unreadable actual Native binding remain fenced.

Independent recovery/focus-Pause fences prevent recovery from clearing a newer pending focus Pause. Private recoveryBusy prevents reentrant admission, dispose and premature confirmed projections. A same-tick changed trusted Host header refreshes UI after barrier release; identical repeated headers do not emit UI or work. Existing ordinary R1 Play/Resume hold rejection remains required.

## Actual evidence

- Initial unit REDs precede implementation: native exact recovery missing, real Worker stale RPC, Client API, Session cursor/fence/queue, and visible Shell command.
- Closure business REDs: focus-Pause versus recovery fence race, Host read failure, confirmed presentation before pending ACK, and stale published UI after same-tick fence release. Each has a focused GREEN.
- `02-host-focus-red` contains an invalid test setup (forgotten await of mount), not the focus business RED. It is retained; `03-host-focus-business-red` is the genuine expected failure after setup correction.
- `06`: four complete affected files, **140 PASS**. Final Session/Native `15`: **130 PASS** (69 Host Lifecycle +61 Native Facility cases). Current focused recovery `11`:10 PASS. Do not add overlapping runs as unique cases. Final Bootstrap `16`:6 PASS,46 intentionally filtered SKIP. Source changed afterward only by commit, not bytes.
- `07` actual build FAIL: optional capability TS2532. Guard now fails closed for absence. `08` and final current `12` original tsc/Vite build PASS. Existing chunk-size warning is retained; no limit or dependency changes.
- Browser `09` overall FAIL122.871s: paid Former route worked; recovery Native ACK then stale UI fence. This is not replaced by later success.
- Browser `13` overall FAIL37.475s: public diagnostic snapshot was read before a fresh Native running tick following Play; final actual Native Running0. No movement was performed. Evidence driver `14` checks fresh matching published Native/Host tick before movement.
- Browser `14` overall **FAIL198.247s**. Normal finite 341kg pickup/west route/depot/exit/paid V2 Former and **three real explicit visible-input recoveries** succeed (tick910,1803,2828). Equality checks compare same tick/bodies/cargo/owners/carrier/inventory/battery before/paused ACK; separate fresh Play then resumes. First hold retained real heavy cargo custody. Subsequent short17ms gesture gives no sampled movement at waypoint rest0.0839m; battery pickup/install not reached. No new terrain obstruction or full W09 completion claimed. Hardware: AMD EPYC9V74/KVM cloud5vCPU, quota4CPU/32GiB, Mesa llvmpipe LLVM19.1.7, LP_NUM_THREADS1/taskset0,1,2,1280×720DPR1/noVideo. Target GPU NOT_RUN. One generic console404 remains; its URL is unbound in this run (no response404 in collected resources); no silence or fake clean console.

## Gates

| Gate | Status | Evidence limit |
| --- | --- | --- |
| Native / Worker / Client / Session / UI business | PASS | Actual bounded tests and explicit private/RPC contracts |
| Independent source review | PASS | Read-only reviewer hashes; no independent runtime claim |
| Build | PASS | Original build12 current source |
| Real browser Recovery | PASS limited | Three actual holds preserve state, then explicit Play |
| Extended heavy/battery route | FAIL | Latest198.247s before battery pickup; no fabricated acceptance |
| Original Dry-band performance | FAIL / unresolved | Historical6809ms vs unchanged5000ms; this recovery patch is no performance fix |
| W09 full fresh16kg circle | BLOCKED | Machines/belts/power/cables/fresh brace/interruption gates still open |
| W10 combined Save/Load | BLOCKED / NOT_RUN | No factory browser restart proof |
| W11 overall acceptance / clean-copy complete build | BLOCKED / NOT_RUN | No claim from subset route/unit/build |
| Visual, final terrain, fun | OWNER_REVIEW_PENDING | Images are interim review evidence |

## Changed files

- `apps/weltraum-browser/src/hestia-prototype/physics/session.ts` — SHA256 `7bac925c8e76e4d6e3ba79f0bab8a7fa50f16d66570918e89ea944718aef43ac`
- `apps/weltraum-browser/src/hestia-prototype/physics/client.ts` — SHA256 `e8021c031892f9e048dc7f1abb558482c687bc0064c43da2e21b8ac0e9e6d9b9`
- `apps/weltraum-browser/src/hestia-prototype/physics/physicsWorker.ts` — SHA256 `c401edd5b4f9e130caf01369ad5925c6013c8fa055cebfa0ebee13500af94a20`
- `apps/weltraum-browser/src/factory/session/hostPort.ts` — SHA256 `990389591159419544852477b7bdbefecd8a3bc46b158760600acacf15c93147`
- `apps/weltraum-browser/src/factory/session/factorySession.ts` — SHA256 `5863df90e7e4c36f8a79c54b4249f9acc8223f995522d99dc177ebd2eab03d4f`
- `apps/weltraum-browser/src/factory/factoryEntry.ts` — SHA256 `ef393b60724fa8d0d0e01abaf91980e123a9c323e78515b6d8f07b80ddc17d87`
- `apps/weltraum-browser/src/factory/ui/factoryShell.ts` — SHA256 `88f6dc0fad4479d8ea9d6f44c072f23a111fc2750349d7ff48df0d12d13887e6`
- `apps/weltraum-browser/src/hvp/hvpBootstrap.ts` — SHA256 `94e2dae1ab702a9a2f14afd28c9fc7f835962f1b0a5f8d91affc6145ea80e6bf`
- `apps/weltraum-browser/tests/unit/factory/facilitySession.test.ts` — SHA256 `d58c0587fdc448941cfa0f9fdb6303cc6af203b6f4d877679e6aa3b774de550d`
- `apps/weltraum-browser/tests/unit/factory/hostLifecycle.test.ts` — SHA256 `5f07a6eac3f37b094f91737baaece313e3d948df438abbb9d6ef411c43dba106`
- `apps/weltraum-browser/tests/unit/factory/factoryShell.test.ts` — SHA256 `efc3092f13995f0fb09aba0cbf48c9090482678beecb348f8ea0c148cddd359a`
- `apps/weltraum-browser/tests/unit/hvp-bootstrap.test.ts` — SHA256 `00f26e1e10ec9b8e91b0bc76a44e5ab609da45e9e582620f0490e67350de5ccb`
- `apps/weltraum-browser/tests/unit/hvp-physics.test.ts` — SHA256 `a5238a79a582f414da703e89c4f31133d46c5f3ac0944dd43cfab50263fdbe2d`
- `apps/weltraum-browser/tests/unit/hvp-player-input.test.ts` — SHA256 `bfe734be37d5da4b097e41d6b31cb76a6d14764f895bda55afb544004a4061e9`

## Command receipts

Every receipt binds UTC/cwd/full command/Node22.23.3/npm11.9.0/local HEAD and actual before-command source bytes. Full raw output remains in the sibling gzip file. Exit1 rows include intentional business REDs, retained setup mistakes and genuine runtime failures; they are not all gameplay FAILs.

| Receipt | Exit | Seconds | Full raw SHA256 |
| --- | --- | --- | --- |
| `01-session-review-red.command.json` | 1 | 1.614 | `2d8622a500fd70c1bcce6ef33282d6a6ffdd20ef547ccffe1116ccd509b057e6` |
| `02-host-focus-red.command.json` | 1 | 19.054 | `87f671b5f3668d7e1f0497af5dd421db25644b36fa027b5717d8efc647b02818` |
| `03-host-focus-business-red.command.json` | 1 | 10.049 | `bd9823355e8a49ba132c3d6d2a4f95019f2eff6d76ec3ce8282baf09fb441185` |
| `04-session-review-green.command.json` | 0 | 5.224 | `9ef4318cd88c83fa4ec14dd8339e8b2db9a18bab91c2ad9dfe2768b95a14a1fa` |
| `05-host-focus-green.command.json` | 0 | 51.983 | `71b12b7537af98118398b7cb1417f1a5d17a094e04a8b916819bddda723b6e6c` |
| `06-session-ui-client-worker-regressions.command.json` | 0 | 63.614 | `670020db2dc13fe1607caa3a44921150c2e161c8260144c34cf65e9bf5a85541` |
| `07-original-build.command.json` | 1 | 5.450 | `4772c2ccac4a29376c1700ab75dbc9be08f64202e6e3a9094727249a0f29180d` |
| `08-original-build-typed-capability.command.json` | 0 | 6.022 | `700eb0645796d8bede3ca2c3874e46ebb52cdeda6578eb419ff1945865acdbcf` |
| `09-normal-v5-heavy-battery-with-explicit-recovery.command.json` | 1 | 122.871 | `e3170314ce106591df0c40da44bbde3e2cca7d1c4489fbf50c88b213115cd0a4` |
| `10-same-tick-ui-fence-red.command.json` | 1 | 2.567 | `3dfab68ec1caddc5ede995370a21722f283afe495447e17e46478ade508b0e83` |
| `11-same-tick-ui-and-recovery-green.command.json` | 0 | 5.414 | `1899c2af58cef9039da6d8d5de9a4b034092240c5bd3bb80128b4ccd08a42c47` |
| `12-build-same-tick-ui.command.json` | 0 | 13.083 | `f7ad5ec5f845d8b894c84a042262402cd93fab0de6d213c48c3e90e83c81d976` |
| `13-normal-v5-heavy-battery-same-tick-ui.command.json` | 1 | 37.475 | `984e5581095aca89be0b2c0a5ecf0030753c602d96a4308b28da5741435101b5` |
| `14-normal-v5-heavy-battery-fresh-presentation.command.json` | 1 | 198.247 | `dc4ad895a1a9a341be0928436df5d456c0934c9cc096d9697ac11637793d1721` |
| `15-final-session-native-regressions.command.json` | 0 | 95.729 | `8b0d9a145fa0d1aaa1d31dde8d67db2c3e33b10767cb3d3533b512dda41d0eaa` |
| `16-final-bootstrap-recovery-and-r1.command.json` | 0 | 71.243 | `d46865eee714258683dee160db0111c028007036c8fc98fbe1d51179c1438402` |
