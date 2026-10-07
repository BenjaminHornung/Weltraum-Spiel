# A-CUT-V3 recovery — 2026-10-05

Overall status: **INCOMPLETE**. This is recovery evidence, not B1/B2/B3 or P01–P06 acceptance.

## Source and owner

- Parent/thread: `01a10b34-b3c6-72f2-8b55-e72bc1011e51`; Paseo owner `af3b10f8-1d75-4a00-add5-a3e3daf106e6`; sole product writer `/root`.
- Verified commit and fetched remote feature HEAD: `0bfd1e67117d0dd6184e592e9a2a1b8b9f58241a`.
- New worktree: `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05`.
- New branch: `feature/resume-hvp-cut-v3-2026-10-05`. Ruling: use the required repository `feature/` prefix rather than the package's older `codex/` example; preserve its exact resume anchor and dedicated-branch intent.
- Main checkout remains on `spike/threejs-core-port-v1`, SHA `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`, with 444 pre-existing status entries. No reset, clean, stash or existing-branch mutation.

## Old writers and local deltas

- Former integrator `6751cdad-e66f-4709-936d-c87669c762f5` and former A/P01–P06 coordinator `a9f6838d-2de2-42b3-b172-7581b47c7a71` were archived through Paseo; both operations returned `success: true`.
- Existing P01–P06 children and former B1–B3 implementer were already archived; prior fresh reviewer was closed. B/C work is outside this takeover.
- Completion worktree retains anchor HEAD; its only untracked entries were `.opencode/` and `.playwright-mcp/`. They remain untouched and are not packaged.
- Private mesh worktree retains `85c2c4c338718c76f51bff175bae09674aceae9a`. Its four task-owned code/test files were copied byte-for-byte into `inputs/private-mesh-snapshot/` before retirement. B1 explorer later verified all four are already tracked, clean and byte-identical at the resume anchor; no recopy is needed. Productive wiring remains absent:

| App-relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/hestia-prototype/presentation/bodyMeshAdmission.ts` | 5734 | `cdf98185c9963302ffa066b209f905d16eff8ef48b96251849d5cf2dbab12734` |
| `src/hvp/hvpCoastMesher.ts` | 54436 | `809f2974ffd22e578f277bedb9af81502109a96f4d38fc82eaec89878a22439b` |
| `src/workers/hvpBodyMeshJob.ts` | 27669 | `8a0cc86d5a08251112166bcf049262f7c4cd72030e690e36cead69d67246e175` |
| `tests/unit/hvpBodyMeshJob.test.ts` | 19334 | `a75a31b2dc9e21d586cf34b442bea38e7e2884e0a72f882e4e7d294ff9fc4bcc` |

Post-retirement scoped Win32_Process inspection excluded its own shell and returned no matching task processes. The completion worktree's Paseo terminal inventory was empty. This bounded ownership check does not claim unrelated machine-wide CPU/GPU quietness. No native process was killed.

## Recovered inputs and current evidence level

- Uploaded restart ZIP: all 23 manifest-listed files verified for SHA-256 and byte length; 24 document entries safely extracted. Together with four private mesh files, 28 copied inputs were verified into this worktree. No uploaded code was executed.
- The immutable V3 ExecPlan was read fully. Independent reviewer `/root/resume_review` confirmed its current terminal status and exact outstanding F1/Runner evidence pointers via `git show` at the anchor; preflight returned successfully. R02 had no retrieved final and stays NOT_PROVEN. Fresh R03 independently accepted the bounded F1/Runner/privacy source scope (A01-REVIEW-R03.md).
- Earlier PASS values are **REPORTED_PASS**, not current **FRESH_PASS**. Structural/Terrain 5000-ms failures, Owner65 outer-180 unknown completion and combined Reporter/Bootstrap unknown completion remain unresolved. B1/B2 activation remains off.
- The confirmed `SystemInfo.getInfo` full-response persistence defect was repaired with an explicit six-field GPU allowlist. Genuine RED then 54/54 GREEN and full type PASS are retained; R03 independently accepted the exact3 source patch. Later collector execution still requires its own bound runtime evidence.
- `A0-B1-INTEGRATION-NEXT-PLAN-20261003-01.md` is present under the known coordination directory. User subsequently supplied `HESTIA_V3_GESAMTAUFTRAG_2026-09-23.md`: copied byte-for-byte into `inputs/`, 109007 bytes / 1188 lines, SHA-256 `c14ca2feda62aa681e3de7675f66df3ad2f8fb5b816eb31b5f6fb58335cd7f2b`, fully read. The provided filename differs from the old `_1_` pointer; no unobserved byte-identity assertion is made for that unavailable filename. Original contract coverage is now possible and still must be proved requirement by requirement.
- Existing dependency versions match the package (Vitest 4.1.11, Vite 8.1.5, TypeScript 7.0.2, Rapier 0.12.0, Playwright 1.61.1). Pinned Node `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe` verified as 22.23.2. Default system Node 26.2.0 is not used for task checks. The private dependency copy has all 3758 files and matching hidden lock; its first interrupted copy's exit remains UNKNOWN, followed by a known additive completion of 775 missing files. No shared junction, installation, package edit or upgrade.

## A01 closeout evidence

Existing CDP persistence was extracted without changing its payload, then synthetic canary RED proved two leaks in the complete reporter file (51 PASS / 2 FAIL). The initial sandbox launch error was not a functional RED. The final identity/driver allowlist passes the complete 54-test file and full typecheck; the direct independent source/receipt review R03 is accepted within declared coverage, see `A01-REVIEW-R03.md`. This permits later collector use only after its other owning prerequisites; it is not B1/B2/B3 or performance acceptance.

## A02 current baseline

Isolated unchanged Structural and Terrain cases pass within their original 5000-ms deadline. The exact complete Structural54 population still reproduces 53 PASS / 1 timeout at 5084.0786 ms. Complete Terrain4 passes with Native exit 0; its release tree is proven, but the separate parent cleanup observation was late and retains FAIL_LATE_OBSERVATION. Fresh complete Owner65 again stops UNKNOWN at the unchanged native 180-s boundary, without final JSON/counts; owned tree is absent, late cleanup observation retained. Do not turn partial stdout into completion. Reporter/Bootstrap whole-r01 is the next bound baseline.

## Next dependency

Complete A00 source binding and tracking, then A01 independent correction review and explicit CDP metadata privacy repair. Reproduce A02 unchanged tests with complete reports; do not start 42/1400 or claim a product gate from recovery.
