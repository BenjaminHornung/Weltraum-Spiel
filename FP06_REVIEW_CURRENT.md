# Hestia FP06 — current external-review checkpoint

Status: **work in progress, explicitly requested source snapshot for review**, 22 October 2026 (Europe/Vienna). Branch: `feature/hestia-fp06-review-continuation-2026-10-15`. Parent checkpoint before this commit: `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`. Use `git rev-parse HEAD` for this snapshot's final commit identity.

## Scope and review entry points

This snapshot includes the accumulated FP06 continuation: measured composition/hold repairs, approved compact receipt V2 with V1 save compatibility, combined checkpoints, normal cargo/input repairs, the approved V6 walkable hull, and the current five visual repairs. It preserves the actual newer Candidate work rather than substituting old main. No merge to main is requested or performed.

For the current five-point task, start with `docs/factory/fp06/play/2026-10-21/visual-repairs/EXEC_PLAN.md`, `PROJECTION_BOUNDARIES.md`, `B09_ACTUAL_RENDER_CORRECTION.md`, and `VERIFICATION_R03.md`. Earlier decisions, failed attempts and accepted V4 gameplay evidence remain historical evidence; they are not silently relabelled as final V7 acceptance.

Current source freeze:

- Bootstrap: `F2085D2E5A14C333E12AAF937997B0440D3606B3F8DCE62B777AC4BA45CAA2B5`.
- Closed asset loader: `2AB8C87791E9E1A4540F8D9847809B7D8C113A5DE57B2DDC6FB955F7ACA4A387`.
- Independent review: 83 protected baseline entries (81 unique files), zero differences; 1,043 selected source/evidence files match the clean V7 copy. Original ReadyV4 manifest remains `B350825F79B4AEA4FED830B03166461590185BD711B9C8DC923AE96242D40DE5`.

## What is actually verified

1. Distributor V2 has source/byte parity checks and earlier actual front/oblique views without the original coplanar stripes. B09 V2 retains Native bounds and removes 118 positive coplanar shell/structure pairs; settled V7 screenshots show real paid stock on its interior floor.
2. Factory-only decor projection, material readability and paid cable/stock/packet presentation are implemented. Original Native assets, colliders, saved plant data, safety guards, limits, Clock and Goldens remain unchanged for these visual repairs. New private presentation data and memory accounting are described in the task documents.
3. Actual V7 R05 play paid two 8 kg raw batches from the existing cargo, completed both Cutter jobs and both Former jobs, producing 7 kg profiles and 7 kg sheet. The old 8 kg of products was separated into Storage 5. Screenshots include two Cutter and two Former poses; measured tool displacement is 0.5 m, and 600 ms Pause checks kept work/parts unchanged. One 8 kg belt packet advanced 375 mm between confirmed observations. These are direct normal-input checks, not TestBridge or injected resources.
4. The final fresh hand-assembled brace is **not complete**. Two pickup attempts were rejected by unchanged `CarrierOverlap` guards. Source tracing confirms the carrier anchor is actor-relative and independent of camera heading; the historical accepted pickup was at approximately X=-5.303133 m, Z=-3.457105 m. No collider or clearance guard was relaxed. A route off the narrow apron also required an ordinary Load; that failed route remains a failed attempt.
5. The previous unsaved R05 browser session ended between turns. Its screenshots remain, but in-memory observations were lost. R06 reopened the same profile and used ordinary Continue: original Save19 SHA-256 is still `a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0`, Native tick48547, 15 bodies and 200 colliders. No primary Save was written. The session is paused for this requested commit/review checkpoint. Final continuous hand-assembly, integrated Distributor/Power views and final controlled close/restart/input replay remain open.

The prior accepted ReadyV4 full production/save/restart result is documented in `PLAY_CURRENT.md` and `FP06_V6_GAMEPLAY_ACCEPTANCE.json`; it must not be substituted for the unfinished final V7 acceptance.

## Verification record and limits

Clean V7 was copied from the actual Candidate (1,043 files), installed with `npm ci --offline` against the existing local cache, and built successfully (335 modules; existing Vite chunk-size warning retained). Its bundles include `factory--rfCeDR7.js`, `hvpBootstrap-4rGlpNqo.js` and `playAssetLoader-Dp0Y_UBV.js`.

Earlier focused checks passed: TypeScript, loader72/72, new B09 parity2/2, focused admission5/5, production/conveyor52/52, and host lifecycle87/87. A broad Bootstrap/plant run retained its two cold-hook timeout failures; the two cold cases later passed in isolation. Four historical derivative tests require absent shallow-history Git objects; they were not weakened and old Goldens were not rewritten. A fresh precommit TypeScript/four-suite result is appended below when complete.

Fresh precommit check on22October: `tsc -p tsconfig.json --noEmit` PASS; `vitest run tests/unit/factory/playAssetLoader.test.ts tests/unit/hvp-vegetation.test.ts tests/unit/hvp-visual-effects.test.ts tests/unit/factory/panels.test.ts` PASS, **4 files /112 tests**,29.71s, exit0. Product/source/asset diff whitespace checks PASS. The full staged historical evidence retains its original trailing whitespace/blank lines, including failed patch and diagnostic output; those records were not rewritten merely to satisfy a formatting check. These checks do not close the remaining actual gameplay acceptance.

Precommit transport correction: the repository now publishes the scoped Play-GLB Git-LFS rule previously supplied only by local attributes. Nine specifically named new asset JSON receipts retain their exact original bytes through `-text` overrides. This avoids normalizing CRLF in the two hash-bound public sidecars and invalidating their loader pins in a fresh clone. No runtime, asset, Native or saved bytes changed; original JSON/Golden rules are unchanged.

The performance diagnostic window is closed. No new FPS, CPU/GPU profile, AST/Core/weather run or claim of improved frame rate is part of this checkpoint. No new dependencies or broad replacement asset packages were added.

## Reproduce from a clean checkout

From `apps/weltraum-browser`:

```powershell
npm ci
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5197 --strictPort
```

Open `http://127.0.0.1:5197/factory.html` in external Chrome. A fresh profile starts a normal new game; existing local progress belongs to its original browser profile and origin. WASD/mouse play, Esc pause, I inventory and contextual E cargo use the existing controls. Continue and Play remain explicit user actions. Browser profiles, raw saves, credentials, `node_modules`, `dist` and TypeScript build cache are not committed.

Historical local videos are retained locally and omitted from Git (71 files, approximately1.44GB); JSON/text/screenshot evidence and the source assets needed to reproduce the candidate are included. This is a review checkpoint, not a sealed final ReadyV7 delivery.
