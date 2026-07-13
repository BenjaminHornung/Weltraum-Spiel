# Test Protocol — Browser Combat Weapon Damage Core v1

## Status

Implementation and executable verification are complete. The local task checklist is manually closed under the user's explicit override; Unity and dotnet are not part of this Browser-only slice and SHALL NOT be started for it.

## DevToolbox workflow limitation

The available DevToolbox MCP authorizes workspaces only below `C:\IFI_SourceCode\AzureDevOps`. This isolated repository is at `C:\IFI_SourceCode\Temp\WeltraumSpiel`, so `workspace_prepare_for_agent` and subsequent Spec/Task/Execution calls would fail with `unauthorized_path`.

Fallback for this change:

1. Maintain `proposal.md`, `design.md`, `specs/default/spec.md`, `tasks.md`, and this protocol manually in the change directory.
2. Record command, exit code, and focused evidence in this protocol after execution.
3. Close the local task checkboxes manually only under the user's explicit instruction after all executable evidence and reviews pass.
4. Do not call `tasks_toggle` or claim that DevToolbox completion preflight ran; record the manual closure exception explicitly.
5. If the workspace becomes authorized later, run `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load`, `execution_create`, `verify_run`, and `tasks_completion_preflight` to reconcile the formal DevToolbox state.

## Unit acceptance matrix

The five focused suites SHALL cover all required cases:

| # | Required case | Focused suite |
| ---: | --- | --- |
| 1 | valid Fixed-weapon shot | `combatFireControl.test.ts` |
| 2 | valid Turret shot | `combatFireControl.test.ts` |
| 3 | no Target | `combatFireControl.test.ts` |
| 4 | Target outside range | `combatFireControl.test.ts` |
| 5 | Target outside arc | `combatFireControl.test.ts` |
| 6 | Turret not aligned | `combatFireControl.test.ts` |
| 7 | cooldown active | `combatFireControl.test.ts` |
| 8 | Ammo empty | `combatFireControl.test.ts` |
| 9 | Energy insufficient | `combatFireControl.test.ts` |
| 10 | Weapon overheated | `combatFireControl.test.ts` |
| 11 | fire permission denied | `combatFireControl.test.ts` |
| 12 | line of fire blocked | `combatFireControl.test.ts` |
| 13 | deterministic blocker ordering | `combatFireControl.test.ts` |
| 14 | reproducible Projectile motion | `combatProjectiles.test.ts` |
| 15 | correct Projectile lifetime expiry | `combatProjectiles.test.ts` |
| 16 | swept collision finds valid Hit | `combatProjectiles.test.ts` |
| 17 | nearer Hit wins | `combatHitResolution.test.ts` |
| 18 | stable Proxy/axis tie-break | `combatHitResolution.test.ts` |
| 19 | same Beam input yields same Hit | `combatHitResolution.test.ts` |
| 20 | Armor reduces matching Damage | `combatDamage.test.ts` |
| 21 | ElectricalEmp differs from Kinetic by Resistance | `combatDamage.test.ts` |
| 22 | Module becomes Degraded/Disabled | `combatDamage.test.ts` |
| 23 | Destroyed cannot become Operational from further Damage | `combatDamage.test.ts` |
| 24 | no negative states | `combatDamage.test.ts` |
| 25 | no NaN/Infinity output | `combatDamage.test.ts` |
| 26 | canonical event ordering | `combatEvents.test.ts` |
| 27 | identical inputs yield identical signature | `combatEvents.test.ts` |
| 28 | public results recursively immutable | all focused suites |
| 29 | no Renderer/Three.js import in Domain Core | `combatEvents.test.ts` source audit |
| 30 | no caller-input mutation | all focused suites |

Additional mandatory coverage includes hybrid Ammo+Energy atomicity, exact Heat-boundary acceptance, Sphere and AABB authority, collision at lifetime/path boundary, start overlap, owner exclusion, frame mismatch, explicit/unknown/absent Module ID routing, independent Hull/Module penetrating damage, sticky destruction, semantic effects, input arrays in different order, and canonical JSON/signature repeatability.

## Real Browser scenario

`apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts` SHALL:

1. install `console`, `pageerror`, `requestfailed`, and non-success HTTP response collection before navigation;
2. load normal `/` and prove `window.TestBridge` is absent;
3. dynamically import `/src/combat/index.ts` through Vite;
4. select a stable-ID Target, evaluate permission, fire a Projectile, advance to a Hit, apply Damage, and sort/assert Events;
5. run the entire pure-domain scenario twice and require byte-identical canonical JSON and signatures;
6. compare inspected signatures with pinned test constants;
7. prove `window.TestBridge` remains absent and all collected Browser/Network error arrays are empty;
8. write only `evidence/browser-combat-weapon-damage-core-v1-summary.json` and `evidence/browser-combat-weapon-damage-core-v1.md`, with stable ordering and no timestamp, absolute machine path, or screenshot.

## Exact verification commands

Run from the repository root exactly as requested:

```bash
cd apps/weltraum-browser
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/combatFireControl.test.ts
npm run test -- tests/unit/combatProjectiles.test.ts
npm run test -- tests/unit/combatHitResolution.test.ts
npm run test -- tests/unit/combatDamage.test.ts
npm run test -- tests/unit/combatEvents.test.ts
npm run test:e2e -- tests/e2e/combat-weapon-damage-core.spec.ts
npm run test
npm run build
npm run test:e2e
git diff --check
```

Because the final `git diff --check` is issued after `cd apps/weltraum-browser`, it checks the same worktree from the Browser subdirectory. Record each command's exit code and do not omit a failing or skipped step.

## Evidence and scope audits

After the exact commands:

- parse the summary JSON and compare it with the Markdown claims;
- run a source scan over `apps/weltraum-browser/src/combat/**` for Three.js/Renderer/scene/mesh imports;
- compare status/diff against the captured `origin/main` base SHA;
- require every changed path to match one of:
  - `.devtoolbox/specs/changes/browser-combat-weapon-damage-core-v1/**`
  - `apps/weltraum-browser/src/combat/**`
  - `apps/weltraum-browser/tests/unit/combat*.test.ts`
  - `apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts`
  - `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1*`
  - `docs/browser-mainline/combat-weapon-damage-core-v1.md`
- explicitly require no change under `Assets/**`, package/lockfiles, or Browser Flight, Navigation, Runtime, Render, UI, Ship Builder, Resources, or Test Harness paths;
- inspect `git diff --check`, the complete diff, and test exit codes before any completion claim.

No screenshot is required because this change adds no visible Combat runtime. A screenshot or static Combat graphic is not functional evidence.

## Execution record

| Gate | Result | Evidence |
| --- | --- | --- |
| Dependency install | PASS | `npm ci` exit 0; 59 packages installed; 0 vulnerabilities. Existing npm `always-auth` and `email` deprecation warnings are non-failing. |
| Focused TypeScript/unit suites | PASS | `npx tsc -p tsconfig.json` exit 0; five focused Vitest files, 49/49 tests passed. |
| Focused Playwright scenario | PASS | Normal-route Chromium scenario passed, including local and `CI=true` two-run repeats. The pinned deterministic scenario, event, Damage, Projectile, Hit, Packet, and Event identities matched. |
| Full unit suite | PASS | `npm run test` exit 0; 44 files, 493/493 tests passed. |
| Production build | PASS | `npm run build` exit 0; TypeScript and Vite build passed. The existing minified-chunk-size warning is non-failing. |
| Full E2E suite | PASS | Final `CI=true` run passed 45/45 with one worker; final exact default run passed 45/45 with eight workers. Earlier failures were diagnosed as four unhydrated Git LFS comparison PNGs and Browser/Vite timing pressure; the four task-external assets were hydrated and the Combat test received the established bounded `ciTimeout(60_000, 90_000)` without changing semantics. |
| JSON/Markdown evidence inspection | PASS | JSON parses; Markdown agrees with the summary; repeated focused and full runs preserved SHA-256 `3DB6C9EEEEC93298B8C8395F65FD710994FAF975002C46157321D7619DAE50BC` and `679B398B1C7A4C5037BC0A9005885D8290A6B27F0BA6AAA1530E6D653EAFFFBE`; no timestamp, absolute path, screenshot, or volatile duration/browser field is present. |
| Import and allowlist audits | PASS | Exactly 21 feature files remain after removing task-external full-E2E outputs. Combat imports are relative/internal; no production source outside `src/combat/**` imports the module; no forbidden product/package/Unity path changed. |
| Diff review | PASS | Independent source and Browser reviewers returned PASS after fixes; `git diff --check` and supplemental untracked-file whitespace/conflict scans passed. |
| .NET and Unity gates | NOT APPLICABLE | This isolated worktree contains no `.sln`/`.slnx`, and the Browser-only change does not modify Unity scripts, Scenes, or Assets. |
| DevToolbox completion preflight | NOT RUN | Blocked by `unauthorized_path` for current workspace root; the user explicitly waived this gate for manual local checklist closure. |
| Manual task closure override | PASS | The user explicitly directed completion despite the unavailable DevToolbox preflight; all seven evidence-backed local task checkboxes are closed without claiming a DevToolbox run. |

## Git delivery gate

After every executable gate passes and the diff/scope audit is clean, create a commit titled `#WELTRAUM-000 Add browser combat weapon and damage core` with the requested concise body and one line for every actually changed file. Push only to `origin/feature/browser-combat-weapon-damage-core-v1`; do not merge to `main`. The local checklist is manually closed under the user's explicit override; formal DevToolbox preflight remains unavailable and is not claimed as completed.
