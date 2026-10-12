# PLAY-03 independent review of actual normal-game captures

Reviewer `/root/play_art_review`; read-only inspection of the eleven actual PNG/JSON pairs, frozen driver, raw receipt, build receipt and bounded source bindings. No tests, build, browser/capture jobs, delegation or product changes were performed. This report is the only write.

**Verdict:** BOUNDED ACTUAL_UI PASS for the observed Start/Cargo/Walk hierarchy, deliberate material reveal and scrolled action reachability; BOUNDED ACTUAL_INPUT PASS for the observed Native pause/Play/neutral/release/fresh-press sequence. **Help/Pause presentation requires P2 corrections.** Actual 800×600/single-column behavior remains NOT_RUN. Owner style is **OWNER_REVIEW_PENDING**; S1, Save, complete factory flow and target-hardware acceptance are not established by this run.

## Exact evidence and build boundary

Run: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/play/2026-10-12/PLAY-03/20261012T121354Z-gamefeel-normal/`.

`01-actual-gamefeel-native-ui-input.command.json` records real Node argv/cwd, source HEAD `69a804fd53988334c6cbfc056951ed1c79b454f9`, Node v22.23.3, UTC `12:13:08.113166`–`12:13:45.657575`, 37.544 s, exit 0. Its decompressed 800-byte raw log independently hashes to `59ac832df5c224268408d710c8f8e4e3fd8fb1f9a54ec13024955910f9cbe5ab`. The 11,377-byte driver matches the pre-execution freeze SHA `8abf0f64e87501cb4ef32cf947c3811074b6bd959da9cfdd309d61f26733bae8`. All eleven PNGs were independently opened at original size; all eleven JSONs were inspected.

The 22 capture files are additionally bound by reviewer ledger SHA `5cb79d6dbf7ce3c964f31e2d2c5142c8ab652926001affec57837ae51ac176ac`: sort PNG/JSON filenames lexicographically, excluding execution/final-read JSON, then hash UTF-8 concatenation of `filename + NUL + decimal-byte-size + NUL + full-file-SHA256 + LF`. This is a read-only byte binding, not a new capture or test.

The existing real production build is `PLAY-02/20261012T112414Z-s1-binding/10-native-observer-original-build.command.json`: `npm run build` (`tsc -p tsconfig.json && vite build`), UTC `12:07:10.045155`–`12:07:14.525734`, 4.48056 s, exit 0, HEAD `f29501516afa2afd0802aa00dd2e43ebda7ba7fe`. Its 1,981-byte raw log independently matches SHA `52cc41379f90de6b698f46b608a0412b350b27519b81c845447fe86803f449a3`. Every one of the sixteen overlapping source bindings matches the subsequent capture receipt, including Entry, Session, HostPort, Bootstrap, physics/input and source fixtures. The build log lists the exact hashed JS/CSS/worker filenames subsequently loaded by the browser.

The actual browser entered `/factory.html` and fetched the built `factory-BHPQBVDl.js`, `factory-C4Yv534t.css`, Native worker and other listed chunks. Its eight committed UI file blobs at capture HEAD, and current UI file bytes, are independently identical to sealed UI commit `6b2e53eb0f1fd3b42a5d16ebe244fe7d0bc57199` / reviewed 54-PASS inputs. This establishes a bounded genuine build → production-entry → UI/capture source chain. The build receipt has **no complete output-SHA ledger or archived served-response hashes**; hashed filenames and matching source lists must not be represented as a complete byte-for-byte build-output seal.

Current Entry, Session, HostPort and hostLifecycle test bytes have changed since the capture, during later S1 work. Their recorded capture SHAs remain historical evidence; the capture does not accept the latest Integrator candidate. Current Bootstrap/physics/input and the eight UI files still match the pertinent bindings at review time.

`normal-ui/execution.json` contains one generic console 404 at `12:13:14.349Z`, with no URL. All twelve recorded response entries have status 200. Driver line 93 rejects page errors and recorded response failures, but does not reject this console-only entry. Therefore exit 0 means its bounded assertions completed, **not “no errors”**; the failed resource remains unidentified. No favicon cause is asserted. The renderer reports ANGLE/Mesa llvmpipe, so this is not target-hardware performance evidence.

## What the actual pixels and actions establish

| Captures under `normal-ui/` | Actual finding |
| --- | --- |
| `01-normal-start-menu` | Real 1280×720 production World behind the left HESTIA menu. New Game is primary; no competing world objective or workshop dock. Exactly one shell, diagnostic HUD hidden, TestBridge absent. Native is confirmed Paused and transport neutral. |
| `02-opened-finite-cargo` | After ordinary New Game → Werkstatt ansehen → Fracht öffnen clicks, the 341-kg Umform-Bausatz pickup and grouped material list are visible. No default wind transfer form competes with that primary pickup. One title and six inspector-local tabs; no permanent world navigation. |
| `02b-intentional-material-selection` | Driver line 58 clicks the first real material row, wind. The optional transfer detail appears, labels wind / two pieces / selected original one-piece lot, and its controls are visible. No transfer is submitted. |
| `02c-small800-material-actions` | PNG IHDR and JSON are **800×720**, not 800×600. Inspector remains two-column, approximately x16/y88/584×608. After ordinary `scrollIntoViewIfNeeded`, the entire disabled transfer action is visible above the footer. Current material remains wind. |
| `02d-wide1920-material-actions` | Actual 1920×1080 World and the same left inspector. Wind detail and full transfer action remain visible after the scripted normal scroll. The selected transfer amount is not a fabricated aggregate command. |
| `03-playing-after-native-ack`, `04-released-normal-walk` | Actual running player camera and clear play view. HUD is bounded to 316×64 at the upper left, Pause at upper right, one cargo-inspection action below; permanent workshop navigation is absent. The driver clicks real Play and waits for pointer lock, confirmed Running and active non-pending input before movement. |
| `05-modal-pause-and-help` | Actual field manual opens with readable control/help sections. Native remains Paused and movement-neutral during the tested keypress. However, a large unexplained dark rectangular backdrop and a false-looking rejection footer remain; see P2 findings below. |
| `06-held-repeat-after-new-native-ack`, `07-fresh-press-after-neutral-release` | Actual Play after a held key, then repeat suppression and fresh movement are witnessed by trusted key events, transport readbacks and changed camera/player position. No held-key restoration is inferred from a mock. |
| `08-final-confirmed-pause` | Native confirmed Paused, pointer lock released, no pending input RPC and material preserved. Save/Continue are visibly disabled with truthful reasons. The same dark backdrop and rejection footer prevent a blanket Pause-UI PASS. |

At 800×720, `.factoryShell.css`'s single-column branch (`max-width:799px` or `max-height:620px`) is **not entered**. This evidence closes the observed desktop/two-column action-reachability problem for the inspected sizes. It does not close the old 800×600 single-column pixel finding or establish behavior on smaller/mobile displays. The action is disabled because no destination has been selected; its visible placement proves reachability, not a successful inventory transfer.

The highlighted battery row in 02b/02c/02d is **not evidence of battery selection**. The frozen script clicked wind, and paired text/detail still names wind. Hover/focus can create another green highlight, but these readbacks do not store `activeElement`, `aria-pressed`, selector value or pointer position. Do not infer an incorrect lot command or a successful keyboard-focus journey from that screenshot. An active-selection/hover distinction remains a useful P2 visual refinement.

## Bounded Native input evidence

The driver uses visible button clicks and trusted CDP keydown/up events; it reads production diagnostics and does not alter World, pose, clock or material directly. `playing()` at lines 32–35 waits for real pointer lock and confirmed Running/active input; `neutral()` at lines 28–31 waits for released keys, zero desired movement and no pending transport IDs. The captured witness sequence is:

| Capture | Native ticks | Player x / z | State and ACK |
| --- | ---: | --- | --- |
| 03 | 105 | −5.5 / 11.875 | Running, pointer locked, sent/ACK 71/71, neutral |
| 04 | 240 | −6.15000248 / 11.875 | Newly pressed/released D moved x; sent/ACK 86/86, neutral afterward |
| 05 | 317 | −6.15000248 / 11.875 | Paused, pointer unlocked, 103/103, neutral |
| 06 | 355 | −6.15000248 / 11.875 | Running after new Play; held/repeat W did not move; 131/131, neutral |
| 07 | 428 | −5.5 / 11.875 | Release followed by fresh A press moved x by ~0.65 m; 152/152, neutral afterward |
| 08/final | 496 | −5.5 / 11.875 | Paused, unlocked, 167/167, neutral; final repeated read remains tick 496 |

Script lines 75–77 additionally compare live reads before/after an A press with the modal open and require identical Native ticks and x. Lines 81–85 close the manual while W is held, require actual Paused before explicitly choosing Play, then require neutral repeat and <2-mm horizontal displacement. These are genuine existing run assertions, not independent reruns; the stored pixels/readbacks provide their bounded visible and Native witnesses. They do not prove every lifecycle timing, focus-loss/replacement-session path, keyboard key or long run.

All captures retain source/terrain digest `913c0c46`, catalog `fnv1a:f3a8c642`, epoch 1 and cell size 0.125 m. Final cargo contents are exactly equal to initial contents: 79 original stacks and 2,984,400,000 mg. The sole changed inventory metadata is accessibility after opening; material revision stays 0. No installed facility exists in any capture. This run therefore proves neither paid construction nor the cutter/former factory loop, despite the task title's use of “build” for the production frontend.

## Concrete remaining findings

**P2 — Help/Pause falsely report an unconfirmed action after confirmed Native pause.** Both `05-modal-pause-and-help.png/json` and `08-final-confirmed-pause.png/json` show “Aktion nicht bestätigt. Status prüfen und erneut wählen.” while Native/Host are confirmed Paused, input error is null and transport is acknowledged/neutral. Current source provides a compatible race: `factoryShell.ts:189` opens Pause before dispatch; `hvpBootstrap.ts:2330` routes a newly opened surface through `pauseForFactoryFocus` at line 2319, setting pausePending; `factoryEntry.ts:111` then rechecks the pause capability, which is disabled while that pause is pending. The Entry file has since changed, so this is a source-supported diagnosis for Root's investigation, not a fully replayed historical cause. Preserve Native admission/ACK guards and make the UI result agree with the confirmed operation. Root has assigned test-first diagnosis to the shared Integrator.

**P2 — Large unexplained dark rectangle remains behind Help/Pause.** In 05 and 08 it spans approximately x100–1180/y100–620, extending far beyond the left inspector across the world. The earlier start/cargo/walk frames do not show it. Its owning DOM/render element is not captured, so a legacy panel/overlay attribution is unproven. Identify its owner and correct the actual layering before claiming polished Help/Pause visuals. The manual itself is visible; this is not a claim that Native movement leaked while it was open.

**P2 / bounded evidence gap — smaller responsive and precise focus state are unverified.** Actual 800×600 or width <800, first-view single-column material ordering, keyboard Tab traversal and active-element/selected-lot DOM state were not captured. The 800×720 screenshot and successful viewport bounding-box assertion cannot substitute for those. Existing 36/42/30-pixel control exceptions likewise remain; no general 44-pixel/WCAG claim is made.

The console 404 is an unresolved evidence-quality issue, with no observed recorded-resource failure or demonstrated gameplay effect. Keep it in the execution result; do not turn this run into “noErrors.”

**Acceptance boundary:** observed ACTUAL_UI and ACTUAL_INPUT behaviors above receive bounded PASS. Help/Pause visual/status quality remains CHANGES REQUIRED/P2. Owner appearance approval remains pending. S1 asset-to-voxel binding, animation/damage, Save/reload, complete W09/factory construction-production flow, map/history, broad accessibility, Art/terrain and target-hardware acceptance are NOT_RUN or outside this capture's scope. No style acceptance or complete prototype acceptance is inferred from the run's exit 0.
