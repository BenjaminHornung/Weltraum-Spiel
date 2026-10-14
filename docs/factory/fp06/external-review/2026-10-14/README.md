# Hestia FP06 external review — 2026-10-14

This branch contains the current Three.js/HVP/Voxel/Physics partial implementation, actual Blender and runtime asset payloads, visual references, English player UI, complete committed evidence and preserved historical partial runs.

**Current overall delivery: BLOCKED. This is not an accepted complete W09–W11 prototype.**

## Read first

- `docs/factory/fp06/play/2026-10-14/composition-closure/RESULT.md` — latest executed candidate and original performance gates.
- `docs/factory/fp06/play/2026-10-14/composition-closure/FINAL_CHECKPOINT.json` — exact source/rollback/test/evidence closure.
- `docs/factory/fp06/play/2026-10-13/native-continuation/REPORT.md` — broader gameplay/UI/Save/Visual boundaries.
- Control branch `codex/hestia-fp06-w00-2026-10-11`: source locks, write ownership, grants, proposals and reviews under `docs/factory/fp06/`.
- Relevant original FP06 package/source plans and README/AGENTS.md. Historical research does not override current grants or source.

Implementation source checkpoint before this evidence-only review commit: `9ebd8cad469651edb1d47023c8d58041d4f32672`. Sole current Integrator is `/root`. No source, recipes, budgets or runtime behavior are changed by this review snapshot.

## Current measured status

- Latest bounded owned-data candidate: **FAIL and fully reverted**. Original 5,000 ms gates took 8,164 and 20,463 ms; one permitted pair, zero subsequent CPU profiles.
- Five retained baseline business guards passed; complete Production/Conveyor/Dry baseline/candidate/restored bytes agree. They do not establish complete gameplay acceptance.
- Latest normal browser: actual 341 kg pickup followed by NativeSimulationHold on the first loaded move. Full fresh 16 kg loop, common Save/restart and final performance acceptance remain missing.
- W09 BLOCKED; W10 BLOCKED_NOT_RUN; W11 PARTIAL_BLOCKED.
- Terrain/visual/gameplay human acceptance: OWNER_REVIEW_PENDING. The larger damaged wreck is real Blender/GLB work; authoritative wreck admission and acceptance remain open.

## Reproduce the source

```bash
git clone --branch codex/hestia-fp06-play-candidate-2026-10-12 https://github.com/BenjaminHornung/Weltraum-Spiel.git
cd Weltraum-Spiel
git lfs pull
cd apps/weltraum-browser
npm ci
npm run dev
```

Use Node 22 and the checked-in lockfile. Existing build and browser instructions also appear in README_PLAY.md where available. Factory entry is `/factory.html`. UI and renderer remain projections of the native/domain authorities. Local tools may require the documented Chromium/Mesa wrapper on CPU cloud machines; no target-GPU PASS is claimed.

The original performance command is documented in RESULT.md; its approved implementation window is closed after failure. Reviewers can inspect archived exact logs/bytes. Any new optimization must respect an explicitly granted path/iteration window, original scenarios and limits.

## Evidence and assets

`HISTORICAL_EVIDENCE_MANIFEST.json` binds 676 pre-existing, previously untracked evidence files by path, bytes and SHA-256. These include 80 screenshots, 12 videos, prior failed/partial runs and five existing CPU profiles. Uploading them does not run a new profile or change any recorded result. No new gameplay or performance acceptance is inferred from this archival commit.

Blender sources live under `art/factory/`; actual runtime payloads live under `apps/weltraum-browser/public/factory/`. Fetch LFS payloads before image/model review. The reviewed owned-data run separately has its verified manifest and exact raw `.log.raw.gz` archives.

External review should report Functional, UI, Save, Visual, Gameplay and Performance separately. Preserve finite C01–C28 cargo, material/energy custody, confirmed tick processing, collision and authority boundaries. No W12–W29, engine/dependency migration, main merge or force-push was performed.
