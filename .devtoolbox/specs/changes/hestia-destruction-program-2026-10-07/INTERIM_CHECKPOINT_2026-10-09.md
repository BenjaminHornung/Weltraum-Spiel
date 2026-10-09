# Hestia interim implementation checkpoint — 2026-10-09

This is the requested external-review snapshot of ongoing work, not a completed phase or Planner acceptance. Branch: `feature/hestia-destruction-program-2026-10-07`; previous checkpoint: `584b945ede46f4099c28ebb2411714d346c485ac`.

## Current implementation

Phase1 contains the current combined32³ Render/Collision chunk compiler with shared34³ halo and strict complete identity/custody validation, the private render admission path, Cold ancestor preparation, private initial/live parked body Recipe reuse, and normal preview resize/reset/lifecycle repairs. The latest small change skips both mesh scans only when every validated halo byte is air, using the shared empty quad materializer and the normal complete eight-buffer output path. The combined contract is preserved.

Private body Wake reuses the exact branded owned Recipe/Source; live park captures canonical motion/surfaces through the existing strict Save encoder/decoder. Legacy first-party sources prepare once at park under the existing96/256MiB ledger. The ledger remains active through checkpoint measurement and native custody outcome. Active/parked/Inertia/retained Branch and original/current collision identities are accounted; Dispose drops the session-owned roots. Public Save schemas/decoder and IPC contracts remain unchanged.

## Verified and incomplete

- Private-Wake regression:95 passed,0 skipped (40 Native/Save/Worker cases and55 report cases). This includes actual player return→Wake→Applied recut→Save→Dispose, complete64-brick owner and metadata/trust/cap/uncertain-removal cases.
- Latest combined chunk regression:104 passed,1 conditional coexistence case skipped; that case must run explicitly before the next acceptance run. TypeScript and product-r31 build succeeded. The prior full512 packet oracle passed before and after the All-Air change with identical SHA `314aa27bf2a0fee5d94ba9b4221a8b717125e2c03a5329cfa71b68574c7af809`.
- Same sealed saved-input adapter:137 All-Air jobs active work245.713→38.187ms; other-job work also varied. This supports the local All-Air saving only, not an attributed whole-game performance gain. The512 jobs, complete packets, collision/layout/population and logical resource cleanup remain intact. Physical heap is unproven.
- Latest game pair r36 exited1 and is wholly invalid. Both variants completed three main Cuts, and the candidate completed two Saved-session End receipts with Native Disposed, ten zero counters/cache0/Cold-retained0. Control failed its15s neighbor/Wake check; candidate later failed the30s authored Ready check before HUD after26.173s terrain compilation. Candidate individual main input-to-render values707.1/705.8/462.6ms are diagnostic only. Its final attempted startup cleanup is unproven. The test driver now captures preparing state safely and waits for mount within a separate30s cleanup budget; this repair still needs real browser proof.

Only G0 and historical D1 mechanisms are qualified. D2–D4 remain in progress; D5, S1–S4 and M1–M8 are open. Formal14→42→1400 and final Planner acceptance have not completed. No threshold, quality, deadline or cap was relaxed; no collision-only exception was implemented.

## Next work and authority boundary

Run the explicit coexistence/cancellation check and actual preparing-cleanup proof, then bind the latest Source/build/HTTP and rerun the required real game/Save/Cold/Wake/recut/contact/End checks. Continue within the authorized phase order. Omitting unused East render computation through a separately bound collision-only derivative still awaits the user's explicit contract decision; see `tests/D3/EAST_COLLISION_ONLY_DECISION.md`.

Generated builds, screenshots, full raw game histories, and duplicate frozen Source trees are preserved locally. The review checkpoint includes the current code/tests/configuration, task documents and selected small receipts; it does not claim that every local generated artifact is present in Git. See `RESUME.md` and `TASKBOARD.json` for continued work.
