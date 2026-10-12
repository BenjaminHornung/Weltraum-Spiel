# W09 Cargo UI — independent sealed precommit review

**Scoped SOURCE / CONTRACT / QUALITY / retained EVIDENCE: PASS.** Checked 2026-10-11 21:45–21:46 UTC. No product/evidence edits or new tests, builds, browser/native actions. No additional correction required within this narrow candidate.

## Bound subject

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-ui-w09-2026-10-11`, branch `codex/hestia-fp06-ui-w09-2026-10-11`; actual HEAD/base `24c274e2302452c5fa305e5ca37d6935bbff55ba` plus sealed WIP. Run `apps/weltraum-browser/evidence/factory/w09/ui-cargo-20261011T214209Z`, sealed 21:45:06.504588 UTC.

- Product seal: 1660 B, SHA256 `2722578365bf46b11d6924dc549b66023d29f0757d3b53243a1d8a9885f05423`.
- Product patch: 6430 B, SHA256 `fb063ff05858eb160f6817b3942dbc4e0d5ce92b5d25aad85cf2e50515e31927`; actual Git diff against base is byte-identical.
- Manifest: 3697 B, SHA256 `ab822f4e21614eacd4cfd8492ef28d02f174028e0f4c1f35414c35fcf5138ef3`.
- Writer report: 6263 B, SHA256 `d6eb2bfeb4d7e5af2a9e42416e53b5eb8af039f2e4019d68cfea22ecbeb3546b`.

Actual scope exactly **15 changed paths = 2 products + 13 ownrun files**. All **12 manifest references / 23412 B** match actual hashes and sizes; no extra run file. Index empty; actual `git diff --check` Exit0. This is PRECOMMIT, not a new HEAD/LFS binding.

## Code and contract

`src/factory/ui/cargoPanel.ts` 15782 B, SHA256 `f899ffb7d5f062272c8f7693325981f9e789f3aec28716941a0522731d0356e5`: only three inserted lines and one replacement. Active handling controls and local transfer form now precede inventory. Inventory remains complete, receives a labelled keyboard-focusable region and its own `max-height:min(32vh,20rem);overflow-y:auto;overscroll-behavior:contain` boundary. This bounds list height; it does not claim a DOM-object count cap.

All source stacks, pickup profiles and command `sourceLots.map(...)` remain unchanged and untruncated. There is no new quantity, timer, authority, optimistic inventory, command identity or capability shortcut. Existing Host-enabled actions, exact finite transfers, pending/replay/stale checks, focus neutralization and Dispose are untouched. Persistent control nodes are created once; moving their initial append order does not rebuild them on publication. The newly focusable inventory participates in existing bubbling focusin/focusout handling.

`tests/unit/factory/panels.test.ts` 23331 B, SHA256 `caf724755fb9a2cd11670172bf3a48e7de9dd8580b0b40ee51d9fa8a68722006`: 41 added lines. Two regressions exercise a synthetic 79-lot view, complete lot/options preservation, control-before-list order, independent scrolling metadata and amount/source/pickup node identity after publication without issuing a command. This is document-double evidence, not actual browser layout/activeElement or Native transport evidence.

Machine, power, technology and `session/hostPort.ts` are independently byte-identical to base and their sealed reference hashes. Frozen HostPort remains SHA256 `07b7a3e6ecf4b94fed367585dc4c094cb906d5688985e23177362867a3dc945c`.

## Actual command evidence

All **3 gzip→raw→external-original byte pairs** match contemporaneous receipt SHA/size and report-embedded receipts: 4606 raw B / 2029 gzip B. Retained cwd and argv identify this WT/application. Original ANSI/control bytes remain preserved.

| Phase | Actual retained result | UTC interval | Raw bytes / SHA256 |
|---|---|---|---|
| 01 RED | Exit1; 2 assertion FAIL, 13 skipped; no import failure | 21:42:09.930466–21:42:10.684145 | 2356 / `660c495390d0a9acc3133afa210720b7505261790bef93bd41cbb8297be2ba25` |
| 02 GREEN | Exit0; 15/15 UI PASS | 21:43:26.679975–21:43:27.445435 | 346 / `1259f7896c37527a5d74fc9c3e288528136867c99b1f9acfcd645cccad94d198` |
| 03 Build | Exit0; original `tsc -p tsconfig.json && vite build`; retained chunk-size warning | 21:43:27.446386–21:43:31.446079 | 1904 / `15a63f72960068bd26644edc6f9e0dc71c398f71b14af0c34c7d568c9e4f8d02` |

Final repeated static hash read confirms the two products and all manifest references remain sealed. No command was rerun by this reviewer.

## Remaining scope

The narrow code change resolves list-before-active-controls structurally. Actual normal-browser screenshot, responsive geometry, keyboard focus/release/resume and full W09 gameplay remain **NOT_RUN by this candidate**. The outer Entry panel, legacy central HVP hints and separate C1/P1/C2 findings are untouched. No human Owner Art acceptance, Native/game-loop acceptance, package/commit PASS or Root commit/copy admission is implied.
