# ExecPlan: RD12 launcher deadline owning repair

## Goal
Latch the one-shot launcher expiry even while its owned job is busy. Reject new
requests after expiry, let the existing job/receipt settle, then stop the control
interval with nonzero exit status on success or rejection. Preserve normal stop.

## Context
Start `92de788c5f96447330435579ffa20818c81b79d8`, tree
`c6d6344c3475138fb7c3a14ae80f8ffc15bae446`; required repair direct parent92.
The actual footer of `phase2-launch.mjs` currently loses the deadline while busy.
HEAD proof `rd12-native-head-92de788c.json`:
`2c4adf93c3ed18d6963c0bf68b05971e0e7b1c76077648c0c60f74b5cfd9c165`.
Root README/current-mainline-state, `.agent/PLANS.md`, actual launcher/run helpers,
all launcher callers and the read-only boundary procedure were inspected.

## Non-goals
No native/browser/server/port/GPU run, delegation, deletion or publication. No
runtime, root, shared, dependency, package, fixture, original native test, reader,
config, oracle, media or old binding-helper changes. Programme NOT_READY and
`productIntegrated=false`; original0/16 and supplemental12/16 remain unchanged.

## Architecture decision
Use one inline expiry flag in the existing footer, not a new timer framework.
Keep the actual run/one-hour timeout/receipt implementation byte-identical.
Evaluate only that actual footer in Node VM using controlled timers, in-memory
filesystem, deferred job/receipt promises and mock process status. Do not import
the native launcher. CPU clocks are not native/managed timing evidence.

## Implementation phases
1. Seal and run ONE focused four-case test against actual original92 footer;
   preserve expected RED source/test/receipt bytes before patching the launcher.
2. Apply the inline latch; run the exact same sealed test GREEN.
3. Verify source713, prior269 evidence except the sole launcher delta, slice253,
   local LFS84, build509, frozen lease/proofs and all old native results unchanged.
4. Run focused/root types, launcher syntax, full52 scope guard (taskRD12,
   start92/baseb3), self-review, exact scoped local commit and postcommit bindings.

## Tests and evidence
`tests/RD-12/launcher-deadline.test.mjs`: idle expiry; busy expiry with receipt
pending and rejection of further work; job rejection/error receipt before exit;
cooperative stop while busy, then normal close with no extra accepted request.
`reports/RD-12/launcher-deadline-repair.mjs` owns fresh CPU receipts in
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/launcher-deadline-repair-92de788c-20261004-a/`.
Old helpers remain unchanged; no old strict5e gate is redefined or invoked.

## Risks and safe stop
Do not confuse fake-clock correctness with live native lifetime proof. Preserve
all old native failures and images. Stop on a material authority/schema mismatch
or exact execution blocker; never reset/reparent/delete or invoke native work.

## Progress log
- [x] Confirmed actual busy deadline root cause and exact five-file write scope.
- [x] Original RED: two busy-expiry failures/two passes, exit1, no timeout.
- [x] Same sealed test GREEN: four passes, exit0, no timeout; only inline latch.
- [x] Focused/root types and launcher syntax checks passed with actual exit0.
- [x] Initial preservation passed: source713/evidence268/slice253/LFS84/build509.
- [ ] Final scoped diff/check/52 guard and postcommit evidence: actual status is
  carried by external `candidate-deadline-final-01.json` and
  `closeout-deadline-final-01.json`, not a recursive precommit SHA claim.

Original launcher SHA256:
`019f00ba6b24bd1b2ffd9bfc8a78b08faacf7e7f5d91f818fbe7aacc34965562`.
Same RED/GREEN test SHA256:
`bc29da70db511402fb5c1218080ae18485aec381f0334feb7c2ce9336e750124`.
No new native or managed-runtime timing evidence was produced.

## Definition of Done
Four deterministic cases pass after genuine original RED; same test bytes in
both receipts. Exactly launcher plus the new focused test/helper/plan/handoff
change. Fresh actual exits/timeouts/hashes and full SHA/tree/direct92 identity
are delivered externally without recursive committed proof claims. All prior
native/media qualification results and automatic-log exception stay unchanged.
