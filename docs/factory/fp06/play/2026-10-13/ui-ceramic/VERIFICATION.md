# Actual verification and reproducible commands

All commands below ran on 2026-10-13 UTC. Use the logs under `apps/weltraum-browser/evidence/factory/ui-ceramic-2026-10-13/`. The project uses the existing pinned Node 22.23.3, npm 11.9, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.11, Chromium 154.0.8037.57 and Blender 4.3.2. No dependency or lockfile changed.

From `apps/weltraum-browser`, the actual final focused invocation was:

```bash
node node_modules/vitest/vitest.mjs run   tests/unit/factory/factoryShell.test.ts   tests/unit/factory/gameUiPresentation.test.ts   tests/unit/factory/localMap.test.ts   tests/unit/factory/onboarding.test.ts   tests/unit/factory/panels.test.ts   tests/unit/hvp-interaction.test.ts   tests/unit/hvp-player-input.test.ts --reporter=dot
node node_modules/typescript/lib/tsc.js --noEmit
node node_modules/vite/bin/vite.js build
```

Result: **110 tests PASS, seven files PASS**. Typecheck and final production build exit 0. Existing chunk-size warning remains. Native Bootstrap copy regressions: 2 PASS / 50 SKIPPED and restart 1 PASS / 51 SKIPPED in separate targeted invocations; skipped cases are not accepted. Earlier local-map/presentation post-visual checks: 28 PASS. Tests for finite material, recipe/source admission and pending receipts retain their actual checks; only English UI selectors/expected copy were translated.

TDD logs contain expected red states for source-bound map, material/power/retained-job presentation, intentional cargo selection and English technology strings, followed by green focused runs. The broad run was started during the translation draft, so its 21 failures are preserved as historical results, not relabeled as final passing totals. Targeted current results and unchanged-source proofs are separate.

Normal production browser harness: `capture-production-matrix.mjs`, no TestBridge. Captures cover New game, disabled Continue on empty storage, actual cargo open and package selection, rejected Confirm build, choosing another facility, 250-mm grid arrow/quarter-turn rotation, unchanged material balance, empty machine/power, technology, map, Tab capture, Escape preserving pause, desktop/narrow HUD, explicit Play and available recovery. Screenshot JSON before/after captures is retained because native state may change during software-rendered capture. The final enum mislabels the start gate when Hold is observed; the independent reviewer caught this. Raw tick/status observations and HARNESS_LABEL_AUDIT.json take precedence: final run shows Hold at tick 27 and confirmed Paused recovery, not a passing 30-tick start.

`main-and-focus-smoke.mjs`: ordinary `/`, Graphics open and Escape, English copy, no TestBridge/page errors; keyboard Tab reaches objective with actual inset focus style. `capture-cargo-post-qa.mjs`: selected 341 kg remains above the primary button at 1280 and 375; actual choice targets are at least 45 px high.

`compare-and-measure.mjs`: combined full and inspector-crop reference comparison, followed by a bounded frame sample from the actual paused production scene and HTTP byte/hash check of the built candidate GLB. The first performance sample had concurrent browser work and is diagnostic; the second sample is isolated. Both remain evidence, and neither proves gameplay FPS or enjoyment.

Blender: `blender -b -t 1 --python art/factory/crashsite-hybrid-v1/build_crashsite.py`; source reopened and asset objects/transforms checked. First denoising attempt failed on this Blender build (log retained); disabling unsupported denoising yielded all three verified previews. `asset-browser-import.mjs` initially lacked an import map for Three.js; the corrected detached GLTFLoader run passed. This is explicitly not an in-game capture. The candidate is served by the normal build with its exact SHA and byte count.

Independent read-only reviewer `/root/ui_ceramic_readonly_review`: translation map and HTML bindings checked, Bootstrap/input copy-only diff checked, existing authority and closed asset-loader boundaries inspected, GLB manifest/hash/parts/turret count independently inspected. Reviewer did not run browser/Blender or claim those executions as independent verification. DevToolbox/game-dev CLI were unavailable for this worktree; native tools and equivalent source/evidence checks were used.

Clean-copy install/build/start: `npm ci --cache /workspace/.cloud-setup/npm-cache`, `npm run build`, `npm exec -- vite preview --host 127.0.0.1 --port 5192 --strictPort`, then `clean-copy-smoke.mjs`. All exit 0. Browser source/public/Factory art are materialized; an unrelated historical modular-ship LFS pointer is excluded and recorded, rather than included as a false native payload. The full Factory sources and public assets contain no LFS pointer-only model/image files.
