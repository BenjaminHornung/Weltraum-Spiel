# Browser Graphics Settings Foundation V1 Evidence

## Result

The browser mainline now has a versioned, persisted graphics-preference contract, a truthful capability model, an accessible player-facing dialog, and a narrow Three.js presentation adapter. The implementation started from `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c` and is integrated against `ea4ccbadfa8c91787e4b4451e04b1fb4ad18a12f` on `feature/browser-graphics-settings-foundation-v1`.

## Settings contract

- Storage key `weltraum.browser.graphics-settings`, schema version 1.
- Low, Medium, High, and Ultra produce deterministic concrete values; a changed preset-owned value derives Custom.
- High is the documented compatibility default. FOV, FPS limit, and fullscreen preference are preserved when switching presets.
- Unknown, malformed, non-finite, out-of-range, and future-version payloads fail closed to defaults without a startup overwrite.
- Apply persists before runtime application, Cancel restores the confirmed snapshot without saving, and Reset stages defaults until Apply.
- Public controller snapshots are deeply immutable.

## Capability and runtime truth

Supported live application covers render scale/max DPR, perspective-camera FOV, camera-only render distance, presentation FPS limit, tone mapping, exposure, supported anisotropy, and tagged render-only decor density. Anti-aliasing is separated into desired and actual values and reports renderer recreation/reload when they differ.

Fullscreen and VSync are browser-managed. Shadows are Planned while the current scene lacks an effective caster/receiver chain. Environment/reflection quality and texture-asset variants are also Planned. Bloom and motion effects are Unsupported without a post-processing pipeline. None of these states is reported as live applied.

The presentation scheduler gates only `renderer.render`; simulation and HUD updates remain on every animation frame. Render distance changes only the perspective camera, and density changes touch only explicitly tagged render decoration. Unit evidence compares an exact gameplay snapshot before and after adapter application. Normal browser evidence preserves idle throttle/speed/fuel/status/distance and a visible locked plan hash across Apply.

## Player UI

The visible Graphics action opens a native modal dialog in the existing dark navy/cyan visual language. It presents preset and individual controls, pending/applied/restart states, requested versus actual values, and capability reasons. Unsupported and Planned controls are disabled, the AA restart state is amber, keyboard focus is visible, and normal Flight/Camera input is blocked while the dialog is open. The Navigation Planner and Graphics dialog are mutually exclusive.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 59 packages, 0 vulnerabilities; lockfile unchanged; `package.json` only registers the Graphics E2E spec as authorized by the user |
| `npx tsc -p tsconfig.json` | PASS | no diagnostics |
| Focused Graphics unit tests | PASS | 5 files, 30 tests |
| UI E2E group | PASS | 12 tests; Graphics assigned exactly once |
| Focused Graphics E2E | PASS | 3 normal `/` tests, no TestBridge |
| CI E2E group inventory | BASELINE FAIL | Graphics is assigned exactly once; current `origin/main` already leaves unrelated `combat-weapon-damage-core.spec.ts` unassigned |
| Full unit suite | PASS | 54 files, 577 tests |
| Production build | PASS | 66 modules; chunk-size warning only |
| Full browser E2E | PASS | 49 tests |
| `.NET` build/test | NOT APPLICABLE | `Weltraum Spiel.sln` and all `.sln`/`.slnx`/`.csproj` files are absent |
| Unity | NOT RUN | explicitly excluded by the change request |
| DevToolbox completion | BLOCKED | `workspace_prepare_for_agent` rejects the isolated worktree as `unauthorized_path`; task boxes remain open |

The machine policy blocks Playwright's bundled `chrome-headless-shell.exe` with `spawn UNKNOWN`. The repository-supported installed Google Chrome fallback was used on isolated port 5174. An early full run exposed missing locally smudged baseline images; after selectively fetching the four already tracked LFS objects, the final post-rebase run passed 49/49. Test-generated changes to unrelated evidence files were discarded.

## Screenshot matrix

| State | Dimensions | SHA-256 |
| --- | --- | --- |
| Panel baseline | 1920x1080 | `f3a156e3ebfc36650ef4b89a0b3492d6588a06c9af904a790d0330456232be8f` |
| Low runtime | 1920x1080 | `ecd4ba6fa4b5613e2f74f54be9ba4ec54f6f4ca5469c62c785ed6ba35acf072b` |
| High runtime | 1920x1080 | `9c0492acc0dbdae499e83d77b13031133686815c35ef88a08867407ac8af8eeb` |

Visual inspection confirms readable labels, no clipped controls or HUD collision, visible keyboard focus, distinct muted/restart-required states, and an unobstructed central scene after closing the dialog. The screenshots are real runtime captures; no whole-page animated-scene pixel comparison is used.

## Scope and limits

The final feature diff is restricted to the original user allowlist plus the explicitly authorized one-line `apps/weltraum-browser/package.json` registration for `tests/e2e/graphics-settings.spec.ts`; the lockfile remains unchanged. `Assets/**`, gameplay domains, TestBridge code, and protected roadmap/index files remain unchanged. The renderer remains projection-only and owns no gameplay or world truth.

Anti-aliasing needs renderer recreation, so a reload is required. Fullscreen transitions and VSync remain browser-controlled. Shadows, environment/reflections, texture variants, bloom, and motion effects cannot be applied until the corresponding scene or renderer pipeline exists. The strict E2E group inventory is still red on this branch for the same pre-existing Combat assignment gap as `origin/main`; this scoped change does not alter Combat. DevToolbox verification and task closure remain pending until that service authorizes the isolated worktree.
