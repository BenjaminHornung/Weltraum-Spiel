# RD-00 terminal handoff

Implemented and freshly verified lab-only candidate. ProductIntegrated=false. HEAD acceptance is PENDING; no Product- or Art-ACCEPT. No delegation, push, PR, merge, deployment, product install or DevToolbox Change/Execution. Shared contracts/config/lock/registration ownership transfers to HEAD at terminal notification.

## Immutable identities

- Worktree: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00`
- Branch: `feature/hestia-rd-rd00-2026-10-02`
- RD start: `807e8b4cc4528bd9d02122109e08e2e869305047`
- Product read base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`
- Product read tree: `cdf8a92b17eecd764bac4588054167bd566485f1`
- **Code/config/test candidate: `94b5e17ee13bfca27607c515bb1b37c8cdea6d28`**
- **Candidate tree: `b0075bfedbe3590b0c2f4fbe2fb368d193ea4d65`**

This code freeze is the parent of a report-only receipt commit adding the three paths below. Its final HEAD/tree and post-commit checks are recorded outside Git at `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/terminal-receipt.json` and in the terminal notification, avoiding a self-referential commit hash. No frozen runtime/config/test bytes are changed by that receipt.

## Exact changed paths

All candidate paths are new (27); nothing existing at RD start was changed:

- `experiments/hestia-rd-2026-10-02/.gitignore`
- `experiments/hestia-rd-2026-10-02/docs/coordination/RD-00-CONTRACT-FREEZE.md`
- `experiments/hestia-rd-2026-10-02/index.html`
- `experiments/hestia-rd-2026-10-02/package-lock.json`
- `experiments/hestia-rd-2026-10-02/package.json`
- `experiments/hestia-rd-2026-10-02/playwright.config.ts`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/EXECPLAN.md`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/collect-evidence.mjs`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/inspect-b3.mjs`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/managed-processes.json`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/native-ts-smoke.mts`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/preflight.mjs`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/run-command.mjs`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/verification.json`
- `experiments/hestia-rd-2026-10-02/scripts/verify-boundary.mjs`
- `experiments/hestia-rd-2026-10-02/src/contracts/controlFixture.ts`
- `experiments/hestia-rd-2026-10-02/src/contracts/experiment.ts`
- `experiments/hestia-rd-2026-10-02/src/contracts/fixture.ts`
- `experiments/hestia-rd-2026-10-02/src/contracts/result.ts`
- `experiments/hestia-rd-2026-10-02/src/contracts/scenario.ts`
- `experiments/hestia-rd-2026-10-02/src/contracts/validation.ts`
- `experiments/hestia-rd-2026-10-02/src/registration.ts`
- `experiments/hestia-rd-2026-10-02/tests/RD-00/browser.spec.ts`
- `experiments/hestia-rd-2026-10-02/tests/RD-00/unit.test.ts`
- `experiments/hestia-rd-2026-10-02/tsconfig.json`
- `experiments/hestia-rd-2026-10-02/vite.config.ts`
- `experiments/hestia-rd-2026-10-02/vitest.config.ts`

Report-only receipt delta (3 new paths):

- `experiments/hestia-rd-2026-10-02/reports/RD-00/finalize-handoff.mjs`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/HANDOFF.md`
- `experiments/hestia-rd-2026-10-02/reports/RD-00/handoff.json`

## Frozen exports

| File under the lab | Public boundary |
|---|---|
| `src/contracts/fixture.ts` | `LabFixtureV1`, `LabFrame`, `SourceRef`, `LabPresentationProfile`, `LabObject`, `LabVoxelRegion`, `LabPayload`, `PayloadElementType`, `LabTypedPayload`, `Vec3`; `importFixture`, `getFixtureDigest`, `fixtureRevision`, `copyFixturePayload`, `readVoxel`, `validateSourceRefs` |
| `src/contracts/experiment.ts` | `LabFrameInput`, `LabWeatherSample`, `LabExperimentHandle`, `LabExperimentFacts`, `LabExperimentContext`, `LabExperimentFactory`, `LabPreset`; `createFrameInput`, `validateWeather`, `validateFacts`, `mountExperiment`, `registeredMountCount` |
| `src/contracts/scenario.ts` | `LabScenarioV1`, `LabKeyframe`; `createScenario`, `importScenario`, `sampleScenario`, `getScenarioDigest`, `createControlledClock` |
| `src/contracts/result.ts` | `LabMetric`, `LabRunResultV1`; `validateMetric`, `createRunResult`, `importRunResult` |
| `src/contracts/controlFixture.ts` | Diagnostic-only `controlManifest`, `createControlScenario`; not the RD-02 F00/F01 generator |
| `src/registration.ts` | `LabRegistration`, static `LAB_REGISTRATIONS`, `startControlPage` |

`validation.ts` is the shared bounded JSON implementation. No renderer objects,
product World/Save handles, dynamic module loader or executable scenario content
cross these boundaries. All V1 field lists are strict; there is no unknown-field
extension bag. HEAD alone owns contracts, registration, package/lock/config after
terminal handoff. Leaves request exact deltas rather than editing shared files.


See `docs/coordination/RD-00-CONTRACT-FREEZE.md` for the six steering answers and RD-03 material authority. Fixture import checks 1 MiB JSON and aggregate 128 MiB payload limits before copy/decode; SHA-bound typed endian bytes are privately owned. knownCoverage is not occupancy, unknown is not air. Snapshot sourceRevision is not max(owner revision); semantic sourceDigest is separate from source byte SHA. Source declarations validate shape, not native Git authenticity: RD-02 still proves F01/export provenance.

## Fresh gates and RED → GREEN

| Check | Result | Evidence label |
|---|---|---|
| BC00/BC01/C00/C01 RED | EXPECTED FAIL: four genuine assertion failures, exit 1 | red |
| Reproducible isolated npm ci | PASS, 52 packages | ci-final |
| check | PASS | check-boundary-review |
| Unit | PASS, 13/13 including original four IDs | green-boundary-review |
| build | PASS | build-final |
| Browser built-dist functional diagnostic | PASS, 1/1, no errors, final mounts 0 | browser-final |
| Native Node TS strip probe | PASS, not product exporter proof | native-ts |
| Authored staged whitespace | PASS; original input hardbreaks excluded | authored-whitespace |
| Frozen bytes vs working tree/index | PASS, 18 files | frozen-index |
| Staged and committed boundary | PASS scoped, explicit narrow exception below | boundary-staged / boundary-committed |
| Post-cleanup strict 5280 bind/close | PASS | port-candidate |

Unsafe RED implementation/test bytes are retained only at `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/red-source-snapshot.json`, not in the candidate. RED was not an import failure. Frozen code/config/tests still match the fresh verification snapshot and committed blobs. No test threshold or source profile was relaxed to pass. Self-review found and fixed the ignored-outside-file boundary inventory; focused checks/13 unit tests were rerun afterward. Review is self-review only; no independent or human review was requested/run.

## Input/source bindings and boundary deviation

52 original input payloads match MANIFEST byte counts/SHA-256. RUN, coordination EXECPLAN, coordination .gitattributes and MANIFEST match their RD-start Git bytes. Full bindings and all 18 frozen file hashes are in `handoff.json`; earlier gates/artifact hashes are in `verification.json`. Historical root mainline state was read as history, not substituted for b3. Six named b3 source blobs/bytes were read and hashed, never executed; exact bindings are included in the receipt.

Committed product tree delta outside the lab is empty. Boundary inventories committed vs b3, delta vs RD start, staged/unstaged/untracked (also ignored outside-lab files), pinned bytes and link/reparse escape. Scope result is PASS with zero violations. The original all-files gate remains **FAIL_ACCEPTED_NARROW_EXCEPTION**, not clean PASS: only the explicitly user-authorized UNTRACKED regular contained automatic `.opencode/throughput.jsonl` and `.opencode/throughput.md` remain. They were not read for content, edited, deleted, moved, staged, committed or published. Third files, tracked/staged/committed copies and link/junction names still fail; real negative oracles prove this. No global collector/config/plugin/cache repair or claim that collectors stopped. External owned runs/oracles are retained artifacts, not product mutations.

## Diagnostic media, numbers and limitations

- Browser result: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/browser/browser-final-1790957974117/result.json`
- Browser byte bindings: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/browser/browser-final-1790957974117/byte-bindings.json`
- Diagnostic state: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/browser/browser-final-1790957974117/diagnostic.json`
- Playwright report: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/browser/browser-final-1790957974117/report.json`
- Screenshot: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/media/browser-final-1790957974117.png`, SHA-256 `d422203cae17c3bd1ba0b2f58153524fc5632b0dcf83b2c508c8699c70f1c0ca`
- Fixture digest: `0d0ba30a507234fe6f8f7b497eb35e0339ddc37e317932c3d130a89cd99f3192`
- Scenario digest: `feb3bd66913e3af1ba6ffc33052b52e5dbf8e30a531d6140f80c1d8936e656bd`
- Source byte digest: `504fa088873444d91d6bc2a154035a7569e15e4b4ff34d6778ec6ed789621efa`
- Build digest: `8715033cff178a1e416bc9544c84c3f1a7769345eaa47a273c1af4ca9eb71b85`
- Lock digest: `2fc41f22007c1b72e573c0021e45fb7e5d10a9a1ff41db143e5669b2cd9de3d9`

Visible UI exercised mount/doublemount, advance, pause, seek, replace, reset, dispose twice, remount/dispose; one canvas, no TestBridge. Screenshot/self-view and state match tick 90, seconds 1.5, paused=true, sourceRevision=1. The test compares actual HTTP HTML/assets with built bytes and fixture/scenario digests with the same control inputs. Samples: planned=1, observed=1, skipped=0, failed=0, diagnostic/process-cold. CPU/frame/GPU timing, upload and CPU memory are not-run; native GPU memory/driver unsupported. Unavailable metrics have NO value key, not zero/null. Browser smoke is not a qualified selection benchmark. GPU benchmark, F01 export, Three rendering, art and product acceptance are NOT_RUN.

Bundle/dependency basis only: build emitted index.html 2.04 kB (gzip 1.03) and JS 22.82 kB (gzip 8.12); 13 modules, no Three host yet. These are CLI bundle facts, not performance gains. Exact pins: Three 0.185.1, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.11, Playwright 1.61.1, @types/node 26.1.1. No Rapier/Babylon/@types/three. Initial plain npm install failed (npm 10.9.8 optional-peer Arborist edgesOut/null bug); --legacy-peer-deps isolated install and fresh ci passed. This flag is required for the demonstrated reproduction, not a global npm configuration change. RD-03 asks HEAD for any concrete Three type dependency delta.

## Start/reproduce

Working directory for every command: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`. `run-command.mjs` supplies the process-local C-only PATH, pinned pwsh script shell, and assigned TMP/cache/browser paths (exact values in command records); it logs raw output and exit codes. Required tools/versions were verified by preflight: Node 22.23.2, npm 10.9.8, Git 2.56.0.windows.1, Python 3.12.13, pwsh 7.6.4, Chromium 151.0.7922.34. Tool paths remain pinned in unchanged RUN.json.

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-ci npm ci --legacy-peer-deps --no-audit --no-fund
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-check npm run check
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-unit npm run test:unit -- tests/RD-00
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-build npm run build
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-boundary npm run verify:boundary -- --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-port node ./scripts/verify-boundary.mjs --port-check
```

Only after the free-port check, start the following command via the managed background-process launcher (shell C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe; same CWD and processLocal environment; NO_COLOR=1, FORCE_COLOR=0; readiness pattern http://127\.0\.0\.1:5280/; timeout 15000 ms; max runtime 120000 ms). No product port fallback:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './node_modules/vite/bin/vite.js' preview --host 127.0.0.1 --port 5280 --strictPort
```

URL: http://127.0.0.1:5280/. During that owned managed server run, execute:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/run-command.mjs' reproduce-browser npm run test:browser -- tests/RD-00/browser.spec.ts
```

Stop only that task by its returned taskId; verify --port-check again. Development uses the same direct Vite command without preview, or npm run dev with the runner's process-local shell environment. Do not run foreground watchers or use another port. preflight.mjs is intentionally START-only, not a post-commit readiness script. The native RD-02 exporter invocation/extensionless-import limitations and NOT_RUN status are documented in the contract-freeze file.

## Cleanup and smallest HEAD/RD-03 takeover

Two owned managed servers were explicitly stopped; cancellation exit 1 is cleanup, not a failed functional gate. Final server bg_mur64fjk_1m/PID19588 served built dist. Owned Chromium PID39156 exited 0 gracefully and removed its temporary profile; no foreign tabs/processes were closed. Raw server logs: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/server-1.log`, `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/server-2.log`; exact launch/readiness/cleanup records: managed-processes.json. Port 5280 is free; registry final count 0. Lab node_modules/dist and owned logs/media/oracles/caches are retained, not deleted. No unresolved RD-00 implementation blocker. Native factory cleanup/generation checking remains each effect's responsibility; the wrapper cannot revoke a factory's leaked resources.

HEAD may take the 27-path candidate plus the 3 report paths; no product merge is proposed or performed here. HEAD thereafter owns shared contracts/config/lock/registration. RD-02 exports genuine byte-bound fixtures/scenarios. RD-03 implements the concrete Three-only one-renderer/scene/camera/renderloop host and borrowed-scene effect seam; solid/water, decoration, particles and view-only passes retain the specific channel authorities in the freeze note. No generic ECS/plugin framework, native renderer/effect implementation or product authority extension was supplied by RD-00.

## Commands / exit codes / raw logs

The exact command ledger is append-only at `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/commands.jsonl`; `handoff.json` is its snapshot through candidate verification. Later report-commit/post-commit records remain in that ledger and `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/terminal-receipt.json`. Earlier failed install, expected RED and initial diagnostic runs are intentionally retained, not hidden. Ordinary read-only file/registry discovery is in the session timeline; all acceptance/install/build/test/commit shell executions use the ledger.

| Label | Exit | Raw log |
|---|---|---|
| preflight | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/preflight-1790954501965.log` |
| install | 1 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/install-1790954534744.log` |
| install-required-peers | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/install-required-peers-1790954619589.log` |
| red | 1 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/red-1790954630684.log` |
| red-snapshot | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/red-snapshot-1790954692263.log` |
| check | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-1790955650392.log` |
| green | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-1790955671148.log` |
| boundary | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-1790955688258.log` |
| build | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/build-1790955792549.log` |
| port-before-browser | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-before-browser-1790955813221.log` |
| browser | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/browser-1790955894897.log` |
| port-after-browser | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-after-browser-1790955987680.log` |
| b3-bindings | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/b3-bindings-1790956091194.log` |
| native-ts | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/native-ts-1790956106231.log` |
| check-steering | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-steering-1790956951407.log` |
| green-steering | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-steering-1790957032762.log` |
| ci-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/ci-final-1790957832010.log` |
| check-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-final-1790957856810.log` |
| green-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-final-1790957884921.log` |
| build-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/build-final-1790957910992.log` |
| b3-bindings-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/b3-bindings-final-1790957925549.log` |
| port-before-browser-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-before-browser-final-1790957935829.log` |
| browser-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/browser-final-1790957978157.log` |
| port-after-browser-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-after-browser-final-1790958028302.log` |
| check-boundary-review | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-boundary-review-1790958767550.log` |
| green-boundary-review | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-boundary-review-1790958800514.log` |
| boundary-final | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-final-1790958819481.log` |
| collect-evidence | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/collect-evidence-1790958899133.log` |
| stage-candidate | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/stage-candidate-1790959354655.log` |
| authored-whitespace | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/authored-whitespace-1790959390003.log` |
| reviewed-diff | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/reviewed-diff-1790959408563.log` |
| frozen-index | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/frozen-index-1790959511087.log` |
| boundary-staged | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-staged-1790959527487.log` |
| commit-candidate | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/commit-candidate-1790959553348.log` |
| boundary-committed | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-committed-1790959596737.log` |
| port-candidate | 0 | `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-candidate-1790959739630.log` |

### preflight — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/preflight.mjs'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/preflight-1790954501965.log`; SHA-256 `e991d3ff2dca5e2cbb0e97de0f637643e668d644a7bb80c324fa751508f8b600`.

### install — exit 1

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'install' '--no-audit' '--no-fund'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/install-1790954534744.log`; SHA-256 `1f45eb5e54699a08f071b6a72f43d9080604fa7dc297daaf7d507769cabeb588`.

### install-required-peers — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'install' '--legacy-peer-deps' '--no-audit' '--no-fund'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/install-required-peers-1790954619589.log`; SHA-256 `0192d9ae5a4664d833069d4a2884376c0235e712fff35d0b872a11a76b33f402`.

### red — exit 1

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:unit' '--' 'tests/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/red-1790954630684.log`; SHA-256 `e1eba785dbd3fbccfe78f00fa5bc15b84a0f0311c6e993ba563013ea421205ff`.

### red-snapshot — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' '--input-type=module' '-e' 'import {readFileSync,writeFileSync} from "node:fs"; import {createHash} from "node:crypto"; const paths=["tests/RD-00/unit.test.ts","src/contracts/fixture.ts","src/contracts/experiment.ts","src/contracts/result.ts","scripts/verify-boundary.mjs"]; const entries=paths.map(path=>{const bytes=readFileSync(path);return {path,sha256:createHash("sha256").update(bytes).digest("hex"),base64:bytes.toString("base64")};}); writeFileSync("C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/red-source-snapshot.json",JSON.stringify(entries,null,2)); console.log("RED sources and test bytes preserved");'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/red-snapshot-1790954692263.log`; SHA-256 `4eb1ae3a43607729dd84139fdf6f250523e7a619c328f26076fcd6aeb625cf32`.

### check — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-1790955650392.log`; SHA-256 `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252`.

### green — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:unit' '--' 'tests/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-1790955671148.log`; SHA-256 `66baa443da5397a353c72402b806708b20fb6b16e891a64e9a0e9c30e875d150`.

### boundary — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'verify:boundary' '--' '--base' 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-1790955688258.log`; SHA-256 `7474be13935f04571960ec226acb9021f573a9994d0715868e08c2c1a7657ce0`.

### build — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'build'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/build-1790955792549.log`; SHA-256 `8e3c9b684ceeb55a111a4be89a7034e2274601b961dd0cd3e9386afb08fc93d5`.

### port-before-browser — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' '--port-check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-before-browser-1790955813221.log`; SHA-256 `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc`.

### browser — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:browser' '--' 'tests/RD-00/browser.spec.ts'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/browser-1790955894897.log`; SHA-256 `d75f843e7a9a266082215b7335e82fd03c6a2359a93914691913a8066fa0cb51`.

### port-after-browser — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' '--port-check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-after-browser-1790955987680.log`; SHA-256 `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc`.

### b3-bindings — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/inspect-b3.mjs'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/b3-bindings-1790956091194.log`; SHA-256 `6632794ce614875748272bdac9c1923ec0c7a86747e9ad5fa1b1122be02f48bd`.

### native-ts — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' '--experimental-strip-types' './reports/RD-00/native-ts-smoke.mts'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/native-ts-1790956106231.log`; SHA-256 `8a98dd3e3785ebce75ecfd74d1ad20cd7374257fc03d326d2fdc5d574cd81b81`.

### check-steering — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-steering-1790956951407.log`; SHA-256 `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252`.

### green-steering — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:unit' '--' 'tests/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-steering-1790957032762.log`; SHA-256 `72ade2038f48f01dc1db9645de16ee540f290e66b5ac7083e8afdfcd40e925b3`.

### ci-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'ci' '--legacy-peer-deps' '--no-audit' '--no-fund'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/ci-final-1790957832010.log`; SHA-256 `0192d9ae5a4664d833069d4a2884376c0235e712fff35d0b872a11a76b33f402`.

### check-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-final-1790957856810.log`; SHA-256 `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252`.

### green-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:unit' '--' 'tests/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-final-1790957884921.log`; SHA-256 `088416275cdf0d34f0304e3419d3d14c3ed0f61963026cc564e84437bab76a7b`.

### build-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'build'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/build-final-1790957910992.log`; SHA-256 `7f5ce943f36b51c5c1798171c1a5caf69e783561f52321bf6ed781eeb9744083`.

### b3-bindings-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/inspect-b3.mjs'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/b3-bindings-final-1790957925549.log`; SHA-256 `9bfe88da95b0094022d9e1b44e3f73aa1c037bd0bb758558b616f60fd92af4bf`.

### port-before-browser-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' '--port-check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-before-browser-final-1790957935829.log`; SHA-256 `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc`.

### browser-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:browser' '--' 'tests/RD-00/browser.spec.ts'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/browser-final-1790957978157.log`; SHA-256 `ab991755c14551864aab799a97fed6065e0349a54f777eac9ee25d2b603461d8`.

### port-after-browser-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' '--port-check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-after-browser-final-1790958028302.log`; SHA-256 `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc`.

### check-boundary-review — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/check-boundary-review-1790958767550.log`; SHA-256 `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252`.

### green-boundary-review — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'test:unit' '--' 'tests/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/green-boundary-review-1790958800514.log`; SHA-256 `0f6c16adda7f1bf9475632e7c57c364589378fbed238ae773bd99cf42a4c35a7`.

### boundary-final — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'verify:boundary' '--' '--base' 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-final-1790958819481.log`; SHA-256 `1a2a130912850a012f515def70a1f7899160c7b92884dde828de540fb423cd21`.

### collect-evidence — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './reports/RD-00/collect-evidence.mjs'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/collect-evidence-1790958899133.log`; SHA-256 `802a1ab43f03f9b338cca8db602cc02bfd805fd9a43cfa12fe3bdda40d7990aa`.

### stage-candidate — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe' 'add' '--' '.gitignore' 'index.html' 'package-lock.json' 'package.json' 'playwright.config.ts' 'tsconfig.json' 'vite.config.ts' 'vitest.config.ts' 'src/contracts' 'src/registration.ts' 'scripts/verify-boundary.mjs' 'tests/RD-00' 'docs/coordination/RD-00-CONTRACT-FREEZE.md' 'reports/RD-00'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/stage-candidate-1790959354655.log`; SHA-256 `6a105ba42749dd0068365058dd0d2fad05e36d27fbb36ad3482700789b743d33`.

### authored-whitespace — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe' 'diff' '--cached' '--check' '--' '.'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/authored-whitespace-1790959390003.log`; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

### reviewed-diff — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe' 'diff' '--cached' '--no-ext-diff' '--no-textconv' '--' 'src/contracts' 'src/registration.ts' 'scripts/verify-boundary.mjs' 'tests/RD-00' '.gitignore' 'index.html' 'package.json' 'tsconfig.json' 'vite.config.ts' 'vitest.config.ts' 'playwright.config.ts' 'docs/coordination/RD-00-CONTRACT-FREEZE.md' 'reports/RD-00/EXECPLAN.md' 'reports/RD-00/run-command.mjs' 'reports/RD-00/preflight.mjs' 'reports/RD-00/inspect-b3.mjs' 'reports/RD-00/native-ts-smoke.mts' 'reports/RD-00/collect-evidence.mjs' 'reports/RD-00/managed-processes.json'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/reviewed-diff-1790959408563.log`; SHA-256 `4b26c860c2fd61835033e46f983f31c63ae2066ba6fca6049e70a94faf990076`.

### frozen-index — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' '--input-type=module' '-e' 'import assert from "node:assert/strict"; import {readFileSync} from "node:fs"; import {createHash} from "node:crypto"; import {execFileSync} from "node:child_process"; const git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe"; const lab="experiments/hestia-rd-2026-10-02/"; const sha=b=>createHash("sha256").update(b).digest("hex"); const evidence=JSON.parse(readFileSync("reports/RD-00/verification.json","utf8")); for (const entry of evidence.frozenFiles) { assert.equal(sha(readFileSync(entry.path)),entry.sha256,entry.path+" disk changed"); assert.equal(sha(execFileSync(git,["show",":"+lab+entry.path])),entry.sha256,entry.path+" index changed"); } const files=execFileSync(git,["diff","--cached","--no-renames","--name-status"],{encoding:"utf8"}).trim().split("\n"); assert.equal(files.length,27); assert.ok(files.every(f=>f.startsWith("A\t"+lab))); console.log(JSON.stringify({status:"PASS",frozenFiles:evidence.frozenFiles.length,newLabOnlyFiles:files.length,files},null,2));'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/frozen-index-1790959511087.log`; SHA-256 `2371c09542fa9e2ef35b4661a81b32a0dec9c3a5a6a98d94c14446ebb50d1f35`.

### boundary-staged — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'verify:boundary' '--' '--base' 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-staged-1790959527487.log`; SHA-256 `ec2ca00f0f2f27c35cbe4815f9e3232608bc8675c85074cb8310d68d5db2fcb7`.

### commit-candidate — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe' '-c' 'user.name=Hestia RD-00' '-c' 'user.email=rd00@invalid.local' 'commit' '-m' 'RD-00 Freeze isolated fixture and lifecycle contracts with diagnostic control'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/commit-candidate-1790959553348.log`; SHA-256 `8395fc4cc36084ba1f3df98523e7ed99e400820abe5af7915598dea0163c81f6`.

### boundary-committed — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js' 'run' 'verify:boundary' '--' '--base' 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/boundary-committed-1790959596737.log`; SHA-256 `f233864f00a27f45b2f6dcab38e5c9d6ad237397380d5db8b16323d7127075d0`.

### port-candidate — exit 0

CWD: `C:\IFI_SourceCode\Temp\Hestia-RD-2026-10-02-worktrees\Hestia-RD-RD00\experiments\hestia-rd-2026-10-02`

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' '--port-check'
```

Raw log: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/logs/port-candidate-1790959739630.log`; SHA-256 `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc`.
