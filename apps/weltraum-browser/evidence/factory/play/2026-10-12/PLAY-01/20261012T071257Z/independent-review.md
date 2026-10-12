# PLAY-01 independent Source / paid-heavy-route review

Reviewer: `/root/play_route_review`, 2026-10-12. Read-only product review; no tests, build, browser job, generator execution, video re-recording, product edits or other agent delegation. This report is the only reviewer write.

Reviewed product worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, branch `codex/hestia-fp06-play-candidate-2026-10-12`, HEAD `96cced23cd285b57f8a557d01ac9ed8a158c927f` plus nine current draft files. Control HEAD: `13c97152286bb15ad04489d8fe581af96d2a0a16` in `fp06-w00-2026-10-11`. Read actual AGENTS (identical to primary), README/current mainline state, exact V2 proposal, `play-01-integrator.json` and `play-01-flora-delta.json`. Integrator grant SHA256 at review: `333cdb4d6de072194b3751eb6c056377a140983c9c38ffb50729288373719923`.

Evidence base below means `apps/weltraum-browser/evidence/factory/play/2026-10-12/PLAY-01/20261012T071257Z/` in that product worktree. Canonical paths and limits were independently read and then confirmed with `/root/play_integrator`.

## Verdicts

| Authority / claim | Verdict | Evidence and limit |
| --- | --- | --- |
| Source | PASS for the exact isolated V2 candidate | Current diff matches the 15 original masks plus three exact additions, `ec8ba9b1`, 380 addressed columns / 297 changed columns / 2890 changed slots / 0 mg material credit. Actual sparse rows and their checksum checked; producer full-slot census and focused tests support bytes outside the union. No fresh independent generator/full fold run. |
| Native route | PARTIAL PASS for paid 341 kg pickup → west route → depot → player exit → B07 install | Actual normal-route-02 screenshots/readbacks/actions prove this sequence in run 17. Run 16's NativeSimulationHold remains an OPEN failure. Run 18 did not reproduce that failure under its measured idle conditions. |
| Material | PASS for the reviewed paid-heavy sequence | Original finite 79-stack cargo starts at 2,984,400,000 mg. Cargo → carrier → depot → installed transfers preserve every itemId aggregate quantity and mass; final total remains 2,984,400,000 mg. No extra material from initial-source geology. |
| Game input | PASS for these captured actions | Normal `/factory.html`, TestBridge false; visible buttons, trusted CDP WASD key down/up and Escape. Current driver reads diagnostic snapshots and sends normal input; no player pose, world, native-clock or material injection observed. This is assisted automated input, not a human usability verdict. |
| Evidence | PASS for integrity and the bounded claims; completeness OPEN | Decompressed raw byte counts/SHA256 match every command receipt 04–18. All nine current draft bytes match receipts 14–18. Eight run-17 screenshots and both idle-probe screenshots were actually viewed. Video metadata is present; videos were not independently watched or decoded. Wrapper exit status alone does not classify action success. |
| Owner / W09 closure | OWNER_REVIEW_PENDING / NOT COMPLETE | Grant authorizes a routine isolated candidate. It does not accept final terrain. Battery, three cables, full 16 kg production line, reverse route, human usability and subsequent W10/W11 dependency gates remain outside the demonstrated slice. |

## Findings

**P1 — retained unexplained idle NativeSimulationHold blocks an unconditional normal-route readiness claim.** In `normal-route/01-v2-normal-entry.json`, the native state is already SimulationHold at tick 440, backlog 0.04296666666648061 s, discarded 0; UI Waiting and host confirmed=false. Both that capture and `02-normal-pickup-stand.json` retain the same tick and player position. The execution log records a disabled Fracht öffnen timeout and a blocked movement action; final native state remains SimulationHold. No first-run worker-clock observations exist to establish cause. Run 17's successful movement is not a cause diagnosis or regression fix.

Run 18 measures a different current observation: 35 repeated idle reads, first 07:48:16.417Z / tick 407, last 07:48:54.720Z / tick 2703, all Running/Ready, each tick delta at least 54, maximum backlog 0.016600000000559015 s, discarded 0, visible/focused true and one clock timer. Maximum measured timer gap is 48.2 ms; final read stays Running at tick 2854. It establishes non-reproduction in that captured run only. Preserve run 16, label its cause OPEN, and diagnose the held worker with live clock evidence if it recurs. There is no reviewed product fix for this failure.

**P2 — the full W09 contract is still unproven.** Run 17 ends after one B07 installation. Its final power status is UNCONNECTED, battery/reserve energy null, power and belt connection arrays empty, and input/output/offcut/WIP containers empty. This cannot support battery/cable acceptance or the complete 16 kg processing loop. Actor explicitly confirms those checks and the reverse route remain NOT_RUN. Do not advance dependent gates from this partial route result.

**P2 — receipt success must remain distinct from action success.** `16-normal-production-route.command.json` has exitCode 0 while its JSON/raw action stream contains two failures. The preserved raw and final readback make that discrepancy inspectable. Treat this receipt as successful evidence capture of a failed route. Similarly, files 09/13 include “green” in their names but their recorded exits are 1; only final receipt 14 supplies the current focused green result. Report classifications from actual results, not filenames or wrapper status.

No new P1/P2 source, geometry, material-credit or scope violation found in the reviewed current diff. The CarrierOverlap veto during the last west-corridor gesture is preserved correctly: attempted player target approximately `[-8250.0305,2400.0020,-1525.0296]` mm, final supported player z approximately −1.47503 m. The driver accepts an 80 mm target tolerance; it does not inject the exact proposal coordinate. Thus the run proves the reachable captured path and does not prove extra steering tolerance at the tight endpoint.

## Source and contract checks

- Original V1 materialization and 15-mask array are unchanged. Additions are exactly `[.75,6,3.25,3.5]`, `[8,15.5,3.25,3.5]`, `[2,13,4.5,4.75]` in E/N, with the existing `slot=1` through yIndex75 and Air0 above. V1 parent digest is checked as `e62aea8a`; Coast digest remains `b8fde6b0`.
- `v1-to-v2-sparse-slot-diff.json` contains 2890 unique indices in 297 changed columns. Every row lies in one exact mask, changes its byte, and reaches the required y-based slot. Per-mask removal is 1256/506/864; additions 0/70/194; replacements 0. File is 40,462 bytes, SHA256 `83217ba7b953cd634967ca384ec28cc70162603b9b25ebc869406f0760cefef9`.
- `source-census.json` binds the actual 8,388,608-slot producer fold, V1 slots SHA256 `48f80a82e119e1691289f7835585fd2a2d275715e146f85353276d388999702e`, V2 slots SHA256 `a380a6b29746d731ebf02d29fdd27fd15d38dc16bfd67b4cb2bec175b0c8264f`, maskCount18 / columnCount4860 / area75,937,500 mm² / credit0 / OWNER_REVIEW_PENDING. Source-census script was read, not executed by this reviewer.
- Source construction/complete validation admits only the explicitly named V1/V2 Factory profile or existing Coast profile. Actual bootstrap requires matching Factory extension/profile/snapshot version. Existing Coast restore stays unchanged and Coast-only. Unknown V3/missing/mismatched Factory profiles are exercised by the final focused tests.
- Cargo's owner, source container, center, sizes, support/access/player checks, geometry policy and source references are unchanged. Only named V2 admission/source binding is added. `fp02Catalog.ts`, `factoryFacilitySession.ts` and `vegetation.ts` are byte-identical to HEAD; no package, lock, collider, capacity, native-budget, foot, sweep or yaw file is in the draft diff.
- The flora amendment is implemented only in initial V2 planning. It evaluates the existing habitat guard and fails unless there are exactly 97 planned plants and precisely one invalid broadleaf: `hvp:flora:bed-52-220`, variant1, pose `[-9.5,2.5,11.5]` m. Only that plant is removed. Existing build habitat guards remain active; the negative extra-invalid-physical-plant test remains fail-closed. Broadleaf has wood=null and decorationPhysics=none in the unchanged vegetation builder. V1/Coast planning returns unchanged; V2 count96 appears in the successful binding test.

## Actual heavy-route observations

Run 17 receipt: 66.823699342 s, raw SHA256 `c17e176bd16d0585855091f2d91e670315b66e8e686022e99c192bb4f0bf22c2`. Execution entry is `/factory.html` without TestBridge, Chromium154.0.8037.57, 1280×720 DPR1, declared software Mesa wrapper; hardware acceptance NOT_RUN. All completed run-17 actions and recorded release gestures were read. One console 404 is present but has no URL attribution in the error entry; all recorded document/script/CSS/worker response resources are 200.

| Actual capture | Relevant readback |
| --- | --- |
| 01-v2-normal-entry | Source ec8ba9b1; native Running tick190; finite cargo 2984.4 kg / 79 stacks; zero installations. |
| 02-paid-341kg-pickup | Player x−5.8000011, z11.875, grounded. Cargo2643.4 kg, carrier341 kg / seven paid stacks; five carrier colliders; nativeMassKg341; committed pickup receipt. |
| 03-heavy-west-corridor | Player x−8.25, z12.125, grounded; carrier front at z11.125 and y≈1.5 m; continued native Running. |
| 04-supported-depot-approach | Player x−6.3000231, z−1.4750296, grounded; carrier at `[−6300.0231,1500,−2475.0295]` mm. |
| 05-local-341kg-depot | Normal Hier ablegen commits; same seven stacks341 kg become depot role; native phase Deposited at `[−6250,1500,−2500]` mm. |
| 06-player-exit-from-former-hull | Normal walk reaches x−4.2500153, y2.4000447, z−1.4750296, grounded. Full future Former footprint has been left before preview. |
| 07-paid-former-ghost | Normal Umformung vorschauen prepares B07 at `[−6250,1500,−2500]` mm, q1, with full material still present. |
| 08-paid-native-former | Normal Bau bestätigen yields `facility_b07_1`, B07 profile e567f7ef / authored source13c8ba14,341 kg, exact bounds min `[−7750,1500,−4500]`, max `[−4750,4500,−500]` mm. Thirty-four owner colliders; carrier null; seven paid stacks in installed container, empty depot. Production observation confirmed/supported/serviceClear/sweepClear/accessible all true; ghost null, zero reservations, total2984.4 kg. |

All eight PNGs visually agree with their broad gameplay states: pickup/depot mass, carried movement HUD, ready ghost and installed model. Pixels cannot establish collider clearance alone; those claims use matching native readbacks. Video metadata reports finalized VP8 1280×720, 64.680 s, 7,014,451 bytes. No independent viewing of video or hardware/render acceptance claim.

## Existing verification evidence and provenance

Final current-byte test receipt 14 ran existing test sources with pattern `PLAY01|W06 R1|W07 actual Host Ghost|never reaches Ready`: three files passed,10 tests passed,45 skipped,63.557418329 s. Receipt15 ran `npm run build`, exit0,4.559257244 s. Both raw byte counts/hashes match and bind all nine current drafts.

Earlier receipt04 had161 passed / two W06 failures across163 tests. Receipt07 reproduced those two failures with the original bootstrap; subsequent changes repair declared test transport fixtures, not native-world admission. Receipt08 four selected tests pass; intermediate V2 binding failures09–13 are retained. Final14 addresses those specific failures. No later full163-test-suite pass or global repository pass is established by this review.

Selected immutable evidence hashes at review:

| File under evidence base | Bytes | SHA256 |
| --- | ---: | --- |
| source-census.json | 1544 | 399a629954dd675e907c0a7ac875bf611978b524454c58cf77abd94ca7c1a167 |
| plant-source-delta.json | 473 | 95fbb5032899f27cd8342a28159307aca6b833fb01d36c99968e037f1bca5214 |
| normal-route-02/normal-route-execution.json | 543112 | ee1bfe0080524330160c967c8284e06e3c691bb987bda2f9b2b4ec0dff71a51b |
| normal-route-02/normal-route-final.json | 309618 | 272886962fe6c1946758a1d026398b4fedd12090c0b5dbe5de3ee94ea602ed0c |
| idle-probe/idle-observations.json | 55042 | 31e1993a21b14755732b794b5e9a427a9c8d62a85d56d5874834d7d5d0e8bc5c |

Product status at report write remains nine legal drafts plus untracked PLAY evidence. Source and paid-heavy transport review is complete for the above bounded slice; final terrain approval and whole-W09 completion remain pending.
