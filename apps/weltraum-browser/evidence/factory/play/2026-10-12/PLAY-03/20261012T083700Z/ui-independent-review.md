# PLAY-03 independent UI source review

Status: **SOURCE_REVIEW_PASS — all three P2 findings closed; no open P1/P2 found within the seven-file review scope**.

Reviewed by `/root/play_ui_review`, with a read-only map/onboarding source cross-check by `/root/play_ui_review/map_review`. No implementation, test, build, profile, browser or screenshot jobs run by reviewers. The only reviewer write is this bounded report. Art remains HOLD; Integrator and UI are the active implementation writers.

## Authority and exact scope

Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-play-ui-2026-10-12`, branch `codex/hestia-fp06-play-ui-2026-10-12`, HEAD `96cced23cd285b57f8a557d01ac9ed8a158c927f`. Git status observed exactly the seven new untracked paths listed in the Root grant, no other UI-worktree changes. Read repository AGENTS.md, README, current-mainline-state, Root grant `docs/factory/fp06/play/2026-10-12/grants/play-03-ui.json` from the W00 worktree, and `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-03/ui-preflight.md`.

Review is source-level and does not approve the normal UI, native lifecycle, accessibility, screenshots, owner acceptance, package gates or runtime wiring. Actual UI-worktree `factoryEntry.ts` still mounts the old panels and does not import the new shell. Integrator owns Entry/Host/input/Save changes.

## Closed findings

1. **P2 — mutable map outlines remain stale at unchanged committed revisions.** `src/factory/ui/localMap.ts:113–122` caches every object outline, including `planned` and movable `cargo`, under session/epoch/frame/terrain/facility/bounds identity. Existing BuildTool move/rotate/cancel changes its request without changing committed terrain or facility revision. A new snapshot can add, move or remove a planned outline while the map keeps the prior drawing. The same cache cannot represent movement of cargo if only handling facts change. Minimal repair within the granted files: draw planned/movable cargo outlines in the dynamic layer on each update; keep known terrain and committed static outlines cached. No new World authority or broad API refactor is needed.
2. **P2 — pending Pause is already presented as confirmed.** `factoryShell.ts:45,150` opens the heading `Spiel pausiert` immediately before lifecycle dispatch resolves, while the confirmed phase can still be `playing`. `hold` uses the same heading. The pending command status does not make the conflicting heading truthful. Minimal repair: neutral `Pause und Sitzung`, or derive the heading exclusively from confirmed phase/status.
3. **P2 — a rejected map bounds snapshot prevents later same-source recovery.** `localMap.ts:110–111` clears the drawing for invalid bounds without clearing the old cache key. Sequence valid A → invalid bounds → valid A with its original identity skips the static redraw. Minimal repair: clear the cache key on invalid bounds, then redraw after a valid publication.

All three findings were sent to Root and UI early and are now **CLOSED** on the exact GREEN/typecheck-bound bytes. Source re-read confirms `localMap.ts:61–70` renders planned/cargo objects in the refreshed dynamic layer, `:126` caches only wreck/installed objects, and `:118` clears the cache key for invalid bounds. `factoryShell.ts:45` uses neutral `Pause und Sitzung`. The exported Shell/Map/Onboarding API is unchanged. The four additional regression cases were present before repairs and failed for these exact behaviors; tests remained byte-identical between regression RED and GREEN. No P1 findings established; no new P1/P2 found in the narrow repairs.

## Source contracts checked

- `FactoryShellPort` is the actual exported narrow API: immutable session/epoch-bound read/subscribe view, explicit lifecycle `dispatch`, and binding-aware `setSurface`. It exposes no World/physics/client/terrain mutation handle. Commands remain Host capabilities; Continue and Save take their disabled reason from the port, with Continue explicitly requiring an admitted combined Factory save. W10 admission is not delivered by UI.
- Shell binds once to session/epoch and ignores older publication revisions and replacement-session updates. Stale close/dispose is guarded before releasing focus. Existing canonical material panels also reject session/epoch mismatches and keep their command identity/unknown receipt alive when hidden.
- Cargo, Machine, Power and Technology controllers mount exactly once per shell. Switching surfaces changes `hidden` only. Existing BuildTool controls arrive as one once-created `buildPanel`; Entry retains ownership. Shell disposes its four controllers only at shell disposal.
- Modal close never dispatches Play, restores held keys, requests pointer lock or grants native time. Explicit Play dispatch is called directly in the click path to preserve user activation. Native pause ACK, focus-loss reason, player movement neutralization and single-world teardown/adoption remain Integrator-owned.
- Escape is consumed in the document capture listener and chooses one action: close surface, otherwise existing ghost cancellation, otherwise explicit pause. B/M are suppressed for input/select/textarea/contenteditable=true and when a surface is open. Tab remains form navigation with a modal focus trap. E receives no new shortcut, avoiding the existing camera collision. Actual input/focus effects are NOT_RUN.
- Map points use E=12.5−worldZ and N=worldX+12.25, heading uses (−dZ,dX), and north-up rendering only inverts SVG Y. Outlines are already transformed; no second quarter-turn is applied. Shell rejects session/epoch/source/terrain/facility mismatched snapshots. Markers bind frame/profile/source and are orientation preferences only; unknown, water and edge coverage cannot be marked as confirmed ground. No JSON dataset, camera or render-node facts become World truth.
- Onboarding is a pure projection of confirmed Host facts. Completion requires the exact 16 kg lineage, two cut batches, 15 kg cut output/1 kg offcut, 7 kg profile+7 kg sheet/1 kg former offcut, 5.8 kg brace/0.2 kg brace offcut and paid 5.8 kg installation. Starting-stock products or UI clicks cannot establish completion. Reordered installed machines are read from facts; legal commands are not progression-locked by UI.

## Remaining Integrator seams

The actual Host currently supplies no complete map geometry/player/frame or cumulative production-lineage facts; these belong in the admitted Integrator projection. Opening a modal must immediately suppress both player and inspection-camera input. An admitted user Play must release the modal input block before calling the existing player activation path, then reflect confirmed Native status. Existing Bootstrap `setPanelFocus` calls `playerInput.stop()` even for null and FactorySession forwards every null. Shell closes the surface on confirmed `phase=playing`; Integrator must make repeated null focus release idempotent so this close does not stop the just-activated player. This is a concrete wiring prerequisite, not an observed runtime failure.

No expansion beyond the seven UI files is requested for the three source fixes. Normal-route held-W/jump neutrality, one-action Escape, focus-loss explicit Play, start/end exclusivity, Continue disabled until W10, actual map/player source facts and screen sizes 1280×720/1920×1080 require later real wiring and browser evidence.

## Read-only test evidence

Original business RED receipt: `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-03/ui/red-receipt.json`. Command selected exactly the three new unit files with `--maxWorkers=1`; 12 assertions failed across 3 files because the intended new modules were absent. Exit 1; start `2026-10-12T07:54:18.120368+00:00`; HEAD matches. Raw log SHA256 `f5dc612c229005cf07e3a028be23382274ff37ea6acdf64d6a54e27aea0e4be3` was independently recomputed and matches receipt. This is expected missing-behavior RED, not readiness evidence. Reviewer did not rerun it.

Final supplied evidence was read without rerunning any command. All three receipts carry the expected argv/cwd, Node `v22.23.3`, matching HEAD, start/end time, exit status, raw log hash, and exactly seven retained inputs with SHA256/size. Retained bytes/size and raw logs were independently recomputed and match every receipt. The current seven UI-worktree bytes/size match **both GREEN and typecheck**. Regression RED differs from current only in the two repaired product modules; the other five inputs are unchanged.

- Added-regression RED `review-red-receipt.json`: `2026-10-12T08:22:53.202757+00:00` → `08:22:54.647521+00:00`, exit 1, three files/16 cases, 12 PASS and four actual assertion FAILs: pending Pause title, planned outline add/move/remove, cargo outline add/move/remove, invalid-bounds recovery. Raw log SHA256 `3b78056a39e69475f6e569b9111c62e3f91b26f6722f4aff57baa327051c5c1b`.
- Focused GREEN `focused-green-receipt.json`: `2026-10-12T08:23:28.752158+00:00` → `08:23:30.038983+00:00`, exit 0, **4 files and 31 tests PASS**. Command selects the three new unit files plus existing `tests/unit/factory/panels.test.ts`, with `--maxWorkers=1`. Raw log SHA256 `78f538f2f5b5ba85e20a80168690785d04c5da68bc18ae73174e84722a37513c`.
- Typecheck `typecheck-receipt.json`: `node node_modules/typescript/bin/tsc -p tsconfig.json`, `2026-10-12T08:23:30.264073+00:00` → `08:23:32.876043+00:00`, **exit 0**. Empty raw log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

This closes the three source findings and verifies the supplied focused test/typecheck evidence for the exact seven UI files. UI-only synthetic Document checks cannot prove native input, Native ACK, pointer lock, combined Save adoption, normal runtime, full flow, accessibility or screenshots. Shared Native/Entry wiring and Continue/W10 remain **UNVERIFIED** in this UI worktree.

## Final reviewed UI bytes

Timestamp: 2026-10-12T08:25:31.597358+00:00. These seven hashes match supplied GREEN and typecheck retained inputs; they establish the reviewed UI slice only, not integrated runtime acceptance.

- `apps/weltraum-browser/src/factory/ui/factoryShell.ts` SHA256 `168418de11ccca20fb6b4d18febf2f95bfe93ff8ef9f117a7d41e98aaba2bf16`
- `apps/weltraum-browser/src/factory/ui/localMap.ts` SHA256 `601a26422ab73f095759cc1009a423316eec5f4227d599b063c43b87345ffd68`
- `apps/weltraum-browser/src/factory/ui/onboarding.ts` SHA256 `0792b419b6d5ce8420632fcf99af11672891e4b1a360bca00bbce53c3e1bc97a`
- `apps/weltraum-browser/src/factory/ui/factoryShell.css` SHA256 `4603db5ebe8da2e4ca36fa3093532133acfa235a9bfab2aba53f9dd384df8fd9`
- `apps/weltraum-browser/tests/unit/factory/factoryShell.test.ts` SHA256 `bda4245f25032c33cf3a58cf2a797f48f6e0bb0ed6a2951f138a8b463d164269`
- `apps/weltraum-browser/tests/unit/factory/localMap.test.ts` SHA256 `d49791579eab4a190a089096b6a2cbe385241b524b9008f2a6099eb7a5c2f99e`
- `apps/weltraum-browser/tests/unit/factory/onboarding.test.ts` SHA256 `22761cb56614e7c861a227587c80bdd0280c49617ec3b3ab324bac3423908b9a`
