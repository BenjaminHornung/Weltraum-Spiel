# W07 input Preparing seam — independent quality supplement

Reviewer `/root/w00_repo_audit`; source/Git/hash reads only, no tests/build/browser or product writes. Original `fp06-w07-input-final-quality-review.md` is unchanged at SHA256 `e34b32c4ef7a53a9f23be1a47d89d82230bcdbebba80c2c73955f39ad89063c3`.

**CODE_QUALITY: FAIL — P1 Native/Client Preparing contract seam.** Actual runtime execution of this new counterexample is NOT_RUN by the reviewer; no RED result is inferred. The prior 83 tests did not exercise this seam.

## Concrete static trigger

A Factory Walking/Running owner already holds Down (and possibly one native pending jump). `physics/client.ts:409–415` sets `bodyPending=true` and sends BeginBodyCut without neutralizing native input. `physics/session.ts:353–355` calls `moving.begin` without neutralization; `bodyCutSession.ts:30,38–49` stores pending preparation, making `busy=true` while `holdsWorld=false`. `session.ts:325` therefore continues advancing the existing Native tick.

Ordinary Up is now discarded by Client's `canDispatchFactoryInput` bodyPending guard (`client.ts:212,383`) and by the native moving.busy guard (`session.ts:344`) if submitted directly. Client's local clear does not clear the native admitted level. Thus direct Client/Native API use can continue the old movement/jump through compile time until StageBodyCut's later correct `holdTick`. No new input-owned pose/tick is needed to reproduce this mismatch. This is an API boundary defect; it is not evidence that every normal browser release takes this path.

## Actual normal caller mitigation

`terrain/bodyCutConsumer.ts:37–45` sets its busy state synchronously before begin/compile. Normal Plasma confirmation (`terrain/plasmaTool.ts:78–85`) calls that consumer without an initial player stop. However, Factory Bootstrap's actual input blocker (`hvpBootstrap.ts:1365`) calls `factoryCanResume` → Factory read `confirmed` → `confirmed():1834–1836`, which requires the body-cut consumer to be Idle. Therefore ordinary KeyUp or the next RAF detects this busy consumer and calls `player/input.ts:63/157` stop. Stop sends explicit cancellation (`:45`) plus Pause; explicit cancellation bypasses the bodyPending/moving.busy movement guards and neutralizes native input. This existing producer barrier mitigates the normal UI path, but does not provide an intrinsic BeginBodyCut API guarantee and depends on that consumer/producer being present.

## Binding and next proof

The defect is bound to the original 30-path receipt `0f9272a18f2f968a8b68fd6735a4c59300b84c07babdad0fa702af6912aa09b7`. At this supplement's read, the four runtime delta bytes and other 25 held files still match that candidate. Root has authorized new unit assertions only; no fresh full-30 end-seal claim is made after such writes.

A real supported Native Preparing case must establish retained Down/Up/jump behavior before a minimal intrinsic fix, then verify neutralization without changing pose, velocity, enabled state, clock, moving-parent motion or Legacy behavior. New RED/GREEN, candidate seal, review and browser remain pending.
