# UI-CERAMIC-01 / ENGLISH-01 — scoped implementation checkpoint

Base SHA: `f0a901db4ea3cfc64061dca3a2a89cc92f38fc6e`. Branch: `codex/hestia-fp06-play-candidate-2026-10-12`. Integrator and only implementation/art writer: `/root`, in the existing local Integrator worktree. `/root/ui_ceramic_readonly_review` inspected source and prepared translations; it made no repository implementation/art writes, prepared a translation copy draft in /tmp, and did not run Blender or the browser. Source commit is recorded in the checkpoint receipt after commit creation.

Owner-approved references are preserved under `art/factory/visual-reference/2026-10-13/`. Actual package grants are in the W00 control worktree at `docs/factory/fp06/play/2026-10-12/grants/ui-ceramic-owner-approved-2026-10-13.json`. Existing Source/Write locks were preserved. No foreign changes were overwritten and no branch was merged, pushed or published.

## What changed

Existing Factory panels use cream ceramic / petrol, cut corners, an objective at upper left, a source-bound minimap at upper right and one contextual inspector. Cargo selection, build preview, production input/output/offcuts, requested versus allocated power, technology, pause/help and start/continue labels are English. English presentation also covers normal browser entry, graphics/proving-ground panels and HVP/player statuses. Stable IDs, catalog/source/save fields, legacy input compatibility and user-entered text are preserved. The exact legacy-string map converts published German descriptions for display without rewriting frozen facts.

Fourteen thumbnails were rendered from existing native Blender sources and are actually used by the panels. The new approved crashsite has separate native source, GLB and three genuine Blender previews; it is a static public build candidate, NOT_ADMITTED by the closed Play loader. See the adjacent crashsite status. There are no paid-provider or engine/dependency changes.

The minimap is deliberately the currently published start-site footprint/path map. Its producer publishes `heading: null`, so the normal game shows a player dot. It does not yet show the reference's detailed coastline or invented heading/paths. UI and machine-asset theme customizers remain planned; this change supplies shared visual tokens and one approved direction.

## Gates, separated

| Area | Result | Evidence and limit |
| --- | --- | --- |
| Functional panel commands/projections | PASS (bounded) | 110 focused tests in 7 files; pending intent, finite source lots, stale/foreign views, frozen recipe admission retained |
| UI normal input | PASS (bounded) | Production screenshots at 1280×720, 1920×1080 and 375×812; package choice, rejected build, choose-other, keyboard move/rotate, views, Tab/Escape, explicit Play/recovery |
| English normal entry | PASS (bounded) | Actual `/` flight HUD and Graphics open/escape, no TestBridge or page errors; source review found no remaining direct rendered German in scanned paths |
| Clean copy install/build/start | PASS (bounded) | Materialized browser/Factory source, locked npm ci, npm run build and ordinary entry/workshop smoke; not full gameplay acceptance |
| Save / browser-restart production | NOT_RUN in this checkpoint | Copy and presentation changed only; no W10 completion claim |
| Visual implementation acceptance | OWNER_REVIEW_PENDING; design QA BLOCKED | Native asset/reference comparisons supplied; detailed minimap and new in-game hull remain absent |
| Full 16 kg gameplay loop / heavy installation | BLOCKED / NOT_RUN here | Existing private prepared-receipt mismatch reproduced on pristine base; no fabricated material/position authority |
| Performance | FAIL for this cloud presentation sample; full gameplay gate NOT_RUN | Xeon Platinum 8573C, 4 CPU quota, llvmpipe software GPU; isolated 30-frame paused sample median 516.5 ms, p95 1416.6 ms |
| Whole regression suite | FAIL | Historical draft run: 2,419 PASS / 21 FAIL; targeted repaired UI/copy paths now pass; five identified source/timeout cases remain unresolved |

The last normal-input run captured **SimulationHold at native tick 27**, then recovered through the actual enabled control to confirmed Paused. Its harness incorrectly overwrote a possible caught start-gate failure with `START_CONFIRMED_THEN_SIMULATION_HOLD`; this enum is not proof of the required Running/tick≥30 criterion. `HARNESS_LABEL_AUDIT.json` documents the error without changing raw evidence. Earlier raw captures separately show confirmed Running/Ready at tick 30 or later; those are bounded start observations, not sustained gameplay acceptance. The simultaneous-browser 180-frame sample is marked diagnostic only; the isolated sample is recorded separately. No global timeout, queue or resource limit was increased.

## Open source failures / next dependencies

1. W07 paid owner install: `Factory private prepared receipt binding mismatch`; the same case fails at pristine base f0a901. Native transaction/receipt closure is required before dependent installation evidence.
2. Coast ownership/addressing test exceeds its existing 60-second budget even alone. Source and test are unchanged here; this deserves a bounded addressing-loop investigation rather than timeout expansion.
3. Paid-band output blockage test exceeds its existing 5-second budget in the broad run. The frozen source/test were not changed by this UI work.
4. Two derivative-admission tests are blocked by an older authoring script's frozen `factoryAssets.ts` SHA. Current source and authoring script match the base, but actual SHA-256 is `8b027d2a9eb30cdc65a30fd7fd7792dfd6ddb6c2a06233f89f75e1b78b42be8f`, while that script expects `a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c`. Do not silently weaken the source-lock gate.
5. Native wreck admission needs a concrete placement/support/collision/LOS/depot/exit/budget/save contract. Static gun art supplies no ammunition or safe-area authority. Current cargo and terrain are unchanged.

After those gates: finish W09 using fresh produced material and ordinary input, W10 shared save/recovery and W11 gameplay/visual/performance. The 16 kg = 5.8 kg installed brace + 3 kg profiles + 5 kg sheet + 2.2 kg offcuts proof is still required. Balancing V2 remains a separately gated proposal. No W12–W29 was started.
