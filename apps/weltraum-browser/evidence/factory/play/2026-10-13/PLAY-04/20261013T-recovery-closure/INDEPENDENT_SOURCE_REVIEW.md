# Independent read-only Recovery source review

Reviewer: `/root/blocked_band_readonly_review`; Root retains sole shared integration ownership. Actual revised source reviewed at local HEAD `eb84b3e06b8e4f1b01cc4cca93b0fbafbc46e80a` plus the granted 14-path draft.

Initial findings: recovery could release a newer focus Pause fence; unavailable actual Host read could fail to establish Session RecoveryHold. Root reproduced both with business RED tests and implemented independent recovery/focus-Pause fences and conservative terminal binding loss. A further private confirmed-projection race was also reproduced and fenced by recoveryBusy.

Actual Browser09 then exposed stale published UI after the recovery fence cleared at the same tick. Business RED10 reproduced this: Session Ready same-tick observe returned without refreshing the UI. A derived trusted-Host header witness now notifies UI for changed same-tick headers while suppressing identical reads. It grants no work/native tick and leaves workHoldReason clearance baselines unchanged.

The reviewer rechecked the new source and Entry optional capability guard; no remaining bounded-contract source findings. Header is updated before notification, so reentrant identical callbacks do not loop and nested newer observations are not overwritten. Existing paid reconcile remains part of notifyUi; no claim that all notification is pure.

Reviewed current SHA256: factorySession.ts `5863df90e7e4c36f8a79c54b4249f9acc8223f995522d99dc177ebd2eab03d4f`; factoryEntry.ts `ef393b60724fa8d0d0e01abaf91980e123a9c323e78515b6d8f07b80ddc17d87`; hvpBootstrap.ts `94e2dae1ab702a9a2f14afd28c9fc7f835962f1b0a5f8d91affc6145ea80e6bf`.

This is SOURCE_REVIEW_PASS for the narrow recovery contract, not full W09/Save/Visual/Gameplay/Performance acceptance. Reviewer performed no edits, tests, browser/profile/CPU jobs or delegation. Root owns verification; actual failures remain retained.
