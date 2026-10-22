# WXG-07 normal research-source adoption — 2026-10-21

This directory continues the existing WXG-07 research package in the normal A0 checkout. It is research source, not application-world or product adoption.

All 383 existing files were copied without overwrite from `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-WXG-07-2026-10-09/spikes/wxg-07-grid-dynamics`. The original producer is preserved byte for byte. Only `tests/replay.test.mjs` and its existing `SourceBindings.json` test row/provenance are updated; this note is the only added package file. Sources, dist, fixtures, implementation digest, InputBindings, package and compiler lock remain unchanged.

The existing accepted seven-day checkpoint-tail case is integrated into `tests/replay.test.mjs`, reusing its imports and omitting only the machine-specific Node-version assertion. The one-hour and 24-hour cases remain intact. The complete five-entry package suite is checked with absolute paths from the private recorder CWD. Fixtures and the existing harmless worker resolve via import.meta. Current results are recorded separately under `.a0-runtime/benni-pc-wxg07-normal-source-adoption-r01` and in `TARGET_PC/WXG07_NORMAL_SOURCE_ADOPTION-20261021.md`.

## Historical evidence — HISTORICAL_ONLY

The following nine copied records remain immutable historical producer evidence. They do not prove the current adoption, a fresh build or current test success:

- `HANDOFF.md`, `REPORT.md`, `receipt.json`, `runner-profile.json`
- Every file in `.runtime/` (five files, including nested historical reports)

`SourceBindings.json` retains the historical producerClosure reference with explicit provenance. Current receipts remain outside this package.

Fresh build is NOT_RUN: 533 of 861 original input entries are unavailable under `inputs/wxg/node_modules`. No replacement, relocation or installation is performed. Build, repro, matrix, producer verification, sealing and fixture generation are NOT_RUN. No gameplay, physics, GPU, M5, browser or Save run is authorized by this adoption.
