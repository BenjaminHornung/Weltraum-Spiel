# W07 Factory input transport — read-only proposal after diagnostic68

Status: SOURCEONLY PROPOSAL; not implemented, no new IPC/runtime/test grant assumed. Existing29 product bytes remain exactly on the ninth seal. This document separates observed browser facts from the proposed technical transport boundary.

## Observed facts

Normal67 showed eight nonzero250ms D/A corrections overshooting a0.3m source-safe X window, with released stable NativeReads and Idle transactions. Diagnostic68 tried exactly eight trusted nominal125ms D pulses. All eight produced Native deltaX0 despite98–119 advanced NativeTicks per released observation. DOM down/up handler separations were138.8–205.7ms. Player owner/lock remained active and every observed World transaction was Idle. No overshoot occurred, so conditional63/50ms corrections were NOT_RUN. Outgoing Worker messages were not captured in68; therefore no exact browser input-message delivery timing is claimed.

Actual source establishes an independent reproducible loss case: client.readInput returns whenever busy; Factory setPlayerInput merely replaces the retained playerInput and marks it dirty. Down and Up while an earlier neutral Read ACK is withheld retain only neutral input. The next released Read sends neutral. The unit transport can prove that same Native Rapier owner never receives the down level while its snapshot ACK is held; it can then serve as the genuine pre-fix RED. No browser pose or clock is to be injected.

## Minimal proposed boundary

Factory-only FactoryInput {input,cancelPendingJump} is posted immediately through the existing request-ID/Pending≤8/20s mechanism, independent of snapshot Read busy. It receives a small ACK without Worldsnapshot, checkpoint, camera or source material. Factory Read continues existing snapshot/camera/aim polling but carries no input. Legacy/default preserves current Read(input) staging on update. No waiting input list, catch-up, minimum level latch, retrospective movement, new timer, changed speed or additional queue capacity is introduced. Full-level equality suppresses unchanged RAF intent; actual movement remains the Native60Hz step. Input dispatch by itself changes neither tick count nor pose.

The Worker applies it only to the live current Factory Session, and does not apply it during an asynchronous World replacement. Native Session checks disposed, Factory mode, Running+Walking and every actual terrain, structural, moving, neighbor, residency, facility and coverage boundary before accepting movement. Rejected stale/held intent receives a small ignored ACK, never an unconfirmed/held snapshot. Client input dispatch closes during commands, mutations and dispose; all late input ACKs remain unable to publish or replace public/held snapshots. The same Worker request identity and FIFO ordering bind the existing Session; no new session/epoch export is required when there is no retained input buffer and Restore is explicitly barred at both client and Worker.

Native jumpPending already intentionally preserves a Space edge through ordinary release. Its existing setter needs an optional cancel flag: ordinary Up preserves the unconsumed native edge, explicit stop/blur/Escape cancellation clears it before the next actual Native step. Repeated unchanged/RAF levels must never resend that consumed edge. Pause/Inspect/Play and replacement retain their current neutralization and barriers. Pending-cap overflow must fail closed by terminating the Worker rather than silently losing Keyup while native motion continues; the existing cap8 and deadline remain unchanged.

## Exact paths requested, no other product edits

1. src/hestia-prototype/physics/client.ts — immediate Factory input dispatch, pure small-ACK handling, Read isolation and command barriers.
2. src/hestia-prototype/physics/physicsWorker.ts — typed Factory-only message/ACK, current-session/restore admission and small reply.
3. src/hestia-prototype/physics/session.ts — actual Native authority/hold admission for Factory input; optional native cancel forwarding.
4. src/hestia-prototype/player/locomotion.ts — optional cancellation of already staged native jumpPending, preserving the original Legacy default.
5. tests/unit/hvp-player-input.test.ts — collectable genuine Native Rapier transport/stop/cancel/hold/late-ACK/cap oracles using its existing explicit transport harness.

Existing player/input.ts already produces real event intents and needs no write; Bootstrap, Assets, Renderer, Terrain, World ownership, Resources, Factory clock and normal E2E also need no runtime write for this boundary.

## Required actual business oracles before implementation

- Hold an initial neutral snapshot Read ACK, deliver Down through the real client, advance the SAME real Rapier Session by its existing Native step API: the actual native X must change before the Read ACK. Current source produces zero movement. No fake axis pose or synthetic tick count.
- After a down level reaches Native authority, deliver Up before snapshot ACK and advance again: no further horizontal displacement. Snapshot remains unchanged until its own ACK; input dispatch alone neither moves nor credits ticks.
- A new jump edge survives ordinary key release but explicit cancellation before the actual native step causes no jump; subsequent explicit update and RAF identical intent do not replay it.
- Native holds/paused/inspection/prepared/restore states admit no incoming move or jump, and late small ACKs cannot overwrite a held Prepare or a replacement snapshot.
- Pause/Play, Dispose, default Legacy and original8-pending cap countercases. Overflow fails closed with terminated Worker and no retained or resumed intent.

No tests were run while preparing this proposal. Root authorization remains required before writing the test or changing any product.
