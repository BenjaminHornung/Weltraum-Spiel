# Reproduce the bounded native experiment

Use the exact frozen Source in tests/final-r02-binding-source and the retained final-r02 built bytes. package.json/package-lock.json pin the dependencies; installed node_modules are deliberately not included. Preserve relative repository paths, including this Spec's probes. All programs on this machine must run under C:\IFI_SourceCode with the approved existing Node22/Chromium151 binaries, no installs or PATH Node26.

From the isolated apps/weltraum-browser working directory set WELTRAUM_PROBE_BUILD_DIR to the retained build and WELTRAUM_HVP_MEASURE_DIR to a fresh absent directory. Invoke the pinned node.exe with node_modules/@playwright/test/cli.js test --config ../../.devtoolbox/specs/changes/hestia-cut-source-gates-2026-10-07/probes/playwright.config.mjs --grep draw-on --max-failures=1.

B: WELTRAUM_PROBE_VARIANTS=direct,owned-moving; WELTRAUM_PROBE_PAIRS=10; WELTRAUM_PROBE_TERRAIN_REPEAT=0. C: variants=owned-moving,owned-terrain; pairs=10; terrain-repeat=1. Both use one worker, AB/BA ordering, no retries and actual preview-served production bytes. The warm Terrain action is ordinary mouse aiming at the remaining authored pillar, not a Source injection or fake body.

Functional Save check: B/C variants, pairs=1, terrain-repeat=0. Moving fault: WELTRAUM_PROBE_MOVING_FAULT=1 and --grep "owned Moving real"; set WELTRAUM_PROBE_NATIVE_FAULT=0 for real planned-result delay/dispose, or1 for actual self.close Worker exit. The driver waits for a real native child projection before cancellation, checks continuing simulation, releases the delayed reply and requires a fresh recovery. Fault diagnostics do not enter latency statistics.

Use bind-production.py freeze before new measurement (new output path) and verify afterward. Source/build changes require a new revision. summarize.py recalculates markers; RESULTS.json lists all failed attempts. package-evidence.py checks ZIP CRC, anchored manifest, every byte count/hash, uniqueness and safe relative paths. Original sealed predecessor is unchanged. Never use this package as proof of14 populations, formal42/1400 or Planner-final completion.
